// Mtaani: the street-jobs app. Take timed jobs across town, see the race leaderboard, plan the
// bank job and find the chop shop.
import { useEffect, useState } from 'react';
import { fmtTsh, fmtShort, STREET } from '@shared/world.js';
import { useStore } from '../../store.js';
import { AppHead } from '../Phone.jsx';
import { L } from '../../i18n.js';
import { sfx } from '../../audio.js';
import { walkTo } from '../../nav.js';
import { refreshStreet } from '../../street.js';

const secs = (ms) => (ms / 1000).toFixed(1) + 's';

export function Mtaani({ back, close }) {
  const run = useStore((s) => s.run);
  const d = useStore((s) => s.street);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { refreshStreet().then(() => setLoaded(true)); }, []);
  const start = async (kind) => {
    const r = await run('/street/mission', { method: 'POST', body: { kind } });
    if (!r) return;
    sfx('levelup');
    await refreshStreet();
    close?.();
    useStore.setState({ phone: null, cityView: 'follow' });
    useStore.getState().toast(L('🎯 Fuata mshale na mwanga wa kijani!', '🎯 Follow the arrow and the green beam!'));
  };
  const go = (pos, label) => { close?.(); useStore.setState({ phone: null, cityView: 'follow' }); walkTo([pos[0], pos[1]], null, label); };
  if (!loaded || !d?.rules) return (<><AppHead title="Mtaani" onBack={back} /><div className="app-body"><div className="small muted" style={{ padding: 12 }}>{L('Inapakia…', 'Loading…')}</div></div></>);
  const s = d.stats;
  const H = STREET.heist;
  return (
    <>
      <AppHead title={L('Mtaani · Kazi za mjini', 'Mtaani · Street jobs')} onBack={back} />
      <div className="app-body">
        <div className="mt-hero">
          <b>{L('Jiji ni lako 🌃', 'The city is yours 🌃')}</b>
          <small>{L('Kazi za haraka, mbio za mtaani, magari ya "kuazima" na kazi kubwa ya benki. Ukivunja sheria, polisi watakufukuza — wapoteze au ulipe faini.', 'Rush jobs, street races, "borrowed" cars and the big bank job. Break the law and the cops will chase you — lose them or pay the fine.')}</small>
          <div className="mt-stats">
            <span><b>{s.missions}</b>{L('kazi', 'jobs')}</span>
            <span><b>{fmtShort(s.earned)}</b>{L('umepata', 'earned')}</span>
            <span><b>{s.cars}</b>{L('magari', 'cars')}</span>
            <span><b>{s.heists}</b>{L('benki', 'heists')}</span>
            <span><b>{s.busts}</b>{L('kukamatwa', 'busted')}</span>
          </div>
        </div>
        {d.mission && <div className="box small" style={{ margin: '10px 0' }}>🎯 {L('Una kazi inayoendelea — fuata mshale.', 'You have a job running — follow the arrow.')}</div>}

        <div className="section-t">{L('KAZI ZA HARAKA', 'RUSH JOBS')}</div>
        {Object.entries(STREET.missions).map(([k, m]) => (
          <div key={k} className="lux-card" style={{ '--lux': k === 'race' ? '#ef4444' : '#22c55e' }}>
            <div className="lux-top">
              <span className="lux-em">{m.emoji}</span>
              <div className="grow">
                <b>{L(m.name[0], m.name[1])}</b>
                <small>
                  {k === 'delivery' && L('Chukua mzigo, upeleke kabla muda haujaisha. Kwa miguu au gari.', 'Grab the parcel and drop it off before time runs out. On foot or wheels.')}
                  {k === 'taxi' && L('Mteja anasubiri — mchukue umfikishe haraka. Unahitaji gari.', 'A fare is waiting — pick them up and floor it. Needs wheels.')}
                  {k === 'race' && L(`Vituo ${m.points} kwa kasi. Rekodi bora zinaingia kwenye ubao.`, `${m.points} checkpoints, flat out. Best times hit the leaderboard.`)}
                </small>
              </div>
            </div>
            <div className="row" style={{ gap: 8, marginTop: 8, alignItems: 'center' }}>
              <b className="grow">{L('kuanzia', 'from')} {fmtTsh(m.base)}+</b>
              <button className="btn btn-green btn-sm" disabled={!!d.mission || !!d.heist} onClick={() => start(k)}>{L('Anza', 'Start')}</button>
            </div>
          </div>
        ))}

        <div className="section-t">{L('KAZI KUBWA', 'THE BIG JOB')}</div>
        <div className="lux-card" style={{ '--lux': '#f59e0b' }}>
          <div className="lux-top">
            <span className="lux-em">🏦</span>
            <div className="grow">
              <b>{L('Vamia benki ya Posta', 'Rob the Posta bank')}</b>
              <small>{L(`Nunua vifaa (${fmtShort(H.gear)}), fungua kasha, toroka hadi maficho ndani ya dakika ${H.timeMs / 60000}. Mzigo: ${fmtShort(H.loot[0])}–${fmtShort(H.loot[1])}.`, `Buy gear (${fmtShort(H.gear)}), crack the vault, reach the safehouse within ${H.timeMs / 60000} min. Loot: ${fmtShort(H.loot[0])}–${fmtShort(H.loot[1])}.`)}</small>
            </div>
          </div>
          <div className="row" style={{ gap: 8, marginTop: 8, alignItems: 'center' }}>
            <small className="grow muted">{d.heistReadyIn > 0 ? L(`Ulinzi mkali — dakika ${Math.ceil(d.heistReadyIn / 60000)}`, `High alert — ${Math.ceil(d.heistReadyIn / 60000)} min`) : L('Nenda benki, gusa "Vamia benki"', 'Go to the bank, tap "Rob the bank"')}</small>
            <button className="btn btn-amber btn-sm" onClick={() => go([d.bank[0], d.bank[1] + 9], L('Benki', 'Bank'))}>🧭 {L('Nenda', 'Go')}</button>
          </div>
        </div>
        <div className="lux-card" style={{ '--lux': '#a855f7' }}>
          <div className="lux-top">
            <span className="lux-em">🔧</span>
            <div className="grow">
              <b>{L('Gereji ya Ubungo', 'Ubungo chop shop')}</b>
              <small>{L('Simama karibu na gari barabarani, gusa "Iba gari" (★1). Lilete hapa bila polisi nyuma: ', 'Stand next to a car on the road and tap "Jack car" (★1). Bring it here with no cops on you: ')}{Object.entries(STREET.chopPay).map(([k, v]) => `${{ car: '🚗', suv: '🚙', van: '🚐', moto: '🏍️', bajaji: '🛺' }[k]} ${fmtShort(v)}`).join(' · ')}</small>
            </div>
          </div>
          <div className="row" style={{ marginTop: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => go(STREET.chop, L('Gereji', 'Chop shop'))}>🧭 {L('Nenda', 'Go')}</button>
          </div>
        </div>

        <div className="section-t">🏁 {L('WAKIMBIZAJI BORA', 'FASTEST RACERS')}</div>
        {d.top.length === 0 && <div className="box small muted">{L('Bado hakuna — kuwa wa kwanza!', 'No times yet — be the first!')}</div>}
        {d.top.map((r, i) => (
          <div key={r.username} className="inv-row">
            <span className="em">{['🥇', '🥈', '🥉'][i] || `${i + 1}.`}</span>
            <div className="grow"><b>@{r.username}</b><small>{r.wins} {L('mbio', 'races')}</small></div>
            <b>{secs(r.ms)}</b>
          </div>
        ))}
        <div className="hint">{L('Nyota hupungua ukijificha. Polisi wakikushika kwa sekunde 1.5 umekamatwa — faini inapanda kwa kila nyota.', 'Stars fade if you lie low. If the cops hold you for 1.5 seconds you’re busted — the fine grows with each star.')}</div>
      </div>
    </>
  );
}
