// Soko la Mali: buy and sell property between players — fixed prices, auctions with bids, and
// offers on anything someone owns.
import { useEffect, useState } from 'react';
import { fmtTsh, fmtShort, plotById, placeById, buildingById } from '@shared/world.js';
import { useStore } from '../../store.js';
import { api } from '../../api.js';
import { AppHead } from '../Phone.jsx';
import { ask } from '../Confirm.jsx';
import { L } from '../../i18n.js';
import { sfx } from '../../audio.js';

const timeLeft = (t) => {
  const ms = t - Date.now();
  if (ms <= 0) return L('inaisha…', 'closing…');
  const m = Math.ceil(ms / 60_000);
  if (m < 60) return L(`dk ${m}`, `${m}m`);
  const h = Math.floor(m / 60);
  return h < 24 ? L(`saa ${h} dk ${m % 60}`, `${h}h ${m % 60}m`) : L(`siku ${Math.floor(h / 24)}`, `${Math.floor(h / 24)}d ${h % 24}h`);
};
const assetName = (a) => L(a.name, a.nameEn || a.name);

/** One listing: what it is, the price/auction, and the buy/bid buttons. */
export function ListingCard({ l, me, onChange, leading }) {
  const run = useStore((s) => s.run);
  const [amt, setAmt] = useState(l.minBid || 0);
  useEffect(() => setAmt(l.minBid || 0), [l.minBid]);
  const a = l.asset;
  const mine = l.seller_id === me.id;
  const buy = async () => {
    if (!(await ask({ icon: '🔑', title: L(`Nunua ${a.name}?`, `Buy ${assetName(a)}?`), text: fmtTsh(l.price), ok: L('Nunua', 'Buy') }))) return;
    const r = await run(`/market/${l.id}/buy`, { method: 'POST' });
    if (r) { sfx('levelup'); onChange?.(r); }
  };
  const bid = async () => {
    const r = await run(`/market/${l.id}/bid`, { method: 'POST', body: { amount: amt } });
    if (r) { sfx('cash'); useStore.getState().toast(L(`🔨 Zabuni yako: ${fmtTsh(amt)} — pesa imeshikiliwa hadi mnada uishe.`, `🔨 You bid ${fmtTsh(amt)} — held until the auction ends.`)); onChange?.(r); }
  };
  const cancel = async () => {
    const r = await run(`/market/${l.id}/cancel`, { method: 'POST' });
    if (r) onChange?.(r);
  };
  return (
    <div className={`lux-card mkt-card ${l.status !== 'open' ? 'closed' : ''}`} style={{ '--lux': l.start_bid ? '#f59e0b' : '#22c55e' }}>
      <div className="lux-top">
        <span className="lux-em">{a.emoji}</span>
        <div className="grow">
          <b>{a.building ? L(a.building[0], a.building[1]) : assetName(a)}</b>
          <small>📍 {assetName(a)}{a.area && a.building ? ` · ${a.area}` : ''}{a.income ? ` · +${fmtShort(a.income)}/${L('saa', 'hr')}` : ''}</small>
          <small style={{ display: 'block' }}>{L('Thamani', 'Est. value')} ~{fmtShort(a.value)} · {L('muuzaji', 'seller')} @{l.seller || (mine ? me.username : '')}</small>
        </div>
      </div>
      {l.status === 'open' ? (
        <>
          <div className="mkt-row">
            {l.price && <span className="mkt-price">🔑 {fmtShort(l.price)}</span>}
            {l.start_bid && <span className="mkt-bid">🔨 {l.top_bid ? fmtShort(l.top_bid) : L(`kuanzia ${fmtShort(l.start_bid)}`, `from ${fmtShort(l.start_bid)}`)} · {l.bids} {L('zabuni', 'bids')} · ⏱ {timeLeft(l.ends_at)}</span>}
            {leading && <span className="mkt-lead">🏆 {L('Unaongoza', 'Leading')}</span>}
          </div>
          {mine ? (
            !l.top_bidder && <button className="btn btn-ghost btn-sm" onClick={cancel}>{L('Ondoa sokoni', 'Remove listing')}</button>
          ) : (
            <div className="row" style={{ gap: 6, marginTop: 8 }}>
              {l.start_bid && (
                <>
                  <input className="input grow" type="number" min={l.minBid} step={100000} value={amt} onChange={(e) => setAmt(Math.floor(+e.target.value || 0))} />
                  <button className="btn btn-amber btn-sm" disabled={me.money < amt || amt < l.minBid} onClick={bid}>🔨 {L('Zabuni', 'Bid')}</button>
                </>
              )}
              {l.price && <button className="btn btn-green btn-sm" disabled={me.money < l.price} onClick={buy}>🔑 {L('Nunua', 'Buy')}</button>}
            </div>
          )}
        </>
      ) : (
        <small className="muted">{l.status === 'sold' ? L(`✅ Imeuzwa ${fmtShort(l.final)}`, `✅ Sold for ${fmtShort(l.final)}`) : l.status === 'expired' ? L('⌛ Mnada uliisha bila zabuni', '⌛ Ended with no bids') : L('Imeondolewa', 'Removed')}</small>
      )}
    </div>
  );
}

function SellForm({ me, onDone }) {
  const run = useStore((s) => s.run);
  const assets = [
    ...(me.plots || []).map((p) => ({ kind: 'plot', id: p.id, label: `${p.building ? buildingById[p.building]?.emoji || '🏠' : '🏞️'} ${p.building ? L(buildingById[p.building]?.name, buildingById[p.building]?.nameEn) : L('Kiwanja', 'Plot')} · ${L(plotById[p.id]?.name, plotById[p.id]?.nameEn)}` })),
    ...(me.businesses || []).map((b) => ({ kind: 'biz', id: b.id, label: `${placeById[b.id]?.icon || '🏪'} ${placeById[b.id]?.business?.label || placeById[b.id]?.name}` })),
  ];
  const [pick, setPick] = useState(assets[0] ? `${assets[0].kind}:${assets[0].id}` : '');
  const [mode, setMode] = useState('auction');
  const [price, setPrice] = useState('');
  const [start, setStart] = useState('');
  const [hours, setHours] = useState(24);
  if (!assets.length) return <div className="box small muted">{L('Huna mali ya kuuza bado.', 'You have no property to sell yet.')}</div>;
  const submit = async () => {
    const [kind, id] = pick.split(':');
    const body = { kind, id, hours, price: mode !== 'auction' ? Number(price) : null, startBid: mode !== 'fixed' ? Number(start) : null };
    const r = await run('/market/list', { method: 'POST', body });
    if (r) { sfx('pop'); useStore.getState().toast(L('🏷️ Iko sokoni!', '🏷️ Listed!')); onDone(r); }
  };
  return (
    <div className="box">
      <select className="input" value={pick} onChange={(e) => setPick(e.target.value)}>
        {assets.map((a) => <option key={`${a.kind}:${a.id}`} value={`${a.kind}:${a.id}`}>{a.label}</option>)}
      </select>
      <div className="chips" style={{ margin: '8px 0' }}>
        {[['auction', '🔨', ['Mnada', 'Auction']], ['fixed', '🔑', ['Bei maalum', 'Fixed price']], ['both', '⚡', ['Vyote', 'Both']]].map(([k, e, n]) => <button key={k} className={`chip ${mode === k ? 'on' : ''}`} onClick={() => setMode(k)}>{e} {L(n[0], n[1])}</button>)}
      </div>
      {mode !== 'auction' && <input className="input" type="number" placeholder={L('Bei ya "nunua sasa" (TSh)', 'Buy-now price (TSh)')} value={price} onChange={(e) => setPrice(e.target.value)} />}
      {mode !== 'fixed' && (
        <>
          <input className="input" style={{ marginTop: 6 }} type="number" placeholder={L('Zabuni ya kuanzia (TSh)', 'Starting bid (TSh)')} value={start} onChange={(e) => setStart(e.target.value)} />
          <div className="chips" style={{ margin: '8px 0' }}>
            {[1, 6, 24, 72].map((h) => <button key={h} className={`chip ${hours === h ? 'on' : ''}`} onClick={() => setHours(h)}>⏱ {h < 24 ? L(`saa ${h}`, `${h}h`) : L(`siku ${h / 24}`, `${h / 24}d`)}</button>)}
          </div>
        </>
      )}
      <button className="btn btn-green btn-block" style={{ marginTop: 8 }} onClick={submit}>🏷️ {L('Weka sokoni', 'List it')}</button>
      <div className="hint">{L('Muuzaji analipa ada ya 3%. Zabuni zinashikiliwa hadi mnada uishe; aliyezidiwa anarudishiwa pesa mara moja.', 'The seller pays a 3% fee. Bids are held until the auction ends; outbid players get their money back at once.')}</div>
    </div>
  );
}

export function SokoMali({ back }) {
  const me = useStore((s) => s.me);
  const run = useStore((s) => s.run);
  const [d, setD] = useState(null);
  const [tab, setTab] = useState('buy');
  const load = () => api('/market').then(setD).catch(() => {});
  useEffect(() => {
    load();
    const t = setInterval(load, 20_000);
    return () => clearInterval(t);
  }, []);
  const set = (r) => { if (r?.listings) setD(r); else load(); useStore.getState().refreshMe?.().catch(() => {}); };
  if (!d) return (<><AppHead title={L('Soko la Mali', 'Property market')} onBack={back} /><div className="app-body"><div className="small muted" style={{ padding: 12 }}>{L('Inapakia…', 'Loading…')}</div></div></>);
  const others = d.listings.filter((l) => l.seller_id !== me.id);
  const answer = async (o, action) => {
    if (action === 'accept' && !(await ask({ icon: '🤝', title: L(`Uza ${o.asset.name} kwa @${o.who}?`, `Sell ${assetName(o.asset)} to @${o.who}?`), text: `${fmtTsh(o.amount)} · ${L('ada 3%', '3% fee')}`, ok: L('Kubali', 'Accept') }))) return;
    const r = await run(`/market/offer/${o.id}/${action}`, { method: 'POST' });
    if (r) { sfx(action === 'accept' ? 'cash' : 'click'); set(r); }
  };
  return (
    <>
      <AppHead title={L('Soko la Mali · Nunua & Uza', 'Property market · Buy & sell')} onBack={back} />
      <div className="app-body">
        <div className="mt-hero" style={{ background: 'linear-gradient(135deg, #064e3b, #047857 55%, #f59e0b)' }}>
          <b>{L('Mali kwa mali 🏘️', 'Property, player to player 🏘️')}</b>
          <small>{L('Nunua viwanja, nyumba, hoteli, viwanda na biashara kutoka kwa wachezaji wengine — kwa bei, kwa mnada, au toa ofa.', 'Buy plots, homes, hotels, factories and businesses from other players — fixed price, auction, or make an offer.')}</small>
        </div>
        <div className="seg" style={{ marginTop: 10 }}>
          <button className={tab === 'buy' ? 'on' : ''} onClick={() => setTab('buy')}>🛒 {L('Inauzwa', 'For sale')} ({others.length})</button>
          <button className={tab === 'sell' ? 'on' : ''} onClick={() => setTab('sell')}>🏷️ {L('Uza', 'Sell')}</button>
          <button className={tab === 'offers' ? 'on' : ''} onClick={() => setTab('offers')}>💼 {L('Ofa', 'Offers')}{d.offersIn.length ? ` (${d.offersIn.length})` : ''}</button>
        </div>
        {tab === 'buy' && (
          <>
            {!others.length && <div className="box small muted">{L('Hakuna mali sokoni sasa hivi. Gusa kiwanja cha mtu kwenye ramani ili umtolee ofa!', 'Nothing listed right now. Tap anyone’s plot on the map to make them an offer!')}</div>}
            {others.map((l) => <ListingCard key={l.id} l={l} me={me} leading={d.leading.includes(l.id)} onChange={set} />)}
          </>
        )}
        {tab === 'sell' && (
          <>
            <SellForm me={me} onDone={set} />
            {d.mine.length > 0 && <div className="section-t">{L('MATANGAZO YAKO', 'YOUR LISTINGS')}</div>}
            {d.mine.map((l) => <ListingCard key={l.id} l={l} me={me} onChange={set} />)}
          </>
        )}
        {tab === 'offers' && (
          <>
            <div className="section-t">{L('OFA KWAKO', 'OFFERS FOR YOU')}</div>
            {!d.offersIn.length && <div className="box small muted">{L('Hakuna ofa bado.', 'No offers yet.')}</div>}
            {d.offersIn.map((o) => (
              <div key={o.id} className="inv-row">
                <span className="em">{o.asset.emoji}</span>
                <div className="grow"><b>@{o.who} · {fmtShort(o.amount)}</b><small style={{ display: 'block' }}>{o.asset.building ? L(o.asset.building[0], o.asset.building[1]) : assetName(o.asset)} · {L('thamani', 'value')} ~{fmtShort(o.asset.value)}</small></div>
                <button className="btn btn-green btn-sm" onClick={() => answer(o, 'accept')}>✓</button>
                <button className="btn btn-ghost btn-sm" onClick={() => answer(o, 'decline')}>✕</button>
              </div>
            ))}
            <div className="section-t">{L('OFA ZAKO', 'YOUR OFFERS')}</div>
            {!d.offersOut.length && <div className="box small muted">{L('Gusa kiwanja au biashara ya mtu ili utoe ofa.', 'Tap someone’s plot or business to make an offer.')}</div>}
            {d.offersOut.map((o) => (
              <div key={o.id} className="inv-row">
                <span className="em">{o.asset.emoji}</span>
                <div className="grow"><b>{fmtShort(o.amount)} → @{o.who}</b><small style={{ display: 'block' }}>{o.asset.building ? L(o.asset.building[0], o.asset.building[1]) : assetName(o.asset)}</small></div>
                <button className="btn btn-ghost btn-sm" onClick={() => answer(o, 'withdraw')}>{L('Ondoa', 'Withdraw')}</button>
              </div>
            ))}
          </>
        )}
      </div>
    </>
  );
}

/** On someone else's plot/business card: the listing (buy/bid) or "make an offer". */
export function PropertyDeal({ kind, id }) {
  const me = useStore((s) => s.me);
  const run = useStore((s) => s.run);
  const [d, setD] = useState(null);
  const [amt, setAmt] = useState('');
  const load = () => api(`/market/asset/${kind}/${id}`).then(setD).catch(() => {});
  useEffect(() => { load(); }, [kind, id]);
  if (!d) return null;
  const offer = async () => {
    const r = await run('/market/offer', { method: 'POST', body: { kind, id, amount: Number(amt) } });
    if (r) { sfx('pop'); setAmt(''); useStore.getState().toast(L('💼 Ofa imetumwa — mmiliki ataamua.', '💼 Offer sent — the owner will decide.')); }
  };
  return (
    <div className="deal-box">
      {d.listing ? (
        <ListingCard l={d.listing} me={me} onChange={() => { load(); useStore.getState().refreshMe?.().catch(() => {}); }} />
      ) : (
        <>
          <div className="small"><b>💼 {L('Toa ofa ya kununua', 'Make an offer to buy')}</b> · {L('thamani', 'est. value')} ~{fmtShort(d.asset.value)}</div>
          <div className="row" style={{ gap: 6, marginTop: 6 }}>
            <input className="input grow" type="number" placeholder={L('Kiasi (TSh)', 'Amount (TSh)')} value={amt} onChange={(e) => setAmt(e.target.value)} />
            <button className="btn btn-green btn-sm" disabled={!amt || Number(amt) > me.money} onClick={offer}>{L('Tuma ofa', 'Send offer')}</button>
          </div>
        </>
      )}
    </div>
  );
}
