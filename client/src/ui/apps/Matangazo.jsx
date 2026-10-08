import { useEffect, useMemo, useRef, useState } from 'react';
import { AD_MAX_DAYS } from '@shared/world.js';
import { useStore } from '../../store.js';
import { api } from '../../api.js';
import { AppHead } from '../Phone.jsx';
import { L, loc, isEn } from '../../i18n.js';

const COLORS = ['#16a34a', '#0f766e', '#1d4ed8', '#7c3aed', '#db2777', '#dc2626', '#ea580c', '#111827'];

export function Matangazo({ arg, back }) {
  const me = useStore((s) => s.me);
  const [slots, setSlots] = useState([]);
  const [mine, setMine] = useState([]);
  const [tab, setTab] = useState('new');
  const [f, setF] = useState({ slotId: typeof arg === 'string' ? arg : '', title: '', body: '', link: '', days: 3, bg: COLORS[0] });
  const [file, setFile] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [phone, setPhone] = useState(me.phone ? '0' + me.phone.slice(3) : '');
  const [pay, setPay] = useState(null); // { paymentId, amountTzs, instructions, status }
  const timer = useRef();
  useEffect(() => () => clearInterval(timer.current), []);
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);
  const load = () => {
    api('/ads/slots').then((s) => {
      setSlots(s);
      setF((x) => (x.slotId ? x : { ...x, slotId: s[0]?.id }));
    }).catch(() => {});
    api('/ads/mine').then(setMine).catch(() => {});
  };
  useEffect(load, []);
  const slot = slots.find((s) => s.id === f.slotId);
  const tzs = slot ? (slot.tzsPerDay || 0) * f.days : 0;
  const up = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async () => {
    setErr('');
    setBusy(true);
    const form = new FormData();
    for (const [k, v] of Object.entries(f)) form.append(k, String(v));
    form.append('phone', phone);
    if (file) form.append('image', file);
    try {
      const r = await api('/ads', { method: 'POST', form });
      setPay(r);
      clearInterval(timer.current);
      timer.current = setInterval(async () => {
        try {
          const s = await api(`/wallet/topup/${r.paymentId}`);
          if (s.status !== 'pending') {
            clearInterval(timer.current);
            setPay((p) => ({ ...p, status: s.status }));
            if (s.status === 'paid') { setF((x) => ({ ...x, title: '', body: '', link: '' })); setFile(null); load(); }
          }
        } catch {}
      }, 3000);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <AppHead title={L('Matangazo', 'Ads')} onBack={back} />
      <div className="app-body">
        <div className="seg">
          <button className={tab === 'new' ? 'on' : ''} onClick={() => setTab('new')}>{L('Tangazo jipya', 'New ad')}</button>
          <button className={tab === 'mine' ? 'on' : ''} onClick={() => setTab('mine')}>{L('Yangu', 'Mine')} ({mine.length})</button>
        </div>
        {tab === 'new' && pay && (
          <div className="box center">
            {pay.status === 'paid' ? (
              <>
                <div style={{ fontSize: 44 }}>📢</div>
                <h3 style={{ margin: '6px 0' }}>{L('Malipo yamepokelewa!', 'Payment received!')}</h3>
                <div className="small muted">{L('Tangazo lako liko hewani (au kwenye foleni ya bango).', 'Your ad is live (or queued for the next free turn on the board).')}</div>
                <button className="btn btn-green btn-sm" style={{ marginTop: 12 }} onClick={() => { setPay(null); setTab('mine'); }}>{L('Ona matangazo yangu', 'See my ads')}</button>
              </>
            ) : pay.status && pay.status !== 'pending' ? (
              <>
                <div style={{ fontSize: 44 }}>❌</div>
                <h3 style={{ margin: '6px 0' }}>{L('Malipo hayakufanikiwa', 'Payment failed')}</h3>
                <button className="btn btn-ghost btn-sm" onClick={() => setPay(null)}>{L('Jaribu tena', 'Try again')}</button>
              </>
            ) : (
              <>
                <div style={{ fontSize: 40 }} className="busy-em">📲</div>
                <h3 style={{ margin: '6px 0' }}>{L('Thibitisha kwenye simu yako', 'Confirm on your phone')}</h3>
                <div className="bold">TZS {Number(pay.amountTzs).toLocaleString()}</div>
                {pay.instructions?.lipaNamba ? (
                  <div className="small" style={{ textAlign: 'left', lineHeight: 1.6, marginTop: 6 }}>
                    {L('Lipa kwa', 'Pay to')} <b>Lipa Namba {pay.instructions.lipaNamba}</b> ({pay.instructions.accountName})
                    {pay.instructions.note && <div className="muted">{pay.instructions.note}</div>}
                  </div>
                ) : (
                  <div className="small muted">{pay.instructions?.note || L('Weka PIN yako ya mobile money kuthibitisha.', 'Enter your mobile money PIN to confirm.')}</div>
                )}
                <div className="progress" style={{ marginTop: 14 }}><div style={{ width: '60%', animation: 'pulse 1s infinite' }} /></div>
                <div className="small muted" style={{ marginTop: 8 }}>{L('Tangazo litaenda hewani malipo yakithibitishwa.', 'Your ad goes live as soon as the payment confirms.')}</div>
              </>
            )}
          </div>
        )}
        {tab === 'new' && !pay && (
          <div className="box">
            <div className="adprev" style={{ background: preview ? `url(${preview}) center/cover` : f.bg }}>
              <b>{f.title || L('Kichwa cha tangazo', 'Ad headline')}</b>
              <span>{f.body || L('Maelezo mafupi ya biashara yako', 'A short description of your business')}</span>
            </div>
            <div className="label">{L('Bango', 'Billboard')}</div>
            <select className="field" value={f.slotId} onChange={up('slotId')}>
              {slots.map((s) => (
                <option key={s.id} value={s.id}>{loc(s)} — TZS {(s.tzsPerDay || 0).toLocaleString()}/{L('siku', 'day')} · {s.live}/{s.capacity}{s.bookedUntil ? L(' (imejaa)', ' (full)') : ''}</option>
              ))}
            </select>
            {slot?.bookedUntil && <div className="hint">{L(`Skrini hii imejaa (${slot.live}/${slot.capacity}). Lako litaanza ${new Date(slot.bookedUntil).toLocaleString()}.`, `This screen is full (${slot.live}/${slot.capacity}). Yours starts ${new Date(slot.bookedUntil).toLocaleString()}.`)}</div>}
            <div className="label">{L('Kichwa', 'Headline')}</div>
            <input className="field" maxLength={40} value={f.title} onChange={up('title')} placeholder={L('mf. Mama Neema Catering', 'e.g. Mama Neema Catering')} />
            <div className="label">{L('Maelezo', 'Description')}</div>
            <input className="field" maxLength={90} value={f.body} onChange={up('body')} placeholder={L('mf. Pilau, biriani & send-off · 0712…', 'e.g. Pilau, biryani & send-offs · 0712…')} />
            <div className="label">{L('Link (hiari, https://)', 'Link (optional, https://)')}</div>
            <input className="field" maxLength={120} value={f.link} onChange={up('link')} placeholder="https://instagram.com/…" autoCapitalize="none" />
            <div className="label">{L('Picha (hiari, max 1.5MB)', 'Image (optional, max 1.5MB)')}</div>
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            <div className="label">{L('Rangi', 'Colour')}</div>
            <div className="swatches">
              {COLORS.map((c) => <button key={c} className={`swatch ${f.bg === c ? 'on' : ''}`} style={{ background: c }} onClick={() => setF({ ...f, bg: c })} aria-label={c} />)}
            </div>
            <div className="label">{L('Siku', 'Days')}: {f.days}</div>
            <input type="range" min="1" max={AD_MAX_DAYS} value={f.days} onChange={(e) => setF({ ...f, days: Number(e.target.value) })} style={{ width: '100%', accentColor: 'var(--green)' }} />
            <div className="label">{L('Namba ya mobile money', 'Mobile money number')}</div>
            <input className="field" inputMode="tel" placeholder="0712 345 678" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <div className="hint">💳 {L('Matangazo yanalipwa kwa pesa halisi (nTZS · M-Pesa, Tigo Pesa, Airtel Money) — si pesa ya mchezo.', 'Ads are paid with real money (nTZS · M-Pesa, Tigo Pesa, Airtel Money) — not game cash.')}</div>
            {err && <div className="err">{err}</div>}
            <button className="btn btn-green btn-block" style={{ marginTop: 14 }} disabled={busy || !f.title || !phone} onClick={submit}>
              {busy ? L('Subiri…', 'Please wait…') : L(`Lipa TZS ${tzs.toLocaleString()} & weka hewani`, `Pay TZS ${tzs.toLocaleString()} & go live`)}
            </button>
            <div className="hint center">{L('Kwa kuweka tangazo unakubali', 'By posting you agree to the')} <a href="/ads-policy" target="_blank">{L('Sera ya Matangazo', 'Advertising Policy')}</a>.</div>
          </div>
        )}
        {tab === 'mine' && (
          <div className="box" style={{ padding: '4px 14px' }}>
            {mine.length === 0 && <div className="small muted" style={{ padding: 10 }}>{L('Bado hujaweka tangazo.', "You haven't posted any ads yet.")}</div>}
            {mine.map((a) => (
              <div key={a.id} className="tx">
                <div>
                  <b>{a.title}</b>
                  <div className="small muted">{loc(slots.find((s) => s.id === a.slot_id))}{a.ends_at ? ` · ${L('hadi', 'until')} ${new Date(a.ends_at).toLocaleDateString()}` : ''}{a.paid_tzs ? ` · TZS ${a.paid_tzs.toLocaleString()}` : ''}</div>
                </div>
                <span className={`small bold ${a.status === 'live' && a.ends_at > Date.now() ? 'green' : 'muted'}`}>
                  {a.status === 'awaiting_payment' ? L('inasubiri malipo', 'awaiting payment') : a.status === 'payment_failed' ? L('malipo yameshindwa', 'payment failed') : a.status !== 'live' ? a.status : a.ends_at < Date.now() ? L('imeisha', 'ended') : a.starts_at > Date.now() ? L('foleni', 'queued') : L('hewani', 'live')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
