import { io } from 'socket.io-client';
import { token } from './api.js';
import { useStore } from './store.js';
import { L } from './i18n.js';
import { sfx } from './audio.js';

// ---- Mutable, per-frame game state kept outside React for performance.
export const local = {
  x: 0, z: 0, ry: 0, moving: false,
  target: null, // [x, z]
  arrive: null, // callback when target reached
  teleported: 0,
};
export const input = { jx: 0, jz: 0, keys: new Set() };
// Camera orientation the player controls by dragging (yaw around the player, pitch above the ground).
export const view = { yaw: 0, pitch: 1.0, mapX: 0, mapZ: 0, mapDist: 150, homeYaw: 0.75, homePitch: 0.95, homeDist: 30 };
// id -> { id, name, username, appearance, v, busy, x, z, ry, m, tx, tz, tr, bubble: {text, until}, emote }
export const remotes = new Map();
export const bubbles = new Map(); // userId -> { text, until }
export const emotes = new Map(); // userId -> { e, until }
// Other people in the same home as you: id -> { id, username, name, appearance, x, z, ry, mode, y }
export const homeGuests = new Map();
// Positions of NPC traffic, written by City every frame (for collisions).
export const trafficCars = [];

let socket = null;
const bump = () => useStore.setState((s) => ({ roster: s.roster + 1 }));
const bumpHome = () => useStore.setState((s) => ({ homeRoster: s.homeRoster + 1 }));

export function connect() {
  if (socket) return socket;
  socket = io({ auth: { token: token.get() }, transports: ['websocket', 'polling'] });
  const st = () => useStore.getState();

  socket.on('connect_error', (e) => {
    if (e.message === 'unauthorized') st().logout();
    if (e.message === 'maintenance') st().toast(L('Bongo Life iko kwenye matengenezo 🔧', 'Bongo Life is under maintenance 🔧'), 'err');
  });
  socket.on('kicked', ({ reason }) => {
    socket.io.opts.reconnection = false;
    const msg = {
      banned: L('Akaunti yako imefungiwa.', 'Your account has been banned.'),
      maintenance: L('Bongo Life iko kwenye matengenezo 🔧', 'Bongo Life is under maintenance 🔧'),
    }[reason] || L('Umetolewa kwenye mchezo. Ingia tena.', 'You were signed out. Please log in again.');
    alert(msg);
    st().logout();
  });
  socket.on('announcement', (announcement) => useStore.setState({ announcement }));
  socket.on('chat:delete', ({ ids }) => {
    const del = new Set(ids);
    useStore.setState((s) => ({ publicFeed: s.publicFeed.filter((m) => !del.has(m.mid ?? m.id)) }));
  });
  socket.on('snapshot', ({ you, players }) => {
    remotes.clear();
    for (const p of players) remotes.set(p.id, { ...p, tx: p.x, tz: p.z, tr: p.ry });
    useStore.setState({ myId: you });
    bump();
  });
  socket.on('player:join', (p) => {
    remotes.set(p.id, { ...p, tx: p.x, tz: p.z, tr: p.ry });
    bump();
  });
  socket.on('player:leave', ({ id }) => {
    remotes.delete(id);
    bump();
  });
  socket.on('player:look', ({ id, appearance }) => {
    const r = remotes.get(id);
    if (r) { r.appearance = appearance; bump(); }
  });
  socket.on('player:vehicle', ({ id, v }) => {
    const r = remotes.get(id);
    if (r) { r.v = v; bump(); }
  });
  socket.on('player:busy', ({ id, busy }) => {
    const r = remotes.get(id);
    if (r) {
      r.busy = busy;
      bump();
    }
  });
  socket.on('player:inside', ({ id, inside }) => {
    if (id === st().myId) return useStore.setState({ inside });
    const r = remotes.get(id);
    if (r) {
      r.inside = inside;
      bump();
    }
  });
  socket.on('inside:denied', () => {
    useStore.setState({ inside: null });
    st().toast(L('Sogea karibu na mlango kwanza.', 'Get closer to the entrance first.'), 'err');
  });
  socket.on('moves', (list) => {
    for (const [id, x, z, ry, m] of list) {
      const r = remotes.get(id);
      if (r) { r.tx = x; r.tz = z; r.tr = ry; r.m = m; }
    }
  });
  socket.on('chat', (msg) => {
    bubbles.set(msg.id, { text: msg.text, until: Date.now() + 6000 });
    useStore.setState((s) => ({ publicFeed: [...s.publicFeed.slice(-40), msg] }));
  });
  socket.on('emote', ({ id, e }) => {
    emotes.set(id, { e, until: Date.now() + 3000 });
    sfx('pop');
  });
  socket.on('dm', (msg) => {
    const s = st();
    if (msg.from_id !== s.myId) {
      sfx('notify');
      const reading = s.phone === 'dm' && s.phoneArg === msg.from;
      if (!reading) {
        s.toast(`💬 @${msg.from}: ${msg.body.slice(0, 60)}`);
        if (s.me) useStore.setState({ me: { ...s.me, unread: (s.me.unread || 0) + 1 } });
      }
    }
    useStore.setState((x) => ({ dmVersion: x.dmVersion + 1, lastDm: msg }));
  });
  socket.on('needs', ({ needs, mood, health }) => {
    const me = st().me;
    if (me) useStore.setState({ me: { ...me, needs, mood, ...(health != null ? { health } : {}) } });
  });
  socket.on('invite', (inv) => {
    sfx('notify');
    useStore.setState({ invite: { ...inv, at: Date.now() } });
  });
  socket.on('event:start', (e) => {
    sfx('notify');
    st().toast(L(`🎉 "${e.title}" imeanza sasa! Fungua Matukio.`, `🎉 "${e.title}" is starting now! Open Events.`));
    useStore.setState((s) => ({ eventsVersion: s.eventsVersion + 1 }));
  });
  socket.on('home:join', (g) => { homeGuests.set(g.id, g); bumpHome(); sfx('pop'); });
  socket.on('home:pos', (g) => {
    const cur = homeGuests.get(g.id);
    if (cur) Object.assign(cur, g);
  });
  socket.on('home:leave', ({ id }) => { homeGuests.delete(id); bumpHome(); });
  socket.on('connect', () => {
    // Re-join the home room after a reconnect.
    const h = st().homeHost;
    if (h) enterHome(h);
  });
  socket.on('online', (n) => useStore.setState({ online: n }));
  socket.on('world', (world) => useStore.setState({ world }));
  socket.on('ads', (ads) => useStore.setState({ ads }));
  socket.on('teleport', ({ pos }) => {
    if (local.ride) return;
    local.x = pos[0];
    local.z = pos[1];
    local.target = null;
    local.teleported++;
  });
  socket.on('toast', ({ text, refresh }) => {
    st().toast(text);
    sfx(refresh ? 'cash' : 'notify');
    if (refresh) st().refreshMe().catch(() => {});
  });
  return socket;
}

export const getSocket = () => socket;

/** Join a home's live room (yours or one you're invited to). */
export function enterHome(hostId) {
  return new Promise((resolve) => {
    if (!socket?.connected) return resolve({ error: 'offline' });
    socket.emit('home:enter', hostId, (r) => {
      homeGuests.clear();
      for (const g of r?.others || []) homeGuests.set(g.id, g);
      bumpHome();
      resolve(r || {});
    });
  });
}
export function leaveHome() {
  homeGuests.clear();
  bumpHome();
  socket?.emit('home:leave');
}
let lastHome = 0;
let lastHomeKey = '';
export function sendHomePos(x, z, ry, mode, y = 0) {
  const t = performance.now();
  const key = `${x.toFixed(2)},${z.toFixed(2)},${mode}`;
  if (!socket?.connected || t - lastHome < 120 || key === lastHomeKey) return;
  lastHome = t;
  lastHomeKey = key;
  socket.emit('home:pos', { x, z, ry, mode, y });
}
export function sendInvite(username) {
  return new Promise((resolve) => {
    if (!socket?.connected) return resolve({ error: 'offline' });
    socket.emit('invite', { to: username }, (r) => resolve(r || {}));
  });
}
export function replyInvite(fromId, accept) {
  socket?.emit('invite:reply', { fromId, accept });
}

/** Walk into a venue (placeId) or back out (null). */
export function setInside(placeId) {
  useStore.setState({ inside: placeId });
  local.target = null;
  socket?.emit('inside', placeId);
  sendMove(true);
}

let lastSent = 0;
let lastPos = '';
export function sendMove(force = false) {
  if (!socket?.connected) return;
  const t = performance.now();
  if (!force && t - lastSent < 100) return;
  const key = `${local.x.toFixed(1)},${local.z.toFixed(1)},${local.ry.toFixed(1)},${local.moving}`;
  if (key === lastPos && !force) return;
  lastPos = key;
  lastSent = t;
  socket.emit('move', { x: local.x, z: local.z, ry: local.ry, m: local.moving ? 1 : 0 });
}

export function sendChat(text) {
  socket?.emit('chat', text);
}
export function sendEmote(e) {
  socket?.emit('emote', e);
}
export function sendDm(to, text) {
  return new Promise((resolve) => {
    if (!socket?.connected) return resolve({ error: L('Hakuna connection', 'No connection') });
    socket.emit('dm', { to, text }, resolve);
  });
}
