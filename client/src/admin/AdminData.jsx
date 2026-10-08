import { Fragment, useEffect, useState } from 'react';
import { fmtTsh, fmtShort, billboardById, buildingById } from '@shared/world.js';
import { useApi, act, ago, dt, tzs, go, Kpi, Pager, Modal, StatusBadge } from './Admin.jsx';

const KINDS = ['', 'topup', 'salary', 'spend', 'purchase', 'income', 'gift', 'transfer_in', 'transfer_out', 'travel', 'ads', 'admin', 'refund'];

function Hbars({ rows, label, value, format = (v) => v.toLocaleString() }) {
  const max = Math.max(1, ...rows.map((r) => Math.abs(value(r))));
  return rows.map((r, i) => (
    <div key={i} className="hbar">
      <span style={{ width: 110, flex: 'none' }}>{label(r)}</span>
      <div className="track"><i style={{ width: `${(Math.abs(value(r)) / max) * 100}%`, background: value(r) < 0 ? '#ef4444' : undefined }} /></div>
      <span style={{ width: 120, textAlign: 'right', flex: 'none' }}>{format(value(r))}</span>
    </div>
  ));
}

// ------------------------------------------------------------- economy
export function Economy() {
  const { data } = useApi('/admin/economy');
  const [range, setRange] = useState('week');
  const [f, setF] = useState({ kind: '', user: '', min: '' });
  const [qs, setQs] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => {
    const t = setTimeout(() => { setQs(`kind=${f.kind}&user=${encodeURIComponent(f.user)}&min=${f.min}`); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [f]);
  const tx = useApi(`/admin/transactions?${qs}&page=${page}`);
  if (!data) return <div className="empty">Loading…</div>;
  const kinds = data.kinds[range];
  const faucets = kinds.filter((k) => k.total > 0).reduce((a, k) => a + k.total, 0);
  const sinks = kinds.filter((k) => k.total < 0).reduce((a, k) => a + k.total, 0);
  return (
    <>
      <div className="adm-head"><div><h1>Economy</h1><div className="sub">Where in-game money comes from (faucets) and where it goes (sinks).</div></div></div>
      <div className="adm-grid">
        <Kpi k="Money supply" v={`TSh ${fmtShort(data.moneySupply)}`} />
        <Kpi k={`Faucets (${range})`} v={`TSh ${fmtShort(faucets)}`} tone="#16a34a" />
        <Kpi k={`Sinks (${range})`} v={`TSh ${fmtShort(-sinks)}`} tone="#dc2626" />
        <Kpi k={`Net (${range})`} v={`TSh ${fmtShort(faucets + sinks)}`} d={faucets + sinks > 0 ? 'inflationary' : 'deflationary'} />
      </div>
      <div className="adm-cols">
        <div className="panel">
          <div className="row between" style={{ marginBottom: 10 }}>
            <h2 style={{ margin: 0 }}>Flow by type</h2>
            <div className="seg" style={{ marginBottom: 0, width: 220 }}>
              {['day', 'week', 'all'].map((r) => <button key={r} className={range === r ? 'on' : ''} onClick={() => setRange(r)}>{r}</button>)}
            </div>
          </div>
          <Hbars rows={kinds} label={(r) => `${r.kind} ×${r.n}`} value={(r) => r.total} format={(v) => `${v > 0 ? '+' : ''}${fmtShort(v)}`} />
          {!kinds.length && <div className="small muted">No transactions in this period.</div>}
        </div>
        <div className="panel">
          <h2>Wealth distribution</h2>
          <Hbars rows={['< 100K', '100K–1M', '1M–10M', '10M–100M', '100M+'].map((b) => ({ b, n: data.distribution.find((d) => d.bucket === b)?.n || 0 }))} label={(r) => r.b} value={(r) => r.n} format={(v) => `${v} players`} />
          <h2 style={{ marginTop: 18 }}>Top spenders (real money)</h2>
          {data.topSpenders.map((s, i) => <div key={s.username} className="row between small" style={{ padding: '3px 0' }}><span>{i + 1}. @{s.username} <span className="muted">×{s.n}</span></span><b>{tzs(s.tzs)}</b></div>)}
          {!data.topSpenders.length && <div className="small muted">No paid top-ups yet.</div>}
        </div>
        <div className="panel">
          <h2>Richest players</h2>
          {data.richest.map((r, i) => (
            <div key={r.id} className="row between small" style={{ padding: '3px 0', cursor: 'pointer' }} onClick={() => go(`users/${r.id}`)}>
              <span>{i === 0 ? '👑' : `${i + 1}.`} @{r.username}</span><b>TSh {fmtShort(r.worth)}</b>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <h2>Transactions</h2>
        <div className="toolbar">
          <select className="in" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
            {KINDS.map((k) => <option key={k} value={k}>{k || 'All types'}</option>)}
          </select>
          <input className="in" placeholder="@username" value={f.user} onChange={(e) => setF({ ...f, user: e.target.value })} />
          <input className="in" placeholder="Min |amount|" inputMode="numeric" value={f.min} onChange={(e) => setF({ ...f, min: e.target.value.replace(/\D/g, '') })} />
        </div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>When</th><th>Player</th><th>Type</th><th>Memo</th><th className="num">Amount</th><th className="num">Balance</th></tr></thead>
            <tbody>
              {tx.data?.rows.map((t) => (
                <tr key={t.id}>
                  <td className="small">{dt(t.created_at)}</td>
                  <td><a href={`#/users/${t.user_id}`}>@{t.username}</a></td>
                  <td><span className="bdg">{t.kind}</span></td>
                  <td className="small">{t.memo}</td>
                  <td className={`num ${t.amount >= 0 ? 'green' : ''}`}>{t.amount >= 0 ? '+' : ''}{t.amount.toLocaleString()}</td>
                  <td className="num">{t.balance_after.toLocaleString()}</td>
                </tr>
              ))}
              {tx.data?.rows.length === 0 && <tr><td colSpan={6} className="empty">No transactions match</td></tr>}
            </tbody>
          </table>
        </div>
        <Pager data={tx.data} page={page} setPage={setPage} />
      </div>
    </>
  );
}

// -------------------------------------------------------------- top-ups
export function Topups() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null);
  const { data, reload } = useApi(`/admin/topups?status=${status}&page=${page}`);
  const sum = (s) => data?.sums.find((x) => x.status === s) || { n: 0, tzs: 0 };
  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Top-ups</h1>
          <div className="sub">
            Provider: {data?.provider ? <span className={`bdg ${data.livemode ? 'g' : 'y'}`}>{data.provider} · {data.livemode ? 'LIVE' : 'test/demo'}</span> : <span className="bdg r">disabled</span>} · pending top-ups are re-checked automatically every 15s.
          </div>
        </div>
        <button className="btn btn-outline" onClick={reload}>↻ Refresh</button>
      </div>
      <div className="adm-grid">
        <Kpi k="Paid" v={tzs(sum('paid').tzs)} d={`${sum('paid').n} payments`} tone="#16a34a" />
        <Kpi k="Pending" v={tzs(sum('pending').tzs)} d={`${sum('pending').n} waiting`} tone="#d97706" />
        <Kpi k="Failed / expired" v={sum('failed').n + sum('expired').n} />
      </div>
      <div className="toolbar">
        {['', 'pending', 'paid', 'failed', 'expired'].map((s) => (
          <button key={s} className={`chip ${status === s ? 'on' : ''}`} style={{ padding: '7px 12px', fontSize: 13 }} onClick={() => { setStatus(s); setPage(1); }}>{s || 'All'}</button>
        ))}
      </div>
      <div className="panel tbl-wrap">
        <table className="tbl">
          <thead><tr><th>#</th><th>When</th><th>Player</th><th>Method</th><th>Phone</th><th className="num">TZS</th><th className="num">TSh credited</th><th>Status</th><th>Provider ref</th><th></th></tr></thead>
          <tbody>
            {data?.rows.map((t) => (
              <tr key={t.id}>
                <td>{t.id}</td>
                <td className="small">{dt(t.created_at)}</td>
                <td><a href={`#/users/${t.user_id}`}>@{t.username}</a></td>
                <td className="small">{t.provider} · {t.method}</td>
                <td className="small">{t.phone ? `+${t.phone}` : ''}</td>
                <td className="num">{t.amount_tzs.toLocaleString()}</td>
                <td className="num">{t.coins.toLocaleString()}</td>
                <td><StatusBadge s={t.status} />{t.credited_at ? <div className="small muted">{ago(t.credited_at)}</div> : null}</td>
                <td className="small muted" style={{ maxWidth: 160, wordBreak: 'break-all' }}>{t.provider_ref}</td>
                <td>
                  {(t.status === 'pending' || t.status === 'expired') && (
                    <div className="actions" style={{ gap: 4 }}>
                      <button className="btn btn-outline btn-xs" onClick={async () => { const r = await act(`/topups/${t.id}/recheck`, { ok: '🔄 Re-checked' }); if (r) reload(); }}>Re-check</button>
                      <button className="btn btn-outline btn-xs" onClick={() => setModal({ t, status: 'paid' })}>Mark paid</button>
                      {t.status === 'pending' && <button className="btn btn-outline btn-xs" onClick={() => setModal({ t, status: 'failed' })}>Mark failed</button>}
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {data?.rows.length === 0 && <tr><td colSpan={10} className="empty">No top-ups</td></tr>}
          </tbody>
        </table>
        <Pager data={data} page={page} setPage={setPage} />
      </div>
      {modal && (
        <Modal
          title={`Mark top-up #${modal.t.id} as ${modal.status}`}
          danger={modal.status === 'failed'}
          fields={[{ name: 'note', label: modal.status === 'paid' ? 'Mobile money receipt / reason (required)' : 'Reason (required)' }]}
          submit={async (v) => {
            const r = await act(`/topups/${modal.t.id}/mark`, { body: { status: modal.status, note: v.note } });
            if (r) reload();
            return !!r;
          }}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}

// ------------------------------------------------------------------ ads
export function Ads() {
  const [filter, setFilter] = useState('reported');
  const [page, setPage] = useState(1);
  const { data, reload } = useApi(`/admin/ads?filter=${filter}&page=${page}`);
  const now = Date.now();
  return (
    <>
      <div className="adm-head"><div><h1>Ads</h1><div className="sub">Billboard moderation. Ads auto-hide after 5 player reports.</div></div></div>
      <div className="toolbar">
        {[['reported', 'Reported'], ['live', 'Live'], ['removed', 'Removed / hidden'], ['', 'All']].map(([v, l]) => (
          <button key={v} className={`chip ${filter === v ? 'on' : ''}`} style={{ padding: '7px 12px', fontSize: 13 }} onClick={() => { setFilter(v); setPage(1); }}>{l}</button>
        ))}
      </div>
      <div style={{ display: 'grid', gap: 10 }}>
        {data?.rows.map((a) => (
          <div key={a.id} className="panel ad-card">
            <div className="thumb" style={{ background: a.image ? `url(/uploads/${a.image}) center/cover` : a.bg }}>{a.title}</div>
            <div className="grow">
              <div className="row between" style={{ alignItems: 'flex-start' }}>
                <div>
                  <b>{a.title}</b> <span className="muted small">by <a href={`#/users/${a.user_id}`}>@{a.username}</a></span>
                  <div className="small">{a.body}</div>
                  {a.link && <div className="small"><a href={a.link} target="_blank" rel="noopener noreferrer nofollow">{a.link}</a></div>}
                  <div className="small muted" style={{ marginTop: 4 }}>{billboardById[a.slot_id]?.nameEn || a.slot_id} · {dt(a.starts_at)} → {dt(a.ends_at)}</div>
                </div>
                <div className="actions" style={{ gap: 4 }}>
                  <StatusBadge s={a.status === 'live' && a.ends_at < now ? 'expired' : a.status} />
                  {a.reports > 0 && <span className="bdg r">🚩 {a.reports}</span>}
                </div>
              </div>
              <div className="actions" style={{ marginTop: 10 }}>
                {a.status === 'live' ? (
                  <>
                    <button className="btn btn-red btn-xs" onClick={async () => { if (await act(`/ads/${a.id}/remove`, { body: { refund: false }, confirm: 'Remove this ad without refund?', ok: '🗑️ Ad removed' })) reload(); }}>Remove</button>
                    <button className="btn btn-outline btn-xs" onClick={async () => { if (await act(`/ads/${a.id}/remove`, { body: { refund: true }, confirm: 'Remove this ad and refund the advertiser?', ok: '🗑️ Removed & refunded' })) reload(); }}>Remove + refund</button>
                  </>
                ) : (
                  <button className="btn btn-outline btn-xs" onClick={async () => { if (await act(`/ads/${a.id}/restore`, { ok: '♻️ Restored' })) reload(); }}>Restore</button>
                )}
              </div>
            </div>
          </div>
        ))}
        {data?.rows.length === 0 && <div className="panel empty">Nothing here 🎉</div>}
      </div>
      <Pager data={data} page={page} setPage={setPage} />
    </>
  );
}

// ----------------------------------------------------------------- chat
export function Chat() {
  const [f, setF] = useState({ q: '', user: '', deleted: false });
  const [qs, setQs] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => {
    const t = setTimeout(() => { setQs(`q=${encodeURIComponent(f.q)}&user=${encodeURIComponent(f.user)}&deleted=${f.deleted ? 1 : 0}`); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [f]);
  const { data, reload } = useApi(`/admin/messages?${qs}&page=${page}`);
  useEffect(() => {
    const t = setInterval(reload, 10_000);
    return () => clearInterval(t);
  }, [reload]);
  return (
    <>
      <div className="adm-head"><div><h1>Chat</h1><div className="sub">Public street chat (live, refreshes every 10s). Private DMs are never shown here.</div></div></div>
      <div className="toolbar">
        <input className="in" style={{ flex: '1 1 200px' }} placeholder="Search text…" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
        <input className="in" placeholder="@username" value={f.user} onChange={(e) => setF({ ...f, user: e.target.value })} />
        <label className="small row" style={{ gap: 6 }}><input type="checkbox" checked={f.deleted} onChange={(e) => setF({ ...f, deleted: e.target.checked })} /> show deleted</label>
      </div>
      <div className="panel tbl-wrap">
        <table className="tbl">
          <thead><tr><th>When</th><th>Player</th><th>Message</th><th></th></tr></thead>
          <tbody>
            {data?.rows.map((m) => (
              <tr key={m.id}>
                <td className="small" style={{ whiteSpace: 'nowrap' }}>{ago(m.created_at)}</td>
                <td><a href={`#/users/${m.user_id}`}>@{m.username}</a>{m.muted_until > Date.now() && <span className="bdg y" style={{ marginLeft: 6 }}>muted</span>}</td>
                <td style={{ textDecoration: m.deleted_at ? 'line-through' : 'none', color: m.deleted_at ? 'var(--mute)' : undefined }}>{m.body}</td>
                <td className="num">
                  {!m.deleted_at && (
                    <div className="actions" style={{ gap: 4, justifyContent: 'flex-end' }}>
                      <button className="btn btn-outline btn-xs" onClick={async () => { if (await act(`/messages/${m.id}`, { method: 'DELETE', ok: '🗑️ Deleted' })) reload(); }}>Delete</button>
                      <button className="btn btn-outline btn-xs" onClick={async () => { if (await act(`/users/${m.user_id}/mute`, { body: { minutes: 60 }, ok: '🔇 Muted for 1h' })) reload(); }}>Mute 1h</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {data?.rows.length === 0 && <tr><td colSpan={4} className="empty">No messages</td></tr>}
          </tbody>
        </table>
        <Pager data={data} page={page} setPage={setPage} />
      </div>
    </>
  );
}

// ------------------------------------------------------------- property
export function Property() {
  const { data, reload } = useApi('/admin/property');
  const [area, setArea] = useState('');
  if (!data) return <div className="empty">Loading…</div>;
  const areas = [...new Set(data.plots.map((p) => p.area))];
  const plots = data.plots.filter((p) => !area || p.area === area);
  const revoke = async (kind, id, refund) => {
    const r = await act(`/${kind}/${id}/revoke`, { body: { refund }, confirm: refund ? 'Return to market and REFUND the owner?' : 'Return to market WITHOUT refund?', ok: '🏷️ Returned to market' });
    if (r) reload();
  };
  return (
    <>
      <div className="adm-head"><div><h1>Property</h1><div className="sub">Plots and businesses. Revoking returns them to the market.</div></div></div>
      <div className="adm-grid">
        <Kpi k="Plots sold" v={`${data.plots.filter((p) => p.owner).length} / ${data.plots.length}`} />
        <Kpi k="Homes built" v={data.plots.filter((p) => p.building).length} />
        <Kpi k="Businesses owned" v={`${data.businesses.filter((b) => b.owner).length} / ${data.businesses.length}`} />
      </div>
      <div className="panel tbl-wrap" style={{ marginBottom: 14 }}>
        <h2>Businesses</h2>
        <table className="tbl">
          <thead><tr><th>Business</th><th className="num">Price</th><th className="num">Income / hr</th><th>Owner</th><th></th></tr></thead>
          <tbody>
            {data.businesses.map((b) => (
              <tr key={b.id}>
                <td><b>{b.name}</b></td><td className="num">{fmtTsh(b.price)}</td><td className="num">{fmtTsh(b.incomePerHour)}</td>
                <td>{b.owner ? <>@{b.owner} <span className="small muted">{ago(b.boughtAt)}</span></> : <span className="muted">for sale</span>}</td>
                <td className="num">{b.owner && (
                  <div className="actions" style={{ gap: 4, justifyContent: 'flex-end' }}>
                    <button className="btn btn-outline btn-xs" onClick={() => revoke('business', b.id, true)}>Revoke + refund</button>
                    <button className="btn btn-outline btn-xs" onClick={() => revoke('business', b.id, false)}>Revoke</button>
                  </div>
                )}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="panel tbl-wrap">
        <div className="row between"><h2 style={{ margin: 0 }}>Plots</h2>
          <select className="in" value={area} onChange={(e) => setArea(e.target.value)}>
            <option value="">All areas</option>
            {areas.map((a) => <option key={a}>{a}</option>)}
          </select>
        </div>
        <table className="tbl" style={{ marginTop: 10 }}>
          <thead><tr><th>Plot</th><th>Area</th><th className="num">Price</th><th>Owner</th><th>Building</th><th></th></tr></thead>
          <tbody>
            {plots.map((p) => (
              <tr key={p.id}>
                <td>{p.id}</td><td>{p.area}</td><td className="num">{fmtTsh(p.price)}</td>
                <td>{p.owner ? <>@{p.owner} <span className="small muted">{ago(p.boughtAt)}</span></> : <span className="muted">for sale</span>}</td>
                <td>{p.building ? buildingById[p.building]?.nameEn : '—'}</td>
                <td className="num">{p.owner && (
                  <div className="actions" style={{ gap: 4, justifyContent: 'flex-end' }}>
                    <button className="btn btn-outline btn-xs" onClick={() => revoke('plots', p.id, true)}>Revoke + refund</button>
                    <button className="btn btn-outline btn-xs" onClick={() => revoke('plots', p.id, false)}>Revoke</button>
                  </div>
                )}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ------------------------------------------------------------ phone apps
const EMPTY_APP = { name: '', url: 'https://', icon_url: '', emoji: '', color: '#111827', badge: 'NEW', sort: 0, active: true };
export function PhoneApps() {
  const { data, reload } = useApi('/admin/phone-apps');
  const [form, setForm] = useState(EMPTY_APP);
  const [editing, setEditing] = useState(null);
  const save = async () => {
    const body = { ...form, sort: Number(form.sort) || 0 };
    const r = editing ? await act(`/phone-apps/${editing}`, { method: 'PUT', body, ok: '✅ App updated' }) : await act('/phone-apps', { body, ok: '✅ App added' });
    if (r) {
      setForm(EMPTY_APP);
      setEditing(null);
      reload();
    }
  };
  const f = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  return (
    <>
      <div className="adm-head"><div><h1>Phone apps</h1><div className="sub">Partner apps on every player's in-game phone. They open in the phone's browser; "Opens" counts taps.</div></div></div>
      <div className="adm-cols">
        <div className="panel">
          <h2>{editing ? `Edit app #${editing}` : 'Add an app'}</h2>
          <div style={{ display: 'grid', gap: 8 }}>
            <input className="in" placeholder="Name (e.g. Guap)" value={form.name} onChange={f('name')} maxLength={24} />
            <input className="in" placeholder="https://… (page to open)" value={form.url} onChange={f('url')} />
            <input className="in" placeholder="Icon image URL (https://…) — optional" value={form.icon_url} onChange={f('icon_url')} />
            <div className="toolbar" style={{ margin: 0 }}>
              <input className="in" style={{ width: 90 }} placeholder="Emoji" value={form.emoji} onChange={f('emoji')} maxLength={8} />
              <input type="color" value={form.color} onChange={f('color')} title="Icon background" />
              <input className="in" style={{ width: 90 }} placeholder="Badge" value={form.badge} onChange={f('badge')} maxLength={8} />
              <input className="in" style={{ width: 80 }} type="number" placeholder="Order" value={form.sort} onChange={f('sort')} />
              <label className="small row" style={{ gap: 6 }}><input type="checkbox" checked={form.active} onChange={f('active')} /> visible</label>
            </div>
            <div className="actions">
              <button className="btn btn-green" onClick={save}>{editing ? 'Save changes' : 'Add app'}</button>
              {editing && <button className="btn btn-outline" onClick={() => { setEditing(null); setForm(EMPTY_APP); }}>Cancel</button>}
            </div>
          </div>
        </div>
        <div className="panel tbl-wrap">
          <h2>Live on phones</h2>
          <table className="tbl">
            <thead><tr><th>App</th><th>URL</th><th className="num">Opens</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {data?.map((a) => (
                <tr key={a.id}>
                  <td><span className="row" style={{ gap: 8 }}>{a.icon_url ? <img src={a.icon_url} alt="" width="26" height="26" style={{ borderRadius: 7, background: '#fff' }} /> : <span>{a.emoji || '🌐'}</span>}<b>{a.name}</b>{a.badge && <span className="bdg r">{a.badge}</span>}</span></td>
                  <td className="small" style={{ maxWidth: 220, wordBreak: 'break-all' }}><a href={a.url} target="_blank" rel="noopener noreferrer">{a.url}</a></td>
                  <td className="num">{a.opens}</td>
                  <td>{a.active ? <span className="bdg g">visible</span> : <span className="bdg">hidden</span>}</td>
                  <td className="num">
                    <div className="actions" style={{ gap: 4, justifyContent: 'flex-end' }}>
                      <button className="btn btn-outline btn-xs" onClick={() => { setEditing(a.id); setForm({ name: a.name, url: a.url, icon_url: a.icon_url || '', emoji: a.emoji || '', color: a.color, badge: a.badge || '', sort: a.sort, active: !!a.active }); }}>Edit</button>
                      <button className="btn btn-outline btn-xs" onClick={async () => { if (await act(`/phone-apps/${a.id}`, { method: 'DELETE', confirm: `Delete ${a.name}?`, ok: '🗑️ Deleted' })) reload(); }}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {data?.length === 0 && <tr><td colSpan={5} className="empty">No apps yet</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

const REASON_LABEL = { harass: 'Harassing / bullying', sexual: 'Sexual / creepy', hate: 'Hate / insults', scam: 'Scam / money', spam: 'Spam', other: 'Something else' };
/** Player reports from the in-game ⚑ Report sheet, with the recent DM context. */
export function Reports() {
  const [status, setStatus] = useState('open');
  const [open, setOpen] = useState(null);
  const { data, reload } = useApi(`/admin/reports?status=${status}`);
  return (
    <>
      <div className="adm-head"><div><h1>Player reports</h1><div className="sub">Reports players sent from the ⚑ Report sheet. The reporter has already blocked the person. Recent DMs between them are attached.</div></div></div>
      <div className="toolbar">
        <button className={`btn btn-xs ${status === 'open' ? 'btn-dark' : 'btn-outline'}`} onClick={() => setStatus('open')}>Open</button>
        <button className={`btn btn-xs ${status === 'closed' ? 'btn-dark' : 'btn-outline'}`} onClick={() => setStatus('closed')}>Closed</button>
      </div>
      <div className="panel tbl-wrap">
        <table className="tbl">
          <thead><tr><th>When</th><th>Reported</th><th>By</th><th>Reason</th><th>Note</th><th></th></tr></thead>
          <tbody>
            {data?.map((r) => (
              <Fragment key={r.id}>
                <tr>
                  <td className="small" style={{ whiteSpace: 'nowrap' }}>{ago(r.created_at)}</td>
                  <td><a href={`#/users/${r.target_id}`}>@{r.target}</a>{r.target_banned && <span className="bdg r" style={{ marginLeft: 6 }}>banned</span>}</td>
                  <td><a href={`#/users/${r.reporter_id}`}>@{r.reporter}</a></td>
                  <td>{REASON_LABEL[r.reason] || r.reason}</td>
                  <td className="small">{r.note}</td>
                  <td className="num">
                    <div className="actions" style={{ gap: 4, justifyContent: 'flex-end' }}>
                      <button className="btn btn-outline btn-xs" onClick={() => setOpen(open === r.id ? null : r.id)}>{open === r.id ? 'Hide chat' : `Chat (${r.context.length})`}</button>
                      <button className="btn btn-outline btn-xs" onClick={async () => { if (await act(`/users/${r.target_id}/mute`, { body: { minutes: 1440 }, ok: '🔇 Muted 24h' })) reload(); }}>Mute 24h</button>
                      <a className="btn btn-outline btn-xs" href={`#/users/${r.target_id}`}>Ban…</a>
                      {status === 'open' && <button className="btn btn-dark btn-xs" onClick={async () => { if (await act(`/reports/${r.id}/close`, { ok: '✓ Closed' })) reload(); }}>Close</button>}
                    </div>
                  </td>
                </tr>
                {open === r.id && (
                  <tr><td colSpan={6}>
                    <div className="small" style={{ display: 'grid', gap: 4, maxHeight: 260, overflow: 'auto' }}>
                      {[...r.context].reverse().map((m, i) => <div key={i}><b>{m.from_id === r.target_id ? `@${r.target}` : `@${r.reporter}`}:</b> {m.body} <span className="muted">· {ago(m.created_at)}</span></div>)}
                      {!r.context.length && <span className="muted">No messages between them.</span>}
                    </div>
                  </td></tr>
                )}
              </Fragment>
            ))}
            {data?.length === 0 && <tr><td colSpan={6} className="empty">No {status} reports 🎉</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
