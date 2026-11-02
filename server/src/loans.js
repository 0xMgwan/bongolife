// Mikopo: bank loans, secured by plots/businesses or unsecured against net worth. One open loan
// per player. Late loans pay a daily fee; after the grace days the bank collects what it can from
// the wallet and seizes the collateral. Unsecured shortfalls are taken from the wallet hourly.
import { db, getUser, addMoney, GameError, now } from './db.js';
import { LOANS, plotById, placeById, PLACES } from '../../shared/world.js';
import { plotValue } from './invest.js';
import { online, emitTo } from './presence.js';

const DAY = 86_400_000;
db.exec(`CREATE TABLE IF NOT EXISTS loans (
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL,
  principal INTEGER NOT NULL, owed INTEGER NOT NULL, paid INTEGER NOT NULL DEFAULT 0, rate REAL NOT NULL,
  collateral TEXT NOT NULL DEFAULT '[]', taken_at INTEGER NOT NULL, due_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'open', closed_at INTEGER, warned INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS loans_user ON loans(user_id, status);`);
const q = {
  open: db.prepare("SELECT * FROM loans WHERE user_id = ? AND status IN ('open', 'defaulted') ORDER BY id DESC LIMIT 1"),
  allOpen: db.prepare("SELECT * FROM loans WHERE status IN ('open', 'defaulted')"),
  history: db.prepare("SELECT * FROM loans WHERE user_id = ? AND status NOT IN ('open', 'defaulted') ORDER BY id DESC LIMIT 5"),
  pay: db.prepare('UPDATE loans SET paid = paid + ? WHERE id = ?'),
  close: db.prepare('UPDATE loans SET status = ?, closed_at = ? WHERE id = ?'),
};
const parse = (s) => { try { return JSON.parse(s) || []; } catch { return []; } };

const daysLate = (l, t = now()) => (t > l.due_at ? Math.min(LOANS.maxLateDays, Math.ceil((t - l.due_at) / DAY)) : 0);
/** What's left to pay today, late fees included. */
export const balanceOf = (l, t = now()) => Math.max(0, Math.round(l.owed * (1 + LOANS.lateFeePerDay * daysLate(l, t))) - l.paid);
/** Outstanding debt (for net worth). */
export const debtOf = (uid) => { const l = q.open.get(uid); return l ? balanceOf(l) : 0; };

/** Is this plot/business pledged to the bank right now? */
export function pledged(kind, id) {
  return q.allOpen.all().some((l) => l.status === 'open' && parse(l.collateral).some((c) => c.kind === kind && c.id === id));
}
export function assertUnpledged(kind, id) {
  if (pledged(kind, id)) throw new GameError(['Mali hii imewekwa dhamana benki — lipa mkopo kwanza.', 'This is pledged to the bank — repay the loan first.'], 409);
}

const valueOf = (kind, id) => {
  if (kind === 'plot') { const r = db.prepare('SELECT * FROM plots WHERE id = ?').get(id); return r ? plotValue(r) : 0; }
  return placeById[id]?.business?.price || 0;
};
const nameOf = (kind, id) => (kind === 'plot' ? plotById[id]?.name : placeById[id]?.business?.label || placeById[id]?.name) || id;
const onMarket = (kind, id) => { try { return !!db.prepare("SELECT 1 FROM listings WHERE kind = ? AND asset_id = ? AND status = 'open'").get(kind, id); } catch { return false; } };

function atBank(uid) {
  const p = online.get(uid);
  if (!p) return false;
  return PLACES.some((pl) => pl.type === 'bank' && (p.inside === pl.id || Math.hypot(Math.max(Math.abs(p.x - pl.pos[0]) - pl.size[0] / 2, 0), Math.max(Math.abs(p.z - pl.pos[1]) - pl.size[1] / 2, 0)) < 14));
}

export function unsecuredLimit(netWorth) {
  return Math.round(Math.min(LOANS.unsecuredMax, Math.max(LOANS.unsecuredMin, netWorth * LOANS.unsecuredPct)) / 10_000) * 10_000;
}

const shape = (l) => l ? {
  id: l.id, principal: l.principal, owed: l.owed, paid: l.paid, rate: l.rate, takenAt: l.taken_at, dueAt: l.due_at,
  status: l.status, daysLate: daysLate(l), balance: balanceOf(l), closedAt: l.closed_at,
  collateral: parse(l.collateral).map((c) => ({ ...c, name: nameOf(c.kind, c.id) })),
} : null;

export function view(uid, netWorth) {
  const assets = [
    ...db.prepare('SELECT id FROM plots WHERE owner_id = ?').all(uid).map((r) => ({ kind: 'plot', id: r.id })),
    ...db.prepare('SELECT id FROM businesses WHERE owner_id = ?').all(uid).map((r) => ({ kind: 'biz', id: r.id })),
  ].map((a) => ({ ...a, name: nameOf(a.kind, a.id), value: valueOf(a.kind, a.id), listed: onMarket(a.kind, a.id) }))
    .filter((a) => a.value > 0).sort((a, b) => b.value - a.value);
  return { loan: shape(q.open.get(uid)), history: q.history.all(uid).map(shape), assets, unsecured: unsecuredLimit(netWorth), atBank: atBank(uid), rules: LOANS };
}

export const take = db.transaction((uid, netWorth, { amount, days, collateral }) => {
  if (!atBank(uid)) throw new GameError(['Nenda benki (NMB Posta) kuchukua mkopo 🏦', 'Go to the bank (NMB Posta) to take out a loan 🏦']);
  const cur = q.open.get(uid);
  if (cur) throw new GameError(cur.status === 'defaulted' ? ['Una deni lililoshindikana — lipa kwanza.', 'You have a defaulted debt — clear it first.'] : ['Tayari una mkopo — umalize kwanza.', 'You already have a loan — repay it first.']);
  const term = LOANS.terms.find((t) => t.days === Number(days));
  if (!term) throw new GameError(['Chagua muda wa mkopo.', 'Pick a loan term.']);
  const picks = [];
  for (const c of Array.isArray(collateral) ? collateral.slice(0, 20) : []) {
    const kind = c?.kind === 'biz' ? 'biz' : 'plot';
    const id = String(c?.id || '');
    if (picks.some((p) => p.kind === kind && p.id === id)) continue;
    const row = db.prepare(`SELECT owner_id FROM ${kind === 'plot' ? 'plots' : 'businesses'} WHERE id = ?`).get(id);
    if (!row || row.owner_id !== uid) throw new GameError(['Hiyo si mali yako.', "You don't own that."], 403);
    if (onMarket(kind, id)) throw new GameError([`${nameOf(kind, id)} iko sokoni — iondoe kwanza.`, `${nameOf(kind, id)} is listed for sale — take it off the market first.`]);
    picks.push({ kind, id, value: valueOf(kind, id) });
  }
  const secured = picks.length > 0;
  const max = secured ? Math.floor(picks.reduce((a, p) => a + p.value, 0) * LOANS.ltv) : unsecuredLimit(netWorth);
  const amt = Math.floor(Number(amount) || 0);
  if (amt < LOANS.min) throw new GameError([`Mkopo wa chini ni TSh ${LOANS.min.toLocaleString()}.`, `The minimum loan is TSh ${LOANS.min.toLocaleString()}.`]);
  if (amt > max) throw new GameError([`Kikomo chako ni TSh ${max.toLocaleString()}.`, `Your limit is TSh ${max.toLocaleString()}.`]);
  const rate = term.rate + (secured ? 0 : LOANS.unsecuredExtra);
  const owed = Math.round(amt * (1 + rate));
  db.prepare('INSERT INTO loans (user_id, principal, owed, rate, collateral, taken_at, due_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(uid, amt, owed, rate, JSON.stringify(picks), now(), now() + term.days * DAY);
  addMoney(uid, amt, 'loan', `🏦 Mkopo wa benki · siku ${term.days} · riba ${Math.round(rate * 100)}%`);
  return { amount: amt, owed };
});

export const repay = db.transaction((uid, amountIn) => {
  const l = q.open.get(uid);
  if (!l) throw new GameError(['Huna mkopo.', "You don't have a loan."]);
  const bal = balanceOf(l);
  const amt = Math.min(bal, Math.floor(Number(amountIn) || bal), getUser(uid).money);
  if (amt <= 0) throw new GameError(['Hela haitoshi.', 'Not enough money.'], 402);
  addMoney(uid, -amt, 'loan_repay', `🏦 Rejesho la mkopo${amt >= bal ? ' — umemaliza!' : ''}`);
  q.pay.run(amt, l.id);
  if (amt >= bal) q.close.run('repaid', now(), l.id);
  return { paid: amt, done: amt >= bal };
});

let onSeize = null;
export const setSeizeHook = (fn) => (onSeize = fn);
/** Hourly: warn about due loans, collect overdue ones, seize collateral after the grace days. */
export const loanTick = db.transaction(() => {
  const t = now();
  let changed = false;
  for (const l of q.allOpen.all()) {
    const bal = balanceOf(l, t);
    if (l.status === 'open' && !l.warned && l.due_at - t < DAY && l.due_at > t) {
      db.prepare('UPDATE loans SET warned = 1 WHERE id = ?').run(l.id);
      emitTo(l.user_id, 'toast', { text: [`🏦 Mkopo wako unaiva ndani ya saa 24 — deni TSh ${bal.toLocaleString()}.`, `🏦 Your loan is due within 24 hours — TSh ${bal.toLocaleString()} to repay.`] });
    }
    const overdue = l.status === 'defaulted' || t > l.due_at + LOANS.graceDays * DAY;
    if (!overdue) continue;
    // Take what the wallet can cover.
    const cash = Math.min(bal, getUser(l.user_id)?.money || 0);
    if (cash > 0) {
      addMoney(l.user_id, -cash, 'loan_repay', '🏦 Benki imekata deni la mkopo uliochelewa');
      q.pay.run(cash, l.id);
    }
    if (cash >= bal) { q.close.run('repaid', t, l.id); emitTo(l.user_id, 'toast', { text: ['🏦 Benki imekata deni lako kutoka kwenye wallet. Mkopo umefungwa.', '🏦 The bank took the overdue loan from your wallet. Loan closed.'], refresh: true }); continue; }
    if (l.status === 'defaulted') continue; // unsecured: keep collecting from the wallet
    const col = parse(l.collateral);
    if (col.length) {
      for (const c of col) {
        db.prepare(`DELETE FROM ${c.kind === 'plot' ? 'plots' : 'businesses'} WHERE id = ? AND owner_id = ?`).run(c.id, l.user_id);
        try { db.prepare("UPDATE listings SET status = 'cancelled' WHERE kind = ? AND asset_id = ? AND status = 'open'").run(c.kind, c.id); } catch {}
      }
      q.close.run('seized', t, l.id);
      const names = col.map((c) => nameOf(c.kind, c.id)).join(', ');
      emitTo(l.user_id, 'toast', { text: [`🏦 Benki imetaifisha dhamana yako (${names}) kwa kushindwa kulipa mkopo.`, `🏦 The bank seized your collateral (${names}) for an unpaid loan.`], refresh: true });
      onSeize?.(getUser(l.user_id), names);
      changed = true;
    } else {
      q.close.run('defaulted', null, l.id);
      emitTo(l.user_id, 'toast', { text: ['🏦 Mkopo umeshindikana — benki itakata deni kutoka kwenye mapato yako.', '🏦 Loan defaulted — the bank will take the debt from your earnings.'], refresh: true });
    }
  }
  return changed;
});
