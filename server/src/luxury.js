// Yachts and private jets: buy one in the Anasa app, board it from anywhere, invite people aboard,
// and sail/fly everyone aboard to another city. Each owner's yacht/jet is its own private room:
// players aboard carry `inside = 'yacht' | 'jet'` plus `host = ownerId`.
import { db, getUser, addMoney, GameError, now, saveFields } from './db.js';
import { online, emitTo, broadcast } from './presence.js';
import { isBlocked } from './crime.js';
import { notify } from './push.js';
import { LUXURY, luxuryById, LUXURY_RESALE, LUXURY_COLORS, LUXURY_PORTS, placeById, cityAt } from '../../shared/world.js';

db.exec(`CREATE TABLE IF NOT EXISTS luxury (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  model TEXT NOT NULL,
  color TEXT NOT NULL,
  name TEXT,
  bought_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS luxury_user ON luxury(user_id);`);

const q = {
  mine: db.prepare('SELECT * FROM luxury WHERE user_id = ? ORDER BY id'),
  one: db.prepare('SELECT * FROM luxury WHERE id = ? AND user_id = ?'),
  insert: db.prepare('INSERT INTO luxury (user_id, model, color, name, bought_at) VALUES (?, ?, ?, ?, ?)'),
  remove: db.prepare('DELETE FROM luxury WHERE id = ?'),
  rename: db.prepare('UPDATE luxury SET name = ? WHERE id = ?'),
};

const INVITE_TTL = 30 * 60_000;
const invites = new Map(); // `${hostId}:${guestId}:${kind}` -> expiresAt

/** The yacht/jet of this kind a player owns (their best one), or null. */
export function flagship(userId, kind) {
  const rows = q.mine.all(userId).filter((r) => luxuryById[r.model]?.kind === kind);
  return rows.sort((a, b) => luxuryById[b.model].price - luxuryById[a.model].price)[0] || null;
}
const shape = (r) => ({ id: r.id, model: r.model, color: r.color, name: r.name || luxuryById[r.model]?.name, boughtAt: r.bought_at, kind: luxuryById[r.model]?.kind });

export function luxuryValue(userId) {
  return q.mine.all(userId).reduce((s, r) => s + (luxuryById[r.model]?.price || 0) * LUXURY_RESALE, 0);
}

export function view(userId) {
  const t = now();
  const mine = q.mine.all(userId).map(shape);
  const invitedTo = [];
  for (const [k, exp] of invites) {
    const [host, guest, kind] = k.split(':');
    if (Number(guest) !== userId || exp < t) continue;
    const h = getUser(Number(host));
    const boat = flagship(Number(host), kind);
    if (h && boat) invitedTo.push({ hostId: h.id, host: h.username, kind, model: boat.model, name: boat.name || luxuryById[boat.model].name });
  }
  return { catalog: LUXURY, colors: LUXURY_COLORS, resale: LUXURY_RESALE, ports: LUXURY_PORTS, mine, invitedTo };
}

export const buy = db.transaction((userId, model, color) => {
  const m = luxuryById[model];
  if (!m) throw new GameError(['Haipo', 'Not found'], 404);
  if (q.mine.all(userId).some((r) => r.model === model)) throw new GameError(['Tayari unayo hii.', 'You already own this one.'], 409);
  addMoney(userId, -m.price, 'spend', `${m.emoji} ${m.name}`);
  q.insert.run(userId, model, LUXURY_COLORS.includes(color) ? color : LUXURY_COLORS[0], null, now());
  return view(userId);
});

export const sell = db.transaction((userId, id) => {
  const r = q.one.get(Number(id), userId);
  if (!r) throw new GameError(['Haipo', 'Not found'], 404);
  const got = Math.round(luxuryById[r.model].price * LUXURY_RESALE);
  q.remove.run(r.id);
  addMoney(userId, got, 'sale', `${luxuryById[r.model].emoji} ${luxuryById[r.model].name}`);
  return { got, ...view(userId) };
});

export function rename(userId, id, name) {
  const r = q.one.get(Number(id), userId);
  if (!r) throw new GameError(['Haipo', 'Not found'], 404);
  q.rename.run(String(name || '').replace(/\s+/g, ' ').trim().slice(0, 24) || null, r.id);
  return view(userId);
}

/** May this player board host's yacht/jet? */
export function canBoard(uid, hostId, kind) {
  if (!flagship(hostId, kind)) return false;
  if (uid === hostId) return true;
  if (isBlocked(uid, hostId)) return false;
  const exp = invites.get(`${hostId}:${uid}:${kind}`);
  return !!exp && exp > now();
}

export function invite(hostId, username, kind) {
  const boat = flagship(hostId, kind);
  if (!boat) throw new GameError([kind === 'jet' ? 'Huna jet.' : 'Huna yacht.', kind === 'jet' ? "You don't own a jet." : "You don't own a yacht."], 403);
  const u = db.prepare('SELECT id, username FROM users WHERE lower(username) = lower(?)').get(String(username || '').replace(/^@/, ''));
  if (!u || u.id === hostId) throw new GameError(['Mtumiaji hayupo', 'User not found'], 404);
  if (isBlocked(hostId, u.id)) throw new GameError(['Huwezi kumwalika.', "You can't invite them."], 403);
  invites.set(`${hostId}:${u.id}:${kind}`, now() + INVITE_TTL);
  const host = getUser(hostId);
  const name = boat.name || luxuryById[boat.model].name;
  const text = kind === 'jet'
    ? [`🛩️ @${host.username} anakualika ndani ya jet yake (${name})`, `🛩️ @${host.username} invited you aboard their jet (${name})`]
    : [`🛥️ @${host.username} anakualika kwenye yacht yake (${name})`, `🛥️ @${host.username} invited you aboard their yacht (${name})`];
  if (online.has(u.id)) emitTo(u.id, 'lux:invite', { hostId, host: host.username, kind, name, model: boat.model, text });
  else notify(u.id, text, { tag: `lux-${hostId}` }).catch(() => {});
  return { ok: true, to: u.username };
}

/** Who's aboard host's yacht/jet right now. */
export const aboard = (hostId, kind) => [...online].filter(([, o]) => o.inside === kind && o.host === hostId).map(([id]) => id);

/** Sail/fly: the owner takes everyone aboard to another city's port/airport. */
export function travel(hostId, kind, city) {
  const o = online.get(hostId);
  if (!o || o.inside !== kind || o.host !== hostId) throw new GameError(['Panda kwanza.', 'Board it first.'], 400);
  const placeId = LUXURY_PORTS[kind]?.[city];
  const dest = placeId && placeById[placeId];
  if (!dest) throw new GameError([kind === 'yacht' ? 'Yacht haifiki huko.' : 'Haiwezekani.', kind === 'yacht' ? "A yacht can't get there." : "Can't go there."]);
  if (cityAt(o.x, o.z)?.id === city) throw new GameError(['Uko hapo tayari.', "You're already there."]);
  const pos = [dest.pos[0], dest.pos[1] + dest.size[1] / 2 + 4];
  const host = getUser(hostId);
  const cityName = { dar: 'Dar es Salaam', znz: 'Zanzibar', aru: 'Arusha' }[city];
  for (const id of aboard(hostId, kind)) {
    const p = online.get(id);
    Object.assign(p, { x: pos[0] + (Math.random() - 0.5) * 3, z: pos[1] + (Math.random() - 0.5) * 2 });
    saveFields(id, { x: p.x, z: p.z });
    emitTo(id, 'teleport', { pos: [p.x, p.z] });
    emitTo(id, 'toast', { text: kind === 'jet' ? [`🛬 Mmetua ${cityName} na jet ya @${host.username}!`, `🛬 Landed in ${cityName} on @${host.username}'s jet!`] : [`⚓ Mmefika ${cityName} kwa yacht ya @${host.username}!`, `⚓ Arrived in ${cityName} on @${host.username}'s yacht!`] });
  }
  broadcast('emote', { id: hostId, e: kind === 'jet' ? '🛫' : '⛵' });
  return { ok: true, city };
}

void now;
export { LUXURY };
