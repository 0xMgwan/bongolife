// Soko la Hisa: the Dar stock exchange. Prices move every few minutes, news shakes sectors,
// and holders get a small dividend each day.
import { useEffect, useState } from 'react';
import { fmtTsh, fmtShort } from '@shared/world.js';
import { useStore } from '../../store.js';
import { api } from '../../api.js';
import { AppHead } from '../Phone.jsx';
import { L } from '../../i18n.js';
import { sfx } from '../../audio.js';

const pct = (x) => `${x >= 0 ? '+' : ''}${(x * 100).toFixed(1)}%`;
function Spark({ data, w = 84, h = 28, up }) {
  if (!data || data.length < 2) return <svg width={w} height={h} />;
  const lo = Math.min(...data);
  const hi = Math.max(...data);
  const pts = data.map((v, i) => `${((i / (data.length - 1)) * w).toFixed(1)},${(h - 2 - ((v - lo) / (hi - lo || 1)) * (h - 4)).toFixed(1)}`).join(' ');
  return <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}><polyline points={pts} fill="none" stroke={up ? '#16a34a' : '#dc2626'} strokeWidth="2" strokeLinejoin="round" /></svg>;
}

export function Hisa({ back }) {
  const me = useStore((s) => s.me);
  const run = useStore((s) => s.run);
  const [d, setD] = useState(null);
  const [sel, setSel] = useState(null);
  const [qty, setQty] = useState(10);
  const load = () => api('/stocks').then(setD).catch(() => {});
  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, []);
  if (!d) return (<><AppHead title={L('Soko la Hisa', 'Stock Exchange')} onBack={back} /><div className="app-body"><div className="small muted" style={{ padding: 12 }}>{L('Inapakia…', 'Loading…')}</div></div></>);
  const s = sel && d.stocks.find((x) => x.id === sel);
  const trade = async (side) => {
    const r = await run('/stocks/trade', { method: 'POST', body: { sym: s.id, side, qty } });
    if (r) {
      setD(r);
      sfx('cash');
      useStore.getState().toast(side === 'buy' ? L(`📈 Umenunua hisa ${qty} za ${s.id}`, `📈 Bought ${qty} ${s.id} shares`) : L(`📉 Umeuza hisa ${qty} za ${s.id}`, `📉 Sold ${qty} ${s.id} shares`));
    }
  };
  const max = s ? Math.max(1, Math.floor(me.money / (s.price * (1 + d.rules.feePct)))) : 0;
  return (
    <>
      <AppHead title={L('Soko la Hisa · DSE', 'Stock Exchange · DSE')} onBack={s ? () => setSel(null) : back} />
      <div className="app-body">
        <div className="inv-card">
          <div className="ic-k">{L('HISA ZAKO', 'YOUR PORTFOLIO')}</div>
          <div className="ic-v">{fmtTsh(Math.round(d.value))}</div>
          <div className="ic-s" style={{ color: d.gain >= 0 ? '#bbf7d0' : '#fecaca' }}>{d.gain >= 0 ? '▲' : '▼'} {fmtTsh(Math.round(Math.abs(d.gain)))} {L('faida/hasara', 'gain/loss')}</div>
          <div className="ic-note">{L('Bei zinabadilika kila dakika 5. Habari za soko zinatikisa sekta. Gawio hulipwa kila siku kwa wenye hisa.', 'Prices move every 5 minutes. Market news shakes whole sectors. Holders get a dividend every day.')}</div>
        </div>
        {s ? (
          <div className="stk-detail">
            <div className="row" style={{ alignItems: 'center', gap: 10, margin: '10px 0' }}>
              <span style={{ fontSize: 30 }}>{s.emoji}</span>
              <div className="grow"><b>{s.name}</b><small className="muted" style={{ display: 'block' }}>{L(s.sector[0], s.sector[1])} · {L('gawio', 'dividend')} {(s.div * 100).toFixed(2)}%/{L('siku', 'day')}</small></div>
              <div style={{ textAlign: 'right' }}><b>{fmtTsh(s.price)}</b><small style={{ display: 'block', color: s.change >= 0 ? '#16a34a' : '#dc2626' }}>{pct(s.change)}</small></div>
            </div>
            <div className="box" style={{ padding: 6 }}><Spark data={s.history} w={300} h={110} up={s.change >= 0} /></div>
            {s.qty > 0 && <div className="small" style={{ margin: '8px 0' }}>{L('Unazo', 'You hold')} <b>{s.qty}</b> · {L('wastani', 'avg')} {fmtTsh(Math.round(s.avg))} · <b style={{ color: s.price >= s.avg ? '#16a34a' : '#dc2626' }}>{pct((s.price - s.avg) / s.avg)}</b></div>}
            <div className="chips" style={{ margin: '10px 0' }}>
              {[1, 10, 100, 1000].map((n) => <button key={n} className={`chip ${qty === n ? 'on' : ''}`} onClick={() => setQty(n)}>{n}</button>)}
              <button className={`chip ${qty === max ? 'on' : ''}`} onClick={() => setQty(max)}>MAX {max}</button>
            </div>
            <input className="input" type="number" min="1" value={qty} onChange={(e) => setQty(Math.max(1, Math.floor(+e.target.value || 1)))} />
            <div className="small muted" style={{ margin: '6px 0' }}>{L('Thamani', 'Value')} {fmtTsh(Math.round(qty * s.price))} · {L('ada', 'fee')} {fmtTsh(Math.max(500, Math.round(qty * s.price * d.rules.feePct)))}</div>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn btn-green grow" disabled={me.money < qty * s.price} onClick={() => trade('buy')}>{L('Nunua', 'Buy')}</button>
              <button className="btn btn-red grow" disabled={s.qty < qty} onClick={() => trade('sell')}>{L('Uza', 'Sell')}</button>
            </div>
          </div>
        ) : (
          d.stocks.map((x) => (
            <button key={x.id} className="inv-row stk-row" onClick={() => { setSel(x.id); setQty(10); }}>
              <span className="em">{x.emoji}</span>
              <div className="grow" style={{ textAlign: 'left' }}><b>{x.id}</b><small>{x.name}{x.qty ? ` · ${L('unazo', 'own')} ${fmtShort(x.qty)}` : ''}</small></div>
              <Spark data={x.history.slice(-30)} up={x.change >= 0} />
              <div style={{ textAlign: 'right', minWidth: 70 }}><b>{fmtShort(x.price)}</b><small style={{ display: 'block', color: x.change >= 0 ? '#16a34a' : '#dc2626' }}>{pct(x.change)}</small></div>
            </button>
          ))
        )}
      </div>
    </>
  );
}
