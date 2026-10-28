// Familia: your spouse, planning a baby, raising your kids, and (if it comes to it) divorce.
import { useEffect, useState } from 'react';
import { fmtTsh, fmtShort } from '@shared/world.js';
import { useStore } from '../../store.js';
import { api } from '../../api.js';
import { AppHead } from '../Phone.jsx';
import { ask } from '../Confirm.jsx';
import { L } from '../../i18n.js';
import { sfx } from '../../audio.js';

const left = (ms) => {
  const m = Math.max(0, Math.ceil(ms / 60_000));
  return m >= 60 ? L(`saa ${Math.floor(m / 60)} dk ${m % 60}`, `${Math.floor(m / 60)}h ${m % 60}m`) : L(`dk ${m}`, `${m} min`);
};

export function Familia({ back, open }) {
  const run = useStore((s) => s.run);
  const [d, setD] = useState(null);
  const [name, setName] = useState('');
  const [gender, setGender] = useState('any');
  const [, tick] = useState(0);
  const load = () => api('/family').then(setD).catch(() => {});
  useEffect(() => {
    load();
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);
  if (!d) return (<><AppHead title={L('Familia', 'Family')} onBack={back} /><div className="app-body"><div className="small muted" style={{ padding: 12 }}>{L('Inapakia…', 'Loading…')}</div></div></>);
  const baby = async () => {
    const r = await run('/family/baby', { method: 'POST', body: { name, gender } });
    if (r) { setD(r); sfx('levelup'); useStore.getState().toast(L(`🤰🏾 Mtoto yuko njiani! Atazaliwa baada ya ${left(r.pregnancy.dueAt - Date.now())}.`, `🤰🏾 A baby is on the way! Due in ${left(r.pregnancy.dueAt - Date.now())}.`)); }
  };
  const care = async (k, a) => {
    const r = await run(`/family/kids/${k.id}/care`, { method: 'POST', body: { act: a.id } });
    if (r) { setD(r); sfx('pop'); useStore.getState().toast(`${a.emoji} ${L(`${k.name} amefurahi!`, `${k.name} loved that!`)}`); }
  };
  const divorce = async () => {
    if (!(await ask({ icon: '⚖️', title: L(`Talaka na ${d.spouse.name}?`, `Divorce ${d.spouse.name}?`), text: L(`Fidia: ${fmtTsh(d.divorceCost)} (${Math.round(d.rules.divorcePct * 100)}% ya pesa zako). Watoto wanabaki kuwa wenu wote.`, `Settlement: ${fmtTsh(d.divorceCost)} (${Math.round(d.rules.divorcePct * 100)}% of your cash). The kids stay yours.`), ok: L('Toa talaka', 'Divorce'), danger: true }))) return;
    const r = await run('/family/divorce', { method: 'POST' });
    if (r) { setD(r); sfx('close'); }
  };
  return (
    <>
      <AppHead title={L('Familia · Nyumbani', 'Family · Home life')} onBack={back} />
      <div className="app-body">
        <div className="fam-hero">
          {d.spouse ? (
            <>
              <b>💍 {L(`Umeoana na ${d.spouse.name}`, `Married to ${d.spouse.name}`)}</b>
              <small>{d.kids.length ? L(`Watoto ${d.kids.length}`, `${d.kids.length} ${d.kids.length === 1 ? 'child' : 'children'}`) : L('Bado hamna watoto', 'No kids yet')}</small>
            </>
          ) : (
            <>
              <b>{L('Bado hujaoa/olewa', 'Not married yet')}</b>
              <small>{L('Pata mpenzi kwenye Penzi (wachezaji au watu wa mchezo), mchumbie, fungeni ndoa — kisha mjenge familia.', 'Find a partner in Dating (players or game characters), propose, get married — then start a family.')}</small>
              <button className="btn btn-white btn-sm" style={{ marginTop: 8 }} onClick={() => open?.('penzi')}>💘 {L('Fungua Penzi', 'Open Dating')}</button>
            </>
          )}
        </div>

        {d.pregnancy && (
          <div className="fam-preg">
            <span>🤰🏾</span>
            <div className="grow"><b>{L(`${d.pregnancy.name} yuko njiani!`, `${d.pregnancy.name} is on the way!`)}</b><small>{L(`Atazaliwa baada ya ${left(d.pregnancy.dueAt - Date.now())}`, `Due in ${left(d.pregnancy.dueAt - Date.now())}`)} · {d.pregnancy.gender === 'girl' ? '👧🏾' : '👦🏾'}</small></div>
          </div>
        )}

        {d.spouse && !d.pregnancy && d.kids.length < d.rules.maxKids && (
          <div className="box" style={{ marginTop: 10 }}>
            <b>👶🏾 {L('Panga mtoto', 'Plan a baby')}</b>
            <div className="row" style={{ gap: 6, marginTop: 8 }}>
              <input className="input grow" maxLength={20} placeholder={L('Jina (si lazima)', 'Name (optional)')} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="chips" style={{ margin: '8px 0' }}>
              {[['any', '🎲', ['Yoyote', 'Surprise']], ['girl', '👧🏾', ['Msichana', 'Girl']], ['boy', '👦🏾', ['Mvulana', 'Boy']]].map(([k, e, n]) => <button key={k} className={`chip ${gender === k ? 'on' : ''}`} onClick={() => setGender(k)}>{e} {L(n[0], n[1])}</button>)}
            </div>
            <button className="btn btn-green btn-block" onClick={baby}>💕 {L('Tunataka mtoto', "Let's have a baby")}</button>
            <div className="hint">{L(`Mtoto anazaliwa baada ya saa ${d.rules.babyMs / 3600000}. Kila siku halisi = mwaka mmoja wa maisha yake.`, `The baby arrives in ${d.rules.babyMs / 3600000} hours. Each real day is a year of their life.`)}</div>
          </div>
        )}

        {d.kids.length > 0 && <div className="section-t">{L('WATOTO WAKO', 'YOUR KIDS')}</div>}
        {d.kids.map((k) => {
          const busy = k.careReadyAt > Date.now();
          return (
            <div key={k.id} className="lux-card" style={{ '--lux': k.gender === 'girl' ? '#f9a8d4' : '#93c5fd' }}>
              <div className="lux-top">
                <span className="lux-em">{k.emoji}</span>
                <div className="grow">
                  <b>{k.name} · {L(`miaka ${k.age}`, `${k.age} yrs`)}</b>
                  <small>{L(k.stage[0], k.stage[1])} · 😊 {k.joy}% · 🎓 {k.smart}</small>
                  <div className="fam-joy"><i style={{ width: `${k.joy}%` }} /></div>
                </div>
              </div>
              <div className="fam-care">
                {d.rules.care.map((a) => (
                  <button key={a.id} className="btn btn-ghost btn-sm" disabled={busy} onClick={() => care(k, a)}>{a.emoji} {L(a.name[0], a.name[1])}{a.cost ? ` · ${fmtShort(a.cost)}` : ''}</button>
                ))}
              </div>
              {busy && <small className="muted">{L(`Anapumzika · dk ${Math.ceil((k.careReadyAt - Date.now()) / 60000)}`, `Resting · ${Math.ceil((k.careReadyAt - Date.now()) / 60000)} min`)}</small>}
            </div>
          );
        })}
        {d.kids.length > 0 && <div className="hint">{L('Watoto wako wanaishi nawe Kwangu — utawaona nyumbani wakicheza.', 'Your kids live with you at home — you’ll see them playing there.')}</div>}

        {d.spouse && (
          <button className="btn btn-ghost btn-block" style={{ marginTop: 16, color: '#b91c1c' }} onClick={divorce}>⚖️ {L('Talaka', 'File for divorce')} · {fmtShort(d.divorceCost)}</button>
        )}
      </div>
    </>
  );
}
