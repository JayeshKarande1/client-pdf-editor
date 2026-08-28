/**
 * Page Manipulation & Thumbnail Sidebar Manager
 */

import { state } from '../state.js';
import { PdfRenderService } from '../services/pdfRenderService.js';
import { CanvasManager } from './canvasManager.js';
import { HistoryManager } from './historyManager.js';
import { TextOptionsPanel } from './textOptionsPanel.js';

export class PageManager {
  static isZoomListenerSet = false;

  /**
   * Render all pages of the document into the editor viewport and thumbnail sidebar
   */
  static async renderDocument(pdfDoc, scale = 1.0) {
    const pagesContainer = document.getElementById('pdfPagesContainer');
    const thumbnailsContainer = document.getElementById('thumbnailList');
    
    if (!pagesContainer || !thumbnailsContainer) return;

    pagesContainer.innerHTML = '';
    thumbnailsContainer.innerHTML = '';

    const numPages = pdfDoc.numPages;
    state.doc.numPages = numPages;
    state.doc.pageDimensions = [];
    state.doc.pageOrder = Array.from({ length: numPages }, (_, i) => i);

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const pageIndex = pageNum - 1;

      // 1. Create Page Wrapper in Viewport
      const pageWrapper = document.createElement('div');
      pageWrapper.className = 'pdf-page-wrapper';
      pageWrapper.id = `page-wrapper-${pageIndex}`;
      pageWrapper.dataset.pageIndex = pageIndex.toString();

      // Background PDF Canvas
      const bgCanvas = document.createElement('canvas');
      bgCanvas.className = 'pdf-canvas-bg';
      bgCanvas.id = `pdf-bg-${pageIndex}`;

      // Foreground Vector Overlay Canvas
      const fgCanvas = document.createElement('canvas');
      fgCanvas.id = `fabric-canvas-${pageIndex}`;

      // In-Place Text Detection Layer (for Click-to-Edit Existing Text)
      const textLayer = document.createElement('div');
      textLayer.className = 'pdf-text-edit-layer';
      textLayer.id = `text-layer-${pageIndex}`;

      pageWrapper.appendChild(bgCanvas);
      pageWrapper.appendChild(fgCanvas);
      pageWrapper.appendChild(textLayer);
      pagesContainer.appendChild(pageWrapper);

      // Render PDF page onto background canvas
      const rotationDelta = state.doc.pageRotations.get(pageIndex) || 0;
      const dims = await PdfRenderService.renderPageToCanvas(pdfDoc, pageNum, bgCanvas, scale, rotationDelta);
      state.doc.pageDimensions.push(dims);

      // Set dimensions of wrapper & text layer
      pageWrapper.style.width = `${dims.width}px`;
      pageWrapper.style.height = `${dims.height}px`;
      textLayer.style.width = `${dims.width}px`;
      textLayer.style.height = `${dims.height}px`;

      // Initialize Fabric.js on foreground canvas
      const fabricCanvas = CanvasManager.initPageCanvas(fgCanvas, pageIndex, dims);
      HistoryManager.pushState(pageIndex, fabricCanvas);

      // Populate interactive in-place text detection layer
      await this.populateTextLayer(pdfDoc, pageNum, pageIndex, scale, rotationDelta, textLayer);

      // 2. Create Thumbnail in Sidebar
      await this.createThumbnailItem(pdfDoc, pageIndex, pageNum, thumbnailsContainer);
    }

    this.updatePageIndicator(1, numPages);
    state.setCurrentPage(1);
    this.highlightActiveThumbnail(0);
    this.setupScrollObserver();
    this.setupZoomListener();
    this.setupToolStateListener();
  }

  /**
   * Populate DOM overlay with clickable text bounding boxes for existing text editing
   */
  static async populateTextLayer(pdfDoc, pageNum, pageIndex, scale, rotationDelta, textLayer) {
    try {
      const lines = await PdfRenderService.extractPageTextLines(pdfDoc, pageNum, scale, rotationDelta);
      textLayer.innerHTML = '';

      lines.forEach((line) => {
        const lineEl = document.createElement('div');
        lineEl.className = 'existing-text-block';
        lineEl.style.left = `${Math.max(0, line.left - 2)}px`;
        lineEl.style.top = `${Math.max(0, line.top - 2)}px`;
        lineEl.style.width = `${line.width + 4}px`;
        lineEl.style.height = `${line.height + 4}px`;
        lineEl.title = `Click to edit: "${line.str}"`;

        // Click to Edit Existing Text
        lineEl.addEventListener('click', (e) => {
          e.stopPropagation();
          this.convertTextToEditable(pageIndex, line, lineEl);
        });

        textLayer.appendChild(lineEl);
      });
    } catch (err) {
      console.warn('Text layer extraction error', err);
    }
  }

  /**
   * Convert an existing PDF text line into an editable in-place Fabric.js text object with background mask
   */
  static convertTextToEditable(pageIndex, line, domElement) {
    const fabricCanvas = state.doc.pageCanvases.get(pageIndex);
    if (!fabricCanvas) return;

    // Sample the background color from the PDF canvas.
    // IMPORTANT: We do NOT sample from the center of the text (that would pick up the ink color).
    // Instead we sample from just ABOVE the text line, and from a few candidates,
    // then pick the LIGHTEST pixel (highest sum of RGB) — that is most likely the background.
    let maskColor = '#ffffff';
    try {
      const bgCanvas = document.getElementById(`pdf-bg-${pageIndex}`);
      if (bgCanvas) {
        const ctx = bgCanvas.getContext('2d');
        const pixelRatio = window.devicePixelRatio || 1;

        // Sample points: above the text, and to the far left & right edges of the block
        const candidates = [
          { x: line.left + line.width / 2, y: line.top - Math.max(4, line.height * 0.5) }, // above
          { x: line.left - 8,              y: line.top + line.height / 2 },                  // left of text
          { x: line.left + line.width + 8, y: line.top + line.height / 2 },                  // right of text
          { x: line.left + line.width / 2, y: line.top + line.height + Math.max(4, line.height * 0.5) } // below
        ];

        let bestPixel = [255, 255, 255]; // fallback to white
        let bestBrightness = -1;

        for (const pt of candidates) {
          const sx = Math.floor(pt.x * pixelRatio);
          const sy = Math.floor(pt.y * pixelRatio);
          if (sx < 0 || sy < 0 || sx >= bgCanvas.width || sy >= bgCanvas.height) continue;
          const px = ctx.getImageData(sx, sy, 1, 1).data;
          const brightness = px[0] + px[1] + px[2]; // higher = lighter = more likely background
          if (brightness > bestBrightness) {
            bestBrightness = brightness;
            bestPixel = [px[0], px[1], px[2]];
          }
        }

        maskColor = `rgb(${bestPixel[0]}, ${bestPixel[1]}, ${bestPixel[2]})`;
      }
    } catch (e) { /* fallback to white if sampling fails */ }

    // 1. Create clean opaque background mask covering the original text
    const mask = new window.fabric.Rect({
      left: Math.max(0, line.left - 4),
      top: Math.max(0, line.top - 3),
      width: line.width + 8,
      height: line.height + 6,
      fill: maskColor,
      stroke: 'transparent',
      selectable: false,
      evented: false,
      _isTemporary: true
    });

    // 2. Create editable IText matching the original text properties
    const textObj = new window.fabric.IText(line.str, {
      left: line.left,
      top: line.top,
      fontSize: line.fontSize || 16,
      fontFamily: line.fontFamily || 'Segoe UI, DejaVu Sans, Arial, sans-serif',
      fontWeight: line.fontWeight || 'normal',
      fontStyle: line.fontStyle || 'normal',
      fill: '#0f172a',
      selectable: true,
      editable: true
    });

    fabricCanvas.add(mask);
    mask._isTemporary = false;
    fabricCanvas.add(textObj);
    fabricCanvas.setActiveObject(textObj);

    // Sync toolbar property panel with the detected text properties
    state.updateEditorSettings({
      fontFamily: line.fontFamily || 'Segoe UI, DejaVu Sans, Arial, sans-serif',
      fontSize: line.fontSize || 16,
      isBold: line.fontWeight === 'bold',
      isItalic: line.fontStyle === 'italic'
    });

    // Hide DOM element so it doesn't block future interactions
    if (domElement) domElement.style.display = 'none';

    // Switch tool mode back to select so user can edit and drag
    state.setEditorTool('select');
    CanvasManager.updateAllCanvasesTool('select');

    setTimeout(() => {
      textObj.enterEditing();
      textObj.selectAll();
      fabricCanvas.renderAll();
      TextOptionsPanel.syncWithActiveObject();
    }, 60);
  }

  /**
   * Toggle text layer interactivity based on active tool
   */
  static setupToolStateListener() {
    state.subscribe('toolChanged', (tool) => {
      const isEditText = tool === 'edit-text';
      document.querySelectorAll('.pdf-text-edit-layer').forEach(layer => {
        layer.classList.toggle('active', isEditText);
      });
    });
  }

  /**
   * Handle zoom changes across all pages
   */
  static setupZoomListener() {
    if (this.isZoomListenerSet) return;
    this.isZoomListenerSet = true;

    state.subscribe('zoomChanged', async (newZoom) => {
      if (!state.doc.pdfjsDoc) return;

      for (let pageNum = 1; pageNum <= state.doc.numPages; pageNum++) {
        const pageIndex = pageNum - 1;
        if (state.doc.deletedPages.has(pageIndex)) continue;

        const bgCanvas = document.getElementById(`pdf-bg-${pageIndex}`);
        const pageWrapper = document.getElementById(`page-wrapper-${pageIndex}`);
        const rotationDelta = state.doc.pageRotations.get(pageIndex) || 0;

        if (bgCanvas && pageWrapper) {
          const dims = await PdfRenderService.renderPageToCanvas(
            state.doc.pdfjsDoc,
            pageNum,
            bgCanvas,
            newZoom,
            rotationDelta
          );

          pageWrapper.style.width = `${dims.width}px`;
          pageWrapper.style.height = `${dims.height}px`;

          const fabricCanvas = state.doc.pageCanvases.get(pageIndex);
          if (fabricCanvas) {
            fabricCanvas.setDimensions({ width: dims.width, height: dims.height });
            fabricCanvas.setZoom(newZoom);
            fabricCanvas.renderAll();
          }
        }
      }
    });
  }

  /**
   * Create a thumbnail item for the sidebar
   */
  static async createThumbnailItem(pdfDoc, pageIndex, pageNum, container) {
    const thumbItem = document.createElement('div');
    thumbItem.className = `thumbnail-item cursor-pointer p-2 rounded-lg bg-white shadow-sm flex flex-col items-center group relative ${pageIndex === 0 ? 'active' : ''}`;
    thumbItem.dataset.pageIndex = pageIndex.toString();

    const rotationDelta = state.doc.pageRotations.get(pageIndex) || 0;
    const thumbDataUrl = await PdfRenderService.generateThumbnail(pdfDoc, pageNum, 160, rotationDelta);

    thumbItem.innerHTML = `
      <div class="relative w-full overflow-hidden rounded border border-slate-200 bg-slate-50 flex items-center justify-center">
        <img src="${thumbDataUrl}" alt="Page ${pageNum}" class="max-h-40 w-auto object-contain pointer-events-none" id="thumb-img-${pageIndex}" />
        <div class="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex space-x-1">
          <button class="btn-rotate-page p-1 bg-white/90 rounded shadow hover:bg-white text-slate-700" title="Rotate Page" data-page-index="${pageIndex}">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
          </button>
          <button class="btn-delete-page p-1 bg-white/90 rounded shadow hover:bg-red-50 text-red-600" title="Delete Page" data-page-index="${pageIndex}">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
          </button>
        </div>
      </div>
      <span class="text-xs font-medium text-slate-600 mt-1.5">Page ${pageNum}</span>
    `;

    // Click to scroll to page
    thumbItem.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      this.scrollToPage(pageIndex);
    });

    // Rotate button
    thumbItem.querySelector('.btn-rotate-page')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.rotatePage(pageIndex);
    });

    // Delete button
    thumbItem.querySelector('.btn-delete-page')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.deletePage(pageIndex);
    });

    container.appendChild(thumbItem);
  }

  /**
   * Scroll viewport to specific page
   */
  static scrollToPage(pageIndex) {
    const pageWrapper = document.getElementById(`page-wrapper-${pageIndex}`);
    if (pageWrapper) {
      pageWrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
      state.setCurrentPage(pageIndex + 1);
      this.highlightActiveThumbnail(pageIndex);
    }
  }

  /**
   * Rotate a specific page by 90 degrees clockwise
   */
  static async rotatePage(pageIndex) {
    const currentDelta = state.doc.pageRotations.get(pageIndex) || 0;
    const newDelta = (currentDelta + 90) % 360;
    state.doc.pageRotations.set(pageIndex, newDelta);

    const bgCanvas = document.getElementById(`pdf-bg-${pageIndex}`);
    const pageWrapper = document.getElementById(`page-wrapper-${pageIndex}`);
    
    if (bgCanvas && pageWrapper && state.doc.pdfjsDoc) {
      const dims = await PdfRenderService.renderPageToCanvas(
        state.doc.pdfjsDoc,
        pageIndex + 1,
        bgCanvas,
        state.doc.zoom,
        newDelta
      );
      
      pageWrapper.style.width = `${dims.width}px`;
      pageWrapper.style.height = `${dims.height}px`;

      const fabricCanvas = state.doc.pageCanvases.get(pageIndex);
      if (fabricCanvas) {
        fabricCanvas.setDimensions({ width: dims.width, height: dims.height });
        fabricCanvas.renderAll();
      }

      const newThumb = await PdfRenderService.generateThumbnail(state.doc.pdfjsDoc, pageIndex + 1, 160, newDelta);
      const thumbImg = document.getElementById(`thumb-img-${pageIndex}`);
      if (thumbImg) thumbImg.src = newThumb;
    }
  }

  /**
   * Delete a page from view
   */
  static deletePage(pageIndex) {
    if (state.doc.numPages - state.doc.deletedPages.size <= 1) {
      alert('A document must have at least one page.');
      return;
    }

    state.doc.deletedPages.add(pageIndex);

    const pageWrapper = document.getElementById(`page-wrapper-${pageIndex}`);
    if (pageWrapper) pageWrapper.style.display = 'none';

    const thumbItem = document.querySelector(`.thumbnail-item[data-page-index="${pageIndex}"]`);
    if (thumbItem) thumbItem.style.display = 'none';
  }

  /**
   * Highlight active thumbnail in sidebar
   */
  static highlightActiveThumbnail(pageIndex) {
    document.querySelectorAll('.thumbnail-item').forEach(item => {
      item.classList.toggle('active', item.dataset.pageIndex === pageIndex.toString());
    });
  }

  /**
   * Update page counter indicator
   */
  static updatePageIndicator(current, total) {
    const indicator = document.getElementById('pageIndicator');
    if (indicator) indicator.textContent = `${current} / ${total}`;
  }

  /**
   * Observe scrolling to update active thumbnail automatically
   */
  static setupScrollObserver() {
    const pagesContainer = document.getElementById('pdfPagesContainer');
    if (!pagesContainer) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const pageIndex = parseInt(entry.target.dataset.pageIndex, 10);
          state.setCurrentPage(pageIndex + 1);
          this.highlightActiveThumbnail(pageIndex);
          this.updatePageIndicator(pageIndex + 1, state.doc.numPages);
        }
      });
    }, {
      root: pagesContainer.parentElement,
      threshold: 0.4
    });

    document.querySelectorAll('.pdf-page-wrapper').forEach(el => observer.observe(el));
  }
}
