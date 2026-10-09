import { haptic, SFX_HAPTIC } from './haptics.js';
// Bongo Life sound engine — everything is synthesised with the Web Audio API,
// so there are no audio files to download on mobile data.
//
// Three buses, each with its own volume: music (venue beats), sfx (UI + game events)
// and ambience (city hum, waves, engine). Browsers only allow audio after a user
// gesture, so the context is created/resumed on the first tap or key press.

const KEY = 'bl_audio';
const defaults = { muted: false, music: 0.7, sfx: 0.8, ambience: 0.6 };
export const audioSettings = (() => {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { ...defaults };
  }
})();
const listeners = new Set();
export function onAudioSettings(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export function setAudioSettings(patch) {
  Object.assign(audioSettings, patch);
  try { localStorage.setItem(KEY, JSON.stringify(audioSettings)); } catch {}
  applyVolumes();
  listeners.forEach((fn) => fn({ ...audioSettings }));
}

let ctx = null;
let master, musicBus, sfxBus, ambBus, noiseBuf, drive;

function init() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 4;
  master.connect(comp).connect(ctx.destination);
  musicBus = ctx.createGain();
  sfxBus = ctx.createGain();
  ambBus = ctx.createGain();
  for (const b of [musicBus, sfxBus, ambBus]) b.connect(master);
  // Shared white-noise buffer for hats, shakers, waves and city hum.
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  // Soft saturation for the log drum.
  drive = ctx.createWaveShaper();
  const curve = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) {
    const x = (i / 1023) * 2 - 1;
    curve[i] = Math.tanh(x * 2.5);
  }
  drive.curve = curve;
  drive.connect(musicBus);
  applyVolumes();
  startAmbience();
  startScheduler();
  return ctx;
}

function applyVolumes() {
  if (!ctx) return;
  const t = ctx.currentTime;
  const m = audioSettings.muted ? 0 : 1;
  master.gain.setTargetAtTime(m * 0.9, t, 0.05);
  musicBus.gain.setTargetAtTime(audioSettings.music * 0.55, t, 0.05);
  trackBus?.gain.setTargetAtTime(audioSettings.music * 0.75, t, 0.05);
  sfxBus.gain.setTargetAtTime(audioSettings.sfx * 0.6, t, 0.05);
  ambBus.gain.setTargetAtTime(audioSettings.ambience * 0.5, t, 0.05);
}

/** Call once at startup: unlocks audio on the first gesture and pauses it in the background. */
export function installAudioUnlock() {
  const unlock = () => {
    const c = init();
    if (c && c.state === 'suspended') c.resume();
    unlockTrackElement();
  };
  window.addEventListener('pointerdown', unlock, { capture: true });
  window.addEventListener('keydown', unlock, { capture: true });
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend();
    else ctx.resume();
  });
}

// ------------------------------------------------------------- helpers
function env(gain, t, a, peak, d, sustain = 0.0001) {
  gain.gain.cancelScheduledValues(t);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(peak, t + a);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, sustain), t + a + d);
}
function tone(bus, { type = 'sine', freq, t, a = 0.005, d = 0.2, peak = 0.3, glideTo, glideTime }) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + (glideTime || d));
  env(g, t, a, peak, d);
  o.connect(g).connect(bus);
  o.start(t);
  o.stop(t + a + d + 0.05);
}
function noise(bus, { t, d = 0.05, peak = 0.2, type = 'highpass', freq = 7000, q = 0.7 }) {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ctx.createGain();
  env(g, t, 0.002, peak, d);
  s.connect(f).connect(g).connect(bus);
  s.start(t, Math.random() * 1.5);
  s.stop(t + d + 0.05);
}
const midi = (n) => 440 * 2 ** ((n - 69) / 12);

// ------------------------------------------------------------- effects
const SFX = {
  click: (t) => tone(sfxBus, { type: 'sine', freq: 880, t, d: 0.05, peak: 0.12 }),
  // Three knocks on a wooden door.
  knock: (t) => [0, 0.16, 0.32].forEach((o) => tone(sfxBus, { type: 'triangle', freq: 140, t: t + o, d: 0.07, peak: 0.45 })),
  coin: (t) => {
    tone(sfxBus, { type: 'triangle', freq: midi(83), t, d: 0.08, peak: 0.25 });
    tone(sfxBus, { type: 'triangle', freq: midi(88), t: t + 0.07, d: 0.25, peak: 0.25 });
  },
  cash: (t) => [76, 79, 83, 88, 91].forEach((n, i) => tone(sfxBus, { type: 'triangle', freq: midi(n), t: t + i * 0.06, d: 0.25, peak: 0.2 })),
  levelup: (t) => [72, 76, 79, 84].forEach((n, i) => tone(sfxBus, { type: 'square', freq: midi(n), t: t + i * 0.09, d: 0.18, peak: 0.08 })),
  notify: (t) => {
    tone(sfxBus, { type: 'sine', freq: midi(81), t, d: 0.12, peak: 0.2 });
    tone(sfxBus, { type: 'sine', freq: midi(86), t: t + 0.1, d: 0.2, peak: 0.2 });
  },
  pop: (t) => tone(sfxBus, { type: 'sine', freq: 500, t, d: 0.08, peak: 0.18, glideTo: 900 }),
  error: (t) => tone(sfxBus, { type: 'square', freq: 180, t, d: 0.18, peak: 0.08, glideTo: 120 }),
  open: (t) => tone(sfxBus, { type: 'sine', freq: 520, t, d: 0.09, peak: 0.12, glideTo: 780 }),
  close: (t) => tone(sfxBus, { type: 'sine', freq: 700, t, d: 0.08, peak: 0.1, glideTo: 450 }),
  horn: (t) => {
    tone(sfxBus, { type: 'sawtooth', freq: 392, t, d: 0.25, peak: 0.06 });
    tone(sfxBus, { type: 'sawtooth', freq: 494, t, d: 0.25, peak: 0.05 });
  },
  splash: (t) => noise(sfxBus, { t, d: 0.5, peak: 0.25, type: 'lowpass', freq: 1500 }),
  crash: (t) => {
    tone(sfxBus, { type: 'sawtooth', freq: 440, t, d: 0.35, peak: 0.07 }); // screech
    tone(sfxBus, { type: 'sawtooth', freq: 466, t, d: 0.35, peak: 0.05 });
    noise(sfxBus, { t: t + 0.3, d: 0.45, peak: 0.4, type: 'lowpass', freq: 600 }); // thud
  },
};

/** Play a one-shot effect by name. Safe to call before audio is unlocked. */
export function sfx(name, { haptic: withHaptic = true } = {}) {
  if (withHaptic) haptic(SFX_HAPTIC[name]);
  if (!ctx || ctx.state !== 'running' || audioSettings.muted) return;
  SFX[name]?.(ctx.currentTime + 0.01);
}

// --------------------------------------------------------------- music
// One step sequencer, 16 steps per bar. Each style is a small pattern set.
const CHORDS = {
  amapiano: [[57, 60, 64, 67], [50, 53, 57, 60], [55, 59, 62, 66], [48, 52, 55, 59]], // Am7 Dm7 Gmaj7 Cmaj7
  bongo: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], // Am F C G
  chill: [[52, 55, 59, 62], [57, 60, 64, 67], [50, 53, 57, 60], [55, 59, 62, 66]],
  singeli: [[57, 60, 64], [55, 59, 62], [53, 57, 60], [55, 59, 62]], // Am G F G
};
// Taarab: hijaz-flavoured scale on A (A Bb C# D E F G) — oud, qanun runs, darbuka.
const HIJAZ = [57, 58, 61, 62, 64, 65, 67, 69, 70, 73, 74, 76];
/** Plucked string: bright attack, quick decay (oud / qanun / guitar). */
function pluck(freq, t, { d = 0.35, peak = 0.12, bright = 2400 } = {}) {
  const o = ctx.createOscillator();
  const f = ctx.createBiquadFilter();
  const g = ctx.createGain();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(freq, t);
  f.type = 'lowpass';
  f.frequency.setValueAtTime(bright, t);
  f.frequency.exponentialRampToValueAtTime(400, t + d);
  env(g, t, 0.003, peak, d);
  o.connect(f).connect(g).connect(musicBus);
  o.start(t);
  o.stop(t + d + 0.05);
}
const STYLES = {
  amapiano: { bpm: 112, step(s, bar, t, dur) {
    const ch = CHORDS.amapiano[bar % 4];
    if (s % 4 === 0) tone(musicBus, { freq: 140, t, d: 0.28, peak: 0.9, glideTo: 42, glideTime: 0.12 });
    if ([0, 3, 6, 10, 13].includes(s)) {
      // log drum: pitched, gliding, driven
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.setValueAtTime(midi(ch[0] - 12) * 1.6, t);
      o.frequency.exponentialRampToValueAtTime(midi(ch[0] - 12), t + 0.05);
      env(g, t, 0.004, 0.55, 0.42);
      o.connect(g).connect(drive);
      o.start(t);
      o.stop(t + 0.5);
    }
    noise(musicBus, { t, d: s % 2 ? 0.05 : 0.03, peak: s % 2 ? 0.12 : 0.06 });
    if (s === 4 || s === 12) noise(musicBus, { t, d: 0.12, peak: 0.25, type: 'bandpass', freq: 1800, q: 1 });
    if (s === 2 || s === 7 || s === 11) ch.forEach((n) => tone(musicBus, { type: 'triangle', freq: midi(n + 12), t, d: dur * 1.6, peak: 0.05 }));
  } },
  bongo: { bpm: 96, step(s, bar, t, dur) {
    const ch = CHORDS.bongo[bar % 4];
    if ([0, 7, 10].includes(s)) tone(musicBus, { freq: 120, t, d: 0.25, peak: 0.85, glideTo: 45, glideTime: 0.1 });
    if (s === 4 || s === 12) noise(musicBus, { t, d: 0.14, peak: 0.3, type: 'bandpass', freq: 2200, q: 0.8 });
    if (s % 2 === 0) noise(musicBus, { t, d: 0.03, peak: 0.07 });
    if ([0, 6, 8, 14].includes(s)) tone(musicBus, { type: 'sine', freq: midi(ch[0] - 24), t, d: dur * 2, peak: 0.35 });
    const mel = [ch[2] + 12, null, ch[1] + 12, null, ch[0] + 12, ch[1] + 12, null, ch[2] + 12, null, ch[0] + 24, null, ch[2] + 12, ch[1] + 12, null, ch[0] + 12, null];
    if (mel[s]) tone(musicBus, { type: 'triangle', freq: midi(mel[s]), t, d: 0.18, peak: 0.12 }); // marimba pluck
  } },
  // Bongo Flava: mid-tempo, syncopated kick, rimshot snare, warm bass, guitar + marimba hooks.
  bongoflava: { bpm: 98, step(s, bar, t, dur) {
    const ch = CHORDS.bongo[bar % 4];
    if ([0, 3, 8, 11].includes(s)) tone(musicBus, { freq: 125, t, d: 0.26, peak: 0.85, glideTo: 46, glideTime: 0.1 });
    if (s === 4 || s === 12) { noise(musicBus, { t, d: 0.12, peak: 0.28, type: 'bandpass', freq: 2400, q: 0.9 }); tone(musicBus, { type: 'square', freq: 820, t, d: 0.03, peak: 0.05 }); }
    if (s % 2 === 1) noise(musicBus, { t, d: 0.025, peak: 0.08, type: 'highpass', freq: 7000, q: 0.7 });
    if ([0, 3, 6, 8, 11, 14].includes(s)) tone(musicBus, { type: 'sine', freq: midi(ch[0] - 24 + (s === 14 ? 7 : 0)), t, d: dur * 2.2, peak: 0.38 });
    // Offbeat "Afro" guitar chops
    if (s % 4 === 2) ch.forEach((n, i) => pluck(midi(n + 12), t + i * 0.008, { d: 0.14, peak: 0.045, bright: 3200 }));
    const hook = [ch[2] + 12, null, ch[1] + 12, ch[2] + 12, null, ch[0] + 24, null, ch[2] + 12, ch[1] + 12, null, ch[0] + 12, null, ch[1] + 12, null, ch[2] + 12, null];
    if (bar % 8 >= 4 && hook[s]) tone(musicBus, { type: 'triangle', freq: midi(hook[s]), t, d: 0.2, peak: 0.11 });
    if (s === 0 && bar % 2 === 0) ch.forEach((n) => tone(musicBus, { type: 'sine', freq: midi(n), t, a: 0.3, d: dur * 30, peak: 0.025 }));
  } },
  // Singeli: frantic 150+ BPM Dar street dance — four-on-floor, rolling hats, stabby synths.
  singeli: { bpm: 156, step(s, bar, t, dur) {
    const ch = CHORDS.singeli[Math.floor(bar / 2) % 4];
    if (s % 4 === 0) tone(musicBus, { freq: 150, t, d: 0.18, peak: 0.95, glideTo: 50, glideTime: 0.07 });
    noise(musicBus, { t, d: 0.02, peak: s % 2 ? 0.1 : 0.06, type: 'highpass', freq: 8000, q: 0.7 });
    if (s === 4 || s === 12 || (bar % 4 === 3 && s >= 12)) noise(musicBus, { t, d: 0.08, peak: 0.26, type: 'bandpass', freq: 1900, q: 1.2 });
    if ([2, 5, 7, 10, 13, 15].includes(s)) tone(musicBus, { type: 'square', freq: midi(ch[(s * 3) % 3] + 12), t, d: 0.07, peak: 0.05 });
    if ([0, 6, 10].includes(s)) tone(musicBus, { type: 'sawtooth', freq: midi(ch[0] - 24), t, d: dur * 1.5, peak: 0.12 });
    if (s % 8 === 4) tone(musicBus, { type: 'triangle', freq: 1300 + (bar % 2) * 200, t, d: 0.05, peak: 0.07 }); // shaker ping
  } },
  // Taarab: Zanzibari orchestra feel — darbuka doum/tak, oud bass, qanun runs on a hijaz scale.
  taarab: { bpm: 86, step(s, bar, t, dur) {
    if (s === 0 || s === 6) tone(musicBus, { freq: 95, t, d: 0.3, peak: 0.6, glideTo: 60, glideTime: 0.12 }); // doum
    if ([3, 8, 11, 14].includes(s)) noise(musicBus, { t, d: 0.05, peak: 0.18, type: 'bandpass', freq: 3200, q: 2 }); // tak
    if (s % 2 === 1 && s !== 15) noise(musicBus, { t, d: 0.02, peak: 0.04, type: 'highpass', freq: 9000, q: 0.5 });
    const root = [57, 57, 62, 64][bar % 4];
    if ([0, 4, 8, 12].includes(s)) pluck(midi(root - 12), t, { d: 0.5, peak: 0.14, bright: 1500 });
    // qanun: a wandering line on the scale, phrase changes every 2 bars
    const phrase = Math.floor(bar / 2);
    const idx = (s * 5 + phrase * 3 + (s > 8 ? 4 : 0)) % HIJAZ.length;
    if (s % 2 === 0 || (bar % 2 === 1 && s % 4 === 3)) pluck(midi(HIJAZ[idx] + 12), t, { d: 0.28, peak: 0.07, bright: 4200 });
    if (s === 0 && bar % 4 === 0) tone(musicBus, { type: 'sine', freq: midi(root), t, a: 0.5, d: dur * 60, peak: 0.03 }); // string pad
  } },
  chill: { bpm: 84, step(s, bar, t, dur) {
    const ch = CHORDS.chill[bar % 4];
    if (s === 0) ch.forEach((n) => tone(musicBus, { type: 'sine', freq: midi(n), t, a: 0.6, d: dur * 15, peak: 0.05 }));
    if (s % 4 === 2) noise(musicBus, { t, d: 0.06, peak: 0.05 });
    if (s === 0 || s === 10) tone(musicBus, { freq: 90, t, d: 0.3, peak: 0.4, glideTo: 45 });
  } },
};

let style = null; // currently audible style
let target = { style: null, level: 0 };
let step = 0;
let bar = 0;
let nextTime = 0;
let venueGain = null;

function startScheduler() {
  venueGain = ctx.createGain();
  venueGain.gain.value = 0;
  // Re-route: everything music-related goes through venueGain so proximity can fade it.
  musicBus.disconnect();
  musicBus.connect(venueGain).connect(master);
  setInterval(() => {
    if (!ctx || ctx.state !== 'running') return;
    // Switch style only when silent-ish or on a bar line, so beats never clash.
    if (target.style !== style && (venueGain.gain.value < 0.02 || step === 0)) {
      style = target.style;
      step = 0;
    }
    venueGain.gain.setTargetAtTime(target.style === style ? target.level : 0, ctx.currentTime, 0.4);
    if (!style) return;
    const st = STYLES[style];
    const dur = 60 / st.bpm / 4;
    if (nextTime < ctx.currentTime) nextTime = ctx.currentTime + 0.05;
    while (nextTime < ctx.currentTime + 0.12) {
      st.step(step, bar, nextTime, dur);
      nextTime += dur;
      step = (step + 1) % 16;
      if (step === 0) bar++;
    }
  }, 25);
}

/** Which venue music should play and how loud (0..1). Real uploaded tracks win over the synth. */
export function setVenueMusic(name, level, venue) {
  const live = level > 0.01;
  const tracks = live && venue ? tracksFor(venue) : null;
  if (tracks?.length) {
    playTracks(venue, tracks, level);
    target = { style: target.style, level: 0 }; // hush the synth under real music
    return;
  }
  stopTracks();
  target = { style: live ? name : target.style, level: live ? level : 0 };
}

// ------------------------------------------------------- real tracks (uploaded by admins)
// One <audio> element, unlocked on the first tap (iOS), routed through Web Audio so proximity
// can fade it like the synth. Track lists are fetched per venue and cached for a few minutes.
let trackEl = null;
let trackGain = null;
let trackBus = null;
let trackVenue = null;
let trackIdx = 0;
let trackList = [];
const trackCache = new Map(); // venue -> { at, tracks, loading }
const nowSubs = new Set();
let nowPlaying = null;
export function onNowPlaying(fn) { nowSubs.add(fn); fn(nowPlaying); return () => nowSubs.delete(fn); }
const setNow = (t) => { nowPlaying = t; nowSubs.forEach((f) => f(t)); };

/** A tiny valid silent WAV (data URI) used to unlock the audio element inside a tap. */
function silentWav() {
  const n = 800;
  const b = new Uint8Array(44 + n);
  const v = new DataView(b.buffer);
  const str = (o, x) => [...x].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF'); v.setUint32(4, 36 + n, true); str(8, 'WAVE'); str(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 8000, true);
  v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); str(36, 'data'); v.setUint32(40, n, true);
  b.fill(128, 44);
  let bin = '';
  b.forEach((x) => { bin += String.fromCharCode(x); });
  return `data:audio/wav;base64,${btoa(bin)}`;
}
function unlockTrackElement() {
  if (trackEl || !ctx) return;
  trackEl = new Audio();
  trackEl.crossOrigin = 'anonymous';
  trackEl.preload = 'auto';
  trackEl.playsInline = true;
  // A silent play inside the gesture lets us start tracks later without another tap.
  trackEl.src = silentWav();
  trackEl.play().then(() => trackEl.pause()).catch(() => {});
  trackEl.addEventListener('ended', () => nextTrack());
  trackEl.addEventListener('error', () => { if (trackList.length > 1) nextTrack(); });
  const src = ctx.createMediaElementSource(trackEl);
  trackGain = ctx.createGain();
  trackGain.gain.value = 0;
  trackBus = ctx.createGain();
  trackBus.gain.value = audioSettings.music * 0.75;
  src.connect(trackGain).connect(trackBus).connect(master);
}
function tracksFor(venue) {
  const c = trackCache.get(venue);
  if (c && (c.loading || Date.now() - c.at < 5 * 60_000)) return c.tracks;
  trackCache.set(venue, { at: Date.now(), tracks: c?.tracks || [], loading: true });
  import('./api.js').then(({ api }) => api(`/music?venue=${encodeURIComponent(venue)}`))
    .then((tracks) => trackCache.set(venue, { at: Date.now(), tracks: Array.isArray(tracks) ? tracks : [], loading: false }))
    .catch(() => trackCache.set(venue, { at: Date.now(), tracks: [], loading: false }));
  return c?.tracks || [];
}
function loadTrack() {
  const t = trackList[trackIdx % trackList.length];
  if (!t || !trackEl) return;
  trackEl.src = `/uploads/${t.file}`;
  trackEl.play().catch(() => {});
  setNow(t);
  import('./api.js').then(({ api }) => api(`/music/${t.id}/play`, { method: 'POST' })).catch(() => {});
}
function nextTrack() {
  if (!trackList.length) return;
  trackIdx = (trackIdx + 1) % trackList.length;
  loadTrack();
}
function playTracks(venue, tracks, level) {
  if (!ctx || !trackEl) return;
  if (venue !== trackVenue) {
    trackVenue = venue;
    trackList = [...tracks].sort(() => Math.random() - 0.5);
    trackIdx = 0;
    loadTrack();
  } else if (trackEl.paused && trackEl.src && !trackEl.ended) trackEl.play().catch(() => {});
  trackGain.gain.setTargetAtTime(Math.min(1, level), ctx.currentTime, 0.5);
}
function stopTracks() {
  if (!trackVenue || !ctx || !trackGain) return;
  trackGain.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
  const v = trackVenue;
  trackVenue = null;
  setNow(null);
  setTimeout(() => { if (!trackVenue && trackEl && v) trackEl.pause(); }, 1500);
}

// ------------------------------------------------------------ ambience
let cityGain, waveGain, waveLfoGain, engineOsc, engineGain;
function loop(filterType, freq, q) {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  s.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = filterType;
  f.frequency.value = freq;
  f.Q.value = q;
  s.connect(f);
  s.start();
  return f;
}
function startAmbience() {
  cityGain = ctx.createGain();
  cityGain.gain.value = 0;
  loop('lowpass', 380, 0.5).connect(cityGain).connect(ambBus);

  waveGain = ctx.createGain();
  waveGain.gain.value = 0;
  const swell = ctx.createGain();
  swell.gain.value = 0.5;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.12; // ~8s per wave
  waveLfoGain = ctx.createGain();
  waveLfoGain.gain.value = 0.45;
  lfo.connect(waveLfoGain).connect(swell.gain);
  lfo.start();
  loop('lowpass', 900, 0.3).connect(swell).connect(waveGain).connect(ambBus);

  engineOsc = ctx.createOscillator();
  engineOsc.type = 'sawtooth';
  engineOsc.frequency.value = 40;
  const ef = ctx.createBiquadFilter();
  ef.type = 'lowpass';
  ef.frequency.value = 300;
  engineGain = ctx.createGain();
  engineGain.gain.value = 0;
  engineOsc.connect(ef).connect(engineGain).connect(ambBus);
  engineOsc.start();
}

/** Ambience mix from the player's surroundings. */
export function setAmbience({ city = 0, waves = 0, engine = 0, engineSpeed = 0 }) {
  if (!ctx || !cityGain) return;
  const t = ctx.currentTime;
  cityGain.gain.setTargetAtTime(city * 0.5, t, 0.8);
  waveGain.gain.setTargetAtTime(waves * 0.9, t, 0.8);
  engineGain.gain.setTargetAtTime(engine * 0.12, t, 0.15);
  engineOsc.frequency.setTargetAtTime(38 + engineSpeed * 55, t, 0.2);
}

// Dev-only inspection hook (stripped from production builds).
if (import.meta.env.DEV) {
  window.__audio = {
    get state() { return ctx?.state; },
    get style() { return style; },
    get target() { return target; },
    get venue() { return venueGain?.gain.value; },
    get waves() { return waveGain?.gain.value; },
    get city() { return cityGain?.gain.value; },
    get engine() { return engineGain?.gain.value; },
  };
}
