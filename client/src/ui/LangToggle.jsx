import { useStore } from '../store.js';
import { LANGS } from '../i18n.js';

/** Compact 🇹🇿/🇬🇧 switch. `full` renders a segmented control instead. */
export function LangToggle({ full = false, style }) {
  const lang = useStore((s) => s.lang);
  const setLang = useStore((s) => s.setLang);
  if (full) {
    return (
      <div className="seg" style={{ marginBottom: 0, ...style }}>
        {LANGS.map((l) => (
          <button key={l.id} className={lang === l.id ? 'on' : ''} onClick={() => setLang(l.id)}>{l.flag} {l.label}</button>
        ))}
      </div>
    );
  }
  const next = lang === 'en' ? 'sw' : 'en';
  return (
    <button className="lang-btn" style={style} onClick={() => setLang(next)} aria-label="Language / Lugha">
      {lang === 'en' ? '🇬🇧 EN' : '🇹🇿 SW'}
    </button>
  );
}
