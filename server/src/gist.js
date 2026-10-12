// Bongo Gist: photos players take in the game, with captions, likes and comments.
import crypto from 'node:crypto';
import { db, getUser, GameError, now } from './db.js';
import { putFile, removeFile } from './storage.js';
import { emitTo } from './presence.js';
import { isBlocked } from './crime.js';

db.exec(`
CREATE TABLE IF NOT EXISTS gist_posts (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  image TEXT NOT NULL,
  caption TEXT,
  place TEXT,
  likes INTEGER NOT NULL DEFAULT 0,
  comments INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS gist_posts_at ON gist_posts(created_at);
CREATE TABLE IF NOT EXISTS gist_likes (post_id INTEGER NOT NULL REFERENCES gist_posts(id) ON DELETE CASCADE, user_id INTEGER NOT NULL, PRIMARY KEY (post_id, user_id));
CREATE TABLE IF NOT EXISTS gist_comments (
  id INTEGER PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES gist_posts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS gist_comments_p ON gist_comments(post_id, id);
`);

const clean = (s, n) => (typeof s === 'string' ? s.replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n) : '');
const isJpeg = (b) => b[0] === 0xff && b[1] === 0xd8;
const isPng = (b) => b.toString('ascii', 1, 4) === 'PNG';
const imageUrl = (ref) => (/^https:\/\//.test(ref) ? ref : `/uploads/${ref}`);
const lastPost = new Map();

export async function createPost(userId, file, { caption, place }) {
  if (!file?.buffer?.length) throw new GameError(['Hakuna picha.', 'No photo.']);
  const ext = isJpeg(file.buffer) ? 'jpg' : isPng(file.buffer) ? 'png' : null;
  if (!ext) throw new GameError(['Picha si sahihi.', 'Invalid image.']);
  if (now() - (lastPost.get(userId) || 0) < 30_000) throw new GameError(['Subiri kidogo kabla ya kupost tena.', 'Wait a moment before posting again.'], 429);
  lastPost.set(userId, now());
  const ref = await putFile(`gist/${crypto.randomUUID()}.${ext}`, file.buffer);
  return db.prepare('INSERT INTO gist_posts (user_id, image, caption, place, created_at) VALUES (?, ?, ?, ?, ?)').run(userId, ref, clean(caption, 200) || null, clean(place, 40) || null, now()).lastInsertRowid;
}

export function feed(viewerId, { before = null, user = null } = {}) {
  const rows = db.prepare(`SELECT p.*, u.username, u.name, u.appearance FROM gist_posts p JOIN users u ON u.id = p.user_id
      WHERE u.banned_at IS NULL ${before ? 'AND p.id < ?' : ''} ${user ? 'AND u.username = ?' : ''} ORDER BY p.id DESC LIMIT 20`).all(...[before, user].filter((v) => v !== null));
  const liked = new Set(db.prepare(`SELECT post_id FROM gist_likes WHERE user_id = ? AND post_id IN (${rows.map(() => '?').join(',') || 'NULL'})`).all(viewerId, ...rows.map((r) => r.id)).map((r) => r.post_id));
  return rows.filter((r) => !isBlocked(viewerId, r.user_id)).map((r) => ({
    id: r.id, image: imageUrl(r.image), caption: r.caption, place: r.place, likes: r.likes, comments: r.comments, at: r.created_at,
    username: r.username, name: r.name, appearance: r.appearance ? JSON.parse(r.appearance) : null, liked: liked.has(r.id), mine: r.user_id === viewerId,
  }));
}

export function like(userId, postId) {
  const p = db.prepare('SELECT * FROM gist_posts WHERE id = ?').get(Number(postId));
  if (!p) throw new GameError(['Post haipo.', 'Post not found.'], 404);
  const had = db.prepare('DELETE FROM gist_likes WHERE post_id = ? AND user_id = ?').run(p.id, userId).changes;
  if (!had) db.prepare('INSERT INTO gist_likes (post_id, user_id) VALUES (?, ?)').run(p.id, userId);
  db.prepare('UPDATE gist_posts SET likes = (SELECT COUNT(*) FROM gist_likes WHERE post_id = ?) WHERE id = ?').run(p.id, p.id);
  if (!had && p.user_id !== userId) emitTo(p.user_id, 'toast', { text: [`❤️ @${getUser(userId).username} amependa picha yako kwenye Gist`, `❤️ @${getUser(userId).username} liked your Gist photo`], push: true, pushTag: 'gist' });
  return { liked: !had, likes: db.prepare('SELECT likes FROM gist_posts WHERE id = ?').get(p.id).likes };
}

export function comments(postId) {
  return db.prepare('SELECT c.id, c.text, c.created_at at, u.username FROM gist_comments c JOIN users u ON u.id = c.user_id WHERE c.post_id = ? ORDER BY c.id LIMIT 200').all(Number(postId));
}
export function comment(userId, postId, text) {
  const p = db.prepare('SELECT * FROM gist_posts WHERE id = ?').get(Number(postId));
  if (!p) throw new GameError(['Post haipo.', 'Post not found.'], 404);
  if (isBlocked(userId, p.user_id)) throw new GameError(['Huwezi kutoa maoni hapa.', "You can't comment here."], 403);
  text = clean(text, 300);
  if (!text) throw new GameError(['Andika kitu.', 'Write something.']);
  db.prepare('INSERT INTO gist_comments (post_id, user_id, text, created_at) VALUES (?, ?, ?, ?)').run(p.id, userId, text, now());
  db.prepare('UPDATE gist_posts SET comments = comments + 1 WHERE id = ?').run(p.id);
  if (p.user_id !== userId) emitTo(p.user_id, 'toast', { text: [`💬 @${getUser(userId).username}: ${text.slice(0, 80)}`, `💬 @${getUser(userId).username}: ${text.slice(0, 80)}`], push: true, pushTag: 'gist' });
  return comments(p.id);
}
export function removePost(userId, postId, isAdmin = false) {
  const p = db.prepare('SELECT * FROM gist_posts WHERE id = ?').get(Number(postId));
  if (!p) return;
  if (p.user_id !== userId && !isAdmin) throw new GameError(['Huna ruhusa.', "You can't do that."], 403);
  db.prepare('DELETE FROM gist_posts WHERE id = ?').run(p.id);
  removeFile(p.image);
}
