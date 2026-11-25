// Harambee: each city's community project. Chip in from anywhere; when the goal is reached the city
// gets a week of better pay and every donor gains fame.
import { useEffect, useState } from 'react';
import { fmtTsh, fmtShort } from '@shared/world.js';
import { useStore } from '../../store.js';
import { api } from '../../api.js';
import { AppHead } from '../Phone.jsx';
import { L } from '../../i18n.js';
import { sfx } from '../../audio.js';

const AMOUNTS = [10_000, 100_000, 1_000_000, 10_000_000];
const dateOf = (t) => new Date(t).toLocaleDateString([], { day: 'numeric', month: 'short' });

function CityCard({ c, rules, me, give }) {
  const [amount, setAmount] = useState(AMOUNTS[1]);
  const p = c.project;
  const pct = Math.min(100, (p.raised / p.goal) * 100);
  const left = p.goal - p.raised;
  return (
    <div className="hb-card">
      <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
        <span className="hb-em">{p.emoji}</span>
        <div className="grow">
          <small className="muted">{c.icon} {c.name}</small>
          <b>{L(p.name[0], p.name[1])}</b>
        </div>
      </div>
      {c.boostUntil > 0 && <div className="hb-boost">⚡ {L(`Kazi zote ${c.name} zinalipa +${rules.boostPay * 100}% hadi ${dateOf(c.boostUntil)}`, `Every job in ${c.name} pays +${rules.boostPay * 100}% until ${dateOf(c.boostUntil)}`)}</div>}
      <div className="hb-bar"><div style={{ width: `${pct}%` }} /></div>
      <div className="row small" style={{ justifyContent: 'space-between' }}>
        <span><b>{fmtShort(p.raised)}</b> / {fmtShort(p.goal)}</span>
        <span className="muted">{L(`wachangiaji ${c.donors}`, `${c.donors} donors`)}</span>
      </div>
      {c.top.length > 0 && (
        <div className="hb-top small">
          {c.top.map((t, i) => <span key={t.username}>{['🥇', '🥈', '🥉', '4.', '5.'][i]} @{t.username} {fmtShort(t.total)}</span>)}
        </div>
      )}
      {c.mine > 0 && <div className="small green" style={{ margin: '6px 0' }}>🤝 {L(`Umechangia ${fmtTsh(c.mine)} — asante!`, `You've given ${fmtTsh(c.mine)} — thank you!`)}</div>}
      <div className="chips" style={{ marginTop: 8 }}>
        {AMOUNTS.filter((a) => a <= Math.max(left, rules.minGift)).map((a) => <button key={a} className={`chip ${amount === a ? 'on' : ''}`} onClick={() => setAmount(a)}>{fmtShort(a)}</button>)}
      </div>
      <button className="btn btn-green btn-block btn-sm" style={{ marginTop: 8 }} disabled={me.money < Math.min(amount, left)} onClick={() => give(c, Math.min(amount, left))}>
        🤝 {L('Changia', 'Chip in')} {fmtTsh(Math.min(amount, left))}
      </button>
    </div>
  );
}

export function Harambee({ back }) {
  const me = useStore((s) => s.me);
  const run = useStore((s) => s.run);
  const [d, setD] = useState(null);
  useEffect(() => { api('/harambee').then(setD).catch(() => {}); }, []);
  const give = async (c, amount) => {
    const r = await run(`/harambee/${c.city}`, { method: 'POST', body: { amount } });
    if (!r) return;
    setD(r);
    if (r.me) useStore.setState({ me: r.me });
    sfx(r.completed ? 'levelup' : 'cash');
    if (!r.completed) useStore.getState().toast(L(`🤝 Asante kwa kuchangia ${fmtTsh(r.gave)}!`, `🤝 Thanks for giving ${fmtTsh(r.gave)}!`));
  };
  return (
    <>
      <AppHead title={L('Harambee 🤝', 'Harambee 🤝')} onBack={back} />
      <div className="app-body">
        <div className="box small" style={{ background: '#f0fdf4' }}>
          {L('Kila mji una mradi wa jamii. Changia ukiwa popote — mradi ukikamilika, kazi zote za mji huo zinalipa zaidi kwa wiki nzima na wachangiaji wanapata umaarufu.', 'Every city has a community project. Chip in from anywhere — when it’s funded, every job in that city pays more for a week and the donors gain fame.')}
        </div>
        {!d && <div className="small muted" style={{ padding: 12 }}>{L('Inapakia…', 'Loading…')}</div>}
        {d?.cities.map((c) => <CityCard key={c.city} c={c} rules={d.rules} me={me} give={give} />)}
      </div>
    </>
  );
}
