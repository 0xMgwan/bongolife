import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { GameError, getUser, DATA_DIR } from './db.js';

function loadSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET must be set in production');
  // Dev: persist a random secret so sessions survive restarts.
  const file = path.join(DATA_DIR, '.jwt-secret');
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8');
  const s = crypto.randomBytes(48).toString('hex');
  fs.writeFileSync(file, s, { mode: 0o600 });
  return s;
}
const SECRET = loadSecret();

export const hashPassword = (pw) => bcrypt.hash(pw, 10);
export const checkPassword = (pw, hash) => bcrypt.compare(pw, hash);
export const signToken = (user) => jwt.sign({ sub: user.id, tv: user.tokenVersion || 0 }, SECRET, { expiresIn: '30d' });

export function verifyToken(token) {
  try {
    const { sub, tv } = jwt.verify(token, SECRET);
    const user = getUser(sub);
    // Bumping token_version (force logout / password reset) invalidates old tokens.
    if (!user || (tv || 0) !== (user.tokenVersion || 0) || user.bannedAt) return null;
    return user;
  } catch {
    return null;
  }
}

export function requireAuth(req, _res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  const user = token && verifyToken(token);
  if (!user) return next(new GameError(['Ingia kwanza (login)', 'Please log in first'], 401, 'unauthorized'));
  req.user = user;
  next();
}

export function requireAdmin(req, _res, next) {
  if (!req.user?.isAdmin) return next(new GameError(['Huna ruhusa', "You don't have permission"], 403, 'forbidden'));
  next();
}

// Tiny fixed-window rate limiter, keyed by IP + route bucket.
const buckets = new Map();
export function rateLimit(name, max, windowMs) {
  return (req, _res, next) => {
    const key = `${name}:${req.ip}`;
    const t = Date.now();
    let b = buckets.get(key);
    if (!b || t > b.reset) b = { count: 0, reset: t + windowMs };
    b.count++;
    buckets.set(key, b);
    if (b.count > max) return next(new GameError(['Pole pole! Umejaribu mara nyingi. Subiri kidogo.', 'Slow down! Too many attempts. Please wait a bit.'], 429, 'rate_limited'));
    next();
  };
}
setInterval(() => {
  const t = Date.now();
  for (const [k, b] of buckets) if (t > b.reset) buckets.delete(k);
}, 60_000).unref();

export const USERNAME_RE = /^[a-z0-9_]{3,20}$/i;

export function normalizePhone(raw) {
  if (!raw) return null;
  const d = String(raw).replace(/[^\d+]/g, '');
  let m;
  if ((m = d.match(/^(?:\+?255|0)([67]\d{8})$/))) return '255' + m[1];
  return null;
}
