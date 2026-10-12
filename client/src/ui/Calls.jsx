// Friend calls: incoming call screen, the in-call bar, and a friend picker for group calls.
import { useEffect, useState } from 'react';
import { useStore } from '../store.js';
import { api } from '../api.js';
import { sfx } from '../audio.js';
import { haptic } from '../haptics.js';
import { L } from '../i18n.js';
import { answerCall, hangUp, toggleMute, addToCall, startCall, resumeAudio, initVoice } from '../voice.js';
import { avatarEmoji } from '../three/Avatar.jsx';

const err = (r) => {
  const t = useStore.getState().toast;
  if (r?.error === 'mic') t(L('Ruhusu maikrofoni ili kupiga simu.', 'Allow the microphone to make calls.'), 'err');
  else if (r?.error === 'not_friends') t(L('Unaweza kupiga simu kwa marafiki tu.', 'You can only call friends.'), 'err');
  else if (r?.error === 'offline') t(L('Hayupo online sasa — tumemtumia arifa ya simu uliyokosa.', "They're offline — we sent them a missed-call notification."), 'err');
  else if (r?.error) t(L('Simu imeshindikana.', 'The call failed.'), 'err');
};
export async function callFriends(usernames) {
  const r = await startCall(usernames);
  err(r);
  return r;
}

function Ringer() {
  // Ring + buzz until answered.
  useEffect(() => {
    const ring = () => { sfx('notify'); haptic('heavy'); navigator.vibrate?.([300, 200, 300]); };
    ring();
    const t = setInterval(ring, 1800);
    return () => clearInterval(t);
  }, []);
  return null;
}

export function IncomingCall() {
  const inc = useStore((s) => s.incomingCall);
  if (!inc) return null;
  return (
    <div className="call-in">
      <Ringer />
      <div className="ci-face">{avatarEmoji(inc.from.appearance)}</div>
      <b>@{inc.from.username}</b>
      <span>{inc.group?.length ? L(`Simu ya kikundi · na ${inc.group.map((g) => '@' + g).join(', ')}`, `Group call · with ${inc.group.map((g) => '@' + g).join(', ')}`) : L('anakupigia simu…', 'is calling you…')}</span>
      <div className="row" style={{ gap: 28, marginTop: 18 }}>
        <button className="ci-btn no" onClick={() => answerCall(false)} aria-label={L('Kataa', 'Decline')}>📵</button>
        <button className="ci-btn yes" onClick={async () => err(await answerCall(true))} aria-label={L('Pokea', 'Answer')}>📞</button>
      </div>
    </div>
  );
}

function FriendPicker({ exclude = [], onPick, onClose, title }) {
  const [list, setList] = useState(null);
  const [sel, setSel] = useState([]);
  useEffect(() => { api('/contacts').then((l) => setList(l.filter((c) => c.mutual && !exclude.includes(c.username)))).catch(() => setList([])); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="sheet-wrap" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head"><h2><span>📞</span>{title}</h2><button className="x" onClick={onClose}>✕</button></div>
        <div className="sheet-body">
          {!list && <div className="small muted">{L('Inapakia…', 'Loading…')}</div>}
          {list && !list.length && <div className="small muted">{L('Huna marafiki bado. Ongeza rafiki kwenye profaili yake — mkiongezana wote wawili mnakuwa marafiki.', 'No friends yet. Add someone from their profile — once you both add each other you’re friends.')}</div>}
          {list?.map((c) => (
            <label key={c.username} className="pick-row">
              <input type="checkbox" checked={sel.includes(c.username)} onChange={() => setSel(sel.includes(c.username) ? sel.filter((x) => x !== c.username) : sel.length < 5 ? [...sel, c.username] : sel)} />
              <span className="grow"><b>{c.name}</b> <small className="muted">@{c.username} · {c.online ? '🟢 online' : 'offline'}</small></span>
            </label>
          ))}
          <button className="btn btn-green btn-block" style={{ marginTop: 12 }} disabled={!sel.length} onClick={() => { onPick(sel); onClose(); }}>📞 {sel.length > 1 ? L(`Piga simu ya kikundi (${sel.length})`, `Group call (${sel.length})`) : L('Piga simu', 'Call')}</button>
        </div>
      </div>
    </div>
  );
}
export function GroupCallButton({ className = 'btn btn-dark btn-sm' }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className={className} onClick={() => setOpen(true)}>👥 {L('Simu ya kikundi', 'Group call')}</button>
      {open && <FriendPicker title={L('Piga simu', 'Call friends')} onPick={callFriends} onClose={() => setOpen(false)} />}
    </>
  );
}

export function CallBar() {
  const call = useStore((s) => s.call);
  const v = useStore((s) => s.voice) || {};
  const [adding, setAdding] = useState(false);
  useEffect(() => { initVoice(); }, []);
  if (!call) return null;
  const peers = v.peers || [];
  const ringing = call.ringing || [];
  return (
    <div className="call-bar">
      <span className="cb-ic">📞</span>
      <span className={`vb-me ${v.meSpeaking && !v.muted ? 'talk' : ''}`}>{v.muted ? '🔇' : '🎙️'} {L('Wewe', 'You')}</span>
      {peers.map((p) => <span key={p.id} className={`vb-p ${p.speaking ? 'talk' : ''} ${p.state !== 'connected' ? 'dim' : ''}`}>@{p.username}{p.state === 'failed' ? ' ⚠️' : p.state !== 'connected' ? ' …' : ''}</span>)}
      {ringing.map((r) => <span key={r} className="vb-p dim">🔔 @{r}</span>)}
      {!peers.length && !ringing.length && <span className="vb-wait">{L('Inaunganisha…', 'Connecting…')}</span>}
      {v.needTap && <button onClick={resumeAudio}>🔊 {L('Gusa kusikia', 'Tap to hear')}</button>}
      <button onClick={toggleMute}>{v.muted ? L('Washa mic', 'Unmute') : L('Zima mic', 'Mute')}</button>
      <button onClick={() => setAdding(true)} aria-label={L('Ongeza', 'Add')}>➕</button>
      <button className="vb-leave" onClick={hangUp}>{L('Kata', 'Hang up')}</button>
      {adding && <FriendPicker title={L('Ongeza kwenye simu', 'Add to call')} exclude={peers.map((p) => p.username)} onPick={addToCall} onClose={() => setAdding(false)} />}
    </div>
  );
}
