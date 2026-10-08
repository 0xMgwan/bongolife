import { useEffect, useState } from 'react';

const SHOW = 6000;
const EXIT = 400;
const GAP = 40_000;

/**
 * Announcements (city event, admin notice) slide in from the right edge, hold, then tuck away
 * to a small tab on the edge. They come back on their own every so often, when the text changes,
 * or when the tab is tapped. One at a time, cycling if there are several.
 */
export function SidePop({ items }) {
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState('in'); // in → out → tab → in (next)
  const sig = items.map((i) => i.key + i.text).join('|');
  // New or changed message: show it straight away.
  useEffect(() => { setIdx(0); setPhase('in'); }, [sig]);
  useEffect(() => {
    if (!items.length) return;
    const ms = phase === 'in' ? SHOW : phase === 'out' ? EXIT : GAP;
    const t = setTimeout(() => {
      if (phase === 'in') setPhase('out');
      else if (phase === 'out') setPhase('tab');
      else { setIdx((i) => i + 1); setPhase('in'); }
    }, ms);
    return () => clearTimeout(t);
  }, [phase, idx, sig]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!items.length) return null;
  const item = items[idx % items.length];
  const icon = Array.from(item.text.trim())[0];
  if (phase === 'tab') {
    return (
      <button className={`side-tab ${item.tone}`} onClick={() => setPhase('in')} aria-label={item.text}>
        {icon}{items.length > 1 && <b>{items.length}</b>}
      </button>
    );
  }
  return (
    <button key={idx} className={`side-pop ${item.tone} ${phase === 'out' ? 'leaving' : ''}`} onClick={() => setPhase('out')} role="status">
      <span>{item.text}</span>
      <i style={{ animationDuration: `${SHOW}ms` }} />
    </button>
  );
}
