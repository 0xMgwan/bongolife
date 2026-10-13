// Walking around inside rooms/venues: joystick, WASD or tap the floor. Everyone in the room sees
// you move. Glowing hotspots (dance floor, bar, stalls…) can be tapped to do something on the spot.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { VIBES, WORK } from '@shared/world.js';
import { input, sendScenePos } from '../net.js';
import { useStore } from '../store.js';
import { emojiTexture, labelTexture } from './textures.js';
import { L } from '../i18n.js';
import { sfx } from '../audio.js';
import { sceneFocus } from './Scenes.jsx';

/** Your own spot in the room. Inactive = the scene places you (seat, bar stool…). */
export const sceneMe = { active: false, x: 0, z: 0, ry: 0, moving: false, target: null, arrive: null, pose: null, poseUntil: 0, key: null };
/** Other players' spots in the room: id -> { x, z, ry, m, mode, at, cx, cz, cr } */
export const scenePeers = new Map();

export function resetSceneWalk(key) {
  Object.assign(sceneMe, { active: false, moving: false, target: null, arrive: null, pose: null, poseUntil: 0, key });
  scenePeers.clear();
}

const BOUNDS = { default: [-10, 10, -7, 9], market: [-15, 15, -8, 11], stand: [-15, 15, -0.5, 11], plaza: [-14, 14, -0.5, 11], terminal: [-14, 14, 0.8, 11], stadium: [-14, 14, -6, 14], beach: [-12, 12, -8, 9], club: [-10, 10, -7, 8], flight: [-2, 2, -6, 6], yacht: [-3.3, 3.3, -2.5, 7.6], showroom: [-15, 15, -12, 10.5], jet: [-0.85, 0.85, -7.8, 6.1] };
const SPEED = 4.2;

// Hotspots per scene: [x, z, vibe]. Scenes not listed get a couple of generic ones.
const SPOTS = {
  club: [[0, 0.5, 'dance'], [-6.5, -4.5, 'drink'], [4.5, -5, 'selfie'], [-3, 4.5, 'greet']],
  lounge: [[0, 0.5, 'dance'], [-5, -3, 'drink'], [4, 3.5, 'selfie']],
  concert: [[0, 1.5, 'dance'], [-5, 4, 'cheer'], [5, 4, 'selfie']],
  bar: [[-2, -2.5, 'drink'], [3.5, 1, 'play'], [0, 3, 'cheer']],
  plaza: [[5.5, 2.9, 'news'], [7.5, 5.9, 'shine'], [3.6, 4.2, 'coffee'], [0, 1, 'photo'], [-5, 7.8, 'haggle']],
  terminal: [[12, 5.6, 'fish'], [-2, 3.2, 'greet'], [0, -0.8, 'photo'], [6.5, 3.4, 'rest']],
  stand: [[-12.5, 8.6, 'photo'], [-2, 3.5, 'fruit'], [4, 6.5, 'greet'], [12, 9, 'rest']],
  market: [[-7.3, 2, 'haggle'], [-1.1, -3, 'fruit'], [5.2, 2, 'haggle'], [11.4, -2, 'fruit'], [-13, 8, 'pray'], [2, 9, 'greet']],
  dining: [[-2.5, 0.5, 'eat'], [2.5, 0.5, 'drink'], [0, 3.5, 'selfie']],
  grill: [[-2, 1.5, 'eat'], [2.5, 2.5, 'drink'], [0, 5, 'greet']],
  beach: [[0, -5, 'swim'], [-5, 2, 'ball'], [4, 3, 'selfie'], [6, -1, 'drink']],
  waterpark: [[-3, 1.5, 'swim'], [5, 4, 'selfie'], [0, 6, 'drink']],
  gym: [[-2.5, -1, 'lift'], [2.5, -1, 'lift'], [0, 3, 'selfie']],
  studio: [[0, -0.5, 'sing'], [3, 2.5, 'selfie']],
  stadium: [[-4, 10, 'cheer'], [4, 10, 'cheer'], [0, 12, 'selfie']],
  salon: [[0, 2.5, 'rest'], [3, 2.5, 'selfie']],
  office: [[-2, 1, 'work'], [3, 2.5, 'greet']],
  bank: [[-2, 1, 'work'], [3, 2.5, 'greet']],
  classroom: [[0, 2, 'work'], [3, 3.5, 'greet']],
  casino: [[0, 2, 'cheer'], [-4, 3, 'drink']],
  rooftop: [[0, 1.5, 'drink'], [-4, 3, 'selfie'], [4, 3, 'dance']],
  spa: [[0, 2, 'rest'], [3, 3, 'selfie']],
  ngoma: [[0, 1, 'dance'], [-4, 4, 'photo']],
  golf: [[0, 2, 'photo'], [-3, 3, 'drink']],
  dhow: [[0, 2, 'photo'], [2, 3, 'swim']],
  safari: [[0, 3, 'photo']],
  hike: [[0, 3, 'photo'], [2, 4, 'rest']],
  shop: [[-2, 2.5, 'haggle'], [3, 2.5, 'fruit']],
  hospital: [[0, 3, 'rest']],
  room: [[0, 1.5, 'rest']],
  karting: [[0, 6, 'cheer'], [4, 6, 'photo']],
  police: [], court: [], flight: [], heli: [], ferry: [[0, 3, 'photo']], road: [],
  yacht: [[1.0, 4.9, 'sunbathe'], [-2.3, 1.7, 'jacuzzi'], [2.1, 0.2, 'champagne'], [0, -1.6, 'decks'], [-1.8, -1.6, 'chef'], [2.9, 6.6, 'angling'], [-2.9, 6.6, 'jetski'], [1.9, -2.2, 'helm'], [-0.9, 5.6, 'selfie']],
  showroom: [[11, 9.2, 'coffee'], [-11, 9, 'selfie']],
  jet: [[0.3, -7.3, 'champagne'], [0, -4.4, 'chef'], [0, -8.1, 'cockpit'], [-0.4, 1.0, 'lounge'], [0.45, 2.1, 'movie'], [0, 4.4, 'nap']],
};
const spotsFor = (key) => SPOTS[key] ?? [[-3, 3, 'greet'], [3, 3, 'selfie']];

/** Movement + camera follow + sending your spot. Mounted inside the scene group. */
export function SceneWalker({ sceneKey }) {
  const sent = useRef({ at: 0, x: 0, z: 0, m: false });
  useEffect(() => {
    resetSceneWalk(sceneKey);
    return () => resetSceneWalk(null);
  }, [sceneKey]);
  useFrame((_, dt) => {
    dt = Math.min(dt, 0.1);
    const k = input.keys;
    let dx = input.jx;
    let dz = input.jz;
    if (k.has('w') || k.has('arrowup')) dz -= 1;
    if (k.has('s') || k.has('arrowdown')) dz += 1;
    if (k.has('a') || k.has('arrowleft')) dx -= 1;
    if (k.has('d') || k.has('arrowright')) dx += 1;
    const manual = Math.hypot(dx, dz) > 0.08;
    if (manual) { sceneMe.target = null; sceneMe.arrive = null; sceneMe.active = true; }
    else if (sceneMe.target) {
      dx = sceneMe.target[0] - sceneMe.x;
      dz = sceneMe.target[1] - sceneMe.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.35) {
        dx = dz = 0;
        sceneMe.target = null;
        const cb = sceneMe.arrive;
        sceneMe.arrive = null;
        cb?.();
      }
    }
    const len = Math.hypot(dx, dz);
    sceneMe.moving = sceneMe.active && len > 0.05;
    if (sceneMe.moving) {
      const sp = (SPEED * dt) / Math.max(1, len);
      const [x0, x1, z0, z1] = BOUNDS[sceneKey] || BOUNDS.default;
      sceneMe.x = Math.max(x0, Math.min(x1, sceneMe.x + dx * sp));
      sceneMe.z = Math.max(z0, Math.min(z1, sceneMe.z + dz * sp));
      sceneMe.ry = Math.atan2(dx, dz);
      sceneMe.pose = null;
    }
    // Keep the camera on you as you wander.
    if (sceneMe.active) {
      sceneFocus.tx = Math.max(-6, Math.min(6, sceneMe.x * 0.6));
      sceneFocus.tz = Math.max(-3, Math.min(4, sceneMe.z * 0.35));
    }
    // Tell the room (throttled; once more when you stop).
    const t = performance.now();
    const s = sent.current;
    if (sceneMe.active && (sceneMe.moving || s.m) && t - s.at > 140) {
      sendScenePos({ x: +sceneMe.x.toFixed(2), z: +sceneMe.z.toFixed(2), ry: +sceneMe.ry.toFixed(2), m: sceneMe.moving, mode: sceneMe.pose });
      Object.assign(s, { at: t, m: sceneMe.moving });
    }
  });
  return null;
}

/** Invisible floor: tap to walk there. */
export function FloorCatcher({ sceneKey }) {
  const [x0, x1, z0, z1] = BOUNDS[sceneKey] || BOUNDS.default;
  return (
    <mesh
      position={[(x0 + x1) / 2, 0.02, (z0 + z1) / 2]}
      rotation={[-Math.PI / 2, 0, 0]}
      onClick={(e) => {
        e.stopPropagation();
        const p = e.object.parent.worldToLocal(e.point.clone());
        sceneMe.active = true;
        sceneMe.target = [p.x, p.z];
        sceneMe.arrive = null;
      }}
    >
      <planeGeometry args={[x1 - x0, z1 - z0]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

/** Tappable hotspots: walk over, then do the thing. */
// During a work shift the WorkPanel tasks become places in the room: walk over to do them.
const WORK_SPOTS = { work: [-3, 1.2], hustle: [3, 1.2], chat: [-4.8, 5], boss: [4.8, -3], nap: [5.2, 5.2] };

export function Hotspots({ sceneKey, myBusy }) {
  const run = useStore((s) => s.run);
  const working = myBusy?.kind === 'job' && myBusy.endsAt > Date.now();
  if (working) return <WorkSpots />;
  const spots = spotsFor(sceneKey);
  const doVibe = async (id) => {
    const v = VIBES[id];
    const r = await run('/act/vibe', { method: 'POST', body: { id } });
    if (!r) return;
    sfx(v.cost ? 'cash' : 'pop');
    sceneMe.pose = v.mode;
    sceneMe.poseUntil = performance.now() + 3500;
    sendScenePos({ x: sceneMe.x, z: sceneMe.z, ry: sceneMe.ry, m: false, mode: v.mode });
    const fx = Object.entries(v.effects).filter(([, n]) => n > 0).map(([k, n]) => `+${n} ${k}`).join(' · ');
    useStore.getState().toast(`${v.emoji} ${L(v.name[0], v.name[1])}${r.found ? ` · +TSh ${r.found.toLocaleString()}` : ''}${fx ? ` · ${fx}` : ''}`);
  };
  return spots.map(([x, z, id], i) => <Hotspot key={i} x={x} z={z} id={id} onGo={() => {
    sceneMe.active = true;
    sceneMe.target = [x, z + 0.9];
    sceneMe.arrive = () => { sceneMe.ry = Math.PI; doVibe(id); };
  }} />);
}

function WorkSpots() {
  const run = useStore((s) => s.run);
  const doTask = async (t) => {
    const r = await run('/act/task', { method: 'POST', body: { task: t.id } });
    if (!r) return;
    sfx(t.perf > 0 ? 'coin' : 'pop');
    sceneMe.pose = t.id === 'nap' ? 'sleep' : t.id === 'chat' ? 'cheer' : t.id === 'boss' ? 'pose' : 'type';
    sceneMe.poseUntil = performance.now() + 3500;
    sendScenePos({ x: sceneMe.x, z: sceneMe.z, ry: sceneMe.ry, m: false, mode: sceneMe.pose });
  };
  return WORK.tasks.map((t) => {
    const [x, z] = WORK_SPOTS[t.id] || [0, 3];
    const v = { emoji: t.emoji, name: [t.name, t.nameEn] };
    return <Hotspot key={t.id} x={x} z={z} v={v} onGo={() => {
      sceneMe.active = true;
      sceneMe.target = [x, z + 0.9];
      sceneMe.arrive = () => { sceneMe.ry = Math.PI; doTask(t); };
    }} />;
  });
}

function Hotspot({ x, z, id, onGo, v: given }) {
  const v = given || VIBES[id];
  const tex = useMemo(() => emojiTexture(v.emoji, { ring: '#f5b800' }), [v.emoji]);
  const lab = useMemo(() => labelTexture(L(v.name[0], v.name[1]) + (v.cost ? ` · ${v.cost / 1000}k` : ''), { size: 40, bold: 800, bg: 'rgba(20,20,20,.88)', fg: '#ffd23f' }), [v.emoji, v.name[0], v.name[1], v.cost]); // eslint-disable-line react-hooks/exhaustive-deps
  const ref = useRef();
  const ring = useRef();
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (ref.current) ref.current.position.y = 2.3 + Math.sin(t * 2 + x) * 0.12;
    if (ring.current) { const s = 1 + ((t * 0.8 + x) % 1) * 0.6; ring.current.scale.set(s, s, s); ring.current.material.opacity = 0.7 * (1 - ((t * 0.8 + x) % 1)); }
  });
  return (
    <group position={[x, 0, z]}>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]} onClick={(e) => { e.stopPropagation(); onGo(); }}>
        <ringGeometry args={[0.55, 0.75, 28]} />
        <meshBasicMaterial color="#f5b800" transparent opacity={0.7} depthWrite={false} />
      </mesh>
      <group ref={ref}>
        <sprite scale={[0.85, 0.85, 1]} onClick={(e) => { e.stopPropagation(); onGo(); }} renderOrder={6}>
          <spriteMaterial map={tex} depthWrite={false} />
        </sprite>
        <sprite position={[0, -0.62, 0]} scale={[0.32 * lab.aspect, 0.32, 1]} renderOrder={6}>
          <spriteMaterial map={lab.texture} depthWrite={false} />
        </sprite>
      </group>
    </group>
  );
}

/**
 * Called from Person every frame: if this person is you walking, or another player walking in
 * the room, move their group and pick a pose. Returns the mode to use, or null to keep the slot.
 */
export function livePerson(group, id, myId, fallbackMode) {
  if (id != null && id === myId) {
    if (!sceneMe.active) {
      // Remember where the scene put you so walking starts from there.
      const p = group.position;
      sceneMe.x = p.x; sceneMe.z = p.z; sceneMe.ry = group.rotation.y;
      return null;
    }
    group.position.set(sceneMe.x, 0, sceneMe.z);
    group.rotation.y = sceneMe.ry;
    if (sceneMe.moving) return 'walk';
    if (sceneMe.pose && performance.now() < sceneMe.poseUntil) return sceneMe.pose;
    return 'idle';
  }
  const peer = id != null && scenePeers.get(id);
  if (!peer || performance.now() - peer.at > 60_000) return null;
  // Ease towards the last reported spot.
  if (peer.cx == null) { peer.cx = peer.x; peer.cz = peer.z; }
  peer.cx += (peer.x - peer.cx) * 0.18;
  peer.cz += (peer.z - peer.cz) * 0.18;
  group.position.set(peer.cx, 0, peer.cz);
  group.rotation.y = peer.ry;
  if (peer.m) return 'walk';
  if (peer.mode && performance.now() - peer.at < 3500) return peer.mode;
  return fallbackMode === 'walk' ? 'idle' : 'idle';
}
