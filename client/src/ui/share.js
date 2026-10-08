import { useStore } from '../store.js';
import { L } from '../i18n.js';
import { sfx } from '../audio.js';

/** A link into the game; carries your username as the invite code (?ref=). */
export function shareUrl(params = {}) {
  const u = new URL(`${location.origin}/`);
  for (const [k, v] of Object.entries(params)) if (v != null) u.searchParams.set(k, v);
  const me = useStore.getState().me;
  if (me?.username) u.searchParams.set('ref', me.username);
  return u.toString();
}

/** Native share sheet on phones, clipboard elsewhere. */
export async function share({ title = 'Bongo Life', text = '', params } = {}) {
  const url = shareUrl(params);
  sfx('click');
  try {
    if (navigator.share) {
      await navigator.share({ title, text, url });
      return;
    }
  } catch (e) {
    if (e?.name === 'AbortError') return;
  }
  try {
    await navigator.clipboard.writeText(url);
    useStore.getState().toast(L('🔗 Link imenakiliwa — itume kwa washkaji!', '🔗 Link copied — send it to your friends!'));
  } catch {
    useStore.getState().toast(L(`🔗 Nakili link: ${url}`, `🔗 Copy this link: ${url}`));
  }
}

/** Read ?ref= / ?place= / ?u= / ?event= once on load; the ref code is kept for sign-up. */
export function readDeepLink() {
  const q = new URLSearchParams(location.search);
  const ref = q.get('ref');
  if (ref && /^[A-Za-z0-9_]{3,20}$/.test(ref)) {
    try { if (!localStorage.getItem('bl_ref')) localStorage.setItem('bl_ref', ref); } catch {}
  }
  const link = { place: q.get('place'), user: q.get('u'), event: q.get('event') };
  if (link.place || link.user || link.event || ref) {
    for (const k of ['ref', 'place', 'u', 'event']) q.delete(k);
    const rest = q.toString();
    history.replaceState(null, '', location.pathname + (rest ? `?${rest}` : ''));
  }
  return link;
}
/** Keep an invite code from the URL for sign-up (without touching the rest of the link). */
export function rememberRef() {
  const ref = new URLSearchParams(location.search).get('ref');
  if (ref && /^[A-Za-z0-9_]{3,20}$/.test(ref)) {
    try { if (!localStorage.getItem('bl_ref')) localStorage.setItem('bl_ref', ref); } catch {}
  }
}
export const pendingRef = () => { try { return localStorage.getItem('bl_ref'); } catch { return null; } };
