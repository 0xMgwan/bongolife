// Investing: land that grows in value, buying/selling through agents, and haulage trucks.
import { db, getUser, addMoney, GameError, now } from './db.js';
import { INVEST, PLOTS, plotById, buildingById, placeById } from '../../shared/world.js';

const DAY = 86_400_000;
const T = INVEST.truck;

const q = {
  plotsOf: db.prepare('SELECT * FROM plots WHERE owner_id = ?'),
  plot: db.prepare('SELECT * FROM plots WHERE id = ?'),
  owned: db.prepare('SELECT id FROM plots'),
  insertPlot: db.prepare('INSERT INTO plots (id, owner_id, building, bought_at, last_collect) VALUES (?, ?, NULL, ?, ?)'),
  deletePlot: db.prepare('DELETE FROM plots WHERE id = ? AND owner_id = ?'),
  trucksOf: db.prepare('SELECT * FROM trucks WHERE user_id = ? ORDER BY id'),
  truck: db.prepare('SELECT * FROM trucks WHERE id = ? AND user_id = ?'),
  insertTruck: db.prepare('INSERT INTO trucks (user_id, bought_at, last_paid) VALUES (?, ?, ?)'),
  deleteTruck: db.prepare('DELETE FROM trucks WHERE id = ?'),
  payTruck: db.prepare('UPDATE trucks SET last_paid = ? WHERE id = ?'),
  bizOf: db.prepare('SELECT * FROM businesses WHERE owner_id = ?'),
  earned: db.prepare("SELECT COALESCE(SUM(amount),0) s FROM transactions WHERE user_id = ? AND kind IN ('income','truck','land_sale_gain') AND created_at > ?"),
};

// ------------------------------------------------------------------ land
/** What a plot (and whatever is built on it) would sell for today. */
export function plotValue(row, t = now()) {
  const plot = plotById[row.id];
  if (!plot) return 0;
  const days = Math.max(0, (t - row.bought_at) / DAY);
  const land = plot.price * (1 + Math.min(INVEST.landGrowthCap, days * INVEST.landGrowthPerDay));
  const b = row.building && buildingById[row.building];
  return Math.round(land + (b ? b.price * INVEST.buildingResale : 0));
}

export const buyPlotRemote = db.transaction((userId, plotId) => {
  const plot = plotById[plotId];
  if (!plot) throw new GameError(['Kiwanja hakipo', 'Plot not found'], 404);
  if (q.plot.get(plotId)) throw new GameError(['Kiwanja hiki kishanunuliwa.', 'This plot has already been sold.'], 409);
  const price = Math.round(plot.price * (1 + INVEST.remoteBuyFee));
  addMoney(userId, -price, 'purchase', `🏞️ Kiwanja ${plot.name} (kupitia dalali)`);
  q.insertPlot.run(plotId, userId, now(), now());
  return { price };
});

export const sellPlot = db.transaction((userId, plotId) => {
  const row = q.plot.get(plotId);
  if (!row || row.owner_id !== userId) throw new GameError(['Hiki si kiwanja chako.', "That isn't your plot."], 403);
  const value = plotValue(row);
  const got = Math.round(value * (1 - INVEST.agentFee));
  q.deletePlot.run(plotId, userId);
  addMoney(userId, got, 'sale', `🏷️ Umeuza ${plotById[plotId].name} (dalali ${INVEST.agentFee * 100}%)`);
  return { got, value };
});

// ---------------------------------------------------------------- trucks
// Deterministic per truck & day, so re-checking can't re-roll a breakdown.
function rnd(a, b) {
  let h = (a * 2654435761) ^ (b * 1597334677);
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
/** Finished days since the last payout (capped), each with its earnings, driver and maybe a breakdown. */
export function truckDays(truck, t = now()) {
  const full = Math.floor((t - truck.last_paid) / DAY);
  const days = Math.min(T.maxDays, Math.max(0, full));
  const out = [];
  for (let i = 0; i < days; i++) {
    const dayIdx = Math.floor(truck.last_paid / DAY) + i;
    const earn = Math.round((T.earnMin + rnd(truck.id, dayIdx) * (T.earnMax - T.earnMin)) / 1000) * 1000;
    const broke = rnd(dayIdx, truck.id + 7) < T.breakChance;
    out.push({ earn, driver: T.driver, repair: broke ? T.repair : 0, net: Math.max(0, earn - T.driver - (broke ? T.repair : 0)) });
  }
  return { days: out, full };
}
export const truckPending = (userId, t = now()) => q.trucksOf.all(userId).reduce((s, tr) => s + truckDays(tr, t).days.reduce((a, d) => a + d.net, 0), 0);

/** Pays out every truck's finished days (called from collectIncome). */
export function collectTrucks(userId, t = now()) {
  let total = 0;
  for (const tr of q.trucksOf.all(userId)) {
    const { days, full } = truckDays(tr, t);
    if (!full) continue;
    total += days.reduce((a, d) => a + d.net, 0);
    // Days beyond the cap are lost (the truck sat idle with no one collecting).
    q.payTruck.run(full > T.maxDays ? t : tr.last_paid + full * DAY, tr.id);
  }
  return total;
}

export const buyTruck = db.transaction((userId) => {
  if (q.trucksOf.all(userId).length >= T.max) throw new GameError([`Kikomo ni malori ${T.max}.`, `The limit is ${T.max} trucks.`]);
  addMoney(userId, -T.price, 'purchase', '🚛 Lori la mizigo');
  q.insertTruck.run(userId, now(), now());
});
export const sellTruck = db.transaction((userId, truckId) => {
  const tr = q.truck.get(truckId, userId);
  if (!tr) throw new GameError(['Lori hilo halipo.', 'Truck not found.'], 404);
  q.deleteTruck.run(tr.id);
  addMoney(userId, T.resale, 'sale', '🚛 Umeuza lori');
  return { got: T.resale };
});

// -------------------------------------------------------------- overview
export function portfolio(userId) {
  const t = now();
  const startOfDay = Math.floor((t + 3 * 3600_000) / DAY) * DAY - 3 * 3600_000; // midnight in Dar (UTC+3)
  const plots = q.plotsOf.all(userId).map((r) => {
    const plot = plotById[r.id];
    const value = plotValue(r, t);
    const b = r.building && buildingById[r.building];
    const paid = plot.price + (b ? b.price : 0);
    return { id: r.id, name: plot.name, district: plot.district, building: r.building, value, paid, gain: value - paid, grewWeek: Math.round(plot.price * INVEST.landGrowthPerDay * Math.min(7, (t - r.bought_at) / DAY)) };
  });
  const trucks = q.trucksOf.all(userId).map((tr) => {
    const { days } = truckDays(tr, t);
    return { id: tr.id, boughtAt: tr.bought_at, pending: days.reduce((a, d) => a + d.net, 0), days, nextIn: Math.max(0, tr.last_paid + DAY * (days.length + 1) - t) };
  });
  const businesses = q.bizOf.all(userId).map((b) => ({ id: b.id, ...placeById[b.id].business, name: placeById[b.id].name, icon: placeById[b.id].icon }));
  const taken = new Set(q.owned.all().map((r) => r.id));
  const forSale = PLOTS.filter((p) => !taken.has(p.id)).map((p) => ({ id: p.id, name: p.name, district: p.district, price: p.price, agentPrice: Math.round(p.price * (1 + INVEST.remoteBuyFee)) }));
  const bizForSale = Object.values(placeById).filter((p) => p.business && !db.prepare('SELECT 1 FROM businesses WHERE id = ?').get(p.id)).map((p) => ({ id: p.id, name: p.name, nameEn: p.nameEn, icon: p.icon, district: p.district, ...p.business }));
  const value = plots.reduce((s, p) => s + p.value, 0) + trucks.length * T.resale + businesses.reduce((s, b) => s + b.price, 0);
  return {
    value,
    earnings: { today: q.earned.get(userId, startOfDay).s, week: q.earned.get(userId, t - 7 * DAY).s, total: q.earned.get(userId, 0).s },
    plots, trucks, businesses, forSale, bizForSale,
    truck: T, fees: { agent: INVEST.agentFee, remote: INVEST.remoteBuyFee },
  };
}

void getUser;
