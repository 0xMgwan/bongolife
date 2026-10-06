import { useEffect, useRef, useState } from 'react';
import { NEEDS, gameClock, moodLabel, moodLabelEn, fmtTsh, fmtShort, vehicleById } from '@shared/world.js';
import { L, loc, pick, isEn } from '../i18n.js';
import { useStore } from '../store.js';
import { input, sendChat, sendEmote } from '../net.js';
import { avatarEmoji } from '../three/Avatar.jsx';
import { setZoom, getZoom } from '../three/GameScene.jsx';

function NeedRing({ need, value }) {
  const r = 15;
  const c = 2 * Math.PI * r;
  const low = value < 20;
  return (
    <div className={`need ${low ? 'low' : ''}`} title={`${loc(need)}: ${Math.round(value)}%`}>
      <svg viewBox="0 0 34 34">
        <circle cx="17" cy="17" r={r} fill="none" stroke="#eef0f3" strokeWidth="3.5" />
        <circle cx="17" cy="17" r={r} fill="none" stroke={low ? '#ef4444' : need.color} strokeWidth="3.5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} style={{ transition: 'stroke-dashoffset .6s' }} />
      </svg>
      <span>{need.icon}</span>
    </div>
  );
}

function Clock() {
  const [c, setC] = useState(gameClock());
  useEffect(() => {
    const t = setInterval(() => setC(gameClock()), 1000);
    return () => clearInterval(t);
  }, []);
  const night = c.hour < 6 || c.hour >= 19;
  return <div className="clock">{night ? '🌙' : '☀️'} {String(c.hour).padStart(2, '0')}:{String(c.minute).padStart(2, '0')}</div>;
}

function Joystick() {
  const knob = useRef();
  const base = useRef();
  const id = useRef(null);
  const move = (e) => {
    if (e.pointerId !== id.current) return;
    const r = base.current.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2);
    let dy = e.clientY - (r.top + r.height / 2);
    const max = r.width / 2 - 10;
    const d = Math.hypot(dx, dy);
    if (d > max) {
      dx = (dx / d) * max;
      dy = (dy / d) * max;
    }
    knob.current.style.transform = `translate(${dx}px, ${dy}px)`;
    input.jx = dx / max;
    input.jz = dy / max;
  };
  const end = (e) => {
    if (e.pointerId !== id.current) return;
    id.current = null;
    knob.current.style.transform = '';
    input.jx = input.jz = 0;
  };
  return (
    <div
      ref={base}
      className="joy"
      onPointerDown={(e) => {
        id.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        move(e);
      }}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <i ref={knob} />
    </div>
  );
}

function Busy({ me }) {
  const run = useStore((s) => s.run);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  const b = me.busy;
  if (!b) return null;
  const total = b.endsAt - b.startedAt;
  const pct = Math.min(100, ((now - b.startedAt) / total) * 100);
  const left = Math.max(0, Math.ceil((b.endsAt - now) / 1000));
  return (
    <div className="busy card">
      <span className="em">{b.emoji}</span>
      <div className="grow">
        <div className="bold">{b.kind === 'job' ? `${L('Kazini', 'Working')}: ${loc(b, 'label')}` : loc(b, 'label')}</div>
        <div className="small muted">{left > 0 ? L(`Sekunde ${left} zimebaki`, `${left}s left`) : L('Inamalizika…', 'Finishing…')}</div>
        <div className="progress"><div style={{ width: `${pct}%` }} /></div>
      </div>
      <button className="btn btn-ghost btn-xs" onClick={() => run('/act/cancel', { method: 'POST' })}>{L('Acha', 'Stop')}</button>
    </div>
  );
}

function Result() {
  const result = useStore((s) => s.result);
  const set = useStore((s) => s.set);
  if (!result) return null;
  return (
    <div className="modal-wrap" onClick={() => set({ result: null })}>
      <div className="modal card" onClick={(e) => e.stopPropagation()}>
        <div className="big">{result.kind === 'job' ? '💰' : '✨'}</div>
        <h3>{pick(result.title)}</h3>
        {result.pay != null && <div className="bold green" style={{ fontSize: 24 }}>+{fmtTsh(result.pay)}</div>}
        {result.lines?.map((l, i) => <div key={i} className="small" style={{ marginTop: 6 }}>{pick(l)}</div>)}
        <button className="btn btn-green btn-block" style={{ marginTop: 16 }} onClick={() => set({ result: null })}>{L('Poa!', 'Nice!')}</button>
      </div>
    </div>
  );
}

const EMOTES = ['👋', '😂', '🔥', '❤️', '🙏', '💃', '😎', '🇹🇿'];

function ChatBar() {
  const open = useStore((s) => s.chatOpen);
  const set = useStore((s) => s.set);
  const feed = useStore((s) => s.publicFeed);
  const [text, setText] = useState('');
  const [emotes, setEmotes] = useState(false);
  const inputRef = useRef();
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);
  const recent = feed.filter((m) => Date.now() - (m.at || 0) < 10_000).slice(-4);
  const submit = (e) => {
    e.preventDefault();
    const t = text.trim();
    if (t) sendChat(t);
    setText('');
    set({ chatOpen: false });
    inputRef.current?.blur();
  };
  return (
    <>
      <div className="feed">
        {recent.map((m) => (
          <div key={`${m.id}-${m.at}`}><b>@{m.username}</b> {m.text}</div>
        ))}
      </div>
      <div className="chatbar">
        <div style={{ position: 'relative' }}>
          {emotes && (
            <div className="emotes">
              {EMOTES.map((e) => <button key={e} onClick={() => { sendEmote(e); setEmotes(false); }}>{e}</button>)}
            </div>
          )}
          <button className="round" style={{ width: 48, height: 48 }} onClick={() => setEmotes(!emotes)} aria-label="Emoji">😀</button>
        </div>
        <form onSubmit={submit}>
          <input ref={inputRef} value={text} onChange={(e) => setText(e.target.value)} placeholder={L('Sema kitu mtaani…', 'Say something…')} maxLength={200} onFocus={() => set({ chatOpen: true })} onBlur={() => setTimeout(() => set({ chatOpen: false }), 150)} enterKeyHint="send" />
          <button className="btn btn-green btn-xs" disabled={!text.trim()}>{L('Tuma', 'Send')}</button>
        </form>
      </div>
    </>
  );
}

export function HUD() {
  const me = useStore((s) => s.me);
  const world = useStore((s) => s.world);
  const online = useStore((s) => s.online);
  const announcement = useStore((s) => s.announcement);
  const openPhone = useStore((s) => s.openPhone);
  const run = useStore((s) => s.run);
  const [touch] = useState(() => matchMedia('(pointer: coarse)').matches);
  if (!me) return null;
  const mood = (isEn() ? moodLabelEn : moodLabel)(me.mood ?? 60);
  
  const vehicle = me.vehicles?.find((v) => v.id === me.activeVehicle);
  const anyVehicle = me.vehicles?.[0];
  const toggleVehicle = () => {
    if (vehicle) run('/vehicle/use', { method: 'POST', body: { vehicleId: null } });
    else if (anyVehicle) run('/vehicle/use', { method: 'POST', body: { vehicleId: anyVehicle.id } });
    else openPhone('mali');
  };
  return (
    <div className="layer">
      <div className="hud-top">
        <div className="hud-bar">
          <button className="avatar-dot" onClick={() => openPhone('mipangilio')}>{avatarEmoji(me.appearance)}</button>
          <div className="grow">
            <div className="hud-name">@{me.username}</div>
            <div className="hud-sub">{mood.emoji} {mood.text} · ⭐ {me.fame} · 🟢 {online}</div>
          </div>
          <button className="money" onClick={() => openPhone('pesa')}>
            <small>TSh</small> {fmtShort(me.money)} <span style={{ opacity: 0.9 }}>＋</span>
          </button>
        </div>
        <div className="hud-row2">
          <div className="needs">
            {NEEDS.map((n) => <NeedRing key={n.id} need={n} value={me.needs?.[n.id] ?? 50} />)}
          </div>
          <Clock />
        </div>
        {world?.event && <div className="event">{loc(world.event, 'text')}</div>}
        {announcement && <div className="announce" style={{ alignSelf: 'center' }}>📣 {loc(announcement, 'text')}</div>}
      </div>
      <Busy me={me} />
      <div className="side">
        <button onClick={() => openPhone('home')} aria-label={L('Simu', 'Phone')}>📱{me.unread > 0 && <span className="badge">{me.unread}</span>}</button>
        <button onClick={() => openPhone('ramani')} aria-label={L('Ramani', 'Map')}>🗺️</button>
        <button onClick={toggleVehicle} className={vehicle ? 'on' : ''} aria-label={L('Gari', 'Vehicle')}>{vehicle ? vehicleById[vehicle.model]?.emoji : anyVehicle ? '🚶' : '🚗'}</button>
        <button onClick={() => openPhone('kazi')} aria-label={L('Kazi', 'Jobs')}>💼</button>
        <button onClick={() => setZoom(getZoom() * 0.8)} aria-label="Zoom in">＋</button>
        <button onClick={() => setZoom(getZoom() * 1.25)} aria-label="Zoom out">－</button>
      </div>
      {touch && <Joystick />}
      <ChatBar />
      <Result />
    </div>
  );
}
