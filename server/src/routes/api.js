import express from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  GAME, HAIRSTYLES, SKIN_TONES, HAIR_COLORS, OUTFITS, TRAITS, SPAWNS, BILLBOARDS, AD_MAX_DAYS,
  billboardById, outfitById, ADS_PER_BOARD,
} from '../../../shared/world.js';
import { db, getUser, getUserByUsername, createUser, saveFields, addMoney, GameError, now, UPLOAD_DIR, getSettings } from '../db.js';
import { hashPassword, checkPassword, signToken, requireAuth, requireAdmin, rateLimit, USERNAME_RE, normalizePhone } from '../auth.js';
import { admin } from './admin.js';
import * as game from '../game.js';
import { online, onlineCount, broadcast, emitTo } from '../presence.js';
import { provider, providers, TOPUP_RATE } from '../payments/index.js';

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
    mayor: lb.rich[0] ? { username: lb.rich[0].username, name: lb.rich[0].name } : null,
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
  const user = db.transaction(() => createUser({ username, name, passwordHash, email, isAdmin: adminNames.has(username.toLowerCase()) }))();
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
  res.json({ token: signToken({ id: row.id, tokenVersion: row.token_version }), me: game.playerState(row.id) });
}));

// ------------------------------------------------------------- me
api.use(requireAuth);

// Maintenance mode locks the game for everyone except admins.
api.use((req, _res, next) => {
  if (getSettings().maintenance && !req.user.isAdmin && req.path !== '/me')
    return next(new GameError(['Bongo Life iko kwenye matengenezo. Rudi baadaye kidogo 🔧', 'Bongo Life is under maintenance. Back shortly 🔧'], 503, 'maintenance'));
  next();
});

api.use('/admin', requireAdmin, admin);

api.get('/me', (req, res) => res.json(game.playerState(req.user.id)));

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
  const result = game.finishAction(req.user.id);
  if (result.teleport) emitTo(req.user.id, 'teleport', { pos: result.teleport });
  res.json({ result, me: game.playerState(req.user.id) });
});
api.post('/act/cancel', (req, res) => {
  game.cancelAction(req.user.id);
  res.json({ me: game.playerState(req.user.id) });
});
// ---- Kwangu (player apartment)
api.get('/home', (req, res) => res.json({ items: game.homeItems(req.user.id) }));
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
    topups: db.prepare('SELECT id, provider, method, amount_tzs, coins, status, instructions, created_at FROM topups WHERE user_id = ? ORDER BY id DESC LIMIT 10').all(req.user.id)
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
  const pending = db.prepare("SELECT COUNT(*) n FROM topups WHERE user_id = ? AND status = 'pending'").get(req.user.id).n;
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

export async function settleTopup(t) {
  const prov = providers[t.provider];
  if (!prov || t.status !== 'pending') return t.status;
  let status;
  try {
    status = await prov.check(t.provider_ref);
  } catch (e) {
    console.warn('[topup] check failed', t.id, e.message);
    return 'pending';
  }
  if (status === 'pending' && now() - t.created_at > 72 * 3600_000) status = 'expired';
  return applyTopupStatus(t, status);
}

/** Move a pending top-up to its final state; credits the player exactly once. */
export function applyTopupStatus(t, status) {
  if (status === 'pending') return status;
  const credited = db.transaction(() => {
    // Compare-and-set so a topup is only ever credited once.
    const r = db.prepare("UPDATE topups SET status = ?, credited_at = ? WHERE id = ? AND status = 'pending'").run(status, status === 'paid' ? now() : null, t.id);
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
    'SELECT m.id, m.body, m.created_at, u.username, u.name FROM messages m JOIN users u ON u.id = m.from_id WHERE m.to_id IS NULL AND m.deleted_at IS NULL ORDER BY m.id DESC LIMIT 60',
  ).all();
  res.json(rows.reverse());
});
api.get('/messages/threads', (req, res) => {
  const me = req.user.id;
  const rows = db.prepare(`
    SELECT CASE WHEN from_id = @me THEN to_id ELSE from_id END AS other, MAX(id) AS last_id,
           SUM(CASE WHEN to_id = @me AND read_at IS NULL THEN 1 ELSE 0 END) AS unread
    FROM messages WHERE to_id IS NOT NULL AND (from_id = @me OR to_id = @me)
    GROUP BY other ORDER BY last_id DESC LIMIT 50`).all({ me });
  const getMsg = db.prepare('SELECT body, created_at, from_id FROM messages WHERE id = ?');
  res.json(rows.map((r) => {
    const u = userBrief.get(r.other);
    const m = getMsg.get(r.last_id);
    return { user: { ...u, appearance: JSON.parse(u.appearance || 'null'), online: online.has(u.id) }, last: m.body, mine: m.from_id === me, at: m.created_at, unread: r.unread };
  }));
});
api.get('/messages/dm/:username', (req, res) => {
  const other = getUserByUsername(req.params.username);
  if (!other) throw new GameError(['Mtumiaji hayupo', 'User not found'], 404);
  const me = req.user.id;
  const rows = db.prepare(
    'SELECT id, from_id, body, created_at FROM messages WHERE (from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?) ORDER BY id DESC LIMIT 100',
  ).all(me, other.id, other.id, me);
  db.prepare('UPDATE messages SET read_at = ? WHERE from_id = ? AND to_id = ? AND read_at IS NULL').run(now(), other.id, me);
  res.json({ user: { id: other.id, username: other.username, name: other.name, appearance: other.appearance, online: online.has(other.id) }, messages: rows.reverse() });
});

// ---------------------------------------------------------- phone
api.get('/phone/apps', (_req, res) => {
  res.json(db.prepare('SELECT id, name, url, icon_url, emoji, color, badge FROM phone_apps WHERE active = 1 ORDER BY sort, id').all());
});
api.post('/phone/apps/:id/open', (req, res) => {
  db.prepare('UPDATE phone_apps SET opens = opens + 1 WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

// -------------------------------------------------------- contacts
const contactList = (userId) =>
  db.prepare(`SELECT u.id, u.username, u.name, u.appearance, u.fame FROM contacts c JOIN users u ON u.id = c.contact_id
    WHERE c.user_id = ? AND u.banned_at IS NULL ORDER BY u.username COLLATE NOCASE`).all(userId)
    .map((u) => ({ ...u, appearance: JSON.parse(u.appearance || 'null'), online: online.has(u.id) }));
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
  });
});
api.get('/leaderboard', (_req, res) => res.json(game.leaderboard()));

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
    return { ...b, live: l?.n || 0, capacity: ADS_PER_BOARD, bookedUntil: full ? l.next_free : null };
  }));
});
api.get('/ads/mine', (req, res) => {
  res.json(db.prepare('SELECT * FROM ads WHERE user_id = ? ORDER BY id DESC LIMIT 30').all(req.user.id));
});

api.post('/ads', rateLimit('ads', 10, 60 * 60_000), upload.single('image'), (req, res) => {
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
  let image = null;
  if (req.file) {
    const kind = MAGIC.find((m) => m.test(req.file.buffer));
    if (!kind) throw new GameError(['Picha iwe PNG, JPG au WEBP.', 'Image must be PNG, JPG or WEBP.']);
    image = `ads/${crypto.randomUUID()}.${kind.ext}`;
  }
  const result = db.transaction(() => {
    // Digital board: goes live now if there's a free turn, otherwise when the next ad ends.
    const ends = db.prepare("SELECT ends_at FROM ads WHERE slot_id = ? AND status = 'live' AND ends_at > ? ORDER BY ends_at").all(slot.id, now()).map((r) => r.ends_at);
    const startsAt = ends.length < ADS_PER_BOARD ? now() : ends[ends.length - ADS_PER_BOARD];
    const cost = slot.pricePerDay * days;
    addMoney(req.user.id, -cost, 'ads', `Tangazo "${title}" — ${slot.name} siku ${days}`);
    const info = db.prepare(
      'INSERT INTO ads (user_id, slot_id, title, body, link, image, bg, starts_at, ends_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(req.user.id, slot.id, title, body || null, link || null, image, bg, startsAt, startsAt + days * 86400_000, now());
    return { id: info.lastInsertRowid, startsAt, cost };
  })();
  if (image) fs.writeFileSync(path.join(UPLOAD_DIR, image), req.file.buffer);
  broadcast('ads', liveAds());
  res.status(201).json({ ...result, me: game.playerState(req.user.id) });
});

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
