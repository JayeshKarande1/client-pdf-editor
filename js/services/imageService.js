/**
 * Image <-> PDF Conversion and ZIP Archiving Service
 */

export class ImageService {
  /**
   * Convert multiple image files into a single PDF
   */
  static async imagesToPDF(imageFiles, { pageSize = 'fit', margin = 20 } = {}) {
    if (!window.PDFLib) throw new Error('PDF-Lib is not loaded');
    const { PDFDocument, PageSizes } = window.PDFLib;
    const doc = await PDFDocument.create();

    for (const file of imageFiles) {
      const buffer = await file.arrayBuffer();
      const isPng = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');
      
      let embeddedImage;
      try {
        if (isPng) {
          embeddedImage = await doc.embedPng(buffer);
        } else {
          embeddedImage = await doc.embedJpg(buffer);
        }
      } catch (err) {
        console.warn('Fallback embedding via canvas for image', file.name, err);
        // Canvas fallback for formats like WebP or tricky JPGs
        const pngBuffer = await this.imageFileToPngBuffer(file);
        embeddedImage = await doc.embedPng(pngBuffer);
      }

      const imgDims = embeddedImage.scale(1);

      let pageWidth, pageHeight;
      let imgWidth, imgHeight, imgX, imgY;

      if (pageSize === 'A4') {
        [pageWidth, pageHeight] = PageSizes.A4;
        const availableW = pageWidth - margin * 2;
        const availableH = pageHeight - margin * 2;
        const scale = Math.min(availableW / imgDims.width, availableH / imgDims.height);
        
        imgWidth = imgDims.width * scale;
        imgHeight = imgDims.height * scale;
        imgX = margin + (availableW - imgWidth) / 2;
        imgY = margin + (availableH - imgHeight) / 2;
      } else {
        // 'fit' to original image size
        pageWidth = imgDims.width + margin * 2;
        pageHeight = imgDims.height + margin * 2;
        imgWidth = imgDims.width;
        imgHeight = imgDims.height;
        imgX = margin;
        imgY = margin;
      }

      const page = doc.addPage([pageWidth, pageHeight]);
      page.drawImage(embeddedImage, {
        x: imgX,
        y: imgY,
        width: imgWidth,
        height: imgHeight
      });
    }

    return await doc.save();
  }

  /**
   * Convert all PDF pages to high-DPI images and zip them
   */
  static async pdfToImagesZip(pdfDoc, { format = 'png', dpiScale = 2.0, onProgress = null } = {}) {
    if (!window.JSZip) throw new Error('JSZip library is not loaded');
    const zip = new window.JSZip();
    const numPages = pdfDoc.numPages;

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      if (onProgress) onProgress(pageNum, numPages);

      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: dpiScale });

      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');

      await page.render({
        canvasContext: ctx,
        viewport: viewport
      }).promise;

      const mimeType = format === 'jpeg' || format === 'jpg' ? 'image/jpeg' : 'image/png';
      const dataUrl = canvas.toDataURL(mimeType, 0.95);
      const base64Data = dataUrl.split(',')[1];
      const ext = format === 'jpeg' || format === 'jpg' ? 'jpg' : 'png';

      const padNum = String(pageNum).padStart(3, '0');
      zip.file(`page_${padNum}.${ext}`, base64Data, { base64: true });
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    return zipBlob;
  }

  /**
   * Convert any image File to PNG ArrayBuffer via HTML5 Canvas
   */
  static async imageFileToPngBuffer(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        canvas.toBlob(blob => {
          blob.arrayBuffer().then(resolve).catch(reject);
        }, 'image/png');
      };
      img.onerror = (e) => {
        URL.revokeObjectURL(url);
        reject(e);
      };
      img.src = url;
    });
  }
}
