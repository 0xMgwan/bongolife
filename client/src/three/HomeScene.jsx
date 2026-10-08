// "Kwangu" — the player's apartment: walls, rooms, furniture, the player's Sim,
// and the buy-mode placement preview. Rendered far from the city at HOME_ORIGIN.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { HOME, furnitureById, footprint, homeFits } from '@shared/world.js';
import { mat, geo } from './textures.js';
import { FurnitureModel } from './Furniture.jsx';
import { Body, Overhead } from './Players.jsx';
import { Vehicle } from './Vehicle.jsx';
import { PartyDecor } from './Party.jsx';
import { Shadows } from './Shadows.jsx';
import { livePartyAt } from '../ui/events.js';
import { vehicleById } from '@shared/world.js';
import { local } from '../net.js';
import { useStore } from '../store.js';
import { homeGuests, sendHomePos } from '../net.js';
import { api } from '../api.js';
import { Yard } from './Yard.jsx';

export const HOME_ORIGIN = [-4000, 0, 4000];
const WALL = '#15806b';
const unitBox = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
const WALL_MAT = new THREE.MeshPhongMaterial({ color: WALL, shininess: 8, specular: new THREE.Color('#111111') });
const CAP_MAT = new THREE.MeshPhongMaterial({ color: '#e7e5e4', shininess: 20 });
const SKIRT_MAT = new THREE.MeshPhongMaterial({ color: '#0f5e4f', shininess: 10 });

/** Player position inside the home (local units), kept outside React. */
export const homeAvatar = { x: 0, z: 2, ry: Math.PI, target: null };

/** Floor textures: big ceramic tiles with grout, wooden planks, small bathroom tiles. */
function checker(a, b, repeat, kind = 'tile') {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const rnd = (i) => ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1;
  if (kind === 'wood') {
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? a : b;
      ctx.fillRect(0, i * 32, 256, 32);
      ctx.globalAlpha = 0.18;
      for (let k = 0; k < 6; k++) { ctx.fillStyle = '#5b3a1e'; ctx.fillRect(rnd(i * 9 + k) * 256, i * 32 + 4 + k * 4, 40 + rnd(k + i) * 80, 1); }
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(60,35,15,.45)';
      ctx.fillRect(0, i * 32, 256, 1.5);
      ctx.fillRect(((i * 97) % 256), i * 32, 1.5, 32);
    }
  } else {
    const n = kind === 'small' ? 4 : 2;
    const s = 256 / n;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      ctx.fillStyle = (x + y) % 2 ? a : b;
      ctx.fillRect(x * s, y * s, s, s);
      const g = ctx.createLinearGradient(x * s, y * s, x * s + s, y * s + s);
      g.addColorStop(0, 'rgba(255,255,255,.10)');
      g.addColorStop(1, 'rgba(0,0,0,.05)');
      ctx.fillStyle = g;
      ctx.fillRect(x * s, y * s, s, s);
    }
    ctx.fillStyle = 'rgba(120,110,95,.55)';
    for (let i = 0; i <= n; i++) { ctx.fillRect(i * s - 1.5, 0, 3, 256); ctx.fillRect(0, i * s - 1.5, 256, 3); }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function Floor({ x1, x2, z1, z2, a, b, y = 0.005, kind = 'tile' }) {
  const m = useMemo(() => new THREE.MeshPhongMaterial({ map: checker(a, b, kind === 'wood' ? [(x2 - x1) / 4, (z2 - z1) / 4] : [(x2 - x1) / 2, (z2 - z1) / 2], kind), shininess: kind === 'wood' ? 18 : 40, specular: new THREE.Color('#2a2a2a') }), [a, b, x1, x2, z1, z2, kind]);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(x1 + x2) / 2, y, (z1 + z2) / 2]} material={m}>
      <planeGeometry args={[x2 - x1, z2 - z1]} />
    </mesh>
  );
}

// Wall segments [x1, z1, x2, z2] — doors are simply gaps between segments.
const WALLS = [
  [-6, -5, 6, -5], [-6, -5, -6, 5], [6, -5, 6, 5], [-6, 5, 1.8, 5], [3.2, 5, 6, 5], // outer, front door gap
  [-2, 1.5, -2, 2.2], [-2, 3.2, -2, 5], [-6, 1.5, -2, 1.5], // bathroom
  [1.5, -5, 1.5, -3.2], [1.5, -2.2, 1.5, -1], [1.5, -1, 6, -1], // bedroom
];
function Walls() {
  return WALLS.map(([x1, z1, x2, z2], i) => {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const back = z1 === -5 && z2 === -5 || x1 === -6 && x2 === -6;
    const h = back ? 2.2 : 1.3;
    const sx = x1 === x2 ? 0.16 : len + 0.16;
    const sz = z1 === z2 ? 0.16 : len + 0.16;
    return (
      <group key={i} position={[(x1 + x2) / 2, 0, (z1 + z2) / 2]}>
        <mesh geometry={unitBox} material={WALL_MAT} scale={[sx, h, sz]} />
        {/* light cap on top of the wall, like a real cut-away doll house */}
        <mesh geometry={unitBox} material={CAP_MAT} position={[0, h, 0]} scale={[sx + 0.04, 0.07, sz + 0.04]} />
        <mesh geometry={unitBox} material={SKIRT_MAT} position={[0, 0, 0]} scale={[sx + 0.03, 0.12, sz + 0.03]} />
      </group>
    );
  });
}

function Garden() {
  return (
    <group>
      {/* Wide enough for the yard on the east side. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[5, -0.04, 0]} material={mat('#c7dca6')}><circleGeometry args={[22, 56]} /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[2.5, -0.03, 6.6]} material={mat('#d6d3d1')}><planeGeometry args={[1.6, 3.2]} /></mesh>
      {[[-9, -6], [9, -8], [-10, 5], [6, 8.5]].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh geometry={geo('cyl', 0.15, 0.2, 1.4, 6)} material={mat('#7c5a3a')} position={[0, 0.7, 0]} />
          <mesh geometry={geo('sphere', 1, 7, 5)} material={mat('#3f9b4a')} position={[0, 1.9, 0]} />
        </group>
      ))}
    </group>
  );
}

/** Where (and how) the Sim sits/lies/stands to use an item. */
function poseFor(item, def, act) {
  const [w, d] = def.size;
  const r = (item.rot * Math.PI) / 2;
  const off = (lx, lz) => [item.x + lx * Math.cos(r) + lz * Math.sin(r), item.z - lx * Math.sin(r) + lz * Math.cos(r)];
  if (def.cat === 'sleep') {
    const [x, z] = off(0, d * 0.42);
    return { x, z, y: def.id === 'mkeka' ? 0.25 : 0.55, ry: r, mode: 'sleep' };
  }
  if (def.cat === 'sit' || act === 'choo') return { x: item.x, z: item.z, y: 0, ry: r, mode: 'sit' };
  if (def.id === 'tv') { const [x, z] = off(0, 2); return { x, z, y: 0, ry: r + Math.PI, mode: 'sit' }; }
  if (def.id === 'laptop') { const [x, z] = off(-0.5, 0.55); return { x, z, y: 0, ry: r + Math.PI, mode: 'sit' }; }
  if (def.id === 'radio' || def.id === 'speaker') { const [x, z] = off(0, 1.3); return { x, z, y: 0, ry: r + Math.PI, mode: 'dance' }; }
  if (def.id === 'jacuzzi') return { x: item.x, z: item.z, y: 0.15, ry: r, mode: 'sit' };
  if (def.id === 'machela') return { x: item.x - 0.6, z: item.z, y: 0.6, ry: r - Math.PI / 2, mode: 'sleep' };
  if (def.id === 'egg-chair') return { x: item.x, z: item.z + 0.1, y: 0.45, ry: r, mode: 'sit' };
  if (def.id === 'treadmill') return { x: item.x, z: item.z, y: 0.22, ry: r + Math.PI, mode: 'walk' };
  // Stand/sit in front of the item facing it: [mode, distance in front].
  const POSE = { game: ['type', def.id === 'ps5' ? 0.4 : 0.8], pool: ['lift', def.size[1] > 1 ? 1.3 : 0.8], dj: ['dj', 0.75], imba: ['sing', 0.9], gitaa: ['sing', 0.6],
    kinanda: ['dj', 0.6], soma: ['idle', 0.8], bao: ['sit', 0.75], mazoezi: ['lift', 0.8], chora: ['lift', 0.8], tazama: ['idle', 1], jitazame: ['idle', 0.9],
    cheza: ['cheer', 0.9], kahawa: ['lift', 0.7], juisi: ['lift', 0.7], nawa: ['idle', 0.6] };
  if (POSE[act]) {
    const [mode, dist] = POSE[act];
    const [x, z] = off(0, dist);
    return { x, z, y: 0, ry: r + Math.PI, mode };
  }
  if (def.cat === 'bath') return { x: item.x, z: item.z, y: 0, ry: r, mode: 'idle' };
  const [x, z] = off(0, w > 1 ? 1.2 : 0.75);
  return { x, z, y: 0, ry: r + Math.PI, mode: act === 'snack' ? 'eat' : 'lift' };
}

function Sim({ me, items }) {
  const g = useRef();
  const motion = useRef({ mode: 'idle' });
  const busy = me.busy && me.busy.endsAt > Date.now() && me.busy.kind === 'home' ? me.busy : null;
  const item = busy && items.find((i) => i.id === busy.itemId);
  const pose = item && furnitureById[item.item] ? poseFor(item, furnitureById[item.item], busy.id) : null;
  useFrame((_, dt) => {
    const h = homeAvatar;
    if (pose) {
      g.current.position.set(pose.x, pose.y, pose.z);
      g.current.rotation.y = pose.ry;
      motion.current.mode = pose.mode;
      h.x = pose.x;
      h.z = pose.z;
      h.target = null;
      sendHomePos(pose.x, pose.z, pose.ry, pose.mode, pose.y);
      return;
    }
    let moving = false;
    if (h.target) {
      const dx = h.target[0] - h.x;
      const dz = h.target[1] - h.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.08) {
        h.target = null;
        const cb = h.arrive;
        h.arrive = null;
        cb?.();
      } else {
        const step = Math.min(d, 3.2 * Math.min(dt, 0.1));
        h.x += (dx / d) * step;
        h.z += (dz / d) * step;
        h.ry = Math.atan2(dx, dz);
        moving = true;
      }
    }
    motion.current.mode = moving ? 'walk' : 'idle';
    g.current.position.set(h.x, 0, h.z);
    g.current.rotation.y = h.ry;
    sendHomePos(h.x, h.z, h.ry, motion.current.mode);
  });
  return (
    <group ref={g}>
      <Body appearance={me.appearance} motion={motion} />
      <Overhead id={me.id} username={me.username} height={1.95} getBusy={() => busy} />
    </group>
  );
}

/** Someone else in the same home (host or fellow guest), smoothed toward their last position. */
function Guest({ g }) {
  const ref = useRef();
  const motion = useRef({ mode: 'idle' });
  const pos = useRef({ x: g.x, z: g.z, y: g.y || 0, ry: g.ry || 0 });
  useFrame((_, dt) => {
    const p = pos.current;
    const a = 1 - Math.exp(-Math.min(dt, 0.1) * 10);
    const d = Math.hypot(g.x - p.x, g.z - p.z);
    p.x += (g.x - p.x) * a;
    p.z += (g.z - p.z) * a;
    p.y += ((g.y || 0) - p.y) * a;
    let diff = (g.ry || 0) - p.ry;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    p.ry += diff * a;
    motion.current.mode = g.mode && g.mode !== 'idle' && g.mode !== 'walk' ? g.mode : d > 0.05 ? 'walk' : 'idle';
    ref.current.position.set(p.x, p.y, p.z);
    ref.current.rotation.y = p.ry;
  });
  return (
    <group ref={ref}>
      <Body appearance={g.appearance} motion={motion} />
      <Overhead id={g.id} username={g.username} height={1.95} />
    </group>
  );
}
function Guests() {
  const roster = useStore((s) => s.homeRoster);
  const list = useMemo(() => [...homeGuests.values()], [roster]); // eslint-disable-line react-hooks/exhaustive-deps
  return list.map((g) => <Guest key={`${g.id}-${g.appearance?.outfit}`} g={g} />);
}

/** Your cars on the driveway (up to 3, best first). Tap one to drive it out into town. */
function Driveway({ vehicles, mine }) {
  const run = useStore((s) => s.run);
  const cars = [...(vehicles || [])].filter((v) => vehicleById[v.model]).sort((a, b) => vehicleById[b.model].price - vehicleById[a.model].price).slice(0, 3);
  const driveOut = (v) => (e) => {
    if (!mine || e.delta > 10) return;
    e.stopPropagation();
    local.lastCar = v.id;
    useStore.setState({ tab: 'town', cityView: 'follow' });
    run('/vehicle/use', { method: 'POST', body: { vehicleId: v.id } });
  };
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-4.8, -0.02, 8.2]} material={mat('#9ca3af')}><planeGeometry args={[9, 5.6]} /></mesh>
      {cars.map((v, i) => {
        const d = vehicleById[v.model];
        return (
          <group key={v.id} position={[-1.8 - i * 3, 0, 8.2]} rotation={[0, Math.PI, 0]} scale={0.9} onClick={driveOut(v)}>
            <Vehicle kind={d.kind} body={d.body} lux={d.lux} color={v.color} />
          </group>
        );
      })}
    </group>
  );
}

function Ghost({ items }) {
  const placing = useStore((s) => s.placing);
  if (!placing) return null;
  const others = items.filter((i) => i.id !== placing.id);
  const ok = homeFits(placing.def, placing.x, placing.z, placing.rot, others);
  const [w, d] = footprint(placing.def, placing.rot);
  return (
    <group position={[placing.x, 0.02, placing.z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <planeGeometry args={[w, d]} />
        <meshBasicMaterial color={ok ? '#22c55e' : '#ef4444'} transparent opacity={0.3} depthWrite={false} />
      </mesh>
      <group rotation={[0, (placing.rot * Math.PI) / 2, 0]}>
        <FurnitureModel def={placing.def} ghost={ok ? 'ok' : 'bad'} />
      </group>
    </group>
  );
}

/** Snap an item's centre so its footprint lines up with the grid. */
export function snapCenter(v, size, half) {
  const off = (size % 2) / 2;
  return Math.max(-half + size / 2, Math.min(half - size / 2, Math.round(v - off) + off));
}

export function HomeScene({ me }) {
  const own = useStore((s) => s.homeItems);
  const visiting = useStore((s) => s.visiting);
  const items = visiting ? visiting.items : own;
  const events = useStore((s) => s.events);
  const party = livePartyAt(events, 'home', visiting ? visiting.host.id : me.id);
  const placing = useStore((s) => s.placing);
  const dragging = useRef(false);
  // The yard beside the house: yours (kept in the store, updated by build mode) or the host's.
  const myYard = useStore((s) => s.yard);
  const hostYard = useStore((s) => s.visitYard);
  const host = visiting?.host?.username;
  useEffect(() => {
    useStore.setState({ visitYard: null });
    if (host) api(`/yard/${encodeURIComponent(host)}`).then((y) => useStore.setState({ visitYard: y })).catch(() => {});
    else api('/yard').then((y) => useStore.setState({ yard: y })).catch(() => {});
  }, [host]);

  const floorPoint = (e) => [e.point.x - HOME_ORIGIN[0], e.point.z - HOME_ORIGIN[2]];
  const moveGhost = (pt) => {
    const p = useStore.getState().placing;
    if (!p) return;
    const [w, d] = footprint(p.def, p.rot);
    useStore.setState({ placing: { ...p, x: snapCenter(pt[0], w, HOME.w / 2), z: snapCenter(pt[1], d, HOME.d / 2) } });
  };
  const onFloorClick = (e) => {
    if (e.delta > 10 && !useStore.getState().placing) return;
    e.stopPropagation();
    const pt = floorPoint(e);
    if (useStore.getState().placing) return moveGhost(pt);
    homeAvatar.target = [Math.max(-5.6, Math.min(5.6, pt[0])), Math.max(-4.6, Math.min(4.6, pt[1]))];
    homeAvatar.arrive = null;
  };

  return (
    <group position={HOME_ORIGIN}>
      <Shadows light={[6, 12, 7]} size={14} intensity={0.7}>
      <Garden />
      <Floor x1={-6} x2={6} z1={-5} z2={5} a="#ece6d8" b="#e2dac8" />
      <Floor x1={1.5} x2={6} z1={-5} z2={-1} a="#b98552" b="#a8744a" y={0.008} kind="wood" />
      <Floor x1={-6} x2={-2} z1={1.5} z2={5} a="#e0ecf7" b="#cfe0f0" y={0.008} kind="small" />
      <Walls />
      {/* invisible click/drag surface for walking and placing */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.02, 0]}
        visible={false}
        onClick={onFloorClick}
        onPointerDown={(e) => { if (useStore.getState().placing) { dragging.current = true; e.stopPropagation(); moveGhost(floorPoint(e)); } }}
        onPointerMove={(e) => { if (dragging.current) moveGhost(floorPoint(e)); }}
        onPointerUp={() => (dragging.current = false)}
        onPointerLeave={() => (dragging.current = false)}
      >
        <planeGeometry args={[HOME.w, HOME.d]} />
      </mesh>
      {items.map((it) => {
        const def = furnitureById[it.item];
        if (!def || placing?.id === it.id) return null;
        return (
          <group
            key={it.id}
            position={[it.x, 0.01, it.z]}
            rotation={[0, (it.rot * Math.PI) / 2, 0]}
            onClick={(e) => {
              if (e.delta > 10) return;
              e.stopPropagation();
              const st = useStore.getState();
              if (st.placing) return;
              if (st.tab === 'shop') useStore.setState({ placing: { def, x: it.x, z: it.z, rot: it.rot, id: it.id } });
              else useStore.setState({ homeSel: it.id });
            }}
          >
            <FurnitureModel def={def} />
          </group>
        );
      })}
      <Yard yard={visiting ? hostYard : myYard} mine={!visiting} origin={HOME_ORIGIN} />
      <Ghost items={items} />
      <Sim me={me} items={items} />
      <Guests />
      {party && <PartyDecor event={party} home />}
      <Driveway vehicles={visiting ? visiting.host.vehicles : me.vehicles} mine={!visiting} />
      <pointLight color="#fff7ed" intensity={10} distance={20} position={[0, 4, 0]} />
      </Shadows>
    </group>
  );
}
