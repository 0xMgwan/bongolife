import { useEffect, useState } from 'react';
import { placeById, fmtShort, fmtTsh, NEEDS, findJob } from '@shared/world.js';
import { useStore } from '../store.js';
import { local, remotes, sendChat, setInside } from '../net.js';
import { avatarEmoji } from '../three/Avatar.jsx';
import { placeDoor } from '../three/Players.jsx';
import { L, loc } from '../i18n.js';
import { sfx } from '../audio.js';
import { share } from './share.js';

const CASINO_GAMES = [['slots', '🎰', 'Slot machines', 'Slot machines'], ['blackjack', '🃏', 'Meza ya Blackjack', 'Blackjack table'], ['roulette', '🎡', 'Roulette', 'Roulette']];

/** The place you're in (entered, inside its scene, or doing something there), else null. */
export function placeHere(me, scene, inside) {
  const id = [scene?.placeId, inside, me.busy?.placeId].find((x) => x && placeById[x]);
  if (id) return id;
  // Standing outside (even at the door) isn't "in" the place — the location pill covers that.
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
  const isIn = useStore.getState().inside === placeId;
  const canEnter = !isIn && near;
  const busyLabel = me.busy && me.busy.placeId === placeId && me.busy.endsAt > Date.now() ? `${me.busy.emoji} ${loc(me.busy, 'label')}` : null;
  if (min) {
    return (
      <div className="loc-pill">
        <button className="lp-name" onClick={() => setMin(false)}>{p.icon} {loc(p)} <span style={{ fontSize: 12 }}>˄</span></button>
      </div>
    );
  }
  const cats = dockCategories(placeId, p, me, near, { start, game });
  const openCat = cats.find((c) => c.key === open);
  return (
    <div className="place-dock">
      <div className="pd-row">
        <button className="pd-me" onClick={() => useStore.getState().openPhone('kabati')}>{avatarEmoji(me.appearance)}</button>
        <button className="pd-name" onClick={() => useStore.setState({ sheet: { type: 'place', id: placeId } })}>
          <b>{p.icon} {loc(p)}</b>
          <small>{busyLabel || `👥 ${here} ${L('hapa', 'here')} · ${p.district}`}</small>
        </button>
        <span className="pd-money">💵 {fmtShort(me.money)}</span>
        {isIn && <button className="pd-btn pd-exit" aria-label={L('Toka nje', 'Leave')} onClick={() => { sfx('close'); setInside(null); }}>🚪</button>}
        <button className="pd-btn" aria-label={L('Shiriki', 'Share')} onClick={() => share({ title: loc(p), text: L(`Tukutane ${p.name} kwenye Bongo Life! 🇹🇿`, `Meet me at ${loc(p)} in Bongo Life! 🇹🇿`), params: { place: placeId } })}>🔗</button>
        <button className="pd-btn" aria-label={L('Ramani', 'Map')} onClick={onMap}>🗺️</button>
        <button className="pd-btn" aria-label={L('Nyumbani', 'Home')} onClick={onHome}>🏠</button>
        <button className="pd-btn" aria-label={L('Punguza', 'Minimise')} onClick={() => setMin(true)}>⌄</button>
      </div>
      <form className="pd-chat" onSubmit={send}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={L(`Sema kitu kwa watu ${here} walioko hapa…`, `Say something to the ${here} players here…`)} maxLength={200} enterKeyHint="send" />
        <button className="pd-send" disabled={!text.trim()} aria-label={L('Tuma', 'Send')}>➤</button>
      </form>
      {(cats.length > 0 || canEnter) && (
        <div className="pd-chips">
          {cats.length > 0 && <button className={`pd-up ${openCat ? 'on' : ''}`} onClick={() => setOpen(openCat ? false : cats[0].key)} aria-label={L('Zaidi', 'More')}>{openCat ? '⌄' : '˄'}</button>}
          {cats.map((c) => (
            <button key={c.key} className={open === c.key ? 'sel' : ''} onClick={() => { sfx('click'); setOpen(open === c.key ? false : c.key); }}>
              <span>{c.emoji}</span>{c.name}
            </button>
          ))}
          {canEnter && <button onClick={() => setInside(placeId)}><span>🚪</span>{L('Ingia ndani', 'Go inside')}</button>}
        </div>
      )}
      {openCat && (
        <div className="pd-cards">
          {openCat.items.map((it) => (
            <button key={it.key} className="pd-card" disabled={it.disabled} onClick={it.go}>
              <div className="pc-top">
                <span className="pc-em">{it.emoji}</span>
                <span className="pc-rt">
                  {it.time && <span className="pc-time">⏱ {it.time}</span>}
                  <b className="pc-price">{it.price}</b>
                </span>
              </div>
              <span className="pc-name">{it.name}</span>
              <div className="pc-tags">{it.tags.map(([t, c]) => <i key={t} className={`tg-${c}`}>{t}</i>)}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
void findJob;

const DRINK_E = /🍺|🍻|🍸|🍷|🥂|🍹|🥃|🍾|☕|🧃|🥤|🧋|🍶|🫖|🥥/u;
const DRINK_W = /\b(bia|beer|drinks?|cocktails?|kinywaji|vinywaji|wine|whisk(e)?y|chai|kahawa|coffee|juice|shots?|malt|champagne|bottle|chupa|madafu|tea)\b/i;
const FOOD_E = /🍖|🍗|🍟|🍕|🍔|🍽|🍤|🍛|🍲|🥘|🍚|🌮|🥗|🍜|🍢|🍳|🥪|🍦|🍰|🥩|🐟|🦞|🍝|🥙|🍩|🧁|🥐|🌽|🍌|🥭|🦐|🍱|🍣/u;
const FOOD_W = /\b(chakula|food|eat|kula|chips|chipsi|nyama|pilau|buffet|lunch|dinner|breakfast|brunch|mishkaki|samaki|biryani|ugali|pizza|burger|seafood|grill)\b/i;
const NEED_EN = { hunger: 'Food', energy: 'Energy', fun: 'Fun', hygiene: 'Clean', social: 'Social' };
const NEED_SW = { hunger: 'Shibe', energy: 'Nguvu', fun: 'Raha', hygiene: 'Usafi', social: 'Jamii' };
const TAG_C = { hunger: 'food', energy: 'energy', fun: 'fun', hygiene: 'clean', social: 'social' };

function kindOf(a) {
  const name = `${a.name} ${loc(a)}`;
  if (DRINK_E.test(a.emoji) || DRINK_W.test(name)) return 'drinks';
  if (FOOD_E.test(a.emoji) || FOOD_W.test(name)) return 'food';
  return 'do';
}

/** Lagos-style categories for a place (drinks / food / things to do / games / work), each with item cards. */
function dockCategories(placeId, p, me, near, { start, game }) {
  const busy = !!me.busy;
  const actCard = (a) => ({
    key: a.id,
    emoji: a.emoji,
    name: loc(a),
    price: a.cost ? fmtTsh(a.cost) : L('Bure', 'Free'),
    time: a.secs >= 120 ? `${Math.round(a.secs / 60)}m` : `${a.secs}s`,
    tags: [
      ...Object.entries(a.effects || {}).filter(([, v]) => v > 0).sort((x, y) => y[1] - x[1]).slice(0, 3).map(([k]) => [`+${L(NEED_SW[k], NEED_EN[k])}`, TAG_C[k]]),
      ...(a.fame ? [[`⭐ +${a.fame}`, 'fame']] : []),
    ],
    disabled: near && (busy || me.money < (a.cost || 0)),
    go: () => start('activity', a.id),
  });
  const groups = { drinks: [], food: [], do: [] };
  for (const a of p.activities || []) groups[kindOf(a)].push(actCard(a));
  const cats = [];
  if (placeId === 'casino') {
    cats.push({
      key: 'games', emoji: '🎰', name: L('Michezo', 'Games'),
      items: CASINO_GAMES.map(([g, e, sw, en]) => ({ key: g, emoji: e, name: L(sw, en), price: 'TSh 1K – 500K', time: null, tags: [[L('Pesa ya mchezo', 'Game money'), 'fun'], ['18+', 'fame']], disabled: false, go: () => game(g) })),
    });
  }
  if (groups.do.length) cats.push({ key: 'do', emoji: p.icon, name: L('Mambo ya kufanya', 'Things to do'), items: groups.do });
  if (groups.drinks.length) cats.push({ key: 'drinks', emoji: '🍹', name: L('Vinywaji', 'Drinks'), items: groups.drinks });
  if (groups.food.length) cats.push({ key: 'food', emoji: '🍽️', name: L('Chakula', 'Food'), items: groups.food });
  if (p.jobs?.length) {
    cats.push({
      key: 'work', emoji: '💼', name: L('Kazi', 'Work'),
      items: p.jobs.map((j) => ({ key: j.id, emoji: j.emoji || '💼', name: loc(j, 'title'), price: `~${fmtTsh(j.pay)}`, time: `${Math.round(j.secs / 60)}m`, tags: [[L('Mshahara', 'Pay'), 'social']], disabled: near && busy, go: () => start('job', j.id) })),
    });
  }
  return cats;
}
