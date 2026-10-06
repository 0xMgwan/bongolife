import { placeById } from '@shared/world.js';
import { placeDoor } from './three/Players.jsx';
import { useStore } from './store.js';
import { local } from './net.js';
import { L, loc } from './i18n.js';

/** Walk to a spot and run `then` on arrival (or now, if already there). */
export function walkTo(pos, then, label) {
  const d = Math.hypot(pos[0] - local.x, pos[1] - local.z);
  if (d < 3) {
    local.target = null;
    then?.();
    return;
  }
  local.target = pos;
  local.arrive = then || null;
  if (label) useStore.getState().toast(L(`🚶 Unaelekea ${label}…`, `🚶 Heading to ${label}…`));
}

export function goToPlace(placeId, open = true) {
  const p = placeById[placeId];
  walkTo(placeDoor(placeId), open ? () => useStore.setState({ sheet: { type: 'place', id: placeId } }) : null, loc(p));
}

