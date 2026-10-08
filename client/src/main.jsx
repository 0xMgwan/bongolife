import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

// Dev-only: drive frames with timers when testing in a hidden/headless tab (?raf-shim).
if (import.meta.env.DEV && new URLSearchParams(location.search).has('raf-shim')) {
  window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 33);
  window.cancelAnimationFrame = (id) => clearTimeout(id);
}
import App from './App.jsx';
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

createRoot(document.getElementById('root')).render(<App />);
