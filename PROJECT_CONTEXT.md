# 🧠 PDFZen - AI Developer Guide & Architecture Context

> **Target Audience**: AI Coding Assistants, LLMs, and Human Developers working on this codebase.  
> **Core Philosophy**: 100% Client-Side Web Execution. Zero Backend APIs. Complete Privacy. Zero Build-Step Friction.

---

## 📌 1. Project Overview & Architecture

**PDFZen** is a professional, high-performance, 100% client-side web application for viewing, editing, annotating, signing, manipulating, and converting PDF documents.

### Tech Stack & Vendor Libraries (Self-Hosted in `/js/libs/`):
* **Architecture**: Modern Vanilla JavaScript (ES6 Modules) + Tailwind CSS (via CDN / PostCSS).
* **PDF Rendering & Text Layer Extraction**: `PDF.js` (v3.11.174) with Web Workers.
* **Vector Canvas & Interactive Annotations**: `Fabric.js` (v5.1.0).
* **PDF Generation, Manipulation & Security**: `pdf-lib` (v1.17.1).
* **File Packaging & Export**: `JSZip` + `FileSaver.js`.
* **Icons**: `Lucide Icons`.
* **Zero Build Step**: Native browser ES modules (`import / export`). Run directly with any static file server (`python -m http.server 3000`).

---

## 📂 2. File & Directory Structure

```
client-pdf-editor/
├── index.html                     # Main SPA entry with modular views, toolbars, and drawers
├── css/
│   └── styles.css                 # Custom scrollbars, glassmorphism, fonts, active toggle styles
├── js/
│   ├── app.js                     # Main bootstrap entry point, navigation router, drag-and-drop
│   ├── state.js                   # Central reactive state manager & pub/sub event bus
│   ├── editor/
│   │   ├── canvasManager.js       # Fabric.js canvas lifecycle, tool modes, mouse handlers, Retina scaling
│   │   ├── historyManager.js      # Undo/Redo state serialization with fabric.util.enlivenObjects
│   │   ├── pageManager.js         # Multi-page PDF layout, scroll observer, DOM in-place text overlay
│   │   ├── textOptionsPanel.js    # Canva/Acrobat-style right-side typography & formatting drawer
│   │   ├── toolbar.js             # Top header bar, bottom floating toolbar, keybindings, property bars
│   │   └── signatureModal.js      # Digital signature modal (Draw, Type with Cursive Fonts, Upload)
│   ├── services/
│   │   ├── pdfRenderService.js    # PDF.js page rendering, PostScript font extraction, bullet normalizer
│   │   ├── pdfLibService.js       # pdf-lib 300 DPI annotation burning, page manipulation, encryption
│   │   └── imageService.js        # JPG/PNG/WebP <-> PDF conversions, ZIP image extraction
│   ├── tools/
│   │   ├── mergeTool.js           # Multi-PDF merger with drag-and-drop card ordering
│   │   ├── splitTool.js           # Visual page selector and range splitter (e.g. 1-3, 5, 8-10)
│   │   ├── organizeTool.js        # Visual page grid with reordering, 90° rotation, and deletion
│   │   ├── imageConvertTool.js    # Image to PDF / PDF to Image batch converter
│   │   ├── securityTool.js        # Client-side AES PDF encryption / password protection
│   │   └── watermarkTool.js       # Text watermark, security stamps, and page numbers
│   └── libs/                      # Self-hosted vendor scripts (offline-capable, zero CORS errors)
├── tests/                         # Automated Playwright browser tests
│   ├── test_all_crud.py           # Full CRUD (Create, Edit, Delete, Undo, Redo) automated validation
│   ├── test_bullet_and_style.py   # Font family, weight, italic, and bullet symbol verification
│   └── test_text_options_drawer.py# Typography panel presets, colors, alignment, and list tests
├── sample.pdf                     # Standard sample PDF used for development & testing
├── README.md                      # Public project documentation & badges
└── PROJECT_CONTEXT.md             # THIS FILE: Complete AI & Developer Guide
```

---

## ⚙️ 3. Core Mechanisms & Implementation Rules

### 🅰️ In-Place Existing Text Modification Engine
* **How it works**:
  1. `PdfRenderService.extractPageTextLines()` extracts glyph bounding boxes, matrices, and font descriptors.
  2. Clicking **"Edit Existing Text"** (`E`) reveals invisible clickable DOM overlay boxes (`.existing-text-block`).
  3. Clicking any line calls `PageManager.convertTextToEditable()`:
     - Adds a solid white background mask (`fabric.Rect`) with generous padding to completely eliminate underlying ghosting.
     - Adds an editable `fabric.IText` positioned precisely over the mask.
     - Sets `_isTemporary = true` on the mask so both the mask and replacement text are recorded as a **single atomic undo/redo action**.
     - Focuses the text, enters editing mode, and selects all text for immediate typing.

### 🅱️ Deep PostScript Font Matching & Normalization
* **Font Extraction**:
  - We query `page.commonObjs` directly to read real embedded PostScript font names (e.g., `BAAAAA+LiberationSans-Bold`, `CAAAAA+DejaVuSans`).
  - Strips subset prefixes (`^[a-z]{6}\+`).
  - Font weight: Detects `bold`, `heavy`, `black`, or `commonObj.bold`.
  - Font style: Detects `italic`, `oblique`, `commonObj.italic`, or affine transformation skew factors (`transform[2] !== 0`).
  - Font family mapping:
    - Sans-Serif: `"Segoe UI, DejaVu Sans, Arial, sans-serif"`
    - Serif: `"Georgia, Times New Roman, serif"`
    - Monospace: `"Consolas, Courier New, monospace"`
* **Bullet Symbol Normalization**:
  - Replaces private Unicode symbol glyphs (`\uf0b7`, `\uf000-\uf0ff`, etc.) with universal standard bullets (`• `).
  - Merges isolated bullet glyphs and following list text on the same line into a unified editable string.

### 🅲️ Anti-Blur & High-DPI Vector Rendering
* **Live Canvas**:
  - Sets `fabric.Object.prototype.objectCaching = false` to eliminate low-res offscreen raster caching blur.
  - Sets `window.fabric.devicePixelRatio = window.devicePixelRatio || 1` and `enableRetinaScaling: true`.
* **Export Resolution**:
  - `PdfLibService.exportEditedPDF` exports vector canvas overlays at `multiplier: 3` (equivalent to **300 DPI print-ready quality**).

### 🅳️ Robust Undo / Redo Engine (`HistoryManager.js`)
* **Object Restoration**:
  - Restores canvas states via `window.fabric.util.enlivenObjects(objectsData, callback)` and `canvas.clear()`.
* **Event Rebound Protection**:
  - Sets `isOperating = true` during `undo()` / `redo()` to prevent blur (`text:editing:exited`) from pushing duplicate states back onto the stack.
* **Current Page Synchronization**:
  - Canvas mouse events (`mouse:down`, `object:added`, `object:modified`) update `state.doc.currentPage` so undo operations always target the correct page.

### 🅴️ Advanced "Text Options" Drawer (`TextOptionsPanel.js`)
* Provides full typography controls:
  - **Presets**: *Normal (12px), Title (32px), Heading 1 (24px), Heading 2 (18px), Subheading (15px Italic), Caption (10px), Code (12px)*.
  - **Decorations**: Bold (`B`), Italic (`I`), Underline (`U`), Strikethrough (`S`).
  - **Colors & Opacity**: Text fill swatches, pastel background highlights, and 10%–100% opacity slider.
  - **Alignment & Lists**: Left, Center, Right, Justify, and Bullet (`•`) / Numbered (`1. 2. 3.`) list converters.
  - **Spacing & Kerning**: Line spacing (`1.0` to `2.0`) and letter spacing (`-20` to `200`).
  - **Layering**: Bring to Front, Send to Back, Duplicate, Delete.

---

## 🧪 4. Testing & Development Workflows

### 1. Running the Local Development Server:
```powershell
python -m http.server 3000
```
Open **[http://localhost:3000](http://localhost:3000)** in the browser.

### 2. Running Automated Browser Tests (Playwright):
Always run the test suite to validate changes before concluding a task:
```powershell
# Run full CRUD & Undo/Redo validation
python tests/test_all_crud.py

# Run bullet normalization and font matching verification
python tests/test_bullet_and_style.py

# Run Text Options typography drawer verification
python tests/test_text_options_drawer.py
```

---

## 📋 5. Important Conventions for AI Agents

1. **Keep Everything Client-Side**: Never introduce server-side processing or remote API dependencies for PDF manipulation. All compute must remain inside the user's browser.
2. **Preserve Self-Hosted Vendor Libraries**: Do not replace `/js/libs/` with external CDN `<script>` tags, as local hosting eliminates CORS worker issues and enables offline usage.
3. **Use Reactive State**: When modifying document or editor parameters, use `state.updateEditorSettings()` or `state.emit()` so all sub-panels stay synchronized.
4. **Browser Validation**: Validate visual features and interactions using the Playwright test suite and screenshot inspection.
