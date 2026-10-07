import { EVENT_LIMITS, isEventLive, placeById } from '@shared/world.js';
import { useStore } from '../store.js';
import { api } from '../api.js';
import { visitHome } from './social.js';
import { setInside } from '../net.js';
import { local } from '../net.js';
import { placeDoor } from '../three/Players.jsx';

let loading = null;
/** Fetch upcoming + live events into the store (deduped). */
export function loadEvents() {
  if (loading) return loading;
  loading = api('/events')
    .then((events) => useStore.setState({ events }))
    .catch(() => {})
    .finally(() => { loading = null; });
  return loading;
}

export const liveEvents = (events) => (events || []).filter((e) => isEventLive(e));
/** The live party at a place (or at a host's home), if any. */
export function livePartyAt(events, placeId, hostId) {
  return liveEvents(events).find((e) => e.place_id === placeId && (placeId !== 'home' || e.host_id === hostId)) || null;
}
export const useLiveEvents = () => liveEvents(useStore((s) => s.events));

/** Join a party: house parties need an RSVP (then you can walk in); venues let anyone in. */
export async function joinParty(e) {
  const st = useStore.getState();
  if (e.place_id === 'home') {
    if (e.host_id === st.me.id) return useStore.setState({ tab: 'home', visiting: null, phone: null, sheet: null });
    if (!e.mine) await st.run(`/events/${e.id}/rsvp`, { method: 'POST' });
    loadEvents();
    return visitHome(e.host);
  }
  const door = placeDoor(e.place_id);
  useStore.setState({ phone: null, tab: 'town', cityView: 'follow', visiting: null });
  if (Math.hypot(door[0] - local.x, door[1] - local.z) < 18) {
    useStore.setState({ sheet: null });
    setInside(e.place_id);
  } else {
    useStore.setState({ sheet: { type: 'travel', id: e.place_id } });
  }
}
export const eventEndsAt = (e) => e.starts_at + EVENT_LIMITS.windowAfterMs;
export const placeName = (id) => placeById[id];
