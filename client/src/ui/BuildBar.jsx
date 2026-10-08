import { useState } from 'react';
import { YARD, YARD_BLOCKS, fmtShort, fmtTsh } from '@shared/world.js';
import { useStore } from '../store.js';
import { api } from '../api.js';
import { L, loc } from '../i18n.js';
import { sfx } from '../audio.js';

/** Go home and switch on build mode (camera glides to the yard). */
export function startBuild() {
  useStore.setState({ tab: 'home', visiting: null, phone: null, sheet: null, placing: null, building: { kind: 'brick', erase: false } });
}

/** Build mode: the block palette, remove toggle, shop settings, Done. Floats over the game. */
export function BuildBar() {
  const build = useStore((s) => s.building);
  const yard = useStore((s) => s.yard);
  const me = useStore((s) => s.me);
  const [shop, setShop] = useState(false);
  const [name, setName] = useState('');
  if (!build || !me) return null;
  const set = (patch) => useStore.setState({ building: { ...build, ...patch } });
  const count = yard?.blocks?.length || 0;
  const saveShop = async (open) => {
    try {
      const r = await api('/yard/meta', { method: 'POST', body: { name: name || yard?.name || '', open } });
      useStore.setState({ yard: { ...yard, ...r } });
      sfx(open ? 'cash' : 'click');
      useStore.getState().toast(open ? L(`🛍️ ${r.name} iko wazi! Alika watu waje.`, `🛍️ ${r.name} is open! Invite people over.`) : L('Duka limefungwa.', 'Closed for now.'));
      setShop(false);
    } catch (e) {
      useStore.getState().toast(e.message, 'err');
    }
  };
  return (
    <div className="build-bar">
      <div className="bb-head">
        <b>🔨 {L('Jenga', 'Build')}</b>
        <span>{count}/{YARD.maxBlocks} · TSh {fmtShort(me.money)}</span>
        <button className={`bb-tool ${build.erase ? 'on' : ''}`} onClick={() => set({ erase: !build.erase })} aria-pressed={build.erase}>🧹 {L('Ondoa', 'Remove')}</button>
        <button className="bb-tool" onClick={() => { setName(yard?.name || ''); setShop(!shop); }}>🛍️ {yard?.open ? L('Wazi', 'Open') : L('Duka', 'Shop')}</button>
        <button className="bb-done" onClick={() => useStore.setState({ building: null })}>{L('Maliza', 'Done')}</button>
      </div>
      {shop ? (
        <div className="bb-shop">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={L('Jina la biashara (mf. Duka la Neema)', 'Business name (e.g. Duka la Neema)')} maxLength={32} />
          <div className="bb-shop-acts">
            {yard?.open
              ? <button className="btn btn-white btn-sm" onClick={() => saveShop(false)}>{L('Funga duka', 'Close shop')}</button>
              : <button className="btn btn-green btn-sm" onClick={() => saveShop(true)}>🛍️ {L('Fungua biashara', 'Open for business')}</button>}
          </div>
          <small>{L(`Weka kaunta 🪵 ili wateja wanunue. Kila mauzo: ${fmtTsh(YARD.sale)} kwako.`, `Place a counter 🪵 so customers can buy. Each sale: ${fmtTsh(YARD.sale)} to you.`)}{yard?.sales ? L(` · Mauzo ${yard.sales}`, ` · ${yard.sales} sales`) : ''}</small>
        </div>
      ) : (
        <div className="bb-palette" role="listbox" aria-label={L('Vitu vya kujenga', 'Blocks')}>
          {YARD_BLOCKS.map((b) => (
            <button key={b.id} role="option" aria-selected={!build.erase && build.kind === b.id} className={`bb-block ${!build.erase && build.kind === b.id ? 'on' : ''}`} onClick={() => set({ kind: b.id, erase: false })}>
              <span>{b.emoji}</span>
              <b>{loc(b)}</b>
              <small>{fmtShort(b.price)}</small>
            </button>
          ))}
        </div>
      )}
      <div className="bb-hint">{build.erase ? L('Gusa kitu ili ukiondoe (unarudishiwa nusu).', 'Tap a block to remove it (half back).') : L('Gusa ardhi au upande wa kitu kuweka.', 'Tap the ground or the side of a block to place.')}</div>
    </div>
  );
}

/** Visiting a home whose yard shop is open: buy something there. */
export function VisitShop() {
  const visiting = useStore((s) => s.visiting);
  const y = useStore((s) => s.visitYard);
  const run = useStore((s) => s.run);
  if (!visiting || !y?.open) return null;
  const buy = async () => {
    const r = await run(`/yard/${encodeURIComponent(visiting.host.username)}/buy`, { method: 'POST' });
    if (r) useStore.getState().toast(L(`🛍️ Umenunua ${r.name}! 😋`, `🛍️ You bought at ${r.name}! 😋`));
  };
  return (
    <button className="visit-shop" onClick={buy}>🛍️ {L(`Nunua ${y.name}`, `Buy at ${y.name}`)} · {fmtTsh(YARD.sale)}</button>
  );
}
