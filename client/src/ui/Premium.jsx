// Subscription and perks, paid with mobile money: the shared pay box, the Perks tab in the
// wallet, and the full-screen pay screen shown once a player's time runs out.
import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store.js';
import { api } from '../api.js';
import { L } from '../i18n.js';
import { sfx } from '../audio.js';

const tzs = (n) => `TZS ${Number(n).toLocaleString()}`;
const dateOf = (t) => new Date(t).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });

/** Phone number + pay button; pushes a USSD prompt and waits for the payment to settle. */
export function PayBox({ kind, months, perkId, amount, label, onPaid }) {
  const me = useStore((s) => s.me);
  const [phone, setPhone] = useState(me?.phone ? '0' + me.phone.slice(3) : '');
  const [state, setState] = useState(null); // null | 'starting' | 'waiting' | 'paid' | 'failed'
  const [err, setErr] = useState('');
  const timer = useRef();
  useEffect(() => () => clearInterval(timer.current), []);

  const pay = async () => {
    setErr('');
    setState('starting');
    try {
      const r = await api('/premium/pay', { method: 'POST', body: { kind, months, perkId, phone } });
      setState('waiting');
      timer.current = setInterval(async () => {
        try {
          const s = await api(`/premium/pay/${r.id}`);
          if (s.status === 'pending') return;
          clearInterval(timer.current);
          if (s.status === 'paid') {
            useStore.setState({ me: s.me });
            setState('paid');
            sfx('levelup');
            onPaid?.(s);
          } else setState('failed');
        } catch {}
      }, 4000);
    } catch (e) {
      setErr(e.message);
      setState(null);
    }
  };

  if (state === 'waiting') {
    return (
      <div className="pay-wait">
        <div className="busy-em" style={{ fontSize: 34 }}>📲</div>
        <b>{L('Thibitisha kwenye simu yako', 'Confirm on your phone')}</b>
        <div className="small muted">{L(`Weka PIN yako ya mobile money kulipa ${tzs(amount)}. Inaweza kuchukua dakika 1–2.`, `Enter your mobile money PIN to pay ${tzs(amount)}. It can take 1–2 minutes.`)}</div>
        <div className="progress" style={{ marginTop: 10 }}><div style={{ width: '60%', animation: 'pulse 1s infinite' }} /></div>
      </div>
    );
  }
  if (state === 'paid') return <div className="pay-wait"><div style={{ fontSize: 34 }}>✅</div><b>{L('Malipo yamepokelewa!', 'Payment received!')}</b></div>;
  return (
    <div className="pay-box">
      {state === 'failed' && <div className="small red" style={{ marginBottom: 6 }}>❌ {L('Malipo hayakufanikiwa. Jaribu tena.', "The payment didn't go through. Try again.")}</div>}
      <input className="field" inputMode="tel" placeholder="07XX XXX XXX" value={phone} onChange={(e) => setPhone(e.target.value)} />
      <div className="small muted" style={{ margin: '4px 2px 8px' }}>M-Pesa · Mixx by Yas · Airtel Money</div>
      {err && <div className="small red" style={{ marginBottom: 6 }}>{err}</div>}
      <button className="btn btn-green btn-block" disabled={!phone || state === 'starting'} onClick={pay}>
        {state === 'starting' ? L('Inaanza…', 'Starting…') : <>📲 {label} · {tzs(amount)}</>}
      </button>
    </div>
  );
}

/** Subscription status + months picker. */
export function SubscribeCard({ sub, onPaid }) {
  const [months, setMonths] = useState(1);
  if (!sub || sub.exempt || !sub.enabled) return null;
  const ending = sub.daysLeft <= sub.remindDays;
  return (
    <div className={`sub-card ${sub.active ? '' : 'over'}`}>
      <div className="row" style={{ gap: 10 }}>
        <span style={{ fontSize: 28 }}>🎟️</span>
        <div className="grow">
          <b>{L('Uanachama wa Bongo Life', 'Bongo Life membership')}</b>
          <div className="small">
            {!sub.active ? L('Muda wako umeisha', 'Your time is up')
              : sub.trial ? L(`Bure hadi ${dateOf(sub.until)} · siku ${sub.daysLeft}`, `Free until ${dateOf(sub.until)} · ${sub.daysLeft} days left`)
                : L(`Umelipia hadi ${dateOf(sub.until)} · siku ${sub.daysLeft}`, `Paid until ${dateOf(sub.until)} · ${sub.daysLeft} days left`)}
          </div>
        </div>
      </div>
      <div className="small" style={{ margin: '8px 0' }}>{L(`${tzs(sub.priceTzs)} kwa mwezi. Ukilipa mapema, siku zinaongezwa juu ya ulizonazo.`, `${tzs(sub.priceTzs)} a month. Paying early adds the days on top of what you have.`)}</div>
      <div className="seg" style={{ marginBottom: 8 }}>
        {sub.plans.map((m) => <button key={m} className={months === m ? 'on' : ''} onClick={() => setMonths(m)}>{m === 1 ? L('Mwezi 1', '1 month') : L(`Miezi ${m}`, `${m} months`)}</button>)}
      </div>
      <PayBox key={months} kind="sub" months={months} amount={sub.priceTzs * months} label={ending || !sub.active ? L('Lipia sasa', 'Pay now') : L('Ongeza muda', 'Extend')} onPaid={onPaid} />
    </div>
  );
}

/** Wallet → Perks tab: the subscription and the perks for sale. */
export function PerksTab() {
  const [d, setD] = useState(null);
  const [open, setOpen] = useState(null);
  const load = () => api('/premium').then(setD).catch(() => {});
  useEffect(() => { load(); }, []);
  if (!d) return <div className="box small muted">{L('Inapakia…', 'Loading…')}</div>;
  return (
    <>
      <SubscribeCard sub={d.sub} onPaid={load} />
      {!d.payments && <div className="box small muted">{L('Malipo hayajawashwa bado.', 'Payments are not enabled yet.')}</div>}
      {d.perks.map((p) => {
        const until = d.mine[p.id];
        return (
          <div key={p.id} className={`perk ${open === p.id ? 'open' : ''}`}>
            <button className="perk-top" onClick={() => setOpen(open === p.id ? null : p.id)}>
              <span className="perk-em">{p.emoji}</span>
              <div className="grow">
                <b>{L(p.name[0], p.name[1])}</b>
                <small>{L(p.blurb[0], p.blurb[1])}</small>
                {until && <small className="green">✓ {L(`Inatumika hadi ${dateOf(until)}`, `Active until ${dateOf(until)}`)}</small>}
              </div>
              <b className="perk-price">{tzs(p.priceTzs)}</b>
            </button>
            {open === p.id && d.payments && <PayBox kind="perk" perkId={p.id} amount={p.priceTzs} label={until ? L('Ongeza', 'Add more') : L('Nunua', 'Buy')} onPaid={load} />}
          </div>
        );
      })}
    </>
  );
}

/** Full screen once the free month / paid time is over: pay to keep playing. */
export function Paywall() {
  const me = useStore((s) => s.me);
  const [sub, setSub] = useState(me?.sub || null);
  useEffect(() => { api('/premium').then((d) => setSub(d.sub)).catch(() => {}); }, []);
  const paid = async () => {
    const fresh = await useStore.getState().refreshMe().catch(() => null);
    if (fresh?.sub?.active) setTimeout(() => location.reload(), 1200);
  };
  return (
    <div className="paywall">
      <div className="paywall-card">
        <div style={{ fontSize: 44 }}>🌆</div>
        <h2>{L(`Karibu tena, ${me?.name || ''}!`, `Welcome back, ${me?.name || ''}!`)}</h2>
        <p className="small">
          {L('Muda wako wa bure wa Bongo Life umeisha. Lipia TZS 5,000 kwa mwezi kuendelea — mali yako, pesa, familia na marafiki wako wote wapo salama wanakusubiri.',
            'Your free Bongo Life time is over. Pay TZS 5,000 a month to keep playing — your property, money, family and friends are all safe and waiting for you.')}
        </p>
        <SubscribeCard sub={sub ? { ...sub, active: false } : null} onPaid={paid} />
        <button className="btn btn-ghost btn-sm" style={{ marginTop: 10 }} onClick={() => useStore.getState().logout()}>{L('Toka', 'Log out')}</button>
      </div>
    </div>
  );
}
