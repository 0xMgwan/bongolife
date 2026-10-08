import React from 'react';
import { createRoot } from 'react-dom/client';
// Brand font, bundled with the app (no Google Fonts round-trip), so 3D labels can use it right away.
import '@fontsource/plus-jakarta-sans/latin-400.css';
import '@fontsource/plus-jakarta-sans/latin-500.css';
import '@fontsource/plus-jakarta-sans/latin-600.css';
import '@fontsource/plus-jakarta-sans/latin-700.css';
import '@fontsource/plus-jakarta-sans/latin-800.css';
// Archivo (Brand Kit display face) for the branded selfie card.
import '@fontsource/archivo/latin-400.css';
import '@fontsource/archivo/latin-600.css';
import '@fontsource/archivo/latin-800.css';
import './styles.css';

// Dev-only: drive frames with timers when testing in a hidden/headless tab (?raf-shim).
if (import.meta.env.DEV && new URLSearchParams(location.search).has('raf-shim')) {
  window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 33);
  window.cancelAnimationFrame = (id) => clearTimeout(id);
}
import App from './App.jsx';
import './ui/InstallApp.jsx'; // catches Android's install prompt early
import { installAudioUnlock, sfx } from './audio.js';
import { haptic } from './haptics.js';

installAudioUnlock();
// Soft click + haptic on every button press (not on the 3D canvas). The sound plays on pointerdown
// so it feels instant; the haptic waits for the click, because iOS only plays its switch haptic
// inside a user activation and a touch's pointerdown doesn't grant one.
const TAPPABLE = 'button, .btn, .chip, a.btn';
window.addEventListener('pointerdown', (e) => {
  if (e.target.closest?.(TAPPABLE)) sfx('click', { haptic: false });
}, { capture: true });
window.addEventListener('click', (e) => {
  const el = e.target.closest?.(TAPPABLE);
  if (el && !el.disabled && !el.closest('.dragging')) haptic(el.classList.contains('chip') ? 'select' : 'tap');
}, { capture: true });

// 3D labels are drawn into canvases once, so the brand font must be loaded first or they fall
// back to the system font for good. Never wait more than ~2.5s for it.
const fontsReady = document.fonts
  ? Promise.race([
      Promise.all(['600', '700', '800'].map((w) => document.fonts.load(`${w} 40px "Plus Jakarta Sans"`))),
      new Promise((r) => setTimeout(r, 2500)),
    ]).catch(() => {})
  : Promise.resolve();
fontsReady.then(() => createRoot(document.getElementById('root')).render(<App />));
