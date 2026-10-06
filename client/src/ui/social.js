import { placeById, PLACES, HOSPITAL_ID } from '@shared/world.js';
import { useStore } from '../store.js';
import { api } from '../api.js';
import { sendInvite, replyInvite, local, remotes } from '../net.js';
import { homeAvatar } from '../three/HomeScene.jsx';
import { goToPlace, walkTo } from '../nav.js';
import { L, loc } from '../i18n.js';
import { sfx } from '../audio.js';

const toast = (...a) => useStore.getState().toast(...a);

/** Go to a friend's home (needs an invite or an RSVP to their house party). */
export async function visitHome(username) {
  const st = useStore.getState();
  if (username === st.me?.username) {
    useStore.setState({ visiting: null, tab: 'home', phone: null, sheet: null, invite: null });
    return true;
  }
  try {
    const r = await api(`/visit/${encodeURIComponent(username)}`);
    Object.assign(homeAvatar, { x: 2.5, z: 4.2, ry: Math.PI, target: null, arrive: null });
    useStore.setState({ visiting: r, tab: 'home', phone: null, sheet: null, placing: null, homeSel: null, invite: null });
    sfx('open');
    toast(L(`🏠 Karibu kwa @${r.host.username}!`, `🏠 Welcome to @${r.host.username}'s place!`));
    return true;
  } catch (e) {
    toast(e.message, 'err');
    return false;
  }
}

export function leaveVisit() {
  useStore.setState({ visiting: null, tab: 'town', homeSel: null });
}

export async function inviteHome(username) {
  const r = await sendInvite(username);
  if (r.ok) toast(L(`📨 Mwaliko umetumwa kwa @${username}`, `📨 Invite sent to @${username}`));
  else if (r.error === 'offline') toast(L(`@${username} hayuko online sasa.`, `@${username} isn't online right now.`), 'err');
  else toast(L('Imeshindikana kutuma mwaliko.', "Couldn't send the invite."), 'err');
}

export async function answerInvite(accept) {
  const inv = useStore.getState().invite;
  if (!inv) return;
  useStore.setState({ invite: null });
  replyInvite(inv.fromId, accept);
  if (accept) await visitHome(inv.from);
}

/** Human label for where a player is right now. */
export function whereIs(r) {
  if (r.inside === 'home') return L('🏠 Nyumbani', '🏠 At home');
  if (r.inside && placeById[r.inside]) return `${placeById[r.inside].icon} ${loc(placeById[r.inside])}`;
  if (r.busy?.placeId && placeById[r.busy.placeId] && r.busy.endsAt > Date.now()) return `${r.busy.emoji || '📍'} ${loc(placeById[r.busy.placeId])}`;
  const x = r.tx ?? r.x;
  const z = r.tz ?? r.z;
  let best = null;
  let bd = Infinity;
  for (const p of PLACES) {
    const d = Math.hypot(p.pos[0] - x, p.pos[1] - z);
    if (d < bd) { bd = d; best = p; }
  }
  return best ? `📍 ${L('karibu na', 'near')} ${loc(best)}` : '📍';
}

/** Walk up to an online player in town. */
export function goToPlayer(username) {
  const r = [...remotes.values()].find((x) => x.username === username);
  if (!r) return toast(L('Hayuko online.', "They're not online."), 'err');
  if (r.inside === 'home') return toast(L('Yuko nyumbani — mwombe akualike.', "They're at home — ask for an invite."));
  useStore.setState({ phone: null, sheet: null, tab: 'town', cityView: 'follow' });
  if (r.inside && placeById[r.inside]) return goToPlace(r.inside);
  walkTo([r.tx + 1.5, r.tz + 1.5], null, `@${r.username}`);
}

export function goHospital() {
  useStore.setState({ phone: null, sheet: null, accident: null, tab: 'town', cityView: 'follow', inside: null });
  goToPlace(HOSPITAL_ID);
}

export async function callAmbulance() {
  const r = await useStore.getState().run('/ambulance', { method: 'POST' });
  if (!r) return;
  local.x = r.pos[0];
  local.z = r.pos[1];
  local.target = null;
  local.knockedUntil = 0;
  local.teleported++;
  useStore.setState({ accident: null, tab: 'town', cityView: 'follow', sheet: { type: 'place', id: HOSPITAL_ID } });
  sfx('horn');
  toast(L('🚑 Umefika Muhimbili. Pata matibabu!', '🚑 You arrived at Muhimbili. Get treated!'));
}
