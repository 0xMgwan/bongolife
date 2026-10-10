// Nightlife money: make it rain (notes anyone in the venue can pick up) and tipping the DJ/staff.
import crypto from 'node:crypto';
import { getUser, saveFields, addMoney, GameError, now } from './db.js';
import { placeById } from '../../shared/world.js';
import { online, emitTo, broadcast } from './presence.js';

export const RAIN = { amounts: [10_000, 50_000, 100_000, 500_000], ttlMs: 90_000, maxNotes: 40, venues: ['club', 'lounge', 'bar', 'singeli', 'kendwa', 'casino', 'viavia', 'nyamachoma'] };
const drops = new Map(); // placeId -> Map(id -> drop)

/** Who's in this venue right now (inside it, or busy there). */
function here(placeId) {
  return [...online].filter(([, o]) => o.inside === placeId || o.busy?.placeId === placeId).map(([id]) => id);
}
function assertHere(userId, placeId) {
  if (!RAIN.venues.includes(placeId) || !placeById[placeId]) throw new GameError(['Hapa si mahali pa kurusha pesa.', "You can't do that here."]);
  const o = online.get(userId);
  if (!o || (o.inside !== placeId && o.busy?.placeId !== placeId)) throw new GameError(['Ingia ndani kwanza.', 'Go inside first.']);
}
const tell = (placeId, event, data) => { for (const id of here(placeId)) emitTo(id, event, data); };

function sweep(placeId) {
  const m = drops.get(placeId);
  if (!m) return;
  const t = now();
  for (const [id, d] of m) if (d.expires < t) m.delete(id);
}

/** Throw money: split into notes that fall around the floor. */
export function rain(userId, placeId, amount) {
  assertHere(userId, placeId);
  amount = Math.floor(Number(amount));
  if (!RAIN.amounts.includes(amount)) throw new GameError(['Chagua kiasi.', 'Pick an amount.']);
  const me = getUser(userId);
  addMoney(userId, -amount, 'spend', `💸 Kurusha pesa — ${placeById[placeId].name}`);
  const note = amount >= 100_000 ? 10_000 : amount >= 50_000 ? 5_000 : 1_000;
  let count = Math.min(RAIN.maxNotes, Math.floor(amount / note));
  const value = Math.floor(amount / count);
  sweep(placeId);
  const m = drops.get(placeId) || new Map();
  drops.set(placeId, m);
  const out = [];
  const t = now();
  while (count-- > 0) {
    const d = { id: crypto.randomUUID().slice(0, 8), value, x: (Math.random() - 0.5) * 9, z: (Math.random() - 0.5) * 7 + 1, delay: Math.random() * 1.6, expires: t + RAIN.ttlMs };
    m.set(d.id, d);
    out.push(d);
  }
  saveFields(userId, { fame: me.fame + (amount >= 100_000 ? 2 : 1) });
  broadcast('emote', { id: userId, e: '💸' });
  tell(placeId, 'rain', { placeId, from: me.username, drops: out, total: amount });
  return { thrown: amount };
}

/** Pick up a note — first come, first served. */
const lastPick = new Map();
export function pick(userId, placeId, dropId) {
  assertHere(userId, placeId);
  if (now() - (lastPick.get(userId) || 0) < 250) throw new GameError(['Pole pole!', 'Easy!'], 429);
  lastPick.set(userId, now());
  sweep(placeId);
  const m = drops.get(placeId);
  const d = m?.get(String(dropId));
  if (!d) return { gone: true };
  m.delete(d.id);
  addMoney(userId, d.value, 'gift', `💸 Pesa iliyorushwa — ${placeById[placeId].name}`);
  tell(placeId, 'rain:picked', { placeId, id: d.id, by: getUser(userId).username });
  return { value: d.value };
}

export function current(placeId) {
  sweep(placeId);
  return [...(drops.get(placeId)?.values() || [])].map((d) => ({ ...d, delay: 0 }));
}

/** Tip the DJ / bartender. If a player is working that shift here, they get it. */
export function tip(userId, placeId, amount) {
  assertHere(userId, placeId);
  amount = Math.floor(Number(amount));
  if (![5_000, 20_000, 50_000, 100_000].includes(amount)) throw new GameError(['Chagua kiasi.', 'Pick an amount.']);
  const me = getUser(userId);
  const worker = [...online].find(([id, o]) => id !== userId && o.busy?.kind === 'job' && o.busy.placeId === placeId);
  addMoney(userId, -amount, 'spend', `🎧 Tip — ${placeById[placeId].name}`);
  if (worker) {
    addMoney(worker[0], amount, 'gift', `🎧 Tip kutoka @${me.username}`);
    emitTo(worker[0], 'toast', { text: [`🎧 @${me.username} amekupa tip TSh ${amount.toLocaleString()}!`, `🎧 @${me.username} tipped you TSh ${amount.toLocaleString()}!`], refresh: true });
  }
  saveFields(userId, { fame: me.fame + 1 });
  tell(placeId, 'toast', { text: [`🎧 @${me.username} amempa DJ tip TSh ${amount.toLocaleString()} 🔥`, `🎧 @${me.username} tipped the DJ TSh ${amount.toLocaleString()} 🔥`] });
  return { to: worker ? getUser(worker[0]).username : null };
}
