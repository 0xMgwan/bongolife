// Lifts UI: the "hop in?" banner, the driver's bar (passengers, pick-ups, go out, drop off) and
// the passenger's bar (riding with…, get out).
import { useState } from 'react';
import { HANGOUT_PLACES, PLACES, placeById, liftSeats, vehicleById, cityAt, venueOf } from '@shared/world.js';
import { useStore } from '../store.js';
import { local, remotes, offerLift, requestLift, replyLift, dropLift, leaveLift, cancelPickup, wherePickup, setInside } from '../net.js';
import { walkTo } from '../nav.js';
import { placeDoor } from '../three/Players.jsx';
import { L, loc } from '../i18n.js';
import { sfx } from '../audio.js';

const ERR = {
  no_car: ['Unahitaji kuwa unaendesha gari lenye nafasi.', 'You need to be driving a vehicle with a free seat.'],
  full: ['Gari limejaa.', 'Your car is full.'],
  offline: ['Hayupo online sasa — tumemtumia taarifa.', "They're offline — we sent them a notification."],
  busy: ['Tayari yuko kwenye gari la mtu.', "They're already in someone's car."],
  blocked: ['Haiwezekani.', "Can't do that."],
  expired: ['Ombi limeisha muda.', 'That request expired.'],
};
const toastErr = (r) => useStore.getState().toast(L(...(ERR[r.error] || ['Imeshindikana.', 'That didn’t work.'])), 'err');

/** Give @username a lift: hop into your best car first if you're on foot. */
export async function giveLift(username) {
  const st = useStore.getState();
  const me = st.me;
  let active = me.vehicles?.find((v) => v.id === me.activeVehicle);
  if (!liftSeats(active?.model)) {
    const car = [...(me.vehicles || [])].filter((v) => liftSeats(v.model) > 0).sort((a, b) => (vehicleById[b.model]?.price || 0) - (vehicleById[a.model]?.price || 0))[0];
    if (!car) return st.toast(L('Huna gari la kubeba mtu. Nunua moja kwenye Mali → Magari.', 'You have no vehicle that can carry someone. Buy one in Assets → Cars.'), 'err');
    const ok = await st.run('/vehicle/use', { method: 'POST', body: { vehicleId: car.id } });
    if (!ok) return;
    local.lastCar = car.id;
    await new Promise((r) => setTimeout(r, 400));
  }
  const r = await offerLift(username);
  if (r?.ok) { sfx('pop'); st.toast(L(`🚗 Umempa @${r.to} ofa ya lifti`, `🚗 Lift offered to @${r.to}`)); }
  else toastErr(r || {});
}
export async function askLift(username) {
  const r = await requestLift(username);
  if (r?.ok) { sfx('pop'); useStore.getState().toast(L(`🙋 Umemuomba @${r.to} lifti`, `🙋 Asked @${r.to} for a lift`)); }
  else toastErr(r || {});
}

export function LiftAsk() {
  const a = useStore((s) => s.liftAsk);
  if (!a) return null;
  const text = a.kind === 'offer'
    ? (a.far ? L(`🚗 @${a.from} anakuja kukuchukua (${a.meters}m) — twende?`, `🚗 @${a.from} will come pick you up (${a.meters}m away) — go?`) : L(`🚗 @${a.from} anakupa lifti — panda?`, `🚗 @${a.from} is offering you a lift — hop in?`))
    : (a.far ? L(`🙋 @${a.from} anaomba lifti (${a.meters}m) — ukamchukue?`, `🙋 @${a.from} needs a lift (${a.meters}m away) — go pick them up?`) : L(`🙋 @${a.from} anaomba lifti — mpakie?`, `🙋 @${a.from} is asking for a lift — let them in?`));
  const answer = async (yes) => {
    const r = await replyLift(a.fromId, yes);
    if (r?.error) toastErr(r);
  };
  return (
    <div className="watch-invite card lift-ask">
      <span>{text}</span>
      <div className="row" style={{ gap: 6 }}>
        <button className="btn btn-green btn-xs" onClick={() => answer(true)}>{L('Ndiyo', 'Yes')}</button>
        <button className="btn btn-ghost btn-xs" onClick={() => answer(false)}>{L('Hapana', 'No')}</button>
      </div>
    </div>
  );
}

/** Places to go out to in the city you're driving in (hangouts first). */
function outSpots() {
  const city = cityAt(local.x, local.z)?.id || 'dar';
  const here = PLACES.filter((p) => !p.comingSoon && (cityAt(p.pos[0], p.pos[1])?.id || 'dar') === city && (HANGOUT_PLACES.includes(p.id) || venueOf(p.id)));
  return here.sort((a, b) => HANGOUT_PLACES.includes(b.id) - HANGOUT_PLACES.includes(a.id)).slice(0, 18);
}

export function LiftBar() {
  const ride = useStore((s) => s.liftRide);
  const waiting = useStore((s) => s.liftWaiting);
  const passengers = useStore((s) => s.liftPassengers) || [];
  const pickups = useStore((s) => s.liftPickups) || [];
  const [going, setGoing] = useState(false);
  if (ride) {
    return (
      <div className="lift-bar">
        <span>🚗 {L(`Uko kwenye gari la @${ride.driver || remotes.get(ride.driverId)?.username || ''}`, `Riding with @${ride.driver || remotes.get(ride.driverId)?.username || ''}`)}</span>
        <button onClick={() => { sfx('close'); leaveLift(); }}>🚪 {L('Shuka', 'Get out')}</button>
      </div>
    );
  }
  if (waiting) {
    return (
      <div className="lift-bar">
        <span>⏳ {L(`@${waiting.driver} anakuja kukuchukua — usiondoke`, `@${waiting.driver} is on the way — stay put`)}</span>
        <button onClick={leaveLift}>✕</button>
      </div>
    );
  }
  if (!passengers.length && !pickups.length) return null;
  const pickUp = async (p) => {
    const w = await wherePickup(p.id);
    const pos = w?.x != null ? [w.x, w.z] : [p.x, p.z];
    walkTo(pos, null, `@${p.username}`);
  };
  const goOut = (placeId) => {
    setGoing(false);
    walkTo(placeDoor(placeId), () => { dropLift(null, placeId); setInside(placeId); }, loc(placeById[placeId]), placeId);
  };
  return (
    <div className="lift-bar driver">
      {pickups.map((p) => (
        <span key={p.id} className="lift-chip">📍 @{p.username}
          <button onClick={() => pickUp(p)}>{L('Nenda', 'Go')}</button>
          <button onClick={() => cancelPickup(p.id)}>✕</button>
        </span>
      ))}
      {passengers.length > 0 && (
        <>
          <span>🚗 {passengers.map((p) => `@${p.username}`).join(', ')}</span>
          <button onClick={() => setGoing(!going)}>🎉 {L('Twende…', 'Go out…')}</button>
          <button onClick={() => dropLift()}>🛑 {L('Washushe', 'Drop off')}</button>
        </>
      )}
      {going && (
        <div className="lift-places">
          {outSpots().map((p) => <button key={p.id} onClick={() => goOut(p.id)}>{p.icon} {loc(p)}</button>)}
        </div>
      )}
    </div>
  );
}
