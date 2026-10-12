// Watch parties: watch football with friends — a shared screen, chat, cheers and snacks.
// Matches come from ScoreBat (SCOREBAT_TOKEN, free video API: highlights + embeds) and from links
// the admin adds (Admin → Settings → Watch: YouTube or any embeddable stream they have rights to).
import { online, emitTo } from './presence.js';
import { getUser, getUserByUsername, addMoney, saveFields, GameError, now, getSettings } from './db.js';
import { applyNeeds } from './game.js';
import { notify } from './push.js';
import { isBlocked } from './crime.js';
import crypto from 'node:crypto';

const hid = (s) => crypto.createHash('sha1').update(s).digest('base64url').slice(0, 12);

export const SNACKS = [
  { id: 'popcorn', emoji: '🍿', name: ['Popcorn', 'Popcorn'], price: 2_000, effects: { hunger: 6, fun: 4 } },
  { id: 'soda', emoji: '🥤', name: ['Soda baridi', 'Cold soda'], price: 1_500, effects: { fun: 3, energy: 2 } },
  { id: 'mishkaki', emoji: '🍢', name: ['Mishkaki', 'Mishkaki'], price: 4_000, effects: { hunger: 12, fun: 3 } },
  { id: 'chips', emoji: '🍟', name: ['Chipsi mayai', 'Chips mayai'], price: 3_000, effects: { hunger: 14 } },
  { id: 'beer', emoji: '🍺', name: ['Bia baridi', 'Cold beer'], price: 3_500, effects: { fun: 6, social: 3 } },
];

// ---------------------------------------------------------------- the match list
const ytEmbed = (url) => {
  const m = /(?:youtu\.be\/|v=|\/live\/|\/embed\/)([\w-]{11})/.exec(url || '');
  return m ? `https://www.youtube.com/embed/${m[1]}?autoplay=1&playsinline=1` : null;
};
let feedCache = null;
export async function matches() {
  const list = [];
  for (const l of getSettings().watchLinks || []) {
    const src = ytEmbed(l.url) || (/^https:\/\//.test(l.url) ? l.url : null);
    if (src) list.push({ id: `link-${hid(l.url)}`, title: l.title || 'Mechi', competition: l.competition || (l.live ? 'LIVE' : ''), live: !!l.live, src, source: 'link' });
  }
  if (process.env.SCOREBAT_TOKEN) {
    if (!feedCache || Date.now() - feedCache.at > 10 * 60_000) {
      try {
        const r = await fetch(`https://www.scorebat.com/video-api/v3/feed/?token=${process.env.SCOREBAT_TOKEN}`, { signal: AbortSignal.timeout(8000) });
        const j = await r.json();
        const items = (j.response || []).slice(0, 30).map((m) => {
          const embed = m.videos?.[0]?.embed || '';
          const src = /src=['"]([^'"]+)['"]/.exec(embed)?.[1] || m.matchviewUrl;
          return src && { id: `sb-${hid(m.title + m.date)}`, title: m.title, competition: m.competition, thumbnail: m.thumbnail, date: m.date, src, source: 'ScoreBat' };
        }).filter(Boolean);
        feedCache = { at: Date.now(), items };
      } catch (e) { console.error('[watch] scorebat', e.message); }
    }
    list.push(...(feedCache?.items || []));
  }
  return list;
}

// ---------------------------------------------------------------- rooms
const rooms = new Map(); // matchId -> { match, members: Set, chat: [] }
const roomOf = (uid) => [...rooms.entries()].find(([, r]) => r.members.has(uid));
const view = (room) => [...room.members].map((id) => ({ id, username: online.get(id)?.username || '?', appearance: online.get(id)?.appearance || null }));
const tell = (room, ev, data) => { for (const id of room.members) emitTo(id, ev, data); };

export function leaveWatch(uid) {
  const hit = roomOf(uid);
  if (!hit) return;
  const [id, room] = hit;
  room.members.delete(uid);
  if (!room.members.size) rooms.delete(id);
  else tell(room, 'watch:members', { members: view(room) });
}

export function attachWatch(socket, uid, p) {
  socket.on('watch:join', async ({ matchId } = {}, ack) => {
    const m = (await matches()).find((x) => x.id === matchId);
    if (!m) return ack?.({ error: 'no_match' });
    leaveWatch(uid);
    const room = rooms.get(m.id) || { match: m, members: new Set(), chat: [] };
    rooms.set(m.id, room);
    room.members.add(uid);
    ack?.({ ok: true, match: m, members: view(room), chat: room.chat.slice(-40) });
    tell(room, 'watch:members', { members: view(room) });
  });
  socket.on('watch:leave', () => leaveWatch(uid));
  socket.on('watch:chat', (text) => {
    const hit = roomOf(uid);
    if (!hit || typeof text !== 'string') return;
    text = text.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 200);
    if (!text) return;
    const t = now();
    if (t - (p.lastWatchChat || 0) < 800) return;
    p.lastWatchChat = t;
    const msg = { id: `${t}-${uid}`, from: p.username, text, at: t };
    hit[1].chat.push(msg);
    if (hit[1].chat.length > 100) hit[1].chat.shift();
    tell(hit[1], 'watch:chat', msg);
  });
  socket.on('watch:react', (e) => {
    const hit = roomOf(uid);
    if (!hit || !['👏', '⚽', '🔥', '😱', '🙌', '📣', '🍿'].includes(e)) return;
    const t = now();
    if (t - (p.lastWatchReact || 0) < 350) return;
    p.lastWatchReact = t;
    tell(hit[1], 'watch:react', { from: p.username, e });
  });
  socket.on('watch:invite', ({ to } = {}, ack) => {
    const hit = roomOf(uid);
    const target = typeof to === 'string' && getUserByUsername(to.replace(/^@/, ''));
    if (!hit || !target || isBlocked(uid, target.id)) return ack?.({ error: 'no' });
    const m = hit[1].match;
    if (online.has(target.id)) emitTo(target.id, 'watch:invited', { from: p.username, matchId: m.id, title: m.title });
    else notify(target.id, [`⚽ @${p.username} anakualika kutazama ${m.title}`, `⚽ @${p.username} invited you to watch ${m.title}`], { tag: 'watch' }).catch(() => {});
    ack?.({ ok: true });
  });
}

/** Buy a snack for yourself or someone in the same watch party. */
export function buySnack(uid, snackId, toName) {
  const s = SNACKS.find((x) => x.id === snackId);
  if (!s) throw new GameError(['Haipo', 'Unknown snack'], 404);
  const hit = roomOf(uid);
  if (!hit) throw new GameError(['Jiunge na watch party kwanza.', 'Join a watch party first.']);
  const me = getUser(uid);
  let to = me;
  if (toName && toName !== me.username) {
    const id = [...hit[1].members].find((m) => online.get(m)?.username === toName);
    if (!id) throw new GameError(['Hayupo kwenye watch party.', "They're not in this watch party."]);
    to = getUser(id);
  }
  addMoney(uid, -s.price, 'spend', `${s.emoji} ${s.name[0]}${to.id !== uid ? ` kwa @${to.username}` : ''} — watch party`);
  saveFields(to.id, { needs: applyNeeds(to.needs, s.effects) });
  tell(hit[1], 'watch:snack', { from: me.username, to: to.username, emoji: s.emoji, name: s.name });
  if (to.id !== uid) emitTo(to.id, 'toast', { text: [`${s.emoji} @${me.username} amekununulia ${s.name[0]}!`, `${s.emoji} @${me.username} bought you ${s.name[1].toLowerCase()}!`], refresh: true });
  return { ok: true };
}
export const watchCounts = () => Object.fromEntries([...rooms].map(([id, r]) => [id, r.members.size]));
