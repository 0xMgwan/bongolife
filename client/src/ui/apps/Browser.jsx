import { useState } from 'react';
import { AppHead } from '../Phone.jsx';
import { L } from '../../i18n.js';

/** In-phone browser for partner apps. Some sites refuse to load inside frames — "Open" always works. */
export function Browser({ arg: app, back }) {
  const [nonce, setNonce] = useState(0);
  if (!app) return null;
  let host = app.url;
  try { host = new URL(app.url).hostname.replace(/^www\./, ''); } catch {}
  return (
    <>
      <AppHead title={app.name} onBack={back} />
      <div className="url-bar">
        <span className="url-pill">🔒 {host}</span>
        <button className="round" style={{ width: 34, height: 34, fontSize: 14 }} onClick={() => setNonce(nonce + 1)} aria-label={L('Pakia upya', 'Reload')}>↻</button>
        <a className="btn btn-ghost btn-xs" href={app.url} target="_blank" rel="noopener noreferrer">{L('Fungua', 'Open')} ↗</a>
      </div>
      {/* Recreate the frame per URL/reload; sandbox must be set before src navigates. */}
      <iframe
        key={`${app.url}#${nonce}`}
        className="phone-frame"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
        referrerPolicy="strict-origin-when-cross-origin"
        title={app.name}
        src={app.url}
      />
    </>
  );
}
