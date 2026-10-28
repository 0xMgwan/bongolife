// Love life with game characters (Bongo singles): like → match, chat, dates, gifts, partner,
// proposal, wedding — for players who haven't matched with a real player yet. One partner at a
// time across real and game romances.
import { db, getUser, saveFields, addMoney, GameError, now } from './db.js';
import { LOVE, NPC_LOVE, NPC_CHAT, LOVE_NPCS, loveNpcById, dateSpotById, loveGiftById, placeById, NEEDS } from '../../shared/world.js';
import { online, broadcast } from './presence.js';

const DAY = 86_400_000;
db.exec(`CREATE TABLE IF NOT EXISTS npc_romance (
  user_id INTEGER NOT NULL, npc_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'match', affection INTEGER NOT NULL DEFAULT 10,
  since INTEGER NOT NULL, touched_at INTEGER NOT NULL,
  last_date INTEGER, dates INTEGER NOT NULL DEFAULT 0,
  last_chat INTEGER, chat_idx INTEGER NOT NULL DEFAULT 0,
  ended_at INTEGER,
  PRIMARY KEY (user_id, npc_id)
)`);
const q = {
  mine: db.prepare('SELECT * FROM npc_romance WHERE user_id = ? AND ended_at IS NULL ORDER BY since DESC'),
  one: db.prepare('SELECT * FROM npc_romance WHERE user_id = ? AND npc_id = ? AND ended_at IS NULL'),
};
// The relationships table belongs to love.js (may not exist yet on a fresh database).
let realStmt = null;
q.realPartner = { get: (a, b) => { try { realStmt ||= db.prepare("SELECT 1 FROM relationships WHERE (a_id = ? OR b_id = ?) AND ended_at IS NULL AND status != 'match' LIMIT 1"); return realStmt.get(a, b); } catch { return null; } } };
const affNow = (r) => Math.max(0, r.affection - Math.floor((now() - r.touched_at) / DAY) * LOVE.decayPerDay);
const touch = (r, delta, extra = {}) => {
  const aff = Math.min(100, affNow(r) + delta);
  const sets = Object.keys(extra).map((k) => `, ${k} = @${k}`).join('');
  db.prepare(`UPDATE npc_romance SET affection = @aff, touched_at = @t${sets} WHERE user_id = @u AND npc_id = @n`).run({ ...extra, aff, t: now(), u: r.user_id, n: r.npc_id });
  return aff;
};
const need = (uid, id) => {
  const r = q.one.get(uid, id);
  if (!r) throw new GameError(['Hamjaendana bado.', "You haven't matched yet."], 404);
  return r;
};
const clamp = (v) => Math.max(0, Math.min(100, v));

/** Does this player already have a game partner (couple or more)? */
export const hasNpcPartner = (uid) => q.mine.all(uid).some((r) => r.status !== 'match');
/** Their game partner, for the profile card and the home. */
export function npcPartner(uid) {
  const r = q.mine.all(uid).find((x) => x.status !== 'match');
  const n = r && loveNpcById[r.npc_id];
  return n ? { id: n.id, name: n.name, status: r.status, look: n.look } : null;
}

function romanceView(r) {
  const n = loveNpcById[r.npc_id];
  const aff = affNow(r);
  const chat = NPC_CHAT[r.chat_idx % NPC_CHAT.length];
  return {
    npc: n, status: r.status, affection: aff, dates: r.dates, since: r.since,
    chat: { q: chat.q, a: chat.a, readyAt: (r.last_chat || 0) + NPC_LOVE.chatCooldownMs },
    nextDateIn: Math.max(0, (r.last_date || 0) + LOVE.dateCooldownMs - now()),
    canCouple: r.status === 'match' && aff >= LOVE.coupleAt,
    canPropose: r.status === 'couple' && aff >= LOVE.proposeAt,
    canWed: r.status === 'engaged',
  };
}

export function view(uid) {
  const u = getUser(uid);
  const mine = q.mine.all(uid);
  const taken = new Set(mine.map((r) => r.npc_id));
  const body = u.appearance?.body === 'man' ? 'man' : 'woman';
  const prof = db.prepare('SELECT looking FROM dating_profiles WHERE user_id = ?').get(uid);
  const looking = prof?.looking && prof.looking !== 'any' ? (prof.looking === 'men' ? 'man' : 'woman') : body === 'man' ? 'woman' : 'man';
  return {
    looking,
    singles: LOVE_NPCS.filter((n) => !taken.has(n.id)),
    romances: mine.map(romanceView),
    partner: npcPartner(uid),
    realPartner: !!q.realPartner.get(uid, uid),
  };
}

export function like(uid, npcId) {
  const n = loveNpcById[npcId];
  if (!n) throw new GameError(['Hayupo', 'Not found'], 404);
  if (q.one.get(uid, npcId)) throw new GameError(['Tayari mmeendana.', "You've already matched."]);
  db.prepare('DELETE FROM npc_romance WHERE user_id = ? AND npc_id = ?').run(uid, npcId);
  db.prepare('INSERT INTO npc_romance (user_id, npc_id, since, touched_at) VALUES (?, ?, ?, ?)').run(uid, npcId, now(), now());
  return { matched: true, ...view(uid) };
}

export function chat(uid, npcId, style) {
  const r = need(uid, npcId);
  const wait = (r.last_chat || 0) + NPC_LOVE.chatCooldownMs - now();
  if (wait > 0) throw new GameError([`${loveNpcById[npcId].name} atajibu baada ya dakika ${Math.ceil(wait / 60_000)} 📱`, `${loveNpcById[npcId].name} will reply in ${Math.ceil(wait / 60_000)} min 📱`], 429);
  if (!['sweet', 'fun', 'chill'].includes(style)) throw new GameError(['Chagua jibu', 'Pick a reply']);
  const n = loveNpcById[npcId];
  const good = style === n.vibe;
  const aff = touch(r, good ? NPC_LOVE.chatGood : NPC_LOVE.chatOk, { last_chat: now(), chat_idx: r.chat_idx + 1 });
  const u = getUser(uid);
  saveFields(uid, { needs: { ...u.needs, social: clamp((u.needs.social ?? 50) + 4) } });
  const reply = good
    ? [['😍 Wow, unanijua vizuri!', '😍 Wow, you get me!'], ['🥰 Hapo umenigusa moyo', '🥰 That touched my heart'], ['😂❤️ Napenda jinsi unavyofikiri', '😂❤️ I love how you think']][r.chat_idx % 3]
    : [['😊 Haha, sawa sawa', '😊 Haha, fair enough'], ['🙂 Inavutia…', '🙂 Interesting…'], ['😄 Tutaona!', "😄 We'll see!"]][r.chat_idx % 3];
  return { good, affection: aff, reply, ...view(uid) };
}

function atPlace(uid, placeId) {
  const p = online.get(uid);
  const pl = placeById[placeId];
  if (!p || !pl) return false;
  if (p.inside === placeId) return true;
  const dx = Math.max(Math.abs(p.x - pl.pos[0]) - pl.size[0] / 2, 0);
  const dz = Math.max(Math.abs(p.z - pl.pos[1]) - pl.size[1] / 2, 0);
  return Math.hypot(dx, dz) < 14;
}

export const date = db.transaction((uid, npcId, spotId) => {
  const r = need(uid, npcId);
  const spot = dateSpotById[spotId];
  if (!spot) throw new GameError(['Mahali pa deti hapajulikani.', 'Unknown date spot.']);
  if (!atPlace(uid, spot.placeId)) throw new GameError([`Nenda ${placeById[spot.placeId].name} kwanza — ${loveNpcById[npcId].name} atakukuta huko.`, `Go to ${placeById[spot.placeId].nameEn || placeById[spot.placeId].name} first — ${loveNpcById[npcId].name} will meet you there.`]);
  if (now() - (r.last_date || 0) < LOVE.dateCooldownMs) throw new GameError(['Mmetoka deti hivi punde.', 'You just had a date.'], 429);
  addMoney(uid, -spot.cost, 'spend', `${spot.emoji} Deti na ${loveNpcById[npcId].name}`);
  const n = loveNpcById[npcId];
  const fav = n.spot === spot.id;
  const bonus = (r.status === 'married' ? 4 : r.status !== 'match' ? 2 : 0) + (fav ? NPC_LOVE.favouriteBonus : 0);
  const aff = touch(r, spot.affection + bonus, { last_date: now(), dates: r.dates + 1 });
  const u = getUser(uid);
  const needs = { ...u.needs };
  for (const [k, v] of Object.entries(spot.effects)) if (NEEDS.some((x) => x.id === k)) needs[k] = clamp((needs[k] ?? 50) + v);
  saveFields(uid, { needs, fame: u.fame + 1 });
  broadcast('emote', { id: uid, e: '💕' });
  return { affection: aff, fav, ...view(uid) };
});

export function gift(uid, npcId, giftId) {
  const r = need(uid, npcId);
  const g = loveGiftById[giftId];
  if (!g) throw new GameError(['Zawadi haipo.', 'Unknown gift.']);
  addMoney(uid, -g.price, 'gift', `${g.emoji} Zawadi kwa ${loveNpcById[npcId].name}`);
  const fav = loveNpcById[npcId].gift === g.id;
  const aff = touch(r, g.affection + (fav ? NPC_LOVE.favouriteBonus : 0));
  return { affection: aff, fav, ...view(uid) };
}

const loyal = (uid, npcId) => {
  if (q.realPartner.get(uid, uid)) throw new GameError(['Tayari una mpenzi (mchezaji). Kuwa mwaminifu 😅', 'You already have a partner (a player). Stay loyal 😅']);
  if (q.mine.all(uid).some((r) => r.npc_id !== npcId && r.status !== 'match')) throw new GameError(['Tayari una mpenzi. Kuwa mwaminifu 😅', 'You already have a partner. Stay loyal 😅']);
};
export function step(uid, npcId, kind) {
  const r = need(uid, npcId);
  const aff = affNow(r);
  const n = loveNpcById[npcId];
  const u = getUser(uid);
  if (kind === 'couple') {
    if (r.status !== 'match') throw new GameError(['Tayari mko pamoja.', "You're already together."]);
    if (aff < LOVE.coupleAt) throw new GameError([`Mapenzi yafikie ${LOVE.coupleAt} kwanza — ongea na nendeni deti.`, `Get affection to ${LOVE.coupleAt} first — chat and go on dates.`]);
    loyal(uid, npcId);
    db.prepare("UPDATE npc_romance SET status = 'couple' WHERE user_id = ? AND npc_id = ?").run(uid, npcId);
    touch(r, 5);
  } else if (kind === 'propose') {
    if (r.status !== 'couple') throw new GameError(['Mnahitaji kuwa wapenzi kwanza.', 'You need to be partners first.']);
    if (aff < LOVE.proposeAt) throw new GameError([`Mapenzi yafikie ${LOVE.proposeAt} kwanza.`, `Get affection to ${LOVE.proposeAt} first.`]);
    addMoney(uid, -LOVE.ringPrice, 'spend', `💍 Pete ya uchumba kwa ${n.name}`);
    db.prepare("UPDATE npc_romance SET status = 'engaged' WHERE user_id = ? AND npc_id = ?").run(uid, npcId);
    touch(r, 10);
    broadcast('toast', { text: [`💍 @${u.username} amemchumbia ${n.name} — amekubali!`, `💍 @${u.username} proposed to ${n.name} — she said yes!`.replace('she', n.body === 'man' ? 'he' : 'she')] });
  } else if (kind === 'wed') {
    if (r.status !== 'engaged') throw new GameError(['Mnahitaji kuwa wachumba kwanza.', 'You need to be engaged first.']);
    addMoney(uid, -LOVE.weddingPrice, 'spend', `💒 Harusi na ${n.name}`);
    db.prepare("UPDATE npc_romance SET status = 'married' WHERE user_id = ? AND npc_id = ?").run(uid, npcId);
    touch(r, 15);
    saveFields(uid, { fame: u.fame + 10 });
    broadcast('toast', { text: [`💒 Harusi! @${u.username} na ${n.name} wamefunga ndoa! 🎉`, `💒 Wedding bells! @${u.username} married ${n.name}! 🎉`] });
  } else throw new GameError(['Haijulikani', 'Unknown']);
  return view(uid);
}

export function end(uid, npcId, divorce = false) {
  const r = need(uid, npcId);
  if (r.status === 'married' && !divorce) throw new GameError(['Mmeoana — tumia Talaka kwenye Familia.', "You're married — file for divorce in the Family app."]);
  db.prepare('UPDATE npc_romance SET ended_at = ? WHERE user_id = ? AND npc_id = ?').run(now(), uid, npcId);
  return view(uid);
}
