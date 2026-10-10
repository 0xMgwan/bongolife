import express from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  GAME, HAIRSTYLES, SKIN_TONES, HAIR_COLORS, OUTFITS, TRAITS, SPAWNS, BILLBOARDS, AD_MAX_DAYS,
  billboardById, outfitById, ADS_PER_BOARD, adPriceTzs, adTzsPerDay, CRIME, plotById, togetherById, REFERRAL, ELECTION, EVENT_LIMITS, EVENT_PLACES, placeById,
} from '../../../shared/world.js';
import { db, getUser, getUserByUsername, createUser, saveFields, addMoney, GameError, now, UPLOAD_DIR, getSettings } from '../db.js';
import { hashPassword, checkPassword, signToken, requireAuth, requireAdmin, rateLimit, USERNAME_RE, normalizePhone } from '../auth.js';
import { admin } from './admin.js';
import { canVisit } from '../social.js';
import { sendMail, welcomeEmail, resetEmail, checkUnsubToken } from '../mail.js';
import * as election from '../election.js';
import * as crime from '../crime.js';
import * as casino from '../casino.js';
import * as game from '../game.js';
import * as yard from '../yard.js';
import { online, onlineCount, broadcast, emitTo } from '../presence.js';
import { provider, providers, TOPUP_RATE } from '../payments/index.js';
import * as story from '../story.js';
import * as invest from '../invest.js';
import * as company from '../company.js';
import * as chat from '../chat.js';
import * as love from '../love.js';
import * as music from '../music.js';
import * as venue from '../venue.js';
import * as court from '../court.js';

export const api = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const adminNames = new Set((process.env.ADMIN_USERNAMES || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean));

// ------------------------------------------------------------ public
api.get('/public/stats', (req, res) => {
  // Read-only and non-personal, so any site (e.g. the marketing landing page) may read it.
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Cache-Control', 'public, max-age=15');
  const vid = str(req.query.v, 40);
  if (/^[a-z0-9-]{8,40}$/i.test(vid)) db.prepare('INSERT OR IGNORE INTO visitors (id, first_seen) VALUES (?, ?)').run(vid, now());
  const lb = game.leaderboard();
  res.json({
    online: onlineCount(),
    visits: db.prepare('SELECT COUNT(*) n FROM visitors').get().n,
    players: db.prepare('SELECT COUNT(*) n FROM users').get().n,
    plotsSold: db.prepare('SELECT COUNT(*) n FROM plots').get().n,
    homes: db.prepare('SELECT COUNT(*) n FROM plots WHERE building IS NOT NULL').get().n,
    mayor: (() => { const m = election.currentMayor() || lb.rich[0]; return m ? { username: m.username, name: m.name } : null; })(),
    event: game.liveEvent(),
    maintenance: getSettings().maintenance,
    announcement: publicAnnouncement(),
    faces: lb.rich.slice(0, 4).map((r) => r.appearance).filter(Boolean),
  });
});

api.get('/world', (_req, res) => res.json({ ...game.worldState(), ads: liveAds(), announcement: publicAnnouncement() }));

export function publicAnnouncement() {
  const st = getSettings();
  return st.announcement ? { text: st.announcement, textEn: st.announcementEn || st.announcement } : null;
}

// -------------------------------------------------------------- auth
api.post('/auth/signup', rateLimit('signup', 8, 15 * 60_000), wrap(async (req, res) => {
  if (!getSettings().signupsEnabled || getSettings().maintenance)
    throw new GameError(['Usajili umefungwa kwa muda. Jaribu baadaye.', 'Sign-ups are temporarily closed. Try again later.'], 503, 'signups_closed');
  const name = str(req.body.name, 40);
  const username = str(req.body.username, 30).replace(/^@/, '');
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const email = str(req.body.email, 120).toLowerCase();
  if (name.length < 2) throw new GameError(['Andika jina lako (angalau herufi 2).', 'Enter your name (at least 2 characters).']);
  if (!USERNAME_RE.test(username)) throw new GameError(['Username: herufi 3–20, namba au _ tu.', 'Username: 3–20 letters, numbers or _ only.']);
  if (password.length < 6 || password.length > 200) throw new GameError(['Password iwe na herufi angalau 6.', 'Password must be at least 6 characters.']);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new GameError(['Email si sahihi.', 'Invalid email.']);
  if (req.body.agree !== true) throw new GameError(['Lazima uthibitishe una miaka 18+ na ukubali Masharti.', 'You must confirm you are 18+ and accept the Terms.']);
  if (getUserByUsername(username)) throw new GameError(['Username hiyo imeshachukuliwa. Jaribu nyingine.', 'That username is taken. Try another.'], 409);
  const passwordHash = await hashPassword(password);
  const refName = str(req.body.ref, 30).replace(/^@/, '');
  const referrer = refName && refName.toLowerCase() !== username.toLowerCase() ? getUserByUsername(refName) : null;
  const user = db.transaction(() => {
    const u = createUser({ username, name, passwordHash, email, isAdmin: adminNames.has(username.toLowerCase()) });
    if (referrer && !referrer.bannedAt) {
      db.prepare('UPDATE users SET referred_by = ? WHERE id = ?').run(referrer.id, u.id);
      addMoney(u.id, REFERRAL.newPlayer, 'bonus', `Zawadi ya kukaribishwa na @${referrer.username}`);
    }
    return u;
  })();
  if (referrer) emitTo(referrer.id, 'toast', { text: [`🎉 @${username} amejiunga kupitia link yako! Utapata ${REFERRAL.referrer.toLocaleString()} akimaliza shifti ya kwanza.`, `🎉 @${username} joined with your link! You get TSh ${REFERRAL.referrer.toLocaleString()} when they finish their first shift.`] });
  game.ensureStarterCar(user.id);
  // Welcome email (doesn't hold up sign-up).
  if (user.email) sendMail({ kind: 'welcome', to: user.email, ...welcomeEmail({ name: user.name, username: user.username, startMoney: getUser(user.id).money }) }).catch(() => {});
  res.status(201).json({ token: signToken(user), me: game.playerState(user.id) });
}));

api.post('/auth/login', rateLimit('login', 20, 15 * 60_000), wrap(async (req, res) => {
  const username = str(req.body.username, 30).replace(/^@/, '');
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const row = db.prepare('SELECT id, username, password_hash, banned_at, ban_reason, token_version, is_admin FROM users WHERE username = ?').get(username);
  if (!row || !(await checkPassword(password, row.password_hash))) throw new GameError(['Username au password si sahihi.', 'Wrong username or password.'], 401);
  if (row.banned_at)
    throw new GameError([`Akaunti hii imefungiwa${row.ban_reason ? ': ' + row.ban_reason : '.'}`, `This account is banned${row.ban_reason ? ': ' + row.ban_reason : '.'}`], 403, 'banned');
  if (!row.is_admin && adminNames.has(row.username.toLowerCase())) db.prepare('UPDATE users SET is_admin = 1 WHERE id = ?').run(row.id);
  saveFields(row.id, { lastSeen: now() });
  game.ensureStarterCar(row.id);
  res.json({ token: signToken({ id: row.id, tokenVersion: row.token_version }), me: game.playerState(row.id) });
}));

// Forgot password: email a 6-digit code (valid 15 min, 5 tries). Always answers the same
// way so it can't be used to discover which usernames/emails exist.
const RESET_TTL = 15 * 60_000;
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
api.post('/auth/forgot', rateLimit('forgot', 6, 15 * 60_000), wrap(async (req, res) => {
  const id = str(req.body.username, 120).replace(/^@/, '');
  const row = id && db.prepare('SELECT id, username, name, email FROM users WHERE (username = ? OR lower(email) = lower(?)) AND banned_at IS NULL').get(id, id);
  if (row?.email) {
    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
    db.prepare('INSERT OR REPLACE INTO password_resets (user_id, code_hash, expires_at, attempts) VALUES (?, ?, ?, 0)').run(row.id, sha(`${row.id}:${code}`), now() + RESET_TTL);
    await sendMail({ kind: 'reset', to: row.email, ...resetEmail({ name: row.name, username: row.username, code }) }).catch(() => {});
  }
  res.json({ ok: true });
}));
api.post('/auth/reset', rateLimit('reset', 15, 15 * 60_000), wrap(async (req, res) => {
  const id = str(req.body.username, 120).replace(/^@/, '');
  const code = str(req.body.code, 10).replace(/\D/g, '');
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (password.length < 6 || password.length > 200) throw new GameError(['Password iwe na herufi angalau 6.', 'Password must be at least 6 characters.']);
  const row = id && db.prepare('SELECT id FROM users WHERE (username = ? OR lower(email) = lower(?)) AND banned_at IS NULL').get(id, id);
  const pr = row && db.prepare('SELECT * FROM password_resets WHERE user_id = ?').get(row.id);
  const bad = () => new GameError(['Code si sahihi au imeisha muda. Omba nyingine.', 'Wrong or expired code. Request a new one.'], 400, 'bad_code');
  if (!pr || pr.expires_at < now() || pr.attempts >= 5) throw bad();
  if (pr.code_hash !== sha(`${row.id}:${code}`)) {
    db.prepare('UPDATE password_resets SET attempts = attempts + 1 WHERE user_id = ?').run(row.id);
    throw bad();
  }
  const hash = await hashPassword(password);
  db.prepare('UPDATE users SET password_hash = ?, token_version = token_version + 1 WHERE id = ?').run(hash, row.id);
  db.prepare('DELETE FROM password_resets WHERE user_id = ?').run(row.id);
  const tv = db.prepare('SELECT token_version FROM users WHERE id = ?').get(row.id).token_version;
  res.json({ token: signToken({ id: row.id, tokenVersion: tv }), me: game.playerState(row.id) });
}));

// One-click unsubscribe from update emails (link in every update email; also accepts the RFC 8058 POST).
const unsubscribe = (req, res) => {
  const id = Math.trunc(Number(req.query.u));
  const ok = Number.isFinite(id) && checkUnsubToken(id, req.query.t);
  if (ok) db.prepare('UPDATE users SET email_updates = 0 WHERE id = ?').run(id);
  if (req.method === 'POST') return res.status(ok ? 200 : 400).end();
  res.status(ok ? 200 : 400).type('html').send(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bongo Life</title>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#f6f1e6;font-family:system-ui,sans-serif;color:#141414;text-align:center;padding:24px">
<div style="background:#fffdf8;border:2.5px solid #141414;border-radius:22px;box-shadow:5px 5px 0 #141414;padding:28px;max-width:420px">
<div style="font-size:44px">${ok ? '✉️' : '⚠️'}</div>
<h1 style="font-size:24px;margin:8px 0">${ok ? 'Umejiondoa · Unsubscribed' : 'Link si sahihi · Invalid link'}</h1>
<p style="color:#555;line-height:1.5">${ok ? 'Hutapokea tena habari mpya kwa email. Unaweza kuwasha tena kwenye Simu → Mipangilio.<br>You won\'t get update emails any more. Turn them back on in Phone → Settings.' : 'Fungua Simu → Mipangilio kubadilisha email zako.<br>Open Phone → Settings to change your email preferences.'}</p>
<a href="https://play.bongolife.app" style="display:inline-block;margin-top:8px;background:#f5b800;color:#141414;font-weight:800;text-decoration:none;padding:12px 20px;border-radius:999px;border:2px solid #141414">Bongo Life →</a></div></body>`);
};
api.get('/unsubscribe', unsubscribe);
api.post('/unsubscribe', unsubscribe);

// ------------------------------------------------------------- me
api.use(requireAuth);

// Change password (signs out other devices) and recovery email.
api.post('/me/password', rateLimit('chpw', 10, 15 * 60_000), wrap(async (req, res) => {
  const current = typeof req.body.current === 'string' ? req.body.current : '';
  const next = typeof req.body.password === 'string' ? req.body.password : '';
  const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
  if (!(await checkPassword(current, row.password_hash))) throw new GameError(['Password ya sasa si sahihi.', 'Your current password is wrong.'], 400, 'bad_password');
  if (next.length < 6 || next.length > 200) throw new GameError(['Password mpya iwe na herufi angalau 6.', 'New password must be at least 6 characters.']);
  db.prepare('UPDATE users SET password_hash = ?, token_version = token_version + 1 WHERE id = ?').run(await hashPassword(next), req.user.id);
  const tv = db.prepare('SELECT token_version FROM users WHERE id = ?').get(req.user.id).token_version;
  res.json({ ok: true, token: signToken({ id: req.user.id, tokenVersion: tv }) });
}));
api.post('/me/email', (req, res) => {
  const email = str(req.body.email, 120).toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new GameError(['Email si sahihi.', 'Invalid email.']);
  db.prepare('UPDATE users SET email = ? WHERE id = ?').run(email || null, req.user.id);
  res.json({ ok: true, me: game.playerState(req.user.id) });
});
api.post('/me/email-updates', (req, res) => {
  db.prepare('UPDATE users SET email_updates = ? WHERE id = ?').run(req.body.on ? 1 : 0, req.user.id);
  res.json({ ok: true, me: game.playerState(req.user.id) });
});
// Display name (the @username stays fixed). Once a day, so people can't impersonate on the fly.
api.post('/me/name', rateLimit('rename', 5, 60 * 60_000), (req, res) => {
  const name = str(req.body.name, 40).replace(/\s+/g, ' ');
  if (name.length < 2) throw new GameError(['Jina liwe na herufi angalau 2.', 'Name must be at least 2 characters.']);
  if (/[<>]|https?:|www\./i.test(name)) throw new GameError(['Jina lisiwe na link wala alama < >.', 'No links or < > in names.']);
  const u = getUser(req.user.id);
  if (name === u.name) return res.json({ ok: true, me: game.playerState(u.id) });
  const wait = (u.nameChangedAt || 0) + 24 * 3600_000 - now();
  if (wait > 0 && !u.isAdmin) throw new GameError([`Unaweza kubadilisha jina tena baada ya saa ${Math.ceil(wait / 3600_000)}.`, `You can change your name again in ${Math.ceil(wait / 3600_000)}h.`], 429);
  db.prepare('UPDATE users SET name = ?, name_changed_at = ? WHERE id = ?').run(name, now(), u.id);
  const o = online.get(u.id);
  if (o) { o.name = name; broadcast('player:look', { id: u.id, name }); }
  res.json({ ok: true, me: game.playerState(u.id) });
});

// Maintenance mode locks the game for everyone except admins.
api.use((req, _res, next) => {
  if (getSettings().maintenance && !req.user.isAdmin && req.path !== '/me')
    return next(new GameError(['Bongo Life iko kwenye matengenezo. Rudi baadaye kidogo 🔧', 'Bongo Life is under maintenance. Back shortly 🔧'], 503, 'maintenance'));
  next();
});

api.use('/admin', requireAdmin, admin);

api.get('/me', (req, res) => {
  game.ensureStarterCar(req.user.id);
  res.json(game.playerState(req.user.id));
});

api.post('/me/profile', (req, res) => {
  const a = req.body.appearance || {};
  const body = a.body === 'man' ? 'man' : 'woman';
  const appearance = {
    body,
    skin: Math.max(0, Math.min(SKIN_TONES.length - 1, a.skin | 0)),
    hairColor: Math.max(0, Math.min(HAIR_COLORS.length - 1, a.hairColor | 0)),
    hair: HAIRSTYLES.some((h) => h.id === a.hair) ? a.hair : 'kiduku',
    outfit: outfitById[a.outfit] ? a.outfit : 'tshirt',
  };
  const u = req.user;
  const outfit = outfitById[appearance.outfit];
  if (outfit.price > 0 && !u.outfits.includes(outfit.id)) throw new GameError(['Hujanunua nguo hii bado.', 'You haven\'t bought this outfit yet.']);
  const fields = { appearance };
  if (!u.onboarded) {
    fields.onboarded = 1;
    fields.trait = TRAITS.some((t) => t.id === req.body.trait) ? req.body.trait : 'mchakarikaji';
    const spawn = SPAWNS[req.body.spawn] || SPAWNS.manzese;
    fields.x = spawn.pos[0];
    fields.z = spawn.pos[1];
  }
  saveFields(u.id, fields);
  const p = online.get(u.id);
  if (p) {
    p.appearance = appearance;
    broadcast('player:look', { id: u.id, appearance });
  }
  res.json(game.playerState(u.id));
});

// --------------------------------------------------------- actions
api.post('/act/start', (req, res) => {
  const busy = game.startAction(req.user.id, { kind: req.body.kind, placeId: req.body.placeId, id: req.body.id });
  res.json({ busy, me: game.playerState(req.user.id) });
});
api.post('/act/finish', (req, res) => {
  const result = game.finishAction(req.user.id, { early: req.body?.early === true });
  if (result.referrer) {
    emitTo(result.referrer, 'toast', { text: [`💰 @${req.user.username} amemaliza shifti yake ya kwanza — umepata TSh ${REFERRAL.referrer.toLocaleString()}!`, `💰 @${req.user.username} finished their first shift — you earned TSh ${REFERRAL.referrer.toLocaleString()}!`], refresh: true });
    delete result.referrer;
  }
  if (result.teleport) emitTo(req.user.id, 'teleport', { pos: result.teleport });
  res.json({ result, me: game.playerState(req.user.id) });
});
api.post('/act/task', (req, res) => {
  const r = game.workTask(req.user.id, str(req.body.task, 20));
  res.json({ ...r, me: game.playerState(req.user.id) });
});
api.post('/act/cancel', (req, res) => {
  game.cancelAction(req.user.id);
  res.json({ me: game.playerState(req.user.id) });
});
// ---- Kwangu (player apartment)
api.get('/home', (req, res) => res.json({ items: game.homeItems(req.user.id) }));
// Visit someone else's home (invite or RSVP to their house party required).
api.get('/visit/:username', (req, res) => {
  const host = getUserByUsername(req.params.username);
  if (!host) throw new GameError(['Mtumiaji hayupo', 'User not found'], 404);
  if (!canVisit(req.user.id, host.id)) throw new GameError(['Hujaalikwa nyumbani kwa mtu huyu.', "You haven't been invited to this home."], 403, 'not_invited');
  const vehicles = db.prepare('SELECT id, model, color FROM vehicles WHERE user_id = ?').all(host.id);
  res.json({ host: { id: host.id, username: host.username, name: host.name, appearance: host.appearance, vehicles }, items: game.homeItems(host.id) });
});
// ---- build mode: your yard of blocks
const intOf = (v) => (Number.isInteger(v) ? v : Number.parseInt(v, 10));
const blockAt = (b) => ({ x: intOf(b.x), y: intOf(b.y), z: intOf(b.z) });
api.get('/yard', (req, res) => res.json(yard.yardOf(req.user.id)));
api.get('/yard/:username', (req, res) => {
  const host = getUserByUsername(req.params.username);
  if (!host) throw new GameError(['Mtumiaji hayupo', 'User not found'], 404);
  if (host.id !== req.user.id && !canVisit(req.user.id, host.id)) throw new GameError(['Hujaalikwa kwa mtu huyu.', "You haven't been invited."], 403, 'not_invited');
  res.json(yard.yardOf(host.id));
});
api.post('/yard/blocks', rateLimit('yard', 240, 60_000), (req, res) => {
  yard.placeBlock(req.user.id, { ...blockAt(req.body), kind: str(req.body.kind, 16) });
  res.json({ ...yard.yardOf(req.user.id), me: game.playerState(req.user.id) });
});
api.delete('/yard/blocks', rateLimit('yard', 240, 60_000), (req, res) => {
  const r = yard.removeBlock(req.user.id, blockAt(req.body));
  res.json({ ...yard.yardOf(req.user.id), refund: r.refund, me: game.playerState(req.user.id) });
});


api.post('/home/items', (req, res) => {
  game.buyFurniture(req.user.id, { item: str(req.body.item, 30), x: req.body.x, z: req.body.z, rot: req.body.rot });
  res.json({ items: game.homeItems(req.user.id), me: game.playerState(req.user.id) });
});
api.patch('/home/items/:id', (req, res) => {
  game.moveFurniture(req.user.id, Number(req.params.id), { x: req.body.x, z: req.body.z, rot: req.body.rot });
  res.json({ items: game.homeItems(req.user.id) });
});
api.delete('/home/items/:id', (req, res) => {
  const refund = game.sellFurniture(req.user.id, Number(req.params.id));
  res.json({ refund, items: game.homeItems(req.user.id), me: game.playerState(req.user.id) });
});
api.post('/home/items/:id/use', (req, res) => {
  const busy = game.startAction(req.user.id, { kind: 'home', id: req.params.id });
  res.json({ busy, me: game.playerState(req.user.id) });
});

api.post('/home/:plotId/:act', (req, res) => {
  game.homeActivity(req.user.id, req.params.plotId, req.params.act);
  res.json({ me: game.playerState(req.user.id) });
});

api.post('/travel', (req, res) => {
  const r = game.travel(req.user.id, str(req.body.placeId, 40), str(req.body.mode, 20));
  res.json({ ...r, me: game.playerState(req.user.id) });
});

// ----------------------------------------------------------- shops
api.post('/shop/vehicle', (req, res) => {
  game.buyVehicle(req.user.id, str(req.body.model, 20), str(req.body.color, 10));
  const me = game.playerState(req.user.id);
  game.useVehicle(req.user.id, me.activeVehicle);
  res.json({ me });
});
api.post('/vehicle/use', (req, res) => {
  game.useVehicle(req.user.id, req.body.vehicleId ? Number(req.body.vehicleId) : null);
  res.json({ me: game.playerState(req.user.id) });
});
api.post('/shop/outfit', (req, res) => {
  game.buyOutfit(req.user.id, str(req.body.outfitId, 30));
  res.json({ me: game.playerState(req.user.id) });
});

// -------------------------------------------------------- property
const worldChanged = () => broadcast('world', game.worldState());
api.post('/plots/:id/buy', (req, res) => {
  game.buyPlot(req.user.id, req.params.id);
  worldChanged();
  res.json({ me: game.playerState(req.user.id) });
});
api.post('/plots/:id/build', (req, res) => {
  game.buildOnPlot(req.user.id, req.params.id, str(req.body.building, 20));
  worldChanged();
  res.json({ me: game.playerState(req.user.id) });
});
api.post('/business/:id/buy', (req, res) => {
  game.buyBusiness(req.user.id, req.params.id);
  worldChanged();
  res.json({ me: game.playerState(req.user.id) });
});
api.post('/income/collect', (req, res) => {
  const amount = game.collectIncome(req.user.id);
  res.json({ amount, me: game.playerState(req.user.id) });
});

// ---------------------------------------------------------- wallet
api.get('/wallet', (req, res) => {
  res.json({
    balance: getUser(req.user.id).money,
    transactions: db.prepare('SELECT id, amount, balance_after, kind, memo, created_at FROM transactions WHERE user_id = ? ORDER BY id DESC LIMIT 60').all(req.user.id),
    topups: db.prepare("SELECT id, provider, method, amount_tzs, coins, status, instructions, created_at FROM topups WHERE user_id = ? AND purpose = 'topup' ORDER BY id DESC LIMIT 10").all(req.user.id)
      .map((t) => ({ ...t, instructions: t.instructions ? JSON.parse(t.instructions) : null })),
    topup: provider
      ? { provider: provider.id, label: provider.label, livemode: provider.livemode, methods: provider.methods, rate: TOPUP_RATE, min: GAME.minTopupTzs, max: GAME.maxTopupTzs, presets: [1_000, 2_000, 5_000, 10_000, 20_000, 50_000] }
      : null,
  });
});

api.post('/wallet/topup', rateLimit('topup', 10, 10 * 60_000), wrap(async (req, res) => {
  if (!getSettings().topupsEnabled) throw new GameError(['Kuongeza salio kumesimamishwa kwa muda.', 'Top-ups are temporarily paused.'], 503);
  if (!provider) throw new GameError(['Malipo hayajawashwa kwenye server hii bado.', 'Payments are not enabled on this server yet.'], 503);
  const amountTzs = Math.floor(Number(req.body.amountTzs));
  if (!(amountTzs >= GAME.minTopupTzs && amountTzs <= GAME.maxTopupTzs))
    throw new GameError([`Kiasi kiwe kati ya TZS ${GAME.minTopupTzs.toLocaleString()} na ${GAME.maxTopupTzs.toLocaleString()}.`, `Amount must be between TZS ${GAME.minTopupTzs.toLocaleString()} and ${GAME.maxTopupTzs.toLocaleString()}.`]);
  const method = provider.methods.includes(req.body.method) ? req.body.method : provider.methods[0];
  const phone = normalizePhone(req.body.phone);
  if (!phone) throw new GameError(['Namba ya simu si sahihi (mfano 0712 345 678).', 'Invalid phone number (e.g. 0712 345 678).']);
  const pending = db.prepare("SELECT COUNT(*) n FROM topups WHERE user_id = ? AND status = 'pending' AND purpose = 'topup'").get(req.user.id).n;
  if (pending >= 3) throw new GameError(['Una malipo 3 yanayosubiri. Yamalize kwanza.', 'You have 3 pending payments. Finish them first.']);
  let created;
  try {
    created = await provider.create({ amountTzs, phone, method, user: req.user });
  } catch (e) {
    throw new GameError(e.userMessage || ['Imeshindikana kuanzisha malipo. Jaribu tena.', 'Could not start the payment. Please try again.'], e.status || 502, e.code);
  }
  const coins = amountTzs * TOPUP_RATE;
  const info = db.prepare(
    'INSERT INTO topups (user_id, provider, provider_ref, method, phone, amount_tzs, coins, status, instructions, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ).run(req.user.id, provider.id, created.ref, method, phone, amountTzs, coins, 'pending', created.instructions ? JSON.stringify(created.instructions) : null, now());
  if (!req.user.phone) saveFields(req.user.id, { phone });
  res.status(201).json({ id: info.lastInsertRowid, status: 'pending', coins, instructions: created.instructions });
}));

// `expired` is our own 72h timeout, not the provider's verdict, so a deposit can still be paid
// after it. Admin re-checks pass { recheckExpired: true } to look again.
export async function settleTopup(t, { recheckExpired = false } = {}) {
  const prov = providers[t.provider];
  if (!prov || !(t.status === 'pending' || (recheckExpired && t.status === 'expired'))) return t.status;
  let status;
  try {
    status = await prov.check(t.provider_ref);
  } catch (e) {
    console.warn('[topup] check failed', t.id, e.message);
    return 'pending';
  }
  if (status === 'pending' && now() - t.created_at > 72 * 3600_000) status = 'expired';
  if (status === 'expired' && t.status === 'expired') return t.status;
  return applyTopupStatus(t, status);
}

/**
 * Move a pending top-up to its final state; credits the player exactly once.
 * A `paid` result also lifts an `expired` top-up: the player paid after our timeout and must still be credited.
 */
export function applyTopupStatus(t, status) {
  if (status === 'pending') return status;
  const from = status === 'paid' ? "status IN ('pending', 'expired')" : "status = 'pending'";
  if (t.purpose === 'ad') {
    let ad = null;
    db.transaction(() => {
      const r = db.prepare(`UPDATE topups SET status = ?, credited_at = ? WHERE id = ? AND ${from}`).run(status, status === 'paid' ? now() : null, t.id);
      if (!r.changes) return;
      if (status === 'paid') ad = activateAd(t.ref_id);
      else db.prepare("UPDATE ads SET status = 'payment_failed' WHERE id = ? AND status = 'awaiting_payment'").run(t.ref_id);
    })();
    if (ad) {
      broadcast('ads', liveAds());
      emitTo(t.user_id, 'toast', { text: [`📢 Malipo yamepokelewa — "${ad.title}" iko hewani!`, `📢 Payment received — "${ad.title}" is live!`], refresh: true });
    }
    return status;
  }
  const credited = db.transaction(() => {
    // Compare-and-set so a topup is only ever credited once.
    const r = db.prepare(`UPDATE topups SET status = ?, credited_at = ? WHERE id = ? AND ${from}`).run(status, status === 'paid' ? now() : null, t.id);
    if (r.changes && status === 'paid') {
      addMoney(t.user_id, t.coins, 'topup', `Umeongeza salio: TZS ${t.amount_tzs.toLocaleString()} → TSh ${t.coins.toLocaleString()}`);
      return true;
    }
    return false;
  })();
  if (credited) emitTo(t.user_id, 'toast', { text: [`✅ Salio limeingia: TSh ${t.coins.toLocaleString()}`, `✅ Top-up received: TSh ${t.coins.toLocaleString()}`], refresh: true });
  return status;
}

api.get('/wallet/topup/:id', wrap(async (req, res) => {
  const t = db.prepare('SELECT * FROM topups WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!t) throw new GameError(['Malipo hayapo', 'Payment not found'], 404);
  const status = await settleTopup(t);
  res.json({ id: t.id, status, me: game.playerState(req.user.id) });
}));

api.post('/wallet/send', (req, res) => {
  const to = game.sendMoney(req.user.id, str(req.body.to, 30).replace(/^@/, ''), req.body.amount, str(req.body.note, 80));
  res.json({ to: to.username, me: game.playerState(req.user.id) });
});

// --------------------------------------------------------- messages
const userBrief = db.prepare('SELECT id, username, name, appearance FROM users WHERE id = ?');
api.get('/messages/public', (_req, res) => {
  const rows = db.prepare(
    'SELECT m.id, m.body, m.created_at, u.username, u.name FROM messages m JOIN users u ON u.id = m.from_id WHERE m.to_id IS NULL AND m.group_id IS NULL AND m.deleted_at IS NULL ORDER BY m.id DESC LIMIT 60',
  ).all();
  res.json(rows.reverse());
});
api.get('/messages/threads', (req, res) => {
  const me = req.user.id;
  const rows = db.prepare(`
    SELECT CASE WHEN from_id = @me THEN to_id ELSE from_id END AS other, MAX(id) AS last_id,
           SUM(CASE WHEN to_id = @me AND read_at IS NULL THEN 1 ELSE 0 END) AS unread
    FROM messages WHERE to_id IS NOT NULL AND group_id IS NULL AND (from_id = @me OR to_id = @me)
    GROUP BY other ORDER BY last_id DESC LIMIT 50`).all({ me });
  const getMsg = db.prepare('SELECT body, created_at, from_id, kind, deleted_at FROM messages WHERE id = ?');
  res.json(rows.map((r) => {
    const u = userBrief.get(r.other);
    const m = getMsg.get(r.last_id);
    return { user: { ...u, appearance: JSON.parse(u.appearance || 'null'), online: online.has(u.id) }, last: chat.messagePreview(m), mine: m.from_id === me, at: m.created_at, unread: r.unread };
  }));
});
api.get('/messages/dm/:username', (req, res) => {
  const other = getUserByUsername(req.params.username);
  if (!other) throw new GameError(['Mtumiaji hayupo', 'User not found'], 404);
  res.json({ user: { id: other.id, username: other.username, name: other.name, appearance: other.appearance, online: online.has(other.id) }, messages: chat.dmHistory(req.user.id, other.id) });
});
// Voice notes, reactions, edit/delete for everyone, forwarding, groups.
const voiceUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 1_600_000, files: 1 } });
api.post('/messages/voice', rateLimit('voice', 30, 60_000), voiceUpload.single('audio'), (req, res) => {
  const body = { to: req.body.to || undefined, groupId: req.body.groupId || undefined, replyTo: req.body.replyTo || undefined, duration: req.body.duration };
  res.status(201).json({ msg: chat.sendVoice(req.user.id, body, req.file) });
});
api.post('/messages/:id/react', rateLimit('react', 60, 60_000), (req, res) => res.json({ msg: chat.react(req.user.id, req.params.id, str(req.body.emoji, 8)) }));
api.post('/messages/:id/edit', (req, res) => res.json({ msg: chat.edit(req.user.id, req.params.id, req.body.text) }));
api.delete('/messages/:id', (req, res) => res.json({ msg: chat.remove(req.user.id, req.params.id) }));
api.post('/messages/:id/forward', rateLimit('fwd', 30, 60_000), (req, res) => res.json({ msg: chat.forward(req.user.id, req.params.id, { to: req.body.to || undefined, groupId: req.body.groupId || undefined }) }));
api.get('/groups', (req, res) => res.json(chat.myGroups(req.user.id)));
api.post('/groups', rateLimit('groups', 10, 60 * 60_000), (req, res) => {
  const id = chat.createGroup(req.user.id, { name: req.body.name, emoji: req.body.emoji, members: req.body.members });
  res.status(201).json({ id, groups: chat.myGroups(req.user.id) });
});
api.get('/groups/:id', (req, res) => res.json(chat.groupView(req.user.id, req.params.id)));
api.post('/groups/:id/members', (req, res) => res.json({ added: chat.addMembers(req.user.id, req.params.id, req.body.members) }));
api.post('/groups/:id/leave', (req, res) => { chat.leaveGroup(req.user.id, req.params.id); res.json({ groups: chat.myGroups(req.user.id) }); });

// ---------------------------------------------------------- phone
api.get('/phone/apps', (_req, res) => {
  res.json(db.prepare('SELECT id, name, url, icon_url, emoji, color, badge FROM phone_apps WHERE active = 1 ORDER BY sort, id').all());
});
api.post('/phone/apps/:id/open', (req, res) => {
  db.prepare('UPDATE phone_apps SET opens = opens + 1 WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

// -------------------------------------------------------- contacts
// Contacts are one-way; when both sides added each other they are friends (mutual).
const contactList = (userId) =>
  db.prepare(`SELECT u.id, u.username, u.name, u.appearance, u.fame,
      EXISTS (SELECT 1 FROM contacts b WHERE b.user_id = u.id AND b.contact_id = c.user_id) AS mutual
    FROM contacts c JOIN users u ON u.id = c.contact_id
    WHERE c.user_id = ? AND u.banned_at IS NULL ORDER BY mutual DESC, u.username COLLATE NOCASE`).all(userId)
    .map((u) => ({ ...u, mutual: !!u.mutual, appearance: JSON.parse(u.appearance || 'null'), online: online.has(u.id), inside: online.get(u.id)?.inside || null }));
api.get('/contacts/requests', (req, res) => {
  res.json(db.prepare(`SELECT u.id, u.username, u.name, u.appearance FROM contacts c JOIN users u ON u.id = c.user_id
    WHERE c.contact_id = ? AND u.banned_at IS NULL AND NOT EXISTS (SELECT 1 FROM contacts b WHERE b.user_id = c.contact_id AND b.contact_id = c.user_id)
    ORDER BY c.created_at DESC LIMIT 50`).all(req.user.id).map((u) => ({ ...u, appearance: JSON.parse(u.appearance || 'null'), online: online.has(u.id) })));
});
api.get('/contacts', (req, res) => res.json(contactList(req.user.id)));
api.post('/contacts', (req, res) => {
  const other = getUserByUsername(str(req.body.username, 30).replace(/^@/, ''));
  if (!other || other.bannedAt) throw new GameError(['Hakuna mtu mwenye username hiyo.', 'No one has that username.'], 404);
  if (other.id === req.user.id) throw new GameError(['Huwezi kujiongeza mwenyewe 😅', "You can't add yourself 😅"]);
  const n = db.prepare('SELECT COUNT(*) n FROM contacts WHERE user_id = ?').get(req.user.id).n;
  if (n >= 300) throw new GameError(['Anwani zimejaa.', 'Your contact list is full.']);
  db.prepare('INSERT OR IGNORE INTO contacts (user_id, contact_id, created_at) VALUES (?, ?, ?)').run(req.user.id, other.id, now());
  emitTo(other.id, 'toast', { text: [`📇 @${req.user.username} amekuongeza kwenye anwani`, `📇 @${req.user.username} added you as a contact`] });
  res.status(201).json(contactList(req.user.id));
});
api.delete('/contacts/:username', (req, res) => {
  const other = getUserByUsername(req.params.username);
  if (other) db.prepare('DELETE FROM contacts WHERE user_id = ? AND contact_id = ?').run(req.user.id, other.id);
  res.json(contactList(req.user.id));
});

// ---------------------------------------------------------- trips & casino
api.post('/trip', (req, res) => {
  const r = game.startTrip(req.user.id, str(req.body.placeId, 30), str(req.body.mode, 10), req.body.insured === true);
  res.json({ ...r, me: game.playerState(req.user.id) });
});
const casinoRoute = (fn) => (req, res) => res.json({ ...fn(req), me: game.playerState(req.user.id) });
api.post('/casino/slots', casinoRoute((req) => casino.slots(req.user.id, req.body.bet)));
api.post('/casino/roulette', casinoRoute((req) => casino.roulette(req.user.id, req.body.bet, typeof req.body.pick === 'number' ? Math.floor(req.body.pick) : str(req.body.pick, 6))));
api.post('/casino/blackjack/deal', casinoRoute((req) => casino.bjDeal(req.user.id, req.body.bet)));
api.post('/casino/blackjack/hit', casinoRoute((req) => casino.bjHit(req.user.id)));
api.post('/casino/blackjack/stand', casinoRoute((req) => casino.bjStand(req.user.id)));
api.post('/casino/blackjack/double', casinoRoute((req) => casino.bjDouble(req.user.id)));

// ---------------------------------------------------------- street life
const targetOf = (req) => {
  const t = getUserByUsername(str(req.params.username, 30).replace(/^@/, ''));
  if (!t || t.id === req.user.id) throw new GameError(['Mtu huyo hayupo.', 'No such player.'], 404);
  return t;
};
api.post('/players/:username/interact', (req, res) => {
  const r = crime.interact(req.user.id, targetOf(req), str(req.body.kind, 12));
  res.json({ ...r, me: game.playerState(req.user.id) });
});
api.post('/players/:username/rob', (req, res) => {
  const r = crime.rob(req.user.id, targetOf(req));
  res.json({ ...r, me: game.playerState(req.user.id) });
});
const reportedAt = new Map();
api.post('/players/:username/report-police', (req, res) => {
  const t = targetOf(req);
  if (t.id === req.user.id) throw new GameError(['😅', '😅']);
  const r = crime.reportToPolice(req.user.id, t);
  // A general report (no matching robbery) still goes on their file — one per reporter per day.
  if (!r.found) {
    const key = `rep:${req.user.id}:${t.id}`;
    if (now() - (reportedAt.get(key) || 0) > 86_400_000) {
      reportedAt.set(key, now());
      story.bumpStats(t.id, ['police_reports']);
    }
  }
  res.json({ ...r, me: game.playerState(req.user.id) });
});
api.post('/players/:username/block', (req, res) => {
  const blocked = crime.toggleBlock(req.user.id, targetOf(req).id);
  res.json({ blocked, me: game.playerState(req.user.id) });
});
api.post('/players/:username/report', (req, res) => {
  const reason = str(req.body.reason, 20);
  if (!['harass', 'sexual', 'hate', 'scam', 'spam', 'other'].includes(reason)) throw new GameError(['Chagua sababu.', 'Pick a reason.']);
  crime.reportPlayer(req.user.id, targetOf(req).id, reason, str(req.body.note, 500));
  res.json({ ok: true, me: game.playerState(req.user.id) });
});
api.post('/jail/choose', (req, res) => {
  const r = crime.jailChoose(req.user.id, str(req.body.option, 10));
  res.json({ ...r, me: game.playerState(req.user.id) });
});
api.post('/jail/bail', (req, res) => {
  const r = crime.payBail(req.user.id);
  res.json({ ...r, me: game.playerState(req.user.id) });
});
api.post('/jail/tick', wrap(async (req, res) => {
  // A real court case: let the judge / magistrate settle it, then report the outcome.
  const j = getUser(req.user.id).jail;
  if (j?.phase === 'court' && j.caseId && now() >= j.courtAt) {
    await court.settle(j.caseId);
    const after = getUser(req.user.id).jail;
    const verdict = !after ? 'win' : after.phase === 'cell' ? 'lose' : undefined;
    return res.json({ verdict, free: !after, jail: after, me: game.playerState(req.user.id) });
  }
  const r = crime.jailTick(req.user.id);
  res.json({ ...r, me: game.playerState(req.user.id) });
}));

// ------------------------------------------------------------------------ court
api.get('/court/cases', (req, res) => res.json(court.myCases(req.user.id)));
api.get('/court/cases/:id', (req, res) => res.json(court.caseView(req.user.id, req.params.id)));
api.post('/court/cases/:id/statement', rateLimit('stmt', 30, 60_000), (req, res) => { court.addText(req.user.id, req.params.id, req.body.text); res.json(court.caseView(req.user.id, req.params.id)); });
const courtVoice = multer({ storage: multer.memoryStorage(), limits: { fileSize: 1_600_000, files: 1 } });
api.post('/court/cases/:id/voice', rateLimit('stmt', 30, 60_000), courtVoice.single('audio'), (req, res) => { court.addVoice(req.user.id, req.params.id, req.file, req.body.duration); res.json(court.caseView(req.user.id, req.params.id)); });
api.post('/court/cases/:id/judge', (req, res) => { court.proposeJudge(req.user.id, req.params.id, str(req.body.username, 30)); res.json(court.caseView(req.user.id, req.params.id)); });
api.post('/court/cases/:id/judge/answer', (req, res) => { court.answerProposal(req.user.id, req.params.id, !!req.body.accept); res.json(court.caseView(req.user.id, req.params.id)); });
api.post('/court/cases/:id/judge/invite', (req, res) => { court.answerJudgeInvite(req.user.id, req.params.id, !!req.body.accept); res.json(court.caseView(req.user.id, req.params.id)); });
api.post('/court/cases/:id/rule', (req, res) => { court.judgeRules(req.user.id, req.params.id, str(req.body.verdict, 12), req.body.reason); res.json({ ...court.caseView(req.user.id, req.params.id), me: game.playerState(req.user.id) }); });

// ---------------------------------------------------------- invites
api.get('/me/referrals', (req, res) => {
  const rows = db.prepare('SELECT username, name, appearance, referral_paid paid, created_at FROM users WHERE referred_by = ? ORDER BY created_at DESC LIMIT 100').all(req.user.id);
  res.json({
    code: req.user.username,
    rules: REFERRAL,
    joined: rows.length,
    paid: rows.filter((r) => r.paid).length,
    earned: Math.min(rows.filter((r) => r.paid).length, REFERRAL.maxPaid) * REFERRAL.referrer,
    friends: rows.map((r) => ({ ...r, paid: !!r.paid, appearance: JSON.parse(r.appearance || 'null') })),
  });
});

// ---------------------------------------------------------- mayor
api.get('/election', (req, res) => res.json(election.electionState(req.user.id)));
api.post('/election/run', (req, res) => {
  election.runForMayor(req.user.id, str(req.body.slogan, ELECTION.sloganMax));
  broadcast('toast', { text: [`🗳️ @${req.user.username} anagombea Ukuu wa Mkoa!`, `🗳️ @${req.user.username} is running for Mayor!`] });
  res.json({ ...election.electionState(req.user.id), me: game.playerState(req.user.id) });
});
api.post('/election/vote', (req, res) => {
  const c = getUserByUsername(str(req.body.username, 30));
  if (!c) throw new GameError(['Mgombea hayupo', 'Candidate not found'], 404);
  election.vote(req.user.id, c.id);
  res.json(election.electionState(req.user.id));
});
api.post('/election/message', (req, res) => {
  election.setMayorMessage(req.user.id, str(req.body.text, ELECTION.messageMax));
  broadcast('world', game.worldState());
  res.json(election.electionState(req.user.id));
});

// ---------------------------------------------------------- health
api.post('/accident', (req, res) => {
  const r = game.accident(req.user.id, { byUsername: str(req.body.by, 30) || null });
  if (r?.by) {
    const driver = getUserByUsername(r.by);
    if (driver) emitTo(driver.id, 'toast', { text: [`🚗💥 Umemgonga @${req.user.username}! Endesha kwa uangalifu.`, `🚗💥 You hit @${req.user.username}! Drive carefully.`] });
  }
  res.json({ hit: !!r, me: game.playerState(req.user.id) });
});
api.post('/ambulance', (req, res) => {
  const r = game.ambulance(req.user.id);
  res.json({ ...r, me: game.playerState(req.user.id) });
});

// ---------------------------------------------------------- events
const eventRows = (userId, where = 'e.starts_at + @after >= @t', params = {}) =>
  db.prepare(`SELECT e.*, u.username host, u.name host_name, u.appearance host_appearance,
      (SELECT COUNT(*) FROM event_rsvps r WHERE r.event_id = e.id) going,
      EXISTS (SELECT 1 FROM event_rsvps r WHERE r.event_id = e.id AND r.user_id = @me) mine
    FROM events e JOIN users u ON u.id = e.host_id
    WHERE e.cancelled = 0 AND ${where} ORDER BY e.starts_at LIMIT 60`)
    .all({ me: userId, t: now(), after: EVENT_LIMITS.windowAfterMs, ...params })
    .map((e) => ({
      ...e,
      mine: !!e.mine,
      host_appearance: JSON.parse(e.host_appearance || 'null'),
      faces: db.prepare('SELECT u.username, u.appearance FROM event_rsvps r JOIN users u ON u.id = r.user_id WHERE r.event_id = ? ORDER BY r.created_at LIMIT 6').all(e.id)
        .map((u) => ({ username: u.username, appearance: JSON.parse(u.appearance || 'null') })),
    }));
api.get('/events', (req, res) => res.json(eventRows(req.user.id)));
api.post('/events', (req, res) => {
  const title = str(req.body.title, EVENT_LIMITS.titleMax);
  const description = str(req.body.description, EVENT_LIMITS.descMax);
  const placeId = str(req.body.placeId, 20);
  const startsAt = Math.floor(Number(req.body.startsAt));
  if (title.length < 3) throw new GameError(['Andika jina la tukio.', 'Give your event a name.']);
  if (!EVENT_PLACES.includes(placeId) || (placeId !== 'home' && !placeById[placeId])) throw new GameError(['Chagua mahali.', 'Pick a place.']);
  if (!(startsAt >= now() + EVENT_LIMITS.minLeadMs - 60_000 && startsAt <= now() + EVENT_LIMITS.maxAheadMs))
    throw new GameError(['Muda uwe kuanzia dakika 5 hadi siku 7 zijazo.', 'Pick a time between 5 minutes and 7 days from now.']);
  const active = db.prepare('SELECT COUNT(*) n FROM events WHERE host_id = ? AND cancelled = 0 AND starts_at > ?').get(req.user.id, now()).n;
  if (active >= EVENT_LIMITS.maxActivePerHost) throw new GameError(['Una matukio mengi yanayokuja.', 'You already have several upcoming events.']);
  const info = db.prepare('INSERT INTO events (host_id, title, description, place_id, starts_at, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(req.user.id, title, description || null, placeId, startsAt, now());
  db.prepare('INSERT INTO event_rsvps (event_id, user_id, created_at) VALUES (?, ?, ?)').run(info.lastInsertRowid, req.user.id, now());
  story.bumpStats(req.user.id, ['hosted']);
  broadcast('toast', { text: [`🎉 Tukio jipya: "${title}" na @${req.user.username}`, `🎉 New event: "${title}" by @${req.user.username}`] });
  broadcast('events:changed', {});
  res.status(201).json(eventRows(req.user.id));
});
api.post('/events/:id/rsvp', (req, res) => {
  const e = db.prepare('SELECT * FROM events WHERE id = ? AND cancelled = 0').get(Number(req.params.id));
  if (!e) throw new GameError(['Tukio halipo.', 'Event not found.'], 404);
  const has = db.prepare('SELECT 1 FROM event_rsvps WHERE event_id = ? AND user_id = ?').get(e.id, req.user.id);
  if (has) db.prepare('DELETE FROM event_rsvps WHERE event_id = ? AND user_id = ?').run(e.id, req.user.id);
  else {
    db.prepare('INSERT INTO event_rsvps (event_id, user_id, created_at) VALUES (?, ?, ?)').run(e.id, req.user.id, now());
    if (e.host_id !== req.user.id) emitTo(e.host_id, 'toast', { text: [`🙋 @${req.user.username} atakuja "${e.title}"`, `🙋 @${req.user.username} is coming to "${e.title}"`] });
  }
  res.json(eventRows(req.user.id));
});
api.delete('/events/:id', (req, res) => {
  db.prepare('UPDATE events SET cancelled = 1 WHERE id = ? AND host_id = ?').run(Number(req.params.id), req.user.id);
  broadcast('events:changed', {});
  res.json(eventRows(req.user.id));
});

// -------------------------------------------------------- players
api.get('/players/:username', (req, res) => {
  const u = getUserByUsername(req.params.username);
  if (!u) throw new GameError(['Mtumiaji hayupo', 'User not found'], 404);
  const plots = db.prepare('SELECT id, building FROM plots WHERE owner_id = ?').all(u.id);
  const biz = db.prepare('SELECT id FROM businesses WHERE owner_id = ?').all(u.id);
  const vehicles = db.prepare('SELECT model, color FROM vehicles WHERE user_id = ?').all(u.id);
  res.json({
    id: u.id, username: u.username, name: u.name, appearance: u.appearance, trait: u.trait, fame: u.fame, elimu: u.elimu,
    since: u.createdAt, online: online.has(u.id), plots, businesses: biz, vehicles, netWorth: game.netWorth(u.id), jobXp: u.jobXp,
    love: love.publicStatus(u.id),
  });
});
api.get('/leaderboard', (_req, res) => res.json(game.leaderboard()));

// ------------------------------------------------------ ambitions & storylines
story.wireStory({ netWorth: game.netWorth, currentMayor: election.currentMayor });
api.get('/story', (req, res) => res.json(story.storyState(req.user.id)));
api.post('/story/choose', (req, res) => {
  story.chooseAmbition(req.user.id, str(req.body.amb, 20));
  res.json({ story: story.storyState(req.user.id), me: game.playerState(req.user.id) });
});
api.post('/story/claim', (req, res) => {
  const r = story.claimChapter(req.user.id);
  res.json({ ...r, story: story.storyState(req.user.id), me: game.playerState(req.user.id) });
});
api.post('/story/dilemma', rateLimit('dilemma', 20, 60_000), (req, res) => {
  const r = story.answerDilemma(req.user.id, str(req.body.id, 20), Math.trunc(Number(req.body.choice)));
  res.json({ ...r, story: story.storyState(req.user.id), me: game.playerState(req.user.id) });
});

// ------------------------------------------------------------------ investing
api.get('/invest', (req, res) => res.json(invest.portfolio(req.user.id)));
const investDone = (req, res, extra = {}) => res.json({ ...extra, invest: invest.portfolio(req.user.id), me: game.playerState(req.user.id) });
api.post('/invest/plots/:id/buy', (req, res) => {
  crime.assertFree(getUser(req.user.id));
  investDone(req, res, invest.buyPlotRemote(req.user.id, req.params.id));
});
api.post('/invest/plots/:id/sell', (req, res) => investDone(req, res, invest.sellPlot(req.user.id, req.params.id)));
api.post('/invest/trucks', (req, res) => {
  crime.assertFree(getUser(req.user.id));
  invest.buyTruck(req.user.id);
  investDone(req, res);
});
api.post('/invest/trucks/:id/sell', (req, res) => investDone(req, res, invest.sellTruck(req.user.id, Number(req.params.id))));

// --------------------------------------------------------- nightlife money
api.get('/venues/:placeId/rain', (req, res) => res.json(venue.current(str(req.params.placeId, 20))));
api.post('/venues/:placeId/rain', rateLimit('rain', 20, 60_000), (req, res) => {
  crime.assertFree(getUser(req.user.id));
  res.json({ ...venue.rain(req.user.id, str(req.params.placeId, 20), req.body.amount), me: game.playerState(req.user.id) });
});
api.post('/venues/:placeId/pick', rateLimit('pick', 240, 60_000), (req, res) => res.json({ ...venue.pick(req.user.id, str(req.params.placeId, 20), str(req.body.id, 12)), me: game.playerState(req.user.id) }));
api.post('/venues/:placeId/tip', rateLimit('tip', 20, 60_000), (req, res) => res.json({ ...venue.tip(req.user.id, str(req.params.placeId, 20), req.body.amount), me: game.playerState(req.user.id) }));

// ------------------------------------------------------------------------ music
api.get('/music', (req, res) => res.json(music.tracksFor(str(req.query.venue, 20))));
const playCounted = new Map();
api.post('/music/:id/play', (req, res) => {
  const key = `${req.user.id}:${req.params.id}`;
  if (now() - (playCounted.get(key) || 0) > 10 * 60_000) { playCounted.set(key, now()); music.countPlay(req.params.id); }
  res.json({ ok: true });
});

// ---------------------------------------------------------------------- dating
api.get('/love', (req, res) => res.json({ ...love.loveState(req.user.id), discover: love.discover(req.user.id) }));
api.post('/love/profile', (req, res) => {
  love.saveProfile(req.user.id, { open: !!req.body.open, adult: !!req.body.adult, bio: req.body.bio, looking: str(req.body.looking, 8) });
  res.json({ ...love.loveState(req.user.id), discover: love.discover(req.user.id) });
});
api.post('/love/swipe', rateLimit('swipe', 120, 60 * 60_000), (req, res) => res.json(love.swipe(req.user.id, str(req.body.username, 30), str(req.body.kind, 6))));
api.post('/love/:rid/date-invite', rateLimit('loveask', 30, 60 * 60_000), (req, res) => res.json(love.inviteDate(req.user.id, req.params.rid, str(req.body.spot, 20))));
api.post('/love/:rid/ask-partner', rateLimit('loveask', 30, 60 * 60_000), (req, res) => res.json(love.askPartner(req.user.id, req.params.rid)));
api.post('/love/:rid/propose', rateLimit('loveask', 30, 60 * 60_000), (req, res) => res.json(love.propose(req.user.id, req.params.rid)));
api.post('/love/answer/:askId', (req, res) => res.json({ ...love.answer(req.user.id, str(req.params.askId, 40), !!req.body.accept), me: game.playerState(req.user.id) }));
api.post('/love/:rid/date', (req, res) => {
  crime.assertFree(getUser(req.user.id));
  res.json({ ...love.startDate(req.user.id, req.params.rid, str(req.body.spot, 20)), me: game.playerState(req.user.id) });
});
api.post('/love/:rid/gift', (req, res) => res.json({ ...love.gift(req.user.id, req.params.rid, str(req.body.gift, 12)), me: game.playerState(req.user.id) }));
api.post('/love/:rid/wedding', (req, res) => res.json({ ...love.wedding(req.user.id, req.params.rid), me: game.playerState(req.user.id) }));
api.post('/love/:rid/end', (req, res) => { love.endRelationship(req.user.id, req.params.rid); res.json(love.loveState(req.user.id)); });

// ------------------------------------------------------------------- companies
api.get('/companies', (req, res) => res.json(company.myCompanies(req.user.id)));
api.post('/companies', (req, res) => {
  crime.assertFree(getUser(req.user.id));
  const id = company.createCompany(req.user.id, { name: req.body.name, logo: req.body.logo, color: req.body.color, industry: str(req.body.industry, 20) });
  res.status(201).json({ id, companies: company.myCompanies(req.user.id), me: game.playerState(req.user.id) });
});
api.get('/shops', (req, res) => res.json(company.openShops(req.user.id)));
api.post('/shops/:id/buy', (req, res) => {
  crime.assertFree(getUser(req.user.id));
  const r = company.buyFromShop(req.user.id, req.params.id, str(req.body.item, 20));
  res.json({ ...r, me: game.playerState(req.user.id) });
});
api.post('/companies/:id', (req, res) => {
  const r = company.updateCompany(req.user.id, req.params.id, { action: str(req.body.action, 12), value: req.body.value });
  res.json({ ...r, companies: company.myCompanies(req.user.id), me: game.playerState(req.user.id) });
});

// ---------------------------------------------------------------------- police
api.get('/police', (req, res) => {
  const t = now();
  const arrests = db.prepare('SELECT reason, fine, created_at FROM arrests WHERE user_id = ? ORDER BY id DESC LIMIT 10').all(req.user.id)
    .map((a) => ({ ...a, reason: JSON.parse(a.reason) }));
  const arrestCount = db.prepare('SELECT COUNT(*) n FROM arrests WHERE user_id = ?').get(req.user.id).n;
  const robbed = db.prepare(`SELECT r.id, r.amount, r.created_at, r.reported, u.username FROM robberies r JOIN users u ON u.id = r.robber_id
    WHERE r.victim_id = ? AND r.created_at > ? ORDER BY r.id DESC LIMIT 10`).all(req.user.id, t - 7 * 86_400_000)
    .map((r) => ({ ...r, canReport: !r.reported && t - r.created_at < CRIME.reportWindowMs }));
  const gains = db.prepare('SELECT COALESCE(SUM(amount),0) s FROM robberies WHERE robber_id = ? AND created_at > ?').get(req.user.id, t - 7 * 86_400_000).s;
  const reportsOnMe = db.prepare('SELECT COUNT(*) n FROM robberies WHERE robber_id = ? AND reported = 1 AND created_at > ?').get(req.user.id, t - 30 * 86_400_000).n;
  res.json({ arrests, arrestCount, robbed, takukuru: { watching: gains >= 300_000 || reportsOnMe >= 2 || arrestCount >= 3, gains, reportsOnMe }, jail: getUser(req.user.id).jail });
});

// ------------------------------------------------------------------ neighbours
api.get('/neighbours', (req, res) => {
  const blocked = new Set(crime.blockedIds(req.user.id));
  const rows = db.prepare(`SELECT u.id, u.username, u.name, u.appearance, u.last_seen,
      (SELECT COUNT(*) FROM home_items h WHERE h.user_id = u.id) items,
      (SELECT p.id FROM plots p WHERE p.owner_id = u.id AND p.building IS NOT NULL LIMIT 1) house
    FROM users u WHERE u.onboarded = 1 AND u.banned_at IS NULL AND u.id != ? ORDER BY u.last_seen DESC LIMIT 120`).all(req.user.id);
  const list = rows.filter((r) => !blocked.has(r.id)).map((r) => {
    const o = online.get(r.id);
    const plot = r.house && plotById[r.house];
    return { username: r.username, name: r.name, appearance: JSON.parse(r.appearance || 'null'), online: !!o, atHome: !!o && o.home === r.id, items: r.items, home: plot ? { kind: 'house', district: plot.district } : { kind: 'apartment' }, lastSeen: r.last_seen };
  });
  list.sort((a, b) => (b.atHome - a.atHome) || (b.online - a.online) || (b.lastSeen - a.lastSeen));
  res.json(list.slice(0, 40));
});
const lastTogether = new Map();
api.post('/visit/:username/together', (req, res) => {
  const host = getUserByUsername(String(req.params.username).replace(/^@/, ''));
  const act = togetherById[str(req.body.act, 12)];
  if (!host || !act) throw new GameError(['Haipo', 'Not found'], 404);
  const me = online.get(req.user.id);
  const isHost = host.id === req.user.id;
  // Both of you must be in the same home right now.
  const others = [...online].filter(([id, o]) => id !== req.user.id && o.home === host.id).map(([id]) => id);
  if (!me || me.home !== host.id || !others.length) throw new GameError(['Mnahitaji kuwa nyumbani pamoja.', 'You both need to be in the home together.']);
  const key = `${host.id}:${act.id}`;
  if (now() - (lastTogether.get(key) || 0) < 45_000) throw new GameError(['Pole pole — mmeshafanya hivyo sasa hivi.', 'Easy — you just did that.'], 429);
  lastTogether.set(key, now());
  const who = [req.user.id, ...others];
  for (const id of who) {
    const u = getUser(id);
    saveFields(id, { needs: game.applyNeeds(u.needs, act.effects) });
    story.bumpStats(id, ['together']);
    if (id !== req.user.id) emitTo(id, 'toast', { text: [`${act.emoji} @${req.user.username}: ${act.name[0]}!`, `${act.emoji} @${req.user.username}: ${act.name[1]}!`], refresh: true });
  }
  void isHost;
  res.json({ ok: true, me: game.playerState(req.user.id) });
});

// ------------------------------------------------------------- ads
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 1_500_000, files: 1 } });
const MAGIC = [
  { ext: 'png', test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { ext: 'jpg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: 'webp', test: (b) => b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP' },
];

export function liveAds() {
  const t = now();
  return db.prepare(
    "SELECT a.id, a.slot_id, a.title, a.body, a.link, a.image, a.bg, a.ends_at, u.username FROM ads a JOIN users u ON u.id = a.user_id WHERE a.status = 'live' AND a.starts_at <= ? AND a.ends_at > ?",
  ).all(t, t);
}

api.get('/ads/slots', (_req, res) => {
  const t = now();
  const live = db.prepare("SELECT slot_id, COUNT(*) n, MIN(ends_at) next_free FROM ads WHERE status = 'live' AND starts_at <= @t AND ends_at > @t GROUP BY slot_id").all({ t });
  const map = Object.fromEntries(live.map((b) => [b.slot_id, b]));
  res.json(BILLBOARDS.map((b) => {
    const l = map[b.id];
    const full = (l?.n || 0) >= ADS_PER_BOARD;
    return { ...b, tzsPerDay: adTzsPerDay(b), live: l?.n || 0, capacity: ADS_PER_BOARD, bookedUntil: full ? l.next_free : null };
  }));
});
api.get('/ads/mine', (req, res) => {
  res.json(db.prepare('SELECT * FROM ads WHERE user_id = ? ORDER BY id DESC LIMIT 30').all(req.user.id));
});

api.post('/ads', rateLimit('ads', 10, 60 * 60_000), upload.single('image'), wrap(async (req, res) => {
  if (!provider) throw new GameError(['Malipo ya simu hayajawashwa bado — matangazo yanalipwa kwa nTZS.', 'Mobile payments are not switched on yet — ads are paid with nTZS.'], 503);
  if (!getSettings().adsEnabled) throw new GameError(['Matangazo mapya yamesimamishwa kwa muda.', 'New ads are temporarily paused.'], 503);
  const slot = billboardById[str(req.body.slotId, 30)];
  if (!slot) throw new GameError(['Chagua bango (billboard).', 'Choose a billboard.']);
  const title = str(req.body.title, 40);
  const body = str(req.body.body, 90);
  const link = str(req.body.link, 120);
  const bg = /^#[0-9a-f]{6}$/i.test(req.body.bg || '') ? req.body.bg : '#16a34a';
  const days = Math.floor(Number(req.body.days));
  if (title.length < 2) throw new GameError(['Andika kichwa cha tangazo.', 'Enter an ad headline.']);
  if (!(days >= 1 && days <= AD_MAX_DAYS)) throw new GameError([`Siku kati ya 1 na ${AD_MAX_DAYS}.`, `Between 1 and ${AD_MAX_DAYS} days.`]);
  if (link && !/^https:\/\/[^\s]+$/i.test(link)) throw new GameError(['Link lazima ianze na https://', 'Link must start with https://']);
  const phone = normalizePhone(req.body.phone);
  if (!phone) throw new GameError(['Namba ya simu si sahihi (mfano 0712 345 678).', 'Invalid phone number (e.g. 0712 345 678).']);
  const method = provider.methods.includes(req.body.method) ? req.body.method : provider.methods[0];
  const pendingAds = db.prepare("SELECT COUNT(*) n FROM ads WHERE user_id = ? AND status = 'awaiting_payment'").get(req.user.id).n;
  if (pendingAds >= 3) throw new GameError(['Una matangazo 3 yanayosubiri malipo. Yamalize kwanza.', 'You have 3 ads waiting for payment. Finish those first.']);
  let image = null;
  if (req.file) {
    const kind = MAGIC.find((m) => m.test(req.file.buffer));
    if (!kind) throw new GameError(['Picha iwe PNG, JPG au WEBP.', 'Image must be PNG, JPG or WEBP.']);
    image = `ads/${crypto.randomUUID()}.${kind.ext}`;
  }
  // Real money: start an nTZS mobile-money payment; the ad goes live once it's paid.
  const amountTzs = adPriceTzs(slot, days);
  let created;
  try {
    created = await provider.create({ amountTzs, phone, method, user: req.user });
  } catch (e) {
    throw new GameError(e.userMessage || ['Imeshindikana kuanzisha malipo. Jaribu tena.', 'Could not start the payment. Please try again.'], e.status || 502, e.code);
  }
  if (image) fs.writeFileSync(path.join(UPLOAD_DIR, image), req.file.buffer);
  const result = db.transaction(() => {
    const ad = db.prepare(
      "INSERT INTO ads (user_id, slot_id, title, body, link, image, bg, starts_at, ends_at, status, days, paid_tzs, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 'awaiting_payment', ?, ?, ?)",
    ).run(req.user.id, slot.id, title, body || null, link || null, image, bg, days, amountTzs, now());
    const pay = db.prepare(
      "INSERT INTO topups (user_id, provider, provider_ref, method, phone, amount_tzs, coins, status, instructions, created_at, purpose, ref_id) VALUES (?, ?, ?, ?, ?, ?, 0, 'pending', ?, ?, 'ad', ?)",
    ).run(req.user.id, provider.id, created.ref, method, phone, amountTzs, created.instructions ? JSON.stringify(created.instructions) : null, now(), ad.lastInsertRowid);
    return { adId: ad.lastInsertRowid, paymentId: pay.lastInsertRowid };
  })();
  if (!req.user.phone) saveFields(req.user.id, { phone });
  res.status(201).json({ ...result, amountTzs, status: 'pending', instructions: created.instructions, livemode: provider.livemode });
}));

/** A paid billboard ad goes live (now, or when the board next has a free turn). */
function activateAd(adId) {
  const ad = db.prepare('SELECT * FROM ads WHERE id = ?').get(adId);
  if (!ad || ad.status !== 'awaiting_payment') return null;
  const ends = db.prepare("SELECT ends_at FROM ads WHERE slot_id = ? AND status = 'live' AND ends_at > ? ORDER BY ends_at").all(ad.slot_id, now()).map((r) => r.ends_at);
  const startsAt = ends.length < ADS_PER_BOARD ? now() : ends[ends.length - ADS_PER_BOARD];
  db.prepare("UPDATE ads SET status = 'live', starts_at = ?, ends_at = ? WHERE id = ?").run(startsAt, startsAt + (ad.days || 1) * 86400_000, ad.id);
  return { ...ad, startsAt };
}

api.post('/ads/:id/report', (req, res) => {
  const ad = db.prepare('SELECT * FROM ads WHERE id = ?').get(req.params.id);
  if (!ad) throw new GameError(['Tangazo halipo', 'Ad not found'], 404);
  const r = db.prepare('INSERT OR IGNORE INTO ad_reports (ad_id, user_id) VALUES (?, ?)').run(ad.id, req.user.id);
  if (r.changes) {
    db.prepare('UPDATE ads SET reports = reports + 1 WHERE id = ?').run(ad.id);
    if (ad.reports + 1 >= 5) {
      db.prepare("UPDATE ads SET status = 'hidden' WHERE id = ?").run(ad.id);
      broadcast('ads', liveAds());
    }
  }
  res.json({ ok: true });
});

// ---------------------------------------------------------- errors
api.use((err, req, res, _next) => {
  const en = req.get('x-lang') === 'en';
  if (err instanceof GameError) return res.status(err.status).json({ error: en ? err.en : err.message, code: err.code });
  if (err instanceof multer.MulterError) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? (en ? 'Image must be under 1.5MB.' : 'Picha isizidi 1.5MB.') : err.message });
  if (err.status && err.status < 500) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: en ? 'Server error. Please try again.' : 'Kuna hitilafu kwenye server. Jaribu tena.' });
});
