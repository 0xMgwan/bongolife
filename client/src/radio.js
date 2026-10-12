// In-game radio: live Tanzanian stations (list from our server). Plays through a plain <audio>
// element — radio streams don't send CORS headers, so they can't go through Web Audio.
// Follows the Music volume / mute in Settings and ducks when a venue plays its own music.
import { api } from './api.js';
import { audioSettings } from './audio.js';
import { useStore } from './store.js';

let el = null;
let stations = [];
let idx = 0;
let duck = 0; // 0..1: how loud the venue's own music is
const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };

const publish = (patch) => useStore.setState((s) => ({ radio: { ...(s.radio || {}), ...patch } }));

export async function loadStations() {
  if (stations.length) return stations;
  stations = await api('/radio').catch(() => []);
  // Start on the player's last station, else the game's default station (first in the list).
  const last = store.get('bl_radio');
  idx = Math.max(0, stations.findIndex((s) => s.name === last));
  publish({ stations, current: stations[idx] || null });
  return stations;
}

function volume() {
  if (audioSettings.muted) return 0;
  return Math.max(0, Math.min(1, audioSettings.music * (1 - 0.8 * duck)));
}
export function applyRadioVolume() { if (el) el.volume = volume(); }
/** 0 = no venue music, 1 = a club at full blast: the radio drops to 20% under it. */
export function radioDuck(level) {
  duck = Math.max(0, Math.min(1, level || 0));
  applyRadioVolume();
}

export async function playRadio(i = idx) {
  await loadStations();
  if (!stations.length) return;
  idx = (i + stations.length) % stations.length;
  const st = stations[idx];
  if (!el) {
    el = new Audio();
    el.preload = 'none';
    el.addEventListener('playing', () => publish({ playing: true, loading: false }));
    el.addEventListener('pause', () => publish({ playing: false }));
    el.addEventListener('waiting', () => publish({ loading: true }));
    // A dead stream: try the next station (once round the list at most).
    el.addEventListener('error', () => { if (useStore.getState().radio?.playing !== false) nextStation(1, true); });
  }
  el.src = st.url;
  el.volume = volume();
  store.set('bl_radio', st.name);
  store.set('bl_radio_on', '1');
  publish({ current: st, loading: true, playing: false });
  try { await el.play(); } catch { publish({ loading: false, playing: false }); }
}
let skipped = 0;
export function nextStation(dir = 1, auto = false) {
  if (auto && ++skipped > stations.length) { skipped = 0; return stopRadio(); }
  if (!auto) skipped = 0;
  return playRadio(idx + dir);
}
export function stopRadio() {
  store.set('bl_radio_on', '0');
  if (el) { el.pause(); el.removeAttribute('src'); el.load(); }
  publish({ playing: false, loading: false });
}
export const toggleRadio = () => (useStore.getState().radio?.playing || useStore.getState().radio?.loading ? stopRadio() : playRadio());
/** Whether the radio should start on its own after the welcome (on unless the player turned it off). */
export const radioAutoOn = () => store.get('bl_radio_auto') !== '0';
export const setRadioAuto = (on) => store.set('bl_radio_auto', on ? '1' : '0');
