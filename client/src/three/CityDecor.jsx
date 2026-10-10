// City glow-up: lit windows at night, street lamps with light pools, pavements, zebra crossings,
// rooftop water tanks, LED screens and painted street names. Everything is instanced and shares
// a few materials whose glow follows the day/night cycle (see setCityNight).
import { memo, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ROADS, isWater } from '@shared/world.js';

// ----------------------------------------------------------------- night state
const night = { v: 0 };
const glowMats = new Set(); // { mat, base, kind }
/** Called by the sky every game-minute: 0 = full day, 1 = night. */
export function setCityNight(v) {
  if (Math.abs(v - night.v) < 0.01) return;
  night.v = v;
  for (const g of glowMats) {
    if (g.kind === 'emissive') g.mat.emissiveIntensity = g.base * v;
    else if (g.kind === 'opacity') g.mat.opacity = g.base * v;
    else if (g.kind === 'color') g.mat.color.copy(g.day).lerp(g.night, v);
  }
}
export const cityNight = night;
const track = (mat, kind, base, extra = {}) => { glowMats.add({ mat, kind, base, ...extra }); return mat; };

// ----------------------------------------------------------------- facades
function canvas(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
// Low houses: 2×2 windows with frames + a door strip. Emissive map lights ~60% of windows warm.
const HOUSE_MAP = canvas(64, 64, (x) => {
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, 64, 64);
  x.fillStyle = 'rgba(0,0,0,.06)'; x.fillRect(0, 58, 64, 6); // plinth
  for (const [wx, wy] of [[9, 10], [37, 10], [9, 32], [37, 32]]) {
    x.fillStyle = '#e5e7eb'; x.fillRect(wx - 2, wy - 2, 22, 18);
    x.fillStyle = '#5b7f99'; x.fillRect(wx, wy, 18, 14);
    x.fillStyle = 'rgba(255,255,255,.35)'; x.fillRect(wx + 2, wy + 2, 5, 10);
  }
});
const HOUSE_GLOW = canvas(64, 64, (x) => {
  x.fillStyle = '#000'; x.fillRect(0, 0, 64, 64);
  for (const [wx, wy, on] of [[9, 10, 1], [37, 10, 0], [9, 32, 1], [37, 32, 1]]) if (on) { x.fillStyle = '#fff'; x.fillRect(wx, wy, 18, 14); }
});
export const houseMat = track(new THREE.MeshLambertMaterial({ color: '#ffffff', map: HOUSE_MAP, emissive: new THREE.Color('#ffc46b'), emissiveMap: HOUSE_GLOW, emissiveIntensity: 0 }), 'emissive', 1.1);

// Towers: a grid of glass with random lit offices at night.
const TOWER_MAP = canvas(64, 64, (x) => {
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, 64, 64);
  x.fillStyle = '#6f97b5';
  for (let y = 4; y < 64; y += 12) for (let i = 4; i < 64; i += 12) x.fillRect(i, y, 8, 8);
});
const TOWER_GLOW = canvas(64, 64, (x) => {
  x.fillStyle = '#000'; x.fillRect(0, 0, 64, 64);
  let s = 7;
  for (let y = 4; y < 64; y += 12) for (let i = 4; i < 64; i += 12) { s = (s * 9301 + 49297) % 233280; if (s / 233280 < 0.55) { x.fillStyle = s % 3 ? '#fff6d8' : '#cfe8ff'; x.fillRect(i, y, 8, 8); } }
});
for (const t of [TOWER_MAP, TOWER_GLOW]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 5); }
export const towerGlowMat = track(new THREE.MeshLambertMaterial({ color: '#ffffff', map: TOWER_MAP, emissive: new THREE.Color('#ffe9b0'), emissiveMap: TOWER_GLOW, emissiveIntensity: 0 }), 'emissive', 1.0);

/** Store fronts: a warm glass band that glows at night (used by place buildings). */
export const shopGlassMat = track(new THREE.MeshLambertMaterial({ color: '#9fc3d9', emissive: new THREE.Color('#ffcf85'), emissiveIntensity: 0 }), 'emissive', 1.2);
/** Neon trims that brighten at night. */
const neonCache = new Map();
export function neonMat(color) {
  if (neonCache.has(color)) return neonCache.get(color);
  const m = track(new THREE.MeshBasicMaterial({ color }), 'color', 0, { day: new THREE.Color(color).multiplyScalar(0.75), night: new THREE.Color(color).multiplyScalar(1.6) });
  neonCache.set(color, m);
  return m;
}

// ------------------------------------------------------------- shared geometry
const unitBox = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
/** A fluffy tree crown: three soft spheres merged (one draw call when instanced). */
export const fluffyCrown = (() => {
  const parts = [[0, 0.1, 0, 1], [0.55, -0.15, 0.25, 0.72], [-0.45, -0.1, -0.3, 0.78], [0.1, 0.45, -0.2, 0.62]].map(([x, y, z, r]) => new THREE.IcosahedronGeometry(r, 1).translate(x, y, z));
  return mergeGeometries(parts);
})();

function Instanced({ items, geometry, material, transform, order }) {
  const ref = useRef();
  useLayoutEffect(() => {
    if (!ref.current) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    const e = new THREE.Euler();
    items.forEach((it, i) => {
      const t = transform(it);
      p.set(...t.pos);
      s.set(...t.scale);
      e.set(t.rx || 0, t.rot || 0, 0);
      q.setFromEuler(e);
      m.compose(p, q, s);
      ref.current.setMatrixAt(i, m);
    });
    ref.current.instanceMatrix.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, [items, transform]);
  if (!items.length) return null;
  return <instancedMesh ref={ref} args={[geometry, material, items.length]} frustumCulled={false} renderOrder={order || 0} />;
}

// ------------------------------------------------------------------ streets
const roadInfo = ROADS.map(([x1, z1, x2, z2, w, name]) => ({ horiz: z1 === z2, x1: Math.min(x1, x2), x2: Math.max(x1, x2), z1: Math.min(z1, z2), z2: Math.max(z1, z2), w, name }));
const onAnyRoad = (x, z, pad = 0) => roadInfo.some((r) => x >= r.x1 - r.w / 2 - pad && x <= r.x2 + r.w / 2 + pad && z >= r.z1 - r.w / 2 - pad && z <= r.z2 + r.w / 2 + pad);

const PAVE_MAT = new THREE.MeshLambertMaterial({ color: '#e9dcc6' });
const KERB_MAT = new THREE.MeshLambertMaterial({ color: '#cbb89a' });
const ZEBRA_TEX = canvas(64, 16, (x) => {
  x.clearRect(0, 0, 64, 16);
  x.fillStyle = '#ffffff';
  for (let i = 2; i < 64; i += 8) x.fillRect(i, 0, 4, 16);
});
const ZEBRA_MAT = new THREE.MeshBasicMaterial({ map: ZEBRA_TEX, transparent: true, opacity: 0.92, depthWrite: false });
const POLE_MAT = new THREE.MeshLambertMaterial({ color: '#374151' });
const LAMP_MAT = track(new THREE.MeshBasicMaterial({ color: '#9ca3af' }), 'color', 0, { day: new THREE.Color('#d1d5db'), night: new THREE.Color('#ffd27a') });
const POOL_TEX = canvas(64, 64, (x) => {
  const g = x.createRadialGradient(32, 32, 2, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,214,140,0.9)');
  g.addColorStop(0.5, 'rgba(255,190,110,0.35)');
  g.addColorStop(1, 'rgba(255,170,90,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
});
const POOL_MAT = track(new THREE.MeshBasicMaterial({ map: POOL_TEX, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }), 'opacity', 0.8);
const poleGeo = new THREE.CylinderGeometry(0.07, 0.1, 1, 6).translate(0, 0.5, 0);
const armGeo = new THREE.BoxGeometry(1, 0.08, 0.08).translate(0.5, 0, 0);
const headGeo = new THREE.SphereGeometry(0.26, 10, 8);
const planeXZ = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);

/** Pavements, kerbs, zebra crossings at junctions, and lamp posts along every road. */
export const Streets = memo(function Streets({ lowEnd }) {
  const data = useMemo(() => {
    const pave = [];
    const zebras = [];
    const lamps = [];
    for (const r of roadInfo) {
      const len = r.horiz ? r.x2 - r.x1 : r.z2 - r.z1;
      const cx = (r.x1 + r.x2) / 2;
      const cz = (r.z1 + r.z2) / 2;
      for (const side of [-1, 1]) {
        const off = r.w / 2 + 0.9;
        pave.push(r.horiz ? { x: cx, z: cz + side * off, w: len, d: 1.8 } : { x: cx + side * off, z: cz, w: 1.8, d: len });
      }
      // Lamps every ~15 units, alternating sides, skipping junctions and water.
      const step = 15;
      let k = 0;
      for (let t = 6; t < len - 6; t += step, k++) {
        const side = k % 2 ? 1 : -1;
        const off = r.w / 2 + 1.2;
        const x = r.horiz ? r.x1 + t : cx + side * off;
        const z = r.horiz ? cz + side * off : r.z1 + t;
        if (isWater(x, z)) continue;
        if (roadInfo.some((o) => o !== r && o.horiz !== r.horiz && Math.abs((r.horiz ? o.x1 : o.z1) - (r.horiz ? x : z)) < o.w / 2 + 3 && (r.horiz ? z >= o.z1 - 4 && z <= o.z2 + 4 : x >= o.x1 - 4 && x <= o.x2 + 4))) continue;
        // Arm reaches over the road: rotation points from the kerb toward the centre line.
        const rot = r.horiz ? (side > 0 ? Math.PI / 2 : -Math.PI / 2) : (side > 0 ? Math.PI : 0);
        lamps.push({ x, z, rot, hx: r.horiz ? x : x - side * 1.1, hz: r.horiz ? z - side * 1.1 : z });
      }
    }
    // Zebra crossings on all four sides of every junction.
    for (const h of roadInfo.filter((r) => r.horiz)) for (const v of roadInfo.filter((r) => !r.horiz)) {
      const x = (v.x1 + v.x2) / 2;
      const z = (h.z1 + h.z2) / 2;
      if (x < h.x1 || x > h.x2 || z < v.z1 || z > v.z2) continue;
      for (const s of [-1, 1]) {
        const ex = x + s * (v.w / 2 + 1.6);
        if (ex > h.x1 && ex < h.x2) zebras.push({ x: ex, z, w: 2.2, d: h.w, rot: Math.PI / 2 });
        const ez = z + s * (h.w / 2 + 1.6);
        if (ez > v.z1 && ez < v.z2) zebras.push({ x, z: ez, w: 2.2, d: v.w, rot: 0 });
      }
    }
    return { pave, zebras, lamps };
  }, []);
  const { pave, zebras, lamps } = data;
  return (
    <group>
      <Instanced items={pave} geometry={unitBox} material={PAVE_MAT} transform={(p) => ({ pos: [p.x, -0.02, p.z], scale: [p.w, 0.095, p.d] })} />
      <Instanced items={pave} geometry={unitBox} material={KERB_MAT} transform={(p) => ({ pos: [p.x, -0.02, p.z], scale: [p.w + (p.w > p.d ? 0 : 0.25), 0.1, p.d + (p.w > p.d ? 0.25 : 0)] })} />
      <Instanced items={zebras} geometry={planeXZ} material={ZEBRA_MAT} order={1} transform={(zb) => ({ pos: [zb.x, 0.1, zb.z], scale: [zb.d, 1, zb.w], rot: zb.rot })} />
      <Instanced items={lamps} geometry={poleGeo} material={POLE_MAT} transform={(l) => ({ pos: [l.x, 0, l.z], scale: [1, 4.2, 1] })} />
      <Instanced items={lamps} geometry={armGeo} material={POLE_MAT} transform={(l) => ({ pos: [l.x, 4.15, l.z], scale: [1.2, 1, 1], rot: l.rot })} />
      <Instanced items={lamps} geometry={headGeo} material={LAMP_MAT} transform={(l) => ({ pos: [l.hx, 4.05, l.hz], scale: [1, 0.6, 1] })} />
      {!lowEnd && <Instanced items={lamps} geometry={planeXZ} material={POOL_MAT} order={2} transform={(l) => ({ pos: [l.hx, 0.12, l.hz], scale: [9, 1, 9] })} />}
    </group>
  );
});

// ----------------------------------------------------------------- rooftops
const TANK_MAT = new THREE.MeshLambertMaterial({ color: '#1f2937' });
const tankGeo = new THREE.CylinderGeometry(0.55, 0.6, 1.3, 10).translate(0, 0.65, 0);
const lidGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.12, 8).translate(0, 1.36, 0);
/** Black Simtank water tanks on roofs — the Dar skyline signature. */
export function RoofTanks({ houses }) {
  const items = useMemo(() => houses.filter((_, i) => i % 5 < 2).map((h) => ({ x: h.x + h.w * 0.22, y: h.h + 0.35, z: h.z - h.d * 0.18 })), [houses]);
  return (
    <>
      <Instanced items={items} geometry={tankGeo} material={TANK_MAT} transform={(t) => ({ pos: [t.x, t.y, t.z], scale: [1, 1, 1] })} />
      <Instanced items={items} geometry={lidGeo} material={TANK_MAT} transform={(t) => ({ pos: [t.x, t.y, t.z], scale: [1, 1, 1] })} />
    </>
  );
}

// --------------------------------------------------------------- LED screens
const LED_LINES = [['BONGO LIFE', '#f5b800'], ['KARIBU DAR 🇹🇿', '#22c55e'], ['MAISHA NI SASA', '#ec4899'], ['BONGO FLAVA', '#38bdf8']];
/** Big animated LED screens on a few tall towers (like the Posta skyline at night). */
export function LedScreens({ towers }) {
  const screens = useMemo(() => [...towers].filter((t) => t.h > 20).sort((a, b) => b.h - a.h).slice(0, 5), [towers]);
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 128;
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  const acc = useRef(0);
  useFrame(({ clock }, dt) => {
    acc.current += dt;
    if (acc.current < 0.12) return;
    acc.current = 0;
    const x = tex.image.getContext('2d');
    const time = clock.elapsedTime;
    const idx = Math.floor(time / 4) % LED_LINES.length;
    const [text, col] = LED_LINES[idx];
    const g = x.createLinearGradient(0, 0, 256, 128);
    const hue = (time * 25) % 360;
    g.addColorStop(0, `hsl(${hue},80%,22%)`);
    g.addColorStop(1, `hsl(${(hue + 80) % 360},80%,12%)`);
    x.fillStyle = g; x.fillRect(0, 0, 256, 128);
    // Tanzanian flag sash sweeping across
    x.save();
    x.translate(((time * 60) % 420) - 80, 0);
    x.rotate(-0.5);
    for (const [c, w] of [['#1eb53a', 18], ['#fcd116', 5], ['#111', 14], ['#fcd116', 5], ['#00a3dd', 18]]) { x.fillStyle = c; x.globalAlpha = 0.35; x.fillRect(0, -40, w, 260); x.translate(w, 0); }
    x.restore();
    x.globalAlpha = 1;
    const k = (time % 4) / 4;
    x.font = "800 34px 'Plus Jakarta Sans', system-ui, sans-serif";
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillStyle = col;
    x.globalAlpha = Math.min(1, k * 4, (1 - k) * 4);
    x.fillText(text, 128, 64);
    x.globalAlpha = 1;
    x.fillStyle = 'rgba(0,0,0,.25)';
    for (let y = 0; y < 128; y += 4) x.fillRect(0, y, 256, 1); // LED scanlines
    tex.needsUpdate = true;
  });
  return screens.map((t, i) => (
    <mesh key={i} position={[t.x, t.h * 0.62, t.z + t.d / 2 + 0.06]}>
      <planeGeometry args={[t.w * 0.9, t.w * 0.45]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  ));
}

// -------------------------------------------------------------- street names
const nameCache = new Map();
function streetNameTex(name) {
  if (nameCache.has(name)) return nameCache.get(name);
  const text = name.toUpperCase();
  const c = document.createElement('canvas');
  const x = c.getContext('2d');
  x.font = "800 56px 'Plus Jakarta Sans', system-ui, sans-serif";
  const w = Math.ceil(x.measureText(text).width) + 20;
  c.width = w; c.height = 72;
  x.font = "800 56px 'Plus Jakarta Sans', system-ui, sans-serif";
  x.textBaseline = 'middle';
  x.fillStyle = 'rgba(255,255,255,.55)';
  x.fillText(text, 10, 38);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const res = { t, aspect: w / 72 };
  nameCache.set(name, res);
  return res;
}
/** Big painted street names along the main roads (map view), like a stylised city map. */
export function StreetNames() {
  const items = useMemo(() => roadInfo.filter((r) => r.name).map((r) => {
    const len = r.horiz ? r.x2 - r.x1 : r.z2 - r.z1;
    return { ...r, len, cx: (r.x1 + r.x2) / 2, cz: (r.z1 + r.z2) / 2 };
  }), []);
  return items.map((r, i) => {
    const { t, aspect } = streetNameTex(r.name);
    const h = Math.min(r.w * 0.75, 4.2);
    const w = Math.min(h * aspect, r.len * 0.45);
    return (
      <mesh key={i} position={[r.cx + (r.horiz ? r.len * 0.18 : 0), 0.13, r.cz + (r.horiz ? 0 : r.len * 0.18)]} rotation={[-Math.PI / 2, 0, r.horiz ? 0 : Math.PI / 2]} renderOrder={1}>
        <planeGeometry args={[w, w / aspect]} />
        <meshBasicMaterial map={t} transparent depthWrite={false} />
      </mesh>
    );
  });
}

void onAnyRoad;
