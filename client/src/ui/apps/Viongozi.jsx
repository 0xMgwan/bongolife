import { useEffect, useState } from 'react';
import { fmtShort, fmtTsh } from '@shared/world.js';
import { api } from '../../api.js';
import { useStore } from '../../store.js';
import { avatarEmoji } from '../../three/Avatar.jsx';
import { AppHead } from '../Phone.jsx';
import { L } from '../../i18n.js';
import { sfx } from '../../audio.js';
import { share } from '../share.js';

function left(ms) {
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return d > 0 ? L(`siku ${d} saa ${h}`, `${d}d ${h}h`) : L(`saa ${h} dk ${m}`, `${h}h ${m}m`);
}

/** Mayor election: current Mkuu wa Mkoa, this week's candidates, vote / run. */
function Uchaguzi({ open }) {
  const me = useStore((s) => s.me);
  const run = useStore((s) => s.run);
  const [e, setE] = useState(null);
  const [slogan, setSlogan] = useState('');
  const [msg, setMsg] = useState(null);
  useEffect(() => {
    api('/election').then(setE).catch(() => {});
  }, []);
  if (!e) return <div className="small muted" style={{ padding: 12 }}>{L('Inapakia…', 'Loading…')}</div>;
  const total = e.candidates.reduce((a, c) => a + c.votes, 0) || 1;
  const vote = async (c) => {
    const r = await run('/election/vote', { method: 'POST', body: { username: c.username } });
    if (r) { setE(r); sfx('cash'); useStore.getState().toast(L(`🗳️ Umempigia kura @${c.username}`, `🗳️ You voted for @${c.username}`)); }
  };
  const stand = async (ev) => {
    ev.preventDefault();
    const r = await run('/election/run', { method: 'POST', body: { slogan } });
    if (r) { setE(r); setSlogan(''); }
  };
  const saveMsg = async () => {
    const r = await run('/election/message', { method: 'POST', body: { text: msg } });
    if (r) { setE(r); setMsg(null); }
  };
  const mayor = e.mayor;
  const iAmMayor = mayor?.id === me.id;
  return (
    <>
      <div className="mayor-card">
        <div className="small bold" style={{ color: '#92400e', marginBottom: 8 }}>🏛️ {L('MKUU WA MKOA WA DAR', 'MAYOR OF DAR')}</div>
        {mayor ? (
          <div className="row" style={{ gap: 12 }}>
            <span className="big-face">{avatarEmoji(mayor.appearance)}</span>
            <div className="grow">
              <b style={{ fontSize: 17 }}>👑 @{mayor.username}</b>
              <div className="small" style={{ color: '#78350f' }}>{L(`Ameshinda kwa kura ${mayor.votes}`, `Won with ${mayor.votes} votes`)}</div>
              {mayor.message && msg === null && <div className="small" style={{ marginTop: 6 }}>“{mayor.message}”</div>}
            </div>
          </div>
        ) : (
          <div className="small">{L('Hakuna Mkuu bado — uchaguzi wa kwanza unaendelea. Gombea sasa!', 'No Mayor yet — the first election is on. Run now!')}</div>
        )}
        {iAmMayor && (msg === null ? (
          <button className="btn btn-white btn-xs" style={{ marginTop: 10 }} onClick={() => setMsg(mayor.message || '')}>📣 {L('Andika ujumbe kwa jiji', 'Post a message to the city')}</button>
        ) : (
          <div className="row" style={{ gap: 6, marginTop: 10 }}>
            <input className="field" style={{ padding: '9px 14px', fontSize: 14 }} maxLength={e.rules.messageMax} value={msg} onChange={(ev) => setMsg(ev.target.value)} placeholder={L('Ujumbe wa Mkuu…', "Mayor's message…")} />
            <button className="btn btn-dark btn-xs" onClick={saveMsg}>{L('Weka', 'Post')}</button>
          </div>
        ))}
        <div className="small" style={{ marginTop: 10, color: '#78350f' }}>
          🗳️ {L(`Uchaguzi wa wiki hii unaisha baada ya ${left(e.endsAt - Date.now())}. Mshindi anapata ${fmtTsh(e.rules.salary)} na taji 👑.`, `This week's election closes in ${left(e.endsAt - Date.now())}. The winner gets ${fmtTsh(e.rules.salary)} and the crown 👑.`)}
        </div>
      </div>

      <div className="row between"><div className="section-t" style={{ margin: '6px 0' }}>{L('Wagombea', 'Candidates')} · {e.candidates.length}</div>
        <button className="link-share" onClick={() => share({ title: 'Bongo Life', text: L('Njoo upige kura ya Mkuu wa Mkoa wa Bongo Life! 🗳️', 'Come vote for the Mayor of Bongo Life! 🗳️') })}>🔗 {L('Shiriki', 'Share')}</button>
      </div>
      <div className="box" style={{ padding: '2px 12px' }}>
        {!e.candidates.length && <div className="small muted" style={{ padding: 12 }}>{L('Bado hakuna anayegombea wiki hii.', 'Nobody is running this week yet.')}</div>}
        {e.candidates.map((c, i) => (
          <div key={c.id} className="cand">
            <span className="avatar-dot" style={{ width: 38, height: 38 }}>{avatarEmoji(c.appearance)}</span>
            <div className="grow" style={{ minWidth: 0 }}>
              <b>{i === 0 && c.votes > 0 ? '🥇 ' : ''}@{c.username}</b>
              {c.slogan && <div className="small muted" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>“{c.slogan}”</div>}
              <div className="bar"><i style={{ width: `${(c.votes / total) * 100}%` }} /></div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="small bold">{c.votes} {L('kura', 'votes')}</div>
              {e.myVote === c.id ? (
                <span className="tag friend">✓ {L('Kura yako', 'Your vote')}</span>
              ) : (
                <button className="btn btn-dark btn-xs" disabled={!e.canVote} onClick={() => vote(c)}>🗳️ {L('Piga kura', 'Vote')}</button>
              )}
            </div>
          </div>
        ))}
      </div>
      {!e.canVote && <div className="hint">{L('Maliza shifti moja ya kazi ili upige kura.', 'Finish one work shift to be able to vote.')}</div>}
      {e.myVote && <div className="hint">{L('Unaweza kubadilisha kura yako mpaka uchaguzi uishe.', 'You can change your vote until the election closes.')}</div>}

      {!e.iAmCandidate && (
        <form className="box" onSubmit={stand} style={{ marginTop: 12 }}>
          <b>🏛️ {L('Gombea Ukuu wa Mkoa', 'Run for Mayor')}</b>
          <div className="small muted" style={{ margin: '4px 0 8px' }}>{L(`Ada ya kampeni ${fmtTsh(e.rules.fee)}. Unahitaji shifti ${e.rules.candidateShifts}+ za kazi.`, `Campaign fee ${fmtTsh(e.rules.fee)}. You need ${e.rules.candidateShifts}+ work shifts.`)}</div>
          <input className="field" style={{ padding: '10px 14px', fontSize: 14 }} maxLength={e.rules.sloganMax} value={slogan} onChange={(ev) => setSlogan(ev.target.value)} placeholder={L('Kauli mbiu — mf. "Daladala bure Ijumaa!"', 'Slogan — e.g. "Free daladala Fridays!"')} />
          <button className="btn btn-green btn-block btn-sm" style={{ marginTop: 8 }} disabled={!e.canRun || me.money < e.rules.fee}>{L('Jiandikishe kugombea', 'Join the race')} · {fmtTsh(e.rules.fee)}</button>
          {!e.canRun && <div className="hint">{L(`Fanya shifti ${e.rules.candidateShifts} za kazi kwanza.`, `Work ${e.rules.candidateShifts} shifts first.`)}</div>}
        </form>
      )}
      <div style={{ height: 8 }} />
      <button className="btn btn-ghost btn-block btn-sm" onClick={() => open('watu')}>🤝 {L('Waombe marafiki wakupigie kura', 'Ask your friends for votes')}</button>
    </>
  );
}

export function Viongozi({ back, open }) {
  const [lb, setLb] = useState(null);
  const [tab, setTab] = useState('mayor');
  const me = useStore((s) => s.me);
  useEffect(() => {
    api('/leaderboard').then(setLb).catch(() => {});
  }, []);
  const rows = lb?.[tab] || [];
  return (
    <>
      <AppHead title={L('Viongozi wa Dar', 'Leaders of Dar')} onBack={back} />
      <div className="app-body">
        <div className="seg">
          <button className={tab === 'mayor' ? 'on' : ''} onClick={() => setTab('mayor')}>🗳️ {L('Meya', 'Mayor')}</button>
          <button className={tab === 'rich' ? 'on' : ''} onClick={() => setTab('rich')}>💰 {L('Utajiri', 'Wealth')}</button>
          <button className={tab === 'famous' ? 'on' : ''} onClick={() => setTab('famous')}>⭐ {L('Umaarufu', 'Fame')}</button>
        </div>
        {tab === 'mayor' ? <Uchaguzi open={open} /> : (
          <div className="box" style={{ padding: '2px 12px' }}>
            {!lb && <div className="small muted" style={{ padding: 12 }}>{L('Inapakia…', 'Loading…')}</div>}
            {rows.map((r, i) => (
              <button key={r.id} className="lb-row" style={{ width: '100%', textAlign: 'left', background: r.username === me.username ? 'var(--green-l)' : undefined, borderRadius: 12 }} onClick={() => r.username !== me.username && open('dm', r.username)}>
                <span className="rank">{i + 1}</span>
                <span className="avatar-dot" style={{ width: 34, height: 34, fontSize: 17 }}>{avatarEmoji(r.appearance)}</span>
                <div className="grow"><b>@{r.username}</b><div className="small muted">{r.name}</div></div>
                {tab === 'rich' ? (
                  <span style={{ textAlign: 'right' }}>
                    <b>TSh {fmtShort(r.money)}</b>
                    <div className="small muted">{L('Mali', 'Worth')} {fmtShort(r.worth)}</div>
                  </span>
                ) : <b>⭐ {r.fame}</b>}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
