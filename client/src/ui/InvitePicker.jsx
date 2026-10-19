// "Invite to…": pick which of your places a friend is invited to — Kwangu, a house on a plot,
// your yacht or jet, or any building you own (tower, farm, factory, resort…).
import { plotById, buildingById, luxuryById, ENTERABLE_BUILDINGS, PRIVATE_BUILDINGS, HOME_LEVELS } from '@shared/world.js';
import { useStore } from '../store.js';
import { api } from '../api.js';
import { enterBlock } from '../net.js';
import { L, loc } from '../i18n.js';
import { sfx } from '../audio.js';

const toast = (...a) => useStore.getState().toast(...a);

/** Everything you could invite someone to. */
async function myPlaces(me) {
  const lvl = HOME_LEVELS[me.homeLevel || 0];
  const out = [{ kind: 'home', id: 'main', emoji: lvl?.emoji || '🏠', title: L('Kwangu', 'My place'), sub: L(lvl.name, lvl.nameEn) }];
  for (const p of me.plots || []) {
    const b = p.building && buildingById[p.building];
    if (!b || !ENTERABLE_BUILDINGS.includes(b.id)) continue;
    out.push({ kind: PRIVATE_BUILDINGS.includes(b.id) ? 'home' : 'block', id: p.id, emoji: b.emoji || '🏠', title: loc(b), sub: `📍 ${loc(plotById[p.id])}`, color: b.color });
  }
  const lux = await api('/luxury').catch(() => null);
  for (const kind of ['yacht', 'jet']) {
    // Guests board your best one of each kind.
    const best = (lux?.mine || []).filter((m) => m.kind === kind).sort((a, b) => (luxuryById[b.model]?.price || 0) - (luxuryById[a.model]?.price || 0))[0];
    if (best) out.push({ kind, id: kind, emoji: luxuryById[best.model]?.emoji || (kind === 'jet' ? '🛩️' : '🛥️'), title: best.name, sub: kind === 'jet' ? L('Jet binafsi', 'Private jet') : L('Yacht', 'Yacht'), color: best.color });
  }
  return out;
}

export async function sendPlaceInvite(username, opt) {
  const r = await useStore.getState().run('/invite/place', { method: 'POST', body: { to: username, kind: opt.kind, id: opt.id } });
  useStore.setState({ invitePick: null });
  if (r) { sfx('pop'); toast(L(`📨 Umemwalika @${username} — ${opt.title}`, `📨 Invited @${username} to ${opt.title}`)); }
}

/** Opens the picker (or invites straight to Kwangu if that's all you have). */
export async function pickInvite(username) {
  const me = useStore.getState().me;
  if (!me) return;
  const places = await myPlaces(me);
  if (places.length === 1) return sendPlaceInvite(username, places[0]);
  useStore.setState({ invitePick: { username, places } });
}

export function InvitePicker() {
  const pick = useStore((s) => s.invitePick);
  if (!pick) return null;
  const close = () => useStore.setState({ invitePick: null });
  return (
    <div className="sheet-wrap" onClick={close}>
      <div className="sheet home-pick" onClick={(e) => e.stopPropagation()}>
        <div className="hp-head"><b>📨 {L(`Mwalike @${pick.username}…`, `Invite @${pick.username} to…`)}</b><button className="x" onClick={close} aria-label={L('Funga', 'Close')}>✕</button></div>
        <div className="hp-list">
          {pick.places.map((o) => (
            <button key={o.kind + o.id} className={`hp-card ${o.id === 'main' ? 'kwangu' : ''}`} style={{ '--hp': o.color || '#fde68a' }} onClick={() => sendPlaceInvite(pick.username, o)}>
              <span className="hp-em">{o.emoji}</span>
              <span className="grow"><b>{o.title}</b><small>{o.sub}</small></span>
              <span className="hp-go">📨</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** "@x invited you to their factory/farm/hotel…" */
export function BlockInviteModal() {
  const inv = useStore((s) => s.blockInvite);
  if (!inv) return null;
  const no = () => useStore.setState({ blockInvite: null });
  const yes = () => {
    useStore.setState({ blockInvite: null, homePick: false, visiting: null });
    enterBlock(inv.plotId);
    toast(L(`${inv.house[2]} Karibu ${inv.house[0]} ya @${inv.from}!`, `${inv.house[2]} Welcome to @${inv.from}'s ${inv.house[1]}!`));
  };
  return (
    <div className="modal-wrap">
      <div className="modal card pop">
        <div className="big">{inv.house[2]}</div>
        <h3>{L('Mwaliko!', 'Invitation!')}</h3>
        <p className="muted">{L(`@${inv.from} anakualika kwenye ${inv.house[0]} yake${inv.area ? ` ${inv.area}` : ''}.`, `@${inv.from} is inviting you to their ${inv.house[1]}${inv.area ? ` in ${inv.area}` : ''}.`)}</p>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn-ghost grow" onClick={no}>{L('Sasa hivi siwezi', 'Not now')}</button>
          <button className="btn btn-green grow" onClick={yes}>✓ {L('Nakuja!', "I'm coming!")}</button>
        </div>
      </div>
    </div>
  );
}
