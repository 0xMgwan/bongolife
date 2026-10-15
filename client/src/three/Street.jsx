// Mtaani in 3D: police cars with flashing light bars chasing you, and tall glowing beams for
// mission markers, the getaway safehouse and the chop shop.
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { STREET } from '@shared/world.js';
import { Car } from './Vehicle.jsx';
import { useStore } from '../store.js';
import { chase, streetFrame, markerTarget } from '../street.js';

const MAX_COPS = 5;
function PoliceCars() {
  const refs = useRef([]);
  const red = useRef([]);
  const blue = useRef([]);
  useFrame(() => {
    for (let i = 0; i < MAX_COPS; i++) {
      const g = refs.current[i];
      const c = chase.cops[i];
      if (!g) continue;
      g.visible = !!c;
      if (!c) continue;
      g.position.set(c.x, 0.1, c.z);
      g.rotation.y = c.ry;
      const on = Math.floor(c.siren * 6 + i) % 2 === 0;
      if (red.current[i]) red.current[i].material.emissiveIntensity = on ? 3 : 0.2;
      if (blue.current[i]) blue.current[i].material.emissiveIntensity = on ? 0.2 : 3;
    }
  });
  return Array.from({ length: MAX_COPS }, (_, i) => (
    <group key={i} ref={(el) => (refs.current[i] = el)} visible={false}>
      <Car body="sedan" color="#f8fafc" lite />
      {/* blue door stripe */}
      <mesh position={[0, 0.66, 0]}><boxGeometry args={[1.84, 0.14, 3.6]} /><meshStandardMaterial color="#1d4ed8" /></mesh>
      {/* light bar */}
      <mesh position={[-0.28, 1.53, -0.1]} ref={(el) => (red.current[i] = el)}><boxGeometry args={[0.5, 0.14, 0.26]} /><meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={2} /></mesh>
      <mesh position={[0.28, 1.53, -0.1]} ref={(el) => (blue.current[i] = el)}><boxGeometry args={[0.5, 0.14, 0.26]} /><meshStandardMaterial color="#3b82f6" emissive="#3b82f6" emissiveIntensity={2} /></mesh>
    </group>
  ));
}

function Beam({ pos, color, label }) {
  const ref = useRef();
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const k = 1 + Math.sin(clock.elapsedTime * 4) * 0.12;
    ref.current.scale.set(k, 1, k);
  });
  return (
    <group position={[pos[0], 0, pos[1]]}>
      <group ref={ref}>
        <mesh position={[0, 14, 0]}><cylinderGeometry args={[2.2, 2.2, 28, 20, 1, true]} /><meshBasicMaterial color={color} transparent opacity={0.28} depthWrite={false} side={2} /></mesh>
      </group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.15, 0]}><ringGeometry args={[3.2, 4, 32]} /><meshBasicMaterial color={color} transparent opacity={0.85} /></mesh>
      {label && <mesh position={[0, 29, 0]}><sphereGeometry args={[0.9, 12, 12]} /><meshBasicMaterial color={color} /></mesh>}
    </group>
  );
}

export function StreetLayer() {
  const street = useStore((s) => s.street);
  const stolen = useStore((s) => s.stolenCar);
  useFrame((_, dt) => streetFrame(Math.min(dt, 0.1)));
  const t = markerTarget();
  const m = street?.mission;
  return (
    <>
      <PoliceCars />
      {t && <Beam key={`${t.pos[0]},${t.pos[1]}`} pos={t.pos} color={t.color} label />}
      {/* Race: show the next couple of gates faintly too. */}
      {m?.kind === 'race' && m.points.slice(m.idx + 1, m.idx + 3).map((p) => <Beam key={`n${p[0]},${p[1]}`} pos={p} color="#fca5a5" />)}
      {stolen && !street?.heist && <Beam pos={STREET.chop} color="#a855f7" label />}
    </>
  );
}
