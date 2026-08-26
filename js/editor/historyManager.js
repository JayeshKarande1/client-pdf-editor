/**
 * Undo / Redo History Manager for PDF Canvas Annotations
 */

import { state } from '../state.js';

export class HistoryManager {
  static historyMap = new Map(); // pageIndex -> { undoStack: [], redoStack: [], isOperating: false }
  static maxHistoryLength = 30;

  static getPageState(pageIndex) {
    if (!this.historyMap.has(pageIndex)) {
      this.historyMap.set(pageIndex, {
        undoStack: [],
        redoStack: [],
        isOperating: false
      });
    }
    return this.historyMap.get(pageIndex);
  }

  /**
   * Push current canvas state to undo stack
   */
  static pushState(pageIndex, canvas) {
    const pageHistory = this.getPageState(pageIndex);
    if (pageHistory.isOperating) return;

    const rawObjects = canvas.getObjects().filter(o => !o._isTemporary);
    const objects = rawObjects.map(obj => {
      const o = obj.toObject(['selectable', '_isTemporary', 'editable', 'pointType']);
      delete o.isEditing;
      delete o.cursorOffsetCache;
      return o;
    });
    const json = JSON.stringify(objects);

    // Don't push if the object list is identical to the top of the stack
    if (pageHistory.undoStack.length > 0) {
      const topJson = pageHistory.undoStack[pageHistory.undoStack.length - 1];
      if (topJson === json) {
        return;
      }
    }

    pageHistory.undoStack.push(json);
    if (pageHistory.undoStack.length > this.maxHistoryLength) {
      pageHistory.undoStack.shift();
    }
    pageHistory.redoStack = [];

    this.updateGlobalState(pageIndex);
  }

  /**
   * Undo last action on canvas
   */
  static undo(pageIndex, canvas) {
    const pageHistory = this.getPageState(pageIndex);
    console.log('[HistoryManager] undo called. pageIndex:', pageIndex, 'stack length:', pageHistory.undoStack.length, 'isOperating:', pageHistory.isOperating);
    if (pageHistory.undoStack.length <= 1 || pageHistory.isOperating) {
      console.log('[HistoryManager] undo aborted: stack <= 1 or isOperating is true');
      return;
    }

    pageHistory.isOperating = true;

    // Exit active text editing if any
    const activeObj = canvas.getActiveObject();
    if (activeObj) {
      if (activeObj.isEditing) activeObj.exitEditing();
      canvas.discardActiveObject();
    }

    const currentState = pageHistory.undoStack.pop();
    pageHistory.redoStack.push(currentState);

    const previousState = pageHistory.undoStack[pageHistory.undoStack.length - 1];
    console.log('[HistoryManager] restoring previousState:', previousState);
    
    this.restoreCanvasObjects(canvas, previousState, () => {
      console.log('[HistoryManager] restoreCanvasObjects callback executed!');
      pageHistory.isOperating = false;
      this.updateGlobalState(pageIndex);
      state.emit('selectionCleared');
    });
  }

  /**
   * Redo action on canvas
   */
  static redo(pageIndex, canvas) {
    const pageHistory = this.getPageState(pageIndex);
    if (pageHistory.redoStack.length === 0 || pageHistory.isOperating) return;

    pageHistory.isOperating = true;

    const activeObj = canvas.getActiveObject();
    if (activeObj) {
      if (activeObj.isEditing) activeObj.exitEditing();
      canvas.discardActiveObject();
    }

    const nextState = pageHistory.redoStack.pop();
    pageHistory.undoStack.push(nextState);

    this.restoreCanvasObjects(canvas, nextState, () => {
      pageHistory.isOperating = false;
      this.updateGlobalState(pageIndex);
      state.emit('selectionCleared');
    });
  }

  /**
   * Helper: Restore canvas objects from JSON string using enlivenObjects
   */
  static restoreCanvasObjects(canvas, jsonString, callback) {
    canvas.clear();
    const objectsData = JSON.parse(jsonString || '[]');
    
    if (objectsData && objectsData.length > 0) {
      window.fabric.util.enlivenObjects(objectsData, (enlivenedObjects) => {
        enlivenedObjects.forEach(obj => canvas.add(obj));
        canvas.renderAll();
        setTimeout(callback, 50);
      });
    } else {
      canvas.renderAll();
      setTimeout(callback, 50);
    }
  }

  /**
   * Clear history for a page or all pages
   */
  static clear(pageIndex = null) {
    if (pageIndex !== null) {
      this.historyMap.delete(pageIndex);
    } else {
      this.historyMap.clear();
    }
    state.editor.canUndo = false;
    state.editor.canRedo = false;
    state.emit('historyChanged', { canUndo: false, canRedo: false });
  }

  static updateGlobalState(pageIndex) {
    const pageHistory = this.getPageState(pageIndex);
    const canUndo = pageHistory.undoStack.length > 1;
    const canRedo = pageHistory.redoStack.length > 0;
    state.editor.canUndo = canUndo;
    state.editor.canRedo = canRedo;
    state.emit('historyChanged', { canUndo, canRedo });
  }
}
