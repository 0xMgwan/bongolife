import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { GAME, NEEDS } from '../../shared/world.js';

export const DATA_DIR = process.env.DATA_DIR || path.resolve(import.meta.dirname, '../data');
fs.mkdirSync(DATA_DIR, { recursive: true });
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(path.join(UPLOAD_DIR, 'ads'), { recursive: true });

export const db = new Database(path.join(DATA_DIR, 'bongo.db'));
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  created_at INTEGER NOT NULL,
  last_seen INTEGER,
  onboarded INTEGER NOT NULL DEFAULT 0,
  appearance TEXT,
  trait TEXT,
  x REAL NOT NULL DEFAULT -35,
  z REAL NOT NULL DEFAULT -12,
  needs TEXT NOT NULL,
  money INTEGER NOT NULL DEFAULT 0,
  fame INTEGER NOT NULL DEFAULT 0,
  elimu INTEGER NOT NULL DEFAULT 0,
  job_xp TEXT NOT NULL DEFAULT '{}',
  outfits TEXT NOT NULL DEFAULT '[]',
  active_vehicle INTEGER,
  busy TEXT,
  is_admin INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  kind TEXT NOT NULL,
  memo TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS tx_user ON transactions(user_id, id DESC);
CREATE TABLE IF NOT EXISTS vehicles (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  model TEXT NOT NULL,
  color TEXT NOT NULL,
  plate TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS plots (
  id TEXT PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES users(id),
  building TEXT,
  bought_at INTEGER NOT NULL,
  last_collect INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS businesses (
  id TEXT PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES users(id),
  bought_at INTEGER NOT NULL,
  last_collect INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY,
  from_id INTEGER NOT NULL REFERENCES users(id),
  to_id INTEGER REFERENCES users(id),
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  read_at INTEGER
);
CREATE INDEX IF NOT EXISTS msg_pub ON messages(to_id, id DESC);
CREATE INDEX IF NOT EXISTS msg_dm ON messages(from_id, to_id, id DESC);
CREATE TABLE IF NOT EXISTS ads (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  slot_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  image TEXT,
  bg TEXT,
  starts_at INTEGER NOT NULL,
  ends_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'live',
  reports INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ads_slot ON ads(slot_id, ends_at);
CREATE TABLE IF NOT EXISTS ad_reports (
  ad_id INTEGER NOT NULL, user_id INTEGER NOT NULL, PRIMARY KEY (ad_id, user_id)
);
CREATE TABLE IF NOT EXISTS topups (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  provider TEXT NOT NULL,
  provider_ref TEXT,
  method TEXT NOT NULL,
  phone TEXT,
  amount_tzs INTEGER NOT NULL,
  coins INTEGER NOT NULL,
  status TEXT NOT NULL,
  instructions TEXT,
  created_at INTEGER NOT NULL,
  credited_at INTEGER
);
CREATE TABLE IF NOT EXISTS visitors (
  id TEXT PRIMARY KEY, first_seen INTEGER NOT NULL
);
`);

// Additive migrations for databases created by earlier versions.
function addColumn(table, col, def) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!cols.includes(col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
}
addColumn('users', 'banned_at', 'INTEGER');
addColumn('users', 'ban_reason', 'TEXT');
addColumn('users', 'muted_until', 'INTEGER');
addColumn('users', 'token_version', 'INTEGER NOT NULL DEFAULT 0');
addColumn('messages', 'deleted_at', 'INTEGER');
addColumn('users', 'home_seeded', 'INTEGER NOT NULL DEFAULT 0');
addColumn('users', 'car_seeded', 'INTEGER NOT NULL DEFAULT 0');
addColumn('users', 'referred_by', 'INTEGER');
// Real-money payments that aren't wallet top-ups (e.g. billboard ads paid in nTZS).
addColumn('topups', 'purpose', "TEXT NOT NULL DEFAULT 'topup'");
addColumn('topups', 'ref_id', 'INTEGER');
addColumn('ads', 'days', 'INTEGER');
addColumn('ads', 'paid_tzs', 'INTEGER');
// Ambitions & storylines: play counters + chosen life path progress.
addColumn('users', 'stats', 'TEXT');
addColumn('users', 'story', 'TEXT');
db.exec(`
CREATE TABLE IF NOT EXISTS trucks (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bought_at INTEGER NOT NULL,
  last_paid INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS trucks_user ON trucks(user_id);
CREATE TABLE IF NOT EXISTS arrests (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  fine INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS arrests_user ON arrests(user_id);
`);
addColumn('users', 'jail', 'TEXT');
// Players can opt out of "what's new" emails (Settings, or the unsubscribe link in each email).
addColumn('users', 'email_updates', 'INTEGER NOT NULL DEFAULT 1');
addColumn('users', 'name_changed_at', 'INTEGER');
// The starter car changed from a Vitz to a Toyota IST.
db.prepare("UPDATE vehicles SET model = 'ist' WHERE model = 'vitz'").run();
addColumn('users', 'referral_paid', 'INTEGER NOT NULL DEFAULT 0');
addColumn('users', 'health', 'INTEGER NOT NULL DEFAULT 100');
addColumn('users', 'injured_at', 'INTEGER');
db.exec(`
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS yard_blocks (
  user_id INTEGER NOT NULL REFERENCES users(id),
  x INTEGER NOT NULL,
  y INTEGER NOT NULL,
  z INTEGER NOT NULL,
  kind TEXT NOT NULL,
  PRIMARY KEY (user_id, x, y, z)
);
CREATE TABLE IF NOT EXISTS home_items (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  item TEXT NOT NULL,
  x REAL NOT NULL,
  z REAL NOT NULL,
  rot INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS home_user ON home_items(user_id);
CREATE TABLE IF NOT EXISTS contacts (
  user_id INTEGER NOT NULL REFERENCES users(id),
  contact_id INTEGER NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, contact_id)
);
CREATE TABLE IF NOT EXISTS robberies (
  id INTEGER PRIMARY KEY,
  robber_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  victim_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  reported INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS blocks (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, blocked_id)
);
CREATE TABLE IF NOT EXISTS player_reports (
  id INTEGER PRIMARY KEY,
  reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  note TEXT,
  context TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS candidates (
  period INTEGER NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slogan TEXT,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (period, user_id)
);
CREATE TABLE IF NOT EXISTS votes (
  period INTEGER NOT NULL,
  voter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  candidate_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (period, voter_id)
);
CREATE TABLE IF NOT EXISTS mayors (
  period INTEGER PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  votes INTEGER NOT NULL DEFAULT 0,
  message TEXT,
  decided_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS password_resets (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY,
  host_id INTEGER NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  description TEXT,
  place_id TEXT NOT NULL,
  starts_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  cancelled INTEGER NOT NULL DEFAULT 0,
  notified INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS events_time ON events(starts_at);
CREATE TABLE IF NOT EXISTS event_rsvps (
  event_id INTEGER NOT NULL REFERENCES events(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (event_id, user_id)
);
CREATE TABLE IF NOT EXISTS phone_apps (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  icon_url TEXT,
  emoji TEXT,
  color TEXT NOT NULL DEFAULT '#111827',
  badge TEXT,
  sort INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  opens INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS audit (
  id INTEGER PRIMARY KEY,
  admin_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  details TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS users_created ON users(created_at);
CREATE INDEX IF NOT EXISTS tx_kind ON transactions(kind, created_at);
CREATE INDEX IF NOT EXISTS topups_status ON topups(status, created_at);
`);

export const now = () => Date.now();

// Featured partner apps on the in-game phone; seeded once with Guap.
if (!db.prepare('SELECT COUNT(*) n FROM phone_apps').get().n) {
  db.prepare('INSERT INTO phone_apps (name, url, icon_url, color, badge, sort, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run('Guap', 'https://guap.gold/markets', 'https://guap.gold/guap.svg', '#0b0b0b', 'NEW', 0, Date.now());
}

// ------------------------------------------------------------ settings
export const DEFAULT_SETTINGS = {
  maintenance: false,
  signupsEnabled: true,
  topupsEnabled: true,
  chatEnabled: true,
  adsEnabled: true,
  announcement: '',
  announcementEn: '',
  eventOverride: '',
  eventOverrideEn: '',
};
let settingsCache = null;
export function getSettings() {
  if (!settingsCache) {
    settingsCache = { ...DEFAULT_SETTINGS };
    for (const r of db.prepare('SELECT key, value FROM settings').all()) {
      try { settingsCache[r.key] = JSON.parse(r.value); } catch {}
    }
  }
  return settingsCache;
}
export function setSettings(patch) {
  const up = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  db.transaction(() => {
    for (const [k, v] of Object.entries(patch)) if (k in DEFAULT_SETTINGS) up.run(k, JSON.stringify(v));
  })();
  settingsCache = null;
  return getSettings();
}

export function audit(adminId, action, targetType, targetId, details) {
  db.prepare('INSERT INTO audit (admin_id, action, target_type, target_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(adminId, action, targetType || null, targetId == null ? null : String(targetId), details ? JSON.stringify(details) : null, now());
}

export function freshNeeds() {
  return Object.fromEntries(NEEDS.map((n) => [n.id, 80]));
}

const parse = (s, fallback) => {
  try {
    return s ? JSON.parse(s) : fallback;
  } catch {
    return fallback;
  }
};

export function rowToUser(r) {
  if (!r) return null;
  return {
    id: r.id,
    username: r.username,
    name: r.name,
    email: r.email,
    emailUpdates: r.email_updates !== 0,
    nameChangedAt: r.name_changed_at || null,
    phone: r.phone,
    createdAt: r.created_at,
    onboarded: !!r.onboarded,
    appearance: parse(r.appearance, null),
    trait: r.trait,
    x: r.x,
    z: r.z,
    needs: parse(r.needs, freshNeeds()),
    money: r.money,
    fame: r.fame,
    elimu: r.elimu,
    jobXp: parse(r.job_xp, {}),
    outfits: parse(r.outfits, []),
    activeVehicle: r.active_vehicle,
    busy: parse(r.busy, null),
    jail: parse(r.jail, null),
    isAdmin: !!r.is_admin,
    bannedAt: r.banned_at,
    banReason: r.ban_reason,
    mutedUntil: r.muted_until,
    tokenVersion: r.token_version,
    lastSeen: r.last_seen,
    homeSeeded: !!r.home_seeded,
    carSeeded: r.car_seeded || 0,
    health: r.health ?? 100,
    injuredAt: r.injured_at,
    stats: parse(r.stats, {}),
    story: parse(r.story, null),
  };
}

const q = {
  byId: db.prepare('SELECT * FROM users WHERE id = ?'),
  byUsername: db.prepare('SELECT * FROM users WHERE username = ?'),
  setMoney: db.prepare('UPDATE users SET money = ? WHERE id = ?'),
  insertTx: db.prepare('INSERT INTO transactions (user_id, amount, balance_after, kind, memo, created_at) VALUES (?, ?, ?, ?, ?, ?)'),
};

export const getUser = (id) => rowToUser(q.byId.get(id));
export const getUserByUsername = (u) => rowToUser(q.byUsername.get(u));

/** message may be a string or a [swahili, english] pair. */
export class GameError extends Error {
  constructor(message, status = 400, code) {
    const [sw, en] = Array.isArray(message) ? message : [message, message];
    super(sw);
    this.en = en;
    this.status = status;
    this.code = code;
  }
}

/** Atomically adjust a balance. Must be called inside db.transaction for multi-step ops. */
export function addMoney(userId, delta, kind, memo) {
  const row = q.byId.get(userId);
  if (!row) throw new GameError(['Mtumiaji hayupo', 'User not found'], 404);
  const next = row.money + Math.round(delta);
  if (next < 0) throw new GameError(['Hela haitoshi, mwanangu. Chakarika kwanza au ongeza salio.', 'Not enough money. Hustle first or top up your wallet.'], 402, 'insufficient_funds');
  q.setMoney.run(next, userId);
  q.insertTx.run(userId, Math.round(delta), next, kind, memo || null, now());
  return next;
}

export function saveFields(userId, fields) {
  const cols = Object.keys(fields);
  if (!cols.length) return;
  const map = { jobXp: 'job_xp', activeVehicle: 'active_vehicle', lastSeen: 'last_seen', homeSeeded: 'home_seeded', carSeeded: 'car_seeded', injuredAt: 'injured_at' };
  const sql = `UPDATE users SET ${cols.map((c) => `${map[c] || c} = @${c}`).join(', ')} WHERE id = @id`;
  const params = { id: userId };
  for (const c of cols) {
    const v = fields[c];
    params[c] = v !== null && typeof v === 'object' ? JSON.stringify(v) : typeof v === 'boolean' ? Number(v) : v;
  }
  db.prepare(sql).run(params);
}

export function createUser({ username, name, passwordHash, email, phone, isAdmin }) {
  const t = now();
  const info = db
    .prepare(
      `INSERT INTO users (username, name, password_hash, email, phone, created_at, last_seen, needs, money, is_admin)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    )
    .run(username, name, passwordHash, email || null, phone || null, t, t, JSON.stringify(freshNeeds()), isAdmin ? 1 : 0);
  addMoney(info.lastInsertRowid, GAME.startMoney, 'gift', 'Karibu Bongo! Zawadi ya kuanzia 🎁');
  return getUser(info.lastInsertRowid);
}
