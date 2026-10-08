// "Together" interactions: high-fives, hugs, dancing, treats, selfies and play-fights. Unlike the
// quick one-sided ones (hello/gist/joke in crime.js), both sims play these, so the other player accepts.
// The idea is contact, not damage: everything needs both players close together, most need the
// other player to accept, and a play-fight can never put anyone in hospital.
import crypto from 'node:crypto';
import { HEALTH, INTERACT_RANGE, moodOf } from '../../shared/world.js';
import { getUser, saveFields, addMoney, now } from './db.js';
import { online, emitTo, broadcast } from './presence.js';
import { applyNeeds } from './game.js';

export const INTERACTIONS = {
  highfive: { ask: true, ms: 1600, needs: { social: 6 } },
  fistbump: { ask: true, ms: 1600, needs: { social: 6 } },
  hug: { ask: true, ms: 2600, needs: { social: 10 } },
  dance: { ask: true, ms: 6000, needs: { social: 8, fun: 10 } },
  treat: { ask: true, ms: 2600, needs: { social: 8 }, cost: 2000, gift: { hunger: 15, fun: 10 } },
  selfie: { ask: true, ms: 2600, needs: { social: 6, fun: 4 } },
  fight: { ask: true, ms: 4200, needs: { social: 10, energy: -6 } },
};
const NEAR = INTERACT_RANGE; // same "next to them" distance as the quick interactions
const ASK_TTL = 15_000;
const COOLDOWN = 4000;
const pending = new Map(); // rid -> { a, b, kind, exp }

/** Both online, not busy, and together: same venue, or close on the street. */
function together(a, b) {
  const p = online.get(a);
  const q = online.get(b);
  if (!p || !q || a === b) return false;
  if (p.inside || q.inside) return !!p.inside && p.inside === q.inside;
  return Math.hypot(p.x - q.x, p.z - q.z) <= NEAR;
}

function sendNeeds(id, user) {
  emitTo(id, 'needs', { needs: user.needs, mood: moodOf(user.needs), health: user.health });
}

/** Apply the effects to both players and tell everyone to play the animation. */
function play(a, b, kind) {
  const def = INTERACTIONS[kind];
  const A = getUser(a);
  const B = getUser(b);
  if (!A || !B) return;
  const result = { a, b, kind, ms: def.ms, at: now() };

  if (def.cost) {
    if (A.money < def.cost) return emitTo(a, 'toast', { text: ['Pesa haitoshi kumnunulia.', "You can't afford the treat."] });
    addMoney(a, -def.cost, 'treat', `Umemnunulia @${B.username}`);
  }

  const aNeeds = applyNeeds(A.needs, def.needs);
  const bNeeds = applyNeeds(B.needs, { ...def.needs, ...(def.gift ? Object.fromEntries(Object.entries(def.gift).map(([k, v]) => [k, (def.needs[k] || 0) + v])) : {}) });
  const aFields = { needs: aNeeds };
  const bFields = { needs: bNeeds };

  if (kind === 'fight') {
    // Fresher fighter has the edge, but anyone can win. Loser takes a tiny knock that never
    // drops them into "injured" (so nobody gets sent to hospital by a play-fight).
    const aEdge = (A.needs.energy ?? 50) + Math.random() * 60;
    const bEdge = (B.needs.energy ?? 50) + Math.random() * 60;
    const winner = aEdge >= bEdge ? a : b;
    const [W, wFields, lFields, L] = winner === a ? [A, aFields, bFields, B] : [B, bFields, aFields, A];
    wFields.fame = (W.fame || 0) + 2;
    const hp = L.health ?? 100;
    if (hp > HEALTH.injuredBelow) lFields.health = Math.max(HEALTH.injuredBelow, hp - 3);
    result.winner = winner;
    result.winnerName = W.username;
  }

  saveFields(a, aFields);
  saveFields(b, bFields);
  sendNeeds(a, { ...A, ...aFields });
  sendNeeds(b, { ...B, ...bFields });
  if (def.cost) emitTo(a, 'toast', { text: [`🍹 Umemnunulia @${B.username}`, `🍹 You treated @${B.username}`], refresh: true });
  if (def.gift) emitTo(b, 'toast', { text: [`🍹 @${A.username} amekunulia kinywaji!`, `🍹 @${A.username} treated you!`] });
  broadcast('interact:play', { ...result, aName: A.username, bName: B.username });
}

export function registerInteractions(socket, uid) {
  let last = 0;

  socket.on('interact', ({ to, kind } = {}, ack = () => {}) => {
    const def = INTERACTIONS[kind];
    const target = [...online.entries()].find(([, q]) => q.username === to)?.[0];
    if (!def || !target) return ack({ error: ['Hayupo karibu.', "They're not around."] });
    const t = now();
    if (t - last < COOLDOWN) return ack({ error: ['Pole pole 😅', 'Easy there 😅'] });
    if (!together(uid, target)) return ack({ error: ['Sogea karibu naye kwanza.', 'Get closer to them first.'] });
    last = t;
    if (!def.ask) {
      play(uid, target, kind);
      return ack({ ok: 'played' });
    }
    const rid = crypto.randomUUID();
    pending.set(rid, { a: uid, b: target, kind, exp: t + ASK_TTL });
    const me = online.get(uid);
    emitTo(target, 'interact:ask', { rid, kind, from: me.username, fromId: uid, exp: t + ASK_TTL });
    ack({ ok: 'asked' });
  });

  socket.on('interact:answer', ({ rid, ok } = {}) => {
    const req = pending.get(rid);
    if (!req || req.b !== uid) return;
    pending.delete(rid);
    const them = online.get(uid)?.username;
    if (!ok || req.exp < now()) return emitTo(req.a, 'toast', { text: [`@${them} amekataa.`, `@${them} said no.`] });
    if (!together(req.a, req.b)) return emitTo(req.a, 'toast', { text: [`@${them} yuko mbali sasa.`, `@${them} moved away.`] });
    play(req.a, req.b, req.kind);
  });
}

// Drop requests nobody answered.
setInterval(() => {
  const t = now();
  for (const [rid, r] of pending) if (r.exp < t) pending.delete(rid);
}, 30_000).unref();
