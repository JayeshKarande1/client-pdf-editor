/**
 * Multi-Mode Digital Signature Modal (Draw, Type, Upload)
 */

import { CanvasManager } from './canvasManager.js';

export class SignatureModal {
  static init() {
    this.modalEl = document.getElementById('signatureModal');
    this.drawCanvasEl = document.getElementById('signatureDrawCanvas');
    this.typeInputEl = document.getElementById('signatureTextInput');
    this.typePreviewContainer = document.getElementById('signatureTypePreviews');
    this.fileInputEl = document.getElementById('signatureFileInput');
    this.imagePreviewEl = document.getElementById('signatureImagePreview');
    this.insertBtn = document.getElementById('insertSignatureBtn');
    
    if (!this.modalEl) return;

    this.activeTab = 'draw';
    this.signatureDataUrl = null;
    this.isDrawing = false;
    this.drawCtx = this.drawCanvasEl.getContext('2d');

    this.setupDrawingCanvas();
    this.setupEventListeners();
  }

  static open() {
    this.modalEl.classList.remove('hidden');
    this.clearDrawCanvas();
    this.setTab('draw');
  }

  static close() {
    this.modalEl.classList.add('hidden');
  }

  static setTab(tab) {
    this.activeTab = tab;
    document.querySelectorAll('.signature-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    document.querySelectorAll('.signature-tab-content').forEach(content => {
      content.classList.toggle('hidden', content.dataset.tab !== tab);
    });
  }

  static setupDrawingCanvas() {
    const canvas = this.drawCanvasEl;
    const ctx = this.drawCtx;

    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const getPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      const clientX = e.clientX || (e.touches && e.touches[0].clientX);
      const clientY = e.clientY || (e.touches && e.touches[0].clientY);
      return {
        x: (clientX - rect.left) * (canvas.width / rect.width),
        y: (clientY - rect.top) * (canvas.height / rect.height)
      };
    };

    const startDraw = (e) => {
      e.preventDefault();
      this.isDrawing = true;
      const pos = getPos(e);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    };

    const moveDraw = (e) => {
      if (!this.isDrawing) return;
      e.preventDefault();
      const pos = getPos(e);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    };

    const stopDraw = () => {
      if (this.isDrawing) {
        this.isDrawing = false;
        ctx.closePath();
      }
    };

    canvas.addEventListener('mousedown', startDraw);
    canvas.addEventListener('mousemove', moveDraw);
    canvas.addEventListener('mouseup', stopDraw);
    canvas.addEventListener('mouseleave', stopDraw);

    canvas.addEventListener('touchstart', startDraw, { passive: false });
    canvas.addEventListener('touchmove', moveDraw, { passive: false });
    canvas.addEventListener('touchend', stopDraw);
  }

  static clearDrawCanvas() {
    this.drawCtx.clearRect(0, 0, this.drawCanvasEl.width, this.drawCanvasEl.height);
  }

  static setupEventListeners() {
    // Tab Switching
    document.querySelectorAll('.signature-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => this.setTab(btn.dataset.tab));
    });

    // Clear Draw Button
    document.getElementById('clearSignatureDrawBtn')?.addEventListener('click', () => {
      this.clearDrawCanvas();
    });

    // Color Selector
    document.querySelectorAll('.sig-color-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        this.drawCtx.strokeStyle = btn.dataset.color;
        document.querySelectorAll('.sig-color-opt').forEach(b => b.classList.remove('ring-2', 'ring-offset-2', 'ring-indigo-500'));
        btn.classList.add('ring-2', 'ring-offset-2', 'ring-indigo-500');
      });
    });

    // Type Input Change
    this.typeInputEl?.addEventListener('input', () => {
      const text = this.typeInputEl.value.trim() || 'Your Name';
      document.querySelectorAll('.type-sig-sample').forEach(el => {
        el.textContent = text;
      });
    });

    // Select Type Font Sample
    document.querySelectorAll('.type-sig-card').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.type-sig-card').forEach(c => c.classList.remove('border-indigo-600', 'bg-indigo-50'));
        card.classList.add('border-indigo-600', 'bg-indigo-50');
      });
    });

    // File Upload
    this.fileInputEl?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          this.imagePreviewEl.src = event.target.result;
          this.imagePreviewEl.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
      }
    });

    // Close Modal
    document.querySelectorAll('.close-signature-modal').forEach(btn => {
      btn.addEventListener('click', () => this.close());
    });

    // Insert Signature Action
    this.insertBtn?.addEventListener('click', () => {
      let resultDataUrl = null;

      if (this.activeTab === 'draw') {
        resultDataUrl = this.drawCanvasEl.toDataURL('image/png');
      } else if (this.activeTab === 'type') {
        const selectedCard = document.querySelector('.type-sig-card.border-indigo-600') || document.querySelector('.type-sig-card');
        const text = this.typeInputEl.value.trim() || 'Your Name';
        const fontClass = selectedCard.dataset.fontClass;
        
        // Render text to offscreen canvas
        const offCanvas = document.createElement('canvas');
        offCanvas.width = 600;
        offCanvas.height = 150;
        const ctx = offCanvas.getContext('2d');
        ctx.fillStyle = '#0f172a';
        ctx.font = `64px "${selectedCard.dataset.fontName}", cursive`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 300, 75);
        resultDataUrl = offCanvas.toDataURL('image/png');
      } else if (this.activeTab === 'upload') {
        resultDataUrl = this.imagePreviewEl.src;
      }

      if (resultDataUrl) {
        CanvasManager.addImageToCurrentPage(resultDataUrl);
        this.close();
      }
    });
  }
}
