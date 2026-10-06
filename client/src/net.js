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
// id -> { id, name, username, appearance, v, busy, x, z, ry, m, tx, tz, tr, bubble: {text, until}, emote }
export const remotes = new Map();
export const bubbles = new Map(); // userId -> { text, until }
export const emotes = new Map(); // userId -> { e, until }

let socket = null;
const bump = () => useStore.setState((s) => ({ roster: s.roster + 1 }));

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
  socket.on('needs', ({ needs, mood }) => {
    const me = st().me;
    if (me) useStore.setState({ me: { ...me, needs, mood } });
  });
  socket.on('online', (n) => useStore.setState({ online: n }));
  socket.on('world', (world) => useStore.setState({ world }));
  socket.on('ads', (ads) => useStore.setState({ ads }));
  socket.on('teleport', ({ pos }) => {
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
