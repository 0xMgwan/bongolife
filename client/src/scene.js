import { ENTERABLE, sceneFor } from '@shared/world.js';

/** The interior/set-piece to show: the venue you're in, or the activity you're doing. */
export function activeScene({ me, inside }) {
  const busy = me?.busy && me.busy.endsAt > Date.now() - 2000 ? me.busy : null;
  if (inside && ENTERABLE[inside]) return { key: ENTERABLE[inside], placeId: inside, busy: busy?.placeId === inside ? busy : null };
  const key = sceneFor(busy);
  return key ? { key, placeId: busy.placeId, busy } : null;
}
