// Ulinzi: hire bodyguards by the day. They walk beside you, scare robbers off and slow
// an arrest down. Paid up front; dismissing early refunds the unused full days.
import { db, addMoney, GameError, now } from './db.js';
import { GUARDS, guardById } from '../../shared/world.js';
import { online, broadcast } from './presence.js';

const DAY = 86_400_000;
db.exec(`CREATE TABLE IF NOT EXISTS guards (
  user_id INTEGER PRIMARY KEY, tier TEXT NOT NULL, until INTEGER NOT NULL, hired_at INTEGER NOT NULL
);`);
const q = {
  get: db.prepare('SELECT * FROM guards WHERE user_id = ?'),
  set: db.prepare('INSERT INTO guards (user_id, tier, until, hired_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET tier = excluded.tier, until = excluded.until, hired_at = excluded.hired_at'),
  del: db.prepare('DELETE FROM guards WHERE user_id = ?'),
};

/** The guard tier protecting this player right now, or null. */
export function guardOf(uid) {
  const r = q.get.get(uid);
  if (!r || r.until < now()) return null;
  return { ...guardById[r.tier], until: r.until };
}
function announce(uid) {
  const g = guardOf(uid);
  const p = online.get(uid);
  if (p) p.guards = g?.men || 0;
  broadcast('player:guards', { id: uid, guards: g?.men || 0 });
}
export function view(uid) {
  return { current: guardOf(uid), tiers: GUARDS };
}
export const hire = db.transaction((uid, tierId, daysIn) => {
  const tier = guardById[tierId];
  const days = Math.max(1, Math.min(30, Math.floor(daysIn)));
  if (!tier) throw new GameError(['Haipo', 'Not found'], 404);
  const cur = guardOf(uid);
  // Same tier: extend. Other tier: unused days of the old one are credited.
  let credit = 0;
  if (cur && cur.id !== tier.id) credit = Math.floor((cur.until - now()) / DAY) * cur.perDay;
  const cost = tier.perDay * days - credit;
  if (cost > 0) addMoney(uid, -cost, 'spend', `${tier.emoji} ${tier.name[0]} · siku ${days}`);
  else if (cost < 0) addMoney(uid, -cost, 'refund', 'Marejesho ya ulinzi');
  const start = cur && cur.id === tier.id ? cur.until : now();
  q.set.run(uid, tier.id, start + days * DAY, now());
  announce(uid);
  return { tier, ...view(uid) };
});
export const dismiss = db.transaction((uid) => {
  const cur = guardOf(uid);
  if (!cur) return view(uid);
  const back = Math.floor((cur.until - now()) / DAY) * cur.perDay;
  q.del.run(uid);
  if (back > 0) addMoney(uid, back, 'refund', 'Marejesho ya ulinzi');
  announce(uid);
  return { refund: back, ...view(uid) };
});
/** Expired contracts: tell everyone the guards went home. */
export function expireTick() {
  for (const [uid, p] of online) if (p.guards && !guardOf(uid)) announce(uid);
}
