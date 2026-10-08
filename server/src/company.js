// Start-your-own companies: daily trading days settled lazily (like trucks), with a company account.
import { db, getUser, addMoney, GameError, now } from './db.js';
import { INDUSTRIES, industryById, COMPANY, COMPANY_EVENTS, SHOP_ITEMS, SHOP, NEEDS } from '../../shared/world.js';
import { emitTo } from './presence.js';
import { bumpStats } from './story.js';

const DAY = 86_400_000;

db.exec(`
CREATE TABLE IF NOT EXISTS companies (
  id INTEGER PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  logo TEXT NOT NULL,
  color TEXT NOT NULL,
  industry TEXT NOT NULL,
  staff INTEGER NOT NULL DEFAULT 1,
  price TEXT NOT NULL DEFAULT 'normal',
  balance INTEGER NOT NULL DEFAULT 0,
  reputation INTEGER NOT NULL DEFAULT 10,
  boost_until INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  last_settled INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS companies_owner ON companies(owner_id);
CREATE TABLE IF NOT EXISTS company_days (
  id INTEGER PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  day INTEGER NOT NULL,
  customers INTEGER NOT NULL,
  revenue INTEGER NOT NULL,
  costs INTEGER NOT NULL,
  profit INTEGER NOT NULL,
  event TEXT
);
CREATE INDEX IF NOT EXISTS company_days_c ON company_days(company_id, day);
`);
// Player shops (added later): open flag, markup over retail, lifetime sales.
for (const [col, def] of [['shop_open', 'INTEGER NOT NULL DEFAULT 0'], ['shop_markup', 'REAL NOT NULL DEFAULT 1.2'], ['shop_sales', 'INTEGER NOT NULL DEFAULT 0']]) {
  if (!db.prepare('PRAGMA table_info(companies)').all().some((c) => c.name === col)) db.exec(`ALTER TABLE companies ADD COLUMN ${col} ${def}`);
}

const q = {
  mine: db.prepare('SELECT * FROM companies WHERE owner_id = ? ORDER BY id'),
  one: db.prepare('SELECT * FROM companies WHERE id = ? AND owner_id = ?'),
  insert: db.prepare('INSERT INTO companies (owner_id, name, logo, color, industry, staff, created_at, last_settled) VALUES (?, ?, ?, ?, ?, 1, ?, ?)'),
  days: db.prepare('SELECT * FROM company_days WHERE company_id = ? ORDER BY day DESC LIMIT 7'),
  addDay: db.prepare('INSERT INTO company_days (company_id, day, customers, revenue, costs, profit, event) VALUES (?, ?, ?, ?, ?, ?, ?)'),
  save: db.prepare('UPDATE companies SET balance = ?, reputation = ?, last_settled = ? WHERE id = ?'),
};

// Deterministic per company & day so settling twice can't re-roll luck.
function rnd(a, b) {
  let h = (a * 374761393) ^ (b * 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** One trading day: staff = capacity, the market (price, reputation, fame, marketing, luck) = demand. */
function tradeDay(c, dayIdx, fame) {
  const ind = industryById[c.industry];
  const pm = COMPANY.prices[c.price] || COMPANY.prices.normal;
  let ev = null;
  let roll = rnd(c.id, dayIdx * 3 + 1);
  for (const e of COMPANY_EVENTS) { if (roll < e.p) { ev = e; break; } roll -= e.p; }
  const marketing = c.boost_until > dayIdx * DAY ? 1 + COMPANY.marketing.boost : 1;
  const luck = 0.75 + rnd(c.id, dayIdx * 3 + 2) * 0.5;
  // Premium pricing only works once people trust you.
  const rep = 1 + (c.reputation - 10) / (c.price === 'premium' ? 80 : 160);
  const fameMult = 1 + Math.min(fame || 0, 200) / 400;
  const demand = ind.base * (1 + COMPANY.staffBoost * ind.maxStaff * 0.6) * pm.cust * rep * fameMult * marketing * luck * (ev?.cust || 1);
  const capacity = ind.base * (1 + COMPANY.staffBoost * c.staff);
  const raw = Math.max(0, Math.min(demand, capacity));
  // Small-ticket businesses count whole customers; events/tech count fractional "jobs" over time.
  const customers = ind.base >= 3 ? Math.round(raw) : raw;
  let revenue = Math.round(customers * ind.ticket * pm.price);
  if (ev?.bonus) revenue = Math.round(revenue * (1 + ev.bonus));
  const fine = ev?.fine ? Math.round(ind.cost * ev.fine) : 0;
  const costs = Math.round(revenue * (1 - ind.margin)) + c.staff * ind.wage + ind.rent + fine;
  const profit = revenue - costs;
  // Busy, well-run days build a name; empty or loss-making days hurt it.
  const repDelta = profit > 0 && demand <= capacity * 1.1 ? 1 : profit < 0 ? -2 : demand > capacity * 1.3 ? -1 : 0;
  return { customers: Math.round(customers * 10) / 10, revenue, costs, profit, event: ev?.id || null, repDelta, demand, capacity };
}

/** Run every finished day since the last settlement (capped). */
function settle(c, fame, t = now()) {
  const full = Math.floor((t - c.last_settled) / DAY);
  if (full <= 0) return c;
  const n = Math.min(COMPANY.maxDays, full);
  let { balance, reputation } = c;
  const firstDay = Math.floor(c.last_settled / DAY) + (full - n);
  for (let i = 0; i < n; i++) {
    const d = tradeDay({ ...c, reputation }, firstDay + i, fame);
    q.addDay.run(c.id, firstDay + i, Math.round(d.customers), d.revenue, d.costs, d.profit, d.event);
    balance += d.profit;
    reputation = Math.max(0, Math.min(100, reputation + d.repDelta));
  }
  const last = c.last_settled + full * DAY;
  q.save.run(balance, reputation, last, c.id);
  return { ...c, balance, reputation, last_settled: last };
}

function view(c, fame) {
  const ind = industryById[c.industry];
  const days = q.days.all(c.id).map((d) => ({ ...d, eventText: COMPANY_EVENTS.find((e) => e.id === d.event)?.text || null }));
  const preview = tradeDay(c, Math.floor(now() / DAY) + 999, fame); // a typical day, for the "capacity vs demand" hint
  return {
    ...c, industryDef: ind, days,
    nextIn: Math.max(0, c.last_settled + DAY - now()),
    busy: preview.demand > preview.capacity * 1.05 ? 'understaffed' : preview.demand < preview.capacity * 0.7 ? 'overstaffed' : 'ok',
    sellFor: Math.round(ind.cost * COMPANY.sellBack) + Math.max(0, c.balance),
    marketingCost: Math.round(ind.cost * COMPANY.marketing.costPct),
  };
}

export function myCompanies(userId) {
  const u = getUser(userId);
  return q.mine.all(userId).map((c) => view(settle(c, u.fame), u.fame));
}

function own(userId, id) {
  const c = q.one.get(Number(id), userId);
  if (!c) throw new GameError(['Kampuni haipo.', 'Company not found.'], 404);
  return settle(c, getUser(userId).fame);
}

const cleanName = (s) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, 28) : '');

export const createCompany = db.transaction((userId, { name, logo, color, industry }) => {
  const ind = industryById[industry];
  if (!ind) throw new GameError(['Chagua sekta.', 'Choose an industry.']);
  name = cleanName(name);
  if (name.length < 2) throw new GameError(['Ipe kampuni jina.', 'Give your company a name.']);
  if (q.mine.all(userId).length >= COMPANY.max) throw new GameError([`Unaweza kuwa na kampuni ${COMPANY.max} tu.`, `You can own up to ${COMPANY.max} companies.`]);
  if (!COMPANY.colors.includes(color)) color = COMPANY.colors[0];
  if (typeof logo !== 'string' || logo.length > 8 || !logo.trim()) logo = ind.emoji;
  addMoney(userId, -ind.cost, 'purchase', `🏢 Umeanzisha ${name} (${ind.name[0]})`);
  const t = now();
  const info = q.insert.run(userId, name, logo, color, ind.id, t, t);
  bumpStats(userId, ['companies']);
  return info.lastInsertRowid;
});

export const updateCompany = db.transaction((userId, id, { action, value }) => {
  const c = own(userId, id);
  const ind = industryById[c.industry];
  if (action === 'hire') {
    if (c.staff >= ind.maxStaff) throw new GameError([`Kikomo ni wafanyakazi ${ind.maxStaff}.`, `The limit is ${ind.maxStaff} staff.`]);
    db.prepare('UPDATE companies SET staff = staff + 1 WHERE id = ?').run(c.id);
  } else if (action === 'fire') {
    if (c.staff <= 0) throw new GameError(['Hakuna wa kuachisha.', 'No one to let go.']);
    db.prepare('UPDATE companies SET staff = staff - 1 WHERE id = ?').run(c.id);
  } else if (action === 'price') {
    if (!COMPANY.prices[value]) throw new GameError(['Bei si sahihi.', 'Invalid price level.']);
    db.prepare('UPDATE companies SET price = ? WHERE id = ?').run(value, c.id);
  } else if (action === 'market') {
    const cost = Math.round(ind.cost * COMPANY.marketing.costPct);
    if (c.boost_until > now()) throw new GameError(['Kampeni bado inaendelea.', 'A campaign is already running.']);
    addMoney(userId, -cost, 'spend', `📣 Matangazo ya ${c.name}`);
    db.prepare('UPDATE companies SET boost_until = ? WHERE id = ?').run(now() + COMPANY.marketing.days * DAY, c.id);
  } else if (action === 'withdraw' || action === 'deposit') {
    const amt = Math.floor(Number(value));
    if (!(amt > 0)) throw new GameError(['Kiasi si sahihi.', 'Invalid amount.']);
    if (action === 'withdraw') {
      if (amt > c.balance) throw new GameError(['Kampuni haina kiasi hicho.', "The company doesn't have that much."]);
      db.prepare('UPDATE companies SET balance = balance - ? WHERE id = ?').run(amt, c.id);
      addMoney(userId, amt, 'income', `🏢 Faida kutoka ${c.name}`);
    } else {
      addMoney(userId, -amt, 'spend', `🏢 Mtaji kwa ${c.name}`);
      db.prepare('UPDATE companies SET balance = balance + ? WHERE id = ?').run(amt, c.id);
    }
  } else if (action === 'shop') {
    if (!SHOP_ITEMS[c.industry]) throw new GameError(['Sekta hii haiuzi bidhaa kwa wachezaji.', "This industry doesn't sell to players."]);
    db.prepare('UPDATE companies SET shop_open = ? WHERE id = ?').run(value ? 1 : 0, c.id);
  } else if (action === 'markup') {
    const m = Number(value);
    if (!SHOP.markups.includes(m)) throw new GameError(['Bei si sahihi.', 'Invalid markup.']);
    db.prepare('UPDATE companies SET shop_markup = ? WHERE id = ?').run(m, c.id);
  } else if (action === 'rename') {
    const name = cleanName(value);
    if (name.length < 2) throw new GameError(['Jina fupi mno.', 'Name is too short.']);
    db.prepare('UPDATE companies SET name = ? WHERE id = ?').run(name, c.id);
  } else if (action === 'sell') {
    const got = Math.round(ind.cost * COMPANY.sellBack) + c.balance;
    db.prepare('DELETE FROM companies WHERE id = ?').run(c.id);
    if (got > 0) addMoney(userId, got, 'sale', `🏢 Umeuza ${c.name}`);
    else if (got < 0) addMoney(userId, got, 'spend', `🏢 Madeni ya ${c.name}`);
    return { sold: true, got };
  } else throw new GameError(['Haijulikani', 'Unknown action']);
  return {};
});

export const companyCount = (userId) => q.mine.all(userId).length;
void INDUSTRIES;

// ------------------------------------------------------------ player shops
const shopPrice = (item, markup) => Math.round((item.price * markup) / 100) * 100;

/** All open player shops, with their items at the owner's prices. */
export function openShops(viewerId) {
  return db.prepare(`SELECT c.id, c.name, c.logo, c.color, c.industry, c.shop_markup, c.shop_sales, c.reputation, u.username owner, u.id owner_id
      FROM companies c JOIN users u ON u.id = c.owner_id WHERE c.shop_open = 1 AND u.banned_at IS NULL ORDER BY c.shop_sales DESC, c.id LIMIT 60`).all()
    .filter((s) => SHOP_ITEMS[s.industry])
    .map((s) => ({ ...s, mine: s.owner_id === viewerId, items: SHOP_ITEMS[s.industry].map((i) => ({ ...i, price: shopPrice(i, s.shop_markup) })) }));
}

const lastBuy = new Map();
const clamp = (v) => Math.max(0, Math.min(100, v));
export const buyFromShop = db.transaction((buyerId, companyId, itemId) => {
  const c = db.prepare('SELECT * FROM companies WHERE id = ? AND shop_open = 1').get(Number(companyId));
  if (!c) throw new GameError(['Duka hili limefungwa.', 'This shop is closed.'], 404);
  if (c.owner_id === buyerId) throw new GameError(['Huwezi kununua dukani kwako.', "You can't buy from your own shop."]);
  const item = SHOP_ITEMS[c.industry]?.find((i) => i.id === itemId);
  if (!item) throw new GameError(['Bidhaa haipo.', 'Item not found.'], 404);
  if (Date.now() - (lastBuy.get(buyerId) || 0) < SHOP.buyCooldownMs) throw new GameError(['Pole pole!', 'Easy there!'], 429);
  lastBuy.set(buyerId, Date.now());
  const price = shopPrice(item, c.shop_markup);
  const buyer = getUser(buyerId);
  addMoney(buyerId, -price, 'spend', `${item.emoji} ${item.name[0]} — ${c.name}`);
  const profit = price - Math.round(item.price * SHOP.stockCost);
  db.prepare('UPDATE companies SET balance = balance + ?, shop_sales = shop_sales + 1 WHERE id = ?').run(profit, c.id);
  const needs = { ...buyer.needs };
  for (const [k, v] of Object.entries(item.effects || {})) if (NEEDS.some((n) => n.id === k)) needs[k] = clamp((needs[k] ?? 50) + v);
  db.prepare('UPDATE users SET needs = ?, health = ? WHERE id = ?').run(JSON.stringify(needs), Math.min(100, (buyer.health ?? 100) + (item.health || 0)), buyerId);
  bumpStats(buyerId, ['shop_buys']);
  emitTo(c.owner_id, 'toast', { text: [`🛍️ @${buyer.username} amenunua ${item.name[0]} — ${c.name} (+TSh ${profit.toLocaleString()})`, `🛍️ @${buyer.username} bought ${item.name[1]} at ${c.name} (+TSh ${profit.toLocaleString()})`] });
  return { item: item.id, price, shop: c.name };
});
