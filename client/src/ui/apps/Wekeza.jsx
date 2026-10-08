import { useEffect, useState } from 'react';
import { fmtTsh, fmtShort, buildingById, placeById } from '@shared/world.js';
import { useStore } from '../../store.js';
import { api } from '../../api.js';
import { AppHead } from '../Phone.jsx';
import { goToPlace } from '../../nav.js';
import { ask } from '../Confirm.jsx';
import { L, loc } from '../../i18n.js';
import { sfx } from '../../audio.js';

const sign = (n) => (n >= 0 ? `+${fmtShort(n)}` : `-${fmtShort(-n)}`);

/** Invest: land that grows, haulage trucks, businesses — like Lagos Life's Invest app. */
export function Wekeza({ back, close, open }) {
  const me = useStore((s) => s.me);
  const run = useStore((s) => s.run);
  const [d, setD] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const load = () => api('/invest').then(setD).catch(() => {});
  useEffect(() => { load(); }, []);
  const act = async (path, confirm, ok) => {
    if (confirm && !(await ask(confirm))) return;
    const r = await run(path, { method: 'POST' });
    if (r?.invest) { setD(r.invest); sfx('cash'); if (ok) useStore.getState().toast(ok(r)); }
  };
  if (!d) return (<><AppHead title={L('Wekeza', 'Invest')} onBack={back} /><div className="app-body"><div className="small muted" style={{ padding: 12 }}>{L('Inapakia…', 'Loading…')}</div></div></>);
  const landGain = d.plots.reduce((s, p) => s + p.gain, 0);
  const T = d.truck;
  const sale = showAll ? d.forSale : d.forSale.slice(0, 6);
  return (
    <>
      <AppHead title={L('Wekeza', 'Invest')} onBack={back} />
      <div className="app-body">
        <div className="inv-card">
          <div className="ic-k">{L('UWEKEZAJI WAKO', 'YOUR INVESTMENTS')}</div>
          <div className="ic-v">{fmtTsh(d.value)}</div>
          <div className="ic-s">{d.plots.length} {L('viwanja', d.plots.length === 1 ? 'plot' : 'plots')} ({sign(landGain)}) · {d.trucks.length} {L(d.trucks.length === 1 ? 'lori' : 'malori', d.trucks.length === 1 ? 'truck' : 'trucks')} · {d.businesses.length} {L('biashara', d.businesses.length === 1 ? 'business' : 'businesses')}</div>
          <div className="ic-row">
            {[['today', L('Leo', 'Today')], ['week', L('Wiki hii', 'This week')], ['total', L('Jumla', 'Total')]].map(([k, t]) => (
              <div key={k}><small>{t}</small><b>+{fmtShort(d.earnings[k])}</b></div>
            ))}
          </div>
          <div className="ic-row2">
            <span>{L('Inasubiri', 'Waiting')}: <b>{fmtTsh(me.pendingIncome || 0)}</b></span>
            <button className="btn btn-white btn-sm" disabled={!me.pendingIncome} onClick={async () => {
              const r = await run('/income/collect', { method: 'POST' });
              if (r) { sfx('cash'); useStore.getState().toast(L(`🏦 Umekusanya ${fmtTsh(r.amount)}`, `🏦 Collected ${fmtTsh(r.amount)}`)); load(); }
            }}>{L('Kusanya', 'Collect')}</button>
          </div>
          <div className="ic-note">{L('Kodi, biashara na malori hulipa kila siku. Ardhi hupanda thamani unapoishikilia — unalipwa ukiuza.', 'Rent, businesses and trucks pay daily. Land grows the longer you hold it — it pays when you sell.')}</div>
        </div>

        <button className="co-start" style={{ marginTop: 12 }} onClick={() => open?.('kampuni')}>
          <span className="em">🏢</span>
          <span className="grow"><b>{L('Anzisha kampuni: kuanzia 1.5M', 'Start a company: from 1.5M')}</b><small>{L('Wafanyakazi, bei, wateja kila jioni', 'Staff, prices, customers every evening')}</small></span>
          <span className="go">{L('Fungua', 'Open')}</span>
        </button>

        <div className="section-t">{L('ARDHI YAKO', 'YOUR LAND')}</div>
        {d.plots.length === 0 && <div className="box small muted">{L('Huna kiwanja bado — nunua kimoja hapa chini.', 'No land yet — buy a plot below.')}</div>}
        {d.plots.map((p) => (
          <div key={p.id} className="inv-row">
            <span className="em">{p.building ? '🏠' : '🌱'}</span>
            <div className="grow">
              <b>{p.name}</b>
              <small>{L('Thamani', 'Worth')} {fmtTsh(p.value)} · <span className={p.gain >= 0 ? 'green' : 'red'}>{sign(p.gain)}</span></small>
              <small>{p.building && buildingById[p.building] ? loc(buildingById[p.building]) + ' · ' : ''}{L(`Imepanda +${fmtShort(p.grewWeek)} wiki hii`, `Grew +${fmtShort(p.grewWeek)} this week`)}</small>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => act(`/invest/plots/${p.id}/sell`,
              { icon: '🏷️', title: L(`Uza ${p.name}?`, `Sell ${p.name}?`), text: L(`Utapata ${fmtTsh(Math.round(p.value * (1 - d.fees.agent)))} baada ya dalali (${d.fees.agent * 100}%).${p.building ? ' Nyumba iliyojengwa inauzwa pamoja.' : ''}`, `You'll get ${fmtTsh(Math.round(p.value * (1 - d.fees.agent)))} after the agent (${d.fees.agent * 100}%).${p.building ? ' The house on it is sold too.' : ''}`), ok: L('Uza', 'Sell'), danger: true },
              (r) => L(`🏷️ Umeuza kwa ${fmtTsh(r.got)}`, `🏷️ Sold for ${fmtTsh(r.got)}`))}>{L('Uza', 'Sell')}</button>
          </div>
        ))}
        <div className="hint">{L(`Madalali huchukua ${d.fees.agent * 100}% ukiuza.`, `Agents take ${d.fees.agent * 100}% when you sell.`)}</div>

        <div className="section-t">{L('BIASHARA YA MALORI', 'HAULAGE BUSINESS')}</div>
        <div className="inv-truck">
          <div className="row" style={{ gap: 12 }}>
            <span style={{ fontSize: 34 }}>🚛</span>
            <div className="grow">
              <b>{L('Lori la Mizigo · Scania', 'Scania Haulage Truck')}</b>
              <small>{L(`Linaingiza ${fmtShort(T.earnMin)}–${fmtShort(T.earnMax)} kwa siku, toa ${fmtShort(T.driver)} ya dereva. Mara nyingine linaharibika (${fmtShort(T.repair)} kutengeneza).`, `Earns ${fmtShort(T.earnMin)}–${fmtShort(T.earnMax)} a day, minus ${fmtShort(T.driver)} for the driver. Sometimes it breaks down (${fmtShort(T.repair)} to fix).`)}</small>
            </div>
          </div>
          <div className="row" style={{ gap: 8, marginTop: 10 }}>
            <button className="btn btn-green grow" disabled={me.money < T.price || d.trucks.length >= T.max} onClick={() => act('/invest/trucks', { icon: '🚛', title: L('Nunua lori?', 'Buy a truck?'), text: L(`${fmtTsh(T.price)}. Linaanza kazi leo — mapato yanaingia kila baada ya saa 24.`, `${fmtTsh(T.price)}. It starts hauling today — income lands every 24 hours.`), ok: L('Nunua', 'Buy') }, () => L('🚛 Lori lako liko barabarani!', '🚛 Your truck is on the road!'))}>{L('Nunua', 'Buy')} · {fmtShort(T.price)}</button>
            <button className="btn btn-ghost grow" disabled={!d.trucks.length} onClick={() => act(`/invest/trucks/${d.trucks[d.trucks.length - 1].id}/sell`, { icon: '🚛', title: L('Uza lori moja?', 'Sell one truck?'), text: L(`Utapata ${fmtTsh(T.resale)}.`, `You'll get ${fmtTsh(T.resale)}.`), ok: L('Uza', 'Sell'), danger: true }, (r) => L(`Umeuza kwa ${fmtTsh(r.got)}`, `Sold for ${fmtTsh(r.got)}`))}>{L('Uza moja', 'Sell one')} · {fmtShort(T.resale)}</button>
          </div>
          {d.trucks.map((t, i) => (
            <div key={t.id} className="small" style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between' }}>
              <span>🚛 #{i + 1} · {t.days.some((x) => x.repair) ? L('🔧 iliharibika', '🔧 broke down') : L('barabarani', 'on the road')}</span>
              <b className="green">{t.pending ? `+${fmtShort(t.pending)}` : L(`inayofuata ${Math.ceil(t.nextIn / 3600_000)}h`, `next in ${Math.ceil(t.nextIn / 3600_000)}h`)}</b>
            </div>
          ))}
        </div>

        <div className="section-t">{L('BIASHARA ZAKO', 'YOUR BUSINESSES')}</div>
        {d.businesses.length === 0 && <div className="box small muted">{L('Kila biashara inalipa kila siku. Zinachukua muda kurudisha mtaji — chagua vizuri.', 'Each one pays you daily. They take a while to pay for themselves, so pick well.')}</div>}
        {d.businesses.map((b) => (
          <div key={b.id} className="inv-row"><span className="em">{b.icon}</span><div className="grow"><b>{b.label || b.name}</b><small>{fmtTsh(b.incomePerHour * 24)}/{L('siku', 'day')}</small></div></div>
        ))}
        {d.bizForSale.slice(0, 6).map((b) => (
          <div key={b.id} className="inv-row sale">
            <span className="em">{b.icon}</span>
            <div className="grow"><b>{b.label || loc(placeById[b.id])}</b><small>{fmtTsh(b.incomePerHour * 24)}/{L('siku', 'day')} · {b.district}</small></div>
            <button className="btn btn-ghost btn-sm" onClick={() => { close?.(); goToPlace(b.id); }}>{fmtShort(b.price)} →</button>
          </div>
        ))}

        <div className="section-t">{L('NUNUA ARDHI', 'BUY LAND')}</div>
        {sale.map((p) => (
          <div key={p.id} className="inv-row sale">
            <span className="em">🌱</span>
            <div className="grow"><b>{p.name}</b><small>{p.district} · {L(`kupitia dalali (+${d.fees.remote * 100}%)`, `via an agent (+${d.fees.remote * 100}%)`)}</small></div>
            <button className="btn btn-green btn-sm" disabled={me.money < p.agentPrice} onClick={() => act(`/invest/plots/${p.id}/buy`, { icon: '🌱', title: L(`Nunua ${p.name}?`, `Buy ${p.name}?`), text: L(`${fmtTsh(p.agentPrice)} kupitia dalali. Thamani hupanda kila siku unayokishikilia.`, `${fmtTsh(p.agentPrice)} through an agent. It grows in value every day you hold it.`), ok: L('Nunua', 'Buy') }, () => L('🌱 Kiwanja ni chako!', '🌱 The plot is yours!'))}>{fmtShort(p.agentPrice)}</button>
          </div>
        ))}
        {d.forSale.length > 6 && <button className="btn btn-ghost btn-block btn-sm" onClick={() => setShowAll(!showAll)}>{showAll ? L('Onyesha machache', 'Show fewer') : L(`Onyesha vyote (${d.forSale.length})`, `Show all (${d.forSale.length})`)}</button>}
      </div>
    </>
  );
}
