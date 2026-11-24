// Weekly mayor elections, one per city: stand where you are (fee + slogan), vote once a week at
// the polling station of the city you're in (you can change it), and last week's winner of each
// city becomes its Mkuu wa Mkoa with a salary, guards and a message to the city.
import { ELECTION, CITIES, cityAt, cityById, electionPeriod, electionEnds } from '../../shared/world.js';
import { db, getUser, addMoney, GameError, now } from './db.js';
import { bumpStats } from './story.js';
import { grantGuards } from './guards.js';
import { online } from './presence.js';

const DAY = 86_400_000;
for (const sql of [
  "ALTER TABLE candidates ADD COLUMN city TEXT NOT NULL DEFAULT 'dar'",
  "ALTER TABLE votes ADD COLUMN city TEXT NOT NULL DEFAULT 'dar'",
  'ALTER TABLE votes ADD COLUMN ip TEXT',
  'ALTER TABLE votes ADD COLUMN voided INTEGER NOT NULL DEFAULT 0',
  'ALTER TABLE users ADD COLUMN signup_ip TEXT',
  'ALTER TABLE users ADD COLUMN last_ip TEXT',
]) try { db.exec(sql); } catch { /* already there */ }
// Mayors per (week, city). The old single-city table carries over as Dar.
db.exec(`CREATE TABLE IF NOT EXISTS city_mayors (
  period INTEGER NOT NULL, city TEXT NOT NULL, user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  votes INTEGER NOT NULL DEFAULT 0, message TEXT, decided_at INTEGER NOT NULL, unseated INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (period, city)
);
INSERT OR IGNORE INTO city_mayors (period, city, user_id, votes, message, decided_at)
  SELECT period, 'dar', user_id, votes, message, decided_at FROM mayors;`);

const shiftsOf = (u) => Object.values(u.jobXp || {}).reduce((a, b) => a + b, 0);
const parse = (r) => (r ? { ...r, appearance: JSON.parse(r.appearance || 'null') } : null);
const salaryOf = (city) => ELECTION.citySalary?.[city] ?? ELECTION.salary;
/** The city a player is standing in right now (live position if online). */
export function cityOf(uid) {
  const p = online.get(uid);
  const u = p ? null : getUser(uid);
  return cityAt(p?.x ?? u?.x ?? 0, p?.z ?? u?.z ?? 0)?.id || 'dar';
}

// Votes that count: not voided, and neither voter nor candidate is banned.
const TALLY = `FROM votes v
  JOIN candidates c ON c.period = v.period AND c.user_id = v.candidate_id
  JOIN users u ON u.id = v.candidate_id AND u.banned_at IS NULL
  JOIN users vu ON vu.id = v.voter_id AND vu.banned_at IS NULL
  WHERE v.voided = 0`;

/** Decide last week's elections that haven't been yet. Returns the new mayors. */
export const settleElection = db.transaction(() => {
  const prev = electionPeriod() - 1;
  const won = [];
  for (const city of CITIES) {
    if (db.prepare('SELECT 1 FROM city_mayors WHERE period = ? AND city = ?').get(prev, city.id)) continue;
    const w = db.prepare(`SELECT v.candidate_id id, COUNT(*) n, MIN(c.created_at) first ${TALLY}
      AND v.period = ? AND c.city = ? GROUP BY v.candidate_id ORDER BY n DESC, first ASC LIMIT 1`).get(prev, city.id);
    db.prepare('INSERT INTO city_mayors (period, city, user_id, votes, decided_at) VALUES (?, ?, ?, ?, ?)').run(prev, city.id, w?.id ?? null, w?.n ?? 0, now());
    if (!w) continue;
    addMoney(w.id, salaryOf(city.id), 'bonus', `Mshahara wa Mkuu wa Mkoa wa ${city.name} 🏛️`);
    grantGuards(w.id, ELECTION.perks.guard, electionEnds(prev + 1)); // VIP protection for the whole term
    won.push({ id: w.id, votes: w.n, username: getUser(w.id).username, city: city.id, cityName: city.name });
  }
  return won;
});

/** The sitting mayor of a city. */
export function currentMayor(city = 'dar') {
  // A week nobody won keeps the previous mayor in office; an unseated one leaves it empty.
  const r = db.prepare(`SELECT m.period, m.city, m.votes, m.message, u.id, u.username, u.name, u.appearance FROM city_mayors m
    LEFT JOIN users u ON u.id = m.user_id AND u.banned_at IS NULL
    WHERE m.city = ? AND (m.user_id IS NOT NULL OR m.unseated = 1) ORDER BY m.period DESC LIMIT 1`).get(city);
  return r?.id ? parse(r) : null;
}
/** Every city's sitting mayor, keyed by city id. */
export const allMayors = () => Object.fromEntries(CITIES.map((c) => [c.id, currentMayor(c.id)]).filter(([, m]) => m));
/** Which city this player is mayor of right now, if any. */
export const mayorCityOf = (uid) => Object.entries(allMayors()).find(([, m]) => m.id === uid)?.[0] || null;
export const isMayor = (uid) => !!mayorCityOf(uid);

/** Why this player can't vote (null = they can). */
function voteBlock(u) {
  if (shiftsOf(u) < ELECTION.minShifts) return [`Fanya kazi angalau shifti ${ELECTION.minShifts} ndipo upige kura.`, `Work at least ${ELECTION.minShifts} shifts to vote.`];
  const days = (now() - u.createdAt) / DAY;
  if (days < ELECTION.minAccountDays) return [`Akaunti mpya: unaweza kupiga kura baada ya siku ${ELECTION.minAccountDays}.`, `New account: you can vote once it's ${ELECTION.minAccountDays} days old.`];
  return null;
}

export function electionState(userId, cityId) {
  const period = electionPeriod();
  const here = cityOf(userId);
  const city = cityById[cityId] ? cityId : here;
  const candidates = db.prepare(`SELECT u.id, u.username, u.name, u.appearance, c.slogan,
      (SELECT COUNT(*) FROM votes v JOIN users vu ON vu.id = v.voter_id AND vu.banned_at IS NULL
        WHERE v.period = c.period AND v.candidate_id = c.user_id AND v.voided = 0) votes
    FROM candidates c JOIN users u ON u.id = c.user_id AND u.banned_at IS NULL
    WHERE c.period = ? AND c.city = ? ORDER BY votes DESC, c.created_at ASC`).all(period, city).map(parse);
  const me = userId && getUser(userId);
  const mine = userId && db.prepare('SELECT candidate_id, city FROM votes WHERE period = ? AND voter_id = ? AND voided = 0').get(period, userId);
  const running = userId && db.prepare('SELECT city FROM candidates WHERE period = ? AND user_id = ?').get(period, userId);
  const block = me && voteBlock(me);
  return {
    period,
    city,
    here,
    endsAt: electionEnds(period),
    mayor: currentMayor(city),
    mayors: Object.fromEntries(Object.entries(allMayors()).map(([k, m]) => [k, { username: m.username, appearance: m.appearance }])),
    salary: salaryOf(city),
    candidates,
    myVote: mine?.candidate_id || null,
    myVoteCity: mine?.city || null,
    myRace: running?.city || null,
    iAmCandidate: !!candidates.find((c) => c.id === userId),
    canVote: !!me && !block && city === here,
    voteBlock: block,
    canRun: !!me && shiftsOf(me) >= ELECTION.candidateShifts && !running && city === here,
    rules: ELECTION,
  };
}

export const runForMayor = db.transaction((userId, slogan) => {
  const u = getUser(userId);
  if (shiftsOf(u) < ELECTION.candidateShifts) throw new GameError([`Fanya kazi angalau shifti ${ELECTION.candidateShifts} kwanza ndipo ugombee.`, `Work at least ${ELECTION.candidateShifts} shifts before you can run.`]);
  const period = electionPeriod();
  if (db.prepare('SELECT 1 FROM candidates WHERE period = ? AND user_id = ?').get(period, userId)) throw new GameError(['Tayari unagombea wiki hii.', "You're already running this week."]);
  const city = cityOf(userId);
  addMoney(userId, -ELECTION.fee, 'spend', `Ada ya kugombea Ukuu wa Mkoa wa ${cityById[city].name}`);
  db.prepare('INSERT INTO candidates (period, user_id, slogan, created_at, city) VALUES (?, ?, ?, ?, ?)').run(period, userId, slogan || null, now(), city);
  bumpStats(userId, ['ran']);
  return city;
});

export const vote = db.transaction((userId, candidateId, ip) => {
  const u = getUser(userId);
  const block = voteBlock(u);
  if (block) throw new GameError(block);
  const period = electionPeriod();
  const c = db.prepare('SELECT city FROM candidates WHERE period = ? AND user_id = ?').get(period, candidateId);
  if (!c) throw new GameError(['Mgombea huyo hayupo.', 'That candidate is not running.'], 404);
  if (candidateId === userId) throw new GameError(['Huwezi kujipigia kura mwenyewe 😅', "You can't vote for yourself 😅"]);
  const here = cityOf(userId);
  if (c.city !== here) throw new GameError([`Kura hupigwa kituoni: nenda ${cityById[c.city].name} kumpigia kura.`, `Votes are cast at the polling station: travel to ${cityById[c.city].name} to vote for them.`]);
  if (ip) {
    const same = db.prepare('SELECT COUNT(*) n FROM votes WHERE period = ? AND candidate_id = ? AND ip = ? AND voter_id != ? AND voided = 0').get(period, candidateId, ip, userId).n;
    if (same >= ELECTION.maxVotesPerIp) throw new GameError(['Kura nyingi sana kutoka mtandao huu kwa mgombea huyu.', 'Too many votes for this candidate from the same network.'], 429);
  }
  db.prepare('INSERT OR REPLACE INTO votes (period, voter_id, candidate_id, created_at, city, ip, voided) VALUES (?, ?, ?, ?, ?, ?, 0)').run(period, userId, candidateId, now(), c.city, ip || null);
});

export function setMayorMessage(userId, text) {
  const city = mayorCityOf(userId);
  if (!city) throw new GameError(['Ni Mkuu wa Mkoa tu anayeweza.', 'Only a Mayor can do that.'], 403);
  db.prepare('UPDATE city_mayors SET message = ? WHERE period = ? AND city = ?').run(text || null, currentMayor(city).period, city);
}

// ------------------------------------------------------------ admin: election audit
/**
 * Every vote of a week with the signals that give a vote farm away: young accounts, few
 * shifts, invited by the candidate, shared signup/vote networks.
 */
export function auditElection(period) {
  const rows = db.prepare(`SELECT v.voter_id, v.candidate_id, v.city, v.ip, v.created_at voted_at, v.voided,
      vu.username voter, vu.created_at joined, vu.job_xp, vu.referred_by, vu.signup_ip, vu.banned_at, cu.username candidate
    FROM votes v JOIN users vu ON vu.id = v.voter_id JOIN users cu ON cu.id = v.candidate_id
    WHERE v.period = ? ORDER BY v.candidate_id, v.created_at`).all(period);
  const byCand = new Map();
  for (const r of rows) {
    const shifts = Object.values(JSON.parse(r.job_xp || '{}')).reduce((a, b) => a + b, 0);
    const ageAtVote = (r.voted_at - r.joined) / DAY;
    const flags = [];
    if (r.referred_by === r.candidate_id) flags.push('invited by candidate');
    if (ageAtVote < ELECTION.minAccountDays) flags.push(`account ${ageAtVote.toFixed(1)}d old`);
    if (shifts < ELECTION.minShifts) flags.push(`${shifts} shifts`);
    const c = byCand.get(r.candidate_id) || { id: r.candidate_id, username: r.candidate, city: r.city, voters: [], counted: 0 };
    c.voters.push({ id: r.voter_id, username: r.voter, joined: r.joined, votedAt: r.voted_at, shifts, ip: r.ip, signupIp: r.signup_ip, banned: !!r.banned_at, voided: !!r.voided, flags });
    if (!r.voided && !r.banned_at) c.counted++;
    byCand.set(r.candidate_id, c);
  }
  // Shared networks: how many of a candidate's voters came from each IP.
  for (const c of byCand.values()) {
    const n = {};
    for (const v of c.voters) for (const ip of new Set([v.ip, v.signupIp].filter(Boolean))) n[ip] = (n[ip] || 0) + 1;
    for (const v of c.voters) {
      const shared = Math.max(0, ...[v.ip, v.signupIp].filter(Boolean).map((ip) => n[ip] - 1));
      if (shared > 0) v.flags.push(`network shared with ${shared}`);
    }
    c.suspicious = c.voters.filter((v) => v.flags.length).length;
  }
  const mayors = db.prepare('SELECT m.city, m.votes, u.username FROM city_mayors m LEFT JOIN users u ON u.id = m.user_id WHERE m.period = ?').all(period);
  return { period, current: electionPeriod(), mayors, candidates: [...byCand.values()].sort((a, b) => b.voters.length - a.voters.length) };
}
/** Strike (or restore) votes. A week that's already been decided keeps its mayor. */
export const voidVotes = db.transaction((period, voterIds, voided = true) => {
  const st = db.prepare('UPDATE votes SET voided = ? WHERE period = ? AND voter_id = ?');
  let n = 0;
  for (const id of voterIds) n += st.run(voided ? 1 : 0, period, id).changes;
  return n;
});
/** Remove a sitting mayor (e.g. won with farmed votes). Salary isn't clawed back here. */
export function unseat(period, city) {
  return db.prepare('UPDATE city_mayors SET user_id = NULL, message = NULL, unseated = 1 WHERE period = ? AND city = ?').run(period, city).changes;
}
