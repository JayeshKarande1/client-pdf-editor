/**
 * High-Resolution Client-Side PDF.js Rendering Service
 */

// Initialize worker source
if (window.pdfjsLib) {
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = './js/libs/pdf.worker.min.js';
}

export class PdfRenderService {
  /**
   * Load PDF Document from ArrayBuffer
   */
  static async loadDocument(arrayBuffer) {
    if (!window.pdfjsLib) {
      throw new Error('PDF.js library is not loaded');
    }
    const loadingTask = window.pdfjsLib.getDocument({
      data: arrayBuffer,
      cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
      cMapPacked: true
    });
    return await loadingTask.promise;
  }

  /**
   * Render a PDF page onto an HTML5 Canvas with High-DPI support
   */
  static async renderPageToCanvas(pdfDoc, pageNumber, canvas, scale = 1.0, rotationDelta = 0) {
    const page = await pdfDoc.getPage(pageNumber);
    const pageRotation = page.rotate || 0;
    const rotation = (pageRotation + rotationDelta) % 360;
    const viewport = page.getViewport({ scale: scale, rotation: rotation });

    const pixelRatio = window.devicePixelRatio || 1;
    canvas.width = Math.floor(viewport.width * pixelRatio);
    canvas.height = Math.floor(viewport.height * pixelRatio);
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;

    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const transform = pixelRatio !== 1 ? [pixelRatio, 0, 0, pixelRatio, 0, 0] : null;

    const renderContext = {
      canvasContext: ctx,
      viewport: viewport,
      transform: transform
    };

    await page.render(renderContext).promise;
    return {
      width: viewport.width,
      height: viewport.height,
      originalWidth: viewport.width / scale,
      originalHeight: viewport.height / scale,
      rotation: rotation,
      scale: scale
    };
  }

  /**
   * Generate a quick thumbnail image (Data URL) for a page
   */
  static async generateThumbnail(pdfDoc, pageNumber, maxDim = 200, rotationDelta = 0) {
    const page = await pdfDoc.getPage(pageNumber);
    const pageRotation = page.rotate || 0;
    const rotation = (pageRotation + rotationDelta) % 360;
    const unscaledViewport = page.getViewport({ scale: 1.0, rotation: rotation });
    
    const scale = maxDim / Math.max(unscaledViewport.width, unscaledViewport.height);
    const viewport = page.getViewport({ scale: scale, rotation: rotation });

    const canvas = document.createElement('canvas');
    const pixelRatio = 1.5; // Good balance for thumbnails
    canvas.width = Math.floor(viewport.width * pixelRatio);
    canvas.height = Math.floor(viewport.height * pixelRatio);
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;

    const ctx = canvas.getContext('2d');
    const transform = [pixelRatio, 0, 0, pixelRatio, 0, 0];

    await page.render({
      canvasContext: ctx,
      viewport: viewport,
      transform: transform
    }).promise;

    return canvas.toDataURL('image/jpeg', 0.85);
  }

  /**
   * Extract all text lines, bounding boxes, and font metadata for in-place editing
   */
  static async extractPageTextLines(pdfDoc, pageNumber, scale = 1.0, rotationDelta = 0) {
    const page = await pdfDoc.getPage(pageNumber);
    const pageRotation = page.rotate || 0;
    const rotation = (pageRotation + rotationDelta) % 360;
    const viewport = page.getViewport({ scale: scale, rotation: rotation });
    const textContent = await page.getTextContent();

    if (!textContent || !textContent.items || textContent.items.length === 0) {
      return [];
    }

    const styles = textContent.styles || {};
    const rawItems = [];

    for (const item of textContent.items) {
      if (!item.str || item.str.trim() === '') continue;

      const tx = item.transform[4];
      const ty = item.transform[5];
      const fontHeight = Math.sqrt(item.transform[0] * item.transform[0] + item.transform[1] * item.transform[1]);
      const scaledFontSize = Math.round(fontHeight * scale);

      const [vx, vy] = viewport.convertToViewportPoint(tx, ty);
      const width = item.width * scale;
      const height = (item.height || fontHeight) * scale;
      const left = vx;
      const top = vy - height;

      // Extract Real Font Name and Attributes from PDF.js commonObjs
      const commonObj = page.commonObjs && page.commonObjs.has(item.fontName) ? page.commonObjs.get(item.fontName) : null;
      const fontStyleObj = styles[item.fontName] || {};
      const realFontName = ((commonObj && commonObj.name) || fontStyleObj.fontFamily || item.fontName || '').toLowerCase();
      const cleanFontName = realFontName.replace(/^[a-z]{6}\+/, '');

      // Detect Font Family mapping
      let matchedFamily = 'Segoe UI, DejaVu Sans, Arial, sans-serif';
      if (
        cleanFontName.includes('times') ||
        cleanFontName.includes('roman') ||
        cleanFontName.includes('georgia') ||
        cleanFontName.includes('garamond') ||
        cleanFontName.includes('palatino') ||
        (cleanFontName.includes('serif') && !cleanFontName.includes('sans'))
      ) {
        matchedFamily = 'Georgia, Times New Roman, serif';
      } else if (
        cleanFontName.includes('mono') ||
        cleanFontName.includes('courier') ||
        cleanFontName.includes('consolas') ||
        cleanFontName.includes('menlo')
      ) {
        matchedFamily = 'Consolas, Courier New, monospace';
      }

      // Detect Bold & Italic styles
      const isBold = cleanFontName.includes('bold') || cleanFontName.includes('heavy') || cleanFontName.includes('black') || (commonObj && commonObj.bold) || (item.transform[0] > fontHeight * 1.15);
      const isItalic = cleanFontName.includes('italic') || cleanFontName.includes('oblique') || (item.transform[2] && Math.abs(item.transform[2]) > 0.05) || (commonObj && commonObj.italic);

      // Clean up & normalize bullet characters and symbol fonts (replace private symbol \uf0b7 with standard •)
      let cleanStr = item.str.replace(/[\uF000-\uF0FF\u2022\u25CF\u25AA\u25E6\u00B7\u2023\u2043\u2219]/g, '•');

      rawItems.push({
        str: cleanStr,
        left: left,
        top: top,
        width: width,
        height: height,
        fontSize: Math.max(10, scaledFontSize),
        fontFamily: matchedFamily,
        fontWeight: isBold ? 'bold' : 'normal',
        fontStyle: isItalic ? 'italic' : 'normal',
        fontName: cleanFontName
      });
    }

    // Group adjacent items on the same line into coherent text lines
    const lines = [];
    rawItems.sort((a, b) => {
      if (Math.abs(a.top - b.top) > 5) return a.top - b.top;
      return a.left - b.left;
    });

    for (const item of rawItems) {
      const lastLine = lines[lines.length - 1];
      const isBulletLine = lastLine && (lastLine.str.trim() === '•' || lastLine.str.startsWith('•'));
      const maxGap = isBulletLine ? 35 : (item.fontSize * 1.5);

      if (
        lastLine &&
        Math.abs(lastLine.top - item.top) <= Math.max(lastLine.height, item.height) * 0.7 &&
        item.left - (lastLine.left + lastLine.width) <= maxGap &&
        item.left >= lastLine.left
      ) {
        const spacer = item.left - (lastLine.left + lastLine.width) > 2 ? ' ' : '';
        lastLine.str += spacer + item.str;
        lastLine.width = (item.left + item.width) - lastLine.left;
        lastLine.height = Math.max(lastLine.height, item.height);
        lastLine.fontSize = Math.max(lastLine.fontSize, item.fontSize);
        // If appending text to a bullet symbol, inherit the text's font family, weight, and style
        if (lastLine.str.startsWith('•') && item.str !== '•') {
          lastLine.fontFamily = item.fontFamily;
          lastLine.fontWeight = item.fontWeight;
          lastLine.fontStyle = item.fontStyle;
        }
      } else {
        lines.push({ ...item });
      }
    }

    return lines;
  }
}
