import { useState } from 'react';
import { FURNITURE, FURNITURE_CATS, HOME, furnitureById, footprint, homeFits, fmtTsh, fmtShort, NEEDS } from '@shared/world.js';
import { useStore } from '../store.js';
import { api } from '../api.js';
import { L, loc } from '../i18n.js';
import { sfx } from '../audio.js';
import { snapCenter, homeAvatar } from '../three/HomeScene.jsx';
import { view } from '../net.js';

const stars = (n) => '★'.repeat(n);
const ITEM_ICON = {
  mkeka: '🛏️', 'bed-single': '🛏️', 'bed-double': '🛏️', 'bed-king': '👑', 'chair-plastic': '🪑', armchair: '🪑', 'sofa-velvet': '🛋️', 'sofa-3': '🛋️', 'sofa-leather': '🛋️',
  jiko: '🔥', cooker: '🍳', fridge: '🧊', 'table-dining': '🍽️', ndoo: '🪣', shower: '🚿', toilet: '🚽', bathtub: '🛁',
  radio: '📻', speaker: '🔊', tv: '📺', laptop: '💻', plant: '🪴', lamp: '💡', rug: '🟫', art: '🖼️',
};
export const itemIcon = (id) => ITEM_ICON[id] || '📦';

async function refreshHome(r) {
  if (r?.items) useStore.setState({ homeItems: r.items });
  if (r?.me) useStore.setState({ me: r.me });
}

export async function loadHome() {
  try {
    const r = await api('/home');
    useStore.setState({ homeItems: r.items });
  } catch (e) {
    useStore.getState().toast(e.message, 'err');
  }
}

/** Buy mode: category chips + item cards. Picking one starts placement. */
function Catalogue() {
  const me = useStore((s) => s.me);
  const [cat, setCat] = useState('sleep');
  const [hidden, setHidden] = useState(false);
  const pick = (def) => {
    const [w, d] = footprint(def, 0);
    // Start near the middle, nudged to a free spot if possible.
    const items = useStore.getState().homeItems;
    let spot = { x: snapCenter(0, w, HOME.w / 2), z: snapCenter(0, d, HOME.d / 2) };
    outer: for (let r = 0; r < 6; r++)
      for (const [dx, dz] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r], [r, r], [-r, -r]]) {
        const x = snapCenter(dx, w, HOME.w / 2);
        const z = snapCenter(dz, d, HOME.d / 2);
        if (homeFits(def, x, z, 0, items)) { spot = { x, z }; break outer; }
      }
    sfx('pop');
    useStore.setState({ placing: { def, ...spot, rot: 0 } });
  };
  return (
    <div className="catalogue card">
      <div className="row between">
        <h3 style={{ margin: 0 }}>{L('Katalogi', 'Catalogue')}</h3>
        <button className="btn btn-ghost btn-xs" onClick={() => setHidden(!hidden)}>{hidden ? L('Onyesha', 'Show') : L('Ficha', 'Hide')}</button>
      </div>
      {!hidden && (
        <>
          <div className="cat-chips">
            {FURNITURE_CATS.map((c) => (
              <button key={c.id} className={`chip ${cat === c.id ? 'on-yellow' : ''}`} onClick={() => setCat(c.id)}>{c.icon} {loc(c)}</button>
            ))}
          </div>
          <div className="cat-grid">
            {FURNITURE.filter((f) => f.cat === cat).map((f) => (
              <button key={f.id} className="cat-card" onClick={() => pick(f)} disabled={me.money < f.price}>
                <div className="row between small muted"><span>{f.size[0]}×{f.size[1]}</span><span className="stars">{stars(f.stars)}</span></div>
                <div className="cat-ic" style={{ background: `${f.color}22` }}>{itemIcon(f.id)}</div>
                <div className="cat-name">{loc(f)}</div>
                <div className="cat-price">{f.price ? fmtTsh(f.price) : L('Bure', 'Free')}</div>
              </button>
            ))}
          </div>
        </>
      )}
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
  const fits = homeFits(def, placing.x, placing.z, placing.rot, others);
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
    useStore.setState({ placing: { ...placing, x: snapCenter(placing.x + dx, w, HOME.w / 2), z: snapCenter(placing.z + dz, d, HOME.d / 2) } });
  };
  const rotate = () => {
    const rot = (placing.rot + 1) % 4;
    const [w, d] = footprint(def, rot);
    useStore.setState({ placing: { ...placing, rot, x: snapCenter(placing.x, w, HOME.w / 2), z: snapCenter(placing.z, d, HOME.d / 2) } });
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
  const items = useStore((s) => s.homeItems);
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
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn btn-ghost grow" onClick={() => { close(); useStore.setState({ tab: 'shop', placing: { def, x: item.x, z: item.z, rot: item.rot, id: item.id } }); }}>✥ {L('Hamisha', 'Move')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function HomeUI() {
  const tab = useStore((s) => s.tab);
  const placing = useStore((s) => s.placing);
  const me = useStore((s) => s.me);
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
