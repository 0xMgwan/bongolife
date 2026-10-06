// Low-poly furniture for the player's home. Models are centred on the origin and
// span their footprint (1 unit per grid cell) before rotation.
import { useMemo } from 'react';
import * as THREE from 'three';
import { mat, geo, fabricTexture } from './textures.js';

const unitBox = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
const ghostOk = new THREE.MeshBasicMaterial({ color: '#22c55e', transparent: true, opacity: 0.45, depthWrite: false });
const ghostBad = new THREE.MeshBasicMaterial({ color: '#ef4444', transparent: true, opacity: 0.45, depthWrite: false });
const glow = (c) => new THREE.MeshBasicMaterial({ color: c });

/** Box sitting on y. ghost overrides every material with a translucent tint. */
function B({ p = [0, 0, 0], s, c, m, ghost }) {
  return <mesh geometry={unitBox} material={ghost || m || mat(c)} position={p} scale={s} />;
}
function Cyl({ p, r, h, c, m, ghost, seg = 14 }) {
  return <mesh geometry={geo('cyl', r, r, h, seg)} material={ghost || m || mat(c)} position={p} />;
}

function Bed({ def, g }) {
  const [w, d] = def.size;
  const W = w * 0.92, D = d * 0.95;
  const low = def.id === 'mkeka';
  return (
    <group>
      {low ? <B s={[W + 0.1, 0.04, D + 0.1]} c="#d6b36a" ghost={g} /> : <B s={[W, 0.35, D]} c="#78350f" ghost={g} />}
      <B p={[0, low ? 0.04 : 0.35, 0]} s={[W * 0.94, 0.18, D * 0.94]} c="#f8fafc" ghost={g} />
      <B p={[0, low ? 0.22 : 0.53, D * 0.12]} s={[W * 0.95, 0.06, D * 0.65]} c={def.color} ghost={g} />
      <B p={[0, low ? 0.22 : 0.53, -D * 0.36]} s={[W * 0.6, 0.12, D * 0.16]} c="#ffffff" ghost={g} />
      {!low && <B p={[0, 0, -D / 2 + 0.05]} s={[W, 1.1, 0.12]} c={def.id === 'bed-king' ? '#facc15' : '#78350f'} ghost={g} />}
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
  return (
    <group>
      <B s={[W, 0.42, 0.8]} c={def.color} ghost={g} />
      <B p={[0, 0.42, -0.3]} s={[W, 0.55, 0.2]} c={def.color} ghost={g} />
      <B p={[-W / 2 + 0.08, 0.42, 0]} s={[0.16, 0.25, 0.8]} c={def.color} ghost={g} />
      <B p={[W / 2 - 0.08, 0.42, 0]} s={[0.16, 0.25, 0.8]} c={def.color} ghost={g} />
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
      return (
        <group>
          <mesh geometry={geo('cyl', 0.2, 0.15, 0.35, 10)} material={g || mat('#b45309')} position={[0, 0.17, 0]} />
          {[[0, 0.75, 0, 0.32], [0.15, 0.55, 0.1, 0.22], [-0.15, 0.6, -0.05, 0.24]].map(([x, y, z, r], i) => (
            <mesh key={i} geometry={geo('sphere', r, 7, 5)} material={g || mat(def.color)} position={[x, y, z]} />
          ))}
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

/** Furniture model for a catalog entry. `ghost` = 'ok' | 'bad' renders a placement preview. */
export function FurnitureModel({ def, ghost }) {
  const g = ghost === 'ok' ? ghostOk : ghost === 'bad' ? ghostBad : null;
  const C = { sleep: Bed, sit: Seat, kitchen: Kitchen, bath: Bath, tech: Tech, decor: Decor }[def.cat] || Decor;
  return <C def={def} g={g} />;
}
