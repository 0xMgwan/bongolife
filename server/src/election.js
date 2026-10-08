// Weekly mayor elections: stand (fee + slogan), vote once per week (you can change it),
// last week's winner becomes Mkuu wa Mkoa with a salary and a city-wide message.
import { ELECTION, electionPeriod, electionEnds } from '../../shared/world.js';
import { db, getUser, addMoney, GameError, now } from './db.js';
import { bumpStats } from './story.js';

const shiftsOf = (u) => Object.values(u.jobXp || {}).reduce((a, b) => a + b, 0);
const parse = (r) => (r ? { ...r, appearance: JSON.parse(r.appearance || 'null') } : null);

/** Decide last week's election if it hasn't been yet. Returns the new mayor row (or null). */
export const settleElection = db.transaction(() => {
  const prev = electionPeriod() - 1;
  if (db.prepare('SELECT 1 FROM mayors WHERE period = ?').get(prev)) return null;
  const w = db.prepare(`SELECT v.candidate_id id, COUNT(*) n, MIN(c.created_at) first FROM votes v
      JOIN candidates c ON c.period = v.period AND c.user_id = v.candidate_id
      JOIN users u ON u.id = v.candidate_id AND u.banned_at IS NULL
    WHERE v.period = ? GROUP BY v.candidate_id ORDER BY n DESC, first ASC LIMIT 1`).get(prev);
  db.prepare('INSERT INTO mayors (period, user_id, votes, decided_at) VALUES (?, ?, ?, ?)').run(prev, w?.id ?? null, w?.n ?? 0, now());
  if (!w) return null;
  addMoney(w.id, ELECTION.salary, 'bonus', 'Mshahara wa Mkuu wa Mkoa 🏛️');
  return { id: w.id, votes: w.n, username: getUser(w.id).username };
});

export function currentMayor() {
  return parse(db.prepare(`SELECT m.period, m.votes, m.message, u.id, u.username, u.name, u.appearance FROM mayors m
    JOIN users u ON u.id = m.user_id AND u.banned_at IS NULL WHERE m.user_id IS NOT NULL ORDER BY m.period DESC LIMIT 1`).get());
}

export function electionState(userId) {
  const period = electionPeriod();
  const candidates = db.prepare(`SELECT u.id, u.username, u.name, u.appearance, c.slogan,
      (SELECT COUNT(*) FROM votes v WHERE v.period = c.period AND v.candidate_id = c.user_id) votes
    FROM candidates c JOIN users u ON u.id = c.user_id AND u.banned_at IS NULL
    WHERE c.period = ? ORDER BY votes DESC, c.created_at ASC`).all(period).map(parse);
  const me = userId && getUser(userId);
  const myVote = userId && db.prepare('SELECT candidate_id FROM votes WHERE period = ? AND voter_id = ?').get(period, userId)?.candidate_id;
  return {
    period,
    endsAt: electionEnds(period),
    mayor: currentMayor(),
    candidates,
    myVote: myVote || null,
    iAmCandidate: !!candidates.find((c) => c.id === userId),
    canVote: !!me && shiftsOf(me) >= ELECTION.minShifts,
    canRun: !!me && shiftsOf(me) >= ELECTION.candidateShifts,
    rules: ELECTION,
  };
}

export const runForMayor = db.transaction((userId, slogan) => {
  const u = getUser(userId);
  if (shiftsOf(u) < ELECTION.candidateShifts) throw new GameError([`Fanya kazi angalau shifti ${ELECTION.candidateShifts} kwanza ndipo ugombee.`, `Work at least ${ELECTION.candidateShifts} shifts before you can run.`]);
  const period = electionPeriod();
  if (db.prepare('SELECT 1 FROM candidates WHERE period = ? AND user_id = ?').get(period, userId)) throw new GameError(['Tayari unagombea wiki hii.', "You're already running this week."]);
  addMoney(userId, -ELECTION.fee, 'spend', 'Ada ya kugombea Ukuu wa Mkoa');
  db.prepare('INSERT INTO candidates (period, user_id, slogan, created_at) VALUES (?, ?, ?, ?)').run(period, userId, slogan || null, now());
  bumpStats(userId, ['ran']);
});

export const vote = db.transaction((userId, candidateId) => {
  const u = getUser(userId);
  if (shiftsOf(u) < ELECTION.minShifts) throw new GameError(['Fanya kazi angalau shifti moja ndipo upige kura.', 'Finish at least one work shift to vote.']);
  const period = electionPeriod();
  if (!db.prepare('SELECT 1 FROM candidates WHERE period = ? AND user_id = ?').get(period, candidateId)) throw new GameError(['Mgombea huyo hayupo.', 'That candidate is not running.'], 404);
  db.prepare('INSERT OR REPLACE INTO votes (period, voter_id, candidate_id, created_at) VALUES (?, ?, ?, ?)').run(period, userId, candidateId, now());
});

export function setMayorMessage(userId, text) {
  const m = currentMayor();
  if (!m || m.id !== userId) throw new GameError(['Ni Mkuu wa Mkoa tu anayeweza.', 'Only the Mayor can do that.'], 403);
  db.prepare('UPDATE mayors SET message = ? WHERE period = ?').run(text || null, m.period);
}
