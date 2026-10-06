import { memo, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  WATER, LAND_PATCHES, BRIDGES, BEACHES, ROADS, PLACES, PLOTS, BILLBOARDS, DISTRICTS, WORLD_SIZE,
  isWater, onRoad, buildingById, fmtShort, randomAppearance,
} from '@shared/world.js';
import { mat, geo, emojiTexture, labelTexture, windowTexture, adTexture } from './textures.js';
import { Vehicle, Boat } from './Vehicle.jsx';
import { Avatar } from './Avatar.jsx';
import { L, loc } from '../i18n.js';

const GRASS = '#c7dca6';
const PAD = '#eceee6';
const WATER_C = '#58b4e3';
const SAND = '#f3e3b5';

function rng(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rectOf = (pos, size, pad = 0) => ({ x1: pos[0] - size[0] / 2 - pad, x2: pos[0] + size[0] / 2 + pad, z1: pos[1] - size[1] / 2 - pad, z2: pos[1] + size[1] / 2 + pad });
const inR = (r, x, z) => x >= r.x1 && x <= r.x2 && z >= r.z1 && z <= r.z2;

// Areas the procedural filler must avoid.
const RESERVED = [
  ...PLACES.map((p) => rectOf(p.pos, p.size, 5)),
  ...PLOTS.map((p) => rectOf(p.pos, [p.size, p.size], 2.5)),
  ...BILLBOARDS.map((b) => rectOf(b.pos, [6, 6])),
  ...BEACHES,
  ...BRIDGES.map((b) => ({ x1: b.x1 - 4, x2: b.x2 + 4, z1: b.z1 - 4, z2: b.z2 + 4 })),
];
const isReserved = (x, z, pad = 0) => RESERVED.some((r) => x >= r.x1 - pad && x <= r.x2 + pad && z >= r.z1 - pad && z <= r.z2 + pad);

// ------------------------------------------------------------ terrain
function Terrain({ onGround }) {
  const handle = (e) => {
    if (e.delta > 10) return;
    e.stopPropagation();
    onGround?.([e.point.x, e.point.z]);
  };
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} material={mat(GRASS)} onClick={handle}>
        <planeGeometry args={[WORLD_SIZE + 200, WORLD_SIZE + 200]} />
      </mesh>
      {WATER.map((w) => (
        <mesh key={w.id} rotation={[-Math.PI / 2, 0, 0]} position={[(w.x1 + w.x2) / 2, 0.03, (w.z1 + w.z2) / 2]} material={mat(WATER_C)} onClick={handle}>
          <planeGeometry args={[w.x2 - w.x1, w.z2 - w.z1]} />
        </mesh>
      ))}
      {/* beyond the world edge: ocean everywhere east */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[260, 0.02, 0]} material={mat(WATER_C)}>
        <planeGeometry args={[200, 600]} />
      </mesh>
      {LAND_PATCHES.map((l) => (
        <mesh key={l.id} rotation={[-Math.PI / 2, 0, 0]} position={[(l.x1 + l.x2) / 2, 0.05, (l.z1 + l.z2) / 2]} material={mat(GRASS)} onClick={handle}>
          <planeGeometry args={[l.x2 - l.x1, l.z2 - l.z1]} />
        </mesh>
      ))}
      {BEACHES.map((b) => (
        <mesh key={b.id} rotation={[-Math.PI / 2, 0, 0]} position={[(b.x1 + b.x2) / 2, 0.07, (b.z1 + b.z2) / 2]} material={mat(SAND)} onClick={handle}>
          <planeGeometry args={[b.x2 - b.x1, b.z2 - b.z1]} />
        </mesh>
      ))}
      {BRIDGES.map((b) => (
        <group key={b.id}>
          <mesh position={[(b.x1 + b.x2) / 2, 0.5, (b.z1 + b.z2) / 2]} geometry={geo('box', b.x2 - b.x1, 0.6, b.z2 - b.z1)} material={mat('#9ca3af')} onClick={handle} />
          {[b.x1, b.x2].map((x) => (
            <mesh key={x} position={[x, 1.3, (b.z1 + b.z2) / 2]} geometry={geo('box', 0.3, 1, b.z2 - b.z1)} material={mat('#e5e7eb')} />
          ))}
          {[b.x1 + 1, b.x2 - 1].map((x) => (
            <group key={'t' + x}>
              <mesh position={[x, 5, (b.z1 + b.z2) / 2]} geometry={geo('box', 0.6, 9, 0.6)} material={mat('#f1f5f9')} />
            </group>
          ))}
        </group>
      ))}
      <WaterText />
    </group>
  );
}

function FlatText({ text, pos, size = 6, color = 'rgba(255,255,255,.55)' }) {
  const { texture, aspect } = useMemo(() => labelTexture(text, { bg: 'rgba(0,0,0,0)', fg: color, size: 64, bold: 800 }), [text, color]);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[pos[0], 0.09, pos[1]]}>
      <planeGeometry args={[size * aspect, size]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} />
    </mesh>
  );
}

function WaterText() {
  return (
    <>
      <FlatText text={L('BAHARI YA HINDI', 'INDIAN OCEAN')} pos={[125, 10]} size={9} />
      <FlatText text="DAR ES SALAAM" pos={[65, 48]} size={6} />
    </>
  );
}

// -------------------------------------------------------------- roads
function Roads({ onGround }) {
  const handle = (e) => {
    if (e.delta > 10) return;
    e.stopPropagation();
    onGround?.([e.point.x, e.point.z]);
  };
  return (
    <group>
      {ROADS.map(([x1, z1, x2, z2, w], i) => {
        const horiz = z1 === z2;
        const len = horiz ? Math.abs(x2 - x1) : Math.abs(z2 - z1);
        const cx = (x1 + x2) / 2;
        const cz = (z1 + z2) / 2;
        return (
          <group key={i}>
            <mesh position={[cx, 0.08, cz]} rotation={[-Math.PI / 2, 0, horiz ? 0 : Math.PI / 2]} material={mat('#9aa0a8')} onClick={handle}>
              <planeGeometry args={[len, w]} />
            </mesh>
            <RoadLine cx={cx} cz={cz} len={len} horiz={horiz} />
          </group>
        );
      })}
    </group>
  );
}

const dashCache = new Map();
function RoadLine({ cx, cz, len, horiz }) {
  const tex = useMemo(() => {
    const n = Math.round(len / 6);
    if (dashCache.has(n)) return dashCache.get(n);
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 4;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 34, 4);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = THREE.RepeatWrapping;
    t.repeat.set(n, 1);
    dashCache.set(n, t);
    return t;
  }, [len]);
  return (
    <mesh position={[cx, 0.1, cz]} rotation={[-Math.PI / 2, 0, horiz ? 0 : Math.PI / 2]}>
      <planeGeometry args={[len, 0.25]} />
      <meshBasicMaterial map={tex} transparent opacity={0.85} depthWrite={false} />
    </mesh>
  );
}

// -------------------------------------------------- procedural filler
const HOUSE_COLORS = ['#f5f5f4', '#fde68a', '#fecaca', '#bfdbfe', '#d9f99d', '#e9d5ff', '#fed7aa', '#e2e8f0', '#99f6e4'];
const TOWER_COLORS = ['#cbd5e1', '#bae6fd', '#e2e8f0', '#a5b4fc', '#94a3b8'];

function useFiller() {
  return useMemo(() => {
    const r = rng(20261006);
    const houses = [];
    const towers = [];
    const trees = [];
    const palms = [];
    const step = 8.5;
    const half = WORLD_SIZE / 2 - 4;
    for (let x = -half; x <= half; x += step)
      for (let z = -half; z <= half; z += step) {
        const jx = x + (r() - 0.5) * 3;
        const jz = z + (r() - 0.5) * 3;
        if (isWater(jx, jz) || isWater(jx + 4, jz) || isWater(jx - 4, jz) || isWater(jx, jz + 4) || isWater(jx, jz - 4)) {
          continue;
        }
        if (onRoad(jx, jz, 4) || isReserved(jx, jz, 1)) {
          if (!onRoad(jx, jz, 1.2) && !isReserved(jx, jz, 4) && r() < 0.25) (jx > 60 ? palms : trees).push([jx, jz, 0.8 + r() * 0.6]);
          continue;
        }
        const posta = jx > 32 && jx < 74 && jz > -44 && jz < 34;
        const dense = posta || (jx > -20 && jx < 30 && jz > -44 && jz < 34) || (jx > -110 && jx < -55 && jz > -90 && jz < -45);
        const p = r();
        if (p < (dense ? 0.78 : 0.5)) {
          const w = 4 + r() * 3;
          const d = 4 + r() * 3;
          if (posta && r() < 0.7) towers.push({ x: jx, z: jz, w: w + 1, d: d + 1, h: 10 + r() * 22, c: TOWER_COLORS[Math.floor(r() * TOWER_COLORS.length)] });
          else houses.push({ x: jx, z: jz, w, d, h: dense ? 3 + r() * 6 : 2.4 + r() * 2.6, c: HOUSE_COLORS[Math.floor(r() * HOUSE_COLORS.length)] });
        } else if (p < 0.8 && !isReserved(jx, jz, 4)) (jx > 60 || jz > 54 ? palms : trees).push([jx, jz, 0.7 + r() * 0.5]);
      }
    return { houses, towers, trees, palms };
  }, []);
}

function Instanced({ items, geometry, material, transform }) {
  const ref = useRef();
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    const c = new THREE.Color();
    items.forEach((it, i) => {
      const t = transform(it);
      p.set(...t.pos);
      s.set(...t.scale);
      q.setFromEuler(new THREE.Euler(0, t.rot || 0, 0));
      m.compose(p, q, s);
      ref.current.setMatrixAt(i, m);
      if (t.color) ref.current.setColorAt(i, c.set(t.color));
    });
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, [items, transform]);
  return <instancedMesh ref={ref} args={[geometry, material, items.length]} frustumCulled={false} />;
}

const NEON_PINK = new THREE.MeshBasicMaterial({ color: '#ec4899' });
const NEON_CYAN = new THREE.MeshBasicMaterial({ color: '#22d3ee' });
const unitBox = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
const whiteMat = new THREE.MeshLambertMaterial({ color: '#ffffff' });
const towerMat = new THREE.MeshLambertMaterial({ color: '#ffffff' });
const roofMat = new THREE.MeshLambertMaterial({ color: '#ffffff' });
const trunkGeo = new THREE.CylinderGeometry(0.18, 0.25, 1, 6).translate(0, 0.5, 0);
const crownGeo = new THREE.IcosahedronGeometry(1, 0);
const palmLeafGeo = new THREE.ConeGeometry(1.8, 0.8, 7).translate(0, -0.2, 0);

const Filler = memo(function Filler() {
  const { houses, towers, trees, palms } = useFiller();
  useEffect(() => {
    const t = windowTexture().clone();
    t.repeat.set(2, 5);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.needsUpdate = true;
    towerMat.map = t;
    towerMat.needsUpdate = true;
  }, []);
  return (
    <group>
      <Instanced items={houses} geometry={unitBox} material={whiteMat} transform={(h) => ({ pos: [h.x, 0, h.z], scale: [h.w, h.h, h.d], color: h.c })} />
      <Instanced items={houses} geometry={unitBox} material={roofMat} transform={(h) => ({ pos: [h.x, h.h, h.z], scale: [h.w + 0.4, 0.35, h.d + 0.4], color: '#9ca3af' })} />
      <Instanced items={towers} geometry={unitBox} material={towerMat} transform={(h) => ({ pos: [h.x, 0, h.z], scale: [h.w, h.h, h.d], color: h.c })} />
      <Instanced items={trees} geometry={trunkGeo} material={mat('#7c5a3a')} transform={([x, z, s]) => ({ pos: [x, 0, z], scale: [s, 1.6 * s, s] })} />
      <Instanced items={trees} geometry={crownGeo} material={mat('#3f9b4a')} transform={([x, z, s]) => ({ pos: [x, 2.2 * s, z], scale: [1.5 * s, 1.4 * s, 1.5 * s] })} />
      <Instanced items={palms} geometry={trunkGeo} material={mat('#9a7b4f')} transform={([x, z, s]) => ({ pos: [x, 0, z], scale: [s * 0.8, 4.5 * s, s * 0.8] })} />
      <Instanced items={palms} geometry={palmLeafGeo} material={mat('#2f9e57')} transform={([x, z, s]) => ({ pos: [x, 4.6 * s, z], scale: [s, s, s], rot: x })} />
    </group>
  );
});

// -------------------------------------------------------------- places
function Sign({ text, w, y, z, bg = '#ffffff', fg = '#111827' }) {
  const { texture, aspect } = useMemo(() => labelTexture(text, { bg, fg, size: 44 }), [text, bg, fg]);
  const h = Math.min(1.6, (w * 0.9) / aspect);
  return (
    <mesh position={[0, y, z]}>
      <planeGeometry args={[h * aspect, h]} />
      <meshBasicMaterial map={texture} transparent />
    </mesh>
  );
}

function Box({ w, h, d, color, y = 0, x = 0, z = 0, m }) {
  return <mesh geometry={unitBox} material={m || mat(color)} position={[x, y, z]} scale={[w, h, d]} />;
}

function Umbrella({ x, z, c }) {
  return (
    <group position={[x, 0, z]}>
      <mesh geometry={geo('cyl', 0.06, 0.06, 2.4, 5)} material={mat('#e5e7eb')} position={[0, 1.2, 0]} />
      <mesh geometry={geo('cone', 1.4, 0.6, 8)} material={mat(c)} position={[0, 2.5, 0]} />
      <mesh geometry={geo('box', 0.7, 0.15, 1.6)} material={mat('#ffffff')} position={[1, 0.25, 0.3]} />
    </group>
  );
}

function PlaceModel({ place, owner }) {
  const [w, d] = place.size;
  const h = place.h;
  const c = place.color;
  switch (place.type) {
    case 'beach':
      return (
        <group>
          {Array.from({ length: Math.floor(d / 6) }, (_, i) => (
            <Umbrella key={i} x={(i % 2 ? -1 : 1) * 1.5} z={-d / 2 + 3 + i * 6} c={['#ef4444', '#f59e0b', '#3b82f6', '#22c55e', '#ec4899'][i % 5]} />
          ))}
        </group>
      );
    case 'stadium':
      return (
        <group>
          <mesh geometry={geo('cyl', w / 2, w / 2 + 1, h, 28, 1, true)} material={mat('#e5e7eb', { side: THREE.DoubleSide })} position={[0, h / 2, 0]} scale={[1, 1, d / w]} />
          <mesh geometry={geo('cyl', w / 2 - 1, w / 2 - 1, 0.3, 28)} material={mat('#4ade80')} position={[0, 0.15, 0]} scale={[0.8, 1, (d / w) * 0.8]} />
          <mesh geometry={geo('box', 0.2, 0.05, d * 0.55)} material={mat('#ffffff')} position={[0, 0.33, 0]} />
          <Sign text={L('UWANJA WA TAIFA', 'NATIONAL STADIUM')} w={w * 0.7} y={h + 1} z={d / 2 + 0.6} />
        </group>
      );
    case 'ferry':
      return (
        <group>
          <Box w={w} h={0.8} d={d} color="#94a3b8" />
          <group position={[0, 0, place.id === 'ferry' ? d / 2 + 6 : -d / 2 - 6]}>
            <Boat />
          </group>
        </group>
      );
    case 'yard':
      return (
        <group>
          <Box w={w} h={0.12} d={d} color="#d1d5db" />
          {[['car', '#e5e7eb', -4, -2], ['suv', '#111827', 0, -2], ['van', '#1f2937', 4, -2], ['moto', '#dc2626', -4, 3], ['bajaji', '#facc15', 0.5, 3], ['suv', '#7f1d1d', 4.5, 3]].map(([k, col, x, z], i) => (
            <group key={i} position={[x, 0.12, z]} rotation={[0, 0.4, 0]} scale={0.8}>
              <Vehicle kind={k} color={col} />
            </group>
          ))}
          <mesh geometry={geo('box', w, 0.8, 0.1)} material={mat('#2fb06f')} position={[0, 3.2, d / 2]} />
          <Sign text={L('YADI YA MAGARI', 'CAR YARD')} w={w * 0.8} y={3.2} z={d / 2 + 0.06} bg="#2fb06f" fg="#ffffff" />
          {[-w / 2, w / 2].map((x) => <mesh key={x} geometry={geo('box', 0.2, 3.6, 0.2)} material={mat('#6b7280')} position={[x, 1.8, d / 2]} />)}
        </group>
      );
    case 'terminal':
      return (
        <group>
          <Box w={w} h={0.12} d={d} color="#d1d5db" />
          <Box w={w} h={0.5} d={d * 0.5} color="#60a5fa" y={5} z={-d * 0.2} />
          {[-w / 2 + 1, 0, w / 2 - 1].map((x) => <mesh key={x} geometry={geo('box', 0.4, 5, 0.4)} material={mat('#e5e7eb')} position={[x, 2.5, 0]} />)}
          <group position={[-3, 0.1, 3]}><Vehicle kind="bus" color="#f8fafc" /></group>
          <group position={[3, 0.1, 3]}><Vehicle kind="bus" color="#fde047" /></group>
          <Sign text="STENDI YA MAGUFULI" w={w} y={6} z={-d * 0.2 + d * 0.25 + 0.02} />
        </group>
      );
    case 'airport':
      return (
        <group>
          <Box w={w} h={0.1} d={6} color="#4b5563" z={d / 2 + 5} />
          <Box w={w * 0.7} h={h} d={d * 0.6} color={c} />
          <Box w={w * 0.72} h={0.6} d={d * 0.64} color="#64748b" y={h} />
          <Box w={3} h={h + 8} d={3} color="#e2e8f0" x={w * 0.42} />
          <Box w={4.5} h={2.5} d={4.5} color="#93c5fd" x={w * 0.42} y={h + 8} />
          <Sign text="JULIUS NYERERE INT'L AIRPORT" w={w * 0.7} y={h - 2} z={d * 0.3 + 0.02} />
        </group>
      );
    case 'market':
      return (
        <group>
          <Box w={w} h={h} d={d} color={c} />
          <Box w={w + 0.6} h={0.5} d={d + 0.6} color="#b45309" y={h} />
          {Array.from({ length: 5 }, (_, i) => (
            <mesh key={i} geometry={geo('box', w / 5 - 0.3, 0.12, 2.2)} material={mat(['#ef4444', '#22c55e', '#3b82f6', '#f97316', '#a855f7'][i])} position={[-w / 2 + (i + 0.5) * (w / 5), 3, d / 2 + 1]} rotation={[0.35, 0, 0]} />
          ))}
          <Sign text={L('SOKO LA KARIAKOO', 'KARIAKOO MARKET')} w={w * 0.8} y={h - 1.6} z={d / 2 + 0.02} />
        </group>
      );
    case 'club':
    case 'lounge':
      return (
        <group>
          <Box w={w} h={h} d={d} color={c} />
          <mesh geometry={geo('box', w + 0.1, 0.25, d + 0.1)} material={NEON_PINK} position={[0, h - 0.6, 0]} />
          <mesh geometry={geo('box', w + 0.1, 0.25, d + 0.1)} material={NEON_CYAN} position={[0, 1.2, 0]} />
          <Sign text={loc(place).toUpperCase()} w={w * 0.85} y={h - 2} z={d / 2 + 0.06} bg="#111827" fg="#f472b6" />
        </group>
      );
    case 'tower':
    case 'bank':
    case 'office':
      return (
        <group>
          <mesh geometry={unitBox} material={towerFacade(c)} scale={[w, h, d]} />
          <Box w={w + 0.4} h={0.6} d={d + 0.4} color="#64748b" y={h} />
          <Box w={3} h={2.6} d={0.2} color="#1f2937" z={d / 2} />
          <Sign text={loc(place)} w={w} y={3.6} z={d / 2 + 0.05} />
        </group>
      );
    default:
      return (
        <group>
          <Box w={w} h={h} d={d} color={c} />
          <Box w={w + 0.5} h={0.5} d={d + 0.5} color="#6b7280" y={h} />
          <Box w={2.2} h={2.4} d={0.2} color="#374151" z={d / 2} />
          {place.type === 'food' && <mesh geometry={geo('box', w + 1, 0.15, 3)} material={mat('#f97316')} position={[0, 2.8, d / 2 + 1.3]} rotation={[0.25, 0, 0]} />}
          {place.type === 'campus' && <Box w={3} h={h + 6} d={3} color="#fef3c7" x={w / 2 - 2} />}
          {place.type === 'mall' && <Box w={w * 0.5} h={2} d={0.3} color="#7c3aed" y={h - 2.4} z={d / 2 + 0.1} />}
          <Sign text={loc(place)} w={w} y={Math.max(3.4, h - 1.4)} z={d / 2 + 0.12} />
        </group>
      );
  }
}

const facadeCache = new Map();
function towerFacade(color) {
  if (facadeCache.has(color)) return facadeCache.get(color);
  const t = windowTexture().clone();
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 8);
  t.needsUpdate = true;
  const m = new THREE.MeshLambertMaterial({ color, map: t });
  facadeCache.set(color, m);
  return m;
}

export function Marker({ emoji, y, scale = 3.2, label, onClick, ring }) {
  const tex = useMemo(() => emojiTexture(emoji, { ring }), [emoji, ring]);
  const lab = useMemo(() => (label ? labelTexture(label, { size: 34 }) : null), [label]);
  return (
    <group position={[0, y, 0]}>
      <sprite scale={[scale, scale, 1]} onClick={onClick} renderOrder={5}>
        <spriteMaterial map={tex} depthWrite={false} />
      </sprite>
      {lab && (
        <sprite scale={[1.1 * lab.aspect, 1.1, 1]} position={[0, -scale * 0.62, 0]} renderOrder={5}>
          <spriteMaterial map={lab.texture} depthWrite={false} />
        </sprite>
      )}
    </group>
  );
}

const Places = memo(function Places({ onPlace, businesses, showLabels }) {
  return PLACES.map((p) => {
    const click = (e) => {
      if (e.delta > 10) return;
      e.stopPropagation();
      onPlace?.(p.id);
    };
    const [w, d] = p.size;
    return (
      <group key={p.id} position={[p.pos[0], 0, p.pos[1]]}>
        {p.type !== 'beach' && p.type !== 'ferry' && (
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.09, 0]} material={mat(PAD)}>
            <planeGeometry args={[w + 5, d + 5]} />
          </mesh>
        )}
        <PlaceModel place={p} owner={businesses?.[p.id]} />
        <mesh position={[0, Math.max(2, p.h) / 2, 0]} onClick={click} visible={false}>
          <boxGeometry args={[w + 2, Math.max(4, p.h), d + 2]} />
        </mesh>
        <Marker emoji={p.icon} y={Math.max(p.h, 2) + 3.4} label={showLabels ? loc(p) : null} onClick={click} />
      </group>
    );
  });
});

// --------------------------------------------------------------- plots
function House({ b, size }) {
  const s = size * 0.62;
  const fh = 2.6;
  const H = b.floors * fh;
  return (
    <group>
      <Box w={s} h={H} d={s} m={b.floors > 2 ? towerFacade(b.color) : mat(b.color)} />
      {b.floors <= 2 ? (
        <mesh geometry={geo('cone', s * 0.78, 2.2, 4)} material={mat('#b45309')} position={[0, H + 1.1, 0]} rotation={[0, Math.PI / 4, 0]} />
      ) : (
        <Box w={s + 0.4} h={0.5} d={s + 0.4} color="#64748b" y={H} />
      )}
      <Box w={1.4} h={2.1} d={0.15} color="#7c2d12" z={s / 2} />
      {b.pool && <Box w={s * 0.6} h={0.1} d={1.8} color="#38bdf8" z={s / 2 + 1.6} x={-0.5} y={0.05} />}
      {b.floors <= 2 && <Box w={size - 0.6} h={0.9} d={0.25} color="#f8fafc" z={size / 2 - 0.3} />}
    </group>
  );
}

const Plots = memo(function Plots({ plots, onPlot, myUsername }) {
  return PLOTS.map((p) => {
    const st = plots?.[p.id];
    const b = st?.building && buildingById[st.building];
    const click = (e) => {
      if (e.delta > 10) return;
      e.stopPropagation();
      onPlot?.(p.id);
    };
    const mine = st && st.owner === myUsername;
    return (
      <group key={p.id} position={[p.pos[0], 0, p.pos[1]]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 0]} material={mat(st ? (mine ? '#bbf7d0' : '#e7e5e4') : '#e8d9b5')} onClick={click}>
          <planeGeometry args={[p.size, p.size]} />
        </mesh>
        {b ? (
          <House b={b} size={p.size} />
        ) : (
          <group>
            {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => (
              <mesh key={i} geometry={geo('box', 0.2, 1, 0.2)} material={mat('#78716c')} position={[(sx * p.size) / 2, 0.5, (sz * p.size) / 2]} />
            ))}
          </group>
        )}
        <Marker
          emoji={b ? (mine ? '🏡' : '🏠') : st ? '🚧' : '🏷️'}
          y={b ? b.floors * 2.6 + 4.5 : 3}
          scale={2.4}
          label={st ? `@${st.owner}` : `TSh ${fmtShort(p.price)}`}
          ring={mine ? '#2fb06f' : undefined}
          onClick={click}
        />
      </group>
    );
  });
});

// ----------------------------------------------------------- billboards
function Billboard({ slot, ad, onClick }) {
  const tex = useMemo(() => adTexture(ad, loc(slot)), [ad?.id, ad?.image, slot.name]);
  useEffect(() => () => tex.dispose(), [tex]);
  const click = (e) => {
    if (e.delta > 10) return;
    e.stopPropagation();
    onClick?.(slot.id);
  };
  return (
    <group position={[slot.pos[0], 0, slot.pos[1]]} rotation={[0, slot.rot, 0]}>
      {[-2.6, 2.6].map((x) => <mesh key={x} geometry={geo('box', 0.3, 5, 0.3)} material={mat('#374151')} position={[x, 2.5, 0]} />)}
      <mesh geometry={geo('box', 8.4, 4.4, 0.3)} material={mat('#111827')} position={[0, 6.6, -0.1]} />
      <mesh position={[0, 6.6, 0.06]} onClick={click}>
        <planeGeometry args={[8, 4]} />
        <meshBasicMaterial map={tex} />
      </mesh>
      <mesh position={[0, 6.6, -0.26]} rotation={[0, Math.PI, 0]} onClick={click}>
        <planeGeometry args={[8, 4]} />
        <meshBasicMaterial map={tex} />
      </mesh>
    </group>
  );
}

const Billboards = memo(function Billboards({ ads, onBillboard }) {
  const bySlot = useMemo(() => Object.fromEntries((ads || []).map((a) => [a.slot_id, a])), [ads]);
  return BILLBOARDS.map((b) => <Billboard key={b.id} slot={b} ad={bySlot[b.id]} onClick={onBillboard} />);
});

// -------------------------------------------------------------- traffic
const TRAFFIC_KINDS = [
  ['bajaji', '#facc15'], ['bus', '#f8fafc'], ['moto', '#dc2626'], ['car', '#e5e7eb'], ['bajaji', '#16a34a'],
  ['suv', '#111827'], ['bus', '#fde047'], ['car', '#1d4ed8'], ['moto', '#111827'], ['van', '#f8fafc'],
  ['car', '#7f1d1d'], ['bajaji', '#2563eb'], ['bus', '#e2e8f0'], ['moto', '#16a34a'], ['car', '#e5e7eb'], ['suv', '#f8fafc'],
];

function Traffic() {
  const refs = useRef([]);
  const state = useMemo(() => {
    const r = rng(7);
    return TRAFFIC_KINDS.map(([kind, color], i) => {
      const road = ROADS[i % ROADS.length];
      return { kind, color, road, t: r(), dir: r() < 0.5 ? 1 : -1, speed: kind === 'bus' ? 7 : kind === 'moto' ? 13 : 10 };
    });
  }, []);
  useFrame((_, dt) => {
    dt = Math.min(dt, 0.1);
    state.forEach((s, i) => {
      const g = refs.current[i];
      if (!g) return;
      const [x1, z1, x2, z2] = s.road;
      const len = Math.hypot(x2 - x1, z2 - z1);
      s.t += (s.dir * s.speed * dt) / len;
      if (s.t > 1) { s.t = 1; s.dir = -1; }
      if (s.t < 0) { s.t = 0; s.dir = 1; }
      const horiz = z1 === z2;
      const lane = s.dir * 1.6;
      const x = x1 + (x2 - x1) * s.t + (horiz ? 0 : lane);
      const z = z1 + (z2 - z1) * s.t + (horiz ? -lane : 0);
      g.position.set(x, 0.1, z);
      const dx = (x2 - x1) * s.dir;
      const dz = (z2 - z1) * s.dir;
      g.rotation.y = Math.atan2(dx, dz);
    });
  });
  return state.map((s, i) => (
    <group key={i} ref={(el) => (refs.current[i] = el)}>
      <Vehicle kind={s.kind} color={s.color} />
    </group>
  ));
}

// ------------------------------------------------------------ walkers
function Walkers({ count = 10 }) {
  const items = useMemo(() => {
    const r = rng(42);
    return Array.from({ length: count }, () => {
      const p = PLACES[Math.floor(r() * PLACES.length)];
      const pos = [p.pos[0] + (r() - 0.5) * 8, p.pos[1] + p.size[1] / 2 + 3];
      return { appearance: randomAppearance(), pos, target: null, wait: r() * 4, motion: { current: { moving: false } } };
    });
  }, [count]);
  const refs = useRef([]);
  useFrame((_, dt) => {
    dt = Math.min(dt, 0.1);
    items.forEach((w, i) => {
      const g = refs.current[i];
      if (!g) return;
      if (!w.target) {
        w.wait -= dt;
        w.motion.current.moving = false;
        if (w.wait <= 0) {
          const near = PLACES.filter((p) => !p.comingSoon && Math.hypot(p.pos[0] - w.pos[0], p.pos[1] - w.pos[1]) < 70);
          const p = near[Math.floor(Math.random() * near.length)] || PLACES[0];
          const t = [p.pos[0] + (Math.random() - 0.5) * p.size[0], p.pos[1] + p.size[1] / 2 + 2.5];
          if (!isWater(t[0], t[1])) w.target = t;
          else w.wait = 1;
        }
      } else {
        const dx = w.target[0] - w.pos[0];
        const dz = w.target[1] - w.pos[1];
        const d = Math.hypot(dx, dz);
        if (d < 0.3) {
          w.target = null;
          w.wait = 2 + Math.random() * 5;
        } else {
          const sp = 3.2 * dt;
          w.pos[0] += (dx / d) * sp;
          w.pos[1] += (dz / d) * sp;
          g.rotation.y = Math.atan2(dx, dz);
          w.motion.current.moving = true;
        }
      }
      g.position.set(w.pos[0], 0.1, w.pos[1]);
    });
  });
  return items.map((w, i) => (
    <group key={i} ref={(el) => (refs.current[i] = el)}>
      <Avatar appearance={w.appearance} motion={w.motion} />
    </group>
  ));
}

function Districts() {
  return DISTRICTS.map((d) => <FlatText key={d.id} text={d.name.toUpperCase()} pos={[d.pos[0], d.pos[1] + 12]} size={3.2} color="rgba(55,65,81,.35)" />);
}

export function City({ world, ads, onPlace, onPlot, onBillboard, onGround, myUsername, walkers = 10, showLabels = true }) {
  return (
    <group>
      <Terrain onGround={onGround} />
      <Roads onGround={onGround} />
      <Filler />
      <Districts />
      <Places onPlace={onPlace} businesses={world?.businesses} showLabels={showLabels} />
      <Plots plots={world?.plots} onPlot={onPlot} myUsername={myUsername} />
      <Billboards ads={ads} onBillboard={onBillboard} />
      <Traffic />
      {walkers > 0 && <Walkers count={walkers} />}
    </group>
  );
}
