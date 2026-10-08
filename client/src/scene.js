import { venueOf, sceneFor } from '@shared/world.js';

/** The interior/set-piece to show: the venue you're in, or the activity you're doing. */
export function activeScene({ me, inside }) {
  // In custody you're shown in the cells or the courtroom.
  const j = me?.jail;
  if (j?.phase === 'court') return { key: 'court', placeId: 'mahakama', busy: null, jail: j };
  if (j) return { key: 'police', placeId: 'polisi', busy: null, jail: j };
  const busy = me?.busy && me.busy.endsAt > Date.now() - 2000 ? me.busy : null;
  const venue = inside && venueOf(inside);
  if (venue) {
    // Doing something there that has its own scene (e.g. a boat trip from the beach)? Show that.
    const here = busy?.placeId === inside ? busy : null;
    return { key: (here && sceneFor(here)) || venue, placeId: inside, busy: here };
  }
  const key = sceneFor(busy);
  return key ? { key, placeId: busy.placeId, busy } : null;
}
