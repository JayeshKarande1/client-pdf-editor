/**
 * Client-Side PDF Security & Password Tool
 */

import { PdfLibService } from '../services/pdfLibService.js';
import { PdfRenderService } from '../services/pdfRenderService.js';

export class SecurityTool {
  static currentFile = null;
  static pdfBytes = null;

  static init() {
    this.container = document.getElementById('securityToolContainer');
    this.dropzone = document.getElementById('securityDropzone');
    this.fileInput = document.getElementById('securityFileInput');
    this.workspace = document.getElementById('securityWorkspace');
    this.protectBtn = document.getElementById('btnExecuteProtect');
    this.passwordInput = document.getElementById('secPasswordInput');
    this.confirmInput = document.getElementById('secConfirmPasswordInput');

    if (!this.container) return;

    this.setupEventListeners();
  }

  static setupEventListeners() {
    this.dropzone?.addEventListener('click', () => this.fileInput.click());

    this.fileInput?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        try {
          this.currentFile = file;
          const buffer = await file.arrayBuffer();
          this.pdfBytes = new Uint8Array(buffer);

          this.dropzone.classList.add('hidden');
          this.workspace.classList.remove('hidden');

          const fileInfo = document.getElementById('secFileInfo');
          if (fileInfo) {
            fileInfo.innerHTML = `
              <div class="flex items-center space-x-3">
                <div class="p-2 bg-indigo-100 rounded-lg text-indigo-700">
                  <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                </div>
                <div>
                  <p class="text-sm font-semibold text-slate-800">${file.name}</p>
                  <p class="text-xs text-slate-500">${(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              </div>
            `;
          }
        } catch (err) {
          alert(`Error reading file: ${err.message}`);
        }
      }
      e.target.value = '';
    });

    this.protectBtn?.addEventListener('click', () => this.executeProtect());
  }

  static async executeProtect() {
    const password = this.passwordInput?.value || '';
    const confirm = this.confirmInput?.value || '';

    if (!password) {
      alert('Please enter a password');
      return;
    }

    if (password !== confirm) {
      alert('Passwords do not match');
      return;
    }

    this.protectBtn.disabled = true;
    this.protectBtn.textContent = 'Encrypting PDF...';

    try {
      const encryptedBytes = await PdfLibService.encryptPDF(this.pdfBytes, password);
      const blob = new Blob([encryptedBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `protected_${this.currentFile.name}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Encryption failed', err);
      alert(`Encryption failed: ${err.message}`);
    } finally {
      this.protectBtn.disabled = false;
      this.protectBtn.textContent = 'Protect & Download PDF';
    }
  }

  static reset() {
    this.currentFile = null;
    this.pdfBytes = null;
    this.dropzone?.classList.remove('hidden');
    this.workspace?.classList.add('hidden');
    if (this.passwordInput) this.passwordInput.value = '';
    if (this.confirmInput) this.confirmInput.value = '';
  }
}
