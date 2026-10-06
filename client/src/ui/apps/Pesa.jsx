import { useEffect, useRef, useState } from 'react';
import { fmtTsh } from '@shared/world.js';
import { useStore } from '../../store.js';
import { api } from '../../api.js';
import { AppHead } from '../Phone.jsx';
import { L } from '../../i18n.js';

const KIND = { topup: '💳', salary: '💼', spend: '🛍️', purchase: '🧾', income: '🏦', gift: '🎁', transfer_in: '📥', transfer_out: '📤', travel: '🛺', ads: '📢' };

function Topup({ info, me, onDone }) {
  const [amount, setAmount] = useState(info.presets[2] || info.min);
  const [phone, setPhone] = useState(me.phone ? '0' + me.phone.slice(3) : '');
  const [method, setMethod] = useState(info.methods[0]);
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const timer = useRef();
  useEffect(() => () => clearInterval(timer.current), []);

  const start = async () => {
    setErr('');
    setBusy(true);
    try {
      const r = await api('/wallet/topup', { method: 'POST', body: { amountTzs: Number(amount), phone, method } });
      setPending(r);
      timer.current = setInterval(async () => {
        try {
          const s = await api(`/wallet/topup/${r.id}`);
          if (s.status !== 'pending') {
            clearInterval(timer.current);
            useStore.setState({ me: s.me });
            setPending({ ...r, status: s.status });
            if (s.status === 'paid') onDone();
          }
        } catch {}
      }, 3000);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (pending) {
    const ins = pending.instructions || {};
    return (
      <div className="box center">
        {pending.status === 'paid' ? (
          <>
            <div style={{ fontSize: 44 }}>✅</div>
            <h3 style={{ margin: '6px 0' }}>{L('Salio limeingia!', 'Top-up received!')}</h3>
            <div className="bold green">+{fmtTsh(pending.coins)}</div>
          </>
        ) : pending.status && pending.status !== 'pending' ? (
          <>
            <div style={{ fontSize: 44 }}>❌</div>
            <h3 style={{ margin: '6px 0' }}>{L('Malipo hayakufanikiwa', 'Payment failed')}</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => setPending(null)}>{L('Jaribu tena', 'Try again')}</button>
          </>
        ) : (
          <>
            <div style={{ fontSize: 40 }} className="busy-em">📲</div>
            <h3 style={{ margin: '6px 0' }}>{L('Thibitisha kwenye simu yako', 'Confirm on your phone')}</h3>
            {ins.lipaNamba ? (
              <div className="small" style={{ textAlign: 'left', lineHeight: 1.6 }}>
                {L('Lipa kwa', 'Pay to')} <b>Lipa Namba {ins.lipaNamba}</b> ({ins.accountName})<br />
                {L('Kiasi', 'Amount')}: <b>TZS {Number(ins.amountTzs).toLocaleString()}</b><br />
                {L('Kutoka namba', 'From number')}: <b>{ins.payFromPhone}</b>
                {ins.note && <div className="muted" style={{ marginTop: 6 }}>{ins.note}</div>}
              </div>
            ) : (
              <div className="small muted">{ins.note || L('Weka PIN yako ya mobile money kuthibitisha malipo.', 'Enter your mobile money PIN to confirm the payment.')}</div>
            )}
            <div className="progress" style={{ marginTop: 14 }}><div style={{ width: '60%', animation: 'pulse 1s infinite' }} /></div>
            <div className="small muted" style={{ marginTop: 8 }}>{L('Tunasubiri uthibitisho…', 'Waiting for confirmation…')}</div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="box">
      {!info.livemode && (
        <div className="small" style={{ background: '#fef9c3', borderRadius: 12, padding: '8px 10px', marginBottom: 10 }}>
          🧪 <b>{info.label}</b> — {L('hakuna pesa halisi itakatwa.', 'no real money will be charged.')}
        </div>
      )}
      <div className="label" style={{ marginTop: 0 }}>{L('Kiasi (TZS)', 'Amount (TZS)')}</div>
      <div className="chips">
        {info.presets.map((p) => (
          <button key={p} className={`chip ${Number(amount) === p ? 'on' : ''}`} style={{ padding: '8px 12px', fontSize: 13.5 }} onClick={() => setAmount(p)}>{p.toLocaleString()}</button>
        ))}
      </div>
      <input className="field" style={{ marginTop: 8 }} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} />
      <div className="small" style={{ marginTop: 6 }}>{L('Utapata', "You'll get")} <b className="green">{fmtTsh(Number(amount || 0) * info.rate)}</b> {L('za Bongo Life', 'in Bongo Life')}</div>
      {info.methods.length > 1 && (
        <>
          <div className="label">{L('Njia ya kulipa', 'Payment method')}</div>
          <div className="seg" style={{ marginBottom: 0 }}>
            <button className={method === 'mobile_money' ? 'on' : ''} onClick={() => setMethod('mobile_money')}>📲 Push (STK)</button>
            <button className={method === 'lipa_namba' ? 'on' : ''} onClick={() => setMethod('lipa_namba')}>🔢 Lipa Namba</button>
          </div>
        </>
      )}
      <div className="label">{L('Namba ya M-Pesa / Mixx / Airtel Money', 'M-Pesa / Mixx / Airtel Money number')}</div>
      <input className="field" inputMode="tel" placeholder="0712 345 678" value={phone} onChange={(e) => setPhone(e.target.value)} />
      {err && <div className="err">{err}</div>}
      <button className="btn btn-green btn-block" style={{ marginTop: 14 }} disabled={busy || !phone || Number(amount) < info.min} onClick={start}>
        {busy ? L('Subiri…', 'Please wait…') : `${L('Lipa', 'Pay')} TZS ${Number(amount || 0).toLocaleString()}`}
      </button>
      <div className="hint center">{L('Malipo kupitia nTZS', 'Payments via nTZS')} · TZS 1 = {fmtTsh(info.rate)} {L('za mchezo', 'in-game')}</div>
    </div>
  );
}

function Send({ initial, onDone }) {
  const run = useStore((s) => s.run);
  const [to, setTo] = useState(initial || '');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const send = async () => {
    const r = await run('/wallet/send', { method: 'POST', body: { to, amount: Number(amount), note } });
    if (r) {
      useStore.getState().toast(L(`💸 Umetuma ${fmtTsh(amount)} kwa @${r.to}`, `💸 Sent ${fmtTsh(amount)} to @${r.to}`));
      setAmount('');
      setNote('');
      onDone();
    }
  };
  return (
    <div className="box">
      <div className="label" style={{ marginTop: 0 }}>{L('Kwa', 'To')}</div>
      <input className="field" placeholder="@username" value={to} onChange={(e) => setTo(e.target.value)} autoCapitalize="none" />
      <div className="label">{L('Kiasi (TSh)', 'Amount (TSh)')}</div>
      <input className="field" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} />
      <div className="label">{L('Ujumbe (hiari)', 'Note (optional)')}</div>
      <input className="field" maxLength={80} value={note} onChange={(e) => setNote(e.target.value)} placeholder={L('mf. Hela ya chipsi 😂', 'e.g. Chips money 😂')} />
      <button className="btn btn-green btn-block" style={{ marginTop: 14 }} disabled={!to || !amount} onClick={send}>{L('Tuma pesa', 'Send money')}</button>
    </div>
  );
}

export function Pesa({ arg, back }) {
  const me = useStore((s) => s.me);
  const [data, setData] = useState(null);
  const [tab, setTab] = useState(arg === 'topup' ? 'topup' : arg?.send ? 'send' : 'history');
  const load = () => api('/wallet').then(setData).catch(() => {});
  useEffect(() => {
    load();
  }, [me?.money]);
  return (
    <>
      <AppHead title={L('Bongo Pesa', 'Wallet')} onBack={back} />
      <div className="app-body">
        <div className="bal">
          <div className="small" style={{ opacity: 0.85 }}>{L('Salio lako', 'Your balance')}</div>
          <div className="n">{fmtTsh(me.money)}</div>
          <div className="row">
            <button className="btn btn-white btn-sm" onClick={() => setTab('topup')}>＋ {L('Ongeza', 'Top up')}</button>
            <button className="btn btn-sm" style={{ background: 'rgba(255,255,255,.2)', color: '#fff' }} onClick={() => setTab('send')}>{L('Tuma', 'Send')}</button>
          </div>
        </div>
        <div className="seg">
          <button className={tab === 'history' ? 'on' : ''} onClick={() => setTab('history')}>{L('Historia', 'History')}</button>
          <button className={tab === 'topup' ? 'on' : ''} onClick={() => setTab('topup')}>{L('Ongeza salio', 'Top up')}</button>
          <button className={tab === 'send' ? 'on' : ''} onClick={() => setTab('send')}>{L('Tuma', 'Send')}</button>
        </div>
        {tab === 'topup' && (data?.topup ? <Topup info={data.topup} me={me} onDone={load} /> : <div className="box small muted">{data ? L('Malipo hayajawashwa kwenye server hii bado.', 'Payments are not enabled on this server yet.') : L('Inapakia…', 'Loading…')}</div>)}
        {tab === 'send' && <Send initial={arg?.send} onDone={load} />}
        {tab === 'history' && (
          <div className="box" style={{ padding: '4px 14px' }}>
            {!data && <div className="small muted" style={{ padding: 10 }}>{L('Inapakia…', 'Loading…')}</div>}
            {data?.transactions.map((t) => (
              <div key={t.id} className="tx">
                <div className="row" style={{ minWidth: 0 }}>
                  <span>{KIND[t.kind] || '•'}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.memo}</div>
                    <div className="small muted">{new Date(t.created_at).toLocaleString()}</div>
                  </div>
                </div>
                <b className={t.amount >= 0 ? 'green' : ''} style={{ whiteSpace: 'nowrap' }}>{t.amount >= 0 ? '+' : ''}{t.amount.toLocaleString()}</b>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
