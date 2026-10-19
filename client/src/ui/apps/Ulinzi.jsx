// Ulinzi: hire a guard, a pair of bodyguards, VIP close protection or a full convoy by the day.
import { useEffect, useState } from 'react';
import { fmtTsh, fmtShort } from '@shared/world.js';
import { useStore } from '../../store.js';
import { api } from '../../api.js';
import { AppHead } from '../Phone.jsx';
import { ask } from '../Confirm.jsx';
import { L } from '../../i18n.js';
import { sfx } from '../../audio.js';

export function Ulinzi({ back }) {
  const me = useStore((s) => s.me);
  const run = useStore((s) => s.run);
  const [d, setD] = useState(null);
  const [days, setDays] = useState(1);
  useEffect(() => { api('/guards').then(setD).catch(() => {}); }, []);
  if (!d) return (<><AppHead title={L('Ulinzi', 'Security')} onBack={back} /><div className="app-body"><div className="small muted" style={{ padding: 12 }}>{L('Inapakia…', 'Loading…')}</div></div></>);
  const cur = d.current;
  const left = cur ? cur.until - Date.now() : 0;
  const hire = async (t) => {
    const cost = t.perDay * days;
    if (!(await ask({ icon: t.emoji, title: L(`Ajiri ${t.name[0]}?`, `Hire ${t.name[1]}?`), text: L(`Siku ${days} · ${fmtTsh(cost)}`, `${days} day${days > 1 ? 's' : ''} · ${fmtTsh(cost)}`), ok: L('Ajiri', 'Hire') }))) return;
    const r = await run('/guards/hire', { method: 'POST', body: { tier: t.id, days } });
    if (r) { setD(r); sfx('levelup'); useStore.getState().toast(L(`${t.emoji} Walinzi wako wako kazini!`, `${t.emoji} Your security detail is on duty!`)); }
  };
  const dismiss = async () => {
    if (!(await ask({ icon: '👋', title: L('Waachishe walinzi?', 'Dismiss your guards?'), text: L('Siku zilizobaki zitarudishwa.', 'Unused full days are refunded.'), ok: L('Waachishe', 'Dismiss'), danger: true }))) return;
    const r = await run('/guards/dismiss', { method: 'POST' });
    if (r) { setD(r); sfx('cash'); }
  };
  return (
    <>
      <AppHead title={L('Ulinzi · Walinzi binafsi', 'Security · Bodyguards')} onBack={back} />
      <div className="app-body">
        <div className="mt-hero" style={{ background: 'linear-gradient(135deg, #020617, #1e293b 60%, #475569)' }}>
          <b>{L('Usalama kwanza 🕶️', 'Safety first 🕶️')}</b>
          <small>{L('Walinzi wanatembea nawe mjini, wanawazuia wezi (na kuwapeleka polisi), na wanachelewesha polisi wakikukamata.', 'Guards walk with you around town, stop robbers (and hand them to the police), and slow the cops down when they grab you.')}</small>
        </div>
        {cur && (
          <div className="lux-card own" style={{ '--lux': '#334155', marginTop: 10 }}>
            <div className="lux-top"><span className="lux-em">{cur.emoji}</span><div className="grow"><b>{L(cur.name[0], cur.name[1])}</b><small>{L(`Wako kazini · zimebaki saa ${Math.ceil(left / 3600000)}`, `On duty · ${Math.ceil(left / 3600000)}h left`)} · 🛡️ {Math.round(cur.protect * 100)}%</small></div></div>
            <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={dismiss}>{L('Waachishe', 'Dismiss')}</button>
          </div>
        )}
        <div className="chips" style={{ margin: '10px 0' }}>
          {[1, 3, 7, 30].map((n) => <button key={n} className={`chip ${days === n ? 'on' : ''}`} onClick={() => setDays(n)}>{L(`Siku ${n}`, `${n} day${n > 1 ? 's' : ''}`)}</button>)}
        </div>
        {d.tiers.map((t) => (
          <div key={t.id} className="lux-card" style={{ '--lux': '#64748b' }}>
            <div className="lux-top">
              <span className="lux-em">{t.emoji}</span>
              <div className="grow">
                <b>{L(t.name[0], t.name[1])}</b>
                <small>{L(t.blurb[0], t.blurb[1])}</small>
                <small style={{ display: 'block', marginTop: 2 }}>👥 {t.men} · 🛡️ {L('wezi', 'robbers')} {Math.round(t.protect * 100)}%{t.copDelay ? ` · 🚓 +${Math.round(t.copDelay * 100)}%` : ''}</small>
              </div>
            </div>
            <div className="row" style={{ gap: 8, marginTop: 8, alignItems: 'center' }}>
              <b className="grow">{fmtShort(t.perDay)}/{L('siku', 'day')} · {fmtTsh(t.perDay * days)}</b>
              <button className="btn btn-green btn-sm" disabled={me.money < t.perDay * days} onClick={() => hire(t)}>{cur?.id === t.id ? L('Ongeza siku', 'Extend') : L('Ajiri', 'Hire')}</button>
            </div>
          </div>
        ))}
        <div className="hint">{L('Ukibadilisha aina ya ulinzi, siku zilizobaki za ule wa zamani zinahesabiwa.', 'Switching tiers credits the unused days of your old contract.')}</div>
      </div>
    </>
  );
}
