import { useState } from 'react';
import { WATER, LAND_PATCHES, BEACHES, BRIDGES, ROADS, PLACES, PLOTS, DISTRICTS, TRAVEL, placeById, travelCost, fmtTsh, WORLD_SIZE } from '@shared/world.js';
import { useStore } from '../../store.js';
import { local } from '../../net.js';
import { goToPlace, startRide } from '../../nav.js';
import { AppHead } from '../Phone.jsx';
import { L, loc, isEn } from '../../i18n.js';
import { sfx } from '../../audio.js';

const H = WORLD_SIZE / 2;
const R = (r, fill) => <rect key={r.id} x={r.x1} y={r.z1} width={r.x2 - r.x1} height={r.z2 - r.z1} fill={fill} />;

export function Ramani({ back, close }) {
  const me = useStore((s) => s.me);
  const world = useStore((s) => s.world);
  const run = useStore((s) => s.run);
  const [sel, setSel] = useState(null);
  const place = sel && placeById[sel];
  const from = [local.x, local.z];

  const ride = async (mode) => {
    const r = await run('/travel', { method: 'POST', body: { placeId: sel, mode } });
    if (!r) return;
    const id = sel;
    close();
    useStore.setState({ tab: 'town', cityView: 'follow', inside: null, sheet: null });
    sfx('horn');
    startRide(mode, r.pos, id, () => {
      sfx('pop');
      useStore.getState().toast(L(`${TRAVEL[mode].emoji} Umefika ${placeById[id].name} · ${fmtTsh(r.cost)}`, `${TRAVEL[mode].emoji} Arrived at ${loc(placeById[id])} · ${fmtTsh(r.cost)}`));
      useStore.setState({ sheet: { type: 'place', id } });
    });
  };

  return (
    <>
      <AppHead title={L('Ramani ya Dar', 'Map of Dar')} onBack={back} />
      <div className="app-body">
        <div className="map-wrap">
          <svg viewBox={`${-H} ${-H} ${WORLD_SIZE} ${WORLD_SIZE}`}>
            <rect x={-H} y={-H} width={WORLD_SIZE} height={WORLD_SIZE} fill="#c7dca6" />
            {WATER.map((w) => R(w, '#58b4e3'))}
            {LAND_PATCHES.map((w) => R(w, '#c7dca6'))}
            {BEACHES.map((w) => R(w, '#f3e3b5'))}
            {BRIDGES.map((w) => R(w, '#9ca3af'))}
            {ROADS.map(([x1, z1, x2, z2, w], i) => <line key={i} x1={x1} y1={z1} x2={x2} y2={z2} stroke="#fff" strokeWidth={w * 0.8} strokeLinecap="round" />)}
            {DISTRICTS.map((d) => <text key={d.id} x={d.pos[0]} y={d.pos[1] + 14} fontSize="6" fontWeight="800" fill="rgba(55,65,81,.5)" textAnchor="middle">{d.name.toUpperCase()}</text>)}
            {PLOTS.map((p) => {
              const st = world.plots?.[p.id];
              return <rect key={p.id} x={p.pos[0] - p.size / 2} y={p.pos[1] - p.size / 2} width={p.size} height={p.size} rx="1.5" fill={st ? (st.owner === me.username ? '#2fb06f' : '#a8a29e') : '#e8d9b5'} stroke="#fff" strokeWidth=".6" />;
            })}
            {PLACES.map((p) => (
              <g key={p.id} transform={`translate(${p.pos[0]} ${p.pos[1]})`} onClick={() => setSel(p.id)} style={{ cursor: 'pointer' }}>
                <circle r={sel === p.id ? 8 : 6.5} fill="#fff" stroke={sel === p.id ? '#111827' : '#e5e7eb'} strokeWidth="1.2" />
                <text fontSize="8" textAnchor="middle" dominantBaseline="central">{p.icon}</text>
              </g>
            ))}
            <g transform={`translate(${local.x} ${local.z})`}>
              <circle r="6" fill="rgba(47,176,111,.25)" />
              <circle r="3.2" fill="#2fb06f" stroke="#fff" strokeWidth="1.4" />
            </g>
          </svg>
        </div>
        {!place && <div className="hint center">{L('Gusa sehemu kwenye ramani kwenda huko 📍', 'Tap a place on the map to go there 📍')}</div>}
        {place && (
          <div className="box" style={{ marginTop: 10 }}>
            <div className="row">
              <span style={{ fontSize: 28 }}>{place.icon}</span>
              <div className="grow"><b>{loc(place)}</b><div className="small muted">{place.district}</div></div>
            </div>
            {place.comingSoon ? (
              <div className="small muted" style={{ marginTop: 8 }}>🚧 {L('Inakuja hivi karibuni!', 'Coming soon!')}</div>
            ) : (
              <div className="opt-list" style={{ marginTop: 10 }}>
                <button className="item" style={{ margin: 0 }} onClick={() => { close(); goToPlace(sel); }}>
                  <span className="em">🚶</span><div className="grow t">{L('Tembea / Endesha', 'Walk / Drive')}</div><b>{L('Bure', 'Free')}</b>
                </button>
                {Object.entries(TRAVEL).map(([mode, t]) => {
                  const cost = travelCost(mode, from, place.pos);
                  return (
                    <button key={mode} className="item" style={{ margin: 0 }} disabled={me.money < cost} onClick={() => ride(mode)}>
                      <span className="em">{t.emoji}</span><div className="grow t">{L(`Panda ${t.name}`, `Take a ${loc(t)}`)}</div><b>{fmtTsh(cost)}</b>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
