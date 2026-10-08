import { useEffect, useState } from 'react';
import { NEEDS, fmtTsh, fmtShort, industryById } from '@shared/world.js';
import { useStore } from '../../store.js';
import { api } from '../../api.js';
import { AppHead } from '../Phone.jsx';
import { L, pick } from '../../i18n.js';
import { sfx } from '../../audio.js';

const icon = Object.fromEntries(NEEDS.map((n) => [n.id, n.icon]));

/** Shops: buy from other players' companies — they keep the profit. */
export function Maduka({ back, open }) {
  const me = useStore((s) => s.me);
  const run = useStore((s) => s.run);
  const [shops, setShops] = useState(null);
  const [sel, setSel] = useState(null);
  const load = () => api('/shops').then(setShops).catch(() => setShops([]));
  useEffect(() => { load(); }, []);
  const shop = shops?.find((s) => s.id === sel);
  const buy = async (item) => {
    const r = await run(`/shops/${shop.id}/buy`, { method: 'POST', body: { item: item.id } });
    if (r) { sfx('cash'); useStore.getState().toast(L(`${item.emoji} Umenunua ${item.name[0]} kwa ${fmtTsh(r.price)}`, `${item.emoji} Bought ${item.name[1]} for ${fmtTsh(r.price)}`)); load(); }
  };
  return (
    <>
      <AppHead title={shop ? shop.name : L('Maduka', 'Shops')} onBack={shop ? () => setSel(null) : back} />
      <div className="app-body">
        {!shops && <div className="small muted" style={{ padding: 12 }}>{L('Inapakia…', 'Loading…')}</div>}
        {shop ? (
          <>
            <div className="co-head" style={{ background: `linear-gradient(135deg, ${shop.color}, #111827)` }}>
              <div className="row" style={{ gap: 12, alignItems: 'center' }}>
                <span className="co-logo big">{shop.logo}</span>
                <div className="grow"><b>{shop.name}</b><small>{pick(industryById[shop.industry].name)} · @{shop.owner} · 🛍️ {shop.shop_sales}</small></div>
              </div>
            </div>
            <div className="section-t">{L('BIDHAA', 'ITEMS')}</div>
            {shop.items.map((i) => (
              <div key={i.id} className="inv-row">
                <span className="em">{i.emoji}</span>
                <div className="grow">
                  <b>{pick(i.name)}</b>
                  <small>{[...Object.entries(i.effects || {}).map(([k, v]) => `${icon[k] || ''}+${v}`), ...(i.health ? [`❤️+${i.health}`] : [])].join('  ')}</small>
                </div>
                <button className="btn btn-green btn-sm" disabled={shop.mine || me.money < i.price} onClick={() => buy(i)}>{i.price < 100_000 ? i.price.toLocaleString() : fmtShort(i.price)}</button>
              </div>
            ))}
            {shop.mine && <div className="hint center">{L('Hili ni duka lako — wateja ni wachezaji wengine.', 'This is your shop — your customers are other players.')}</div>}
          </>
        ) : shops && (
          <>
            <div className="co-intro">
              <b>{L('Nunua kwa wachezaji', 'Buy from players')}</b>
              <small>{L('Kila duka hapa linamilikiwa na mchezaji. Ukinunua, faida inaenda kwake.', 'Every shop here is run by a player. When you buy, they keep the profit.')}</small>
            </div>
            {shops.length === 0 && <div className="box small muted">{L('Hakuna duka lililo wazi bado. Kuwa wa kwanza!', 'No shops are open yet. Be the first!')}</div>}
            {shops.map((s) => (
              <button key={s.id} className="co-card" onClick={() => setSel(s.id)}>
                <span className="co-logo" style={{ background: s.color }}>{s.logo}</span>
                <span className="grow"><b>{s.name}</b><small>{pick(industryById[s.industry].name)} · @{s.owner}{s.mine ? ` · ${L('lako', 'yours')}` : ''}</small></span>
                <span className="co-amt"><b>🛍️ {s.shop_sales}</b><small>{L('kuanzia', 'from')} {fmtShort(Math.min(...s.items.map((i) => i.price)))}</small></span>
              </button>
            ))}
            <button className="co-start" style={{ marginTop: 8 }} onClick={() => open?.('kampuni')}><span className="em">🏢</span><span className="grow"><b>{L('Fungua duka lako', 'Open your own shop')}</b><small>{L('Anzisha kampuni, kisha fungua duka', 'Start a company, then open its shop')}</small></span><span className="go">→</span></button>
          </>
        )}
      </div>
    </>
  );
}
