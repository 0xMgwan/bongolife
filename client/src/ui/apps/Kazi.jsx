import { PLACES, shiftPay, jobTitle, jobTitleEn, jobLevel, fmtTsh, vehicleById } from '@shared/world.js';
import { useStore } from '../../store.js';
import { goToPlace } from '../../nav.js';
import { AppHead } from '../Phone.jsx';
import { L, loc, isEn } from '../../i18n.js';

export function Kazi({ back, close }) {
  const me = useStore((s) => s.me);
  const jobs = PLACES.flatMap((p) => (p.jobs || []).map((j) => ({ j, p })));
  jobs.sort((a, b) => a.j.pay - b.j.pay);
  return (
    <>
      <AppHead title={L('Kazi · Chakarika', 'Jobs · Hustle')} onBack={back} />
      <div className="app-body">
        <div className="box small" style={{ background: 'var(--green-l)' }}>
          💡 {L('Mshahara unapanda kadri unavyofanya shifti nyingi (cheo) na ukiwa na mood nzuri. Kula, lala na pumzika ili ulipwe zaidi.', 'Pay rises as you work more shifts (promotions) and when your mood is good. Eat, sleep and relax to earn more.')}
        </div>
        {jobs.map(({ j, p }) => {
          const shifts = me.jobXp?.[j.id] || 0;
          const pay = shiftPay(j, { shifts, mood: me.mood, trait: me.trait, fame: me.fame });
          const lockE = j.requires?.elimu && me.elimu < j.requires.elimu;
          const lockV = j.requires?.vehicle && !me.vehicles.some((v) => j.requires.vehicle.includes(v.model));
          return (
            <div key={j.id} className="item" style={{ background: '#fff' }}>
              <span className="em">{p.icon}</span>
              <div className="grow">
                <div className="t">{isEn() ? jobTitleEn(j, shifts) : jobTitle(j, shifts)}</div>
                <div className="s">{loc(p)} · ~{fmtTsh(pay)}/{L('shifti', 'shift')} · Lv {jobLevel(shifts) + 1}</div>
                {lockE && <div className="s red">🎓 {L(`Elimu ${j.requires.elimu} inahitajika`, `Education ${j.requires.elimu} required`)}</div>}
                {lockV && <div className="s red">🔑 {j.requires.vehicle.map((m) => loc(vehicleById[m])).join(' / ')}</div>}
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => { close(); goToPlace(p.id); }}>{L('Nenda', 'Go')}</button>
            </div>
          );
        })}
      </div>
    </>
  );
}
