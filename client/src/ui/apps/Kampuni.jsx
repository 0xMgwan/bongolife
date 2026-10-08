import { useEffect, useState } from 'react';
import { INDUSTRIES, industryById, COMPANY, SHOP_ITEMS, SHOP, fmtTsh, fmtShort } from '@shared/world.js';
import { useStore } from '../../store.js';
import { api } from '../../api.js';
import { AppHead } from '../Phone.jsx';
import { ask } from '../Confirm.jsx';
import { L, pick } from '../../i18n.js';
import { sfx } from '../../audio.js';

const PRICE_LABEL = { cheap: ['Bei nafuu', 'Cheap'], normal: ['Kawaida', 'Normal'], premium: ['Bei ya juu', 'Premium'] };
const sign = (n) => (n >= 0 ? `+${fmtShort(n)}` : `-${fmtShort(-n)}`);
const hrs = (ms) => Math.max(1, Math.ceil(ms / 3600_000));

function NewCompany({ onDone, onCancel }) {
  const me = useStore((s) => s.me);
  const run = useStore((s) => s.run);
  const [ind, setInd] = useState(INDUSTRIES[0].id);
  const def = industryById[ind];
  const [logo, setLogo] = useState(def.emoji);
  const [color, setColor] = useState(COMPANY.colors[0]);
  const [name, setName] = useState('');
  const pickInd = (id) => { setInd(id); setLogo(industryById[id].emoji); };
  const create = async () => {
    const r = await run('/companies', { method: 'POST', body: { name, logo, color, industry: ind } });
    if (r) { sfx('levelup'); useStore.getState().toast(L(`🏢 ${name} imefunguliwa!`, `🏢 ${name} is open for business!`)); onDone(r); }
  };
  return (
    <div className="co-new">
      <div className="row" style={{ gap: 10, alignItems: 'center' }}>
        <button className="round" onClick={onCancel} aria-label={L('Rudi', 'Back')}>←</button>
        <b style={{ fontSize: 18 }}>{L('Kampuni mpya', 'New company')}</b>
      </div>
      <div className="row" style={{ gap: 10, marginTop: 12, alignItems: 'center' }}>
        <span className="co-logo" style={{ background: color }}>{logo}</span>
        <input className="field" style={{ margin: 0, flex: 1 }} maxLength={28} placeholder={L('Jina la kampuni', 'Company name')} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="section-t">{L('SEKTA', 'INDUSTRY')}</div>
      <div className="co-inds">
        {INDUSTRIES.map((i) => (
          <button key={i.id} className={ind === i.id ? 'on' : ''} onClick={() => pickInd(i.id)}>
            <span className="em">{i.emoji}</span>
            <span><b>{pick(i.name)}</b><small>{L('kuanzia', 'from')} {fmtShort(i.cost)}</small></span>
          </button>
        ))}
      </div>
      <div className="hint">{pick(def.blurb)} {L(`Wafanyakazi hadi ${def.maxStaff} · mshahara ${fmtShort(def.wage)}/siku · kodi ${fmtShort(def.rent)}/siku.`, `Up to ${def.maxStaff} staff · wages ${fmtShort(def.wage)}/day · rent ${fmtShort(def.rent)}/day.`)}</div>
      <div className="section-t">{L('NEMBO', 'LOGO')}</div>
      <div className="co-logos">
        {[...new Set([...def.logos, '⭐', '🔥', '🦁', '🌍', '💎'])].map((e) => <button key={e} className={logo === e ? 'on' : ''} onClick={() => setLogo(e)}>{e}</button>)}
      </div>
      <div className="co-colors">
        {COMPANY.colors.map((c) => <button key={c} className={color === c ? 'on' : ''} style={{ background: c }} onClick={() => setColor(c)} aria-label={c} />)}
      </div>
      <button className="btn btn-green btn-block" style={{ marginTop: 14 }} disabled={name.trim().length < 2 || me.money < def.cost} onClick={create}>
        🏢 {L('Fungua kampuni', 'Open the company')} · {fmtTsh(def.cost)}
      </button>
      {me.money < def.cost && <div className="hint center red">{L('Mtaji hautoshi bado.', "You don't have enough capital yet.")}</div>}
    </div>
  );
}

function CompanyView({ c, onBack, onChanged }) {
  const run = useStore((s) => s.run);
  const [amt, setAmt] = useState('');
  const ind = c.industryDef;
  const act = async (action, value, confirm, ok) => {
    if (confirm && !(await ask(confirm))) return;
    const r = await run(`/companies/${c.id}`, { method: 'POST', body: { action, value } });
    if (r) { sfx(action === 'withdraw' || action === 'sell' ? 'cash' : 'pop'); onChanged(r.companies, r.sold); if (ok) useStore.getState().toast(ok); }
  };
  const last = c.days[0];
  const max = Math.max(1, ...c.days.map((d) => Math.abs(d.profit)));
  return (
    <>
      <div className="co-head" style={{ background: `linear-gradient(135deg, ${c.color}, #111827)` }}>
        <div className="row" style={{ gap: 12, alignItems: 'center' }}>
          <span className="co-logo big">{c.logo}</span>
          <div className="grow">
            <b>{c.name}</b>
            <small>{ind.emoji} {pick(ind.name)} · ⭐ {L('sifa', 'reputation')} {c.reputation}</small>
          </div>
        </div>
        <div className="co-bal">
          <small>{L('Akaunti ya kampuni', 'Company account')}</small>
          <b className={c.balance < 0 ? 'neg' : ''}>{fmtTsh(c.balance)}</b>
        </div>
        <input className="field co-amt-in" inputMode="numeric" placeholder={L('Kiasi (TSh)', 'Amount (TSh)')} value={amt} onChange={(e) => setAmt(e.target.value.replace(/\D/g, ''))} />
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn-white btn-sm grow" disabled={!amt || Number(amt) > c.balance} onClick={() => { act('withdraw', Number(amt), null, L('💸 Umetoa faida', '💸 Profit withdrawn')); setAmt(''); }}>{L('Toa', 'Withdraw')}</button>
          <button className="btn btn-sm grow co-dep" disabled={!amt} onClick={() => { act('deposit', Number(amt)); setAmt(''); }}>{L('Weka', 'Deposit')}</button>
        </div>
        <div className="small" style={{ opacity: 0.8, marginTop: 8 }}>{L(`Siku inayofuata ya biashara baada ya saa ${hrs(c.nextIn)}`, `Next trading day closes in ${hrs(c.nextIn)}h`)}</div>
      </div>

      <div className="section-t">{L('SIKU YA MWISHO', 'LAST DAY')}</div>
      {last ? (
        <div className="co-day">
          <div><small>{L('Wateja', 'Customers')}</small><b>{last.customers}</b></div>
          <div><small>{L('Mauzo', 'Sales')}</small><b>{fmtShort(last.revenue)}</b></div>
          <div><small>{L('Gharama', 'Costs')}</small><b>{fmtShort(last.costs)}</b></div>
          <div><small>{L('Faida', 'Profit')}</small><b className={last.profit >= 0 ? 'green' : 'red'}>{sign(last.profit)}</b></div>
          {last.eventText && <p>{pick(last.eventText)}</p>}
        </div>
      ) : <div className="box small muted">{L('Siku ya kwanza bado inaendelea — rudi kesho kuona ripoti.', "The first day is still running — come back tomorrow for the report.")}</div>}
      {c.days.length > 1 && (
        <div className="co-chart">
          {[...c.days].reverse().map((d) => <i key={d.id} className={d.profit >= 0 ? 'up' : 'dn'} style={{ height: `${Math.max(6, (Math.abs(d.profit) / max) * 100)}%` }} title={sign(d.profit)} />)}
        </div>
      )}

      <div className="section-t">{L('WAFANYAKAZI', 'STAFF')}</div>
      <div className="co-box">
        <div className="row between">
          <span><b>{c.staff}</b> / {ind.maxStaff} · {fmtShort(ind.wage)}/{L('siku kila mmoja', 'day each')}</span>
          <span className="row" style={{ gap: 6 }}>
            <button className="btn btn-ghost btn-sm" disabled={c.staff <= 0} onClick={() => act('fire')}>−</button>
            <button className="btn btn-green btn-sm" disabled={c.staff >= ind.maxStaff} onClick={() => act('hire')}>＋ {L('Ajiri', 'Hire')}</button>
          </span>
        </div>
        <small className={c.busy === 'ok' ? 'muted' : 'warn'}>{c.busy === 'understaffed' ? L('⚠️ Wateja wanaondoka — wafanyakazi hawatoshi.', '⚠️ Customers are walking out — not enough staff.') : c.busy === 'overstaffed' ? L('💤 Wafanyakazi wengi kuliko wateja — unalipa mishahara bure.', "💤 More staff than customers — you're paying wages for nothing.") : L('👌 Idadi ya wafanyakazi inalingana na wateja.', '👌 Staff level matches demand.')}</small>
      </div>

      <div className="section-t">{L('BEI', 'PRICES')}</div>
      <div className="seg">
        {Object.keys(COMPANY.prices).map((p) => <button key={p} className={c.price === p ? 'on' : ''} onClick={() => act('price', p)}>{pick(PRICE_LABEL[p])}</button>)}
      </div>
      <div className="hint" style={{ marginTop: 4 }}>{L('Bei nafuu huleta wateja wengi; bei ya juu inafaa ukishajenga sifa.', 'Cheap brings crowds; premium pays off once you have a reputation.')}</div>

      {SHOP_ITEMS[c.industry] && (
        <>
          <div className="section-t">{L('DUKA LA WACHEZAJI', 'PLAYER SHOP')}</div>
          <div className="co-box">
            <div className="row between">
              <span>🛍️ {c.shop_open ? L(`Liko wazi · mauzo ${c.shop_sales}`, `Open · ${c.shop_sales} sales`) : L('Wachezaji wengine wanunue kwako', 'Let other players buy from you')}</span>
              <button className={`btn btn-sm ${c.shop_open ? 'btn-ghost' : 'btn-green'}`} onClick={() => act('shop', !c.shop_open, null, c.shop_open ? L('Duka limefungwa', 'Shop closed') : L('🛍️ Duka liko wazi! Liko kwenye app ya Maduka.', '🛍️ Shop open! It’s listed in the Shops app.'))}>{c.shop_open ? L('Funga', 'Close') : L('Fungua duka', 'Open shop')}</button>
            </div>
            {c.shop_open ? (
              <>
                <div className="seg" style={{ margin: '4px 0 0' }}>
                  {SHOP.markups.map((m) => <button key={m} className={c.shop_markup === m ? 'on' : ''} onClick={() => act('markup', m)}>×{m}</button>)}
                </div>
                {SHOP_ITEMS[c.industry].map((i) => {
                  const price = Math.round((i.price * c.shop_markup) / 100) * 100;
                  return <small key={i.id} className="muted">{i.emoji} {pick(i.name)} · {fmtShort(price)} · {L('faida', 'profit')} {fmtShort(price - Math.round(i.price * SHOP.stockCost))}</small>;
                })}
                <small className="muted">{L('Bei juu = faida zaidi kwa kila mauzo, lakini wanunuzi huchagua maduka ya bei nafuu.', 'Higher markup = more profit per sale, but buyers shop around.')}</small>
              </>
            ) : null}
          </div>
        </>
      )}

      <div className="section-t">{L('MATANGAZO', 'MARKETING')}</div>
      <div className="co-box">
        <div className="row between">
          <span>📣 {L(`+${COMPANY.marketing.boost * 100}% wateja kwa siku ${COMPANY.marketing.days}`, `+${COMPANY.marketing.boost * 100}% customers for ${COMPANY.marketing.days} days`)}</span>
          <button className="btn btn-green btn-sm" disabled={c.boost_until > Date.now()} onClick={() => act('market', null, null, L('📣 Kampeni imeanza!', '📣 Campaign launched!'))}>{c.boost_until > Date.now() ? L('Inaendelea', 'Running') : fmtShort(c.marketingCost)}</button>
        </div>
      </div>

      <button className="btn btn-ghost btn-block" style={{ marginTop: 14 }} onClick={() => act('sell', null, { icon: '🏢', title: L(`Uza ${c.name}?`, `Sell ${c.name}?`), text: L(`Utapata ${fmtTsh(c.sellFor)} (nusu ya mtaji + akaunti).`, `You'll get ${fmtTsh(c.sellFor)} (half the startup cost + the account).`), ok: L('Uza', 'Sell'), danger: true }, L('🏢 Kampuni imeuzwa', '🏢 Company sold'))}>{L('Uza kampuni', 'Sell the company')}</button>
      <button className="btn btn-ghost btn-block btn-sm" style={{ marginTop: 6 }} onClick={onBack}>← {L('Kampuni zangu', 'My companies')}</button>
    </>
  );
}

/** Company: start and run your own business (Lagos Life style). */
export function Kampuni({ back }) {
  const [list, setList] = useState(null);
  const [mode, setMode] = useState('list'); // list | new | <id>
  useEffect(() => { api('/companies').then(setList).catch(() => setList([])); }, []);
  const open = list?.find((c) => String(c.id) === String(mode));
  return (
    <>
      <AppHead title={L('Kampuni', 'Company')} onBack={back} />
      <div className="app-body">
        {!list && <div className="small muted" style={{ padding: 12 }}>{L('Inapakia…', 'Loading…')}</div>}
        {list && mode === 'new' && <NewCompany onCancel={() => setMode('list')} onDone={(r) => { setList(r.companies); setMode(String(r.id)); }} />}
        {list && open && <CompanyView c={open} onBack={() => setMode('list')} onChanged={(cs, sold) => { setList(cs); if (sold) setMode('list'); }} />}
        {list && mode === 'list' && (
          <>
            <div className="co-intro">
              <b>{L('Kuwa bosi wako mwenyewe', 'Be your own boss')}</b>
              <small>{L('Ajiri watu, panga bei, fanya matangazo. Kila jioni kampuni inafanya biashara ya siku — faida inaingia kwenye akaunti yake.', 'Hire staff, set prices, run ads. Every evening the company trades a day — profit lands in its account.')}</small>
            </div>
            {list.map((c) => (
              <button key={c.id} className="co-card" onClick={() => setMode(String(c.id))}>
                <span className="co-logo" style={{ background: c.color }}>{c.logo}</span>
                <span className="grow">
                  <b>{c.name}</b>
                  <small>{pick(c.industryDef.name)} · {c.staff} {L('wafanyakazi', 'staff')} · ⭐ {c.reputation}</small>
                </span>
                <span className="co-amt">
                  <b className={c.balance < 0 ? 'red' : ''}>{fmtShort(c.balance)}</b>
                  {c.days[0] && <small className={c.days[0].profit >= 0 ? 'green' : 'red'}>{sign(c.days[0].profit)}</small>}
                </span>
              </button>
            ))}
            {list.length < COMPANY.max
              ? <button className="co-start" onClick={() => setMode('new')}><span className="em">🏢</span><span className="grow"><b>{L('Anzisha kampuni', 'Start a company')}: {L('kuanzia', 'from')} {fmtShort(INDUSTRIES[0].cost)}</b><small>{L('Wafanyakazi, bei, wateja kila jioni', 'Staff, prices, customers every evening')}</small></span><span className="go">{L('Fungua', 'Open')}</span></button>
              : <div className="hint center">{L(`Kikomo ni kampuni ${COMPANY.max}.`, `You can run up to ${COMPANY.max} companies.`)}</div>}
          </>
        )}
      </div>
    </>
  );
}
