---
name: fabric-canvas-expert
description: Deep expertise in HTML5 Canvas and Fabric.js engineering. Covers DPI retina scaling, interactive text layers, custom controls, undo/redo state stacks, freehand drawing, shapes, and zero-artifact rendering pipelines.
---

# Fabric.js & HTML5 Canvas Engineering Skill

This skill provides best practices, architectural patterns, and debugging guidelines for interactive vector canvas applications built with Fabric.js.

---

## 1. High-DPI & Retina Display Management
To prevent blurriness on Retina/High-DPI screens, always sync devicePixelRatio and disable raster caching for dynamic text/vector objects:

`javascript
const pixelRatio = window.devicePixelRatio || 1;
window.fabric.devicePixelRatio = pixelRatio;

// Disable offscreen raster caching to preserve vector clarity during zoom
window.fabric.Object.prototype.set({
  objectCaching: false,
  transparentCorners: false,
  cornerColor: '#4f46e5',
  cornerStrokeColor: '#ffffff',
  borderColor: '#4f46e5',
  cornerSize: 10,
  cornerStyle: 'circle'
});
`

---

## 2. Text Editing & Clean Replacement
When replacing or editing text inline on a document canvas:
1. **Never render editing box borders**:
   `javascript
   window.fabric.IText.prototype.hasBorders = false;
   window.fabric.IText.prototype.hasControls = false;
   window.fabric.IText.prototype.editingBorderColor = 'rgba(0,0,0,0)';
   window.fabric.IText.prototype.borderColor = 'rgba(0,0,0,0)';
   window.fabric.IText.prototype.padding = 0;
   `
2. **Always discard selection and exit editing before export**:
   `javascript
   fabricCanvas.getObjects().forEach(obj => {
     if (obj.isEditing && typeof obj.exitEditing === 'function') {
       obj.exitEditing();
     }
   });
   fabricCanvas.discardActiveObject();
   fabricCanvas.renderAll();
   `
3. **Background Masking**:
   - Use strokeWidth: 0 and stroke: null on covering rectangles to avoid anti-aliasing seams.
   - Expand mask vertically to account for font descenders (g, j, p, q, y): Math.max(8, fontSize * 0.35).
   - Expand mask horizontally dynamically as new characters are typed via 	extObj.on('changed', ...).

---

## 3. High-Resolution Multiplier Export
When exporting vector canvas content to a raster image overlay for PDF stamping, use a **5x resolution multiplier** to match crisp native print DPI:

`javascript
const dataUrl = fabricCanvas.toDataURL({
  format: 'png',
  multiplier: 5,
  enableRetinaScaling: true
});
`

---

## 4. Undo / Redo History Stack Management
Maintain page-isolated JSON state stacks with debouncing:
- Cap stack depth at 30 snapshots to avoid memory bloat.
- Ignore transient objects marked with _isTemporary: true.
- Serialize with canvas.toJSON(['_isWhiteout', '_isTemporary', 'id']) to preserve custom metadata.
