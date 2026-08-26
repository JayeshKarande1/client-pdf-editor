/**
 * PDFZen Advanced Text Options Panel Controller
 * Handles Presets, Fonts, Sizes, Decorations, Colors, Alignment, Lists, Spacing, and Layering
 */

import { state } from '../state.js';
import { HistoryManager } from './historyManager.js';

export class TextOptionsPanel {
  static init() {
    this.panel = document.getElementById('textOptionsDrawer');
    if (!this.panel) return;

    this.bindEvents();
    this.subscribeToSelection();
  }

  /**
   * Toggle Drawer Visibility
   */
  static toggle(show = null) {
    if (!this.panel) return;
    const isHidden = this.panel.classList.contains('hidden');
    const shouldShow = show !== null ? show : isHidden;

    if (shouldShow) {
      this.panel.classList.remove('hidden');
      document.getElementById('btnToggleTextOptions')?.classList.add('bg-indigo-50', 'text-indigo-600');
      this.syncWithActiveObject();
    } else {
      this.panel.classList.add('hidden');
      document.getElementById('btnToggleTextOptions')?.classList.remove('bg-indigo-50', 'text-indigo-600');
    }
  }

  /**
   * Get active text object from current canvas
   */
  static getActiveTextObject() {
    const activePageIndex = Math.max(0, (state.doc.currentPage || 1) - 1);
    const canvas = state.doc.pageCanvases.get(activePageIndex) || state.doc.pageCanvases.get(0);
    if (!canvas) return { canvas: null, textObj: null };

    const activeObj = canvas.getActiveObject();
    if (activeObj && (activeObj.type === 'i-text' || activeObj.type === 'text')) {
      return { canvas, textObj: activeObj, pageIndex: activePageIndex };
    }
    return { canvas, textObj: null, pageIndex: activePageIndex };
  }

  /**
   * Apply property to active text object and record history
   */
  static applyTextProperty(prop, value) {
    const { canvas, textObj, pageIndex } = this.getActiveTextObject();
    if (!textObj || !canvas) return;

    textObj.set(prop, value);
    canvas.renderAll();
    HistoryManager.pushState(pageIndex, canvas);

    // Sync global state
    state.updateEditorSettings({ [prop]: value });
  }

  /**
   * Sync panel inputs with currently active Fabric text object
   */
  static syncWithActiveObject() {
    const { textObj } = this.getActiveTextObject();
    if (!textObj) return;

    // Font & Size
    const fontSelect = document.getElementById('optFontFamily');
    if (fontSelect && textObj.fontFamily) {
      fontSelect.value = textObj.fontFamily;
    }

    const sizeInput = document.getElementById('optFontSize');
    if (sizeInput && textObj.fontSize) {
      sizeInput.value = Math.round(textObj.fontSize);
    }

    // Decorations
    document.getElementById('optBoldBtn')?.classList.toggle('active-toggle', textObj.fontWeight === 'bold');
    document.getElementById('optItalicBtn')?.classList.toggle('active-toggle', textObj.fontStyle === 'italic');
    document.getElementById('optUnderlineBtn')?.classList.toggle('active-toggle', !!textObj.underline);
    document.getElementById('optStrikeBtn')?.classList.toggle('active-toggle', !!textObj.linethrough);

    // Colors
    const textColorInput = document.getElementById('optTextColor');
    if (textColorInput && textObj.fill && typeof textObj.fill === 'string' && textObj.fill.startsWith('#')) {
      textColorInput.value = textObj.fill;
    }

    const bgColorInput = document.getElementById('optBgColor');
    if (bgColorInput && textObj.textBackgroundColor && typeof textObj.textBackgroundColor === 'string' && textObj.textBackgroundColor.startsWith('#')) {
      bgColorInput.value = textObj.textBackgroundColor;
    }

    // Opacity
    const opacitySlider = document.getElementById('optOpacitySlider');
    const opacityVal = document.getElementById('optOpacityValue');
    const currentOpacity = textObj.opacity !== undefined ? Math.round(textObj.opacity * 100) : 100;
    if (opacitySlider) opacitySlider.value = currentOpacity;
    if (opacityVal) opacityVal.textContent = `${currentOpacity}%`;

    // Alignment
    const currentAlign = textObj.textAlign || 'left';
    document.querySelectorAll('.opt-align-btn').forEach(btn => {
      btn.classList.toggle('active-toggle', btn.dataset.align === currentAlign);
    });

    // Spacing
    const lineSpacing = document.getElementById('optLineSpacing');
    if (lineSpacing) {
      lineSpacing.value = textObj.lineHeight ? textObj.lineHeight.toFixed(2) : '1.16';
    }

    const letterSpacing = document.getElementById('optLetterSpacing');
    const letterSpacingVal = document.getElementById('optLetterSpacingValue');
    const charSpace = textObj.charSpacing || 0;
    if (letterSpacing) letterSpacing.value = charSpace;
    if (letterSpacingVal) letterSpacingVal.textContent = `${charSpace}`;
  }

  /**
   * Listen to selection events to auto-sync panel
   */
  static subscribeToSelection() {
    state.subscribe('objectSelected', (props) => {
      const { textObj } = this.getActiveTextObject();
      if (textObj) {
        this.syncWithActiveObject();
      }
    });

    state.subscribe('selectionCleared', () => {
      // Retain or reset
    });
  }

  /**
   * Bind UI Buttons and Inputs
   */
  static bindEvents() {
    // 1. Close Drawer
    document.getElementById('btnCloseTextOptions')?.addEventListener('click', () => {
      this.toggle(false);
    });

    // 2. Open / Toggle Drawer Button
    document.getElementById('btnToggleTextOptions')?.addEventListener('click', () => {
      this.toggle();
    });

    // 3. Preset "Turn Into" Selector
    document.getElementById('optPresetSelect')?.addEventListener('change', (e) => {
      const val = e.target.value;
      const presets = {
        'title': { fontSize: 32, fontWeight: 'bold', fontStyle: 'normal', lineHeight: 1.1 },
        'h1': { fontSize: 24, fontWeight: 'bold', fontStyle: 'normal', lineHeight: 1.15 },
        'h2': { fontSize: 18, fontWeight: 'bold', fontStyle: 'normal', lineHeight: 1.2 },
        'subheading': { fontSize: 15, fontWeight: 'normal', fontStyle: 'italic', lineHeight: 1.25 },
        'normal': { fontSize: 12, fontWeight: 'normal', fontStyle: 'normal', lineHeight: 1.2 },
        'caption': { fontSize: 10, fontWeight: 'normal', fontStyle: 'normal', lineHeight: 1.2 },
        'code': { fontSize: 12, fontFamily: 'Consolas, Courier New, monospace', fontWeight: 'normal', fontStyle: 'normal', lineHeight: 1.3 }
      };

      const preset = presets[val];
      if (preset) {
        const { canvas, textObj, pageIndex } = this.getActiveTextObject();
        if (textObj && canvas) {
          textObj.set(preset);
          canvas.renderAll();
          HistoryManager.pushState(pageIndex, canvas);
          this.syncWithActiveObject();
        }
      }
    });

    // 4. Font Family Selector
    document.getElementById('optFontFamily')?.addEventListener('change', (e) => {
      this.applyTextProperty('fontFamily', e.target.value);
    });

    // 5. Font Size Decrement / Increment & Input
    const sizeInput = document.getElementById('optFontSize');
    sizeInput?.addEventListener('change', (e) => {
      const size = Math.max(6, Math.min(120, parseInt(e.target.value, 10) || 16));
      e.target.value = size;
      this.applyTextProperty('fontSize', size);
    });

    document.getElementById('btnFontSizeDec')?.addEventListener('click', () => {
      if (!sizeInput) return;
      const cur = parseInt(sizeInput.value, 10) || 16;
      const next = Math.max(6, cur - 1);
      sizeInput.value = next;
      this.applyTextProperty('fontSize', next);
    });

    document.getElementById('btnFontSizeInc')?.addEventListener('click', () => {
      if (!sizeInput) return;
      const cur = parseInt(sizeInput.value, 10) || 16;
      const next = Math.min(120, cur + 1);
      sizeInput.value = next;
      this.applyTextProperty('fontSize', next);
    });

    // 6. Text Decorations (Bold, Italic, Underline, Strikethrough)
    document.getElementById('optBoldBtn')?.addEventListener('click', () => {
      const { textObj } = this.getActiveTextObject();
      const isBold = textObj?.fontWeight === 'bold';
      this.applyTextProperty('fontWeight', isBold ? 'normal' : 'bold');
      document.getElementById('optBoldBtn')?.classList.toggle('active-toggle', !isBold);
    });

    document.getElementById('optItalicBtn')?.addEventListener('click', () => {
      const { textObj } = this.getActiveTextObject();
      const isItalic = textObj?.fontStyle === 'italic';
      this.applyTextProperty('fontStyle', isItalic ? 'normal' : 'italic');
      document.getElementById('optItalicBtn')?.classList.toggle('active-toggle', !isItalic);
    });

    document.getElementById('optUnderlineBtn')?.addEventListener('click', () => {
      const { textObj } = this.getActiveTextObject();
      const isUnderline = !!textObj?.underline;
      this.applyTextProperty('underline', !isUnderline);
      document.getElementById('optUnderlineBtn')?.classList.toggle('active-toggle', !isUnderline);
    });

    document.getElementById('optStrikeBtn')?.addEventListener('click', () => {
      const { textObj } = this.getActiveTextObject();
      const isStrike = !!textObj?.linethrough;
      this.applyTextProperty('linethrough', !isStrike);
      document.getElementById('optStrikeBtn')?.classList.toggle('active-toggle', !isStrike);
    });

    // 7. Text Color & Swatches
    document.getElementById('optTextColor')?.addEventListener('input', (e) => {
      this.applyTextProperty('fill', e.target.value);
    });

    document.querySelectorAll('.opt-color-swatch').forEach(swatch => {
      swatch.addEventListener('click', () => {
        const color = swatch.dataset.color;
        const colorInput = document.getElementById('optTextColor');
        if (colorInput) colorInput.value = color;
        this.applyTextProperty('fill', color);
      });
    });

    // 8. Text Background Highlight & Swatches
    document.getElementById('optBgColor')?.addEventListener('input', (e) => {
      this.applyTextProperty('textBackgroundColor', e.target.value);
    });

    document.querySelectorAll('.opt-bg-swatch').forEach(swatch => {
      swatch.addEventListener('click', () => {
        const color = swatch.dataset.color || '';
        const bgInput = document.getElementById('optBgColor');
        if (bgInput && color.startsWith('#')) bgInput.value = color;
        this.applyTextProperty('textBackgroundColor', color);
      });
    });

    // 9. Opacity Slider
    const opacitySlider = document.getElementById('optOpacitySlider');
    const opacityVal = document.getElementById('optOpacityValue');
    opacitySlider?.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      if (opacityVal) opacityVal.textContent = `${val}%`;
      this.applyTextProperty('opacity', val / 100);
    });

    // 10. Alignment Buttons
    document.querySelectorAll('.opt-align-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const align = btn.dataset.align;
        this.applyTextProperty('textAlign', align);
        document.querySelectorAll('.opt-align-btn').forEach(b => b.classList.remove('active-toggle'));
        btn.classList.add('active-toggle');
      });
    });

    // 11. Lists (Bullet, Numbered, Remove)
    document.getElementById('optListNone')?.addEventListener('click', () => {
      this.transformList('none');
    });

    document.getElementById('optListBullet')?.addEventListener('click', () => {
      this.transformList('bullet');
    });

    document.getElementById('optListNumber')?.addEventListener('click', () => {
      this.transformList('number');
    });

    // 12. Case Transformation
    document.getElementById('optCaseUpper')?.addEventListener('click', () => {
      this.transformCase('upper');
    });
    document.getElementById('optCaseLower')?.addEventListener('click', () => {
      this.transformCase('lower');
    });
    document.getElementById('optCaseTitle')?.addEventListener('click', () => {
      this.transformCase('title');
    });

    // 13. Line Spacing
    document.getElementById('optLineSpacing')?.addEventListener('change', (e) => {
      const val = parseFloat(e.target.value) || 1.16;
      this.applyTextProperty('lineHeight', val);
    });

    // 14. Letter Spacing (Char Spacing)
    const letterSpacing = document.getElementById('optLetterSpacing');
    const letterSpacingVal = document.getElementById('optLetterSpacingValue');
    letterSpacing?.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10) || 0;
      if (letterSpacingVal) letterSpacingVal.textContent = `${val}`;
      this.applyTextProperty('charSpacing', val);
    });

    // 15. Layer Actions (Bring Forward, Send Backward, Duplicate, Delete)
    document.getElementById('optLayerFront')?.addEventListener('click', () => {
      const { canvas, textObj, pageIndex } = this.getActiveTextObject();
      if (textObj && canvas) {
        textObj.bringToFront();
        canvas.renderAll();
        HistoryManager.pushState(pageIndex, canvas);
      }
    });

    document.getElementById('optLayerBack')?.addEventListener('click', () => {
      const { canvas, textObj, pageIndex } = this.getActiveTextObject();
      if (textObj && canvas) {
        textObj.sendToBack();
        canvas.renderAll();
        HistoryManager.pushState(pageIndex, canvas);
      }
    });

    document.getElementById('optDuplicateText')?.addEventListener('click', () => {
      const { canvas, textObj, pageIndex } = this.getActiveTextObject();
      if (textObj && canvas) {
        textObj.clone((cloned) => {
          cloned.set({
            left: textObj.left + 20,
            top: textObj.top + 20
          });
          canvas.add(cloned);
          canvas.setActiveObject(cloned);
          canvas.renderAll();
          HistoryManager.pushState(pageIndex, canvas);
        });
      }
    });

    document.getElementById('optDeleteText')?.addEventListener('click', () => {
      const { canvas, textObj, pageIndex } = this.getActiveTextObject();
      if (textObj && canvas) {
        canvas.remove(textObj);
        canvas.discardActiveObject();
        canvas.renderAll();
        HistoryManager.pushState(pageIndex, canvas);
      }
    });
  }

  /**
   * Transform text into bullet or numbered list
   */
  static transformList(type) {
    const { canvas, textObj, pageIndex } = this.getActiveTextObject();
    if (!textObj || !canvas) return;

    const lines = textObj.text.split('\n');
    const transformed = lines.map((line, idx) => {
      // Strip existing bullets/numbers
      const clean = line.replace(/^([•\-\*]|\d+\.|\([a-z0-9]\))\s*/, '');
      if (type === 'bullet') return `• ${clean}`;
      if (type === 'number') return `${idx + 1}. ${clean}`;
      return clean;
    });

    textObj.set('text', transformed.join('\n'));
    canvas.renderAll();
    HistoryManager.pushState(pageIndex, canvas);
  }

  /**
   * Transform text case (UPPERCASE, lowercase, Title Case)
   */
  static transformCase(type) {
    const { canvas, textObj, pageIndex } = this.getActiveTextObject();
    if (!textObj || !canvas) return;

    let text = textObj.text;
    if (type === 'upper') {
      text = text.toUpperCase();
    } else if (type === 'lower') {
      text = text.toLowerCase();
    } else if (type === 'title') {
      text = text.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
    }

    textObj.set('text', text);
    canvas.renderAll();
    HistoryManager.pushState(pageIndex, canvas);
  }
}
