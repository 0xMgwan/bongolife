import { useEffect, useState } from 'react';
import { TRAVEL, placeById, travelCost, fmtTsh, ENTERABLE, vehicleById } from '@shared/world.js';
import { useStore } from '../store.js';
import { local } from '../net.js';
import { goToPlace, startRide } from '../nav.js';
import { placeDoor } from '../three/Players.jsx';
import { L, loc } from '../i18n.js';
import { sfx } from '../audio.js';
import { share } from './share.js';

/** Trek / bajaji / daladala / boda / taxi / your own car — like Lagos's travel row. */
export function TravelOptions({ placeId, onDone }) {
  const me = useStore((s) => s.me);
  const run = useStore((s) => s.run);
  const place = placeById[placeId];
  const from = [local.x, local.z];
  const car = me.vehicles?.find((v) => v.id === me.activeVehicle && ['car', 'van', 'suv', 'moto', 'bajaji'].includes(vehicleById[v.model]?.kind))
    || me.vehicles?.find((v) => ['car', 'van', 'suv', 'moto', 'bajaji'].includes(vehicleById[v.model]?.kind));
  const go = async (mode) => {
    onDone?.();
    useStore.setState({ tab: 'town', cityView: 'follow', inside: null, sheet: null, phone: null, visiting: null });
    if (mode === 'walk') return goToPlace(placeId);
    const r = await run('/travel', { method: 'POST', body: { placeId, mode } });
    if (!r) return;
    sfx('horn');
    const cv = r.car && vehicleById[r.car.model];
    const look = cv ? { kind: cv.kind, body: cv.body, lux: cv.lux, color: r.car.color } : null;
    startRide(mode, r.pos, placeId, () => {
      sfx('pop');
      useStore.getState().toast(r.cost ? L(`${TRAVEL[mode].emoji} Umefika ${place.name} · ${fmtTsh(r.cost)}`, `${TRAVEL[mode].emoji} Arrived at ${loc(place)} · ${fmtTsh(r.cost)}`) : L(`📍 Umefika ${place.name}`, `📍 Arrived at ${loc(place)}`));
      useStore.setState({ sheet: { type: 'place', id: placeId } });
    }, look);
  };
  const opts = [
    { mode: 'walk', emoji: '🚶', name: L('Tembea', 'Trek'), cost: 0 },
    ...Object.entries(TRAVEL).filter(([, t]) => !t.own).map(([mode, t]) => ({ mode, emoji: t.emoji, name: t.name.split(' ')[0], cost: travelCost(mode, from, place.pos) })),
    ...(car ? [{ mode: 'gari', emoji: vehicleById[car.model]?.emoji || '🚗', name: L('Gari langu', 'My car'), cost: 0, own: true }] : []),
  ];
  return (
    <div className="travel-row">
      {opts.map((o) => (
        <button key={o.mode} className={`travel-opt ${o.own ? 'own' : ''}`} disabled={o.cost > me.money} onClick={() => go(o.mode)}>
          <span className="em">{o.emoji}</span>
          <b>{o.name}</b>
          <small>{o.cost ? fmtTsh(o.cost).replace('TSh ', 'TSh ') : L('Bure', 'Free')}</small>
        </button>
      ))}
    </div>
  );
}

/** Map pop-up for a place: about, share link, things to do, and how to get there. */
export function TravelCard({ id, onClose }) {
  const p = placeById[id];
  const [closing, setClosing] = useState(false);
  useEffect(() => sfx('open'), []);
  if (!p) return null;
  const near = Math.hypot(...placeDoor(id).map((v, i) => v - [local.x, local.z][i])) < 18;
  const close = () => { setClosing(true); setTimeout(onClose, 150); };
  const things = [...(p.activities || []).map((a) => `${a.emoji} ${loc(a)}`), ...(p.jobs || []).map((j) => `💼 ${loc(j, 'title')}`)];
  return (
    <div className="sheet-wrap" onClick={close}>
      <div className={`sheet travel-card ${closing ? 'out' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="grab" />
        <div className="row" style={{ gap: 12 }}>
          <span className="tc-ic">{p.icon}</span>
          <div className="grow"><h2 style={{ margin: 0 }}>{loc(p)}</h2><div className="muted">{p.district}</div></div>
          <button className="x" onClick={close} aria-label={L('Funga', 'Close')}>✕</button>
        </div>
        <p className="tc-blurb">{loc(p, 'blurb')}</p>
        <button className="link-share" onClick={() => share({ title: loc(p), text: L(`Tukutane ${p.name} kwenye Bongo Life! 🇹🇿`, `Meet me at ${loc(p)} in Bongo Life! 🇹🇿`), params: { place: id } })}>🔗 {L(`Shiriki link ya ${p.name}`, `Share a link to ${loc(p)}`)}</button>
        {things.length > 0 && <div className="tc-chips">{things.map((t) => <span key={t}>{t}</span>)}</div>}
        {ENTERABLE[id] && <div className="tc-note">🚪 {L('Unaweza kuingia ndani na kuona nani yupo.', "You can go inside and see who's there.")}</div>}
        {near ? (
          <button className="btn btn-green btn-block" style={{ marginTop: 12 }} onClick={() => { onClose(); useStore.setState({ sheet: { type: 'place', id } }); }}>{L('Uko hapa · Ona shughuli', "You're here · See activities")} →</button>
        ) : (
          <TravelOptions placeId={id} onDone={onClose} />
        )}
      </div>
    </div>
  );
}
