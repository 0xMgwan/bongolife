// Turning on push notifications: a Settings row, and a one-time nudge a little while into the game.
import { useEffect, useState } from 'react';
import { pushState, enablePush, disablePush, syncPush } from '../push.js';
import { useStore } from '../store.js';
import { api } from '../api.js';
import { L } from '../i18n.js';

const SEEN = 'bl_push_prompt';
const store = { get: () => { try { return localStorage.getItem(SEEN); } catch { return '1'; } }, set: () => { try { localStorage.setItem(SEEN, '1'); } catch {} } };
const toast = (t, k) => useStore.getState().toast(t, k);

async function turnOn() {
  try {
    const r = await enablePush();
    if (r === 'on') toast(L('🔔 Arifa zimewashwa!', '🔔 Notifications on!'));
    else toast(L('Arifa zimezuiwa kwenye browser. Ziruhusu kwenye mipangilio ya simu.', 'Notifications are blocked in your browser. Allow them in your phone settings.'), 'err');
    return r;
  } catch {
    toast(L('Kifaa hiki hakiwezi kupokea arifa.', "This device can't receive notifications."), 'err');
    return 'unsupported';
  }
}

export function PushSettings() {
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { pushState().then(setState); }, []);
  if (!state) return null;
  const hint = {
    'ios-install': L('iPhone: kwanza ongeza Bongo Life kwenye Home Screen (Share → Add to Home Screen), kisha fungua kutoka hapo.', 'iPhone: first add Bongo Life to your Home Screen (Share → Add to Home Screen), then open it from there.'),
    unsupported: L('Browser hii haitumii arifa. Jaribu Chrome au Safari ya karibuni.', "This browser doesn't support notifications. Try a recent Chrome or Safari."),
    blocked: L('Umezuia arifa. Ziruhusu kwenye mipangilio ya browser/simu kwa play.bongolife.app.', "You've blocked notifications. Allow them for play.bongolife.app in your browser/phone settings."),
  }[state];
  return (
    <div className="box">
      <div className="row between">
        <span className="bold">🔔 {L('Arifa (push)', 'Notifications (push)')}</span>
        {(state === 'on' || state === 'off') && (
          <button className={`btn btn-xs ${state === 'on' ? 'btn-green' : 'btn-ghost'}`} disabled={busy} onClick={async () => {
            setBusy(true);
            setState(state === 'on' ? await disablePush() : await turnOn());
            setBusy(false);
          }}>{state === 'on' ? L('Zimewashwa ✓', 'On ✓') : L('Washa', 'Turn on')}</button>
        )}
      </div>
      <div className="hint">{hint || L('Meseji, mauzo, maombi ya kazi, penzi na mahakama — hata game ikiwa imefungwa.', 'Messages, sales, job applications, dating and court — even when the game is closed.')}</div>
      {state === 'on' && (
        <button className="btn btn-ghost btn-xs" style={{ marginTop: 8 }} onClick={() => api('/me/push/test', { method: 'POST' }).then((r) => toast(r.ok ? L('📨 Arifa ya majaribio imetumwa', '📨 Test notification sent') : L('Haikufika — jaribu kuzima na kuwasha tena.', "It didn't arrive — try turning it off and on."), r.ok ? undefined : 'err')).catch((e) => toast(e.message, 'err'))}>
          {L('Tuma ya majaribio', 'Send a test')}
        </button>
      )}
    </div>
  );
}

/** Ask once, ~40s into a session, only where push can actually work. */
export function PushPrompt() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    syncPush();
    if (store.get()) return;
    const t = setTimeout(() => pushState().then((s) => s === 'off' && Notification.permission === 'default' && setShow(true)), 40_000);
    return () => clearTimeout(t);
  }, []);
  if (!show) return null;
  const done = () => { store.set(); setShow(false); };
  return (
    <div className="push-prompt card">
      <div className="pp-ic">🔔</div>
      <div className="grow">
        <b>{L('Usikose kitu mtaani', "Don't miss a thing")}</b>
        <small>{L('Pata arifa za meseji, mauzo na ajira hata ukiwa nje ya game.', 'Get notified about messages, sales and jobs even when you’re out of the game.')}</small>
        <div className="row" style={{ gap: 8, marginTop: 8 }}>
          <button className="btn btn-green btn-sm" onClick={async () => { await turnOn(); done(); }}>{L('Washa arifa', 'Turn on')}</button>
          <button className="btn btn-ghost btn-sm" onClick={done}>{L('Baadaye', 'Later')}</button>
        </div>
      </div>
    </div>
  );
}
