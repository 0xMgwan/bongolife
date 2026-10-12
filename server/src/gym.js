// Gym: memberships, timed workouts that build fitness, and personal trainers — NPC coaches or
// real players who sign up as trainers and get paid by their clients.
import { db, getUser, addMoney, saveFields, GameError, now } from './db.js';
import { online, emitTo } from './presence.js';
import { notify } from './push.js';
import { GYM, gymWorkoutById, placeById } from '../../shared/world.js';
import { applyNeeds } from './game.js';

const DAY = 86_400_000;
db.exec(`CREATE TABLE IF NOT EXISTS fitness (
  user_id INTEGER PRIMARY KEY,
  score REAL NOT NULL DEFAULT 20,
  membership TEXT, member_until INTEGER,
  last_workout INTEGER, workouts INTEGER NOT NULL DEFAULT 0,
  streak INTEGER NOT NULL DEFAULT 0, last_day INTEGER,
  active TEXT
);
CREATE TABLE IF NOT EXISTS trainers (
  user_id INTEGER PRIMARY KEY,
  price INTEGER NOT NULL, focus TEXT, bio TEXT,
  active INTEGER NOT NULL DEFAULT 1, clients INTEGER NOT NULL DEFAULT 0, earned INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS trainer_hires (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL, kind TEXT NOT NULL, ref TEXT NOT NULL,
  price INTEGER NOT NULL, started_at INTEGER NOT NULL, until INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS hires_client ON trainer_hires(client_id, until);`);

const q = {
  ensure: db.prepare('INSERT OR IGNORE INTO fitness (user_id) VALUES (?)'),
  get: db.prepare('SELECT * FROM fitness WHERE user_id = ?'),
  hire: db.prepare('SELECT * FROM trainer_hires WHERE client_id = ? AND until > ? ORDER BY id DESC LIMIT 1'),
  trainer: db.prepare('SELECT t.*, u.username, u.name, u.appearance FROM trainers t JOIN users u ON u.id = t.user_id WHERE t.user_id = ?'),
  trainers: db.prepare('SELECT t.*, u.username, u.name FROM trainers t JOIN users u ON u.id = t.user_id WHERE t.active = 1 AND u.banned_at IS NULL ORDER BY t.clients DESC, t.created_at DESC LIMIT 40'),
  myClients: db.prepare('SELECT h.*, u.username FROM trainer_hires h JOIN users u ON u.id = h.client_id WHERE h.kind = ? AND h.ref = ? AND h.until > ? ORDER BY h.until DESC'),
};
const row = (uid) => { q.ensure.run(uid); return q.get.get(uid); };
const upd = (uid, f) => db.prepare(`UPDATE fitness SET ${Object.keys(f).map((k) => `${k} = @${k}`).join(', ')} WHERE user_id = @uid`).run({ ...f, uid });

/** Fitness right now: it slips a little every day you skip. */
export function fitnessOf(uid, r = q.get.get(uid)) {
  if (!r) return 20;
  const idle = r.last_workout ? Math.max(0, (now() - r.last_workout) / DAY - 1) : 0;
  return Math.round(Math.max(5, r.score - idle * GYM.decayPerDay) * 10) / 10;
}
const membershipOf = (r) => (r?.membership && r.member_until > now() ? GYM.memberships.find((m) => m.id === r.membership) : null);

function atGym(uid) {
  const p = online.get(uid);
  if (!p) return null;
  if (GYM.places.includes(p.inside)) return p.inside;
  for (const id of GYM.places) {
    const pl = placeById[id];
    if (pl && Math.hypot(p.x - pl.pos[0], p.z - pl.pos[1]) < Math.max(...pl.size) / 2 + 12) return id;
  }
  return null;
}

function trainerView(hire) {
  if (!hire) return null;
  if (hire.kind === 'npc') {
    const t = GYM.npcTrainers.find((x) => x.id === hire.ref);
    return t && { kind: 'npc', ...t, until: hire.until };
  }
  const t = q.trainer.get(Number(hire.ref));
  return t && { kind: 'player', id: t.user_id, name: `@${t.username}`, username: t.username, emoji: '🧑🏾‍🏫', focus: [t.focus || '', t.focus || ''], price: t.price, until: hire.until, online: online.has(t.user_id) };
}

export function view(uid) {
  const r = row(uid);
  const t = now();
  const mine = q.trainer.get(uid);
  return {
    fitness: fitnessOf(uid, r),
    workouts: r.workouts,
    streak: r.last_day != null && Math.floor(t / DAY) - r.last_day <= 1 ? r.streak : 0,
    membership: membershipOf(r) ? { ...membershipOf(r), until: r.member_until } : null,
    readyAt: (r.last_workout || 0) + GYM.cooldownMs,
    active: r.active ? JSON.parse(r.active) : null,
    atGym: atGym(uid),
    trainer: trainerView(q.hire.get(uid, t)),
    gym: GYM,
    trainers: q.trainers.all().filter((x) => x.user_id !== uid).map((x) => ({ id: x.user_id, username: x.username, name: x.name, price: x.price, focus: x.focus, bio: x.bio, clients: x.clients, fitness: fitnessOf(x.user_id), online: online.has(x.user_id) })),
    me: mine ? { price: mine.price, focus: mine.focus, bio: mine.bio, active: !!mine.active, earned: mine.earned, clients: q.myClients.all('player', String(uid), t).map((h) => ({ username: h.username, until: h.until })) } : null,
    now: t,
  };
}

export const buyMembership = db.transaction((uid, id) => {
  const m = GYM.memberships.find((x) => x.id === id);
  if (!m) throw new GameError(['Haipo', 'Not found'], 404);
  const r = row(uid);
  const base = r.membership === id && r.member_until > now() ? r.member_until : now();
  addMoney(uid, -m.price, 'spend', `${m.emoji} Gym · ${m.name}`);
  upd(uid, { membership: id, member_until: base + m.days * DAY });
  return view(uid);
});

export function start(uid, workoutId) {
  const w = gymWorkoutById[workoutId];
  if (!w) throw new GameError(['Haipo', 'Not found'], 404);
  const r = row(uid);
  const wait = (r.last_workout || 0) + GYM.cooldownMs - now();
  if (wait > 0) throw new GameError([`Pumzisha misuli — dakika ${Math.ceil(wait / 60_000)}.`, `Let your muscles rest — ${Math.ceil(wait / 60_000)} min.`], 429);
  const u = getUser(uid);
  if ((u.needs?.energy ?? 50) < Math.abs(w.energy) + 5) throw new GameError(['Umechoka sana kufanya mazoezi. Pumzika au kula kwanza.', "You're too tired to train. Rest or eat first."]);
  if (!w.home) {
    const m = membershipOf(r);
    if (!m) throw new GameError(['Unahitaji uanachama wa gym (au pasi ya siku).', 'You need a gym membership (or a day pass).'], 402);
    if (w.elite && !m.elite) throw new GameError(['Hii ni ya wanachama wa Elite.', 'This is for Elite members.'], 403);
    if (!atGym(uid)) throw new GameError(['Nenda gym kwanza (Mlimani, au gym za hoteli Zanzibar/Arusha).', 'Go to a gym first (Mlimani, or the hotel gyms in Zanzibar/Arusha).'], 400);
  }
  const active = { id: w.id, at: now(), gym: atGym(uid) };
  upd(uid, { active: JSON.stringify(active) });
  return { ok: true, active };
}

export const finish = db.transaction((uid) => {
  const r = row(uid);
  const a = r.active && JSON.parse(r.active);
  if (!a) throw new GameError(['Hakuna mazoezi yanayoendelea.', 'No workout in progress.']);
  const w = gymWorkoutById[a.id];
  if (now() - a.at < w.secs * 850) throw new GameError(['Bado — maliza seti zote!', 'Not yet — finish all your sets!']);
  const m = membershipOf(r);
  const hire = q.hire.get(uid, now());
  // Gains: workout × (elite) × (trainer) × (your player-trainer is right here with you).
  let mult = 1 + (m?.gain || 0) + (hire ? GYM.trainerBonus : 0);
  let coached = null;
  if (hire?.kind === 'player') {
    const tid = Number(hire.ref);
    if (a.gym && atGym(tid) === a.gym) {
      mult += GYM.trainerTogether;
      coached = online.get(tid)?.username;
      const tr = row(tid);
      upd(tid, { score: Math.min(100, fitnessOf(tid, tr) + 0.3), last_workout: now() });
      emitTo(tid, 'toast', { text: [`🧑🏾‍🏫 Umemfundisha @${getUser(uid).username} — kazi nzuri!`, `🧑🏾‍🏫 You coached @${getUser(uid).username} — nice work!`] });
    }
  }
  const before = fitnessOf(uid, r);
  // Harder to gain near the top.
  const gain = Math.round(w.fitness * mult * (1 - before / 140) * 10) / 10;
  const fitness = Math.min(100, before + gain);
  const day = Math.floor(now() / DAY);
  const streak = r.last_day === day ? r.streak : r.last_day === day - 1 ? r.streak + 1 : 1;
  upd(uid, { score: fitness, last_workout: now(), workouts: r.workouts + 1, streak, last_day: day, active: null });
  const u = getUser(uid);
  const health = Math.min(100, (u.health ?? 100) + w.health);
  saveFields(uid, { health, needs: applyNeeds(u.needs, { energy: w.energy, ...w.effects }) });
  return { gain, fitness, health, streak, coached, ...view(uid) };
});

export function cancel(uid) {
  upd(uid, { active: null });
  return view(uid);
}

// ------------------------------------------------------------------ trainers
export const hire = db.transaction((uid, kind, ref) => {
  if (q.hire.get(uid, now())) throw new GameError(['Tayari una kocha wiki hii.', 'You already have a trainer this week.'], 409);
  if (kind === 'npc') {
    const t = GYM.npcTrainers.find((x) => x.id === ref);
    if (!t) throw new GameError(['Haipo', 'Not found'], 404);
    addMoney(uid, -t.price, 'spend', `${t.emoji} ${t.name}`);
    db.prepare('INSERT INTO trainer_hires (client_id, kind, ref, price, started_at, until) VALUES (?, ?, ?, ?, ?, ?)').run(uid, 'npc', t.id, t.price, now(), now() + 7 * DAY);
    return view(uid);
  }
  const tid = Number(ref);
  const t = q.trainer.get(tid);
  if (!t || !t.active || tid === uid) throw new GameError(['Kocha hayupo', 'Trainer not found'], 404);
  const client = getUser(uid);
  addMoney(uid, -t.price, 'spend', `🧑🏾‍🏫 Kocha @${t.username}`);
  const pay = Math.round(t.price * (1 - GYM.trainerCut));
  addMoney(tid, pay, 'income', `🧑🏾‍🏫 Mteja @${client.username}`);
  db.prepare('INSERT INTO trainer_hires (client_id, kind, ref, price, started_at, until) VALUES (?, ?, ?, ?, ?, ?)').run(uid, 'player', String(tid), t.price, now(), now() + 7 * DAY);
  db.prepare('UPDATE trainers SET clients = clients + 1, earned = earned + ? WHERE user_id = ?').run(pay, tid);
  const text = [`🧑🏾‍🏫 @${client.username} amekuajiri kuwa kocha wake — umepata TSh ${pay.toLocaleString()}!`, `🧑🏾‍🏫 @${client.username} hired you as their trainer — you earned TSh ${pay.toLocaleString()}!`];
  if (online.has(tid)) emitTo(tid, 'toast', { text, refresh: true });
  else notify(tid, text, { tag: `trainer-${uid}` }).catch(() => {});
  return view(uid);
});

export function register(uid, { price, focus, bio }) {
  if (fitnessOf(uid) < GYM.trainerMinFitness) throw new GameError([`Unahitaji fitness ${GYM.trainerMinFitness}+ kuwa kocha.`, `You need ${GYM.trainerMinFitness}+ fitness to become a trainer.`], 403);
  const p = Math.round(Number(price) / 1000) * 1000;
  if (!(p >= GYM.trainerPrice[0] && p <= GYM.trainerPrice[1])) throw new GameError([`Bei iwe kati ya ${GYM.trainerPrice[0].toLocaleString()} na ${GYM.trainerPrice[1].toLocaleString()}.`, `Price must be between ${GYM.trainerPrice[0].toLocaleString()} and ${GYM.trainerPrice[1].toLocaleString()}.`]);
  const clean = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);
  db.prepare(`INSERT INTO trainers (user_id, price, focus, bio, active, created_at) VALUES (?, ?, ?, ?, 1, ?)
    ON CONFLICT(user_id) DO UPDATE SET price = excluded.price, focus = excluded.focus, bio = excluded.bio, active = 1`).run(uid, p, clean(focus, 40), clean(bio, 140), now());
  return view(uid);
}
export function unregister(uid) {
  db.prepare('UPDATE trainers SET active = 0 WHERE user_id = ?').run(uid);
  return view(uid);
}
/** For player cards: their fitness and trainer listing. */
export function publicFitness(uid) {
  const t = q.trainer.get(uid);
  return { fitness: fitnessOf(uid), trainer: t && t.active ? { price: t.price, focus: t.focus, clients: t.clients } : null };
}
