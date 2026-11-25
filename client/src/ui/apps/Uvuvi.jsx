// Uvuvi: fishing. The phone app (cool box, collection, records, where to fish) and the reel-in game
// that opens over the city when you cast.
import { useEffect, useRef, useState } from 'react';
import { FISH, FISHING, fishById, placeById, fmtTsh, cityAt } from '@shared/world.js';
import { useStore } from '../../store.js';
import { api } from '../../api.js';
import { AppHead } from '../Phone.jsx';
import { goToPlace } from '../../nav.js';
import { L, loc } from '../../i18n.js';
import { sfx } from '../../audio.js';

const fname = (f) => L(f.name[0], f.name[1]);

/** The timing game: wait for the bite, then stop the marker inside the green zone once per pull. */
export function FishingGame() {
  const open = useStore((s) => s.fishing);
  const [phase, setPhase] = useState('cast'); // cast → wait → reel → result
  const [info, setInfo] = useState(null);
  const [won, setWon] = useState(0);
  const [zone, setZone] = useState([0.4, 0.62]);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState('');
  const marker = useRef(0);
  const dir = useRef(1);
  const bar = useRef(null);
  const raf = useRef(0);
  const close = () => { cancelAnimationFrame(raf.current); useStore.setState({ fishing: null }); };

  const start = async () => {
    setErr(''); setResult(null); setWon(0); setPhase('cast');
    try {
      const r = await api('/fish/cast', { method: 'POST' });
      useStore.setState({ me: r.me });
      setInfo(r);
      setPhase('wait');
      sfx('click');
      setTimeout(() => { setPhase('reel'); sfx('notify'); newZone(r.speed); }, r.biteMs);
    } catch (e) { setErr(e.message); setPhase('done'); }
  };
  useEffect(() => { if (open) start(); return () => cancelAnimationFrame(raf.current); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const newZone = (speed) => {
    const w = Math.max(0.12, 0.3 - (speed - 1) * 0.12);
    const a = 0.08 + Math.random() * (0.84 - w);
    setZone([a, a + w]);
  };
  // Marker runs back and forth; setTimeout keeps it going when the tab is in the background.
  useEffect(() => {
    if (phase !== 'reel' || !info) return undefined;
    let last = performance.now();
    const tick = () => {
      const t = performance.now();
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      marker.current += dir.current * dt * 0.9 * info.speed;
      if (marker.current > 1) { marker.current = 1; dir.current = -1; }
      if (marker.current < 0) { marker.current = 0; dir.current = 1; }
      if (bar.current) bar.current.style.left = `${marker.current * 100}%`;
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [phase, info]);

  const finish = async (pulls) => {
    cancelAnimationFrame(raf.current);
    setPhase('result');
    try {
      const r = await api('/fish/reel', { method: 'POST', body: { won: pulls } });
      setResult(r);
      sfx(r.landed ? (r.record ? 'levelup' : 'cash') : 'error');
    } catch (e) { setErr(e.message); setPhase('done'); }
  };
  const pull = () => {
    if (phase === 'wait') return finish(0); // too early
    if (phase !== 'reel') return;
    const m = marker.current;
    if (m >= zone[0] && m <= zone[1]) {
      const n = won + 1;
      setWon(n);
      sfx('click');
      if (n >= info.pulls) finish(n);
      else newZone(info.speed + 0.25 * n);
    } else finish(won);
  };

  if (!open) return null;
  const f = result?.species ? fishById[result.species] : null;
  return (
    <div className="fishing">
      <div className="fishing-card">
        <button className="fishing-x" onClick={close} aria-label={L('Funga', 'Close')}>✕</button>
        {phase === 'cast' && <div className="fishing-msg">🎣 {L('Unarusha ndoano…', 'Casting…')}</div>}
        {phase === 'wait' && (
          <>
            <div className="fishing-bob">🎣</div>
            <div className="fishing-msg">{L('Subiri samaki anase…', 'Wait for a bite…')}</div>
            <div className="small muted">{L('Usivute mapema!', "Don't pull too early!")}</div>
          </>
        )}
        {phase === 'reel' && info && (
          <>
            <div className="fishing-msg bite">{L('Amenasa! VUTA ukiwa kwenye kijani', 'Bite! PULL when the marker is in the green')}</div>
            <div className="fishing-pulls">{Array.from({ length: info.pulls }, (_, i) => <span key={i} className={i < won ? 'on' : ''} />)}</div>
            <div className="fishing-bar" onPointerDown={pull}>
              <div className="fishing-zone" style={{ left: `${zone[0] * 100}%`, width: `${(zone[1] - zone[0]) * 100}%` }} />
              <div className="fishing-marker" ref={bar} />
            </div>
            <button className="btn btn-green btn-block" onPointerDown={pull}>🎣 {L('VUTA!', 'PULL!')}</button>
          </>
        )}
        {phase === 'result' && !result && <div className="fishing-msg">…</div>}
        {phase === 'result' && result && (
          result.landed ? (
            <>
              <div className="fishing-catch">{f.emoji}</div>
              {result.record && <div className="fishing-record">🏆 {L('REKODI MPYA YA TAIFA!', 'NEW NATIONAL RECORD!')}</div>}
              <h3>{fname(f)} · {result.kg} kg</h3>
              <div className="small">{L('Thamani sokoni', 'Market value')}: <b>{fmtTsh(result.value)}</b></div>
            </>
          ) : (
            <>
              <div className="fishing-catch">💨</div>
              <h3>{result.reason === 'slow' ? L('Umechelewa — samaki ameondoka', 'Too slow — it swam off') : L('Samaki amekimbia!', 'It got away!')}</h3>
              {result.species && <div className="small muted">{L('Ilikuwa', 'It was a')} {fname(fishById[result.species])}…</div>}
            </>
          )
        )}
        {err && <div className="small red" style={{ margin: '8px 0' }}>{err}</div>}
        {(phase === 'result' || phase === 'done') && (
          <div className="row" style={{ gap: 8, marginTop: 12 }}>
            <button className="btn btn-green grow" onClick={start}>🎣 {L('Rusha tena', 'Cast again')}</button>
            <button className="btn btn-ghost" onClick={() => { close(); useStore.getState().openPhone('uvuvi'); }}>🧊 {L('Kibox', 'Cool box')}</button>
          </div>
        )}
      </div>
    </div>
  );
}

export function Uvuvi({ back, close }) {
  const run = useStore((s) => s.run);
  const [d, setD] = useState(null);
  const load = () => api('/fish').then(setD).catch(() => {});
  useEffect(() => { load(); }, []);
  const act = async (path) => {
    const r = await run(path, { method: 'POST' });
    if (r) { setD(r); if (r.me) useStore.setState({ me: r.me }); return r; }
    return null;
  };
  const fish = () => { close?.(); useStore.setState({ fishing: Date.now() }); };
  return (
    <>
      <AppHead title={L('Uvuvi 🎣', 'Fishing 🎣')} onBack={back} />
      <div className="app-body">
        {!d && <div className="small muted" style={{ padding: 12 }}>{L('Inapakia…', 'Loading…')}</div>}
        {d && (
          <>
            {d.spot ? (
              <div className="box" style={{ background: '#ecfeff' }}>
                <b>🌊 {loc(placeById[d.spot])}</b>
                <div className="small" style={{ margin: '4px 0 8px' }}>{L('Samaki wa hapa', 'Fish here')}: {d.here.map((id) => fishById[id].emoji + ' ' + fname(fishById[id])).join(' · ')}</div>
                <button className="btn btn-green btn-block" onClick={fish}>🎣 {L('Anza kuvua', 'Start fishing')}</button>
              </div>
            ) : (
              <div className="box">
                <b>{L('Wapi pa kuvua?', 'Where to fish?')}</b>
                <div className="small muted" style={{ margin: '4px 0 8px' }}>{L('Ufukweni, bandarini au ziwa Victoria. Kila mji una samaki wake.', 'Beaches, ports and Lake Victoria. Every city has its own fish.')}</div>
                <div className="chips">
                  {FISHING.spots.map((id) => placeById[id]).filter(Boolean).map((p) => (
                    <button key={p.id} className="chip" onClick={() => { close?.(); goToPlace(p.id); }}>📍 {loc(p)} · {cityAt(...p.pos)?.name}</button>
                  ))}
                </div>
              </div>
            )}

            <div className="label">🧊 {L(`Kibox · samaki ${d.box.length}/${FISHING.boxMax}`, `Cool box · ${d.box.length}/${FISHING.boxMax} fish`)}</div>
            {d.box.length === 0 && <div className="box small muted">{L('Bado hujavua kitu.', 'Nothing caught yet.')}</div>}
            {d.box.length > 0 && (
              <div className="box" style={{ padding: '4px 12px' }}>
                {d.box.map((c) => (
                  <div key={c.id} className="tx">
                    <span>{fishById[c.species].emoji} {fname(fishById[c.species])} · {c.kg} kg</span>
                    <span className="row" style={{ gap: 6 }}>
                      <b className="small">{fmtTsh(c.value)}</b>
                      <button className="btn btn-ghost btn-xs" onClick={() => act(`/fish/cook/${c.id}`).then((r) => r && useStore.getState().toast(L('🍳 Umepika na kula — tamu!', '🍳 Cooked and eaten — delicious!')))}>🍳</button>
                    </span>
                  </div>
                ))}
              </div>
            )}
            {d.box.length > 0 && (d.market
              ? <button className="btn btn-green btn-block" style={{ marginTop: 8 }} onClick={() => act('/fish/sell').then((r) => r && (sfx('cash'), useStore.getState().toast(L(`🐟 Umeuza samaki ${r.sold} kwa ${fmtTsh(r.total)}`, `🐟 Sold ${r.sold} fish for ${fmtTsh(r.total)}`))))}>💰 {L('Uza wote', 'Sell all')} · {fmtTsh(d.boxValue)}</button>
              : <div className="hint">{L(`Thamani ${fmtTsh(d.boxValue)}. Uza kwenye soko la samaki: `, `Worth ${fmtTsh(d.boxValue)}. Sell at a fish market: `)}{FISHING.markets.map((id) => <button key={id} className="link-btn" onClick={() => { close?.(); goToPlace(id); }}>{loc(placeById[id])}</button>).reduce((a, b) => [a, ' · ', b])}</div>
            )}

            <div className="label">📖 {L('Daftari la samaki', 'Fish collection')} · {Object.keys(d.caught).length}/{FISH.length}</div>
            <div className="fish-grid">
              {FISH.map((f) => {
                const mine = d.caught[f.id];
                const rec = d.records[f.id];
                return (
                  <div key={f.id} className={`fish-cell ${mine ? 'got' : ''}`}>
                    <span className="em">{mine ? f.emoji : '❔'}</span>
                    <b>{mine ? fname(f) : '???'}</b>
                    <small>{mine ? L(`kubwa: ${mine.best} kg`, `best: ${mine.best} kg`) : L('bado', 'not yet')}</small>
                    {rec && <small className="rec">🏆 {rec.kg} kg · @{rec.username}</small>}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </>
  );
}
