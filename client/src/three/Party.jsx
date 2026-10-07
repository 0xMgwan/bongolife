// Party atmosphere for live events: banner with the event name, balloons, falling
// confetti, sweeping disco lights and extra dancers. Works in any scene or at home.
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { randomAppearance } from '@shared/world.js';
import { geo, mat } from './textures.js';
import { Body } from './Players.jsx';

function bannerTexture(title, sub) {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 220;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 1024, 0);
  g.addColorStop(0, '#db2777');
  g.addColorStop(0.5, '#7c3aed');
  g.addColorStop(1, '#f59e0b');
  x.fillStyle = g;
  x.beginPath();
  x.roundRect(6, 6, 1012, 208, 40);
  x.fill();
  x.fillStyle = '#ffffff';
  x.textAlign = 'center';
  x.font = '900 86px system-ui, sans-serif';
  x.fillText(`🎉 ${title}`.slice(0, 30), 512, 112);
  x.font = '700 44px system-ui, sans-serif';
  x.fillText(sub, 512, 178);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#ec4899', '#a855f7', '#facc15', '#14b8a6'];

function Balloons({ p }) {
  const g = useRef();
  useFrame(({ clock }) => {
    if (g.current) g.current.position.y = Math.sin(clock.elapsedTime * 1.3 + p[0]) * 0.12;
  });
  return (
    <group position={p}>
      <group ref={g}>
        {[[0, 2.6, 0], [0.35, 2.9, 0.1], [-0.3, 2.95, -0.1], [0.1, 3.3, 0.2], [-0.15, 2.3, 0.25]].map(([x, y, z], i) => (
          <group key={i}>
            <mesh geometry={geo('sphere', 0.26, 12, 10)} material={mat(COLORS[(i + Math.round(p[0])) & 7])} position={[x, y, z]} scale={[1, 1.2, 1]} />
            <mesh geometry={geo('cyl', 0.004, 0.004, y, 3)} material={mat('#e5e7eb')} position={[x * 0.5, y / 2, z * 0.5]} />
          </group>
        ))}
      </group>
    </group>
  );
}

/** Instanced confetti falling through the area and looping. */
function Confetti({ area = [14, 10], top = 5, count = 140 }) {
  const ref = useRef();
  const data = useMemo(() => Array.from({ length: count }, () => ({
    x: (Math.random() - 0.5) * area[0], z: (Math.random() - 0.5) * area[1], y: Math.random() * top,
    s: 0.6 + Math.random() * 0.8, r: Math.random() * 6, w: 1 + Math.random() * 3,
  })), [count, area, top]);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colors = useMemo(() => {
    const arr = new Float32Array(count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) { c.set(COLORS[i % COLORS.length]); arr.set([c.r, c.g, c.b], i * 3); }
    return arr;
  }, [count]);
  useFrame((_, dt) => {
    const m = ref.current;
    if (!m) return;
    data.forEach((d, i) => {
      d.y -= dt * d.s;
      d.r += dt * d.w;
      if (d.y < 0) d.y = top;
      dummy.position.set(d.x + Math.sin(d.r) * 0.2, d.y, d.z);
      dummy.rotation.set(d.r, d.r * 0.7, 0);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[null, null, count]}>
      <planeGeometry args={[0.09, 0.14]}>
        <instancedBufferAttribute attach="attributes-color" args={[colors, 3]} />
      </planeGeometry>
      <meshBasicMaterial vertexColors side={THREE.DoubleSide} />
    </instancedMesh>
  );
}

function DiscoLights({ r = 4, y = 3.5 }) {
  const lights = useRef([]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    lights.current.forEach((l, i) => {
      if (!l) return;
      const a = t * (0.8 + i * 0.25) + (i * Math.PI * 2) / 3;
      l.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
      l.intensity = 5 + Math.sin(t * 6 + i) * 2;
    });
  });
  return ['#ec4899', '#22d3ee', '#a855f7'].map((c, i) => <pointLight key={c} ref={(el) => (lights.current[i] = el)} color={c} distance={10} intensity={5} />);
}

function Dancer({ slot, appearance }) {
  const motion = useRef({ mode: 'dance' });
  return (
    <group position={[slot[0], 0, slot[1]]} rotation={[0, slot[2], 0]}>
      <Body appearance={appearance} motion={motion} />
    </group>
  );
}

/**
 * `event` — the live event; `home` — sized for the apartment; `banner` — where the banner hangs.
 */
export function PartyDecor({ event, home = false, banner, dancers = 6 }) {
  const sub = home ? `Pati ya @${event.host} · LIVE` : `LIVE · @${event.host} · ${event.going} going`;
  const tex = useMemo(() => bannerTexture(event.title, sub), [event.title, sub]);
  const looks = useMemo(() => Array.from({ length: dancers }, () => randomAppearance()), [dancers]);
  const ring = home
    ? [[-3.5, -3.2, 0.6], [-4.4, -0.4, 1.2], [4.6, 2.4, -1.8], [-0.5, 3.6, 3]]
    : Array.from({ length: dancers }, (_, i) => {
      const a = (i / dancers) * Math.PI * 2 + 0.3;
      return [Math.cos(a) * 6.2, Math.sin(a) * 4.2 + 1.5, -a - Math.PI / 2];
    });
  const bp = banner || (home ? [0, 2.25, -4.85] : [0, 3.8, -4.2]);
  return (
    <group>
      <mesh position={bp}>
        <planeGeometry args={home ? [5.4, 1.16] : [7, 1.5]} />
        <meshBasicMaterial map={tex} transparent toneMapped={false} />
      </mesh>
      {(home ? [[-5.4, 0, -4.4], [5.4, 0, -4.4], [-5.4, 0, 4.4]] : [[-6.5, 0, -3.5], [6.5, 0, -3.5], [-7, 0, 3.5], [7, 0, 3.5]]).map((p) => <Balloons key={p.join()} p={p} />)}
      <Confetti area={home ? [11, 9] : [16, 12]} top={home ? 2.6 : 5} count={home ? 90 : 160} />
      <DiscoLights r={home ? 3 : 5} y={home ? 2.2 : 3.8} />
      {ring.slice(0, home ? 4 : dancers).map((s, i) => <Dancer key={i} slot={s} appearance={looks[i % looks.length]} />)}
    </group>
  );
}
