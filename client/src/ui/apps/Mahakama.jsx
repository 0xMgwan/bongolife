import { useEffect, useRef, useState } from 'react';
import { fmtTsh } from '@shared/world.js';
import { useStore } from '../../store.js';
import { api } from '../../api.js';
import { AppHead } from '../Phone.jsx';
import { VoicePlayer, useVoiceRecorder } from './Messages.jsx';
import { L, pick } from '../../i18n.js';
import { sfx } from '../../audio.js';

const ROLE = { defendant: ['Mshtakiwa', 'Defendant'], plaintiff: ['Mlalamikaji', 'Plaintiff'], judge: ['Jaji', 'Judge'] };
const mmss = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

function CaseView({ id, back }) {
  const run = useStore((s) => s.run);
  const courtVersion = useStore((s) => s.courtVersion);
  const [c, setC] = useState(null);
  const [text, setText] = useState('');
  const [judgeName, setJudgeName] = useState('');
  const [reason, setReason] = useState('');
  const [now, setNow] = useState(Date.now());
  const end = useRef();
  const load = () => api(`/court/cases/${id}`).then(setC).catch((e) => { useStore.getState().toast(e.message, 'err'); back(); });
  useEffect(() => { load(); }, [id, courtVersion]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [c?.statements.length]);
  const post = async (path, body, ok) => {
    const r = await run(`/court/cases/${id}${path}`, { method: 'POST', body });
    if (r) { setC(r); if (ok) useStore.getState().toast(ok); sfx('pop'); }
    return r;
  };
  const voice = useVoiceRecorder(async (blob, secs) => {
    const form = new FormData();
    form.append('audio', blob, `voice.${blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm'}`);
    form.append('duration', String(secs));
    try { setC(await api(`/court/cases/${id}/voice`, { method: 'POST', form })); sfx('pop'); } catch (e) { useStore.getState().toast(e.message, 'err'); }
  });
  if (!c) return <div className="app-body"><div className="small muted" style={{ padding: 12 }}>{L('Inapakia…', 'Loading…')}</div></div>;
  const hearing = c.status === 'hearing';
  const open = hearing && now < c.hearingEndsAt;
  const canSpeak = hearing && (c.role === 'judge' || ((c.role === 'defendant' || c.role === 'plaintiff') && open));
  const isParty = c.role === 'defendant' || c.role === 'plaintiff';
  const send = (e) => { e.preventDefault(); if (text.trim()) { post('/statement', { text }); setText(''); } };
  return (
    <>
      <div className="court-head">
        <div className="ch-t">⚖️ {L('Kesi', 'Case')} #{c.id} · {pick(c.reason)}</div>
        <div className="ch-p">
          <span>🧍 {L('Mshtakiwa', 'Defendant')}: <b>@{c.defendant}</b></span>
          <span>🙋 {L('Mlalamikaji', 'Plaintiff')}: <b>{c.plaintiff ? `@${c.plaintiff}` : L('Jamhuri', 'The State')}</b></span>
        </div>
        <div className="ch-j">
          🧑‍⚖️ {c.judge.kind === 'player' ? L(`Jaji: @${c.judge.username}`, `Judge: @${c.judge.username}`) : L('Jaji: Mheshimiwa Hakimu (wa kawaida)', 'Judge: Mheshimiwa Hakimu (standard)')}
          {hearing && <span className="ch-time">{open ? L(`Usikilizaji: ${mmss(c.hearingEndsAt - now)}`, `Hearing: ${mmss(c.hearingEndsAt - now)}`) : c.judgeDeadline ? L(`Jaji anaamua: ${mmss(c.judgeDeadline - now)}`, `Judge deciding: ${mmss(c.judgeDeadline - now)}`) : L('Hakimu anaamua…', 'Magistrate deciding…')}</span>}
        </div>
        {c.verdict && (
          <div className={`ch-verdict ${c.verdict}`}>
            <b>{c.verdict === 'guilty' ? L('HATIA', 'GUILTY') : L('HANA HATIA', 'NOT GUILTY')}</b>
            <small>{pick(c.verdictReason || ['', ''])} — {c.decidedBy === 'hakimu' ? L('Mheshimiwa Hakimu', 'Mheshimiwa Hakimu') : c.decidedBy}</small>
            {c.verdict === 'guilty' && <small>{L(`Faini ${fmtTsh(c.fine)}${c.plaintiff ? ' (nusu ni fidia kwa mlalamikaji)' : ''}`, `Fine ${fmtTsh(c.fine)}${c.plaintiff ? ' (half compensates the plaintiff)' : ''}`)}</small>}
          </div>
        )}
      </div>

      {/* judge selection */}
      {hearing && isParty && c.judge.status === 'none' && (
        <form className="court-judge" onSubmit={(e) => { e.preventDefault(); if (judgeName.trim()) post('/judge', { username: judgeName.trim() }, L('Pendekezo limetumwa', 'Proposal sent')); setJudgeName(''); }}>
          <small>{L('Unaweza kupendekeza mchezaji awe jaji (pande zote zikubali). Asipochaguliwa, Hakimu wa kawaida atasikiliza pande zote na kuamua.', 'Propose a player to judge (both sides must agree). Otherwise the standard magistrate hears both sides and decides.')}</small>
          <div className="row" style={{ gap: 6 }}>
            <input className="field" style={{ margin: 0 }} placeholder={L('@jaji', '@judge')} value={judgeName} onChange={(e) => setJudgeName(e.target.value)} autoCapitalize="none" />
            <button className="btn btn-dark btn-sm">{L('Pendekeza', 'Propose')}</button>
          </div>
        </form>
      )}
      {hearing && isParty && c.judge.status === 'proposed' && (
        <div className="court-judge">
          {c.judge.proposedBy === useStore.getState().me.username
            ? <small>⏳ {L(`Unasubiri upande mwingine ukubali @${c.judge.username} awe jaji.`, `Waiting for the other side to accept @${c.judge.username} as judge.`)}</small>
            : (
              <>
                <small>{L(`@${c.judge.proposedBy} amependekeza @${c.judge.username} awe jaji.`, `@${c.judge.proposedBy} proposed @${c.judge.username} as judge.`)}</small>
                <div className="row" style={{ gap: 6 }}>
                  <button className="btn btn-ghost btn-sm grow" onClick={() => post('/judge/answer', { accept: false })}>{L('Kataa', 'Decline')}</button>
                  <button className="btn btn-green btn-sm grow" onClick={() => post('/judge/answer', { accept: true })}>{L('Kubali', 'Accept')}</button>
                </div>
              </>
            )}
        </div>
      )}
      {hearing && isParty && c.judge.status === 'invited' && <div className="court-judge"><small>⏳ {L(`Tunasubiri @${c.judge.username} akubali kuwa jaji.`, `Waiting for @${c.judge.username} to accept.`)}</small></div>}
      {hearing && c.role === 'invited' && (
        <div className="court-judge">
          <small>{L('Umeombwa kuwa jaji wa kesi hii. Sikiliza pande zote kisha toa hukumu — utalipwa TSh 20,000.', "You've been asked to judge this case. Hear both sides, then rule — you'll be paid TSh 20,000.")}</small>
          <div className="row" style={{ gap: 6 }}>
            <button className="btn btn-ghost btn-sm grow" onClick={() => post('/judge/invite', { accept: false })}>{L('Kataa', 'Decline')}</button>
            <button className="btn btn-green btn-sm grow" onClick={() => post('/judge/invite', { accept: true }, L('🧑‍⚖️ Wewe ni jaji sasa', '🧑‍⚖️ You are the judge now'))}>🧑‍⚖️ {L('Nitakuwa jaji', "I'll judge")}</button>
          </div>
        </div>
      )}

      <div className="app-body" style={{ background: '#f5f1e8' }}>
        <div className="msgs">
          {c.statements.length === 0 && <div className="center small muted" style={{ padding: 16 }}>{L('Bado hakuna maelezo. Wahusika wanaweza kuandika au kurekodi sauti.', 'No statements yet. The parties can write or record a voice note.')}</div>}
          {c.statements.map((s) => (
            <div key={s.id} className={`bubble court-stmt r-${s.role} ${s.username === useStore.getState().me.username ? 'me' : ''}`}>
              <b className="bubble-from">{s.role === 'judge' ? '🧑‍⚖️' : s.role === 'defendant' ? '🧍' : '🙋'} @{s.username} · {pick(ROLE[s.role] || ['', ''])}</b>
              {s.kind === 'voice' ? <VoicePlayer m={s} /> : s.body}
            </div>
          ))}
          <div ref={end} />
        </div>
      </div>

      {hearing && c.role === 'judge' && (
        <div className="court-rule">
          <input className="field" style={{ margin: 0 }} maxLength={300} placeholder={L('Sababu ya hukumu (hiari)', 'Reason for your ruling (optional)')} value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="row" style={{ gap: 6 }}>
            <button className="btn btn-green btn-sm grow" onClick={() => post('/rule', { verdict: 'not_guilty', reason }, L('⚖️ Hukumu imetolewa', '⚖️ Ruling given'))}>{L('Hana hatia', 'Not guilty')}</button>
            <button className="btn btn-red btn-sm grow" onClick={() => post('/rule', { verdict: 'guilty', reason }, L('⚖️ Hukumu imetolewa', '⚖️ Ruling given'))}>{L('Ana hatia', 'Guilty')}</button>
          </div>
        </div>
      )}
      {canSpeak && (voice.rec ? (
        <div className={`composer recording ${voice.rec.cancel ? 'cancel' : ''}`}>
          <span className="rec-dot" /> <b>{Math.floor(voice.rec.secs)}s</b>
          <span className="grow small">{voice.rec.cancel ? L('Achia kufuta', 'Release to cancel') : L('‹ Telezesha kushoto kufuta · achia kutuma', '‹ Slide left to cancel · release to send')}</span>
          <button className="mic on" onPointerUp={voice.stop} onPointerMove={(e) => voice.move(e.clientX)}>🎤</button>
        </div>
      ) : (
        <form className="composer" onSubmit={send}>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder={c.role === 'judge' ? L('Uliza swali kwa pande zote…', 'Ask the parties a question…') : L('Eleza upande wako…', 'Tell your side…')} maxLength={500} />
          {text.trim() ? <button className="btn btn-green btn-sm">{L('Tuma', 'Send')}</button> : (
            <button type="button" className="mic" aria-label={L('Shikilia kurekodi', 'Hold to record')}
              onPointerDown={(e) => { e.currentTarget.setPointerCapture?.(e.pointerId); voice.start(e.clientX); }}
              onPointerMove={(e) => voice.move(e.clientX)} onPointerUp={voice.stop} onPointerCancel={voice.stop}
              onContextMenu={(e) => e.preventDefault()}>🎤</button>
          )}
        </form>
      ))}
    </>
  );
}

/** Kisutu Court: your cases (as defendant, plaintiff or judge), statements, judges and verdicts. */
export function Mahakama({ back, arg }) {
  const [cases, setCases] = useState(null);
  const [open, setOpen] = useState(arg ? Number(arg) : null);
  const courtVersion = useStore((s) => s.courtVersion);
  useEffect(() => { api('/court/cases').then(setCases).catch(() => setCases([])); }, [courtVersion, open]);
  if (open) return (<><AppHead title={L('Mahakama ya Kisutu', 'Kisutu Court')} onBack={() => setOpen(null)} /><CaseView id={open} back={() => setOpen(null)} /></>);
  return (
    <>
      <AppHead title={L('Mahakama ya Kisutu', 'Kisutu Court')} onBack={back} />
      <div className="app-body">
        <div className="co-intro">
          <b>⚖️ {L('Haki kwa wote', 'Justice for all')}</b>
          <small>{L('Ukikamatwa na kuchagua wakili, kesi yako inasikilizwa hapa. Pande zote zinatoa maelezo kwa maandishi au sauti; jaji ni mchezaji mnayemwamini au Hakimu wa kawaida.', 'If you are arrested and choose a lawyer, your case is heard here. Both sides give statements in writing or by voice; the judge is a player you both trust, or the standard magistrate.')}</small>
        </div>
        {cases?.length === 0 && <div className="box small muted">{L('Huna kesi yoyote. Endelea hivyo! 😇', 'You have no cases. Keep it that way! 😇')}</div>}
        {cases?.map((c) => (
          <button key={c.id} className="co-card" onClick={() => setOpen(c.id)}>
            <span className="co-logo" style={{ background: c.verdict === 'guilty' ? '#b91c1c' : c.verdict ? '#15803d' : '#78350f' }}>⚖️</span>
            <span className="grow">
              <b>#{c.id} · {pick(c.reason)}</b>
              <small>@{c.defendant}{c.plaintiff ? ` vs @${c.plaintiff}` : ''} · {c.role === 'judge' || c.role === 'invited' ? L('wewe ni jaji', "you're judging") : pick(ROLE[c.role] || ['', ''])}</small>
            </span>
            <span className="co-amt"><b>{c.verdict ? (c.verdict === 'guilty' ? L('Hatia', 'Guilty') : L('Huru', 'Cleared')) : L('Inaendelea', 'Ongoing')}</b></span>
          </button>
        ))}
      </div>
    </>
  );
}
