/**
 * Client-Side Organize & Rotate Pages Tool
 */

import { PdfLibService } from '../services/pdfLibService.js';
import { PdfRenderService } from '../services/pdfRenderService.js';

export class OrganizeTool {
  static currentFile = null;
  static pdfDoc = null;
  static pdfBytes = null;
  static pageList = []; // [{ originalIndex, rotationDelta, id }]

  static init() {
    this.container = document.getElementById('organizeToolContainer');
    this.dropzone = document.getElementById('organizeDropzone');
    this.fileInput = document.getElementById('organizeFileInput');
    this.workspace = document.getElementById('organizeWorkspace');
    this.gridEl = document.getElementById('organizeGrid');
    this.saveBtn = document.getElementById('btnSaveOrganized');

    if (!this.container) return;

    this.setupEventListeners();
  }

  static setupEventListeners() {
    this.dropzone?.addEventListener('click', () => this.fileInput.click());

    this.fileInput?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) this.loadFile(file);
      e.target.value = '';
    });

    // Rotate all right
    document.getElementById('btnRotateAllRight')?.addEventListener('click', () => {
      this.pageList.forEach(p => p.rotationDelta = (p.rotationDelta + 90) % 360);
      this.renderGrid();
    });

    // Save & Export
    this.saveBtn?.addEventListener('click', () => this.executeSave());
  }

  static async loadFile(file) {
    try {
      this.currentFile = file;
      const buffer = await file.arrayBuffer();
      this.pdfBytes = new Uint8Array(buffer);
      this.pdfDoc = await PdfRenderService.loadDocument(buffer.slice(0));

      this.pageList = Array.from({ length: this.pdfDoc.numPages }, (_, i) => ({
        originalIndex: i,
        rotationDelta: 0,
        id: Math.random().toString(36).substring(2, 9)
      }));

      this.dropzone.classList.add('hidden');
      this.workspace.classList.remove('hidden');

      await this.renderGrid();
    } catch (err) {
      console.error('Error loading PDF for organize', err);
      alert(`Error loading file: ${err.message}`);
    }
  }

  static async renderGrid() {
    if (!this.gridEl || !this.pdfDoc) return;
    this.gridEl.innerHTML = '';

    for (let i = 0; i < this.pageList.length; i++) {
      const item = this.pageList[i];
      const card = document.createElement('div');
      card.className = 'organize-card group relative p-3 bg-white rounded-xl border border-slate-200 shadow-sm hover:border-indigo-400 hover:shadow-md transition-all flex flex-col items-center cursor-move';
      card.draggable = true;
      card.dataset.index = i.toString();

      const thumbUrl = await PdfRenderService.generateThumbnail(this.pdfDoc, item.originalIndex + 1, 200, item.rotationDelta);

      card.innerHTML = `
        <div class="w-full h-48 bg-slate-50 rounded-lg overflow-hidden flex items-center justify-center border border-slate-100 mb-2.5 relative">
          <img src="${thumbUrl}" alt="Page ${item.originalIndex + 1}" class="max-h-full max-w-full object-contain pointer-events-none" />
          <div class="absolute bottom-2 right-2 flex space-x-1.5 opacity-90 group-hover:opacity-100 transition-opacity">
            <button class="btn-rotate-card p-1.5 bg-white/95 rounded-lg shadow-sm hover:bg-indigo-50 text-indigo-600" title="Rotate 90°">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
            </button>
            <button class="btn-delete-card p-1.5 bg-white/95 rounded-lg shadow-sm hover:bg-red-50 text-red-600" title="Delete Page">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            </button>
          </div>
        </div>
        <div class="flex items-center justify-between w-full px-1">
          <span class="text-xs font-bold text-slate-700">Page ${i + 1}</span>
          <span class="text-[11px] text-slate-400 font-medium">(Orig: #${item.originalIndex + 1})</span>
        </div>
      `;

      // Rotation Action
      card.querySelector('.btn-rotate-card')?.addEventListener('click', (e) => {
        e.stopPropagation();
        item.rotationDelta = (item.rotationDelta + 90) % 360;
        this.renderGrid();
      });

      // Deletion Action
      card.querySelector('.btn-delete-card')?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.pageList.length <= 1) {
          alert('Cannot delete the last remaining page.');
          return;
        }
        this.pageList.splice(i, 1);
        this.renderGrid();
      });

      // Drag and Drop Reordering
      this.attachDragEvents(card, i);

      this.gridEl.appendChild(card);
    }
  }

  static attachDragEvents(card, index) {
    card.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', index.toString());
      card.classList.add('opacity-40');
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('opacity-40');
    });

    card.addEventListener('dragover', (e) => {
      e.preventDefault();
      card.classList.add('border-indigo-600');
    });

    card.addEventListener('dragleave', () => {
      card.classList.remove('border-indigo-600');
    });

    card.addEventListener('drop', (e) => {
      e.preventDefault();
      card.classList.remove('border-indigo-600');
      const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
      const toIndex = index;

      if (fromIndex !== toIndex && !isNaN(fromIndex)) {
        const movedItem = this.pageList.splice(fromIndex, 1)[0];
        this.pageList.splice(toIndex, 0, movedItem);
        this.renderGrid();
      }
    });
  }

  static async executeSave() {
    if (this.pageList.length === 0 || !this.pdfBytes) return;

    this.saveBtn.disabled = true;
    this.saveBtn.textContent = 'Generating PDF...';

    try {
      const pageOrder = this.pageList.map(p => p.originalIndex);
      const pageRotations = new Map();
      this.pageList.forEach(p => {
        if (p.rotationDelta !== 0) pageRotations.set(p.originalIndex, p.rotationDelta);
      });

      const outputBytes = await PdfLibService.exportEditedPDF({
        originalPdfBytes: this.pdfBytes,
        pageCanvases: new Map(),
        pageRotations: pageRotations,
        pageOrder: pageOrder,
        deletedPages: new Set()
      });

      const blob = new Blob([outputBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `organized_${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error saving organized PDF', err);
      alert(`Save failed: ${err.message}`);
    } finally {
      this.saveBtn.disabled = false;
      this.saveBtn.textContent = 'Save & Download PDF';
    }
  }

  static reset() {
    this.currentFile = null;
    this.pdfDoc = null;
    this.pdfBytes = null;
    this.pageList = [];
    this.dropzone?.classList.remove('hidden');
    this.workspace?.classList.add('hidden');
  }
}
