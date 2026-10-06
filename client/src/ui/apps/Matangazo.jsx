import { useEffect, useMemo, useState } from 'react';
import { AD_MAX_DAYS, fmtTsh } from '@shared/world.js';
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
  const cost = slot ? slot.pricePerDay * f.days : 0;
  const up = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async () => {
    setErr('');
    setBusy(true);
    const form = new FormData();
    for (const [k, v] of Object.entries(f)) form.append(k, String(v));
    if (file) form.append('image', file);
    try {
      const r = await api('/ads', { method: 'POST', form });
      useStore.setState({ me: r.me });
      useStore.getState().toast(r.startsAt > Date.now() + 5000 ? L(`📢 Tangazo limepangwa kuanza ${new Date(r.startsAt).toLocaleString()}`, `📢 Ad scheduled to start ${new Date(r.startsAt).toLocaleString()}`) : L('📢 Tangazo lako liko hewani!', '📢 Your ad is live!'));
      setF({ ...f, title: '', body: '', link: '' });
      setFile(null);
      setTab('mine');
      load();
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
        {tab === 'new' && (
          <div className="box">
            <div className="adprev" style={{ background: preview ? `url(${preview}) center/cover` : f.bg }}>
              <b>{f.title || L('Kichwa cha tangazo', 'Ad headline')}</b>
              <span>{f.body || L('Maelezo mafupi ya biashara yako', 'A short description of your business')}</span>
            </div>
            <div className="label">{L('Bango', 'Billboard')}</div>
            <select className="field" value={f.slotId} onChange={up('slotId')}>
              {slots.map((s) => (
                <option key={s.id} value={s.id}>{loc(s)} — {fmtTsh(s.pricePerDay)}/{L('siku', 'day')}{s.bookedUntil ? L(' (foleni)', ' (queued)') : ''}</option>
              ))}
            </select>
            {slot?.bookedUntil && <div className="hint">{L(`Bango hili lina tangazo hadi ${new Date(slot.bookedUntil).toLocaleString()}. Lako litaanza baada yake.`, `This billboard is booked until ${new Date(slot.bookedUntil).toLocaleString()}. Yours starts after it.`)}</div>}
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
            {err && <div className="err">{err}</div>}
            <button className="btn btn-green btn-block" style={{ marginTop: 14 }} disabled={busy || !f.title || me.money < cost} onClick={submit}>
              {busy ? L('Subiri…', 'Please wait…') : L(`Lipa ${fmtTsh(cost)} & weka hewani`, `Pay ${fmtTsh(cost)} & go live`)}
            </button>
            {me.money < cost && <div className="hint center red">{L('Salio halitoshi — ongeza kwenye Bongo Pesa.', 'Not enough balance — top up in your Wallet.')}</div>}
          </div>
        )}
        {tab === 'mine' && (
          <div className="box" style={{ padding: '4px 14px' }}>
            {mine.length === 0 && <div className="small muted" style={{ padding: 10 }}>{L('Bado hujaweka tangazo.', "You haven't posted any ads yet.")}</div>}
            {mine.map((a) => (
              <div key={a.id} className="tx">
                <div>
                  <b>{a.title}</b>
                  <div className="small muted">{loc(slots.find((s) => s.id === a.slot_id))} · {L('hadi', 'until')} {new Date(a.ends_at).toLocaleDateString()}</div>
                </div>
                <span className={`small bold ${a.status === 'live' && a.ends_at > Date.now() ? 'green' : 'muted'}`}>
                  {a.status !== 'live' ? a.status : a.ends_at < Date.now() ? L('imeisha', 'ended') : a.starts_at > Date.now() ? L('foleni', 'queued') : L('hewani', 'live')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
