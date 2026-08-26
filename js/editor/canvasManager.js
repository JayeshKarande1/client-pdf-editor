/**
 * Fabric.js Interactive Vector Canvas Manager per PDF Page
 */

import { state } from '../state.js';
import { HistoryManager } from './historyManager.js';

export class CanvasManager {
  /**
   * Initialize a Fabric.js canvas instance on top of a rendered PDF page canvas
   */
  static initPageCanvas(canvasElement, pageIndex, dimensions) {
    if (!window.fabric) {
      throw new Error('Fabric.js library is not loaded');
    }

    const pixelRatio = window.devicePixelRatio || 1;
    window.fabric.devicePixelRatio = pixelRatio;

    const fabricCanvas = new window.fabric.Canvas(canvasElement, {
      width: dimensions.width,
      height: dimensions.height,
      selection: true,
      preserveObjectStacking: true,
      stopContextMenu: true,
      fireRightClick: true,
      enableRetinaScaling: true
    });

    // Disable offscreen raster caching to ensure ultra-crisp vector and font rendering on all displays
    window.fabric.Object.prototype.set({
      objectCaching: false,
      transparentCorners: false,
      cornerColor: '#4f46e5',
      cornerStrokeColor: '#ffffff',
      borderColor: '#4f46e5',
      cornerSize: 10,
      cornerStyle: 'circle',
      padding: 6,
      borderDashArray: [4, 4]
    });

    // Store in global state
    state.doc.pageCanvases.set(pageIndex, fabricCanvas);

    // Attach drawing and shape interaction handlers
    this.setupCanvasInteractions(fabricCanvas, pageIndex);

    // Apply current active tool mode
    this.applyToolMode(fabricCanvas, state.editor.activeTool);

    return fabricCanvas;
  }

  /**
   * Configure interactive tool events (draw, shapes, text, etc.)
   */
  static setupCanvasInteractions(canvas, pageIndex) {
    let isDrawingShape = false;
    let activeShape = null;
    let startX = 0;
    let startY = 0;

    // Track object modifications for Undo / Redo
    const recordHistory = () => {
      HistoryManager.pushState(pageIndex, canvas);
    };

    canvas.on('object:added', (e) => {
      state.setCurrentPage(pageIndex + 1);
      if (!e.target._isTemporary) {
        recordHistory();
      }
    });
    canvas.on('object:modified', () => {
      state.setCurrentPage(pageIndex + 1);
      recordHistory();
    });
    canvas.on('object:removed', () => {
      state.setCurrentPage(pageIndex + 1);
      recordHistory();
    });
    canvas.on('path:created', () => {
      state.setCurrentPage(pageIndex + 1);
      recordHistory();
    });
    canvas.on('text:changed', () => {
      state.setCurrentPage(pageIndex + 1);
      recordHistory();
    });
    canvas.on('text:editing:exited', () => {
      state.setCurrentPage(pageIndex + 1);
      recordHistory();
    });

    // Mouse Down Handler for Shape Creation & Text Insertion
    canvas.on('mouse:down', (options) => {
      state.setCurrentPage(pageIndex + 1);
      const tool = state.editor.activeTool;
      if (tool === 'select' || tool === 'edit-text') return;

      const pointer = canvas.getPointer(options.e);
      startX = pointer.x;
      startY = pointer.y;

      if (tool === 'text') {
        // Create an editable IText object
        const text = new window.fabric.IText('Click here to edit text', {
          left: startX,
          top: startY,
          fontFamily: state.editor.fontFamily || 'Helvetica',
          fontSize: state.editor.fontSize || 18,
          fill: state.editor.textColor || '#0f172a',
          fontWeight: state.editor.isBold ? 'bold' : 'normal',
          fontStyle: state.editor.isItalic ? 'italic' : 'normal',
          textAlign: state.editor.textAlign || 'left',
          editable: true
        });
        canvas.add(text);
        canvas.setActiveObject(text);
        
        // Switch back to select tool so the user can interactively type or drag
        state.setEditorTool('select');
        this.updateAllCanvasesTool('select');
        
        setTimeout(() => {
          text.enterEditing();
          text.selectAll();
          canvas.renderAll();
        }, 50);
        return;
      }

      if (tool === 'rectangle' || tool === 'whiteout') {
        isDrawingShape = true;
        const isWhiteout = tool === 'whiteout';
        activeShape = new window.fabric.Rect({
          left: startX,
          top: startY,
          width: 1,
          height: 1,
          fill: isWhiteout ? '#ffffff' : (state.editor.shapeFilled ? state.editor.shapeFillColor : 'transparent'),
          stroke: isWhiteout ? '#e2e8f0' : state.editor.shapeStrokeColor,
          strokeWidth: isWhiteout ? 1 : state.editor.shapeStrokeWidth,
          strokeDashArray: isWhiteout ? [2, 2] : null,
          selectable: true,
          _isTemporary: true
        });
        canvas.add(activeShape);
      } else if (tool === 'circle') {
        isDrawingShape = true;
        activeShape = new window.fabric.Ellipse({
          left: startX,
          top: startY,
          rx: 1,
          ry: 1,
          fill: state.editor.shapeFilled ? state.editor.shapeFillColor : 'transparent',
          stroke: state.editor.shapeStrokeColor,
          strokeWidth: state.editor.shapeStrokeWidth,
          selectable: true,
          _isTemporary: true
        });
        canvas.add(activeShape);
      } else if (tool === 'line' || tool === 'arrow') {
        isDrawingShape = true;
        activeShape = new window.fabric.Line([startX, startY, startX, startY], {
          stroke: state.editor.shapeStrokeColor,
          strokeWidth: state.editor.shapeStrokeWidth,
          selectable: true,
          _isTemporary: true
        });
        canvas.add(activeShape);
      }
    });

    // Mouse Move Handler (Dragging shape size)
    canvas.on('mouse:move', (options) => {
      if (!isDrawingShape || !activeShape) return;
      const pointer = canvas.getPointer(options.e);

      const tool = state.editor.activeTool;
      if (tool === 'rectangle' || tool === 'whiteout') {
        const left = Math.min(startX, pointer.x);
        const top = Math.min(startY, pointer.y);
        const width = Math.max(2, Math.abs(pointer.x - startX));
        const height = Math.max(2, Math.abs(pointer.y - startY));
        activeShape.set({ left, top, width, height });
      } else if (tool === 'circle') {
        const rx = Math.max(1, Math.abs(pointer.x - startX) / 2);
        const ry = Math.max(1, Math.abs(pointer.y - startY) / 2);
        const left = Math.min(startX, pointer.x);
        const top = Math.min(startY, pointer.y);
        activeShape.set({ left, top, rx, ry });
      } else if (tool === 'line' || tool === 'arrow') {
        activeShape.set({ x2: pointer.x, y2: pointer.y });
      }
      canvas.renderAll();
    });

    // Mouse Up Handler (Finalize Shape)
    canvas.on('mouse:up', () => {
      if (isDrawingShape && activeShape) {
        activeShape._isTemporary = false;
        
        // If arrow, construct arrowhead polygon and group
        if (state.editor.activeTool === 'arrow') {
          const x1 = activeShape.x1, y1 = activeShape.y1;
          const x2 = activeShape.x2, y2 = activeShape.y2;
          const dx = x2 - x1, dy = y2 - y1;
          const angle = Math.atan2(dy, dx);
          const headLength = 16;

          const arrowHead = new window.fabric.Triangle({
            left: x2,
            top: y2,
            originX: 'center',
            originY: 'center',
            pointType: 'arrow_head',
            angle: (angle * 180 / Math.PI) + 90,
            width: headLength,
            height: headLength,
            fill: state.editor.shapeStrokeColor
          });

          const group = new window.fabric.Group([activeShape, arrowHead], {
            selectable: true
          });
          canvas.remove(activeShape);
          canvas.add(group);
          canvas.setActiveObject(group);
        } else {
          canvas.setActiveObject(activeShape);
        }

        isDrawingShape = false;
        activeShape = null;
        recordHistory();
        canvas.renderAll();
        
        // Auto-switch to select mode after drawing shape
        state.setEditorTool('select');
        this.updateAllCanvasesTool('select');
      }
    });

    // Update state when active object changes
    canvas.on('selection:created', (e) => this.handleSelectionChange(e.target));
    canvas.on('selection:updated', (e) => this.handleSelectionChange(e.target));
    canvas.on('selection:cleared', () => state.emit('selectionCleared'));
  }

  /**
   * Handle object selection to update toolbar inputs
   */
  static handleSelectionChange(activeObject) {
    if (!activeObject) return;
    
    state.emit('objectSelected', {
      type: activeObject.type,
      fill: activeObject.fill,
      stroke: activeObject.stroke,
      fontSize: activeObject.fontSize,
      fontFamily: activeObject.fontFamily,
      fontWeight: activeObject.fontWeight,
      fontStyle: activeObject.fontStyle,
      textAlign: activeObject.textAlign
    });
  }

  /**
   * Apply tool mode to a Fabric canvas
   */
  static applyToolMode(canvas, tool) {
    if (!canvas) return;

    const wrapper = canvas.wrapperEl;
    if (wrapper) {
      wrapper.classList.remove('cursor-draw', 'cursor-text-tool', 'cursor-shape-tool', 'cursor-eraser');
    }

    if (tool === 'draw') {
      canvas.isDrawingMode = true;
      canvas.freeDrawingBrush = new window.fabric.PencilBrush(canvas);
      canvas.freeDrawingBrush.color = state.editor.drawColor || '#4f46e5';
      canvas.freeDrawingBrush.width = state.editor.drawWidth || 3;
      if (wrapper) wrapper.classList.add('cursor-draw');
    } else if (tool === 'highlight') {
      canvas.isDrawingMode = true;
      canvas.freeDrawingBrush = new window.fabric.PencilBrush(canvas);
      const hex = state.editor.highlightColor || '#fef08a';
      const opacity = state.editor.highlightOpacity || 0.45;
      canvas.freeDrawingBrush.color = this.hexToRgba(hex, opacity);
      canvas.freeDrawingBrush.width = state.editor.highlightWidth || 20;
      if (wrapper) wrapper.classList.add('cursor-draw');
    } else {
      canvas.isDrawingMode = false;
      canvas.selection = tool === 'select';
      canvas.forEachObject(obj => {
        obj.selectable = tool === 'select';
        obj.evented = tool === 'select';
      });

      if (wrapper) {
        if (tool === 'text') wrapper.classList.add('cursor-text-tool');
        else if (['rectangle', 'circle', 'line', 'arrow'].includes(tool)) wrapper.classList.add('cursor-shape-tool');
        else if (tool === 'whiteout') wrapper.classList.add('cursor-eraser');
      }
    }
  }

  /**
   * Update all active page canvases when the tool changes
   */
  static updateAllCanvasesTool(tool) {
    state.doc.pageCanvases.forEach(canvas => {
      this.applyToolMode(canvas, tool);
    });
  }

  /**
   * Add an image / signature to the current active canvas
   */
  static addImageToCurrentPage(dataUrl) {
    const activePageIndex = Math.max(0, (state.doc.currentPage || 1) - 1);
    let canvas = state.doc.pageCanvases.get(activePageIndex);
    if (!canvas && state.doc.pageCanvases.size > 0) {
      canvas = state.doc.pageCanvases.get(0);
    }
    if (!canvas) return;

    window.fabric.Image.fromURL(dataUrl, (img) => {
      const maxDim = Math.min(canvas.width, canvas.height) * 0.4;
      if (img.width > maxDim || img.height > maxDim) {
        img.scale(maxDim / Math.max(img.width, img.height));
      }

      img.set({
        left: (canvas.width - img.getScaledWidth()) / 2,
        top: (canvas.height - img.getScaledHeight()) / 2,
        selectable: true
      });

      canvas.add(img);
      canvas.setActiveObject(img);
      canvas.renderAll();
      HistoryManager.pushState(activePageIndex, canvas);
      state.setEditorTool('select');
      this.updateAllCanvasesTool('select');
    });
  }

  /**
   * Delete selected object on active canvas
   */
  static deleteSelectedObject() {
    const activePageIndex = Math.max(0, (state.doc.currentPage || 1) - 1);
    const canvas = state.doc.pageCanvases.get(activePageIndex) || state.doc.pageCanvases.get(0);
    if (!canvas) return;

    const activeObjects = canvas.getActiveObjects();
    if (activeObjects.length > 0) {
      activeObjects.forEach(obj => canvas.remove(obj));
      canvas.discardActiveObject();
      canvas.renderAll();
      HistoryManager.pushState(activePageIndex, canvas);
      state.emit('selectionCleared');
    }
  }

  /**
   * Helper: Hex to RGBA string
   */
  static hexToRgba(hex, alpha) {
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const num = parseInt(c, 16);
    return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
  }
}
