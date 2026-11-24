// The monthly subscription and paid perks. Both are paid with real mobile money through the
// payment provider; the `topups` row carries purpose 'sub' (ref_id = months) or 'perk'
// (ref_id = index in PERKS), and api.js's applyTopupStatus calls applyPurchase once it is paid.
import { db, getUser, saveFields, GameError, now, getSettings } from './db.js';
import { SUBSCRIPTION, PERKS, perkById, NEEDS } from '../../shared/world.js';
import { grantGuards, guardOf } from './guards.js';
import { emitTo } from './presence.js';
import { provider } from './payments/index.js';

const DAY = 86_400_000;
const cols = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name);
if (!cols.includes('paid_until')) db.exec('ALTER TABLE users ADD COLUMN paid_until INTEGER');
db.exec(`CREATE TABLE IF NOT EXISTS perks (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, perk TEXT NOT NULL, until INTEGER NOT NULL,
  PRIMARY KEY (user_id, perk)
);`);

const q = {
  row: db.prepare('SELECT id, created_at, paid_until, is_admin FROM users WHERE id = ?'),
  setUntil: db.prepare('UPDATE users SET paid_until = ? WHERE id = ?'),
  perk: db.prepare('SELECT until FROM perks WHERE user_id = ? AND perk = ?'),
  perks: db.prepare('SELECT perk, until FROM perks WHERE user_id = ? AND until > ?'),
  setPerk: db.prepare('INSERT INTO perks (user_id, perk, until) VALUES (?, ?, ?) ON CONFLICT(user_id, perk) DO UPDATE SET until = excluded.until'),
  pending: db.prepare("SELECT id, purpose, ref_id, amount_tzs, created_at FROM topups WHERE user_id = ? AND purpose IN ('sub', 'perk') AND status = 'pending' AND created_at > ? ORDER BY id DESC"),
};

/** Paid (or free) until: the stored date, else the free first month (and never before launch). */
const untilOf = (r) => r.paid_until ?? Math.max(r.created_at + SUBSCRIPTION.trialDays * DAY, SUBSCRIPTION.startsAt);
export const subscriptionsOn = () => getSettings().subscriptionsEnabled !== false;

export function subOf(uid) {
  const r = q.row.get(uid);
  if (!r) return null;
  const until = untilOf(r);
  const exempt = !!r.is_admin;
  const t = now();
  return {
    until, exempt, enabled: subscriptionsOn(),
    active: exempt || !subscriptionsOn() || until > t,
    trial: r.paid_until == null,
    daysLeft: Math.max(0, Math.ceil((until - t) / DAY)),
    priceTzs: SUBSCRIPTION.priceTzs, plans: SUBSCRIPTION.plans, remindDays: SUBSCRIPTION.remindDays,
  };
}
export const isLocked = (uid) => !subOf(uid)?.active;

export function perksOf(uid) {
  return Object.fromEntries(q.perks.all(uid, now()).map((r) => [r.perk, r.until]));
}
export const hasPerk = (uid, id) => (q.perk.get(uid, id)?.until || 0) > now();

export function view(uid) {
  return {
    sub: subOf(uid), perks: PERKS, mine: perksOf(uid),
    pending: q.pending.all(uid, now() - 15 * 60_000),
    payments: provider ? { methods: provider.methods, livemode: provider.livemode } : null,
  };
}

/** Starts a mobile-money payment for a subscription or a perk. Returns the topups row id. */
export async function startPayment(user, { kind, months, perkId, phone }) {
  if (!provider) throw new GameError(['Malipo hayajawashwa bado.', 'Payments are not enabled yet.'], 503);
  let amountTzs, purpose, refId;
  if (kind === 'sub') {
    const m = Math.floor(Number(months));
    if (!SUBSCRIPTION.plans.includes(m)) throw new GameError(['Mpango huo haupo.', 'No such plan.']);
    amountTzs = SUBSCRIPTION.priceTzs * m; purpose = 'sub'; refId = m;
  } else {
    const i = PERKS.findIndex((p) => p.id === perkId);
    if (i < 0) throw new GameError(['Ofa hiyo haipo.', 'No such perk.']);
    const g = PERKS[i].id === 'guards' && guardOf(user.id);
    if (g && g.id !== 'bodyguard' && g.id !== 'mlinzi') throw new GameError(['Tayari una ulinzi mkubwa zaidi.', 'You already have stronger protection.']);
    amountTzs = PERKS[i].priceTzs; purpose = 'perk'; refId = i;
  }
  const busy = db.prepare("SELECT COUNT(*) n FROM topups WHERE user_id = ? AND status = 'pending' AND created_at > ?").get(user.id, now() - 15 * 60_000).n;
  if (busy >= 3) throw new GameError(['Una malipo 3 yanayosubiri. Yamalize kwanza.', 'You have 3 pending payments. Finish them first.']);
  let created;
  try {
    created = await provider.create({ amountTzs, phone, user });
  } catch (e) {
    throw new GameError(e.userMessage || ['Imeshindikana kuanzisha malipo. Jaribu tena.', 'Could not start the payment. Please try again.'], e.status || 502, e.code);
  }
  const info = db.prepare(
    'INSERT INTO topups (user_id, provider, provider_ref, method, phone, amount_tzs, coins, status, instructions, created_at, purpose, ref_id) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)',
  ).run(user.id, provider.id, created.ref, provider.methods[0], phone, amountTzs, 'pending', created.instructions ? JSON.stringify(created.instructions) : null, now(), purpose, refId);
  if (!user.phone) saveFields(user.id, { phone });
  return { id: info.lastInsertRowid, status: 'pending', amountTzs, instructions: created.instructions };
}

/** Called inside the transaction that marks a sub/perk payment paid. Returns the toast text. */
export function applyPurchase(t) {
  if (t.purpose === 'sub') return extendSub(t.user_id, t.ref_id * SUBSCRIPTION.days, 'paid');
  const perk = PERKS[t.ref_id];
  if (!perk) return null;
  return grantPerk(t.user_id, perk.id);
}

/** Adds days to a player's subscription, from today or from the end of the current period. */
export function extendSub(uid, days, why = 'paid') {
  const r = q.row.get(uid);
  const until = Math.max(now(), untilOf(r)) + days * DAY;
  q.setUntil.run(until, uid);
  const d = new Date(until).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Dar_es_Salaam' });
  emitTo(uid, 'subscription', subOf(uid));
  return why === 'paid'
    ? [`✅ Asante! Bongo Life iko wazi kwako hadi ${d}.`, `✅ Thank you! Bongo Life is yours until ${d}.`]
    : [`🎁 Umepewa siku ${days} za bure — hadi ${d}.`, `🎁 You got ${days} free days — until ${d}.`];
}

export function grantPerk(uid, id) {
  const perk = perkById[id];
  if (id === 'refill') {
    const needs = Object.fromEntries(NEEDS.map((n) => [n.id, 100]));
    saveFields(uid, { needs });
    emitTo(uid, 'needs', { needs, mood: 100, health: getUser(uid).health });
  } else {
    const g = id === 'guards' ? guardOf(uid) : null;
    const cur = Math.max(q.perk.get(uid, id)?.until || 0, g?.id === 'bodyguard' ? g.until : 0);
    const until = Math.max(now(), cur) + perk.days * DAY;
    q.setPerk.run(uid, id, until);
    if (id === 'guards') grantGuards(uid, 'bodyguard', until);
  }
  return [`${perk.emoji} ${perk.name[0]} — imewashwa!`, `${perk.emoji} ${perk.name[1]} — activated!`];
}
