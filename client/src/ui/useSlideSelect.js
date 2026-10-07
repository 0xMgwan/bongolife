import { useEffect } from 'react';
import { haptic } from '../haptics.js';

/**
 * Slide a finger (or mouse) over a list and the item under it lights up, with a haptic tick each
 * time it moves to a new one — also while the list scrolls under a still finger. The last one
 * stays `.picked` after release so its button is easy to hit. Nothing is triggered on release:
 * actions here cost money, so they still need their own tap.
 */
export function useSlideSelect(ref, selector = '.item') {
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    let active = null;
    let tracking = false;
    let lastPoint = null;
    // Stagger the pop-in: each item gets its place in the list (capped so long lists don't drag).
    root.querySelectorAll(selector).forEach((el, i) => el.style.setProperty('--n', Math.min(i, 8)));

    const pick = (el) => {
      if (el === active) return;
      active?.classList.remove('picked');
      active = el;
      if (!el) return;
      el.classList.add('picked');
      haptic('select');
    };
    const itemAt = (x, y) => {
      const el = document.elementFromPoint(x, y)?.closest?.(selector);
      return el && root.contains(el) ? el : null;
    };
    const follow = (x, y) => {
      lastPoint = [x, y];
      const el = itemAt(x, y);
      if (el) pick(el);
    };

    const down = (e) => {
      if (!e.target.closest?.(selector)) return;
      tracking = true;
      follow(e.clientX, e.clientY);
    };
    // Mouse: pointermove. Touch: touchmove, which (unlike pointer events) keeps firing while the
    // browser scrolls the list, so the pick keeps up with the scroll.
    const move = (e) => tracking && e.pointerType === 'mouse' && follow(e.clientX, e.clientY);
    const touchMove = (e) => {
      if (!tracking) return;
      const t = e.touches[0];
      if (t) follow(t.clientX, t.clientY);
    };
    const scroll = () => tracking && lastPoint && follow(...lastPoint);
    const up = () => { tracking = false; };

    root.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    root.addEventListener('touchmove', touchMove, { passive: true });
    root.addEventListener('scroll', scroll, { passive: true });
    window.addEventListener('pointerup', up);
    window.addEventListener('touchend', up);
    return () => {
      root.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      root.removeEventListener('touchmove', touchMove);
      root.removeEventListener('scroll', scroll);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('touchend', up);
    };
  }, [ref, selector]);
}
