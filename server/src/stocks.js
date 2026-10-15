// Soko la Hisa: a small stock exchange. Prices random-walk every few minutes with occasional
// market news; big trades nudge the price; holders earn a dividend once a day.
import { db, getUser, addMoney, GameError, now } from './db.js';
import { STOCKS, stockById, MARKET } from '../../shared/world.js';
import { broadcast, online, emitTo } from './presence.js';

db.exec(`CREATE TABLE IF NOT EXISTS stock_prices (
  id TEXT PRIMARY KEY, price REAL NOT NULL, open REAL NOT NULL, history TEXT NOT NULL, updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS stock_holdings (
  user_id INTEGER NOT NULL, sym TEXT NOT NULL, qty INTEGER NOT NULL, avg REAL NOT NULL, PRIMARY KEY (user_id, sym)
);
CREATE TABLE IF NOT EXISTS stock_meta (k TEXT PRIMARY KEY, v TEXT);`);
const q = {
  price: db.prepare('SELECT * FROM stock_prices WHERE id = ?'),
  all: db.prepare('SELECT * FROM stock_prices'),
  upsert: db.prepare('INSERT INTO stock_prices (id, price, open, history, updated_at) VALUES (@id, @price, @open, @history, @t) ON CONFLICT(id) DO UPDATE SET price = @price, open = @open, history = @history, updated_at = @t'),
  hold: db.prepare('SELECT * FROM stock_holdings WHERE user_id = ? AND sym = ?'),
  holds: db.prepare('SELECT * FROM stock_holdings WHERE user_id = ?'),
  allHolds: db.prepare('SELECT * FROM stock_holdings WHERE qty > 0'),
  setHold: db.prepare('INSERT INTO stock_holdings (user_id, sym, qty, avg) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, sym) DO UPDATE SET qty = excluded.qty, avg = excluded.avg'),
  meta: db.prepare('SELECT v FROM stock_meta WHERE k = ?'),
  setMeta: db.prepare('INSERT INTO stock_meta (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v'),
};
const gauss = () => Math.sqrt(-2 * Math.log(Math.random() || 1e-9)) * Math.cos(2 * Math.PI * Math.random());
const round = (p) => (p >= 1000 ? Math.round(p / 5) * 5 : Math.round(p));
// A new market starts with a day of made-up trading so the charts aren't empty.
for (const s of STOCKS) {
  const r = q.price.get(s.id);
  if (r && JSON.parse(r.history).length >= 10) continue;
  const hist = [s.base];
  for (let i = 1; i < MARKET.historyLen; i++) hist.push(Math.max(s.base * 0.5, round(hist[i - 1] * Math.exp(gauss() * s.vol + (s.base - hist[i - 1]) / s.base * 0.01))));
  const last = hist[hist.length - 1];
  q.upsert.run({ id: s.id, price: last, open: hist[hist.length - 1 - 24] || s.base, history: JSON.stringify(hist), t: now() });
}
const NEWS = [
  [['Bandari ya Dar yavunja rekodi ya mizigo', 'Dar port breaks its cargo record'], ['SRJ', 'KILI', 'MAZA'], 0.05],
  [['Riba za benki zashuka', 'Bank rates fall'], ['KIBO', 'MZLD'], 0.04],
  [['Bei ya mafuta yapanda duniani', 'World oil prices jump'], ['MAFT'], 0.09],
  [['Bei ya mafuta yashuka', 'Oil prices slide'], ['MAFT', 'NDGE'], -0.06],
  [['Ndege mpya zawasili Dar', 'New planes land at Dar'], ['NDGE'], 0.08],
  [['Data za simu zapanda bei', 'Mobile data prices rise'], ['SIMU'], 0.05],
  [['nTZS yapata leseni mpya', 'nTZS wins a new licence'], ['NEDA'], 0.1],
  [['Albamu mpya ya Bongo Flava yavunja rekodi', 'New Bongo Flava album breaks records'], ['BONGO'], 0.08],
  [['Mvua kubwa zachelewesha ujenzi', 'Heavy rains delay construction'], ['SRJ'], -0.05],
  [['Wawekezaji wauza hisa za benki', 'Investors dump bank shares'], ['KIBO', 'MZLD'], -0.04],
];

/** One market tick: every stock random-walks; sometimes a headline moves a sector. */
export function tick() {
  const t = now();
  const rows = Object.fromEntries(q.all.all().map((r) => [r.id, r]));
  let news = null;
  if (Math.random() < 0.18) news = NEWS[Math.floor(Math.random() * NEWS.length)];
  // New trading day (Dar time): today's open = last price.
  const day = String(Math.floor((t + 3 * 3600_000) / 86_400_000));
  const newDay = q.meta.get('day')?.v !== day;
  for (const s of STOCKS) {
    const r = rows[s.id];
    let p = r.price * Math.exp(gauss() * s.vol + (s.base - r.price) / s.base * 0.004); // drifts back toward fair value
    if (news?.[1].includes(s.id)) p *= 1 + news[2] * (0.6 + Math.random() * 0.8);
    p = Math.max(s.base * 0.15, round(p));
    const hist = JSON.parse(r.history);
    hist.push(p);
    q.upsert.run({ id: s.id, price: p, open: newDay ? r.price : r.open, history: JSON.stringify(hist.slice(-MARKET.historyLen)), t });
  }
  if (newDay) { payDividends(); q.setMeta.run('day', day); }
  if (news) broadcast('toast', { text: [`📈 Soko la Hisa: ${news[0][0]} (${news[1].join(', ')})`, `📈 Stock market: ${news[0][1]} (${news[1].join(', ')})`] });
}
function payDividends() {
  const prices = Object.fromEntries(q.all.all().map((r) => [r.id, r.price]));
  const per = new Map();
  for (const h of q.allHolds.all()) {
    const d = Math.round(h.qty * prices[h.sym] * (stockById[h.sym]?.div || 0));
    if (d > 0) per.set(h.user_id, (per.get(h.user_id) || 0) + d);
  }
  for (const [uid, amt] of per) {
    try { addMoney(uid, amt, 'income', '📈 Gawio la hisa (dividend)'); } catch {}
    if (online.has(uid)) emitTo(uid, 'toast', { text: [`📈 Gawio la hisa: TSh ${amt.toLocaleString()}`, `📈 Share dividends: TSh ${amt.toLocaleString()}`], refresh: true });
  }
}

export function portfolioValue(uid) {
  const prices = Object.fromEntries(q.all.all().map((r) => [r.id, r.price]));
  return q.holds.all(uid).reduce((s, h) => s + h.qty * (prices[h.sym] || 0), 0);
}
export function view(uid) {
  const holds = Object.fromEntries(q.holds.all(uid).map((h) => [h.sym, h]));
  const stocks = STOCKS.map((s) => {
    const r = q.price.get(s.id);
    const h = holds[s.id];
    return { ...s, price: r.price, open: r.open, change: (r.price - r.open) / r.open, history: JSON.parse(r.history), qty: h?.qty || 0, avg: h?.avg || 0 };
  });
  const value = stocks.reduce((a, s) => a + s.qty * s.price, 0);
  const cost = stocks.reduce((a, s) => a + s.qty * s.avg, 0);
  return { stocks, value, gain: value - cost, rules: MARKET };
}

export const trade = db.transaction((uid, sym, side, qtyIn) => {
  const s = stockById[sym];
  const qty = Math.floor(Number(qtyIn));
  if (!s || !(qty > 0) || qty > 10_000_000) throw new GameError(['Ombi si sahihi', 'Invalid order']);
  const r = q.price.get(sym);
  const h = q.hold.get(uid, sym) || { qty: 0, avg: 0 };
  const value = r.price * qty;
  const fee = Math.max(500, Math.round(value * MARKET.feePct));
  if (side === 'buy') {
    addMoney(uid, -(value + fee), 'purchase', `📈 Hisa ${qty} za ${sym}`);
    q.setHold.run(uid, sym, h.qty + qty, (h.avg * h.qty + value) / (h.qty + qty));
  } else {
    if (h.qty < qty) throw new GameError(['Huna hisa za kutosha.', "You don't have that many shares."]);
    q.setHold.run(uid, sym, h.qty - qty, h.qty - qty ? h.avg : 0);
    addMoney(uid, Math.max(0, value - fee), 'sale', `📉 Umeuza hisa ${qty} za ${sym}`);
  }
  // Big orders move the price a little (more for small companies).
  const impact = Math.min(0.05, MARKET.impact * (value / (s.base * 2_000_000)));
  const np = round(r.price * (side === 'buy' ? 1 + impact : 1 - impact));
  const hist = JSON.parse(r.history);
  hist[hist.length - 1] = np;
  q.upsert.run({ id: sym, price: np, open: r.open, history: JSON.stringify(hist), t: now() });
  return { fee, ...view(uid) };
});

export function startMarket() {
  setInterval(() => { try { tick(); } catch (e) { console.error('[stocks]', e.message); } }, MARKET.tickMs).unref();
}
void getUser;
