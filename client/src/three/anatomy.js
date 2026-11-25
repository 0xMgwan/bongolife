// Procedural anatomy for the characters: a sculpted head, a shaped torso, muscled limbs,
// hands with fingers, real shoes and hair that follows the skull. Every geometry is built once
// per variant and shared by every character on screen.
import * as THREE from 'three';

const cache = new Map();
const memo = (key, make) => {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
};
const gauss = (x, c, s) => Math.exp(-((x - c) ** 2) / (2 * s * s));
// Cheap deterministic 3D value noise (no textures needed).
function hash(x, y, z) {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}
export function noise3(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const l = (a, b, t) => a + (b - a) * t;
  const c = (dx, dy, dz) => hash(ix + dx, iy + dy, iz + dz);
  return l(
    l(l(c(0, 0, 0), c(1, 0, 0), u), l(c(0, 1, 0), c(1, 1, 0), u), v),
    l(l(c(0, 0, 1), c(1, 0, 1), u), l(c(0, 1, 1), c(1, 1, 1), u), v),
    w,
  );
}

// ------------------------------------------------------------------ head
// Head radii (metres) and the face sculpt, applied to a unit sphere.
export const HEAD = { rx: 0.132, ry: 0.158, rz: 0.142 };
function sculpt(v, woman) {
  let { x, y, z } = v;
  // Jaw narrows below the cheekbones (more for women), skull stays round.
  if (y < 0.05) {
    const t = Math.min(1, (0.05 - y) / 1.05);
    x *= 1 - (woman ? 0.36 : 0.27) * t * t;
    z *= 1 - 0.08 * t * t;
  }
  // Chin and jawline forward.
  if (y < -0.5 && z > 0) z += (woman ? 0.04 : 0.07) * gauss(x, 0, 0.32) * z;
  // The face is flatter than the skull.
  if (z > 0.55) z = 0.55 + (z - 0.55) * 0.55;
  // Cheekbones.
  const cheek = gauss(y, -0.1, 0.15) * gauss(Math.abs(x), 0.6, 0.17) * (z > 0 ? 1 : 0);
  x += Math.sign(x) * cheek * 0.05;
  z += cheek * 0.06;
  // Brow ridge and eye sockets.
  if (z > 0.3) {
    z += gauss(y, 0.33, 0.07) * gauss(x, 0, 0.55) * (woman ? 0.015 : 0.03);
    z -= gauss(y, 0.13, 0.1) * gauss(Math.abs(x), 0.36, 0.13) * 0.05;
  }
  // Fuller back of the skull, slightly flat temples.
  if (z < 0 && y > -0.25) z *= 1.1;
  x *= 1 - gauss(y, 0.35, 0.18) * 0.04;
  v.set(x, y, z);
}
export function headGeo(woman) {
  return memo(`head${woman}`, () => {
    const g = new THREE.SphereGeometry(1, 56, 42);
    const p = g.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      sculpt(v, woman);
      p.setXYZ(i, v.x * HEAD.rx, v.y * HEAD.ry, v.z * HEAD.rz);
    }
    g.computeVertexNormals();
    return g;
  });
}

/**
 * Hair that follows the skull: a sphere cap (`cover` = how far down it reaches, radians from
 * the crown, the front hairline sits higher than the back), pushed out by `lift` and roughened by `fuzz`.
 */
export function scalpGeo(woman, { cover = 1.75, lift = 0.012, fuzz = 0, front = 0.55, seed = 1 } = {}) {
  return memo(`scalp${woman}${cover}${lift}${fuzz}${front}${seed}`, () => {
    const g = new THREE.SphereGeometry(1, 48, 32, 0, Math.PI * 2, 0, cover);
    const p = g.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      // Tilt so the hairline is high at the forehead and low at the nape.
      const tilt = -0.38;
      const y = v.y * Math.cos(tilt) - v.z * Math.sin(tilt);
      const z = v.y * Math.sin(tilt) + v.z * Math.cos(tilt);
      v.set(v.x, y, z);
      // Raise the hairline at the very front so the forehead shows.
      if (v.z > 0.5 && v.y < front) v.y = front - (front - v.y) * 0.35;
      sculpt(v, woman);
      const n = fuzz ? (noise3(v.x * 9 + seed, v.y * 9, v.z * 9) - 0.5) * fuzz : 0;
      const k = 1 + lift / 0.14 + n;
      p.setXYZ(i, v.x * HEAD.rx * k, v.y * HEAD.ry * k, v.z * HEAD.rz * k);
    }
    g.computeVertexNormals();
    return g;
  });
}

/** A fluffy ball (afro, bun): a sphere with soft noise bumps. */
export function puffGeo(key, fuzz = 0.08, freq = 5) {
  return memo(`puff${key}${fuzz}${freq}`, () => {
    const g = new THREE.SphereGeometry(1, 40, 30);
    const p = g.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const n = noise3(v.x * freq + 3, v.y * freq, v.z * freq) * 0.7 + noise3(v.x * freq * 3, v.y * freq * 3, v.z * freq * 3) * 0.3;
      v.multiplyScalar(1 + (n - 0.5) * fuzz * 2);
      p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    return g;
  });
}

/** A tube along points (braids, locs, ponytails, eyebrows). */
export function tubeGeo(key, pts, radius, { taper = 0, seg = 16, radial = 6 } = {}) {
  return memo(`tube${key}`, () => {
    const curve = new THREE.CatmullRomCurve3(pts.map((q) => new THREE.Vector3(...q)));
    const g = new THREE.TubeGeometry(curve, seg, radius, radial, false);
    if (taper) {
      // Thin towards the end: scale each ring around the curve.
      const p = g.attributes.position;
      const v = new THREE.Vector3();
      for (let i = 0; i < p.count; i++) {
        const ring = Math.floor(i / (radial + 1));
        const t = ring / seg;
        const c = curve.getPointAt(Math.min(1, t));
        v.fromBufferAttribute(p, i).sub(c).multiplyScalar(1 - taper * t).add(c);
        p.setXYZ(i, v.x, v.y, v.z);
      }
      g.computeVertexNormals();
    }
    return g;
  });
}

// ------------------------------------------------------------------ body
/** Revolve a radius profile [[radius, y], …] (y ascending) around the Y axis. */
function lathe(profile, seg = 20) {
  return new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.0005), y)), seg);
}

export const BUILD = {
  slim: { w: 0.9, limb: 0.88, belly: 0 },
  avg: { w: 1, limb: 1, belly: 0.01 },
  big: { w: 1.14, limb: 1.12, belly: 0.05 },
};

/** Torso from hips (y=0) to the base of the neck (~0.63): shoulders, chest/bust, waist, belly, back. */
export function torsoGeo(woman, build = 'avg') {
  return memo(`torso${woman}${build}`, () => {
    const b = BUILD[build] || BUILD.avg;
    const prof = woman
      ? [[0.001, -0.005], [0.15, 0], [0.172, 0.04], [0.162, 0.12], [0.138, 0.21], [0.142, 0.3], [0.158, 0.38], [0.165, 0.45], [0.168, 0.5], [0.15, 0.555], [0.1, 0.6], [0.05, 0.622], [0.001, 0.628]]
      : [[0.001, -0.005], [0.155, 0], [0.165, 0.05], [0.158, 0.14], [0.155, 0.22], [0.172, 0.31], [0.195, 0.39], [0.21, 0.46], [0.205, 0.52], [0.16, 0.575], [0.1, 0.61], [0.05, 0.628], [0.001, 0.633]];
    const g = lathe(prof, 32);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const front = z > 0 ? 1 : 0;
      // Wider at the shoulders than deep; the chest is deeper than the waist.
      const shoulderW = woman ? 1.05 + gauss(y, 0.5, 0.07) * 0.18 : 1.08 + gauss(y, 0.5, 0.08) * 0.3;
      x *= shoulderW * b.w;
      z *= (woman ? 0.66 : 0.62) + gauss(y, 0.4, 0.1) * 0.08;
      // Bust / pecs, belly, shoulder blades.
      if (woman) z += front * gauss(y, 0.4, 0.055) * gauss(Math.abs(x), 0.068, 0.045) * 0.075;
      else z += front * gauss(y, 0.42, 0.06) * gauss(Math.abs(x), 0.08, 0.06) * 0.025;
      z += front * gauss(y, 0.16, 0.07) * gauss(x, 0, 0.09) * b.belly;
      z -= (1 - front) * gauss(y, 0.44, 0.07) * gauss(Math.abs(x), 0.07, 0.05) * -0.012;
      // Seat at the back of the hips.
      z -= (1 - front) * gauss(y, 0.02, 0.06) * (woman ? 0.03 : 0.015);
      p.setXYZ(i, x, y, z);
    }
    g.computeVertexNormals();
    return g;
  });
}

/** Limb segment hanging down from its joint (y=0 → -len). `back` pushes the calf/bicep bulge. */
function limb(key, profile, { back = 0, backY = 0, front = 0, frontY = 0 } = {}) {
  return memo(key, () => {
    const g = lathe(profile.slice().sort((a, b) => a[1] - b[1]), 18);
    if (back || front) {
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const y = p.getY(i);
        let z = p.getZ(i);
        if (z < 0) z -= gauss(y, backY, 0.06) * back;
        else z += gauss(y, frontY, 0.05) * front;
        p.setZ(i, z);
      }
      g.computeVertexNormals();
    }
    return g;
  });
}
export const LIMB = { upperArm: 0.3, foreArm: 0.26, thigh: 0.43, shin: 0.43 };
export function upperArmGeo(woman, build = 'avg') {
  const k = (woman ? 0.86 : 1) * (BUILD[build] || BUILD.avg).limb;
  return limb(`ua${woman}${build}`, [[0.001, 0.035], [0.05 * k, 0.02], [0.064 * k, -0.02], [0.062 * k, -0.08], [0.057 * k, -0.15], [0.05 * k, -0.24], [0.045 * k, -0.3], [0.001, -0.32]], { front: woman ? 0 : 0.008 * k, frontY: -0.12 });
}
export function foreArmGeo(woman, build = 'avg') {
  const k = (woman ? 0.86 : 1) * (BUILD[build] || BUILD.avg).limb;
  return limb(`fa${woman}${build}`, [[0.001, 0.02], [0.044 * k, 0.005], [0.048 * k, -0.05], [0.042 * k, -0.13], [0.033 * k, -0.22], [0.029 * k, -0.26], [0.001, -0.275]]);
}
export function thighGeo(woman, build = 'avg') {
  const k = (BUILD[build] || BUILD.avg).limb;
  return limb(`th${woman}${build}`, [[0.001, 0.04], [(woman ? 0.098 : 0.092) * k, 0.02], [(woman ? 0.1 : 0.094) * k, -0.05], [(woman ? 0.088 : 0.084) * k, -0.18], [0.072 * k, -0.33], [0.062 * k, -0.43], [0.001, -0.45]], { front: 0.012 * k, frontY: -0.18 });
}
export function shinGeo(woman, build = 'avg') {
  const k = (BUILD[build] || BUILD.avg).limb;
  return limb(`sh${woman}${build}`, [[0.001, 0.02], [0.06 * k, 0.005], [0.064 * k, -0.08], [0.058 * k, -0.17], [0.045 * k, -0.3], [0.037 * k, -0.4], [0.036 * k, -0.43], [0.001, -0.445]], { back: 0.022 * k, backY: -0.12 });
}
export function neckGeo(woman) {
  return memo(`neck${woman}`, () => lathe(woman
    ? [[0.001, -0.06], [0.06, -0.055], [0.048, 0], [0.044, 0.06], [0.046, 0.1], [0.001, 0.11]]
    : [[0.001, -0.06], [0.075, -0.055], [0.058, 0], [0.054, 0.06], [0.055, 0.1], [0.001, 0.11]], 18));
}

/** Shoe hanging from the ankle: toe forward (+z), flat sole, toe spring. */
export function shoeGeo(kind) {
  return memo(`shoe${kind}`, () => {
    const g = new THREE.SphereGeometry(1, 24, 16);
    const p = g.attributes.position;
    const heel = kind === 'heel';
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      if (y < -0.35) y = -0.35 + (y + 0.35) * 0.15; // flat sole
      x *= 0.95 - Math.max(0, -z) * 0.12; // narrower heel
      y += Math.max(0, z - 0.4) * 0.12; // toe spring
      if (heel) y += Math.max(0, -z) * 0.35;
      p.setXYZ(i, x * 0.05, y * 0.05 + 0.005, z * 0.125 + 0.045);
    }
    g.computeVertexNormals();
    return g;
  });
}
export function soleGeo(kind) {
  return memo(`sole${kind}`, () => {
    const g = new THREE.CapsuleGeometry(0.048, 0.16, 4, 12);
    g.rotateX(Math.PI / 2);
    g.scale(1.06, 0.22, 1);
    g.translate(0, -0.012, 0.045);
    return g;
  });
}

/** Ear: a flattened shell with an inner fold. */
export function earGeo() {
  return memo('ear', () => {
    const g = new THREE.SphereGeometry(1, 16, 12);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const dish = x > 0 ? -gauss(y, 0.05, 0.4) * gauss(z, 0, 0.4) * 0.6 : 0;
      p.setXYZ(i, (x * 0.35 + dish) * 0.03, y * 0.04 * (1 - Math.max(0, -y) * 0.25), z * 0.026);
    }
    g.computeVertexNormals();
    return g;
  });
}

/** Lips: a soft bow-shaped upper lip and fuller lower lip. */
export function lipGeo(upper, woman) {
  return memo(`lip${upper}${woman}`, () => {
    const g = new THREE.SphereGeometry(1, 24, 12);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      if (upper) y += gauss(x, 0, 0.25) * 0.25 * (y > 0 ? -1 : 0) + Math.abs(x) * -0.25; // cupid's bow, corners down
      else y += Math.abs(x) * 0.3;
      const w = woman ? 0.026 : 0.028;
      p.setXYZ(i, x * w, y * (upper ? 0.0075 : 0.0095) * (woman ? 1.15 : 1), z * 0.011);
    }
    g.computeVertexNormals();
    return g;
  });
}

/** Nose: bridge, rounded tip and nostril wings in one smooth piece. */
export function noseGeo(woman) {
  return memo(`nose${woman}`, () => {
    const g = new THREE.SphereGeometry(1, 28, 20);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const t = (y + 1) / 2; // 0 bottom → 1 top
      // narrow bridge at the top, broad rounded base with nostril wings
      const width = 0.38 + (1 - t) * 0.42 + gauss(y, -0.55, 0.22) * (woman ? 0.35 : 0.5);
      x *= width;
      // projects most at the tip (lower third), lies flat at the bridge
      z = z * (0.28 + gauss(y, -0.4, 0.32) * 0.5) + gauss(y, -0.45, 0.35) * 0.18;
      if (y < -0.7) y = -0.7 + (y + 0.7) * 0.35;
      p.setXYZ(i, x * 0.027, y * 0.03, z * 0.028);
    }
    g.computeVertexNormals();
    return g;
  });
}
