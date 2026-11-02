// Mikopo: borrow at the bank (secured by plots/businesses, or unsecured), repay any time.
import { useEffect, useState } from 'react';
import { fmtTsh, fmtShort } from '@shared/world.js';
import { useStore } from '../../store.js';
import { api } from '../../api.js';
import { AppHead } from '../Phone.jsx';
import { ask } from '../Confirm.jsx';
import { goToPlace } from '../../nav.js';
import { L } from '../../i18n.js';
import { sfx } from '../../audio.js';

const left = (ms) => {
  const h = Math.max(0, Math.round(ms / 3_600_000));
  return h >= 48 ? L(`siku ${Math.round(h / 24)}`, `${Math.round(h / 24)} days`) : L(`saa ${h}`, `${h}h`);
};

function LoanCard({ loan, me, repay }) {
  const late = loan.dueAt < Date.now();
  const pct = Math.min(100, (loan.paid / (loan.paid + loan.balance)) * 100);
  const [amt, setAmt] = useState('');
  return (
    <div className={`loan-card ${late ? 'late' : ''}`}>
      <div className="row between"><b>🏦 {L('Mkopo wako', 'Your loan')}</b><span className="tag">{loan.status === 'defaulted' ? L('Umeshindikana', 'Defaulted') : late ? L(`Umechelewa siku ${loan.daysLate}`, `${loan.daysLate} day(s) late`) : L(`Unaiva baada ya ${left(loan.dueAt - Date.now())}`, `Due in ${left(loan.dueAt - Date.now())}`)}</span></div>
      <div className="loan-big">{fmtTsh(loan.balance)}<small>{L(' bado kulipa', ' left to pay')}</small></div>
      <div className="fam-joy"><i style={{ width: `${pct}%` }} /></div>
      <small className="muted">{L(`Ulikopa ${fmtTsh(loan.principal)} · riba ${Math.round(loan.rate * 100)}% · umelipa ${fmtTsh(loan.paid)}`, `Borrowed ${fmtTsh(loan.principal)} · ${Math.round(loan.rate * 100)}% interest · paid ${fmtTsh(loan.paid)}`)}</small>
      {loan.collateral.length > 0 && <small className="muted">🔒 {L('Dhamana', 'Collateral')}: {loan.collateral.map((c) => c.name).join(', ')}</small>}
      {late && <small className="red">⚠️ {L('Ada ya kuchelewa 5% kila siku. Ukichelewa zaidi benki itakata wallet na kutaifisha dhamana.', 'A 5% late fee is added daily. Stay late and the bank takes your wallet cash and seizes the collateral.')}</small>}
      <div className="row" style={{ gap: 6, marginTop: 8 }}>
        <input className="input grow" inputMode="numeric" placeholder={L('Kiasi (si lazima)', 'Amount (optional)')} value={amt} onChange={(e) => setAmt(e.target.value.replace(/\D/g, ''))} />
        <button className="btn btn-dark btn-sm" disabled={me.money <= 0} onClick={() => repay(Number(amt) || null).then(() => setAmt(''))}>{L('Lipa', 'Pay')}</button>
      </div>
      <button className="btn btn-green btn-block btn-sm" style={{ marginTop: 6 }} disabled={me.money < loan.balance} onClick={() => repay(null)}>✅ {L('Lipa deni lote', 'Pay it all off')} · {fmtShort(loan.balance)}</button>
    </div>
  );
}

export function Mkopo({ back, close }) {
  const run = useStore((s) => s.run);
  const me = useStore((s) => s.me);
  const [d, setD] = useState(null);
  const [days, setDays] = useState(7);
  const [picked, setPicked] = useState([]);
  const [amount, setAmount] = useState('');
  const load = () => api('/loans').then(setD).catch(() => {});
  useEffect(() => { load(); }, []);
  if (!d) return (<><AppHead title={L('Mikopo', 'Loans')} onBack={back} /><div className="app-body"><div className="small muted" style={{ padding: 12 }}>{L('Inapakia…', 'Loading…')}</div></div></>);
  const key = (a) => `${a.kind}:${a.id}`;
  const chosen = d.assets.filter((a) => picked.includes(key(a)));
  const secured = chosen.length > 0;
  const max = secured ? Math.floor(chosen.reduce((s, a) => s + a.value, 0) * d.rules.ltv) : d.unsecured;
  const term = d.rules.terms.find((t) => t.days === days);
  const rate = term.rate + (secured ? 0 : d.rules.unsecuredExtra);
  const amt = Math.min(max, Number(amount) || max);
  const take = async () => {
    if (!(await ask({ icon: '🏦', title: L(`Kopa ${fmtTsh(amt)}?`, `Borrow ${fmtTsh(amt)}?`), text: L(`Utarudisha ${fmtTsh(Math.round(amt * (1 + rate)))} ndani ya siku ${days}.${secured ? ` Dhamana: ${chosen.map((a) => a.name).join(', ')} — usipolipa, benki itaichukua.` : ''}`, `You'll repay ${fmtTsh(Math.round(amt * (1 + rate)))} within ${days} days.${secured ? ` Collateral: ${chosen.map((a) => a.name).join(', ')} — if you don't pay, the bank takes it.` : ''}`), ok: L('Kopa', 'Borrow') }))) return;
    const r = await run('/loans/take', { method: 'POST', body: { amount: amt, days, collateral: chosen.map(({ kind, id }) => ({ kind, id })) } });
    if (r) { setD(r); setPicked([]); setAmount(''); sfx('cash'); useStore.getState().toast(L(`🏦 ${fmtTsh(r.amount)} zimeingia kwenye wallet!`, `🏦 ${fmtTsh(r.amount)} is in your wallet!`)); }
  };
  const repay = async (amount) => {
    const r = await run('/loans/repay', { method: 'POST', body: { amount } });
    if (r) { setD(r); sfx(r.done ? 'levelup' : 'pop'); useStore.getState().toast(r.done ? L('🎉 Umemaliza mkopo! Dhamana yako iko huru.', '🎉 Loan paid off! Your collateral is free.') : L(`✅ Umelipa ${fmtTsh(r.paid)}`, `✅ Paid ${fmtTsh(r.paid)}`)); }
  };
  return (
    <>
      <AppHead title={L('Mikopo · NMB', 'Loans · NMB')} onBack={back} />
      <div className="app-body">
        {d.loan ? <LoanCard loan={d.loan} me={me} repay={repay} /> : (
          <>
            <div className="loan-hero">
              <b>🏦 {L('Kopa benki', 'Borrow from the bank')}</b>
              <small>{L('Weka viwanja au biashara kama dhamana upate mkopo mkubwa kwa riba ndogo — au kopa kidogo bila dhamana.', 'Pledge plots or businesses as collateral for a bigger loan at a lower rate — or borrow a little without collateral.')}</small>
            </div>
            {!d.atBank && (
              <div className="box small" style={{ background: '#fef3c7' }}>
                📍 {L('Mikopo inatolewa benki tu. Nenda NMB Posta kisha ufungue tena.', 'Loans are only given at the bank. Go to NMB Posta, then open this again.')}
                <button className="btn btn-dark btn-sm btn-block" style={{ marginTop: 8 }} onClick={() => { close?.(); goToPlace('bank'); }}>🏦 {L('Nenda NMB Posta', 'Go to NMB Posta')}</button>
              </div>
            )}
            <div className="section-t">{L('DHAMANA (SI LAZIMA)', 'COLLATERAL (OPTIONAL)')}</div>
            {!d.assets.length && <small className="muted">{L('Huna viwanja wala biashara — unaweza kukopa bila dhamana tu.', "You don't own plots or businesses — you can only borrow unsecured.")}</small>}
            {d.assets.map((a) => (
              <label key={key(a)} className={`inv-row loan-asset ${a.listed ? 'off' : ''}`}>
                <input type="checkbox" disabled={a.listed} checked={picked.includes(key(a))} onChange={(e) => setPicked((p) => (e.target.checked ? [...p, key(a)] : p.filter((x) => x !== key(a))))} />
                <span className="em">{a.kind === 'plot' ? '🏞️' : '🏪'}</span>
                <div className="grow"><b>{a.name}</b><small>{L('Thamani', 'Value')} {fmtShort(a.value)}{a.listed ? L(' · iko sokoni', ' · listed for sale') : ''}</small></div>
              </label>
            ))}
            <div className="section-t">{L('MUDA', 'TERM')}</div>
            <div className="seg">
              {d.rules.terms.map((t) => <button key={t.days} className={days === t.days ? 'on' : ''} onClick={() => setDays(t.days)}>{L(`Siku ${t.days}`, `${t.days} days`)} · {Math.round((t.rate + (secured ? 0 : d.rules.unsecuredExtra)) * 100)}%</button>)}
            </div>
            <div className="box" style={{ marginTop: 10 }}>
              <div className="row between"><small>{secured ? L(`Kikomo (${Math.round(d.rules.ltv * 100)}% ya dhamana)`, `Limit (${Math.round(d.rules.ltv * 100)}% of collateral)`) : L('Kikomo bila dhamana', 'Unsecured limit')}</small><b>{fmtTsh(max)}</b></div>
              <input className="input" style={{ marginTop: 8, width: '100%' }} inputMode="numeric" placeholder={L(`Kiasi (hadi ${fmtShort(max)})`, `Amount (up to ${fmtShort(max)})`)} value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} />
              <div className="row between" style={{ marginTop: 8 }}><small>{L('Utarudisha', "You'll repay")}</small><b>{fmtTsh(Math.round(amt * (1 + rate)))}</b></div>
              <button className="btn btn-green btn-block" style={{ marginTop: 10 }} disabled={!d.atBank || amt < d.rules.min} onClick={take}>🏦 {L('Kopa', 'Borrow')} {fmtShort(amt)}</button>
            </div>
            <div className="hint">{L(`Lipa wakati wowote. Ukichelewa: ada ya 5% kila siku; baada ya siku ${d.rules.graceDays} benki inakata wallet yako na kutaifisha dhamana. Mali iliyowekwa dhamana haiwezi kuuzwa hadi umalize mkopo.`, `Repay any time. If you're late: a 5% fee each day; after ${d.rules.graceDays} days the bank takes your wallet cash and seizes the collateral. Pledged property can't be sold until the loan is paid.`)}</div>
          </>
        )}
        {d.history.length > 0 && <div className="section-t">{L('HISTORIA', 'HISTORY')}</div>}
        {d.history.map((h) => (
          <div key={h.id} className="inv-row">
            <span className="em">{h.status === 'repaid' ? '✅' : '⚠️'}</span>
            <div className="grow"><b>{fmtTsh(h.principal)}</b><small>{h.status === 'repaid' ? L('Imelipwa', 'Repaid') : L('Dhamana imetaifishwa', 'Collateral seized')} · {new Date(h.closedAt || h.takenAt).toLocaleDateString()}</small></div>
          </div>
        ))}
      </div>
    </>
  );
}
