// Players hiring players: company owners post jobs ("Tunaajiri!"), players apply, owners hire,
// and staff work timed shifts paid from the company account. Active player staff also raise
// the company's capacity (see company.js).
import { db, getUser, addMoney, GameError, now } from './db.js';
import { industryById, HIRING } from '../../shared/world.js';
import { emitTo, broadcast, online } from './presence.js';
import { isBlocked } from './crime.js';

db.exec(`
CREATE TABLE IF NOT EXISTS job_posts (
  id INTEGER PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  wage INTEGER NOT NULL,
  slots INTEGER NOT NULL,
  note TEXT,
  open INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  announced_at INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS job_posts_open ON job_posts(open, created_at);
CREATE TABLE IF NOT EXISTS job_apps (
  id INTEGER PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES job_posts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL,
  UNIQUE(post_id, user_id)
);
CREATE TABLE IF NOT EXISTS company_staff (
  id INTEGER PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  wage INTEGER NOT NULL,
  shifts INTEGER NOT NULL DEFAULT 0,
  last_shift INTEGER NOT NULL DEFAULT 0,
  hired_at INTEGER NOT NULL,
  UNIQUE(company_id, user_id)
);
CREATE INDEX IF NOT EXISTS company_staff_user ON company_staff(user_id);
`);

const clean = (s, n) => (typeof s === 'string' ? s.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n) : '');
const q = {
  company: db.prepare('SELECT * FROM companies WHERE id = ?'),
  post: db.prepare('SELECT * FROM job_posts WHERE id = ?'),
  openPosts: db.prepare('SELECT COUNT(*) n FROM job_posts WHERE company_id = ? AND open = 1'),
  filled: db.prepare('SELECT COUNT(*) n FROM job_apps WHERE post_id = ? AND status = ?'),
  staffOf: db.prepare('SELECT s.*, u.username, u.name, u.appearance FROM company_staff s JOIN users u ON u.id = s.user_id WHERE s.company_id = ? ORDER BY s.hired_at'),
  staffRow: db.prepare('SELECT * FROM company_staff WHERE id = ?'),
  employers: db.prepare(`SELECT s.*, c.name company, c.logo, c.color, c.industry, c.balance, u.username owner
      FROM company_staff s JOIN companies c ON c.id = s.company_id JOIN users u ON u.id = c.owner_id WHERE s.user_id = ? ORDER BY s.hired_at`),
  isStaff: db.prepare('SELECT id FROM company_staff WHERE company_id = ? AND user_id = ?'),
  apps: db.prepare(`SELECT a.*, u.username, u.name, u.fame, u.elimu, u.appearance FROM job_apps a JOIN users u ON u.id = a.user_id
      WHERE a.post_id = ? AND a.status = 'pending' ORDER BY a.created_at`),
};

function ownCompany(userId, companyId) {
  const c = q.company.get(Number(companyId));
  if (!c || c.owner_id !== userId) throw new GameError(['Kampuni haipo.', 'Company not found.'], 404);
  return c;
}
function ownPost(userId, postId) {
  const p = q.post.get(Number(postId));
  if (!p) throw new GameError(['Tangazo la kazi halipo.', 'Job post not found.'], 404);
  return { post: p, company: ownCompany(userId, p.company_id) };
}
const wageRange = (c) => {
  const ind = industryById[c.industry];
  return [ind.wage, ind.wage * HIRING.maxWageMult];
};

// ------------------------------------------------------------ posting
export const postJob = db.transaction((userId, companyId, { role, wage, slots, note }) => {
  const c = ownCompany(userId, companyId);
  role = clean(role, 30);
  note = clean(note, 140);
  wage = Math.round(Number(wage) / 500) * 500;
  slots = Math.floor(Number(slots));
  const [lo, hi] = wageRange(c);
  if (role.length < 2) throw new GameError(['Andika cheo cha kazi (mf. Mpishi, Dereva).', 'Write a job title (e.g. Cook, Rider).']);
  if (!(wage >= lo && wage <= hi)) throw new GameError([`Mshahara uwe kati ya TSh ${lo.toLocaleString()} na ${hi.toLocaleString()} kwa shifti.`, `Wage must be between TSh ${lo.toLocaleString()} and ${hi.toLocaleString()} per shift.`]);
  if (!(slots >= 1 && slots <= HIRING.maxSlots)) throw new GameError([`Nafasi 1–${HIRING.maxSlots}.`, `1–${HIRING.maxSlots} openings.`]);
  if (q.openPosts.get(c.id).n >= HIRING.maxOpenPosts) throw new GameError(['Una matangazo mengi ya kazi yaliyo wazi. Funga moja kwanza.', 'You have too many open job posts. Close one first.']);
  const id = db.prepare('INSERT INTO job_posts (company_id, role, wage, slots, note, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(c.id, role, wage, slots, note || null, now()).lastInsertRowid;
  announce(userId, id);
  return id;
});

/** "Tunaajiri!" — a street-chat post from the owner plus a banner for everyone online. Once an hour per post. */
export function announce(userId, postId) {
  const { post, company: c } = ownPost(userId, postId);
  if (!post.open) throw new GameError(['Tangazo hili limefungwa.', 'This post is closed.']);
  const wait = post.announced_at + HIRING.announceEveryMs - now();
  if (wait > 0) throw new GameError([`Unaweza kutangaza tena baada ya dakika ${Math.ceil(wait / 60_000)}.`, `You can announce again in ${Math.ceil(wait / 60_000)} min.`], 429);
  db.prepare('UPDATE job_posts SET announced_at = ? WHERE id = ?').run(now(), post.id);
  const owner = getUser(userId);
  const text = `📢 ${c.logo} ${c.name} inaajiri: ${post.role} — TSh ${post.wage.toLocaleString()}/shifti (nafasi ${post.slots}). Omba: Simu → Kazi → Ajira`;
  const t = now();
  const info = db.prepare('INSERT INTO messages (from_id, to_id, body, created_at) VALUES (?, NULL, ?, ?)').run(userId, text, t);
  broadcast('chat', { mid: info.lastInsertRowid, id: userId, username: owner.username, name: owner.name, text, at: t });
  for (const [id] of online) {
    if (id === userId || isBlocked(userId, id)) continue;
    emitTo(id, 'hiring', { postId: post.id, company: c.name, logo: c.logo, color: c.color, role: post.role, wage: post.wage, owner: owner.username });
  }
  return { ok: true };
}

export function closePost(userId, postId) {
  const { post } = ownPost(userId, postId);
  db.prepare('UPDATE job_posts SET open = 0 WHERE id = ?').run(post.id);
  db.prepare("UPDATE job_apps SET status = 'closed' WHERE post_id = ? AND status = 'pending'").run(post.id);
}

// ------------------------------------------------------------ the jobs board
export function board(viewerId) {
  const rows = db.prepare(`SELECT p.*, c.name company, c.logo, c.color, c.industry, c.reputation, c.owner_id, u.username owner
      FROM job_posts p JOIN companies c ON c.id = p.company_id JOIN users u ON u.id = c.owner_id
      WHERE p.open = 1 AND u.banned_at IS NULL ORDER BY p.created_at DESC LIMIT 60`).all();
  const mine = new Map(db.prepare('SELECT post_id, status FROM job_apps WHERE user_id = ?').all(viewerId).map((r) => [r.post_id, r.status]));
  return rows
    .filter((p) => p.owner_id === viewerId || !isBlocked(p.owner_id, viewerId))
    .map((p) => ({
      id: p.id, role: p.role, wage: p.wage, slots: p.slots, note: p.note, created_at: p.created_at,
      company: p.company, logo: p.logo, color: p.color, industry: p.industry, reputation: p.reputation, owner: p.owner,
      hired: q.filled.get(p.id, 'hired').n, mineApp: mine.get(p.id) || null,
      employed: !!q.isStaff.get(p.company_id, viewerId), isMine: p.owner_id === viewerId,
    }));
}

export function apply(userId, postId, note) {
  const p = q.post.get(Number(postId));
  if (!p || !p.open) throw new GameError(['Nafasi hii imeshajazwa au imefungwa.', 'This job is filled or closed.'], 404);
  const c = q.company.get(p.company_id);
  if (c.owner_id === userId) throw new GameError(['Hii ni kampuni yako 😄', "That's your own company 😄"]);
  if (isBlocked(c.owner_id, userId)) throw new GameError(['Huwezi kuomba kazi hapa.', "You can't apply here."], 403);
  if (q.isStaff.get(c.id, userId)) throw new GameError(['Tayari unafanya kazi hapa.', 'You already work here.']);
  if (q.employers.all(userId).length >= HIRING.maxEmployers) throw new GameError([`Unaweza kuajiriwa na kampuni ${HIRING.maxEmployers} tu. Acha moja kwanza.`, `You can work for ${HIRING.maxEmployers} companies at most. Quit one first.`]);
  const me = getUser(userId);
  const r = db.prepare("INSERT INTO job_apps (post_id, user_id, note, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(post_id, user_id) DO UPDATE SET status = 'pending', note = excluded.note, created_at = excluded.created_at WHERE job_apps.status != 'hired'")
    .run(p.id, userId, clean(note, 140) || null, now());
  if (!r.changes) throw new GameError(['Ombi lako lipo tayari.', 'You already applied.']);
  emitTo(c.owner_id, 'toast', {
    text: [`📝 @${me.username} ameomba kazi ya ${p.role} — ${c.name}. Fungua Kampuni.`, `📝 @${me.username} applied to be ${p.role} at ${c.name}. Open Company.`],
    push: true, pushTag: `apps-${c.id}`, pushTitle: [`${c.logo} Ombi jipya la kazi`, `${c.logo} New job application`],
  });
  return { ok: true };
}

export function applicants(ownerId, postId) {
  const { post } = ownPost(ownerId, postId);
  return q.apps.all(post.id).map((a) => ({ id: a.id, username: a.username, name: a.name, fame: a.fame, elimu: a.elimu, note: a.note, created_at: a.created_at }));
}

export const answer = db.transaction((ownerId, appId, accept) => {
  const a = db.prepare('SELECT * FROM job_apps WHERE id = ?').get(Number(appId));
  if (!a || a.status !== 'pending') throw new GameError(['Ombi halipo.', 'Application not found.'], 404);
  const { post, company: c } = ownPost(ownerId, a.post_id);
  if (!accept) {
    db.prepare("UPDATE job_apps SET status = 'rejected' WHERE id = ?").run(a.id);
    emitTo(a.user_id, 'toast', { text: [`${c.logo} ${c.name}: ombi lako la ${post.role} halikufanikiwa safari hii.`, `${c.logo} ${c.name}: your application for ${post.role} wasn't successful this time.`], push: true, pushTag: 'jobs' });
    return { ok: true };
  }
  if (q.filled.get(post.id, 'hired').n >= post.slots) throw new GameError(['Nafasi zimejaa.', 'All openings are filled.']);
  if (q.employers.all(a.user_id).length >= HIRING.maxEmployers) throw new GameError(['Mchezaji huyu tayari ana kazi nyingi.', 'This player already has too many jobs.']);
  db.prepare("UPDATE job_apps SET status = 'hired' WHERE id = ?").run(a.id);
  db.prepare('INSERT OR IGNORE INTO company_staff (company_id, user_id, role, wage, hired_at) VALUES (?, ?, ?, ?, ?)').run(c.id, a.user_id, post.role, post.wage, now());
  if (q.filled.get(post.id, 'hired').n >= post.slots) closePost(ownerId, post.id);
  emitTo(a.user_id, 'toast', {
    text: [`🎉 Umeajiriwa! ${post.role} — ${c.logo} ${c.name}, TSh ${post.wage.toLocaleString()}/shifti. Fungua Kazi → Ajira kuanza shifti.`, `🎉 You're hired! ${post.role} at ${c.logo} ${c.name}, TSh ${post.wage.toLocaleString()}/shift. Open Jobs → Hiring to start a shift.`],
    refresh: true, long: true, push: true, pushTag: 'jobs', pushTitle: ['🎉 Umeajiriwa!', "🎉 You're hired!"],
  });
  return { ok: true };
});

// ------------------------------------------------------------ staff
export function postsOf(companyId) {
  return db.prepare('SELECT * FROM job_posts WHERE company_id = ? AND open = 1 ORDER BY created_at DESC').all(companyId).map((p) => ({
    id: p.id, role: p.role, wage: p.wage, slots: p.slots, note: p.note, created_at: p.created_at, announcedAt: p.announced_at,
    hired: q.filled.get(p.id, 'hired').n, pending: q.filled.get(p.id, 'pending').n,
  }));
}

export function staffOf(companyId) {
  const t = now();
  return q.staffOf.all(companyId).map((s) => ({
    id: s.id, username: s.username, name: s.name, role: s.role, wage: s.wage, shifts: s.shifts,
    lastShift: s.last_shift, active: t - s.last_shift < HIRING.activeMs,
  }));
}
/** Player staff who worked a shift recently count towards a company's capacity. */
export const activeStaffCount = (companyId) => db.prepare('SELECT COUNT(*) n FROM company_staff WHERE company_id = ? AND last_shift > ?').get(companyId, now() - HIRING.activeMs).n;

export function myEmployers(userId) {
  return q.employers.all(userId).map((s) => ({ id: s.id, company: s.company, logo: s.logo, color: s.color, industry: s.industry, owner: s.owner, role: s.role, wage: s.wage, shifts: s.shifts, canPay: s.balance >= s.wage }));
}

export function setWage(ownerId, staffId, wage) {
  const s = q.staffRow.get(Number(staffId));
  if (!s) throw new GameError(['Mfanyakazi hayupo.', 'Staff member not found.'], 404);
  const c = ownCompany(ownerId, s.company_id);
  wage = Math.round(Number(wage) / 500) * 500;
  const [lo, hi] = wageRange(c);
  if (!(wage >= lo && wage <= hi)) throw new GameError([`Mshahara uwe kati ya TSh ${lo.toLocaleString()} na ${hi.toLocaleString()}.`, `Wage must be between TSh ${lo.toLocaleString()} and ${hi.toLocaleString()}.`]);
  db.prepare('UPDATE company_staff SET wage = ? WHERE id = ?').run(wage, s.id);
  emitTo(s.user_id, 'toast', { text: [`${c.logo} ${c.name}: mshahara wako sasa ni TSh ${wage.toLocaleString()}/shifti.`, `${c.logo} ${c.name}: your wage is now TSh ${wage.toLocaleString()}/shift.`], push: true, pushTag: 'jobs' });
}

/** Owner lets someone go, or the employee quits. */
export function endJob(userId, staffId) {
  const s = q.staffRow.get(Number(staffId));
  if (!s) throw new GameError(['Mfanyakazi hayupo.', 'Staff member not found.'], 404);
  const c = q.company.get(s.company_id);
  if (userId !== s.user_id && userId !== c.owner_id) throw new GameError(['Huna ruhusa.', "You can't do that."], 403);
  const busy = getUser(s.user_id).busy;
  if (busy?.kind === 'company' && busy.id === s.id && busy.endsAt > now()) throw new GameError(['Subiri shifti iishe kwanza.', 'Wait for the shift to finish first.']);
  db.prepare('DELETE FROM company_staff WHERE id = ?').run(s.id);
  const who = getUser(s.user_id);
  if (userId === c.owner_id) emitTo(s.user_id, 'toast', { text: [`${c.logo} ${c.name} imekuachisha kazi ya ${s.role}.`, `${c.logo} ${c.name} let you go from ${s.role}.`], refresh: true, push: true, pushTag: 'jobs' });
  else emitTo(c.owner_id, 'toast', { text: [`👋 @${who.username} ameacha kazi ya ${s.role} — ${c.name}.`, `👋 @${who.username} quit as ${s.role} at ${c.name}.`], push: true, pushTag: `apps-${c.id}` });
}

// ------------------------------------------------------------ shifts
/** Checks before a shift; returns what game.startCompanyShift needs. */
export function shiftInfo(userId, staffId) {
  const s = q.staffRow.get(Number(staffId));
  if (!s || s.user_id !== userId) throw new GameError(['Hufanyi kazi hapa.', "You don't work there."], 404);
  const c = q.company.get(s.company_id);
  if (c.balance < s.wage) {
    emitTo(c.owner_id, 'toast', { text: [`⚠️ ${c.name} haina pesa ya kulipa @${getUser(userId).username}. Weka mtaji kwenye kampuni.`, `⚠️ ${c.name} can't pay @${getUser(userId).username}. Deposit money into the company.`], push: true, pushTag: `pay-${c.id}` });
    throw new GameError([`${c.name} haina pesa ya mshahara sasa hivi. Bosi amejulishwa.`, `${c.name} can't pay wages right now. Your boss has been told.`]);
  }
  const ind = industryById[c.industry];
  return { staff: s, company: c, place: HIRING.places[c.industry] || 'posta', emoji: ind.emoji };
}

/** Pay a finished shift from the company account; the company gets the shift's output. */
export function payShift(userId, busy) {
  const s = q.staffRow.get(Number(busy.id));
  if (!s || s.user_id !== userId) return { lines: [['Kazi hii haipo tena.', 'This job no longer exists.']], pay: 0 };
  const c = q.company.get(s.company_id);
  const ind = industryById[c.industry];
  const pay = Math.max(0, Math.min(s.wage, c.balance));
  const output = Math.round(ind.wage * HIRING.outputMult);
  db.prepare('UPDATE companies SET balance = balance - ? + ? WHERE id = ?').run(pay, output, c.id);
  db.prepare('UPDATE company_staff SET shifts = shifts + 1, last_shift = ? WHERE id = ?').run(now(), s.id);
  if (pay) addMoney(userId, pay, 'salary', `${s.role} — ${c.name}`);
  const lines = [[`🏢 ${c.name} · shifti ${s.shifts + 1}`, `🏢 ${c.name} · shift ${s.shifts + 1}`]];
  if (pay < s.wage) lines.push([`⚠️ Kampuni ilikuwa na TSh ${pay.toLocaleString()} tu.`, `⚠️ The company only had TSh ${pay.toLocaleString()}.`]);
  return { pay, lines, company: c, staff: s };
}
