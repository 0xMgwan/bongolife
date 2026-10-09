import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store.js';
import { api } from '../../api.js';
import { sendDm, sendGroup, sendChat } from '../../net.js';
import { ask } from '../Confirm.jsx';
import { sfx } from '../../audio.js';
import { avatarEmoji } from '../../three/Avatar.jsx';
import { AppHead } from '../Phone.jsx';
import { L } from '../../i18n.js';
import { inviteHome, visitHome } from '../social.js';

// "::hello" style system lines from quick interactions.
const NUDGES = { hello: ['amesalimia 👋', 'said hello 👋'], gist: ['anataka stori 💬', 'wants to gist 💬'], joke: ['amepiga utani 😂', 'cracked a joke 😂'], 'joke:fail': ['alijaribu utani 😬', 'tried a joke 😬'], shade: ['amepiga kijembe 😒', 'threw shade 😒'] };
export const nudgeText = (body, who) => {
  const k = body.startsWith('::') && NUDGES[body.slice(2)];
  return k ? L(`@${who} ${k[0]}`, `@${who} ${k[1]}`) : null;
};
const QUICK = [['Mambo vipi? 👋', 'Mambo vipi? 👋'], ['Poa sana 😄', 'Poa sana 😄'], ['Kuna nini leo?', "What's up today?"], ['Twende tukale bata 🎉', "Let's go out 🎉"], ['Uko wapi?', 'Where you at?'], ['Hahaha 😂', 'Hahaha 😂']];

const ago = (t) => {
  const s = (Date.now() - t) / 1000;
  if (s < 60) return L('sasa hivi', 'just now');
  if (s < 3600) return L(`dk ${Math.floor(s / 60)}`, `${Math.floor(s / 60)}m`);
  if (s < 86400) return L(`saa ${Math.floor(s / 3600)}`, `${Math.floor(s / 3600)}h`);
  return new Date(t).toLocaleDateString();
};

const REACTIONS = ['❤️', '😂', '😮', '😢', '🙏', '👍', '🔥'];
const fmtSecs = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const errText = (r) => (r.errorText ? L(r.errorText[0], r.errorText[1]) : r.error === 'muted' ? L('Umezuiwa kuchat kwa muda.', 'You are muted for now.') : r.error);

/** Chats & Groups tabs. */
export function Threads({ open, back, arg }) {
  const [tab, setTab] = useState(arg === 'groups' ? 'groups' : 'chats');
  const [threads, setThreads] = useState(null);
  const [groups, setGroups] = useState(null);
  const [to, setTo] = useState('');
  const [creating, setCreating] = useState(false);
  const dmVersion = useStore((s) => s.dmVersion);
  useEffect(() => {
    api('/messages/threads').then(setThreads).catch(() => setThreads([]));
    api('/groups').then(setGroups).catch(() => setGroups([]));
  }, [dmVersion]);
  const groupUnread = (groups || []).reduce((n, g) => n + g.unread, 0);
  if (creating) return <NewGroup back={() => setCreating(false)} onCreated={(id) => { setCreating(false); open('group', id); }} />;
  return (
    <>
      <AppHead title={L('Ujumbe', 'Messages')} onBack={back} />
      <div className="app-body">
        <div className="seg">
          <button className={tab === 'chats' ? 'on' : ''} onClick={() => setTab('chats')}>💬 {L('Chats', 'Chats')}</button>
          <button className={tab === 'groups' ? 'on' : ''} onClick={() => setTab('groups')}>👥 {L('Vikundi', 'Groups')}{groupUnread > 0 && <span className="badge" style={{ position: 'static', marginLeft: 6 }}>{groupUnread}</span>}</button>
        </div>
        {tab === 'chats' ? (
          <>
            <form className="row" style={{ marginBottom: 10 }} onSubmit={(e) => { e.preventDefault(); if (to.trim()) open('dm', to.trim().replace(/^@/, '')); }}>
              <input className="field" style={{ padding: '11px 16px' }} placeholder={L('@username kuanzisha chat', '@username to start a chat')} value={to} onChange={(e) => setTo(e.target.value)} autoCapitalize="none" />
              <button className="btn btn-green btn-sm">{L('Anza', 'Start')}</button>
            </form>
            <div className="box" style={{ padding: '4px 12px' }}>
              {threads === null && <div className="muted small" style={{ padding: 12 }}>{L('Inapakia…', 'Loading…')}</div>}
              {threads?.length === 0 && <div className="muted small" style={{ padding: 12 }}>{L('Bado huna meseji. Gusa mtu mtaani kumtumia ujumbe 👋', 'No messages yet. Tap someone on the street to message them 👋')}</div>}
              {threads?.map((t) => (
                <button key={t.user.id} className="thread" onClick={() => open('dm', t.user.username)}>
                  <span className="avatar-dot">{avatarEmoji(t.user.appearance)}{t.user.online && <span className="dot" style={{ position: 'absolute', right: 0, bottom: 0 }} />}</span>
                  <div className="grow">
                    <div className="row between"><b>@{t.user.username}</b><span className="small muted">{ago(t.at)}</span></div>
                    <div className="small muted" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nudgeText(t.last || '', t.mine ? L('wewe', 'you') : t.user.username) || `${t.mine ? L('Wewe: ', 'You: ') : ''}${t.last === '🚫' ? L('Ujumbe umefutwa', 'Message deleted') : t.last}`}</div>
                  </div>
                  {t.unread > 0 && <span className="badge" style={{ position: 'static' }}>{t.unread}</span>}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <button className="co-start" style={{ marginBottom: 10 }} onClick={() => setCreating(true)}><span className="em">👥</span><span className="grow"><b>{L('Kikundi kipya', 'New group')}</b><small>{L('Washkaji, familia, kampuni…', 'Friends, family, your company crew…')}</small></span><span className="go">＋</span></button>
            <div className="box" style={{ padding: '4px 12px' }}>
              {groups === null && <div className="muted small" style={{ padding: 12 }}>{L('Inapakia…', 'Loading…')}</div>}
              {groups?.length === 0 && <div className="muted small" style={{ padding: 12 }}>{L('Bado huna kikundi.', 'No groups yet.')}</div>}
              {groups?.map((g) => (
                <button key={g.id} className="thread" onClick={() => open('group', g.id)}>
                  <span className="avatar-dot" style={{ fontSize: 20 }}>{g.emoji}</span>
                  <div className="grow">
                    <div className="row between"><b>{g.name}</b><span className="small muted">{g.at ? ago(g.at) : ''}</span></div>
                    <div className="small muted" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.last || L(`Watu ${g.size}`, `${g.size} members`)}</div>
                  </div>
                  {g.unread > 0 && <span className="badge" style={{ position: 'static' }}>{g.unread}</span>}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}

const GROUP_EMOJIS = ['👥', '🔥', '🎉', '⚽', '💼', '🎤', '🏖️', '💃', '🍲', '❤️'];
/** Pick people from your contacts (or type @usernames) for a new group / to add. */
function PeoplePicker({ picked, setPicked }) {
  const [contacts, setContacts] = useState([]);
  const [extra, setExtra] = useState('');
  useEffect(() => { api('/contacts').then((c) => setContacts(Array.isArray(c) ? c : c.contacts || [])).catch(() => {}); }, []);
  const toggle = (u) => setPicked(picked.includes(u) ? picked.filter((x) => x !== u) : [...picked, u]);
  return (
    <>
      <div className="pick-list">
        {contacts.map((c) => {
          const u = c.username || c.user?.username;
          if (!u) return null;
          return <button key={u} className={picked.includes(u) ? 'on' : ''} onClick={() => toggle(u)}>{picked.includes(u) ? '✓' : '＋'} @{u}</button>;
        })}
        {picked.filter((u) => !contacts.some((c) => (c.username || c.user?.username) === u)).map((u) => <button key={u} className="on" onClick={() => toggle(u)}>✓ @{u}</button>)}
      </div>
      <form className="row" style={{ marginTop: 8 }} onSubmit={(e) => { e.preventDefault(); const u = extra.trim().replace(/^@/, ''); if (u && !picked.includes(u)) setPicked([...picked, u]); setExtra(''); }}>
        <input className="field" style={{ margin: 0 }} placeholder="@username" value={extra} onChange={(e) => setExtra(e.target.value)} autoCapitalize="none" />
        <button className="btn btn-ghost btn-sm">{L('Ongeza', 'Add')}</button>
      </form>
    </>
  );
}
function NewGroup({ back, onCreated }) {
  const run = useStore((s) => s.run);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState(GROUP_EMOJIS[0]);
  const [picked, setPicked] = useState([]);
  const create = async () => {
    const r = await run('/groups', { method: 'POST', body: { name, emoji, members: picked } });
    if (r) { sfx('pop'); onCreated(r.id); }
  };
  return (
    <>
      <AppHead title={L('Kikundi kipya', 'New group')} onBack={back} />
      <div className="app-body">
        <div className="row" style={{ gap: 10, alignItems: 'center' }}>
          <span className="co-logo" style={{ background: '#111827' }}>{emoji}</span>
          <input className="field" style={{ margin: 0, flex: 1 }} maxLength={40} placeholder={L('Jina la kikundi', 'Group name')} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="co-logos" style={{ marginTop: 10 }}>{GROUP_EMOJIS.map((e) => <button key={e} className={emoji === e ? 'on' : ''} onClick={() => setEmoji(e)}>{e}</button>)}</div>
        <div className="section-t">{L('WATU', 'PEOPLE')} ({picked.length})</div>
        <PeoplePicker picked={picked} setPicked={setPicked} />
        <button className="btn btn-green btn-block" style={{ marginTop: 14 }} disabled={name.trim().length < 2 || !picked.length} onClick={create}>👥 {L('Unda kikundi', 'Create group')}</button>
      </div>
    </>
  );
}

// ------------------------------------------------------------ voice notes
function VoicePlayer({ m }) {
  const ref = useRef();
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const dur = m.duration || 1;
  const toggle = (e) => {
    e.stopPropagation();
    const a = ref.current;
    if (!a) return;
    if (a.paused) { a.play().catch(() => {}); } else a.pause();
  };
  return (
    <div className="voice">
      <audio ref={ref} src={`/uploads/${m.audio}`} preload="none" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => { setPlaying(false); setT(0); }} onTimeUpdate={(e) => setT(e.currentTarget.currentTime)} />
      <button onClick={toggle} onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()} aria-label={playing ? 'Pause' : 'Play'}>{playing ? '❚❚' : '▶'}</button>
      <div className="vbar"><i style={{ width: `${Math.min(100, (t / dur) * 100)}%` }} /></div>
      <small>{fmtSecs(playing ? t : dur)}</small>
    </div>
  );
}

/** Hold to talk, release to send, slide left to cancel. */
function useVoiceRecorder(onDone) {
  const [rec, setRec] = useState(null); // { secs, cancel }
  const st = useRef({});
  const start = async (x) => {
    if (st.current.active) return;
    st.current = { active: true, startX: x, cancel: false, released: false };
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      st.current.active = false;
      useStore.getState().toast(L('Simu hii haiwezi kurekodi sauti hapa.', "This browser can't record voice notes."), 'err');
      return;
    }
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      st.current.active = false;
      useStore.getState().toast(L('Ruhusu maikrofoni kurekodi sauti.', 'Allow the microphone to record voice notes.'), 'err');
      return;
    }
    // Released before permission came back → don't start.
    if (st.current.released) { stream.getTracks().forEach((tr) => tr.stop()); st.current.active = false; return; }
    const type = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg'].find((t) => MediaRecorder.isTypeSupported?.(t)) || '';
    const mr = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
    const chunks = [];
    mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    mr.onstop = () => {
      stream.getTracks().forEach((tr) => tr.stop());
      const secs = (Date.now() - st.current.t0) / 1000;
      const cancelled = st.current.cancel;
      st.current.active = false;
      clearInterval(st.current.timer);
      setRec(null);
      if (cancelled || secs < 0.8) return;
      onDone(new Blob(chunks, { type: mr.mimeType || 'audio/webm' }), Math.round(secs));
    };
    st.current.mr = mr;
    st.current.t0 = Date.now();
    mr.start();
    sfx('click');
    setRec({ secs: 0, cancel: false });
    st.current.timer = setInterval(() => {
      const secs = (Date.now() - st.current.t0) / 1000;
      setRec((r) => r && { ...r, secs });
      if (secs >= 60) stop();
    }, 200);
  };
  const move = (x) => {
    if (!st.current.active || st.current.startX == null) return;
    const cancel = st.current.startX - x > 80;
    if (cancel !== st.current.cancel) { st.current.cancel = cancel; setRec((r) => r && { ...r, cancel }); }
  };
  const stop = () => {
    st.current.released = true;
    if (st.current.mr?.state === 'recording') st.current.mr.stop();
  };
  return { rec, start, move, stop };
}

// ------------------------------------------------------------ conversation
function Bubble({ m, mine, showName, onMenu, onReply, onReact, myName }) {
  const [dx, setDx] = useState(0);
  const g = useRef(null);
  const press = useRef(null);
  if (m.kind === 'system') return <div className="nudge-line">👥 {L(`@${m.from} ameunda kikundi`, `@${m.from} created the group`)}</div>;
  const nudge = nudgeText(m.body || '', m.from);
  if (nudge) return <div className="nudge-line">{nudge} · {ago(m.created_at)}</div>;
  const down = (e) => {
    g.current = { x: e.clientX, y: e.clientY, dx: 0 };
    press.current = setTimeout(() => { press.current = null; if (g.current && Math.abs(g.current.dx) < 8) { g.current = null; onMenu(m); } }, 450);
  };
  const moveP = (e) => {
    if (!g.current) return;
    const d = e.clientX - g.current.x;
    if (Math.abs(e.clientY - g.current.y) > 24 && Math.abs(d) < 20) { g.current = null; setDx(0); return; }
    g.current.dx = d;
    if (d > 0) setDx(Math.min(80, d));
  };
  const up = () => {
    clearTimeout(press.current);
    if (g.current && g.current.dx > 55 && !m.deleted) onReply(m);
    else if (g.current && Math.abs(g.current.dx) < 8 && press.current !== null) onMenu(m);
    g.current = null;
    setDx(0);
  };
  const rx = Object.entries(m.reactions || {});
  return (
    <div className={`bubble-row ${mine ? 'me' : ''}`}>
      <span className="swipe-ic" style={{ opacity: dx / 80 }}>↩️</span>
      <div
        className={`bubble ${mine ? 'me' : ''} ${m.deleted ? 'deleted' : ''}`}
        style={{ transform: dx ? `translateX(${dx}px)` : undefined }}
        onPointerDown={down} onPointerMove={moveP} onPointerUp={up} onPointerCancel={() => { clearTimeout(press.current); g.current = null; setDx(0); }}
        onContextMenu={(e) => { e.preventDefault(); onMenu(m); }}
      >
        {showName && !mine && <b className="bubble-from">@{m.from}</b>}
        {m.fwd && !m.deleted && <span className="fwd">↪️ {L('Imetumwa tena', 'Forwarded')}</span>}
        {m.reply && !m.deleted && <span className="quote"><b>@{m.reply.from}</b>{m.reply.deleted ? L('Ujumbe umefutwa', 'Message deleted') : m.reply.body}</span>}
        {m.deleted ? <i>🚫 {L('Ujumbe huu umefutwa', 'This message was deleted')}</i> : m.kind === 'voice' ? <VoicePlayer m={m} /> : m.body}
        <small>{ago(m.created_at)}{m.edited_at && !m.deleted ? ` · ${L('imehaririwa', 'edited')}` : ''}{mine && !m.group_id ? ` · ${m.read_at ? '✓✓' : '✓'}` : ''}</small>
      </div>
      {rx.length > 0 && (
        <div className="rx-row">
          {rx.map(([e, who]) => <button key={e} className={who.includes(myName) ? 'on' : ''} onClick={() => onReact(m, e)}>{e}{who.length > 1 ? ` ${who.length}` : ''}</button>)}
        </div>
      )}
    </div>
  );
}

function ForwardPicker({ m, onClose }) {
  const run = useStore((s) => s.run);
  const [threads, setThreads] = useState([]);
  const [groups, setGroups] = useState([]);
  useEffect(() => {
    api('/messages/threads').then(setThreads).catch(() => {});
    api('/groups').then(setGroups).catch(() => {});
  }, []);
  const go = async (body, label) => {
    const r = await run(`/messages/${m.id}/forward`, { method: 'POST', body });
    if (r) { sfx('pop'); useStore.getState().toast(L(`↪️ Umetuma kwa ${label}`, `↪️ Forwarded to ${label}`)); onClose(); }
  };
  return (
    <div className="modal-wrap confirm-wrap" onClick={onClose}>
      <div className="modal card confirm-card fwd-pick" onClick={(e) => e.stopPropagation()}>
        <h3>↪️ {L('Tuma kwa…', 'Forward to…')}</h3>
        <div className="fwd-list">
          {groups.map((g) => <button key={`g${g.id}`} onClick={() => go({ groupId: g.id }, g.name)}>{g.emoji} {g.name}</button>)}
          {threads.map((t) => <button key={t.user.id} onClick={() => go({ to: t.user.username }, `@${t.user.username}`)}>{avatarEmoji(t.user.appearance)} @{t.user.username}</button>)}
          {!groups.length && !threads.length && <div className="small muted">{L('Hakuna mazungumzo bado.', 'No chats yet.')}</div>}
        </div>
        <button className="btn btn-ghost btn-block" style={{ marginTop: 10 }} onClick={onClose}>{L('Ghairi', 'Cancel')}</button>
      </div>
    </div>
  );
}

/** One conversation (DM or group): replies, reactions, edit/delete, forward, voice notes. */
function Conversation({ kind, target, messages, setMessages, isGroup }) {
  const me = useStore((s) => s.me);
  const run = useStore((s) => s.run);
  const lastDm = useStore((s) => s.lastDm);
  const lastGm = useStore((s) => s.lastGm);
  const msgUpdate = useStore((s) => s.msgUpdate);
  const [text, setText] = useState('');
  const [reply, setReply] = useState(null);
  const [editing, setEditing] = useState(null);
  const [menu, setMenu] = useState(null);
  const [fwd, setFwd] = useState(null);
  const end = useRef();
  const input = useRef();
  const add = (m) => setMessages((list) => (list.some((x) => x.id === m.id) ? list : [...list, m]));
  // Live messages for this conversation.
  useEffect(() => {
    const m = isGroup ? lastGm : lastDm;
    if (!m) return;
    if (isGroup ? String(m.group_id) === String(target) : (m.from === target || (m.from_id === me.id && m.to_id === kind.otherId)) && !m.group_id) add(m);
  }, [isGroup ? lastGm : lastDm]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (msgUpdate) setMessages((list) => list.map((x) => (x.id === msgUpdate.id ? { ...x, ...msgUpdate } : x)));
  }, [msgUpdate]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [messages.length]);

  const send = async (e, quick) => {
    e?.preventDefault();
    const t = (quick ?? text).trim();
    if (!t) return;
    setText('');
    if (editing) {
      const r = await run(`/messages/${editing.id}/edit`, { method: 'POST', body: { text: t } });
      if (r) setMessages((list) => list.map((x) => (x.id === r.msg.id ? r.msg : x)));
      setEditing(null);
      return;
    }
    const extra = reply ? { replyTo: reply.id } : {};
    setReply(null);
    const r = isGroup ? await sendGroup(target, t, extra) : await sendDm(target, t, extra);
    if (r.error) useStore.getState().toast(errText(r), 'err');
    else add(r.msg);
  };
  const voice = useVoiceRecorder(async (blob, secs) => {
    const form = new FormData();
    const ext = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm';
    form.append('audio', blob, `voice.${ext}`);
    form.append('duration', String(secs));
    if (isGroup) form.append('groupId', String(target)); else form.append('to', target);
    if (reply) form.append('replyTo', String(reply.id));
    setReply(null);
    try {
      const r = await api('/messages/voice', { method: 'POST', form });
      sfx('pop');
      add(r.msg);
    } catch (err) { useStore.getState().toast(err.message, 'err'); }
  });
  const react = async (m, emoji) => {
    setMenu(null);
    const r = await run(`/messages/${m.id}/react`, { method: 'POST', body: { emoji } });
    if (r) setMessages((list) => list.map((x) => (x.id === r.msg.id ? r.msg : x)));
  };
  const del = async (m) => {
    setMenu(null);
    const r = await run(`/messages/${m.id}`, { method: 'DELETE' });
    if (r) setMessages((list) => list.map((x) => (x.id === r.msg.id ? r.msg : x)));
  };
  const startReply = (m) => { setEditing(null); setReply(m); setMenu(null); setTimeout(() => input.current?.focus(), 30); };
  const canEdit = (m) => m.from_id === me.id && m.kind !== 'voice' && !m.deleted && Date.now() - m.created_at < 15 * 60_000;
  return (
    <>
      <div className="app-body" style={{ background: '#eef2f6' }}>
        <div className="msgs">
          {messages.length === 0 && <div className="center small muted" style={{ padding: 20 }}>{L('Anza stori! Sema "Mambo vipi?" 👋', 'Start chatting! Say "Mambo vipi?" 👋')}</div>}
          {messages.map((m) => (
            <Bubble key={m.id} m={m} mine={m.from_id === me.id} showName={isGroup} myName={me.username} onMenu={setMenu} onReply={startReply} onReact={react} />
          ))}
          <div ref={end} />
        </div>
      </div>
      {!isGroup && !reply && !editing && (
        <div className="quick-replies">
          {QUICK.map(([sw, en]) => <button key={sw} onClick={() => send(null, L(sw, en))}>{L(sw, en)}</button>)}
        </div>
      )}
      {(reply || editing) && (
        <div className="reply-bar">
          <span>{editing ? <>✏️ {L('Unahariri', 'Editing')}</> : <>↩️ @{reply.from}: {reply.kind === 'voice' ? '🎤' : (reply.body || '').slice(0, 60)}</>}</span>
          <button onClick={() => { setReply(null); setEditing(null); setText(''); }} aria-label={L('Funga', 'Close')}>✕</button>
        </div>
      )}
      {voice.rec ? (
        <div className={`composer recording ${voice.rec.cancel ? 'cancel' : ''}`}>
          <span className="rec-dot" /> <b>{fmtSecs(voice.rec.secs)}</b>
          <span className="grow small">{voice.rec.cancel ? L('Achia kufuta', 'Release to cancel') : L('‹ Telezesha kushoto kufuta · achia kutuma', '‹ Slide left to cancel · release to send')}</span>
          <button className="mic on" onPointerUp={voice.stop} onPointerMove={(e) => voice.move(e.clientX)}>🎤</button>
        </div>
      ) : (
        <form className="composer" onSubmit={send}>
          <input ref={input} value={text} onChange={(e) => setText(e.target.value)} placeholder={L('Andika ujumbe…', 'Write a message…')} maxLength={500} enterKeyHint="send" />
          {text.trim() || editing ? (
            <button className="btn btn-green btn-sm" disabled={!text.trim()}>{editing ? L('Hifadhi', 'Save') : L('Tuma', 'Send')}</button>
          ) : (
            <button type="button" className="mic" aria-label={L('Shikilia kurekodi', 'Hold to record')}
              onPointerDown={(e) => { e.currentTarget.setPointerCapture?.(e.pointerId); voice.start(e.clientX); }}
              onPointerMove={(e) => voice.move(e.clientX)}
              onPointerUp={voice.stop} onPointerCancel={voice.stop}
              onContextMenu={(e) => e.preventDefault()}>🎤</button>
          )}
        </form>
      )}
      {menu && (
        <div className="modal-wrap confirm-wrap" onClick={() => setMenu(null)}>
          <div className="msg-menu" onClick={(e) => e.stopPropagation()}>
            {!menu.deleted && <div className="rx-bar">{REACTIONS.map((e) => <button key={e} onClick={() => react(menu, e)}>{e}</button>)}</div>}
            <div className="mm-list">
              {!menu.deleted && <button onClick={() => startReply(menu)}>↩️ {L('Jibu', 'Reply')}</button>}
              {!menu.deleted && <button onClick={() => { setFwd(menu); setMenu(null); }}>↪️ {L('Tuma kwa mwingine', 'Forward')}</button>}
              {!menu.deleted && menu.kind !== 'voice' && <button onClick={() => { navigator.clipboard?.writeText(menu.body).catch(() => {}); setMenu(null); useStore.getState().toast(L('Imenakiliwa', 'Copied')); }}>📋 {L('Nakili', 'Copy')}</button>}
              {canEdit(menu) && <button onClick={() => { setReply(null); setEditing(menu); setText(menu.body); setMenu(null); setTimeout(() => input.current?.focus(), 30); }}>✏️ {L('Hariri', 'Edit')}</button>}
              {menu.from_id === me.id && !menu.deleted && <button className="red" onClick={async () => { if (await ask({ icon: '🗑️', title: L('Futa kwa wote?', 'Delete for everyone?'), text: L('Ujumbe utafutika kwa kila mtu kwenye mazungumzo haya.', 'The message disappears for everyone in this chat.'), ok: L('Futa', 'Delete'), danger: true })) del(menu); }}>🗑️ {L('Futa kwa wote', 'Delete for everyone')}</button>}
            </div>
          </div>
        </div>
      )}
      {fwd && <ForwardPicker m={fwd} onClose={() => setFwd(null)} />}
    </>
  );
}

export function Dm({ arg: username, back }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    api(`/messages/dm/${encodeURIComponent(username)}`)
      .then((d) => { setData(d); useStore.getState().refreshMe().catch(() => {}); })
      .catch((e) => { useStore.getState().toast(e.message, 'err'); back(); });
  }, [username]); // eslint-disable-line react-hooks/exhaustive-deps
  const setMessages = (fn) => setData((d) => d && { ...d, messages: typeof fn === 'function' ? fn(d.messages) : fn });
  return (
    <>
      <AppHead title={`@${username}`} onBack={back} right={data?.user.online ? <span className="small green bold">online</span> : null} />
      <div className="dm-top">
        <div className="small muted center">🔒 {L(`Faragha · wewe na @${username} pekee mnaona hii`, `Private · only you and @${username} can see this`)}</div>
        <div className="dm-acts">
          <button className="g" onClick={() => inviteHome(username)}>🏠 {L('Mwalike kwako', 'Invite over')}</button>
          <button className="b" onClick={() => visitHome(username)}>🚪 {L('Mtembelee', 'Visit them')}</button>
          <button className="y" onClick={() => useStore.getState().openPhone('pesa', { send: username })}>💸 {L('Tuma pesa', 'Send money')}</button>
          <button className="p" onClick={() => useStore.setState({ phone: null, sheet: { type: 'player', id: username } })}>🎉 {L('Mtoke pamoja', 'Go out')}</button>
        </div>
      </div>
      {data ? <Conversation kind={{ otherId: data.user.id }} target={username} messages={data.messages} setMessages={setMessages} /> : <div className="app-body"><div className="small muted" style={{ padding: 12 }}>{L('Inapakia…', 'Loading…')}</div></div>}
    </>
  );
}

export function GroupChat({ arg: groupId, back }) {
  const run = useStore((s) => s.run);
  const [data, setData] = useState(null);
  const [adding, setAdding] = useState(false);
  const [picked, setPicked] = useState([]);
  const load = () => api(`/groups/${groupId}`).then(setData).catch((e) => { useStore.getState().toast(e.message, 'err'); back(); });
  useEffect(() => { load(); }, [groupId]); // eslint-disable-line react-hooks/exhaustive-deps
  const setMessages = (fn) => setData((d) => d && { ...d, messages: typeof fn === 'function' ? fn(d.messages) : fn });
  const leave = async () => {
    if (!(await ask({ icon: '👋', title: L('Ondoka kwenye kikundi?', 'Leave the group?'), ok: L('Ondoka', 'Leave'), danger: true }))) return;
    const r = await run(`/groups/${groupId}/leave`, { method: 'POST' });
    if (r) back();
  };
  return (
    <>
      <AppHead title={data ? `${data.group.emoji} ${data.group.name}` : '…'} onBack={back} right={data && <button className="btn btn-ghost btn-xs" onClick={() => setAdding(!adding)}>👥 {data.members.length}</button>} />
      {adding && data && (
        <div className="grp-panel">
          <div className="grp-members">{data.members.map((u) => <span key={u.id}>{avatarEmoji(u.appearance)} @{u.username}</span>)}</div>
          <PeoplePicker picked={picked} setPicked={setPicked} />
          <div className="row" style={{ gap: 8, marginTop: 8 }}>
            <button className="btn btn-green btn-sm grow" disabled={!picked.length} onClick={async () => { const r = await run(`/groups/${groupId}/members`, { method: 'POST', body: { members: picked } }); if (r) { setPicked([]); setAdding(false); load(); useStore.getState().toast(L(`Umeongeza ${r.added}`, `Added ${r.added}`)); } }}>＋ {L('Ongeza', 'Add')}</button>
            <button className="btn btn-ghost btn-sm" onClick={leave}>{L('Ondoka', 'Leave')}</button>
          </div>
        </div>
      )}
      {data ? <Conversation isGroup target={groupId} messages={data.messages} setMessages={setMessages} /> : <div className="app-body"><div className="small muted" style={{ padding: 12 }}>{L('Inapakia…', 'Loading…')}</div></div>}
    </>
  );
}

export function Mtaa({ back, open }) {
  const feed = useStore((s) => s.publicFeed);
  const myName = useStore((s) => s.me?.username);
  const [text, setText] = useState('');
  const end = useRef();
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [feed.length]);
  const send = (e) => {
    e.preventDefault();
    if (text.trim()) sendChat(text.trim());
    setText('');
  };
  return (
    <>
      <AppHead title={L('Mtaa · Chat ya wote', 'Street · Public chat')} onBack={back} />
      <div className="app-body" style={{ background: '#eef2f6' }}>
        <div className="msgs">
          {feed.map((m) => (
            <div key={`${m.mid ?? m.id}-${m.at}`} className={`bubble ${m.username === myName ? 'me' : ''}`}>
              {m.username !== myName && (
                <button className="bold small" style={{ display: 'block', color: 'var(--green-d)' }} onClick={() => open('dm', m.username)}>@{m.username}</button>
              )}
              {m.text}
              <small>{ago(m.at)}</small>
            </div>
          ))}
          <div ref={end} />
        </div>
      </div>
      <form className="composer" onSubmit={send}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={L('Niaje wanangu…', 'Hey everyone…')} maxLength={200} enterKeyHint="send" />
        <button className="btn btn-green btn-sm" disabled={!text.trim()}>{L('Tuma', 'Send')}</button>
      </form>
    </>
  );
}
