// Mtaani: GTA-style street life. Wanted stars from crimes (police chase you on your screen),
// timed missions across town (deliveries, taxi rushes, street races), carjacking a car off the
// road and selling it at the chop shop, and the big one — robbing NMB Bank and making the getaway.
// Live state is in memory (it's about what you're doing right now); race records are kept.
import { db, getUser, addMoney, GameError, now } from './db.js';
import { STREET, CARJACK_MODEL, ROADS, cityAt, placeById, vehicleById } from '../../shared/world.js';
import { online, broadcast, emitTo } from './presence.js';
import { arrest, assertFree } from './crime.js';
import { vehicleSummary } from './game.js';

db.exec(`CREATE TABLE IF NOT EXISTS street_races (
  user_id INTEGER PRIMARY KEY, best_ms INTEGER NOT NULL, wins INTEGER NOT NULL DEFAULT 0, at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS street_stats (
  user_id INTEGER PRIMARY KEY, missions INTEGER NOT NULL DEFAULT 0, earned INTEGER NOT NULL DEFAULT 0,
  heists INTEGER NOT NULL DEFAULT 0, cars INTEGER NOT NULL DEFAULT 0, busts INTEGER NOT NULL DEFAULT 0
);`);
const q = {
  race: db.prepare('SELECT * FROM street_races WHERE user_id = ?'),
  setRace: db.prepare('INSERT INTO street_races (user_id, best_ms, wins, at) VALUES (?, ?, 1, ?) ON CONFLICT(user_id) DO UPDATE SET best_ms = MIN(best_ms, excluded.best_ms), wins = wins + 1, at = excluded.at'),
  top: db.prepare('SELECT r.best_ms ms, r.wins, u.username FROM street_races r JOIN users u ON u.id = r.user_id ORDER BY r.best_ms LIMIT 8'),
  stats: db.prepare('SELECT * FROM street_stats WHERE user_id = ?'),
  bump: (uid, col, n = 1) => db.prepare(`INSERT INTO street_stats (user_id, ${col}) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET ${col} = ${col} + excluded.${col}`).run(uid, n),
};

const S = new Map(); // userId -> { stars, crimeAt, mission, heist, stolen, heistAt }
const st = (uid) => {
  if (!S.has(uid)) S.set(uid, { stars: 0, crimeAt: 0, mission: null, heist: null, stolen: null, heistAt: 0 });
  return S.get(uid);
};
const posOf = (uid) => {
  const p = online.get(uid);
  if (!p) throw new GameError(['Ingia mtaani kwanza.', 'Get out into town first.']);
  if (p.inside) throw new GameError(['Toka nje kwanza.', 'Step outside first.']);
  return [p.x, p.z];
};
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const roadsIn = (cityId) => ROADS.filter(([x1, z1]) => cityAt(x1, z1)?.id === cityId || cityAt(x1 + 1, z1 + 1)?.id === cityId);
/** A random point on a road in this city, between min and max metres from `from`. */
function roadPoint(from, min, max) {
  const city = cityAt(from[0], from[1])?.id || 'dar';
  const roads = roadsIn(city);
  for (let i = 0; i < 80; i++) {
    const [x1, z1, x2, z2] = roads[Math.floor(Math.random() * roads.length)];
    const t = 0.08 + Math.random() * 0.84;
    const p = [Math.round(x1 + (x2 - x1) * t), Math.round(z1 + (z2 - z1) * t)];
    const d = dist(p, from);
    if (d >= min && d <= max && cityAt(p[0], p[1])?.id === city) return p;
  }
  const [x1, z1, x2, z2] = roads[0];
  return [Math.round((x1 + x2) / 2), Math.round((z1 + z2) / 2)];
}
const hasCar = (uid) => !!st(uid).stolen || !!online.get(uid)?.vehicle;

// --------------------------------------------------------------- wanted
function setStars(uid, stars, why) {
  const s = st(uid);
  s.stars = Math.max(0, Math.min(STREET.maxStars, stars));
  if (s.stars) s.crimeAt = now();
  emitTo(uid, 'wanted', { stars: s.stars, why: why || null });
  broadcast('player:wanted', { id: uid, stars: s.stars });
}
export const addStars = (uid, n, why) => setStars(uid, st(uid).stars + n, why);
export const starsOf = (uid) => S.get(uid)?.stars || 0;

/** Called on a timer: stars slowly fade when you lie low. */
export function decayTick() {
  const t = now();
  for (const [uid, s] of S) {
    if (s.stars && !s.heist && t - s.crimeAt > STREET.decayMs * s.stars) setStars(uid, s.stars - 1);
    if (s.mission && t > s.mission.deadline + 5000) failMission(uid, ['Muda umekwisha', 'Out of time']);
    if (s.heist && t > s.heist.deadline) {
      s.heist = null;
      emitTo(uid, 'street', { type: 'heist:lost', text: ['🚨 Polisi wamefunga barabara — mzigo umepotea!', '🚨 Roadblocks everywhere — you had to dump the loot!'] });
    }
    if (!online.has(uid) && !s.stars && !s.mission && !s.heist && !s.stolen) S.delete(uid);
  }
}

/** The police car caught you (reported by your client after the hold time). */
export const bust = db.transaction((uid) => {
  const s = st(uid);
  if (!s.stars) return { ok: false };
  const fine = STREET.bustFine[s.stars - 1];
  const lost = s.heist?.loot || 0;
  s.mission = null;
  s.heist = null;
  s.stolen = null;
  setStars(uid, 0);
  clearStolenVehicle(uid);
  q.bump(uid, 'busts');
  arrest(uid, ['Kukimbia polisi', 'Evading the police'], fine);
  broadcast('emote', { id: uid, e: '🚓' });
  return { ok: true, fine, lost };
});
/** You stayed out of sight long enough. */
export function escaped(uid) {
  const s = st(uid);
  if (!s.stars) return { stars: 0 };
  if (now() - s.crimeAt < STREET.loseHoldMs) return { stars: s.stars };
  setStars(uid, s.heist ? 1 : 0);
  return { stars: s.stars, escaped: true };
}

// ------------------------------------------------------------- missions
export function startMission(uid, kind) {
  const def = STREET.missions[kind];
  if (!def) throw new GameError(['Haipo', 'Not found'], 404);
  assertFree(getUser(uid));
  const s = st(uid);
  if (s.mission) throw new GameError(['Maliza kazi uliyonayo kwanza.', 'Finish your current job first.']);
  if (s.heist) throw new GameError(['Uko kwenye wizi wa benki!', "You're in the middle of a heist!"]);
  if (def.needCar && !hasCar(uid)) throw new GameError(['Unahitaji gari au pikipiki — panda yako au "azima" moja barabarani 😏', 'You need wheels — get in yours or "borrow" one off the road 😏']);
  const from = posOf(uid);
  const points = [];
  let prev = from;
  const n = def.points || (kind === 'delivery' || kind === 'taxi' ? 2 : 1);
  for (let i = 0; i < n; i++) {
    const p = roadPoint(prev, kind === 'race' ? 45 : i ? 90 : 25, kind === 'race' ? 110 : i ? 220 : 80);
    points.push(p);
    prev = p;
  }
  let len = 0;
  prev = from;
  for (const p of points) { len += dist(prev, p); prev = p; }
  const pay = Math.round((def.base + def.perM * len) / 1000) * 1000;
  s.mission = { kind, points, idx: 0, pay, start: now(), deadline: now() + Math.round((len / def.speed) * 1150 + 20_000), len: Math.round(len) };
  return { mission: s.mission };
}
function failMission(uid, why) {
  const s = st(uid);
  if (!s.mission) return;
  s.mission = null;
  emitTo(uid, 'street', { type: 'mission:fail', text: [`❌ ${why[0]}`, `❌ ${why[1]}`] });
}
export function cancelMission(uid) {
  st(uid).mission = null;
  return { ok: true };
}

/** Client says it reached the next marker; the server checks the live position. */
export const checkpoint = db.transaction((uid) => {
  const s = st(uid);
  const pos = posOf(uid);
  // Heist getaway: reached the safehouse.
  if (s.heist && dist(pos, s.heist.safe) < 10) {
    const { loot } = s.heist;
    s.heist = null;
    setStars(uid, Math.min(s.stars, 2));
    addMoney(uid, loot, 'income', '💰 Wizi wa benki — umefanikiwa kutoroka');
    q.bump(uid, 'heists');
    q.bump(uid, 'earned', loot);
    broadcast('toast', { text: [`💰 Wezi wa benki wametoroka na mzigo! Polisi wamechanganyikiwa.`, `💰 The bank robbers got away with it! Police are baffled.`] });
    return { done: true, paid: loot, heist: true };
  }
  const m = s.mission;
  if (!m) return { none: true };
  if (now() > m.deadline) { failMission(uid, ['Muda umekwisha', 'Out of time']); return { failed: true }; }
  if (STREET.missions[m.kind].needCar && !hasCar(uid)) return { needCar: true, mission: m };
  if (dist(pos, m.points[m.idx]) > 9) return { far: true, mission: m };
  m.idx++;
  if (m.idx < m.points.length) return { mission: m };
  s.mission = null;
  const ms = now() - m.start;
  // Quick finishers get a tip.
  const tip = Math.round(m.pay * Math.max(0, (m.deadline - now()) / (m.deadline - m.start)) * 0.5 / 1000) * 1000;
  const paid = m.pay + tip;
  const def = STREET.missions[m.kind];
  addMoney(uid, paid, 'income', `${def.emoji} ${def.name[0]}`);
  q.bump(uid, 'missions');
  q.bump(uid, 'earned', paid);
  let record = false;
  if (m.kind === 'race') {
    const prev = q.race.get(uid);
    record = !prev || ms < prev.best_ms;
    q.setRace.run(uid, ms, now());
  }
  return { done: true, paid, tip, ms, record };
});

// --------------------------------------------------------------- carjack
function clearStolenVehicle(uid) {
  const p = online.get(uid);
  if (!p) return;
  const u = getUser(uid);
  p.vehicle = u.activeVehicle ? vehicleSummary(u.activeVehicle) : null;
  broadcast('player:vehicle', { id: uid, v: p.vehicle });
}
export function carjack(uid, kind, color) {
  assertFree(getUser(uid));
  const model = CARJACK_MODEL[kind];
  if (!model || !vehicleById[model]) throw new GameError(['Gari hilo haliwezekani.', "Can't take that one."]);
  posOf(uid);
  const s = st(uid);
  if (s.stolen && now() - s.stolen.at < 4000) throw new GameError(['Subiri kidogo.', 'Hang on a sec.'], 429);
  s.stolen = { kind, model, color: /^#[0-9a-f]{6}$/i.test(color) ? color : '#9ca3af', at: now() };
  const p = online.get(uid);
  p.vehicle = { model, color: s.stolen.color, plate: 'T ' + (100 + Math.floor(Math.random() * 899)) + ' WZI' };
  broadcast('player:vehicle', { id: uid, v: p.vehicle });
  broadcast('emote', { id: uid, e: '😈' });
  q.bump(uid, 'cars');
  addStars(uid, STREET.carjackStars, ['Wizi wa gari', 'Grand theft auto']);
  return { stolen: s.stolen, vehicle: p.vehicle, chop: STREET.chop, pay: STREET.chopPay[kind] };
}
/** Get out of the stolen car — or sell it if you're at the chop shop. */
export const ditch = db.transaction((uid) => {
  const s = st(uid);
  if (!s.stolen) return { ok: true };
  const p = online.get(uid);
  const atChop = p && dist([p.x, p.z], STREET.chop) < 12;
  const pay = atChop ? STREET.chopPay[s.stolen.kind] : 0;
  s.stolen = null;
  clearStolenVehicle(uid);
  if (pay) {
    if (s.stars) throw new GameError(['Gereji haipokei gari likiwa linafuatwa na polisi! Wapoteze kwanza.', "The chop shop won't take a car with cops on its tail! Lose them first."]);
    addMoney(uid, pay, 'income', '🔧 Gereji ya Ubungo — gari limeuzwa vipande');
    q.bump(uid, 'earned', pay);
  }
  return { ok: true, paid: pay };
});

// ----------------------------------------------------------------- heist
const SAFEHOUSES = [[-140, -140], [-140, 140], [85, 140], [-110, -145], [125, -90]];
export const startHeist = db.transaction((uid) => {
  const H = STREET.heist;
  assertFree(getUser(uid));
  const s = st(uid);
  const pos = posOf(uid);
  const bank = placeById[H.places[0]];
  if (dist(pos, bank.pos) > 22) throw new GameError([`Nenda ${bank.name} kwanza.`, `Go to ${bank.name} first.`]);
  if (s.heist || s.mission) throw new GameError(['Uko na kazi nyingine.', "You're already on a job."]);
  if (s.stars) throw new GameError(['Polisi wanakufuata — wapoteze kwanza.', 'The cops are on you — lose them first.']);
  const wait = s.heistAt + H.cooldownMs - now();
  if (wait > 0) throw new GameError([`Benki iko na ulinzi mkali — rudi baada ya dakika ${Math.ceil(wait / 60000)}.`, `The bank is on high alert — come back in ${Math.ceil(wait / 60000)} min.`], 429);
  addMoney(uid, -H.gear, 'purchase', '🧰 Vifaa vya kuvunja kasha');
  s.heistAt = now();
  // Vault: three dials; the client shows a sweeping needle you stop on the green zone.
  const dials = [0, 1, 2].map(() => ({ at: 0.15 + Math.random() * 0.7, width: 0.12 - Math.random() * 0.04, speed: 0.6 + Math.random() * 0.6 }));
  s.vault = { dials, at: now() };
  return { vault: dials };
});
export function crackVault(uid, ok) {
  const H = STREET.heist;
  const s = st(uid);
  if (!s.vault || now() - s.vault.at > 90_000) throw new GameError(['Hakuna kasha.', 'No vault open.']);
  s.vault = null;
  if (!ok) {
    addStars(uid, 3, ['Kengele ya benki!', 'Bank alarm!']);
    broadcast('toast', { text: ['🚨 Kengele yalia benki ya Posta — polisi njiani!', '🚨 Alarm at the Posta bank — police on the way!'] });
    return { alarm: true };
  }
  const loot = Math.round((H.loot[0] + Math.random() * (H.loot[1] - H.loot[0])) / 10_000) * 10_000;
  const pos = posOf(uid);
  const safe = SAFEHOUSES.filter((p) => dist(p, pos) > 120).sort(() => Math.random() - 0.5)[0] || SAFEHOUSES[0];
  s.heist = { loot, safe, deadline: now() + H.timeMs };
  addStars(uid, STREET.heistStars, ['Wizi wa benki', 'Bank heist']);
  const me = getUser(uid);
  broadcast('toast', { text: [`🚨 Benki ya Posta imevamiwa! @${me.username} anakimbia na TSh ${(loot / 1e6).toFixed(1)}M`, `🚨 The Posta bank has been robbed! @${me.username} is fleeing with TSh ${(loot / 1e6).toFixed(1)}M`] });
  return { heist: s.heist };
}

// ------------------------------------------------------------------ view
export function view(uid) {
  const s = S.get(uid) || {};
  return {
    stars: s.stars || 0,
    mission: s.mission || null,
    heist: s.heist || null,
    stolen: s.stolen || null,
    heistReadyIn: Math.max(0, (s.heistAt || 0) + STREET.heist.cooldownMs - now()),
    stats: q.stats.get(uid) || { missions: 0, earned: 0, heists: 0, cars: 0, busts: 0 },
    race: q.race.get(uid) || null,
    top: q.top.all(),
    rules: STREET,
    bank: placeById[STREET.heist.places[0]].pos,
  };
}
