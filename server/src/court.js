// Kisutu Court: real cases with statements (text + voice), a judge (a player both sides trust, or the
// standard magistrate "Mheshimiwa Hakimu"), and a verdict that moves money and freedom.
import { db, getUser, saveFields, addMoney, GameError, now } from './db.js';
import { CRIME } from '../../shared/world.js';
import { online, emitTo } from './presence.js';
import { storeVoice } from './chat.js';
import { bumpStats } from './story.js';

export const COURT = { hearingMs: 5 * 60_000, judgeGraceMs: 10 * 60_000, maxStatements: 12, textMax: 500, judgeReward: 20_000 };

db.exec(`
CREATE TABLE IF NOT EXISTS court_cases (
  id INTEGER PRIMARY KEY,
  defendant_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plaintiff_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  robbery_id INTEGER,
  reason TEXT NOT NULL,
  fine INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'hearing',
  judge_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  judge_status TEXT NOT NULL DEFAULT 'none',
  judge_proposed_by INTEGER,
  opened_at INTEGER NOT NULL,
  hearing_ends_at INTEGER NOT NULL,
  verdict TEXT,
  verdict_reason TEXT,
  decided_by TEXT,
  decided_at INTEGER
);
CREATE INDEX IF NOT EXISTS cases_def ON court_cases(defendant_id);
CREATE INDEX IF NOT EXISTS cases_pla ON court_cases(plaintiff_id);
CREATE TABLE IF NOT EXISTS case_statements (
  id INTEGER PRIMARY KEY,
  case_id INTEGER NOT NULL REFERENCES court_cases(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  kind TEXT NOT NULL,
  body TEXT,
  audio TEXT,
  duration INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS stmts_case ON case_statements(case_id, id);
`);

const q = {
  case: db.prepare('SELECT * FROM court_cases WHERE id = ?'),
  stmts: db.prepare('SELECT s.*, u.username FROM case_statements s JOIN users u ON u.id = s.user_id WHERE s.case_id = ? ORDER BY s.id'),
  name: db.prepare('SELECT username FROM users WHERE id = ?'),
};
const nameOf = (id) => (id ? q.name.get(id)?.username || null : null);

function roleOf(c, userId) {
  if (userId === c.defendant_id) return 'defendant';
  if (userId === c.plaintiff_id) return 'plaintiff';
  if (userId === c.judge_id && c.judge_status === 'accepted') return 'judge';
  if (userId === c.judge_id && c.judge_status === 'invited') return 'invited';
  return null;
}
const parties = (c) => [c.defendant_id, c.plaintiff_id, c.judge_status === 'accepted' || c.judge_status === 'invited' ? c.judge_id : null].filter(Boolean);
const ping = (c, extra = {}) => { for (const id of parties(c)) emitTo(id, 'court:update', { caseId: c.id, ...extra }); };

// ------------------------------------------------------------------- opening
/** Called when an arrested player goes to court (with a lawyer). Returns the case id. */
export function openCase(defendantId, jail) {
  const robbery = db.prepare('SELECT * FROM robberies WHERE robber_id = ? AND reported = 1 ORDER BY id DESC LIMIT 1').get(defendantId);
  const recent = robbery && now() - robbery.created_at < 2 * 3600_000 ? robbery : null;
  const t = now();
  const id = db.prepare('INSERT INTO court_cases (defendant_id, plaintiff_id, robbery_id, reason, fine, opened_at, hearing_ends_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(defendantId, recent?.victim_id || null, recent?.id || null, JSON.stringify(jail.reason), jail.fine, t, t + COURT.hearingMs).lastInsertRowid;
  const def = nameOf(defendantId);
  if (recent) {
    emitTo(recent.victim_id, 'court:update', { caseId: id, opened: true });
    emitTo(recent.victim_id, 'toast', { text: [`⚖️ Kesi ya @${def} imefunguliwa Kisutu — toa ushahidi wako (dk 5).`, `⚖️ @${def}'s case is open at Kisutu — give your side (5 min).`] });
  }
  return id;
}

// --------------------------------------------------------------------- views
export function caseView(userId, caseId) {
  const c = q.case.get(Number(caseId));
  if (!c) throw new GameError(['Kesi haipo.', 'Case not found.'], 404);
  const role = roleOf(c, userId);
  return {
    id: c.id, role, status: c.status, reason: JSON.parse(c.reason), fine: c.fine,
    defendant: nameOf(c.defendant_id), plaintiff: nameOf(c.plaintiff_id),
    judge: { kind: c.judge_status === 'accepted' ? 'player' : 'hakimu', status: c.judge_status, username: nameOf(c.judge_id), proposedBy: nameOf(c.judge_proposed_by) },
    openedAt: c.opened_at, hearingEndsAt: c.hearing_ends_at,
    judgeDeadline: c.judge_status === 'accepted' ? c.hearing_ends_at + COURT.judgeGraceMs : null,
    verdict: c.verdict, verdictReason: c.verdict_reason ? JSON.parse(c.verdict_reason) : null, decidedBy: c.decided_by,
    // Anyone can watch a hearing (it's a public court); only parties and the judge speak.
    statements: q.stmts.all(c.id).map((s) => ({ id: s.id, username: s.username, role: s.role, kind: s.kind, body: s.body, audio: s.audio, duration: s.duration, created_at: s.created_at })),
  };
}
export function myCases(userId) {
  return db.prepare(`SELECT id FROM court_cases WHERE defendant_id = ? OR plaintiff_id = ? OR (judge_id = ? AND judge_status IN ('invited','accepted')) ORDER BY id DESC LIMIT 15`)
    .all(userId, userId, userId).map((r) => caseView(userId, r.id));
}

// ---------------------------------------------------------------- statements
function speakable(userId, caseId) {
  const c = q.case.get(Number(caseId));
  if (!c) throw new GameError(['Kesi haipo.', 'Case not found.'], 404);
  if (c.status !== 'hearing') throw new GameError(['Kesi imeshaamuliwa.', 'The case has been decided.']);
  const role = roleOf(c, userId);
  if (!role || role === 'invited') throw new GameError(['Ni wahusika na jaji tu wanaozungumza.', 'Only the parties and the judge can speak.'], 403);
  if (role !== 'judge' && now() > c.hearing_ends_at) throw new GameError(['Muda wa kusikiliza umeisha.', 'The hearing time is over.']);
  const n = db.prepare('SELECT COUNT(*) n FROM case_statements WHERE case_id = ? AND user_id = ?').get(c.id, userId).n;
  if (n >= COURT.maxStatements) throw new GameError(['Umeshatoa maelezo ya kutosha.', "You've said enough — let the court decide."]);
  return { c, role };
}
const insertStmt = db.prepare('INSERT INTO case_statements (case_id, user_id, role, kind, body, audio, duration, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
export function addText(userId, caseId, text) {
  const { c, role } = speakable(userId, caseId);
  const body = typeof text === 'string' ? text.replace(/\s+/g, ' ').trim().slice(0, COURT.textMax) : '';
  if (!body) throw new GameError(['Andika maelezo.', 'Write your statement.']);
  insertStmt.run(c.id, userId, role, 'text', body, null, null, now());
  ping(c);
}
export function addVoice(userId, caseId, file, duration) {
  const { c, role } = speakable(userId, caseId);
  const { rel, secs } = storeVoice(file, duration);
  insertStmt.run(c.id, userId, role, 'voice', null, rel, secs, now());
  ping(c);
}

// --------------------------------------------------------------------- judge
/** A party proposes a player as judge. With a plaintiff, the other side must agree first. */
export function proposeJudge(userId, caseId, username) {
  const c = q.case.get(Number(caseId));
  if (!c || c.status !== 'hearing') throw new GameError(['Kesi haipo.', 'Case not found.'], 404);
  const role = roleOf(c, userId);
  if (role !== 'defendant' && role !== 'plaintiff') throw new GameError(['Ni wahusika tu.', 'Only the parties can do that.'], 403);
  if (c.judge_status === 'accepted') throw new GameError(['Jaji ameshapatikana.', 'A judge is already sitting.']);
  const j = db.prepare('SELECT id, username FROM users WHERE username = ?').get(String(username || '').replace(/^@/, ''));
  if (!j) throw new GameError(['Mtumiaji hayupo.', 'User not found.'], 404);
  if (j.id === c.defendant_id || j.id === c.plaintiff_id) throw new GameError(['Mhusika hawezi kuwa jaji.', "A party can't be the judge."]);
  if (!online.has(j.id)) throw new GameError([`@${j.username} hayuko mtandaoni.`, `@${j.username} isn't online.`]);
  const needsOther = !!c.plaintiff_id;
  db.prepare('UPDATE court_cases SET judge_id = ?, judge_proposed_by = ?, judge_status = ? WHERE id = ?').run(j.id, userId, needsOther ? 'proposed' : 'invited', c.id);
  const fresh = q.case.get(c.id);
  if (needsOther) {
    const other = role === 'defendant' ? c.plaintiff_id : c.defendant_id;
    emitTo(other, 'toast', { text: [`⚖️ @${nameOf(userId)} amependekeza @${j.username} awe jaji — kubali au kataa.`, `⚖️ @${nameOf(userId)} proposed @${j.username} as judge — accept or decline.`] });
  } else inviteJudge(fresh);
  ping(fresh);
}
function inviteJudge(c) {
  emitTo(c.judge_id, 'court:invite', { caseId: c.id, defendant: nameOf(c.defendant_id), plaintiff: nameOf(c.plaintiff_id) });
}
/** The other party answers a judge proposal. */
export function answerProposal(userId, caseId, accept) {
  const c = q.case.get(Number(caseId));
  if (!c || c.judge_status !== 'proposed') throw new GameError(['Hakuna pendekezo.', 'No pending proposal.']);
  const role = roleOf(c, userId);
  if ((role !== 'defendant' && role !== 'plaintiff') || userId === c.judge_proposed_by) throw new GameError(['Si zamu yako.', "It's not your call."], 403);
  if (!accept) db.prepare("UPDATE court_cases SET judge_id = NULL, judge_proposed_by = NULL, judge_status = 'none' WHERE id = ?").run(c.id);
  else { db.prepare("UPDATE court_cases SET judge_status = 'invited' WHERE id = ?").run(c.id); inviteJudge(q.case.get(c.id)); }
  ping(q.case.get(c.id));
}
/** The invited player accepts or declines sitting as judge. */
export function answerJudgeInvite(userId, caseId, accept) {
  const c = q.case.get(Number(caseId));
  if (!c || c.judge_status !== 'invited' || c.judge_id !== userId) throw new GameError(['Mwaliko umeisha.', 'That invite has expired.']);
  if (accept) {
    db.prepare("UPDATE court_cases SET judge_status = 'accepted' WHERE id = ?").run(c.id);
    // Give the defendant's countdown room for the judge to rule.
    const d = getUser(c.defendant_id);
    if (d.jail?.caseId === c.id) saveFields(d.id, { jail: { ...d.jail, courtAt: c.hearing_ends_at + COURT.judgeGraceMs } });
  } else db.prepare("UPDATE court_cases SET judge_id = NULL, judge_proposed_by = NULL, judge_status = 'none' WHERE id = ?").run(c.id);
  const fresh = q.case.get(c.id);
  for (const id of [c.defendant_id, c.plaintiff_id].filter(Boolean)) emitTo(id, 'toast', { text: accept ? [`⚖️ @${nameOf(userId)} amekubali kuwa jaji.`, `⚖️ @${nameOf(userId)} agreed to judge your case.`] : [`@${nameOf(userId)} amekataa kuwa jaji — Hakimu ataamua.`, `@${nameOf(userId)} declined — the magistrate will decide.`] });
  ping(fresh);
}
/** The sitting player judge rules. */
export function judgeRules(userId, caseId, verdict, reason) {
  const c = q.case.get(Number(caseId));
  if (!c || c.status !== 'hearing') throw new GameError(['Kesi haipo.', 'Case not found.'], 404);
  if (roleOf(c, userId) !== 'judge') throw new GameError(['Wewe si jaji wa kesi hii.', "You're not this case's judge."], 403);
  if (!['guilty', 'not_guilty'].includes(verdict)) throw new GameError(['Chagua hukumu.', 'Pick a verdict.']);
  const r = typeof reason === 'string' ? reason.replace(/\s+/g, ' ').trim().slice(0, 300) : '';
  applyVerdict(c, verdict, r ? [r, r] : verdict === 'guilty' ? ['Jaji ameridhika kuwa kosa lilitendeka.', 'The judge is satisfied the offence happened.'] : ['Jaji hakuridhika na ushahidi.', 'The judge was not convinced by the evidence.'], `@${nameOf(userId)}`);
  addMoney(userId, COURT.judgeReward, 'gift', `⚖️ Ujira wa jaji — kesi #${c.id}`);
  saveFields(userId, { fame: getUser(userId).fame + 1 });
  bumpStats(userId, ['judged']);
}

// ------------------------------------------------------------------- verdict
function applyVerdict(c, verdict, reason, by) {
  db.prepare("UPDATE court_cases SET status = 'decided', verdict = ?, verdict_reason = ?, decided_by = ?, decided_at = ? WHERE id = ? AND status = 'hearing'")
    .run(verdict, JSON.stringify(reason), by, now(), c.id);
  const d = getUser(c.defendant_id);
  const inThisCase = d.jail?.caseId === c.id;
  if (verdict === 'guilty') {
    const paid = Math.min(Math.max(0, d.money), c.fine);
    if (paid > 0) addMoney(d.id, -paid, 'fine', `⚖️ Faini ya mahakama — kesi #${c.id}`);
    if (c.plaintiff_id && paid > 0) addMoney(c.plaintiff_id, Math.floor(paid / 2), 'refund', `⚖️ Fidia — kesi #${c.id}`);
    if (inThisCase) saveFields(d.id, { jail: { ...d.jail, phase: 'cell', until: now() + CRIME.cellMs / 2, verdict: 'lose' } });
  } else if (inThisCase) saveFields(d.id, { jail: null });
  const text = verdict === 'guilty'
    ? [`⚖️ Kesi #${c.id}: @${d.username} ana HATIA. ${reason[0]}`, `⚖️ Case #${c.id}: @${d.username} is GUILTY. ${reason[1]}`]
    : [`⚖️ Kesi #${c.id}: @${d.username} HANA HATIA. ${reason[0]}`, `⚖️ Case #${c.id}: @${d.username} is NOT GUILTY. ${reason[1]}`];
  for (const id of parties(c)) { emitTo(id, 'court:verdict', { caseId: c.id, verdict, text }); emitTo(id, 'toast', { text, refresh: true }); }
}

/**
 * The standard magistrate: weighs what actually happened — the police record, the defendant's history,
 * the plaintiff's credibility, and who turned up to argue — then rules and names the deciding factor.
 */
function hakimuRules(c, stmts) {
  const DAY = 86_400_000;
  const robbery = c.robbery_id && db.prepare('SELECT amount, created_at FROM robberies WHERE id = ?').get(c.robbery_id);
  const priors = Math.max(0, db.prepare('SELECT COUNT(*) n FROM arrests WHERE user_id = ?').get(c.defendant_id).n - 1);
  const robsWeek = db.prepare('SELECT COUNT(*) n FROM robberies WHERE robber_id = ? AND created_at > ?').get(c.defendant_id, now() - 7 * DAY).n;
  const reports = getUser(c.defendant_id)?.stats?.police_reports || 0;
  const plaintiffPriors = c.plaintiff_id ? db.prepare('SELECT COUNT(*) n FROM arrests WHERE user_id = ?').get(c.plaintiff_id).n : 0;
  // Voice notes carry a little more weight than a typed line.
  const weight = (id) => stmts.filter((x) => x.user_id === id).reduce((w, x) => w + (x.kind === 'voice' ? 1.5 : 1), 0);
  const prosecution = c.plaintiff_id ? weight(c.plaintiff_id) : 1.5; // the state always says something
  const defence = weight(c.defendant_id);
  const factors = [
    ['evidence', robbery ? 1.4 + Math.min(0.6, robbery.amount / 200_000) : 0.4, ['Ripoti ya polisi na kukamatwa vinathibitisha tukio.', 'The police report and the arrest establish what happened.']],
    ['record', Math.min(1.2, priors * 0.3), ['Mshtakiwa ana rekodi ya makosa ya awali.', 'The defendant has a record of previous offences.']],
    ['pattern', Math.min(1, Math.max(0, robsWeek - 1) * 0.35), ['Wizi umejirudia wiki hii.', 'There is a pattern of robberies this week.']],
    ['reports', Math.min(0.8, reports * 0.15), ['Polisi wana ripoti kadhaa dhidi ya mshtakiwa.', 'The police hold several reports against the defendant.']],
    ['arguments', Math.max(-1, Math.min(1, (prosecution - defence) * 0.25)), prosecution >= defence ? ['Mlalamikaji alieleza kesi yake vizuri zaidi.', 'The plaintiff made the stronger case in court.'] : ['Utetezi ulijieleza vizuri zaidi.', 'The defence argued its side better.']],
    ['credibility', -Math.min(0.9, plaintiffPriors * 0.3), ['Mlalamikaji naye ana rekodi — ushahidi wake una mashaka.', "The plaintiff's own record weakens their account."]],
    ['lawyer', -0.5, ['Wakili wa utetezi aliibua mashaka.', 'The defence lawyer raised reasonable doubt.']],
  ];
  const score = factors.reduce((t, f) => t + f[1], 0) - 1.1 + (Math.random() - 0.5) * 0.6;
  const guilty = score > 0;
  // The reason is the factor that pushed hardest in the verdict's direction.
  const top = [...factors].sort((a, b) => (guilty ? b[1] - a[1] : a[1] - b[1]))[0];
  const reason = guilty ? top[2] : top[1] < 0 ? top[2] : ['Upande wa mashtaka haukuthibitisha kosa bila shaka.', "The prosecution didn't prove it beyond doubt."];
  return { verdict: guilty ? 'guilty' : 'not_guilty', reason };
}

const deciding = new Set();
/** Decide a case whose hearing is over (player judge first, then the magistrate). Safe to call repeatedly. */
export async function settle(caseId) {
  const c = q.case.get(Number(caseId));
  if (!c || c.status !== 'hearing' || now() < c.hearing_ends_at) return c;
  // A sitting player judge gets a grace period to rule before the magistrate steps in.
  if (c.judge_status === 'accepted' && now() < c.hearing_ends_at + COURT.judgeGraceMs) return c;
  if (deciding.has(c.id)) return c;
  deciding.add(c.id);
  try {
    const stmts = q.stmts.all(c.id);
    const ruling = hakimuRules(c, stmts);
    applyVerdict(c, ruling.verdict, ruling.reason, 'hakimu');
  } finally {
    deciding.delete(c.id);
  }
  return q.case.get(c.id);
}

/** Sweep overdue hearings so verdicts land even when nobody is watching. */
setInterval(() => {
  const due = db.prepare("SELECT id FROM court_cases WHERE status = 'hearing' AND hearing_ends_at < ?").all(now());
  for (const r of due) settle(r.id).catch(() => {});
}, 20_000).unref();
