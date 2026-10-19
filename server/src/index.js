import express from 'express';
import compression from 'compression';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { Server } from 'socket.io';
import { bumpStats } from './story.js';
import { NEED_TICK_SECONDS, isWater, moodOf, placeById, EVENT_LIMITS, HANGOUT_PLACES, luxuryById, plotById, ENTERABLE_BUILDINGS } from '../../shared/world.js';
import { db, getUser, saveFields, now, UPLOAD_DIR, getSettings } from './db.js';
import { verifyToken } from './auth.js';
import { registerInteractions } from './interact.js';
import { api, settleTopup, applyTopupStatus } from './routes/api.js';
import { verifyNtzsWebhook } from './payments/index.js';
import { online, setIO, publicPlayer, broadcast, emitTo } from './presence.js';
import { decayNeeds, vehicleSummary, neglectHealth, worldState, mayorRef, netWorth } from './game.js';
import { settleElection, currentMayor } from './election.js';
import { isBlocked } from './crime.js';
import { attachVoice, leaveVoice } from './voice.js';
import { attachWatch, leaveWatch } from './watch.js';
import { shopRentTick } from './company.js';
import { addInvite, canVisit } from './social.js';
import * as chat from './chat.js';
import * as luxury from './luxury.js';
import * as afya from './health.js';
import * as lift from './lift.js';
import { guardOf, expireTick as guardsTick } from './guards.js';
import { startNews, story as newsStory } from './news.js';

const PORT = Number(process.env.PORT) || 8787;
const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(compression());
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});
// Players (and admins) should always land on the real domain, not the *.up.railway.app one.
// API, sockets, uploads and webhooks are left alone so nothing already pointing here breaks.
const CANONICAL_URL = (process.env.CANONICAL_URL || 'https://play.bongolife.app').replace(/\/$/, '');
app.use((req, res, next) => {
  const host = req.hostname || '';
  if (req.method === 'GET' && /\.up\.railway\.app$/i.test(host) && !/^\/(api|socket\.io|uploads)\b/.test(req.path)) {
    return res.redirect(301, CANONICAL_URL + req.originalUrl);
  }
  next();
});
// nTZS webhooks need the raw body for signature verification, so they come before express.json.
app.post('/api/webhooks/ntzs', express.raw({ type: '*/*', limit: '100kb' }), (req, res) => {
  const raw = req.body?.toString('utf8') || '';
  if (!verifyNtzsWebhook(raw, req.get('x-webhook-signature'), req.get('x-webhook-timestamp'))) {
    console.warn('[webhook] invalid nTZS signature');
    return res.status(400).json({ error: 'invalid signature' });
  }
  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    return res.status(400).json({ error: 'invalid json' });
  }
  if (event.type === 'deposit.completed' && event.data?.depositId) {
    const t = db.prepare("SELECT * FROM topups WHERE provider = 'ntzs' AND provider_ref = ?").get(String(event.data.depositId));
    if (t) {
      // Credits the amount WE recorded for this deposit, exactly once (compare-and-set).
      applyTopupStatus(t, 'paid');
    } else console.warn('[webhook] unknown deposit', event.data.depositId);
  }
  res.json({ received: true });
});
app.use(express.json({ limit: '50kb' }));
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d', immutable: true, fallthrough: false }));
app.use('/api', api);
app.get('/healthz', (_req, res) => res.json({ ok: true }));

const dist = path.resolve(import.meta.dirname, '../../client/dist');
if (fs.existsSync(dist)) {
  // The service worker must never be cached, or installed apps would keep an old one.
  app.get('/sw.js', (_req, res) => res.set('Cache-Control', 'no-cache').sendFile(path.join(dist, 'sw.js')));
  app.use(express.static(dist, { maxAge: '1h', index: false }));
  app.use('/assets', express.static(path.join(dist, 'assets'), { maxAge: '365d', immutable: true }));
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

const server = http.createServer(app);
const io = new Server(server, {
  cors: process.env.NODE_ENV === 'production' ? undefined : { origin: true },
  pingInterval: 20_000,
  maxHttpBufferSize: 16_000,
});
setIO(io);

// ------------------------------------------------------------- sockets
io.use((socket, next) => {
  const user = verifyToken(socket.handshake.auth?.token);
  if (!user) return next(new Error('unauthorized'));
  if (!user.onboarded) return next(new Error('not_onboarded'));
  if (getSettings().maintenance && !user.isAdmin) return next(new Error('maintenance'));
  socket.data.userId = user.id;
  next();
});

const pendingMoves = new Map();
const insertMsg = db.prepare('INSERT INTO messages (from_id, to_id, body, created_at) VALUES (?, ?, ?, ?)');
const cleanText = (t) => (typeof t === 'string' ? t.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 200) : '');

io.on('connection', (socket) => {
  const uid = socket.data.userId;
  const user = getUser(uid);
  let p = online.get(uid);
  const isNew = !p;
  if (!p) {
    p = {
      sockets: new Set(), x: user.x, z: user.z, ry: 0, m: 0, name: user.name, username: user.username, appearance: user.appearance,
      vehicle: vehicleSummary(user.activeVehicle), busy: user.busy && user.busy.endsAt > now() ? { kind: user.busy.kind, id: user.busy.id, placeId: user.busy.placeId, emoji: user.busy.emoji, endsAt: user.busy.endsAt } : null,
      inside: null, guards: guardOf(uid)?.men || 0,
      lastChat: 0, chatCount: 0,
    };
    online.set(uid, p);
  }
  p.sockets.add(socket.id);

  socket.emit('snapshot', { you: uid, players: [...online].filter(([id]) => id !== uid).map(([id, pl]) => publicPlayer(id, pl)) });
  if (isNew) socket.broadcast.emit('player:join', publicPlayer(uid, p));
  broadcast('online', online.size);

  socket.on('move', (d) => {
    if (!d || !Number.isFinite(d.x) || !Number.isFinite(d.z)) return;
    if (lift.isRiding(uid)) return; // passengers go where the driver goes
    // Loose anti-teleport: ignore jumps larger than a fast car could make between packets.
    if (Math.hypot(d.x - p.x, d.z - p.z) > 40) return socket.emit('teleport', { pos: [p.x, p.z] });
    if (p.inside && d.m) {
      // Walking away means you left the venue.
      p.inside = null; p.host = null;
      broadcast('player:inside', { id: uid, inside: null });
    }
    if (isWater(d.x, d.z)) return;
    p.x = d.x;
    p.z = d.z;
    p.ry = Number.isFinite(d.ry) ? d.ry : p.ry;
    p.m = d.m === 2 ? 2 : d.m ? 1 : 0; // 2 = running
    pendingMoves.set(uid, [uid, +p.x.toFixed(2), +p.z.toFixed(2), +p.ry.toFixed(2), p.m]);
    lift.follow(uid, p, (pid, pp) => pendingMoves.set(pid, [pid, +pp.x.toFixed(2), +pp.z.toFixed(2), +(pp.ry || 0).toFixed(2), 1]));
  });

  socket.on('chat', (payload) => {
    const text = cleanText(typeof payload === 'string' ? payload : payload?.text);
    const replyId = Number(payload?.replyTo) || null;
    if (!text) return;
    const t = now();
    if (!getSettings().chatEnabled) return socket.emit('toast', { text: ['Chat imefungwa kwa muda.', 'Chat is temporarily disabled.'] });
    const muted = getUser(uid).mutedUntil;
    if (muted && muted > t) return socket.emit('toast', { text: ['Umezuiwa kuchat kwa muda.', 'You are muted for now.'] });
    if (t - p.lastChat < 1200) return socket.emit('toast', { text: ['Pole pole na meseji 😅', 'Slow down with the messages 😅'] });
    p.lastChat = t;
    const info = insertMsg.run(uid, null, text, t);
    // Replying to another street message: keep a short quote of it.
    let reply = null;
    const orig = replyId && db.prepare('SELECT m.id, m.body, m.to_id, m.group_id, m.deleted_at, u.username FROM messages m JOIN users u ON u.id = m.from_id WHERE m.id = ?').get(replyId);
    if (orig && !orig.to_id && !orig.group_id && !orig.deleted_at) {
      db.prepare('UPDATE messages SET reply_to = ? WHERE id = ?').run(orig.id, info.lastInsertRowid);
      reply = { id: orig.id, from: orig.username, body: orig.body.slice(0, 80) };
    }
    broadcast('chat', { mid: info.lastInsertRowid, id: uid, username: p.username, name: p.name, text, at: t, reply, reactions: {} });
    // @mentions: ping each mentioned player (once per message, never yourself or someone who blocked you).
    const named = [...new Set((text.match(/@([a-z0-9_.]{3,24})/gi) || []).map((m) => m.slice(1).toLowerCase()))].slice(0, 5);
    for (const n of named) {
      const u = db.prepare('SELECT id FROM users WHERE lower(username) = ?').get(n);
      if (u && u.id !== uid && !isBlocked(uid, u.id)) emitTo(u.id, 'mention', { from: p.username, text, at: t });
    }
    // Chatting fills the social need a little.
    const u = getUser(uid);
    saveFields(uid, { needs: { ...u.needs, social: Math.min(100, (u.needs.social ?? 50) + 2) } });
  });

  // Private messages (DMs and groups): replies, forwards, edits, reactions live in chat.js.
  const chatSend = (payload, ack) => {
    const t = now();
    if (t - (p.lastDm || 0) < 400) return ack?.({ error: 'Pole pole' });
    p.lastDm = t;
    try {
      const msg = chat.sendMessage(uid, payload || {});
      ack?.({ ok: true, msg: { ...msg, fromName: p.name } });
    } catch (e) {
      ack?.({ error: e.code === 'muted' ? 'muted' : e.status === 403 ? 'blocked' : e.message, errorText: [e.message, e.en || e.message] });
    }
  };
  socket.on('dm', ({ to, text, replyTo, fwd } = {}, ack) => chatSend({ to, text, replyTo, fwd }, ack));
  socket.on('gm', ({ groupId, text, replyTo } = {}, ack) => chatSend({ groupId, text, replyTo }, ack));

  // Walk into / out of a venue. Must be standing near it.
  socket.on('inside', (placeId) => {
    // In custody you stay at the station / court.
    const j = getUser(uid)?.jail;
    if (j && (p.inside === 'polisi' || p.inside === 'mahakama') && placeId !== p.inside) return socket.emit('player:inside', { id: uid, inside: p.inside });
    let inside = null;
    let host = null;
    const priv = typeof placeId === 'string' && /^(yacht|jet):(\d+)$/.exec(placeId);
    const blk = typeof placeId === 'string' && /^block:([\w-]+)$/.exec(placeId);
    if (placeId === 'home') inside = 'home';
    else if (blk) {
      // Walking into an apartment block / hostel / hotel on a plot: be near it (owners can pop in from anywhere).
      const plot = plotById[blk[1]];
      const row = plot && db.prepare('SELECT owner_id, building FROM plots WHERE id = ?').get(plot.id);
      if (!row || !ENTERABLE_BUILDINGS.includes(row.building)) return socket.emit('inside:denied', placeId);
      if (row.owner_id !== uid && Math.hypot(p.x - plot.pos[0], p.z - plot.pos[1]) > plot.size / 2 + 16) return socket.emit('inside:denied', placeId);
      inside = 'block';
      host = `blk-${plot.id}`;
    }
    else if (priv) {
      // Boarding a yacht/jet: yours, or one you were invited aboard. Works from anywhere.
      host = Number(priv[2]);
      if (!luxury.canBoard(uid, host, priv[1])) return socket.emit('inside:denied', placeId);
      const boat = luxury.flagship(host, priv[1]);
      if (luxury.aboard(host, priv[1]).length >= (luxuryById[boat.model]?.guests || 8) && uid !== host) return socket.emit('inside:denied', placeId);
      inside = priv[1];
    } else if (placeId && placeById[placeId] && !placeById[placeId].private) {
      const pl = placeById[placeId];
      const dx = Math.max(Math.abs(p.x - pl.pos[0]) - pl.size[0] / 2, 0);
      const dz = Math.max(Math.abs(p.z - pl.pos[1]) - pl.size[1] / 2, 0);
      if (Math.hypot(dx, dz) > 16) return socket.emit('inside:denied', placeId);
      inside = placeId;
    }
    if (inside !== 'home') leaveHome();
    const boat = typeof host === 'number' && luxury.flagship(host, inside);
    const msg = { id: uid, inside, host, model: boat?.model || null, color: boat?.color || null, hostName: typeof host === 'number' ? getUser(host)?.username : null, plotId: inside === 'block' ? host.slice(4) : null };
    if (p.inside === inside && (p.host || null) === host) return socket.emit('player:inside', msg);
    leaveVoice(uid); // walking out of a room ends its voice chat
    p.inside = inside;
    p.host = host;
    broadcast('player:inside', msg);
  });

  // ---- invites & home visits
  socket.on('invite', ({ to } = {}, ack) => {
    const target = typeof to === 'string' && db.prepare('SELECT id, username FROM users WHERE username = ?').get(to.replace(/^@/, ''));
    if (!target || target.id === uid) return ack?.({ error: 'not_found' });
    if (!online.has(target.id)) return ack?.({ error: 'offline' });
    if (isBlocked(uid, target.id)) return ack?.({ error: 'blocked' });
    addInvite(uid, target.id);
    emitTo(target.id, 'invite', { fromId: uid, from: p.username, fromName: p.name, appearance: p.appearance });
    ack?.({ ok: true });
  });
  // "Let's go out": invite someone to meet at a place (club, beach, nyama choma…).
  const lastHangout = new Map();
  socket.on('hangout', ({ to, placeId } = {}, ack) => {
    const target = typeof to === 'string' && db.prepare('SELECT id FROM users WHERE username = ?').get(to.replace(/^@/, ''));
    if (!target || target.id === uid || !HANGOUT_PLACES.includes(placeId)) return ack?.({ error: 'bad' });
    if (isBlocked(uid, target.id)) return ack?.({ error: 'blocked' });
    if (!online.has(target.id)) return ack?.({ error: 'offline' });
    if (now() - (lastHangout.get(target.id) || 0) < 8000) return ack?.({ error: 'slow' });
    lastHangout.set(target.id, now());
    emitTo(target.id, 'hangout', { fromId: uid, from: p.username, appearance: p.appearance, placeId });
    ack?.({ ok: true });
  });
  socket.on('hangout:reply', ({ fromId, placeId, accept } = {}) => {
    if (!online.has(fromId) || !HANGOUT_PLACES.includes(placeId)) return;
    const name = placeById[placeId];
    if (accept) emitTo(fromId, 'hangout:accepted', { by: p.username, placeId });
    else emitTo(fromId, 'toast', { text: [`@${p.username} hawezi kuja ${name.name} sasa hivi.`, `@${p.username} can't make it to ${name.name} right now.`] });
  });
  // Neighbours: knock on someone's door; they open (→ you may enter) or not.
  const lastKnock = new Map();
  socket.on('knock', ({ to } = {}, ack) => {
    const host = typeof to === 'string' && db.prepare('SELECT id, username FROM users WHERE username = ?').get(to.replace(/^@/, ''));
    if (!host || host.id === uid) return ack?.({ error: 'not_found' });
    const o = online.get(host.id);
    if (!o) return ack?.({ error: 'offline' });
    if (o.home !== host.id) return ack?.({ error: 'not_home' });
    if (isBlocked(uid, host.id)) return ack?.({ error: 'blocked' });
    if (now() - (lastKnock.get(host.id) || 0) < 10_000) return ack?.({ error: 'slow' });
    lastKnock.set(host.id, now());
    emitTo(host.id, 'knock', { fromId: uid, from: p.username, fromName: p.name, appearance: p.appearance });
    ack?.({ ok: true });
  });
  socket.on('knock:reply', ({ fromId, accept } = {}) => {
    if (!online.has(fromId)) return;
    if (accept) {
      addInvite(uid, fromId);
      bumpStats(fromId, ['visits']);
      bumpStats(uid, ['hosted_visit']);
    }
    emitTo(fromId, 'knock:reply', { host: p.username, hostId: uid, accept: !!accept });
  });
  socket.on('invite:reply', ({ fromId, accept } = {}) => {
    if (online.has(fromId)) emitTo(fromId, 'toast', { text: accept ? [`🏠 @${p.username} amekubali — anakuja!`, `🏠 @${p.username} accepted — on the way!`] : [`@${p.username} hawezi kuja sasa.`, `@${p.username} can't come right now.`] });
  });
  const leaveHome = () => {
    if (!p.home) return;
    socket.to(`home:${p.home}`).emit('home:leave', { id: uid });
    socket.leave(`home:${p.home}`);
    p.home = null;
  };
  socket.on('home:enter', (hostId, ack) => {
    hostId = Number(hostId) || uid;
    if (!canVisit(uid, hostId)) return ack?.({ error: 'not_invited' });
    leaveHome();
    p.home = hostId;
    p.homePos = { x: 0, z: 3.5, ry: Math.PI, mode: 'idle' };
    socket.join(`home:${hostId}`);
    const others = [...online].filter(([id, o]) => id !== uid && o.home === hostId).map(([id, o]) => ({ id, username: o.username, name: o.name, appearance: o.appearance, ...o.homePos }));
    socket.to(`home:${hostId}`).emit('home:join', { id: uid, username: p.username, name: p.name, appearance: p.appearance, ...p.homePos });
    if (p.inside !== 'home') {
      p.inside = 'home';
      broadcast('player:inside', { id: uid, inside: 'home' });
    }
    ack?.({ ok: true, others });
  });
  socket.on('home:pos', (d = {}) => {
    if (!p.home || !Number.isFinite(d.x) || !Number.isFinite(d.z)) return;
    p.homePos = { x: d.x, z: d.z, y: Number(d.y) || 0, ry: Number(d.ry) || 0, mode: typeof d.mode === 'string' ? d.mode.slice(0, 10) : 'idle' };
    socket.to(`home:${p.home}`).emit('home:pos', { id: uid, ...p.homePos });
  });
  socket.on('home:leave', leaveHome);

  socket.on('jump', () => {
    const t = now();
    if (t - (p.lastJump || 0) < 400) return;
    p.lastJump = t;
    socket.broadcast.emit('jump', { id: uid });
  });

  registerInteractions(socket, uid);

  // Walking around inside a venue/room: relay your spot to everyone in the same room.
  attachVoice(socket, uid, p);
  attachWatch(socket, uid, p);
  lift.attachLift(socket, uid, p);

  socket.on('scene:pos', (d = {}) => {
    const x = Number(d.x), z = Number(d.z), ry = Number(d.ry);
    if (![x, z, ry].every(Number.isFinite) || Math.abs(x) > 40 || Math.abs(z) > 40) return;
    const t = now();
    if (t - (p.lastScenePos || 0) < 90) return;
    p.lastScenePos = t;
    const room = p.inside || (p.busy && p.busy.endsAt > t ? p.busy.placeId : null);
    if (!room) return;
    const host = p.host || null;
    const mode = typeof d.mode === 'string' && d.mode.length <= 10 ? d.mode : null;
    const out = { id: uid, x, z, ry, m: !!d.m, mode, y: Number.isFinite(Number(d.y)) ? Math.max(0, Math.min(60, Number(d.y))) : 0 };
    for (const [id, o] of online) {
      if (id === uid) continue;
      const theirs = o.inside || (o.busy && o.busy.endsAt > t ? o.busy.placeId : null);
      if (theirs === room && (o.host || null) === host) emitTo(id, 'scene:pos', out);
    }
  });

  socket.on('emote', (e) => {
    if (typeof e === 'string' && e.length <= 8) broadcast('emote', { id: uid, e });
  });

  socket.on('disconnect', () => {
    if (p.sockets.size <= 1) { leaveVoice(uid); leaveWatch(uid); lift.leave(uid); }
    if (p.home) socket.to(`home:${p.home}`).emit('home:leave', { id: uid });
    p.sockets.delete(socket.id);
    if (p.sockets.size) return;
    online.delete(uid);
    saveFields(uid, { x: p.x, z: p.z, lastSeen: now() });
    broadcast('player:leave', { id: uid });
    broadcast('online', online.size);
  });
});

// Batched movement broadcast at 10Hz.
setInterval(() => {
  if (!pendingMoves.size) return;
  io.emit('moves', [...pendingMoves.values()]);
  pendingMoves.clear();
}, 100);

// Pre-generate the shared welcome phrases so the first welcome plays straight away.
setTimeout(() => import('./live.js').then((m) => m.warmVoice()).catch(() => {}), 5000);

// Needs decay for online players + position flush.
setInterval(() => {
  const tx = db.transaction(() => {
    for (const [uid, p] of online) {
      const u = getUser(uid);
      if (!u) continue;
      // Sleeping / busy players don't decay while the activity runs.
      const needs = u.busy && u.busy.endsAt > now() ? u.needs : decayNeeds(u);
      const health = neglectHealth(u, needs) ?? afya.planRegen(uid, u.health ?? 100);
      saveFields(uid, { needs, x: p.x, z: p.z, lastSeen: now(), ...(health != null ? { health } : {}) });
      emitTo(uid, 'needs', { needs, mood: moodOf(needs), health: health ?? u.health });
    }
  });
  tx();
}, NEED_TICK_SECONDS * 1000);

// Mayor elections: decide last week's winner once the week rolls over.
mayorRef.current = currentMayor;
const checkElection = () => {
  try {
    const won = settleElection();
    if (won) {
      newsStory.mayor({ id: won.id, username: won.username }, won.votes);
      broadcast('toast', { text: [`🏛️ @${won.username} ndiye Mkuu wa Mkoa mpya wa Dar! (kura ${won.votes})`, `🏛️ @${won.username} is Dar's new Mayor! (${won.votes} votes)`] });
      broadcast('world', worldState());
    }
  } catch (e) { console.error('[election]', e); }
};
checkElection();
setInterval(checkElection, 60_000);
// Press: milestones, rich list, rivalries. Guards whose contract ran out go home.
startNews({ netWorth: (id) => netWorth(id) });
setInterval(() => { try { guardsTick(); } catch (e) { console.error('[guards]', e.message); } }, 60_000);
// Economy: stock market ticks; property of long-idle owners is bought back by the bank.
import('./stocks.js').then((m) => m.startMarket());
import('./street.js').then((m) => setInterval(() => { try { m.decayTick(); } catch (e) { console.error('[street]', e.message); } }, 3000));
import('./buyback.js').then((m) => {
  const run = () => m.buybackTick(() => broadcast('world', worldState()));
  setTimeout(run, 60_000);
  setInterval(run, 3600_000);
});
// Shop rent: reminders, charges, grace period and closing (every 5 minutes).
setInterval(() => { try { shopRentTick(); } catch (e) { console.error('[rent]', e.message); } }, 5 * 60_000);

/** Is a public party running at this venue right now? */
function partyLiveAt(placeId) {
  return !!db.prepare('SELECT 1 FROM events WHERE cancelled = 0 AND place_id = ? AND starts_at <= ? AND starts_at + ? >= ?').get(placeId, now(), EVENT_LIMITS.windowAfterMs, now());
}

// Event reminders: ping everyone who RSVP'd when an event starts.
setInterval(() => {
  const due = db.prepare('SELECT e.*, u.username host FROM events e JOIN users u ON u.id = e.host_id WHERE e.cancelled = 0 AND e.notified = 0 AND e.starts_at <= ?').all(now());
  for (const e of due) {
    db.prepare('UPDATE events SET notified = 1 WHERE id = ?').run(e.id);
    for (const r of db.prepare('SELECT user_id FROM event_rsvps WHERE event_id = ?').all(e.id))
      emitTo(r.user_id, 'event:start', { id: e.id, title: e.title, placeId: e.place_id, host: e.host, hostId: e.host_id });
    // Everyone sees the LIVE chip; the whole city can join.
    broadcast('events:changed', {});
  }
}, 30_000);

// Settle pending top-ups in the background (webhook-free, idempotent). Walks the pending set in
// batches with a cursor so 25+ abandoned pushes can't starve newer top-ups, and never overlaps runs.
let topupCursor = 0;
let settling = false;
setInterval(async () => {
  if (settling) return;
  settling = true;
  try {
    const rows = db.prepare("SELECT * FROM topups WHERE status = 'pending' AND id > ? ORDER BY id LIMIT 25").all(topupCursor);
    topupCursor = rows.length < 25 ? 0 : rows[rows.length - 1].id;
    for (const t of rows) await settleTopup(t);
  } finally {
    settling = false;
  }
}, 15_000);

server.listen(PORT, () => console.log(`🇹🇿 Bongo Life server on http://localhost:${PORT}`));
