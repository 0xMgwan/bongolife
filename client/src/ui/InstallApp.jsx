import { useEffect, useState } from 'react';
import { L } from '../i18n.js';
import { sfx } from '../audio.js';

// Android/Chrome fires `beforeinstallprompt` once, early — catch it at import time and keep it.
let deferred = null;
const subs = new Set();
const emit = () => subs.forEach((f) => f());
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; emit(); });
  window.addEventListener('appinstalled', () => { deferred = null; try { localStorage.setItem('bl_installed', '1'); } catch {} emit(); });
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
  }
}

const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
export const isIOS = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1);
export const isAndroid = /Android/i.test(ua);
const isSamsung = /SamsungBrowser/i.test(ua);
const isIOSNotSafari = isIOS && /CriOS|FxiOS|EdgiOS|GSA\//i.test(ua);

/** Already running as an installed app (home-screen icon)? */
export function isInstalled() {
  if (typeof window === 'undefined') return false;
  return window.navigator.standalone === true
    || ['standalone', 'fullscreen', 'minimal-ui'].some((m) => window.matchMedia?.(`(display-mode: ${m})`).matches);
}

function useInstall() {
  const [, tick] = useState(0);
  useEffect(() => { const f = () => tick((n) => n + 1); subs.add(f); return () => subs.delete(f); }, []);
  return deferred;
}

async function promptInstall() {
  if (!deferred) return false;
  deferred.prompt();
  const { outcome } = await deferred.userChoice.catch(() => ({ outcome: 'dismissed' }));
  if (outcome === 'accepted') deferred = null;
  emit();
  return outcome === 'accepted';
}

/** Step-by-step for this phone/browser. */
function Steps() {
  if (isIOS && isIOSNotSafari) {
    return <ol className="inst-steps"><li>{L('Fungua bongolife kwenye ', 'Open this page in ')}<b>Safari</b> 🧭</li><li>{L('Bonyeza ', 'Tap ')}<b>{L('Share', 'Share')}</b> <span className="inst-ic">⬆️</span></li><li><b>{L('Add to Home Screen', 'Add to Home Screen')}</b> ➕</li></ol>;
  }
  if (isIOS) {
    return (
      <ol className="inst-steps">
        <li>{L('Bonyeza kitufe cha ', 'Tap the ')}<b>Share</b> <span className="inst-ic">⬆️</span> {L('chini ya Safari', 'at the bottom of Safari')}</li>
        <li>{L('Shuka chini, chagua ', 'Scroll down and tap ')}<b>Add to Home Screen</b> ➕</li>
        <li>{L('Bonyeza ', 'Tap ')}<b>Add</b> — {L('Bongo Life itakuwa kwenye skrini yako kama app', 'Bongo Life sits on your home screen like an app')} 👑</li>
      </ol>
    );
  }
  return (
    <ol className="inst-steps">
      <li>{L('Bonyeza menyu ', 'Tap the menu ')}<span className="inst-ic">{isSamsung ? '☰' : '⋮'}</span> {L('juu kulia', 'at the top right')}</li>
      <li>{L('Chagua ', 'Choose ')}<b>{isSamsung ? 'Add page to → Home screen' : L('Install app / Add to Home screen', 'Install app / Add to Home screen')}</b></li>
      <li>{L('Bonyeza ', 'Tap ')}<b>Install</b> — {L('itafunguka kama app, skrini nzima', 'it opens like an app, full screen')} 👑</li>
    </ol>
  );
}

const SNOOZE = 'bl_install_snooze';
const snoozed = () => { try { return Date.now() < +(localStorage.getItem(SNOOZE) || 0); } catch { return false; } };

/** Banner nudging players who are still in the browser to install / add to home screen. */
export function InstallBanner() {
  const can = useInstall();
  const [show, setShow] = useState(false);
  const [help, setHelp] = useState(false);
  useEffect(() => {
    if (isInstalled() || snoozed() || !(isIOS || isAndroid || can)) return;
    const t = setTimeout(() => setShow(true), 20_000);
    return () => clearTimeout(t);
  }, [can]);
  const close = () => {
    try { localStorage.setItem(SNOOZE, String(Date.now() + 3 * 864e5)); } catch {}
    setShow(false); setHelp(false);
  };
  const install = async () => {
    sfx('click');
    if (can) { if (await promptInstall()) setShow(false); } else setHelp(true);
  };
  if (help) return <InstallHelp onClose={close} />;
  if (!show || isInstalled()) return null;
  return (
    <div className="install-banner pop">
      <img src="/icon-192.png" alt="" />
      <div className="grow">
        <b>{L('Weka Bongo Life kama app', 'Get the Bongo Life app')}</b>
        <small>{isIOS ? L('Iweke kwenye Home Screen — skrini nzima, haraka zaidi', 'Add it to your Home Screen — full screen, faster') : L('Install — skrini nzima, inafunguka haraka', 'Install it — full screen, opens instantly')}</small>
      </div>
      <button className="btn btn-green btn-sm" onClick={install}>{can ? L('Install', 'Install') : L('Jinsi gani', 'How')}</button>
      <button className="ib-x" aria-label={L('Funga', 'Close')} onClick={close}>✕</button>
    </div>
  );
}

/** Full instructions sheet (also opened from Settings). */
export function InstallHelp({ onClose }) {
  const can = useInstall();
  return (
    <div className="modal-wrap" onClick={onClose}>
      <div className="modal card install-help" onClick={(e) => e.stopPropagation()}>
        <img src="/icon-192.png" alt="" className="ih-icon" />
        <h3>{L('Weka Bongo Life kwenye simu', 'Install Bongo Life')}</h3>
        {isInstalled() ? <p className="hint">{L('Tayari umeiweka — unacheza kwenye app. 🎉', "You're already playing in the app. 🎉")}</p> : (
          <>
            {can && <button className="btn btn-green" style={{ width: '100%', marginBottom: 12 }} onClick={async () => { if (await promptInstall()) onClose(); }}>⬇️ {L('Install sasa', 'Install now')}</button>}
            <Steps />
          </>
        )}
        <button className="btn btn-ghost" style={{ width: '100%', marginTop: 12 }} onClick={onClose}>{L('Sawa', 'Got it')}</button>
      </div>
    </div>
  );
}

/** Settings row. */
export function InstallRow() {
  const [open, setOpen] = useState(false);
  const installed = isInstalled();
  return (
    <div className="box">
      <div className="row between">
        <div>
          <div className="bold">📲 {L('App kwenye simu', 'Install the app')}</div>
          <div className="hint" style={{ marginTop: 2 }}>{installed ? L('Umeiweka ✓', 'Installed ✓') : isIOS ? L('Iweke kwenye Home Screen', 'Add to your Home Screen') : L('Iweke kama app ya Android', 'Install it like an Android app')}</div>
        </div>
        {!installed && <button className="btn btn-xs btn-green" onClick={() => setOpen(true)}>{L('Jinsi gani', 'How')}</button>}
      </div>
      {open && <InstallHelp onClose={() => setOpen(false)} />}
    </div>
  );
}
