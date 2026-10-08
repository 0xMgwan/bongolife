// Street life: quick interactions, robbery, police, cells, bail, lawyers and court.
import { CRIME, INTERACTIONS, INTERACT_RANGE, POLICE_ID, COURT_ID, placeById } from '../../shared/world.js';
import { db, getUser, saveFields, addMoney, GameError, now } from './db.js';
import { online, broadcast, emitTo } from './presence.js';
import { applyNeeds } from './game.js';
import { bumpStats } from './story.js';

const jailed = (u) => !!u?.jail && u.jail.phase !== 'free';
export const isJailed = jailed;

/** Stop people from working, travelling etc. while they're held. */
export function assertFree(user) {
  if (!jailed(user)) return;
  throw new GameError(['Uko mikononi mwa polisi — maliza kwanza (faini, dhamana au mahakama).', "You're in police custody — sort it out first (fine, bail or court)."], 403, 'jailed');
}

const door = (placeId) => {
  const p = placeById[placeId];
  return [p.pos[0], p.pos[1] + p.size[1] / 2 + 2.5];
};
function moveTo(userId, placeId) {
  const [x, z] = door(placeId);
  saveFields(userId, { x, z });
  const p = online.get(userId);
  if (p) {
    Object.assign(p, { x, z, inside: placeId });
    broadcast('player:inside', { id: userId, inside: placeId });
    emitTo(userId, 'teleport', { pos: [x, z] });
  }
}

/** Two online players standing close enough to interact (in town, not at home). */
function nearby(aId, bId, range) {
  const a = online.get(aId);
  const b = online.get(bId);
  if (!b) throw new GameError(['Hayuko online sasa.', "They're not online right now."]);
  if (!a || a.inside === 'home' || b.inside === 'home' || Math.hypot(a.x - b.x, a.z - b.z) > range)
    throw new GameError(['Msogelee kwanza.', 'Get closer to them first.'], 400, 'too_far');
}

export const isBlocked = (a, b) => !!db.prepare('SELECT 1 FROM blocks WHERE (user_id = ? AND blocked_id = ?) OR (user_id = ? AND blocked_id = ?)').get(a, b, b, a);
export const blockedIds = (userId) => db.prepare('SELECT blocked_id id FROM blocks WHERE user_id = ?').all(userId).map((r) => r.id);

// ------------------------------------------------------------ interactions
const lastInteract = new Map(); // "a:b:kind" -> ts
export const interact = db.transaction((userId, target, kind) => {
  const def = INTERACTIONS.find((i) => i.id === kind);
  if (!def) throw new GameError(['Haipo', 'Unknown'], 404);
  if (isBlocked(userId, target.id)) throw new GameError(['Huwezi kuongea na mtu huyu.', "You can't interact with this person."], 403);
  nearby(userId, target.id, INTERACT_RANGE);
  const key = `${userId}:${target.id}:${kind}`;
  if (now() - (lastInteract.get(key) || 0) < 20_000) throw new GameError(['Pole pole! Subiri kidogo.', 'Easy! Give it a moment.'], 429);
  lastInteract.set(key, now());
  const me = getUser(userId);
  const ok = def.chance == null || Math.random() < def.chance;
  saveFields(userId, { needs: applyNeeds(me.needs, ok ? def.effects : def.fail) });
  bumpStats(userId, ['interact', `interact:${kind}`]);
  if (ok && def.them) saveFields(target.id, { needs: applyNeeds(getUser(target.id).needs, def.them) });
  // A little line in your private chat, like a nudge.
  db.prepare('INSERT INTO messages (from_id, to_id, body, created_at) VALUES (?, ?, ?, ?)').run(userId, target.id, `::${kind}${ok ? '' : ':fail'}`, now());
  broadcast('emote', { id: userId, e: ok ? def.emoji : '😬' });
  emitTo(target.id, 'nudge', { from: me.username, kind, ok });
  return { ok };
});

// ---------------------------------------------------------------- robbery
const lastRob = new Map();
export const rob = db.transaction((userId, target) => {
  const me = getUser(userId);
  assertFree(me);
  if (target.id === userId) throw new GameError(['😅', '😅']);
  if (isBlocked(userId, target.id)) throw new GameError(['Huwezi.', "You can't."], 403);
  nearby(userId, target.id, CRIME.robRange);
  if (jailed(target)) throw new GameError(['Yuko mikononi mwa polisi.', "They're in police custody."]);
  if (now() - (lastRob.get(userId) || 0) < CRIME.robCooldownMs) throw new GameError(['Polisi wanakuangalia — subiri kwanza.', 'The police are watching you — lie low for a while.'], 429);
  lastRob.set(userId, now());
  // Every report the police have on you makes the next job riskier.
  const heat = Math.min(0.25, (me.stats?.police_reports || 0) * 0.05);
  if (Math.random() > CRIME.robSuccess - heat || target.money < CRIME.robMin) {
    arrest(userId, ['Jaribio la wizi', 'Attempted robbery'], CRIME.fine);
    emitTo(target.id, 'toast', { text: [`🚓 @${me.username} alijaribu kukuibia — polisi wamemkamata!`, `🚓 @${me.username} tried to rob you — the police caught them!`] });
    return { caught: true };
  }
  const amount = Math.max(CRIME.robMin, Math.min(CRIME.robMax, Math.floor(target.money * CRIME.robPct)));
  addMoney(target.id, -amount, 'robbed', `Umeibiwa na @${me.username}`);
  addMoney(userId, amount, 'robbery', `Umemwibia @${target.username}`);
  const info = db.prepare('INSERT INTO robberies (robber_id, victim_id, amount, created_at) VALUES (?, ?, ?, ?)').run(userId, target.id, amount, now());
  broadcast('emote', { id: target.id, e: '😱' });
  emitTo(target.id, 'robbed', { by: me.username, amount, robberyId: info.lastInsertRowid });
  return { amount };
});

/** Victim reports a robber; police may catch them and return the money. */
export const reportToPolice = db.transaction((userId, target) => {
  const r = db.prepare('SELECT * FROM robberies WHERE robber_id = ? AND victim_id = ? AND reported = 0 AND created_at > ? ORDER BY id DESC LIMIT 1')
    .get(target.id, userId, now() - CRIME.reportWindowMs);
  if (!r) return { found: false };
  db.prepare('UPDATE robberies SET reported = 1 WHERE id = ?').run(r.id);
  const robber = getUser(target.id);
  if (jailed(robber) || Math.random() > CRIME.catchChance) {
    return { found: true, caught: false };
  }
  const back = Math.min(r.amount, Math.max(0, robber.money));
  if (back > 0) {
    addMoney(robber.id, -back, 'fine', `Pesa ya wizi imerudishwa kwa @${getUser(userId).username}`);
    addMoney(userId, back, 'refund', `Polisi wamerudisha pesa kutoka kwa @${robber.username}`);
  }
  arrest(robber.id, ['Wizi', 'Robbery'], CRIME.fine);
  return { found: true, caught: true, back };
});

// ------------------------------------------------------- police & court
export function arrest(userId, reason, fine) {
  db.prepare('INSERT INTO arrests (user_id, reason, fine, created_at) VALUES (?, ?, ?, ?)').run(userId, JSON.stringify(reason), fine, now());
  saveFields(userId, { jail: { phase: 'arrested', reason, fine, bail: Math.round((fine * CRIME.bailPct) / 1000) * 1000, at: now() }, busy: null });
  moveTo(userId, POLICE_ID);
  const u = getUser(userId);
  broadcast('emote', { id: userId, e: '🚓' });
  emitTo(userId, 'arrested', { jail: u.jail });
}

/** Choose what to do after an arrest. */
export const jailChoose = db.transaction((userId, option) => {
  const u = getUser(userId);
  const j = u.jail;
  if (!j || j.phase !== 'arrested') throw new GameError(['Hakuna kesi.', 'Nothing to decide.']);
  if (option === 'fine') {
    if (u.money < j.fine) throw new GameError(['Huna pesa ya kutosha kulipa faini.', "You can't afford the fine."]);
    addMoney(userId, -j.fine, 'fine', `Faini: ${j.reason[0]}`);
    saveFields(userId, { jail: null });
    return { free: true };
  }
  if (option === 'cell') {
    saveFields(userId, { jail: { ...j, phase: 'cell', until: now() + CRIME.cellMs } });
    return { cell: true };
  }
  if (option === 'lawyer') {
    if (u.money < CRIME.lawyerFee) throw new GameError(['Huna pesa ya wakili.', "You can't afford a lawyer."]);
    addMoney(userId, -CRIME.lawyerFee, 'spend', 'Ada ya wakili');
    saveFields(userId, { jail: { ...j, phase: 'court', courtAt: now() + CRIME.courtDelayMs } });
    moveTo(userId, COURT_ID);
    return { court: true };
  }
  throw new GameError(['Chaguo si sahihi', 'Invalid option']);
});

export const payBail = db.transaction((userId) => {
  const u = getUser(userId);
  if (u.jail?.phase !== 'cell') throw new GameError(['Huko rumande.', "You're not in a cell."]);
  if (u.money < u.jail.bail) throw new GameError(['Huna pesa ya dhamana.', "You can't afford bail."]);
  addMoney(userId, -u.jail.bail, 'fine', 'Dhamana');
  saveFields(userId, { jail: null });
  return { free: true };
});

/** Release when the cell time is up; give the court verdict when the hearing time comes. */
export const jailTick = db.transaction((userId) => {
  const u = getUser(userId);
  const j = u.jail;
  if (!j) return { free: true };
  if (j.phase === 'cell' && now() >= j.until) {
    saveFields(userId, { jail: null });
    return { free: true, released: true };
  }
  if (j.phase === 'court' && now() >= j.courtAt) {
    const win = Math.random() < CRIME.winChance;
    if (win) {
      saveFields(userId, { jail: null });
      return { free: true, verdict: 'win' };
    }
    saveFields(userId, { jail: { ...j, phase: 'cell', until: now() + CRIME.cellMs / 2, verdict: 'lose' } });
    moveTo(userId, POLICE_ID);
    return { verdict: 'lose' };
  }
  return { jail: j };
});

// ------------------------------------------------------- block & report
export function toggleBlock(userId, targetId) {
  if (db.prepare('SELECT 1 FROM blocks WHERE user_id = ? AND blocked_id = ?').get(userId, targetId)) {
    db.prepare('DELETE FROM blocks WHERE user_id = ? AND blocked_id = ?').run(userId, targetId);
    return false;
  }
  db.prepare('INSERT INTO blocks (user_id, blocked_id, created_at) VALUES (?, ?, ?)').run(userId, targetId, now());
  return true;
}
export function reportPlayer(userId, targetId, reason, note) {
  const context = db.prepare(`SELECT from_id, body, created_at FROM messages WHERE ((from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?)) ORDER BY id DESC LIMIT 30`).all(userId, targetId, targetId, userId);
  db.prepare('INSERT INTO player_reports (reporter_id, target_id, reason, note, context, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(userId, targetId, reason, note || null, JSON.stringify(context), now());
  db.prepare('INSERT OR IGNORE INTO blocks (user_id, blocked_id, created_at) VALUES (?, ?, ?)').run(userId, targetId, now());
}
