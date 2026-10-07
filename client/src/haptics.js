// Haptic feedback. Android/Chrome uses the Vibration API; iOS Safari (18+) has no
// vibrate(), but toggling a native <input type="checkbox" switch> plays the system
// haptic tick, so we fire that (it only works inside a tap, which is most cases).
const KEY = 'bl_haptics';
let enabled = (() => { try { return localStorage.getItem(KEY) !== '0'; } catch { return true; } })();
const listeners = new Set();

const PATTERNS = {
  tap: 8,
  light: 12,
  select: 10,
  success: [14, 50, 22],
  coin: [8, 40, 8],
  notify: [18, 70, 18],
  error: [35, 50, 35],
  heavy: 45,
  crash: [90, 40, 180],
  engine: [20, 30, 20, 30, 20],
  takeoff: [30, 60, 30, 60, 60, 60, 120],
};

let iosLabel = null;
function iosTick() {
  if (!iosLabel) {
    iosLabel = document.createElement('label');
    iosLabel.setAttribute('aria-hidden', 'true');
    iosLabel.style.cssText = 'position:fixed;left:-100px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    input.tabIndex = -1;
    iosLabel.appendChild(input);
    document.body.appendChild(iosLabel);
  }
  iosLabel.click();
}
const canVibrate = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

export function haptic(kind = 'tap') {
  if (!enabled) return;
  const p = PATTERNS[kind] ?? PATTERNS.tap;
  try {
    if (canVibrate) navigator.vibrate(p);
    else {
      iosTick();
      // Multi-pulse patterns: a couple more ticks so they feel different from a tap.
      if (Array.isArray(p)) for (let i = 1; i < Math.min(3, Math.ceil(p.length / 2)); i++) setTimeout(iosTick, i * 90);
    }
  } catch {}
}

export const hapticsEnabled = () => enabled;
export function setHaptics(on) {
  enabled = !!on;
  try { localStorage.setItem(KEY, on ? '1' : '0'); } catch {}
  listeners.forEach((f) => f(enabled));
  if (on) haptic('success');
}
export const onHaptics = (f) => (listeners.add(f), () => listeners.delete(f));

// Sound effect → haptic.
export const SFX_HAPTIC = { click: 'tap', coin: 'coin', cash: 'success', levelup: 'success', notify: 'notify', pop: 'light', error: 'error', open: 'light', close: 'select', horn: 'heavy', splash: 'light', crash: 'crash' };
