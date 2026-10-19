// Inside a building on a plot (apartment block, hostel, hotel, retirement home): a cut-away
// tower with the front wall removed so every floor shows at once — two furnished units per floor,
// a lobby, tenants, and a switch-back staircase you walk up and down. Tap a floor to go there
// (via the stairs); the joystick/WASD walks you around the floor you're on.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { furnitureById, buildingById, interiorOf } from '@shared/world.js';
import { PlotSite } from './PlotSite.jsx';
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
const NEON = new THREE.MeshBasicMaterial({ color: '#22d3ee', toneMapped: false });
const STEP = mat('#a8a29e');
// Private homes on plots get a look per house type.
export const HOUSE_THEMES = {
  banda: { wall: '#fde68a', floor: ['#d6b98c', '#cfae7d'], roof: '#b45309', trim: '#92400e', light: '#fff1c2' },
  kisasa: { wall: '#f1f5f9', floor: ['#d4d4d8', '#cbd5e1'], roof: '#334155', trim: '#0ea5e9', light: '#f8fafc' },
  villa: { wall: '#fef3c7', floor: ['#f5f5f4', '#e7e5e4'], roof: '#9a3412', trim: '#ca8a04', light: '#fff7d6', lux: true },
  kontena: { wall: '#f97316', floor: ['#a8a29e', '#9ca3af'], roof: '#1f2937', trim: '#1d4ed8', light: '#fff7d6', ribs: true },
  kesho: { wall: '#f8fafc', floor: ['#1e293b', '#0f172a'], roof: '#e2e8f0', trim: '#22d3ee', light: '#a5f3fc', neon: true },
};

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
  const items = kind === 'bedroom'
    ? [[seed % 2 ? 'bed-king' : 'bed-double', cx - 0.4, -2.3], ['lamp', x1 + 0.5, -3.3], [pick(['mirror', 'bookshelf', 'aquarium']), x2 - 0.6, -3.3], ['rug', cx - 0.4, -0.2], [pick(['armchair', 'egg-chair', 'beanbag']), x2 - 1, 0.6]]
    : kind === 'study'
      ? [[pick(['laptop', 'keyboard', 'easel']), cx, -3.1], ['bookshelf', x1 + 0.6, -3.3], [pick(['ps5', 'arcade', 'weights', 'treadmill']), x2 - 1, -2.6], ['beanbag', cx - 0.5, 0.3], ['plant', x2 - 0.5, 0.8]]
      : kind === 'hotel'
    ? [['bed-king', cx - 0.6, -2.2], ['tv-65', cx + 1.4, -3.4], ['armchair', cx + 1.6, 0.4], ['lamp', x1 + 0.6, -3.3]]
    : kind === 'hostel'
      ? [['bed-single', x1 + 0.9, -2.5], ['bed-single', x1 + 2.3, -2.5], ['bed-single', x2 - 1.1, -2.5], ['beanbag', cx, 0.6]]
      : kind === 'care'
        ? [['bed-single', x1 + 1, -2.5], ['armchair', cx, 0.3], ['plant', x2 - 0.6, -3.3], ['tv-65', cx + 1, -3.4]]
        : kind === 'living'
          ? [[pick(['sofa-3', 'sofa-velvet', 'sofa-leather']), cx, -0.3], ['tv-65', cx, -3.4], ['rug', cx, -1.4], ['armchair', x1 + 0.7, -1.6], ['speaker', cx + 1.6, -3.3], ['plant', x1 + 0.5, -3.3], ['coffee', cx, -1.5]]
          : [[pick(['sofa-3', 'sofa-velvet', 'sofa-leather']), cx - 1, -1.1], ['tv-65', cx - 1, -3.4], [pick(['bed-double', 'bed-single']), x2 - 1.4, -2.4], ['fridge', x1 + 0.6, -3.3], ['counter', x1 + 1.8, -3.3], ['rug', cx - 1, -0.4], ['plant', x2 - 0.5, 0.8]];
  return (
    <group>
      {items.map(([id, x, z], i) => furnitureById[id] && <group key={i} position={[x, 0.02, z]}><FurnitureModel def={furnitureById[id]} /></group>)}
    </group>
  );
}
function Floor({ k, color, kind, floors, theme }) {
  const y = k * BLK.fh;
  const wallM = useMemo(() => mat(theme?.wall || color), [color, theme]);
  const lightM = useMemo(() => (theme ? new THREE.MeshBasicMaterial({ color: theme.light, toneMapped: false }) : LIGHT), [theme]);
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
      <mesh geometry={unit} material={mat(theme ? theme.floor[k % 2] : k % 2 ? '#e7e0d3' : '#ece6d8')} position={[0, -0.15, 0]} scale={[BLK.w, 0.15, BLK.d]} onClick={tap} />
      <mesh geometry={unit} material={lightM} position={[-1, BLK.fh - 0.12, -1]} scale={[8, 0.04, 0.12]} />
      {theme?.neon && [Z1 + 0.2, 0].map((z) => <mesh key={z} geometry={unit} material={NEON} position={[-0.5, 0.05, z]} scale={[BLK.w - 2, 0.04, 0.06]} />)}
      {theme?.ribs && Array.from({ length: 14 }, (_, i) => <B key={i} p={[X1 + 0.5 + i, 0, Z1 + 0.12]} s={[0.08, BLK.fh, 0.06]} c="#c2410c" />)}
      {theme?.lux && furnitureById.chandelier && <group position={[-3, BLK.fh - 1.3, -1]}><FurnitureModel def={furnitureById.chandelier} /></group>}
      {/* back wall with windows, side walls */}
      <B p={[0, 0, Z1]} s={[BLK.w, BLK.fh, 0.2]} m={wallM} />
      {[-4.5, -1.5, 1.5].map((x) => <B key={x} p={[x, 1, Z1 + 0.11]} s={[1.6, 1.1, 0.02]} m={GLASS} />)}
      <B p={[X1, 0, 0]} s={[0.2, BLK.fh, BLK.d]} m={wallM} />
      <B p={[X2, 0, 0]} s={[0.2, BLK.fh, BLK.d]} m={wallM} />
      {/* stair-well wall + low balcony rail along the open front */}
      <B p={[STAIR_X1 - 0.05, 0, Z1 + 1.5]} s={[0.12, BLK.fh, 3]} m={wallM} />
      <B p={[-0.9, 0, Z2 - 0.05]} s={[BLK.w - 2.4, 0.9, 0.04]} m={GLASS} />
      {lobby && theme ? (
        <group>
          {/* living room: sofa set facing the TV, dining table, open kitchen */}
          <Unit x1={X1 + 0.2} x2={-0.6} seed={k} kind="living" />
          {[['table-dining', 1.6, -0.6], ['counter', 3.6, -3.3], ['cooker', 2.4, -3.3], ['fridge', 4.6, -3.3], ['vase', 0.6, 1.2]].map(([id, x, z]) => furnitureById[id] && <group key={id} position={[x, 0.02, z]}><FurnitureModel def={furnitureById[id]} /></group>)}
          {theme.lux && furnitureById.art && <group position={[-3, 1.2, Z1 + 0.2]}><FurnitureModel def={furnitureById.art} /></group>}
          {furnitureById.cat && <group position={[-1.4, 0.02, 1.2]}><FurnitureModel def={furnitureById[k % 2 ? 'dog' : 'cat']} /></group>}
        </group>
      ) : lobby ? (
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
          <Unit x1={X1 + 0.2} x2={-0.6} seed={k * 3} kind={theme ? 'bedroom' : kind} />
          <Unit x1={-0.4} x2={STAIR_X1 - 0.2} seed={k * 3 + 1} kind={theme ? (k === 1 ? 'bedroom' : 'study') : kind} />
          {!theme && k % 2 === 1 && <Person slot={[-3.6, 0, -0.6, 0.3]} appearance={NPC_LOOKS[(k * 5) % NPC_LOOKS.length]} mode="sit" />}
          {!theme && k % 3 === 2 && <Person slot={[2.2, 0, 0.8, -0.4]} appearance={NPC_LOOKS[(k * 7 + 2) % NPC_LOOKS.length]} mode="idle" />}
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
      <FloorTag k={k} home={!!theme} />
    </group>
  );
}
function FloorTag({ k, home }) {
  const text = home ? (k === 0 ? L('Sebule', 'Living room') : k === 1 ? L('Chumba kikuu', 'Master bedroom') : L(`Ghorofa ${k}`, `Floor ${k}`)) : k === 0 ? L('Mapokezi', 'Lobby') : L(`Ghorofa ${k}`, `Floor ${k}`);
  const t = useMemo(() => labelTexture(text, { size: 40, bold: 800, bg: 'rgba(17,24,39,.8)', fg: '#ffd23f' }), [text]);
  return (
    <sprite position={[X1 - 0.9, 1.4, Z2 - 0.4]} scale={[0.5 * t.aspect, 0.5, 1]}>
      <spriteMaterial map={t.texture} depthWrite={false} />
    </sprite>
  );
}

export function Apartments(props) {
  const { b, owner } = useBlock();
  // Farms, factories, solar farms and resorts are open sites rather than towers.
  if (interiorOf(b?.id) === 'site') return <PlotSite b={b} owner={owner} {...props} />;
  return <Tower {...props} />;
}
function Tower({ me, people }) {
  const { b, floors, color } = useBlock();
  const kind = b?.id === 'hoteli' ? 'hotel' : b?.id === 'hostel' ? 'hostel' : b?.id === 'wazee' ? 'care' : 'flat';
  const theme = b && HOUSE_THEMES[b.id];
  const H = floors * BLK.fh;
  const { owner } = useBlock();
  const title = theme && owner ? L(`KWA @${owner.toUpperCase()}`, `@${owner.toUpperCase()}'S PLACE`) : b ? loc(b).toUpperCase() : 'APARTMENTS';
  const sign = useMemo(() => labelTexture(title, { size: 70, bold: 900, bg: 'rgba(0,0,0,0)', fg: theme?.neon ? '#0e7490' : '#111827' }), [title, theme]);
  // Other players stand around the lobby until their first move arrives.
  const slots = useMemo(() => [[0, 0, Z2 - 1.2, Math.PI], [1, 0, 2.2, Math.PI], [-1.2, 0, 2.6, Math.PI], [2.4, 0, 1.8, Math.PI], [-2.6, 0, 1.4, Math.PI]], []);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.3, 6]}><planeGeometry args={[80, 40]} /><meshLambertMaterial color="#9fbf7a" /></mesh>
      {Array.from({ length: floors }, (_, k) => <Floor key={k} k={k} color={color} kind={kind} floors={floors} theme={theme} />)}
      {/* roof, water tank, name on top */}
      <B p={[0, H - 0.15, 0]} s={[BLK.w + 0.4, 0.3, BLK.d + 0.4]} c={theme?.roof || '#64748b'} />
      {theme && !theme.neon && b.id !== 'kontena' && <mesh geometry={geo('cone', BLK.w * 0.62, 2.6, 4)} material={mat(theme.roof)} position={[0, H + 1.3, 0]} rotation={[0, Math.PI / 4, 0]} scale={[1, 1, BLK.d / BLK.w * 1.1]} />}
      {theme?.neon && (
        <group>
          <mesh position={[0, H, 0]}><sphereGeometry args={[3.2, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshPhongMaterial color="#bae6fd" transparent opacity={0.45} shininess={140} /></mesh>
          <mesh geometry={unit} material={NEON} position={[0, H + 0.02, Z2 + 0.2]} scale={[BLK.w + 0.4, 0.08, 0.08]} />
          <mesh geometry={geo('cyl', 1.4, 1.4, 0.12, 20)} material={mat('#334155')} position={[5, H + 0.1, -2]} />
        </group>
      )}
      {!theme && <mesh geometry={geo('cyl', 0.8, 0.8, 1.4, 14)} material={mat('#1f2937')} position={[-4, H + 0.85, -2]} />}
      {/* the yard: a pool for villas & hotels, a garden with trees for homes */}
      {(b?.pool || b?.id === 'kesho') && (
        <group position={[-2, -0.28, Z2 + 4.6]}>
          <B p={[0, 0, 0]} s={[8.4, 0.3, 4.4]} c="#e7e5e4" />
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.32, 0]}><planeGeometry args={[7.6, 3.6]} /><meshPhongMaterial color="#22d3ee" shininess={120} /></mesh>
          {[-2.6, 0, 2.6].map((x) => <B key={x} p={[x, 0.3, 2.8]} s={[0.8, 0.25, 1.8]} c="#f8fafc" />)}
        </group>
      )}
      {theme && [[-8.5, 3], [8.6, 4], [-9, -2], [9.2, -2.5]].map(([x, z], i) => (
        <group key={i} position={[x, -0.3, z]}>
          <mesh geometry={geo('cyl', 0.18, 0.24, 2.4, 6)} material={mat('#78350f')} position={[0, 1.2, 0]} />
          <mesh geometry={geo('sphere', 1.3, 10, 8)} material={mat(i % 2 ? '#16a34a' : '#15803d')} position={[0, 2.9, 0]} />
        </group>
      ))}
      <mesh position={[0, H + (theme && !theme.neon && b.id !== 'kontena' ? 3.6 : 1.1), Z2 + (theme ? 1.2 : 0)]}><planeGeometry args={[9, 9 / sign.aspect]} /><meshBasicMaterial map={sign.texture} transparent /></mesh>
      <BlockWalker floors={floors} />
      {[{ id: me.id, username: me.username, appearance: me.appearance }, ...people].map((r, i) => (
        <Person key={r.id} slot={slots[i % slots.length]} appearance={r.appearance} mode="idle" id={r.id} username={r.username} />
      ))}
      <pointLight color="#fff7e6" intensity={4} distance={30} position={[0, (sceneMe.y || 0) + 2.5, 2]} />
    </group>
  );
}

