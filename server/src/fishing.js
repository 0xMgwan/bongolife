// Uvuvi: cast, bite, reel. The species and its weight are rolled on the server when you cast;
// the client plays the timing game and reports how many pulls you won. Landed fish go to your
// cool box until you sell them at a fish market or cook them.
import { db, getUser, saveFields, addMoney, GameError, now } from './db.js';
import { FISHING, FISH, fishById, placeById, cityAt } from '../../shared/world.js';
import { positionOf, broadcast } from './presence.js';
import * as news from './news.js';

db.exec(`CREATE TABLE IF NOT EXISTS catches (
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  species TEXT NOT NULL, kg REAL NOT NULL, city TEXT NOT NULL, caught_at INTEGER NOT NULL, gone TEXT
);
CREATE INDEX IF NOT EXISTS catches_user ON catches(user_id, gone);
CREATE TABLE IF NOT EXISTS fish_records (species TEXT PRIMARY KEY, user_id INTEGER NOT NULL, kg REAL NOT NULL, at INTEGER NOT NULL);`);

const q = {
  box: db.prepare('SELECT * FROM catches WHERE user_id = ? AND gone IS NULL ORDER BY id DESC'),
  boxN: db.prepare('SELECT COUNT(*) n FROM catches WHERE user_id = ? AND gone IS NULL'),
  add: db.prepare('INSERT INTO catches (user_id, species, kg, city, caught_at) VALUES (?, ?, ?, ?, ?)'),
  gone: db.prepare('UPDATE catches SET gone = ? WHERE id = ? AND user_id = ? AND gone IS NULL'),
  goneAll: db.prepare("UPDATE catches SET gone = 'sold' WHERE user_id = ? AND gone IS NULL"),
  kinds: db.prepare('SELECT species, COUNT(*) n, MAX(kg) best FROM catches WHERE user_id = ? GROUP BY species'),
  records: db.prepare('SELECT r.*, u.username FROM fish_records r JOIN users u ON u.id = r.user_id'),
  record: db.prepare('SELECT * FROM fish_records WHERE species = ?'),
  setRecord: db.prepare('INSERT INTO fish_records (species, user_id, kg, at) VALUES (?, ?, ?, ?) ON CONFLICT(species) DO UPDATE SET user_id = excluded.user_id, kg = excluded.kg, at = excluded.at'),
};
const casts = new Map(); // uid → { species, kg, pulls, biteAt, until }
const lastCast = new Map();

const valueOf = (c) => Math.round((c.kg * fishById[c.species].perKg) / 100) * 100;
const near = (u, p) => {
  const [x, z] = positionOf(u);
  return Math.hypot(x - p.pos[0], z - p.pos[1]) <= Math.max(...p.size) / 2 + 14;
};
function spotOf(u, ids) {
  return ids.map((id) => placeById[id]).find((p) => p && near(u, p)) || null;
}

export function view(uid) {
  const u = getUser(uid);
  const box = q.box.all(uid).map((c) => ({ ...c, value: valueOf(c) }));
  const spot = spotOf(u, FISHING.spots);
  const market = spotOf(u, FISHING.markets);
  return {
    box, boxValue: box.reduce((s, c) => s + c.value, 0),
    spot: spot?.id || null, market: market?.id || null,
    here: spot ? FISH.filter((f) => f.waters.includes(cityAt(...spot.pos)?.id)).map((f) => f.id) : [],
    caught: Object.fromEntries(q.kinds.all(uid).map((r) => [r.species, { n: r.n, best: r.best }])),
    records: Object.fromEntries(q.records.all().map((r) => [r.species, { kg: r.kg, username: r.username }])),
    nextCastIn: Math.max(0, (lastCast.get(uid) || 0) + FISHING.cooldownMs - now()),
  };
}

export function cast(uid) {
  const u = getUser(uid);
  if (u.busy && u.busy.endsAt > now()) throw new GameError(['Maliza unachofanya kwanza.', 'Finish what you are doing first.']);
  const spot = spotOf(u, FISHING.spots);
  if (!spot) throw new GameError(['Nenda ufukweni, bandarini au ziwani kuvua.', 'Go to a beach, a port or the lake shore to fish.'], 400, 'too_far');
  const wait = (lastCast.get(uid) || 0) + FISHING.cooldownMs - now();
  if (wait > 0) throw new GameError([`Subiri sekunde ${Math.ceil(wait / 1000)} kabla ya kurusha tena.`, `Wait ${Math.ceil(wait / 1000)}s before casting again.`], 429);
  if ((u.needs.energy ?? 0) < FISHING.energy + 3) throw new GameError(['Umechoka sana kuvua. Pumzika kwanza. 😴', 'Too tired to fish. Rest first. 😴']);
  if (q.boxN.get(uid).n >= FISHING.boxMax) throw new GameError(['Kibox chako kimejaa — uza au pika samaki kwanza.', 'Your cool box is full — sell or cook some fish first.']);
  lastCast.set(uid, now());
  saveFields(uid, { needs: { ...u.needs, energy: Math.max(0, (u.needs.energy ?? 0) - FISHING.energy) } });
  // Roll the fish now; the client only learns its size once it's landed.
  const city = cityAt(...spot.pos)?.id || 'dar';
  const pool = FISH.filter((f) => f.waters.includes(city));
  let r = Math.random() * pool.reduce((s, f) => s + f.weight, 0);
  const f = pool.find((x) => (r -= x.weight) < 0) || pool[0];
  // Weight skews small: most are average, a few are monsters.
  const t = Math.random() ** 2.2;
  const kg = Math.round((f.kg[0] + (f.kg[1] - f.kg[0]) * t) * 10) / 10;
  const biteMs = 1500 + Math.floor(Math.random() * 4500);
  casts.set(uid, { species: f.id, kg, pulls: f.pulls, city, biteAt: now() + biteMs, until: now() + biteMs + FISHING.windowMs });
  // Bigger fish swim faster in the timing game.
  return { biteMs, pulls: f.pulls, speed: 1 + Math.min(1.2, kg / (f.kg[1] || 1)) * 0.8 + (f.pulls - 1) * 0.25 };
}

export function reel(uid, won) {
  const c = casts.get(uid);
  casts.delete(uid);
  if (!c) throw new GameError(['Hukurusha ndoano.', 'You have no line out.']);
  const t = now();
  if (t < c.biteAt - 300) throw new GameError(['Umevuta mapema — samaki amekimbia!', 'You pulled too early — it got away!']);
  if (t > c.until) return { landed: false, reason: 'slow' };
  if (!(Number(won) >= c.pulls)) return { landed: false, reason: 'escaped', species: c.species };
  const u = getUser(uid);
  const id = q.add.run(uid, c.species, c.kg, c.city, t).lastInsertRowid;
  const f = fishById[c.species];
  const rec = q.record.get(c.species);
  let record = false;
  if (!rec || c.kg > rec.kg) {
    q.setRecord.run(c.species, uid, c.kg, t);
    record = true;
    if (rec) {
      news.publish('sport', [`Rekodi mpya ya uvuvi: @${u.username} avua ${f.name[0]} wa kilo ${c.kg}!`, `Fishing record: @${u.username} lands a ${c.kg} kg ${f.name[1]}!`], { user: u });
      broadcast('toast', { text: [`🎣 Rekodi! @${u.username} amevua ${f.name[0]} wa kilo ${c.kg}`, `🎣 Record! @${u.username} landed a ${c.kg} kg ${f.name[1]}`] });
    }
  }
  return { landed: true, id, species: c.species, kg: c.kg, value: valueOf({ species: c.species, kg: c.kg }), record };
}

/** Sell the whole cool box at a fish market. */
export const sellAll = db.transaction((uid) => {
  const u = getUser(uid);
  const market = spotOf(u, FISHING.markets);
  if (!market) throw new GameError(['Peleka samaki sokoni la samaki (Feri, Mwanza, Forodhani au Bagamoyo).', 'Take your catch to a fish market (Ferry, Mwanza, Forodhani or Bagamoyo).'], 400, 'too_far');
  const box = q.box.all(uid);
  if (!box.length) throw new GameError(['Kibox kiko tupu.', 'Your cool box is empty.']);
  const total = box.reduce((s, c) => s + valueOf(c), 0);
  q.goneAll.run(uid);
  addMoney(uid, total, 'income', `🐟 Umeuza samaki ${box.length} — ${market.name}`);
  return { sold: box.length, total };
});

/** Cook one fish from the box and eat it. */
export function cook(uid, catchId) {
  const u = getUser(uid);
  const r = q.gone.run('eaten', Number(catchId), uid);
  if (!r.changes) throw new GameError(['Samaki huyo hayupo.', "That fish isn't in your box."], 404);
  const needs = { ...u.needs, hunger: Math.min(100, (u.needs.hunger ?? 0) + FISHING.cookHunger), fun: Math.min(100, (u.needs.fun ?? 0) + 3) };
  saveFields(uid, { needs });
  return { needs };
}
