import { useEffect } from 'react';

const prefersReduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * A horizontally scrolling row people can slide through:
 *  - touch swipes natively; a mouse can click-and-drag (a drag never counts as a tap)
 *  - `fade-l` / `fade-r` classes while there is more to scroll that way (CSS fades the edge)
 *  - the first time it overflows, it peeks sideways once so players see it scrolls (`peekKey`)
 */
export function useSwipeRow(ref, { peekKey, active = true } = {}) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !active) return;

    const edges = () => {
      const max = el.scrollWidth - el.clientWidth;
      el.classList.toggle('fade-l', el.scrollLeft > 4);
      el.classList.toggle('fade-r', el.scrollLeft < max - 4);
    };
    edges();
    el.addEventListener('scroll', edges, { passive: true });
    const ro = new ResizeObserver(edges);
    ro.observe(el);

    // Mouse drag-to-scroll (touch already scrolls natively).
    let drag = null;
    let moved = false;
    const down = (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      drag = { x: e.clientX, left: el.scrollLeft };
      moved = false;
    };
    const move = (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      if (!moved && Math.abs(dx) > 5) {
        moved = true;
        el.classList.add('dragging');
      }
      if (moved) el.scrollLeft = drag.left - dx;
    };
    const up = () => {
      if (!drag) return;
      drag = null;
      // Kept until after the trailing click so the global tap haptic skips it too.
      setTimeout(() => el.classList.remove('dragging'), 0);
    };
    // Swallow the click that ends a drag so it doesn't press the chip under the cursor.
    const click = (e) => {
      if (moved) {
        e.stopPropagation();
        e.preventDefault();
        moved = false;
      }
    };
    el.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    el.addEventListener('click', click, true);

    // One-time peek once the entrance animation has played.
    let peek;
    if (peekKey && !prefersReduced()) {
      let seen = false;
      try { seen = localStorage.getItem(peekKey) === '1'; } catch {}
      if (!seen) {
        peek = setTimeout(() => {
          if (el.scrollWidth - el.clientWidth < 12 || el.scrollLeft > 0) return;
          try { localStorage.setItem(peekKey, '1'); } catch {}
          el.scrollTo({ left: Math.min(72, el.scrollWidth - el.clientWidth), behavior: 'smooth' });
          peek = setTimeout(() => el.scrollTo({ left: 0, behavior: 'smooth' }), 700);
        }, 900);
      }
    }

    return () => {
      el.removeEventListener('scroll', edges);
      ro.disconnect();
      el.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      el.removeEventListener('click', click, true);
      clearTimeout(peek);
    };
  }, [ref, peekKey, active]);
}
