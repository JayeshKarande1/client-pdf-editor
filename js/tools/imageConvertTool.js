/**
 * Client-Side Image <-> PDF Conversion Tool
 */

import { ImageService } from '../services/imageService.js';
import { PdfRenderService } from '../services/pdfRenderService.js';

export class ImageConvertTool {
  static images = []; // Array of File objects
  static pdfFile = null;
  static pdfDoc = null;

  static init() {
    this.container = document.getElementById('convertToolContainer');
    if (!this.container) return;

    this.setupTabs();
    this.setupImgToPdf();
    this.setupPdfToImg();
  }

  static setupTabs() {
    document.querySelectorAll('.convert-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        document.querySelectorAll('.convert-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
        document.getElementById('imgToPdfSection')?.classList.toggle('hidden', mode !== 'img-to-pdf');
        document.getElementById('pdfToImgSection')?.classList.toggle('hidden', mode !== 'pdf-to-img');
      });
    });
  }

  // --- 1. Images to PDF ---
  static setupImgToPdf() {
    const dropzone = document.getElementById('imgToPdfDropzone');
    const fileInput = document.getElementById('imgToPdfFileInput');
    const imageListEl = document.getElementById('imgToPdfList');
    const convertBtn = document.getElementById('btnConvertImgToPdf');

    dropzone?.addEventListener('click', () => fileInput.click());

    fileInput?.addEventListener('change', (e) => {
      this.images.push(...Array.from(e.target.files));
      this.renderImageList();
      e.target.value = '';
    });

    convertBtn?.addEventListener('click', async () => {
      if (this.images.length === 0) return;
      convertBtn.disabled = true;
      convertBtn.textContent = 'Generating PDF...';

      try {
        const pageSize = document.getElementById('imgPdfPageSize')?.value || 'fit';
        const margin = parseInt(document.getElementById('imgPdfMargin')?.value, 10) || 20;

        const pdfBytes = await ImageService.imagesToPDF(this.images, { pageSize, margin });
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `images_converted_${Date.now()}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error('Image to PDF failed', err);
        alert(`Conversion failed: ${err.message}`);
      } finally {
        convertBtn.disabled = false;
        convertBtn.textContent = 'Convert to PDF';
      }
    });
  }

  static renderImageList() {
    const listEl = document.getElementById('imgToPdfList');
    const convertBtn = document.getElementById('btnConvertImgToPdf');
    if (!listEl) return;

    listEl.innerHTML = '';
    listEl.classList.toggle('hidden', this.images.length === 0);
    if (convertBtn) convertBtn.disabled = this.images.length === 0;

    this.images.forEach((file, idx) => {
      const item = document.createElement('div');
      item.className = 'flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200 shadow-sm';
      const imgUrl = URL.createObjectURL(file);

      item.innerHTML = `
        <div class="flex items-center space-x-3 min-w-0">
          <img src="${imgUrl}" alt="${file.name}" class="w-12 h-12 object-cover rounded-lg border border-slate-200 flex-shrink-0" />
          <div class="min-w-0">
            <p class="text-sm font-semibold text-slate-800 truncate">${file.name}</p>
            <p class="text-xs text-slate-500">${(file.size / 1024).toFixed(1)} KB</p>
          </div>
        </div>
        <button class="btn-remove-img p-1.5 text-red-500 hover:bg-red-50 rounded-lg">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
      `;

      item.querySelector('.btn-remove-img')?.addEventListener('click', () => {
        URL.revokeObjectURL(imgUrl);
        this.images.splice(idx, 1);
        this.renderImageList();
      });

      listEl.appendChild(item);
    });
  }

  // --- 2. PDF to Images ---
  static setupPdfToImg() {
    const dropzone = document.getElementById('pdfToImgDropzone');
    const fileInput = document.getElementById('pdfToImgFileInput');
    const convertBtn = document.getElementById('btnConvertPdfToImg');
    const fileInfo = document.getElementById('pdfToImgInfo');
    const progressEl = document.getElementById('pdfToImgProgress');

    dropzone?.addEventListener('click', () => fileInput.click());

    fileInput?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        try {
          this.pdfFile = file;
          const buffer = await file.arrayBuffer();
          this.pdfDoc = await PdfRenderService.loadDocument(buffer);
          
          if (fileInfo) {
            fileInfo.innerHTML = `
              <div class="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-900 text-sm font-medium flex items-center justify-between">
                <span>Selected: <strong>${file.name}</strong> (${this.pdfDoc.numPages} pages)</span>
                <span class="text-xs text-indigo-600 bg-white px-2 py-1 rounded shadow-sm">${(file.size / 1024 / 1024).toFixed(2)} MB</span>
              </div>
            `;
            fileInfo.classList.remove('hidden');
          }
          if (convertBtn) convertBtn.disabled = false;
        } catch (err) {
          alert(`Error loading PDF: ${err.message}`);
        }
      }
      e.target.value = '';
    });

    convertBtn?.addEventListener('click', async () => {
      if (!this.pdfDoc) return;
      convertBtn.disabled = true;
      if (progressEl) progressEl.classList.remove('hidden');

      try {
        const format = document.getElementById('pdfImgFormat')?.value || 'png';
        const dpiScale = parseFloat(document.getElementById('pdfImgQuality')?.value) || 2.0;

        const zipBlob = await ImageService.pdfToImagesZip(this.pdfDoc, {
          format,
          dpiScale,
          onProgress: (current, total) => {
            if (progressEl) {
              progressEl.querySelector('.progress-bar-fill').style.width = `${Math.round((current / total) * 100)}%`;
              progressEl.querySelector('.progress-text').textContent = `Processing page ${current} of ${total}...`;
            }
          }
        });

        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pdf_images_${Date.now()}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error('PDF to Image export failed', err);
        alert(`Export failed: ${err.message}`);
      } finally {
        convertBtn.disabled = false;
        if (progressEl) progressEl.classList.add('hidden');
      }
    });
  }

  static reset() {
    this.images = [];
    this.pdfFile = null;
    this.pdfDoc = null;
    this.renderImageList();
    document.getElementById('pdfToImgInfo')?.classList.add('hidden');
    document.getElementById('btnConvertPdfToImg')?.setAttribute('disabled', 'true');
  }
}
