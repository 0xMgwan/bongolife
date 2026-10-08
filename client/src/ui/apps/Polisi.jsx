import { useEffect, useState } from 'react';
import { fmtTsh } from '@shared/world.js';
import { useStore } from '../../store.js';
import { api } from '../../api.js';
import { AppHead } from '../Phone.jsx';
import { goToPlace } from '../../nav.js';
import { L, pick } from '../../i18n.js';
import { sfx } from '../../audio.js';

const ago = (t) => {
  const m = Math.round((Date.now() - t) / 60_000);
  if (m < 60) return L(`dakika ${m} zilizopita`, `${m} min ago`);
  const h = Math.round(m / 60);
  return h < 24 ? L(`saa ${h} zilizopita`, `${h}h ago`) : L(`siku ${Math.round(h / 24)} zilizopita`, `${Math.round(h / 24)}d ago`);
};

/** Police: your record, TAKUKURU, robberies against you, and filing a report. */
export function Polisi({ back, close }) {
  const run = useStore((s) => s.run);
  const [d, setD] = useState(null);
  const [f, setF] = useState({ username: '', note: '' });
  const load = () => api('/police').then(setD).catch(() => {});
  useEffect(() => { load(); }, []);
  const report = async (username) => {
    const u = username.replace(/^@/, '').trim();
    if (!u) return;
    const r = await run(`/players/${encodeURIComponent(u)}/report-police`, { method: 'POST', body: { note: f.note } });
    if (!r) return;
    sfx(r.caught ? 'cash' : 'notify');
    useStore.getState().toast(
      !r.found ? L('Ripoti imepokelewa. Polisi watamfuatilia.', 'Report filed. The police will keep an eye on them.')
        : r.caught ? L(`🚓 Amekamatwa!${r.back ? ` Umerudishiwa ${fmtTsh(r.back)}.` : ''}`, `🚓 Arrested!${r.back ? ` You got ${fmtTsh(r.back)} back.` : ''}`)
          : L('🏃 Ametoroka kwa sasa… polisi wanamtafuta.', '🏃 They got away for now… the police are looking.'),
    );
    setF({ username: '', note: '' });
    load();
  };
  return (
    <>
      <AppHead title={L('Polisi', 'Police')} onBack={back} />
      <div className="app-body">
        <div className="pol-card">
          <div style={{ fontSize: 34 }}>🚓</div>
          <b>{L('Kituo cha Polisi Oysterbay', 'Oysterbay Police Station')}</b>
          <small>{d ? (d.arrestCount ? L(`Umekamatwa mara ${d.arrestCount}`, `${d.arrestCount} arrest${d.arrestCount > 1 ? 's' : ''} on your record`) : L('Rekodi safi — hujawahi kukamatwa', 'Clean record — never arrested')) : '…'}</small>
          <button className="btn btn-white btn-sm" style={{ marginTop: 10 }} onClick={() => { close?.(); goToPlace('polisi'); }}>📍 {L('Nenda kituoni', 'Go to the station')}</button>
        </div>

        {d && (
          <div className={`pol-box ${d.takukuru.watching ? 'warn' : ''}`}>
            <b>🕵🏾 {d.takukuru.watching ? L('TAKUKURU wanakufuatilia', 'TAKUKURU is watching you') : L('Hakuna faili TAKUKURU', 'No TAKUKURU file on you')}</b>
            <small>{d.takukuru.watching
              ? L('Utajiri wa ghafla, ripoti za wizi au kukamatwa mara kwa mara kumewashtua. Jiepushe na matatizo.', 'Sudden wealth, robbery reports or repeat arrests caught their eye. Keep your nose clean.')
              : L('TAKUKURU huangalia utajiri wa ghafla na matumizi makubwa, na mara nyingine huchimba makosa ya zamani.', 'TAKUKURU notices sudden wealth and big spending, and sometimes digs into past crimes.')}</small>
          </div>
        )}

        {d?.robbed?.length > 0 && (
          <>
            <div className="section-t">{L('WIZI DHIDI YAKO (SIKU 7)', 'ROBBERIES AGAINST YOU (7 DAYS)')}</div>
            {d.robbed.map((r) => (
              <div key={r.id} className="inv-row">
                <span className="em">🦹</span>
                <div className="grow"><b>@{r.username} · {fmtTsh(r.amount)}</b><small>{ago(r.created_at)}{r.reported ? ` · ${L('imeripotiwa', 'reported')}` : ''}</small></div>
                {r.canReport && <button className="btn btn-red btn-sm" onClick={() => report(r.username)}>{L('Ripoti', 'Report')}</button>}
              </div>
            ))}
          </>
        )}

        <div className="pol-box">
          <b>📝 {L('Ripoti mtu polisi', 'Report someone to the police')}</b>
          <small>{L('Kwa makosa ya mchezo kama wizi. Anayeripotiwa mara nyingi anakuwa hatarini zaidi. Kwa unyanyasaji au jambo halisi, tumia ⚑ Ripoti kwenye wasifu wake.', 'For in-game crimes, like a robbery. Robbing gets riskier for whoever the police have reports on. For harassment or anything real, use ⚑ Report on their profile.')}</small>
          <input className="field" placeholder="@username" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} autoCapitalize="none" autoCorrect="off" />
          <input className="field" placeholder={L('Nini kilitokea? (hiari)', 'What happened? (optional)')} value={f.note} maxLength={140} onChange={(e) => setF({ ...f, note: e.target.value })} />
          <button className="btn btn-green btn-block" disabled={!f.username.trim()} onClick={() => report(f.username)}>{L('Wasilisha ripoti', 'File the report')}</button>
        </div>

        {d?.arrests?.length > 0 && (
          <>
            <div className="section-t">{L('REKODI YAKO', 'YOUR RECORD')}</div>
            {d.arrests.map((a, i) => (
              <div key={i} className="inv-row"><span className="em">🚓</span><div className="grow"><b>{pick(a.reason)}</b><small>{L('Faini', 'Fine')} {fmtTsh(a.fine)} · {ago(a.created_at)}</small></div></div>
            ))}
          </>
        )}
      </div>
    </>
  );
}
