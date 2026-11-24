// Admin → Elections: every vote of a week, per candidate, with the signals of a vote farm
// (new accounts, invited by the candidate, shared networks). Strike votes, ban alts, unseat.
import { useState } from 'react';
import { useApi, act, dt } from './Admin.jsx';

const CITY = { dar: 'Dar', znz: 'Zanzibar', aru: 'Arusha', mwz: 'Mwanza', pwa: 'Pwani' };

function Candidate({ c, period, reload }) {
  const [open, setOpen] = useState(false);
  const flagged = c.voters.filter((v) => v.flags.length && !v.voided && !v.banned);
  const ids = (list) => list.map((v) => v.id);
  return (
    <div className="panel" style={{ marginBottom: 12 }}>
      <div className="row" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <b>@{c.username}</b>
        <span className="bdg b">{CITY[c.city] || c.city}</span>
        <span>{c.voters.length} votes · <b>{c.counted} counted</b></span>
        {c.suspicious > 0 && <span className="bdg r">⚠ {c.suspicious} suspicious</span>}
        <span style={{ flex: 1 }} />
        {flagged.length > 0 && (
          <>
            <button className="btn btn-xs btn-dark" onClick={async () => { if (await act('/elections/void', { body: { period, voterIds: ids(flagged) }, confirm: `Strike ${flagged.length} flagged votes for @${c.username}?` })) reload(); }}>Strike {flagged.length} flagged</button>
            <button className="btn btn-xs btn-red" onClick={async () => { if (await act('/elections/ban', { body: { ids: ids(flagged) }, confirm: `Ban ${flagged.length} flagged voter accounts?` })) reload(); }}>Ban flagged</button>
          </>
        )}
        <button className="btn btn-xs btn-outline" onClick={() => setOpen(!open)}>{open ? 'Hide' : 'Show'} voters</button>
      </div>
      {open && (
        <div className="tbl-wrap" style={{ marginTop: 10 }}>
          <table className="tbl">
            <thead><tr><th>Voter</th><th>Joined</th><th>Voted</th><th>Shifts</th><th>Network</th><th>Flags</th><th></th></tr></thead>
            <tbody>
              {c.voters.map((v) => (
                <tr key={v.id} style={{ opacity: v.voided || v.banned ? 0.45 : 1 }}>
                  <td><a href={`#/users/${v.id}`}>@{v.username}</a>{v.banned && ' 🚫'}{v.voided && ' (struck)'}</td>
                  <td className="small">{dt(v.joined)}</td>
                  <td className="small">{dt(v.votedAt)}</td>
                  <td>{v.shifts}</td>
                  <td className="small">{v.ip || v.signupIp || '—'}</td>
                  <td className="small">{v.flags.map((f) => <span key={f} className="bdg r" style={{ marginRight: 4 }}>{f}</span>)}</td>
                  <td>
                    <button className="btn btn-xs btn-outline" onClick={async () => { if (await act('/elections/void', { body: { period, voterIds: [v.id], restore: v.voided } })) reload(); }}>{v.voided ? 'Restore' : 'Strike'}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function Elections() {
  const [period, setPeriod] = useState('');
  const { data, reload } = useApi(`/admin/elections${period ? `?period=${period}` : ''}`);
  const p = data?.period;
  return (
    <>
      <div className="adm-head">
        <div><h1>Elections</h1><div className="sub">Votes per candidate with fraud signals. Struck or banned votes stop counting; a decided week keeps its mayor unless you unseat them.</div></div>
      </div>
      <div className="panel" style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn btn-xs btn-outline" disabled={!p} onClick={() => setPeriod(String(p - 1))}>← Previous week</button>
        <b>Week #{p}{p === data?.current ? ' (now)' : ''}</b>
        <button className="btn btn-xs btn-outline" disabled={!p || p >= data?.current} onClick={() => setPeriod(String(p + 1))}>Next week →</button>
        <span style={{ flex: 1 }} />
        {data?.mayors.filter((m) => m.username).map((m) => (
          <span key={m.city} className="small">
            👑 {CITY[m.city]}: @{m.username} ({m.votes}){' '}
            <button className="btn btn-xs btn-red" onClick={async () => { if (await act('/elections/unseat', { body: { period: p, city: m.city }, confirm: `Unseat @${m.username} as mayor of ${CITY[m.city]}?` })) reload(); }}>Unseat</button>
          </span>
        ))}
      </div>
      {data?.top?.length > 0 && (
        <div className="panel small" style={{ marginBottom: 12 }}>
          <b>Biggest wins ever:</b>{' '}
          {data.top.slice(0, 8).map((t) => (
            <button key={`${t.period}-${t.city}`} className="btn btn-xs btn-outline" style={{ margin: 2 }} onClick={() => setPeriod(String(t.period))}>#{t.period} {CITY[t.city]} @{t.username || '—'} · {t.votes}</button>
          ))}
        </div>
      )}
      {data?.candidates.map((c) => <Candidate key={c.id} c={c} period={p} reload={reload} />)}
      {data && !data.candidates.length && <div className="panel empty">No votes this week.</div>}
    </>
  );
}
