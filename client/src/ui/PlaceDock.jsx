import { useEffect, useState } from 'react';
import { placeById, fmtShort, fmtTsh, NEEDS, ENTERABLE, findJob } from '@shared/world.js';
import { useStore } from '../store.js';
import { local, remotes, sendChat, setInside } from '../net.js';
import { avatarEmoji } from '../three/Avatar.jsx';
import { placeDoor } from '../three/Players.jsx';
import { L, loc } from '../i18n.js';
import { sfx } from '../audio.js';
import { share } from './share.js';

const CASINO_GAMES = [['slots', '🎰', 'Slot machines', 'Slot machines'], ['blackjack', '🃏', 'Meza ya Blackjack', 'Blackjack table'], ['roulette', '🎡', 'Roulette', 'Roulette']];

/** The place you're at (inside, doing something there, or standing at its door), else null. */
export function placeHere(me, scene, inside) {
  const id = [scene?.placeId, inside, me.busy?.placeId].find((x) => x && placeById[x]);
  if (id) return id;
  for (const p of Object.values(placeById)) {
    const dx = Math.max(Math.abs(local.x - p.pos[0]) - p.size[0] / 2, 0);
    const dz = Math.max(Math.abs(local.z - p.pos[1]) - p.size[1] / 2, 0);
    if (Math.hypot(dx, dz) < 9) return p.id;
  }
  return null;
}

/** Lagos-style dock for the place you're at: who's here, chat, share/map/home, and what to do. */
export function PlaceDock({ me, placeId, onHome, onMap }) {
  const run = useStore((s) => s.run);
  const roster = useStore((s) => s.roster);
  const [open, setOpen] = useState(false); // full list of things to do
  const [min, setMin] = useState(false);
  const [text, setText] = useState('');
  useEffect(() => { setOpen(false); }, [placeId]);
  void roster;
  const p = placeById[placeId];
  const here = 1 + [...remotes.values()].filter((r) => r.inside === placeId || r.busy?.placeId === placeId || (!r.inside && Math.hypot(r.tx - p.pos[0], r.tz - p.pos[1]) < Math.max(...p.size))).length;
  const near = (() => {
    const d = placeDoor(placeId);
    return Math.hypot(d[0] - local.x, d[1] - local.z) < 20 || useStore.getState().inside === placeId;
  })();
  const map = Object.fromEntries(NEEDS.map((n) => [n.id, n]));
  const start = async (kind, id) => {
    if (!near) return useStore.setState({ sheet: { type: 'travel', id: placeId } });
    const r = await run('/act/start', { method: 'POST', body: { kind, placeId, id } });
    if (r) { sfx('pop'); setOpen(false); }
  };
  const game = (g) => { sfx('open'); useStore.setState({ casino: g }); };
  const send = (e) => {
    e.preventDefault();
    const t = text.trim();
    if (t) { sendChat(t); sfx('pop'); }
    setText('');
  };
  const busyLabel = me.busy && me.busy.placeId === placeId && me.busy.endsAt > Date.now() ? `${me.busy.emoji} ${loc(me.busy, 'label')}` : null;
  if (min) {
    return (
      <div className="loc-pill">
        <button className="lp-name" onClick={() => setMin(false)}>{p.icon} {loc(p)} <span style={{ fontSize: 12 }}>˄</span></button>
      </div>
    );
  }
  const chips = [
    ...(placeId === 'casino' ? CASINO_GAMES.map(([g, e, sw, en]) => ({ key: g, emoji: e, name: L(sw, en), go: () => game(g) })) : []),
    ...(p.activities || []).map((a) => ({ key: a.id, emoji: a.emoji, name: loc(a), go: () => start('activity', a.id) })),
  ];
  return (
    <div className="place-dock">
      <div className="pd-row">
        <button className="pd-me" onClick={() => useStore.getState().openPhone('kabati')}>{avatarEmoji(me.appearance)}</button>
        <button className="pd-name" onClick={() => useStore.setState({ sheet: { type: 'place', id: placeId } })}>
          <b>{p.icon} {loc(p)}</b>
          <small>{busyLabel || `👥 ${here} ${L('hapa', 'here')} · ${p.district}`}</small>
        </button>
        <span className="pd-money">💵 {fmtShort(me.money)}</span>
        <button className="pd-btn" aria-label={L('Shiriki', 'Share')} onClick={() => share({ title: loc(p), text: L(`Tukutane ${p.name} kwenye Bongo Life! 🇹🇿`, `Meet me at ${loc(p)} in Bongo Life! 🇹🇿`), params: { place: placeId } })}>🔗</button>
        <button className="pd-btn" aria-label={L('Ramani', 'Map')} onClick={onMap}>🗺️</button>
        <button className="pd-btn" aria-label={L('Nyumbani', 'Home')} onClick={onHome}>🏠</button>
        <button className="pd-btn" aria-label={L('Punguza', 'Minimise')} onClick={() => setMin(true)}>⌄</button>
      </div>
      <form className="pd-chat" onSubmit={send}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={L(`Sema kitu kwa watu ${here} walioko hapa…`, `Say something to the ${here} players here…`)} maxLength={200} enterKeyHint="send" />
        <button className="pd-send" disabled={!text.trim()} aria-label={L('Tuma', 'Send')}>➤</button>
      </form>
      {(chips.length > 0 || p.jobs?.length > 0) && (
        <div className="pd-chips">
          <button className={`pd-up ${open ? 'on' : ''}`} onClick={() => setOpen(!open)} aria-label={L('Zaidi', 'More')}>{open ? '⌄' : '˄'}</button>
          {chips.map((c) => <button key={c.key} onClick={c.go}><span>{c.emoji}</span>{c.name}</button>)}
          {ENTERABLE[placeId] && useStore.getState().inside !== placeId && near && <button onClick={() => setInside(placeId)}><span>🚪</span>{L('Ingia ndani', 'Go inside')}</button>}
        </div>
      )}
      {open && (
        <div className="pd-list">
          {placeId === 'casino' && CASINO_GAMES.map(([g, e, sw, en]) => (
            <button key={g} className="pd-item" onClick={() => game(g)}>
              <span className="em">{e}</span>
              <span className="grow"><b>{L(sw, en)}</b><small>{L('Dau TSh 1,000 – 500,000 · pesa ya mchezo tu', 'Bets TSh 1,000 – 500,000 · game money only')}</small></span>
              <span className="go">{L('Cheza', 'Play')}</span>
            </button>
          ))}
          {(p.activities || []).map((a) => (
            <button key={a.id} className="pd-item" disabled={!!me.busy || me.money < a.cost} onClick={() => start('activity', a.id)}>
              <span className="em">{a.emoji}</span>
              <span className="grow">
                <b>{loc(a)}</b>
                <small>{a.cost ? fmtTsh(a.cost) : L('Bure', 'Free')} · {a.secs}s · {Object.entries(a.effects).map(([k, v]) => `${map[k]?.icon || ''}${v > 0 ? '+' : ''}${v}`).join(' ')}{a.fame ? ` ⭐+${a.fame}` : ''}</small>
              </span>
              <span className="go">{near ? L('Fanya', 'Do') : L('Nenda', 'Go')}</span>
            </button>
          ))}
          {(p.jobs || []).map((j) => (
            <button key={j.id} className="pd-item" disabled={!!me.busy} onClick={() => start('job', j.id)}>
              <span className="em">💼</span>
              <span className="grow"><b>{loc(j, 'title')}</b><small>~{fmtTsh(j.pay)} · {Math.round(j.secs / 60)} min</small></span>
              <span className="go">{L('Kazi', 'Work')}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
void findJob;
