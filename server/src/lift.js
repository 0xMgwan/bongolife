// Lifts: give another player a ride in your car (or on the back of your boda), ask a driver for a
// lift, or drive across town to pick a friend up. Passengers follow the driver's position; the
// driver can drop everyone off, or at a place so they all walk in together.
import { online, emitTo, broadcast } from './presence.js';
import { db, getUser, saveFields, now } from './db.js';
import { isBlocked } from './crime.js';
import { notify } from './push.js';
import { liftSeats, LIFT, placeById } from '../../shared/world.js';
import { applyNeeds } from './game.js';

const cars = new Map(); // driverId -> Set(passengerId)
const riderOf = new Map(); // passengerId -> driverId
const asks = new Map(); // `${from}:${to}` -> { kind: 'offer' | 'request', at }
const pickups = new Map(); // passengerId -> driverId (accepted; the driver is on the way)

const nameOf = (id) => online.get(id)?.username || getUser(id)?.username || '?';
const seatsLeft = (did) => liftSeats(online.get(did)?.vehicle?.model) - (cars.get(did)?.size || 0);
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export const isRiding = (uid) => riderOf.has(uid);

function tell(did) {
  const list = [...(cars.get(did) || [])].map((id) => ({ id, username: nameOf(id) }));
  broadcast('lift:state', { driver: did, passengers: list });
}
export function snapshot() {
  return [...cars].map(([driver, set]) => ({ driver, passengers: [...set].map((id) => ({ id, username: nameOf(id) })) }));
}

function social(uid) {
  const u = getUser(uid);
  if (u) saveFields(uid, { needs: applyNeeds(u.needs, { social: 6, fun: 3 }) });
}

function board(did, pid) {
  const d = online.get(did);
  const p = online.get(pid);
  if (!d || !p || seatsLeft(did) <= 0) return false;
  pickups.delete(pid);
  if (!cars.has(did)) cars.set(did, new Set());
  cars.get(did).add(pid);
  riderOf.set(pid, did);
  Object.assign(p, { x: d.x, z: d.z, inside: null, host: null });
  broadcast('player:inside', { id: pid, inside: null });
  social(did);
  social(pid);
  emitTo(pid, 'toast', { text: [`🚗 Umepanda gari la @${d.username}`, `🚗 You hopped in with @${d.username}`] });
  emitTo(did, 'toast', { text: [`🚗 @${p.username} amepanda`, `🚗 @${p.username} got in`] });
  tell(did);
  return true;
}

/** Let a passenger out beside the car (or at a place's door, to walk in together). */
export function drop(pid, placeId = null) {
  const did = riderOf.get(pid);
  if (did == null) return;
  riderOf.delete(pid);
  cars.get(did)?.delete(pid);
  if (!cars.get(did)?.size) cars.delete(did);
  const d = online.get(did);
  const p = online.get(pid);
  if (p && d) {
    const side = (cars.get(did)?.size || 0) % 2 ? -1 : 1;
    const x = d.x + Math.cos(d.ry || 0) * 1.8 * side;
    const z = d.z - Math.sin(d.ry || 0) * 1.8 * side;
    Object.assign(p, { x, z });
    saveFields(pid, { x, z });
    emitTo(pid, 'teleport', { pos: [x, z] });
  }
  emitTo(pid, 'lift:dropped', { placeId: placeId && placeById[placeId] ? placeId : null });
  tell(did);
}
export function dropAll(did, placeId = null) {
  for (const pid of [...(cars.get(did) || [])]) drop(pid, placeId);
}

/** Called on every driver move: passengers ride along; pick-ups board when the car arrives. */
export function follow(did, d, onMoved) {
  if (cars.has(did) && !d.vehicle) dropAll(did);
  for (const pid of cars.get(did) || []) {
    const p = online.get(pid);
    if (!p) continue;
    p.x = d.x;
    p.z = d.z;
    p.ry = d.ry;
    onMoved(pid, p);
  }
  for (const [pid, wantDriver] of pickups) {
    if (wantDriver !== did) continue;
    const p = online.get(pid);
    if (p && dist(d, p) <= LIFT.boardDist) board(did, pid);
  }
}

export function leave(uid) {
  if (riderOf.has(uid)) drop(uid);
  if (cars.has(uid)) dropAll(uid);
  for (const [pid, did] of pickups) {
    if (pid === uid || did === uid) {
      pickups.delete(pid);
      emitTo(pid === uid ? did : pid, 'lift:cancelled', { by: nameOf(uid) });
    }
  }
}

// Drivers who park up (stop using the car) let everyone out.
setInterval(() => {
  for (const did of [...cars.keys()]) if (!online.get(did)?.vehicle) dropAll(did);
  const t = now();
  for (const [k, a] of asks) if (t - a.at > LIFT.askTtlMs) asks.delete(k);
}, 4000).unref();

export function attachLift(socket, uid, p) {
  socket.emit('lift:all', snapshot());
  const target = (to) => {
    const u = typeof to === 'string' && db.prepare('SELECT id, username FROM users WHERE lower(username) = lower(?)').get(to.replace(/^@/, ''));
    if (!u || u.id === uid) return { error: 'not_found' };
    if (isBlocked(uid, u.id)) return { error: 'blocked' };
    if (!online.has(u.id)) return { error: 'offline', u };
    return { u };
  };
  // Driver → someone: "hop in" (nearby) or "I'll come pick you up" (anywhere).
  socket.on('lift:offer', ({ to } = {}, ack) => {
    if (!liftSeats(p.vehicle?.model)) return ack?.({ error: 'no_car' });
    if (seatsLeft(uid) <= 0) return ack?.({ error: 'full' });
    const { u, error } = target(to);
    if (error === 'offline' && u) notify(u.id, [`🚗 @${p.username} anataka kukupa lifti — ingia kwenye mchezo`, `🚗 @${p.username} wants to give you a lift — hop into the game`], { tag: `lift-${uid}` }).catch(() => {});
    if (error) return ack?.({ error });
    if (riderOf.has(u.id)) return ack?.({ error: 'busy' });
    asks.set(`${uid}:${u.id}`, { kind: 'offer', at: now() });
    const o = online.get(u.id);
    emitTo(u.id, 'lift:ask', { fromId: uid, from: p.username, kind: 'offer', model: p.vehicle.model, far: dist(p, o) > LIFT.boardDist, meters: Math.round(dist(p, o)) });
    ack?.({ ok: true, to: u.username });
  });
  // Someone on foot → a driver: "can I get a lift?"
  socket.on('lift:request', ({ to } = {}, ack) => {
    if (riderOf.has(uid)) return ack?.({ error: 'busy' });
    const { u, error } = target(to);
    if (error) return ack?.({ error });
    const d = online.get(u.id);
    if (!liftSeats(d.vehicle?.model) || seatsLeft(u.id) <= 0) return ack?.({ error: 'no_car' });
    asks.set(`${uid}:${u.id}`, { kind: 'request', at: now() });
    emitTo(u.id, 'lift:ask', { fromId: uid, from: p.username, kind: 'request', far: dist(p, d) > LIFT.boardDist, meters: Math.round(dist(p, d)) });
    ack?.({ ok: true, to: u.username });
  });
  socket.on('lift:reply', ({ fromId, accept } = {}, ack) => {
    const key = `${fromId}:${uid}`;
    const a = asks.get(key);
    asks.delete(key);
    if (!a || now() - a.at > LIFT.askTtlMs || !online.has(fromId)) return ack?.({ error: 'expired' });
    if (!accept) {
      emitTo(fromId, 'toast', { text: [`@${p.username} amesema hapana kwa sasa.`, `@${p.username} said not right now.`] });
      return ack?.({ ok: true });
    }
    const did = a.kind === 'offer' ? fromId : uid;
    const pid = a.kind === 'offer' ? uid : fromId;
    const d = online.get(did);
    const pp = online.get(pid);
    if (!liftSeats(d?.vehicle?.model) || seatsLeft(did) <= 0) return ack?.({ error: 'no_car' });
    if (riderOf.has(pid)) return ack?.({ error: 'busy' });
    if (dist(d, pp) <= LIFT.boardDist) board(did, pid);
    else {
      // The driver heads over; the passenger waits where they are.
      pickups.set(pid, did);
      emitTo(did, 'lift:pickup', { id: pid, username: pp.username, x: pp.x, z: pp.z });
      emitTo(pid, 'lift:waiting', { driverId: did, driver: d.username });
    }
    ack?.({ ok: true });
  });
  socket.on('lift:drop', ({ id, placeId } = {}) => {
    if (id != null) { if (cars.get(uid)?.has(Number(id))) drop(Number(id), placeId); }
    else dropAll(uid, placeId);
  });
  socket.on('lift:leave', () => {
    if (riderOf.has(uid)) drop(uid);
    const did = pickups.get(uid);
    if (did != null) { pickups.delete(uid); emitTo(did, 'lift:cancelled', { by: p.username }); }
  });
  socket.on('lift:cancel', ({ id } = {}) => {
    const pid = Number(id);
    if (pickups.get(pid) === uid) { pickups.delete(pid); emitTo(pid, 'lift:cancelled', { by: p.username }); }
  });
  // Where's my passenger now? (they may have walked a bit)
  socket.on('lift:where', ({ id } = {}, ack) => {
    const pid = Number(id);
    const pp = pickups.get(pid) === uid && online.get(pid);
    ack?.(pp ? { x: pp.x, z: pp.z } : { error: 'none' });
  });
}
