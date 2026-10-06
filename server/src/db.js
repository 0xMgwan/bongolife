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
db.exec(`
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
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
    isAdmin: !!r.is_admin,
    bannedAt: r.banned_at,
    banReason: r.ban_reason,
    mutedUntil: r.muted_until,
    tokenVersion: r.token_version,
    lastSeen: r.last_seen,
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
  const map = { jobXp: 'job_xp', activeVehicle: 'active_vehicle', lastSeen: 'last_seen' };
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
