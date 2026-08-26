/**
 * Client-Side Watermark & Page Numbering Tool
 */

import { PdfLibService } from '../services/pdfLibService.js';
import { PdfRenderService } from '../services/pdfRenderService.js';

export class WatermarkTool {
  static currentFile = null;
  static pdfDoc = null;
  static pdfBytes = null;

  static init() {
    this.container = document.getElementById('watermarkToolContainer');
    this.dropzone = document.getElementById('watermarkDropzone');
    this.fileInput = document.getElementById('watermarkFileInput');
    this.workspace = document.getElementById('watermarkWorkspace');
    this.previewCanvas = document.getElementById('watermarkPreviewCanvas');
    this.applyBtn = document.getElementById('btnApplyWatermark');

    if (!this.container) return;

    this.setupEventListeners();
  }

  static setupEventListeners() {
    this.dropzone?.addEventListener('click', () => this.fileInput.click());

    this.fileInput?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        try {
          this.currentFile = file;
          const buffer = await file.arrayBuffer();
          this.pdfBytes = new Uint8Array(buffer);
          this.pdfDoc = await PdfRenderService.loadDocument(buffer.slice(0));

          this.dropzone.classList.add('hidden');
          this.workspace.classList.remove('hidden');

          await this.updateLivePreview();
        } catch (err) {
          alert(`Error reading file: ${err.message}`);
        }
      }
      e.target.value = '';
    });

    // Real-time preview updates on input changes
    const liveInputs = ['wmText', 'wmFontSize', 'wmOpacity', 'wmAngle', 'wmColor', 'enablePageNumbers', 'pageNumFormat', 'pageNumPos'];
    liveInputs.forEach(id => {
      document.getElementById(id)?.addEventListener('input', () => this.updateLivePreview());
    });

    this.applyBtn?.addEventListener('click', () => this.executeApply());
  }

  static async updateLivePreview() {
    if (!this.pdfDoc || !this.previewCanvas) return;

    const pageNum = 1;
    const page = await this.pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.0 });

    const canvas = this.previewCanvas;
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');

    // Render underlying page
    await page.render({
      canvasContext: ctx,
      viewport: viewport
    }).promise;

    // Draw Watermark Overlay
    const text = document.getElementById('wmText')?.value || 'CONFIDENTIAL';
    const fontSize = parseInt(document.getElementById('wmFontSize')?.value, 10) || 50;
    const opacity = parseFloat(document.getElementById('wmOpacity')?.value) || 0.25;
    const angle = parseInt(document.getElementById('wmAngle')?.value, 10) || 45;
    const color = document.getElementById('wmColor')?.value || '#ef4444';

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.fillStyle = color;
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((angle * Math.PI) / 180);
    ctx.fillText(text, 0, 0);
    ctx.restore();

    // Draw Page Number preview if enabled
    const enablePageNums = document.getElementById('enablePageNumbers')?.checked;
    if (enablePageNums) {
      const pos = document.getElementById('pageNumPos')?.value || 'bottom-center';
      const format = document.getElementById('pageNumFormat')?.value || 'Page {n} of {total}';
      const pageText = format.replace('{n}', '1').replace('{total}', this.pdfDoc.numPages.toString());

      ctx.save();
      ctx.fillStyle = '#475569';
      ctx.font = '12px sans-serif';

      let x = canvas.width / 2;
      let y = canvas.height - 20;
      let align = 'center';

      if (pos === 'bottom-right') {
        x = canvas.width - 30;
        align = 'right';
      } else if (pos === 'top-right') {
        x = canvas.width - 30;
        y = 30;
        align = 'right';
      }

      ctx.textAlign = align;
      ctx.fillText(pageText, x, y);
      ctx.restore();
    }
  }

  static async executeApply() {
    if (!this.pdfBytes) return;

    this.applyBtn.disabled = true;
    this.applyBtn.textContent = 'Applying Watermark...';

    try {
      const text = document.getElementById('wmText')?.value || 'CONFIDENTIAL';
      const fontSize = parseInt(document.getElementById('wmFontSize')?.value, 10) || 50;
      const opacity = parseFloat(document.getElementById('wmOpacity')?.value) || 0.25;
      const rotationDegrees = parseInt(document.getElementById('wmAngle')?.value, 10) || 45;
      const colorHex = document.getElementById('wmColor')?.value || '#ef4444';

      // Parse color
      const num = parseInt(colorHex.replace('#', ''), 16);
      const color = {
        r: ((num >> 16) & 255) / 255,
        g: ((num >> 8) & 255) / 255,
        b: (num & 255) / 255
      };

      let resultBytes = await PdfLibService.addWatermark(this.pdfBytes, {
        text,
        fontSize,
        opacity,
        rotationDegrees,
        color
      });

      const enablePageNums = document.getElementById('enablePageNumbers')?.checked;
      if (enablePageNums) {
        const format = document.getElementById('pageNumFormat')?.value || 'Page {n} of {total}';
        const position = document.getElementById('pageNumPos')?.value || 'bottom-center';
        resultBytes = await PdfLibService.addPageNumbers(resultBytes, { format, position });
      }

      const blob = new Blob([resultBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `watermarked_${this.currentFile.name}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to apply watermark', err);
      alert(`Operation failed: ${err.message}`);
    } finally {
      this.applyBtn.disabled = false;
      this.applyBtn.textContent = 'Download Watermarked PDF';
    }
  }

  static reset() {
    this.currentFile = null;
    this.pdfDoc = null;
    this.pdfBytes = null;
    this.dropzone?.classList.remove('hidden');
    this.workspace?.classList.add('hidden');
  }
}
