import { fmtTsh, vehicleById, plotById, placeById, buildingById } from '@shared/world.js';
import { useStore } from '../../store.js';
import { walkTo, goToPlace } from '../../nav.js';
import { AppHead } from '../Phone.jsx';
import { L, loc, isEn } from '../../i18n.js';

export function Mali({ back, close }) {
  const me = useStore((s) => s.me);
  const run = useStore((s) => s.run);
  const go = (fn) => { close(); fn(); };
  return (
    <>
      <AppHead title={L('Mali Yangu', 'My Assets')} onBack={back} />
      <div className="app-body">
        <div className="bal" style={{ background: 'linear-gradient(135deg,#0ea5e9,#1d4ed8)' }}>
          <div className="small" style={{ opacity: 0.85 }}>{L('Thamani ya mali zote', 'Total net worth')}</div>
          <div className="n">{fmtTsh(me.netWorth)}</div>
          <div className="row between">
            <span className="small">{L('Kodi inayosubiri', 'Income waiting')}: <b>{fmtTsh(me.pendingIncome)}</b></span>
            <button className="btn btn-white btn-sm" disabled={!me.pendingIncome} onClick={() => run('/income/collect', { method: 'POST' }).then((r) => r && useStore.getState().toast(L(`🏦 Umekusanya ${fmtTsh(r.amount)}`, `🏦 Collected ${fmtTsh(r.amount)}`)))}>{L('Kusanya', 'Collect')}</button>
          </div>
        </div>

        <div className="section-t">{L('Magari', 'Vehicles')} ({me.vehicles.length})</div>
        {me.vehicles.length === 0 && <div className="box small muted">{L('Huna usafiri bado. Tembelea Yadi ya Magari Ubungo 🚗', 'No vehicle yet. Visit the Car Yard in Ubungo 🚗')} <button className="btn btn-ghost btn-xs" onClick={() => go(() => goToPlace('yadi'))}>{L('Nenda', 'Go')}</button></div>}
        {me.vehicles.map((v) => {
          const m = vehicleById[v.model];
          const active = me.activeVehicle === v.id;
          return (
            <div key={v.id} className="item" style={{ background: '#fff' }}>
              <span className="em" style={{ background: v.color }}>{m?.emoji}</span>
              <div className="grow"><div className="t">{loc(m)}</div><div className="s">{v.plate}</div></div>
              <button className={`btn btn-sm ${active ? 'btn-dark' : 'btn-green'}`} onClick={() => run('/vehicle/use', { method: 'POST', body: { vehicleId: active ? null : v.id } })}>{active ? L('Shuka', 'Get off') : L('Endesha', 'Drive')}</button>
            </div>
          );
        })}

        <div className="section-t">{L('Viwanja & Nyumba', 'Plots & Homes')} ({me.plots.length})</div>
        {me.plots.length === 0 && <div className="box small muted">{L('Huna kiwanja bado. Viwanja vinauzwa Kigamboni, Masaki, Mbezi, Kinondoni na Temeke 🏷️', 'No plots yet. Plots are on sale in Kigamboni, Masaki, Mbezi, Kinondoni and Temeke 🏷️')}</div>}
        {me.plots.map((p) => {
          const plot = plotById[p.id];
          const b = p.building && buildingById[p.building];
          return (
            <div key={p.id} className="item" style={{ background: '#fff' }}>
              <span className="em">{b ? '🏠' : '🏞️'}</span>
              <div className="grow"><div className="t">{loc(plot)}</div><div className="s">{b ? loc(b) : L('Hakijajengwa', 'Not built')}{b?.incomePerHour ? ` · ${fmtTsh(b.incomePerHour)}/${L('saa', 'hr')}` : ''}</div></div>
              <button className="btn btn-ghost btn-sm" onClick={() => go(() => walkTo([plot.pos[0], plot.pos[1] + plot.size / 2 + 1.5], () => useStore.setState({ sheet: { type: 'plot', id: p.id } }), loc(plot)))}>{L('Nenda', 'Go')}</button>
            </div>
          );
        })}

        <div className="section-t">{L('Biashara', 'Businesses')} ({me.businesses.length})</div>
        {me.businesses.length === 0 && <div className="box small muted">{L('Nunua genge, bar, duka la Kariakoo au club upate mapato kila saa 💼', 'Buy a food stall, bar, Kariakoo shop or club to earn income every hour 💼')}</div>}
        {me.businesses.map((b) => {
          const p = placeById[b.id];
          return (
            <div key={b.id} className="item" style={{ background: '#fff' }}>
              <span className="em">{p.icon}</span>
              <div className="grow"><div className="t">{p.business.label ? loc(p.business, 'label') : loc(p)}</div><div className="s">{fmtTsh(p.business.incomePerHour)}/{L('saa', 'hr')}</div></div>
              <button className="btn btn-ghost btn-sm" onClick={() => go(() => goToPlace(b.id))}>{L('Nenda', 'Go')}</button>
            </div>
          );
        })}
        <div className="hint center">{L('Kodi hujilimbikiza hadi saa 12 — kusanya mara kwa mara!', 'Income builds up for 12 hours max — collect often!')}</div>
      </div>
    </>
  );
}
