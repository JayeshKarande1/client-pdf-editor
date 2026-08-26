# PDFZen - 100% Client-Side PDF Editor & Productivity Suite

![PDFZen Banner](https://img.shields.io/badge/PDFZen-100%25%20Client--Side-4f46e5?style=for-the-badge&logo=adobeacrobatreader)
![License](https://img.shields.io/badge/license-MIT-green?style=for-the-badge)
![Privacy](https://img.shields.io/badge/Privacy-Zero%20Server%20Uploads-blue?style=for-the-badge)

**PDFZen** is a lightning-fast, modern, 100% client-side web application for editing, annotating, signing, merging, splitting, converting, organizing, and securing PDF documents. All operations happen directly in the user's browser using WebAssembly and HTML5 Canvas with **zero backend server processing** and **complete document privacy**.

---

## ✨ Features

### 📝 1. In-Place Text Editing & Direct Vector Annotations
* **Edit Existing PDF Text**: Automatically detects existing lines and PostScript fonts (`Liberation Sans`, `DejaVu Sans`, `Times New Roman`, etc.), allowing users to click and modify text directly in place.
* **Text Options Drawer (Canva & Acrobat Style)**:
  * Presets: Title, Heading 1, Heading 2, Subheading, Normal Text, Monospace Code.
  * Typography: Font family, size increment/decrement, Bold, Italic, Underline, Strikethrough, Line spacing, and Letter spacing.
  * Colors & Highlighting: Color palettes, pastel background highlights, and real-time opacity sliders.
  * Alignment & Lists: Left, Center, Right, Justify, and Bulleted/Numbered list formatting.
* **Vector Drawing & Shapes**:
  * Freehand Pen & Highlighter with stroke and color controls.
  * Rectangles, Ellipses/Circles, Straight Lines, Directional Arrows, and Whiteout boxes.
* **Digital Signatures & Stamps**:
  * Draw signatures, Type signatures in cursive calligraphy fonts (*Great Vibes, Caveat, Dancing Script, Satisfy*), or Upload image signatures.
  * Image stamps and logo placement.
* **Robust Undo / Redo**:
  * Full state history stack (`Ctrl+Z` / `Ctrl+Y`) protecting against event rebound.

### 🛠️ 2. Comprehensive PDF Suite (iLovePDF Style)
* **Merge PDF**: Combine multiple PDFs into a single file with interactive card reordering.
* **Split PDF**: Visual thumbnail page selector with custom page range syntax (e.g. `1-3, 5, 8-10`).
* **Organize & Rotate**: Visual grid of all page thumbnails with drag-and-drop reordering, single-click page rotation (90° clockwise), and page deletion.
* **Image to PDF**: Convert JPG, PNG, and WebP images to formatted PDFs with custom margins and orientations.
* **PDF to Images (ZIP)**: Convert all PDF pages to high-resolution PNG or JPG images bundled into a downloadable ZIP archive.
* **Watermark & Page Numbers**: Add custom text watermarks, diagonal security stamps, and automated page numbering (`Page X of Y`).
* **Password Protect**: Encrypt PDF files client-side.

### 🖨️ 3. Ultra-Crisp 300 DPI Export
* High-DPI Retina vector rendering during live editing.
* 300 DPI print-ready PDF export via `pdf-lib`.

---

## 🚀 Getting Started

### Local Development Setup

No complex build pipeline required! Simply serve the directory using any static file server:

```bash
# Clone the repository
git clone https://github.com/JayeshKarande1/client-pdf-editor.git
cd client-pdf-editor

# Start a local HTTP server
python -m http.server 3000
```

Open your browser and navigate to:
👉 **[http://localhost:3000](http://localhost:3000)**

---

## 🧪 Automated Testing

Automated end-to-end tests are written with Playwright:

```bash
# Install dependencies
pip install playwright
python -m playwright install chromium

# Run all test suites
python tests/test_all_crud.py
python tests/test_bullet_and_style.py
python tests/test_text_options_drawer.py
```

---

## 🔒 Privacy & Security

* **100% Client-Side**: No PDF, image, or user text is ever sent over the network or uploaded to a remote server.
* **Offline Capable**: All vendor libraries (`pdf.js`, `pdf-lib`, `fabric.js`, `jszip`, `lucide`) are self-hosted locally in `/js/libs/`.

---

## 📄 License

MIT License © 2026 Jayesh Karande
