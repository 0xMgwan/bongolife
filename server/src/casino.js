// Casino games — server-side randomness so nobody can cheat. Game money only.
import { CASINO, placeById } from '../../shared/world.js';
import { db, getUser, addMoney, GameError, now } from './db.js';
import { online } from './presence.js';

function atCasino(userId) {
  const p = online.get(userId);
  const c = placeById.casino;
  const u = getUser(userId);
  const x = p?.x ?? u.x;
  const z = p?.z ?? u.z;
  const dx = Math.max(Math.abs(x - c.pos[0]) - c.size[0] / 2, 0);
  const dz = Math.max(Math.abs(z - c.pos[1]) - c.size[1] / 2, 0);
  if (Math.hypot(dx, dz) > 18) throw new GameError(['Nenda Le Grande Casino kwanza.', 'Go to Le Grande Casino first.']);
  if (u.jail) throw new GameError(['Uko mikononi mwa polisi.', "You're in police custody."], 403);
}
function takeBet(userId, bet, what) {
  bet = Math.floor(Number(bet));
  if (!(bet >= CASINO.minBet && bet <= CASINO.maxBet)) throw new GameError([`Dau ni kati ya TSh ${CASINO.minBet.toLocaleString()} na ${CASINO.maxBet.toLocaleString()}.`, `Bets are between TSh ${CASINO.minBet.toLocaleString()} and ${CASINO.maxBet.toLocaleString()}.`]);
  if (getUser(userId).money < bet) throw new GameError(['Huna pesa ya kutosha.', "You don't have enough money."]);
  addMoney(userId, -bet, 'casino', what);
  return bet;
}
const pay = (userId, amount, what) => amount > 0 && addMoney(userId, amount, 'casino', what);

// ----------------------------------------------------------------- slots
function spinReel() {
  const { symbols, weights } = CASINO.slots;
  let r = Math.random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < symbols.length; i++) { r -= weights[i]; if (r <= 0) return i; }
  return 0;
}
export const slots = db.transaction((userId, bet) => {
  atCasino(userId);
  bet = takeBet(userId, bet, 'Slot machine');
  const reels = [spinReel(), spinReel(), spinReel()];
  let mult = 0;
  if (reels[0] === reels[1] && reels[1] === reels[2]) mult = CASINO.slots.three[reels[0]];
  else if (reels.filter((r) => r === 0).length === 2) mult = CASINO.slots.twoCherries;
  const win = Math.round(bet * mult);
  pay(userId, win, 'Ushindi wa slot');
  return { reels: reels.map((i) => CASINO.slots.symbols[i]), win, mult };
});

// -------------------------------------------------------------- roulette
export const roulette = db.transaction((userId, bet, pick) => {
  atCasino(userId);
  const valid = pick === 'red' || pick === 'black' || pick === 'even' || pick === 'odd' || (Number.isInteger(pick) && pick >= 0 && pick <= 36);
  if (!valid) throw new GameError(['Chagua rangi au namba.', 'Pick a colour or a number.']);
  bet = takeBet(userId, bet, 'Roulette');
  const n = Math.floor(Math.random() * 37);
  const red = CASINO.roulette.redNumbers.includes(n);
  let mult = 0;
  if (Number.isInteger(pick)) mult = pick === n ? 36 : 0;
  else if (n !== 0) {
    if ((pick === 'red' && red) || (pick === 'black' && !red) || (pick === 'even' && n % 2 === 0) || (pick === 'odd' && n % 2 === 1)) mult = 2;
  }
  const win = bet * mult;
  pay(userId, win, 'Ushindi wa roulette');
  return { n, color: n === 0 ? 'green' : red ? 'red' : 'black', win };
});

// ------------------------------------------------------------- blackjack
const tables = new Map(); // userId -> { deck, player, dealer, bet }
const newDeck = () => {
  const d = [];
  for (const s of ['♠', '♥', '♦', '♣']) for (const r of ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']) d.push(r + s);
  for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
  return d;
};
export const handValue = (cards) => {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    const r = c.slice(0, -1);
    if (r === 'A') { aces++; total += 11; } else total += ['J', 'Q', 'K'].includes(r) ? 10 : Number(r);
  }
  while (total > 21 && aces--) total -= 10;
  return total;
};
function settle(userId, t, outcome) {
  tables.delete(userId);
  const win = outcome === 'blackjack' ? Math.round(t.bet * 2.5) : outcome === 'win' ? t.bet * 2 : outcome === 'push' ? t.bet : 0;
  pay(userId, win, 'Blackjack');
  return { player: t.player, dealer: t.dealer, pv: handValue(t.player), dv: handValue(t.dealer), outcome, win, done: true };
}
function dealerPlay(userId, t) {
  while (handValue(t.dealer) < 17) t.dealer.push(t.deck.pop());
  const pv = handValue(t.player);
  const dv = handValue(t.dealer);
  return settle(userId, t, dv > 21 || pv > dv ? 'win' : pv === dv ? 'push' : 'lose');
}
const view = (t) => ({ player: t.player, dealer: [t.dealer[0], '🂠'], pv: handValue(t.player), dv: handValue([t.dealer[0]]), bet: t.bet, done: false });
export const bjDeal = db.transaction((userId, bet) => {
  atCasino(userId);
  if (tables.has(userId)) return view(tables.get(userId));
  bet = takeBet(userId, bet, 'Blackjack');
  const deck = newDeck();
  const t = { deck, bet, player: [deck.pop(), deck.pop()], dealer: [deck.pop(), deck.pop()], at: now() };
  tables.set(userId, t);
  if (handValue(t.player) === 21) return settle(userId, t, handValue(t.dealer) === 21 ? 'push' : 'blackjack');
  return view(t);
});
export const bjHit = db.transaction((userId) => {
  const t = tables.get(userId);
  if (!t) throw new GameError(['Hakuna mchezo.', 'No hand in play.']);
  t.player.push(t.deck.pop());
  const pv = handValue(t.player);
  if (pv > 21) return settle(userId, t, 'lose');
  if (pv === 21) return dealerPlay(userId, t);
  return view(t);
});
export const bjStand = db.transaction((userId) => {
  const t = tables.get(userId);
  if (!t) throw new GameError(['Hakuna mchezo.', 'No hand in play.']);
  return dealerPlay(userId, t);
});
export const bjDouble = db.transaction((userId) => {
  const t = tables.get(userId);
  if (!t || t.player.length !== 2) throw new GameError(['Huwezi kudouble sasa.', "You can't double now."]);
  takeBet(userId, t.bet, 'Blackjack double');
  t.bet *= 2;
  t.player.push(t.deck.pop());
  if (handValue(t.player) > 21) return settle(userId, t, 'lose');
  return dealerPlay(userId, t);
});
