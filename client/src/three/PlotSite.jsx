// Walk-in sites on plots that aren't towers: a working farm, factory floors (warehouse, food,
// textile, cement), a solar farm and a thatched eco resort. You walk around with the joystick
// (or tap the ground); workers, machines, tractors and forklifts keep busy around you.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mat, geo, labelTexture } from './textures.js';
import { Avatar } from './Avatar.jsx';
import { Car, Vehicle } from './Vehicle.jsx';
import { input, sendScenePos } from '../net.js';
import { sceneMe } from './SceneWalk.jsx';
import { sceneCam, Person, NPC_LOOKS } from './Scenes.jsx';
import { L, loc } from '../i18n.js';

const SX = 16; // half-width of the walkable site
const SZ = 11;
const unit = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
const B = ({ p, s, c, m, r }) => <mesh geometry={unit} material={m || mat(c)} position={p} scale={s} rotation={r} />;
const GLOW = (c) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false });

// ------------------------------------------------------------ walking
const walk = { target: null, blocks: [] };
function SiteWalker() {
  const sent = useRef(0);
  useEffect(() => {
    Object.assign(sceneMe, { active: true, x: 0, z: SZ - 3, y: 0, ry: Math.PI, moving: false });
    walk.target = null;
    return () => { walk.target = null; };
  }, []);
  useFrame((_, dt) => {
    dt = Math.min(dt, 0.1);
    const k = input.keys;
    let jx = input.jx;
    let jz = input.jz;
    if (k.has('w') || k.has('arrowup')) jz -= 1;
    if (k.has('s') || k.has('arrowdown')) jz += 1;
    if (k.has('a') || k.has('arrowleft')) jx -= 1;
    if (k.has('d') || k.has('arrowright')) jx += 1;
    let dx = 0;
    let dz = 0;
    if (Math.hypot(jx, jz) > 0.08) { dx = jx; dz = jz; walk.target = null; }
    else if (walk.target) {
      dx = walk.target[0] - sceneMe.x;
      dz = walk.target[1] - sceneMe.z;
      if (Math.hypot(dx, dz) < 0.15) { walk.target = null; dx = 0; dz = 0; }
    }
    const len = Math.hypot(dx, dz);
    let moving = false;
    if (len > 0.01) {
      const step = 4 * dt * Math.min(1, walk.target ? 1 : len);
      const nx = Math.max(-SX + 0.5, Math.min(SX - 0.5, sceneMe.x + (dx / len) * step));
      const nz = Math.max(-SZ + 0.5, Math.min(SZ - 0.5, sceneMe.z + (dz / len) * step));
      // Don't walk through machines and buildings.
      const hit = (x, z) => walk.blocks.some(([x1, z1, x2, z2]) => x > x1 && x < x2 && z > z1 && z < z2);
      if (!hit(nx, nz)) { sceneMe.x = nx; sceneMe.z = nz; }
      else if (!hit(nx, sceneMe.z)) sceneMe.x = nx;
      else if (!hit(sceneMe.x, nz)) sceneMe.z = nz;
      else walk.target = null;
      sceneMe.ry = Math.atan2(dx, dz);
      moving = true;
    }
    sceneMe.moving = moving;
    // High three-quarter view that keeps most of the site in frame while following you.
    sceneCam.pos = [sceneMe.x * 0.5, 17, Math.min(SZ + 14, sceneMe.z + 17)];
    sceneCam.look = [sceneMe.x * 0.7, 0, sceneMe.z - 5];
    const t = performance.now();
    if (t - sent.current > 140) {
      sent.current = t;
      sendScenePos({ x: +sceneMe.x.toFixed(2), z: +sceneMe.z.toFixed(2), ry: +sceneMe.ry.toFixed(2), m: moving, y: 0 });
    }
  });
  return null;
}
function Ground({ color }) {
  const tap = (e) => {
    if (e.delta > 10) return;
    e.stopPropagation();
    walk.target = [Math.max(-SX + 0.5, Math.min(SX - 0.5, e.point.x)), Math.max(-SZ + 0.5, Math.min(SZ - 0.5, e.point.z))];
  };
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} onClick={tap}><planeGeometry args={[SX * 2 + 30, SZ * 2 + 30]} /><meshLambertMaterial color={color} /></mesh>
      {/* boundary wall with a gate at the front */}
      {[[-SX - 0.2, 0, 0.3, SZ * 2], [SX + 0.2, 0, 0.3, SZ * 2], [0, -SZ - 0.2, SX * 2 + 0.6, 0.3]].map(([x, z, w, d], i) => <B key={i} p={[x, 0, z]} s={[w, 0.9, d]} c="#d6d3d1" />)}
      {[-1, 1].map((k) => <B key={k} p={[k * (SX / 2 + 2), 0, SZ + 0.2]} s={[SX - 4, 0.9, 0.3]} c="#d6d3d1" />)}
    </group>
  );
}
/** A worker walking back and forth between two points. */
function Worker({ a, b, look, speed = 1, mode = 'walk', offset = 0 }) {
  const g = useRef();
  const motion = useRef({ mode, moving: true });
  useFrame(({ clock }) => {
    if (!g.current) return;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const t = ((clock.elapsedTime * speed) / len + offset) % 2;
    const f = t < 1 ? t : 2 - t;
    g.current.position.set(a[0] + (b[0] - a[0]) * f, 0, a[1] + (b[1] - a[1]) * f);
    g.current.rotation.y = Math.atan2(b[0] - a[0], b[1] - a[1]) + (t < 1 ? 0 : Math.PI);
  });
  return <group ref={g}><Avatar appearance={look} motion={motion} /></group>;
}
const worker = (i, outfit) => ({ ...NPC_LOOKS[i % NPC_LOOKS.length], outfit: outfit || 'reflekta' });

// ------------------------------------------------------------- the farm
function Farm() {
  const tractor = useRef();
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 0.12;
    const g = tractor.current;
    if (!g) return;
    // Laps around the maize field.
    const p = (t % 1) * 4;
    const seg = Math.floor(p);
    const f = p - seg;
    const pts = [[-14, -9], [-2, -9], [-2, -1], [-14, -1], [-14, -9]];
    const [x1, z1] = pts[seg];
    const [x2, z2] = pts[seg + 1];
    g.position.set(x1 + (x2 - x1) * f, 0, z1 + (z2 - z1) * f);
    g.rotation.y = Math.atan2(x2 - x1, z2 - z1);
  });
  useEffect(() => { walk.blocks = [[7, -10, 15, -3.5]]; }, []);
  return (
    <group>
      <Ground color="#8db66b" />
      {/* maize field */}
      {Array.from({ length: 8 }, (_, r) => Array.from({ length: 10 }, (_, c) => (
        <group key={r + '-' + c} position={[-13 + c * 1.2, 0, -8.5 + r * 0.95]}>
          <mesh geometry={geo('cyl', 0.05, 0.07, 1.7, 5)} material={mat('#65a30d')} position={[0, 0.85, 0]} />
          <mesh geometry={geo('cone', 0.32, 0.9, 5)} material={mat('#84cc16')} position={[0, 1.6, 0]} />
          {(r + c) % 3 === 0 && <mesh geometry={geo('capsule', 0.07, 0.25, 3, 6)} material={mat('#facc15')} position={[0.1, 1.2, 0]} />}
        </group>
      )))}
      {/* tomato & greens beds with drip lines */}
      {Array.from({ length: 5 }, (_, r) => (
        <group key={r} position={[-8, 0, 2.5 + r * 1.6]}>
          <B p={[0, 0, 0]} s={[10, 0.25, 0.8]} c="#7c4a2d" />
          {Array.from({ length: 12 }, (_, i) => <mesh key={i} geometry={geo('sphere', 0.22, 6, 5)} material={mat(r % 2 ? '#16a34a' : '#22c55e')} position={[-4.6 + i * 0.84, 0.42, 0]} />)}
          {r % 2 === 0 && Array.from({ length: 6 }, (_, i) => <mesh key={'t' + i} geometry={geo('sphere', 0.09, 6, 5)} material={mat('#dc2626')} position={[-4.2 + i * 1.6, 0.6, 0.18]} />)}
        </group>
      ))}
      {/* red barn + silo + water tank */}
      <group position={[11, 0, -7]}>
        <B p={[0, 0, 0]} s={[7, 4, 6]} c="#b91c1c" />
        <mesh geometry={geo('cone', 5, 2.4, 4)} material={mat('#7f1d1d')} position={[0, 5.2, 0]} rotation={[0, Math.PI / 4, 0]} scale={[1, 1, 0.85]} />
        <B p={[0, 0, 3.02]} s={[2.6, 3, 0.05]} c="#fef3c7" />
        <mesh geometry={geo('cyl', 1.2, 1.2, 6, 16)} material={mat('#e5e7eb')} position={[5, 3, 0]} />
        <mesh geometry={geo('sphere', 1.2, 16, 8)} material={mat('#9ca3af')} position={[5, 6, 0]} />
      </group>
      <mesh geometry={geo('cyl', 0.9, 0.9, 1.6, 14)} material={mat('#1f2937')} position={[13.5, 3.2, 3]} />
      {[[12.8, 2.3], [14.2, 2.3], [12.8, 3.7], [14.2, 3.7]].map(([x, z], i) => <B key={i} p={[x, 0, z]} s={[0.12, 2.4, 0.12]} c="#78350f" />)}
      {/* tractor */}
      <group ref={tractor}>
        <B p={[0, 0.5, 0]} s={[1.3, 0.9, 2]} c="#16a34a" />
        <B p={[0, 1.4, -0.4]} s={[1.1, 1, 1]} c="#15803d" />
        {[[-0.75, -0.6, 0.6], [0.75, -0.6, 0.6], [-0.7, 0.75, 0.38], [0.7, 0.75, 0.38]].map(([x, z, r], i) => <mesh key={i} geometry={geo('cyl', r, r, 0.3, 14)} material={mat('#111827')} position={[x, r, z]} rotation={[0, 0, Math.PI / 2]} />)}
      </group>
      {/* scarecrow, chickens, workers */}
      <group position={[-1, 0, -4]}>
        <B p={[0, 0, 0]} s={[0.1, 2.2, 0.1]} c="#78350f" />
        <B p={[0, 1.6, 0]} s={[1.4, 0.1, 0.1]} c="#78350f" />
        <mesh geometry={geo('sphere', 0.25, 8, 6)} material={mat('#fde68a')} position={[0, 2.35, 0]} />
        <mesh geometry={geo('cone', 0.4, 0.3, 8)} material={mat('#a16207')} position={[0, 2.6, 0]} />
      </group>
      {Array.from({ length: 6 }, (_, i) => <mesh key={i} geometry={geo('sphere', 0.18, 6, 5)} material={mat(i % 3 ? '#f8fafc' : '#b45309')} position={[4 + (i % 3) * 0.8, 0.18, 6 + Math.floor(i / 3) * 0.7]} />)}
      <Worker a={[-12, 1.8]} b={[-4, 1.8]} look={worker(2, 'tshirt')} speed={0.8} />
      <Worker a={[-12, 5]} b={[-4, 5]} look={worker(5, 'kanga')} speed={0.7} offset={0.5} />
      <Worker a={[6, -2]} b={[10, -2]} look={worker(9, 'reflekta')} speed={1} />
    </group>
  );
}

// ---------------------------------------------------------- factories
const VARIANT = {
  warehouse: { floor: '#9ca3af', wall: '#2563eb', box: '#b45309' },
  food: { floor: '#e5e7eb', wall: '#16a34a', box: '#f97316' },
  textile: { floor: '#d6d3d1', wall: '#c026d3', box: '#f472b6' },
  cement: { floor: '#a8a29e', wall: '#78716c', box: '#d6d3d1' },
};
function Conveyor({ z, color }) {
  const boxes = useRef([]);
  useFrame(({ clock }) => {
    boxes.current.forEach((b, i) => {
      if (!b) return;
      b.position.x = -10 + ((clock.elapsedTime * 1.6 + i * 2.2) % 20);
    });
  });
  return (
    <group position={[0, 0, z]}>
      <B p={[0, 0, 0]} s={[20, 0.9, 1.2]} c="#374151" />
      <B p={[0, 0.9, 0]} s={[20, 0.06, 1]} c="#111827" />
      {Array.from({ length: 9 }, (_, i) => <mesh key={i} ref={(el) => (boxes.current[i] = el)} geometry={unit} material={mat(color)} position={[0, 0.96, 0]} scale={[0.7, 0.55, 0.7]} />)}
    </group>
  );
}
function Forklift() {
  const g = useRef();
  useFrame(({ clock }) => {
    if (!g.current) return;
    const t = (clock.elapsedTime * 0.15) % 2;
    const f = t < 1 ? t : 2 - t;
    g.current.position.set(-12 + f * 24, 0, 6.5);
    g.current.rotation.y = t < 1 ? Math.PI / 2 : -Math.PI / 2;
  });
  return (
    <group ref={g}>
      <B p={[0, 0.3, 0]} s={[1.2, 0.9, 1.8]} c="#facc15" />
      <B p={[0, 1.2, -0.3]} s={[1, 1, 0.9]} m={new THREE.MeshPhongMaterial({ color: '#bae6fd', transparent: true, opacity: 0.4 })} />
      <B p={[0, 0, 1.1]} s={[0.9, 2.2, 0.1]} c="#374151" />
      <B p={[0, 0.4, 1.5]} s={[1, 0.8, 0.9]} c="#b45309" />
      {[[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]].map(([x, z], i) => <mesh key={i} geometry={geo('cyl', 0.3, 0.3, 0.25, 12)} material={mat('#111827')} position={[x, 0.3, z]} rotation={[0, 0, Math.PI / 2]} />)}
    </group>
  );
}
function Factory({ variant = 'warehouse' }) {
  const V = VARIANT[variant] || VARIANT.warehouse;
  const smoke = useRef([]);
  useFrame(({ clock }) => {
    smoke.current.forEach((m, i) => {
      if (!m) return;
      const t = (clock.elapsedTime * 0.4 + i / 5) % 1;
      m.position.y = 14 + t * 6;
      m.scale.setScalar(0.6 + t * 1.6);
      m.material.opacity = 0.5 * (1 - t);
    });
  });
  useEffect(() => {
    walk.blocks = [[-10.2, -6.6, 10.2, -5.4], [-10.2, -1.6, 10.2, -0.4], [-15.5, -10.5, -11, -7], ...(variant === 'cement' || variant === 'food' ? [[10, -10.5, 15.5, -6.5]] : [])];
  }, [variant]);
  return (
    <group>
      <Ground color="#a3a3a3" />
      {/* polished hall floor, back wall with the company colour, sawtooth roof frame */}
      <B p={[0, -0.01, -2]} s={[SX * 2, 0.02, SZ * 2 - 4]} c={V.floor} />
      <B p={[0, 0, -SZ + 0.2]} s={[SX * 2, 7, 0.4]} c={V.wall} />
      {Array.from({ length: 8 }, (_, i) => <B key={i} p={[-14 + i * 4, 0, -SZ + 0.5]} s={[0.4, 7.4, 0.4]} c="#334155" />)}
      {Array.from({ length: 6 }, (_, i) => <B key={'r' + i} p={[0, 7.1, -9 + i * 3]} s={[SX * 2, 0.2, 0.2]} c="#475569" />)}
      {[-5, 0, 5].map((x) => <B key={x} p={[x, 4.5, -SZ + 0.42]} s={[3.2, 1.6, 0.02]} m={GLOW('#e0f2fe')} />)}
      {/* production lines */}
      <Conveyor z={-6} color={V.box} />
      <Conveyor z={-1} color={V.box} />
      {/* machines along the lines with status lights */}
      {[-7, -1, 5].map((x, i) => (
        <group key={x} position={[x, 0, -3.5]}>
          <B p={[0, 0, 0]} s={[2.2, 2.2, 1.6]} c={variant === 'textile' ? '#f5f5f4' : '#94a3b8'} />
          <B p={[0, 2.2, 0]} s={[1.6, 0.6, 1.2]} c="#475569" />
          <mesh geometry={geo('sphere', 0.15, 8, 6)} material={GLOW(i % 2 ? '#22c55e' : '#f59e0b')} position={[0.8, 2.1, 0.82]} />
          {variant === 'textile' && <mesh geometry={geo('cyl', 0.5, 0.5, 2, 14)} material={mat(['#f472b6', '#22d3ee', '#facc15'][i])} position={[0, 1.3, 0.9]} rotation={[0, 0, Math.PI / 2]} />}
        </group>
      ))}
      {/* tanks/silos for food & cement, pallet racks for the warehouse */}
      {(variant === 'food' || variant === 'cement') && [11.5, 14].map((x) => (
        <group key={x} position={[x, 0, -8.5]}>
          <mesh geometry={geo('cyl', 1.2, 1.2, variant === 'cement' ? 12 : 6, 16)} material={mat(variant === 'cement' ? '#d6d3d1' : '#e5e7eb')} position={[0, variant === 'cement' ? 6 : 3, 0]} />
          <mesh geometry={geo('cone', 1.2, 1.2, 16)} material={mat('#9ca3af')} position={[0, variant === 'cement' ? 12.6 : 6.6, 0]} />
        </group>
      ))}
      {variant === 'cement' && (
        <group position={[-13, 0, -9]}>
          <mesh geometry={geo('cyl', 0.9, 1.1, 14, 14)} material={mat('#78716c')} position={[0, 7, 0]} />
          {Array.from({ length: 5 }, (_, i) => (
            <mesh key={i} ref={(el) => (smoke.current[i] = el)} geometry={geo('sphere', 1, 10, 8)} position={[0, 14, 0]}>
              <meshLambertMaterial color="#e5e7eb" transparent opacity={0.4} depthWrite={false} />
            </mesh>
          ))}
        </group>
      )}
      {variant !== 'cement' && Array.from({ length: 3 }, (_, r) => (
        <group key={r} position={[-13.2, 0, -9.5 + r * 1.1]}>
          {[0, 1.2, 2.4].map((y) => <group key={y}><B p={[0, y, 0]} s={[4.2, 0.1, 0.9]} c="#f97316" /><B p={[-0.8, y + 0.1, 0]} s={[1, 0.8, 0.8]} c={V.box} /><B p={[0.8, y + 0.1, 0]} s={[1, 0.8, 0.8]} c={V.box} /></group>)}
        </group>
      ))}
      {/* loading bay with a truck */}
      <group position={[11, 0, 7]} rotation={[0, -Math.PI / 2, 0]}><Vehicle kind="van" color="#f8fafc" lite /></group>
      <Forklift />
      {/* office pod */}
      <group position={[-12, 0, 7.5]}>
        <B p={[0, 0, 0]} s={[5, 3, 3]} m={new THREE.MeshPhongMaterial({ color: '#bfdbfe', transparent: true, opacity: 0.55 })} />
        <B p={[0, 3, 0]} s={[5.2, 0.2, 3.2]} c="#334155" />
        <Person slot={[0, 0, 0, Math.PI]} appearance={NPC_LOOKS[3]} mode="sit" />
      </group>
      <Worker a={[-9, -2.4]} b={[9, -2.4]} look={worker(1)} speed={1} />
      <Worker a={[-9, -7.2]} b={[3, -7.2]} look={worker(6)} speed={0.8} offset={0.4} />
      <Worker a={[6, 2]} b={[6, 8]} look={worker(11, 'reflekta')} speed={0.9} />
      <Person slot={[-4, 0, -4.6, Math.PI]} appearance={worker(14)} mode="idle" />
    </group>
  );
}

// ---------------------------------------------------------- solar farm
function Solar() {
  useEffect(() => { walk.blocks = [[10, -10.5, 15.5, -5.5]]; }, []);
  const shine = useMemo(() => new THREE.MeshPhongMaterial({ color: '#1e3a8a', specular: '#93c5fd', shininess: 140 }), []);
  return (
    <group>
      <Ground color="#c2b280" />
      {Array.from({ length: 5 }, (_, r) => Array.from({ length: 6 }, (_, c) => (
        <group key={r + '-' + c} position={[-13 + c * 3.8, 0, -9 + r * 3.4]}>
          <B p={[0, 0, 0]} s={[0.12, 1.1, 0.12]} c="#9ca3af" />
          <mesh geometry={unit} material={shine} position={[0, 1.05, 0]} scale={[3.3, 0.08, 1.8]} rotation={[-0.45, 0, 0]} />
          {Array.from({ length: 3 }, (_, i) => <mesh key={i} geometry={unit} material={mat('#cbd5e1')} position={[-1.1 + i * 1.1, 1.13, 0]} scale={[0.02, 0.08, 1.8]} rotation={[-0.45, 0, 0]} />)}
        </group>
      )))}
      {/* inverter & control room, power line */}
      <group position={[12.5, 0, -8]}>
        <B p={[0, 0, 0]} s={[5, 3, 4]} c="#f8fafc" />
        <B p={[0, 3, 0]} s={[5.2, 0.2, 4.2]} c="#1e3a8a" />
        <mesh geometry={geo('sphere', 0.18, 8, 6)} material={GLOW('#22c55e')} position={[2.6, 2.4, 1]} />
      </group>
      {[5, 9, 13].map((z) => <B key={z} p={[14.5, 0, z - 9]} s={[0.25, 7, 0.25]} c="#57534e" />)}
      <Worker a={[-13, -7.3]} b={[7, -7.3]} look={worker(4, 'reflekta')} speed={0.6} />
      <Worker a={[-13, -0.5]} b={[7, -0.5]} look={worker(8)} speed={0.7} offset={0.6} />
    </group>
  );
}

// ------------------------------------------------------------- resort
function Resort() {
  useEffect(() => { walk.blocks = [[-6, -4, 6, 2], [-15, -9, -9, -4], [9, -9, 15, -4], [-3, -10.5, 3, -7]]; }, []);
  const water = useRef();
  useFrame(({ clock }) => { if (water.current) water.current.material.color.setHSL(0.52, 0.8, 0.55 + Math.sin(clock.elapsedTime * 2) * 0.03); });
  return (
    <group>
      <Ground color="#e9d8a6" />
      {/* pool with deck and loungers */}
      <B p={[0, 0, -1]} s={[13, 0.2, 7]} c="#f5f5f4" />
      <mesh ref={water} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.22, -1]}><planeGeometry args={[11.4, 5.6]} /><meshPhongMaterial color="#22d3ee" shininess={140} /></mesh>
      {[-4.5, -1.5, 1.5, 4.5].map((x) => <B key={x} p={[x, 0.2, 3.6]} s={[1, 0.3, 2]} c="#fef3c7" />)}
      {[-4.5, 1.5].map((x) => <mesh key={x} geometry={geo('cone', 1.4, 0.6, 10)} material={mat('#ef4444')} position={[x + 1.5, 2.4, 3.6]} />)}
      {/* thatched bungalows */}
      {[[-12, -6.5], [12, -6.5], [-12, 6], [12, 6]].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <B p={[0, 0, 0]} s={[5, 2.6, 4]} c="#fef3c7" />
          <mesh geometry={geo('cone', 3.8, 2.6, 8)} material={mat('#a16207')} position={[0, 3.9, 0]} />
          <B p={[0, 0, 2.02]} s={[1.2, 2, 0.05]} c="#78350f" />
        </group>
      ))}
      {/* beach bar */}
      <group position={[0, 0, -8.5]}>
        <B p={[0, 0, 0]} s={[5, 1.1, 1.4]} c="#92400e" />
        <mesh geometry={geo('cone', 3.6, 1.6, 8)} material={mat('#ca8a04')} position={[0, 3.3, 0]} />
        {[-2.2, 2.2].map((x) => <B key={x} p={[x, 0, 0]} s={[0.15, 2.6, 0.15]} c="#78350f" />)}
        <Person slot={[0, 0, -1, 0]} appearance={NPC_LOOKS[12]} mode="idle" />
      </group>
      {/* palms */}
      {[[-7, 8], [7, 8], [-15, 0], [15, 0], [-6, -9], [6, -9]].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh geometry={geo('cyl', 0.15, 0.25, 5, 6)} material={mat('#92400e')} position={[0, 2.5, 0]} rotation={[0, 0, 0.12]} />
          {Array.from({ length: 6 }, (_, k) => <mesh key={k} geometry={unit} material={mat('#16a34a')} position={[0.3, 5, 0]} scale={[2.6, 0.08, 0.6]} rotation={[0, (k / 6) * Math.PI * 2, -0.35]} />)}
        </group>
      ))}
      <Person slot={[-4.5, 0.5, 3.6, Math.PI]} appearance={NPC_LOOKS[7]} mode="sleep" />
      <Person slot={[4.5, 0.5, 3.6, Math.PI]} appearance={NPC_LOOKS[15]} mode="sleep" />
      <Worker a={[-8, 1]} b={[8, 1]} look={worker(10, 'shati')} speed={0.6} />
    </group>
  );
}

// ------------------------------------------------------------- entry
export function PlotSite({ b, me, people, owner }) {
  const title = useMemo(() => labelTexture(`${b?.emoji || ''} ${b ? loc(b) : ''}${owner ? ` · @${owner}` : ''}`, { size: 54, bold: 900, bg: 'rgba(17,24,39,.85)', fg: '#ffd23f' }), [b, owner]);
  useEffect(() => () => { walk.blocks = []; }, []);
  const slots = [[0, 0, SZ - 3, Math.PI], [1.4, 0, SZ - 3.6, Math.PI], [-1.4, 0, SZ - 3.8, Math.PI], [2.6, 0, SZ - 3.2, Math.PI]];
  const kind = b?.kind;
  return (
    <group>
      {kind === 'farm' ? <Farm /> : kind === 'solar' ? <Solar /> : kind === 'resort' ? <Resort /> : <Factory variant={b?.variant} />}
      {/* gate posts at the front; the name board stands at the back where the camera sees it */}
      {[-2.6, 2.6].map((x) => <B key={x} p={[x, 0, SZ + 0.3]} s={[0.4, 1.6, 0.4]} c="#334155" />)}
      <group position={[0, 0, -SZ - 1]}>
        <mesh position={[0, 9.5, 0]}><planeGeometry args={[Math.min(12, 1.1 * title.aspect), Math.min(12, 1.1 * title.aspect) / title.aspect]} /><meshBasicMaterial map={title.texture} transparent side={THREE.DoubleSide} /></mesh>
      </group>
      <SiteWalker />
      {[{ id: me.id, username: me.username, appearance: me.appearance }, ...people].map((r, i) => (
        <Person key={r.id} slot={slots[i % slots.length]} appearance={r.appearance} mode="idle" id={r.id} username={r.username} />
      ))}
      <hemisphereLight args={['#ffffff', '#a3a3a3', 0.6]} />
    </group>
  );
}
void Car; void L;
