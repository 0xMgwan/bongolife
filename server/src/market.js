// Soko la Mali: players sell plots (with their buildings) and businesses to each other —
// fixed "buy now" prices, timed auctions (bids are held until you're outbid), and offers on
// property that isn't listed. The seller pays a small agent fee.
import { db, getUser, addMoney, GameError, now } from './db.js';
import { PROPERTY_MARKET as PM, plotById, placeById, buildingById, houseStats } from '../../shared/world.js';
import { plotValue } from './invest.js';
import { emitTo, broadcast } from './presence.js';

db.exec(`CREATE TABLE IF NOT EXISTS listings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL, asset_id TEXT NOT NULL, seller_id INTEGER NOT NULL,
  price INTEGER, start_bid INTEGER, ends_at INTEGER,
  top_bid INTEGER, top_bidder INTEGER, bids INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open', buyer_id INTEGER, final INTEGER,
  created_at INTEGER NOT NULL, closed_at INTEGER
);
CREATE INDEX IF NOT EXISTS listings_open ON listings(status);
CREATE TABLE IF NOT EXISTS property_offers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL, asset_id TEXT NOT NULL, from_id INTEGER NOT NULL, to_id INTEGER NOT NULL,
  amount INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'open', created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL
);`);
const q = {
  listing: db.prepare('SELECT * FROM listings WHERE id = ?'),
  openFor: db.prepare("SELECT * FROM listings WHERE kind = ? AND asset_id = ? AND status = 'open'"),
  open: db.prepare("SELECT l.*, u.username seller FROM listings l JOIN users u ON u.id = l.seller_id WHERE l.status = 'open' ORDER BY l.created_at DESC LIMIT 100"),
  mine: db.prepare("SELECT * FROM listings WHERE seller_id = ? AND (status = 'open' OR closed_at > ?) ORDER BY id DESC LIMIT 30"),
  myBids: db.prepare("SELECT * FROM listings WHERE top_bidder = ? AND status = 'open'"),
  ended: db.prepare("SELECT * FROM listings WHERE status = 'open' AND ends_at IS NOT NULL AND ends_at <= ?"),
  offer: db.prepare('SELECT * FROM property_offers WHERE id = ?'),
  offersIn: db.prepare("SELECT o.*, u.username who FROM property_offers o JOIN users u ON u.id = o.from_id WHERE o.to_id = ? AND o.status = 'open' AND o.expires_at > ? ORDER BY o.id DESC"),
  offersOut: db.prepare("SELECT o.*, u.username who FROM property_offers o JOIN users u ON u.id = o.to_id WHERE o.from_id = ? AND o.status = 'open' AND o.expires_at > ? ORDER BY o.id DESC"),
};
const uname = (id) => getUser(id)?.username || '?';

/** Who owns this asset now (and its row), or null. */
function ownerOf(kind, id) {
  if (kind === 'plot') return db.prepare('SELECT * FROM plots WHERE id = ?').get(id) || null;
  if (kind === 'biz') return db.prepare('SELECT * FROM businesses WHERE id = ?').get(id) || null;
  return null;
}
/** What a buyer would see: name, building, income, an estimate of value. */
export function describe(kind, id) {
  const row = ownerOf(kind, id);
  if (kind === 'plot') {
    const p = plotById[id];
    const b = row?.building && buildingById[row.building];
    let up = {};
    try { up = JSON.parse(row?.upgrades || '{}'); } catch {}
    return { kind, id, name: p?.name, nameEn: p?.nameEn, area: p?.area, city: p?.city, emoji: b?.emoji || '🏞️', building: b ? [b.name, b.nameEn] : null, income: b ? houseStats(b, up).incomePerHour : 0, value: row ? plotValue(row) : p?.price || 0 };
  }
  const pl = placeById[id];
  return { kind, id, name: pl?.business?.label || pl?.name, nameEn: pl?.nameEn || pl?.name, area: pl?.district, emoji: pl?.icon, building: null, income: pl?.business?.incomePerHour || 0, value: pl?.business?.price || 0 };
}
const shape = (l) => ({ ...l, asset: describe(l.kind, l.asset_id), minBid: l.top_bid ? Math.ceil(l.top_bid * (1 + PM.minRaise) / 1000) * 1000 : l.start_bid });

/** Move ownership. Income timers restart for the new owner. */
function transfer(kind, id, from, to) {
  const row = ownerOf(kind, id);
  if (!row || row.owner_id !== from) throw new GameError(['Mali hii haipo tena kwa muuzaji.', 'The seller no longer owns this.'], 409);
  const t = now();
  if (kind === 'plot') db.prepare('UPDATE plots SET owner_id = ?, bought_at = ?, last_collect = ? WHERE id = ?').run(to, t, t, id);
  else db.prepare('UPDATE businesses SET owner_id = ?, bought_at = ?, last_collect = ? WHERE id = ?').run(to, t, t, id);
  // Any other open listing/offers on it are now void.
  db.prepare("UPDATE property_offers SET status = 'void' WHERE kind = ? AND asset_id = ? AND status = 'open'").run(kind, id);
}
function refundTop(l, why) {
  if (!l.top_bidder || !l.top_bid) return;
  addMoney(l.top_bidder, l.top_bid, 'refund', `🔁 Zabuni imerudishwa — ${describe(l.kind, l.asset_id).name}`);
  if (why) emitTo(l.top_bidder, 'toast', { text: why, refresh: true });
}
let onSale = null;
export const setSaleHook = (fn) => (onSale = fn);
function payout(l, buyer, amount) {
  const fee = Math.round(amount * PM.feePct);
  transfer(l.kind, l.asset_id, l.seller_id, buyer);
  addMoney(l.seller_id, amount - fee, 'sale', `🏷️ Umeuza ${describe(l.kind, l.asset_id).name} (ada ${PM.feePct * 100}%)`);
  db.prepare("UPDATE listings SET status = 'sold', buyer_id = ?, final = ?, closed_at = ? WHERE id = ?").run(buyer, amount, now(), l.id);
  const a = describe(l.kind, l.asset_id);
  emitTo(l.seller_id, 'toast', { text: [`🏷️ ${a.name} imeuzwa kwa @${uname(buyer)} — TSh ${amount.toLocaleString()}`, `🏷️ ${a.nameEn || a.name} sold to @${uname(buyer)} for TSh ${amount.toLocaleString()}`], refresh: true });
  emitTo(buyer, 'toast', { text: [`🔑 ${a.name} ni yako sasa!`, `🔑 ${a.nameEn || a.name} is yours now!`], refresh: true });
  onSale?.({ seller: getUser(l.seller_id), buyer: getUser(buyer), asset: a, amount });
}

export function view(uid) {
  const t = now();
  return {
    listings: q.open.all().map(shape),
    mine: q.mine.all(uid, t - 3 * 86_400_000).map(shape),
    leading: q.myBids.all(uid).map((l) => l.id),
    offersIn: q.offersIn.all(uid, t).map((o) => ({ ...o, asset: describe(o.kind, o.asset_id) })),
    offersOut: q.offersOut.all(uid, t).map((o) => ({ ...o, asset: describe(o.kind, o.asset_id) })),
    rules: PM,
  };
}
/** The listing (if any) for one asset — for the plot card. */
export function listingFor(kind, id) {
  const l = q.openFor.get(kind, id);
  return l ? shape({ ...l, seller: uname(l.seller_id) }) : null;
}

export const list = db.transaction((uid, { kind, id, price, startBid, hours }) => {
  if (!['plot', 'biz'].includes(kind)) throw new GameError(['Aina haijulikani', 'Unknown kind']);
  const row = ownerOf(kind, id);
  if (!row || row.owner_id !== uid) throw new GameError(['Hii si mali yako.', "You don't own this."], 403);
  if (q.openFor.get(kind, id)) throw new GameError(['Tayari iko sokoni.', 'Already on the market.']);
  if (db.prepare("SELECT COUNT(*) n FROM listings WHERE seller_id = ? AND status = 'open'").get(uid).n >= PM.maxListings) throw new GameError([`Kikomo ni matangazo ${PM.maxListings}.`, `You can have ${PM.maxListings} listings at once.`]);
  price = Math.floor(Number(price) || 0) || null;
  startBid = Math.floor(Number(startBid) || 0) || null;
  if (!price && !startBid) throw new GameError(['Weka bei au zabuni ya kuanzia.', 'Set a price or a starting bid.']);
  if ((price && price < 100_000) || (startBid && startBid < 100_000)) throw new GameError(['Bei ya chini ni TSh 100,000.', 'The minimum is TSh 100,000.']);
  if (price && startBid && startBid >= price) throw new GameError(['Zabuni ya kuanzia iwe chini ya bei ya "nunua sasa".', 'The starting bid must be below the buy-now price.']);
  const h = PM.hours.includes(Number(hours)) ? Number(hours) : 24;
  const info = db.prepare('INSERT INTO listings (kind, asset_id, seller_id, price, start_bid, ends_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(kind, id, uid, price, startBid, startBid ? now() + h * 3600_000 : null, now());
  const a = describe(kind, id);
  broadcast('toast', { text: [`🏷️ Sokoni: ${a.name}${startBid ? ' — mnada umeanza!' : ''}`, `🏷️ On the market: ${a.nameEn || a.name}${startBid ? ' — auction open!' : ''}`] });
  return { id: info.lastInsertRowid, ...view(uid) };
});

export const cancel = db.transaction((uid, id) => {
  const l = q.listing.get(Number(id));
  if (!l || l.seller_id !== uid || l.status !== 'open') throw new GameError(['Haipo', 'Not found'], 404);
  if (l.top_bidder) throw new GameError(['Kuna zabuni tayari — mnada lazima uishe.', 'There are bids already — the auction has to finish.']);
  db.prepare("UPDATE listings SET status = 'cancelled', closed_at = ? WHERE id = ?").run(now(), l.id);
  return view(uid);
});

export const bid = db.transaction((uid, id, amountIn) => {
  const l = q.listing.get(Number(id));
  if (!l || l.status !== 'open' || !l.start_bid) throw new GameError(['Mnada haupo.', 'No auction here.'], 404);
  if (l.seller_id === uid) throw new GameError(['Huwezi kununua mali yako.', "You can't bid on your own property."]);
  if (l.ends_at <= now()) throw new GameError(['Mnada umeisha.', 'The auction has ended.']);
  const min = shape(l).minBid;
  const amount = Math.floor(Number(amountIn) || 0);
  if (amount < min) throw new GameError([`Zabuni ya chini ni TSh ${min.toLocaleString()}.`, `The minimum bid is TSh ${min.toLocaleString()}.`]);
  if (l.price && amount >= l.price) throw new GameError(['Hiyo ni zaidi ya bei ya "nunua sasa" — nunua moja kwa moja.', 'That beats the buy-now price — just buy it.']);
  // The money is held until you're outbid or the auction ends.
  addMoney(uid, -amount, 'purchase', `🔨 Zabuni: ${describe(l.kind, l.asset_id).name}`);
  const a = describe(l.kind, l.asset_id);
  if (l.top_bidder && l.top_bidder !== uid) refundTop(l, [`⚠️ Umezidiwa kwenye mnada wa ${a.name} — pesa yako imerudi.`, `⚠️ You've been outbid on ${a.nameEn || a.name} — your money is back.`]);
  else if (l.top_bidder === uid) refundTop(l);
  const ends = l.ends_at - now() < PM.snipeMs ? l.ends_at + PM.snipeMs : l.ends_at;
  db.prepare('UPDATE listings SET top_bid = ?, top_bidder = ?, bids = bids + 1, ends_at = ? WHERE id = ?').run(amount, uid, ends, l.id);
  emitTo(l.seller_id, 'toast', { text: [`🔨 Zabuni mpya: TSh ${amount.toLocaleString()} kwa ${a.name}`, `🔨 New bid: TSh ${amount.toLocaleString()} on ${a.nameEn || a.name}`] });
  return view(uid);
});

export const buyNow = db.transaction((uid, id) => {
  const l = q.listing.get(Number(id));
  if (!l || l.status !== 'open' || !l.price) throw new GameError(['Haiuzwi kwa bei hiyo.', 'Not for sale at a fixed price.'], 404);
  if (l.seller_id === uid) throw new GameError(['Hii ni yako tayari 😅', 'It’s already yours 😅']);
  addMoney(uid, -l.price, 'purchase', `🔑 Umenunua ${describe(l.kind, l.asset_id).name}`);
  refundTop(l, [`ℹ️ ${describe(l.kind, l.asset_id).name} imenunuliwa moja kwa moja — zabuni yako imerudi.`, `ℹ️ ${describe(l.kind, l.asset_id).nameEn} was bought outright — your bid is refunded.`]);
  payout(l, uid, l.price);
  return view(uid);
});

export const offer = db.transaction((uid, { kind, id, amount }) => {
  const row = ownerOf(kind, id);
  if (!row) throw new GameError(['Haina mmiliki — inunue moja kwa moja.', 'Nobody owns it — buy it directly.']);
  if (row.owner_id === uid) throw new GameError(['Hii ni yako tayari.', 'It’s already yours.']);
  amount = Math.floor(Number(amount) || 0);
  if (amount < 100_000) throw new GameError(['Ofa ya chini ni TSh 100,000.', 'The minimum offer is TSh 100,000.']);
  if (getUser(uid).money < amount) throw new GameError(['Huna pesa ya kutosha kwa ofa hii.', "You don't have enough money for that offer."]);
  db.prepare("UPDATE property_offers SET status = 'withdrawn' WHERE from_id = ? AND kind = ? AND asset_id = ? AND status = 'open'").run(uid, kind, id);
  db.prepare('INSERT INTO property_offers (kind, asset_id, from_id, to_id, amount, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(kind, id, uid, row.owner_id, amount, now(), now() + PM.offerTtlMs);
  const a = describe(kind, id);
  emitTo(row.owner_id, 'toast', { text: [`💼 @${uname(uid)} anataka kununua ${a.name} kwa TSh ${amount.toLocaleString()} — angalia Soko la Mali.`, `💼 @${uname(uid)} offers TSh ${amount.toLocaleString()} for your ${a.nameEn || a.name} — check the Property market.`] });
  return view(uid);
});

export const answerOffer = db.transaction((uid, id, action) => {
  const o = q.offer.get(Number(id));
  if (!o || o.status !== 'open' || o.expires_at < now()) throw new GameError(['Ofa haipo tena.', 'That offer is no longer open.'], 404);
  if (action === 'withdraw') {
    if (o.from_id !== uid) throw new GameError(['Haipo', 'Not found'], 404);
    db.prepare("UPDATE property_offers SET status = 'withdrawn' WHERE id = ?").run(o.id);
    return view(uid);
  }
  if (o.to_id !== uid) throw new GameError(['Haipo', 'Not found'], 404);
  if (action === 'decline') {
    db.prepare("UPDATE property_offers SET status = 'declined' WHERE id = ?").run(o.id);
    emitTo(o.from_id, 'toast', { text: [`🙅 @${uname(uid)} amekataa ofa yako.`, `🙅 @${uname(uid)} declined your offer.`] });
    return view(uid);
  }
  // Accept: the buyer pays now (if they still can), then ownership moves.
  if (getUser(o.from_id).money < o.amount) throw new GameError(['Mnunuzi hana pesa ya kutosha tena.', "The buyer can't afford it any more."], 409);
  const open = q.openFor.get(o.kind, o.asset_id);
  if (open?.top_bidder) throw new GameError(['Kuna mnada unaoendelea — subiri uishe.', 'There’s a live auction on it — wait for it to end.'], 409);
  if (open) db.prepare("UPDATE listings SET status = 'cancelled', closed_at = ? WHERE id = ?").run(now(), open.id);
  addMoney(o.from_id, -o.amount, 'purchase', `🔑 Umenunua ${describe(o.kind, o.asset_id).name}`);
  db.prepare("UPDATE property_offers SET status = 'accepted' WHERE id = ?").run(o.id);
  const fake = db.prepare('INSERT INTO listings (kind, asset_id, seller_id, price, created_at) VALUES (?, ?, ?, ?, ?)').run(o.kind, o.asset_id, uid, o.amount, now());
  payout(q.listing.get(fake.lastInsertRowid), o.from_id, o.amount);
  return view(uid);
});

/** Every 30s: close finished auctions. */
export const marketTick = db.transaction(() => {
  for (const l of q.ended.all(now())) {
    const a = describe(l.kind, l.asset_id);
    if (!l.top_bidder) {
      db.prepare("UPDATE listings SET status = 'expired', closed_at = ? WHERE id = ?").run(now(), l.id);
      emitTo(l.seller_id, 'toast', { text: [`⌛ Mnada wa ${a.name} umeisha bila zabuni.`, `⌛ The auction for ${a.nameEn || a.name} ended with no bids.`] });
      continue;
    }
    const row = ownerOf(l.kind, l.asset_id);
    if (!row || row.owner_id !== l.seller_id) {
      refundTop(l, [`ℹ️ Mnada wa ${a.name} umefutwa — pesa yako imerudi.`, `ℹ️ The auction for ${a.nameEn || a.name} was voided — your money is back.`]);
      db.prepare("UPDATE listings SET status = 'cancelled', closed_at = ? WHERE id = ?").run(now(), l.id);
      continue;
    }
    // The winner already paid (held bid): just move the asset and pay the seller.
    payout(l, l.top_bidder, l.top_bid);
  }
});
