// Real music: admins upload licensed tracks and tag the venues where they play.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { db, GameError, now, UPLOAD_DIR } from './db.js';
import { MUSIC_VENUES } from '../../shared/world.js';

db.exec(`
CREATE TABLE IF NOT EXISTS music_tracks (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  file TEXT NOT NULL,
  venues TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  plays INTEGER NOT NULL DEFAULT 0,
  rights TEXT,
  uploaded_by INTEGER,
  created_at INTEGER NOT NULL
);
`);

const VENUE_IDS = new Set(MUSIC_VENUES.map((v) => v.id));
const AUDIO = [
  { ext: 'mp3', test: (b) => b.toString('ascii', 0, 3) === 'ID3' || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) },
  { ext: 'm4a', test: (b) => b.toString('ascii', 4, 8) === 'ftyp' },
  { ext: 'ogg', test: (b) => b.toString('ascii', 0, 4) === 'OggS' },
];
const clean = (s, n) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, n) : '');
const venuesOf = (v) => [...new Set((Array.isArray(v) ? v : String(v || '').split(',')).map((x) => x.trim()).filter((x) => VENUE_IDS.has(x)))];

export function tracksFor(venue) {
  return db.prepare('SELECT id, title, artist, file FROM music_tracks WHERE active = 1 AND (\',\' || venues || \',\') LIKE ? ORDER BY id').all(`%,${venue},%`);
}
export function countPlay(id) {
  db.prepare('UPDATE music_tracks SET plays = plays + 1 WHERE id = ?').run(Number(id));
}

export function listTracks() {
  return db.prepare('SELECT * FROM music_tracks ORDER BY id DESC').all().map((t) => ({ ...t, venues: t.venues.split(',').filter(Boolean) }));
}
export function addTrack(adminId, { title, artist, venues, rights }, file) {
  if (!file?.buffer?.length) throw new GameError('Choose an audio file');
  const kind = AUDIO.find((a) => a.test(file.buffer));
  if (!kind) throw new GameError('Audio must be MP3, M4A or OGG');
  title = clean(title, 80);
  artist = clean(artist, 80);
  if (!title || !artist) throw new GameError('Title and artist are required');
  const v = venuesOf(venues);
  if (!v.length) throw new GameError('Pick at least one venue');
  rights = clean(rights, 200);
  if (!rights) throw new GameError('Confirm the rights / licence for this track');
  const rel = `music/${crypto.randomUUID()}.${kind.ext}`;
  fs.mkdirSync(path.join(UPLOAD_DIR, 'music'), { recursive: true });
  fs.writeFileSync(path.join(UPLOAD_DIR, rel), file.buffer);
  return db.prepare('INSERT INTO music_tracks (title, artist, file, venues, rights, uploaded_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(title, artist, rel, v.join(','), rights, adminId, now()).lastInsertRowid;
}
export function updateTrack(id, { active, venues }) {
  const t = db.prepare('SELECT * FROM music_tracks WHERE id = ?').get(Number(id));
  if (!t) throw new GameError('Track not found', 404);
  if (active != null) db.prepare('UPDATE music_tracks SET active = ? WHERE id = ?').run(active ? 1 : 0, t.id);
  if (venues != null) {
    const v = venuesOf(venues);
    if (!v.length) throw new GameError('Pick at least one venue');
    db.prepare('UPDATE music_tracks SET venues = ? WHERE id = ?').run(v.join(','), t.id);
  }
}
export function deleteTrack(id) {
  const t = db.prepare('SELECT * FROM music_tracks WHERE id = ?').get(Number(id));
  if (!t) return;
  db.prepare('DELETE FROM music_tracks WHERE id = ?').run(t.id);
  fs.rm(path.join(UPLOAD_DIR, t.file), () => {});
}
