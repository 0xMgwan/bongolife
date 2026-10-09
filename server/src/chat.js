// Private chat: DMs and groups with replies, forwards, reactions, edits, deletes and voice notes.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { db, getUser, GameError, now, UPLOAD_DIR } from './db.js';
import { emitTo } from './presence.js';
import { isBlocked } from './crime.js';

const col = (table, name, def) => {
  if (!db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${def}`);
};
col('messages', 'group_id', 'INTEGER');
col('messages', 'reply_to', 'INTEGER');
col('messages', 'fwd', 'INTEGER NOT NULL DEFAULT 0');
col('messages', 'kind', "TEXT NOT NULL DEFAULT 'text'");
col('messages', 'audio', 'TEXT');
col('messages', 'duration', 'INTEGER');
col('messages', 'edited_at', 'INTEGER');
col('messages', 'deleted_at', 'INTEGER');
db.exec(`
CREATE INDEX IF NOT EXISTS msg_group ON messages(group_id, id DESC);
CREATE TABLE IF NOT EXISTS msg_reactions (
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  PRIMARY KEY (message_id, user_id)
);
CREATE TABLE IF NOT EXISTS chat_groups (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL,
  owner_id INTEGER NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS group_members (
  group_id INTEGER NOT NULL REFERENCES chat_groups(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_read INTEGER NOT NULL DEFAULT 0,
  joined_at INTEGER NOT NULL,
  PRIMARY KEY (group_id, user_id)
);
CREATE INDEX IF NOT EXISTS gm_user ON group_members(user_id);
`);

export const CHAT = { maxText: 500, editWindowMs: 15 * 60_000, maxGroup: 30, maxVoiceSecs: 60, maxVoiceBytes: 1_500_000, reactions: ['❤️', '😂', '😮', '😢', '🙏', '👍', '🔥'] };
export const cleanMsg = (t) => (typeof t === 'string' ? t.replace(/[\u0000-\u0008\u000b-\u001f]/g, ' ').trim().slice(0, CHAT.maxText) : '');

const q = {
  msg: db.prepare('SELECT * FROM messages WHERE id = ?'),
  insert: db.prepare('INSERT INTO messages (from_id, to_id, group_id, body, created_at, reply_to, fwd, kind, audio, duration) VALUES (@from, @to, @group, @body, @t, @reply, @fwd, @kind, @audio, @duration)'),
  reactions: db.prepare('SELECT r.emoji, u.username FROM msg_reactions r JOIN users u ON u.id = r.user_id WHERE r.message_id = ?'),
  member: db.prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?'),
  members: db.prepare('SELECT u.id, u.username, u.name, u.appearance FROM group_members m JOIN users u ON u.id = m.user_id WHERE m.group_id = ? ORDER BY m.joined_at'),
  group: db.prepare('SELECT * FROM chat_groups WHERE id = ?'),
  name: db.prepare('SELECT username FROM users WHERE id = ?'),
};

// ---------------------------------------------------------------- shaping
/** A message as the client sees it (reply preview, reactions, deleted/edited state). */
export function shape(m) {
  if (!m) return null;
  const deleted = !!m.deleted_at;
  let reply = null;
  if (m.reply_to) {
    const r = q.msg.get(m.reply_to);
    if (r) reply = { id: r.id, from: q.name.get(r.from_id)?.username, body: r.deleted_at ? '' : r.kind === 'voice' ? '🎤' : r.body.slice(0, 80), deleted: !!r.deleted_at };
  }
  const rx = {};
  for (const r of q.reactions.all(m.id)) (rx[r.emoji] ||= []).push(r.username);
  return {
    id: m.id, from_id: m.from_id, from: q.name.get(m.from_id)?.username, to_id: m.to_id, group_id: m.group_id,
    body: deleted ? '' : m.body, kind: m.kind || 'text', audio: deleted ? null : m.audio, duration: m.duration,
    created_at: m.created_at, edited_at: m.edited_at, deleted, fwd: !!m.fwd, reply, reactions: rx, read_at: m.read_at,
  };
}

/** Everyone who should see a message (both DM sides, or every group member). */
function audience(m) {
  if (m.group_id) return q.members.all(m.group_id).map((u) => u.id);
  return [m.from_id, m.to_id].filter(Boolean);
}
const fanout = (m, event) => {
  const out = shape(m);
  for (const id of audience(m)) emitTo(id, event, out);
  return out;
};

// ---------------------------------------------------------------- sending
function target({ userId, to, groupId }) {
  if (groupId) {
    const g = q.group.get(Number(groupId));
    if (!g || !q.member.get(g.id, userId)) throw new GameError(['Hauko kwenye kikundi hiki.', "You're not in this group."], 403);
    return { group: g.id, to: null };
  }
  const t = typeof to === 'string' && db.prepare('SELECT id FROM users WHERE username = ?').get(to.replace(/^@/, ''));
  if (!t || t.id === userId) throw new GameError(['Mtumiaji hayupo', 'User not found'], 404);
  if (isBlocked(userId, t.id)) throw new GameError(['Huwezi kumtumia ujumbe.', "You can't message them."], 403);
  return { group: null, to: t.id };
}
function checkMuted(userId) {
  const u = getUser(userId);
  if (u.mutedUntil && u.mutedUntil > now()) throw new GameError(['Umezuiwa kuchat kwa muda.', 'You are muted for now.'], 403, 'muted');
}
function validReply(replyTo, dest) {
  if (!replyTo) return null;
  const r = q.msg.get(Number(replyTo));
  if (!r) return null;
  if (dest.group ? r.group_id !== dest.group : r.group_id) return null;
  return r.id;
}

export function sendMessage(userId, { to, groupId, text, replyTo, fwd }) {
  checkMuted(userId);
  const body = cleanMsg(text);
  if (!body) throw new GameError(['Ujumbe mtupu', 'Empty message']);
  const dest = target({ userId, to, groupId });
  const info = q.insert.run({ from: userId, to: dest.to, group: dest.group, body, t: now(), reply: validReply(replyTo, dest), fwd: fwd ? 1 : 0, kind: 'text', audio: null, duration: null });
  return fanout(q.msg.get(info.lastInsertRowid), dest.group ? 'gm' : 'dm');
}

const AUDIO = [
  { ext: 'webm', test: (b) => b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3 },
  { ext: 'ogg', test: (b) => b.toString('ascii', 0, 4) === 'OggS' },
  { ext: 'm4a', test: (b) => b.toString('ascii', 4, 8) === 'ftyp' },
];
export function sendVoice(userId, { to, groupId, replyTo, duration }, file) {
  checkMuted(userId);
  if (!file?.buffer?.length) throw new GameError(['Hakuna sauti', 'No audio']);
  if (file.buffer.length > CHAT.maxVoiceBytes) throw new GameError(['Sauti ni ndefu mno.', 'Voice note is too long.']);
  const kind = AUDIO.find((a) => a.test(file.buffer));
  if (!kind) throw new GameError(['Aina ya sauti haikubaliki.', 'Unsupported audio format.']);
  const dest = target({ userId, to, groupId });
  const secs = Math.max(1, Math.min(CHAT.maxVoiceSecs, Math.round(Number(duration) || 1)));
  const rel = `voice/${crypto.randomUUID()}.${kind.ext}`;
  fs.mkdirSync(path.join(UPLOAD_DIR, 'voice'), { recursive: true });
  fs.writeFileSync(path.join(UPLOAD_DIR, rel), file.buffer);
  const info = q.insert.run({ from: userId, to: dest.to, group: dest.group, body: '🎤', t: now(), reply: validReply(replyTo, dest), fwd: 0, kind: 'voice', audio: rel, duration: secs });
  return fanout(q.msg.get(info.lastInsertRowid), dest.group ? 'gm' : 'dm');
}

/** Can this user see this message? */
function canSee(userId, m) {
  if (!m) return false;
  if (m.group_id) return !!q.member.get(m.group_id, userId);
  return m.from_id === userId || m.to_id === userId;
}

export function forward(userId, messageId, { to, groupId }) {
  const m = q.msg.get(Number(messageId));
  if (!canSee(userId, m) || m.deleted_at) throw new GameError(['Ujumbe haupo.', 'Message not found.'], 404);
  checkMuted(userId);
  const dest = target({ userId, to, groupId });
  const info = q.insert.run({ from: userId, to: dest.to, group: dest.group, body: m.body, t: now(), reply: null, fwd: 1, kind: m.kind || 'text', audio: m.audio, duration: m.duration });
  return fanout(q.msg.get(info.lastInsertRowid), dest.group ? 'gm' : 'dm');
}

// ---------------------------------------------------------- edit / delete / react
export function react(userId, messageId, emoji) {
  const m = q.msg.get(Number(messageId));
  if (!canSee(userId, m) || m.deleted_at) throw new GameError(['Ujumbe haupo.', 'Message not found.'], 404);
  const had = db.prepare('SELECT emoji FROM msg_reactions WHERE message_id = ? AND user_id = ?').get(m.id, userId);
  if (had?.emoji === emoji || !CHAT.reactions.includes(emoji)) db.prepare('DELETE FROM msg_reactions WHERE message_id = ? AND user_id = ?').run(m.id, userId);
  else db.prepare('INSERT OR REPLACE INTO msg_reactions (message_id, user_id, emoji) VALUES (?, ?, ?)').run(m.id, userId, emoji);
  return fanout(m, 'msg:update');
}
export function edit(userId, messageId, text) {
  const m = q.msg.get(Number(messageId));
  if (!m || m.from_id !== userId || m.deleted_at || m.to_id === null && !m.group_id) throw new GameError(['Huwezi kuhariri ujumbe huu.', "You can't edit this message."], 403);
  if ((m.kind || 'text') !== 'text') throw new GameError(['Ujumbe wa sauti hauhaririwi.', "Voice notes can't be edited."]);
  if (now() - m.created_at > CHAT.editWindowMs) throw new GameError(['Muda wa kuhariri umepita (dk 15).', 'Too late to edit (15 min).']);
  const body = cleanMsg(text);
  if (!body) throw new GameError(['Ujumbe mtupu', 'Empty message']);
  db.prepare('UPDATE messages SET body = ?, edited_at = ? WHERE id = ?').run(body, now(), m.id);
  return fanout(q.msg.get(m.id), 'msg:update');
}
export function remove(userId, messageId) {
  const m = q.msg.get(Number(messageId));
  if (!m || m.from_id !== userId || (m.to_id === null && !m.group_id)) throw new GameError(['Huwezi kufuta ujumbe huu.', "You can't delete this message."], 403);
  db.prepare('UPDATE messages SET deleted_at = ?, body = ? WHERE id = ?').run(now(), '', m.id);
  db.prepare('DELETE FROM msg_reactions WHERE message_id = ?').run(m.id);
  if (m.audio) fs.rm(path.join(UPLOAD_DIR, m.audio), () => {});
  return fanout(q.msg.get(m.id), 'msg:update');
}

// ------------------------------------------------------------------ reading
export function dmHistory(userId, otherId) {
  const rows = db.prepare(
    'SELECT * FROM messages WHERE group_id IS NULL AND ((from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?)) ORDER BY id DESC LIMIT 100',
  ).all(userId, otherId, otherId, userId);
  db.prepare('UPDATE messages SET read_at = ? WHERE from_id = ? AND to_id = ? AND read_at IS NULL').run(now(), otherId, userId);
  return rows.reverse().map(shape);
}
const preview = (m) => (m.deleted_at ? '🚫' : m.kind === 'voice' ? '🎤 Voice' : m.body);
export { preview as messagePreview };

// ------------------------------------------------------------------- groups
export function createGroup(userId, { name, emoji, members }) {
  name = cleanMsg(name).slice(0, 40);
  if (name.length < 2) throw new GameError(['Ipe kikundi jina.', 'Give the group a name.']);
  emoji = typeof emoji === 'string' && emoji.trim() && emoji.length <= 8 ? emoji.trim() : '👥';
  const names = [...new Set((Array.isArray(members) ? members : []).map((m) => String(m).replace(/^@/, '').trim()).filter(Boolean))].slice(0, CHAT.maxGroup - 1);
  const ids = names.map((n) => db.prepare('SELECT id FROM users WHERE username = ?').get(n)?.id).filter((id) => id && id !== userId && !isBlocked(userId, id));
  if (!ids.length) throw new GameError(['Ongeza angalau mtu mmoja.', 'Add at least one person.']);
  const t = now();
  const id = db.transaction(() => {
    const g = db.prepare('INSERT INTO chat_groups (name, emoji, owner_id, created_at) VALUES (?, ?, ?, ?)').run(name, emoji, userId, t).lastInsertRowid;
    const add = db.prepare('INSERT OR IGNORE INTO group_members (group_id, user_id, joined_at) VALUES (?, ?, ?)');
    for (const uid of [userId, ...ids]) add.run(g, uid, t);
    db.prepare("INSERT INTO messages (from_id, group_id, body, created_at, kind) VALUES (?, ?, ?, ?, 'system')").run(userId, g, `::created`, t);
    return g;
  })();
  for (const uid of ids) emitTo(uid, 'group:new', { id, name, emoji });
  return id;
}
export function myGroups(userId) {
  return db.prepare(`SELECT g.id, g.name, g.emoji, g.owner_id, m.last_read,
      (SELECT MAX(id) FROM messages WHERE group_id = g.id) last_id,
      (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) size
    FROM chat_groups g JOIN group_members m ON m.group_id = g.id AND m.user_id = ? ORDER BY last_id DESC`).all(userId)
    .map((g) => {
      const last = g.last_id && q.msg.get(g.last_id);
      const unread = db.prepare('SELECT COUNT(*) n FROM messages WHERE group_id = ? AND id > ? AND from_id != ?').get(g.id, g.last_read, userId).n;
      return { id: g.id, name: g.name, emoji: g.emoji, size: g.size, owner: g.owner_id === userId, unread, at: last?.created_at, last: last ? (last.kind === 'system' ? '' : `@${q.name.get(last.from_id)?.username}: ${preview(last)}`) : '' };
    });
}
export function groupView(userId, groupId) {
  const g = q.group.get(Number(groupId));
  if (!g || !q.member.get(g.id, userId)) throw new GameError(['Kikundi hakipo.', 'Group not found.'], 404);
  const rows = db.prepare('SELECT * FROM messages WHERE group_id = ? ORDER BY id DESC LIMIT 100').all(g.id).reverse();
  if (rows.length) db.prepare('UPDATE group_members SET last_read = ? WHERE group_id = ? AND user_id = ?').run(rows[rows.length - 1].id, g.id, userId);
  return {
    group: { id: g.id, name: g.name, emoji: g.emoji, owner: g.owner_id === userId },
    members: q.members.all(g.id).map((u) => ({ ...u, appearance: JSON.parse(u.appearance || 'null') })),
    messages: rows.map(shape),
  };
}
export function addMembers(userId, groupId, names) {
  const g = q.group.get(Number(groupId));
  if (!g || !q.member.get(g.id, userId)) throw new GameError(['Kikundi hakipo.', 'Group not found.'], 404);
  const count = q.members.all(g.id).length;
  const add = db.prepare('INSERT OR IGNORE INTO group_members (group_id, user_id, joined_at) VALUES (?, ?, ?)');
  let n = 0;
  for (const name of (names || []).slice(0, CHAT.maxGroup - count)) {
    const u = db.prepare('SELECT id FROM users WHERE username = ?').get(String(name).replace(/^@/, ''));
    if (u && !isBlocked(userId, u.id) && add.run(g.id, u.id, now()).changes) { n++; emitTo(u.id, 'group:new', { id: g.id, name: g.name, emoji: g.emoji }); }
  }
  return n;
}
export function leaveGroup(userId, groupId) {
  db.prepare('DELETE FROM group_members WHERE group_id = ? AND user_id = ?').run(Number(groupId), userId);
  if (!db.prepare('SELECT 1 FROM group_members WHERE group_id = ?').get(Number(groupId))) db.prepare('DELETE FROM chat_groups WHERE id = ?').run(Number(groupId));
}
