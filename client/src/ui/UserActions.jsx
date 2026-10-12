// Tap a name (street chat, a room, a list) → a quick menu: profile, message, send a tip.
import { useState } from 'react';
import { fmtTsh, fmtShort } from '@shared/world.js';
import { useStore } from '../store.js';
import { ask } from './Confirm.jsx';
import { sfx } from '../audio.js';
import { L } from '../i18n.js';

export const TIP_AMOUNTS = [1_000, 5_000, 10_000, 50_000, 100_000];

export const openUserActions = (username) => username && useStore.setState({ userActions: username });

/** Send someone money straight away (asks first). Returns true when sent. */
export async function tipUser(username, amount) {
  const st = useStore.getState();
  if ((st.me?.money || 0) < amount) { st.toast(L('Huna pesa ya kutosha.', "You don't have enough money."), 'err'); return false; }
  if (!(await ask({ icon: '💸', title: L(`Mtumie @${username} ${fmtTsh(amount)}?`, `Send @${username} ${fmtTsh(amount)}?`), ok: L('Tuma', 'Send') }))) return false;
  const r = await st.run('/wallet/send', { method: 'POST', body: { to: username, amount, note: '💸 tip' } });
  if (!r) return false;
  sfx('cash');
  st.toast(L(`💸 Umemtumia @${r.to} ${fmtTsh(amount)}`, `💸 Sent @${r.to} ${fmtTsh(amount)}`));
  return true;
}

/** Quick tip chips + "other amount". */
export function TipRow({ username, onSent }) {
  const money = useStore((s) => s.me?.money || 0);
  return (
    <div className="tip-row">
      {TIP_AMOUNTS.map((a) => <button key={a} disabled={money < a} onClick={async () => { if (await tipUser(username, a)) onSent?.(); }}>{fmtShort(a)}</button>)}
      <button onClick={() => { useStore.setState({ userActions: null, sheet: null }); useStore.getState().openPhone('pesa', { send: username }); }}>{L('Kiasi kingine', 'Other')}</button>
    </div>
  );
}

export function UserActions() {
  const username = useStore((s) => s.userActions);
  const me = useStore((s) => s.me);
  const [tipping, setTipping] = useState(false);
  if (!username) return null;
  const close = () => { setTipping(false); useStore.setState({ userActions: null }); };
  const mine = username === me?.username;
  return (
    <div className="modal-wrap ua-wrap" onClick={close}>
      <div className="msg-menu ua-menu" onClick={(e) => e.stopPropagation()}>
        <div className="ua-name">@{username}</div>
        <div className="mm-list">
          <button onClick={() => { close(); useStore.setState({ phone: null, sheet: { type: 'player', id: username } }); }}>👤 {L('Ona wasifu', 'View profile')}</button>
          {!mine && <button onClick={() => { close(); useStore.getState().openPhone('dm', username); }}>💬 {L('Mtumie ujumbe', 'Message')}</button>}
          {!mine && <button onClick={() => setTipping(!tipping)}>💸 {L('Mtumie pesa / tip', 'Send money / tip')}</button>}
        </div>
        {tipping && <TipRow username={username} onSent={close} />}
      </div>
    </div>
  );
}
