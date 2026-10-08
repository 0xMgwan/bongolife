import { useEffect, useState } from 'react';
import { WORK, workStage, perfMult, findJob, shiftPay, placeById, fmtTsh, gameClock } from '@shared/world.js';
import { useStore } from '../store.js';
import { api } from '../api.js';
import { L, loc, pick } from '../i18n.js';
import { sfx } from '../audio.js';
import { haptic } from '../haptics.js';
import { ask } from './Confirm.jsx';

const hhmmAt = (ms) => {
  // Real Dar time at a future moment.
  const c = gameClock(ms);
  return `${c.hour % 12 || 12}:${String(c.minute).padStart(2, '0')} ${c.hour < 12 ? 'AM' : 'PM'}`;
};

function Ring({ pct }) {
  const r = 9;
  const c = 2 * Math.PI * r;
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r={r} fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="4" />
      <circle cx="12" cy="12" r={r} fill="none" stroke={pct >= 70 ? '#4ade80' : pct >= 40 ? '#facc15' : '#f87171'} strokeWidth="4" strokeDasharray={`${(pct / 100) * c} ${c}`} transform="rotate(-90 12 12)" strokeLinecap="round" />
    </svg>
  );
}

/** Shift HUD: stages, performance, things to do, pay so far, clock out. */
export function WorkPanel({ me }) {
  const run = useStore((s) => s.run);
  const set = useStore((s) => s.set);
  const [now, setNow] = useState(Date.now());
  const [sel, setSel] = useState('work');
  const [min, setMin] = useState(false);
  const [pending, setPending] = useState(null);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  const b = me.busy;
  const { job } = findJob(b.id) || {};
  if (!job) return null;
  const place = placeById[b.placeId];
  const total = b.endsAt - b.startedAt;
  const frac = Math.min(1, Math.max(0, (now - b.startedAt) / total));
  const stage = workStage(frac);
  const working = stage >= 3;
  const canLeavePaid = frac >= WORK.minStayFrac;
  const full = shiftPay(job, { shifts: me.jobXp?.[b.id] || 0, mood: me.mood ?? 60, trait: me.trait, fame: me.fame }) * perfMult(b.perf, b.done);
  const soFar = Math.round((full * frac) / 100) * 100;
  const stayLeft = Math.max(0, Math.ceil((b.startedAt + total * WORK.minStayFrac - now) / 60000));
  const cd = b.cd || {};
  const task = WORK.tasks.find((t) => t.id === sel);

  const doTask = async (t) => {
    setSel(t.id);
    if (!working) return;
    setPending(t.id);
    haptic('tap');
    const r = await run('/act/task', { method: 'POST', body: { task: t.id } });
    setPending(null);
    if (r) sfx(t.perf > 0 ? 'coin' : 'pop');
  };
  const leave = async () => {
    if (!canLeavePaid) {
      if (!(await ask({ icon: '💼', title: L('Ondoka kazini?', 'Leave your shift?'), text: L('Ukiondoka sasa hupati malipo.', "Leave now and you won't get paid."), ok: L('Ondoka', 'Leave'), cancel: L('Endelea kazi', 'Keep working'), danger: true }))) return;
      return run('/act/cancel', { method: 'POST' });
    }
    try {
      const r = await api('/act/finish', { method: 'POST', body: { early: true } });
      set({ me: r.me, result: r.result });
      sfx('coin');
    } catch (e) {
      useStore.getState().toast(e.message, 'err');
    }
  };

  if (min) {
    return (
      <button className="work-mini" onClick={() => setMin(false)}>
        💼 <b>{Math.round(frac * 100)}%</b> · {pick(WORK.stages[stage].slice(1))} ˅
      </button>
    );
  }
  return (
    <div className="work">
      <div className="row between">
        <div style={{ minWidth: 0 }}>
          <div className="w-title">{place?.icon} {loc(b, 'label')}</div>
          <div className="w-sub">{loc(place)}</div>
        </div>
        <button className="w-x" onClick={() => setMin(true)} aria-label={L('Punguza', 'Minimise')}>˄</button>
      </div>
      <div className="row" style={{ gap: 10, marginTop: 8 }}>
        <div className="w-bar grow"><i style={{ width: `${frac * 100}%` }} /></div>
        <span className="w-sub">{L('Nyumbani', 'Home')} {hhmmAt(b.endsAt)}</span>
      </div>
      <div className="w-pay">
        {canLeavePaid
          ? L(`Umepata ${fmtTsh(soFar)} hadi sasa`, `Earned ${fmtTsh(soFar)} so far`)
          : L(`Bado hujalipwa · kaa dakika ${stayLeft}`, `No pay yet · stay ${stayLeft} min`)}
      </div>
      <div className="row between" style={{ marginTop: 6 }}>
        <span className="row" style={{ gap: 6 }}><Ring pct={b.perf ?? 50} /> {b.perf ?? 50}%</span>
        <span className="w-sub">⭐ {b.done || 0}/{WORK.starsAt} · +{WORK.starBonus * 100}% {L('ukifika', 'at')} {WORK.starsAt}</span>
      </div>
      <div className="w-stage">{pick(WORK.stages[stage].slice(1))}</div>
      <div className="w-segs">
        {WORK.stages.map((s, i) => {
          const end = WORK.stages[i + 1]?.[0] ?? 1;
          const fill = Math.min(1, Math.max(0, (frac - s[0]) / (end - s[0])));
          return <i key={i}><em style={{ width: `${fill * 100}%` }} /></i>;
        })}
      </div>
      {WORK.stages[stage + 1] && <div className="w-sub" style={{ marginTop: 2 }}>{L('Kinachofuata', 'Next')}: {pick(WORK.stages[stage + 1].slice(1))}</div>}
      <div className="w-tasks">
        {WORK.tasks.map((t) => {
          const used = t.once && cd[t.id];
          const cooling = cd[t.id] && now - cd[t.id] < t.cooldown * 1000;
          return (
            <button key={t.id} className={`${sel === t.id ? 'on' : ''} ${!working || used || cooling ? 'dim' : ''}`} disabled={pending === t.id} onClick={() => doTask(t)} aria-label={loc(t)}>
              {t.emoji}
            </button>
          );
        })}
      </div>
      <div className="w-sub">{working ? loc(task) : L('Utaanza kazi baada ya kikao…', 'Tasks unlock after the brief…')}</div>
      <button className="w-leave" onClick={leave}>
        {canLeavePaid ? L(`Toka sasa · ${fmtTsh(soFar)}`, `Clock out · ${fmtTsh(soFar)}`) : L('Ondoka sasa · bila malipo', 'Leave now · no pay')}
      </button>
    </div>
  );
}
