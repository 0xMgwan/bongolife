// Bank buyback: property held by players who haven't played for a while goes back on the
// market so newcomers get a shot. The owner is paid fair value, so nobody loses out.
import { db, addMoney, now } from './db.js';
import { plotById, placeById } from '../../shared/world.js';
import { plotValue } from './invest.js';
import { broadcast } from './presence.js';

const DAY = 86_400_000;
export const BUYBACK = { idleDays: 14, pay: 0.8 };

export const runBuyback = db.transaction(() => {
  const cut = now() - BUYBACK.idleDays * DAY;
  const freed = [];
  for (const p of db.prepare(`SELECT x.* FROM plots x JOIN users u ON u.id = x.owner_id WHERE COALESCE(u.last_seen, u.created_at) < ? AND x.bought_at < ?`).all(cut, cut)) {
    const plot = plotById[p.id];
    if (!plot) continue;
    const pay = Math.round(plotValue(p) * BUYBACK.pay);
    db.prepare('DELETE FROM plots WHERE id = ?').run(p.id);
    addMoney(p.owner_id, pay, 'sale', `🏦 Benki imenunua ${plot.name} (hukuonekana siku ${BUYBACK.idleDays})`);
    freed.push(plot.name);
  }
  for (const b of db.prepare(`SELECT x.* FROM businesses x JOIN users u ON u.id = x.owner_id WHERE COALESCE(u.last_seen, u.created_at) < ? AND x.bought_at < ?`).all(cut, cut)) {
    const place = placeById[b.id];
    if (!place?.business) continue;
    const pay = Math.round(place.business.price * BUYBACK.pay);
    db.prepare('DELETE FROM businesses WHERE id = ?').run(b.id);
    addMoney(b.owner_id, pay, 'sale', `🏦 Benki imenunua ${place.business.label || place.name} (hukuonekana siku ${BUYBACK.idleDays})`);
    freed.push(place.business.label || place.name);
  }
  return freed;
});

/** Hourly; calls onChange when something was freed so the world refreshes. */
export function buybackTick(onChange) {
  try {
    const freed = runBuyback();
    if (!freed.length) return;
    const list = freed.slice(0, 4).join(', ') + (freed.length > 4 ? ` +${freed.length - 4}` : '');
    broadcast('toast', { text: [`🏦 Mali ${freed.length} zimerudi sokoni: ${list}. Wahi!`, `🏦 ${freed.length} properties are back on the market: ${list}. Be quick!`] });
    onChange?.();
  } catch (e) { console.error('[buyback]', e.message); }
}
