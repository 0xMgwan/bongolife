// Web push: phone/desktop notifications while Bongo Life is closed.
// VAPID keys come from VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY, or are generated once and kept in DATA_DIR
// (next to the database), so push works without any setup. VAPID_SUBJECT defaults to mailto:support@bongolife.app.
// iPhone: only works once the game is added to the Home Screen (iOS 16.4+).
import fs from 'node:fs';
import path from 'node:path';
import webpush from 'web-push';
import { db, now, DATA_DIR } from './db.js';

db.exec(`
CREATE TABLE IF NOT EXISTS push_subs (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS push_subs_user ON push_subs(user_id);
`);
if (!db.prepare('PRAGMA table_info(users)').all().some((c) => c.name === 'lang')) db.exec("ALTER TABLE users ADD COLUMN lang TEXT");

function vapidKeys() {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) return { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
  const file = path.join(DATA_DIR, '.vapid.json');
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch {}
  const keys = webpush.generateVAPIDKeys();
  fs.writeFileSync(file, JSON.stringify(keys), { mode: 0o600 });
  return keys;
}
const KEYS = vapidKeys();
webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:support@bongolife.app', KEYS.publicKey, KEYS.privateKey);
export const pushPublicKey = () => KEYS.publicKey;

const q = {
  add: db.prepare('INSERT INTO push_subs (user_id, endpoint, p256dh, auth, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth'),
  del: db.prepare('DELETE FROM push_subs WHERE endpoint = ?'),
  delMine: db.prepare('DELETE FROM push_subs WHERE endpoint = ? AND user_id = ?'),
  of: db.prepare('SELECT * FROM push_subs WHERE user_id = ?'),
  count: db.prepare('SELECT COUNT(*) n FROM push_subs WHERE user_id = ?'),
  total: db.prepare('SELECT COUNT(*) n, COUNT(DISTINCT user_id) users FROM push_subs'),
  lang: db.prepare('SELECT lang FROM users WHERE id = ?'),
};

export function subscribe(userId, sub) {
  const endpoint = typeof sub?.endpoint === 'string' ? sub.endpoint : '';
  const { p256dh, auth } = sub?.keys || {};
  if (!/^https:\/\//.test(endpoint) || endpoint.length > 1000 || typeof p256dh !== 'string' || typeof auth !== 'string') throw new Error('bad subscription');
  q.add.run(userId, endpoint, p256dh.slice(0, 200), auth.slice(0, 100), now());
  return q.count.get(userId).n;
}
export const unsubscribe = (userId, endpoint) => q.delMine.run(String(endpoint || ''), userId);
export const pushCount = (userId) => q.count.get(userId).n;
export const pushStats = () => q.total.get();

// Don't buzz someone's phone more than once per tag every few seconds (e.g. a burst of DMs).
const recent = new Map();

/**
 * Send a notification to all of a player's devices.
 * text: [sw, en] (or a string); opts: { title, url, tag }.
 */
export async function notify(userId, text, { title = 'Bongo Life', url = '/', tag = 'bongo' } = {}) {
  const subs = q.of.all(userId);
  if (!subs.length) return 0;
  const key = `${userId}:${tag}`;
  if (now() - (recent.get(key) || 0) < 8000) return 0;
  recent.set(key, now());
  const en = q.lang.get(userId)?.lang === 'en';
  const pick = (t) => (Array.isArray(t) ? t[en ? 1 : 0] || t[0] : t);
  const payload = JSON.stringify({ title: pick(title), body: String(pick(text) || '').slice(0, 240), url, tag });
  let sent = 0;
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 6 * 3600, urgency: 'high', topic: tag.replace(/[^a-z0-9_-]/gi, '').slice(0, 32) || undefined });
      sent++;
    } catch (e) {
      // Gone / unsubscribed devices are cleaned up.
      if (e.statusCode === 404 || e.statusCode === 410) q.del.run(s.endpoint);
      else console.error('[push] send failed', e.statusCode || e.message);
    }
  }));
  return sent;
}

/**
 * Turn a live event for an offline player into a push notification (called from presence.emitTo).
 * Returns nothing; unknown events are ignored.
 */
export function pushForEvent(userId, event, data) {
  const n = describe(event, data, userId);
  if (n) notify(userId, n.text, n).catch(() => {});
}

function describe(event, d, userId) {
  switch (event) {
    case 'dm':
      if (d.from_id === userId) return null;
      return { title: `💬 @${d.from}`, text: d.kind === 'voice' ? ['🎤 Voice note', '🎤 Voice note'] : d.body, url: `/?dm=${encodeURIComponent(d.from)}`, tag: `dm-${d.from}` };
    case 'gm':
      if (d.from_id === userId) return null;
      return { title: ['💬 Ujumbe wa kikundi', '💬 Group message'], text: `@${d.from}: ${d.kind === 'voice' ? '🎤' : d.body}`, tag: `gm-${d.group_id}` };
    case 'mention':
      return { title: `📣 @${d.from}`, text: d.text, tag: 'mention' };
    case 'love:ask':
    case 'love:match':
      return { title: '💞 Penzi', text: [`@${d.from || d.with} anakutaka! Fungua Penzi.`, `@${d.from || d.with} is interested in you! Open Penzi.`], tag: 'love' };
    case 'love:answer':
      return { title: '💞 Penzi', text: d.text || [`@${d.by} amejibu.`, `@${d.by} replied.`], tag: 'love' };
    case 'court:invite':
      return { title: ['⚖️ Mahakama', '⚖️ Court'], text: [`Umeombwa kuwa hakimu kesi ya @${d.defendant}.`, `You've been asked to judge @${d.defendant}'s case.`], tag: 'court' };
    case 'court:verdict':
      return { title: ['⚖️ Hukumu', '⚖️ Verdict'], text: d.text, tag: 'court' };
    case 'robbed':
      return { title: ['🚨 Umeibiwa!', '🚨 You were robbed!'], text: [`@${d.by} amekuibia TSh ${Number(d.amount || 0).toLocaleString()}. Ripoti Polisi.`, `@${d.by} robbed you of TSh ${Number(d.amount || 0).toLocaleString()}. Report it to the police.`], tag: 'crime' };
    case 'toast':
      // Only toasts that matter later (money in, sales, hiring, invitations) — not UI chatter.
      if (!d.push || !d.text) return null;
      return { title: d.pushTitle || 'Bongo Life', text: d.text, tag: d.pushTag || 'news' };
    default:
      return null;
  }
}
