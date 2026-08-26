/**
 * Main Application Entry Point and View Dispatcher
 */

import { state } from './state.js';
import { PdfRenderService } from './services/pdfRenderService.js';
import { PdfLibService } from './services/pdfLibService.js';
import { CanvasManager } from './editor/canvasManager.js';
import { EditorToolbar } from './editor/toolbar.js';
import { PageManager } from './editor/pageManager.js';
import { SignatureModal } from './editor/signatureModal.js';
import { TextOptionsPanel } from './editor/textOptionsPanel.js';
import { MergeTool } from './tools/mergeTool.js';
import { SplitTool } from './tools/splitTool.js';
import { OrganizeTool } from './tools/organizeTool.js';
import { ImageConvertTool } from './tools/imageConvertTool.js';
import { SecurityTool } from './tools/securityTool.js';
import { WatermarkTool } from './tools/watermarkTool.js';

class App {
  static init() {
    // 1. Initialize Sub-modules
    EditorToolbar.init();
    TextOptionsPanel.init();
    SignatureModal.init();
    MergeTool.init();
    SplitTool.init();
    OrganizeTool.init();
    ImageConvertTool.init();
    SecurityTool.init();
    WatermarkTool.init();

    // 2. Setup Global Navigation & View Switcher
    this.setupNavigation();

    // 3. Setup Editor File Drop / Open
    this.setupEditorFileOpen();

    // 4. Setup Save & Download Action
    this.setupSaveExport();

    // 5. Global Drag-and-Drop Handler
    this.setupGlobalDragAndDrop();

    // 6. Initialize Lucide Icons
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  static setupNavigation() {
    // Nav bar links & dashboard cards
    document.querySelectorAll('[data-nav-view]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const targetView = el.dataset.navView;
        this.switchView(targetView);
      });
    });

    state.subscribe('viewChanged', (viewName) => {
      // Hide all view containers
      document.querySelectorAll('.view-container').forEach(view => {
        view.classList.add('hidden');
      });

      // Show targeted view
      const targetEl = document.getElementById(`view-${viewName}`);
      if (targetEl) targetEl.classList.remove('hidden');

      // Update navbar active state
      document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.toggle('text-indigo-600', link.dataset.navView === viewName);
        link.classList.toggle('font-semibold', link.dataset.navView === viewName);
        link.classList.toggle('text-slate-600', link.dataset.navView !== viewName);
      });

      // Reset tools when navigating away
      if (viewName !== 'merge') MergeTool.reset();
      if (viewName !== 'split') SplitTool.reset();
      if (viewName !== 'organize') OrganizeTool.reset();
      if (viewName !== 'convert') ImageConvertTool.reset();
      if (viewName !== 'security') SecurityTool.reset();
      if (viewName !== 'watermark') WatermarkTool.reset();

      if (window.lucide) window.lucide.createIcons();
    });
  }

  static switchView(viewName) {
    state.setView(viewName);
  }

  static setupEditorFileOpen() {
    const editorDropzone = document.getElementById('editorDropzone');
    const editorFileInput = document.getElementById('editorFileInput');
    const navOpenFileBtn = document.getElementById('navOpenFileBtn');

    editorDropzone?.addEventListener('click', () => editorFileInput?.click());
    navOpenFileBtn?.addEventListener('click', () => editorFileInput?.click());

    document.getElementById('btnHomeLoadSample')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.loadSamplePDF();
    });

    document.getElementById('btnSplashLoadSample')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.loadSamplePDF();
    });

    editorFileInput?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        await this.loadDocumentIntoEditor(file);
      }
      e.target.value = '';
    });
  }

  static async loadSamplePDF() {
    try {
      const response = await fetch('./sample.pdf');
      if (!response.ok) throw new Error('sample.pdf not found');
      const blob = await response.blob();
      const file = new File([blob], 'sample.pdf', { type: 'application/pdf' });
      await this.loadDocumentIntoEditor(file);
    } catch (err) {
      console.error('Failed to load sample.pdf', err);
      alert(`Could not load sample.pdf: ${err.message}`);
    }
  }

  static async loadDocumentIntoEditor(file) {
    console.log('[PDFZen] Starting document load:', file.name, `(${file.size} bytes)`);
    const loadingOverlay = document.getElementById('globalLoadingOverlay');
    if (loadingOverlay) loadingOverlay.classList.remove('hidden');

    try {
      state.resetDocument();
      state.doc.file = file;
      state.doc.fileName = file.name;

      const buffer = await file.arrayBuffer();
      state.doc.pdfBytes = new Uint8Array(buffer);
      console.log('[PDFZen] ArrayBuffer loaded, parsing with PDF.js...');
      
      state.doc.pdfjsDoc = await PdfRenderService.loadDocument(buffer.slice(0));
      console.log('[PDFZen] PDF.js loaded document successfully. Total pages:', state.doc.pdfjsDoc.numPages);

      // Switch to Editor View
      this.switchView('editor');

      // Hide upload splash, show editor workspace
      document.getElementById('editorUploadSplash')?.classList.add('hidden');
      document.getElementById('editorWorkspace')?.classList.remove('hidden');

      // Update filename display
      const titleInput = document.getElementById('editorDocTitle');
      if (titleInput) titleInput.value = file.name.replace(/\.[^/.]+$/, '');

      // Render document pages & thumbnails
      console.log('[PDFZen] Rendering pages into viewport...');
      await PageManager.renderDocument(state.doc.pdfjsDoc, state.doc.zoom);
      console.log('[PDFZen] Page rendering complete!');

      if (loadingOverlay) loadingOverlay.classList.add('hidden');
      if (window.lucide) window.lucide.createIcons();
    } catch (err) {
      console.error('[PDFZen] Error opening PDF in editor:', err);
      alert(`Could not open PDF: ${err.message}\nCheck console for details.`);
      if (loadingOverlay) loadingOverlay.classList.add('hidden');
    }
  }

  static setupSaveExport() {
    const saveBtn = document.getElementById('btnSaveEditedPdf');
    if (!saveBtn) return;

    saveBtn.addEventListener('click', async () => {
      if (!state.doc.pdfBytes) return;

      const originalText = saveBtn.innerHTML;
      saveBtn.disabled = true;
      saveBtn.innerHTML = `
        <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
        Saving PDF...
      `;

      try {
        const outputBytes = await PdfLibService.exportEditedPDF({
          originalPdfBytes: state.doc.pdfBytes,
          pageCanvases: state.doc.pageCanvases,
          pageRotations: state.doc.pageRotations,
          pageOrder: state.doc.pageOrder,
          deletedPages: state.doc.deletedPages
        });

        const docTitle = document.getElementById('editorDocTitle')?.value.trim() || 'edited_document';
        const blob = new Blob([outputBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${docTitle}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error('Export failed', err);
        alert(`Export failed: ${err.message}`);
      } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalText;
        if (window.lucide) window.lucide.createIcons();
      }
    });
  }

  static setupGlobalDragAndDrop() {
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', async (e) => {
      e.preventDefault();
      // If dropped on document outside specialized dropzones
      if (e.target.closest('.specialized-dropzone')) return;

      const files = Array.from(e.dataTransfer.files);
      const pdfFile = files.find(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'));
      if (pdfFile) {
        await this.loadDocumentIntoEditor(pdfFile);
      }
    });
  }
}

// Bootstrap on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
