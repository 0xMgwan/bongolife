import { YARD, YARD_BLOCKS, fmtShort } from '@shared/world.js';
import { useStore } from '../store.js';
import { L, loc } from '../i18n.js';

/** Go home and switch on build mode (camera glides to the yard). */
export function startBuild() {
  useStore.setState({ tab: 'home', visiting: null, phone: null, sheet: null, placing: null, building: { kind: 'brick', erase: false } });
}

/** Build mode: the block palette, remove toggle, Done. Floats over the game. */
export function BuildBar() {
  const build = useStore((s) => s.building);
  const yard = useStore((s) => s.yard);
  const me = useStore((s) => s.me);
  if (!build || !me) return null;
  const set = (patch) => useStore.setState({ building: { ...build, ...patch } });
  const count = yard?.blocks?.length || 0;
  return (
    <div className="build-bar">
      <div className="bb-head">
        <b>🔨 {L('Jenga', 'Build')}</b>
        <span>{count}/{YARD.maxBlocks} · TSh {fmtShort(me.money)}</span>
        <button className={`bb-tool ${build.erase ? 'on' : ''}`} onClick={() => set({ erase: !build.erase })} aria-pressed={build.erase}>🧹 {L('Ondoa', 'Remove')}</button>
        <button className="bb-done" onClick={() => useStore.setState({ building: null })}>{L('Maliza', 'Done')}</button>
      </div>
      <div className="bb-palette" role="listbox" aria-label={L('Vitu vya kujenga', 'Blocks')}>
        {YARD_BLOCKS.map((b) => (
          <button key={b.id} role="option" aria-selected={!build.erase && build.kind === b.id} className={`bb-block ${!build.erase && build.kind === b.id ? 'on' : ''}`} onClick={() => set({ kind: b.id, erase: false })}>
            <span>{b.emoji}</span>
            <b>{loc(b)}</b>
            <small>{fmtShort(b.price)}</small>
          </button>
        ))}
      </div>
      <div className="bb-hint">{build.erase ? L('Gusa kitu ili ukiondoe (unarudishiwa nusu).', 'Tap a block to remove it (half back).') : L('Gusa ardhi au upande wa kitu kuweka.', 'Tap the ground or the side of a block to place.')}</div>
    </div>
  );
}
