import { useEffect, useState } from 'react';
import { TRAVEL, placeById, travelCost, fuelCost, tripFuel, bestCar, fmtTsh, fmtShort, venueOf, vehicleById, TRIP_MODES, tripKey, cityAt, cityById } from '@shared/world.js';
import { useStore } from '../store.js';
import { local } from '../net.js';
import { goToPlace, startRide, enterPlace } from '../nav.js';
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
      enterPlace(placeId);
    }, look);
  };
  const opts = [
    { mode: 'walk', emoji: '🚶', name: L('Tembea', 'Trek'), cost: 0 },
    ...Object.entries(TRAVEL).filter(([, t]) => !t.own).map(([mode, t]) => ({ mode, emoji: t.emoji, name: t.name.split(' ')[0], cost: travelCost(mode, from, place.pos) })),
    ...(car ? [{ mode: 'gari', emoji: vehicleById[car.model]?.emoji || '🚗', name: L('Gari langu', 'My car'), cost: fuelCost(car.model, from, place.pos), own: true, fuel: true }] : []),
  ];
  return (
    <div className="travel-row">
      {opts.map((o) => (
        <button key={o.mode} className={`travel-opt ${o.own ? 'own' : ''}`} disabled={o.cost > me.money} onClick={() => go(o.mode)}>
          <span className="em">{o.emoji}</span>
          <b>{o.name}</b>
          <small>{o.cost ? `${o.fuel ? '⛽ ' : ''}${fmtTsh(o.cost)}` : L('Bure', 'Free')}</small>
        </button>
      ))}
    </div>
  );
}

const TRIP_TEXT = {
  flight: (c, car) => [`Ndege hadi ${c}, takriban dakika 50. Teksi hadi uwanja imejumuishwa.`, `Fly to ${c}, about 50 minutes. The cab to the airport is included.`],
  heli: (c) => [`Helikopta binafsi hadi ${c} — mwonekano wa ajabu, kutoka mlangoni hadi mlangoni.`, `A private helicopter to ${c} — amazing views, door to door.`],
  ferry: (c) => [`Boti ya kasi ya Azam kutoka Kivukoni hadi ${c}, takriban saa 2 baharini.`, `The Azam fast ferry from Kivukoni to ${c}, about 2 hours at sea.`],
  bus: (c) => [`Basi la kifahari kutoka Magufuli hadi ${c}, takriban saa 9 barabarani.`, `A luxury coach from Magufuli terminal to ${c}, about 9 hours on the road.`],
  car: (c, car) => [`Endesha ${car} yako hadi ${c}, takriban saa 9 barabarani. Mafuta tu, lakini utafika umechoka.`, `Drive your ${car} to ${c}, about 9 hours on the road. Fuel only, but you'll arrive tired.`],
};
const INS_TEXT = {
  car: ['Kuharibika, tairi kupasuka, faini za barabarani. Bila bima, safari 1 kati ya 5 zina wahala.', 'Breakdowns, flat tyres, checkpoint fines. Without it, about 1 in 5 road trips hit wahala.'],
  bus: ['Basi kuharibika au mzigo kupotea. Bila bima, 1 kati ya 6.', 'Breakdowns or lost luggage. Without it, about 1 in 6 trips.'],
  ferry: ['Bahari kuchafuka, simu kuanguka majini. Bila bima, 1 kati ya 7.', 'Rough seas or a phone overboard. Without it, about 1 in 7 crossings.'],
  flight: ['Ndege kuchelewa, mzigo kupotea. Bila bima, 1 kati ya 8.', 'Delays and lost luggage. Without it, about 1 in 8 flights.'],
  heli: ['Hali mbaya ya hewa — kutua mahali pengine. Bila bima, 1 kati ya 12.', 'Bad weather diverts you. Without it, about 1 in 12 flights.'],
};

/** Getting to another city: flight / ferry / coach / helicopter / your own car, with travel insurance. */
export function TripOptions({ placeId, onDone }) {
  const me = useStore((s) => s.me);
  const run = useStore((s) => s.run);
  const place = placeById[placeId];
  const from = cityAt(local.x, local.z)?.id || 'dar';
  const to = cityAt(...place.pos)?.id;
  const key = tripKey(from, to);
  const car = bestCar(me.vehicles);
  const priceOf = (m) => (m.own && car ? tripFuel(m.price[key], car.model) : m.price[key]);
  const modes = Object.entries(TRIP_MODES).filter(([id, m]) => m.price[key] && (!m.own || car));
  const [sel, setSel] = useState(modes.find(([id]) => id === 'car') ? 'car' : modes[0]?.[0]);
  const [ins, setIns] = useState(true);
  if (!modes.length) return <div className="hint">{L('Hakuna usafiri wa moja kwa moja.', 'No direct way to get there.')}</div>;
  const m = TRIP_MODES[sel];
  const total = priceOf(m) + (ins ? m.ins : 0);
  const cityName = cityById[to].name;
  const go = async () => {
    const r = await run('/trip', { method: 'POST', body: { placeId, mode: sel, insured: ins } });
    if (!r) return;
    sfx(sel === 'car' ? 'horn' : 'open');
    onDone?.();
    useStore.setState({ tab: 'town', cityView: 'follow', inside: null, sheet: null, phone: null, visiting: null });
  };
  return (
    <div>
      <div className="travel-row">
        {modes.map(([id, t]) => (
          <button key={id} className={`travel-opt ${sel === id ? 'own' : ''}`} onClick={() => setSel(id)}>
            <span className="em">{t.emoji}</span>
            <b>{L(t.name, t.nameEn).split(' ')[0]}</b>
            <small>{t.own ? `⛽ TSh ${fmtShort(priceOf(t))}` : L(`kuanzia ${fmtShort(t.price[key])}`, `from ${fmtShort(t.price[key])}`)}</small>
            <small style={{ fontSize: 10.5, textAlign: 'center', lineHeight: 1.2 }}>{t.own ? L('mafuta tu', 'fuel only') : L(t.note[0], t.note[1])}</small>
          </button>
        ))}
      </div>
      <div className="trip-panel">
        <p>{L(...TRIP_TEXT[sel](cityName, car ? vehicleById[car.model].name : ''))}</p>
        <div className="trip-ins">
          <div>
            <b>🛡️ {L('Bima ya safari', 'Travel insurance')}</b>
            <small>{L(...INS_TEXT[sel])}</small>
          </div>
          <span className="ins-price">+{fmtTsh(m.ins)}</span>
          <button className={`toggle ${ins ? 'on' : ''}`} onClick={() => setIns(!ins)} aria-pressed={ins} aria-label={L('Bima', 'Insurance')}><i /></button>
        </div>
        <button className="btn btn-green btn-block" disabled={me.money < total} onClick={go}>{m.emoji} {L('Twende', 'Go')} · {fmtTsh(total)}</button>
      </div>
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
        {venueOf(id) && <div className="tc-note">🚪 {L('Unaweza kuingia ndani na kuona nani yupo.', "You can go inside and see who's there.")}</div>}
        {cityAt(...p.pos)?.id !== cityAt(local.x, local.z)?.id ? (
          <TripOptions placeId={id} onDone={onClose} />
        ) : near ? (
          <button className="btn btn-green btn-block" style={{ marginTop: 12 }} onClick={() => { onClose(); enterPlace(id); }}>{L('Ingia · Ona shughuli', 'Go in · See activities')} →</button>
        ) : (
          <TravelOptions placeId={id} onDone={onClose} />
        )}
      </div>
    </div>
  );
}
