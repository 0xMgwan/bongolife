import express from 'express';
import compression from 'compression';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { Server } from 'socket.io';
import { NEED_TICK_SECONDS, isWater, moodOf, ENTERABLE, placeById, EVENT_SCENES, EVENT_LIMITS, HANGOUT_PLACES } from '../../shared/world.js';
import { db, getUser, saveFields, now, UPLOAD_DIR, getSettings } from './db.js';
import { verifyToken } from './auth.js';
import { api, settleTopup, applyTopupStatus } from './routes/api.js';
import { verifyNtzsWebhook } from './payments/index.js';
import { online, setIO, publicPlayer, broadcast, emitTo } from './presence.js';
import { decayNeeds, vehicleSummary, neglectHealth, worldState, mayorRef } from './game.js';
import { settleElection, currentMayor } from './election.js';
import { isBlocked } from './crime.js';
import { addInvite, canVisit } from './social.js';

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
      inside: null,
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
    // Loose anti-teleport: ignore jumps larger than a fast car could make between packets.
    if (Math.hypot(d.x - p.x, d.z - p.z) > 40) return socket.emit('teleport', { pos: [p.x, p.z] });
    if (p.inside && d.m) {
      // Walking away means you left the venue.
      p.inside = null;
      broadcast('player:inside', { id: uid, inside: null });
    }
    if (isWater(d.x, d.z)) return;
    p.x = d.x;
    p.z = d.z;
    p.ry = Number.isFinite(d.ry) ? d.ry : p.ry;
    p.m = d.m === 2 ? 2 : d.m ? 1 : 0; // 2 = running
    pendingMoves.set(uid, [uid, +p.x.toFixed(2), +p.z.toFixed(2), +p.ry.toFixed(2), p.m]);
  });

  socket.on('chat', (text) => {
    text = cleanText(text);
    if (!text) return;
    const t = now();
    if (!getSettings().chatEnabled) return socket.emit('toast', { text: ['Chat imefungwa kwa muda.', 'Chat is temporarily disabled.'] });
    const muted = getUser(uid).mutedUntil;
    if (muted && muted > t) return socket.emit('toast', { text: ['Umezuiwa kuchat kwa muda.', 'You are muted for now.'] });
    if (t - p.lastChat < 1200) return socket.emit('toast', { text: ['Pole pole na meseji 😅', 'Slow down with the messages 😅'] });
    p.lastChat = t;
    const info = insertMsg.run(uid, null, text, t);
    broadcast('chat', { mid: info.lastInsertRowid, id: uid, username: p.username, name: p.name, text, at: t });
    // Chatting fills the social need a little.
    const u = getUser(uid);
    saveFields(uid, { needs: { ...u.needs, social: Math.min(100, (u.needs.social ?? 50) + 2) } });
  });

  socket.on('dm', ({ to, text } = {}, ack) => {
    text = cleanText(text);
    const target = typeof to === 'string' && db.prepare('SELECT id, username FROM users WHERE username = ?').get(to.replace(/^@/, ''));
    if (!text || !target || target.id === uid) return ack?.({ error: 'Ujumbe haukutumwa' });
    if (isBlocked(uid, target.id)) return ack?.({ error: 'blocked' });
    const t = now();
    const muted = getUser(uid).mutedUntil;
    if (muted && muted > t) return ack?.({ error: 'muted' });
    if (t - (p.lastDm || 0) < 400) return ack?.({ error: 'Pole pole' });
    p.lastDm = t;
    const info = insertMsg.run(uid, target.id, text, t);
    const msg = { id: info.lastInsertRowid, from_id: uid, to_id: target.id, from: p.username, fromName: p.name, body: text, created_at: t };
    emitTo(target.id, 'dm', msg);
    for (const sid of p.sockets) if (sid !== socket.id) io.to(sid).emit('dm', msg);
    ack?.({ ok: true, msg });
  });

  // Walk into / out of a venue. Must be standing near it.
  socket.on('inside', (placeId) => {
    // In custody you stay at the station / court.
    const j = getUser(uid)?.jail;
    if (j && (p.inside === 'polisi' || p.inside === 'mahakama') && placeId !== p.inside) return socket.emit('player:inside', { id: uid, inside: p.inside });
    let inside = null;
    if (placeId === 'home') inside = 'home';
    else if (placeId && (ENTERABLE[placeId] || (EVENT_SCENES[placeId] && partyLiveAt(placeId)))) {
      const pl = placeById[placeId];
      const dx = Math.max(Math.abs(p.x - pl.pos[0]) - pl.size[0] / 2, 0);
      const dz = Math.max(Math.abs(p.z - pl.pos[1]) - pl.size[1] / 2, 0);
      if (Math.hypot(dx, dz) > 16) return socket.emit('inside:denied', placeId);
      inside = placeId;
    }
    if (inside !== 'home') leaveHome();
    if (p.inside === inside) return;
    p.inside = inside;
    broadcast('player:inside', { id: uid, inside });
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

  socket.on('emote', (e) => {
    if (typeof e === 'string' && e.length <= 8) broadcast('emote', { id: uid, e });
  });

  socket.on('disconnect', () => {
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

// Needs decay for online players + position flush.
setInterval(() => {
  const tx = db.transaction(() => {
    for (const [uid, p] of online) {
      const u = getUser(uid);
      if (!u) continue;
      // Sleeping / busy players don't decay while the activity runs.
      const needs = u.busy && u.busy.endsAt > now() ? u.needs : decayNeeds(u);
      const health = neglectHealth(u, needs);
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
      broadcast('toast', { text: [`🏛️ @${won.username} ndiye Mkuu wa Mkoa mpya wa Dar! (kura ${won.votes})`, `🏛️ @${won.username} is Dar's new Mayor! (${won.votes} votes)`] });
      broadcast('world', worldState());
    }
  } catch (e) { console.error('[election]', e); }
};
checkElection();
setInterval(checkElection, 60_000);

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
