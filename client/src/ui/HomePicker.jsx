// The 🏠 button: if you own buildings on plots, pick where to go — your Kwangu apartment or any
// house, tower, farm, factory or resort you've built. Otherwise it goes straight to Kwangu.
import { plotById, buildingById, ENTERABLE_BUILDINGS, HOME_LEVELS, fmtShort } from '@shared/world.js';
import { useStore } from '../store.js';
import { enterBlock } from '../net.js';
import { L, loc } from '../i18n.js';
import { sfx } from '../audio.js';

const built = (me) => (me?.plots || []).filter((p) => p.building && ENTERABLE_BUILDINGS.includes(p.building));
const goKwangu = () => useStore.setState({ tab: 'home', visiting: null, sheet: null, cityView: 'follow', homePick: false });

export function goHome() {
  sfx('open');
  if (built(useStore.getState().me).length) useStore.setState({ homePick: true });
  else goKwangu();
}

export function HomePicker() {
  const open = useStore((s) => s.homePick);
  const me = useStore((s) => s.me);
  if (!open || !me) return null;
  const close = () => useStore.setState({ homePick: false });
  const lvl = HOME_LEVELS[me.homeLevel || 0];
  const list = built(me);
  return (
    <div className="sheet-wrap" onClick={close}>
      <div className="sheet home-pick" onClick={(e) => e.stopPropagation()}>
        <div className="hp-head"><b>🏠 {L('Unaenda wapi?', 'Where to?')}</b><button className="x" onClick={close} aria-label={L('Funga', 'Close')}>✕</button></div>
        <div className="hp-list">
          <button className="hp-card kwangu" onClick={goKwangu}>
            <span className="hp-em">{lvl.emoji}</span>
            <span className="grow"><b>{L('Kwangu', 'My place')}</b><small>{L(lvl.name, lvl.nameEn)} · {L('panga samani, alika marafiki', 'decorate, invite friends')}</small></span>
            <span className="hp-go">→</span>
          </button>
          {list.map((p) => {
            const b = buildingById[p.building];
            const plot = plotById[p.id];
            return (
              <button key={p.id} className="hp-card" style={{ '--hp': b.color }} onClick={() => { useStore.setState({ homePick: false, tab: 'town', visiting: null }); enterBlock(p.id); }}>
                <span className="hp-em">{b.emoji || '🏠'}</span>
                <span className="grow"><b>{loc(b)}</b><small>📍 {loc(plot)}{b.incomePerHour ? ` · +${fmtShort(b.incomePerHour)}/${L('saa', 'hr')}` : ''}</small></span>
                <span className="hp-go">🚪</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
