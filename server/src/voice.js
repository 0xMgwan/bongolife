// Voice: live rooms (everyone in a venue) and calls (friends, 1:1 or group). Audio flows
// peer-to-peer over WebRTC; the server only relays the set-up between members of the same room,
// and hands out ICE servers — STUN, plus a TURN relay for strict mobile networks (Cloudflare
// TURN via CF_TURN_KEY_ID + CF_TURN_API_TOKEN, or any TURN via TURN_URL/TURN_USERNAME/TURN_PASSWORD).
import crypto from 'node:crypto';
import { online, emitTo } from './presence.js';
import { isBlocked } from './crime.js';
import { db, now, getUser } from './db.js';
import { notify } from './push.js';

export const VOICE_MAX = 8;
export const CALL_MAX = 6;
const RING_MS = 35_000;
const rooms = new Map(); // key -> Set(userId)   key = 'place:<id>' | 'call:<id>'
const calls = new Map(); // callId -> { id, host, invited: Set, ringing: Map(uid -> timer), joined: boolean }
const roomOf = (p) => (p.inside && p.host ? `${p.inside}~${p.host}` : p.inside) || (p.busy && p.busy.endsAt > now() ? p.busy.placeId : null);
const nameOf = (id) => online.get(id)?.username || getUser(id)?.username || '?';
const areFriends = (a, b) => !!db.prepare('SELECT 1 FROM contacts x JOIN contacts y ON y.user_id = x.contact_id AND y.contact_id = x.user_id WHERE x.user_id = ? AND x.contact_id = ?').get(a, b);

function members(key) {
  return [...(rooms.get(key) || [])].map((id) => ({ id, username: nameOf(id) }));
}
function tellPlace(key) {
  if (!key.startsWith('place:')) return;
  const place = key.slice(6);
  const n = rooms.get(key)?.size || 0;
  for (const [id, o] of online) if (roomOf(o) === place) emitTo(id, 'voice:count', { room: place, n, members: members(key) });
}
function tellCall(call) {
  const view = { callId: call.id, host: nameOf(call.host), members: members(`call:${call.id}`), ringing: [...call.ringing.keys()].map(nameOf) };
  for (const id of new Set([...call.invited, call.host])) emitTo(id, 'call:update', view);
}
function endCall(call, reason = 'ended') {
  for (const t of call.ringing.values()) clearTimeout(t);
  for (const id of new Set([...call.invited, call.host])) emitTo(id, 'call:ended', { callId: call.id, reason });
  calls.delete(call.id);
}

export function leaveVoice(uid) {
  for (const [key, set] of rooms) {
    if (!set.delete(uid)) continue;
    for (const id of set) emitTo(id, 'voice:left', { id: uid });
    if (!set.size) rooms.delete(key);
    tellPlace(key);
    if (key.startsWith('call:')) {
      const call = calls.get(key.slice(5));
      if (call) {
        // A call ends when fewer than two people are left in it and nobody else is still ringing.
        if ((rooms.get(key)?.size || 0) < 2 && !call.ringing.size) endCall(call);
        else tellCall(call);
      }
    }
  }
}

function ring(call, from, toId) {
  if (call.ringing.has(toId) || rooms.get(`call:${call.id}`)?.has(toId)) return;
  call.invited.add(toId);
  const caller = getUser(from);
  if (!online.has(toId)) {
    notify(toId, [`📞 Simu uliyokosa kutoka @${caller.username}`, `📞 Missed call from @${caller.username}`], { title: 'Bongo Life', tag: `call-${from}` }).catch(() => {});
    return;
  }
  emitTo(toId, 'call:ring', { callId: call.id, from: { id: caller.id, username: caller.username, name: caller.name, appearance: caller.appearance }, group: [...call.invited].filter((i) => i !== toId).map(nameOf) });
  call.ringing.set(toId, setTimeout(() => {
    call.ringing.delete(toId);
    emitTo(toId, 'call:missed', { callId: call.id, from: caller.username });
    notify(toId, [`📞 Simu uliyokosa kutoka @${caller.username}`, `📞 Missed call from @${caller.username}`], { tag: `call-${from}` }).catch(() => {});
    if ((rooms.get(`call:${call.id}`)?.size || 0) < 2 && !call.ringing.size) endCall(call, 'no_answer');
    else tellCall(call);
  }, RING_MS));
}

export function attachVoice(socket, uid, p) {
  // Join the voice of the venue you're in, or a call you were invited to.
  socket.on('voice:join', async (opts, ack) => {
    let key;
    if (opts?.call) {
      const call = calls.get(String(opts.call));
      if (!call || (call.host !== uid && !call.invited.has(uid))) return ack?.({ error: 'no_call' });
      key = `call:${call.id}`;
      const t = call.ringing.get(uid);
      if (t) { clearTimeout(t); call.ringing.delete(uid); }
    } else {
      const room = roomOf(p);
      if (!room) return ack?.({ error: 'not_inside' });
      key = `place:${room}`;
    }
    leaveVoice(uid);
    const set = rooms.get(key) || new Set();
    if (set.size >= (key.startsWith('call:') ? CALL_MAX : VOICE_MAX)) return ack?.({ error: 'full' });
    const peers = members(key).filter((m) => !isBlocked(uid, m.id));
    set.add(uid);
    rooms.set(key, set);
    for (const m of peers) emitTo(m.id, 'voice:joined', { id: uid, username: p.username });
    ack?.({ ok: true, key, peers, ice: await iceServers() });
    tellPlace(key);
    if (key.startsWith('call:')) tellCall(calls.get(key.slice(5)));
  });
  socket.on('voice:signal', ({ to, data } = {}) => {
    const key = [...rooms].find(([, s]) => s.has(uid))?.[0];
    if (!key || !rooms.get(key).has(to) || isBlocked(uid, to)) return;
    if (JSON.stringify(data || {}).length > 20_000) return;
    emitTo(to, 'voice:signal', { from: uid, data });
  });
  socket.on('voice:leave', () => leaveVoice(uid));
  socket.on('voice:count?', () => { const room = roomOf(p); if (room) emitTo(uid, 'voice:count', { room, n: rooms.get(`place:${room}`)?.size || 0, members: members(`place:${room}`) }); });

  // ---- calls (friends only)
  const friendIds = (names) => {
    const out = [];
    for (const n of (Array.isArray(names) ? names : []).slice(0, CALL_MAX - 1)) {
      const u = typeof n === 'string' && db.prepare('SELECT id FROM users WHERE username = ? AND banned_at IS NULL').get(n.replace(/^@/, ''));
      if (u && u.id !== uid && areFriends(uid, u.id) && !isBlocked(uid, u.id)) out.push(u.id);
    }
    return out;
  };
  socket.on('call:start', ({ to } = {}, ack) => {
    const ids = friendIds(to);
    if (!ids.length) return ack?.({ error: 'not_friends' });
    const call = { id: crypto.randomUUID().slice(0, 12), host: uid, invited: new Set(), ringing: new Map() };
    calls.set(call.id, call);
    for (const id of ids) ring(call, uid, id);
    const offline = ids.filter((id) => !online.has(id)).map(nameOf);
    if (!call.ringing.size) { calls.delete(call.id); return ack?.({ error: 'offline', offline }); }
    ack?.({ ok: true, callId: call.id, offline });
    tellCall(call);
  });
  socket.on('call:add', ({ callId, to } = {}, ack) => {
    const call = calls.get(String(callId));
    if (!call || !rooms.get(`call:${call.id}`)?.has(uid)) return ack?.({ error: 'no_call' });
    const ids = friendIds(to).filter((id) => call.invited.size + 1 < CALL_MAX);
    for (const id of ids) ring(call, uid, id);
    ack?.({ ok: true });
    tellCall(call);
  });
  socket.on('call:decline', ({ callId } = {}) => {
    const call = calls.get(String(callId));
    if (!call) return;
    const t = call.ringing.get(uid);
    if (t) { clearTimeout(t); call.ringing.delete(uid); }
    for (const id of rooms.get(`call:${call.id}`) || []) emitTo(id, 'call:declined', { callId: call.id, by: p.username });
    if ((rooms.get(`call:${call.id}`)?.size || 0) < 2 && !call.ringing.size) endCall(call, 'declined');
    else tellCall(call);
  });
}

// ------------------------------------------------------------------ ICE
let cfIce = null;
/** STUN always; TURN when configured (Cloudflare credentials are fetched and cached). */
export async function iceServers() {
  const list = [{ urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'] }];
  if (process.env.CF_TURN_KEY_ID && process.env.CF_TURN_API_TOKEN) {
    if (!cfIce || Date.now() - cfIce.at > 6 * 3600_000) {
      try {
        const r = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${process.env.CF_TURN_KEY_ID}/credentials/generate-ice-servers`, {
          method: 'POST',
          headers: { authorization: `Bearer ${process.env.CF_TURN_API_TOKEN}`, 'content-type': 'application/json' },
          body: JSON.stringify({ ttl: 86_400 }),
          signal: AbortSignal.timeout(6000),
        });
        const j = await r.json();
        if (r.ok && j.iceServers) cfIce = { at: Date.now(), servers: Array.isArray(j.iceServers) ? j.iceServers : [j.iceServers] };
        else console.error('[voice] cloudflare turn', r.status, JSON.stringify(j).slice(0, 200));
      } catch (e) { console.error('[voice] cloudflare turn', e.message); }
    }
    if (cfIce) list.push(...cfIce.servers);
  }
  if (process.env.TURN_URL) list.push({ urls: process.env.TURN_URL.split(','), username: process.env.TURN_USERNAME || '', credential: process.env.TURN_PASSWORD || '' });
  return list;
}
export const turnConfigured = () => !!((process.env.CF_TURN_KEY_ID && process.env.CF_TURN_API_TOKEN) || process.env.TURN_URL);
