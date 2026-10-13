// Bongo Motors showroom (the Ubungo car yard, inside): every car on a spinning podium, grouped by
// class. Tap a car to see it up close, pick a colour and buy it.
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { VEHICLES, fmtShort } from '@shared/world.js';
import { mat, geo, labelTexture } from './textures.js';
import { Vehicle } from './Vehicle.jsx';
import { useStore } from '../store.js';
import { Crowd } from './Scenes.jsx';
import { L, loc } from '../i18n.js';

const unit = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
const B = ({ p, s, m, c }) => <mesh geometry={unit} material={m || mat(c)} position={p} scale={s} />;
const FLOOR = new THREE.MeshPhongMaterial({ color: '#1f2937', shininess: 140, specular: new THREE.Color('#94a3b8') });
const PODIUM = new THREE.MeshPhongMaterial({ color: '#e5e7eb', shininess: 120 });
const GLOW = new THREE.MeshBasicMaterial({ color: '#f5b800', toneMapped: false });
const GLASS = new THREE.MeshPhongMaterial({ color: '#0b1626', shininess: 140, transparent: true, opacity: 0.55 });

export const SHOWROOM_CARS = VEHICLES.filter((v) => ['car', 'suv', 'van'].includes(v.kind)).sort((a, b) => a.price - b.price);
/** Podium spots: three rows, cheaper cars at the front, supercars at the back. */
export const showroomSpot = (i) => {
  const perRow = 6;
  const row = Math.floor(i / perRow);
  const col = i % perRow;
  return [(col - (perRow - 1) / 2) * 4.6, -row * 6.2 + 4];
};

function Label({ v, y }) {
  const t = useMemo(() => labelTexture(`${loc(v)} · ${fmtShort(v.price)}`, { size: 44, bold: 800, bg: 'rgba(17,24,39,.85)', fg: v.lux ? '#ffd23f' : '#ffffff' }), [v]);
  return (
    <sprite position={[0, y, 0]} scale={[0.55 * t.aspect, 0.55, 1]}>
      <spriteMaterial map={t.texture} depthWrite={false} />
    </sprite>
  );
}

function Podium({ v, i }) {
  const spin = useRef();
  const sel = useStore((s) => s.showroomCar === v.id);
  useFrame((_, dt) => { if (spin.current) spin.current.rotation.y += dt * (sel ? 0.9 : 0.25); });
  const [x, z] = showroomSpot(i);
  const pick = (e) => {
    if (e.delta > 10) return;
    e.stopPropagation();
    useStore.setState({ showroomCar: v.id });
  };
  const big = v.body === 'range' || v.body === 'rolls' || v.body === 'suv-big' || v.kind === 'van';
  return (
    <group position={[x, 0, z]} onClick={pick}>
      <mesh geometry={geo('cyl', 2.1, 2.2, 0.3, 40)} material={PODIUM} position={[0, 0.15, 0]} />
      <mesh geometry={geo('torus', 2.15, 0.05, 6, 40)} material={sel ? GLOW : mat('#64748b')} rotation={[Math.PI / 2, 0, 0]} position={[0, 0.31, 0]} />
      <group ref={spin} position={[0, 0.3, 0]} scale={big ? 0.72 : 0.8}>
        <Vehicle kind={v.kind} body={v.body} lux={v.lux} model={v.id} color={v.color} />
      </group>
      <Label v={v} y={big ? 2.5 : 2.2} />
    </group>
  );
}

export function Showroom({ me, myBusy, people }) {
  const slots = useMemo(() => [[-2, 0, 8, Math.PI], [2, 0, 8.5, Math.PI], [-6, 0, 7, Math.PI], [6, 0, 7, Math.PI], [0, 0, 9, Math.PI]], []);
  const sign = useMemo(() => labelTexture('BONGO MOTORS · SHOWROOM', { size: 70, bold: 900, bg: 'rgba(0,0,0,0)', fg: '#f5b800' }), []);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -3]} material={FLOOR}><planeGeometry args={[34, 26]} /></mesh>
      {/* back wall with sign, glass side walls, light strips */}
      <B p={[0, 0, -16]} s={[34, 7, 0.3]} c="#0f172a" />
      <mesh position={[0, 5.2, -15.8]}><planeGeometry args={[14, 14 / sign.aspect]} /><meshBasicMaterial map={sign.texture} transparent /></mesh>
      {[-17, 17].map((x) => <B key={x} p={[x, 0, -3]} s={[0.2, 6, 26]} m={GLASS} />)}
      {[-12, -6, 0, 6, 12].map((x) => <B key={x} p={[x, 6.6, -3]} s={[0.25, 0.08, 24]} m={mat('#fef9c3', { emissive: '#fde68a', emissiveIntensity: 1 })} />)}
      {/* sales desk */}
      <group position={[11, 0, 8]}>
        <B p={[0, 0, 0]} s={[3.4, 1.1, 1]} c="#f5b800" />
        <B p={[0, 1.1, 0]} s={[3.6, 0.08, 1.2]} c="#111827" />
      </group>
      {SHOWROOM_CARS.map((v, i) => <Podium key={v.id} v={v} i={i} />)}
      <Crowd me={me} myBusy={myBusy} people={people} slots={slots} localSlot={[0, 0, 9.5, Math.PI]} crowd={3} modeFor={() => 'idle'} />
      {[[-8, 9], [8, 9]].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh geometry={geo('cyl', 0.3, 0.25, 0.6, 10)} material={mat('#78350f')} position={[0, 0.3, 0]} />
          <mesh geometry={geo('sphere', 0.7, 10, 8)} material={mat('#3f9b4a')} position={[0, 1.1, 0]} />
        </group>
      ))}
      <pointLight color="#fff7e6" intensity={6} distance={40} position={[0, 8, 0]} />
    </group>
  );
}

void L;
