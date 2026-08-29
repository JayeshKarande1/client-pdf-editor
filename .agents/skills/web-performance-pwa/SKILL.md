---
name: web-performance-pwa
description: Client-side web performance optimization, memory management for heavy canvas/PDF operations, zero-backend PWA caching strategies, Service Worker offline readiness, and Core Web Vitals optimization.
---

# Web Performance & Offline-First (PWA) Engineering Skill

This skill provides optimization patterns for client-side, heavy-computation single-page applications dealing with large PDF files, canvas buffers, and high-frequency DOM manipulation.

---

## 1. Browser Memory Management & Leak Prevention
When rendering multi-page PDFs (e.g. 50+ pages), canvas contexts and ArrayBuffers can rapidly consume gigabytes of RAM.

- **Canvas Context Disposal**:
  When pages are re-rendered or destroyed, explicitly clear canvas dimensions and remove references:
  `javascript
  function destroyCanvas(canvasElement, fabricInstance) {
    if (fabricInstance) {
      fabricInstance.clear();
      fabricInstance.dispose();
    }
    if (canvasElement) {
      canvasElement.width = 0;
      canvasElement.height = 0;
    }
  }
  `
- **Virtual Page Rendering (Intersection Observer)**:
  Only render the high-resolution canvas for pages currently inside or near the viewport (1.5x screen buffer). For offscreen pages, keep a placeholder container with computed dimensions.

---

## 2. Progressive Web App (PWA) & Offline Caching
Enable users to use PDFDost offline without internet connection:

### Web Manifest (manifest.json)
`json
{
  "name": "PDFDost - 100% Client-Side PDF Editor",
  "short_name": "PDFDost",
  "start_url": "./index.html",
  "display": "standalone",
  "background_color": "#f8fafc",
  "theme_color": "#4f46e5",
  "icons": [
    { "src": "./icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "./icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
`

### Cache-First Service Worker Strategy
Cache static assets (pdf.min.js, abric.min.js, pdf-lib.min.js, icons, CSS) so initial load is instant and works completely offline.

---

## 3. Core Web Vitals Optimization
- **Largest Contentful Paint (LCP)**: Preload critical fonts and defer non-essential tool scripts.
- **Cumulative Layout Shift (CLS)**: Always set fixed aspect-ratio placeholders on page wrapper divs before PDF.js finishes rendering.
- **Interaction to Next Paint (INP)**: Debounce heavy canvas recalculations (equestAnimationFrame) during text input and drawing.
