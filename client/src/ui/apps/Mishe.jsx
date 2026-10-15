// Mishe (hustles): small businesses anyone can own — no map spot needed, so latecomers can still
// build an empire. Each earns per 6-hour shift, minus running costs and the odd breakdown.
import { useEffect, useState } from 'react';
import { fmtTsh, fmtShort } from '@shared/world.js';
import { useStore } from '../../store.js';
import { api } from '../../api.js';
import { AppHead } from '../Phone.jsx';
import { ask } from '../Confirm.jsx';
import { L } from '../../i18n.js';
import { sfx } from '../../audio.js';

export function Mishe({ back }) {
  const me = useStore((s) => s.me);
  const run = useStore((s) => s.run);
  const [d, setD] = useState(null);
  useEffect(() => { api('/hustles').then(setD).catch(() => {}); }, []);
  if (!d) return (<><AppHead title={L('Mishe', 'Hustles')} onBack={back} /><div className="app-body"><div className="small muted" style={{ padding: 12 }}>{L('Inapakia…', 'Loading…')}</div></div></>);
  const daily = d.hustles.reduce((s, h) => s + h.count * ((h.earn[0] + h.earn[1]) / 2 - h.cost), 0);
  const buy = async (h) => {
    if (!(await ask({ icon: h.emoji, title: L(`Nunua ${h.name[0]}?`, `Buy a ${h.name[1]}?`), text: `${fmtTsh(h.price)} · ${L('takriban', 'about')} +${fmtShort(Math.round((h.earn[0] + h.earn[1]) / 2 - h.cost))}/${L('siku', 'day')}`, ok: L('Nunua', 'Buy') }))) return;
    const r = await run('/hustles/buy', { method: 'POST', body: { kind: h.id } });
    if (r) { setD(r); sfx('cash'); useStore.getState().toast(L(`${h.emoji} ${h.name[0]} imeanza kazi!`, `${h.emoji} Your ${h.name[1]} is open for business!`)); }
  };
  const sell = async (h) => {
    if (!(await ask({ icon: '🏷️', title: L(`Uza ${h.name[0]} moja?`, `Sell one ${h.name[1]}?`), text: L(`Utapata ${fmtTsh(Math.round(h.price * d.rules.resale))}.`, `You'll get ${fmtTsh(Math.round(h.price * d.rules.resale))}.`), ok: L('Uza', 'Sell'), danger: true }))) return;
    const r = await run('/hustles/sell', { method: 'POST', body: { kind: h.id } });
    if (r) { setD(r); sfx('cash'); }
  };
  return (
    <>
      <AppHead title={L('Mishe · Biashara ndogo', 'Hustles · Side businesses')} onBack={back} />
      <div className="app-body">
        <div className="inv-card">
          <div className="ic-k">{L('MISHE ZAKO', 'YOUR HUSTLES')}</div>
          <div className="ic-v">{d.total} <small style={{ fontSize: 14 }}>{L('biashara', 'running')}</small></div>
          <div className="ic-s">≈ +{fmtShort(Math.round(daily))} / {L('siku', 'day')} · {L('inasubiri', 'waiting')} {fmtTsh(d.pending)}</div>
          <div className="ic-note">{L('Hakuna kikomo cha eneo — kila mtu anaweza kuanza. Faida huingia na kodi zako (Wekeza → Kusanya). Kuna siku zinaharibika — gharama ya fundi inakatwa.', 'No map spot needed — anyone can start. Profits arrive with your rent (Invest → Collect). Sometimes things break — the repair bill comes out of that shift.')}</div>
        </div>
        {d.hustles.map((h) => {
          const mid = Math.round((h.earn[0] + h.earn[1]) / 2 - h.cost);
          const days = Math.ceil(h.price / mid);
          return (
            <div key={h.id} className="lux-card" style={{ '--lux': '#16a34a' }}>
              <div className="lux-top">
                <span className="lux-em">{h.emoji}</span>
                <div className="grow">
                  <b>{L(h.name[0], h.name[1])}{h.count ? ` ×${h.count}` : ''}</b>
                  <small>+{fmtShort(h.earn[0] - h.cost)}–{fmtShort(h.earn[1] - h.cost)}/{L('siku', 'day')} · {L(`hurudisha ~siku ${days}`, `pays back in ~${days} days`)}{h.broke ? ` · 🔧${h.broke}` : ''}</small>
                </div>
              </div>
              <div className="row" style={{ gap: 8, marginTop: 8, alignItems: 'center' }}>
                <b className="grow">{fmtTsh(h.price)}</b>
                {h.count > 0 && <button className="btn btn-ghost btn-sm" onClick={() => sell(h)}>{L('Uza', 'Sell')}</button>}
                <button className="btn btn-green btn-sm" disabled={me.money < h.price || h.count >= d.rules.maxEach} onClick={() => buy(h)}>{h.count ? L('Ongeza', 'Add one') : L('Anza', 'Start')}</button>
              </div>
            </div>
          );
        })}
        <div className="hint">{L(`Hadi ${d.rules.maxEach} kwa kila aina. Ukiuza unapata ${Math.round(d.rules.resale * 100)}%. Faida inakusanyika hadi saa ${(d.rules.maxPeriods * d.rules.periodMs) / 3600000}.`, `Up to ${d.rules.maxEach} of each. Resale is ${Math.round(d.rules.resale * 100)}%. Profits pile up for ${(d.rules.maxPeriods * d.rules.periodMs) / 3600000} hours.`)}</div>
      </div>
    </>
  );
}
