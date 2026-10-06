import express from 'express';
import { PLOTS, PLACES, SPAWNS, plotById, placeById, buildingById, vehicleById, NEEDS } from '../../../shared/world.js';
import { db, getUser, addMoney, saveFields, GameError, now, audit, getSettings, setSettings, freshNeeds } from '../db.js';
import { hashPassword } from '../auth.js';
import * as game from '../game.js';
import { online, broadcast, emitTo, kick } from '../presence.js';
import { providers, provider, TOPUP_RATE } from '../payments/index.js';
import { settleTopup, liveAds, publicAnnouncement } from './api.js';

export const admin = express.Router();
const DAY = 86400_000;
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const int = (v, d = 0) => (Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : d);
const page = (req, size = 50) => {
  const p = Math.max(1, int(req.query.page, 1));
  return { limit: size, offset: (p - 1) * size, page: p };
};
const userOr404 = (id) => {
  const u = getUser(int(id));
  if (!u) throw new GameError('User not found', 404);
  return u;
};
const parse = (s) => {
  try { return s ? JSON.parse(s) : null; } catch { return null; }
};
const worldChanged = () => broadcast('world', game.worldState());

/** Bucket rows of {t, v} into the last `days` calendar days (UTC+3, Dar time). */
function series(rows, days) {
  const tz = 3 * 3600_000;
  const today = Math.floor((now() + tz) / DAY);
  const out = Array.from({ length: days }, (_, i) => ({ day: new Date((today - days + 1 + i) * DAY).toISOString().slice(5, 10), value: 0 }));
  for (const r of rows) {
    const idx = Math.floor((r.t + tz) / DAY) - (today - days + 1);
    if (idx >= 0 && idx < days) out[idx].value += r.v;
  }
  return out;
}

// ------------------------------------------------------------ overview
admin.get('/overview', (_req, res) => {
  const t = now();
  const since30 = t - 30 * DAY;
  const one = (sql, ...a) => db.prepare(sql).get(...a);
  const users = one('SELECT COUNT(*) n FROM users').n;
  const kpis = {
    users,
    onboarded: one('SELECT COUNT(*) n FROM users WHERE onboarded = 1').n,
    newToday: one('SELECT COUNT(*) n FROM users WHERE created_at > ?', t - DAY).n,
    new7d: one('SELECT COUNT(*) n FROM users WHERE created_at > ?', t - 7 * DAY).n,
    online: online.size,
    dau: one('SELECT COUNT(*) n FROM users WHERE last_seen > ?', t - DAY).n,
    wau: one('SELECT COUNT(*) n FROM users WHERE last_seen > ?', t - 7 * DAY).n,
    banned: one('SELECT COUNT(*) n FROM users WHERE banned_at IS NOT NULL').n,
    visits: one('SELECT COUNT(*) n FROM visitors').n,
    moneySupply: one('SELECT COALESCE(SUM(money),0) s FROM users').s,
    revenueTzs: one("SELECT COALESCE(SUM(amount_tzs),0) s FROM topups WHERE status = 'paid'").s,
    revenue7dTzs: one("SELECT COALESCE(SUM(amount_tzs),0) s FROM topups WHERE status = 'paid' AND credited_at > ?", t - 7 * DAY).s,
    payingUsers: one("SELECT COUNT(DISTINCT user_id) n FROM topups WHERE status = 'paid'").n,
    pendingTopups: one("SELECT COUNT(*) n FROM topups WHERE status = 'pending'").n,
    liveAds: liveAds().length,
    reportedAds: one("SELECT COUNT(*) n FROM ads WHERE reports > 0 AND status = 'live'").n,
    adSpend: one("SELECT COALESCE(-SUM(amount),0) s FROM transactions WHERE kind = 'ads'").s,
    messagesToday: one('SELECT COUNT(*) n FROM messages WHERE created_at > ?', t - DAY).n,
    plotsSold: one('SELECT COUNT(*) n FROM plots').n,
    plotsTotal: PLOTS.length,
    businessesOwned: one('SELECT COUNT(*) n FROM businesses').n,
    businessesTotal: PLACES.filter((p) => p.business).length,
    vehicles: one('SELECT COUNT(*) n FROM vehicles').n,
  };
  kpis.arppu = kpis.payingUsers ? Math.round(kpis.revenueTzs / kpis.payingUsers) : 0;
  kpis.conversion = users ? +((kpis.payingUsers / users) * 100).toFixed(1) : 0;
  const charts = {
    signups: series(db.prepare('SELECT created_at t, 1 v FROM users WHERE created_at > ?').all(since30), 30),
    revenue: series(db.prepare("SELECT credited_at t, amount_tzs v FROM topups WHERE status = 'paid' AND credited_at > ?").all(since30), 30),
    salaries: series(db.prepare("SELECT created_at t, amount v FROM transactions WHERE kind = 'salary' AND created_at > ?").all(since30), 30),
    messages: series(db.prepare('SELECT created_at t, 1 v FROM messages WHERE created_at > ?').all(since30), 30),
  };
  const recentSignups = db.prepare('SELECT id, username, name, created_at FROM users ORDER BY id DESC LIMIT 8').all();
  const recentTopups = db.prepare('SELECT t.id, t.amount_tzs, t.status, t.created_at, u.username FROM topups t JOIN users u ON u.id = t.user_id ORDER BY t.id DESC LIMIT 8').all();
  res.json({ kpis, charts, recentSignups, recentTopups, payments: { provider: provider?.id || null, livemode: !!provider?.livemode, rate: TOPUP_RATE } });
});

// --------------------------------------------------------------- users
admin.get('/users', (req, res) => {
  const { limit, offset, page: p } = page(req, 40);
  const q = str(req.query.q, 40);
  const filter = str(req.query.filter, 20);
  const sort = { new: 'u.id DESC', money: 'u.money DESC', fame: 'u.fame DESC', seen: 'u.last_seen DESC', old: 'u.id ASC' }[req.query.sort] || 'u.id DESC';
  const where = ['1=1'];
  const params = {};
  if (q) {
    where.push('(u.username LIKE @q OR u.name LIKE @q OR u.email LIKE @q OR u.phone LIKE @q)');
    params.q = `%${q}%`;
  }
  if (filter === 'banned') where.push('u.banned_at IS NOT NULL');
  if (filter === 'admins') where.push('u.is_admin = 1');
  if (filter === 'muted') where.push(`u.muted_until > ${now()}`);
  if (filter === 'paying') where.push("EXISTS (SELECT 1 FROM topups t WHERE t.user_id = u.id AND t.status = 'paid')");
  if (filter === 'online') where.push(`u.id IN (${[...online.keys()].join(',') || 0})`);
  const w = where.join(' AND ');
  const total = db.prepare(`SELECT COUNT(*) n FROM users u WHERE ${w}`).get(params).n;
  const rows = db.prepare(`
    SELECT u.id, u.username, u.name, u.email, u.phone, u.money, u.fame, u.elimu, u.created_at, u.last_seen, u.banned_at, u.muted_until, u.is_admin, u.onboarded, u.appearance,
      (SELECT COALESCE(SUM(amount_tzs),0) FROM topups t WHERE t.user_id = u.id AND t.status = 'paid') AS paid_tzs
    FROM users u WHERE ${w} ORDER BY ${sort} LIMIT ${limit} OFFSET ${offset}`).all(params);
  res.json({ total, page: p, pageSize: limit, rows: rows.map((r) => ({ ...r, appearance: parse(r.appearance), online: online.has(r.id) })) });
});

admin.get('/users/:id', (req, res) => {
  const u = userOr404(req.params.id);
  const id = u.id;
  res.json({
    user: { ...u, online: online.has(id), position: online.get(id) ? [online.get(id).x, online.get(id).z] : [u.x, u.z] },
    netWorth: game.netWorth(id),
    pendingIncome: game.pendingIncome(id),
    vehicles: db.prepare('SELECT * FROM vehicles WHERE user_id = ?').all(id),
    plots: db.prepare('SELECT * FROM plots WHERE owner_id = ?').all(id),
    businesses: db.prepare('SELECT * FROM businesses WHERE owner_id = ?').all(id),
    transactions: db.prepare('SELECT * FROM transactions WHERE user_id = ? ORDER BY id DESC LIMIT 100').all(id),
    topups: db.prepare('SELECT * FROM topups WHERE user_id = ? ORDER BY id DESC LIMIT 50').all(id),
    ads: db.prepare('SELECT * FROM ads WHERE user_id = ? ORDER BY id DESC LIMIT 30').all(id),
    messages: db.prepare('SELECT id, body, created_at, deleted_at FROM messages WHERE from_id = ? AND to_id IS NULL ORDER BY id DESC LIMIT 50').all(id),
    dmStats: db.prepare('SELECT COUNT(*) sent, COUNT(DISTINCT to_id) contacts FROM messages WHERE from_id = ? AND to_id IS NOT NULL').get(id),
    totals: db.prepare('SELECT kind, SUM(amount) total, COUNT(*) n FROM transactions WHERE user_id = ? GROUP BY kind').all(id),
    audit: db.prepare("SELECT a.*, u.username admin FROM audit a JOIN users u ON u.id = a.admin_id WHERE a.target_type = 'user' AND a.target_id = ? ORDER BY a.id DESC LIMIT 50").all(String(id))
      .map((a) => ({ ...a, details: parse(a.details) })),
  });
});

admin.post('/users/:id/ban', (req, res) => {
  const u = userOr404(req.params.id);
  if (u.id === req.user.id) throw new GameError("You can't ban yourself");
  const reason = str(req.body.reason, 200) || null;
  db.prepare('UPDATE users SET banned_at = ?, ban_reason = ?, token_version = token_version + 1 WHERE id = ?').run(now(), reason, u.id);
  kick(u.id, 'banned');
  game.clearLeaderboardCache();
  audit(req.user.id, 'user.ban', 'user', u.id, { reason });
  res.json({ ok: true });
});
admin.post('/users/:id/unban', (req, res) => {
  const u = userOr404(req.params.id);
  db.prepare('UPDATE users SET banned_at = NULL, ban_reason = NULL WHERE id = ?').run(u.id);
  game.clearLeaderboardCache();
  audit(req.user.id, 'user.unban', 'user', u.id);
  res.json({ ok: true });
});
admin.post('/users/:id/mute', (req, res) => {
  const u = userOr404(req.params.id);
  const minutes = Math.max(0, Math.min(60 * 24 * 365, int(req.body.minutes, 60)));
  const until = minutes ? now() + minutes * 60_000 : null;
  db.prepare('UPDATE users SET muted_until = ? WHERE id = ?').run(until, u.id);
  if (until) emitTo(u.id, 'toast', { text: [`Umezuiwa kuchat kwa dakika ${minutes}.`, `You've been muted for ${minutes} minutes.`] });
  audit(req.user.id, minutes ? 'user.mute' : 'user.unmute', 'user', u.id, { minutes });
  res.json({ ok: true });
});
admin.post('/users/:id/balance', (req, res) => {
  const u = userOr404(req.params.id);
  const delta = int(req.body.delta);
  const memo = str(req.body.memo, 120);
  if (!delta || Math.abs(delta) > 1e13) throw new GameError('Enter a non-zero amount');
  if (!memo) throw new GameError('A reason is required for balance adjustments');
  const balance = db.transaction(() => addMoney(u.id, delta, 'admin', `Admin: ${memo}`))();
  emitTo(u.id, 'toast', { text: delta > 0 ? [`🎁 Umepokea TSh ${delta.toLocaleString()} — ${memo}`, `🎁 You received TSh ${delta.toLocaleString()} — ${memo}`] : [`Salio limerekebishwa: ${memo}`, `Balance adjusted: ${memo}`], refresh: true });
  audit(req.user.id, 'user.balance', 'user', u.id, { delta, memo, balance });
  res.json({ ok: true, balance });
});
admin.post('/users/:id/needs', (req, res) => {
  const u = userOr404(req.params.id);
  const needs = Object.fromEntries(NEEDS.map((n) => [n.id, 100]));
  saveFields(u.id, { needs, busy: null });
  emitTo(u.id, 'needs', { needs, mood: 100 });
  audit(req.user.id, 'user.needs_reset', 'user', u.id);
  res.json({ ok: true });
});
admin.post('/users/:id/teleport', (req, res) => {
  const u = userOr404(req.params.id);
  const spawn = SPAWNS[req.body.spawn] || SPAWNS.manzese;
  const [x, z] = spawn.pos;
  saveFields(u.id, { x, z, busy: null });
  const p = online.get(u.id);
  if (p) Object.assign(p, { x, z });
  emitTo(u.id, 'teleport', { pos: [x, z] });
  audit(req.user.id, 'user.teleport', 'user', u.id, { spawn: req.body.spawn });
  res.json({ ok: true });
});
admin.post('/users/:id/role', (req, res) => {
  const u = userOr404(req.params.id);
  if (u.id === req.user.id) throw new GameError("You can't change your own role");
  const isAdmin = !!req.body.isAdmin;
  db.prepare('UPDATE users SET is_admin = ? WHERE id = ?').run(isAdmin ? 1 : 0, u.id);
  audit(req.user.id, isAdmin ? 'user.make_admin' : 'user.revoke_admin', 'user', u.id);
  res.json({ ok: true });
});
admin.post('/users/:id/logout', (req, res) => {
  const u = userOr404(req.params.id);
  db.prepare('UPDATE users SET token_version = token_version + 1 WHERE id = ?').run(u.id);
  kick(u.id, 'logged_out');
  audit(req.user.id, 'user.force_logout', 'user', u.id);
  res.json({ ok: true });
});
admin.post('/users/:id/password', async (req, res, next) => {
  try {
    const u = userOr404(req.params.id);
    const pw = typeof req.body.password === 'string' ? req.body.password : '';
    if (pw.length < 6) throw new GameError('Password must be at least 6 characters');
    db.prepare('UPDATE users SET password_hash = ?, token_version = token_version + 1 WHERE id = ?').run(await hashPassword(pw), u.id);
    kick(u.id, 'password_reset');
    audit(req.user.id, 'user.password_reset', 'user', u.id);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});
admin.post('/users/:id/profile', (req, res) => {
  const u = userOr404(req.params.id);
  const name = str(req.body.name, 40);
  const email = str(req.body.email, 120).toLowerCase() || null;
  if (name.length < 2) throw new GameError('Name too short');
  saveFields(u.id, { name, email });
  const p = online.get(u.id);
  if (p) p.name = name;
  audit(req.user.id, 'user.profile', 'user', u.id, { name, email });
  res.json({ ok: true });
});
admin.post('/users/:id/vehicles/:vid/remove', (req, res) => {
  const u = userOr404(req.params.id);
  const v = db.prepare('SELECT * FROM vehicles WHERE id = ? AND user_id = ?').get(int(req.params.vid), u.id);
  if (!v) throw new GameError('Vehicle not found', 404);
  db.transaction(() => {
    if (u.activeVehicle === v.id) game.useVehicle(u.id, null);
    db.prepare('DELETE FROM vehicles WHERE id = ?').run(v.id);
    if (req.body.refund) addMoney(u.id, vehicleById[v.model]?.price || 0, 'refund', `Refund: ${vehicleById[v.model]?.name}`);
  })();
  audit(req.user.id, 'vehicle.remove', 'user', u.id, { vehicle: v.model, refund: !!req.body.refund });
  res.json({ ok: true });
});

// -------------------------------------------------------- economy
admin.get('/economy', (_req, res) => {
  const t = now();
  const byKind = (since) => db.prepare('SELECT kind, SUM(amount) total, COUNT(*) n FROM transactions WHERE created_at > ? GROUP BY kind ORDER BY total DESC').all(since);
  const lb = game.leaderboard();
  res.json({
    moneySupply: db.prepare('SELECT COALESCE(SUM(money),0) s FROM users').get().s,
    kinds: { day: byKind(t - DAY), week: byKind(t - 7 * DAY), all: byKind(0) },
    richest: lb.rich.slice(0, 15),
    famous: lb.famous.slice(0, 10),
    topSpenders: db.prepare("SELECT u.username, SUM(t.amount_tzs) tzs, COUNT(*) n FROM topups t JOIN users u ON u.id = t.user_id WHERE t.status = 'paid' GROUP BY t.user_id ORDER BY tzs DESC LIMIT 15").all(),
    distribution: db.prepare(`SELECT CASE WHEN money < 100000 THEN '< 100K' WHEN money < 1000000 THEN '100K–1M' WHEN money < 10000000 THEN '1M–10M'
      WHEN money < 100000000 THEN '10M–100M' ELSE '100M+' END bucket, COUNT(*) n FROM users GROUP BY bucket`).all(),
  });
});

admin.get('/transactions', (req, res) => {
  const { limit, offset, page: p } = page(req, 60);
  const where = ['1=1'];
  const params = {};
  if (req.query.kind) { where.push('t.kind = @kind'); params.kind = str(req.query.kind, 20); }
  if (req.query.user) { where.push('u.username = @user'); params.user = str(req.query.user, 30).replace(/^@/, ''); }
  if (req.query.min) { where.push('ABS(t.amount) >= @min'); params.min = int(req.query.min); }
  const w = where.join(' AND ');
  const total = db.prepare(`SELECT COUNT(*) n FROM transactions t JOIN users u ON u.id = t.user_id WHERE ${w}`).get(params).n;
  const rows = db.prepare(`SELECT t.*, u.username FROM transactions t JOIN users u ON u.id = t.user_id WHERE ${w} ORDER BY t.id DESC LIMIT ${limit} OFFSET ${offset}`).all(params);
  res.json({ total, page: p, pageSize: limit, rows });
});

// --------------------------------------------------------- top-ups
admin.get('/topups', (req, res) => {
  const { limit, offset, page: p } = page(req, 50);
  const status = str(req.query.status, 20);
  const w = status ? 't.status = @status' : '1=1';
  const total = db.prepare(`SELECT COUNT(*) n FROM topups t WHERE ${w}`).get({ status }).n;
  const rows = db.prepare(`SELECT t.*, u.username FROM topups t JOIN users u ON u.id = t.user_id WHERE ${w} ORDER BY t.id DESC LIMIT ${limit} OFFSET ${offset}`).all({ status });
  const sums = db.prepare('SELECT status, COUNT(*) n, COALESCE(SUM(amount_tzs),0) tzs FROM topups GROUP BY status').all();
  res.json({ total, page: p, pageSize: limit, rows, sums, provider: provider?.id || null, livemode: !!provider?.livemode, rate: TOPUP_RATE });
});
admin.post('/topups/:id/recheck', async (req, res, next) => {
  try {
    const t = db.prepare('SELECT * FROM topups WHERE id = ?').get(int(req.params.id));
    if (!t) throw new GameError('Top-up not found', 404);
    const status = await settleTopup(t);
    audit(req.user.id, 'topup.recheck', 'topup', t.id, { status });
    res.json({ status });
  } catch (e) {
    next(e);
  }
});
admin.post('/topups/:id/mark', (req, res) => {
  const t = db.prepare('SELECT * FROM topups WHERE id = ?').get(int(req.params.id));
  if (!t) throw new GameError('Top-up not found', 404);
  const status = req.body.status === 'paid' ? 'paid' : 'failed';
  const note = str(req.body.note, 200);
  if (!note) throw new GameError('A note is required (e.g. the mobile money receipt)');
  if (t.status !== 'pending') throw new GameError(`Top-up is already ${t.status}`);
  db.transaction(() => {
    const r = db.prepare("UPDATE topups SET status = ?, credited_at = ? WHERE id = ? AND status = 'pending'").run(status, status === 'paid' ? now() : null, t.id);
    if (r.changes && status === 'paid') addMoney(t.user_id, t.coins, 'topup', `Top-up (manual): TZS ${t.amount_tzs.toLocaleString()}`);
  })();
  if (status === 'paid') emitTo(t.user_id, 'toast', { text: [`✅ Salio limeingia: TSh ${t.coins.toLocaleString()}`, `✅ Top-up received: TSh ${t.coins.toLocaleString()}`], refresh: true });
  audit(req.user.id, `topup.mark_${status}`, 'topup', t.id, { note, user: t.user_id, amountTzs: t.amount_tzs });
  res.json({ ok: true });
});

// ------------------------------------------------------------- ads
admin.get('/ads', (req, res) => {
  const { limit, offset, page: p } = page(req, 40);
  const filter = str(req.query.filter, 20);
  const t = now();
  const w = filter === 'live' ? `a.status = 'live' AND a.ends_at > ${t}` : filter === 'reported' ? 'a.reports > 0' : filter === 'removed' ? "a.status != 'live'" : '1=1';
  const total = db.prepare(`SELECT COUNT(*) n FROM ads a WHERE ${w}`).get().n;
  const rows = db.prepare(`SELECT a.*, u.username FROM ads a JOIN users u ON u.id = a.user_id WHERE ${w} ORDER BY a.reports DESC, a.id DESC LIMIT ${limit} OFFSET ${offset}`).all();
  res.json({ total, page: p, pageSize: limit, rows });
});
admin.post('/ads/:id/remove', (req, res) => {
  const ad = db.prepare('SELECT * FROM ads WHERE id = ?').get(int(req.params.id));
  if (!ad) throw new GameError('Ad not found', 404);
  const refund = req.body.refund ? db.prepare("SELECT -amount a FROM transactions WHERE user_id = ? AND kind = 'ads' AND memo LIKE ? ORDER BY id DESC LIMIT 1").get(ad.user_id, `%"${ad.title}"%`)?.a || 0 : 0;
  db.transaction(() => {
    db.prepare("UPDATE ads SET status = 'removed' WHERE id = ?").run(ad.id);
    if (refund > 0) addMoney(ad.user_id, refund, 'refund', `Refund: ad "${ad.title}"`);
  })();
  emitTo(ad.user_id, 'toast', { text: [`📢 Tangazo "${ad.title}" limeondolewa na admin.`, `📢 Your ad "${ad.title}" was removed by an admin.`], refresh: true });
  broadcast('ads', liveAds());
  audit(req.user.id, 'ad.remove', 'ad', ad.id, { refund, reason: str(req.body.reason, 200) });
  res.json({ ok: true, refund });
});
admin.post('/ads/:id/restore', (req, res) => {
  db.prepare("UPDATE ads SET status = 'live', reports = 0 WHERE id = ?").run(int(req.params.id));
  db.prepare('DELETE FROM ad_reports WHERE ad_id = ?').run(int(req.params.id));
  broadcast('ads', liveAds());
  audit(req.user.id, 'ad.restore', 'ad', req.params.id);
  res.json({ ok: true });
});

// -------------------------------------------------------------- chat
admin.get('/messages', (req, res) => {
  const { limit, offset, page: p } = page(req, 80);
  const where = ['m.to_id IS NULL'];
  const params = {};
  if (req.query.q) { where.push('m.body LIKE @q'); params.q = `%${str(req.query.q, 60)}%`; }
  if (req.query.user) { where.push('u.username = @user'); params.user = str(req.query.user, 30).replace(/^@/, ''); }
  if (req.query.deleted !== '1') where.push('m.deleted_at IS NULL');
  const w = where.join(' AND ');
  const total = db.prepare(`SELECT COUNT(*) n FROM messages m JOIN users u ON u.id = m.from_id WHERE ${w}`).get(params).n;
  const rows = db.prepare(`SELECT m.id, m.body, m.created_at, m.deleted_at, u.id user_id, u.username, u.muted_until FROM messages m JOIN users u ON u.id = m.from_id WHERE ${w} ORDER BY m.id DESC LIMIT ${limit} OFFSET ${offset}`).all(params);
  res.json({ total, page: p, pageSize: limit, rows });
});
admin.delete('/messages/:id', (req, res) => {
  db.prepare('UPDATE messages SET deleted_at = ? WHERE id = ?').run(now(), int(req.params.id));
  broadcast('chat:delete', { ids: [int(req.params.id)] });
  audit(req.user.id, 'message.delete', 'message', req.params.id);
  res.json({ ok: true });
});
admin.post('/users/:id/purge-messages', (req, res) => {
  const u = userOr404(req.params.id);
  const ids = db.prepare('SELECT id FROM messages WHERE from_id = ? AND to_id IS NULL AND deleted_at IS NULL').all(u.id).map((r) => r.id);
  db.prepare('UPDATE messages SET deleted_at = ? WHERE from_id = ? AND to_id IS NULL AND deleted_at IS NULL').run(now(), u.id);
  broadcast('chat:delete', { ids });
  audit(req.user.id, 'user.purge_messages', 'user', u.id, { count: ids.length });
  res.json({ ok: true, count: ids.length });
});

// ---------------------------------------------------------- property
admin.get('/property', (_req, res) => {
  const plots = Object.fromEntries(db.prepare('SELECT p.*, u.username FROM plots p JOIN users u ON u.id = p.owner_id').all().map((r) => [r.id, r]));
  const biz = Object.fromEntries(db.prepare('SELECT b.*, u.username FROM businesses b JOIN users u ON u.id = b.owner_id').all().map((r) => [r.id, r]));
  res.json({
    plots: PLOTS.map((p) => ({ id: p.id, name: p.name, area: p.area, price: p.price, owner: plots[p.id]?.username || null, building: plots[p.id]?.building || null, boughtAt: plots[p.id]?.bought_at || null })),
    businesses: PLACES.filter((p) => p.business).map((p) => ({ id: p.id, name: p.business.label || p.name, price: p.business.price, incomePerHour: p.business.incomePerHour, owner: biz[p.id]?.username || null, boughtAt: biz[p.id]?.bought_at || null })),
  });
});
admin.post('/plots/:id/revoke', (req, res) => {
  const row = db.prepare('SELECT * FROM plots WHERE id = ?').get(req.params.id);
  if (!row) throw new GameError('Plot is not owned', 404);
  const plot = plotById[row.id];
  const refund = req.body.refund ? plot.price + (row.building ? buildingById[row.building]?.price || 0 : 0) : 0;
  db.transaction(() => {
    db.prepare('DELETE FROM plots WHERE id = ?').run(row.id);
    if (refund) addMoney(row.owner_id, refund, 'refund', `Refund: ${plot.name}`);
  })();
  emitTo(row.owner_id, 'toast', { text: [`🏞️ ${plot.name} kimerudishwa sokoni na admin.`, `🏞️ ${plot.nameEn} was returned to the market by an admin.`], refresh: true });
  worldChanged();
  game.clearLeaderboardCache();
  audit(req.user.id, 'plot.revoke', 'plot', row.id, { owner: row.owner_id, refund });
  res.json({ ok: true, refund });
});
admin.post('/business/:id/revoke', (req, res) => {
  const row = db.prepare('SELECT * FROM businesses WHERE id = ?').get(req.params.id);
  if (!row) throw new GameError('Business is not owned', 404);
  const place = placeById[row.id];
  const refund = req.body.refund ? place.business.price : 0;
  db.transaction(() => {
    db.prepare('DELETE FROM businesses WHERE id = ?').run(row.id);
    if (refund) addMoney(row.owner_id, refund, 'refund', `Refund: ${place.name}`);
  })();
  worldChanged();
  game.clearLeaderboardCache();
  audit(req.user.id, 'business.revoke', 'business', row.id, { owner: row.owner_id, refund });
  res.json({ ok: true, refund });
});

// -------------------------------------------------------------- live
admin.get('/online', (_req, res) => {
  res.json([...online].map(([id, p]) => ({ id, username: p.username, name: p.name, x: +p.x.toFixed(1), z: +p.z.toFixed(1), busy: p.busy, vehicle: p.vehicle, sockets: p.sockets.size })));
});

// ---------------------------------------------------------- settings
admin.get('/settings', (_req, res) => res.json(getSettings()));
admin.put('/settings', (req, res) => {
  const before = getSettings();
  const patch = {};
  for (const k of ['maintenance', 'signupsEnabled', 'topupsEnabled', 'chatEnabled', 'adsEnabled']) if (k in req.body) patch[k] = !!req.body[k];
  for (const k of ['announcement', 'announcementEn', 'eventOverride', 'eventOverrideEn']) if (k in req.body) patch[k] = str(req.body[k], 160);
  const after = setSettings(patch);
  if ('announcement' in patch || 'announcementEn' in patch) broadcast('announcement', publicAnnouncement());
  if ('eventOverride' in patch || 'eventOverrideEn' in patch) worldChanged();
  if (patch.maintenance && !before.maintenance) {
    for (const [id] of online) if (!getUser(id)?.isAdmin) kick(id, 'maintenance');
  }
  audit(req.user.id, 'settings.update', 'settings', null, patch);
  res.json(after);
});

admin.post('/broadcast', (req, res) => {
  const text = str(req.body.text, 200);
  const textEn = str(req.body.textEn, 200) || text;
  if (!text) throw new GameError('Message is required');
  broadcast('toast', { text: [`📣 ${text}`, `📣 ${textEn}`], long: true });
  audit(req.user.id, 'broadcast', null, null, { text, textEn });
  res.json({ ok: true, reached: online.size });
});

admin.post('/grant-all', (req, res) => {
  const amount = int(req.body.amount);
  const memo = str(req.body.memo, 120);
  if (amount <= 0 || amount > 1e9) throw new GameError('Amount must be between 1 and 1,000,000,000');
  if (!memo) throw new GameError('A reason is required');
  const scope = req.body.scope === 'all' ? 'all' : 'online';
  const ids = scope === 'all' ? db.prepare('SELECT id FROM users WHERE banned_at IS NULL').all().map((r) => r.id) : [...online.keys()];
  db.transaction(() => ids.forEach((id) => addMoney(id, amount, 'gift', `🎁 ${memo}`)))();
  for (const id of ids) emitTo(id, 'toast', { text: [`🎁 Zawadi: TSh ${amount.toLocaleString()} — ${memo}`, `🎁 Gift: TSh ${amount.toLocaleString()} — ${memo}`], refresh: true });
  audit(req.user.id, 'grant_all', null, null, { amount, memo, scope, count: ids.length });
  res.json({ ok: true, count: ids.length });
});

// --------------------------------------------------------- phone apps
const appFields = (b) => {
  const url = str(b.url, 300);
  if (!/^https:\/\/[^\s]+$/i.test(url)) throw new GameError('URL must start with https://');
  const icon = str(b.icon_url, 300);
  if (icon && !/^https:\/\/[^\s]+$/i.test(icon)) throw new GameError('Icon URL must start with https://');
  const name = str(b.name, 24);
  if (name.length < 2) throw new GameError('Name is required');
  return {
    name, url, icon_url: icon || null, emoji: str(b.emoji, 8) || null,
    color: /^#[0-9a-f]{6}$/i.test(b.color || '') ? b.color : '#111827',
    badge: str(b.badge, 8) || null, sort: int(b.sort), active: b.active === false ? 0 : 1,
  };
};
admin.get('/phone-apps', (_req, res) => res.json(db.prepare('SELECT * FROM phone_apps ORDER BY sort, id').all()));
admin.post('/phone-apps', (req, res) => {
  const f = appFields(req.body);
  const info = db.prepare('INSERT INTO phone_apps (name, url, icon_url, emoji, color, badge, sort, active, created_at) VALUES (@name, @url, @icon_url, @emoji, @color, @badge, @sort, @active, @t)').run({ ...f, t: now() });
  audit(req.user.id, 'phone_app.create', 'phone_app', info.lastInsertRowid, f);
  res.status(201).json({ id: info.lastInsertRowid });
});
admin.put('/phone-apps/:id', (req, res) => {
  const f = appFields(req.body);
  db.prepare('UPDATE phone_apps SET name=@name, url=@url, icon_url=@icon_url, emoji=@emoji, color=@color, badge=@badge, sort=@sort, active=@active WHERE id=@id').run({ ...f, id: int(req.params.id) });
  audit(req.user.id, 'phone_app.update', 'phone_app', req.params.id, f);
  res.json({ ok: true });
});
admin.delete('/phone-apps/:id', (req, res) => {
  db.prepare('DELETE FROM phone_apps WHERE id = ?').run(int(req.params.id));
  audit(req.user.id, 'phone_app.delete', 'phone_app', req.params.id);
  res.json({ ok: true });
});

// -------------------------------------------------------------- audit
admin.get('/audit', (req, res) => {
  const { limit, offset, page: p } = page(req, 60);
  const total = db.prepare('SELECT COUNT(*) n FROM audit').get().n;
  const rows = db.prepare(`SELECT a.*, u.username admin FROM audit a JOIN users u ON u.id = a.admin_id ORDER BY a.id DESC LIMIT ${limit} OFFSET ${offset}`).all()
    .map((r) => ({ ...r, details: parse(r.details) }));
  res.json({ total, page: p, pageSize: limit, rows });
});
