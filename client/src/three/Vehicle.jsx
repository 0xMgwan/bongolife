import { mat, geo } from './textures.js';
import { shadowMat } from './Avatar.jsx';

const TIRE = mat('#111827');
const GLASS = mat('#9ec5e8');
const LIGHT = mat('#fef9c3');
const CHROME = mat('#cbd5e1');

function Wheels({ pts, r = 0.32, w = 0.22 }) {
  return pts.map(([x, z], i) => <mesh key={i} geometry={geo('cyl', r, r, w, 10)} material={TIRE} position={[x, r, z]} rotation={[0, 0, Math.PI / 2]} />);
}

/** Faces +z. Scale ~ real metres. */
export function Vehicle({ kind, color = '#e5e7eb' }) {
  const body = mat(color);
  switch (kind) {
    case 'bike':
      return (
        <group>
          <mesh geometry={geo('circle', 0.6, 12)} material={shadowMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} scale={[0.5, 1.4, 1]} />
          <Wheels pts={[[0, 0.55], [0, -0.55]]} r={0.33} w={0.06} />
          <mesh geometry={geo('box', 0.06, 0.06, 1.1)} material={body} position={[0, 0.55, 0]} />
          <mesh geometry={geo('box', 0.5, 0.05, 0.05)} material={TIRE} position={[0, 0.95, 0.45]} />
        </group>
      );
    case 'moto':
      return (
        <group>
          <mesh geometry={geo('circle', 0.7, 12)} material={shadowMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} scale={[0.6, 1.5, 1]} />
          <Wheels pts={[[0, 0.65], [0, -0.65]]} r={0.33} w={0.12} />
          <mesh geometry={geo('box', 0.3, 0.35, 1.1)} material={body} position={[0, 0.6, 0]} />
          <mesh geometry={geo('box', 0.34, 0.12, 0.7)} material={TIRE} position={[0, 0.83, -0.2]} />
          <mesh geometry={geo('box', 0.7, 0.05, 0.05)} material={CHROME} position={[0, 1.05, 0.55]} />
          <mesh geometry={geo('box', 0.16, 0.12, 0.05)} material={LIGHT} position={[0, 0.85, 0.66]} />
        </group>
      );
    case 'bajaji':
      return (
        <group>
          <mesh geometry={geo('circle', 1, 12)} material={shadowMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} scale={[0.9, 1.3, 1]} />
          <Wheels pts={[[0, 1.0], [-0.6, -0.5], [0.6, -0.5]]} r={0.28} w={0.14} />
          <mesh geometry={geo('box', 1.3, 0.55, 2.1)} material={body} position={[0, 0.65, 0]} />
          <mesh geometry={geo('box', 1.36, 0.08, 2.2)} material={mat('#111827')} position={[0, 1.75, -0.05]} />
          <mesh geometry={geo('box', 1.2, 0.5, 0.05)} material={GLASS} position={[0, 1.25, 0.95]} />
          {[[-0.62, 0.9], [0.62, 0.9], [-0.62, -0.95], [0.62, -0.95]].map(([x, z], i) => (
            <mesh key={i} geometry={geo('box', 0.06, 0.8, 0.06)} material={TIRE} position={[x, 1.3, z]} />
          ))}
        </group>
      );
    case 'bus':
      return (
        <group>
          <mesh geometry={geo('circle', 1, 12)} material={shadowMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} scale={[1.3, 3.4, 1]} />
          <Wheels pts={[[-1, 2], [1, 2], [-1, -2], [1, -2]]} r={0.42} w={0.28} />
          <mesh geometry={geo('box', 2.2, 1.6, 6.4)} material={body} position={[0, 1.35, 0]} />
          <mesh geometry={geo('box', 2.24, 0.25, 6.44)} material={mat('#1d4ed8')} position={[0, 0.95, 0]} />
          <mesh geometry={geo('box', 2.24, 0.55, 5.6)} material={GLASS} position={[0, 1.75, -0.2]} />
          <mesh geometry={geo('box', 2.0, 0.6, 0.05)} material={GLASS} position={[0, 1.7, 3.21]} />
        </group>
      );
    case 'van':
    case 'suv':
    case 'car':
    default: {
      const L = kind === 'van' ? 4.4 : kind === 'suv' ? 4.6 : 3.9;
      const W = kind === 'suv' ? 1.95 : 1.75;
      const H = kind === 'van' ? 1.25 : kind === 'suv' ? 0.85 : 0.65;
      const cabinH = kind === 'van' ? 0.0 : kind === 'suv' ? 0.65 : 0.55;
      const lift = kind === 'suv' ? 0.45 : 0.35;
      return (
        <group>
          <mesh geometry={geo('circle', 1, 14)} material={shadowMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} scale={[W * 0.6, L * 0.6, 1]} />
          <Wheels pts={[[-W / 2 + 0.1, L / 2 - 0.75], [W / 2 - 0.1, L / 2 - 0.75], [-W / 2 + 0.1, -L / 2 + 0.75], [W / 2 - 0.1, -L / 2 + 0.75]]} r={kind === 'suv' ? 0.4 : 0.33} />
          <mesh geometry={geo('box', W, H, L)} material={body} position={[0, lift + H / 2, 0]} />
          {kind === 'van' ? (
            <mesh geometry={geo('box', W + 0.02, 0.45, L - 1.2)} material={GLASS} position={[0, lift + H - 0.3, -0.4]} />
          ) : (
            <>
              <mesh geometry={geo('box', W - 0.1, cabinH, L * 0.5)} material={body} position={[0, lift + H + cabinH / 2, -L * 0.05]} />
              <mesh geometry={geo('box', W - 0.08, cabinH * 0.7, L * 0.48)} material={GLASS} position={[0, lift + H + cabinH * 0.45, -L * 0.05]} />
            </>
          )}
          <mesh geometry={geo('box', 0.3, 0.14, 0.04)} material={LIGHT} position={[-W / 2 + 0.3, lift + H * 0.6, L / 2 + 0.01]} />
          <mesh geometry={geo('box', 0.3, 0.14, 0.04)} material={LIGHT} position={[W / 2 - 0.3, lift + H * 0.6, L / 2 + 0.01]} />
          <mesh geometry={geo('box', 0.3, 0.12, 0.04)} material={mat('#dc2626')} position={[-W / 2 + 0.3, lift + H * 0.6, -L / 2 - 0.01]} />
          <mesh geometry={geo('box', 0.3, 0.12, 0.04)} material={mat('#dc2626')} position={[W / 2 - 0.3, lift + H * 0.6, -L / 2 - 0.01]} />
          {kind === 'suv' && <mesh geometry={geo('box', W - 0.3, 0.06, L * 0.4)} material={TIRE} position={[0, lift + H + cabinH + 0.05, -L * 0.05]} />}
        </group>
      );
    }
  }
}

export function Boat({ color = '#f8fafc' }) {
  return (
    <group>
      <mesh geometry={geo('box', 4, 1.2, 10)} material={mat(color)} position={[0, 0.4, 0]} />
      <mesh geometry={geo('box', 3, 1.4, 4)} material={mat('#1d4ed8')} position={[0, 1.7, -1]} />
      <mesh geometry={geo('box', 3.05, 0.4, 4.05)} material={GLASS} position={[0, 1.9, -1]} />
    </group>
  );
}

/** Seat height for riders on open vehicles; null = rider hidden inside. */
export function riderOffset(kind) {
  if (kind === 'bike') return [0, 0.15, -0.1];
  if (kind === 'moto') return [0, 0.3, -0.15];
  return null;
}
