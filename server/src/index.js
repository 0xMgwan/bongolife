import express from 'express';
import compression from 'compression';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { Server } from 'socket.io';
import { NEED_TICK_SECONDS, isWater, moodOf, ENTERABLE, placeById } from '../../shared/world.js';
import { db, getUser, saveFields, now, UPLOAD_DIR, getSettings } from './db.js';
import { verifyToken } from './auth.js';
import { api, settleTopup, applyTopupStatus } from './routes/api.js';
import { verifyNtzsWebhook } from './payments/index.js';
import { online, setIO, publicPlayer, broadcast, emitTo } from './presence.js';
import { decayNeeds, vehicleSummary } from './game.js';

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
    p.m = d.m ? 1 : 0;
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
    let inside = null;
    if (placeId === 'home') inside = 'home';
    else if (placeId && ENTERABLE[placeId]) {
      const pl = placeById[placeId];
      const dx = Math.max(Math.abs(p.x - pl.pos[0]) - pl.size[0] / 2, 0);
      const dz = Math.max(Math.abs(p.z - pl.pos[1]) - pl.size[1] / 2, 0);
      if (Math.hypot(dx, dz) > 16) return socket.emit('inside:denied', placeId);
      inside = placeId;
    }
    if (p.inside === inside) return;
    p.inside = inside;
    broadcast('player:inside', { id: uid, inside });
  });

  socket.on('emote', (e) => {
    if (typeof e === 'string' && e.length <= 8) broadcast('emote', { id: uid, e });
  });

  socket.on('disconnect', () => {
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
      saveFields(uid, { needs, x: p.x, z: p.z, lastSeen: now() });
      emitTo(uid, 'needs', { needs, mood: moodOf(needs) });
    }
  });
  tx();
}, NEED_TICK_SECONDS * 1000);

// Settle pending top-ups in the background (webhook-free, idempotent).
setInterval(async () => {
  const rows = db.prepare("SELECT * FROM topups WHERE status = 'pending' ORDER BY id LIMIT 25").all();
  for (const t of rows) await settleTopup(t);
}, 15_000);

server.listen(PORT, () => console.log(`🇹🇿 Bongo Life server on http://localhost:${PORT}`));
