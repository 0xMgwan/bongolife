// Harambee: one community project per city at a time. Anyone can chip in from anywhere; when the
// goal is reached the city gets a week of better pay and donors gain fame, then the next project opens.
import { db, getUser, addMoney, GameError, now } from './db.js';
import { HARAMBEE, HARAMBEE_PROJECTS, CITIES, cityById } from '../../shared/world.js';
import { broadcast } from './presence.js';
import * as news from './news.js';

db.exec(`CREATE TABLE IF NOT EXISTS harambee (
  city TEXT NOT NULL, round INTEGER NOT NULL, project TEXT NOT NULL, goal INTEGER NOT NULL,
  raised INTEGER NOT NULL DEFAULT 0, started_at INTEGER NOT NULL, done_at INTEGER,
  PRIMARY KEY (city, round)
);
CREATE TABLE IF NOT EXISTS harambee_gifts (
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  city TEXT NOT NULL, round INTEGER NOT NULL, amount INTEGER NOT NULL, at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS harambee_gifts_round ON harambee_gifts(city, round);`);

const DAY = 86_400_000;
const q = {
  open: db.prepare('SELECT * FROM harambee WHERE city = ? AND done_at IS NULL ORDER BY round DESC LIMIT 1'),
  last: db.prepare('SELECT * FROM harambee WHERE city = ? ORDER BY round DESC LIMIT 1'),
  lastDone: db.prepare('SELECT * FROM harambee WHERE city = ? AND done_at IS NOT NULL ORDER BY round DESC LIMIT 1'),
  insert: db.prepare('INSERT INTO harambee (city, round, project, goal, started_at) VALUES (?, ?, ?, ?, ?)'),
  raise: db.prepare('UPDATE harambee SET raised = raised + ? WHERE city = ? AND round = ?'),
  done: db.prepare('UPDATE harambee SET done_at = ? WHERE city = ? AND round = ? AND done_at IS NULL'),
  gift: db.prepare('INSERT INTO harambee_gifts (user_id, city, round, amount, at) VALUES (?, ?, ?, ?, ?)'),
  top: db.prepare(`SELECT u.username, SUM(g.amount) total FROM harambee_gifts g JOIN users u ON u.id = g.user_id
    WHERE g.city = ? AND g.round = ? GROUP BY g.user_id ORDER BY total DESC LIMIT 5`),
  mine: db.prepare('SELECT COALESCE(SUM(amount), 0) s FROM harambee_gifts WHERE user_id = ? AND city = ? AND round = ?'),
  donors: db.prepare('SELECT user_id, SUM(amount) total FROM harambee_gifts WHERE city = ? AND round = ? GROUP BY user_id'),
  count: db.prepare('SELECT COUNT(DISTINCT user_id) n FROM harambee_gifts WHERE city = ? AND round = ?'),
};

/** The project collecting money in a city (opens the next one if needed). */
function current(city) {
  const open = q.open.get(city);
  if (open) return open;
  const last = q.last.get(city);
  const round = (last?.round ?? -1) + 1;
  const list = HARAMBEE_PROJECTS[city];
  const p = list[round % list.length];
  const goal = Math.round(p.goal * (1 + 0.5 * Math.floor(round / list.length)));
  q.insert.run(city, round, p.id, goal, now());
  return q.open.get(city);
}
const projectOf = (row) => HARAMBEE_PROJECTS[row.city].find((p) => p.id === row.project);

/** Until when the city's pay boost runs (0 if none). */
export function boostUntil(city) {
  const d = city && q.lastDone.get(city);
  const until = d ? d.done_at + HARAMBEE.boostDays * DAY : 0;
  return until > now() ? until : 0;
}

export function view(uid) {
  return {
    cities: CITIES.map((c) => {
      const row = current(c.id);
      const done = q.lastDone.get(c.id);
      return {
        city: c.id, name: c.name, icon: c.icon,
        project: { ...projectOf(row), goal: row.goal, raised: row.raised, round: row.round },
        donors: q.count.get(c.id, row.round).n,
        top: q.top.all(c.id, row.round),
        mine: q.mine.get(uid, c.id, row.round).s,
        boostUntil: boostUntil(c.id),
        lastDone: done ? { ...projectOf(done), at: done.done_at } : null,
      };
    }),
    rules: HARAMBEE,
  };
}

export const donate = db.transaction((uid, city, amountIn) => {
  if (!cityById[city]) throw new GameError(['Mji huo haupo.', 'No such city.'], 404);
  const amount = Math.floor(Number(amountIn));
  if (!(amount >= HARAMBEE.minGift && amount <= HARAMBEE.maxGift)) throw new GameError([`Changia kuanzia TSh ${HARAMBEE.minGift.toLocaleString()}.`, `Give at least TSh ${HARAMBEE.minGift.toLocaleString()}.`]);
  const row = current(city);
  const p = projectOf(row);
  const give = Math.min(amount, row.goal - row.raised);
  addMoney(uid, -give, 'gift', `🤝 Harambee: ${p.name[0]}`);
  q.gift.run(uid, city, row.round, give, now());
  q.raise.run(give, city, row.round);
  const u = getUser(uid);
  let completed = false;
  if (row.raised + give >= row.goal && q.done.run(now(), city, row.round).changes) {
    completed = true;
    // Donors earn fame by how much they gave.
    for (const d of q.donors.all(city, row.round)) {
      const fame = Math.min(HARAMBEE.fameCap, Math.max(1, Math.floor((d.total / 1_000_000) * HARAMBEE.famePerM)));
      db.prepare('UPDATE users SET fame = fame + ? WHERE id = ?').run(fame, d.user_id);
    }
    const name = cityById[city].name;
    broadcast('toast', { text: [`🎉 Harambee ya ${name} imefanikiwa: ${p.name[0]}! Kazi zote ${name} zinalipa +${HARAMBEE.boostPay * 100}% wiki hii.`, `🎉 ${name}'s Harambee is funded: ${p.name[1]}! Every job in ${name} pays +${HARAMBEE.boostPay * 100}% this week.`], long: true, refresh: true });
    news.publish('community', [`Harambee: wananchi wa ${name} wakamilisha ${p.name[0]}`, `Harambee: ${name} residents fund ${p.name[1]}`], { big: true });
  } else if (give >= 10_000_000) {
    news.publish('community', [`@${u.username} achangia ${(give / 1e6).toFixed(0)}M kwa ${p.name[0]}`, `@${u.username} gives ${(give / 1e6).toFixed(0)}M to ${p.name[1]}`], { user: u, throttleMs: 60 * 60_000 });
  }
  return { gave: give, completed };
});
