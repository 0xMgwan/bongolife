// Build mode: each player's yard of blocks beside their house. (Selling is company shops: company.js.)
import { YARD, yardBlockById } from '../../shared/world.js';
import { db, getUser, addMoney, GameError } from './db.js';

const q = {
  blocks: db.prepare('SELECT x, y, z, kind FROM yard_blocks WHERE user_id = ?'),
  at: db.prepare('SELECT kind FROM yard_blocks WHERE user_id = ? AND x = ? AND y = ? AND z = ?'),
  count: db.prepare('SELECT COUNT(*) n FROM yard_blocks WHERE user_id = ?'),
  put: db.prepare('INSERT INTO yard_blocks (user_id, x, y, z, kind) VALUES (?, ?, ?, ?, ?)'),
  del: db.prepare('DELETE FROM yard_blocks WHERE user_id = ? AND x = ? AND y = ? AND z = ?'),
  above: db.prepare('SELECT COUNT(*) n FROM yard_blocks WHERE user_id = ? AND x = ? AND z = ? AND y > ?'),
};

const cell = (v, max) => Number.isInteger(v) && v >= 0 && v < max;

export function yardOf(userId) {
  return { blocks: q.blocks.all(userId) };
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
