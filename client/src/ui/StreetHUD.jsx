// Mtaani HUD: wanted stars, the live job bar (timer, distance, arrow), carjack / chop shop
// buttons, and the bank vault mini-game.
import { useEffect, useRef, useState } from 'react';
import { STREET } from '@shared/world.js';
import { useStore } from '../store.js';
import { local } from '../net.js';
import { L } from '../i18n.js';
import { sfx } from '../audio.js';
import { chase, near, markerTarget, arrowTo, jackCar, ditchCar, refreshStreet } from '../street.js';

function useTick(ms = 200) {
  const [, set] = useState(0);
  useEffect(() => {
    const t = setInterval(() => set((n) => n + 1), ms);
    return () => clearInterval(t);
  }, [ms]);
}
const mmss = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export function StreetHUD() {
  const street = useStore((s) => s.street);
  const stolen = useStore((s) => s.stolenCar);
  const tab = useStore((s) => s.tab);
  const inside = useStore((s) => s.inside);
  const vault = useStore((s) => s.vault);
  useTick(250);
  useEffect(() => { refreshStreet(); }, []);
  if (tab !== 'town' || inside) return vault ? <Vault /> : null;
  const stars = street?.stars || 0;
  const t = markerTarget();
  const m = street?.mission;
  const h = street?.heist;
  const def = m && STREET.missions[m.kind];
  const d = t ? Math.round(Math.hypot(t.pos[0] - local.x, t.pos[1] - local.z)) : 0;
  const left = h ? h.deadline - Date.now() : m ? m.deadline - Date.now() : 0;
  const evade = stars && chase.closest > STREET.loseRange ? Math.min(1, chase.clearMs / STREET.loseHoldMs) : 0;
  const danger = stars && chase.nearMs > 0 ? Math.min(1, chase.nearMs / STREET.bustHoldMs) : 0;
  return (
    <>
      <div className="street-top">
      {stars > 0 && (
        <div className={`wanted ${danger ? 'danger' : ''}`}>
          <div className="stars">{Array.from({ length: STREET.maxStars }, (_, i) => <span key={i} className={i < stars ? 'on' : ''}>★</span>)}</div>
          <small>
            {danger ? L('🚓 Polisi wamekushika — kimbia!', '🚓 They’ve got you — break free!')
              : evade ? L(`Unawapoteza… ${Math.round(evade * 100)}%`, `Losing them… ${Math.round(evade * 100)}%`)
                : L('Kimbia mbali na polisi!', 'Get away from the cops!')}
          </small>
          {(evade > 0 || danger > 0) && <div className="bar"><i style={{ width: `${(danger || evade) * 100}%`, background: danger ? '#ef4444' : '#22c55e' }} /></div>}
        </div>
      )}
      {t && (
        <div className={`job-bar ${left < 15000 ? 'late' : ''}`}>
          <span className="arrow" style={{ transform: `rotate(${arrowTo(t.pos)}deg)` }}>➤</span>
          <div className="grow">
            <b>{h ? L('💰 Toroka hadi maficho!', '💰 Get to the safehouse!') : `${def.emoji} ${L(def.name[0], def.name[1])}`}{m && m.points.length > 1 ? ` · ${m.idx + 1}/${m.points.length}` : ''}</b>
            <small>{d} m · ⏱ {mmss(left)}{m ? ` · TSh ${m.pay.toLocaleString()}` : h ? ` · TSh ${h.loot.toLocaleString()}` : ''}</small>
          </div>
          {m && <button className="btn btn-ghost btn-xs" onClick={() => useStore.getState().run('/street/mission/cancel', { method: 'POST' }).then(refreshStreet)}>✕</button>}
        </div>
      )}
      </div>
      <div className="street-acts">
        {near.car != null && !stars && (
          <button className="btn btn-red" onClick={jackCar}>😈 {L('Iba gari', 'Jack car')}</button>
        )}
        {near.car != null && stars > 0 && (
          <button className="btn btn-red" onClick={jackCar}>😈 {L('Chukua gari', 'Grab car')}</button>
        )}
        {stolen && near.chop && <button className="btn btn-green" onClick={ditchCar}>🔧 {L(`Uza gereji · ${STREET.chopPay[street?.stolen?.kind] ? (STREET.chopPay[street.stolen.kind] / 1e6).toFixed(1) + 'M' : ''}`, `Sell to chop shop · ${STREET.chopPay[street?.stolen?.kind] ? (STREET.chopPay[street.stolen.kind] / 1e6).toFixed(1) + 'M' : ''}`)}</button>}
        {stolen && !near.chop && <button className="btn btn-ghost" onClick={ditchCar}>🚶 {L('Acha gari', 'Ditch car')}</button>}
        {near.bank && !h && !m && !stars && (
          <button className="btn btn-amber" onClick={startHeist}>🧨 {L('Vamia benki', 'Rob the bank')}</button>
        )}
      </div>
      {vault && <Vault />}
    </>
  );
}

async function startHeist() {
  const st = useStore.getState();
  const { ask } = await import('./Confirm.jsx');
  const H = STREET.heist;
  if (!(await ask({ icon: '🧨', title: L('Vamia benki?', 'Rob the bank?'), text: L(`Vifaa vinagharimu TSh ${H.gear.toLocaleString()}. Fungua kasha (vitasa 3), kisha toroka hadi maficho ndani ya dakika ${H.timeMs / 60000} na polisi ★★★★ nyuma yako. Ukikamatwa unapoteza mzigo.`, `Gear costs TSh ${H.gear.toLocaleString()}. Crack the vault (3 dials), then reach the safehouse within ${H.timeMs / 60000} min with ★★★★ police on you. Get busted and the loot is gone.`), ok: L('Twende kazi', "Let's do it"), danger: true }))) return;
  const r = await st.run('/street/heist', { method: 'POST' });
  if (!r) return;
  if (r.me) useStore.setState({ me: r.me });
  useStore.setState({ vault: { dials: r.vault, idx: 0, at: performance.now() } });
  sfx('pop');
}

/** Three dials: a needle sweeps back and forth; tap when it's in the green. One miss = alarm. */
function Vault() {
  const vault = useStore((s) => s.vault);
  const [pos, setPos] = useState(0);
  const raf = useRef();
  useEffect(() => {
    const loop = () => {
      const v = useStore.getState().vault;
      if (!v) return;
      const dial = v.dials[v.idx];
      const t = (performance.now() - v.at) / 1000;
      setPos((Math.sin(t * dial.speed * 3) + 1) / 2);
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
  }, [vault?.idx]);
  if (!vault) return null;
  const dial = vault.dials[vault.idx];
  const finish = async (ok) => {
    useStore.setState({ vault: null });
    const r = await useStore.getState().run('/street/heist/crack', { method: 'POST', body: { ok } });
    if (!r) return;
    if (r.alarm) { sfx('siren'); useStore.getState().toast(L('🚨 Kengele imelia! Kimbia!', '🚨 The alarm went off! Run!'), 'err'); }
    if (r.heist) { sfx('cash'); useStore.getState().toast(L(`💰 Kasha limefunguka: TSh ${r.heist.loot.toLocaleString()}! Toroka hadi maficho!`, `💰 Vault open: TSh ${r.heist.loot.toLocaleString()}! Get to the safehouse!`)); }
    refreshStreet();
  };
  const hit = () => {
    const ok = pos >= dial.at - dial.width / 2 && pos <= dial.at + dial.width / 2;
    if (!ok) return finish(false);
    sfx('coin');
    if (vault.idx === vault.dials.length - 1) return finish(true);
    useStore.setState({ vault: { ...vault, idx: vault.idx + 1, at: performance.now() } });
  };
  return (
    <div className="vault-modal" onPointerDown={(e) => { e.preventDefault(); hit(); }}>
      <div className="vault card" onPointerDown={(e) => e.stopPropagation()}>
        <b>🔐 {L('Fungua kasha', 'Crack the vault')} · {vault.idx + 1}/{vault.dials.length}</b>
        <small className="muted">{L('Gusa sindano ikiwa kwenye kijani', 'Tap when the needle is in the green')}</small>
        <div className="vault-track">
          <i className="zone" style={{ left: `${(dial.at - dial.width / 2) * 100}%`, width: `${dial.width * 100}%` }} />
          <i className="needle" style={{ left: `${pos * 100}%` }} />
        </div>
        <div className="vault-dots">{vault.dials.map((_, i) => <span key={i} className={i < vault.idx ? 'on' : ''} />)}</div>
        <button className="btn btn-amber" onClick={hit}>🔓 {L('SASA!', 'NOW!')}</button>
      </div>
    </div>
  );
}
