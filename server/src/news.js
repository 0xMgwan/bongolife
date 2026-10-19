// Habari: the in-game press. Media houses write stories from what players actually do —
// new fortunes, crimes, scandals, launches, luxury buys, rivalries and the rich list.
import { db, now } from './db.js';
import { NEWS_CATS, outletById, WEALTH_MARKS, bigMoney } from '../../shared/world.js';
import { broadcast } from './presence.js';

db.exec(`CREATE TABLE IF NOT EXISTS news (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  outlet TEXT NOT NULL, cat TEXT NOT NULL, title TEXT NOT NULL, body TEXT,
  user_id INTEGER, username TEXT, big INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS news_time ON news(created_at);
CREATE TABLE IF NOT EXISTS news_marks (user_id INTEGER PRIMARY KEY, level INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS news_meta (k TEXT PRIMARY KEY, v TEXT);`);
const q = {
  insert: db.prepare('INSERT INTO news (outlet, cat, title, body, user_id, username, big, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'),
  list: db.prepare('SELECT * FROM news ORDER BY id DESC LIMIT ?'),
  byOutlet: db.prepare('SELECT * FROM news WHERE outlet = ? ORDER BY id DESC LIMIT ?'),
  byUser: db.prepare('SELECT * FROM news WHERE user_id = ? ORDER BY id DESC LIMIT 10'),
  recentSame: db.prepare('SELECT 1 FROM news WHERE user_id = ? AND cat = ? AND created_at > ? LIMIT 1'),
  mark: db.prepare('SELECT level FROM news_marks WHERE user_id = ?'),
  setMark: db.prepare('INSERT INTO news_marks (user_id, level) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET level = excluded.level'),
  meta: db.prepare('SELECT v FROM news_meta WHERE k = ?'),
  setMeta: db.prepare('INSERT INTO news_meta (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v'),
  prune: db.prepare('DELETE FROM news WHERE created_at < ?'),
};
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const row = (r) => ({ ...r, title: JSON.parse(r.title), body: r.body ? JSON.parse(r.body) : null, big: !!r.big });

/** Publish a story. `text` is [sw, en]; `user` is { id, username } or null. */
export function publish(cat, text, { user = null, body = null, big = false, outlet = null, throttleMs = 0 } = {}) {
  try {
    if (throttleMs && user && q.recentSame.get(user.id, cat, now() - throttleMs)) return null;
    const o = outlet || pick(NEWS_CATS[cat]?.outlets || ['mwanabongo']);
    const info = q.insert.run(o, cat, JSON.stringify(text), body ? JSON.stringify(body) : null, user?.id ?? null, user?.username ?? null, big ? 1 : 0, now());
    const story = { id: info.lastInsertRowid, outlet: o, cat, title: text, body, user_id: user?.id ?? null, username: user?.username ?? null, big, created_at: now() };
    broadcast('news', story);
    return story;
  } catch (e) {
    console.error('[news]', e.message);
    return null;
  }
}

export function feed({ outlet, limit = 60 } = {}) {
  const n = Math.min(100, Math.max(1, limit));
  const rows = outlet && outletById[outlet] ? q.byOutlet.all(outlet, n) : q.list.all(n);
  return rows.map(row);
}
export const aboutUser = (uid) => q.byUser.all(uid).map(row);

// ------------------------------------------------------------ story writers
const u = (x) => `@${x.username}`;
const M = (n) => bigMoney(n);
export const story = {
  land(user, plotName, price) {
    publish('wealth', pick([
      [`${u(user)} anunua kiwanja ${plotName} kwa ${M(price)[0]}`, `${u(user)} snaps up ${plotName} for ${M(price)[1]}`],
      [`Mali isiyohamishika: ${u(user)} aongeza ardhi ${plotName}`, `Real estate: ${u(user)} adds ${plotName} to the portfolio`],
    ]), { user, throttleMs: 30 * 60_000 });
  },
  build(user, what, where) {
    publish('business', pick([
      [`${u(user)} azindua ${what} mpya ${where}`, `${u(user)} unveils a new ${what} in ${where}`],
      [`Ujenzi: ${what} ya ${u(user)} yafunguliwa ${where}`, `Construction: ${u(user)}'s ${what} opens in ${where}`],
    ]), { user, throttleMs: 20 * 60_000 });
  },
  business(user, name, price) {
    publish('business', pick([
      [`${u(user)} anunua ${name} — dili la ${M(price)[0]}`, `${u(user)} buys ${name} in a ${M(price)[1]} deal`],
      [`Mmiliki mpya wa ${name} ni ${u(user)}`, `${name} has a new owner: ${u(user)}`],
    ]), { user });
  },
  company(user, name) {
    publish('business', [`Kampuni mpya mjini: ${u(user)} afungua "${name}"`, `New company in town: ${u(user)} launches "${name}"`], { user });
  },
  luxury(user, item, price) {
    publish('luxury', pick([
      [`${u(user)} anunua ${item} ya ${M(price)[0]}! Maisha ya kifahari 🔥`, `${u(user)} splashes ${M(price)[1]} on the ${item}! 🔥`],
      [`Wameona nini? ${u(user)} na ${item} mpya kabisa`, `Spotted: ${u(user)} with a brand-new ${item}`],
    ]), { user, big: price >= 500_000_000 });
  },
  hustle(user, name, count) {
    publish('business', [`${u(user)} sasa anamiliki ${count} ${name} — himaya ya mishe inakua`, `${u(user)} now runs ${count} ${name}s — a hustle empire is growing`], { user, throttleMs: 2 * 3600_000 });
  },
  stocks(user, sym, value, side) {
    publish('business', side === 'buy'
      ? [`${u(user)} anunua hisa za ${sym} za ${M(value)[0]} — soko lashtuka`, `${u(user)} buys ${M(value)[1]} of ${sym} — the market takes note`]
      : [`${u(user)} auza hisa za ${sym} za ${M(value)[0]}`, `${u(user)} dumps ${M(value)[1]} of ${sym} shares`], { user, throttleMs: 30 * 60_000 });
  },
  robbery(robber, victim, amount) {
    publish('crime', pick([
      [`Uporaji mchana kweupe: @${victim} aibiwa ${M(amount)[0]}`, `Broad-daylight robbery: @${victim} loses ${M(amount)[1]}`],
      [`Polisi wamsaka ${u(robber)} kwa tuhuma za wizi`, `Police hunt ${u(robber)} over a street robbery`],
    ]), { user: robber, throttleMs: 15 * 60_000 });
  },
  robberyFoiled(robber, victim, guards) {
    publish('crime', guards
      ? [`Walinzi wa @${victim} wamzima ${u(robber)} — jaribio la wizi lashindwa`, `@${victim}'s bodyguards stop ${u(robber)} cold — robbery foiled`]
      : [`${u(robber)} akamatwa akijaribu kumwibia @${victim}`, `${u(robber)} arrested trying to rob @${victim}`], { user: robber, throttleMs: 15 * 60_000 });
  },
  heist(user, loot) {
    publish('crime', pick([
      [`🚨 WIZI MKUBWA: Benki ya Posta yaporwa ${M(loot)[0]}! Mtuhumiwa ${u(user)} hajulikani alipo`, `🚨 BIG HEIST: Posta bank robbed of ${M(loot)[1]}! Suspect ${u(user)} still at large`],
      [`Majambazi watoroka na ${M(loot)[0]} — polisi wachanganyikiwa`, `Robbers escape with ${M(loot)[1]} — police left baffled`],
    ]), { user, big: true });
  },
  bankAlarm(user) {
    publish('crime', [`Jaribio la kuvamia benki ya Posta lashindwa — kengele yalia`, `Attempted raid on the Posta bank fails as the alarm sounds`], { user, throttleMs: 30 * 60_000 });
  },
  busted(user, stars, worth) {
    const rich = worth >= 100_000_000;
    publish(rich ? 'scandal' : 'crime', rich
      ? pick([
        [`SKENDO: Tajiri ${u(user)} (${M(worth)[0]}) akamatwa baada ya msako wa polisi!`, `SCANDAL: Tycoon ${u(user)} (${M(worth)[1]}) arrested after a police chase!`],
        [`Aibu! ${u(user)} apigwa pingu mbele ya umati`, `Shame! ${u(user)} handcuffed in front of a crowd`],
      ])
      : [`Msako wa nyota ${stars}: ${u(user)} akamatwa`, `${stars}-star chase ends with ${u(user)} in handcuffs`], { user, big: rich && stars >= 3 });
  },
  race(user, secs) {
    publish('sport', [`Rekodi mpya ya mbio za mtaani: ${u(user)} — sekunde ${secs}`, `New street-race record: ${u(user)} in ${secs}s`], { user });
  },
  married(a, b) {
    publish('love', pick([
      [`Harusi ya mwaka! ${u(a)} na ${u(b)} wafunga ndoa 💍`, `Wedding of the year! ${u(a)} and ${u(b)} tie the knot 💍`],
      [`Penzi limeshinda: ${u(a)} ❤️ ${u(b)} sasa ni mume na mke`, `Love wins: ${u(a)} ❤️ ${u(b)} are now married`],
    ]), { user: a });
  },
  dating(a, b) {
    publish('love', [`Wameonekana pamoja… ${u(a)} na ${u(b)} ni wapenzi wapya mjini 👀`, `Spotted together… ${u(a)} and ${u(b)} are the city's newest couple 👀`], { user: a, throttleMs: 3600_000 });
  },
  breakup(a, b) {
    publish('scandal', pick([
      [`Penzi lavunjika! ${u(a)} na ${u(b)} waachana 💔`, `It's over! ${u(a)} and ${u(b)} split 💔`],
      [`Machozi mtandaoni: ${u(a)} amtema ${u(b)}`, `Tears online: ${u(a)} dumps ${u(b)}`],
    ]), { user: a });
  },
  mayor(user, votes) {
    publish('politics', [`${u(user)} ashinda Umeya wa Dar kwa kura ${votes}`, `${u(user)} wins the Dar mayoral race with ${votes} votes`], { user, big: true });
  },
  guards(user, tier) {
    publish('luxury', [`${u(user)} sasa anatembea na ${tier.name[0].toLowerCase()} — anaogopa nini? 🕶️`, `${u(user)} now rolls with ${tier.name[1].replace(/^[A-Z][a-z]/, (x) => x.toLowerCase())} — what are they afraid of? 🕶️`], { user, throttleMs: 6 * 3600_000 });
  },
  donation(user, amount, place) {
    publish('wealth', [`Moyo wa kutoa: ${u(user)} atoa ${M(amount)[0]} ${place}`, `Generous: ${u(user)} gives ${M(amount)[1]} at ${place}`], { user, throttleMs: 6 * 3600_000 });
  },
};

// ------------------------------------------------------- milestones & rich list
const markOf = (worth) => WEALTH_MARKS.reduce((lvl, m, i) => (worth >= m ? i + 1 : lvl), 0);
const MARK_LINES = [
  null,
  ['amefikisha milioni ya kwanza! Safari imeanza', 'hits their first million! The journey begins'],
  ['sasa ana thamani ya milioni 10', 'is now worth 10 million'],
  ['ameingia klabu ya milioni 100', 'joins the 100-million club'],
  ['ni BILIONEA rasmi! 🎉', 'is officially a BILLIONAIRE! 🎉'],
  ['ana bilioni 10 — mmoja wa matajiri wakubwa Bongo', 'is worth 10 billion — among the richest in Bongo'],
  ['ana bilioni 100. Hakuna kinachomzuia', 'is worth 100 billion. Unstoppable'],
  ['ni TRILIONEA wa kwanza wa aina yake! 🤯', 'becomes a TRILLIONAIRE! 🤯'],
  ['ana trilioni 10 — utajiri wa kihistoria', 'is worth 10 trillion — historic wealth'],
  ['ana trilioni 100. Uchumi wote mkononi', 'is worth 100 trillion. The whole economy in one hand'],
  ['ni KWADRILIONEA! Hadithi ya Bongo', 'is a QUADRILLIONAIRE! A Bongo legend'],
  ['ni KWINTILIONEA. Haiwezekani… lakini imetokea', 'is a QUINTILLIONAIRE. Impossible… yet here we are'],
];
let netWorthFn = null;
function checkMilestones() {
  const since = now() - 2 * 86_400_000;
  const users = db.prepare('SELECT id, username FROM users WHERE COALESCE(last_seen, created_at) > ? AND banned_at IS NULL').all(since);
  const ranked = [];
  for (const user of users) {
    const worth = netWorthFn(user.id);
    ranked.push({ ...user, worth });
    const lvl = markOf(worth);
    const prev = q.mark.get(user.id);
    if (!prev) { q.setMark.run(user.id, lvl); continue; } // first sight: no story for old fortunes
    if (lvl > prev.level) {
      q.setMark.run(user.id, lvl);
      const line = MARK_LINES[Math.min(lvl, MARK_LINES.length - 1)];
      publish('milestone', [`${u(user)} ${line[0]}`, `${u(user)} ${line[1]}`], { user, big: lvl >= 4, body: [`Thamani: ${M(worth)[0]}`, `Net worth: ${M(worth)[1]}`] });
    }
  }
  return ranked;
}
/** #1 changed hands? The rich list makes the news. Once a day, Forbz publishes its top 5. */
function rankings(ranked) {
  const all = db.prepare('SELECT id, username FROM users WHERE banned_at IS NULL').all();
  const seen = new Set(ranked.map((r) => r.id));
  for (const user of all) if (!seen.has(user.id)) ranked.push({ ...user, worth: netWorthFn(user.id) });
  ranked.sort((a, b) => b.worth - a.worth);
  const top = ranked[0];
  if (!top) return;
  const prevTop = q.meta.get('top')?.v;
  if (prevTop && +prevTop !== top.id) {
    const was = ranked.find((r) => r.id === +prevTop);
    if (was) publish('ranking', [`MAPINDUZI: ${u(top)} ampita ${u(was)} na kuwa tajiri namba 1 Bongo!`, `SHAKE-UP: ${u(top)} overtakes ${u(was)} as Bongo's richest!`], { user: top, big: true, body: [`${M(top.worth)[0]} dhidi ya ${M(was.worth)[0]}`, `${M(top.worth)[1]} vs ${M(was.worth)[1]}`] });
  }
  q.setMeta.run('top', String(top.id));
  // Rival watch: #2 closing in on #1.
  const second = ranked[1];
  if (second && top.worth > 0 && second.worth / top.worth > 0.9 && q.meta.get('rival')?.v !== `${top.id}-${second.id}`) {
    q.setMeta.run('rival', `${top.id}-${second.id}`);
    publish('ranking', [`Upinzani mkali: ${u(second)} yuko karibu kumpita ${u(top)}`, `Rivalry heats up: ${u(second)} is closing in on ${u(top)}`], { user: second });
  }
  const day = String(Math.floor((now() + 3 * 3600_000) / 86_400_000));
  if (q.meta.get('list')?.v !== day) {
    q.setMeta.run('list', day);
    const five = ranked.slice(0, 5).filter((r) => r.worth > 0);
    if (five.length >= 3) {
      publish('ranking', [`Orodha ya Forbz Bongo ya leo: ${u(five[0])} aongoza`, `Today's Forbz Bongo rich list: ${u(five[0])} leads`], {
        outlet: 'forbz', user: five[0],
        body: [five.map((r, i) => `${i + 1}. @${r.username} — ${M(r.worth)[0]}`).join('\n'), five.map((r, i) => `${i + 1}. @${r.username} — ${M(r.worth)[1]}`).join('\n')],
      });
    }
  }
}

export function startNews({ netWorth }) {
  netWorthFn = netWorth;
  const run = () => {
    try { rankings(checkMilestones()); q.prune.run(now() - 30 * 86_400_000); } catch (e) { console.error('[news]', e.message); }
  };
  setTimeout(run, 20_000);
  setInterval(run, 10 * 60_000).unref();
}
