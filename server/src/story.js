// Ambitions (life paths with story chapters) and street dilemmas.
import { db, getUser, saveFields, addMoney, GameError, now } from './db.js';
import { AMBITIONS, ambitionById, STORY, DILEMMAS, dilemmaById, NEEDS } from '../../shared/world.js';
import { emitTo } from './presence.js';

// --------------------------------------------------------------- counters
/** Count something the player did (place visits, shifts, trips…) and nudge them if a chapter is now complete. */
export function bumpStats(userId, keys) {
  const u = getUser(userId);
  if (!u) return;
  const stats = { ...(u.stats || {}) };
  for (const k of keys) if (k) stats[k] = (stats[k] || 0) + 1;
  saveFields(userId, { stats });
  notifyIfReady(userId);
}

const friendsOf = db.prepare('SELECT COUNT(*) n FROM contacts x JOIN contacts y ON y.user_id = x.contact_id AND y.contact_id = x.user_id WHERE x.user_id = ?');
const plotsOf = db.prepare('SELECT COUNT(*) n, SUM(building IS NOT NULL) built FROM plots WHERE owner_id = ?');
const bizOf = db.prepare('SELECT COUNT(*) n FROM businesses WHERE owner_id = ?');
const trucksOf = db.prepare('SELECT COUNT(*) n FROM trucks WHERE user_id = ?');
const companiesOf = (id) => { try { return db.prepare('SELECT COUNT(*) n FROM companies WHERE owner_id = ?').get(id).n; } catch { return 0; } };

let worthFn = () => 0;
let mayorFn = () => null;
/** game.js / election.js register these to avoid an import cycle. */
export function wireStory({ netWorth, currentMayor }) {
  if (netWorth) worthFn = netWorth;
  if (currentMayor) mayorFn = currentMayor;
}

/** How far the player is towards a goal: { have, need }. */
export function progressOf(u, goal) {
  if (goal.stat) return { have: u.stats?.[goal.stat] || 0, need: goal.n || 1 };
  if (goal.fame != null) return { have: u.fame || 0, need: goal.fame };
  if (goal.money != null) return { have: u.money, need: goal.money };
  if (goal.worth != null) return { have: worthFn(u.id), need: goal.worth };
  if (goal.friends != null) return { have: friendsOf.get(u.id).n, need: goal.friends };
  if (goal.plots != null) return { have: plotsOf.get(u.id).n, need: goal.plots };
  if (goal.house != null) return { have: plotsOf.get(u.id).built || 0, need: goal.house };
  if (goal.assets != null) return { have: bizOf.get(u.id).n + trucksOf.get(u.id).n + companiesOf(u.id), need: goal.assets };
  if (goal.mayor != null) return { have: mayorFn()?.username === u.username ? 1 : 0, need: 1 };
  return { have: 0, need: 1 };
}

const storyOf = (u) => u.story || { amb: null, steps: {}, switchedAt: 0, nextDilemmaAt: 0, notified: null };

/** The chapter the player is on, with progress — or null if no ambition is picked / it's finished. */
export function currentChapter(u) {
  const s = storyOf(u);
  const amb = s.amb && ambitionById[s.amb];
  if (!amb) return null;
  const step = s.steps?.[amb.id] || 0;
  const chapter = amb.chapters[step];
  if (!chapter) return { amb: amb.id, step, done: true, total: amb.chapters.length };
  const p = progressOf(u, chapter.goal);
  return { amb: amb.id, step, total: amb.chapters.length, ...p, ready: p.have >= p.need };
}

/** Today's dilemma for this player, if one is due. Picked deterministically from the time slot. */
export function dueDilemma(u) {
  const s = storyOf(u);
  if (now() < (s.nextDilemmaAt || 0)) return null;
  const slot = Math.floor(now() / STORY.dilemmaEveryMs);
  const d = DILEMMAS[(slot * 7 + u.id * 13) % DILEMMAS.length];
  return d.id === s.lastDilemma ? DILEMMAS[(DILEMMAS.indexOf(d) + 1) % DILEMMAS.length] : d;
}

/** Compact story summary for the HUD (part of playerState). */
export function storySummary(u) {
  const c = currentChapter(u);
  return { ...(c || { amb: null }), dilemma: dueDilemma(u)?.id || null };
}

function notifyIfReady(userId) {
  const u = getUser(userId);
  const c = currentChapter(u);
  if (!c?.ready) return;
  const s = storyOf(u);
  const key = `${c.amb}:${c.step}`;
  if (s.notified === key) return;
  saveFields(userId, { story: { ...s, notified: key } });
  const ch = ambitionById[c.amb].chapters[c.step];
  emitTo(userId, 'toast', { text: [`🌟 Sura imekamilika: ${ch.title[0]} — dai zawadi!`, `🌟 Chapter complete: ${ch.title[1]} — claim your reward!`], refresh: true });
}

// --------------------------------------------------------------- actions
export const chooseAmbition = db.transaction((userId, ambId) => {
  const u = getUser(userId);
  if (!ambitionById[ambId]) throw new GameError(['Ndoto hiyo haipo.', 'No such ambition.']);
  const s = storyOf(u);
  if (s.amb === ambId) return s;
  if (s.amb && now() - (s.switchedAt || 0) < STORY.switchCooldownMs) {
    const hrs = Math.ceil((STORY.switchCooldownMs - (now() - s.switchedAt)) / 3600_000);
    throw new GameError([`Unaweza kubadili ndoto baada ya saa ${hrs}.`, `You can switch ambition in ${hrs}h.`], 429);
  }
  // Progress on each path is kept, so coming back later resumes where you were.
  const next = { ...s, amb: ambId, switchedAt: now(), steps: { ...(s.steps || {}) } };
  saveFields(userId, { story: next });
  return next;
});

export const claimChapter = db.transaction((userId) => {
  const u = getUser(userId);
  const c = currentChapter(u);
  if (!c || c.done) throw new GameError(['Hakuna sura ya kudai.', 'Nothing to claim.']);
  if (!c.ready) throw new GameError(['Bado hujamaliza lengo la sura hii.', "You haven't finished this chapter's goal yet."]);
  const amb = ambitionById[c.amb];
  const ch = amb.chapters[c.step];
  const s = storyOf(u);
  saveFields(userId, { story: { ...s, steps: { ...s.steps, [amb.id]: c.step + 1 } }, ...(ch.reward.fame ? { fame: u.fame + ch.reward.fame } : {}) });
  if (ch.reward.money) addMoney(userId, ch.reward.money, 'bonus', `🌟 ${amb.name[0]}: ${ch.title[0]}`);
  const next = amb.chapters[c.step + 1] || null;
  return { reward: ch.reward, finished: !next, next };
});

const clampNeed = (v) => Math.max(0, Math.min(100, v));
export const answerDilemma = db.transaction((userId, id, choiceIdx) => {
  const u = getUser(userId);
  const d = dueDilemma(u);
  if (!d || d.id !== id) throw new GameError(['Habari hii imeshapita.', 'That moment has passed.']);
  const choice = d.choices[choiceIdx];
  if (!choice) throw new GameError(['Chagua jibu.', 'Pick an answer.']);
  let out = choice.out;
  let base = { ...out };
  if (out.chance != null) {
    const won = Math.random() < out.chance;
    base = { money: out.money, ...(won ? out.win : out.lose), won };
  }
  // Money: fixed amount, or a share of cash when |x| < 1. Never more than you have.
  let money = base.money || 0;
  if (money && Math.abs(money) < 1) money = Math.round(u.money * money);
  if (money < 0) money = -Math.min(u.money, -money);
  if (money) addMoney(userId, money, money > 0 ? 'bonus' : 'spend', `${d.emoji} ${d.text[0].slice(0, 60)}`);
  const fields = {};
  if (base.fame) fields.fame = Math.max(0, u.fame + base.fame);
  if (base.needs) {
    fields.needs = { ...u.needs };
    for (const [k, v] of Object.entries(base.needs)) if (NEEDS.some((n) => n.id === k)) fields.needs[k] = clampNeed((fields.needs[k] ?? 50) + v);
  }
  const s = storyOf(u);
  fields.story = { ...s, nextDilemmaAt: now() + STORY.dilemmaEveryMs, lastDilemma: d.id };
  saveFields(userId, fields);
  return { msg: base.msg, money, fame: base.fame || 0, won: base.won };
});

export function storyState(userId) {
  const u = getUser(userId);
  const s = storyOf(u);
  return {
    amb: s.amb,
    steps: s.steps || {},
    canSwitchAt: s.amb ? (s.switchedAt || 0) + STORY.switchCooldownMs : 0,
    current: currentChapter(u),
    dilemma: dueDilemma(u),
    progress: Object.fromEntries(AMBITIONS.map((a) => [a.id, s.steps?.[a.id] || 0])),
  };
}
