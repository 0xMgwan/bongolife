// "Kwangu" — the player's apartment: walls, rooms, furniture, the player's Sim,
// and the buy-mode placement preview. Rendered far from the city at HOME_ORIGIN.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { HOME, furnitureById, footprint, homeFits, homeBounds, HOME_FLOORS, HOME_LEVELS, HOME_UP_Y, HOME_STAIRS, HOME_UPPER, homeStairY } from '@shared/world.js';
import { mat, geo, labelTexture } from './textures.js';
import { FurnitureModel } from './Furniture.jsx';
import { Body, Overhead } from './Players.jsx';
import { Vehicle } from './Vehicle.jsx';
import { PartyDecor } from './Party.jsx';
import { Shadows } from './Shadows.jsx';
import { livePartyAt } from '../ui/events.js';
import { vehicleById } from '@shared/world.js';
import { local, input, view } from '../net.js';
import { useStore } from '../store.js';
import { homeGuests, sendHomePos } from '../net.js';
import { api } from '../api.js';
import { Yard } from './Yard.jsx';
import { HomeAddons, doAddon, homePose, UP_Y } from './HomeAddons.jsx';

export const HOME_ORIGIN = [-4000, 0, 4000];
const WALL = '#15806b';
const unitBox = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
const WALL_MAT = new THREE.MeshPhongMaterial({ color: WALL, shininess: 8, specular: new THREE.Color('#111111') });
const CAP_MAT = new THREE.MeshPhongMaterial({ color: '#e7e5e4', shininess: 20 });
const SKIRT_MAT = new THREE.MeshPhongMaterial({ color: '#0f5e4f', shininess: 10 });

/** The home's centre and extra camera distance for its size (read by the camera rig). */
export const homeView = { cx: 0, cz: 0, extra: 0 };
/** Which home is on screen: yours, or the host's when visiting. */
export function homeLayout(me, visiting) {
  const level = (visiting ? visiting.host.homeLevel : me?.homeLevel) || 0;
  const style = (visiting ? visiting.host.homeStyle : me?.homeStyle) || {};
  const features = (visiting ? visiting.host.homeFeatures : me?.homeFeatures) || [];
  return { level, style, b: homeBounds(level, features), room: !!HOME_LEVELS[level]?.room, features, storey: features.includes('storey') };
}
const wallMats = new Map();
const wallMat = (c) => wallMats.get(c) || (wallMats.set(c, new THREE.MeshPhongMaterial({ color: c, shininess: 8, specular: new THREE.Color('#111111') })), wallMats.get(c));

/** Player position inside the home (local units), kept outside React. */
export const homeAvatar = { x: 0, z: 2, y: 0, ry: Math.PI, target: null, path: null };

// ---- walking inside: stairs, the upper floor, joystick/WASD
const onStairs = (x, z) => x >= HOME_STAIRS.x1 - 0.1 && x <= HOME_STAIRS.x2 + 0.1 && z >= HOME_STAIRS.z1 - 0.2 && z <= HOME_STAIRS.z2 + 0.2;
const inUpper = (x, z, terrace) => x >= HOME_UPPER.x1 + 0.3 && x <= HOME_UPPER.x2 - 0.3 && z >= HOME_UPPER.z1 + 0.3 && z <= (terrace ? HOME_UPPER.terrace : HOME_UPPER.z2) - 0.15;
const STAIR_BOTTOM = [(HOME_STAIRS.x1 + HOME_STAIRS.x2) / 2, HOME_STAIRS.z2 + 0.45, 0];
const STAIR_TOP = [(HOME_STAIRS.x1 + HOME_STAIRS.x2) / 2, HOME_STAIRS.z1 - 0.4, HOME_UP_Y];
if (import.meta.env.DEV) window.__home = { get avatar() { return homeAvatar; }, walk: (...a) => walkHome(...a) };
/** Walk to a spot on a floor (0 ground, 1 upstairs), taking the stairs when the floor changes. */
export function walkHome(x, z, floor = 0, arrive = null) {
  const h = homeAvatar;
  const up = h.y > HOME_UP_Y / 2;
  const goal = [x, z, floor ? HOME_UP_Y : 0];
  h.path = up === !!floor ? [goal] : up ? [STAIR_TOP, STAIR_BOTTOM, goal] : [STAIR_BOTTOM, STAIR_TOP, goal];
  h.target = null;
  h.arrive = arrive;
}

/** Floor textures: big ceramic tiles with grout, wooden planks, small bathroom tiles. */
function checker(a, b, repeat, kind = 'tile') {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const rnd = (i) => ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1;
  if (kind === 'wood') {
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? a : b;
      ctx.fillRect(0, i * 32, 256, 32);
      ctx.globalAlpha = 0.18;
      for (let k = 0; k < 6; k++) { ctx.fillStyle = '#5b3a1e'; ctx.fillRect(rnd(i * 9 + k) * 256, i * 32 + 4 + k * 4, 40 + rnd(k + i) * 80, 1); }
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(60,35,15,.45)';
      ctx.fillRect(0, i * 32, 256, 1.5);
      ctx.fillRect(((i * 97) % 256), i * 32, 1.5, 32);
    }
  } else {
    const n = kind === 'small' ? 4 : 2;
    const s = 256 / n;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      ctx.fillStyle = (x + y) % 2 ? a : b;
      ctx.fillRect(x * s, y * s, s, s);
      const g = ctx.createLinearGradient(x * s, y * s, x * s + s, y * s + s);
      g.addColorStop(0, 'rgba(255,255,255,.10)');
      g.addColorStop(1, 'rgba(0,0,0,.05)');
      ctx.fillStyle = g;
      ctx.fillRect(x * s, y * s, s, s);
    }
    ctx.fillStyle = 'rgba(120,110,95,.55)';
    for (let i = 0; i <= n; i++) { ctx.fillRect(i * s - 1.5, 0, 3, 256); ctx.fillRect(0, i * s - 1.5, 256, 3); }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function Floor({ x1, x2, z1, z2, a, b, y = 0.005, kind = 'tile' }) {
  const m = useMemo(() => new THREE.MeshPhongMaterial({ map: checker(a, b, kind === 'wood' ? [(x2 - x1) / 4, (z2 - z1) / 4] : [(x2 - x1) / 2, (z2 - z1) / 2], kind), shininess: kind === 'wood' ? 18 : 40, specular: new THREE.Color('#2a2a2a') }), [a, b, x1, x2, z1, z2, kind]);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(x1 + x2) / 2, y, (z1 + z2) / 2]} material={m}>
      <planeGeometry args={[x2 - x1, z2 - z1]} />
    </mesh>
  );
}

// Wall segments [x1, z1, x2, z2] — doors are simply gaps between segments. The outer shell follows
// the home's size; the original bathroom/bedroom keep their walls when the home grows.
function wallsFor({ b, room }) {
  const W = [
    [b.x1, b.z1, b.x2, b.z1], [b.x1, b.z1, b.x1, b.z2], [b.x2, b.z1, b.x2, b.z2], [b.x1, b.z2, 1.8, b.z2], [3.2, b.z2, b.x2, b.z2], // outer, front door gap
    [-2, 1.5, -2, 2.2], [-2, 3.2, -2, 5], [-6, 1.5, -2, 1.5], // bathroom
    [1.5, -5, 1.5, -3.2], [1.5, -2.2, 1.5, -1], [1.5, -1, 6, -1], // bedroom
  ];
  if (b.x1 < -6) W.push([-6, 1.5, -6, 5]); // bathroom's old outer wall
  if (b.z1 < -5) W.push([1.5, -5, 6, -5]); // bedroom's old outer wall
  if (room) W.push([b.x1 + 5, b.z1, b.x1 + 5, b.z1 + 2.2], [b.x1 + 5, b.z1 + 3.2, b.x1 + 5, b.z1 + 4.5], [b.x1, b.z1 + 4.5, b.x1 + 5, b.z1 + 4.5]); // a second bedroom
  return W;
}
// Do segments p1-p2 and q1-q2 cross (2D, x/z)?
function crosses([ax, az], [bx, bz], [cx, cz], [dx, dz]) {
  const o = (px, pz, qx, qz, rx, rz) => Math.sign((qx - px) * (rz - pz) - (qz - pz) * (rx - px));
  return o(ax, az, bx, bz, cx, cz) !== o(ax, az, bx, bz, dx, dz) && o(cx, cz, dx, dz, ax, az) !== o(cx, cz, dx, dz, bx, bz);
}
const FULL_WALL = 2.4;
/** Walls stand full height when you're close in; any wall between the camera and your Sim
 * drops down (Sims-style), and from far away they go back to a doll-house cut-away. */
function Walls({ layout }) {
  const { b } = layout;
  const m = wallMat(layout.style.wall || WALL);
  const segs = wallsFor(layout);
  const refs = useRef([]);
  useFrame(({ camera }, dt) => {
    const cam = [camera.position.x - HOME_ORIGIN[0], camera.position.z - HOME_ORIGIN[2]];
    const me = [homeAvatar.x, homeAvatar.z];
    const far = view.homeDist > 18 || useStore.getState().tab === 'shop';
    segs.forEach(([x1, z1, x2, z2], i) => {
      const g = refs.current[i];
      if (!g) return;
      const back = (z1 === b.z1 && z2 === b.z1) || (x1 === b.x1 && x2 === b.x1);
      let h = far ? (back ? 2.2 : 1.3) : FULL_WALL;
      if (!far && crosses(cam, me, [x1, z1], [x2, z2])) h = 0.25;
      const s = g.userData.h ?? h;
      g.userData.h = s + (h - s) * Math.min(1, dt * 8);
      g.children[0].scale.y = g.userData.h;
      g.children[1].position.y = g.userData.h;
    });
  });
  return segs.map(([x1, z1, x2, z2], i) => {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const sx = x1 === x2 ? 0.16 : len + 0.16;
    const sz = z1 === z2 ? 0.16 : len + 0.16;
    return (
      <group key={i} ref={(el) => (refs.current[i] = el)} position={[(x1 + x2) / 2, 0, (z1 + z2) / 2]}>
        <mesh geometry={unitBox} material={m} scale={[sx, FULL_WALL, sz]} />
        {/* light cap on top of the wall */}
        <mesh geometry={unitBox} material={CAP_MAT} position={[0, FULL_WALL, 0]} scale={[sx + 0.04, 0.07, sz + 0.04]} />
        <mesh geometry={unitBox} material={SKIRT_MAT} position={[0, 0, 0]} scale={[sx + 0.03, 0.12, sz + 0.03]} />
      </group>
    );
  });
}

function Garden({ b }) {
  return (
    <group>
      {/* Wide enough for the yard on the east side (and a grown home on the west). */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[5, -0.04, 0]} material={mat('#c7dca6')}><circleGeometry args={[28, 56]} /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[2.5, -0.03, 6.6]} material={mat('#d6d3d1')}><planeGeometry args={[1.6, 3.2]} /></mesh>
      {[[b.x1 - 3, b.z1 - 1], [9, -8], [b.x1 - 4, 5], [0.5, 15.5]].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh geometry={geo('cyl', 0.15, 0.2, 1.4, 6)} material={mat('#7c5a3a')} position={[0, 0.7, 0]} />
          <mesh geometry={geo('sphere', 1, 7, 5)} material={mat('#3f9b4a')} position={[0, 1.9, 0]} />
        </group>
      ))}
    </group>
  );
}

/** Where (and how) the Sim sits/lies/stands to use an item. */
function poseFor(item, def, act) {
  const [w, d] = def.size;
  const r = (item.rot * Math.PI) / 2;
  const off = (lx, lz) => [item.x + lx * Math.cos(r) + lz * Math.sin(r), item.z - lx * Math.sin(r) + lz * Math.cos(r)];
  if (def.cat === 'sleep') {
    const [x, z] = off(0, d * 0.42);
    return { x, z, y: def.id === 'mkeka' ? 0.25 : 0.55, ry: r, mode: 'sleep' };
  }
  if (def.cat === 'sit' || act === 'choo') return { x: item.x, z: item.z, y: 0, ry: r, mode: 'sit' };
  if (def.id === 'tv') { const [x, z] = off(0, 2); return { x, z, y: 0, ry: r + Math.PI, mode: 'sit' }; }
  if (def.id === 'laptop') { const [x, z] = off(-0.5, 0.55); return { x, z, y: 0, ry: r + Math.PI, mode: 'sit' }; }
  if (def.id === 'radio' || def.id === 'speaker') { const [x, z] = off(0, 1.3); return { x, z, y: 0, ry: r + Math.PI, mode: 'dance' }; }
  if (def.id === 'jacuzzi') return { x: item.x, z: item.z, y: 0.15, ry: r, mode: 'sit' };
  if (def.id === 'machela') return { x: item.x - 0.6, z: item.z, y: 0.6, ry: r - Math.PI / 2, mode: 'sleep' };
  if (def.id === 'egg-chair') return { x: item.x, z: item.z + 0.1, y: 0.45, ry: r, mode: 'sit' };
  if (def.id === 'treadmill') return { x: item.x, z: item.z, y: 0.22, ry: r + Math.PI, mode: 'walk' };
  // Stand/sit in front of the item facing it: [mode, distance in front].
  const POSE = { game: ['type', def.id === 'ps5' ? 0.4 : 0.8], pool: ['lift', def.size[1] > 1 ? 1.3 : 0.8], dj: ['dj', 0.75], imba: ['sing', 0.9], gitaa: ['sing', 0.6],
    kinanda: ['dj', 0.6], soma: ['idle', 0.8], bao: ['sit', 0.75], mazoezi: ['lift', 0.8], chora: ['lift', 0.8], tazama: ['idle', 1], jitazame: ['idle', 0.9],
    cheza: ['cheer', 0.9], kahawa: ['lift', 0.7], juisi: ['lift', 0.7], nawa: ['idle', 0.6] };
  if (POSE[act]) {
    const [mode, dist] = POSE[act];
    const [x, z] = off(0, dist);
    return { x, z, y: 0, ry: r + Math.PI, mode };
  }
  if (def.cat === 'bath') return { x: item.x, z: item.z, y: 0, ry: r, mode: 'idle' };
  const [x, z] = off(0, w > 1 ? 1.2 : 0.75);
  return { x, z, y: 0, ry: r + Math.PI, mode: act === 'snack' ? 'eat' : 'lift' };
}

function Sim({ me, items, layout }) {
  const g = useRef();
  const motion = useRef({ mode: 'idle' });
  const busy = me.busy && me.busy.endsAt > Date.now() && me.busy.kind === 'home' ? me.busy : null;
  const item = busy && items.find((i) => i.id === busy.itemId);
  const pose = item && furnitureById[item.item] ? poseFor(item, furnitureById[item.item], busy.id) : null;
  const lay = useRef(layout);
  lay.current = layout;
  useFrame((_, dt) => {
    dt = Math.min(dt, 0.1);
    const h = homeAvatar;
    const { b, storey } = lay.current;
    const terrace = lay.current.features.includes('rooftop');
    // Old-style target (ground floor) → a path, so stairs are handled.
    if (h.target) { const [tx, tz] = h.target; const cb = h.arrive; walkHome(tx, tz, 0, cb); }
    const k = input.keys;
    let jx = input.jx;
    let jz = input.jz;
    if (k.has('w') || k.has('arrowup')) jz -= 1;
    if (k.has('s') || k.has('arrowdown')) jz += 1;
    if (k.has('a') || k.has('arrowleft')) jx -= 1;
    if (k.has('d') || k.has('arrowright')) jx += 1;
    const manual = Math.hypot(jx, jz) > 0.08 && !useStore.getState().placing;
    // Using a home add-on (pool, balcony, upstairs bed…): hold that pose for a few seconds.
    const hp = homePose.pose;
    if (hp && hp.until > Date.now() && !h.path && !manual) {
      g.current.position.set(hp.x, hp.y, hp.z);
      g.current.rotation.y = hp.ry;
      motion.current.mode = hp.mode;
      sendHomePos(hp.x, hp.z, hp.ry, hp.mode, hp.y);
      return;
    }
    if (hp && (hp.until <= Date.now() || h.path || manual)) { homePose.pose = null; }
    if (pose && !manual) {
      g.current.position.set(pose.x, pose.y, pose.z);
      g.current.rotation.y = pose.ry;
      motion.current.mode = pose.mode;
      h.x = pose.x;
      h.z = pose.z;
      h.y = 0;
      h.path = null;
      sendHomePos(pose.x, pose.z, pose.ry, pose.mode, pose.y);
      return;
    }
    let moving = false;
    if (manual) {
      // Joystick / WASD, relative to the camera. Walls and the floor edge stop you; the stairs
      // carry you between floors.
      h.path = null;
      const c = Math.cos(view.homeYaw);
      const sn = Math.sin(view.homeYaw);
      const dx = jx * c + jz * sn;
      const dz = -jx * sn + jz * c;
      const len = Math.hypot(dx, dz);
      const step = 3 * dt * Math.min(1, len);
      const nx = h.x + (dx / len) * step;
      const nz = h.z + (dz / len) * step;
      const up = h.y > HOME_UP_Y / 2;
      let ok = false;
      let ny = h.y;
      if (storey && onStairs(nx, nz) && Math.abs(homeStairY(nz) - h.y) < 0.8) { ok = true; ny = homeStairY(nz); }
      else if (up) { ok = storey && inUpper(nx, nz, terrace); ny = HOME_UP_Y; }
      else { ok = nx > b.x1 + 0.3 && nx < b.x2 - 0.3 && nz > b.z1 + 0.3 && nz < b.z2 - 0.3; ny = 0; }
      if (ok) { h.x = nx; h.z = nz; h.y = ny; }
      h.ry = Math.atan2(dx, dz);
      moving = true;
    } else if (h.path?.length) {
      const [tx, tz, ty] = h.path[0];
      const dx = tx - h.x;
      const dz = tz - h.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.08) {
        h.y = ty;
        h.path.shift();
        if (!h.path.length) {
          h.path = null;
          const cb = h.arrive;
          h.arrive = null;
          cb?.();
        }
      } else {
        const step = Math.min(d, 3.2 * dt);
        h.x += (dx / d) * step;
        h.z += (dz / d) * step;
        // Height follows the stairs; elsewhere ease toward the waypoint's floor.
        h.y = storey && onStairs(h.x, h.z) && Math.abs(ty - h.y) > 0.01 ? homeStairY(h.z) : h.y + (ty - h.y) * Math.min(1, step / Math.max(d, 0.001));
        h.ry = Math.atan2(dx, dz);
        moving = true;
      }
    }
    motion.current.mode = moving ? 'walk' : 'idle';
    g.current.position.set(h.x, h.y, h.z);
    g.current.rotation.y = h.ry;
    sendHomePos(h.x, h.z, h.ry, motion.current.mode, h.y || undefined);
  });
  return (
    <group ref={g}>
      <Body appearance={me.appearance} motion={motion} />
      <Overhead id={me.id} username={me.username} height={1.95} getBusy={() => busy} />
    </group>
  );
}

/** Your game-character spouse/fiancé(e) lives at home: strolls between a few spots. */
function Spouse({ npc, b }) {
  const g = useRef();
  const motion = useRef({ mode: 'idle' });
  const st = useRef({ x: -2, z: 2, i: 0, wait: 2 });
  const spots = useMemo(() => [[-3, 3], [b.x1 + 2, -2], [0, 0.5], [3, -3], [-1, -3.5]], [b.x1]);
  const tag = useMemo(() => labelTexture(`${npc.status === 'married' ? '💍' : '💞'} ${npc.name}`, { size: 44, bold: 800, bg: 'rgba(225,29,72,.9)', fg: '#fff' }), [npc.name, npc.status]);
  useFrame((_, dt) => {
    const s = st.current;
    const [tx, tz] = spots[s.i];
    const dx = tx - s.x;
    const dz = tz - s.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.1) {
      motion.current.mode = 'idle';
      s.wait -= dt;
      if (s.wait <= 0) { s.i = (s.i + 1) % spots.length; s.wait = 3 + Math.random() * 4; }
    } else {
      const step = Math.min(d, 1.6 * Math.min(dt, 0.1));
      s.x += (dx / d) * step;
      s.z += (dz / d) * step;
      motion.current.mode = 'walk';
      g.current.rotation.y = Math.atan2(dx, dz);
    }
    g.current.position.set(s.x, 0, s.z);
  });
  return (
    <group ref={g}>
      <Body appearance={npc.look} motion={motion} />
      <sprite position={[0, 2.25, 0]} scale={[0.36 * tag.aspect, 0.36, 1]}><spriteMaterial map={tag.texture} depthWrite={false} /></sprite>
    </group>
  );
}

/** Someone else in the same home (host or fellow guest), smoothed toward their last position. */
function Guest({ g }) {
  const ref = useRef();
  const motion = useRef({ mode: 'idle' });
  const pos = useRef({ x: g.x, z: g.z, y: g.y || 0, ry: g.ry || 0 });
  useFrame((_, dt) => {
    const p = pos.current;
    const a = 1 - Math.exp(-Math.min(dt, 0.1) * 10);
    const d = Math.hypot(g.x - p.x, g.z - p.z);
    p.x += (g.x - p.x) * a;
    p.z += (g.z - p.z) * a;
    p.y += ((g.y || 0) - p.y) * a;
    let diff = (g.ry || 0) - p.ry;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    p.ry += diff * a;
    motion.current.mode = g.mode && g.mode !== 'idle' && g.mode !== 'walk' ? g.mode : d > 0.05 ? 'walk' : 'idle';
    ref.current.position.set(p.x, p.y, p.z);
    ref.current.rotation.y = p.ry;
  });
  return (
    <group ref={ref} onClick={(e) => { if (e.delta > 10) return; e.stopPropagation(); useStore.setState({ sheet: { type: 'player', id: g.username } }); }}>
      <Body appearance={g.appearance} motion={motion} />
      <Overhead id={g.id} username={g.username} height={1.95} />
    </group>
  );
}
function Guests() {
  const roster = useStore((s) => s.homeRoster);
  const list = useMemo(() => [...homeGuests.values()], [roster]); // eslint-disable-line react-hooks/exhaustive-deps
  return list.map((g) => <Guest key={`${g.id}-${g.appearance?.outfit}`} g={g} />);
}

/** Your cars on the driveway (up to 3, best first). Tap one to drive it out into town. */
function Driveway({ vehicles, mine }) {
  const run = useStore((s) => s.run);
  const cars = [...(vehicles || [])].filter((v) => vehicleById[v.model]).sort((a, b) => vehicleById[b.model].price - vehicleById[a.model].price).slice(0, 3);
  const driveOut = (v) => (e) => {
    if (!mine || e.delta > 10) return;
    e.stopPropagation();
    local.lastCar = v.id;
    useStore.setState({ tab: 'town', cityView: 'follow' });
    run('/vehicle/use', { method: 'POST', body: { vehicleId: v.id } });
  };
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-4.8, -0.02, 8.2]} material={mat('#9ca3af')}><planeGeometry args={[9, 5.6]} /></mesh>
      {cars.map((v, i) => {
        const d = vehicleById[v.model];
        return (
          <group key={v.id} position={[-1.8 - i * 3, 0, 8.2]} rotation={[0, Math.PI, 0]} scale={0.9} onClick={driveOut(v)}>
            <Vehicle kind={d.kind} body={d.body} lux={d.lux} model={d.id} color={v.color} />
          </group>
        );
      })}
    </group>
  );
}

function Ghost({ items, b }) {
  const placing = useStore((s) => s.placing);
  if (!placing) return null;
  const others = items.filter((i) => i.id !== placing.id);
  const ok = homeFits(placing.def, placing.x, placing.z, placing.rot, others, b);
  const [w, d] = footprint(placing.def, placing.rot);
  return (
    <group position={[placing.x, 0.02, placing.z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <planeGeometry args={[w, d]} />
        <meshBasicMaterial color={ok ? '#22c55e' : '#ef4444'} transparent opacity={0.3} depthWrite={false} />
      </mesh>
      <group rotation={[0, (placing.rot * Math.PI) / 2, 0]}>
        <FurnitureModel def={placing.def} ghost={ok ? 'ok' : 'bad'} />
      </group>
    </group>
  );
}

/** Snap an item's centre so its footprint lines up with the grid. */
export function snapCenter(v, size, half) {
  const off = (size % 2) / 2;
  return Math.max(-half + size / 2, Math.min(half - size / 2, Math.round(v - off) + off));
}
/** Snap an item's centre to the grid inside [lo, hi] (the home's walls on that axis). */
export function snapIn(v, size, lo, hi) {
  const off = (size % 2) / 2;
  return Math.max(lo + size / 2, Math.min(hi - size / 2, Math.round(v - off) + off));
}

export function HomeScene({ me }) {
  const own = useStore((s) => s.homeItems);
  const visiting = useStore((s) => s.visiting);
  const items = visiting ? visiting.items : own;
  const events = useStore((s) => s.events);
  const party = livePartyAt(events, 'home', visiting ? visiting.host.id : me.id);
  const placing = useStore((s) => s.placing);
  const dragging = useRef(false);
  // The yard beside the house: yours (kept in the store, updated by build mode) or the host's.
  const myYard = useStore((s) => s.yard);
  const hostYard = useStore((s) => s.visitYard);
  const host = visiting?.host?.username;
  const layout = homeLayout(me, visiting);
  const { b } = layout;
  // Garden add-ons sit in front of the house: pull the camera back a little to include them.
  const garden = layout.features.some((f) => ['pool', 'bbq', 'cinema', 'jacuzzi'].includes(f));
  homeView.cx = (b.x1 + b.x2) / 2;
  homeView.cz = (b.z1 + b.z2) / 2 + (garden ? 10 : 0);
  homeView.extra = layout.level * 4 + (garden ? 8 : 0);
  const floor = HOME_FLOORS.find((f) => f.id === layout.style.floor) || HOME_FLOORS[0];
  const terrace = layout.features.includes('rooftop');
  useEffect(() => {
    useStore.setState({ visitYard: null });
    if (host) api(`/yard/${encodeURIComponent(host)}`).then((y) => useStore.setState({ visitYard: y })).catch(() => {});
    else api('/yard').then((y) => useStore.setState({ yard: y })).catch(() => {});
  }, [host]);

  const floorPoint = (e) => [e.point.x - HOME_ORIGIN[0], e.point.z - HOME_ORIGIN[2]];
  const moveGhost = (pt) => {
    const p = useStore.getState().placing;
    if (!p) return;
    const [w, d] = footprint(p.def, p.rot);
    useStore.setState({ placing: { ...p, x: snapIn(pt[0], w, b.x1, b.x2), z: snapIn(pt[1], d, b.z1, b.z2) } });
  };
  const onFloorClick = (e) => {
    if (e.delta > 10 && !useStore.getState().placing) return;
    e.stopPropagation();
    const pt = floorPoint(e);
    if (useStore.getState().placing) return moveGhost(pt);
    walkHome(Math.max(b.x1 + 0.4, Math.min(b.x2 - 0.4, pt[0])), Math.max(b.z1 + 0.4, Math.min(b.z2 - 0.4, pt[1])), 0);
  };
  // Tapping the glass upper floor walks you up the stairs (placing furniture stays downstairs).
  const onUpperClick = (e) => {
    if (useStore.getState().placing || e.delta > 10) return;
    e.stopPropagation();
    const [x, z] = floorPoint(e);
    walkHome(Math.max(HOME_UPPER.x1 + 0.4, Math.min(HOME_UPPER.x2 - 0.4, x)), Math.max(HOME_UPPER.z1 + 0.4, Math.min((terrace ? HOME_UPPER.terrace : HOME_UPPER.z2) - 0.3, z)), 1);
  };

  return (
    <group position={HOME_ORIGIN}>
      <Shadows light={[6, 12, 7]} size={14} intensity={0.7}>
      <Garden b={b} />
      <Floor x1={b.x1} x2={b.x2} z1={b.z1} z2={b.z2} a={floor.a} b={floor.b} kind={floor.kind} />
      <Floor x1={1.5} x2={6} z1={-5} z2={-1} a="#b98552" b="#a8744a" y={0.008} kind="wood" />
      <Floor x1={-6} x2={-2} z1={1.5} z2={5} a="#e0ecf7" b="#cfe0f0" y={0.008} kind="small" />
      {layout.room && <Floor x1={b.x1} x2={b.x1 + 5} z1={b.z1} z2={b.z1 + 4.5} a="#c7a27a" b="#b8916a" y={0.008} kind="wood" />}
      <Walls layout={layout} />
      {/* invisible click/drag surface for walking and placing */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[(b.x1 + b.x2) / 2, 0.02, (b.z1 + b.z2) / 2]}
        visible={false}
        onClick={onFloorClick}
        onPointerDown={(e) => { if (useStore.getState().placing) { dragging.current = true; e.stopPropagation(); moveGhost(floorPoint(e)); } }}
        onPointerMove={(e) => { if (dragging.current) moveGhost(floorPoint(e)); }}
        onPointerUp={() => (dragging.current = false)}
        onPointerLeave={() => (dragging.current = false)}
      >
        <planeGeometry args={[b.x2 - b.x1, b.z2 - b.z1]} />
      </mesh>
      {layout.storey && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, HOME_UP_Y + 0.03, (HOME_UPPER.z1 + (terrace ? HOME_UPPER.terrace : HOME_UPPER.z2)) / 2]} visible={false} onClick={onUpperClick}>
          <planeGeometry args={[HOME_UPPER.x2 - HOME_UPPER.x1, (terrace ? HOME_UPPER.terrace : HOME_UPPER.z2) - HOME_UPPER.z1]} />
        </mesh>
      )}
      <HomeAddons features={layout.features} b={b} wallMat={wallMat(layout.style.wall || WALL)} onUse={doAddon} />
      {items.map((it) => {
        const def = furnitureById[it.item];
        if (!def || placing?.id === it.id) return null;
        return (
          <group
            key={it.id}
            position={[it.x, 0.01, it.z]}
            rotation={[0, (it.rot * Math.PI) / 2, 0]}
            onClick={(e) => {
              if (e.delta > 10) return;
              e.stopPropagation();
              const st = useStore.getState();
              if (st.placing) return;
              if (st.tab === 'shop') useStore.setState({ placing: { def, x: it.x, z: it.z, rot: it.rot, id: it.id } });
              else useStore.setState({ homeSel: it.id });
            }}
          >
            <FurnitureModel def={def} />
          </group>
        );
      })}
      <Yard yard={visiting ? hostYard : myYard} mine={!visiting} origin={HOME_ORIGIN} />
      <Ghost items={items} b={b} />
      <Sim me={me} items={items} layout={layout} />
      {!visiting && me.npcPartner && me.npcPartner.status !== 'couple' && <Spouse npc={me.npcPartner} b={b} />}
      <Guests />
      {party && <PartyDecor event={party} home />}
      <Driveway vehicles={visiting ? visiting.host.vehicles : me.vehicles} mine={!visiting} />
      <pointLight color="#fff7ed" intensity={10} distance={20} position={[0, 4, 0]} />
      </Shadows>
    </group>
  );
}
