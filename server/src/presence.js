// In-memory presence for connected players. The DB stays the source of truth
// for everything except live position, which is flushed periodically.
export const online = new Map(); // userId -> { sockets:Set, x, z, ry, m, v, name, username, appearance, vehicle, busy, lastChat }
let io = null;

export const setIO = (server) => (io = server);
export const getIO = () => io;

export function emitTo(userId, event, data) {
  const p = online.get(userId);
  if (!p || !io) return;
  for (const sid of p.sockets) io.to(sid).emit(event, data);
}

export function broadcast(event, data) {
  io?.emit(event, data);
}

export function positionOf(user) {
  const p = online.get(user.id);
  return p ? [p.x, p.z] : [user.x, user.z];
}

export function publicPlayer(id, p) {
  return { id, name: p.name, username: p.username, appearance: p.appearance, x: p.x, z: p.z, ry: p.ry, m: p.m, v: p.vehicle, busy: p.busy };
}

export function onlineCount() {
  return online.size;
}

/** Disconnect every socket of a user (ban, force logout). */
export function kick(userId, reason = 'kicked') {
  const p = online.get(userId);
  if (!p || !io) return;
  for (const sid of p.sockets) {
    const sock = io.sockets.sockets.get(sid);
    sock?.emit('kicked', { reason });
    sock?.disconnect(true);
  }
}
