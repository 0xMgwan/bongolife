// "Kwangu" — the player's apartment: walls, rooms, furniture, the player's Sim,
// and the buy-mode placement preview. Rendered far from the city at HOME_ORIGIN.
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { HOME, furnitureById, footprint, homeFits } from '@shared/world.js';
import { mat, geo } from './textures.js';
import { FurnitureModel } from './Furniture.jsx';
import { Body, Overhead } from './Players.jsx';
import { useStore } from '../store.js';
import { homeGuests, sendHomePos } from '../net.js';

export const HOME_ORIGIN = [-4000, 0, 4000];
const WALL = '#15806b';
const unitBox = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);

/** Player position inside the home (local units), kept outside React. */
export const homeAvatar = { x: 0, z: 2, ry: Math.PI, target: null };

function checker(a, b, repeat) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = a;
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = b;
  ctx.fillRect(0, 0, 32, 32);
  ctx.fillRect(32, 32, 32, 32);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  return t;
}

function Floor({ x1, x2, z1, z2, a, b, y = 0.005 }) {
  const m = useMemo(() => new THREE.MeshLambertMaterial({ map: checker(a, b, [(x2 - x1) / 2, (z2 - z1) / 2]) }), [a, b, x1, x2, z1, z2]);
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
    return <mesh key={i} geometry={unitBox} material={mat(WALL)} position={[(x1 + x2) / 2, 0, (z1 + z2) / 2]} scale={[x1 === x2 ? 0.16 : len + 0.16, back ? 2.2 : 1.3, z1 === z2 ? 0.16 : len + 0.16]} />;
  });
}

function Garden() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]} material={mat('#c7dca6')}><circleGeometry args={[15, 48]} /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[2.5, -0.03, 6.6]} material={mat('#d6d3d1')}><planeGeometry args={[1.6, 3.2]} /></mesh>
      {[[-9, -6], [9, -7], [-10, 5], [10, 6]].map(([x, z], i) => (
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
  const placing = useStore((s) => s.placing);
  const dragging = useRef(false);

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
      <Garden />
      <Floor x1={-6} x2={6} z1={-5} z2={5} a="#e7e1d3" b="#d6cfbd" />
      <Floor x1={1.5} x2={6} z1={-5} z2={-1} a="#d4a373" b="#c48f5b" y={0.008} />
      <Floor x1={-6} x2={-2} z1={1.5} z2={5} a="#dbeafe" b="#bfdbfe" y={0.008} />
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
      <Ghost items={items} />
      <Sim me={me} items={items} />
      <Guests />
      <pointLight color="#fff7ed" intensity={14} distance={20} position={[0, 4, 0]} />
    </group>
  );
}
