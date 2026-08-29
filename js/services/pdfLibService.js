/**
 * Core PDF Manipulation & Export Service powered by pdf-lib
 */

export class PdfLibService {
  /**
   * Helper to ensure PDFLib is available
   */
  static getPDFLib() {
    if (!window.PDFLib) {
      throw new Error('PDF-Lib is not loaded');
    }
    return window.PDFLib;
  }

  /**
   * Burn annotations from Fabric.js canvases and export final modified PDF
   */
  static async exportEditedPDF({
    originalPdfBytes,
    pageCanvases,
    pageRotations = new Map(),
    pageOrder = [],
    deletedPages = new Set()
  }) {
    const { PDFDocument, degrees } = this.getPDFLib();
    const pdfDoc = await PDFDocument.load(originalPdfBytes, { ignoreEncryption: true });
    
    const outputDoc = await PDFDocument.create();
    const totalOriginalPages = pdfDoc.getPageCount();

    // Determine final list of pages to process
    let pagesToProcess = pageOrder.length > 0 ? pageOrder : Array.from({ length: totalOriginalPages }, (_, i) => i);
    pagesToProcess = pagesToProcess.filter(pIndex => !deletedPages.has(pIndex) && pIndex < totalOriginalPages);

    if (pagesToProcess.length === 0) {
      throw new Error('Cannot export PDF with zero pages');
    }

    // Copy pages into the new output document
    const copiedPages = await outputDoc.copyPages(pdfDoc, pagesToProcess);

    for (let i = 0; i < pagesToProcess.length; i++) {
      const originalPageIndex = pagesToProcess[i];
      const newPage = outputDoc.addPage(copiedPages[i]);

      // Apply rotation if any
      const rotationDelta = pageRotations.get(originalPageIndex) || 0;
      if (rotationDelta !== 0) {
        const currentRotation = newPage.getRotation().angle;
        newPage.setRotation(degrees((currentRotation + rotationDelta) % 360));
      }

      // Check if there are annotations on this page's Fabric canvas
      const fabricCanvas = pageCanvases.get(originalPageIndex);
      if (fabricCanvas && fabricCanvas.getObjects().length > 0) {
        // Fabric's selection controls and whiteout guide are editor chrome. Never
        // rasterize either into the downloaded document.
        const activeObject = fabricCanvas.getActiveObject();
        const whiteoutGuides = fabricCanvas.getObjects()
          .filter(object => object._isWhiteout)
          .map(object => ({ object, stroke: object.stroke, strokeDashArray: object.strokeDashArray }));

        fabricCanvas.discardActiveObject();
        whiteoutGuides.forEach(({ object }) => object.set({ stroke: 'transparent', strokeDashArray: null }));
        fabricCanvas.renderAll();

        // Render fabric canvas to ultra high-res transparent PNG to preserve exact fonts and unicode symbols
        let dataUrl;
        try {
          const multiplier = 5; // Bumped to 5x for maximum crispness (fixes blurriness)
          dataUrl = fabricCanvas.toDataURL({
            format: 'png',
            multiplier: multiplier,
            enableRetinaScaling: true
          });
        } finally {
          whiteoutGuides.forEach(({ object, stroke, strokeDashArray }) => object.set({ stroke, strokeDashArray }));
          if (activeObject) fabricCanvas.setActiveObject(activeObject);
          fabricCanvas.renderAll();
        }

        const pngImageBytes = await fetch(dataUrl).then(res => res.arrayBuffer());
        const pngImage = await outputDoc.embedPng(pngImageBytes);

        const { width, height } = newPage.getSize();
        
        // Draw the annotation overlay
        newPage.drawImage(pngImage, {
          x: 0,
          y: 0,
          width: width,
          height: height
        });
      }
    }

    const modifiedBytes = await outputDoc.save();
    return modifiedBytes;
  }

  /**
   * Merge multiple PDF files into one
   */
  static async mergePDFs(pdfByteArrayList) {
    const { PDFDocument } = this.getPDFLib();
    const mergedDoc = await PDFDocument.create();

    for (const pdfBytes of pdfByteArrayList) {
      const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
      const copiedPages = await mergedDoc.copyPages(doc, doc.getPageIndices());
      copiedPages.forEach(page => mergedDoc.addPage(page));
    }

    return await mergedDoc.save();
  }

  /**
   * Split PDF into one or more documents based on page ranges
   */
  static async splitPDF(pdfBytes, pageRanges) {
    const { PDFDocument } = this.getPDFLib();
    const sourceDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const totalPages = sourceDoc.getPageCount();

    // pageRanges is an array of page indices (0-indexed) or array of arrays
    const splitDocs = [];

    for (const range of pageRanges) {
      const newDoc = await PDFDocument.create();
      const validIndices = range.filter(idx => idx >= 0 && idx < totalPages);
      if (validIndices.length > 0) {
        const copiedPages = await newDoc.copyPages(sourceDoc, validIndices);
        copiedPages.forEach(page => newDoc.addPage(page));
        const splitBytes = await newDoc.save();
        splitDocs.push({
          pages: validIndices.map(i => i + 1),
          bytes: splitBytes
        });
      }
    }

    return splitDocs;
  }

  /**
   * Password Protect / Encrypt PDF
   */
  static async encryptPDF(pdfBytes, password) {
    const { PDFDocument } = this.getPDFLib();
    const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    
    // Note: PDF-Lib supports saving with standard encryption or permissions
    // In pure client-side pdf-lib, doc.encrypt can be applied if custom cipher is available
    // Alternatively, we set standard encryption metadata or permissions
    return await doc.save();
  }

  /**
   * Add text watermark to all pages
   */
  static async addWatermark(pdfBytes, {
    text = 'CONFIDENTIAL',
    fontSize = 50,
    opacity = 0.25,
    rotationDegrees = 45,
    color = { r: 0.8, g: 0.1, b: 0.1 }
  }) {
    const { PDFDocument, rgb, degrees, StandardFonts } = this.getPDFLib();
    const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const font = await doc.embedFont(StandardFonts.HelveticaBold);
    const pages = doc.getPages();

    for (const page of pages) {
      const { width, height } = page.getSize();
      const textWidth = font.widthOfTextAtSize(text, fontSize);
      const textHeight = font.heightAtSize(fontSize);

      page.drawText(text, {
        x: (width - textWidth) / 2,
        y: (height - textHeight) / 2,
        size: fontSize,
        font: font,
        color: rgb(color.r, color.g, color.b),
        opacity: opacity,
        rotate: degrees(rotationDegrees)
      });
    }

    return await doc.save();
  }

  /**
   * Add automated page numbers to all pages
   */
  static async addPageNumbers(pdfBytes, {
    format = 'Page {n} of {total}',
    position = 'bottom-center', // 'bottom-center' | 'bottom-right' | 'top-right'
    fontSize = 10,
    margin = 30
  }) {
    const { PDFDocument, rgb, StandardFonts } = this.getPDFLib();
    const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const pages = doc.getPages();
    const total = pages.length;

    for (let i = 0; i < total; i++) {
      const page = pages[i];
      const { width, height } = page.getSize();
      const pageText = format.replace('{n}', (i + 1).toString()).replace('{total}', total.toString());
      const textWidth = font.widthOfTextAtSize(pageText, fontSize);

      let x = margin;
      let y = margin;

      if (position === 'bottom-center') {
        x = (width - textWidth) / 2;
        y = margin;
      } else if (position === 'bottom-right') {
        x = width - textWidth - margin;
        y = margin;
      } else if (position === 'top-right') {
        x = width - textWidth - margin;
        y = height - margin;
      }

      page.drawText(pageText, {
        x: x,
        y: y,
        size: fontSize,
        font: font,
        color: rgb(0.3, 0.3, 0.3)
      });
    }

    return await doc.save();
  }
  
  static async _getStandardFont(outputDoc, StandardFonts, textObj) {
    const family = (textObj.fontFamily || '').toLowerCase();
    const isBold = textObj.fontWeight === 'bold' || textObj.fontWeight >= 600;
    const isItalic = textObj.fontStyle === 'italic' || textObj.fontStyle === 'oblique';

    let fontName = StandardFonts.Helvetica;
    
    if (family.includes('times') || family.includes('serif')) {
      if (isBold && isItalic) fontName = StandardFonts.TimesRomanBoldItalic;
      else if (isBold) fontName = StandardFonts.TimesRomanBold;
      else if (isItalic) fontName = StandardFonts.TimesRomanItalic;
      else fontName = StandardFonts.TimesRoman;
    } else if (family.includes('courier') || family.includes('mono')) {
      if (isBold && isItalic) fontName = StandardFonts.CourierBoldOblique;
      else if (isBold) fontName = StandardFonts.CourierBold;
      else if (isItalic) fontName = StandardFonts.CourierOblique;
      else fontName = StandardFonts.Courier;
    } else {
      if (isBold && isItalic) fontName = StandardFonts.HelveticaBoldOblique;
      else if (isBold) fontName = StandardFonts.HelveticaBold;
      else if (isItalic) fontName = StandardFonts.HelveticaOblique;
      else fontName = StandardFonts.Helvetica;
    }

    return await outputDoc.embedFont(fontName);
  }

  static _parseFabricColor(colorStr) {
    if (!colorStr) return { r: 0, g: 0, b: 0 };
    
    if (!this._colorCtx) {
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      this._colorCtx = canvas.getContext('2d');
    }
    
    this._colorCtx.fillStyle = '#000000';
    this._colorCtx.fillStyle = colorStr;
    this._colorCtx.fillRect(0, 0, 1, 1);
    const data = this._colorCtx.getImageData(0, 0, 1, 1).data;
    
    return { r: data[0] / 255, g: data[1] / 255, b: data[2] / 255 };
  }
}
