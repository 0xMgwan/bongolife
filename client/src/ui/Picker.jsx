import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { L } from '../i18n.js';
import { haptic } from '../haptics.js';

/**
 * A dropdown in the game's own style instead of the system <select>: a pill that shows the
 * choice, and a list that pops up from the centre over the dimmed, blurred game.
 * options: [{ value, label, icon?, sub?, right?, badge?, warn? }]
 */
export function Picker({ value, options, onChange, title, placeholder }) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  useEffect(() => {
    if (!open) return;
    const key = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [open]);
  const choose = (o) => {
    haptic('select');
    onChange(o.value);
    setOpen(false);
  };
  return (
    <>
      <button type="button" className="picker" onClick={() => setOpen(true)} aria-haspopup="listbox" aria-expanded={open}>
        <span className="pk-main">
          {current?.icon && <span className="pk-ic">{current.icon}</span>}
          <span className="pk-txt">
            <b>{current ? current.label : placeholder || L('Chagua…', 'Choose…')}</b>
            {current?.sub && <small>{current.sub}</small>}
          </span>
        </span>
        <span className="pk-caret" aria-hidden="true">▾</span>
      </button>
      {open && createPortal(
        <div className="picker-wrap" onClick={() => setOpen(false)}>
          <div className="picker-pop" role="listbox" aria-label={title} onClick={(e) => e.stopPropagation()}>
            <div className="pk-head">
              <b>{title}</b>
              <button type="button" onClick={() => setOpen(false)} aria-label={L('Funga', 'Close')}>✕</button>
            </div>
            <div className="pk-list">
              {options.map((o, i) => (
                <button type="button" key={o.value} role="option" aria-selected={o.value === value} className={`pk-opt ${o.value === value ? 'on' : ''} ${o.warn ? 'warn' : ''}`} style={{ '--i': Math.min(i, 10) }} onClick={() => choose(o)}>
                  {o.icon && <span className="pk-ic">{o.icon}</span>}
                  <span className="pk-txt">
                    <b>{o.label}</b>
                    {o.sub && <small>{o.sub}</small>}
                  </span>
                  {o.badge && <span className="pk-badge">{o.badge}</span>}
                  {o.right && <span className="pk-right">{o.right}</span>}
                  {o.value === value && <span className="pk-check">✓</span>}
                </button>
              ))}
            </div>
          </div>
        </div>,
        document.querySelector('.app') || document.body,
      )}
    </>
  );
}
