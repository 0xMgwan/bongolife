import { useStore } from '../store.js';
import { L } from '../i18n.js';
import { sfx } from '../audio.js';

let resolver = null;
/**
 * In-game replacement for window.confirm/alert. Resolves true (OK) or false (cancel).
 * `alert: true` shows a single OK button.
 */
export function ask({ icon = '🤔', title, text, ok, cancel, danger = false, alert = false }) {
  if (resolver) resolver(false);
  sfx('open');
  return new Promise((res) => {
    resolver = res;
    useStore.setState({ confirm: { icon, title, text, ok, cancel, danger, alert } });
  });
}

export function ConfirmModal() {
  const c = useStore((s) => s.confirm);
  if (!c) return null;
  const done = (v) => {
    sfx(v ? 'click' : 'close');
    useStore.setState({ confirm: null });
    const r = resolver;
    resolver = null;
    r?.(v);
  };
  return (
    <div className="modal-wrap confirm-wrap" onClick={() => done(false)}>
      <div className="modal card confirm-card" onClick={(e) => e.stopPropagation()}>
        <div className="big badge-ic">{c.icon}</div>
        {c.title && <h3>{c.title}</h3>}
        {c.text && <p className="confirm-text">{c.text}</p>}
        <div className="confirm-btns">
          {!c.alert && <button className="btn btn-ghost" onClick={() => done(false)}>{c.cancel || L('Ghairi', 'Cancel')}</button>}
          <button className={`btn ${c.danger ? 'btn-red' : 'btn-green'}`} onClick={() => done(true)}>{c.ok || L('Sawa', 'OK')}</button>
        </div>
      </div>
    </div>
  );
}
