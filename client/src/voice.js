// Voice: live rooms (everyone in a venue) and friend calls (1:1 or group). Peer-to-peer WebRTC
// audio, set up through our socket. The newcomer calls everyone already in the room.
import { getSocket } from './net.js';
import { useStore } from './store.js';

let mic = null;
let ice = [];
const peers = new Map(); // id -> { pc, audio, username, speaking, state, queue: RTCIceCandidate[] }
let meters = null;
const set = (patch) => useStore.setState((s) => ({ voice: { ...(s.voice || {}), ...patch } }));
const list = () => [...peers.entries()].map(([id, p]) => ({ id, username: p.username, speaking: p.speaking, state: p.state }));

function meter(stream, onLevel) {
  try {
    meters ||= new (window.AudioContext || window.webkitAudioContext)();
    if (meters.state === 'suspended') meters.resume().catch(() => {});
    const src = meters.createMediaStreamSource(stream);
    const an = meters.createAnalyser();
    an.fftSize = 256;
    src.connect(an);
    const buf = new Uint8Array(an.frequencyBinCount);
    const tick = () => {
      if (!mic) return;
      an.getByteFrequencyData(buf);
      onLevel(buf.reduce((a, b) => a + b, 0) / buf.length);
      setTimeout(tick, 150);
    };
    tick();
  } catch {}
}

function peer(id, username) {
  let p = peers.get(id);
  if (p) return p;
  const pc = new RTCPeerConnection({ iceServers: ice });
  // Attached to the page (iOS plays WebRTC audio more reliably from an element in the DOM).
  const audio = document.createElement('audio');
  audio.autoplay = true;
  audio.playsInline = true;
  audio.style.display = 'none';
  document.body.appendChild(audio);
  p = { pc, audio, username, speaking: false, state: 'connecting', queue: [] };
  peers.set(id, p);
  for (const t of mic.getTracks()) pc.addTrack(t, mic);
  pc.onicecandidate = (e) => e.candidate && getSocket()?.emit('voice:signal', { to: id, data: { ice: e.candidate.toJSON() } });
  pc.ontrack = (e) => {
    audio.srcObject = e.streams[0];
    audio.play().catch(() => set({ needTap: true }));
    meter(e.streams[0], (lvl) => {
      const speaking = lvl > 16;
      if (speaking !== p.speaking) { p.speaking = speaking; set({ peers: list() }); }
    });
  };
  pc.onconnectionstatechange = () => {
    const s = pc.connectionState;
    p.state = s === 'connected' ? 'connected' : s === 'failed' ? 'failed' : s === 'disconnected' ? 'reconnecting' : 'connecting';
    if (s === 'failed') pc.restartIce?.();
    set({ peers: list() });
  };
  set({ peers: list() });
  return p;
}
async function flushQueue(p) {
  // Connection candidates that arrived before the offer/answer was applied.
  for (const c of p.queue.splice(0)) await p.pc.addIceCandidate(c).catch(() => {});
}
function drop(id) {
  const p = peers.get(id);
  if (!p) return;
  try { p.pc.close(); } catch {}
  p.audio.srcObject = null;
  p.audio.remove();
  peers.delete(id);
  set({ peers: list() });
}

let wired = false;
function wire() {
  const s = getSocket();
  if (!s || wired) return;
  wired = true;
  s.on('voice:joined', ({ id, username }) => { if (mic) peer(id, username); });
  s.on('voice:left', ({ id }) => drop(id));
  s.on('voice:count', ({ room, n, members }) => set({ room, count: n, members }));
  s.on('voice:signal', async ({ from, data }) => {
    if (!mic) return;
    const names = useStore.getState().voice?.members || useStore.getState().call?.members || [];
    const p = peer(from, peers.get(from)?.username || names.find((m) => m.id === from)?.username || '…');
    try {
      if (data.sdp) {
        await p.pc.setRemoteDescription(data.sdp);
        await flushQueue(p);
        if (data.sdp.type === 'offer') {
          await p.pc.setLocalDescription(await p.pc.createAnswer());
          s.emit('voice:signal', { to: from, data: { sdp: p.pc.localDescription } });
        }
      } else if (data.ice) {
        if (p.pc.remoteDescription) await p.pc.addIceCandidate(data.ice).catch(() => {});
        else p.queue.push(data.ice);
      }
    } catch (e) { console.warn('[voice]', e?.message); }
  });
  // ---- calls
  s.on('call:ring', (d) => useStore.setState({ incomingCall: d }));
  s.on('call:update', (d) => useStore.setState((st) => (st.call?.callId === d.callId || st.voice?.callId === d.callId ? { call: { ...(st.call || {}), ...d } } : {})));
  s.on('call:declined', ({ by }) => useStore.getState().toast(`📞 @${by} ${useStore.getState().lang === 'en' ? 'declined' : 'amekataa'}`));
  s.on('call:missed', () => useStore.setState({ incomingCall: null }));
  s.on('call:ended', ({ callId }) => {
    const st = useStore.getState();
    if (st.incomingCall?.callId === callId) useStore.setState({ incomingCall: null });
    if (st.voice?.callId === callId) leaveVoice();
    useStore.setState({ call: null });
  });
}
/** Start listening for calls as soon as the game's socket exists. */
export function initVoice() {
  if (wired) return;
  if (getSocket()) return wire();
  const t = setInterval(() => { if (getSocket()) { clearInterval(t); wire(); } }, 500);
}
/** Ask the server how many are live in this room (for the "join" chip). */
export function pollVoice() { wire(); getSocket()?.emit('voice:count?'); }

/** Join the venue's live room (no args) or a call ({ call: id }). */
export async function joinVoice(opts = null) {
  wire();
  const s = getSocket();
  if (!s) return { error: 'offline' };
  if (mic) leaveVoice();
  try {
    mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  } catch {
    return { error: 'mic' };
  }
  // Unlock audio output while we still have the tap.
  meters ||= new (window.AudioContext || window.webkitAudioContext)();
  meters.resume?.().catch(() => {});
  const r = await new Promise((resolve) => s.emit('voice:join', opts, resolve));
  if (!r?.ok) { mic.getTracks().forEach((t) => t.stop()); mic = null; return r || { error: 'failed' }; }
  ice = r.ice || [];
  set({ on: true, muted: false, peers: [], callId: opts?.call || null, kind: opts?.call ? 'call' : 'room', needTap: false });
  meter(mic, (lvl) => { const me = lvl > 16; if (me !== useStore.getState().voice?.meSpeaking) set({ meSpeaking: me }); });
  for (const m of r.peers) {
    const p = peer(m.id, m.username);
    try {
      await p.pc.setLocalDescription(await p.pc.createOffer());
      s.emit('voice:signal', { to: m.id, data: { sdp: p.pc.localDescription } });
    } catch {}
  }
  return { ok: true };
}

export function leaveVoice() {
  getSocket()?.emit('voice:leave');
  for (const id of [...peers.keys()]) drop(id);
  mic?.getTracks().forEach((t) => t.stop());
  mic = null;
  set({ on: false, muted: false, peers: [], meSpeaking: false, callId: null, kind: null });
}

export function toggleMute() {
  if (!mic) return;
  const muted = !useStore.getState().voice?.muted;
  mic.getAudioTracks().forEach((t) => (t.enabled = !muted));
  set({ muted });
}
/** If the browser blocked playback, a tap starts every remote stream. */
export function resumeAudio() {
  meters?.resume?.().catch(() => {});
  for (const p of peers.values()) p.audio.play().catch(() => {});
  set({ needTap: false });
}

// ---------------------------------------------------------------- calls
export async function startCall(usernames) {
  wire();
  const s = getSocket();
  if (!s) return { error: 'offline' };
  const r = await new Promise((resolve) => s.emit('call:start', { to: usernames }, resolve));
  if (!r?.ok) return r || { error: 'failed' };
  useStore.setState({ call: { callId: r.callId, members: [], ringing: usernames, outgoing: true } });
  const j = await joinVoice({ call: r.callId });
  if (!j.ok) { useStore.setState({ call: null }); return j; }
  return r;
}
export async function answerCall(accept) {
  wire();
  const inc = useStore.getState().incomingCall;
  if (!inc) return;
  useStore.setState({ incomingCall: null });
  if (!accept) return getSocket()?.emit('call:decline', { callId: inc.callId });
  useStore.setState({ call: { callId: inc.callId, members: [], ringing: [] } });
  const j = await joinVoice({ call: inc.callId });
  if (!j.ok) { useStore.setState({ call: null }); getSocket()?.emit('call:decline', { callId: inc.callId }); }
  return j;
}
export function addToCall(usernames) {
  const c = useStore.getState().call;
  if (c) getSocket()?.emit('call:add', { callId: c.callId, to: usernames });
}
export function hangUp() {
  leaveVoice();
  useStore.setState({ call: null });
}
