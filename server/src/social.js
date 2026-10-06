// Social glue: home invites (in memory, short-lived) and who may visit whose home.
import { db, now } from './db.js';
import { EVENT_LIMITS } from '../../shared/world.js';

const INVITE_TTL = 15 * 60_000;
const invites = new Map(); // `${hostId}:${guestId}` -> expiresAt

export function addInvite(hostId, guestId) {
  invites.set(`${hostId}:${guestId}`, now() + INVITE_TTL);
}
export function hasInvite(hostId, guestId) {
  const t = invites.get(`${hostId}:${guestId}`);
  if (!t) return false;
  if (t < now()) {
    invites.delete(`${hostId}:${guestId}`);
    return false;
  }
  return true;
}
setInterval(() => {
  const t = now();
  for (const [k, exp] of invites) if (exp < t) invites.delete(k);
}, 60_000).unref();

const rsvpHome = db.prepare(`SELECT 1 FROM events e JOIN event_rsvps r ON r.event_id = e.id
  WHERE e.host_id = ? AND r.user_id = ? AND e.place_id = 'home' AND e.cancelled = 0 AND e.starts_at - ? <= ? AND e.starts_at + ? >= ? LIMIT 1`);

/** A guest may enter a home if it's their own, they were invited, or they RSVP'd to a party there that's on now. */
export function canVisit(guestId, hostId) {
  if (guestId === hostId) return true;
  if (hasInvite(hostId, guestId)) return true;
  const t = now();
  return !!rsvpHome.get(hostId, guestId, EVENT_LIMITS.windowBeforeMs, t, EVENT_LIMITS.windowAfterMs, t);
}

export const isFriend = (a, b) =>
  !!db.prepare('SELECT 1 FROM contacts x JOIN contacts y ON y.user_id = x.contact_id AND y.contact_id = x.user_id WHERE x.user_id = ? AND x.contact_id = ?').get(a, b);
