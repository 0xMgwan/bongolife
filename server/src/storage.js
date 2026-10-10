// File storage for big uploads (music). Cloudflare R2 when configured, otherwise the server's disk.
//   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET — an R2 API token with Object Read & Write
//   R2_PUBLIC_URL — the bucket's public URL (r2.dev subdomain or a custom domain like https://media.bongolife.app)
// Stored references are either a full https URL (R2) or a path under UPLOAD_DIR (disk), so old files keep working.
import fs from 'node:fs';
import path from 'node:path';
import { AwsClient } from 'aws4fetch';
import { UPLOAD_DIR } from './db.js';

const env = (k) => process.env[k] || '';
export const r2Enabled = () => !!(env('R2_ACCOUNT_ID') && env('R2_ACCESS_KEY_ID') && env('R2_SECRET_ACCESS_KEY') && env('R2_BUCKET') && env('R2_PUBLIC_URL'));

let client = null;
const r2 = () => (client ||= new AwsClient({ accessKeyId: env('R2_ACCESS_KEY_ID'), secretAccessKey: env('R2_SECRET_ACCESS_KEY'), service: 's3', region: 'auto' }));
const endpoint = (key) => `https://${env('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com/${env('R2_BUCKET')}/${key.split('/').map(encodeURIComponent).join('/')}`;
const publicUrl = (key) => `${env('R2_PUBLIC_URL').replace(/\/$/, '')}/${key}`;
const isRemote = (ref) => /^https:\/\//.test(ref || '');

const TYPES = { mp3: 'audio/mpeg', m4a: 'audio/mp4', ogg: 'audio/ogg' };

/** Save a file; returns the reference to store in the database. */
export async function putFile(key, buffer) {
  if (!r2Enabled()) {
    fs.mkdirSync(path.dirname(path.join(UPLOAD_DIR, key)), { recursive: true });
    fs.writeFileSync(path.join(UPLOAD_DIR, key), buffer);
    return key;
  }
  const ext = key.split('.').pop();
  const res = await r2().fetch(endpoint(key), {
    method: 'PUT',
    body: buffer,
    headers: { 'content-type': TYPES[ext] || 'application/octet-stream', 'cache-control': 'public, max-age=31536000, immutable' },
  });
  if (!res.ok) throw new Error(`R2 upload failed (${res.status}): ${(await res.text().catch(() => '')).slice(0, 200)}`);
  return publicUrl(key);
}

/** Delete a stored file (best effort). */
export async function removeFile(ref) {
  if (!ref) return;
  if (!isRemote(ref)) return void fs.rm(path.join(UPLOAD_DIR, ref), () => {});
  const base = env('R2_PUBLIC_URL').replace(/\/$/, '');
  if (!r2Enabled() || !ref.startsWith(base + '/')) return;
  await r2().fetch(endpoint(ref.slice(base.length + 1)), { method: 'DELETE' }).catch(() => {});
}

/** Move a file that's on the server's disk into R2; returns the new reference (or the old one if R2 is off). */
export async function moveToR2(ref) {
  if (!r2Enabled() || isRemote(ref)) return ref;
  const file = path.join(UPLOAD_DIR, ref);
  if (!fs.existsSync(file)) return ref;
  const url = await putFile(ref, fs.readFileSync(file));
  fs.rm(file, () => {});
  return url;
}

/** How much the disk-stored music takes, for the admin panel. */
export function diskUsage(dir = 'music') {
  const root = path.join(UPLOAD_DIR, dir);
  if (!fs.existsSync(root)) return { files: 0, bytes: 0 };
  let files = 0;
  let bytes = 0;
  for (const f of fs.readdirSync(root)) {
    const st = fs.statSync(path.join(root, f));
    if (st.isFile()) { files++; bytes += st.size; }
  }
  return { files, bytes };
}
