// Afya: health plans (30-day cover), therapy sessions, an online doctor and a pharmacy.
import { db, getUser, addMoney, saveFields, GameError, now } from './db.js';
import { HEALTH_PLANS, healthPlanById, AFYA, THERAPISTS, HOSPITAL_ID, HEALTH } from '../../shared/world.js';
import { applyNeeds } from './game.js';

db.exec(`CREATE TABLE IF NOT EXISTS health_plans (
  user_id INTEGER PRIMARY KEY,
  plan TEXT,
  until INTEGER,
  last_therapy INTEGER,
  last_doctor INTEGER,
  last_pharmacy INTEGER,
  sessions INTEGER NOT NULL DEFAULT 0
)`);
const q = {
  get: db.prepare('SELECT * FROM health_plans WHERE user_id = ?'),
  ensure: db.prepare('INSERT OR IGNORE INTO health_plans (user_id) VALUES (?)'),
};
const row = (uid) => { q.ensure.run(uid); return q.get.get(uid); };
const set = (uid, fields) => db.prepare(`UPDATE health_plans SET ${Object.keys(fields).map((k) => `${k} = @${k}`).join(', ')} WHERE user_id = @uid`).run({ ...fields, uid });

/** The player's active plan, or null. */
export function planOf(uid) {
  const r = q.get.get(uid);
  return r?.plan && r.until > now() ? healthPlanById[r.plan] || null : null;
}
const priced = (base, off) => Math.round((base * (1 - (off || 0))) / 100) * 100;
/** Hospital activity price after cover. */
export function hospitalPrice(uid, placeId, cost) {
  if (placeId !== HOSPITAL_ID || !cost) return cost;
  return priced(cost, planOf(uid)?.hospitalOff);
}

export function view(uid) {
  const u = getUser(uid);
  const r = row(uid);
  const plan = planOf(uid);
  const t = now();
  return {
    health: u.health ?? 100,
    injured: (u.health ?? 100) < HEALTH.injuredBelow,
    plan: plan ? { ...plan, until: r.until } : null,
    plans: HEALTH_PLANS,
    therapists: THERAPISTS,
    sessions: r.sessions,
    therapy: { price: priced(AFYA.therapy.price, plan?.therapyOff), readyAt: (r.last_therapy || 0) + AFYA.therapy.cooldownMs },
    doctor: { price: priced(AFYA.doctor.price, plan?.doctorOff), readyAt: (r.last_doctor || 0) + AFYA.doctor.cooldownMs },
    pharmacy: AFYA.pharmacy,
    pharmacyReadyAt: (r.last_pharmacy || 0) + AFYA.pharmacyCooldownMs,
    now: t,
  };
}

export const buyPlan = db.transaction((uid, id) => {
  const p = healthPlanById[id];
  if (!p) throw new GameError(['Mpango haupo', 'Plan not found'], 404);
  const r = row(uid);
  // Renewing the same plan stacks; switching starts fresh today.
  const base = r.plan === id && r.until > now() ? r.until : now();
  addMoney(uid, -p.price, 'spend', `🩺 ${p.name}`);
  set(uid, { plan: id, until: base + p.days * 86_400_000 });
  return view(uid);
});

function heal(uid, amount, effects) {
  const u = getUser(uid);
  const health = Math.min(100, (u.health ?? 100) + amount);
  const fields = { health };
  if (health >= HEALTH.injuredBelow) fields.injuredAt = null;
  if (effects) fields.needs = applyNeeds(u.needs, effects);
  saveFields(uid, fields);
  return health;
}
const wait = (readyAt) => {
  const ms = readyAt - now();
  if (ms > 0) throw new GameError([`Subiri dakika ${Math.ceil(ms / 60_000)}.`, `Wait ${Math.ceil(ms / 60_000)} min.`], 429);
};

export const therapy = db.transaction((uid, therapistId) => {
  const th = THERAPISTS.find((x) => x.id === therapistId);
  if (!th) throw new GameError(['Haipo', 'Not found'], 404);
  const v = view(uid);
  wait(v.therapy.readyAt);
  if (v.therapy.price) addMoney(uid, -v.therapy.price, 'spend', `🧠 ${th.name}`);
  const health = heal(uid, AFYA.therapy.health, AFYA.therapy.effects);
  db.prepare('UPDATE health_plans SET last_therapy = ?, sessions = sessions + 1 WHERE user_id = ?').run(now(), uid);
  return { health, paid: v.therapy.price, ...view(uid) };
});

export const doctor = db.transaction((uid) => {
  const v = view(uid);
  wait(v.doctor.readyAt);
  if (v.doctor.price) addMoney(uid, -v.doctor.price, 'spend', '📱 Daktari mtandaoni');
  const health = heal(uid, AFYA.doctor.health);
  set(uid, { last_doctor: now() });
  return { health, paid: v.doctor.price, ...view(uid) };
});

export const pharmacy = db.transaction((uid, id) => {
  const item = AFYA.pharmacy.find((x) => x.id === id);
  if (!item) throw new GameError(['Haipo', 'Not found'], 404);
  wait(row(uid).last_pharmacy + AFYA.pharmacyCooldownMs);
  addMoney(uid, -item.price, 'spend', `${item.emoji} ${item.name}`);
  const health = heal(uid, item.health, item.effects);
  set(uid, { last_pharmacy: now() });
  return { health, ...view(uid) };
});

/** Gold cover: health creeps back up every needs tick. */
export function planRegen(uid, health) {
  const p = planOf(uid);
  if (!p?.regen || health >= 100) return null;
  return Math.min(100, health + p.regen);
}
