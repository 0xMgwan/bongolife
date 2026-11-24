// Matamasha: the concert schedule, tickets, and who's going. Attending (being at the show)
// is a busy state run by game.js like any activity.
import { db, getUser, addMoney, GameError, now } from './db.js';
import { CONCERT, concertAt, concertSlot, ticketPrice, placeById } from '../../shared/world.js';

db.exec(`CREATE TABLE IF NOT EXISTS concert_tickets (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, slot INTEGER NOT NULL,
  tier TEXT NOT NULL, price INTEGER NOT NULL, bought_at INTEGER NOT NULL, attended INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, slot)
);
CREATE INDEX IF NOT EXISTS concert_tickets_slot ON concert_tickets(slot);`);

const q = {
  mine: db.prepare('SELECT * FROM concert_tickets WHERE user_id = ? AND slot = ?'),
  sold: db.prepare('SELECT COUNT(*) n FROM concert_tickets WHERE slot = ?'),
  going: db.prepare(`SELECT u.username, u.appearance, t.tier FROM concert_tickets t JOIN users u ON u.id = t.user_id
    WHERE t.slot = ? AND u.banned_at IS NULL ORDER BY CASE t.tier WHEN 'vvip' THEN 0 WHEN 'vip' THEN 1 ELSE 2 END, t.bought_at LIMIT 12`),
};

export const ticketOf = (uid, slot) => q.mine.get(uid, slot) || null;
export const markAttended = (uid, slot) => db.prepare('UPDATE concert_tickets SET attended = 1 WHERE user_id = ? AND slot = ?').run(uid, slot);

/** The show that's on now (or about to be) and the next few, with your tickets. */
export function view(uid) {
  const t = now();
  const first = concertSlot(t);
  const shows = [];
  for (let s = first; s < first + CONCERT.ahead; s++) {
    const c = concertAt(s);
    if (c.endsAt < t) continue;
    const mine = ticketOf(uid, s);
    shows.push({
      ...c, live: t >= c.startsAt && t < c.endsAt,
      prices: Object.fromEntries(CONCERT.tiers.map((tr) => [tr.id, ticketPrice(c, tr.id)])),
      sold: q.sold.get(s).n,
      going: q.going.all(s).map((r) => ({ ...r, appearance: JSON.parse(r.appearance || 'null') })),
      ticket: mine ? { tier: mine.tier, attended: !!mine.attended } : null,
    });
  }
  return { shows, tiers: CONCERT.tiers };
}

export const buyTicket = db.transaction((uid, slot, tierId) => {
  const c = concertAt(slot);
  if (!CONCERT.tiers.some((t) => t.id === tierId)) throw new GameError(['Tiketi hiyo haipo.', 'No such ticket.']);
  if (c.endsAt < now() || slot > concertSlot() + CONCERT.ahead) throw new GameError(['Tamasha hilo halipo.', "That show isn't on sale."], 404);
  const had = ticketOf(uid, slot);
  if (had?.attended) throw new GameError(['Umeshahudhuria tamasha hili.', "You've already been to this show."]);
  const price = ticketPrice(c, tierId);
  // Upgrading pays the difference.
  const due = price - (had?.price || 0);
  if (due <= 0) throw new GameError(['Tayari una tiketi hii au bora zaidi.', 'You already have this ticket or better.']);
  const place = placeById[c.placeId];
  addMoney(uid, -due, 'spend', `🎟️ ${c.artist.name} — ${place.name}`);
  db.prepare(`INSERT INTO concert_tickets (user_id, slot, tier, price, bought_at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id, slot) DO UPDATE SET tier = excluded.tier, price = excluded.price`).run(uid, slot, tierId, price, now());
  return view(uid);
});
