/**
 * Client-Side Merge PDF Tool
 */

import { PdfLibService } from '../services/pdfLibService.js';
import { PdfRenderService } from '../services/pdfRenderService.js';

export class MergeTool {
  static files = []; // [{ file, bytes, numPages, thumbUrl, id }]

  static init() {
    this.container = document.getElementById('mergeToolContainer');
    this.dropzone = document.getElementById('mergeDropzone');
    this.fileInput = document.getElementById('mergeFileInput');
    this.fileListEl = document.getElementById('mergeFileList');
    this.mergeBtn = document.getElementById('btnExecuteMerge');
    this.statusEl = document.getElementById('mergeStatus');

    if (!this.container) return;

    this.setupEventListeners();
  }

  static setupEventListeners() {
    this.dropzone?.addEventListener('click', () => this.fileInput.click());

    this.fileInput?.addEventListener('change', (e) => {
      this.handleFiles(Array.from(e.target.files));
      e.target.value = '';
    });

    // Drag & Drop
    ['dragenter', 'dragover'].forEach(eventName => {
      this.dropzone?.addEventListener(eventName, (e) => {
        e.preventDefault();
        this.dropzone.classList.add('drag-over-active');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      this.dropzone?.addEventListener(eventName, (e) => {
        e.preventDefault();
        this.dropzone.classList.remove('drag-over-active');
      });
    });

    this.dropzone?.addEventListener('drop', (e) => {
      const droppedFiles = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'));
      if (droppedFiles.length > 0) {
        this.handleFiles(droppedFiles);
      }
    });

    // Execute Merge
    this.mergeBtn?.addEventListener('click', () => this.executeMerge());
  }

  static async handleFiles(newFiles) {
    for (const file of newFiles) {
      try {
        const buffer = await file.arrayBuffer();
        const pdfDoc = await PdfRenderService.loadDocument(buffer.slice(0));
        const thumbUrl = await PdfRenderService.generateThumbnail(pdfDoc, 1, 120);

        this.files.push({
          id: Math.random().toString(36).substring(2, 9),
          file: file,
          bytes: new Uint8Array(buffer),
          numPages: pdfDoc.numPages,
          thumbUrl: thumbUrl
        });
      } catch (err) {
        console.error('Error loading PDF file for merge', file.name, err);
        alert(`Failed to load ${file.name}: ${err.message}`);
      }
    }

    this.renderFileList();
  }

  static renderFileList() {
    if (!this.fileListEl) return;
    this.fileListEl.innerHTML = '';

    if (this.files.length === 0) {
      this.fileListEl.classList.add('hidden');
      if (this.mergeBtn) this.mergeBtn.disabled = true;
      return;
    }

    this.fileListEl.classList.remove('hidden');
    if (this.mergeBtn) this.mergeBtn.disabled = this.files.length < 2;

    this.files.forEach((item, index) => {
      const card = document.createElement('div');
      card.className = 'flex items-center justify-between p-3.5 bg-white rounded-xl border border-slate-200 shadow-sm hover:border-indigo-300 transition-all';
      
      card.innerHTML = `
        <div class="flex items-center space-x-3.5 min-w-0">
          <div class="w-12 h-16 bg-slate-100 rounded border border-slate-200 overflow-hidden flex items-center justify-center flex-shrink-0">
            <img src="${item.thumbUrl}" alt="Preview" class="max-h-full max-w-full object-contain" />
          </div>
          <div class="min-w-0">
            <p class="text-sm font-semibold text-slate-800 truncate">${item.file.name}</p>
            <p class="text-xs text-slate-500">${item.numPages} ${item.numPages === 1 ? 'page' : 'pages'} • ${(item.file.size / 1024 / 1024).toFixed(2)} MB</p>
          </div>
        </div>
        <div class="flex items-center space-x-1">
          <button class="btn-move-up p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30" ${index === 0 ? 'disabled' : ''} title="Move Up">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path></svg>
          </button>
          <button class="btn-move-down p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30" ${index === this.files.length - 1 ? 'disabled' : ''} title="Move Down">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
          </button>
          <button class="btn-remove-file p-1.5 rounded-lg text-red-500 hover:bg-red-50 hover:text-red-700" title="Remove">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
      `;

      card.querySelector('.btn-move-up')?.addEventListener('click', () => {
        [this.files[index - 1], this.files[index]] = [this.files[index], this.files[index - 1]];
        this.renderFileList();
      });

      card.querySelector('.btn-move-down')?.addEventListener('click', () => {
        [this.files[index], this.files[index + 1]] = [this.files[index + 1], this.files[index]];
        this.renderFileList();
      });

      card.querySelector('.btn-remove-file')?.addEventListener('click', () => {
        this.files.splice(index, 1);
        this.renderFileList();
      });

      this.fileListEl.appendChild(card);
    });
  }

  static async executeMerge() {
    if (this.files.length < 2) return;

    this.mergeBtn.disabled = true;
    this.mergeBtn.innerHTML = `
      <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
      Merging ${this.files.length} PDFs...
    `;

    try {
      const byteArrays = this.files.map(f => f.bytes);
      const mergedBytes = await PdfLibService.mergePDFs(byteArrays);
      
      const blob = new Blob([mergedBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `merged_${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error during merge execution', err);
      alert(`Merge failed: ${err.message}`);
    } finally {
      this.mergeBtn.disabled = false;
      this.mergeBtn.innerHTML = `
        <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"></path></svg>
        Merge PDF Files
      `;
    }
  }

  static reset() {
    this.files = [];
    this.renderFileList();
  }
}
