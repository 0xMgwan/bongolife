// Live voice rooms: talk to the other players in the same venue. Peer-to-peer WebRTC audio,
// signalled through our socket. The newcomer calls everyone already in the room.
import { getSocket } from './net.js';
import { useStore } from './store.js';

let mic = null;
let ice = [];
const peers = new Map(); // id -> { pc, audio, username, level }
let meters = null;
const set = (patch) => useStore.setState((s) => ({ voice: { ...(s.voice || {}), ...patch } }));
const list = () => [...peers.entries()].map(([id, p]) => ({ id, username: p.username, speaking: p.speaking }));

function meter(stream, onLevel) {
  try {
    meters ||= new (window.AudioContext || window.webkitAudioContext)();
    const src = meters.createMediaStreamSource(stream);
    const an = meters.createAnalyser();
    an.fftSize = 256;
    src.connect(an);
    const buf = new Uint8Array(an.frequencyBinCount);
    const tick = () => {
      if (!an.context || an.context.state === 'closed') return;
      an.getByteFrequencyData(buf);
      onLevel(buf.reduce((a, b) => a + b, 0) / buf.length);
      if (useStore.getState().voice?.on) setTimeout(tick, 150);
    };
    tick();
  } catch {}
}

function peer(id, username) {
  let p = peers.get(id);
  if (p) return p;
  const pc = new RTCPeerConnection({ iceServers: ice });
  const audio = new Audio();
  audio.autoplay = true;
  p = { pc, audio, username, speaking: false };
  peers.set(id, p);
  for (const t of mic.getTracks()) pc.addTrack(t, mic);
  pc.onicecandidate = (e) => e.candidate && getSocket()?.emit('voice:signal', { to: id, data: { ice: e.candidate } });
  pc.ontrack = (e) => {
    audio.srcObject = e.streams[0];
    audio.play().catch(() => {});
    meter(e.streams[0], (lvl) => {
      const speaking = lvl > 18;
      if (speaking !== p.speaking) { p.speaking = speaking; set({ peers: list() }); }
    });
  };
  pc.onconnectionstatechange = () => { if (['failed', 'closed'].includes(pc.connectionState)) drop(id); };
  set({ peers: list() });
  return p;
}
function drop(id) {
  const p = peers.get(id);
  if (!p) return;
  try { p.pc.close(); } catch {}
  p.audio.srcObject = null;
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
    const p = peer(from, useStore.getState().voice?.members?.find((m) => m.id === from)?.username || '…');
    try {
      if (data.sdp) {
        await p.pc.setRemoteDescription(data.sdp);
        if (data.sdp.type === 'offer') {
          await p.pc.setLocalDescription(await p.pc.createAnswer());
          s.emit('voice:signal', { to: from, data: { sdp: p.pc.localDescription } });
        }
      } else if (data.ice) await p.pc.addIceCandidate(data.ice);
    } catch {}
  });
}
/** Ask the server how many are live in this room (for the "join" chip). */
export function pollVoice() { wire(); getSocket()?.emit('voice:count?'); }

export async function joinVoice() {
  wire();
  const s = getSocket();
  if (!s) return { error: 'offline' };
  try {
    mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  } catch {
    return { error: 'mic' };
  }
  const r = await new Promise((resolve) => s.emit('voice:join', null, resolve));
  if (!r?.ok) { mic.getTracks().forEach((t) => t.stop()); mic = null; return r || { error: 'failed' }; }
  ice = r.ice || [];
  set({ on: true, muted: false, peers: [] });
  meter(mic, (lvl) => { const me = lvl > 18; if (me !== useStore.getState().voice?.meSpeaking) set({ meSpeaking: me }); });
  // We're the newcomer: call everyone already here.
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
  set({ on: false, muted: false, peers: [], meSpeaking: false });
}

export function toggleMute() {
  if (!mic) return;
  const muted = !useStore.getState().voice?.muted;
  mic.getAudioTracks().forEach((t) => (t.enabled = !muted));
  set({ muted });
}
