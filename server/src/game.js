import {
  GAME, NEEDS, PLACES, PLOTS, VEHICLES, BUILDINGS, ALLOWED_BUILDINGS, VEHICLE_COLORS,
  placeById, plotById, vehicleById, buildingById, outfitById, findActivity, findJob,
  shiftPay, jobLevel, jobTitle, jobTitleEn, moodOf, currentEvent, travelCost, isWater, TRAVEL,
} from '../../shared/world.js';
import { db, getUser, addMoney, saveFields, GameError, now, getSettings } from './db.js';

export function liveEvent() {
  const st = getSettings();
  if (st.eventOverride) return { text: st.eventOverride, textEn: st.eventOverrideEn || st.eventOverride, boost: {} };
  return currentEvent();
}
import { online, positionOf, broadcast, emitTo } from './presence.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const HOUR = 3600_000;

const q = {
  vehicles: db.prepare('SELECT * FROM vehicles WHERE user_id = ? ORDER BY id'),
  vehicle: db.prepare('SELECT * FROM vehicles WHERE id = ? AND user_id = ?'),
  insertVehicle: db.prepare('INSERT INTO vehicles (user_id, model, color, plate, created_at) VALUES (?, ?, ?, ?, ?)'),
  plotsOf: db.prepare('SELECT * FROM plots WHERE owner_id = ?'),
  plot: db.prepare('SELECT * FROM plots WHERE id = ?'),
  insertPlot: db.prepare('INSERT INTO plots (id, owner_id, building, bought_at, last_collect) VALUES (?, ?, NULL, ?, ?)'),
  buildPlot: db.prepare('UPDATE plots SET building = ?, last_collect = ? WHERE id = ?'),
  allPlots: db.prepare('SELECT p.id, p.building, u.username, u.name FROM plots p JOIN users u ON u.id = p.owner_id'),
  bizOf: db.prepare('SELECT * FROM businesses WHERE owner_id = ?'),
  biz: db.prepare('SELECT * FROM businesses WHERE id = ?'),
  insertBiz: db.prepare('INSERT INTO businesses (id, owner_id, bought_at, last_collect) VALUES (?, ?, ?, ?)'),
  allBiz: db.prepare('SELECT b.id, u.username, u.name FROM businesses b JOIN users u ON u.id = b.owner_id'),
  collectPlot: db.prepare('UPDATE plots SET last_collect = ? WHERE id = ?'),
  collectBiz: db.prepare('UPDATE businesses SET last_collect = ? WHERE id = ?'),
  unread: db.prepare('SELECT COUNT(*) n FROM messages WHERE to_id = ? AND read_at IS NULL'),
};

function plate() {
  const L = 'ABCDEFGHJKLMNPRSTUVWXYZ';
  const r = (s) => s[Math.floor(Math.random() * s.length)];
  return `T ${100 + Math.floor(Math.random() * 900)} ${r(L)}${r(L)}${r(L)}`;
}

function discount(user, price) {
  return user.trait === 'mjanja' ? Math.round(price * 0.95) : price;
}

// ------------------------------------------------------------- income
function accrued(lastCollect, perHour, t = now()) {
  const hrs = Math.min(GAME.incomeCapHours, Math.max(0, (t - lastCollect) / HOUR));
  return Math.floor(hrs * perHour);
}

export function pendingIncome(userId, t = now()) {
  let total = 0;
  for (const p of q.plotsOf.all(userId)) {
    const b = p.building && buildingById[p.building];
    if (b?.incomePerHour) total += accrued(p.last_collect, b.incomePerHour, t);
  }
  for (const b of q.bizOf.all(userId)) {
    const place = placeById[b.id];
    if (place?.business) total += accrued(b.last_collect, place.business.incomePerHour, t);
  }
  return total;
}

export const collectIncome = db.transaction((userId) => {
  const t = now();
  const amount = pendingIncome(userId, t);
  if (amount <= 0) throw new GameError(['Hakuna kodi ya kukusanya bado. Rudi baadaye.', 'No income to collect yet. Come back later.']);
  for (const p of q.plotsOf.all(userId)) q.collectPlot.run(t, p.id);
  for (const b of q.bizOf.all(userId)) q.collectBiz.run(t, b.id);
  addMoney(userId, amount, 'income', 'Kodi na mapato ya biashara');
  return amount;
});

// --------------------------------------------------------------- state
export function netWorth(userId) {
  const u = getUser(userId);
  let worth = u.money;
  for (const v of q.vehicles.all(userId)) worth += (vehicleById[v.model]?.price || 0) * 0.7;
  for (const p of q.plotsOf.all(userId)) worth += (plotById[p.id]?.price || 0) + (p.building ? buildingById[p.building]?.price || 0 : 0);
  for (const b of q.bizOf.all(userId)) worth += placeById[b.id]?.business?.price || 0;
  return Math.round(worth);
}

export function playerState(userId) {
  const u = getUser(userId);
  const { password_hash, ...safe } = u;
  const [x, z] = positionOf(u);
  return {
    ...safe,
    x,
    z,
    mood: moodOf(u.needs),
    vehicles: q.vehicles.all(userId),
    plots: q.plotsOf.all(userId),
    businesses: q.bizOf.all(userId),
    pendingIncome: pendingIncome(userId),
    unread: q.unread.get(userId).n,
    netWorth: netWorth(userId),
  };
}

export function worldState() {
  return {
    plots: Object.fromEntries(q.allPlots.all().map((p) => [p.id, { building: p.building, owner: p.username, ownerName: p.name }])),
    businesses: Object.fromEntries(q.allBiz.all().map((b) => [b.id, { owner: b.username, ownerName: b.name }])),
    event: liveEvent(),
  };
}

// ----------------------------------------------------------- proximity
function distToPlace(place, [x, z]) {
  const [px, pz] = place.pos;
  const [w, d] = place.size;
  const dx = Math.max(Math.abs(x - px) - w / 2, 0);
  const dz = Math.max(Math.abs(z - pz) - d / 2, 0);
  return Math.hypot(dx, dz);
}
function requireNear(user, place) {
  if (distToPlace(place, positionOf(user)) > 14) throw new GameError([`Nenda ${place.name} kwanza.`, `Go to ${place.nameEn || place.name} first.`], 400, 'too_far');
}
function requireNearPos(user, pos, size = 10) {
  return requireNear(user, { pos, size: [size, size], name: 'kiwanja hicho' });
}

// ----------------------------------------------------------- needs
function applyNeeds(needs, effects, mult = 1) {
  const out = { ...needs };
  for (const n of NEEDS) {
    const d = effects?.[n.id];
    if (d) out[n.id] = clamp((out[n.id] ?? 50) + (d > 0 ? d * mult : d), 0, 100);
  }
  return out;
}

export function decayNeeds(user) {
  const out = { ...user.needs };
  for (const n of NEEDS) {
    let d = n.decay;
    if (n.id === 'fun' && user.trait === 'mtoko') d *= 0.6;
    out[n.id] = clamp((out[n.id] ?? 50) - d, 0, 100);
  }
  return out;
}

// ----------------------------------------------------------- actions
function eventMult(place, kind) {
  const boost = currentEvent().boost || {};
  if (kind === 'job') return boost.jobs || 1;
  return boost[place.type] || 1;
}

function setBusy(userId, busy) {
  saveFields(userId, { busy });
  const p = online.get(userId);
  if (p) {
    p.busy = busy ? { kind: busy.kind, id: busy.id, emoji: busy.emoji, endsAt: busy.endsAt } : null;
    broadcast('player:busy', { id: userId, busy: p.busy });
  }
}

export const startAction = db.transaction((userId, { kind, placeId, id }) => {
  const user = getUser(userId);
  if (user.busy && user.busy.endsAt > now()) throw new GameError(['Bado uko bize na kitu kingine.', 'You\'re still busy with something else.']);
  const place = placeById[placeId];
  if (!place) throw new GameError(['Sehemu haipo', 'Place not found'], 404);
  if (place.comingSoon) throw new GameError(['Inakuja hivi karibuni!', 'Coming soon!']);
  requireNear(user, place);

  if (kind === 'activity') {
    const act = findActivity(placeId, id);
    if (!act) throw new GameError(['Shughuli haipo', 'Activity not found'], 404);
    const cost = discount(user, act.cost);
    if (cost > 0) addMoney(userId, -cost, 'spend', `${act.name} — ${place.name}`);
    let secs = act.secs;
    if (act.special?.elimu && user.trait === 'msomi') secs = Math.round(secs * 0.6);
    const busy = { kind, id, placeId, emoji: act.emoji, label: act.name, labelEn: act.nameEn, startedAt: now(), endsAt: now() + secs * 1000 };
    setBusy(userId, busy);
    return busy;
  }
  if (kind === 'job') {
    const job = (place.jobs || []).find((j) => j.id === id);
    if (!job) throw new GameError(['Kazi haipo', 'Job not found'], 404);
    if (job.requires?.elimu && user.elimu < job.requires.elimu)
      throw new GameError([`Unahitaji Elimu level ${job.requires.elimu}. Soma kozi Chuo Kikuu cha Dar.`, `You need Education level ${job.requires.elimu}. Take a course at the University of Dar.`]);
    if (job.requires?.vehicle) {
      const owned = q.vehicles.all(userId).map((v) => v.model);
      if (!job.requires.vehicle.some((m) => owned.includes(m)))
        throw new GameError([`Unahitaji ${job.requires.vehicle.map((m) => vehicleById[m].name).join(' / ')} kufanya kazi hii.`, `You need a ${job.requires.vehicle.map((m) => vehicleById[m].nameEn).join(' / ')} for this job.`]);
    }
    if ((user.needs.energy ?? 0) < job.energy) throw new GameError(['Umechoka sana! Nenda kalale kwanza. 😴', 'You\'re exhausted! Go sleep first. 😴']);
    const busy = { kind, id, placeId, emoji: '💼', label: jobTitle(job, user.jobXp[id] || 0), labelEn: jobTitleEn(job, user.jobXp[id] || 0), startedAt: now(), endsAt: now() + job.secs * 1000 };
    setBusy(userId, busy);
    return busy;
  }
  throw new GameError(['Ombi si sahihi', 'Invalid request']);
});

export const finishAction = db.transaction((userId) => {
  const user = getUser(userId);
  const busy = user.busy;
  if (!busy) throw new GameError(['Hakuna shughuli inayoendelea.', 'Nothing in progress.']);
  if (now() < busy.endsAt - 1500) throw new GameError(['Bado haijaisha, subiri kidogo.', 'Not finished yet, wait a bit.']);
  const place = placeById[busy.placeId];
  const result = { kind: busy.kind, lines: [] };
  const fields = { busy: null };

  if (busy.kind === 'activity') {
    const act = findActivity(busy.placeId, busy.id);
    const mult = eventMult(place, 'activity');
    fields.needs = applyNeeds(user.needs, act.effects, mult);
    for (const n of NEEDS) {
      const d = Math.round(fields.needs[n.id] - user.needs[n.id]);
      if (d) result.lines.push([`${n.icon} ${n.name} ${d > 0 ? '+' : ''}${d}`, `${n.icon} ${n.nameEn} ${d > 0 ? '+' : ''}${d}`]);
    }
    if (mult > 1) result.lines.push(['🎉 Bonasi ya tukio la wiki!', '🎉 Weekly event bonus!']);
    if (act.fame) {
      fields.fame = user.fame + act.fame * (user.trait === 'msanii' && place.type === 'studio' ? 2 : 1);
      result.lines.push([`⭐ Umaarufu +${fields.fame - user.fame}`, `⭐ Fame +${fields.fame - user.fame}`]);
    }
    if (act.special?.elimu) {
      fields.elimu = user.elimu + act.special.elimu;
      result.lines.push([`🎓 Elimu sasa ni level ${fields.elimu}`, `🎓 Education is now level ${fields.elimu}`]);
    }
    if (act.special?.teleport) {
      const [x, z] = act.special.teleport;
      fields.x = x;
      fields.z = z;
      const p = online.get(userId);
      if (p) Object.assign(p, { x, z });
      result.teleport = [x, z];
    }
    result.title = [`${act.emoji} ${act.name}`, `${act.emoji} ${act.nameEn}`];
  } else {
    const { job } = findJob(busy.id);
    const shifts = user.jobXp[busy.id] || 0;
    const before = jobLevel(shifts);
    let pay = shiftPay(job, { shifts, mood: moodOf(user.needs), trait: user.trait, fame: user.fame });
    pay = Math.round(pay * eventMult(place, 'job'));
    addMoney(userId, pay, 'salary', `${jobTitle(job, shifts)} — ${place.name}`);
    fields.jobXp = { ...user.jobXp, [busy.id]: shifts + 1 };
    fields.needs = applyNeeds(user.needs, { energy: -job.energy, hunger: -6, hygiene: -6, social: 4 });
    if (job.fameBonus) fields.fame = user.fame + 1;
    result.title = ['💼 Shifti imeisha!', '💼 Shift complete!'];
    result.pay = pay;
    if (jobLevel(shifts + 1) > before) result.lines.push([`🎉 Umepandishwa cheo: ${jobTitle(job, shifts + 1)}!`, `🎉 Promoted: ${jobTitleEn(job, shifts + 1)}!`]);
  }
  saveFields(userId, fields);
  setBusy(userId, null);
  return result;
});

export function cancelAction(userId) {
  setBusy(userId, null);
}

// ------------------------------------------------------------- shops
export const buyVehicle = db.transaction((userId, model, color) => {
  const user = getUser(userId);
  const v = vehicleById[model];
  if (!v) throw new GameError(['Gari halipo', 'Vehicle not found'], 404);
  requireNear(user, placeById.yadi);
  if (!VEHICLE_COLORS.includes(color)) color = v.color;
  addMoney(userId, -discount(user, v.price), 'purchase', `Umenunua ${v.name}`);
  const info = q.insertVehicle.run(userId, model, color, plate(), now());
  saveFields(userId, { activeVehicle: info.lastInsertRowid });
  return info.lastInsertRowid;
});

export function useVehicle(userId, vehicleId) {
  if (vehicleId != null && !q.vehicle.get(vehicleId, userId)) throw new GameError(['Hilo si gari lako', 'That\'s not your vehicle']);
  saveFields(userId, { activeVehicle: vehicleId ?? null });
  const p = online.get(userId);
  if (p) {
    p.vehicle = vehicleId ? vehicleSummary(vehicleId) : null;
    broadcast('player:vehicle', { id: userId, v: p.vehicle });
  }
}

export function vehicleSummary(vehicleId) {
  const v = vehicleId && db.prepare('SELECT model, color, plate FROM vehicles WHERE id = ?').get(vehicleId);
  return v || null;
}

export const buyOutfit = db.transaction((userId, outfitId) => {
  const user = getUser(userId);
  const o = outfitById[outfitId];
  if (!o) throw new GameError(['Nguo haipo', 'Outfit not found'], 404);
  if (o.price === 0 || user.outfits.includes(outfitId)) throw new GameError(['Tayari unayo nguo hii.', 'You already own this outfit.']);
  const shops = PLACES.filter((p) => p.shop === 'outfits');
  const [x, z] = positionOf(user);
  if (!shops.some((s) => distToPlace(s, [x, z]) <= 14)) throw new GameError(['Nenda dukani (Kariakoo au Mlimani City) kwanza.', 'Go to a shop (Kariakoo or Mlimani City) first.']);
  addMoney(userId, -discount(user, o.price), 'purchase', `Umenunua ${o.name}`);
  saveFields(userId, { outfits: [...user.outfits, outfitId] });
});

// ---------------------------------------------------------- property
export const buyPlot = db.transaction((userId, plotId) => {
  const user = getUser(userId);
  const plot = plotById[plotId];
  if (!plot) throw new GameError(['Kiwanja hakipo', 'Plot not found'], 404);
  if (q.plot.get(plotId)) throw new GameError(['Kiwanja hiki kishanunuliwa.', 'This plot has already been sold.'], 409);
  requireNearPos(user, plot.pos, plot.size);
  addMoney(userId, -discount(user, plot.price), 'purchase', `Umenunua ${plot.name}`);
  q.insertPlot.run(plotId, userId, now(), now());
});

export const buildOnPlot = db.transaction((userId, plotId, buildingId) => {
  const user = getUser(userId);
  const row = q.plot.get(plotId);
  const plot = plotById[plotId];
  const b = buildingById[buildingId];
  if (!row || row.owner_id !== userId) throw new GameError(['Hiki si kiwanja chako.', 'This isn\'t your plot.'], 403);
  if (!b) throw new GameError(['Jengo halipo', 'Building not found'], 404);
  if (!ALLOWED_BUILDINGS[plot.area]?.includes(buildingId)) throw new GameError([`${b.name} hairuhusiwi ${plot.area}.`, `${b.nameEn} isn't allowed in ${plot.area}.`]);
  const old = row.building ? buildingById[row.building] : null;
  if (old && old.price >= b.price) throw new GameError(['Unaweza kupandisha hadhi tu (upgrade).', 'You can only upgrade.']);
  const cost = discount(user, b.price - (old ? Math.round(old.price * 0.5) : 0));
  addMoney(userId, -cost, 'purchase', `Ujenzi: ${b.name} — ${plot.name}`);
  q.buildPlot.run(buildingId, now(), plotId);
});

export const buyBusiness = db.transaction((userId, placeId) => {
  const user = getUser(userId);
  const place = placeById[placeId];
  if (!place?.business) throw new GameError(['Biashara hii haiuzwi', 'This business is not for sale'], 404);
  if (q.biz.get(placeId)) throw new GameError(['Biashara hii ina mmiliki tayari.', 'This business already has an owner.'], 409);
  requireNear(user, place);
  addMoney(userId, -discount(user, place.business.price), 'purchase', `Umenunua ${place.business.label || place.name}`);
  q.insertBiz.run(placeId, userId, now(), now());
});

/** Rest at your own house: better than the rented room. */
export function homeActivity(userId, plotId, act) {
  const user = getUser(userId);
  const row = q.plot.get(plotId);
  if (!row || row.owner_id !== userId || !row.building) throw new GameError(['Hii si nyumba yako.', 'This isn\'t your house.'], 403);
  requireNearPos(user, plotById[plotId].pos, 14);
  const b = buildingById[row.building];
  const effects = act === 'lala' ? { energy: 70 + b.energyBonus, fun: b.pool ? 15 : 0 } : act === 'oga' ? { hygiene: 100 } : null;
  if (!effects) throw new GameError(['Shughuli haipo', 'Activity not found']);
  saveFields(userId, { needs: applyNeeds(user.needs, effects) });
}

// ------------------------------------------------------------ travel
export const travel = db.transaction((userId, placeId, mode) => {
  const user = getUser(userId);
  const place = placeById[placeId];
  if (!place || !TRAVEL[mode]) throw new GameError(['Safari si sahihi', 'Invalid trip']);
  const from = positionOf(user);
  // drop the passenger on the nearest dry spot just outside the building
  const [px, pz] = place.pos;
  let dest = [px, pz + place.size[1] / 2 + 3];
  for (const cand of [dest, [px, pz - place.size[1] / 2 - 3], [px - place.size[0] / 2 - 3, pz], [px + place.size[0] / 2 + 3, pz]])
    if (!isWater(cand[0], cand[1])) { dest = cand; break; }
  const cost = travelCost(mode, from, dest);
  addMoney(userId, -cost, 'travel', `${TRAVEL[mode].name} kwenda ${place.name}`);
  saveFields(userId, { x: dest[0], z: dest[1] });
  const p = online.get(userId);
  if (p) Object.assign(p, { x: dest[0], z: dest[1] });
  return { pos: dest, cost };
});

export const sendMoney = db.transaction((fromId, toUsername, amount, note) => {
  const to = db.prepare('SELECT id, username FROM users WHERE username = ?').get(toUsername);
  if (!to) throw new GameError(['Hakuna mtu mwenye username hiyo.', 'No one has that username.'], 404);
  if (to.id === fromId) throw new GameError(['Huwezi kujitumia mwenyewe 😅', 'You can\'t send money to yourself 😅']);
  amount = Math.floor(Number(amount));
  if (!(amount >= 100) || amount > 1e12) throw new GameError(['Kiasi si sahihi (angalau TSh 100).', 'Invalid amount (at least TSh 100).']);
  const from = getUser(fromId);
  addMoney(fromId, -amount, 'transfer_out', `Kwa @${to.username}${note ? ' — ' + note : ''}`);
  addMoney(to.id, amount, 'transfer_in', `Kutoka @${from.username}${note ? ' — ' + note : ''}`);
  emitTo(to.id, 'toast', { text: [`💸 @${from.username} amekutumia TSh ${amount.toLocaleString()}`, `💸 @${from.username} sent you TSh ${amount.toLocaleString()}`], refresh: true });
  return to;
});

// ------------------------------------------------------- leaderboard
let lbCache = { at: 0, data: null };
export function clearLeaderboardCache() {
  lbCache = { at: 0, data: null };
}
export function leaderboard() {
  if (now() - lbCache.at < 30_000 && lbCache.data) return lbCache.data;
  const rows = db.prepare('SELECT id, username, name, fame, appearance FROM users WHERE onboarded = 1 AND banned_at IS NULL').all();
  const scored = rows.map((r) => ({ ...r, appearance: JSON.parse(r.appearance || 'null'), worth: netWorth(r.id) }));
  const rich = [...scored].sort((a, b) => b.worth - a.worth).slice(0, 20);
  const famous = [...scored].sort((a, b) => b.fame - a.fame).slice(0, 20);
  lbCache = { at: now(), data: { rich, famous } };
  return lbCache.data;
}
