// Kwangu add-ons built from the Shop's "Upgrade home" tab: pool, BBQ garden, balcony, garden
// cinema, outdoor jacuzzi, a second storey (upstairs view) and its terrace. Each has glowing spots:
// tap one and your Sim goes there and does the thing.
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { HOME_FEATURES, furnitureById } from '@shared/world.js';
import { mat, geo, emojiTexture, labelTexture } from './textures.js';
import { FurnitureModel } from './Furniture.jsx';
import { useStore } from '../store.js';
import { L } from '../i18n.js';
import { sfx } from '../audio.js';

export const UP_Y = 2.45; // second-storey floor height
const unit = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
const B = ({ p, s, c, m, r }) => <mesh geometry={unit} material={m || mat(c)} position={p} scale={s} rotation={r} />;
const WATER = new THREE.MeshPhongMaterial({ color: '#22b8e6', shininess: 120, specular: '#e0f7ff', emissive: '#0369a1', emissiveIntensity: 0.25, transparent: true, opacity: 0.9 });
const GLASS = new THREE.MeshPhongMaterial({ color: '#bfe3ff', transparent: true, opacity: 0.35, shininess: 120 });
const DECK = mat('#b07a45');
const LIGHT = new THREE.MeshBasicMaterial({ color: '#fde68a', toneMapped: false });

/** Where your Sim should be posed right now (set when you use a spot). */
export const homePose = { pose: null };

function Lounger({ p, ry = 0 }) {
  return (
    <group position={p} rotation={[0, ry, 0]}>
      <B p={[0, 0, 0]} s={[0.8, 0.3, 1.9]} c="#f8fafc" />
      <B p={[0, 0.3, 0.1]} s={[0.75, 0.1, 1.5]} c="#38bdf8" />
      <B p={[0, 0.45, -0.75]} s={[0.75, 0.1, 0.45]} c="#38bdf8" r={[0.5, 0, 0]} />
    </group>
  );
}
function Pool() {
  const w = useRef();
  useFrame(({ clock }) => { if (w.current) w.current.position.y = -0.08 + Math.sin(clock.elapsedTime * 1.4) * 0.02; });
  return (
    <group>
      <B p={[5.6, -0.02, 8.6]} s={[6.4, 0.06, 4.6]} m={DECK} />
      <B p={[5.4, -0.01, 8.6]} s={[4, 0.08, 3]} c="#e2e8f0" />
      <mesh ref={w} geometry={unit} material={WATER} position={[5.4, -0.08, 8.6]} scale={[3.6, 0.12, 2.6]} />
      {[0.4, 0.8].map((y, i) => <B key={i} p={[3.75, y - 0.2, 8.6]} s={[0.05, 0.05, 0.5]} c="#e5e7eb" />)}
      <Lounger p={[8.4, 0, 8.2]} />
      <mesh geometry={geo('cone', 1.1, 0.5, 8)} material={mat('#f97316')} position={[8.4, 2.1, 9.4]} />
      <mesh geometry={geo('cyl', 0.04, 0.04, 2.1, 5)} material={mat('#e5e7eb')} position={[8.4, 1.05, 9.4]} />
    </group>
  );
}
function Bbq() {
  const smoke = useRef();
  useFrame(({ clock }) => {
    smoke.current?.children.forEach((c, i) => {
      const k = (clock.elapsedTime * 0.5 + i / 3) % 1;
      c.position.set(Math.sin(k * 6 + i) * 0.1, 1.2 + k * 1.4, 0);
      c.scale.setScalar(0.15 + k * 0.35);
      c.material.opacity = 0.4 * (1 - k);
    });
  });
  return (
    <group>
      <B p={[4.8, -0.02, 12.6]} s={[5.4, 0.04, 2.6]} c="#7fb069" />
      <group position={[3.2, 0, 11.7]}>
        <mesh geometry={geo('cyl', 0.45, 0.35, 0.5, 14)} material={mat('#111827')} position={[0, 0.85, 0]} />
        {[[-0.25, -0.2], [0.25, -0.2], [0, 0.3]].map(([x, z], i) => <B key={i} p={[x, 0, z]} s={[0.05, 0.7, 0.05]} c="#374151" />)}
        <mesh geometry={geo('cyl', 0.42, 0.42, 0.02, 14)} material={mat('#ef4444', { emissive: '#f97316', emissiveIntensity: 0.8 })} position={[0, 1.1, 0]} />
        <group ref={smoke}>{[0, 1, 2].map((i) => <mesh key={i}><sphereGeometry args={[1, 8, 6]} /><meshBasicMaterial color="#e5e7eb" transparent opacity={0.3} depthWrite={false} /></mesh>)}</group>
      </group>
      {[5.6, 6.6, 7.4].map((x, i) => (
        <group key={x} position={[x, 0, 13.2]}>
          <mesh geometry={geo('cyl', 0.12, 0.12, 0.5, 6)} material={mat('#3f9b4a')} position={[0, 0.25, 0]} />
          <mesh geometry={geo('sphere', 0.2, 8, 6)} material={mat(['#f472b6', '#facc15', '#f97316'][i])} position={[0, 0.55, 0]} />
        </group>
      ))}
      <B p={[4.6, 0, 13.6]} s={[1.6, 0.45, 0.45]} m={DECK} />
    </group>
  );
}
function Balcony() {
  return (
    <group>
      <B p={[-1.6, UP_Y - 0.15, 5.9]} s={[3.8, 0.15, 1.8]} m={DECK} />
      <B p={[-1.6, UP_Y, 6.78]} s={[3.8, 0.9, 0.04]} m={GLASS} />
      {[-1, 1].map((s) => <B key={s} p={[-1.6 + s * 1.88, UP_Y, 5.9]} s={[0.04, 0.9, 1.8]} m={GLASS} />)}
      <B p={[-1.6, UP_Y + 0.9, 6.78]} s={[3.85, 0.05, 0.06]} c="#e5e7eb" />
      {[-3.3, 0.1].map((x) => <B key={x} p={[x, 0, 6.6]} s={[0.15, UP_Y - 0.15, 0.15]} c="#e7e5e4" />)}
      <B p={[-0.6, UP_Y, 5.9]} s={[0.5, 0.5, 0.5]} c="#7c2d12" />
      <mesh geometry={geo('sphere', 0.25, 8, 6)} material={mat('#3f9b4a')} position={[-3.2, UP_Y + 0.35, 6.4]} />
    </group>
  );
}
function GardenCinema() {
  const scr = useRef();
  useFrame(({ clock }) => { if (scr.current) scr.current.material.color.setHSL((clock.elapsedTime * 0.05) % 1, 0.55, 0.55); });
  return (
    <group position={[-12.5, 0, 0]}>
      <B p={[0, 0, 7.4]} s={[4.4, 3, 0.2]} c="#111827" />
      <mesh ref={scr} position={[0, 1.9, 7.52]}><planeGeometry args={[4, 2.2]} /><meshBasicMaterial color="#60a5fa" toneMapped={false} /></mesh>
      {[-1.2, 0, 1.2].map((x) => <B key={x} p={[x, 0, 10.6]} s={[1, 0.45, 0.9]} c={x ? '#f472b6' : '#a855f7'} />)}
      {Array.from({ length: 8 }, (_, i) => <mesh key={i} geometry={geo('sphere', 0.06, 6, 4)} material={LIGHT} position={[-2.4 + i * 0.68, 3.2 - Math.sin((i / 7) * Math.PI) * 0.4, 8.4]} />)}
    </group>
  );
}
function Jacuzzi() {
  return (
    <group position={[9.6, 0, 11.6]}>
      <mesh geometry={geo('cyl', 1.1, 1.1, 0.6, 24)} material={mat('#f8fafc')} position={[0, 0.3, 0]} />
      <mesh geometry={geo('cyl', 0.95, 0.95, 0.04, 24)} material={mat('#5eead4', { emissive: '#14b8a6', emissiveIntensity: 0.6 })} position={[0, 0.56, 0]} />
    </group>
  );
}
function SpiralStair({ x }) {
  return (
    <group position={[x, 0, 5.8]}>
      <mesh geometry={geo('cyl', 0.06, 0.06, UP_Y + 1, 6)} material={mat('#e5e7eb')} position={[0, (UP_Y + 1) / 2, 0]} />
      {Array.from({ length: 12 }, (_, i) => <B key={i} p={[Math.cos(i * 0.6) * 0.45, (i / 12) * UP_Y, Math.sin(i * 0.6) * 0.45]} s={[0.8, 0.06, 0.32]} r={[0, -i * 0.6, 0]} m={DECK} />)}
    </group>
  );
}

/** The second storey, shown in the upstairs view: master suite, lounge, optional open terrace. */
function Upstairs({ b, wallMat, terrace }) {
  const bed = furnitureById['bed-king'];
  const sofa = furnitureById['sofa-3'];
  const tv = furnitureById['tv-65'];
  const rug = furnitureById.rug;
  const plant = furnitureById.plant;
  const back = (x1, z1, x2, z2, h) => {
    const len = Math.hypot(x2 - x1, z2 - z1);
    return <B p={[(x1 + x2) / 2, UP_Y, (z1 + z2) / 2]} s={[x1 === x2 ? 0.16 : len, h, z1 === z2 ? 0.16 : len]} m={wallMat} />;
  };
  const roomZ = terrace ? 1.6 : b.z2;
  return (
    <group>
      <B p={[(b.x1 + b.x2) / 2, UP_Y - 0.2, (b.z1 + b.z2) / 2]} s={[b.x2 - b.x1 + 0.2, 0.2, b.z2 - b.z1 + 0.2]} c="#d6c7ad" />
      <B p={[(b.x1 + b.x2) / 2, UP_Y + 0.001, (b.z1 + roomZ) / 2]} s={[b.x2 - b.x1, 0.01, roomZ - b.z1]} c="#e9e2d3" />
      {back(b.x1, b.z1, b.x2, b.z1, 2.2)}
      {back(b.x1, b.z1, b.x1, b.z2, 2.2)}
      {back(b.x2, b.z1, b.x2, b.z2, 1.1)}
      {back(1.5, b.z1, 1.5, -2.2, 1.1)}
      {back(1.5, -1, b.x2, -1, 1.1)}
      {terrace ? (
        <>
          <B p={[(b.x1 + b.x2) / 2, UP_Y + 0.002, (roomZ + b.z2) / 2]} s={[b.x2 - b.x1, 0.02, b.z2 - roomZ]} m={DECK} />
          <B p={[(b.x1 + b.x2) / 2, UP_Y, b.z2]} s={[b.x2 - b.x1, 0.9, 0.05]} m={GLASS} />
          {back(b.x1, roomZ, 0.6, roomZ, 1.1)}
          {back(2.4, roomZ, b.x2, roomZ, 1.1)}
          <Lounger p={[-1, UP_Y, 3.6]} ry={Math.PI} />
          <Lounger p={[-2.2, UP_Y, 3.6]} ry={Math.PI} />
          <B p={[3.8, UP_Y, 3.4]} s={[0.6, 1.1, 0.6]} c="#111827" />
          {Array.from({ length: 12 }, (_, i) => <mesh key={i} geometry={geo('sphere', 0.06, 6, 4)} material={LIGHT} position={[b.x1 + 0.5 + i * ((b.x2 - b.x1 - 1) / 11), UP_Y + 2 - Math.sin((i / 11) * Math.PI) * 0.4, roomZ + 0.1]} />)}
        </>
      ) : (
        <B p={[(b.x1 + b.x2) / 2, UP_Y, b.z2]} s={[b.x2 - b.x1, 1.1, 0.16]} m={wallMat} />
      )}
      {bed && <group position={[3.6, UP_Y, -3.2]}><FurnitureModel def={bed} /></group>}
      {sofa && <group position={[-3.5, UP_Y, -2.2]}><FurnitureModel def={sofa} /></group>}
      {tv && <group position={[-3.5, UP_Y, -4.4]} rotation={[0, 0, 0]}><FurnitureModel def={tv} /></group>}
      {rug && <group position={[-3.5, UP_Y, -3.2]}><FurnitureModel def={rug} /></group>}
      {plant && <group position={[b.x1 + 0.6, UP_Y, b.z1 + 0.6]}><FurnitureModel def={plant} /></group>}
      <pointLight color="#fff7ed" intensity={2.5} distance={14} position={[0, UP_Y + 5, -1]} />
    </group>
  );
}

function Spot({ act, feature, onUse }) {
  const [x, y, z] = act.spot;
  const tex = useMemo(() => emojiTexture(act.emoji, { ring: '#f5b800' }), [act.emoji]);
  const lab = useMemo(() => labelTexture(L(act.name[0], act.name[1]), { size: 40, bold: 800, bg: 'rgba(20,20,20,.88)', fg: '#ffd23f' }), [act]);
  const ref = useRef();
  useFrame(({ clock }) => { if (ref.current) ref.current.position.y = Math.max(0, y) + 2.1 + Math.sin(clock.elapsedTime * 2 + x) * 0.1; });
  const go = (e) => {
    if (e.delta > 10) return;
    e.stopPropagation();
    onUse(feature, act);
  };
  return (
    <group position={[x, 0, z]} onClick={go}>
      <group ref={ref}>
        <sprite scale={[0.9, 0.9, 1]}><spriteMaterial map={tex} depthWrite={false} /></sprite>
        <sprite position={[0, -0.75, 0]} scale={[0.32 * lab.aspect, 0.32, 1]}><spriteMaterial map={lab.texture} depthWrite={false} /></sprite>
      </group>
      <mesh position={[0, Math.max(0, y) + 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.35, 0.5, 24]} /><meshBasicMaterial color="#f5b800" transparent opacity={0.8} /></mesh>
    </group>
  );
}

export function HomeAddons({ features = [], b, upstairs, wallMat, onUse }) {
  const has = (id) => features.includes(id);
  return (
    <group>
      {has('pool') && !upstairs && <Pool />}
      {has('bbq') && !upstairs && <Bbq />}
      {has('balcony') && <Balcony />}
      {has('cinema') && !upstairs && <GardenCinema />}
      {has('jacuzzi') && !upstairs && <Jacuzzi />}
      {has('storey') && !upstairs && <SpiralStair x={b.x1 - 0.9} />}
      {has('storey') && upstairs && <Upstairs b={b} wallMat={wallMat} terrace={has('rooftop')} />}
      {HOME_FEATURES.filter((f) => has(f.id)).flatMap((f) => f.acts.filter((a) => !!a.up === !!upstairs || f.id === 'balcony').map((a) => <Spot key={`${f.id}${a.id}`} act={a} feature={f} onUse={onUse} />))}
    </group>
  );
}

/** Use a spot: the API applies the effect, your Sim strikes the pose for a few seconds. */
export async function doAddon(feature, act) {
  const st = useStore.getState();
  const r = await st.run('/home/feature/use', { method: 'POST', body: { feature: feature.id, act: act.id } });
  if (!r) return;
  const [x, y, z, ry] = act.spot;
  homePose.pose = { x, y, z, ry, mode: act.mode, until: Date.now() + 6000 };
  sfx('pop');
  const fx = Object.entries(r.effects).filter(([, n]) => n > 0).map(([k, n]) => `+${n} ${k}`).join(' · ');
  st.toast(`${act.emoji} ${L(act.name[0], act.name[1])}${fx ? ` · ${fx}` : ''}`);
}
