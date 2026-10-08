import { useEffect, useRef, useState } from 'react';
import { NEEDS, gameClock, moodLabel, moodLabelEn, fmtTsh, fmtShort, vehicleById, BILLBOARDS, PLOTS, placeById, HEALTH, TRAVEL, flightPhase, findActivity, PLACES, DISTRICTS } from '@shared/world.js';
import { L, loc, pick, isEn } from '../i18n.js';
import { useStore } from '../store.js';
import { input, sendChat, sendEmote, setInside, remotes, local, view } from '../net.js';
import { avatarEmoji } from '../three/Avatar.jsx';
import { setZoom, getZoom } from '../three/GameScene.jsx';
import { setAudioSettings, sfx } from '../audio.js';
import { useAudioSettings } from './useAudioSettings.js';
import { activeScene } from '../scene.js';
import { goToPlace, skipRide, skipTrip } from '../nav.js';
import { goHomeTo } from './homeNav.js';
import { goHospital, leaveVisit } from './social.js';
import { WorkPanel } from './WorkPanel.jsx';
import { useLiveEvents, joinParty } from './events.js';
import { haptic } from '../haptics.js';

/** Banner shown while inside a venue or doing a scene activity. */
/** In-flight bar: phase + destination, camera toggle (auto / cabin / outside). */
function FlightBar({ me }) {
  const view = useStore((s) => s.flightView);
  const [, tick] = useState(0);
  const b = me.busy;
  const f = b ? Math.min(1, (Date.now() - b.startedAt) / (b.endsAt - b.startedAt)) : 0;
  const ph = flightPhase(b?.kind === 'job' ? 0.5 : f);
  const last = useRef(ph[1]);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (last.current !== ph[1]) {
      last.current = ph[1];
      if (ph[1] === 'takeoff') { haptic('takeoff'); sfx('horn'); }
      if (ph[1] === 'landing') haptic('engine');
    }
  }, [ph]);
  useEffect(() => () => useStore.setState({ flightView: null }), []);
  const act = b?.kind === 'activity' ? findActivity(b.placeId, b.id) : null;
  const icon = { boarding: '🧳', takeoff: '🛫', cruise: '✈️', landing: '🛬' }[ph[1]];
  const opt = (v, label) => <button className={view === v ? 'on' : ''} onClick={() => { sfx('click'); useStore.setState({ flightView: v }); }}>{label}</button>;
  return (
    <div className="flight-bar">
      <div className="pill">{icon} {L(ph[2], ph[3])}{act ? ` · ${act.flight.dest}` : ''}</div>
      <div className="seg-mini">
        {opt(null, '🎬')}
        {opt('inside', L('👀 Ndani', '👀 Inside'))}
        {opt('outside', L('🎥 Nje', '🎥 Outside'))}
      </div>
    </div>
  );
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

/** Live party anywhere in the city + your agreed meet-up: one tap to join / go. */
function SocialChips({ me }) {
  const live = useLiveEvents();
  const meetup = useStore((s) => s.meetup);
  const inside = useStore((s) => s.inside);
  const tab = useStore((s) => s.tab);
  const visiting = useStore((s) => s.visiting);
  const chips = [];
  for (const e of live.slice(0, 2)) {
    const here = e.place_id === 'home' ? tab === 'home' && (visiting ? visiting.host.id : me.id) === e.host_id : inside === e.place_id;
    if (here) continue;
    const p = placeById[e.place_id];
    chips.push(
      <button key={`e${e.id}`} className="live-chip" onClick={() => { sfx('click'); joinParty(e); }}>
        <span className="live-dot">LIVE</span>
        <span className="lc-t"><b>{e.title}</b><small>{e.place_id === 'home' ? L(`Kwa @${e.host}`, `At @${e.host}'s`) : loc(p)} · 🙋 {e.going}</small></span>
        <span className="lc-go">{L('Ingia', 'Join')} →</span>
      </button>,
    );
  }
  if (meetup && meetup.until > Date.now() && inside !== meetup.placeId) {
    const p = placeById[meetup.placeId];
    chips.push(
      <button key="meet" className="live-chip meet" onClick={() => { sfx('click'); useStore.setState({ sheet: { type: 'travel', id: meetup.placeId }, tab: 'town', phone: null }); }}>
        <span className="lc-ic">🤝</span>
        <span className="lc-t"><b>{L(`Kutana na @${meetup.with}`, `Meet @${meetup.with}`)}</b><small>{p?.icon} {loc(p)}</small></span>
        <span className="lc-go">{L('Nenda', 'Go')} →</span>
        <span className="lc-x" onClick={(ev) => { ev.stopPropagation(); useStore.setState({ meetup: null }); }}>✕</span>
      </button>,
    );
  }
  return chips.length ? <div className="social-chips">{chips}</div> : null;
}

/** "Heading to X… · Skip" while walking/driving to a place (needs a vehicle to skip). */
function HeadingBanner({ me }) {
  const [h, setH] = useState(null);
  useEffect(() => {
    const t = setInterval(() => {
      const cur = local.heading && local.target ? local.heading : null;
      if (!cur) local.heading = null;
      setH((prev) => (prev?.placeId === cur?.placeId ? prev : cur));
    }, 400);
    return () => clearInterval(t);
  }, []);
  if (!h) return null;
  const p = placeById[h.placeId];
  const hasCar = me.vehicles?.some((v) => ['car', 'van', 'suv', 'moto', 'bajaji'].includes(vehicleById[v.model]?.kind));
  const driving = !!me.activeVehicle;
  return (
    <div className="heading-banner">
      <div className="pill">{driving ? '🚗' : '🚶'} {L(`Unaelekea ${p?.name}…`, `Heading to ${loc(p)}…`)}</div>
      {hasCar && <button className="pill" onClick={() => { sfx('horn'); skipTrip(); }}>⏭ {L('Ruka', 'Skip')}</button>}
    </div>
  );
}

/** Where you are now + quick buttons: map, and home (or out of the house). */
function LocationPill({ me, scene }) {
  const tab = useStore((s) => s.tab);
  const visiting = useStore((s) => s.visiting);
  const inside = useStore((s) => s.inside);
  const roster = useStore((s) => s.roster);
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1500);
    return () => clearInterval(t);
  }, []);
  void roster;
  const atHome = tab === 'home';
  let icon = '📍';
  let name = '';
  let placeId = [scene?.placeId, inside, me.busy?.placeId].find((id) => id && placeById[id]) || null;
  if (atHome) {
    icon = '🏠';
    name = visiting ? L(`Kwa @${visiting.host.username}`, `@${visiting.host.username}'s place`) : L('Kwangu', 'My place');
    placeId = null;
  } else {
    if (!placeId) {
      let best = null;
      let bd = 28;
      for (const p of PLACES) {
        const d = Math.hypot(p.pos[0] - local.x, p.pos[1] - local.z) - Math.max(...p.size) / 2;
        if (d < bd) { bd = d; best = p; }
      }
      placeId = best?.id || null;
    }
    if (placeId) {
      icon = placeById[placeId].icon;
      name = loc(placeById[placeId]);
    } else {
      const d = [...DISTRICTS].sort((a, b) => Math.hypot(a.pos[0] - local.x, a.pos[1] - local.z) - Math.hypot(b.pos[0] - local.x, b.pos[1] - local.z))[0];
      name = d?.name || 'Dar es Salaam';
    }
  }
  const here = placeId ? 1 + [...remotes.values()].filter((r) => r.inside === placeId || r.busy?.placeId === placeId).length : 0;
  const openName = () => {
    sfx('click');
    if (placeId) useStore.setState({ sheet: { type: 'place', id: placeId } });
  };
  return (
    <div className="loc-pill">
      <button className="lp-name" onClick={openName}>{icon} {name}{here > 1 && <small>· 👥{here}</small>} {placeId && <span style={{ fontSize: 12 }}>˄</span>}</button>
      <span className="lp-sep" />
      <button className="lp-btn" aria-label={L('Ramani', 'Map')} onClick={() => { sfx('click'); useStore.setState({ tab: 'town', cityView: 'map', visiting: null, sheet: null, mapFilter: null }); }}>🗺️</button>
      {atHome ? (
        <button className="lp-btn" aria-label={L('Toka nje', 'Go out')} onClick={() => { sfx('close'); if (visiting) leaveVisit(); else useStore.setState({ tab: 'town', cityView: 'follow' }); }}>🚪</button>
      ) : (
        <button className="lp-btn" aria-label={L('Nenda nyumbani', 'Go home')} onClick={() => { sfx('open'); useStore.setState({ tab: 'home', visiting: null, sheet: null, cityView: 'follow' }); }}>🏠</button>
      )}
    </div>
  );
}

function RideBanner() {
  const r = useStore((s) => s.riding);
  if (!r) return null;
  const p = placeById[r.placeId];
  return (
    <div className="ride-banner">
      <div className="pill">{TRAVEL[r.mode]?.emoji} {L(`Njiani kwenda ${p?.name}…`, `On the way to ${loc(p)}…`)}</div>
      <button className="pill" onClick={() => { sfx('click'); skipRide(); }}>⏭ {L('Ruka', 'Skip')}</button>
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
  if (b.kind === 'job') return <WorkPanel me={me} />;
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


function useClock() {
  const [c, setC] = useState(gameClock());
  useEffect(() => {
    const t = setInterval(() => setC(gameClock()), 5000);
    return () => clearInterval(t);
  }, []);
  return c;
}
const fmtTime = ({ hour, minute }) => {
  if (!isEn()) return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  const h = hour % 12 || 12;
  return `${h}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
};

/** Top pill: time · mood · sound · wallet (+). */
function TopBar({ me }) {
  const clock = useClock();
  const sound = useAudioSettings();
  const openPhone = useStore((s) => s.openPhone);
  const online = useStore((s) => s.online);
  const visits = useStore((s) => s.visits);
  const clean = useStore((s) => s.cleanScreen);
  const night = clock.hour < 6 || clock.hour >= 19;
  const mood = (isEn() ? moodLabelEn : moodLabel)(me.mood ?? 60);
  const k = (n) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '')}k` : String(n || 0));
  return (
    <div className="topbar-wrap">
      <div className="topbar">
        <span className="tb-time">{night ? '🌙' : '☀️'} {fmtTime(clock)}</span>
        <span className="tb-sep" />
        <button className="tb-mood" onClick={() => openPhone('mipangilio')}>{mood.emoji} <span>{mood.text}</span></button>
        <span className="tb-sep" />
        <button className="tb-sound" onClick={() => setAudioSettings({ muted: !sound.muted })} aria-label={L('Sauti', 'Sound')}>{sound.muted ? '🔇' : '🔊'}</button>
        <button className="tb-money" onClick={() => openPhone('pesa', 'topup')}>
          TSh {fmtShort(me.money)} <i>＋</i>
        </button>
      </div>
      {!clean && (
        <div className="tb-pills">
          <span className="mini-pill">👀 {k(visits)} {L('wageni', 'visits')}</span>
          <span className="mini-pill"><i className="dot" /> {k(online)} online</span>
        </div>
      )}
    </div>
  );
}

/** Context tips: what your Sim needs right now, and how to fix it. */
function useTips(me) {
  const openPhone = useStore((s) => s.openPhone);
  const set = useStore((s) => s.set);
  const n = me.needs || {};
  const tips = [];
  if (me.busy) return tips;
  if ((me.health ?? 100) < HEALTH.injuredBelow) tips.push({ icon: '🏥', c: '#ef4444', t: L('Umeumia!', "You're hurt!"), s: L('Nenda Muhimbili upate matibabu', 'Get treated at Muhimbili'), go: () => goHospital() });
  else if ((me.health ?? 100) < 70) tips.push({ icon: '❤️', c: '#f43f5e', t: L('Afya iko chini', 'Health is low'), s: L('Pita hospitali, kula & lala vizuri', 'Visit the hospital, eat & sleep well'), go: () => goHospital() });
  if ((n.energy ?? 100) < 35) tips.push({ icon: '😴', c: '#3b82f6', t: L('Umechoka', 'Tired'), s: L('Nenda Kwangu, gusa kitanda', 'Go home and tap your bed'), go: () => goHomeTo('sleep') });
  if ((n.hygiene ?? 100) < 35) tips.push({ icon: '🧼', c: '#06b6d4', t: L('Jisafishe', 'Freshen up'), s: L('Gusa ndoo au bafu Kwangu', 'Tap the bucket or shower at home'), go: () => goHomeTo('bath') });
  if ((n.hunger ?? 100) < 35) tips.push({ icon: '🍛', c: '#f59e0b', t: L('Njaa inauma', 'Hungry'), s: L('Pika Kwangu au kula kwa Mama Ntilie', 'Cook at home or eat at Mama Ntilie'), go: () => goHomeTo('kitchen') });
  if ((n.fun ?? 100) < 35) tips.push({ icon: '🎉', c: '#ec4899', t: L('Kula bata', 'Have some fun'), s: L('1245 Club, Elements au Coco Beach', '1245 Club, Elements or Coco Beach'), go: () => { set({ tab: 'town' }); goToPlace('club'); } });
  if ((n.social ?? 100) < 35) tips.push({ icon: '💬', c: '#8b5cf6', t: L('Piga stori', 'Catch up'), s: L('Ongea na watu kwenye chat', 'Talk to people in chat'), go: () => openPhone('mtaa') });
  if (me.pendingIncome > 0) tips.push({ icon: '🏦', c: '#16a34a', t: L('Kodi iko tayari', 'Income ready'), s: fmtTsh(me.pendingIncome), go: () => openPhone('mali') });
  if (me.unread > 0) tips.push({ icon: '✉️', c: '#2563eb', t: L(`Meseji ${me.unread} mpya`, `${me.unread} new messages`), s: L('Fungua Ujumbe', 'Open Messages'), go: () => openPhone('ujumbe') });
  if (!tips.length && me.money < 30_000) tips.push({ icon: '💼', c: '#334155', t: L('Tafuta mshiko', 'Earn some money'), s: L('Chagua kazi uchakarike', 'Pick a job and hustle'), go: () => openPhone('kazi') });
  if (!tips.length && !Object.keys(me.jobXp || {}).length && useStore.getState().tab === 'town') tips.push({ icon: '👆', c: '#2fb06f', t: L('Karibu mtaani!', 'Welcome to town!'), s: L('Gusa jengo lenye alama', 'Tap a building with an icon') });
  return tips.slice(0, 2);
}

function Tips({ me }) {
  const clean = useStore((s) => s.cleanScreen);
  const tips = useTips(me);
  const toggle = () => {
    const v = !clean;
    try { localStorage.setItem('bl_clean', v ? '1' : '0'); } catch {}
    useStore.setState({ cleanScreen: v });
  };
  return (
    <div className="tips">
      {!clean && tips.map((t, i) => (
        <button key={i} className="tip" onClick={() => { sfx('click'); t.go?.(); }}>
          <span className="tip-ic" style={{ background: t.c }}>{t.icon}</span>
          <span><b>{t.t}</b><small>{t.s}</small></span>
        </button>
      ))}
      <button className="clean-btn" onClick={toggle}>{clean ? L('˅ Onyesha vidokezo', '˅ Show tips') : L('˄ Safisha skrini', '˄ Clean screen')}</button>
    </div>
  );
}

/** Avatar + compact need bars (bottom-left). */
function NeedsPanel({ me }) {
  const openPhone = useStore((s) => s.openPhone);
  const mood = me.mood ?? 60;
  const bars = [...NEEDS.map((n) => ({ icon: n.icon, v: me.needs?.[n.id] ?? 50, c: n.color, name: loc(n) })), { icon: '❤️', v: me.health ?? 100, c: '#f43f5e', name: L('Afya', 'Health') }];
  void mood;
  return (
    <div className="needs-panel">
      <button className="big-avatar" onClick={() => openPhone('kabati')} aria-label={L('Kabati', 'Wardrobe')}>{avatarEmoji(me.appearance)}</button>
      <div className="need-bars">
        {bars.map((b, i) => (
          <div key={i} className="nb" title={`${b.name}: ${Math.round(b.v)}%`}>
            <span>{b.icon}</span>
            <i><em style={{ width: `${b.v}%`, background: b.v < 20 ? '#ef4444' : b.v < 40 ? '#f59e0b' : b.c }} /></i>
          </div>
        ))}
      </div>
    </div>
  );
}

const NAV_ICONS = {
  home: <path d="M3 11.5 12 4l9 7.5M5.5 9.5V20h13V9.5M10 20v-5h4v5" />,
  shop: <path d="M5 11V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3M3 13a2 2 0 0 1 4 0v2h10v-2a2 2 0 0 1 4 0v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4ZM6 19v2M18 19v2" />,
  town: <path d="M9 4 3 6.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5L9 4Zm0 0v13.5m6-11v13.5" />,
  phone: <path d="M8 3h8a1.5 1.5 0 0 1 1.5 1.5v15A1.5 1.5 0 0 1 16 21H8a1.5 1.5 0 0 1-1.5-1.5v-15A1.5 1.5 0 0 1 8 3Zm3 15h2" />,
};
function BottomNav({ me }) {
  const tab = useStore((s) => s.tab);
  const phone = useStore((s) => s.phone);
  const openPhone = useStore((s) => s.openPhone);
  const cityView = useStore((s) => s.cityView);
  // Home = wherever you are right now (your flat if you're in it, else the street).
  const go = (t) => {
    sfx('click');
    if (t === 'phone') return openPhone('home');
    const base = { placing: null, homeSel: null, sheet: null, phone: null };
    if (t === 'here') return useStore.setState({ ...base, tab: tab === 'shop' ? 'home' : tab, cityView: 'follow', mapFilter: null });
    if (t === 'shop') return useStore.setState({ ...base, tab: 'shop', visiting: null });
    if (t === 'map') return useStore.setState({ ...base, tab: 'town', cityView: 'map', visiting: null });
  };
  const items = [
    ['here', 'home', L('Mwanzo', 'Home')],
    ['shop', 'shop', L('Nunua', 'Buy')],
    ['map', 'town', L('Ramani', 'Map')],
    ['phone', 'phone', L('Simu', 'Phone')],
  ];
  const isOn = (id) => {
    if (phone) return id === 'phone';
    if (id === 'shop') return tab === 'shop';
    if (id === 'map') return tab === 'town' && cityView === 'map';
    if (id === 'here') return tab === 'home' || (tab === 'town' && cityView !== 'map');
    return false;
  };
  return (
    <nav className="bottom-nav">
      {items.map(([id, icon, label]) => {
        const on = isOn(id);
        return (
          <button key={id} className={on ? 'on' : ''} onClick={() => go(id)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{NAV_ICONS[icon]}</svg>
            <span>{label}</span>
            {id === 'phone' && me.unread > 0 && <b className="badge">{me.unread}</b>}
          </button>
        );
      })}
    </nav>
  );
}

/** Town chips: jump the map to ads, plots, the sea or people — or walk again. */
function TownChips() {
  const cityView = useStore((s) => s.cityView);
  const filter = useStore((s) => s.mapFilter);
  const openPhone = useStore((s) => s.openPhone);
  const fly = (id) => {
    sfx('click');
    const avg = (pts) => pts.reduce((a, p) => [a[0] + p[0] / pts.length, a[1] + p[1] / pts.length], [0, 0]);
    let target = [local.x, local.z, 150];
    if (id === 'ads') target = [...avg(BILLBOARDS.map((b) => b.pos)), 230];
    if (id === 'homes') target = [...avg(PLOTS.map((p) => p.pos)), 260];
    if (id === 'sea') target = [62, 92, 105];
    if (id === 'people') {
      const pts = [[local.x, local.z], ...[...remotes.values()].filter((r) => !r.inside).map((r) => [r.tx, r.tz])];
      target = [...avg(pts), pts.length > 1 ? 190 : 120];
    }
    view.mapX = target[0];
    view.mapZ = target[1];
    view.mapDist = target[2];
    useStore.setState({ cityView: 'map', mapFilter: id });
  };
  const chips = [
    ['ads', '📢', L('Matangazo', 'Ads')],
    ['homes', '🏘️', L('Viwanja', 'Homes')],
    ['sea', '🌊', L('Bahari', 'Sea')],
    ['people', '👥', L('Watu', 'People')],
  ];
  return (
    <div className="town-chips">
      {chips.map(([id, icon, label]) => (
        <button key={id} className={cityView === 'map' && filter === id ? 'on' : ''} onClick={() => fly(id)}>{icon} {label}</button>
      ))}
      <button onClick={() => openPhone('viongozi')}>🏛️ {L('Mkuu', 'Mayor')}</button>
      <button className={cityView === 'follow' ? 'on' : ''} onClick={() => { sfx('click'); useStore.setState({ cityView: 'follow', mapFilter: null }); }}>🚶 {L('Tembea', 'Walk')}</button>
    </div>
  );
}

const EMOTES = ['👋', '😂', '🔥', '❤️', '🙏', '💃', '😎', '🇹🇿'];

function ChatDock() {
  const open = useStore((s) => s.chatOpen);
  const set = useStore((s) => s.set);
  const feed = useStore((s) => s.publicFeed);
  const [text, setText] = useState('');
  const inputRef = useRef();
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);
  const recent = feed.filter((m) => Date.now() - (m.at || 0) < 10_000).slice(-3);
  const submit = (e) => {
    e.preventDefault();
    const t = text.trim();
    if (t) sendChat(t);
    setText('');
    set({ chatOpen: false });
  };
  return (
    <>
      <div className="feed">
        {recent.map((m) => <div key={`${m.mid ?? m.id}-${m.at}`}><b>@{m.username}</b> {m.text}</div>)}
      </div>
      {open && (
        <div className="chat-dock">
          <div className="emote-row">{EMOTES.map((e) => <button key={e} onClick={() => { sendEmote(e); set({ chatOpen: false }); }}>{e}</button>)}</div>
          <form onSubmit={submit}>
            <input ref={inputRef} value={text} onChange={(e) => setText(e.target.value)} placeholder={L('Sema kitu mtaani…', 'Say something…')} maxLength={200} enterKeyHint="send" />
            <button className="btn btn-green btn-xs" disabled={!text.trim()}>{L('Tuma', 'Send')}</button>
            <button type="button" className="btn btn-ghost btn-xs" onClick={() => set({ chatOpen: false })}>✕</button>
          </form>
        </div>
      )}
    </>
  );
}

export function HUD() {
  const me = useStore((s) => s.me);
  const world = useStore((s) => s.world);
  const announcement = useStore((s) => s.announcement);
  const inside = useStore((s) => s.inside);
  const tab = useStore((s) => s.tab);
  const cityView = useStore((s) => s.cityView);
  const clean = useStore((s) => s.cleanScreen);
  const chatOpen = useStore((s) => s.chatOpen);
  const openPhone = useStore((s) => s.openPhone);
  const run = useStore((s) => s.run);
  const [touch] = useState(() => matchMedia('(pointer: coarse)').matches);
  const riding = useStore((s) => s.riding);
  if (!me) return null;
  const town = tab === 'town';
  const scene = town ? activeScene({ me, inside }) : null;
  const shop = tab === 'shop';
  const vehicle = me.vehicles?.find((v) => v.id === me.activeVehicle);
  // Your go-to ride: the one you drove last, else the most expensive.
  const anyVehicle = me.vehicles?.find((v) => v.id === local.lastCar) || [...(me.vehicles || [])].sort((a, b) => (vehicleById[b.model]?.price || 0) - (vehicleById[a.model]?.price || 0))[0];
  const toggleVehicle = () => {
    if (vehicle) run('/vehicle/use', { method: 'POST', body: { vehicleId: null } });
    else if (anyVehicle) {
      local.lastCar = anyVehicle.id;
      run('/vehicle/use', { method: 'POST', body: { vehicleId: anyVehicle.id } });
    }
    else openPhone('mali');
  };
  const walking = town && !scene && cityView === 'follow' && !riding;
  return (
    <div className="layer">
      {!shop && <TopBar me={me} />}
      {!shop && !riding && (
        <div className="hud-left">
          {!clean && world?.event && town && !scene && <div className="event">{loc(world.event, 'text')}</div>}
          {!clean && announcement && <div className="announce">📣 {loc(announcement, 'text')}</div>}
          <SocialChips me={me} />
          {town && !scene && me.busy?.kind !== 'job' && <TownChips />}
          <Tips me={me} />
        </div>
      )}
      <Busy me={me} />
      {scene && scene.key === 'flight' && <FlightBar me={me} />}
      {!shop && !riding && <LocationPill me={me} scene={scene} />}
      {town && !riding && <HeadingBanner me={me} />}
      {!shop && (
        <div className="side">
          <button onClick={() => { Object.assign(view, { yaw: 0, pitch: 1.0, homeYaw: 0.75, homePitch: 0.95, homeDist: 30 }); sfx('click'); }} aria-label={L('Rudisha kamera', 'Reset camera')}>🧭</button>
          {town && <button onClick={() => useStore.setState({ chatOpen: !chatOpen })} className={chatOpen ? 'on' : ''} aria-label="Chat">💬</button>}
          <button onClick={() => (town ? setZoom(getZoom() * 0.8) : (view.homeDist = Math.max(14, view.homeDist * 0.8)))} aria-label="Zoom in">＋</button>
          <button onClick={() => (town ? setZoom(getZoom() * 1.25) : (view.homeDist = Math.min(48, view.homeDist * 1.25)))} aria-label="Zoom out">－</button>
        </div>
      )}
      {walking && (
        <button className={`drive-btn ${vehicle ? 'on' : ''}`} onClick={() => { sfx(vehicle ? 'click' : 'horn'); toggleVehicle(); }}>
          {vehicle ? <>🚶 {L('Shuka', 'Get out')}</> : anyVehicle ? <>{vehicleById[anyVehicle.model]?.emoji} {L('Endesha', 'Drive')}</> : <>🚗 {L('Nunua gari', 'Get a ride')}</>}
        </button>
      )}
      <RideBanner />
      {touch && walking && <Joystick />}
      {town && <ChatDock />}
      {!shop && <NeedsPanel me={me} />}
      {!shop && <BottomNav me={me} />}
      <Result />
    </div>
  );
}
