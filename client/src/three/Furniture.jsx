// Low-poly furniture for the player's home. Models are centred on the origin and
// span their footprint (1 unit per grid cell) before rotation.
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mat, geo, fabricTexture } from './textures.js';

const unitBox = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
const ghostOk = new THREE.MeshBasicMaterial({ color: '#22c55e', transparent: true, opacity: 0.45, depthWrite: false });
const ghostBad = new THREE.MeshBasicMaterial({ color: '#ef4444', transparent: true, opacity: 0.45, depthWrite: false });
const glow = (c) => new THREE.MeshBasicMaterial({ color: c });

// Soft, slightly glossy materials read as real fabric/wood/plastic instead of flat colour.
const softCache = new Map();
export function soft(color, shininess = 14) {
  const k = color + shininess;
  if (!softCache.has(k)) softCache.set(k, new THREE.MeshPhongMaterial({ color, shininess, specular: new THREE.Color('#1f1f1f') }));
  return softCache.get(k);
}
/** Box sitting on y. ghost overrides every material with a translucent tint. */
function B({ p = [0, 0, 0], s, c, m, ghost, r }) {
  return <mesh geometry={unitBox} material={ghost || m || soft(c)} position={p} scale={s} rotation={r} />;
}
function Cyl({ p, r, h, c, m, ghost, seg = 14 }) {
  return <mesh geometry={geo('cyl', r, r, h, seg)} material={ghost || m || soft(c)} position={p} />;
}
/** Rounded bar (capsule) lying along x or z — sofa arms, pillows, rolls. */
function Roll({ p, r, len, c, axis = 'z', ghost }) {
  return <mesh geometry={geo('capsule', r, len, 6, 14)} material={ghost || soft(c)} position={p} rotation={axis === 'z' ? [Math.PI / 2, 0, 0] : [0, 0, Math.PI / 2]} />;
}

function Bed({ def, g }) {
  const [w, d] = def.size;
  const W = w * 0.92, D = d * 0.95;
  const low = def.id === 'mkeka';
  const top = low ? 0.26 : 0.62;
  const wood = def.id === 'bed-king' ? '#a16207' : '#8b5a2b';
  const pillows = w > 1 ? [-W * 0.24, W * 0.24] : [0];
  return (
    <group>
      {low ? <B s={[W + 0.15, 0.04, D + 0.15]} c="#d6b36a" ghost={g} /> : (
        <>
          <B p={[0, 0.08, 0]} s={[W, 0.3, D]} c={wood} ghost={g} />
          {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z], i) => <B key={i} p={[(x * W) / 2.15, 0, (z * D) / 2.15]} s={[0.08, 0.1, 0.08]} c="#3f2a1a" ghost={g} />)}
        </>
      )}
      {/* mattress */}
      <B p={[0, low ? 0.04 : 0.38, 0]} s={[W * 0.96, low ? 0.2 : 0.24, D * 0.96]} c="#f8fafc" ghost={g} />
      {/* duvet with the sheet folded over at the top */}
      <B p={[0, top - 0.02, D * 0.1]} s={[W * 0.99, 0.08, D * 0.72]} c={def.color} ghost={g} />
      <B p={[0, top - 0.01, -D * 0.24]} s={[W * 0.99, 0.085, D * 0.07]} c="#f1f5f9" ghost={g} />
      {pillows.map((x) => <mesh key={x} geometry={geo('capsule', 0.09, W > 1 ? W * 0.3 : W * 0.55, 6, 12)} material={g || soft('#ffffff')} position={[x, top + 0.05, -D * 0.37]} rotation={[0, 0, Math.PI / 2]} scale={[1, 1, 1.9]} />)}
      {!low && (
        <group position={[0, 0, -D / 2 + 0.04]}>
          <B s={[W + 0.08, 1.15, 0.1]} c={wood} ghost={g} />
          <B p={[0, 0.55, 0.06]} s={[W * 0.8, 0.45, 0.04]} c={def.id === 'bed-king' ? '#fde68a' : '#a16207'} ghost={g} />
        </group>
      )}
    </group>
  );
}

function Seat({ def, g }) {
  const [w] = def.size;
  const W = w * 0.9;
  if (def.id === 'chair-plastic') {
    return (
      <group>
        {[[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]].map(([x, z], i) => <B key={i} p={[x, 0, z]} s={[0.06, 0.45, 0.06]} c={def.color} ghost={g} />)}
        <B p={[0, 0.45, 0]} s={[0.6, 0.06, 0.6]} c={def.color} ghost={g} />
        <B p={[0, 0.5, -0.28]} s={[0.6, 0.6, 0.06]} c={def.color} ghost={g} />
      </group>
    );
  }
  // Upholstered sofa / armchair: legs, base, seat & back cushions, rolled arms.
  const n = Math.max(1, Math.round(W / 0.85));
  const cw = (W - 0.34) / n;
  return (
    <group>
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z], i) => <B key={i} p={[(x * W) / 2.3, 0, (z * 0.8) / 2.3]} s={[0.07, 0.12, 0.07]} c="#3f2a1a" ghost={g} />)}
      <B p={[0, 0.12, 0]} s={[W, 0.2, 0.82]} c={def.color} ghost={g} />
      {Array.from({ length: n }, (_, i) => (
        <group key={i} position={[-W / 2 + 0.17 + cw * (i + 0.5), 0, 0]}>
          <B p={[0, 0.32, 0.06]} s={[cw - 0.04, 0.14, 0.62]} c={def.color} ghost={g} />
          <B p={[0, 0.42, -0.28]} s={[cw - 0.05, 0.5, 0.18]} r={[-0.12, 0, 0]} c={def.color} ghost={g} />
        </group>
      ))}
      <B p={[0, 0.3, -0.36]} s={[W, 0.62, 0.1]} c={def.color} ghost={g} />
      {[-1, 1].map((sd) => <Roll key={sd} p={[sd * (W / 2 - 0.09), 0.48, 0.02]} r={0.1} len={0.62} c={def.color} ghost={g} />)}
      {[-1, 1].map((sd) => <B key={`a${sd}`} p={[sd * (W / 2 - 0.09), 0.12, 0.02]} s={[0.18, 0.36, 0.8]} c={def.color} ghost={g} />)}
    </group>
  );
}

function Kitchen({ def, g }) {
  switch (def.id) {
    case 'jiko':
      return (
        <group>
          <Cyl p={[0, 0.2, 0]} r={0.28} h={0.4} c="#374151" ghost={g} />
          <Cyl p={[0, 0.41, 0]} r={0.24} h={0.03} m={glow('#f97316')} ghost={g} />
          <Cyl p={[0, 0.58, 0]} r={0.22} h={0.3} c="#9ca3af" ghost={g} />
        </group>
      );
    case 'cooker':
      return (
        <group>
          <B s={[0.85, 0.85, 0.75]} c="#e5e7eb" ghost={g} />
          {[[-0.2, -0.15], [0.2, -0.15], [-0.2, 0.15], [0.2, 0.15]].map(([x, z], i) => <Cyl key={i} p={[x, 0.86, z]} r={0.11} h={0.02} c="#111827" ghost={g} />)}
          <B p={[0, 0.25, 0.38]} s={[0.6, 0.35, 0.02]} c="#111827" ghost={g} />
        </group>
      );
    case 'fridge':
      return (
        <group>
          <B s={[0.8, 1.8, 0.7]} c="#f8fafc" ghost={g} />
          <B p={[0.3, 0.9, 0.36]} s={[0.04, 0.5, 0.04]} c="#9ca3af" ghost={g} />
          <B p={[0, 1.15, 0.351]} s={[0.78, 0.02, 0.01]} c="#cbd5e1" ghost={g} />
        </group>
      );
    case 'table-dining':
      return (
        <group>
          <Cyl p={[0, 0.75, 0]} r={0.7} h={0.06} c={def.color} ghost={g} seg={20} />
          <Cyl p={[0, 0.38, 0]} r={0.08} h={0.75} c={def.color} ghost={g} />
          {[[0, -0.8, 0], [0, 0.8, Math.PI], [-0.8, 0, Math.PI / 2], [0.8, 0, -Math.PI / 2]].map(([x, z], i) => (
            <group key={i} position={[x, 0, z]}>
              <B p={[0, 0.42, 0]} s={[0.4, 0.05, 0.4]} c="#7c2d12" ghost={g} />
              {[[-0.15, -0.15], [0.15, -0.15], [-0.15, 0.15], [0.15, 0.15]].map(([a, b], k) => <B key={k} p={[a, 0, b]} s={[0.04, 0.42, 0.04]} c="#7c2d12" ghost={g} />)}
            </group>
          ))}
        </group>
      );
    default:
      return <B s={[0.9, 0.9, 0.7]} c={def.color} ghost={g} />;
  }
}

function Bath({ def, g }) {
  switch (def.id) {
    case 'ndoo':
      return (
        <group>
          <B s={[0.95, 0.03, 0.95]} c="#bfdbfe" ghost={g} />
          <mesh geometry={geo('cyl', 0.24, 0.18, 0.4, 14)} material={g || mat(def.color)} position={[0.15, 0.2, 0.1]} />
          <B p={[-0.25, 0, -0.2]} s={[0.25, 0.25, 0.25]} c="#a16207" ghost={g} />
        </group>
      );
    case 'shower':
      return (
        <group>
          <B s={[0.95, 0.06, 0.95]} c="#e0f2fe" ghost={g} />
          <B p={[0, 0.06, 0]} s={[0.95, 2, 0.95]} m={g || new THREE.MeshLambertMaterial({ color: '#bae6fd', transparent: true, opacity: 0.35 })} />
          <Cyl p={[0, 1.95, -0.3]} r={0.08} h={0.04} c="#9ca3af" ghost={g} />
        </group>
      );
    case 'toilet':
      return (
        <group>
          <mesh geometry={geo('cyl', 0.22, 0.17, 0.42, 14)} material={g || mat('#f8fafc')} position={[0, 0.21, 0.08]} />
          <B p={[0, 0.3, -0.3]} s={[0.45, 0.55, 0.2]} c="#f8fafc" ghost={g} />
        </group>
      );
    case 'bathtub':
      return (
        <group>
          <B s={[1.8, 0.55, 0.85]} c="#f8fafc" ghost={g} />
          <B p={[0, 0.5, 0]} s={[1.6, 0.06, 0.65]} m={g || glow('#7dd3fc')} />
        </group>
      );
    default:
      return <B s={[0.9, 0.9, 0.9]} c={def.color} ghost={g} />;
  }
}

function Tech({ def, g }) {
  switch (def.id) {
    case 'radio':
      return (
        <group>
          <B s={[0.7, 0.55, 0.5]} c="#a16207" ghost={g} />
          <B p={[0, 0.55, 0]} s={[0.5, 0.3, 0.25]} c={def.color} ghost={g} />
          <mesh geometry={geo('circle', 0.08, 12)} material={g || mat('#111827')} position={[0.12, 0.7, 0.126]} />
        </group>
      );
    case 'speaker':
      return (
        <group>
          <B s={[0.6, 1.3, 0.55]} c={def.color} ghost={g} />
          <mesh geometry={geo('circle', 0.2, 16)} material={g || glow('#22d3ee')} position={[0, 0.85, 0.28]} />
          <mesh geometry={geo('circle', 0.12, 16)} material={g || glow('#ec4899')} position={[0, 0.35, 0.28]} />
        </group>
      );
    case 'tv':
      return (
        <group>
          <B s={[1.8, 0.45, 0.45]} c="#78350f" ghost={g} />
          <B p={[0, 0.45, -0.05]} s={[1.6, 0.9, 0.06]} c="#0b0f17" ghost={g} />
          <B p={[0, 0.5, -0.015]} s={[1.5, 0.8, 0.01]} m={g || glow('#38bdf8')} />
        </group>
      );
    case 'laptop':
      return (
        <group>
          <B p={[0, 0.72, 0]} s={[1.8, 0.05, 0.8]} c={def.color} ghost={g} />
          {[[-0.8, -0.3], [0.8, -0.3], [-0.8, 0.3], [0.8, 0.3]].map(([x, z], i) => <B key={i} p={[x, 0, z]} s={[0.06, 0.72, 0.06]} c="#78350f" ghost={g} />)}
          <B p={[0.2, 0.77, 0]} s={[0.5, 0.02, 0.35]} c="#9ca3af" ghost={g} />
          <B p={[0.2, 0.78, -0.17]} s={[0.5, 0.32, 0.02]} m={g || glow('#a5b4fc')} />
          <B p={[-0.5, 0, 0.5]} s={[0.45, 0.45, 0.45]} c="#111827" ghost={g} />
        </group>
      );
    default:
      return <B s={[0.8, 0.8, 0.8]} c={def.color} ghost={g} />;
  }
}

function Decor({ def, g }) {
  const rugMat = useMemo(() => new THREE.MeshLambertMaterial({ map: fabricTexture('kitenge', def.color) }), [def.color]);
  switch (def.id) {
    case 'plant':
      // Snake plant in a ceramic pot: tall blade leaves fanning out.
      return (
        <group>
          <mesh geometry={geo('cyl', 0.2, 0.15, 0.42, 14)} material={g || soft('#e7d3b8', 30)} position={[0, 0.21, 0]} />
          <mesh geometry={geo('cyl', 0.18, 0.18, 0.02, 14)} material={g || soft('#3f2a1a')} position={[0, 0.41, 0]} />
          {Array.from({ length: 9 }, (_, i) => {
            const a = (i / 9) * Math.PI * 2;
            const lean = 0.18 + (i % 3) * 0.08;
            return <mesh key={i} geometry={geo('cone', 0.06, 0.75 + (i % 3) * 0.18, 4)} material={g || soft(i % 2 ? '#3f9b5a' : '#5fb37a')} position={[Math.cos(a) * 0.06, 0.78 + (i % 3) * 0.08, Math.sin(a) * 0.06]} rotation={[Math.sin(a) * lean, 0, -Math.cos(a) * lean]} scale={[1, 1, 0.35]} />;
          })}
        </group>
      );
    case 'lamp':
      return (
        <group>
          <Cyl p={[0, 0.03, 0]} r={0.18} h={0.06} c="#374151" ghost={g} />
          <Cyl p={[0, 0.8, 0]} r={0.03} h={1.6} c="#374151" ghost={g} />
          <mesh geometry={geo('cone', 0.28, 0.35, 14)} material={g || glow(def.color)} position={[0, 1.65, 0]} />
          {!g && <pointLight color="#fde68a" intensity={3} distance={4} position={[0, 1.4, 0]} />}
        </group>
      );
    case 'rug':
      return <B s={[def.size[0] * 0.95, 0.02, def.size[1] * 0.95]} m={g || rugMat} />;
    case 'art':
      return (
        <group>
          <B p={[0, 0, -0.2]} s={[0.06, 1.4, 0.06]} c="#78350f" ghost={g} />
          <B p={[0, 0.7, -0.15]} s={[0.8, 0.8, 0.05]} c="#78350f" ghost={g} />
          {[['#0ea5e9', -0.15, 0.95], ['#facc15', 0.12, 0.8], ['#ef4444', -0.05, 1.12], ['#16a34a', 0.18, 1.05]].map(([c, x, y], i) => (
            <mesh key={i} geometry={geo('circle', 0.12 - i * 0.015, 10)} material={g || glow(c)} position={[x, y, -0.12]} />
          ))}
        </group>
      );
    default:
      return <B s={[0.8, 0.8, 0.8]} c={def.color} ghost={g} />;
  }
}


// ------------------------------------------------------------------ extras
/** Gently animated bits (pet tails, fish, RGB light). */
function Spin({ children, fn }) {
  const ref = useRef();
  useFrame(({ clock }) => ref.current && fn(ref.current, clock.elapsedTime));
  return <group ref={ref}>{children}</group>;
}
function Legs4({ w, d, h, c, g }) {
  return [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z], i) => <B key={i} p={[(x * w) / 2, 0, (z * d) / 2]} s={[0.07, h, 0.07]} c={c} ghost={g} />);
}
function Pet({ kind, color, g }) {
  if (kind === 'parrot') {
    return (
      <group>
        <Cyl p={[0, 0.03, 0]} r={0.3} h={0.06} c="#78350f" ghost={g} />
        <Cyl p={[0, 0.6, 0]} r={0.03} h={1.2} c="#9ca3af" ghost={g} />
        {Array.from({ length: 8 }, (_, i) => <B key={i} p={[Math.sin((i / 8) * Math.PI * 2) * 0.3, 0.6, Math.cos((i / 8) * Math.PI * 2) * 0.3]} s={[0.02, 0.9, 0.02]} c="#d4d4d8" ghost={g} />)}
        <Spin fn={(o, t) => (o.rotation.y = Math.sin(t * 0.8) * 0.6)}>
          <mesh geometry={geo('sphere', 0.13, 8, 6)} material={g || mat(color)} position={[0, 0.95, 0]} scale={[1, 1.4, 1]} />
          <mesh geometry={geo('sphere', 0.08, 8, 6)} material={g || mat('#facc15')} position={[0, 1.18, 0.04]} />
          <mesh geometry={geo('cone', 0.03, 0.08, 6)} material={g || mat('#111827')} position={[0, 1.17, 0.13]} rotation={[Math.PI / 2, 0, 0]} />
          <B p={[0, 0.62, -0.08]} s={[0.08, 0.25, 0.04]} c="#dc2626" ghost={g} />
        </Spin>
      </group>
    );
  }
  const cat = kind === 'cat';
  const L = cat ? 0.42 : 0.6;
  return (
    <group>
      <Cyl p={[0, 0.02, 0.05]} r={0.4} h={0.04} c={cat ? '#fda4af' : '#93c5fd'} ghost={g} />
      <mesh geometry={geo('sphere', 0.2, 10, 8)} material={g || mat(color)} position={[0, cat ? 0.24 : 0.36, 0]} scale={[0.9, 0.8, L / 0.36]} />
      {[[-0.1, 0.12], [0.1, 0.12], [-0.1, -0.12], [0.1, -0.12]].map(([x, z], i) => <B key={i} p={[x, 0, z * (L / 0.3)]} s={[0.06, cat ? 0.2 : 0.3, 0.06]} c={color} ghost={g} />)}
      <mesh geometry={geo('sphere', cat ? 0.13 : 0.15, 10, 8)} material={g || mat(color)} position={[0, cat ? 0.38 : 0.55, L * 0.55]} />
      {[-1, 1].map((sd) => <mesh key={sd} geometry={geo('cone', cat ? 0.05 : 0.06, cat ? 0.12 : 0.14, 4)} material={g || mat(cat ? color : '#78350f')} position={[sd * 0.07, cat ? 0.5 : 0.66, L * 0.52]} rotation={[cat ? 0 : 0.6, 0, sd * (cat ? 0.2 : 0.8)]} />)}
      <mesh geometry={geo('sphere', 0.03, 6, 4)} material={g || mat('#111827')} position={[0, cat ? 0.37 : 0.53, L * 0.55 + (cat ? 0.13 : 0.15)]} />
      <Spin fn={(o, t) => (o.rotation.y = Math.sin(t * (cat ? 2 : 9)) * (cat ? 0.35 : 0.6))}>
        <group position={[0, cat ? 0.3 : 0.45, -L * 0.45]}>
          <B p={[0, 0, -0.12]} s={[0.04, 0.04, 0.28]} c={color} ghost={g} />
        </group>
      </Spin>
    </group>
  );
}

const EXTRA = {
  beanbag: ({ def, g }) => <mesh geometry={geo('sphere', 0.45, 12, 8)} material={g || mat(def.color)} position={[0, 0.28, 0]} scale={[1, 0.62, 1]} />,
  'egg-chair': ({ def, g }) => (
    <group>
      <Cyl p={[0, 0.02, 0]} r={0.35} h={0.04} c="#a8a29e" ghost={g} />
      <B p={[0.3, 0, -0.3]} s={[0.05, 2, 0.05]} c="#a8a29e" ghost={g} />
      <B p={[0.15, 1.95, -0.15]} s={[0.35, 0.05, 0.05]} c="#a8a29e" ghost={g} />
      <mesh geometry={geo('sphere', 0.42, 12, 10)} material={g || mat(def.color)} position={[0, 0.85, 0]} scale={[1, 1.3, 1]} />
      <mesh geometry={geo('sphere', 0.33, 12, 10)} material={g || mat('#0f766e')} position={[0, 0.82, 0.14]} scale={[0.9, 1.15, 0.7]} />
    </group>
  ),
  machela: ({ def, g }) => (
    <group>
      {[-0.95, 0.95].map((x) => <B key={x} p={[x, 0, 0]} s={[0.1, 1.2, 0.1]} c="#78350f" ghost={g} />)}
      <mesh geometry={geo('box', 1.7, 0.05, 0.75)} material={g || mat(def.color)} position={[0, 0.55, 0]} />
      <mesh geometry={geo('box', 1.7, 0.05, 0.75)} material={g || mat('#facc15')} position={[0, 0.57, 0]} scale={[1, 1, 0.3]} />
    </group>
  ),
  coffee: ({ def, g }) => (
    <group>
      <B s={[0.8, 0.85, 0.6]} c="#d6d3d1" ghost={g} />
      <B p={[0, 0.85, 0]} s={[0.4, 0.45, 0.35]} c={def.color} ghost={g} />
      <Cyl p={[0, 0.92, 0.12]} r={0.06} h={0.1} c="#f8fafc" ghost={g} />
      <mesh geometry={geo('circle', 0.04, 8)} material={g || glow('#22c55e')} position={[0.12, 1.15, 0.18]} />
    </group>
  ),
  blender: ({ def, g }) => (
    <group>
      <B s={[0.8, 0.85, 0.6]} c="#d6d3d1" ghost={g} />
      <B p={[0, 0.85, 0]} s={[0.22, 0.12, 0.22]} c="#111827" ghost={g} />
      <mesh geometry={geo('cyl', 0.12, 0.09, 0.32, 10)} material={g || mat(def.color)} position={[0, 1.13, 0]} />
    </group>
  ),
  counter: ({ def, g }) => (
    <group>
      <B s={[1.9, 0.88, 0.8]} c="#57534e" ghost={g} />
      <B p={[0, 0.88, 0]} s={[2, 0.06, 0.9]} c={def.color} ghost={g} />
      {[-0.5, 0.5].map((x) => <Cyl key={x} p={[x, 0.35, 0.65]} r={0.16} h={0.7} c="#111827" ghost={g} />)}
      <Cyl p={[0.5, 0.97, 0]} r={0.14} h={0.12} c="#16a34a" ghost={g} />
    </group>
  ),
  sink: ({ g }) => (
    <group>
      <B s={[0.8, 0.82, 0.5]} c="#e7e5e4" ghost={g} />
      <B p={[0, 0.82, 0]} s={[0.6, 0.06, 0.4]} c="#f8fafc" ghost={g} />
      <B p={[0, 1.1, -0.23]} s={[0.6, 0.8, 0.04]} m={g || mat('#c7d2fe')} />
    </group>
  ),
  jacuzzi: ({ def, g }) => (
    <group>
      <Cyl p={[0, 0.3, 0]} r={0.95} h={0.6} c="#f8fafc" ghost={g} seg={20} />
      <Spin fn={(o, t) => (o.position.y = 0.58 + Math.sin(t * 3) * 0.02)}>
        <mesh geometry={geo('cyl', 0.82, 0.82, 0.04, 20)} material={g || glow(def.color)} />
      </Spin>
      {!g && <pointLight color="#38bdf8" intensity={2} distance={3} position={[0, 0.7, 0]} />}
    </group>
  ),
  'tv-65': ({ g }) => (
    <group>
      <B s={[1.9, 0.4, 0.45]} c="#e7e5e4" ghost={g} />
      <B p={[0, 0.45, -0.05]} s={[1.95, 1.15, 0.05]} c="#0b0f17" ghost={g} />
      <B p={[0, 0.5, -0.02]} s={[1.85, 1.05, 0.01]} m={g || glow('#60a5fa')} />
    </group>
  ),
  ps5: ({ g }) => (
    <group>
      <B s={[1.8, 0.45, 0.45]} c="#111827" ghost={g} />
      <B p={[0, 0.45, -0.05]} s={[1.6, 0.9, 0.06]} c="#0b0f17" ghost={g} />
      <B p={[0, 0.5, -0.015]} s={[1.5, 0.8, 0.01]} m={g || glow('#22c55e')} />
      <B p={[0.75, 0.45, 0.05]} s={[0.12, 0.42, 0.28]} c="#f8fafc" ghost={g} />
      <group position={[0, 0, 0.3]}>
        <B p={[0, 0, 0]} s={[0.55, 0.45, 0.5]} c="#dc2626" ghost={g} />
        <B p={[0, 0.45, 0.2]} s={[0.55, 0.75, 0.1]} c="#111827" ghost={g} />
      </group>
    </group>
  ),
  arcade: ({ def, g }) => (
    <group>
      <B s={[0.75, 1.75, 0.65]} c={def.color} ghost={g} />
      <B p={[0, 1.05, 0.33]} s={[0.6, 0.5, 0.02]} m={g || glow('#fde047')} />
      <B p={[0, 0.85, 0.4]} s={[0.7, 0.08, 0.25]} c="#111827" ghost={g} />
      <B p={[0, 1.6, 0.3]} s={[0.7, 0.15, 0.05]} m={g || glow('#f472b6')} />
    </group>
  ),
  snooker: ({ def, g }) => (
    <group>
      <Legs4 w={2.4} d={1.3} h={0.75} c="#78350f" g={g} />
      <B p={[0, 0.72, 0]} s={[2.75, 0.14, 1.65]} c="#78350f" ghost={g} />
      <B p={[0, 0.8, 0]} s={[2.5, 0.08, 1.4]} c={def.color} ghost={g} />
      {[[-0.4, 0], [0.5, 0.2], [0.6, -0.15], [0.7, 0.05]].map(([x, z], i) => <mesh key={i} geometry={geo('sphere', 0.05, 8, 6)} material={g || mat(['#f8fafc', '#dc2626', '#facc15', '#111827'][i])} position={[x, 0.9, z]} />)}
      <B p={[-0.2, 0.92, 0.3]} s={[1.3, 0.03, 0.03]} c="#d6b36a" ghost={g} />
    </group>
  ),
  foosball: ({ def, g }) => (
    <group>
      <Legs4 w={1.5} d={0.6} h={0.75} c="#57534e" g={g} />
      <B p={[0, 0.72, 0]} s={[1.7, 0.25, 0.8]} c={def.color} ghost={g} />
      <B p={[0, 0.8, 0]} s={[1.5, 0.02, 0.7]} c="#16a34a" ghost={g} />
      {[-0.5, -0.17, 0.17, 0.5].map((x, i) => <B key={x} p={[x, 0.95, 0]} s={[0.03, 0.03, 1.1]} c="#d4d4d8" ghost={g} />)}
    </group>
  ),
  'dj-decks': ({ g }) => (
    <group>
      <B s={[1.8, 0.95, 0.7]} c="#1f2937" ghost={g} />
      {[-0.5, 0.5].map((x) => (
        <Spin key={x} fn={(o, t) => (o.rotation.y = t * 3)}>
          <mesh geometry={geo('cyl', 0.24, 0.24, 0.03, 16)} material={g || mat('#111827')} position={[x, 0.98, 0]} />
        </Spin>
      ))}
      <B p={[0, 0.95, 0]} s={[0.35, 0.05, 0.4]} m={g || glow('#22d3ee')} />
      <B p={[0, 0.3, 0.36]} s={[1.6, 0.2, 0.02]} m={g || glow('#ec4899')} />
    </group>
  ),
  karaoke: ({ def, g }) => (
    <group>
      <B s={[0.6, 0.9, 0.5]} c="#111827" ghost={g} />
      <B p={[0, 0.9, 0]} s={[0.5, 0.35, 0.05]} m={g || glow(def.color)} />
      <B p={[0.4, 0, 0.3]} s={[0.04, 1.4, 0.04]} c="#9ca3af" ghost={g} />
      <mesh geometry={geo('sphere', 0.07, 8, 6)} material={g || mat('#111827')} position={[0.4, 1.45, 0.3]} />
    </group>
  ),
  guitar: ({ def, g }) => (
    <group>
      <B p={[0, 0, -0.1]} s={[0.35, 0.1, 0.3]} c="#374151" ghost={g} />
      <group rotation={[-0.25, 0, 0]} position={[0, 0.1, -0.05]}>
        <mesh geometry={geo('sphere', 0.24, 10, 8)} material={g || mat(def.color)} position={[0, 0.3, 0]} scale={[1, 1.15, 0.35]} />
        <mesh geometry={geo('circle', 0.07, 10)} material={g || mat('#111827')} position={[0, 0.35, 0.09]} />
        <B p={[0, 0.55, 0]} s={[0.07, 0.6, 0.05]} c="#3f2a1a" ghost={g} />
        <B p={[0, 1.15, 0]} s={[0.11, 0.15, 0.05]} c="#3f2a1a" ghost={g} />
      </group>
    </group>
  ),
  keyboard: ({ def, g }) => (
    <group>
      {[-0.7, 0.7].map((x) => <B key={x} p={[x, 0, 0]} s={[0.06, 0.75, 0.4]} c="#374151" ghost={g} />)}
      <B p={[0, 0.75, 0]} s={[1.7, 0.1, 0.4]} c={def.color} ghost={g} />
      <B p={[0, 0.85, 0.05]} s={[1.5, 0.02, 0.18]} c="#f8fafc" ghost={g} />
      <B p={[0, 0, 0.55]} s={[0.6, 0.45, 0.3]} c="#111827" ghost={g} />
    </group>
  ),
  bookshelf: ({ def, g }) => (
    <group>
      <B s={[1.8, 1.9, 0.4]} c={def.color} ghost={g} />
      {[0.2, 0.65, 1.1, 1.55].map((y, r) => (
        <group key={y}>
          {Array.from({ length: 9 }, (_, i) => <B key={i} p={[-0.75 + i * 0.18, y, 0.05]} s={[0.12, 0.32 - (i % 3) * 0.04, 0.3]} c={['#dc2626', '#2563eb', '#16a34a', '#f59e0b', '#7c3aed', '#0f766e'][(i + r) % 6]} ghost={g} />)}
        </group>
      ))}
    </group>
  ),
  bao: ({ g }) => (
    <group>
      <Legs4 w={0.6} d={0.6} h={0.45} c="#78350f" g={g} />
      <B p={[0, 0.45, 0]} s={[0.8, 0.12, 0.8]} c="#92400e" ghost={g} />
      {Array.from({ length: 16 }, (_, i) => <mesh key={i} geometry={geo('circle', 0.05, 8)} material={g || mat('#3f2a1a')} position={[-0.3 + (i % 8) * 0.085, 0.58, (i < 8 ? -0.1 : 0.1)]} rotation={[-Math.PI / 2, 0, 0]} />)}
      {[-0.3, 0.3].map((x) => <B key={x} p={[x, 0, x * 2.2]} s={[0.3, 0.38, 0.3]} c="#a16207" ghost={g} />)}
    </group>
  ),
  easel: ({ g }) => (
    <group>
      <group rotation={[-0.15, 0, 0]}>
        {[-0.3, 0.3].map((x) => <B key={x} p={[x, 0, 0]} s={[0.05, 1.6, 0.05]} c="#a16207" ghost={g} />)}
        <B p={[0, 0.7, 0.03]} s={[0.7, 0.75, 0.03]} c="#f8fafc" ghost={g} />
        {[['#ef4444', -0.15, 1.0], ['#22c55e', 0.1, 0.85], ['#3b82f6', 0.05, 1.2]].map(([c, x, y], i) => <mesh key={i} geometry={geo('circle', 0.09, 10)} material={g || mat(c)} position={[x, y, 0.05]} />)}
      </group>
      <B p={[0, 0, -0.45]} s={[0.05, 1.5, 0.05]} c="#a16207" ghost={g} />
    </group>
  ),
  weights: ({ g }) => (
    <group>
      <B s={[0.8, 0.7, 0.4]} c="#1f2937" ghost={g} />
      {[0.25, 0.55].map((y) => [-0.2, 0.2].map((x) => <mesh key={`${x}${y}`} geometry={geo('cyl', 0.1, 0.1, 0.32, 10)} material={g || mat('#111827')} position={[x, y + 0.12, 0.05]} rotation={[0, 0, Math.PI / 2]} />))}
      <Cyl p={[0, 0.05, 0.35]} r={0.25} h={0.06} c="#7c3aed" ghost={g} />
    </group>
  ),
  treadmill: ({ def, g }) => (
    <group>
      <B p={[0, 0, 0]} s={[0.75, 0.2, 1.8]} c={def.color} ghost={g} />
      <B p={[0, 0.2, 0]} s={[0.6, 0.02, 1.6]} c="#111827" ghost={g} />
      {[-0.35, 0.35].map((x) => <B key={x} p={[x, 0.2, 0.75]} s={[0.05, 1.1, 0.05]} c="#9ca3af" ghost={g} />)}
      <B p={[0, 1.25, 0.75]} s={[0.75, 0.25, 0.15]} c="#111827" ghost={g} />
      <B p={[0, 1.33, 0.67]} s={[0.4, 0.12, 0.01]} m={g || glow('#22d3ee')} />
    </group>
  ),
  kandili: ({ def, g }) => (
    <group>
      <Cyl p={[0, 0.08, 0]} r={0.14} h={0.16} c="#78350f" ghost={g} />
      <mesh geometry={geo('sphere', 0.13, 10, 8)} material={g || glow(def.color)} position={[0, 0.3, 0]} scale={[1, 1.3, 1]} />
      <Cyl p={[0, 0.5, 0]} r={0.06} h={0.06} c="#374151" ghost={g} />
      {!g && <pointLight color="#f59e0b" intensity={2} distance={3.5} position={[0, 0.5, 0]} />}
    </group>
  ),
  fairy: ({ def, g }) => (
    <group>
      {[-0.9, 0.9].map((x) => <B key={x} p={[x, 0, 0]} s={[0.04, 1.9, 0.04]} c="#78350f" ghost={g} />)}
      {Array.from({ length: 13 }, (_, i) => {
        const x = -0.9 + i * 0.15;
        const y = 1.85 - Math.sin((i / 12) * Math.PI) * 0.35;
        return <mesh key={i} geometry={geo('sphere', 0.035, 6, 4)} material={g || glow(['#fde047', '#f472b6', '#38bdf8', '#4ade80'][i % 4])} position={[x, y, 0]} />;
      })}
      {!g && <pointLight color={def.color} intensity={1.5} distance={3} position={[0, 1.6, 0.3]} />}
    </group>
  ),
  'rgb-lamp': ({ g }) => {
    const m = useMemo(() => new THREE.MeshBasicMaterial({ color: '#a855f7' }), []);
    const light = useRef();
    return (
      <group>
        <Cyl p={[0, 0.03, 0]} r={0.16} h={0.06} c="#111827" ghost={g} />
        <Spin fn={(_, t) => { m.color.setHSL((t * 0.08) % 1, 0.9, 0.6); if (light.current) light.current.color.copy(m.color); }}>
          <mesh geometry={geo('cyl', 0.08, 0.08, 1.4, 10)} material={g || m} position={[0, 0.76, 0]} />
        </Spin>
        {!g && <pointLight ref={light} intensity={2.5} distance={4} position={[0, 1, 0.2]} />}
      </group>
    );
  },
  neon: ({ def, g }) => {
    const tex = useMemo(() => {
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 96;
      const x = c.getContext('2d');
      x.font = '900 64px system-ui';
      x.textAlign = 'center';
      x.shadowColor = def.color;
      x.shadowBlur = 18;
      x.fillStyle = '#fff0f6';
      x.fillText('BONGO', 128, 70);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    }, [def.color]);
    return (
      <group>
        <B p={[0, 0, -0.35]} s={[1.8, 1.9, 0.06]} c="#1f2937" ghost={g} />
        <mesh position={[0, 1.35, -0.31]}><planeGeometry args={[1.7, 0.64]} />{g ? <primitive object={g} attach="material" /> : <meshBasicMaterial map={tex} transparent toneMapped={false} />}</mesh>
        {!g && <pointLight color={def.color} intensity={3} distance={4} position={[0, 1.3, 0.2]} />}
      </group>
    );
  },
  chandelier: ({ def, g }) => (
    <group>
      <B p={[0, 0, 0]} s={[0.04, 2.6, 0.04]} c="#a16207" ghost={g} />
      <Spin fn={(o, t) => (o.rotation.y = t * 0.2)}>
        {Array.from({ length: 8 }, (_, i) => (
          <mesh key={i} geometry={geo('cone', 0.05, 0.22, 6)} material={g || glow(def.color)} position={[Math.sin((i / 8) * Math.PI * 2) * 0.38, 2.15, Math.cos((i / 8) * Math.PI * 2) * 0.38]} rotation={[Math.PI, 0, 0]} />
        ))}
        <mesh geometry={geo('sphere', 0.18, 10, 8)} material={g || glow('#fef9c3')} position={[0, 2.25, 0]} />
      </Spin>
      {!g && <pointLight color="#fef3c7" intensity={5} distance={7} position={[0, 2, 0]} />}
    </group>
  ),
  aquarium: ({ def, g }) => (
    <group>
      <B s={[1.8, 0.7, 0.6]} c="#1f2937" ghost={g} />
      <B p={[0, 0.7, 0]} s={[1.75, 0.8, 0.55]} m={g || new THREE.MeshLambertMaterial({ color: def.color, transparent: true, opacity: 0.55 })} />
      {[0, 1, 2].map((i) => (
        <Spin key={i} fn={(o, t) => { o.position.x = Math.sin(t * (0.5 + i * 0.2) + i) * 0.6; o.rotation.y = Math.cos(t * (0.5 + i * 0.2) + i) > 0 ? 0 : Math.PI; }}>
          <mesh geometry={geo('sphere', 0.06, 8, 6)} material={g || mat(['#f97316', '#facc15', '#ec4899'][i])} position={[0, 0.9 + i * 0.15, (i - 1) * 0.12]} scale={[1.6, 1, 0.6]} />
        </Spin>
      ))}
      <B p={[0, 0.7, 0]} s={[1.6, 0.08, 0.5]} c="#fde68a" ghost={g} />
      {!g && <pointLight color="#38bdf8" intensity={1.5} distance={3} position={[0, 1, 0.5]} />}
    </group>
  ),
  mirror: ({ g }) => (
    <group>
      <B p={[0, 0, 0]} s={[0.4, 0.06, 0.3]} c="#78350f" ghost={g} />
      <B p={[0, 0.06, -0.05]} s={[0.6, 1.7, 0.06]} c="#a16207" ghost={g} />
      <B p={[0, 0.12, -0.01]} s={[0.5, 1.58, 0.02]} m={g || new THREE.MeshPhongMaterial({ color: '#e0f2fe', shininess: 120, specular: '#ffffff' })} />
    </group>
  ),
  vase: ({ def, g }) => (
    <group>
      <mesh geometry={geo('cyl', 0.12, 0.18, 0.5, 12)} material={g || mat('#0f766e')} position={[0, 0.25, 0]} />
      {[[0, 0.75, 0], [0.12, 0.7, 0.05], [-0.1, 0.68, -0.05], [0.04, 0.8, -0.1]].map(([x, y, z], i) => (
        <group key={i}>
          <B p={[x * 0.5, 0.45, z * 0.5]} s={[0.02, y - 0.45, 0.02]} c="#15803d" ghost={g} />
          <mesh geometry={geo('sphere', 0.08, 8, 6)} material={g || mat(i % 2 ? '#f9a8d4' : def.color)} position={[x, y, z]} />
        </group>
      ))}
    </group>
  ),
  clock: ({ def, g }) => {
    const hand = useRef();
    useFrame(() => { if (hand.current) hand.current.rotation.z = -((Date.now() / 1000) % 60) / 60 * Math.PI * 2; });
    return (
      <group>
        <B p={[0, 0, -0.4]} s={[0.05, 1.5, 0.05]} c="#78350f" ghost={g} />
        <Cyl p={[0, 1.6, -0.38]} r={0.3} h={0.06} c={def.color} ghost={g} />
        <mesh geometry={geo('circle', 0.26, 20)} material={g || mat('#f8fafc')} position={[0, 1.6, -0.34]} />
        <group ref={hand} position={[0, 1.6, -0.33]}><B p={[0, 0, 0]} s={[0.015, 0.22, 0.01]} c="#dc2626" ghost={g} /></group>
        <B p={[0, 1.6, -0.33]} s={[0.025, 0.15, 0.01]} c="#111827" ghost={g} />
      </group>
    );
  },
  shield: ({ def, g }) => (
    <group>
      <B p={[0, 0, -0.35]} s={[0.04, 0.2, 0.04]} c="#78350f" ghost={g} />
      <mesh geometry={geo('sphere', 0.5, 12, 10)} material={g || mat(def.color)} position={[0, 1.25, -0.38]} scale={[0.6, 1.2, 0.08]} />
      <mesh geometry={geo('sphere', 0.5, 12, 10)} material={g || mat('#f8fafc')} position={[0, 1.25, -0.34]} scale={[0.18, 1.0, 0.06]} />
      <mesh geometry={geo('sphere', 0.5, 12, 10)} material={g || mat('#111827')} position={[0, 1.25, -0.32]} scale={[0.07, 0.4, 0.05]} />
      <B p={[0.35, 0, -0.32]} s={[0.04, 2.3, 0.04]} c="#78350f" ghost={g} />
      <mesh geometry={geo('cone', 0.06, 0.3, 6)} material={g || mat('#9ca3af')} position={[0.35, 2.45, -0.32]} />
    </group>
  ),
  'zanzibar-door': ({ def, g }) => (
    <group>
      <B p={[0, 0, -0.3]} s={[1.8, 2.5, 0.2]} c="#3f2a1a" ghost={g} />
      <B p={[-0.42, 0.1, -0.18]} s={[0.78, 2.1, 0.06]} c={def.color} ghost={g} />
      <B p={[0.42, 0.1, -0.18]} s={[0.78, 2.1, 0.06]} c={def.color} ghost={g} />
      {Array.from({ length: 10 }, (_, i) => <mesh key={i} geometry={geo('cone', 0.04, 0.1, 6)} material={g || mat('#d4a017')} position={[(i % 2 ? 0.42 : -0.42) + ((i % 4) < 2 ? -0.2 : 0.2), 0.4 + Math.floor(i / 2) * 0.38, -0.12]} rotation={[Math.PI / 2, 0, 0]} />)}
      <B p={[0, 2.2, -0.17]} s={[1.6, 0.25, 0.06]} c="#a16207" ghost={g} />
    </group>
  ),
  dog: ({ def, g }) => <Pet kind="dog" color={def.color} g={g} />,
  cat: ({ def, g }) => <Pet kind="cat" color={def.color} g={g} />,
  parrot: ({ def, g }) => <Pet kind="parrot" color={def.color} g={g} />,
};

/** Furniture model for a catalog entry. `ghost` = 'ok' | 'bad' renders a placement preview. */
export function FurnitureModel({ def, ghost }) {
  const g = ghost === 'ok' ? ghostOk : ghost === 'bad' ? ghostBad : null;
  const X = EXTRA[def.id];
  if (X) return <X def={def} g={g} />;
  const C = { sleep: Bed, sit: Seat, kitchen: Kitchen, bath: Bath, tech: Tech, decor: Decor, light: Decor }[def.cat] || Decor;
  return <C def={def} g={g} />;
}
