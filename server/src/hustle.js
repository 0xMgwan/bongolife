// Hustles: small businesses with unlimited supply (no map spot) — chips stalls, bodas, M-Pesa
// agents, daladalas… Each earns per 6-hour shift minus running costs, sometimes breaks down,
// and pays out with the rest of your income.
import { db, addMoney, GameError, now } from './db.js';
import { HUSTLES, hustleById, HUSTLE } from '../../shared/world.js';

db.exec(`CREATE TABLE IF NOT EXISTS hustles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL, kind TEXT NOT NULL,
  bought_at INTEGER NOT NULL, last_paid INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS hustles_user ON hustles(user_id);`);
const q = {
  mine: db.prepare('SELECT * FROM hustles WHERE user_id = ? ORDER BY id'),
  one: db.prepare('SELECT * FROM hustles WHERE id = ? AND user_id = ?'),
  insert: db.prepare('INSERT INTO hustles (user_id, kind, bought_at, last_paid) VALUES (?, ?, ?, ?)'),
  remove: db.prepare('DELETE FROM hustles WHERE id = ?'),
  pay: db.prepare('UPDATE hustles SET last_paid = ? WHERE id = ?'),
};

// Deterministic per hustle & shift so re-checking can't re-roll a breakdown.
function rnd(a, b) {
  let h = (a * 2654435761) ^ (b * 1597334677);
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
/** Finished shifts since the last payout (capped), each with its net. */
function shifts(row, t = now()) {
  const h = hustleById[row.kind];
  const full = Math.floor((t - row.last_paid) / HUSTLE.periodMs);
  const n = Math.min(HUSTLE.maxPeriods, Math.max(0, full));
  let net = 0;
  let broke = 0;
  for (let i = 0; i < n; i++) {
    const idx = Math.floor(row.last_paid / HUSTLE.periodMs) + i;
    const earn = (h.earn[0] + rnd(row.id, idx) * (h.earn[1] - h.earn[0])) / 4; // earn is per day
    const down = rnd(idx, row.id + 11) < h.breakChance;
    if (down) broke++;
    net += Math.max(0, earn - h.cost / 4 - (down ? h.repair : 0));
  }
  return { net: Math.round(net / 100) * 100, full, broke };
}
export const hustlePending = (uid, t = now()) => q.mine.all(uid).reduce((s, r) => s + shifts(r, t).net, 0);
/** Called from collectIncome. */
export function collectHustles(uid, t = now()) {
  let total = 0;
  for (const r of q.mine.all(uid)) {
    const { net, full } = shifts(r, t);
    if (!full) continue;
    total += net;
    q.pay.run(full > HUSTLE.maxPeriods ? t : r.last_paid + full * HUSTLE.periodMs, r.id);
  }
  return total;
}
export const hustleValue = (uid) => q.mine.all(uid).reduce((s, r) => s + (hustleById[r.kind]?.price || 0) * HUSTLE.resale, 0);

export function view(uid) {
  const t = now();
  const rows = q.mine.all(uid);
  const owned = HUSTLES.map((h) => {
    const mine = rows.filter((r) => r.kind === h.id);
    const s = mine.map((r) => shifts(r, t));
    return { ...h, count: mine.length, pending: s.reduce((a, x) => a + x.net, 0), broke: s.reduce((a, x) => a + x.broke, 0), ids: mine.map((r) => r.id) };
  });
  return { hustles: owned, rules: HUSTLE, total: rows.length, pending: owned.reduce((a, h) => a + h.pending, 0) };
}
export const buy = db.transaction((uid, kind) => {
  const h = hustleById[kind];
  if (!h) throw new GameError(['Haipo', 'Not found'], 404);
  if (q.mine.all(uid).filter((r) => r.kind === kind).length >= HUSTLE.maxEach) throw new GameError([`Kikomo ni ${HUSTLE.maxEach} kwa aina moja.`, `The limit is ${HUSTLE.maxEach} of one kind.`]);
  addMoney(uid, -h.price, 'purchase', `${h.emoji} ${h.name[0]}`);
  q.insert.run(uid, kind, now(), now());
  return view(uid);
});
export const sell = db.transaction((uid, kind) => {
  const h = hustleById[kind];
  const r = h && q.mine.all(uid).filter((x) => x.kind === kind).pop();
  if (!r) throw new GameError(['Huna hii.', "You don't own one."], 404);
  q.remove.run(r.id);
  const got = Math.round(h.price * HUSTLE.resale);
  addMoney(uid, got, 'sale', `${h.emoji} Umeuza ${h.name[0]}`);
  return { got, ...view(uid) };
});
