import { useMemo, useState } from 'react';
import { YARD, yardBlockById } from '@shared/world.js';
import { useStore } from '../store.js';
import { api } from '../api.js';
import { geo, mat, labelTexture } from './textures.js';
import { haptic } from '../haptics.js';
import { sfx } from '../audio.js';

// The yard sits east of the house: cell (0,0) is its north-west corner. One world unit per block.
export const YARD_X0 = 8;
export const YARD_Z0 = -6;
const center = (x, y, z) => [YARD_X0 + x + 0.5, y + 0.5, YARD_Z0 + z + 0.5];

/** One block, drawn by kind (walls are cubes; floors/roofs are slabs; props are little models). */
function Block({ b, onPick }) {
  const def = yardBlockById[b.kind];
  if (!def) return null;
  const [cx, cy, cz] = center(b.x, b.y, b.z);
  const pick = (e) => onPick?.(e, b);
  let body;
  if (def.slab) body = <mesh geometry={geo('box', 1, 0.2, 1)} material={mat(def.color)} position={[0, -0.4, 0]} castShadow receiveShadow />;
  else if (def.glass) body = <mesh geometry={geo('box', 1, 1, 1)} position={[0, 0, 0]}><meshStandardMaterial color={def.color} transparent opacity={0.45} roughness={0.1} /></mesh>;
  else if (def.counter)
    body = (
      <group>
        <mesh geometry={geo('box', 1, 0.7, 0.8)} material={mat(def.color)} position={[0, -0.15, 0]} castShadow />
        <mesh geometry={geo('box', 1.04, 0.08, 0.86)} material={mat('#e7d3b0')} position={[0, 0.24, 0]} />
      </group>
    );
  else if (def.shelf)
    body = (
      <group>
        <mesh geometry={geo('box', 1, 1, 0.3)} material={mat(def.color)} position={[0, 0, -0.32]} castShadow />
        {[-0.2, 0.15].map((y, i) => <mesh key={i} geometry={geo('box', 0.8, 0.18, 0.2)} material={mat(i ? '#ef4444' : '#22c55e')} position={[0, y, -0.18]} />)}
      </group>
    );
  else if (def.sign) body = <mesh geometry={geo('box', 1, 0.6, 0.08)} material={mat(def.color)} position={[0, 0.1, 0]} castShadow />;
  else if (def.plant)
    body = (
      <group>
        <mesh geometry={geo('cyl', 0.22, 0.18, 0.35, 8)} material={mat('#b45309')} position={[0, -0.32, 0]} />
        <mesh geometry={geo('sphere', 0.38, 8, 6)} material={mat(def.color)} position={[0, 0.05, 0]} castShadow />
      </group>
    );
  else if (def.lamp)
    body = (
      <group>
        <mesh geometry={geo('cyl', 0.05, 0.05, 0.8, 6)} material={mat('#334155')} position={[0, -0.1, 0]} />
        <mesh geometry={geo('sphere', 0.18, 10, 8)} position={[0, 0.35, 0]}><meshStandardMaterial color={def.color} emissive={def.color} emissiveIntensity={1.4} /></mesh>
        <pointLight color="#fde68a" intensity={3} distance={5} position={[0, 0.35, 0]} />
      </group>
    );
  else if (b.kind === 'door')
    body = (
      <group>
        <mesh geometry={geo('box', 1, 1, 0.16)} material={mat(def.color)} castShadow />
        <mesh geometry={geo('sphere', 0.05, 6, 4)} material={mat('#f5b800')} position={[0.3, 0, 0.1]} />
      </group>
    );
  else body = <mesh geometry={geo('box', 1, 1, 1)} material={mat(def.color)} castShadow receiveShadow />;
  // A full-cell, invisible hit box so every block is easy to tap (and gives a face normal).
  return (
    <group position={[cx, cy, cz]}>
      {body}
      <mesh geometry={geo('box', 1, 1, 1)} visible={false} onClick={pick} onPointerMove={(e) => onPick?.(e, b, true)} />
    </group>
  );
}

/** The yard: its blocks, the ground grid, and (in build mode) tap-to-place / tap-to-remove. */
export function Yard({ yard, mine, origin }) {
  const build = useStore((s) => s.building);
  const [hover, setHover] = useState(null);
  const blocks = yard?.blocks || [];
  const occupied = useMemo(() => new Set(blocks.map((b) => `${b.x},${b.y},${b.z}`)), [blocks]);
  const sign = useMemo(() => (yard?.name ? labelTexture(`${yard.open ? '🛍️ ' : ''}${yard.name}`, { size: 34, bg: yard.open ? 'rgba(245,184,0,.95)' : 'rgba(15,23,42,.85)', fg: yard.open ? '#111' : '#fff' }) : null), [yard?.name, yard?.open]);
  const building = mine && build;

  const send = async (method, body) => {
    try {
      const r = await api('/yard/blocks', { method, body });
      useStore.setState({ yard: r, ...(r.me ? { me: r.me } : {}) });
      haptic(method === 'POST' ? 'tap' : 'light');
      sfx(method === 'POST' ? 'pop' : 'click');
    } catch (e) {
      useStore.getState().toast(e.message, 'err');
    }
  };
  // Where a tap lands: on the ground → that cell at y=0; on a block → the neighbouring cell
  // on the face you tapped (Minecraft-style), or the block itself when erasing.
  const target = (e, b) => {
    if (b) {
      if (build.erase) return { x: b.x, y: b.y, z: b.z, existing: true };
      const n = e.face?.normal;
      if (!n) return null;
      return { x: b.x + Math.round(n.x), y: b.y + Math.round(n.y), z: b.z + Math.round(n.z) };
    }
    const lx = Math.floor(e.point.x - origin[0] - YARD_X0);
    const lz = Math.floor(e.point.z - origin[2] - YARD_Z0);
    return { x: lx, y: 0, z: lz };
  };
  const inYard = (t) => t && t.x >= 0 && t.x < YARD.w && t.z >= 0 && t.z < YARD.d && t.y >= 0 && t.y < YARD.h;
  const pick = (e, b, hovering) => {
    if (!building) return;
    e.stopPropagation();
    const t = target(e, b);
    if (hovering) return setHover(inYard(t) ? t : null);
    if (e.delta > 10 || !inYard(t)) return;
    if (build.erase) return t.existing && send('DELETE', { x: t.x, y: t.y, z: t.z });
    if (occupied.has(`${t.x},${t.y},${t.z}`)) return;
    send('POST', { x: t.x, y: t.y, z: t.z, kind: build.kind });
  };

  return (
    <group>
      {/* Ground: packed earth with a faint grid, brighter while building. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[YARD_X0 + YARD.w / 2, 0.006, YARD_Z0 + YARD.d / 2]} receiveShadow
        onClick={(e) => pick(e, null)} onPointerMove={(e) => pick(e, null, true)} onPointerOut={() => setHover(null)}>
        <planeGeometry args={[YARD.w, YARD.d]} />
        <meshStandardMaterial color={building ? '#e9d8b4' : '#d9c7a1'} />
      </mesh>
      {building && <gridHelper args={[YARD.w, YARD.w, '#a58a5c', '#c2a878']} position={[YARD_X0 + YARD.w / 2, 0.012, YARD_Z0 + YARD.d / 2]} />}
      {blocks.map((b) => <Block key={`${b.x},${b.y},${b.z}`} b={b} onPick={building ? pick : undefined} />)}
      {building && hover && (
        <mesh geometry={geo('box', 1.02, 1.02, 1.02)} position={center(hover.x, hover.y, hover.z)}>
          <meshBasicMaterial color={build.erase ? '#ef4444' : '#f5b800'} transparent opacity={0.35} depthWrite={false} />
        </mesh>
      )}
      {sign && (
        <sprite position={[YARD_X0 + YARD.w / 2, Math.max(3, ...blocks.map((b) => b.y + 2)), YARD_Z0 + YARD.d / 2]} scale={[sign.aspect * 0.9, 0.9, 1]}>
          <spriteMaterial map={sign.texture} depthWrite={false} />
        </sprite>
      )}
    </group>
  );
}
