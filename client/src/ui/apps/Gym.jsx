// Gym: fitness score, memberships, guided timed workouts, and personal trainers (NPC coaches or
// real players who sign up as trainers).
import { useEffect, useState } from 'react';
import { fmtTsh, fmtShort, placeById, cityAt, fitnessLabel } from '@shared/world.js';
import { useStore } from '../../store.js';
import { api } from '../../api.js';
import { local } from '../../net.js';
import { AppHead } from '../Phone.jsx';
import { ask } from '../Confirm.jsx';
import { goToPlace } from '../../nav.js';
import { L, loc } from '../../i18n.js';
import { sfx } from '../../audio.js';

const mins = (ms) => Math.max(1, Math.ceil(ms / 60_000));

export function Gym({ back, close }) {
  const me = useStore((s) => s.me);
  const run = useStore((s) => s.run);
  const [d, setD] = useState(null);
  const [session, setSession] = useState(null);
  const [form, setForm] = useState(null);
  const [, tick] = useState(0);
  const load = () => api('/gym').then((r) => { setD(r); if (r.active) setSession(r.active); }).catch(() => {});
  useEffect(() => { load(); const t = setInterval(() => tick((n) => n + 1), 15_000); return () => clearInterval(t); }, []);
  if (!d) return (<><AppHead title="Gym" onBack={back} /><div className="app-body"><div className="small muted" style={{ padding: 12 }}>{L('Inapakia…', 'Loading…')}</div></div></>);
  if (session) return <Workout active={session} d={d} onDone={(r) => { setSession(null); if (r) setD(r); else load(); }} />;
  const G = d.gym;
  const t = Date.now();
  const cooling = d.readyAt > t;
  const nearestGym = () => {
    const city = cityAt(local.x, local.z)?.id || 'dar';
    return G.places.find((id) => (cityAt(...placeById[id].pos)?.id || 'dar') === city) || G.places[0];
  };
  const startW = async (w) => {
    const r = await run('/gym/start', { method: 'POST', body: { id: w.id } });
    if (r?.active) { sfx('pop'); setSession(r.active); }
  };
  const buyM = async (m) => {
    if (!(await ask({ icon: m.emoji, title: L(`Nunua ${m.name}?`, `Buy ${m.nameEn}?`), text: fmtTsh(m.price), ok: L('Lipa', 'Pay') }))) return;
    const r = await run('/gym/membership', { method: 'POST', body: { id: m.id } });
    if (r) { setD(r); sfx('cash'); }
  };
  const hire = async (kind, ref, name, price) => {
    if (!(await ask({ icon: '🧑🏾‍🏫', title: L(`Mwajiri ${name} wiki moja?`, `Hire ${name} for a week?`), text: L(`${fmtTsh(price)} · mazoezi yako yanaongezeka 50% kwa siku 7.`, `${fmtTsh(price)} · your workouts give 50% more for 7 days.`), ok: L('Ajiri', 'Hire') }))) return;
    const r = await run('/gym/hire', { method: 'POST', body: { kind, ref } });
    if (r) { setD(r); sfx('levelup'); }
  };
  const [lab, labEn] = fitnessLabel(d.fitness);
  const gymPlace = placeById[d.atGym || nearestGym()];
  return (
    <>
      <AppHead title="Gym" onBack={back} />
      <div className="app-body">
        <div className="gym-hero">
          <div className="gym-score"><b>{Math.round(d.fitness)}</b><small>fitness</small></div>
          <div className="grow">
            <b>{L(lab, labEn)}</b>
            <div className="gym-bar"><i style={{ width: `${d.fitness}%` }} /></div>
            <small>🔥 {L(`Mfululizo wa siku ${d.streak}`, `${d.streak}-day streak`)} · 🏋🏾 {d.workouts} {L('mazoezi', 'workouts')}</small>
            <small>{d.membership ? `${d.membership.emoji} ${L(d.membership.name, d.membership.nameEn)} · ${L('hadi', 'until')} ${new Date(d.membership.until).toLocaleDateString()}` : L('Huna uanachama', 'No membership')}{d.trainer ? ` · 🧑🏾‍🏫 ${d.trainer.name}` : ''}</small>
          </div>
        </div>
        <div className="small muted" style={{ margin: '6px 2px' }}>{L('Ukiwa fiti unatembea na kukimbia kwa kasi zaidi, na afya yako inaimarika. Usipofanya mazoezi, fitness hushuka kidogo kila siku.', 'Being fit makes you walk and run faster and boosts your health. Skip training and fitness slips a little each day.')}</div>
        {d.atGym ? <div className="box small" style={{ background: 'var(--green-l)' }}>✅ {L(`Uko ${loc(placeById[d.atGym])} — tayari kwa mazoezi!`, `You're at ${loc(placeById[d.atGym])} — ready to train!`)}</div>
          : <button className="btn btn-dark btn-block" onClick={() => { close?.(); goToPlace(gymPlace.id); }}>📍 {L(`Nenda ${loc(gymPlace)}`, `Go to ${loc(gymPlace)}`)}</button>}

        <div className="section-t">{L('MAZOEZI', 'WORKOUTS')}{cooling ? ` · ⏳ ${L(`dk ${mins(d.readyAt - t)}`, `${mins(d.readyAt - t)} min`)}` : ''}</div>
        <div className="gym-grid">
          {G.workouts.map((w) => {
            const locked = !w.home && (!d.membership || (w.elite && !d.membership.elite));
            return (
              <button key={w.id} className={`gym-w ${locked ? 'locked' : ''}`} disabled={cooling || (!w.home && !d.atGym) || locked} onClick={() => startW(w)}>
                <span>{w.emoji}</span>
                <b>{L(w.name, w.nameEn)}</b>
                <small>{w.secs}s · ⚡{w.energy} · 💪+{w.fitness}{w.home ? ` · ${L('popote', 'anywhere')}` : ''}</small>
                {locked && <i>🔒 {w.elite ? 'Elite' : L('Uanachama', 'Members')}</i>}
              </button>
            );
          })}
        </div>

        <div className="section-t">{L('UANACHAMA', 'MEMBERSHIP')}</div>
        {G.memberships.map((m) => (
          <div key={m.id} className="inv-row">
            <span className="em">{m.emoji}</span>
            <div className="grow"><b>{L(m.name, m.nameEn)}</b><small>{m.days === 1 ? L('Siku 1', '1 day') : L(`Siku ${m.days}`, `${m.days} days`)}{m.gain ? ` · +${m.gain * 100}% ${L('matokeo', 'gains')}` : ''}</small></div>
            <button className="btn btn-green btn-sm" disabled={me.money < m.price} onClick={() => buyM(m)}>{fmtShort(m.price)}</button>
          </div>
        ))}

        <div className="section-t">{L('MAKOCHA (PERSONAL TRAINERS)', 'PERSONAL TRAINERS')}</div>
        {d.trainer ? (
          <div className="box small">🧑🏾‍🏫 {L(`Kocha wako: ${d.trainer.name} hadi ${new Date(d.trainer.until).toLocaleDateString()} — mazoezi yanaongezeka 50%.`, `Your trainer: ${d.trainer.name} until ${new Date(d.trainer.until).toLocaleDateString()} — workouts give 50% more.`)}{d.trainer.kind === 'player' ? L(' Mkiwa gym pamoja mnapata zaidi!', ' Train at the gym together for even more!') : ''}</div>
        ) : (
          <>
            {G.npcTrainers.map((c) => (
              <div key={c.id} className="inv-row">
                <span className="em">{c.emoji}</span>
                <div className="grow"><b>{c.name}</b><small>{L(c.focus[0], c.focus[1])} · {L('wiki 1', '1 week')}</small></div>
                <button className="btn btn-green btn-sm" disabled={me.money < c.price} onClick={() => hire('npc', c.id, c.name, c.price)}>{fmtShort(c.price)}</button>
              </div>
            ))}
            {d.trainers.length > 0 && <div className="small muted" style={{ margin: '8px 2px 4px' }}>{L('Wachezaji walio makocha:', 'Players who coach:')}</div>}
            {d.trainers.map((c) => (
              <div key={c.id} className="inv-row">
                <span className="em">{c.online ? '🟢' : '⚪'}</span>
                <div className="grow">
                  <b>@{c.username}</b>
                  <small>💪 {Math.round(c.fitness)} · {c.focus || L('Mazoezi yote', 'All-round')} · 👥 {c.clients}</small>
                  {c.bio && <small>“{c.bio}”</small>}
                </div>
                <button className="btn btn-green btn-sm" disabled={me.money < c.price} onClick={() => hire('player', c.id, `@${c.username}`, c.price)}>{fmtShort(c.price)}</button>
              </div>
            ))}
          </>
        )}

        <div className="section-t">{L('KUWA KOCHA', 'BECOME A TRAINER')}</div>
        {d.me?.active ? (
          <div className="box small">
            <b>🧑🏾‍🏫 {L('Wewe ni kocha', "You're a trainer")} · {fmtTsh(d.me.price)}/{L('wiki', 'week')}</b>
            <div>{L(`Umepata ${fmtTsh(d.me.earned)} · wateja hai: ${d.me.clients.length}`, `Earned ${fmtTsh(d.me.earned)} · active clients: ${d.me.clients.length}`)}</div>
            {d.me.clients.map((c) => <div key={c.username}>• @{c.username} · {L('hadi', 'until')} {new Date(c.until).toLocaleDateString()}</div>)}
            <div className="row" style={{ gap: 6, marginTop: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setForm({ price: d.me.price, focus: d.me.focus || '', bio: d.me.bio || '' })}>✏️ {L('Hariri', 'Edit')}</button>
              <button className="btn btn-ghost btn-sm" onClick={async () => { const r = await run('/gym/trainer', { method: 'DELETE' }); if (r) setD(r); }}>{L('Acha ukocha', 'Stop coaching')}</button>
            </div>
          </div>
        ) : d.fitness >= G.trainerMinFitness ? (
          !form && <button className="btn btn-green btn-block" onClick={() => setForm({ price: 100_000, focus: '', bio: '' })}>🧑🏾‍🏫 {L('Jisajili kama kocha', 'Sign up as a trainer')}</button>
        ) : (
          <div className="box small muted">{L(`Fikia fitness ${G.trainerMinFitness} uweze kufundisha wengine na kulipwa kila wiki.`, `Reach ${G.trainerMinFitness} fitness to coach other players and get paid weekly.`)}</div>
        )}
        {form && (
          <div className="box">
            <div className="label" style={{ marginTop: 0 }}>{L('Bei kwa wiki (TSh)', 'Price per week (TSh)')}</div>
            <input className="field" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            <div className="label">{L('Utaalamu', 'Speciality')}</div>
            <input className="field" maxLength={40} placeholder={L('mf. Nguvu, Yoga, Ndondi', 'e.g. Strength, Yoga, Boxing')} value={form.focus} onChange={(e) => setForm({ ...form, focus: e.target.value })} />
            <div className="label">{L('Kuhusu wewe', 'About you')}</div>
            <input className="field" maxLength={140} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
            <div className="row" style={{ gap: 6, marginTop: 8 }}>
              <button className="btn btn-green grow" onClick={async () => { const r = await run('/gym/trainer', { method: 'POST', body: form }); if (r) { setD(r); setForm(null); sfx('levelup'); } }}>{L('Hifadhi', 'Save')}</button>
              <button className="btn btn-ghost" onClick={() => setForm(null)}>{L('Ghairi', 'Cancel')}</button>
            </div>
            <div className="hint">{L(`Gym inachukua ${G.trainerCut * 100}%. Wateja wakiwa gym pamoja nawe wanapata zaidi, na wewe pia.`, `The gym keeps ${G.trainerCut * 100}%. Clients who train at the gym with you gain more — and so do you.`)}</div>
          </div>
        )}
      </div>
    </>
  );
}

/** A guided workout: each move gets its slice of the time; finish when the clock runs out. */
function Workout({ active, d, onDone }) {
  const run = useStore((s) => s.run);
  const w = d.gym.workouts.find((x) => x.id === active.id);
  const [t, setT] = useState(Date.now());
  useEffect(() => { const i = setInterval(() => setT(Date.now()), 250); return () => clearInterval(i); }, []);
  const total = w.secs * 1000;
  const elapsed = Math.min(total, t - active.at);
  const per = total / w.moves.length;
  const idx = Math.min(w.moves.length - 1, Math.floor(elapsed / per));
  const left = Math.ceil((total - elapsed) / 1000);
  const done = elapsed >= total;
  const finish = async () => {
    const r = await run('/gym/finish', { method: 'POST' });
    if (!r) return;
    sfx('levelup');
    useStore.getState().toast(L(`💪 +${r.gain} fitness (sasa ${Math.round(r.fitness)}) · ❤️ ${r.health}%${r.coached ? ` · kocha @${r.coached} alikuwepo!` : ''}`, `💪 +${r.gain} fitness (now ${Math.round(r.fitness)}) · ❤️ ${r.health}%${r.coached ? ` · coached by @${r.coached}!` : ''}`));
    onDone(r);
  };
  return (
    <>
      <AppHead title={L(w.name, w.nameEn)} onBack={async () => { await run('/gym/cancel', { method: 'POST' }); onDone(null); }} />
      <div className="app-body gym-session">
        <div className={`gym-pulse ${done ? 'done' : ''}`}>{done ? '🏆' : w.emoji}</div>
        <div className="gym-move">{done ? L('Umemaliza! 🔥', 'Done! 🔥') : L(w.moves[idx][0], w.moves[idx][1])}</div>
        <div className="gym-steps">{w.moves.map((m, i) => <span key={i} className={i < idx || done ? 'ok' : i === idx ? 'now' : ''}>{L(m[0], m[1])}</span>)}</div>
        <div className="gym-bar big"><i style={{ width: `${(elapsed / total) * 100}%` }} /></div>
        <div className="gym-left">{done ? '' : `${left}s`}</div>
        {d.trainer && <div className="small muted center">🧑🏾‍🏫 {d.trainer.name}: {L('"Endelea! Pumua vizuri!"', '"Keep going! Breathe!"')}</div>}
        <button className="btn btn-green btn-block" disabled={!done} onClick={finish}>{done ? L('Kusanya matokeo 💪', 'Collect your gains 💪') : L('Endelea…', 'Keep going…')}</button>
      </div>
    </>
  );
}
