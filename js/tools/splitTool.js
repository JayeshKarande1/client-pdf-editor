/**
 * Client-Side Split PDF Tool
 */

import { PdfLibService } from '../services/pdfLibService.js';
import { PdfRenderService } from '../services/pdfRenderService.js';

export class SplitTool {
  static currentFile = null;
  static pdfDoc = null;
  static pdfBytes = null;
  static selectedPages = new Set(); // 0-indexed

  static init() {
    this.container = document.getElementById('splitToolContainer');
    this.dropzone = document.getElementById('splitDropzone');
    this.fileInput = document.getElementById('splitFileInput');
    this.workspace = document.getElementById('splitWorkspace');
    this.gridEl = document.getElementById('splitThumbnailGrid');
    this.rangeInput = document.getElementById('splitRangeInput');
    this.splitBtn = document.getElementById('btnExecuteSplit');
    this.selectModeRadios = document.querySelectorAll('input[name="splitMode"]');

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

    // Select All / Deselect All
    document.getElementById('btnSplitSelectAll')?.addEventListener('click', () => {
      if (!this.pdfDoc) return;
      for (let i = 0; i < this.pdfDoc.numPages; i++) this.selectedPages.add(i);
      this.syncSelectionUI();
    });

    document.getElementById('btnSplitDeselectAll')?.addEventListener('click', () => {
      this.selectedPages.clear();
      this.syncSelectionUI();
    });

    // Custom Range Input Parser
    this.rangeInput?.addEventListener('input', (e) => {
      this.parseRangeInput(e.target.value);
    });

    // Execute Split
    this.splitBtn?.addEventListener('click', () => this.executeSplit());
  }

  static async loadFile(file) {
    try {
      this.currentFile = file;
      const buffer = await file.arrayBuffer();
      this.pdfBytes = new Uint8Array(buffer);
      this.pdfDoc = await PdfRenderService.loadDocument(buffer.slice(0));
      this.selectedPages.clear();

      // By default select all pages
      for (let i = 0; i < this.pdfDoc.numPages; i++) this.selectedPages.add(i);

      this.dropzone.classList.add('hidden');
      this.workspace.classList.remove('hidden');

      await this.renderGrid();
      this.syncSelectionUI();
    } catch (err) {
      console.error('Failed to load PDF for split', err);
      alert(`Error opening file: ${err.message}`);
    }
  }

  static async renderGrid() {
    if (!this.gridEl || !this.pdfDoc) return;
    this.gridEl.innerHTML = '';

    for (let pageNum = 1; pageNum <= this.pdfDoc.numPages; pageNum++) {
      const pageIndex = pageNum - 1;
      const card = document.createElement('div');
      card.className = 'split-page-card relative cursor-pointer p-2.5 rounded-xl border-2 transition-all bg-white shadow-sm flex flex-col items-center group';
      card.dataset.pageIndex = pageIndex.toString();

      const thumbUrl = await PdfRenderService.generateThumbnail(this.pdfDoc, pageNum, 180);

      card.innerHTML = `
        <div class="absolute top-3 left-3 z-10">
          <input type="checkbox" class="split-checkbox w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer pointer-events-none" checked />
        </div>
        <div class="w-full h-44 bg-slate-50 rounded-lg overflow-hidden flex items-center justify-center border border-slate-100 mb-2">
          <img src="${thumbUrl}" alt="Page ${pageNum}" class="max-h-full max-w-full object-contain pointer-events-none" />
        </div>
        <span class="text-xs font-semibold text-slate-700">Page ${pageNum}</span>
      `;

      card.addEventListener('click', () => {
        if (this.selectedPages.has(pageIndex)) {
          this.selectedPages.delete(pageIndex);
        } else {
          this.selectedPages.add(pageIndex);
        }
        this.syncSelectionUI();
      });

      this.gridEl.appendChild(card);
    }
  }

  static syncSelectionUI() {
    document.querySelectorAll('.split-page-card').forEach(card => {
      const pIndex = parseInt(card.dataset.pageIndex, 10);
      const isSelected = this.selectedPages.has(pIndex);
      const checkbox = card.querySelector('.split-checkbox');
      if (checkbox) checkbox.checked = isSelected;

      if (isSelected) {
        card.classList.add('border-indigo-600', 'bg-indigo-50/40');
        card.classList.remove('border-slate-200');
      } else {
        card.classList.remove('border-indigo-600', 'bg-indigo-50/40');
        card.classList.add('border-slate-200');
      }
    });

    if (this.splitBtn) {
      this.splitBtn.disabled = this.selectedPages.size === 0;
      this.splitBtn.textContent = `Extract ${this.selectedPages.size} ${this.selectedPages.size === 1 ? 'Page' : 'Pages'}`;
    }
  }

  static parseRangeInput(str) {
    if (!this.pdfDoc) return;
    this.selectedPages.clear();
    const parts = str.split(',').map(p => p.trim()).filter(Boolean);

    parts.forEach(part => {
      if (part.includes('-')) {
        const [start, end] = part.split('-').map(n => parseInt(n.trim(), 10));
        if (!isNaN(start) && !isNaN(end)) {
          const min = Math.max(1, Math.min(start, end));
          const max = Math.min(this.pdfDoc.numPages, Math.max(start, end));
          for (let i = min; i <= max; i++) this.selectedPages.add(i - 1);
        }
      } else {
        const pageNum = parseInt(part, 10);
        if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= this.pdfDoc.numPages) {
          this.selectedPages.add(pageNum - 1);
        }
      }
    });

    this.syncSelectionUI();
  }

  static async executeSplit() {
    if (this.selectedPages.size === 0 || !this.pdfBytes) return;

    this.splitBtn.disabled = true;
    this.splitBtn.textContent = 'Extracting pages...';

    try {
      const selectedIndices = Array.from(this.selectedPages).sort((a, b) => a - b);
      const splitResults = await PdfLibService.splitPDF(this.pdfBytes, [selectedIndices]);

      if (splitResults.length > 0) {
        const blob = new Blob([splitResults[0].bytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `extracted_pages_${Date.now()}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Split failed', err);
      alert(`Split failed: ${err.message}`);
    } finally {
      this.splitBtn.disabled = false;
      this.syncSelectionUI();
    }
  }

  static reset() {
    this.currentFile = null;
    this.pdfDoc = null;
    this.pdfBytes = null;
    this.selectedPages.clear();
    this.dropzone?.classList.remove('hidden');
    this.workspace?.classList.add('hidden');
  }
}
