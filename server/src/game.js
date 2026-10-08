import {
  GAME, NEEDS, PLACES, PLOTS, VEHICLES, BUILDINGS, ALLOWED_BUILDINGS, VEHICLE_COLORS,
  placeById, plotById, vehicleById, buildingById, outfitById, findActivity, findJob,
  shiftPay, jobLevel, jobTitle, jobTitleEn, moodOf, ENTERABLE,
  furnitureById, STARTER_HOME, homeFits, HOME, HEALTH, HOSPITAL_ID, currentEvent, travelCost, isWater, TRAVEL, STARTER_CAR, WORK, perfMult, REFERRAL, TRIP_MODES, tripKey, cityAt, cityById,
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
    blocked: db.prepare('SELECT u.username FROM blocks b JOIN users u ON u.id = b.blocked_id WHERE b.user_id = ?').all(userId).map((r) => r.username),
  };
}

// Set by index.js (avoids a circular import with election.js).
export const mayorRef = { current: null };

export function worldState() {
  return {
    plots: Object.fromEntries(q.allPlots.all().map((p) => [p.id, { building: p.building, owner: p.username, ownerName: p.name }])),
    businesses: Object.fromEntries(q.allBiz.all().map((b) => [b.id, { owner: b.username, ownerName: b.name }])),
    event: liveEvent(),
    mayor: (() => {
      const m = mayorRef.current?.();
      return m ? { username: m.username, name: m.name, message: m.message || null } : null;
    })(),
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
/** Held by police (arrested, in a cell or waiting for court). */
function assertNotJailed(user) {
  if (user?.jail && user.jail.phase !== 'free')
    throw new GameError(['Uko mikononi mwa polisi — maliza kwanza (faini, dhamana au mahakama).', "You're in police custody — sort it out first (fine, bail or court)."], 403, 'jailed');
}

export function applyNeeds(needs, effects, mult = 1) {
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
    p.busy = busy ? { kind: busy.kind, id: busy.id, placeId: busy.placeId, emoji: busy.emoji, endsAt: busy.endsAt } : null;
    broadcast('player:busy', { id: userId, busy: p.busy });
    // Starting something at a venue puts you inside it, so others see you there.
    if (busy && ENTERABLE[busy.placeId] && p.inside !== busy.placeId) {
      p.inside = busy.placeId;
      broadcast('player:inside', { id: userId, inside: p.inside });
    }
  }
}

// ---------------------------------------------------------------- home
const hq = {
  items: db.prepare('SELECT id, item, x, z, rot FROM home_items WHERE user_id = ? ORDER BY id'),
  item: db.prepare('SELECT * FROM home_items WHERE id = ? AND user_id = ?'),
  insert: db.prepare('INSERT INTO home_items (user_id, item, x, z, rot, created_at) VALUES (?, ?, ?, ?, ?, ?)'),
  move: db.prepare('UPDATE home_items SET x = ?, z = ?, rot = ? WHERE id = ?'),
  del: db.prepare('DELETE FROM home_items WHERE id = ?'),
  count: db.prepare('SELECT COUNT(*) n FROM home_items WHERE user_id = ?'),
};
const snap = (v) => Math.round(Number(v) * 2) / 2;
const turn = (r) => ((Math.trunc(Number(r) || 0) % 4) + 4) % 4;

/** A player's furniture; new homes get the starter set once. */
export const homeItems = db.transaction((userId) => {
  if (!getUser(userId).homeSeeded) {
    for (const s of STARTER_HOME) hq.insert.run(userId, s.item, s.x, s.z, s.rot, now());
    saveFields(userId, { homeSeeded: 1 });
  }
  return hq.items.all(userId);
});

export const buyFurniture = db.transaction((userId, { item, x, z, rot }) => {
  const def = furnitureById[item];
  if (!def) throw new GameError(['Kitu hicho hakipo.', 'That item does not exist.'], 404);
  x = snap(x); z = snap(z); rot = turn(rot);
  if (!homeFits(def, x, z, rot, hq.items.all(userId))) throw new GameError(['Hakuna nafasi hapo. Sogeza kwingine.', "It doesn't fit there. Try another spot."]);
  if (hq.count.get(userId).n >= 80) throw new GameError(['Nyumba imejaa vitu.', 'Your home is full.']);
  if (def.price) addMoney(userId, -discount(getUser(userId), def.price), 'purchase', `Fanicha: ${def.name}`);
  hq.insert.run(userId, item, x, z, rot, now());
});

export const moveFurniture = db.transaction((userId, id, { x, z, rot }) => {
  const row = hq.item.get(id, userId);
  if (!row) throw new GameError(['Kitu hicho si chako.', "That's not your item."], 404);
  x = snap(x); z = snap(z); rot = turn(rot);
  const others = hq.items.all(userId).filter((o) => o.id !== row.id);
  if (!homeFits(furnitureById[row.item], x, z, rot, others)) throw new GameError(['Hakuna nafasi hapo. Sogeza kwingine.', "It doesn't fit there. Try another spot."]);
  hq.move.run(x, z, rot, row.id);
});

export const sellFurniture = db.transaction((userId, id) => {
  const row = hq.item.get(id, userId);
  if (!row) throw new GameError(['Kitu hicho si chako.', "That's not your item."], 404);
  const def = furnitureById[row.item];
  const refund = Math.floor((def?.price || 0) * HOME.sellBack);
  hq.del.run(row.id);
  if (refund) addMoney(userId, refund, 'refund', `Umeuza: ${def.name}`);
  return refund;
});

export const startAction = db.transaction((userId, { kind, placeId, id }) => {
  assertNotJailed(getUser(userId));
  const user = getUser(userId);
  if (user.busy && user.busy.endsAt > now()) throw new GameError(['Bado uko bize na kitu kingine.', 'You\'re still busy with something else.']);
  if (kind === 'home') {
    const visiting = online.get(userId)?.home;
    const row = hq.item.get(Number(id), userId) || (visiting ? hq.item.get(Number(id), visiting) : null);
    const def = row && furnitureById[row.item];
    if (!def?.use) throw new GameError(['Kitu hicho hakitumiki.', "You can't use that."]);
    if (def.use.cost) addMoney(userId, -def.use.cost, 'spend', `${def.use.name} nyumbani`);
    const busy = { kind, id: def.use.act, itemId: row.id, item: row.item, placeId: 'home', emoji: def.use.emoji, label: def.use.name, labelEn: def.use.nameEn, startedAt: now(), endsAt: now() + def.use.secs * 1000 };
    setBusy(userId, busy);
    return busy;
  }
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
        throw new GameError(job.requires.vehicle.length > 3 ? ['Unahitaji gari kufanya kazi hii.', 'You need a car for this job.'] : [`Unahitaji ${job.requires.vehicle.map((m) => vehicleById[m].name).join(' / ')} kufanya kazi hii.`, `You need a ${job.requires.vehicle.map((m) => vehicleById[m].nameEn).join(' / ')} for this job.`]);
    }
    if ((user.health ?? 100) < HEALTH.injuredBelow) throw new GameError(['Uko mgonjwa — nenda hospitali kwanza. 🏥', "You're injured — get treated at the hospital first. 🏥"]);
    if ((user.needs.energy ?? 0) < job.energy) throw new GameError(['Umechoka sana! Nenda kalale kwanza. 😴', 'You\'re exhausted! Go sleep first. 😴']);
    const busy = { kind, id, placeId, emoji: '💼', label: jobTitle(job, user.jobXp[id] || 0), labelEn: jobTitleEn(job, user.jobXp[id] || 0), startedAt: now(), endsAt: now() + job.secs * 1000, perf: 50, done: 0, cd: {} };
    setBusy(userId, busy);
    return busy;
  }
  throw new GameError(['Ombi si sahihi', 'Invalid request']);
});

/** Something to do during a shift: affects performance (pay) and needs. Cooldowns are server-side. */
export const workTask = db.transaction((userId, taskId) => {
  const user = getUser(userId);
  const busy = user.busy;
  if (!busy || busy.kind !== 'job' || now() > busy.endsAt) throw new GameError(['Huko kazini sasa hivi.', "You're not at work right now."]);
  const task = WORK.tasks.find((t) => t.id === taskId);
  if (!task) throw new GameError(['Kazi hiyo haipo', 'Unknown task'], 404);
  const frac = (now() - busy.startedAt) / (busy.endsAt - busy.startedAt);
  if (frac < WORK.stages[3][0]) throw new GameError(['Subiri kikao kiishe kwanza.', 'Wait for the brief to finish first.']);
  const cd = busy.cd || {};
  if (task.once && cd[task.id]) throw new GameError(['Umeshafanya hivyo leo.', 'You already did that this shift.']);
  if (cd[task.id] && now() - cd[task.id] < task.cooldown * 1000) throw new GameError(['Pumzika kidogo kwanza.', 'Give it a moment.'], 429, 'cooldown');
  const perf = Math.max(0, Math.min(100, (busy.perf ?? 50) + task.perf));
  const done = (busy.done || 0) + (task.good ? 1 : 0);
  const next = { ...busy, perf, done, cd: { ...cd, [task.id]: now() } };
  saveFields(userId, { busy: next, ...(task.needs ? { needs: applyNeeds(user.needs, task.needs) } : {}) });
  return { perf, done };
});

export const finishAction = db.transaction((userId, { early = false } = {}) => {
  const user = getUser(userId);
  const busy = user.busy;
  if (!busy) throw new GameError(['Hakuna shughuli inayoendelea.', 'Nothing in progress.']);
  // Jobs may clock out early once past the minimum stay, for pro-rated pay.
  let frac = 1;
  if (early && busy.kind === 'job' && now() < busy.endsAt) {
    frac = (now() - busy.startedAt) / (busy.endsAt - busy.startedAt);
    if (frac < WORK.minStayFrac) throw new GameError(['Kaa angalau nusu ya shifti ndipo ulipwe.', 'Stay at least half the shift to get paid.'], 400, 'too_early');
  } else if (now() < busy.endsAt - 1500) throw new GameError(['Bado haijaisha, subiri kidogo.', 'Not finished yet, wait a bit.'], 400, 'too_early');
  const place = placeById[busy.placeId];
  const result = { kind: busy.kind, lines: [] };
  const fields = { busy: null };

  if (busy.kind === 'home') {
    const def = furnitureById[busy.item];
    fields.needs = applyNeeds(user.needs, def?.use?.effects || {});
    if (def?.use?.fame) {
      fields.fame = user.fame + def.use.fame;
      result.lines.push([`⭐ Umaarufu +${def.use.fame}`, `⭐ Fame +${def.use.fame}`]);
    }
    if (def?.use?.health) {
      fields.health = Math.min(100, (user.health ?? 100) + def.use.health);
      result.lines.push([`❤️ Afya +${fields.health - (user.health ?? 100)}`, `❤️ Health +${fields.health - (user.health ?? 100)}`]);
    }
    for (const n of NEEDS) {
      const d = Math.round(fields.needs[n.id] - user.needs[n.id]);
      if (d) result.lines.push([`${n.icon} ${n.name} ${d > 0 ? '+' : ''}${d}`, `${n.icon} ${n.nameEn} ${d > 0 ? '+' : ''}${d}`]);
    }
    result.title = [`${def?.use?.emoji} ${def?.use?.name}`, `${def?.use?.emoji} ${def?.use?.nameEn}`];
  } else if (busy.kind === 'activity') {
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
    if (act.special?.health) {
      fields.health = Math.min(100, (user.health ?? 100) + act.special.health);
      if (act.special.heal || fields.health >= HEALTH.injuredBelow) fields.injuredAt = null;
      result.lines.push([`❤️ Afya sasa ${fields.health}%`, `❤️ Health now ${fields.health}%`]);
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
  } else if (busy.kind === 'trip') {
    // Arrive in the other city — and, if you skipped insurance, maybe some wahala on the way.
    const m = TRIP_MODES[busy.id];
    const dest = placeById[busy.placeId];
    const [x, z] = doorOf(dest);
    fields.x = x;
    fields.z = z;
    const p = online.get(userId);
    if (p) Object.assign(p, { x, z, inside: null });
    result.teleport = [x, z];
    const city = cityById[busy.to];
    result.title = [`${m.emoji} Karibu ${city.name}!`, `${m.emoji} Welcome to ${city.name}!`];
    fields.needs = applyNeeds(user.needs, m.own ? { energy: -25, fun: 5 } : { energy: -8, fun: 10 });
    if (Math.random() < m.risk) {
      const W = WAHALA[busy.id];
      const w = W[Math.floor(Math.random() * W.length)];
      if (busy.insured) result.lines.push([`🛡️ ${w[0]} — bima imelipia kila kitu.`, `🛡️ ${w[1]} — your insurance covered it.`]);
      else {
        const cost = Math.min(w[2], Math.max(0, user.money));
        if (cost) addMoney(userId, -cost, 'spend', `Safari: ${w[0]}`);
        if (w[3]) fields.needs = applyNeeds(fields.needs, w[3]);
        result.lines.push([`⚠️ ${w[0]}${cost ? ` (−TSh ${cost.toLocaleString()})` : ''}. Hukuwa na bima!`, `⚠️ ${w[1]}${cost ? ` (−TSh ${cost.toLocaleString()})` : ''}. No insurance!`]);
      }
    } else result.lines.push(['✅ Safari salama.', '✅ Smooth trip.']);
  } else {
    const { job } = findJob(busy.id);
    const shifts = user.jobXp[busy.id] || 0;
    const before = jobLevel(shifts);
    let pay = shiftPay(job, { shifts, mood: moodOf(user.needs), trait: user.trait, fame: user.fame });
    pay = Math.round((pay * eventMult(place, 'job') * perfMult(busy.perf, busy.done) * frac) / 100) * 100;
    addMoney(userId, pay, 'salary', `${jobTitle(job, shifts)} — ${place.name}`);
    fields.jobXp = { ...user.jobXp, [busy.id]: shifts + (frac >= 1 ? 1 : 0) };
    // Invite reward: the friend who brought you in gets paid on your first full shift.
    const ref = frac >= 1 && db.prepare('SELECT referred_by, referral_paid FROM users WHERE id = ?').get(userId);
    if (ref?.referred_by && !ref.referral_paid) {
      const paid = db.prepare('SELECT COUNT(*) n FROM users WHERE referred_by = ? AND referral_paid = 1').get(ref.referred_by).n;
      db.prepare('UPDATE users SET referral_paid = 1 WHERE id = ?').run(userId);
      if (paid < REFERRAL.maxPaid) {
        addMoney(ref.referred_by, REFERRAL.referrer, 'bonus', `Zawadi ya kualika @${user.username}`);
        result.referrer = ref.referred_by;
      }
    }
    fields.needs = applyNeeds(user.needs, { energy: -job.energy, hunger: -6, hygiene: -6, social: 4 });
    if (job.fameBonus) fields.fame = user.fame + 1;
    result.title = frac < 1 ? ['💼 Umetoka mapema', '💼 Clocked out early'] : ['💼 Shifti imeisha!', '💼 Shift complete!'];
    result.lines.push([`📈 Utendaji ${busy.perf ?? 50}% · ⭐ ${busy.done || 0}/${WORK.starsAt}`, `📈 Performance ${busy.perf ?? 50}% · ⭐ ${busy.done || 0}/${WORK.starsAt}`]);
    if ((busy.done || 0) >= WORK.starsAt) result.lines.push([`🌟 Bonasi ya bidii +${WORK.starBonus * 100}%`, `🌟 Hard-work bonus +${WORK.starBonus * 100}%`]);
    result.pay = pay;
    if (frac >= 1 && jobLevel(shifts + 1) > before) result.lines.push([`🎉 Umepandishwa cheo: ${jobTitle(job, shifts + 1)}!`, `🎉 Promoted: ${jobTitleEn(job, shifts + 1)}!`]);
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

/** Hand every player a used starter car once (new and existing accounts). */
export const ensureStarterCar = db.transaction((userId) => {
  const u = getUser(userId);
  // v2: everyone without an actual car gets one (v1 skipped people who only had a bike/boda).
  if (!u || u.carSeeded >= 2) return false;
  saveFields(userId, { carSeeded: 2 });
  if (q.vehicles.all(userId).some((v) => ['car', 'van', 'suv'].includes(vehicleById[v.model]?.kind))) return false;
  const v = vehicleById[STARTER_CAR];
  const color = VEHICLE_COLORS[Math.floor(Math.random() * VEHICLE_COLORS.length)] || v.color;
  q.insertVehicle.run(userId, v.id, color, plate(), now());
  return true;
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

// ------------------------------------------------------------ trips
const doorOf = (place) => {
  const [px, pz] = place.pos;
  const cands = [[px, pz + place.size[1] / 2 + 3], [px, pz - place.size[1] / 2 - 3], [px - place.size[0] / 2 - 3, pz], [px + place.size[0] / 2 + 3, pz]];
  return cands.find(([x, z]) => !isWater(x, z)) || cands[0];
};
// Things that go wrong on the road / at sea / in the air when you're not insured: [sw, en, cost, needs]
const WAHALA = {
  car: [['Gari limeharibika njiani, fundi amekutoza', 'Your car broke down — the mechanic charged you', 80_000], ['Tairi limepasuka', 'A flat tyre', 25_000], ['Faini ya polisi barabarani', 'A police checkpoint fine', 30_000]],
  bus: [['Basi limeharibika, umechelewa sana', 'The coach broke down — hours late', 0, { energy: -20, fun: -10 }], ['Mzigo wako umepotea', 'Your luggage went missing', 30_000]],
  ferry: [['Bahari imechafuka — umetapika', 'Rough seas — you got seasick', 0, { hygiene: -30, fun: -20 }], ['Umepoteza simu baharini', 'You dropped your phone overboard', 50_000]],
  flight: [['Ndege imechelewa saa nne', 'The flight was delayed four hours', 0, { energy: -20, fun: -15 }], ['Mzigo umepotea uwanjani', 'Lost luggage at the airport', 40_000]],
  heli: [['Hali ya hewa mbaya — mmetua mahali pengine', 'Bad weather — you landed somewhere else and paid a cab', 60_000]],
};

/** Book a trip to a place in another city (flight, helicopter, ferry, coach or your own car). */
export const startTrip = db.transaction((userId, placeId, mode, insured) => {
  const user = getUser(userId);
  assertNotJailed(user);
  if (user.busy && user.busy.endsAt > now()) throw new GameError(['Bado uko bize na kitu kingine.', "You're still busy with something else."]);
  const place = placeById[placeId];
  const m = TRIP_MODES[mode];
  if (!place || !m) throw new GameError(['Safari si sahihi', 'Invalid trip']);
  const [ux, uz] = positionOf(user);
  const from = cityAt(ux, uz)?.id || 'dar';
  const to = cityAt(...place.pos)?.id;
  if (!to || to === from) throw new GameError(['Uko kwenye mji huo tayari.', "You're already in that city."]);
  const fare = m.price[tripKey(from, to)];
  if (!fare) throw new GameError(['Hakuna usafiri huo kati ya miji hii.', "That way of travelling doesn't connect these cities."]);
  if (m.own && !q.vehicles.all(userId).some((v) => ['car', 'van', 'suv'].includes(vehicleById[v.model]?.kind)))
    throw new GameError(['Unahitaji gari kuendesha safari hii.', 'You need a car to drive there.']);
  const cost = fare + (insured ? m.ins : 0);
  addMoney(userId, -cost, 'travel', `${m.name} kwenda ${cityById[to].name}${insured ? ' (+bima)' : ''}`);
  const busy = { kind: 'trip', id: mode, placeId, from, to, insured: !!insured, emoji: m.emoji, label: `${m.name} → ${cityById[to].name}`, labelEn: `${m.nameEn} → ${cityById[to].name}`, startedAt: now(), endsAt: now() + m.secs * 1000 };
  setBusy(userId, busy);
  return { busy, cost };
});

// ------------------------------------------------------------ travel
export const travel = db.transaction((userId, placeId, mode) => {
  assertNotJailed(getUser(userId));
  const user = getUser(userId);
  const place = placeById[placeId];
  if (!place || !TRAVEL[mode]) throw new GameError(['Safari si sahihi', 'Invalid trip']);
  {
    const [ux, uz] = positionOf(user);
    if (cityAt(ux, uz)?.id !== cityAt(...place.pos)?.id) throw new GameError(['Mji mwingine — panda ndege, boti au basi.', "That's another city — take a flight, ferry or coach."], 400, 'other_city');
  }
  let car = null;
  if (TRAVEL[mode].own) {
    car = q.vehicles.all(userId).find((v) => v.id === user.activeVehicle) || q.vehicles.all(userId).find((v) => ['car', 'van', 'suv', 'moto', 'bajaji'].includes(vehicleById[v.model]?.kind));
    if (!car) throw new GameError(['Huna gari bado.', "You don't have a car yet."]);
  }
  const from = positionOf(user);
  // drop the passenger on the nearest dry spot just outside the building
  const [px, pz] = place.pos;
  let dest = [px, pz + place.size[1] / 2 + 3];
  for (const cand of [dest, [px, pz - place.size[1] / 2 - 3], [px - place.size[0] / 2 - 3, pz], [px + place.size[0] / 2 + 3, pz]])
    if (!isWater(cand[0], cand[1])) { dest = cand; break; }
  const cost = travelCost(mode, from, dest);
  if (cost) addMoney(userId, -cost, 'travel', `${TRAVEL[mode].name} kwenda ${place.name}`);
  saveFields(userId, { x: dest[0], z: dest[1] });
  const p = online.get(userId);
  if (p) {
    Object.assign(p, { x: dest[0], z: dest[1] });
    if (p.inside) {
      p.inside = null;
      broadcast('player:inside', { id: userId, inside: null });
    }
  }
  if (car && user.activeVehicle !== car.id) useVehicle(userId, car.id);
  return { pos: dest, cost, car: car ? { model: car.model, color: car.color } : null };
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
  if (now() - lbCache.at < 10_000 && lbCache.data) return lbCache.data;
  const rows = db.prepare('SELECT id, username, name, fame, money, appearance FROM users WHERE onboarded = 1 AND banned_at IS NULL').all();
  const scored = rows.map((r) => ({ ...r, appearance: JSON.parse(r.appearance || 'null'), worth: netWorth(r.id) }));
  // Wealth = cash on hand right now (net worth incl. cars/land/businesses is shown alongside).
  const rich = [...scored].sort((a, b) => b.money - a.money).slice(0, 20);
  const famous = [...scored].sort((a, b) => b.fame - a.fame).slice(0, 20);
  lbCache = { at: now(), data: { rich, famous } };
  return lbCache.data;
}

// ---------------------------------------------------------------- health
/** Knocked down by traffic (reported by the victim's client). Cooldown stops repeats. */
export const accident = db.transaction((userId, { byUsername } = {}) => {
  const u = getUser(userId);
  if (u.injuredAt && now() - u.injuredAt < HEALTH.accidentCooldownMs) return null;
  const health = Math.max(5, (u.health ?? 100) - HEALTH.accidentDamage);
  const needs = applyNeeds(u.needs, { energy: -20, fun: -15 });
  saveFields(userId, { health, injuredAt: now(), needs, busy: null });
  setBusy(userId, null);
  return { health, by: byUsername || null };
});

/** Ambulance ride straight to the hospital entrance. */
export const ambulance = db.transaction((userId) => {
  const u = getUser(userId);
  const h = placeById[HOSPITAL_ID];
  const pos = [h.pos[0], h.pos[1] + h.size[1] / 2 + 3];
  const cost = (u.health ?? 100) < HEALTH.injuredBelow ? HEALTH.ambulanceCost : HEALTH.ambulanceCost * 2;
  addMoney(userId, -Math.min(cost, u.money), 'travel', 'Gari la wagonjwa 🚑');
  saveFields(userId, { x: pos[0], z: pos[1] });
  const p = online.get(userId);
  if (p) Object.assign(p, { x: pos[0], z: pos[1], inside: null });
  return { pos };
});

/** Neglect hurts: starving or exhausted players slowly lose health (called from the needs tick). */
export function neglectHealth(user, needs) {
  if ((needs.hunger ?? 50) > 5 && (needs.energy ?? 50) > 5) return null;
  return Math.max(1, (user.health ?? 100) - 1);
}
