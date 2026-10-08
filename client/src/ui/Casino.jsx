import { useEffect, useRef, useState } from 'react';
import { CASINO, fmtTsh, fmtShort } from '@shared/world.js';
import { useStore } from '../store.js';
import { api } from '../api.js';
import { L } from '../i18n.js';
import { sfx } from '../audio.js';
import { haptic } from '../haptics.js';

const BETS = [1_000, 5_000, 10_000, 50_000, 100_000, 500_000];
const call = async (path, body) => {
  try {
    const r = await api(path, { method: 'POST', body });
    if (r.me) useStore.setState({ me: r.me });
    return r;
  } catch (e) {
    useStore.getState().toast(e.message, 'err');
    return null;
  }
};

function BetPicker({ bet, setBet, disabled }) {
  const money = useStore((s) => s.me.money);
  return (
    <div className="bet-row">
      {BETS.map((b) => <button key={b} className={bet === b ? 'on' : ''} disabled={disabled || b > money} onClick={() => setBet(b)}>{fmtShort(b)}</button>)}
    </div>
  );
}

function Slots() {
  const [bet, setBet] = useState(5_000);
  const [reels, setReels] = useState(['🍒', '⭐', '7️⃣']);
  const [spinning, setSpinning] = useState(false);
  const [msg, setMsg] = useState(null);
  const timer = useRef();
  useEffect(() => () => clearInterval(timer.current), []);
  const spin = async () => {
    setSpinning(true);
    setMsg(null);
    sfx('click');
    const S = CASINO.slots.symbols;
    timer.current = setInterval(() => setReels([0, 1, 2].map(() => S[Math.floor(Math.random() * S.length)])), 70);
    const [r] = await Promise.all([call('/casino/slots', { bet }), new Promise((ok) => setTimeout(ok, 1100))]);
    clearInterval(timer.current);
    setSpinning(false);
    if (!r) return;
    setReels(r.reels);
    if (r.win > 0) { sfx(r.mult >= 25 ? 'levelup' : 'cash'); haptic('success'); setMsg(L(`🎉 Umeshinda ${fmtTsh(r.win)}!`, `🎉 You won ${fmtTsh(r.win)}!`)); }
    else setMsg(L('Bahati mbaya — jaribu tena!', 'No luck — spin again!'));
  };
  return (
    <div className="game">
      <div className={`reels ${spinning ? 'spin' : ''}`}>{reels.map((s, i) => <span key={i}>{s}</span>)}</div>
      <div className="paytable">7️⃣7️⃣7️⃣ ×150 · 💎💎💎 ×50 · ⭐⭐⭐ ×25 · 🔔🔔🔔 ×12 · 🍋🍋🍋 ×8 · 🍒🍒🍒 ×5 · 🍒🍒 ×2</div>
      <BetPicker bet={bet} setBet={setBet} disabled={spinning} />
      <button className="btn btn-green btn-block" disabled={spinning} onClick={spin}>{spinning ? L('Inazunguka…', 'Spinning…') : `🎰 ${L('Zungusha', 'Spin')} · ${fmtTsh(bet)}`}</button>
      {msg && <div className="game-msg">{msg}</div>}
    </div>
  );
}

const Card = ({ c }) => {
  const red = /[♥♦]/.test(c);
  return <span className={`card-c ${c === '🂠' ? 'back' : ''} ${red ? 'red' : ''}`}>{c === '🂠' ? '' : c}</span>;
};
function Blackjack() {
  const [bet, setBet] = useState(10_000);
  const [hand, setHand] = useState(null);
  const [busy, setBusy] = useState(false);
  const act = async (path, body) => {
    setBusy(true);
    sfx('click');
    const r = await call(path, body);
    setBusy(false);
    if (!r) return;
    setHand(r);
    if (r.done) {
      if (r.win > r.bet || r.outcome === 'win' || r.outcome === 'blackjack') { sfx('cash'); haptic('success'); } else if (r.outcome === 'lose') sfx('error');
    }
  };
  const done = !hand || hand.done;
  const outcome = hand?.done && {
    blackjack: L(`🂡 BLACKJACK! +${fmtTsh(hand.win)}`, `🂡 BLACKJACK! +${fmtTsh(hand.win)}`),
    win: L(`🎉 Umeshinda ${fmtTsh(hand.win)}`, `🎉 You win ${fmtTsh(hand.win)}`),
    push: L('🤝 Sare — dau limerudi', '🤝 Push — bet returned'),
    lose: L('😬 Dealer ameshinda', '😬 Dealer wins'),
  }[hand.outcome];
  return (
    <div className="game">
      <div className="bj-hand"><small>{L('Dealer', 'Dealer')} {hand ? `· ${hand.dv}` : ''}</small><div>{(hand?.dealer || ['🂠', '🂠']).map((c, i) => <Card key={i} c={c} />)}</div></div>
      <div className="bj-hand"><small>{L('Wewe', 'You')} {hand ? `· ${hand.pv}` : ''}</small><div>{(hand?.player || ['🂠', '🂠']).map((c, i) => <Card key={i} c={c} />)}</div></div>
      {outcome && <div className="game-msg">{outcome}</div>}
      {done ? (
        <>
          <BetPicker bet={bet} setBet={setBet} disabled={busy} />
          <button className="btn btn-green btn-block" disabled={busy} onClick={() => act('/casino/blackjack/deal', { bet })}>🃏 {L('Gawa karata', 'Deal')} · {fmtTsh(bet)}</button>
        </>
      ) : (
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn-dark grow" disabled={busy} onClick={() => act('/casino/blackjack/hit')}>{L('Ongeza', 'Hit')}</button>
          <button className="btn btn-green grow" disabled={busy} onClick={() => act('/casino/blackjack/stand')}>{L('Simama', 'Stand')}</button>
          {hand.player.length === 2 && <button className="btn btn-ghost grow" disabled={busy} onClick={() => act('/casino/blackjack/double')}>×2 {L('Double', 'Double')}</button>}
        </div>
      )}
    </div>
  );
}

function Roulette() {
  const [bet, setBet] = useState(5_000);
  const [pick, setPick] = useState('red');
  const [res, setRes] = useState(null);
  const [angle, setAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const spin = async () => {
    setSpinning(true);
    setRes(null);
    sfx('click');
    setAngle((a) => a + 1440 + Math.random() * 360);
    const [r] = await Promise.all([call('/casino/roulette', { bet, pick }), new Promise((ok) => setTimeout(ok, 2200))]);
    setSpinning(false);
    if (!r) return;
    setRes(r);
    if (r.win) { sfx('cash'); haptic('success'); } else sfx('error');
  };
  const reds = CASINO.roulette.redNumbers;
  return (
    <div className="game">
      <div className="wheel-wrap">
        <div className="wheel" style={{ transform: `rotate(${angle}deg)` }} />
        <div className="wheel-ball">{res ? <b className={res.color}>{res.n}</b> : '🎡'}</div>
      </div>
      <div className="rl-picks">
        {[['red', L('Nyekundu', 'Red')], ['black', L('Nyeusi', 'Black')], ['even', L('Shufwa', 'Even')], ['odd', L('Witiri', 'Odd')]].map(([id, n]) => (
          <button key={id} className={`${pick === id ? 'on' : ''} ${id}`} onClick={() => setPick(id)}>{n} ×2</button>
        ))}
      </div>
      <div className="rl-nums">
        {Array.from({ length: 37 }, (_, n) => (
          <button key={n} className={`${pick === n ? 'on' : ''} ${n === 0 ? 'green' : reds.includes(n) ? 'red' : 'black'}`} onClick={() => setPick(n)}>{n}</button>
        ))}
      </div>
      <BetPicker bet={bet} setBet={setBet} disabled={spinning} />
      <button className="btn btn-green btn-block" disabled={spinning} onClick={spin}>{spinning ? L('Gurudumu linazunguka…', 'Wheel spinning…') : `🎡 ${L('Zungusha', 'Spin')} · ${typeof pick === 'number' ? `#${pick} ×36` : '×2'} · ${fmtTsh(bet)}`}</button>
      {res && <div className="game-msg">{res.win ? L(`🎉 ${res.n}! Umeshinda ${fmtTsh(res.win)}`, `🎉 ${res.n}! You win ${fmtTsh(res.win)}`) : L(`${res.n} — umekosa`, `${res.n} — no win`)}</div>}
    </div>
  );
}

/** Le Grande Casino table games. Game money only — it can never be cashed out. */
export function CasinoModal() {
  const game = useStore((s) => s.casino);
  const money = useStore((s) => s.me?.money ?? 0);
  if (!game) return null;
  const close = () => { sfx('close'); useStore.setState({ casino: null }); };
  const tabs = [['slots', '🎰 Slots'], ['blackjack', '🃏 Blackjack'], ['roulette', '🎡 Roulette']];
  return (
    <div className="modal-wrap casino-wrap" onClick={close}>
      <div className="casino card pop" onClick={(e) => e.stopPropagation()}>
        <div className="row between">
          <b>🎰 Le Grande Casino</b>
          <span className="pd-money">💵 {fmtShort(money)}</span>
          <button className="pd-btn" onClick={close} aria-label={L('Funga', 'Close')}>✕</button>
        </div>
        <div className="seg" style={{ margin: '10px 0' }}>
          {tabs.map(([id, n]) => <button key={id} className={game === id ? 'on' : ''} onClick={() => useStore.setState({ casino: id })}>{n}</button>)}
        </div>
        {game === 'slots' && <Slots />}
        {game === 'blackjack' && <Blackjack />}
        {game === 'roulette' && <Roulette />}
        <div className="casino-note">{L('Pesa ya mchezo tu — haiwezi kutolewa. Cheza kwa burudani. 18+', 'Game money only — it can never be cashed out. Play for fun. 18+')}</div>
      </div>
    </div>
  );
}
