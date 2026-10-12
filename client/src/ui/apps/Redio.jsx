// Radio app: live Tanzanian stations.
import { useEffect, useState } from 'react';
import { useStore } from '../../store.js';
import { AppHead } from '../Phone.jsx';
import { L } from '../../i18n.js';
import { loadStations, playRadio, toggleRadio, nextStation, radioAutoOn, setRadioAuto } from '../../radio.js';

export function Redio({ back }) {
  const radio = useStore((s) => s.radio) || {};
  const [list, setList] = useState(radio.stations || []);
  const [auto, setAuto] = useState(radioAutoOn());
  useEffect(() => { loadStations().then(setList); }, []);
  const cur = radio.current;
  const on = radio.playing || radio.loading;
  return (
    <>
      <AppHead title={L('Redio', 'Radio')} onBack={back} />
      <div className="app-body">
        <div className="radio-now">
          <div className="rn-ic">📻</div>
          <b>{cur?.name || L('Chagua kituo', 'Pick a station')}</b>
          <small>{radio.loading ? L('Inaunganisha…', 'Tuning in…') : radio.playing ? L('Hewani sasa', 'On air now') : L('Imezimwa', 'Off')}</small>
          <div className="row" style={{ gap: 10, justifyContent: 'center', marginTop: 10 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => nextStation(-1)} aria-label="Previous">⏮</button>
            <button className="btn btn-green" onClick={() => toggleRadio()}>{on ? `⏸ ${L('Zima', 'Stop')}` : `▶ ${L('Washa', 'Play')}`}</button>
            <button className="btn btn-ghost btn-sm" onClick={() => nextStation(1)} aria-label="Next">⏭</button>
          </div>
        </div>
        {list.map((s, i) => (
          <button key={s.name} className={`radio-row ${cur?.name === s.name ? 'on' : ''}`} onClick={() => playRadio(i)}>
            <span className="grow">
              <b>{s.name}</b>
              <small>{s.city} · {L(s.tag[0], s.tag[1])}</small>
            </span>
            <span className="rr-play">{cur?.name === s.name && radio.playing ? '🔊' : '▶'}</span>
          </button>
        ))}
        <div className="box small row between" style={{ marginTop: 10 }}>
          <span>{L('Washa redio nikiingia kwenye game', 'Start the radio when I open the game')}</span>
          <button className={`btn btn-xs ${auto ? 'btn-green' : 'btn-ghost'}`} onClick={() => { setRadioAuto(!auto); setAuto(!auto); }}>{auto ? L('Ndiyo ✓', 'On ✓') : L('Hapana', 'Off')}</button>
        </div>
        <div className="hint">{L('Vituo halisi vya Tanzania vinavyorusha mtandaoni. Sauti inafuata Muziki kwenye Mipangilio na inapungua ukiwa club.', 'Real Tanzanian stations streaming online. Volume follows Music in Settings and dips inside clubs.')}</div>
      </div>
    </>
  );
}
