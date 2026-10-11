// Players hiring players: the jobs board (Kazi → Ajira), your employers (Kazi → Kazi zangu)
// and the hiring tools inside a company (Kampuni → Timu).
import { useEffect, useState } from 'react';
import { fmtTsh, fmtShort, HIRING } from '@shared/world.js';
import { useStore } from '../../store.js';
import { api } from '../../api.js';
import { sfx } from '../../audio.js';
import { ask } from '../Confirm.jsx';
import { L } from '../../i18n.js';

const ago = (t) => {
  const m = Math.round((Date.now() - t) / 60_000);
  return m < 60 ? L(`dk ${m}`, `${m}m`) : m < 1440 ? L(`saa ${Math.round(m / 60)}`, `${Math.round(m / 60)}h`) : L(`siku ${Math.round(m / 1440)}`, `${Math.round(m / 1440)}d`);
};

// ---------------------------------------------------------------- jobs board
export function JobsBoard({ tab, close }) {
  const run = useStore((s) => s.run);
  const me = useStore((s) => s.me);
  const [data, setData] = useState(null);
  const [applying, setApplying] = useState(null);
  const [note, setNote] = useState('');
  const load = () => api('/jobs/board').then(setData).catch(() => setData({ posts: [], employers: [] }));
  useEffect(() => { load(); }, []);
  if (!data) return <div className="small muted" style={{ padding: 12 }}>{L('Inapakia…', 'Loading…')}</div>;

  if (tab === 'mine') {
    const shift = async (s) => {
      const r = await run(`/staff/${s.id}/shift`, { method: 'POST' });
      if (r) { sfx('pop'); close?.(); }
    };
    const quit = async (s) => {
      if (!(await ask({ icon: '👋', title: L(`Acha kazi ${s.company}?`, `Quit ${s.company}?`), ok: L('Acha kazi', 'Quit'), danger: true }))) return;
      const r = await run(`/staff/${s.id}/leave`, { method: 'POST' });
      if (r) setData({ ...data, employers: r.employers });
    };
    return (
      <>
        {!data.employers.length && (
          <div className="box small">{L('Bado hujaajiriwa na mchezaji. Angalia Ajira — makampuni ya wachezaji yanatafuta watu.', "No player has hired you yet. Check Hiring — player companies are looking for people.")}</div>
        )}
        {data.employers.map((s) => (
          <div key={s.id} className="job-card">
            <div className="row" style={{ gap: 10 }}>
              <span className="co-logo" style={{ background: s.color }}>{s.logo}</span>
              <div className="grow">
                <b>{s.role}</b>
                <small>{s.company} · @{s.owner} · {s.shifts} {L('shifti', 'shifts')}</small>
              </div>
              <b className="job-wage">{fmtShort(s.wage)}</b>
            </div>
            {!s.canPay && <small className="red">⚠️ {L('Kampuni haina pesa ya mshahara sasa.', "The company can't pay wages right now.")}</small>}
            <div className="row" style={{ gap: 8, marginTop: 8 }}>
              <button className="btn btn-green btn-sm grow" disabled={!s.canPay || (me.busy && me.busy.endsAt > Date.now())} onClick={() => shift(s)}>💼 {L(`Piga shifti · dk ${Math.round(HIRING.shiftSecs / 60)}`, `Work a shift · ${Math.round(HIRING.shiftSecs / 60)} min`)}</button>
              <button className="btn btn-ghost btn-sm" onClick={() => quit(s)}>{L('Acha', 'Quit')}</button>
            </div>
          </div>
        ))}
      </>
    );
  }

  const applyTo = async (p) => {
    const r = await run(`/jobs/${p.id}/apply`, { method: 'POST', body: { note } });
    if (r) { sfx('pop'); setData({ ...data, posts: r.posts }); setApplying(null); setNote(''); useStore.getState().toast(L('📝 Ombi limetumwa! Bosi atakujulisha.', "📝 Application sent! The boss will let you know.")); }
  };
  return (
    <>
      <div className="box small" style={{ background: 'var(--green-l)' }}>
        📢 {L('Makampuni ya wachezaji wanaoajiri sasa. Ukiajiriwa, unalipwa kutoka akaunti ya kampuni kila shifti.', 'Player companies hiring right now. Once hired, you’re paid from the company account every shift.')}
      </div>
      {!data.posts.length && <div className="box small muted">{L('Hakuna anayeajiri kwa sasa. Una kampuni? Tangaza kazi kwenye Kampuni → Timu.', 'Nobody is hiring right now. Own a company? Post a job in Company → Team.')}</div>}
      {data.posts.map((p) => (
        <div key={p.id} className="job-card">
          <div className="row" style={{ gap: 10 }}>
            <span className="co-logo" style={{ background: p.color }}>{p.logo}</span>
            <div className="grow">
              <b>{p.role}</b>
              <small>{p.company} · @{p.owner} · ⭐ {p.reputation} · {ago(p.created_at)}</small>
            </div>
            <span className="job-wage"><b>{fmtShort(p.wage)}</b><small>/{L('shifti', 'shift')}</small></span>
          </div>
          {p.note && <p className="job-note">“{p.note}”</p>}
          <small className="muted">{L(`Nafasi ${p.slots - p.hired} kati ya ${p.slots}`, `${p.slots - p.hired} of ${p.slots} openings left`)}</small>
          {p.isMine ? <small className="muted"> · {L('Tangazo lako', 'Your post')}</small>
            : p.employed ? <div className="tag-ok">✅ {L('Unafanya kazi hapa', 'You work here')}</div>
            : p.mineApp === 'pending' ? <div className="tag-wait">⏳ {L('Ombi lako linasubiri', 'Your application is pending')}</div>
            : applying === p.id ? (
              <div className="sec-form" style={{ marginTop: 8 }}>
                <input className="field" maxLength={140} placeholder={L('Kwa nini wewe? (si lazima)', 'Why you? (optional)')} value={note} onChange={(e) => setNote(e.target.value)} />
                <button className="btn btn-green btn-sm" onClick={() => applyTo(p)}>{L('Tuma ombi', 'Send application')}</button>
              </div>
            ) : <button className="btn btn-dark btn-sm" style={{ marginTop: 8 }} onClick={() => { setApplying(p.id); setNote(''); }}>📝 {L('Omba kazi', 'Apply')}</button>}
        </div>
      ))}
    </>
  );
}

// ---------------------------------------------------------------- company team
export function TeamSection({ c, onChanged }) {
  const run = useStore((s) => s.run);
  const lo = c.industryDef.wage;
  const hi = lo * HIRING.maxWageMult;
  const [form, setForm] = useState(null);
  const [apps, setApps] = useState({});
  const post = async () => {
    const r = await run(`/companies/${c.id}/posts`, { method: 'POST', body: form });
    if (r) { sfx('pop'); setForm(null); onChanged(r.companies); useStore.getState().toast(L('📢 Tangazo la kazi limetoka — mtaa mzima umeona!', '📢 Job posted — the whole town has seen it!')); }
  };
  const call = async (path, body, ok) => {
    const r = await run(path, { method: 'POST', body });
    if (r) { onChanged(r.companies); if (ok) useStore.getState().toast(ok); }
    return r;
  };
  const loadApps = async (p) => setApps({ ...apps, [p.id]: await api(`/jobposts/${p.id}/applicants`).catch(() => []) });
  const answer = async (p, a, accept) => {
    const r = await call(`/jobapps/${a.id}`, { accept }, accept ? L(`🎉 Umemwajiri @${a.username}!`, `🎉 You hired @${a.username}!`) : null);
    if (r) loadApps(p);
  };
  return (
    <>
      <div className="section-t">{L('TIMU · WACHEZAJI', 'TEAM · PLAYERS')}</div>
      <div className="co-box">
        <small className="muted">{L(`Ajiri wachezaji halisi. Kila shifti unawalipa kutoka akaunti ya kampuni, kampuni inapata ${fmtShort(lo * HIRING.outputMult)}, na wanaofanya kazi wanaongeza uwezo wa kuhudumia wateja.`, `Hire real players. You pay them from the company account each shift, the company earns ${fmtShort(lo * HIRING.outputMult)}, and active staff let you serve more customers.`)}</small>
        {c.team.map((s) => (
          <div key={s.id} className="row between team-row">
            <span>
              <b>@{s.username}</b> · {s.role}
              <small className="muted"> · {fmtShort(s.wage)}/{L('shifti', 'shift')} · {s.shifts} {L('shifti', 'shifts')} · {s.active ? L('🟢 hai', '🟢 active') : L('⚪ hajafanya leo', '⚪ not today')}</small>
            </span>
            <span className="row" style={{ gap: 4 }}>
              <button className="btn btn-ghost btn-xs" onClick={async () => {
                const v = prompt(L(`Mshahara mpya (TSh ${lo.toLocaleString()}–${hi.toLocaleString()})`, `New wage (TSh ${lo.toLocaleString()}–${hi.toLocaleString()})`), s.wage);
                if (v) call(`/staff/${s.id}/wage`, { wage: Number(v.replace(/\D/g, '')) }, L('💰 Mshahara umebadilishwa', '💰 Wage updated'));
              }}>💰</button>
              <button className="btn btn-ghost btn-xs" onClick={async () => {
                if (await ask({ icon: '👋', title: L(`Mwachishe @${s.username}?`, `Let @${s.username} go?`), ok: L('Achisha', 'Let go'), danger: true })) call(`/staff/${s.id}/leave`);
              }}>✕</button>
            </span>
          </div>
        ))}

        {c.posts.map((p) => (
          <div key={p.id} className="post-row">
            <div className="row between">
              <span>📢 <b>{p.role}</b> <small className="muted">· {fmtShort(p.wage)} · {p.hired}/{p.slots} · {p.pending} {L('maombi', 'applicants')}</small></span>
              <span className="row" style={{ gap: 4 }}>
                <button className="btn btn-ghost btn-xs" disabled={Date.now() - p.announcedAt < HIRING.announceEveryMs} onClick={() => call(`/jobposts/${p.id}/announce`, {}, L('📢 Umetangaza tena!', '📢 Announced again!'))}>📢</button>
                <button className="btn btn-ghost btn-xs" onClick={() => call(`/jobposts/${p.id}/close`)}>{L('Funga', 'Close')}</button>
              </span>
            </div>
            {p.pending > 0 && !apps[p.id] && <button className="btn btn-dark btn-xs" style={{ marginTop: 6 }} onClick={() => loadApps(p)}>{L(`Ona maombi ${p.pending}`, `See ${p.pending} applicant(s)`)}</button>}
            {apps[p.id]?.map((a) => (
              <div key={a.id} className="app-row">
                <span className="grow">
                  <b>@{a.username}</b> <small className="muted">· ⭐ {a.fame} · 🎓 {a.elimu}</small>
                  {a.note && <small className="job-note">“{a.note}”</small>}
                </span>
                <button className="btn btn-green btn-xs" onClick={() => answer(p, a, true)}>{L('Ajiri', 'Hire')}</button>
                <button className="btn btn-ghost btn-xs" onClick={() => answer(p, a, false)}>✕</button>
              </div>
            ))}
            {apps[p.id] && !apps[p.id].length && <small className="muted">{L('Hakuna maombi mapya.', 'No new applications.')}</small>}
          </div>
        ))}

        {form ? (
          <div className="sec-form" style={{ marginTop: 10 }}>
            <input className="field" maxLength={30} placeholder={L('Cheo (mf. Mpishi, Kinyozi, Dereva)', 'Role (e.g. Cook, Barber, Rider)')} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
            <label className="small bold">{L('Mshahara kwa shifti', 'Wage per shift')}: {fmtTsh(form.wage)}</label>
            <input type="range" min={lo} max={hi} step={500} value={form.wage} onChange={(e) => setForm({ ...form, wage: Number(e.target.value) })} />
            <div className="row" style={{ gap: 6 }}>
              <span className="small bold">{L('Nafasi', 'Openings')}</span>
              {Array.from({ length: HIRING.maxSlots }, (_, i) => i + 1).map((n) => <button key={n} className={`chip ${form.slots === n ? 'on' : ''}`} style={{ padding: '6px 11px' }} onClick={() => setForm({ ...form, slots: n })}>{n}</button>)}
            </div>
            <input className="field" maxLength={140} placeholder={L('Ujumbe (si lazima): mf. “Lazima ujue kupika chipsi”', 'Message (optional): e.g. “Must know how to make chips”')} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            <div className="row" style={{ gap: 8 }}>
              <button className="btn btn-green btn-sm grow" disabled={form.role.trim().length < 2} onClick={post}>📢 {L('Tangaza kazi', 'Post & announce')}</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setForm(null)}>{L('Ghairi', 'Cancel')}</button>
            </div>
            <small className="muted">{L('Tangazo linaonekana kwenye chat ya mtaa na kwa kila aliye online.', 'The post shows in street chat and to everyone online.')}</small>
          </div>
        ) : (
          <button className="btn btn-dark btn-sm btn-block" style={{ marginTop: 10 }} disabled={c.posts.length >= HIRING.maxOpenPosts} onClick={() => setForm({ role: '', wage: Math.round((lo * 2) / 500) * 500, slots: 1, note: '' })}>📢 {L('Tunaajiri! Tangaza kazi', "We're hiring! Post a job")}</button>
        )}
      </div>
    </>
  );
}

/** Banner when someone announces a job while you're playing. */
export function HiringPop() {
  const pop = useStore((s) => s.hiringPop);
  const openPhone = useStore((s) => s.openPhone);
  useEffect(() => {
    if (!pop) return;
    const t = setTimeout(() => useStore.setState({ hiringPop: null }), 9000);
    return () => clearTimeout(t);
  }, [pop]);
  if (!pop) return null;
  return (
    <button key={pop.postId} className="side-pop green hiring-pop" onClick={() => { useStore.setState({ hiringPop: null }); openPhone('kazi', 'ajira'); }}>
      📢 <b>{pop.logo} {pop.company}</b> {L('inaajiri', 'is hiring')}: {pop.role} · {fmtShort(pop.wage)}/{L('shifti', 'shift')}
      <span className="small" style={{ display: 'block', opacity: 0.8 }}>{L('Gusa kuomba →', 'Tap to apply →')}</span>
    </button>
  );
}
