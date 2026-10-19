import { useEffect, useState } from 'react';
import { furnitureThumb, cachedThumb } from '../three/thumbs.jsx';
import { FURNITURE, FURNITURE_CATS, HOME, furnitureById, footprint, homeFits, fmtTsh, fmtShort, NEEDS, homeBounds, HOME_LEVELS, HOME_WALLS, HOME_FLOORS, HOME_STYLE_PRICE, HOME_FEATURES } from '@shared/world.js';
import { ask } from './Confirm.jsx';
import { useStore } from '../store.js';
import { api } from '../api.js';
import { L, loc } from '../i18n.js';
import { sfx } from '../audio.js';
import { snapIn, homeAvatar } from '../three/HomeScene.jsx';
import { view } from '../net.js';

const stars = (n) => '★'.repeat(n);
const ITEM_ICON = {
  mkeka: '🛏️', 'bed-single': '🛏️', 'bed-double': '🛏️', 'bed-king': '👑', 'chair-plastic': '🪑', armchair: '🪑', 'sofa-velvet': '🛋️', 'sofa-3': '🛋️', 'sofa-leather': '🛋️',
  jiko: '🔥', cooker: '🍳', fridge: '🧊', 'table-dining': '🍽️', ndoo: '🪣', shower: '🚿', toilet: '🚽', bathtub: '🛁',
  radio: '📻', speaker: '🔊', tv: '📺', laptop: '💻', plant: '🪴', lamp: '💡', rug: '🟫', art: '🖼️',
  beanbag: '🫘', 'egg-chair': '🥚', machela: '🏝️', coffee: '☕', blender: '🥤', counter: '🍽️', sink: '🚰', jacuzzi: '🛁',
  'tv-65': '📺', ps5: '🎮', arcade: '🕹️', snooker: '🎱', foosball: '⚽', 'dj-decks': '🎧', karaoke: '🎤',
  guitar: '🎸', keyboard: '🎹', bookshelf: '📚', bao: '♟️', easel: '🎨', weights: '🏋️', treadmill: '🏃',
  kandili: '🏮', fairy: '✨', 'rgb-lamp': '🌈', neon: '🔆', chandelier: '💎', aquarium: '🐠', mirror: '🪞', vase: '💐',
  clock: '🕰️', shield: '🛡️', 'zanzibar-door': '🚪', dog: '🐶', cat: '🐱', parrot: '🦜',
};
export const itemIcon = (id) => ITEM_ICON[id] || '📦';

async function refreshHome(r) {
  if (r?.items) useStore.setState({ homeItems: r.items });
  if (r?.me) useStore.setState({ me: r.me });
}

/** Go into Kwangu ('main') or one of your houses on a plot — each is its own home to furnish. */
export async function switchHome(key = 'main') {
  const st = useStore.getState();
  const r = await st.run('/home/switch', { method: 'POST', body: { home: key } });
  if (!r) return;
  useStore.setState({ me: r.me, homeItems: r.items, tab: 'home', visiting: null, sheet: null, phone: null, homePick: false, placing: null, cityView: 'follow' });
}

export async function loadHome() {
  try {
    const r = await api('/home');
    useStore.setState({ homeItems: r.items });
  } catch (e) {
    useStore.getState().toast(e.message, 'err');
  }
}

/** 3D render of the item (falls back to its emoji while rendering or if WebGL is unavailable). */
export function Thumb({ def, size = 64 }) {
  const [url, setUrl] = useState(() => cachedThumb(`f:${def.id}`));
  useEffect(() => {
    let live = true;
    if (!url) furnitureThumb(def).then((u) => live && setUrl(u)).catch(() => {});
    return () => { live = false; };
  }, [def, url]);
  return url ? <img src={url} alt="" width={size} height={size} style={{ objectFit: 'contain' }} /> : <span>{itemIcon(def.id)}</span>;
}

/** Buy mode: category chips + item cards. Picking one starts placement. */
function Catalogue() {
  const me = useStore((s) => s.me);
  const [cat, setCat] = useState(() => useStore.getState().catTab || 'sleep');
  useEffect(() => { useStore.setState({ catTab: null }); }, []);
  const b = homeBounds(me.homeLevel, me.homeFeatures);
  const cx = Math.round((b.x1 + b.x2) / 2);
  const cz = Math.round((b.z1 + b.z2) / 2);
  const [hidden, setHidden] = useState(false);
  const pick = (def) => {
    const [w, d] = footprint(def, 0);
    // Start near the middle, nudged to a free spot if possible.
    const items = useStore.getState().homeItems;
    let spot = { x: snapIn(cx, w, b.x1, b.x2), z: snapIn(cz, d, b.z1, b.z2) };
    outer: for (let r = 0; r < 9; r++)
      for (const [dx, dz] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r], [r, r], [-r, -r], [r, -r], [-r, r]]) {
        const x = snapIn(cx + dx, w, b.x1, b.x2);
        const z = snapIn(cz + dz, d, b.z1, b.z2);
        if (homeFits(def, x, z, 0, items, b)) { spot = { x, z }; break outer; }
      }
    sfx('pop');
    useStore.setState({ placing: { def, ...spot, rot: 0 } });
  };
  // Hidden: a floating button brings it back. Shown: a card popping up in the middle of the room.
  if (hidden) {
    return (
      <button className="cat-fab" onClick={() => setHidden(false)}>🛍️ {L('Katalogi', 'Catalogue')}</button>
    );
  }
  return (
    <>
      <div className="cat-backdrop" onClick={() => setHidden(true)} />
      <div className="catalogue card" role="dialog" aria-label={L('Katalogi', 'Catalogue')}>
        <div className="row between">
          <h3 style={{ margin: 0 }}>🛍️ {L('Katalogi', 'Catalogue')}</h3>
          <button className="cat-x" onClick={() => setHidden(true)} aria-label={L('Ficha', 'Hide')}>✕</button>
        </div>
        <div className="cat-chips">
          <button className={`chip ${cat === 'upgrade' ? 'on-yellow' : ''}`} onClick={() => setCat('upgrade')}>🏗️ {L('Boresha nyumba', 'Upgrade home')}</button>
          {FURNITURE_CATS.map((c) => (
            <button key={c.id} className={`chip ${cat === c.id ? 'on-yellow' : ''}`} onClick={() => setCat(c.id)}>{c.icon} {loc(c)}</button>
          ))}
        </div>
        {cat === 'upgrade' ? <HomeUpgrade /> : <div className="cat-grid" key={cat}>
          {/* Just the item floating, its price and a Select button; the name is for screen readers. */}
          {FURNITURE.filter((f) => f.cat === cat).map((f, i) => {
            const broke = me.money < f.price;
            return (
              <div key={f.id} className={`cat-item ${broke ? 'broke' : ''}`} style={{ '--i': Math.min(i, 9) }}>
                <button className="cat-ic" onClick={() => pick(f)} disabled={broke} aria-label={loc(f)} title={loc(f)}><Thumb def={f} size={84} /></button>
                <div className="cat-price">{f.price ? fmtTsh(f.price) : L('Bure', 'Free')}</div>
                <button className="cat-pick" onClick={() => pick(f)} disabled={broke}>{broke ? L('Pesa haitoshi', 'Not enough') : L('Chagua', 'Select')}</button>
              </div>
            );
          })}
        </div>}
      </div>
    </>
  );
}

/** Bigger home levels, wall paint and floors. */
function HomeUpgrade() {
  const me = useStore((s) => s.me);
  const run = useStore((s) => s.run);
  const level = me.homeLevel || 0;
  const style = me.homeStyle || {};
  const next = HOME_LEVELS[level + 1];
  const cur = HOME_LEVELS[level];
  const sz = (lv) => { const b = homeBounds(lv); return `${b.x2 - b.x1}×${b.z2 - b.z1}m`; };
  const up = async () => {
    if (!(await ask({ icon: next.emoji, title: L(`Hamia ${next.name}?`, `Move up to a ${next.nameEn}?`), text: L(`${fmtTsh(next.price)} · ${sz(next.level)} · vitu vyako vinabaki pale pale.`, `${fmtTsh(next.price)} · ${sz(next.level)} · your furniture stays where it is.`), ok: L('Boresha', 'Upgrade') }))) return;
    const r = await run('/home/upgrade', { method: 'POST', body: { level: next.level } });
    if (r) { sfx('levelup'); useStore.getState().toast(L(`${next.emoji} Karibu ${next.name}! Nafasi zaidi ya kupamba.`, `${next.emoji} Welcome to your ${next.nameEn}! More room to decorate.`)); }
  };
  const build = async (f) => {
    if (!(await ask({ icon: f.emoji, title: L(`Jenga ${f.name}?`, `Build a ${f.nameEn}?`), text: fmtTsh(f.price), ok: L('Jenga', 'Build') }))) return;
    const r = await run('/home/feature', { method: 'POST', body: { id: f.id } });
    if (r) { sfx('levelup'); useStore.getState().toast(L(`${f.emoji} ${f.name} imekamilika! Gusa alama zinazong'aa kuitumia.`, `${f.emoji} Your ${f.nameEn} is ready! Tap the glowing spots to use it.`)); }
  };
  const restyle = async (body) => {
    const r = await run('/home/style', { method: 'POST', body });
    if (r) sfx('cash');
  };
  return (
    <div className="home-up">
      <div className="hu-cur">
        <b>{cur.emoji} {L(cur.name, cur.nameEn)} · {sz(level)}</b>
        <small>{cur.comfort ? L(`Kupumzika nyumbani kunaleta +${Math.round(cur.comfort * 100)}%`, `Resting at home gives +${Math.round(cur.comfort * 100)}%`) : L('Nyumba ya kuanzia', 'Your starter home')}</small>
      </div>
      {HOME_LEVELS.slice(1).map((lv) => (
        <div key={lv.level} className={`hu-lv ${lv.level <= level ? 'done' : lv.level === level + 1 ? 'next' : ''}`}>
          <span>{lv.emoji}</span>
          <div className="grow">
            <b>{L(lv.name, lv.nameEn)} · {sz(lv.level)}</b>
            <small>+{Math.round(lv.comfort * 100)}% {L('kupumzika', 'rest')}{lv.room ? L(' · chumba cha ziada', ' · extra bedroom') : ''}</small>
          </div>
          {lv.level <= level ? <b className="green">✓</b> : lv.level === level + 1
            ? <button className="btn btn-green btn-sm" disabled={me.money < lv.price} onClick={up}>{fmtShort(lv.price)}</button>
            : <small className="muted">{fmtShort(lv.price)}</small>}
        </div>
      ))}
      <div className="hu-t">🔨 {L('Jenga kimoja kimoja', 'Build add-ons')}</div>
      {HOME_FEATURES.map((f) => {
        const built = (me.homeFeatures || []).includes(f.id);
        const locked = f.requires && !(me.homeFeatures || []).includes(f.requires);
        return (
          <div key={f.id} className={`hu-lv ${built ? 'done' : ''}`}>
            <span>{f.emoji}</span>
            <div className="grow">
              <b>{L(f.name, f.nameEn)}</b>
              <small>{f.acts.map((a) => `${a.emoji} ${L(a.name[0], a.name[1])}`).join(' · ')}</small>
            </div>
            {built ? <b className="green">✓</b> : locked ? <small className="muted">🔒 {L('Ghorofa kwanza', 'Storey first')}</small>
              : <button className="btn btn-green btn-sm" disabled={me.money < f.price} onClick={() => build(f)}>{fmtShort(f.price)}</button>}
          </div>
        );
      })}
      <div className="hu-t">🎨 {L('Rangi ya kuta', 'Wall colour')} · {fmtShort(HOME_STYLE_PRICE.wall)}</div>
      <div className="hu-sw">
        {HOME_WALLS.map((c) => <button key={c} className={(style.wall || HOME_WALLS[0]) === c ? 'on' : ''} style={{ background: c }} disabled={me.money < HOME_STYLE_PRICE.wall} onClick={() => restyle({ wall: c })} aria-label={c} />)}
      </div>
      <div className="hu-t">🧱 {L('Sakafu', 'Floor')} · {fmtShort(HOME_STYLE_PRICE.floor)}</div>
      <div className="hu-fl">
        {HOME_FLOORS.map((f) => <button key={f.id} className={(style.floor || 'tile') === f.id ? 'on' : ''} disabled={me.money < HOME_STYLE_PRICE.floor} onClick={() => restyle({ floor: f.id })}><i style={{ background: `linear-gradient(135deg, ${f.a} 50%, ${f.b} 50%)` }} />{L(f.name, f.nameEn)}</button>)}
      </div>
    </div>
  );
}

/** Placement controls: arrows nudge one cell, ⟳ rotates, Place buys/moves. */
function PlacePanel() {
  const placing = useStore((s) => s.placing);
  const items = useStore((s) => s.homeItems);
  const me = useStore((s) => s.me);
  const [busy, setBusy] = useState(false);
  const { def } = placing;
  const others = items.filter((i) => i.id !== placing.id);
  const b = homeBounds(me.homeLevel, me.homeFeatures);
  const fits = homeFits(def, placing.x, placing.z, placing.rot, others, b);
  // Arrows are screen-relative: pick the grid axis closest to that screen direction.
  const nudgeScreen = (sx, sy) => {
    const yaw = view.homeYaw;
    const wx = Math.cos(yaw) * sx - Math.sin(yaw) * sy;
    const wz = -Math.sin(yaw) * sx - Math.cos(yaw) * sy;
    if (Math.abs(wx) > Math.abs(wz)) nudge(Math.sign(wx), 0);
    else nudge(0, Math.sign(wz));
  };
  const nudge = (dx, dz) => {
    const [w, d] = footprint(def, placing.rot);
    useStore.setState({ placing: { ...placing, x: snapIn(placing.x + dx, w, b.x1, b.x2), z: snapIn(placing.z + dz, d, b.z1, b.z2) } });
  };
  const rotate = () => {
    const rot = (placing.rot + 1) % 4;
    const [w, d] = footprint(def, rot);
    useStore.setState({ placing: { ...placing, rot, x: snapIn(placing.x, w, b.x1, b.x2), z: snapIn(placing.z, d, b.z1, b.z2) } });
  };
  const place = async () => {
    setBusy(true);
    const body = { x: placing.x, z: placing.z, rot: placing.rot };
    const r = placing.id
      ? await useStore.getState().run(`/home/items/${placing.id}`, { method: 'PATCH', body })
      : await useStore.getState().run('/home/items', { method: 'POST', body: { item: def.id, ...body } });
    setBusy(false);
    if (!r) return;
    await refreshHome(r);
    sfx(placing.id ? 'pop' : 'cash');
    useStore.setState({ placing: null });
  };
  const sell = async () => {
    const r = await useStore.getState().run(`/home/items/${placing.id}`, { method: 'DELETE' });
    if (!r) return;
    await refreshHome(r);
    if (r.refund) useStore.getState().toast(L(`Umeuza kwa ${fmtTsh(r.refund)}`, `Sold for ${fmtTsh(r.refund)}`));
    useStore.setState({ placing: null });
  };
  return (
    <div className="place-panel card">
      <div className="row between">
        <div>
          <b>{loc(def)}</b>
          <div className="small muted">{L('Buruta, gusa sakafu au tumia mishale', 'Drag it, tap the floor or use the arrows')}</div>
        </div>
        <b className="green">{placing.id ? L('Hamisha', 'Move') : fmtTsh(def.price)}</b>
      </div>
      <div className="row" style={{ marginTop: 10, alignItems: 'stretch' }}>
        <div className="arrows">
          <button onClick={() => nudgeScreen(-1, 1)} aria-label="up-left">↖</button>
          <button onClick={() => nudgeScreen(1, 1)} aria-label="up-right">↗</button>
          <button className="rot" onClick={rotate} aria-label={L('Zungusha', 'Rotate')}>⟳</button>
          <button onClick={() => nudgeScreen(-1, -1)} aria-label="down-left">↙</button>
          <button onClick={() => nudgeScreen(1, -1)} aria-label="down-right">↘</button>
        </div>
        <div className="grow" style={{ display: 'grid', gap: 8 }}>
          <button className="btn btn-green" disabled={!fits || busy || (!placing.id && me.money < def.price)} onClick={place}>
            ✓ {fits ? (placing.id ? L('Weka hapa', 'Put here') : L('Nunua & weka', 'Buy & place')) : L('Haitoshi hapa', "Doesn't fit")}
          </button>
          <div className="row" style={{ gap: 8 }}>
            {placing.id && <button className="btn btn-ghost grow" onClick={sell}>{L('Uza', 'Sell')} +{fmtShort(Math.floor(def.price * HOME.sellBack))}</button>}
            <button className="btn btn-white grow" onClick={() => useStore.setState({ placing: null })}>✕ {L('Ghairi', 'Cancel')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Tapping furniture at home: use it, move it or sell it. */
function ItemSheet() {
  const id = useStore((s) => s.homeSel);
  const own = useStore((s) => s.homeItems);
  const visiting = useStore((s) => s.visiting);
  const items = visiting ? visiting.items : own;
  const me = useStore((s) => s.me);
  const item = items.find((i) => i.id === id);
  const def = item && furnitureById[item.item];
  if (!def) return null;
  const close = () => useStore.setState({ homeSel: null });
  const use = async () => {
    // Walk over first, then start.
    homeAvatar.target = [item.x, item.z + 0.8];
    close();
    const r = await useStore.getState().run(`/home/items/${item.id}/use`, { method: 'POST' });
    if (r) sfx(def.cat === 'bath' ? 'splash' : 'pop');
  };
  const map = Object.fromEntries(NEEDS.map((n) => [n.id, n]));
  return (
    <div className="sheet-wrap" onClick={close}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <div className="grab" />
          <h2>{itemIcon(def.id)} {loc(def)}</h2>
          <div className="small muted"><span className="stars">{stars(def.stars)}</span> · {def.size[0]}×{def.size[1]}</div>
          <button className="x" onClick={close} aria-label={L('Funga', 'Close')}>✕</button>
        </div>
        <div className="sheet-body">
          {def.use ? (
            <div className="item">
              <span className="em">{def.use.emoji}</span>
              <div className="grow">
                <div className="t">{loc(def.use)}</div>
                <div className="s">{def.use.cost ? fmtTsh(def.use.cost) : L('Bure', 'Free')} · {def.use.secs}s</div>
                <div className="fx">{Object.entries(def.use.effects).map(([k, v]) => <span key={k} className={v > 0 ? 'up' : 'dn'}>{map[k]?.icon} {v > 0 ? '+' : ''}{v}</span>)}</div>
              </div>
              <button className="btn btn-green btn-sm" disabled={!!me.busy} onClick={use}>{L('Fanya', 'Do')}</button>
            </div>
          ) : (
            <div className="box small muted" style={{ background: 'var(--chip)' }}>{L('Pambo tu — linapendezesha nyumba yako.', 'Decoration — it makes your home look great.')}</div>
          )}
          {!visiting && <div className="row" style={{ marginTop: 10 }}>
            <button className="btn btn-ghost grow" onClick={() => { close(); useStore.setState({ tab: 'shop', placing: { def, x: item.x, z: item.z, rot: item.rot, id: item.id } }); }}>✥ {L('Hamisha', 'Move')}</button>
          </div>}
        </div>
      </div>
    </div>
  );
}

export function HomeUI() {
  const tab = useStore((s) => s.tab);
  const placing = useStore((s) => s.placing);
  const me = useStore((s) => s.me);
  const visiting = useStore((s) => s.visiting);
  if (tab !== 'home' && tab !== 'shop') return null;
  return (
    <>

      {tab === 'shop' && (
        <div className="buy-top">
          <span className="pill">🛋️ {L('Duka · Panga nyumba', 'Buy mode')}</span>
          <span className="pill bold">TSh {fmtShort(me.money)}</span>
          <button className="round" onClick={() => useStore.setState({ tab: 'home', placing: null })} aria-label={L('Funga', 'Close')}>✕</button>
        </div>
      )}
      {tab === 'shop' && (placing ? <PlacePanel /> : <Catalogue />)}
      <ItemSheet />
    </>
  );
}
