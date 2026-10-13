// Inside a building on a plot (apartment block, hostel, hotel, retirement home): a cut-away
// tower with the front wall removed so every floor shows at once — two furnished units per floor,
// a lobby, tenants, and a switch-back staircase you walk up and down. Tap a floor to go there
// (via the stairs); the joystick/WASD walks you around the floor you're on.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { furnitureById, buildingById } from '@shared/world.js';
import { mat, geo, labelTexture } from './textures.js';
import { FurnitureModel } from './Furniture.jsx';
import { useStore } from '../store.js';
import { input, sendScenePos } from '../net.js';
import { sceneMe } from './SceneWalk.jsx';
import { sceneCam, Person, NPC_LOOKS } from './Scenes.jsx';
import { L, loc } from '../i18n.js';

export const BLK = { w: 14, d: 8, fh: 3, stairX: 6.15 };
const X1 = -BLK.w / 2;
const X2 = BLK.w / 2;
const STAIR_X1 = 5.3;
const Z1 = -BLK.d / 2;
const Z2 = BLK.d / 2;
const unit = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
const B = ({ p, s, c, m }) => <mesh geometry={unit} material={m || mat(c)} position={p} scale={s} />;
const GLASS = new THREE.MeshPhongMaterial({ color: '#bfdbfe', transparent: true, opacity: 0.35, shininess: 120 });
const LIGHT = new THREE.MeshBasicMaterial({ color: '#fff7d6', toneMapped: false });
const STEP = mat('#a8a29e');

/** The staircase between floor k and k+1 runs front→back on even floors, back→front on odd ones. */
const stairEnds = (k) => (k % 2 === 0 ? [Z2 - 0.8, Z1 + 0.8] : [Z1 + 0.8, Z2 - 0.8]);

/** This building's floor count and look, from the plot it stands on. */
export function useBlock() {
  const block = useStore((s) => s.block);
  const plots = useStore((s) => s.world?.plots);
  const st = block && plots?.[block.plotId];
  const b = st?.building && buildingById[st.building];
  const floors = Math.min(10, (b?.floors || 4) + (st?.up?.floors || 0));
  return { plotId: block?.plotId, b, floors, owner: st?.owner, color: st?.up?.color || b?.color || '#e2e8f0' };
}

// ---- walking: my position lives in sceneMe (x, z, y); a path of [x, z, y] waypoints climbs stairs.
const walk = { path: null, floors: 4 };
function pathTo(x, z, floor) {
  const cur = Math.round((sceneMe.y || 0) / BLK.fh);
  const pts = [];
  let k = cur;
  while (k !== floor) {
    const up = floor > k;
    const step = up ? k : k - 1; // the flight between `step` and `step + 1`
    const [zs, ze] = stairEnds(step);
    const [from, to] = up ? [zs, ze] : [ze, zs];
    pts.push([BLK.stairX, from, k * BLK.fh]);
    k += up ? 1 : -1;
    pts.push([BLK.stairX, to, k * BLK.fh]);
  }
  pts.push([x, z, floor * BLK.fh]);
  walk.path = pts;
  sceneMe.active = true;
}
if (import.meta.env.DEV) window.__blk = { go: (...a) => pathTo(...a), get me() { return sceneMe; } };
function BlockWalker({ floors }) {
  const sent = useRef(0);
  useEffect(() => {
    Object.assign(sceneMe, { active: true, x: 0, z: Z2 - 1.2, y: 0, ry: Math.PI, moving: false });
    walk.path = null;
    return () => { sceneMe.y = 0; walk.path = null; };
  }, []);
  useFrame((_, dt) => {
    dt = Math.min(dt, 0.1);
    walk.floors = floors;
    const k = input.keys;
    let jx = input.jx;
    let jz = input.jz;
    if (k.has('w') || k.has('arrowup')) jz -= 1;
    if (k.has('s') || k.has('arrowdown')) jz += 1;
    if (k.has('a') || k.has('arrowleft')) jx -= 1;
    if (k.has('d') || k.has('arrowright')) jx += 1;
    let moving = false;
    if (Math.hypot(jx, jz) > 0.08 && !walk.path) {
      const len = Math.hypot(jx, jz);
      const step = 3 * dt * Math.min(1, len);
      sceneMe.x = Math.max(X1 + 0.5, Math.min(STAIR_X1 - 0.3, sceneMe.x + (jx / len) * step));
      sceneMe.z = Math.max(Z1 + 0.5, Math.min(Z2 - 0.4, sceneMe.z + (jz / len) * step));
      sceneMe.ry = Math.atan2(jx, jz);
      moving = true;
    } else if (walk.path?.length) {
      const [tx, tz, ty] = walk.path[0];
      const dx = tx - sceneMe.x;
      const dz = tz - sceneMe.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.08) {
        sceneMe.y = ty;
        walk.path.shift();
        if (!walk.path.length) walk.path = null;
      } else {
        const s = Math.min(d, 4.4 * dt);
        // On a flight of stairs the height follows the distance travelled.
        sceneMe.y += (ty - sceneMe.y) * Math.min(1, s / d);
        sceneMe.x += (dx / d) * s;
        sceneMe.z += (dz / d) * s;
        sceneMe.ry = Math.atan2(dx, dz);
        moving = true;
      }
    }
    sceneMe.moving = moving;
    // Camera follows the floor you're on, so the floors above and below stay in view.
    const y = sceneMe.y || 0;
    sceneCam.pos = [sceneMe.x * 0.35, y + 4.2, Z2 + 13];
    sceneCam.look = [sceneMe.x * 0.35, y + 1.2, 0];
    const t = performance.now();
    if (t - sent.current > 140) {
      sent.current = t;
      sendScenePos({ x: +sceneMe.x.toFixed(2), z: +sceneMe.z.toFixed(2), ry: +sceneMe.ry.toFixed(2), m: moving, y: +y.toFixed(2) });
    }
  });
  return null;
}

// ---- the building
function Unit({ x1, x2, seed, kind }) {
  const pick = (ids) => ids[seed % ids.length];
  const cx = (x1 + x2) / 2;
  const items = kind === 'hotel'
    ? [['bed-king', cx - 0.6, -2.2], ['tv-65', cx + 1.4, -3.4], ['armchair', cx + 1.6, 0.4], ['lamp', x1 + 0.6, -3.3]]
    : kind === 'hostel'
      ? [['bed-single', x1 + 0.9, -2.5], ['bed-single', x1 + 2.3, -2.5], ['bed-single', x2 - 1.1, -2.5], ['beanbag', cx, 0.6]]
      : kind === 'care'
        ? [['bed-single', x1 + 1, -2.5], ['armchair', cx, 0.3], ['plant', x2 - 0.6, -3.3], ['tv-65', cx + 1, -3.4]]
        : [[pick(['sofa-3', 'sofa-velvet', 'sofa-leather']), cx - 1, -1.1], ['tv-65', cx - 1, -3.4], [pick(['bed-double', 'bed-single']), x2 - 1.4, -2.4], ['fridge', x1 + 0.6, -3.3], ['counter', x1 + 1.8, -3.3], ['rug', cx - 1, -0.4], ['plant', x2 - 0.5, 0.8]];
  return (
    <group>
      {items.map(([id, x, z], i) => furnitureById[id] && <group key={i} position={[x, 0.02, z]}><FurnitureModel def={furnitureById[id]} /></group>)}
    </group>
  );
}
function Floor({ k, color, kind, floors }) {
  const y = k * BLK.fh;
  const wallM = useMemo(() => mat(color), [color]);
  const tap = (e) => {
    if (e.delta > 10) return;
    e.stopPropagation();
    const p = e.object.parent.worldToLocal(e.point.clone());
    pathTo(Math.max(X1 + 0.5, Math.min(STAIR_X1 - 0.3, p.x)), Math.max(Z1 + 0.5, Math.min(Z2 - 0.4, p.z)), k);
  };
  const lobby = k === 0;
  return (
    <group position={[0, y, 0]}>
      {/* floor slab (tap to walk here) + ceiling light strip */}
      <mesh geometry={unit} material={mat(k % 2 ? '#e7e0d3' : '#ece6d8')} position={[0, -0.15, 0]} scale={[BLK.w, 0.15, BLK.d]} onClick={tap} />
      <mesh geometry={unit} material={LIGHT} position={[-1, BLK.fh - 0.12, -1]} scale={[8, 0.04, 0.12]} />
      {/* back wall with windows, side walls */}
      <B p={[0, 0, Z1]} s={[BLK.w, BLK.fh, 0.2]} m={wallM} />
      {[-4.5, -1.5, 1.5].map((x) => <B key={x} p={[x, 1, Z1 + 0.11]} s={[1.6, 1.1, 0.02]} m={GLASS} />)}
      <B p={[X1, 0, 0]} s={[0.2, BLK.fh, BLK.d]} m={wallM} />
      <B p={[X2, 0, 0]} s={[0.2, BLK.fh, BLK.d]} m={wallM} />
      {/* stair-well wall + low balcony rail along the open front */}
      <B p={[STAIR_X1 - 0.05, 0, Z1 + 1.5]} s={[0.12, BLK.fh, 3]} m={wallM} />
      <B p={[-0.9, 0, Z2 - 0.05]} s={[BLK.w - 2.4, 0.9, 0.04]} m={GLASS} />
      {lobby ? (
        <group>
          {/* lobby: reception desk, mailboxes, a guard and a sofa */}
          <B p={[-3.5, 0, -2.2]} s={[3, 1.05, 0.9]} c="#7c2d12" />
          <B p={[1.8, 0.6, Z1 + 0.15]} s={[2.2, 1.2, 0.12]} c="#94a3b8" />
          {furnitureById['sofa-leather'] && <group position={[1.5, 0.02, 0.6]}><FurnitureModel def={furnitureById['sofa-leather']} /></group>}
          {furnitureById.plant && <group position={[X1 + 0.6, 0.02, Z2 - 1]}><FurnitureModel def={furnitureById.plant} /></group>}
          <Person slot={[-3.5, 0, -3.2, 0]} appearance={{ ...NPC_LOOKS[6], outfit: 'reflekta' }} mode="idle" />
        </group>
      ) : (
        <group>
          {/* two units split by a wall with a doorway */}
          <B p={[-0.5, 0, Z1 + 1.6]} s={[0.12, BLK.fh, 3.2]} m={wallM} />
          <Unit x1={X1 + 0.2} x2={-0.6} seed={k * 3} kind={kind} />
          <Unit x1={-0.4} x2={STAIR_X1 - 0.2} seed={k * 3 + 1} kind={kind} />
          {k % 2 === 1 && <Person slot={[-3.6, 0, -0.6, 0.3]} appearance={NPC_LOOKS[(k * 5) % NPC_LOOKS.length]} mode="sit" />}
          {k % 3 === 2 && <Person slot={[2.2, 0, 0.8, -0.4]} appearance={NPC_LOOKS[(k * 7 + 2) % NPC_LOOKS.length]} mode="idle" />}
        </group>
      )}
      {/* flight of stairs up to the next floor */}
      {k < floors - 1 && (() => {
        const [zs, ze] = stairEnds(k);
        const n = 12;
        return Array.from({ length: n }, (_, i) => {
          const f = (i + 0.5) / n;
          return <B key={i} p={[BLK.stairX, f * BLK.fh - 0.1, zs + (ze - zs) * f]} s={[1.3, 0.14, Math.abs(ze - zs) / n + 0.03]} m={STEP} />;
        });
      })()}
      <FloorTag k={k} />
    </group>
  );
}
function FloorTag({ k }) {
  const t = useMemo(() => labelTexture(k === 0 ? L('Mapokezi', 'Lobby') : L(`Ghorofa ${k}`, `Floor ${k}`), { size: 40, bold: 800, bg: 'rgba(17,24,39,.8)', fg: '#ffd23f' }), [k]);
  return (
    <sprite position={[X1 - 0.9, 1.4, Z2 - 0.4]} scale={[0.5 * t.aspect, 0.5, 1]}>
      <spriteMaterial map={t.texture} depthWrite={false} />
    </sprite>
  );
}

export function Apartments({ me, people }) {
  const { b, floors, color } = useBlock();
  const kind = b?.id === 'hoteli' ? 'hotel' : b?.id === 'hostel' ? 'hostel' : b?.id === 'wazee' ? 'care' : 'flat';
  const H = floors * BLK.fh;
  const sign = useMemo(() => labelTexture(b ? loc(b).toUpperCase() : 'APARTMENTS', { size: 70, bold: 900, bg: 'rgba(0,0,0,0)', fg: '#111827' }), [b]);
  // Other players stand around the lobby until their first move arrives.
  const slots = useMemo(() => [[0, 0, Z2 - 1.2, Math.PI], [1, 0, 2.2, Math.PI], [-1.2, 0, 2.6, Math.PI], [2.4, 0, 1.8, Math.PI], [-2.6, 0, 1.4, Math.PI]], []);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.3, 6]}><planeGeometry args={[80, 40]} /><meshLambertMaterial color="#9fbf7a" /></mesh>
      {Array.from({ length: floors }, (_, k) => <Floor key={k} k={k} color={color} kind={kind} floors={floors} />)}
      {/* roof, water tank, name on top */}
      <B p={[0, H - 0.15, 0]} s={[BLK.w + 0.4, 0.3, BLK.d + 0.4]} c="#64748b" />
      <mesh geometry={geo('cyl', 0.8, 0.8, 1.4, 14)} material={mat('#1f2937')} position={[-4, H + 0.85, -2]} />
      <mesh position={[0, H + 1.1, Z2]}><planeGeometry args={[9, 9 / sign.aspect]} /><meshBasicMaterial map={sign.texture} transparent /></mesh>
      <BlockWalker floors={floors} />
      {[{ id: me.id, username: me.username, appearance: me.appearance }, ...people].map((r, i) => (
        <Person key={r.id} slot={slots[i % slots.length]} appearance={r.appearance} mode="idle" id={r.id} username={r.username} />
      ))}
      <pointLight color="#fff7e6" intensity={4} distance={30} position={[0, (sceneMe.y || 0) + 2.5, 2]} />
    </group>
  );
}

