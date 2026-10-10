import { useCallback, useEffect, useState } from 'react';
import { fmtTsh, fmtShort, MUSIC_VENUES } from '@shared/world.js';
import { api, token } from '../api.js';
import { useStore } from '../store.js';
import { Logo } from '../ui/Logo.jsx';
import { Users, UserDetail } from './AdminUsers.jsx';
import { Economy, Topups, Ads, Chat, Property, PhoneApps, Reports } from './AdminData.jsx';
import './admin.css';

// ------------------------------------------------------------ helpers
export function useApi(path, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(() => {
    setLoading(true);
    return api(path)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [path]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    load();
  }, [load, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
  return { data, error, loading, reload: load };
}

/** Run an admin mutation, toast the outcome, return the response (or null). */
export async function act(path, { method = 'POST', body, confirm: ask, ok } = {}) {
  if (ask && !window.confirm(ask)) return null;
  try {
    const r = await api(`/admin${path}`, { method, body: body ?? {} });
    useStore.getState().toast(ok || '✅ Done');
    return r;
  } catch (e) {
    useStore.getState().toast(e.message, 'err');
    return null;
  }
}

export const ago = (t) => {
  if (!t) return '—';
  const s = (Date.now() - t) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return new Date(t).toLocaleDateString();
};
export const dt = (t) => (t ? new Date(t).toLocaleString() : '—');
export const tzs = (n) => `TZS ${Math.round(n || 0).toLocaleString()}`;

export function Kpi({ k, v, d, tone }) {
  return (
    <div className="panel kpi">
      <div className="k">{k}</div>
      <div className="v" style={tone ? { color: tone } : undefined}>{v}</div>
      {d && <div className="d">{d}</div>}
    </div>
  );
}

export function Bars({ data, format = (v) => v }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <>
      <div className="bars">
        {data.map((d) => <div key={d.day} style={{ height: `${(d.value / max) * 100}%` }} title={`${d.day}: ${format(d.value)}`} />)}
      </div>
      <div className="bars-x"><span>{data[0]?.day}</span><span>{data[Math.floor(data.length / 2)]?.day}</span><span>{data[data.length - 1]?.day}</span></div>
    </>
  );
}

export function Pager({ data, page, setPage }) {
  if (!data) return null;
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  return (
    <div className="pager">
      <span>{data.total.toLocaleString()} total · page {page} / {pages}</span>
      <button className="btn btn-outline btn-xs" disabled={page <= 1} onClick={() => setPage(page - 1)}>‹ Prev</button>
      <button className="btn btn-outline btn-xs" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next ›</button>
    </div>
  );
}

export function Switch({ on, onChange, danger }) {
  return <button className={`switch ${on ? 'on' : ''} ${danger ? 'danger' : ''}`} onClick={() => onChange(!on)} aria-pressed={on} />;
}

/** Small form modal: fields = [{ name, label, type, options, placeholder }]. */
export function Modal({ title, fields, submit, onClose, danger, initial = {} }) {
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const go = async (e) => {
    e.preventDefault();
    setBusy(true);
    const ok = await submit(v);
    setBusy(false);
    if (ok !== false) onClose();
  };
  return (
    <div className="adm-modal" onClick={onClose}>
      <form className="panel" onClick={(e) => e.stopPropagation()} onSubmit={go}>
        <h2>{title}</h2>
        {fields.map((f) => (
          <div key={f.name}>
            <label>{f.label}</label>
            {f.type === 'select' ? (
              <select className="in" value={v[f.name] ?? ''} onChange={(e) => setV({ ...v, [f.name]: e.target.value })}>
                {f.options.map(([val, lab]) => <option key={val} value={val}>{lab}</option>)}
              </select>
            ) : f.type === 'checkbox' ? (
              <input type="checkbox" checked={!!v[f.name]} onChange={(e) => setV({ ...v, [f.name]: e.target.checked })} />
            ) : (
              <input className="in" type={f.type || 'text'} placeholder={f.placeholder} value={v[f.name] ?? ''} onChange={(e) => setV({ ...v, [f.name]: e.target.value })} />
            )}
          </div>
        ))}
        <div className="actions" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className={`btn ${danger ? 'btn-red' : 'btn-green'}`} disabled={busy}>{busy ? '…' : 'Confirm'}</button>
        </div>
      </form>
    </div>
  );
}

// ------------------------------------------------------------ routing
const SECTIONS = [
  ['overview', '📊', 'Overview'],
  ['live', '🟢', 'Live'],
  ['users', '👥', 'Users'],
  ['economy', '💰', 'Economy'],
  ['topups', '💳', 'Top-ups'],
  ['ads', '📢', 'Ads'],
  ['chat', '💬', 'Chat'],
  ['reports', '⚑', 'Reports'],
  ['property', '🏘️', 'Property'],
  ['apps', '📱', 'Phone apps'],
  ['music', '🎵', 'Music'],
  ['settings', '⚙️', 'Settings'],
  ['audit', '🧾', 'Audit log'],
];

function useHashRoute() {
  const read = () => (location.hash.replace(/^#\/?/, '') || 'overview').split('/');
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => setRoute(read());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
export const go = (path) => (location.hash = `#/${path}`);

// ----------------------------------------------------------- sections
function Overview() {
  const { data, reload } = useApi('/admin/overview');
  useEffect(() => {
    const t = setInterval(reload, 30_000);
    return () => clearInterval(t);
  }, [reload]);
  if (!data) return <div className="empty">Loading…</div>;
  const k = data.kpis;
  const p = data.payments;
  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Overview</h1>
          <div className="sub">
            Payments: {p.provider ? <span className={`bdg ${p.livemode ? 'g' : 'y'}`}>{p.provider} · {p.livemode ? 'LIVE' : 'test/demo'}</span> : <span className="bdg r">disabled</span>} · rate TZS 1 = {fmtTsh(p.rate)}
          </div>
        </div>
        <button className="btn btn-outline" onClick={reload}>↻ Refresh</button>
      </div>
      <div className="adm-grid">
        <Kpi k="Players" v={k.users.toLocaleString()} d={`${k.onboarded} finished onboarding`} />
        <Kpi k="New today" v={k.newToday} d={`${k.new7d} this week`} />
        <Kpi k="Online now" v={k.online} tone="#16a34a" />
        <Kpi k="DAU / WAU" v={`${k.dau} / ${k.wau}`} d={k.wau ? `${Math.round((k.dau / k.wau) * 100)}% stickiness` : ''} />
        <Kpi k="Revenue (all time)" v={tzs(k.revenueTzs)} d={`${tzs(k.revenue7dTzs)} last 7d`} tone="#16a34a" />
        <Kpi k="Paying players" v={k.payingUsers} d={`${k.conversion}% conversion · ARPPU ${tzs(k.arppu)}`} />
        <Kpi k="Pending top-ups" v={k.pendingTopups} tone={k.pendingTopups ? '#d97706' : undefined} />
        <Kpi k="Money supply" v={`TSh ${fmtShort(k.moneySupply)}`} d="in all wallets" />
        <Kpi k="Ads live" v={k.liveAds} d={`${k.reportedAds} reported · TSh ${fmtShort(k.adSpend)} spent`} tone={k.reportedAds ? '#dc2626' : undefined} />
        <Kpi k="Plots sold" v={`${k.plotsSold} / ${k.plotsTotal}`} d={`${k.businessesOwned}/${k.businessesTotal} businesses owned`} />
        <Kpi k="Vehicles" v={k.vehicles} />
        <Kpi k="Chat (24h)" v={k.messagesToday} d={`${k.visits.toLocaleString()} landing visitors · ${k.banned} banned`} />
      </div>
      <div className="adm-cols">
        <div className="panel"><h2>Sign-ups · 30 days</h2><Bars data={data.charts.signups} /></div>
        <div className="panel"><h2>Revenue (TZS) · 30 days</h2><Bars data={data.charts.revenue} format={tzs} /></div>
        <div className="panel"><h2>Salaries paid (TSh) · 30 days</h2><Bars data={data.charts.salaries} format={fmtTsh} /></div>
        <div className="panel"><h2>Messages · 30 days</h2><Bars data={data.charts.messages} /></div>
      </div>
      <div className="adm-cols">
        <div className="panel">
          <h2>Latest sign-ups</h2>
          <table className="tbl"><tbody>
            {data.recentSignups.map((u) => (
              <tr key={u.id} className="click" onClick={() => go(`users/${u.id}`)}><td><b>@{u.username}</b></td><td>{u.name}</td><td className="num">{ago(u.created_at)}</td></tr>
            ))}
          </tbody></table>
        </div>
        <div className="panel">
          <h2>Latest top-ups</h2>
          <table className="tbl"><tbody>
            {data.recentTopups.map((t) => (
              <tr key={t.id}><td>@{t.username}</td><td className="num">{tzs(t.amount_tzs)}</td><td><StatusBadge s={t.status} /></td><td className="num">{ago(t.created_at)}</td></tr>
            ))}
            {!data.recentTopups.length && <tr><td className="empty">No top-ups yet</td></tr>}
          </tbody></table>
        </div>
      </div>
    </>
  );
}

export function StatusBadge({ s }) {
  const tone = { paid: 'g', live: 'g', pending: 'y', failed: 'r', expired: 'r', removed: 'r', hidden: 'r' }[s] || '';
  return <span className={`bdg ${tone}`}>{s}</span>;
}

function Live() {
  const { data, reload } = useApi('/admin/online');
  useEffect(() => {
    const t = setInterval(reload, 5000);
    return () => clearInterval(t);
  }, [reload]);
  return (
    <>
      <div className="adm-head"><div><h1>Live</h1><div className="sub">Players connected right now (refreshes every 5s)</div></div></div>
      <div className="panel tbl-wrap">
        <table className="tbl">
          <thead><tr><th>Player</th><th>Position</th><th>Doing</th><th>Vehicle</th><th className="num">Tabs</th></tr></thead>
          <tbody>
            {data?.map((p) => (
              <tr key={p.id} className="click" onClick={() => go(`users/${p.id}`)}>
                <td><b>@{p.username}</b> <span className="muted">{p.name}</span></td>
                <td>{p.x}, {p.z}</td>
                <td>{p.busy ? `${p.busy.emoji} ${p.busy.kind} · ${p.busy.id}` : <span className="muted">idle</span>}</td>
                <td>{p.vehicle ? p.vehicle.model : '—'}</td>
                <td className="num">{p.sockets}</td>
              </tr>
            ))}
            {data?.length === 0 && <tr><td colSpan={5} className="empty">Nobody online right now</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** Email health: is Resend set up, and what happened to the last sends? */
function MailHealth() {
  const { data, reload } = useApi('/admin/mail');
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);
  if (!data) return null;
  return (
    <div className="panel">
      <h2>✉️ Email (welcome + password resets)</h2>
      <div className="small" style={{ marginBottom: 6 }}>
        Status: <b style={{ color: data.enabled && !data.warnings.length ? '#16a34a' : '#dc2626' }}>{data.enabled ? (data.warnings.length ? 'Sending, with problems' : `Working (${data.transport})`) : 'OFF — no emails are sent'}</b>
        <span className="muted"> · From: {data.from}</span>
      </div>
      {data.warnings.map((w) => <div key={w} className="small" style={{ background: '#fef2f2', color: '#991b1b', borderRadius: 8, padding: '8px 10px', marginBottom: 6 }}>⚠️ {w}</div>)}
      <div className="toolbar" style={{ marginTop: 8 }}>
        <input className="in" style={{ flex: 1, minWidth: 180 }} type="email" placeholder="Send the welcome email to… (blank = your email)" value={to} onChange={(e) => setTo(e.target.value)} />
        <button className="btn btn-green" disabled={busy} onClick={async () => {
          setBusy(true);
          const r = await act('/mail/test', { body: { to }, ok: '✉️ Test sent — check the result below' });
          setBusy(false);
          if (r) reload();
        }}>Send test</button>
      </div>
      <h3 style={{ marginTop: 14, fontSize: 14 }}>Recent sends</h3>
      {!data.recent.length && <div className="small muted">Nothing sent since the server last restarted.</div>}
      {data.recent.map((m) => (
        <div key={m.at + m.to} className="small" style={{ padding: '6px 0', borderTop: '1px solid #eee' }}>
          {m.ok ? '✅' : '❌'} <b>{m.kind}</b> → {m.to} <span className="muted">· {ago(m.at)}{m.status ? ` · HTTP ${m.status}` : ''}</span>
          {m.error && <div className="muted" style={{ wordBreak: 'break-word' }}>{m.error}</div>}
        </div>
      ))}
    </div>
  );
}

/** Licensed tracks that play at venues (1245, Singeli, Stone Town…), replacing the synth there. */
function MusicAdmin() {
  const { data, reload } = useApi('/admin/music');
  const [f, setF] = useState({ title: '', artist: '', venues: ['club'], rights: '' });
  const [file, setFile] = useState(null);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const toggleVenue = (v) => setF({ ...f, venues: f.venues.includes(v) ? f.venues.filter((x) => x !== v) : [...f.venues, v] });
  const upload = async () => {
    const form = new FormData();
    form.append('audio', file);
    form.append('title', f.title);
    form.append('artist', f.artist);
    form.append('venues', f.venues.join(','));
    form.append('rights', f.rights);
    setBusy(true);
    try {
      await api('/admin/music', { method: 'POST', form });
      useStore.getState().toast('🎵 Track added');
      setF({ ...f, title: '', artist: '', rights: '' });
      setFile(null);
      setAgree(false);
      reload();
    } catch (e) { useStore.getState().toast(e.message, 'err'); }
    setBusy(false);
  };
  return (
    <>
      <div className="adm-head"><div><h1>Music</h1><div className="sub">Real tracks for venues. Where a venue has tracks, they play instead of the built-in synth (with a "Now playing" label).</div></div></div>
      <div className="adm-cols">
        <div className="panel">
          <h2>Add a track</h2>
          <div className="small" style={{ background: '#fef9c3', borderRadius: 8, padding: '8px 10px', marginBottom: 10 }}>⚖️ Only upload music you have the right to play publicly — your own, licensed (e.g. via COSOTA or the label), or with the artist's written permission. Commercial hits without a licence can get the game taken down.</div>
          <input className="in" style={{ width: '100%', marginBottom: 8 }} placeholder="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={80} />
          <input className="in" style={{ width: '100%', marginBottom: 8 }} placeholder="Artist" value={f.artist} onChange={(e) => setF({ ...f, artist: e.target.value })} maxLength={80} />
          <input type="file" accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/ogg,.mp3,.m4a,.ogg" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <div className="small muted" style={{ margin: '10px 0 6px' }}>Plays at:</div>
          <div className="toolbar" style={{ flexWrap: 'wrap' }}>
            {MUSIC_VENUES.map((v) => <button key={v.id} className={`btn ${f.venues.includes(v.id) ? 'btn-green' : 'btn-outline'}`} onClick={() => toggleVenue(v.id)}>{v.name} <span className="muted small">· {v.style}</span></button>)}
          </div>
          <input className="in" style={{ width: '100%', margin: '10px 0 8px' }} placeholder="Rights / licence (e.g. 'Own release', 'Permission from artist, 12 Oct 2026')" value={f.rights} onChange={(e) => setF({ ...f, rights: e.target.value })} maxLength={200} />
          <label className="small" style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} /> I confirm Bongo Life has the right to play this track publicly.</label>
          <button className="btn btn-green" style={{ marginTop: 10 }} disabled={busy || !file || !f.title || !f.artist || !f.venues.length || !f.rights || !agree} onClick={upload}>{busy ? 'Uploading…' : 'Upload track'}</button>
        </div>
        <div className="panel">
          <h2>Library ({data?.length || 0})</h2>
          {!data?.length && <div className="empty">No tracks yet — venues use the built-in Bongo Flava / Singeli / Taarab synth.</div>}
          {data?.map((t) => (
            <div key={t.id} style={{ padding: '8px 0', borderTop: '1px solid #eee' }}>
              <div className="row between" style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <div><b>{t.title}</b> <span className="muted">— {t.artist}</span><div className="small muted">{t.venues.map((v) => MUSIC_VENUES.find((x) => x.id === v)?.name || v).join(', ')} · {t.plays} plays · {t.rights}</div></div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <audio controls preload="none" src={`/uploads/${t.file}`} style={{ height: 32, width: 180 }} />
                  <Switch on={!!t.active} onChange={(v) => act(`/music/${t.id}`, { body: { active: v }, ok: v ? 'Enabled' : 'Disabled' }).then(() => reload())} />
                  <button className="btn btn-outline" onClick={() => act(`/music/${t.id}`, { method: 'DELETE', confirm: `Delete "${t.title}"?`, ok: 'Deleted' }).then(() => reload())}>🗑️</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function Settings() {
  const { data, reload } = useApi('/admin/settings');
  const [form, setForm] = useState(null);
  const [cast, setCast] = useState({ text: '', textEn: '' });
  const [gift, setGift] = useState({ amount: '', memo: '', scope: 'online' });
  useEffect(() => {
    if (data) setForm(data);
  }, [data]);
  if (!form) return <div className="empty">Loading…</div>;
  const save = async (patch) => {
    const r = await act('/settings', { method: 'PUT', body: patch, ok: '✅ Settings saved' });
    if (r) {
      setForm(r);
      reload();
    }
  };
  const flag = (key, label, desc, danger) => (
    <div className="toggle">
      <div><b>{label}</b><div className="small muted">{desc}</div></div>
      <Switch on={!!form[key]} danger={danger} onChange={(v) => save({ [key]: v })} />
    </div>
  );
  return (
    <>
      <div className="adm-head"><div><h1>Settings</h1><div className="sub">Live game switches. Changes apply instantly to every player.</div></div></div>
      <div className="adm-cols">
        <MailHealth />
        <div className="panel">
          <h2>Switches</h2>
          {flag('maintenance', '🔧 Maintenance mode', 'Kicks every non-admin and blocks the game until turned off.', true)}
          {flag('signupsEnabled', 'Sign-ups', 'Allow new accounts.')}
          {flag('topupsEnabled', 'Wallet top-ups', 'Allow mobile money top-ups.')}
          {flag('chatEnabled', 'Public chat', 'Allow street chat messages.')}
          {flag('adsEnabled', 'New ads', 'Allow players to buy billboard ads.')}
        </div>
        <div className="panel">
          <h2>Announcement banner</h2>
          <div className="small muted" style={{ marginBottom: 8 }}>Shown on the landing page and in-game HUD until cleared.</div>
          <input className="in" style={{ width: '100%', marginBottom: 8 }} placeholder="Kiswahili" value={form.announcement} onChange={(e) => setForm({ ...form, announcement: e.target.value })} maxLength={160} />
          <input className="in" style={{ width: '100%' }} placeholder="English" value={form.announcementEn} onChange={(e) => setForm({ ...form, announcementEn: e.target.value })} maxLength={160} />
          <div className="actions" style={{ marginTop: 10 }}>
            <button className="btn btn-green" onClick={() => save({ announcement: form.announcement, announcementEn: form.announcementEn })}>Publish</button>
            <button className="btn btn-outline" onClick={() => save({ announcement: '', announcementEn: '' })}>Clear</button>
          </div>
          <h2 style={{ marginTop: 22 }}>Event override</h2>
          <div className="small muted" style={{ marginBottom: 8 }}>Replaces the weekly rotating event banner (no gameplay bonus).</div>
          <input className="in" style={{ width: '100%', marginBottom: 8 }} placeholder="Kiswahili, e.g. 🎉 Sikukuu ya Uhuru!" value={form.eventOverride} onChange={(e) => setForm({ ...form, eventOverride: e.target.value })} maxLength={160} />
          <input className="in" style={{ width: '100%' }} placeholder="English" value={form.eventOverrideEn} onChange={(e) => setForm({ ...form, eventOverrideEn: e.target.value })} maxLength={160} />
          <div className="actions" style={{ marginTop: 10 }}>
            <button className="btn btn-green" onClick={() => save({ eventOverride: form.eventOverride, eventOverrideEn: form.eventOverrideEn })}>Set event</button>
            <button className="btn btn-outline" onClick={() => save({ eventOverride: '', eventOverrideEn: '' })}>Back to weekly rotation</button>
          </div>
        </div>
        <div className="panel">
          <h2>📣 Broadcast</h2>
          <div className="small muted" style={{ marginBottom: 8 }}>One-off pop-up message to everyone online.</div>
          <input className="in" style={{ width: '100%', marginBottom: 8 }} placeholder="Kiswahili" value={cast.text} onChange={(e) => setCast({ ...cast, text: e.target.value })} maxLength={200} />
          <input className="in" style={{ width: '100%' }} placeholder="English" value={cast.textEn} onChange={(e) => setCast({ ...cast, textEn: e.target.value })} maxLength={200} />
          <button className="btn btn-green" style={{ marginTop: 10 }} disabled={!cast.text} onClick={async () => {
            const r = await act('/broadcast', { body: cast, ok: '📣 Broadcast sent' });
            if (r) setCast({ text: '', textEn: '' });
          }}>Send broadcast</button>

          <h2 style={{ marginTop: 22 }}>🎁 Gift money</h2>
          <div className="small muted" style={{ marginBottom: 8 }}>Credit in-game TSh to every player (or everyone online). Logged in the audit trail.</div>
          <div className="toolbar">
            <input className="in" style={{ width: 140 }} inputMode="numeric" placeholder="Amount (TSh)" value={gift.amount} onChange={(e) => setGift({ ...gift, amount: e.target.value.replace(/\D/g, '') })} />
            <select className="in" value={gift.scope} onChange={(e) => setGift({ ...gift, scope: e.target.value })}>
              <option value="online">Online players</option>
              <option value="all">All players</option>
            </select>
          </div>
          <input className="in" style={{ width: '100%' }} placeholder="Reason (shown to players)" value={gift.memo} onChange={(e) => setGift({ ...gift, memo: e.target.value })} maxLength={120} />
          <button className="btn btn-dark" style={{ marginTop: 10 }} disabled={!gift.amount || !gift.memo} onClick={async () => {
            const r = await act('/grant-all', { body: { ...gift, amount: Number(gift.amount) }, confirm: `Give TSh ${Number(gift.amount).toLocaleString()} to ${gift.scope === 'all' ? 'ALL' : 'online'} players?` });
            if (r) {
              useStore.getState().toast(`🎁 Sent to ${r.count} players`);
              setGift({ amount: '', memo: '', scope: gift.scope });
            }
          }}>Send gift</button>
        </div>
      </div>
    </>
  );
}

function Audit() {
  const [page, setPage] = useState(1);
  const { data } = useApi(`/admin/audit?page=${page}`);
  return (
    <>
      <div className="adm-head"><div><h1>Audit log</h1><div className="sub">Every admin action, newest first.</div></div></div>
      <div className="panel tbl-wrap">
        <table className="tbl">
          <thead><tr><th>When</th><th>Admin</th><th>Action</th><th>Target</th><th>Details</th></tr></thead>
          <tbody>
            {data?.rows.map((a) => (
              <tr key={a.id}>
                <td className="small">{dt(a.created_at)}</td>
                <td>@{a.admin}</td>
                <td><span className="bdg b">{a.action}</span></td>
                <td>{a.target_type === 'user' ? <a href={`#/users/${a.target_id}`}>user #{a.target_id}</a> : a.target_type ? `${a.target_type} ${a.target_id ?? ''}` : '—'}</td>
                <td className="small" style={{ maxWidth: 360, wordBreak: 'break-word' }}>{a.details ? JSON.stringify(a.details) : ''}</td>
              </tr>
            ))}
            {data?.rows.length === 0 && <tr><td colSpan={5} className="empty">No admin actions yet</td></tr>}
          </tbody>
        </table>
        <Pager data={data} page={page} setPage={setPage} />
      </div>
    </>
  );
}

// -------------------------------------------------------------- login
function AdminLogin({ onDone }) {
  const [f, setF] = useState({ username: '', password: '' });
  const [err, setErr] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      const r = await api('/auth/login', { method: 'POST', body: f });
      if (!r.me.isAdmin) return setErr('This account is not an admin.');
      token.set(r.token);
      onDone(r.me);
    } catch (e2) {
      setErr(e2.message);
    }
  };
  return (
    <div className="auth">
      <form className="card adm-login" style={{ padding: 22 }} onSubmit={submit}>
        <Logo size={22} />
        <h2 style={{ margin: '14px 0 4px' }}>Admin sign in</h2>
        <div className="label">Username</div>
        <input className="field" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} autoCapitalize="none" autoComplete="username" />
        <div className="label">Password</div>
        <input className="field" type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete="current-password" />
        {err && <div className="err">{err}</div>}
        <button className="btn btn-green btn-block" style={{ marginTop: 16 }}>Sign in</button>
        <a href="/" className="small" style={{ display: 'block', textAlign: 'center', marginTop: 12 }}>← Back to the game</a>
      </form>
    </div>
  );
}

export default function Admin() {
  const [me, setMe] = useState(undefined);
  const route = useHashRoute();
  useEffect(() => {
    document.title = 'Bongo Life · Admin';
    if (!token.get()) return setMe(null);
    api('/me').then(setMe).catch(() => setMe(null));
  }, []);
  if (me === undefined) return <div className="loading">Loading…</div>;
  if (!me || !me.isAdmin) return <AdminLogin onDone={setMe} />;

  const [section, id] = route;
  const nav = (
    <>
      {SECTIONS.map(([key, icon, label]) => (
        <button key={key} className={section === key ? 'on' : ''} onClick={() => go(key)}>{icon} {label}</button>
      ))}
    </>
  );
  return (
    <div className="adm">
      <aside className="adm-side">
        <Logo size={18} />
        {nav}
        <div className="foot">
          Signed in as <b>@{me.username}</b><br />
          <a href="/" style={{ color: '#94a3b8' }}>← Back to game</a>
        </div>
      </aside>
      <div className="adm-top">{nav}</div>
      <main className="adm-main">
        {section === 'overview' && <Overview />}
        {section === 'live' && <Live />}
        {section === 'users' && (id ? <UserDetail id={id} me={me} /> : <Users />)}
        {section === 'economy' && <Economy />}
        {section === 'topups' && <Topups />}
        {section === 'ads' && <Ads />}
        {section === 'chat' && <Chat />}
        {section === 'reports' && <Reports />}
        {section === 'property' && <Property />}
        {section === 'apps' && <PhoneApps />}
        {section === 'music' && <MusicAdmin />}
        {section === 'settings' && <Settings />}
        {section === 'audit' && <Audit />}
      </main>
    </div>
  );
}
