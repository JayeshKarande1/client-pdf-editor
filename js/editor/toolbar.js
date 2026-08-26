/**
 * Interactive Visual Editor Toolbar & Property Panel
 */

import { state } from '../state.js';
import { CanvasManager } from './canvasManager.js';
import { HistoryManager } from './historyManager.js';
import { SignatureModal } from './signatureModal.js';

export class EditorToolbar {
  static init() {
    this.setupToolButtons();
    this.setupPropertyControls();
    this.setupActionButtons();
    this.setupKeybindings();
    this.subscribeToStateChanges();
  }

  /**
   * Bind primary tool selection buttons (Select, Edit Text, Text, Pen, Highlight, Shapes, etc.)
   */
  static setupToolButtons() {
    document.querySelectorAll('.editor-tool-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tool = btn.dataset.tool;

        if (tool === 'signature') {
          SignatureModal.open();
          return;
        }

        if (tool === 'image-upload') {
          document.getElementById('imageUploadInput')?.click();
          return;
        }

        state.setEditorTool(tool);
        CanvasManager.updateAllCanvasesTool(tool);
      });
    });

    // Image Upload Handler
    document.getElementById('imageUploadInput')?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          CanvasManager.addImageToCurrentPage(event.target.result);
        };
        reader.readAsDataURL(file);
      }
      e.target.value = ''; // Reset input
    });
  }

  /**
   * Setup contextual property controls (Colors, Font sizes, Stroke widths)
   */
  static setupPropertyControls() {
    // Text Color
    const textColorInput = document.getElementById('propTextColor');
    textColorInput?.addEventListener('input', (e) => {
      state.updateEditorSettings({ textColor: e.target.value });
      this.updateActiveCanvasObject({ fill: e.target.value });
    });

    // Font Size
    const fontSizeInput = document.getElementById('propFontSize');
    fontSizeInput?.addEventListener('change', (e) => {
      const val = parseInt(e.target.value, 10) || 16;
      state.updateEditorSettings({ fontSize: val });
      this.updateActiveCanvasObject({ fontSize: val });
    });

    // Font Family
    const fontFamilySelect = document.getElementById('propFontFamily');
    fontFamilySelect?.addEventListener('change', (e) => {
      state.updateEditorSettings({ fontFamily: e.target.value });
      this.updateActiveCanvasObject({ fontFamily: e.target.value });
    });

    // Bold & Italic
    document.getElementById('propBoldBtn')?.addEventListener('click', () => {
      const newBold = !state.editor.isBold;
      state.updateEditorSettings({ isBold: newBold });
      this.updateActiveCanvasObject({ fontWeight: newBold ? 'bold' : 'normal' });
    });

    document.getElementById('propItalicBtn')?.addEventListener('click', () => {
      const newItalic = !state.editor.isItalic;
      state.updateEditorSettings({ isItalic: newItalic });
      this.updateActiveCanvasObject({ fontStyle: newItalic ? 'italic' : 'normal' });
    });

    // Draw / Highlight Color & Width
    const drawColorInput = document.getElementById('propDrawColor');
    drawColorInput?.addEventListener('input', (e) => {
      state.updateEditorSettings({ drawColor: e.target.value });
      CanvasManager.updateAllCanvasesTool(state.editor.activeTool);
    });

    const drawWidthInput = document.getElementById('propDrawWidth');
    drawWidthInput?.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10) || 3;
      state.updateEditorSettings({ drawWidth: val });
      CanvasManager.updateAllCanvasesTool(state.editor.activeTool);
    });

    // Shape Colors
    const shapeStrokeInput = document.getElementById('propShapeStroke');
    shapeStrokeInput?.addEventListener('input', (e) => {
      state.updateEditorSettings({ shapeStrokeColor: e.target.value });
      this.updateActiveCanvasObject({ stroke: e.target.value });
    });

    const shapeFillInput = document.getElementById('propShapeFill');
    shapeFillInput?.addEventListener('input', (e) => {
      state.updateEditorSettings({ shapeFillColor: e.target.value });
      this.updateActiveCanvasObject({ fill: e.target.value });
    });

    const shapeFillToggle = document.getElementById('propShapeFillToggle');
    shapeFillToggle?.addEventListener('change', (e) => {
      const filled = e.target.checked;
      state.updateEditorSettings({ shapeFilled: filled });
      this.updateActiveCanvasObject({ fill: filled ? state.editor.shapeFillColor : 'transparent' });
    });
  }

  /**
   * Setup Undo/Redo, Delete, and Zoom actions
   */
  static setupActionButtons() {
    // Undo
    document.getElementById('btnUndo')?.addEventListener('click', () => {
      console.log('[EditorToolbar] Undo button clicked!');
      const activePageIndex = Math.max(0, (state.doc.currentPage || 1) - 1);
      const currentCanvas = state.doc.pageCanvases.get(activePageIndex) || state.doc.pageCanvases.get(0);
      if (currentCanvas) HistoryManager.undo(activePageIndex, currentCanvas);
    });

    // Redo
    document.getElementById('btnRedo')?.addEventListener('click', () => {
      console.log('[EditorToolbar] Redo button clicked!');
      const activePageIndex = Math.max(0, (state.doc.currentPage || 1) - 1);
      const currentCanvas = state.doc.pageCanvases.get(activePageIndex) || state.doc.pageCanvases.get(0);
      if (currentCanvas) HistoryManager.redo(activePageIndex, currentCanvas);
    });

    // Delete Object
    document.getElementById('btnDeleteObject')?.addEventListener('click', () => {
      CanvasManager.deleteSelectedObject();
    });

    // Zoom Controls
    document.getElementById('btnZoomIn')?.addEventListener('click', () => {
      state.setZoom(state.doc.zoom + 0.15);
    });

    document.getElementById('btnZoomOut')?.addEventListener('click', () => {
      state.setZoom(state.doc.zoom - 0.15);
    });

    document.getElementById('btnZoomFit')?.addEventListener('click', () => {
      state.setZoom(1.0);
    });
  }

  /**
   * Helper: Apply properties to currently selected canvas object
   */
  static updateActiveCanvasObject(props) {
    const activePageIndex = Math.max(0, (state.doc.currentPage || 1) - 1);
    const canvas = state.doc.pageCanvases.get(activePageIndex) || state.doc.pageCanvases.get(0);
    if (!canvas) return;
    const activeObj = canvas.getActiveObject();
    if (activeObj) {
      activeObj.set(props);
      canvas.renderAll();
      HistoryManager.pushState(activePageIndex, canvas);
    }
  }

  /**
   * Keyboard shortcuts (Delete, Backspace, Ctrl+Z, Ctrl+Y, Tool Hotkeys)
   */
  static setupKeybindings() {
    window.addEventListener('keydown', (e) => {
      if (state.currentView !== 'editor') return;

      // Ignore when typing inside an input, textarea or active IText editing
      const activeCanvas = state.doc.pageCanvases.get(Math.max(0, (state.doc.currentPage || 1) - 1));
      const activeObj = activeCanvas?.getActiveObject();
      const isEditingText = activeObj && activeObj.isEditing;

      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

      // Delete key
      if ((e.key === 'Delete' || e.key === 'Backspace') && !isEditingText) {
        if (activeObj) {
          e.preventDefault();
          CanvasManager.deleteSelectedObject();
        }
      }

      // Ctrl + Z (Undo)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        const activePageIndex = Math.max(0, (state.doc.currentPage || 1) - 1);
        const canvas = state.doc.pageCanvases.get(activePageIndex) || state.doc.pageCanvases.get(0);
        if (canvas) HistoryManager.undo(activePageIndex, canvas);
        return;
      }

      // Ctrl + Y or Ctrl + Shift + Z (Redo)
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
        e.preventDefault();
        const activePageIndex = Math.max(0, (state.doc.currentPage || 1) - 1);
        const canvas = state.doc.pageCanvases.get(activePageIndex) || state.doc.pageCanvases.get(0);
        if (canvas) HistoryManager.redo(activePageIndex, canvas);
        return;
      }

      // Quick Tool Hotkeys (when not holding Ctrl/Meta and not typing text)
      if (!e.ctrlKey && !e.metaKey && !e.altKey && !isEditingText) {
        const key = e.key.toLowerCase();
        if (key === 'v') { state.setEditorTool('select'); CanvasManager.updateAllCanvasesTool('select'); }
        else if (key === 'e') { state.setEditorTool('edit-text'); CanvasManager.updateAllCanvasesTool('edit-text'); }
        else if (key === 't') { state.setEditorTool('text'); CanvasManager.updateAllCanvasesTool('text'); }
        else if (key === 'p') { state.setEditorTool('draw'); CanvasManager.updateAllCanvasesTool('draw'); }
        else if (key === 'h') { state.setEditorTool('highlight'); CanvasManager.updateAllCanvasesTool('highlight'); }
        else if (key === 'r') { state.setEditorTool('rectangle'); CanvasManager.updateAllCanvasesTool('rectangle'); }
        else if (key === 'c') { state.setEditorTool('circle'); CanvasManager.updateAllCanvasesTool('circle'); }
        else if (key === 'l') { state.setEditorTool('line'); CanvasManager.updateAllCanvasesTool('line'); }
        else if (key === 'w') { state.setEditorTool('whiteout'); CanvasManager.updateAllCanvasesTool('whiteout'); }
      }
    });
  }

  /**
   * Reactively update UI states on events
   */
  static subscribeToStateChanges() {
    // Tool changed
    state.subscribe('toolChanged', (tool) => {
      document.querySelectorAll('.editor-tool-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tool === tool);
      });

      // Show/Hide context sub-bars
      const textProps = document.getElementById('textPropertiesBar');
      const drawProps = document.getElementById('drawPropertiesBar');
      const shapeProps = document.getElementById('shapePropertiesBar');

      if (textProps) textProps.classList.toggle('hidden', tool !== 'text');
      if (drawProps) drawProps.classList.toggle('hidden', !['draw', 'highlight'].includes(tool));
      if (shapeProps) shapeProps.classList.toggle('hidden', !['rectangle', 'circle', 'line', 'arrow'].includes(tool));
    });

    // History changed (update undo/redo button disabled states)
    state.subscribe('historyChanged', ({ canUndo, canRedo }) => {
      const undoBtn = document.getElementById('btnUndo');
      const redoBtn = document.getElementById('btnRedo');
      if (undoBtn) undoBtn.disabled = !canUndo;
      if (redoBtn) redoBtn.disabled = !canRedo;
    });

    // Zoom changed
    state.subscribe('zoomChanged', (zoom) => {
      const zoomText = document.getElementById('zoomDisplay');
      if (zoomText) zoomText.textContent = `${Math.round(zoom * 100)}%`;
    });

    // Object selected (populate property bar with selected object attributes)
    state.subscribe('objectSelected', (props) => {
      if (props.fontSize) {
        const sizeInput = document.getElementById('propFontSize');
        if (sizeInput) sizeInput.value = props.fontSize;
      }
      if (props.fill && typeof props.fill === 'string' && props.fill.startsWith('#')) {
        const colorInput = document.getElementById('propTextColor');
        if (colorInput) colorInput.value = props.fill;
      }
      const delBtn = document.getElementById('btnDeleteObject');
      if (delBtn) delBtn.classList.remove('opacity-40');
    });

    state.subscribe('selectionCleared', () => {
      const delBtn = document.getElementById('btnDeleteObject');
      if (delBtn) delBtn.classList.add('opacity-40');
    });
  }
}
