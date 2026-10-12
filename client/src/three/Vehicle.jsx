import * as THREE from 'three';
import { mat, geo } from './textures.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { shadowMat } from './Avatar.jsx';
import { track, cityNight } from './CityDecor.jsx';

const TIRE = mat('#111827');
const GLASS = mat('#9ec5e8');
const LIGHT = mat('#fef9c3');
const CHROME = mat('#cbd5e1');

function Wheels({ pts, r = 0.32, w = 0.22 }) {
  return pts.map(([x, z], i) => <mesh key={i} geometry={geo('cyl', r, r, w, 10)} material={TIRE} position={[x, r, z]} rotation={[0, 0, Math.PI / 2]} />);
}

/** Faces +z. Scale ~ real metres. */
export function Vehicle({ kind, color = '#e5e7eb', body: bodyStyle, lux, model, lite }) {
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
    default:
      return <Car body={bodyStyle || DEFAULT_BODY[kind] || 'hatch'} color={color} lux={lux} model={model} lite={lite} />;
  }
}


// ------------------------------------------------------------------ cars
// Each body is a side silhouette (z = length towards the nose, y = height): smoothed, given real
// wheel arches and extruded across the car's width with rounded edges. On top: a tumblehome
// glasshouse with pillars and roof, then lights, grille, trim and multi-spoke wheels. Every part
// is merged per material and cached per model, so a car is about a dozen draw calls.
// Facing +z, metres.
const DEFAULT_BODY = { car: 'hatch', suv: 'suv', van: 'van' };
const BODIES = {
  hatch: { L: 3.9, W: 1.7, wheel: 0.32, body: [[-1.95, 0.32], [-1.95, 0.95], [-1.8, 1.0], [1.05, 0.98], [1.95, 0.78], [1.95, 0.32]], cabin: [[-1.8, 0.98], [-1.65, 1.5], [0.2, 1.52], [1.05, 0.98]] },
  sedan: { L: 4.7, W: 1.8, wheel: 0.33, body: [[-2.35, 0.32], [-2.35, 0.88], [-2.2, 0.98], [-1.3, 1.0], [1.25, 0.95], [2.35, 0.78], [2.35, 0.32]], cabin: [[-1.35, 1.0], [-0.75, 1.46], [0.55, 1.46], [1.3, 0.95]], cp: 0.2 },
  luxury: { L: 5.2, W: 1.9, wheel: 0.36, body: [[-2.6, 0.34], [-2.6, 0.92], [-2.45, 1.02], [-1.45, 1.05], [1.4, 1.0], [2.6, 0.84], [2.6, 0.34]], cabin: [[-1.5, 1.05], [-0.85, 1.52], [0.65, 1.52], [1.45, 1.0]], cp: 0.24 },
  sports: { L: 4.5, W: 1.95, wheel: 0.34, inset: 0.8, doors: 2, body: [[-2.25, 0.25], [-2.25, 0.8], [-1.9, 0.88], [-0.9, 0.92], [1.2, 0.72], [2.25, 0.5], [2.25, 0.25]], cabin: [[-1.25, 0.9], [-0.55, 1.22], [0.15, 1.22], [1.15, 0.73]] },
  suv: { L: 4.6, W: 1.9, wheel: 0.4, d: true, body: [[-2.3, 0.45], [-2.3, 1.18], [-2.15, 1.25], [1.25, 1.22], [2.3, 1.0], [2.3, 0.45]], cabin: [[-2.15, 1.24], [-2.05, 1.85], [0.55, 1.88], [1.3, 1.22]] },
  'suv-big': { L: 5.0, W: 2.0, wheel: 0.43, d: true, smooth: 1, cut: 0.2, body: [[-2.5, 0.48], [-2.5, 1.28], [-2.4, 1.34], [1.45, 1.32], [2.5, 1.12], [2.5, 0.48]], cabin: [[-2.4, 1.33], [-2.32, 2.02], [0.85, 2.04], [1.5, 1.32]] },
  // Range Rover: long flat bonnet, flat beltline, upright tail, short overhangs.
  range: { L: 5.05, W: 2.05, wheel: 0.45, inset: 0.86, d: true, smooth: 1, cut: 0.2, body: [[-2.52, 0.46], [-2.52, 1.2], [-2.45, 1.27], [1.5, 1.27], [2.42, 1.16], [2.52, 1.0], [2.52, 0.46]], cabin: [[-2.45, 1.27], [-2.4, 1.84], [0.9, 1.88], [1.58, 1.27]] },
  // Rolls-Royce: tall upright nose, long bonnet, sweeping roof.
  rolls: { L: 5.35, W: 2.05, wheel: 0.46, inset: 0.9, d: true, smooth: 1, cut: 0.18, body: [[-2.67, 0.5], [-2.67, 1.28], [-2.55, 1.38], [1.7, 1.42], [2.62, 1.36], [2.67, 1.2], [2.67, 0.5]], cabin: [[-2.42, 1.38], [-2.22, 2.0], [0.85, 2.02], [1.72, 1.42]] },
  'suv-sport': { L: 5.1, W: 2.05, wheel: 0.44, body: [[-2.55, 0.42], [-2.55, 1.05], [-2.3, 1.15], [1.3, 1.08], [2.55, 0.82], [2.55, 0.42]], cabin: [[-2.2, 1.14], [-1.75, 1.66], [0.35, 1.68], [1.35, 1.08]] },
  boxy: { L: 4.85, W: 2.0, wheel: 0.44, d: true, smooth: 1, cut: 0.08, body: [[-2.42, 0.5], [-2.42, 1.3], [1.6, 1.3], [2.42, 1.22], [2.42, 0.5]], cabin: [[-2.42, 1.3], [-2.4, 2.0], [1.2, 2.0], [1.62, 1.3]] },
  van: { L: 4.7, W: 1.8, wheel: 0.34, wrap: true, body: [[-2.35, 0.35], [-2.35, 1.95], [1.2, 1.98], [2.35, 1.05], [2.35, 0.35]], cabin: [[-2.2, 1.35], [-2.2, 1.85], [1.1, 1.88], [1.95, 1.2], [1.95, 1.05]] },
};
// Signature details per model (anything left out uses DEFAULT_STYLE).
const DEFAULT_STYLE = { lights: 'std', grille: 'std', tail: 'std', rim: 'rim', spokes: [5, 0.075] };
const STYLES = {
  range: { lights: 'slim', grille: 'range', tail: 'bar', pillars: 'black', roof: 'black', rim: 'rimDark', spokes: [10, 0.04], drl: true },
  cullinan: { lights: 'rr', grille: 'rr', tail: 'rr', spokes: [7, 0.05], drl: true, mascot: true, chromeBelt: true },
  gwagon: { lights: 'round', grille: 'g', tail: 'g', rim: 'rimDark', spokes: [6, 0.09], spare: true, steps: true, fenderLights: true, cladding: true },
  porsche: { lights: 'round', grille: 'intakes', tail: 'bar', spokes: [5, 0.06], caliper: true, exhaust: 2, noWing: true },
  aventador: { lights: 'y', grille: 'intakes', tail: 'y', rim: 'rimDark', spokes: [5, 0.05], caliper: true, exhaust: 1 },
  urus: { lights: 'y', grille: 'urus', tail: 'bar', rim: 'rimDark', spokes: [5, 0.06], caliper: true, cladding: true, exhaust: 2, drl: true },
  'bmw-x5': { lights: 'slim', grille: 'kidney', spokes: [10, 0.04], rails: true, drl: true },
  'benz-c': { lights: 'slim', grille: 'benz', spokes: [10, 0.04], drl: true },
  'benz-s': { lights: 'slim', grille: 'benz', tail: 'bar', spokes: [10, 0.035], drl: true, chromeBelt: true, exhaust: 2 },
  v8: { rails: true, steps: true, cladding: true },
  prado: { rails: true, steps: true, cladding: true },
  harrier: { lights: 'slim', tail: 'bar', drl: true },
  crown: { grille: 'benz' },
};

// ---- materials: glossy clear-coated paint and chrome reflect a small painted sky.
let envTex = null;
function carEnv() {
  if (envTex) return envTex;
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#4f79ad'); g.addColorStop(0.4, '#c9dcef'); g.addColorStop(0.5, '#f8fafc'); g.addColorStop(0.53, '#6b6f76'); g.addColorStop(1, '#1d1f24');
  x.fillStyle = g;
  x.fillRect(0, 0, 512, 256);
  x.fillStyle = 'rgba(255,255,255,0.9)';
  for (const [px, w] of [[30, 80], [200, 120], [390, 70]]) x.fillRect(px, 36, w, 24);
  x.fillStyle = 'rgba(34,40,52,0.6)';
  for (let i = 0; i < 64; i++) { const h = 5 + ((i * 37) % 22); x.fillRect(i * 8, 128 - h, 7, h); }
  envTex = new THREE.CanvasTexture(c);
  envTex.mapping = THREE.EquirectangularReflectionMapping;
  envTex.colorSpace = THREE.SRGBColorSpace;
  return envTex;
}
// Reflections dim at night; lamps glow.
const envd = (m, base) => { track(m, 'env', base); m.envMapIntensity = base * (1 - 0.75 * cityNight.v); return m; };
const glow = (m, base) => { track(m, 'emissive', base); m.emissiveIntensity = base * cityNight.v; return m; };
let CM = null;
function carMats() {
  if (CM) return CM;
  const env = carEnv();
  const std = (o) => new THREE.MeshStandardMaterial(o);
  CM = {
    glass: envd(new THREE.MeshPhysicalMaterial({ color: '#0c131d', metalness: 0.15, roughness: 0.05, clearcoat: 1, envMap: env }), 1.5),
    trim: std({ color: '#16181c', roughness: 0.8, metalness: 0.05 }),
    black: envd(std({ color: '#07080a', roughness: 0.16, metalness: 0.45, envMap: env }), 1),
    chrome: envd(std({ color: '#f1f5f9', roughness: 0.1, metalness: 1, envMap: env }), 1.3),
    light: glow(std({ color: '#e9eef5', roughness: 0.08, metalness: 0.4, envMap: env, emissive: '#fff3c4' }), 2.4),
    drl: std({ color: '#ffffff', emissive: '#e6f3ff', emissiveIntensity: 0.9 }),
    tail: glow(std({ color: '#b0102a', roughness: 0.2, emissive: '#ff1f35' }), 1.8),
    tire: std({ color: '#1b1c1f', roughness: 0.92 }),
    rim: envd(std({ color: '#d6dae0', roughness: 0.2, metalness: 0.95, envMap: env }), 1.1),
    rimDark: envd(std({ color: '#3b3e45', roughness: 0.28, metalness: 0.9, envMap: env }), 1.1),
    disc: std({ color: '#4a4e55', roughness: 0.5, metalness: 0.6 }),
    caliper: std({ color: '#dc2626', roughness: 0.35 }),
    plate: std({ color: '#f8fafc', roughness: 0.6 }),
    plateY: std({ color: '#facc15', roughness: 0.6 }),
  };
  return CM;
}
const paintCache = new Map();
function paint(color, lite) {
  const k = color + (lite ? ':l' : '');
  if (!paintCache.has(k)) {
    const m = lite
      ? new THREE.MeshStandardMaterial({ color, metalness: 0.4, roughness: 0.38, envMap: carEnv() })
      : new THREE.MeshPhysicalMaterial({ color, metalness: 0.5, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.05, envMap: carEnv() });
    paintCache.set(k, envd(m, 1));
  }
  return paintCache.get(k);
}

// ---- geometry helpers (everything non-indexed so it merges)
const ni = (g) => (g.index ? g.toNonIndexed() : g);
const EUL = new THREE.Euler();
const MAT4 = new THREE.Matrix4();
function place(g, x, y, z, rx = 0, ry = 0, rz = 0) {
  if (rx || ry || rz) g.applyMatrix4(MAT4.makeRotationFromEuler(EUL.set(rx, ry, rz)));
  g.translate(x, y, z);
  return ni(g);
}
const box = (w, h, d, x, y, z, rx, ry, rz) => place(new THREE.BoxGeometry(w, h, d), x, y, z, rx, ry, rz);
/** Cylinder whose axis runs along x (wheels, discs) unless rotated otherwise. */
const cylX = (r, h, seg, x, y, z, open = false) => place(new THREE.CylinderGeometry(r, r, h, seg, 1, open), x, y, z, 0, 0, Math.PI / 2);
const cylZ = (r, h, seg, x, y, z) => place(new THREE.CylinderGeometry(r, r, h, seg), x, y, z, Math.PI / 2, 0, 0);
/** A bar between two (z, y) points on the side at x. */
function bar([z1, y1], [z2, y2], x, t = 0.08, d = 0.05) {
  return box(d, t, Math.hypot(z2 - z1, y2 - y1), x, (y1 + y2) / 2, (z1 + z2) / 2, -Math.atan2(y2 - y1, z2 - z1));
}
function ext(pts, width, bevel = 0.06, segs = 3) {
  const shape = new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(z, y)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: width - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: segs, curveSegments: 6 });
  g.rotateY(-Math.PI / 2);
  g.translate((width - bevel * 2) / 2, 0, 0);
  return ni(g);
}
function chaikin(pts, iters, cut = 0.25) {
  let p = pts;
  for (let k = 0; k < iters; k++) {
    const out = [p[0]];
    for (let i = 0; i < p.length - 1; i++) {
      const [a, b] = [p[i], p[i + 1]];
      out.push([a[0] + (b[0] - a[0]) * cut, a[1] + (b[1] - a[1]) * cut], [a[0] + (b[0] - a[0]) * (1 - cut), a[1] + (b[1] - a[1]) * (1 - cut)]);
    }
    out.push(p[p.length - 1]);
    p = out;
  }
  return p;
}
/** Arc over a wheel at (wz, wy) of radius r, from the front side to the rear, cut at y = yb. */
function arc(wz, wy, r, yb, n = 12) {
  const out = [];
  const a0 = yb > wy ? Math.asin(Math.min(1, (yb - wy) / r)) : 0;
  if (yb < wy) out.push([wz + r, yb]);
  for (let i = 0; i <= n; i++) { const a = a0 + (Math.PI - 2 * a0) * (i / n); out.push([wz + Math.cos(a) * r, wy + Math.sin(a) * r]); }
  if (yb < wy) out.push([wz - r, yb]);
  return out;
}
function clipAbove(poly, yc) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    if (a[1] >= yc) out.push(a);
    if ((a[1] >= yc) !== (b[1] >= yc)) out.push([a[0] + ((b[0] - a[0]) * (yc - a[1])) / (b[1] - a[1]), yc]);
  }
  return out;
}
/** Furthest-forward (or back) z of a polyline at height y. */
function zAt(poly, y, front) {
  let best = front ? -1e9 : 1e9;
  for (let i = 0; i < poly.length - 1; i++) {
    const [a, b] = [poly[i], poly[i + 1]];
    if (a[1] === b[1] || (a[1] - y) * (b[1] - y) > 0) continue;
    const z = a[0] + ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]);
    best = front ? Math.max(best, z) : Math.min(best, z);
  }
  return best;
}
const tireCache = new Map();
function tireGeo(r, w) {
  const k = `${r}:${w}`;
  if (!tireCache.has(k)) {
    const h = w / 2;
    const pts = [[r * 0.68, -h], [r * 0.92, -h], [r * 0.985, -h + 0.03], [r, -h + 0.07], [r, h - 0.07], [r * 0.985, h - 0.03], [r * 0.92, h], [r * 0.68, h]].map(([a, b]) => new THREE.Vector2(a, b));
    tireCache.set(k, ni(new THREE.LatheGeometry(pts, 22)));
  }
  return tireCache.get(k);
}

const partCache = new Map();
function carParts(body, model, lux, lite) {
  const key = `${body}|${model || ''}|${lux ? 1 : 0}|${lite ? 1 : 0}`;
  if (partCache.has(key)) return partCache.get(key);
  const b = BODIES[body] || BODIES.hatch;
  const st = { ...DEFAULT_STYLE, ...(lux ? { spokes: [10, 0.04] } : {}), ...(STYLES[model] || {}) };
  const { L, W, wheel: R } = b;
  const parts = {};
  const add = (k, g) => (parts[k] ||= []).push(g);
  const both = (fn) => [-1, 1].forEach(fn);
  const bev = 0.07;
  const yb = b.body[0][1];
  const wz = L / 2 - (b.inset || 0.75);
  const AR = R + 0.06 + bev; // arch radius before the bevel grows the outline
  const archR = AR - bev;

  // -- body shell with arches
  const top = chaikin(b.body, b.smooth ?? 2, b.cut ?? 0.24);
  const shell = ext([...top, ...arc(wz, R, AR, yb), ...arc(-wz, R, AR, yb)], W, bev, 3);
  // Curve the slab: tuck the shoulders in, round the corners in plan view, tuck the sills.
  const beltY = b.cabin.find((p) => p[0] === Math.max(...b.cabin.map((q) => q[0])))[1];
  const pos = shell.attributes.position;
  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  const squeeze = (y, z) => 1 - 0.07 * clamp01((y - (beltY - 0.35)) / 0.35) - 0.05 * clamp01((yb + 0.14 - y) / 0.14) - (body === 'boxy' ? 0.03 : 0.1) * clamp01((Math.abs(z) - (L / 2 - 0.6)) / 0.6) ** 2;
  const sideX = (y, z) => (W / 2) * squeeze(y, z);
  for (let i = 0; i < pos.count; i++) pos.setX(i, pos.getX(i) * squeeze(pos.getY(i), pos.getZ(i)));
  add('paint', shell);
  // arch liners (and black flares on off-roaders)
  for (const z of [wz, -wz]) {
    const ring = [...arc(z, R, archR + (st.cladding ? 0.13 : 0.06), yb), ...arc(z, R, archR - 0.01, yb).reverse()];
    add('trim', ext(ring, st.cladding ? W + 0.06 : W - 0.1, 0.02, 1));
  }
  const zF = (y) => zAt(top, y, true) + bev;
  const zR = (y) => zAt(top, y, false) - bev;
  const noseTop = b.body[b.body.length - 2][1];
  const tailTop = b.body[1][1];

  // -- glasshouse
  const cab = b.cabin;
  const maxY = Math.max(...cab.map((p) => p[1]));
  const tops = cab.filter((p) => p[1] >= maxY - 0.1);
  const rt = tops.reduce((a, p) => (p[0] < a[0] ? p : a));
  const ft = tops.reduce((a, p) => (p[0] > a[0] ? p : a));
  const low = cab.filter((p) => !tops.includes(p));
  const pick = (dir) => low.reduce((a, p) => (dir * (p[0] - a[0]) > 1e-6 || (Math.abs(p[0] - a[0]) < 1e-6 && p[1] > a[1]) ? p : a));
  const fb = pick(1);
  const rb = pick(-1);
  const belt = fb[1];
  const Wc = b.wrap ? W + 0.03 : W - 0.26;
  const cabS = chaikin(cab, 1, body === 'boxy' ? 0.05 : 0.12);
  add('glass', ext(cabS, Wc, 0.04, 2));
  if (!b.wrap) add(st.roof === 'black' ? 'black' : 'paint', ext(clipAbove(cabS, maxY - 0.08), Wc + 0.04, 0.03, 2));
  const pm = st.pillars === 'black' ? 'black' : 'paint';
  // A/C pillars: a bar lying along the glass edge, its outer side flush with the edge, stopping under the roof.
  const cx = cab.reduce((a, p) => a + p[0], 0) / cab.length;
  const cy = cab.reduce((a, p) => a + p[1], 0) / cab.length;
  const pillar = (a, c, x, t) => {
    const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
    let n = [-(c[1] - a[1]) / len, (c[0] - a[0]) / len];
    if ((cx - a[0]) * n[0] + (cy - a[1]) * n[1] < 0) n = [-n[0], -n[1]];
    const o = t / 2 - 0.015;
    const e = [a[0] + (c[0] - a[0]) * 0.86, a[1] + (c[1] - a[1]) * 0.86];
    return bar([a[0] + n[0] * o, a[1] + n[1] * o], [e[0] + n[0] * o, e[1] + n[1] * o], x, t, 0.045);
  };
  const zB = fb[0] - (fb[0] - rb[0]) * (b.doors === 2 ? 0.62 : 0.42);
  both((s) => {
    const x = s * (Wc / 2 + 0.012);
    // pillars stop just under the roof edge
    add(pm, pillar(fb, ft, x, 0.1));
    add(pm, pillar(rb, rt, x, b.cp || 0.14));
    add(pm, bar([zB, belt], [zB, maxY - 0.07], x, 0.09, 0.045));
    if (b.d) { const zD = rb[0] + (zB - rb[0]) * 0.36; add(pm, bar([zD, belt], [zD, maxY - 0.07], x, 0.08, 0.045)); }
    if (!lite) add(lux || st.chromeBelt ? 'chrome' : 'trim', bar([rb[0] + 0.04, belt + 0.012], [fb[0] - 0.04, belt + 0.012], s * (Wc / 2 + 0.03), 0.03, 0.03));
  });
  if (b.wrap) {
    // van: the windscreen sits on the sloped nose
    const yAt = (z) => Math.max(...top.slice(0, -1).map((a, i) => { const c = top[i + 1]; return (a[0] - z) * (c[0] - z) <= 0 && a[0] !== c[0] ? a[1] + ((c[1] - a[1]) * (z - a[0])) / (c[0] - a[0]) : -1; }));
    const [p, q] = [[1.45, yAt(1.45)], [2.12, yAt(2.12)]];
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    const n = [-(q[1] - p[1]) / len, (q[0] - p[0]) / len];
    const o = bev + 0.004;
    add('glass', bar([p[0] + n[0] * o, p[1] + n[1] * o], [q[0] + n[0] * o, q[1] + n[1] * o], 0, 0.02, W - 0.36));
  }

  // -- doors, handles, mirrors
  const archTop = (z) => {
    for (const c of [wz, -wz]) if (Math.abs(z - c) < archR) return R + Math.sqrt(archR * archR - (z - c) ** 2);
    return yb + 0.08;
  };
  if (!lite && !b.wrap) {
    const seams = b.doors === 2 ? [fb[0] - 0.05, zB - 0.2] : [fb[0] - 0.05, zB, zB - (fb[0] - zB) * 0.92];
    both((s) => {
      for (const z of seams) {
        const y0 = archTop(z) + 0.03;
        const y1 = belt - 0.02;
        // in short pieces so the line follows the curved side
        for (let k = 0; k < 4 && y1 > y0; k++) {
          const ya = y0 + ((y1 - y0) * k) / 4;
          const yc = ya + (y1 - y0) / 8;
          add('trim', box(0.012, (y1 - y0) / 4 + 0.01, 0.014, s * (sideX(yc, z) + 0.003), yc, z));
        }
      }
      const handles = b.doors === 2 ? [seams[1] + 0.25] : [seams[1] + 0.24, seams[2] + 0.24];
      for (const z of handles) add(lux ? 'chrome' : 'trim', box(0.025, 0.035, 0.15, s * (sideX(belt - 0.11, z) + 0.01), belt - 0.11, z));
    });
  }
  both((s) => {
    const mx = Math.max(sideX(belt, fb[0]), Wc / 2);
    add('trim', box(0.16, 0.04, 0.06, s * (mx + 0.06), belt + 0.06, fb[0] - 0.12));
    add(st.pillars === 'black' ? 'black' : 'paint', box(0.1, 0.13, 0.2, s * (mx + 0.16), belt + 0.1, fb[0] - 0.15));
  });

  // -- front
  const lx = W / 2 - 0.3;
  const yL = st.lights === 'slim' ? noseTop - 0.13 : noseTop - 0.17;
  both((s) => {
    const z = zF(yL);
    if (st.lights === 'round') {
      add('light', cylZ(0.105, 0.06, 18, s * lx, yL, z));
      if (!lite) add('chrome', place(new THREE.TorusGeometry(0.105, 0.016, 6, 18), s * lx, yL, z + 0.03));
    } else if (st.lights === 'slim') {
      add('light', box(0.46, 0.065, 0.06, s * (W / 2 - 0.33), yL, z));
      if (st.drl || lux) add('drl', box(0.46, 0.016, 0.066, s * (W / 2 - 0.33), yL - 0.045, z));
    } else if (st.lights === 'y') {
      add('drl', box(0.36, 0.035, 0.065, s * lx, yL + 0.02, z, 0, 0, s * 0.35));
      add('light', box(0.3, 0.055, 0.06, s * lx, yL - 0.03, z));
    } else if (st.lights === 'rr') {
      add('light', box(0.3, 0.085, 0.06, s * (W / 2 - 0.3), yL + 0.04, z));
      add('drl', box(0.3, 0.018, 0.066, s * (W / 2 - 0.3), yL - 0.02, z));
    } else {
      add('light', box(0.4, 0.11, 0.06, s * lx, yL, z));
    }
  });
  const yG = yL - 0.02;
  const zG = (y) => zF(y);
  switch (st.grille) {
    case 'range':
      add('chrome', box(W * 0.46, 0.17, 0.05, 0, yG + 0.01, zG(yG) - 0.005));
      add('black', box(W * 0.44, 0.14, 0.06, 0, yG + 0.01, zG(yG)));
      break;
    case 'rr': {
      const y = noseTop - 0.26;
      add('chrome', box(0.54, 0.46, 0.06, 0, y, zG(y)));
      add('black', box(0.47, 0.39, 0.065, 0, y, zG(y)));
      for (let i = 0; i < 9; i++) add('chrome', box(0.016, 0.39, 0.07, -0.2 + i * 0.05, y, zG(y)));
      break;
    }
    case 'kidney':
      both((s) => { add('chrome', box(0.24, 0.21, 0.05, s * 0.135, yG, zG(yG) - 0.005)); add('black', box(0.2, 0.17, 0.055, s * 0.135, yG, zG(yG))); });
      break;
    case 'benz':
      add('black', box(W * 0.4, 0.2, 0.05, 0, yG, zG(yG)));
      add('chrome', box(W * 0.4, 0.03, 0.06, 0, yG, zG(yG)));
      add('chrome', cylZ(0.07, 0.04, 16, 0, yG, zG(yG) + 0.02));
      break;
    case 'g':
      add('black', box(W * 0.48, 0.24, 0.05, 0, yG, zG(yG)));
      for (const dy of [-0.06, 0, 0.06]) add('chrome', box(W * 0.48, 0.02, 0.06, 0, yG + dy, zG(yG)));
      break;
    case 'urus':
      add('black', box(W * 0.62, 0.22, 0.05, 0, yb + 0.27, zG(yb + 0.27)));
      break;
    case 'intakes':
      both((s) => add('black', box(0.36, 0.13, 0.05, s * (W / 2 - 0.38), yb + 0.14, zG(yb + 0.14))));
      add('black', box(0.5, 0.08, 0.05, 0, yb + 0.07, zG(yb + 0.07)));
      break;
    default:
      add('trim', box(W * 0.34, 0.15, 0.05, 0, yG, zG(yG)));
      add('chrome', box(W * 0.34, 0.025, 0.06, 0, yG + 0.02, zG(yG)));
  }
  add('trim', box(W - 0.2, 0.07, 0.1, 0, yb + 0.04, zF(yb + 0.04) - 0.03));
  add('plate', box(0.42, 0.11, 0.02, 0, yb + 0.2, zF(yb + 0.2) + 0.005));
  if (st.mascot) add('chrome', box(0.04, 0.09, 0.07, 0, noseTop + bev + 0.04, zF(noseTop - 0.02) - 0.12));
  if (st.fenderLights) both((s) => add('light', box(0.1, 0.07, 0.14, s * (W / 2 - 0.12), noseTop + bev + 0.03, zF(noseTop - 0.05) - 0.14)));

  // -- rear
  const yT = Math.min(tailTop - 0.2, yb + 0.55);
  both((s) => {
    if (st.tail === 'rr') add('tail', box(0.14, 0.3, 0.06, s * (W / 2 - 0.16), yT, zR(yT)));
    else if (st.tail === 'g') add('tail', box(0.12, 0.22, 0.06, s * (W / 2 - 0.12), yT - 0.1, zR(yT - 0.1)));
    else if (st.tail === 'y') add('tail', box(0.38, 0.045, 0.06, s * lx, yT, zR(yT), 0, 0, -s * 0.35));
    else add('tail', box(st.tail === 'bar' ? 0.32 : 0.34, st.tail === 'bar' ? 0.08 : 0.12, 0.06, s * (W / 2 - 0.28), yT, zR(yT)));
  });
  if (st.tail === 'bar') add('tail', box(W - 0.5, 0.035, 0.055, 0, yT + 0.01, zR(yT) + 0.005));
  add('trim', box(W - 0.2, 0.08, 0.1, 0, yb + 0.05, zR(yb + 0.05) + 0.03));
  add('plateY', box(0.42, 0.12, 0.02, 0, yb + 0.2, zR(yb + 0.2) - 0.005));
  if (st.exhaust) for (const x of st.exhaust === 1 ? [0] : [-(W / 2 - 0.4), W / 2 - 0.4]) add('chrome', cylZ(0.045, 0.14, 12, x, yb + 0.06, zR(yb + 0.06) + 0.02));
  if (body === 'sports' && !st.noWing) add('black', box(W * 0.9, 0.05, 0.3, 0, tailTop + 0.18, -L / 2 + 0.2));
  if (body === 'boxy' || st.spare) {
    const y = yb + 0.55;
    const z = zR(y) - 0.12;
    add('tire', place(tireGeo(0.4, 0.22).clone(), 0, y, z, Math.PI / 2, 0, 0));
    add('black', cylZ(0.29, 0.06, 20, 0, y, z - 0.09));
  }

  // -- roof extras
  if (st.rails && !lite) both((s) => {
    const x = s * (Wc / 2 - 0.1);
    add(lux ? 'chrome' : 'trim', bar([rt[0] + 0.15, maxY + 0.075], [ft[0] - 0.2, maxY + 0.075], x, 0.035, 0.05));
    for (const z of [rt[0] + 0.2, ft[0] - 0.25]) add('trim', box(0.05, 0.06, 0.06, x, maxY + 0.05, z));
  });
  if (lux && !b.wrap && st.roof !== 'black') add('glass', box(Wc * 0.5, 0.012, (ft[0] - rt[0]) * 0.42, 0, maxY + 0.036, (ft[0] + rt[0]) / 2 + 0.1));
  if (st.steps) both((s) => add('trim', box(0.2, 0.045, 2 * (wz - archR) - 0.15, s * (W / 2 + 0.06), yb + 0.02, 0)));

  // -- wheels: rounded tyres, multi-spoke rims, brake discs
  const tw = 0.24 + (lux ? 0.03 : 0);
  const [nSp, wSp] = st.spokes;
  for (const [sx, z] of [[-1, wz], [1, wz], [-1, -wz], [1, -wz]]) {
    const x = sx * (W / 2 - tw / 2 - 0.03);
    add('tire', place(tireGeo(R, tw).clone(), x, R, z, 0, 0, Math.PI / 2));
    const xo = x + sx * (tw / 2 - 0.035);
    add('disc', cylX(R * 0.68, tw - 0.03, 18, x, R, z, true));
    add(st.rim, place(new THREE.TorusGeometry(R * 0.665, 0.02, 6, 22), xo, R, z, 0, Math.PI / 2, 0));
    add('chrome', cylX(R * 0.13, 0.05, 12, xo + sx * 0.01, R, z));
    if (lite) { add(st.rim, cylX(R * 0.6, 0.02, 14, xo - sx * 0.01, R, z)); continue; }
    for (let k = 0; k < nSp; k++) {
      const a = (k / nSp) * Math.PI * 2;
      add(st.rim, box(0.035, R * 0.55, wSp, xo, R + Math.cos(a) * R * 0.39, z + Math.sin(a) * R * 0.39, a));
    }
    add('disc', cylX(R * 0.5, 0.025, 18, x + sx * (tw / 2 - 0.12), R, z));
    if (st.caliper) add('caliper', box(0.07, R * 0.3, R * 0.22, x + sx * (tw / 2 - 0.085), R + R * 0.3, z - R * 0.22));
  }

  const merged = Object.fromEntries(Object.entries(parts).map(([k, gs]) => [k, mergeGeometries(gs, false)]));
  partCache.set(key, merged);
  return merged;
}

export function Car({ body = 'hatch', color = '#e5e7eb', lux = false, model, lite = false }) {
  const b = BODIES[body] || BODIES.hatch;
  const parts = carParts(BODIES[body] ? body : 'hatch', model, lux, lite);
  const M = carMats();
  const p = paint(color, lite);
  return (
    <group>
      <mesh geometry={geo('circle', 1, 16)} material={shadowMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} scale={[b.W * 0.62, b.L * 0.58, 1]} />
      {Object.entries(parts).map(([k, g]) => <mesh key={k} geometry={g} material={k === 'paint' ? p : M[k]} />)}
    </group>
  );
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

/** Airliner (Air Tanzania colours), nose towards +z, ~30 m long. `gear` shows wheels. */
export function Plane({ livery = '#0ea5e9', tail = '#facc15', gear = true }) {
  const white = mat('#f8fafc');
  const dark = mat('#1e293b');
  const liv = mat(livery);
  const tl = mat(tail);
  const grey = mat('#94a3b8');
  return (
    <group>
      {/* fuselage */}
      <mesh geometry={geo('cyl', 1.7, 1.7, 24, 18)} material={white} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0]} />
      <mesh geometry={geo('sphere', 1.7, 18, 12)} material={white} position={[0, 0, 12]} scale={[1, 0.95, 1.6]} />
      <mesh geometry={geo('box', 1.6, 0.5, 0.9)} material={dark} position={[0, 0.75, 13.6]} rotation={[0.45, 0, 0]} />
      <mesh geometry={geo('cyl', 0.35, 1.7, 6, 18)} material={white} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.5, -15]} />
      {/* windows + livery stripe */}
      {[-1, 1].map((sd) => (
        <group key={sd}>
          <mesh geometry={geo('box', 0.05, 0.28, 19)} material={dark} position={[sd * 1.68, 0.45, 0.5]} />
          <mesh geometry={geo('box', 0.05, 0.22, 22)} material={liv} position={[sd * 1.69, -0.2, 0]} />
        </group>
      ))}
      {/* wings (swept) + engines */}
      {[-1, 1].map((sd) => (
        <group key={`w${sd}`}>
          <mesh geometry={geo('box', 11, 0.32, 3.4)} material={grey} position={[sd * 6.2, -0.8, 0.2]} rotation={[0, sd * 0.32, sd * 0.06]} />
          <mesh geometry={geo('box', 0.2, 1.1, 1.2)} material={tl} position={[sd * 11.6, -0.2, -1.6]} />
          <mesh geometry={geo('cyl', 0.75, 0.65, 3, 14)} material={white} rotation={[Math.PI / 2, 0, 0]} position={[sd * 4.6, -1.6, 1.8]} />
          <mesh geometry={geo('cyl', 0.6, 0.6, 0.1, 14)} material={dark} rotation={[Math.PI / 2, 0, 0]} position={[sd * 4.6, -1.6, 3.32]} />
          <mesh geometry={geo('box', 4.2, 0.2, 1.6)} material={grey} position={[sd * 2.4, 0.9, -16.4]} rotation={[0, sd * 0.3, 0]} />
        </group>
      ))}
      {/* tail fin with flag-yellow giraffe-ish livery */}
      <mesh geometry={geo('box', 0.3, 5, 3.6)} material={liv} position={[0, 3.2, -16]} rotation={[-0.38, 0, 0]} />
      <mesh geometry={geo('box', 0.34, 1.6, 1.4)} material={tl} position={[0, 3.6, -16.2]} rotation={[-0.38, 0, 0]} />
      {gear && (
        <group>
          {[[0, 9], [-1.6, -1], [1.6, -1]].map(([x, z], i) => (
            <group key={i} position={[x, -1.7, z]}>
              <mesh geometry={geo('box', 0.15, 0.9, 0.15)} material={grey} position={[0, 0.45, 0]} />
              <mesh geometry={geo('cyl', 0.4, 0.4, 0.35, 12)} material={mat('#111827')} rotation={[0, 0, Math.PI / 2]} position={[0, 0, 0]} />
            </group>
          ))}
        </group>
      )}
    </group>
  );
}
