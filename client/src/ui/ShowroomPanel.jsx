// The car you tapped in the showroom: big preview, specs, colours and Buy.
import { useState } from 'react';
import { vehicleById, VEHICLE_COLORS, fmtTsh, liftSeats } from '@shared/world.js';
import { useStore } from '../store.js';
import { CarPic } from './Sheets.jsx';
import { ask } from './Confirm.jsx';
import { L, loc } from '../i18n.js';
import { sfx } from '../audio.js';

const CLASS = ['', ['Kuanzia', 'Starter'], ['Familia', 'Family'], ['Wakubwa', 'Executive'], ['Premium', 'Premium'], ['Watu wazito', 'Big boss'], ['Supercar', 'Supercar']];

export function ShowroomPanel() {
  const id = useStore((s) => s.showroomCar);
  const inside = useStore((s) => s.inside);
  const me = useStore((s) => s.me);
  const run = useStore((s) => s.run);
  const [color, setColor] = useState(null);
  const v = id && vehicleById[id];
  if (!v || inside !== 'yadi') return null;
  const c = color || v.color;
  const owned = me.vehicles?.some((x) => x.model === v.id);
  const buy = async () => {
    if (!(await ask({ icon: v.emoji, title: L(`Nunua ${v.name}?`, `Buy the ${loc(v)}?`), text: fmtTsh(v.price), ok: L('Nunua', 'Buy') }))) return;
    const r = await run('/shop/vehicle', { method: 'POST', body: { model: v.id, color: c } });
    if (r) { sfx('levelup'); useStore.getState().toast(L(`🎉 ${v.name} ni yako! Liko nje — gusa "Endesha".`, `🎉 The ${loc(v)} is yours! It's outside — tap "Drive".`)); useStore.setState({ showroomCar: null }); }
  };
  const close = () => { setColor(null); useStore.setState({ showroomCar: null }); };
  const cls = CLASS[v.tier || 1];
  return (
    <div className="sr-panel card">
      <button className="sr-x" onClick={close} aria-label={L('Funga', 'Close')}>✕</button>
      <CarPic v={v} color={c} />
      <div className="sr-name">{loc(v)}</div>
      <div className="sr-specs">
        <span>💰 {fmtTsh(v.price)}</span>
        <span>⚡ ×{v.speed}</span>
        <span>🧍 {liftSeats(v.id) + 1} {L('viti', 'seats')}</span>
        {cls && <span>🏷️ {L(cls[0], cls[1])}</span>}
        {v.lux && <span>✨ {L('Kifahari', 'Luxury')}</span>}
      </div>
      <div className="swatches" style={{ gap: 6, justifyContent: 'center' }}>
        {VEHICLE_COLORS.map((col) => <button key={col} className={`swatch ${c === col ? 'on' : ''}`} style={{ background: col, width: 26, height: 26, borderWidth: 2 }} onClick={() => setColor(col)} aria-label={col} />)}
      </div>
      <button className="btn btn-green btn-block" disabled={me.money < v.price} onClick={buy}>{owned ? L('Nunua jingine', 'Buy another') : me.money < v.price ? L('Pesa haitoshi', 'Not enough money') : L(`Nunua · ${fmtTsh(v.price)}`, `Buy · ${fmtTsh(v.price)}`)}</button>
    </div>
  );
}
