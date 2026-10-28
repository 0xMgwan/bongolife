// Familia: married couples (with another player or a game character) can plan a baby, raise
// their kids (play, outings, school fees, gifts) and — if it comes to it — divorce.
import { db, getUser, saveFields, addMoney, GameError, now } from './db.js';
import { FAMILY, familyStage, loveNpcById, NEEDS, randomAppearance } from '../../shared/world.js';
import { emitTo, broadcast } from './presence.js';
import { partnersOf, endRelationship } from './love.js';
import { npcPartner, end as endNpc } from './npclove.js';

db.exec(`CREATE TABLE IF NOT EXISTS children (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_a INTEGER NOT NULL, partner_kind TEXT NOT NULL, partner_id TEXT NOT NULL,
  name TEXT NOT NULL, gender TEXT NOT NULL, look TEXT NOT NULL,
  born_at INTEGER NOT NULL, joy INTEGER NOT NULL DEFAULT 60, smart INTEGER NOT NULL DEFAULT 0, last_care INTEGER
);
CREATE TABLE IF NOT EXISTS pregnancies (
  user_id INTEGER PRIMARY KEY, partner_kind TEXT NOT NULL, partner_id TEXT NOT NULL,
  name TEXT NOT NULL, gender TEXT NOT NULL, due_at INTEGER NOT NULL, tried_at INTEGER NOT NULL
);`);
const q = {
  kids: db.prepare("SELECT * FROM children WHERE parent_a = ? OR (partner_kind = 'player' AND partner_id = ?) ORDER BY born_at"),
  kid: db.prepare('SELECT * FROM children WHERE id = ?'),
  preg: db.prepare("SELECT * FROM pregnancies WHERE user_id = ? OR (partner_kind = 'player' AND partner_id = ?)"),
  due: db.prepare('SELECT * FROM pregnancies WHERE due_at <= ?'),
};

/** Who you're married to: { kind: 'player'|'npc', id, name, rid? } or null. */
export function spouseOf(uid) {
  const p = partnersOf(uid).find((x) => x.status === 'married');
  if (p) return { kind: 'player', id: String(p.id), name: `@${p.username}`, rid: p.rid };
  const n = npcPartner(uid);
  if (n?.status === 'married') return { kind: 'npc', id: n.id, name: n.name, look: n.look };
  return null;
}

const shape = (c, t = now()) => {
  const st = familyStage(c.born_at, t);
  return { id: c.id, name: c.name, gender: c.gender, look: JSON.parse(c.look), born: c.born_at, age: st.age, stage: st.label, emoji: st.emoji, joy: c.joy, smart: c.smart, careReadyAt: (c.last_care || 0) + FAMILY.careCooldownMs };
};
/** Light list for the home scene. */
export const kidsBrief = (uid) => q.kids.all(uid, String(uid)).map((c) => shape(c));

export function view(uid) {
  const preg = q.preg.get(uid, String(uid));
  return {
    spouse: spouseOf(uid),
    pregnancy: preg ? { name: preg.name, gender: preg.gender, dueAt: preg.due_at } : null,
    kids: kidsBrief(uid),
    rules: FAMILY,
    divorceCost: Math.max(FAMILY.divorceMin, Math.round(getUser(uid).money * FAMILY.divorcePct)),
  };
}

const clean = (s) => String(s || '').replace(/[^\p{L}\p{N} '-]/gu, '').trim().slice(0, 20);
export const planBaby = db.transaction((uid, nameIn, genderIn) => {
  const sp = spouseOf(uid);
  if (!sp) throw new GameError(['Mnahitaji kuoana kwanza 💍', 'You need to be married first 💍']);
  if (q.preg.get(uid, String(uid))) throw new GameError(['Mtoto yuko njiani tayari 🤰🏾', 'A baby is already on the way 🤰🏾']);
  if (kidsBrief(uid).length >= FAMILY.maxKids) throw new GameError([`Familia imejaa (watoto ${FAMILY.maxKids}).`, `Your family is full (${FAMILY.maxKids} kids).`]);
  const last = db.prepare('SELECT MAX(born_at) t FROM children WHERE parent_a = ?').get(uid)?.t || 0;
  if (now() - last < FAMILY.tryCooldownMs) throw new GameError(['Pumzikeni kidogo kabla ya mtoto mwingine 😅', 'Take a breather before the next baby 😅'], 429);
  const gender = genderIn === 'boy' || genderIn === 'girl' ? genderIn : Math.random() < 0.5 ? 'boy' : 'girl';
  const name = clean(nameIn) || FAMILY.names[gender][Math.floor(Math.random() * FAMILY.names[gender].length)];
  db.prepare('INSERT INTO pregnancies (user_id, partner_kind, partner_id, name, gender, due_at, tried_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(uid, sp.kind, sp.id, name, gender, now() + FAMILY.babyMs, now());
  if (sp.kind === 'player') emitTo(Number(sp.id), 'toast', { text: [`🤰🏾 Mtoto yuko njiani! @${getUser(uid).username} na wewe mnatarajia ${name}.`, `🤰🏾 A baby is on the way! You and @${getUser(uid).username} are expecting ${name}.`], refresh: true });
  return view(uid);
});

let onBirth = null;
export const setBirthHook = (fn) => (onBirth = fn);
/** Every minute: babies whose time has come are born. */
export const birthTick = db.transaction(() => {
  for (const p of q.due.all(now())) {
    db.prepare('DELETE FROM pregnancies WHERE user_id = ?').run(p.user_id);
    const look = { ...randomAppearance(), body: p.gender === 'girl' ? 'woman' : 'man', outfit: p.gender === 'girl' ? 'sundress' : 'tshirt', hair: p.gender === 'girl' ? 'misuko' : 'kiduku' };
    db.prepare('INSERT INTO children (parent_a, partner_kind, partner_id, name, gender, look, born_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(p.user_id, p.partner_kind, p.partner_id, p.name, p.gender, JSON.stringify(look), now());
    const u = getUser(p.user_id);
    const other = p.partner_kind === 'player' ? getUser(Number(p.partner_id))?.username : loveNpcById[p.partner_id]?.name;
    const text = [`👶🏾 Hongera! ${p.name} amezaliwa — ${p.gender === 'girl' ? 'mtoto wa kike' : 'mtoto wa kiume'}!`, `👶🏾 Congratulations! ${p.name} is born — a baby ${p.gender}!`];
    emitTo(p.user_id, 'toast', { text, refresh: true });
    if (p.partner_kind === 'player') emitTo(Number(p.partner_id), 'toast', { text, refresh: true });
    broadcast('emote', { id: p.user_id, e: '👶🏾' });
    onBirth?.(u, other, p);
  }
});

export const care = db.transaction((uid, kidId, actId) => {
  const c = q.kid.get(Number(kidId));
  if (!c || (c.parent_a !== uid && !(c.partner_kind === 'player' && c.partner_id === String(uid)))) throw new GameError(['Si mtoto wako.', "That's not your child."], 404);
  const a = FAMILY.care.find((x) => x.id === actId);
  if (!a) throw new GameError(['Haijulikani', 'Unknown']);
  const wait = (c.last_care || 0) + FAMILY.careCooldownMs - now();
  if (wait > 0) throw new GameError([`${c.name} anapumzika — rudi baada ya dakika ${Math.ceil(wait / 60_000)}.`, `${c.name} needs a break — back in ${Math.ceil(wait / 60_000)} min.`], 429);
  if (a.cost) addMoney(uid, -a.cost, 'spend', `${a.emoji} ${a.name[0]} — ${c.name}`);
  db.prepare('UPDATE children SET joy = MIN(100, joy + ?), smart = smart + ?, last_care = ? WHERE id = ?').run(a.joy, a.smart || 0, now(), c.id);
  if (a.effects) {
    const u = getUser(uid);
    const needs = { ...u.needs };
    for (const [k, v] of Object.entries(a.effects)) if (NEEDS.some((n) => n.id === k)) needs[k] = Math.max(0, Math.min(100, (needs[k] ?? 50) + v));
    saveFields(uid, { needs });
  }
  return view(uid);
});

/** Divorce: the one who files pays a settlement (to a player ex); the kids stay with both parents. */
export const divorce = db.transaction((uid) => {
  const sp = spouseOf(uid);
  if (!sp) throw new GameError(['Hujaoa/olewa.', "You're not married."]);
  const cost = Math.max(FAMILY.divorceMin, Math.round(getUser(uid).money * FAMILY.divorcePct));
  const paid = Math.min(cost, Math.max(0, getUser(uid).money));
  if (paid) addMoney(uid, -paid, 'spend', `⚖️ Talaka — fidia kwa ${sp.name}`);
  if (sp.kind === 'player') {
    if (paid) addMoney(Number(sp.id), paid, 'income', `⚖️ Fidia ya talaka kutoka @${getUser(uid).username}`);
    endRelationship(uid, sp.rid);
  } else {
    endNpc(uid, sp.id, true);
  }
  db.prepare('DELETE FROM pregnancies WHERE user_id = ? OR (partner_kind = ? AND partner_id = ?)').run(uid, sp.kind, sp.id);
  return { spouse: sp, cost, ...view(uid) };
});
