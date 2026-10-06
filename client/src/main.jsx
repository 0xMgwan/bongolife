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

installAudioUnlock();
// Soft click on every button press (not on the 3D canvas).
window.addEventListener('pointerdown', (e) => {
  if (e.target.closest?.('button, .btn, .chip, a.btn')) sfx('click');
}, { capture: true });

createRoot(document.getElementById('root')).render(<App />);
