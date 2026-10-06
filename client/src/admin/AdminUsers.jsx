import { useEffect, useState } from 'react';
import { NEEDS, SPAWNS, TRAITS, fmtTsh, vehicleById, plotById, placeById, buildingById, findJob, jobTitleEn } from '@shared/world.js';
import { avatarEmoji } from '../three/Avatar.jsx';
import { useApi, act, ago, dt, tzs, go, Kpi, Pager, Modal, StatusBadge } from './Admin.jsx';

const FILTERS = [['', 'All'], ['online', 'Online'], ['paying', 'Paying'], ['muted', 'Muted'], ['banned', 'Banned'], ['admins', 'Admins']];
const SORTS = [['new', 'Newest'], ['seen', 'Last seen'], ['money', 'Richest'], ['fame', 'Most famous'], ['old', 'Oldest']];

export function Users() {
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState('new');
  const [page, setPage] = useState(1);
  useEffect(() => {
    const t = setTimeout(() => { setQuery(q); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [q]);
  const { data } = useApi(`/admin/users?q=${encodeURIComponent(query)}&filter=${filter}&sort=${sort}&page=${page}`);
  return (
    <>
      <div className="adm-head"><div><h1>Users</h1><div className="sub">Search by username, name, email or phone.</div></div></div>
      <div className="toolbar">
        <input className="in" style={{ flex: '1 1 220px' }} placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="in" value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}>
          {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <div className="toolbar">
        {FILTERS.map(([v, l]) => (
          <button key={v} className={`chip ${filter === v ? 'on' : ''}`} style={{ padding: '7px 12px', fontSize: 13 }} onClick={() => { setFilter(v); setPage(1); }}>{l}</button>
        ))}
      </div>
      <div className="panel tbl-wrap">
        <table className="tbl">
          <thead><tr><th>Player</th><th>Contact</th><th className="num">Balance</th><th className="num">Paid</th><th className="num">Fame</th><th>Joined</th><th>Last seen</th><th>Status</th></tr></thead>
          <tbody>
            {data?.rows.map((u) => (
              <tr key={u.id} className="click" onClick={() => go(`users/${u.id}`)}>
                <td><span style={{ marginRight: 6 }}>{avatarEmoji(u.appearance)}</span><b>@{u.username}</b><div className="small muted">{u.name}</div></td>
                <td className="small">{u.email || '—'}<div className="muted">{u.phone ? `+${u.phone}` : ''}</div></td>
                <td className="num">{fmtTsh(u.money)}</td>
                <td className="num">{u.paid_tzs ? tzs(u.paid_tzs) : '—'}</td>
                <td className="num">{u.fame}</td>
                <td className="small">{ago(u.created_at)}</td>
                <td className="small">{u.online ? <span className="bdg g">online</span> : ago(u.last_seen)}</td>
                <td>
                  <div className="actions" style={{ gap: 4 }}>
                    {u.is_admin ? <span className="bdg k">admin</span> : null}
                    {u.banned_at ? <span className="bdg r">banned</span> : null}
                    {u.muted_until > Date.now() ? <span className="bdg y">muted</span> : null}
                    {!u.onboarded ? <span className="bdg">no avatar</span> : null}
                  </div>
                </td>
              </tr>
            ))}
            {data?.rows.length === 0 && <tr><td colSpan={8} className="empty">No players match</td></tr>}
          </tbody>
        </table>
        <Pager data={data} page={page} setPage={setPage} />
      </div>
    </>
  );
}

const TABS = ['Overview', 'Transactions', 'Top-ups', 'Ads', 'Chat', 'History'];

export function UserDetail({ id, me }) {
  const { data, reload, error } = useApi(`/admin/users/${id}`);
  const [tab, setTab] = useState('Overview');
  const [modal, setModal] = useState(null);
  if (error) return <div className="empty">{error}</div>;
  if (!data) return <div className="empty">Loading…</div>;
  const u = data.user;
  const self = u.id === me.id;
  const muted = u.mutedUntil > Date.now();
  const run = async (path, opts) => {
    const r = await act(`/users/${u.id}${path}`, opts);
    if (r) reload();
    return r;
  };
  const trait = TRAITS.find((t) => t.id === u.trait);

  const modals = {
    balance: {
      title: `Adjust balance · @${u.username}`,
      fields: [
        { name: 'delta', label: 'Amount in TSh (negative to deduct)', type: 'number', placeholder: 'e.g. 50000 or -20000' },
        { name: 'memo', label: 'Reason (shown to the player)', placeholder: 'e.g. Compensation for failed top-up' },
      ],
      submit: (v) => run('/balance', { body: { delta: Number(v.delta), memo: v.memo } }).then(Boolean),
    },
    ban: {
      title: `Ban @${u.username}`,
      danger: true,
      fields: [{ name: 'reason', label: 'Reason (shown when they try to log in)', placeholder: 'e.g. Scamming other players' }],
      submit: (v) => run('/ban', { body: v, ok: '⛔ Player banned' }).then(Boolean),
    },
    mute: {
      title: `Mute @${u.username}`,
      initial: { minutes: '60' },
      fields: [{ name: 'minutes', label: 'Duration', type: 'select', options: [['15', '15 minutes'], ['60', '1 hour'], ['1440', '24 hours'], ['10080', '7 days'], ['525600', '1 year']] }],
      submit: (v) => run('/mute', { body: { minutes: Number(v.minutes) }, ok: '🔇 Player muted' }).then(Boolean),
    },
    password: {
      title: `Reset password · @${u.username}`,
      danger: true,
      fields: [{ name: 'password', label: 'New password (min 6 characters) — share it with the player privately', type: 'text' }],
      submit: (v) => run('/password', { body: v, ok: '🔑 Password reset, player signed out' }).then(Boolean),
    },
    teleport: {
      title: `Teleport @${u.username}`,
      initial: { spawn: 'manzese' },
      fields: [{ name: 'spawn', label: 'Destination', type: 'select', options: Object.entries(SPAWNS).map(([k, s]) => [k, s.name]) }],
      submit: (v) => run('/teleport', { body: v }).then(Boolean),
    },
    profile: {
      title: `Edit profile · @${u.username}`,
      initial: { name: u.name, email: u.email || '' },
      fields: [{ name: 'name', label: 'Display name' }, { name: 'email', label: 'Email', type: 'email' }],
      submit: (v) => run('/profile', { body: v }).then(Boolean),
    },
  };

  return (
    <>
      <a href="#/users" className="small">← All users</a>
      <div className="adm-head" style={{ marginTop: 10 }}>
        <div className="row" style={{ alignItems: 'center' }}>
          <span className="avatar-dot" style={{ width: 54, height: 54, fontSize: 28 }}>{avatarEmoji(u.appearance)}</span>
          <div>
            <h1>{u.name} <span className="muted" style={{ fontWeight: 600 }}>@{u.username}</span></h1>
            <div className="actions" style={{ gap: 6 }}>
              {u.online ? <span className="bdg g">online</span> : <span className="bdg">last seen {ago(u.lastSeen)}</span>}
              {u.isAdmin && <span className="bdg k">admin</span>}
              {u.bannedAt && <span className="bdg r">banned {ago(u.bannedAt)}{u.banReason ? ` · ${u.banReason}` : ''}</span>}
              {muted && <span className="bdg y">muted until {dt(u.mutedUntil)}</span>}
              <span className="bdg">#{u.id}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 14 }}>
        <div className="actions">
          <button className="btn btn-green" onClick={() => setModal('balance')}>💰 Adjust balance</button>
          {muted ? (
            <button className="btn btn-outline" onClick={() => run('/mute', { body: { minutes: 0 }, ok: '🔊 Unmuted' })}>🔊 Unmute</button>
          ) : (
            <button className="btn btn-outline" onClick={() => setModal('mute')}>🔇 Mute</button>
          )}
          {!self && (u.bannedAt ? (
            <button className="btn btn-outline" onClick={() => run('/unban', { ok: '✅ Unbanned' })}>✅ Unban</button>
          ) : (
            <button className="btn btn-red" onClick={() => setModal('ban')}>⛔ Ban</button>
          ))}
          <button className="btn btn-outline" onClick={() => run('/logout', { confirm: 'Sign this player out of every device?', ok: '🚪 Signed out' })}>🚪 Force logout</button>
          <button className="btn btn-outline" onClick={() => setModal('password')}>🔑 Reset password</button>
          <button className="btn btn-outline" onClick={() => run('/needs', { ok: '💯 Needs restored' })}>💯 Restore needs</button>
          <button className="btn btn-outline" onClick={() => setModal('teleport')}>📍 Teleport</button>
          <button className="btn btn-outline" onClick={() => setModal('profile')}>✏️ Edit profile</button>
          <button className="btn btn-outline" onClick={() => run('/purge-messages', { confirm: "Delete all of this player's public chat messages?", ok: '🧹 Messages removed' })}>🧹 Purge chat</button>
          {!self && (
            <button className="btn btn-dark" onClick={() => run('/role', { body: { isAdmin: !u.isAdmin }, confirm: u.isAdmin ? 'Revoke admin access?' : 'Give this player full admin access?' })}>
              {u.isAdmin ? 'Revoke admin' : '🛡️ Make admin'}
            </button>
          )}
        </div>
      </div>

      <div className="adm-grid">
        <Kpi k="Wallet" v={fmtTsh(u.money)} />
        <Kpi k="Net worth" v={fmtTsh(data.netWorth)} />
        <Kpi k="Real money paid" v={tzs(data.topups.filter((t) => t.status === 'paid').reduce((a, t) => a + t.amount_tzs, 0))} tone="#16a34a" />
        <Kpi k="Income waiting" v={fmtTsh(data.pendingIncome)} />
        <Kpi k="Fame · Education" v={`⭐ ${u.fame} · 🎓 ${u.elimu}`} />
        <Kpi k="DMs sent" v={data.dmStats.sent} d={`${data.dmStats.contacts} contacts (content private)`} />
      </div>

      <div className="tabs-s">
        {TABS.map((t) => <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>)}
      </div>

      {tab === 'Overview' && (
        <div className="adm-cols">
          <div className="panel">
            <h2>Profile</h2>
            <div className="kv">
              <span>Email</span><span>{u.email || '—'}</span>
              <span>Phone</span><span>{u.phone ? `+${u.phone}` : '—'}</span>
              <span>Joined</span><span>{dt(u.createdAt)}</span>
              <span>Trait</span><span>{trait ? `${trait.emoji} ${trait.nameEn}` : '—'}</span>
              <span>Position</span><span>{u.position.map((n) => n.toFixed(1)).join(', ')}</span>
              <span>Busy</span><span>{u.busy ? `${u.busy.emoji} ${u.busy.labelEn || u.busy.label} (ends ${ago(u.busy.endsAt)})` : '—'}</span>
              <span>Onboarded</span><span>{u.onboarded ? 'yes' : 'no'}</span>
            </div>
            <h2 style={{ marginTop: 18 }}>Needs</h2>
            {NEEDS.map((n) => (
              <div key={n.id} className="hbar">
                <span style={{ width: 90 }}>{n.icon} {n.nameEn}</span>
                <div className="track"><i style={{ width: `${u.needs[n.id] ?? 0}%`, background: n.color }} /></div>
                <span style={{ width: 34, textAlign: 'right' }}>{Math.round(u.needs[n.id] ?? 0)}</span>
              </div>
            ))}
          </div>
          <div className="panel">
            <h2>Jobs</h2>
            {Object.entries(u.jobXp).length === 0 && <div className="small muted">No shifts worked yet.</div>}
            {Object.entries(u.jobXp).map(([jid, n]) => {
              const f = findJob(jid);
              return <div key={jid} className="row between small" style={{ padding: '4px 0' }}><span>{f ? `${jobTitleEn(f.job, n)} · ${f.place.nameEn}` : jid}</span><b>{n} shifts</b></div>;
            })}
            <h2 style={{ marginTop: 18 }}>Vehicles</h2>
            {data.vehicles.length === 0 && <div className="small muted">None</div>}
            {data.vehicles.map((v) => (
              <div key={v.id} className="row between small" style={{ padding: '4px 0' }}>
                <span>{vehicleById[v.model]?.emoji} {vehicleById[v.model]?.nameEn} · {v.plate}{u.activeVehicle === v.id ? ' · driving' : ''}</span>
                <span className="actions" style={{ gap: 4 }}>
                  <button className="btn btn-outline btn-xs" onClick={() => run(`/vehicles/${v.id}/remove`, { body: { refund: true }, confirm: 'Remove this vehicle and refund its price?' })}>Remove + refund</button>
                  <button className="btn btn-outline btn-xs" onClick={() => run(`/vehicles/${v.id}/remove`, { body: { refund: false }, confirm: 'Remove this vehicle WITHOUT refund?' })}>Remove</button>
                </span>
              </div>
            ))}
            <h2 style={{ marginTop: 18 }}>Property</h2>
            {data.plots.length + data.businesses.length === 0 && <div className="small muted">None</div>}
            {data.plots.map((p) => (
              <div key={p.id} className="small" style={{ padding: '3px 0' }}>🏞️ {plotById[p.id]?.nameEn}{p.building ? ` · ${buildingById[p.building]?.nameEn}` : ' · empty'} <span className="muted">({ago(p.bought_at)})</span></div>
            ))}
            {data.businesses.map((b) => (
              <div key={b.id} className="small" style={{ padding: '3px 0' }}>{placeById[b.id]?.icon} {placeById[b.id]?.nameEn} <span className="muted">({ago(b.bought_at)})</span></div>
            ))}
            <h2 style={{ marginTop: 18 }}>Money flow by type</h2>
            {data.totals.map((t) => (
              <div key={t.kind} className="row between small" style={{ padding: '3px 0' }}><span>{t.kind} <span className="muted">×{t.n}</span></span><b className={t.total >= 0 ? 'green' : 'red'}>{t.total.toLocaleString()}</b></div>
            ))}
          </div>
        </div>
      )}

      {tab === 'Transactions' && (
        <div className="panel tbl-wrap">
          <table className="tbl">
            <thead><tr><th>When</th><th>Type</th><th>Memo</th><th className="num">Amount</th><th className="num">Balance</th></tr></thead>
            <tbody>
              {data.transactions.map((t) => (
                <tr key={t.id}><td className="small">{dt(t.created_at)}</td><td><span className="bdg">{t.kind}</span></td><td className="small">{t.memo}</td>
                  <td className={`num ${t.amount >= 0 ? 'green' : ''}`}>{t.amount >= 0 ? '+' : ''}{t.amount.toLocaleString()}</td><td className="num">{t.balance_after.toLocaleString()}</td></tr>
              ))}
            </tbody>
          </table>
          <div className="small muted" style={{ marginTop: 8 }}>Latest 100 · full history in <a href={`#/economy`}>Economy → Transactions</a></div>
        </div>
      )}

      {tab === 'Top-ups' && (
        <div className="panel tbl-wrap">
          <table className="tbl">
            <thead><tr><th>#</th><th>When</th><th>Method</th><th>Phone</th><th className="num">TZS</th><th className="num">Credited TSh</th><th>Status</th><th>Ref</th></tr></thead>
            <tbody>
              {data.topups.map((t) => (
                <tr key={t.id}><td>{t.id}</td><td className="small">{dt(t.created_at)}</td><td>{t.provider} · {t.method}</td><td>{t.phone ? `+${t.phone}` : ''}</td>
                  <td className="num">{t.amount_tzs.toLocaleString()}</td><td className="num">{t.coins.toLocaleString()}</td><td><StatusBadge s={t.status} /></td><td className="small muted">{t.provider_ref}</td></tr>
              ))}
              {!data.topups.length && <tr><td colSpan={8} className="empty">No top-ups</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'Ads' && (
        <div className="panel tbl-wrap">
          <table className="tbl">
            <thead><tr><th>Title</th><th>Billboard</th><th>Runs</th><th className="num">Reports</th><th>Status</th></tr></thead>
            <tbody>
              {data.ads.map((a) => (
                <tr key={a.id}><td><b>{a.title}</b><div className="small muted">{a.body}</div></td><td>{a.slot_id}</td><td className="small">{dt(a.starts_at)} → {dt(a.ends_at)}</td><td className="num">{a.reports}</td><td><StatusBadge s={a.status} /></td></tr>
              ))}
              {!data.ads.length && <tr><td colSpan={5} className="empty">No ads</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'Chat' && (
        <div className="panel tbl-wrap">
          <table className="tbl">
            <tbody>
              {data.messages.map((m) => (
                <tr key={m.id}>
                  <td className="small" style={{ width: 150 }}>{dt(m.created_at)}</td>
                  <td style={{ textDecoration: m.deleted_at ? 'line-through' : 'none', color: m.deleted_at ? 'var(--mute)' : undefined }}>{m.body}</td>
                  <td className="num">{!m.deleted_at && <button className="btn btn-outline btn-xs" onClick={async () => { if (await act(`/messages/${m.id}`, { method: 'DELETE', ok: '🗑️ Deleted' })) reload(); }}>Delete</button>}</td>
                </tr>
              ))}
              {!data.messages.length && <tr><td className="empty">No public messages</td></tr>}
            </tbody>
          </table>
          <div className="small muted" style={{ marginTop: 8 }}>Public street chat only. Private DMs are not visible to admins.</div>
        </div>
      )}

      {tab === 'History' && (
        <div className="panel tbl-wrap">
          <table className="tbl">
            <thead><tr><th>When</th><th>Admin</th><th>Action</th><th>Details</th></tr></thead>
            <tbody>
              {data.audit.map((a) => (
                <tr key={a.id}><td className="small">{dt(a.created_at)}</td><td>@{a.admin}</td><td><span className="bdg b">{a.action}</span></td><td className="small">{a.details ? JSON.stringify(a.details) : ''}</td></tr>
              ))}
              {!data.audit.length && <tr><td colSpan={4} className="empty">No admin actions on this player</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {modal && <Modal {...modals[modal]} onClose={() => setModal(null)} />}
    </>
  );
}
