// Build mode: each player's yard of blocks beside their house, and the shop they can open there.
import { YARD, yardBlockById, moodOf } from '../../shared/world.js';
import { db, getUser, saveFields, addMoney, GameError } from './db.js';
import { emitTo } from './presence.js';
import { applyNeeds } from './game.js';

const q = {
  blocks: db.prepare('SELECT x, y, z, kind FROM yard_blocks WHERE user_id = ?'),
  at: db.prepare('SELECT kind FROM yard_blocks WHERE user_id = ? AND x = ? AND y = ? AND z = ?'),
  count: db.prepare('SELECT COUNT(*) n FROM yard_blocks WHERE user_id = ?'),
  put: db.prepare('INSERT INTO yard_blocks (user_id, x, y, z, kind) VALUES (?, ?, ?, ?, ?)'),
  del: db.prepare('DELETE FROM yard_blocks WHERE user_id = ? AND x = ? AND y = ? AND z = ?'),
  above: db.prepare('SELECT COUNT(*) n FROM yard_blocks WHERE user_id = ? AND x = ? AND z = ? AND y > ?'),
  meta: db.prepare('SELECT name, open, sales, earned FROM yards WHERE user_id = ?'),
  upsert: db.prepare('INSERT INTO yards (user_id, name, open) VALUES (@id, @name, @open) ON CONFLICT(user_id) DO UPDATE SET name = @name, open = @open'),
  sale: db.prepare('INSERT INTO yards (user_id, sales, earned) VALUES (?, 1, ?) ON CONFLICT(user_id) DO UPDATE SET sales = sales + 1, earned = earned + excluded.earned'),
};

const cell = (v, max) => Number.isInteger(v) && v >= 0 && v < max;

export function yardOf(userId) {
  const m = q.meta.get(userId);
  return { blocks: q.blocks.all(userId), name: m?.name || '', open: !!m?.open, sales: m?.sales || 0, earned: m?.earned || 0 };
}

/** Place one block. It needs ground or a block under it (no floating), and costs the block's price. */
export const placeBlock = db.transaction((userId, { x, y, z, kind }) => {
  const def = yardBlockById[kind];
  if (!def) throw new GameError(['Kitu hicho hakipo.', 'Unknown block.']);
  if (!cell(x, YARD.w) || !cell(z, YARD.d) || !cell(y, YARD.h)) throw new GameError(['Nje ya uwanja wako.', 'Outside your yard.']);
  if (q.at.get(userId, x, y, z)) throw new GameError(['Tayari kuna kitu hapo.', 'Something is already there.']);
  if (y > 0 && !q.at.get(userId, x, y - 1, z)) throw new GameError(['Weka kitu chini yake kwanza.', 'Put something under it first.']);
  if (q.count.get(userId).n >= YARD.maxBlocks) throw new GameError([`Umefikia kikomo cha vitu ${YARD.maxBlocks}.`, `You've hit the ${YARD.maxBlocks}-block limit.`]);
  const user = getUser(userId);
  if (user.money < def.price) throw new GameError(['Pesa haitoshi.', "You can't afford that."]);
  addMoney(userId, -def.price, 'build', `Ujenzi: ${def.name}`);
  q.put.run(userId, x, y, z, kind);
  return { money: user.money - def.price };
});

/** Remove one block (not one that's holding others up); half the price comes back. */
export const removeBlock = db.transaction((userId, { x, y, z }) => {
  const row = q.at.get(userId, x, y, z);
  if (!row) throw new GameError(['Hakuna kitu hapo.', "There's nothing there."]);
  if (q.above.get(userId, x, z, y).n) throw new GameError(['Ondoa vilivyo juu yake kwanza.', 'Remove what is on top of it first.']);
  q.del.run(userId, x, y, z);
  const back = Math.floor((yardBlockById[row.kind]?.price || 0) * YARD.refund);
  if (back) addMoney(userId, back, 'build', 'Ujenzi: umeondoa kitu');
  return { refund: back };
});

export function setYardMeta(userId, { name, open }) {
  const clean = String(name || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 32);
  if (open && !clean) throw new GameError(['Ipe biashara yako jina kwanza.', 'Give your place a name first.']);
  if (open && !q.blocks.all(userId).some((b) => b.kind === 'counter')) throw new GameError(['Weka kaunta kwanza ili wateja wanunue.', 'Place a counter first so customers can buy.']);
  q.upsert.run({ id: userId, name: clean, open: open ? 1 : 0 });
  return yardOf(userId);
}

/** A visitor buys at an open yard shop: they pay, the owner earns, the visitor gets a little treat. */
export const buyAtYard = db.transaction((visitorId, hostId) => {
  if (visitorId === hostId) throw new GameError(['Huwezi kujinunulia mwenyewe 😄', "You can't buy from yourself 😄"]);
  const meta = q.meta.get(hostId);
  if (!meta?.open) throw new GameError(['Duka limefungwa.', 'This place is closed.']);
  const v = getUser(visitorId);
  if (v.money < YARD.sale) throw new GameError(['Pesa haitoshi.', "You can't afford that."]);
  addMoney(visitorId, -YARD.sale, 'shop', `Umenunua ${meta.name}`);
  addMoney(hostId, YARD.sale, 'shop', `Mauzo: ${meta.name}`);
  q.sale.run(hostId, YARD.sale);
  const needs = applyNeeds(v.needs, { hunger: 8, fun: 6, social: 4 });
  saveFields(visitorId, { needs });
  emitTo(visitorId, 'needs', { needs, mood: moodOf(needs), health: v.health });
  emitTo(hostId, 'toast', { text: [`🛍️ @${v.username} amenunua ${meta.name}! +TSh ${YARD.sale.toLocaleString()}`, `🛍️ @${v.username} bought at ${meta.name}! +TSh ${YARD.sale.toLocaleString()}`], refresh: true });
  return { name: meta.name };
});
