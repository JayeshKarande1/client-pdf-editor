/**
 * Application State Management for Client-Side PDF Suite
 */

class AppState {
  constructor() {
    this.listeners = new Map();
    
    // Global Navigation State
    this.currentView = 'home'; // 'home' | 'editor' | 'merge' | 'split' | 'organize' | 'convert' | 'security' | 'watermark'
    
    // Active Document State (for Editor & Viewers)
    this.doc = {
      file: null,
      fileName: '',
      pdfBytes: null,
      pdfjsDoc: null,
      numPages: 0,
      pageDimensions: [], // [{ width, height, rotation, scale }]
      pageCanvases: new Map(), // pageIndex -> Fabric.Canvas
      pageRotations: new Map(), // pageIndex -> delta degrees (0, 90, 180, 270)
      pageOrder: [], // [0, 1, 2, ...] array of page indices
      deletedPages: new Set(),
      zoom: 1.0,
      currentPage: 1
    };

    // Visual Editor Active Tool & Styling Properties
    this.editor = {
      activeTool: 'select', // 'select' | 'text' | 'draw' | 'highlight' | 'rectangle' | 'circle' | 'line' | 'arrow' | 'whiteout' | 'stamp'
      
      // Text styling
      textColor: '#0f172a',
      fontSize: 16,
      fontFamily: 'Helvetica', // 'Helvetica' | 'Times' | 'Courier' | 'Arial'
      isBold: false,
      isItalic: false,
      textAlign: 'left',
      
      // Freehand Pen
      drawColor: '#4f46e5',
      drawWidth: 3,
      
      // Highlighter
      highlightColor: '#fef08a',
      highlightWidth: 20,
      highlightOpacity: 0.45,
      
      // Shapes
      shapeStrokeColor: '#ef4444',
      shapeFillColor: 'transparent',
      shapeStrokeWidth: 3,
      shapeFilled: false,
      
      // Whiteout / Redaction
      whiteoutColor: '#ffffff',
      
      // History tracking
      canUndo: false,
      canRedo: false
    };
  }

  // Subscribe to state change events
  subscribe(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.listeners.get(event).delete(callback);
  }

  // Emit event to subscribers
  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(cb => cb(data));
    }
  }

  // Switch active view/tool
  setView(viewName) {
    this.currentView = viewName;
    this.emit('viewChanged', viewName);
  }

  // Reset current document
  resetDocument() {
    // Dispose all fabric canvases to prevent memory leaks
    this.doc.pageCanvases.forEach(canvas => {
      try {
        canvas.dispose();
      } catch (e) {
        console.error('Error disposing canvas', e);
      }
    });

    this.doc = {
      file: null,
      fileName: '',
      pdfBytes: null,
      pdfjsDoc: null,
      numPages: 0,
      pageDimensions: [],
      pageCanvases: new Map(),
      pageRotations: new Map(),
      pageOrder: [],
      deletedPages: new Set(),
      zoom: 1.0,
      currentPage: 1
    };

    this.editor.canUndo = false;
    this.editor.canRedo = false;
    this.emit('documentReset');
  }

  // Set active editor tool
  setEditorTool(tool) {
    this.editor.activeTool = tool;
    this.emit('toolChanged', tool);
  }

  // Update editor styling options
  updateEditorSettings(partialSettings) {
    Object.assign(this.editor, partialSettings);
    this.emit('settingsChanged', this.editor);
  }

  // Zoom control
  setZoom(zoom) {
    const clampedZoom = Math.min(Math.max(zoom, 0.4), 3.0);
    this.doc.zoom = clampedZoom;
    this.emit('zoomChanged', clampedZoom);
  }

  // Page selection
  setCurrentPage(pageNum) {
    this.doc.currentPage = Math.min(Math.max(pageNum, 1), this.doc.numPages);
    this.emit('pageChanged', this.doc.currentPage);
  }
}

export const state = new AppState();
