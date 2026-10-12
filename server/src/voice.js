// Live voice rooms: players in the same venue can talk. Audio flows peer-to-peer (WebRTC); the
// server only relays the connection set-up between people in the same room. Mesh: max 8 per room.
import { online, emitTo } from './presence.js';
import { isBlocked } from './crime.js';
import { now } from './db.js';

export const VOICE_MAX = 8;
const rooms = new Map(); // room -> Set(userId)
const roomOf = (p) => p.inside || (p.busy && p.busy.endsAt > now() ? p.busy.placeId : null);

function members(room) {
  return [...(rooms.get(room) || [])].map((id) => ({ id, username: online.get(id)?.username || '?' }));
}
function tellRoom(room) {
  // Everyone in the venue (in voice or not) sees how many are live.
  const n = rooms.get(room)?.size || 0;
  for (const [id, o] of online) if (roomOf(o) === room) emitTo(id, 'voice:count', { room, n, members: members(room) });
}
export function leaveVoice(uid) {
  for (const [room, set] of rooms) {
    if (!set.delete(uid)) continue;
    for (const id of set) emitTo(id, 'voice:left', { id: uid });
    if (!set.size) rooms.delete(room);
    tellRoom(room);
  }
}

export function attachVoice(socket, uid, p) {
  socket.on('voice:join', (_, ack) => {
    const room = roomOf(p);
    if (!room) return ack?.({ error: 'not_inside' });
    leaveVoice(uid);
    const set = rooms.get(room) || new Set();
    if (set.size >= VOICE_MAX) return ack?.({ error: 'full' });
    const peers = members(room).filter((m) => !isBlocked(uid, m.id));
    set.add(uid);
    rooms.set(room, set);
    for (const m of peers) emitTo(m.id, 'voice:joined', { id: uid, username: p.username });
    ack?.({ ok: true, room, peers, ice: iceServers() });
    tellRoom(room);
  });
  socket.on('voice:signal', ({ to, data } = {}) => {
    const room = [...rooms].find(([, s]) => s.has(uid))?.[0];
    if (!room || !rooms.get(room).has(to) || isBlocked(uid, to)) return;
    if (JSON.stringify(data || {}).length > 20_000) return;
    emitTo(to, 'voice:signal', { from: uid, data });
  });
  socket.on('voice:leave', () => leaveVoice(uid));
  socket.on('voice:count?', () => { const room = roomOf(p); if (room) emitTo(uid, 'voice:count', { room, n: rooms.get(room)?.size || 0, members: members(room) }); });
}

/** STUN always; TURN if configured (helps people behind strict mobile networks). */
export function iceServers() {
  const list = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
  if (process.env.TURN_URL) list.push({ urls: process.env.TURN_URL.split(','), username: process.env.TURN_USERNAME || '', credential: process.env.TURN_PASSWORD || '' });
  return list;
}
