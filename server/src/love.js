// Dating life: opt-in (18+) profiles, likes → matches, dates together, gifts, partners, proposals, weddings.
import crypto from 'node:crypto';
import { db, getUser, saveFields, addMoney, GameError, now } from './db.js';
import { LOVE, DATE_SPOTS, dateSpotById, loveGiftById, placeById, NEEDS } from '../../shared/world.js';
import { online, emitTo, broadcast } from './presence.js';
import { isBlocked } from './crime.js';
import { bumpStats } from './story.js';

const DAY = 86_400_000;
db.exec(`
CREATE TABLE IF NOT EXISTS dating_profiles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  open INTEGER NOT NULL DEFAULT 0,
  adult INTEGER NOT NULL DEFAULT 0,
  bio TEXT,
  looking TEXT NOT NULL DEFAULT 'any',
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS dating_swipes (
  from_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (from_id, to_id)
);
CREATE TABLE IF NOT EXISTS relationships (
  id INTEGER PRIMARY KEY,
  a_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  b_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  affection INTEGER NOT NULL DEFAULT 10,
  since INTEGER NOT NULL,
  touched_at INTEGER NOT NULL,
  last_date INTEGER,
  dates INTEGER NOT NULL DEFAULT 0,
  ended_at INTEGER
);
CREATE INDEX IF NOT EXISTS rel_a ON relationships(a_id);
CREATE INDEX IF NOT EXISTS rel_b ON relationships(b_id);
`);

const q = {
  profile: db.prepare('SELECT * FROM dating_profiles WHERE user_id = ?'),
  rel: db.prepare('SELECT * FROM relationships WHERE id = ? AND ended_at IS NULL'),
  relsStmt: db.prepare('SELECT * FROM relationships WHERE (a_id = ? OR b_id = ?) AND ended_at IS NULL ORDER BY id DESC'),
  pair: db.prepare('SELECT * FROM relationships WHERE ((a_id = ? AND b_id = ?) OR (a_id = ? AND b_id = ?)) AND ended_at IS NULL'),
  brief: db.prepare('SELECT id, username, name, appearance, fame, last_seen FROM users WHERE id = ?'),
};

const relsOf = (id) => q.relsStmt.all(id, id);
const other = (r, me) => (r.a_id === me ? r.b_id : r.a_id);
/** Affection after neglect: fades a little each day since the last date/gift. */
const affectionNow = (r) => Math.max(0, r.affection - Math.floor((now() - r.touched_at) / DAY) * LOVE.decayPerDay);
const bodyOf = (u) => (u?.appearance?.body === 'woman' ? 'woman' : 'man');
const wants = (looking, body) => looking === 'any' || (looking === 'men' && body === 'man') || (looking === 'women' && body === 'woman');

function mine(userId, rid) {
  const r = q.rel.get(Number(rid));
  if (!r || (r.a_id !== userId && r.b_id !== userId)) throw new GameError(['Uhusiano huo haupo.', 'Relationship not found.'], 404);
  return r;
}
function relView(r, me) {
  const o = q.brief.get(other(r, me));
  const aff = affectionNow(r);
  return {
    id: r.id, status: r.status, affection: aff, since: r.since, lastDate: r.last_date, dates: r.dates,
    partner: { username: o.username, name: o.name, appearance: JSON.parse(o.appearance || 'null'), online: online.has(o.id), fame: o.fame },
    canCouple: r.status === 'match' && aff >= LOVE.coupleAt,
    canPropose: r.status === 'couple' && aff >= LOVE.proposeAt,
    canWed: r.status === 'engaged',
    nextDateIn: Math.max(0, (r.last_date || 0) + LOVE.dateCooldownMs - now()),
  };
}
const touch = (r, delta, extra = {}) => {
  const aff = Math.min(100, affectionNow(r) + delta);
  db.prepare(`UPDATE relationships SET affection = @aff, touched_at = @t${Object.keys(extra).map((k) => `, ${k} = @${k}`).join('')} WHERE id = @id`).run({ ...extra, aff, t: now(), id: r.id });
  return aff;
};

// ------------------------------------------------------------------ profile
export function saveProfile(userId, { open, adult, bio, looking }) {
  const prev = q.profile.get(userId);
  if (open && !adult && !prev?.adult) throw new GameError(['Thibitisha una miaka 18+ kuwasha uchumba.', 'Confirm you are 18+ to turn on dating.']);
  const l = ['any', 'men', 'women'].includes(looking) ? looking : prev?.looking || 'any';
  const b = typeof bio === 'string' ? bio.replace(/\s+/g, ' ').trim().slice(0, LOVE.bioMax) : prev?.bio || '';
  db.prepare(`INSERT INTO dating_profiles (user_id, open, adult, bio, looking, updated_at) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET open = excluded.open, adult = MAX(adult, excluded.adult), bio = excluded.bio, looking = excluded.looking, updated_at = excluded.updated_at`)
    .run(userId, open ? 1 : 0, adult || prev?.adult ? 1 : 0, b, l, now());
}

// ----------------------------------------------------------------- discover
export function discover(userId) {
  const me = getUser(userId);
  const prof = q.profile.get(userId);
  if (!prof?.open) return [];
  const myBody = bodyOf(me);
  const rows = db.prepare(`SELECT u.id, u.username, u.name, u.appearance, u.fame, u.last_seen, u.story, p.bio, p.looking
      FROM dating_profiles p JOIN users u ON u.id = p.user_id
      WHERE p.open = 1 AND p.adult = 1 AND u.id != ? AND u.banned_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM dating_swipes s WHERE s.from_id = ? AND s.to_id = u.id AND (s.kind = 'like' OR s.created_at > ?))
      ORDER BY u.last_seen DESC LIMIT 80`).all(userId, userId, now() - 7 * DAY);
  return rows
    .map((r) => ({ ...r, appearance: JSON.parse(r.appearance || 'null') }))
    .filter((r) => wants(prof.looking, bodyOf(r)) && wants(r.looking, myBody) && !isBlocked(userId, r.id) && !q.pair.get(userId, r.id, r.id, userId))
    .sort((a, b) => online.has(b.id) - online.has(a.id))
    .slice(0, 20)
    .map((r) => ({ username: r.username, name: r.name, appearance: r.appearance, fame: r.fame, bio: r.bio, online: online.has(r.id), amb: JSON.parse(r.story || 'null')?.amb || null }));
}

export const swipe = db.transaction((userId, username, kind) => {
  const t = db.prepare('SELECT id, username FROM users WHERE username = ?').get(String(username).replace(/^@/, ''));
  if (!t || t.id === userId) throw new GameError(['Hayupo', 'Not found'], 404);
  if (!q.profile.get(userId)?.open) throw new GameError(['Washa uchumba kwanza.', 'Turn on dating first.']);
  const theirs = q.profile.get(t.id);
  if (!theirs?.open || isBlocked(userId, t.id)) throw new GameError(['Hapatikani.', 'Not available.']);
  db.prepare('INSERT OR REPLACE INTO dating_swipes (from_id, to_id, kind, created_at) VALUES (?, ?, ?, ?)').run(userId, t.id, kind === 'like' ? 'like' : 'pass', now());
  if (kind !== 'like') return { match: false };
  const back = db.prepare("SELECT 1 FROM dating_swipes WHERE from_id = ? AND to_id = ? AND kind = 'like'").get(t.id, userId);
  if (!back || q.pair.get(userId, t.id, t.id, userId)) {
    emitTo(t.id, 'toast', { text: ['💘 Mtu fulani amekupenda kwenye Penzi!', '💘 Someone liked you on Penzi!'] });
    return { match: false };
  }
  const [a, b] = userId < t.id ? [userId, t.id] : [t.id, userId];
  const rid = db.prepare("INSERT INTO relationships (a_id, b_id, status, affection, since, touched_at) VALUES (?, ?, 'match', 10, ?, ?)").run(a, b, now(), now()).lastInsertRowid;
  const me = getUser(userId);
  emitTo(t.id, 'love:match', { with: me.username, rid });
  return { match: true, rid, with: t.username };
});

// ------------------------------------------------------- asks (date / partner / propose)
const asks = new Map(); // id -> { kind, from, to, rid, spot, at }
setInterval(() => { for (const [k, a] of asks) if (now() - a.at > LOVE.askTtlMs) asks.delete(k); }, 60_000).unref();

function ask(userId, r, kind, spot) {
  const to = other(r, userId);
  if (!online.has(to)) throw new GameError(['Mpenzi wako hayuko mtandaoni sasa.', "They're not online right now."]);
  const id = crypto.randomUUID();
  asks.set(id, { id, kind, from: userId, to, rid: r.id, spot, at: now() });
  const me = getUser(userId);
  emitTo(to, 'love:ask', { id, kind, from: me.username, appearance: me.appearance, spot });
  return { asked: true };
}

export function inviteDate(userId, rid, spotId) {
  const r = mine(userId, rid);
  const spot = dateSpotById[spotId];
  if (!spot) throw new GameError(['Chagua mahali pa deti.', 'Pick a date spot.']);
  return ask(userId, r, 'date', spot.id);
}
export function askPartner(userId, rid) {
  const r = mine(userId, rid);
  if (r.status !== 'match') throw new GameError(['Tayari mko pamoja.', "You're already together."]);
  if (affectionNow(r) < LOVE.coupleAt) throw new GameError([`Mapenzi yafikie ${LOVE.coupleAt} kwanza — nendeni deti.`, `Get affection to ${LOVE.coupleAt} first — go on dates.`]);
  const mineCouple = relsOf(userId).some((x) => x.id !== r.id && x.status !== 'match');
  if (mineCouple) throw new GameError(['Tayari una mpenzi. Kuwa mwaminifu 😅', 'You already have a partner. Stay loyal 😅']);
  return ask(userId, r, 'couple');
}
export function propose(userId, rid) {
  const r = mine(userId, rid);
  if (r.status !== 'couple') throw new GameError(['Mnahitaji kuwa wapenzi kwanza.', 'You need to be partners first.']);
  if (affectionNow(r) < LOVE.proposeAt) throw new GameError([`Mapenzi yafikie ${LOVE.proposeAt} kwanza.`, `Get affection to ${LOVE.proposeAt} first.`]);
  if (getUser(userId).money < LOVE.ringPrice) throw new GameError(['Pete ya uchumba inahitajika (TSh 5M).', 'You need an engagement ring (TSh 5M).']);
  return ask(userId, r, 'propose');
}

export const answer = db.transaction((userId, askId, accept) => {
  const a = asks.get(askId);
  if (!a || a.to !== userId) throw new GameError(['Ombi limeisha muda.', 'That request has expired.'], 410);
  asks.delete(askId);
  const r = q.rel.get(a.rid);
  if (!r) throw new GameError(['Uhusiano haupo tena.', 'Relationship no longer exists.']);
  const me = getUser(userId);
  const from = getUser(a.from);
  const tell = (text) => emitTo(a.from, 'love:answer', { kind: a.kind, accept: !!accept, by: me.username, spot: a.spot, text });
  if (!accept) {
    tell([`@${me.username} amesema hapana kwa sasa.`, `@${me.username} said not right now.`]);
    return { ok: true };
  }
  if (a.kind === 'date') {
    tell([`💘 @${me.username} amekubali deti!`, `💘 @${me.username} said yes to the date!`]);
    return { ok: true, spot: a.spot, with: from.username };
  }
  if (a.kind === 'couple') {
    db.prepare("UPDATE relationships SET status = 'couple' WHERE id = ?").run(r.id);
    touch(r, 5);
    tell([`❤️ Wewe na @${me.username} sasa ni wapenzi!`, `❤️ You and @${me.username} are now partners!`]);
    return { ok: true, status: 'couple' };
  }
  if (a.kind === 'propose') {
    if (from.money < LOVE.ringPrice) throw new GameError(['Mchumba hana pesa ya pete tena.', "They can't afford the ring anymore."]);
    addMoney(from.id, -LOVE.ringPrice, 'spend', `💍 Pete ya uchumba kwa @${me.username}`);
    db.prepare("UPDATE relationships SET status = 'engaged' WHERE id = ?").run(r.id);
    touch(r, 10);
    tell([`💍 @${me.username} amekubali kukuoa/kuolewa nawe!`, `💍 @${me.username} said YES!`]);
    broadcast('toast', { text: [`💍 @${from.username} amemchumbia @${me.username} — wamekubaliana!`, `💍 @${from.username} proposed to @${me.username} — they said yes!`] });
    return { ok: true, status: 'engaged' };
  }
  return { ok: true };
});

// ------------------------------------------------------------------- dates
/** Is this player at the place (inside it, or standing near it)? */
function atPlace(userId, placeId) {
  const p = online.get(userId);
  const pl = placeById[placeId];
  if (!p || !pl) return false;
  if (p.inside === placeId) return true;
  const dx = Math.max(Math.abs(p.x - pl.pos[0]) - pl.size[0] / 2, 0);
  const dz = Math.max(Math.abs(p.z - pl.pos[1]) - pl.size[1] / 2, 0);
  return Math.hypot(dx, dz) < 14;
}
const clamp = (v) => Math.max(0, Math.min(100, v));
export const startDate = db.transaction((userId, rid, spotId) => {
  const r = mine(userId, rid);
  const spot = dateSpotById[spotId];
  if (!spot) throw new GameError(['Mahali pa deti hapajulikani.', 'Unknown date spot.']);
  const partnerId = other(r, userId);
  if (!atPlace(userId, spot.placeId)) throw new GameError([`Nenda ${placeById[spot.placeId].name} kwanza.`, `Go to ${placeById[spot.placeId].nameEn || placeById[spot.placeId].name} first.`]);
  if (!atPlace(partnerId, spot.placeId)) throw new GameError(['Mpenzi wako bado hajafika.', "Your date hasn't arrived yet."]);
  if (now() - (r.last_date || 0) < LOVE.dateCooldownMs) throw new GameError(['Mmetoka deti hivi punde — pumzikeni kidogo.', 'You just had a date — give it a little time.'], 429);
  addMoney(userId, -spot.cost, 'spend', `${spot.emoji} Deti: ${spot.name[0]}`);
  // Married couples and partners get a little more out of every date.
  const bonus = r.status === 'married' ? 4 : r.status !== 'match' ? 2 : 0;
  const aff = touch(r, spot.affection + bonus, { last_date: now(), dates: r.dates + 1 });
  for (const id of [userId, partnerId]) {
    const u = getUser(id);
    const needs = { ...u.needs };
    for (const [k, v] of Object.entries(spot.effects)) if (NEEDS.some((n) => n.id === k)) needs[k] = clamp((needs[k] ?? 50) + v);
    saveFields(id, { needs, fame: u.fame + 1 });
    bumpStats(id, ['dates', `date:${spot.id}`]);
    broadcast('emote', { id, e: '💕' });
  }
  const me = getUser(userId);
  emitTo(partnerId, 'love:date', { with: me.username, spot: spot.id, affection: aff });
  return { affection: aff, spot: spot.id };
});

export function gift(userId, rid, giftId) {
  const r = mine(userId, rid);
  const g = loveGiftById[giftId];
  if (!g) throw new GameError(['Zawadi haipo.', 'Unknown gift.']);
  const partnerId = other(r, userId);
  addMoney(userId, -g.price, 'gift', `${g.emoji} Zawadi kwa mpenzi`);
  const aff = touch(r, g.affection);
  const me = getUser(userId);
  emitTo(partnerId, 'toast', { text: [`${g.emoji} @${me.username} amekutumia ${g.name[0]}! 💕`, `${g.emoji} @${me.username} sent you ${g.name[1].toLowerCase()}! 💕`], refresh: true });
  return { affection: aff };
}

export const wedding = db.transaction((userId, rid) => {
  const r = mine(userId, rid);
  if (r.status !== 'engaged') throw new GameError(['Mnahitaji kuwa wachumba kwanza.', 'You need to be engaged first.']);
  addMoney(userId, -LOVE.weddingPrice, 'spend', '💒 Harusi');
  db.prepare("UPDATE relationships SET status = 'married' WHERE id = ?").run(r.id);
  touch(r, 15);
  const me = getUser(userId);
  const o = getUser(other(r, userId));
  for (const id of [me.id, o.id]) saveFields(id, { fame: getUser(id).fame + 10 });
  broadcast('toast', { text: [`💒 Harusi! @${me.username} na @${o.username} wamefunga ndoa! 🎉`, `💒 Wedding bells! @${me.username} and @${o.username} just got married! 🎉`] });
  emitTo(o.id, 'love:answer', { kind: 'wedding', accept: true, by: me.username, text: [`💒 Mmeoana na @${me.username}! Hongera!`, `💒 You're married to @${me.username}! Congratulations!`] });
  return { status: 'married' };
});

export function endRelationship(userId, rid) {
  const r = mine(userId, rid);
  db.prepare('UPDATE relationships SET ended_at = ? WHERE id = ?').run(now(), r.id);
  const me = getUser(userId);
  const msg = r.status === 'match' ? [`@${me.username} ameondoa match yenu.`, `@${me.username} unmatched with you.`] : [`💔 @${me.username} ameachana nawe.`, `💔 @${me.username} broke up with you.`];
  emitTo(other(r, userId), 'toast', { text: msg, refresh: true });
}

// --------------------------------------------------------------------- views
export function loveState(userId) {
  const prof = q.profile.get(userId);
  return {
    profile: prof ? { open: !!prof.open, adult: !!prof.adult, bio: prof.bio || '', looking: prof.looking } : { open: false, adult: false, bio: '', looking: 'any' },
    relationships: relsOf(userId).filter((r) => !isBlocked(userId, other(r, userId))).map((r) => relView(r, userId)),
    likesYou: db.prepare("SELECT COUNT(*) n FROM dating_swipes s WHERE s.to_id = ? AND s.kind = 'like' AND NOT EXISTS (SELECT 1 FROM dating_swipes x WHERE x.from_id = ? AND x.to_id = s.from_id)").get(userId, userId).n,
  };
}
/** Public line for a profile card: who they're with (partners and up only). */
export function publicStatus(userId) {
  const r = relsOf(userId).find((x) => x.status !== 'match');
  if (!r) return null;
  return { status: r.status, with: q.brief.get(other(r, userId))?.username };
}
/** Minimal list for the client HUD: partners you could start a date with. */
export function partnersOf(userId) {
  return relsOf(userId).map((r) => ({ rid: r.id, status: r.status, username: q.brief.get(other(r, userId))?.username, id: other(r, userId) }));
}
void DATE_SPOTS;
