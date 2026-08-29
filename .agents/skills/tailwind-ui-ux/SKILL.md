---
name: tailwind-ui-ux
description: Expert UI/UX engineering, Tailwind CSS design system patterns, modern layout structuring, micro-interactions, floating toolbars, responsive drawers, modal animations, and accessibility guidelines for frontend web applications.
---

# Tailwind CSS & UI/UX Engineering Skill

This skill provides architectural patterns, styling conventions, and interaction design rules for building modern, responsive, intuitive, and accessible web interfaces using Tailwind CSS and vanilla JavaScript/HTML.

---

## 1. Visual Hierarchy & Design System Rules
- **Color Palette**:
  - Primary Brand: Indigo/Violet gradient (rom-indigo-600 to-violet-600, g-indigo-600 hover:bg-indigo-700).
  - Neutral Base: Slate tones (g-slate-50, g-slate-100, order-slate-200, 	ext-slate-700, 	ext-slate-900).
  - Accents: Emerald (g-emerald-100 text-emerald-700 for badges/success), Amber (warning/alerts), Rose (danger/delete).
- **Surface Elevation**:
  - Card/Modal containers: g-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl transition-all.
  - Floating Toolbars: g-slate-900/90 backdrop-blur-md text-white rounded-2xl shadow-2xl border border-white/10 px-3 py-2.
  - Dropdowns & Drawers: g-white/95 backdrop-blur-md border border-slate-200 shadow-xl rounded-xl.

---

## 2. Component Implementation Patterns

### Floating Action Toolbar
Floating bottom action bars must be centered, elevated, and responsive:
`html
<div class="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center space-x-1 bg-slate-900/90 backdrop-blur-md text-white px-3 py-2 rounded-2xl shadow-2xl border border-white/10">
  <button class="p-2.5 rounded-xl hover:bg-white/10 text-slate-300 hover:text-white transition-all active:scale-95" title="Select Tool">
    <i data-lucide="mouse-pointer" class="w-5 h-5"></i>
  </button>
</div>
`

### Animated Toast Notification System
Never use blocking window.alert(). Use non-blocking, stacking animated toasts with automatic dismissal:
`javascript
export class Toast {
  static show(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = 	oast toast- flex items-center space-x-2 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium transition-all duration-300 transform translate-y-2 opacity-0;
    toast.innerHTML = <span></span>;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.remove('translate-y-2', 'opacity-0'));
    setTimeout(() => {
      toast.classList.add('opacity-0', 'translate-y-2');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }
}
`

### Accessible Modals
- Support Escape key dismissal.
- Lock background body scroll (overflow-hidden) when modal is open.
- Provide a clear backdrop with blur (g-slate-900/50 backdrop-blur-sm).

---

## 3. Micro-Interactions & Polish
- **Transitions**: Apply 	ransition-all duration-150 ease-out for hover states.
- **Active State**: Use ctive:scale-95 on action buttons to give tactile feedback.
- **Icon Sizing**: Maintain consistent 16px (w-4 h-4) for inline actions, 20px (w-5 h-5) for toolbar buttons, and 24px (w-6 h-6) for category hero cards.
- **Tooltips**: Use lightweight CSS :hover::after pseudo-tooltips or clean floating labels rather than heavy external libraries.
