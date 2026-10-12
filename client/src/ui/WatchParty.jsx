// Watch parties: pick a match (Phone → Mechi), watch it on a big screen in a stadium with
// whoever joins, chat, cheer, grab snacks or buy them for someone, and invite friends.
import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store.js';
import { api } from '../api.js';
import { getSocket } from '../net.js';
import { sfx } from '../audio.js';
import { L } from '../i18n.js';
import { AppHead } from './Phone.jsx';
import { avatarEmoji } from '../three/Avatar.jsx';

const REACTS = ['👏', '⚽', '🔥', '😱', '🙌', '📣'];
const set = (patch) => useStore.setState((s) => ({ watch: { ...(s.watch || {}), ...patch } }));
let wired = false;
function wire() {
  const s = getSocket();
  if (!s || wired) return;
  wired = true;
  s.on('watch:members', ({ members }) => set({ members }));
  s.on('watch:chat', (m) => set({ chat: [...(useStore.getState().watch?.chat || []).slice(-60), m] }));
  s.on('watch:react', ({ from, e }) => floatUp(e, from));
  s.on('watch:snack', ({ from, to, emoji, name }) => {
    floatUp(emoji, from);
    const me = useStore.getState().me?.username;
    const line = from === to ? `${emoji} @${from} ${L('amechukua', 'grabbed')} ${L(name[0], name[1]).toLowerCase()}` : `${emoji} @${from} → @${to}`;
    set({ chat: [...(useStore.getState().watch?.chat || []).slice(-60), { id: `${Date.now()}s`, from: '', text: line, sys: true }] });
    if (to === me && from !== me) sfx('coin');
  });
  s.on('watch:invited', (d) => useStore.setState({ watchInvite: d }));
}
export function initWatch() {
  if (wired) return;
  if (getSocket()) return wire();
  const t = setInterval(() => { if (getSocket()) { clearInterval(t); wire(); } }, 600);
}
function floatUp(e, from) {
  const id = Math.random().toString(36).slice(2);
  set({ floats: [...(useStore.getState().watch?.floats || []).slice(-20), { id, e, from, x: 10 + Math.random() * 80 }] });
  setTimeout(() => set({ floats: (useStore.getState().watch?.floats || []).filter((f) => f.id !== id) }), 2600);
}

export async function joinWatch(matchId) {
  wire();
  const r = await new Promise((resolve) => getSocket()?.emit('watch:join', { matchId }, resolve) ?? resolve({ error: 'offline' }));
  if (!r?.ok) return useStore.getState().toast(L('Mechi hii haipatikani sasa.', "This match isn't available right now."), 'err');
  useStore.setState({ phone: null, watchInvite: null, watch: { open: true, match: r.match, members: r.members, chat: r.chat || [], floats: [], view: 'stadium', chatOpen: false } });
}
export function leaveWatch() {
  getSocket()?.emit('watch:leave');
  useStore.setState({ watch: null });
}

// ---------------------------------------------------------------- phone app: the match list
export function Mechi({ back }) {
  const [data, setData] = useState(null);
  useEffect(() => { api('/watch').then(setData).catch(() => setData({ matches: [] })); initWatch(); }, []);
  return (
    <>
      <AppHead title={L('Mechi · Watch party', 'Matches · Watch party')} onBack={back} />
      <div className="app-body">
        <div className="box small" style={{ background: 'var(--green-l)' }}>⚽ {L('Chagua mechi, tazama na washkaji kwenye skrini kubwa ya uwanja — chat, shangilia na agiza popcorn.', 'Pick a match and watch with friends on the stadium big screen — chat, cheer and grab popcorn.')}</div>
        {!data && <div className="small muted">{L('Inapakia…', 'Loading…')}</div>}
        {data && !data.matches.length && <div className="box small">{L('Hakuna mechi kwa sasa. Rudi baadaye!', 'No matches right now. Check back later!')}</div>}
        {data?.matches.map((m) => (
          <button key={m.id} className="match-row" onClick={() => joinWatch(m.id)}>
            {m.thumbnail ? <img src={m.thumbnail} alt="" /> : <span className="mr-ic">⚽</span>}
            <span className="grow">
              <b>{m.title}</b>
              <small>{m.live ? '🔴 LIVE · ' : ''}{m.competition}{m.watching ? ` · 👥 ${m.watching}` : ''}</small>
            </span>
            <span className="go">▶</span>
          </button>
        ))}
        <div className="hint">{L('Video kupitia ScoreBat na viungo rasmi.', 'Video via ScoreBat and official links.')}</div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- the party
function Picker({ title, items, onPick, onClose }) {
  return (
    <div className="wp-pop" onClick={onClose}>
      <div className="wp-pop-in" onClick={(e) => e.stopPropagation()}>
        <b>{title}</b>
        {items.length ? items.map((it) => <button key={it.key} onClick={() => { onPick(it); onClose(); }}>{it.label}</button>) : <small className="muted">{L('Hakuna', 'Nobody here yet')}</small>}
      </div>
    </div>
  );
}

export function WatchParty() {
  const w = useStore((s) => s.watch);
  const me = useStore((s) => s.me);
  const run = useStore((s) => s.run);
  const [pop, setPop] = useState(null); // 'snacks' | 'buy' | 'buyWho' | 'invite'
  const [buyFor, setBuyFor] = useState(null);
  const [friends, setFriends] = useState([]);
  const [snacks, setSnacks] = useState([]);
  const [text, setText] = useState('');
  const chatEnd = useRef();
  useEffect(() => { initWatch(); }, []);
  useEffect(() => { if (w?.open) api('/watch').then((d) => setSnacks(d.snacks || [])).catch(() => {}); }, [w?.open]);
  useEffect(() => { chatEnd.current?.scrollIntoView({ block: 'end' }); }, [w?.chat?.length, w?.chatOpen]);
  if (!w?.open) return null;
  const m = w.match;
  const react = (e) => { getSocket()?.emit('watch:react', e); sfx('pop'); };
  const buy = async (snack, to) => {
    const r = await run('/watch/snack', { method: 'POST', body: { id: snack.id, to } });
    if (r) sfx('cash');
  };
  const send = (e) => { e.preventDefault(); if (text.trim()) getSocket()?.emit('watch:chat', text.trim()); setText(''); };
  return (
    <div className={`wp ${w.view === 'screen' ? 'wp-screen' : ''}`}>
      <div className="wp-top">
        <div className="wp-title"><span className="wp-live">{m.live ? '● LIVE' : '▶'}</span><b>{m.title}</b><small>{m.competition}</small></div>
        <div className="wp-tools">
          <span className="wp-pill">👥 {w.members?.length || 1}</span>
          <div className="wp-seg">
            <button className={w.view !== 'screen' ? 'on' : ''} onClick={() => set({ view: 'stadium' })}>🏟️ {L('Uwanja', 'Stadium')}</button>
            <button className={w.view === 'screen' ? 'on' : ''} onClick={() => set({ view: 'screen' })}>🖥️ {L('Skrini', 'Screen')}</button>
          </div>
          <button className="wp-pill" onClick={() => set({ chatOpen: !w.chatOpen })}>💬 Chat</button>
          <button className="wp-pill wp-leave" onClick={leaveWatch}>⎋ {L('Toka', 'Leave')}</button>
        </div>
      </div>
      <div className="wp-stage">
        <div className="wp-stands" />
        <div className="wp-screenbox">
          <iframe src={m.src} title={m.title} allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowFullScreen />
        </div>
        <div className="wp-pitch"><i /></div>
        <div className="wp-heads">{(w.members || []).slice(0, 6).map((p) => <span key={p.id} title={p.username}>{avatarEmoji(p.appearance)}<small>@{p.username}</small></span>)}</div>
        {(w.floats || []).map((f) => <span key={f.id} className="wp-float" style={{ left: `${f.x}%` }}>{f.e}<small>@{f.from}</small></span>)}
        {w.chatOpen && (
          <div className="wp-chat">
            <div className="wp-msgs">
              {(w.chat || []).map((c) => <div key={c.id} className={c.sys ? 'sys' : ''}>{c.sys ? c.text : <><b>@{c.from}</b> {c.text}</>}</div>)}
              <div ref={chatEnd} />
            </div>
            <form onSubmit={send}><input value={text} maxLength={200} onChange={(e) => setText(e.target.value)} placeholder={L('Andika…', 'Say something…')} /><button>➤</button></form>
          </div>
        )}
      </div>
      <div className="wp-bottom">
        <button onClick={async () => { setFriends((await api('/contacts').catch(() => [])).filter((c) => c.mutual)); setPop('invite'); }}>👤 {L('Alika', 'Invite')}</button>
        <button className="gold" onClick={() => setPop('buyWho')}>🎁 {L('Nunulia mtu', 'Buy for someone')}</button>
        <button onClick={() => { setBuyFor(null); setPop('snacks'); }}>🍿 {L('Vitafunwa', 'Snacks')}</button>
        {REACTS.map((e) => <button key={e} className="react" onClick={() => react(e)}>{e}</button>)}
      </div>
      <div className="wp-credit">{m.source === 'ScoreBat' ? 'Video · ScoreBat' : ''}</div>
      {pop === 'snacks' && <Picker title={buyFor ? L(`Nunulia @${buyFor}`, `Buy for @${buyFor}`) : L('Vitafunwa', 'Snacks')} items={snacks.map((s) => ({ key: s.id, label: `${s.emoji} ${L(s.name[0], s.name[1])} · TSh ${s.price.toLocaleString()}`, s }))} onPick={(it) => buy(it.s, buyFor)} onClose={() => setPop(null)} />}
      {pop === 'buyWho' && <Picker title={L('Unamnunulia nani?', 'Who are you treating?')} items={(w.members || []).filter((p) => p.username !== me.username).map((p) => ({ key: p.id, label: `${avatarEmoji(p.appearance)} @${p.username}`, p }))} onPick={(it) => { setBuyFor(it.p.username); setTimeout(() => setPop('snacks'), 0); }} onClose={() => setPop(null)} />}
      {pop === 'invite' && <Picker title={L('Alika rafiki', 'Invite a friend')} items={friends.map((f) => ({ key: f.username, label: `${f.online ? '🟢' : '⚪'} @${f.username}`, f }))} onPick={(it) => getSocket()?.emit('watch:invite', { to: it.f.username }, (r) => useStore.getState().toast(r?.ok ? L(`📨 Mwaliko umetumwa kwa @${it.f.username}`, `📨 Invite sent to @${it.f.username}`) : L('Imeshindikana.', 'Failed.')))} onClose={() => setPop(null)} />}
    </div>
  );
}

/** "@x invited you to watch …" banner. */
export function WatchInvite() {
  const inv = useStore((s) => s.watchInvite);
  useEffect(() => { initWatch(); }, []);
  useEffect(() => { if (!inv) return; sfx('notify'); const t = setTimeout(() => useStore.setState({ watchInvite: null }), 20_000); return () => clearTimeout(t); }, [inv]);
  if (!inv) return null;
  return (
    <div className="watch-invite card">
      <span>⚽ <b>@{inv.from}</b> {L('anakualika kutazama', 'invited you to watch')} <b>{inv.title}</b></span>
      <div className="row" style={{ gap: 6 }}>
        <button className="btn btn-green btn-xs" onClick={() => joinWatch(inv.matchId)}>{L('Jiunge', 'Join')}</button>
        <button className="btn btn-ghost btn-xs" onClick={() => useStore.setState({ watchInvite: null })}>✕</button>
      </div>
    </div>
  );
}
