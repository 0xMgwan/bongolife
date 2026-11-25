import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SKIN_TONES, HAIR_COLORS, outfitById } from '@shared/world.js';
import { mat, geo, fabricTexture } from './textures.js';
import {
  HEAD, LIMB, BUILD, headGeo, scalpGeo, puffGeo, tubeGeo, torsoGeo, upperArmGeo, foreArmGeo, thighGeo, shinGeo,
  neckGeo, shoeGeo, soleGeo, earGeo, lipGeo, noseGeo,
} from './anatomy.js';

// ------------------------------------------------------------------ materials
export const shadowMat = new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.18, depthWrite: false });
const cache = new Map();
const once = (key, make) => {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
};

function canvasTex(size, draw, repeat = 1) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 4;
  return t;
}
// Woven cloth: fine light/dark threads, tinted by the material colour.
const weaveTex = () => once('weave', () => canvasTex(128, (g, s) => {
  g.fillStyle = '#ececec'; g.fillRect(0, 0, s, s);
  for (let i = 0; i < s; i += 2) {
    g.fillStyle = `rgba(255,255,255,${0.25 + Math.random() * 0.2})`; g.fillRect(0, i, s, 1);
    g.fillStyle = `rgba(0,0,0,${0.05 + Math.random() * 0.06})`; g.fillRect(i, 0, 1, s);
  }
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.08})`; g.fillRect(Math.random() * s, Math.random() * s, 2, 1); }
}, 6));
// Coily hair: dense tiny curls.
const coilTex = () => once('coil', () => canvasTex(128, (g, s) => {
  g.fillStyle = '#c4c4c4'; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 2600; i++) {
    const l = Math.random();
    g.strokeStyle = l > 0.5 ? `rgba(255,255,255,${l * 0.35})` : `rgba(0,0,0,${(1 - l) * 0.35})`;
    g.beginPath(); g.arc(Math.random() * s, Math.random() * s, 1 + Math.random() * 1.6, 0, Math.PI * 2 * Math.random()); g.stroke();
  }
}, 3));
// Cornrows: raised rows running front to back.
const rowTex = () => once('rows', () => canvasTex(128, (g, s) => {
  for (let x = 0; x < s; x++) {
    const v = 0.5 + 0.5 * Math.cos((x / s) * Math.PI * 2 * 8);
    const c = Math.round(90 + v * 140);
    g.fillStyle = `rgb(${c},${c},${c})`; g.fillRect(x, 0, 1, s);
  }
}, 1));

/** Skin: soft Phong plus a warm wrap-around glow at the edges (cheap subsurface look). */
function skinMat(color) {
  return once(`skin${color}`, () => {
    const m = new THREE.MeshPhongMaterial({ color, shininess: 26, specular: new THREE.Color('#3a2a22') });
    m.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', `
        {
          float rim = 1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
          outgoingLight += diffuseColor.rgb * vec3(0.95, 0.5, 0.36) * pow(rim, 2.4) * 0.55;
          outgoingLight *= vec3(1.03, 0.99, 0.97);
        }
        #include <opaque_fragment>`);
    };
    m.customProgramCacheKey = () => 'bl-skin';
    return m;
  });
}
const lipMat = (skin) => once(`lip${skin}`, () => new THREE.MeshPhongMaterial({ color: new THREE.Color(skin).lerp(new THREE.Color('#3d1616'), 0.38), shininess: 55, specular: new THREE.Color('#4a3030') }));
const hairMat = (color, tex) => once(`hair${color}${tex}`, () => new THREE.MeshPhongMaterial({
  color: new THREE.Color(color).lerp(new THREE.Color('#5a4a3e'), 0.16), map: tex === 'rows' ? rowTex() : coilTex(), shininess: tex === 'rows' ? 22 : 10, specular: new THREE.Color('#2a2a2a'),
}));
function fabricMat(pattern, color) {
  if (pattern === 'plain') return once(`cloth${color}`, () => new THREE.MeshPhongMaterial({ color, map: weaveTex(), shininess: 5, specular: new THREE.Color('#151515') }));
  return once(`cloth${pattern}${color}`, () => new THREE.MeshPhongMaterial({ map: fabricTexture(pattern, color), shininess: 5, specular: new THREE.Color('#151515') }));
}
const sclera = new THREE.MeshPhongMaterial({ color: '#f1ece4', shininess: 90 });
const iris = new THREE.MeshPhongMaterial({ color: '#5a3418', shininess: 120, specular: new THREE.Color('#666') });
const pupil = new THREE.MeshBasicMaterial({ color: '#050505' });
const glint = new THREE.MeshBasicMaterial({ color: '#ffffff' });
const mouthLine = new THREE.MeshBasicMaterial({ color: '#2a1210' });
const SOLE = mat('#e7e5e4');
const SOLE_DARK = mat('#57534e');
const SNEAKER = new THREE.MeshPhongMaterial({ color: '#f8fafc', shininess: 30 });
const LEATHER = new THREE.MeshPhongMaterial({ color: '#3b2416', shininess: 70, specular: new THREE.Color('#7a5a40') });
const BELT = new THREE.MeshPhongMaterial({ color: '#1c1917', shininess: 60 });
const BUCKLE = new THREE.MeshPhongMaterial({ color: '#d4b26a', shininess: 120, specular: new THREE.Color('#fff') });
const WHITE = mat('#f8fafc');
// Parts only drawn up close (face, fingers, most braid strands, laces, buttons).
const FINE = { fine: true };
const NEAR = 24;

// Where the face surface is at (x, y), so features sit on the sculpted head.
const faceZCache = new Map();
function faceZ(woman, x, y) {
  const key = `${woman}${x}${y}`;
  if (faceZCache.has(key)) return faceZCache.get(key);
  const p = headGeo(woman).attributes.position;
  let best = Infinity, z = HEAD.rz;
  for (let i = 0; i < p.count; i++) {
    const vz = p.getZ(i);
    if (vz <= 0) continue;
    const d = (p.getX(i) - x) ** 2 + (p.getY(i) - y) ** 2;
    if (d < best) { best = d; z = vz; }
  }
  faceZCache.set(key, z);
  return z;
}

// ------------------------------------------------------------------ hair
function braidPts(i, n, len, spread, curl) {
  const a = -Math.PI * 0.62 + (i / (n - 1)) * Math.PI * 1.24; // 0 = straight back
  const r = 0.128;
  const x = Math.sin(a) * r, z = -Math.cos(a) * r;
  return [[x, 0.03, z], [x * 1.08, -0.04, z * 1.08 - 0.01], [x * (1.1 + spread), -len * 0.55, z * 1.12 - 0.03], [x * (1.12 + spread) + Math.sin(i * 1.7) * curl, -len, z * 1.15 - 0.05]];
}
function Hair({ style, color, woman, fabric }) {
  const coil = hairMat(color, 'coil');
  switch (style) {
    case 'afro':
      return (
        <group>
          <mesh geometry={scalpGeo(woman, { cover: 1.8, lift: 0.006 })} material={coil} />
          <mesh geometry={puffGeo('afro', 0.07, 4)} material={coil} position={[0, 0.088, -0.078]} scale={[0.192, 0.172, 0.172]} />
        </group>
      );
    case 'kibanio':
      return (
        <group>
          <mesh geometry={scalpGeo(woman, { cover: 1.9, lift: 0.006 })} material={hairMat(color, 'rows')} />
          <mesh geometry={puffGeo('bun', 0.05, 5)} material={coil} position={[0, 0.15, -0.095]} scale={0.072} />
        </group>
      );
    case 'mkia':
      return (
        <group>
          <mesh geometry={scalpGeo(woman, { cover: 1.9, lift: 0.006 })} material={hairMat(color, 'rows')} />
          <mesh geometry={puffGeo('tie', 0.03, 6)} material={coil} position={[0, 0.06, -0.15]} scale={0.03} />
          <mesh geometry={tubeGeo('pony', [[0, 0.06, -0.155], [0, 0.02, -0.2], [0, -0.1, -0.21], [0.01, -0.24, -0.19]], 0.032, { taper: 0.7 })} material={coil} />
        </group>
      );
    case 'misuko':
    case 'rasta': {
      const rasta = style === 'rasta';
      const n = rasta ? 15 : 19;
      const len = rasta ? 0.42 : 0.36;
      return (
        <group>
          <mesh geometry={scalpGeo(woman, { cover: 1.95, lift: 0.007 })} material={hairMat(color, rasta ? 'coil' : 'rows')} />
          {Array.from({ length: n }, (_, i) => (
            <mesh key={i} userData={i % 3 ? FINE : undefined} geometry={tubeGeo(`${style}${i}`, braidPts(i, n, len, rasta ? 0.15 : 0.05, rasta ? 0.03 : 0.01), rasta ? 0.017 : 0.011, { taper: rasta ? 0.2 : 0.35, radial: 5, seg: 10 })} material={coil} />
          ))}
        </group>
      );
    }
    case 'kiduku':
      // Short fade: a full top with a soft, see-through edge at the hairline and sides.
      return (
        <group>
          <mesh geometry={paintGeo('short', woman, shortHairDensity, 0.006)} material={paintMat(color, 1)} renderOrder={2} />
        </group>
      );
    case 'kilemba':
      return (
        <group>
          <mesh geometry={puffGeo('wrap', 0.05, 3)} material={fabric} position={[0, 0.07, -0.025]} scale={[0.158, 0.15, 0.17]} />
          <mesh geometry={puffGeo('knot', 0.12, 4)} material={fabric} position={[0.03, 0.2, 0.04]} scale={[0.07, 0.055, 0.06]} />
        </group>
      );
    case 'kofia':
      return (
        <group>
          <mesh geometry={scalpGeo(woman, { cover: 1.5, lift: 0.016, front: 0.9 })} material={mat('#1d4ed8')} />
          <mesh geometry={geo('cyl', 0.1, 0.1, 0.008, 20, 1, false, 0, Math.PI)} material={mat('#1e40af')} position={[0, 0.07, 0.115]} rotation={[0.12, -Math.PI / 2, 0]} scale={[1, 1, 0.9]} />
        </group>
      );
    default:
      return null; // kipara (bald)
  }
}

function Beard({ style, color, woman }) {
  if (!style || style === 'none' || woman) return null;
  const stubble = style === 'stubble';
  if (style === 'goatee') return <mesh geometry={paintGeo('goatee', false, beardDensity('goatee'), 0.007)} material={paintMat(color, 0.95)} renderOrder={2} />;
  return (
    <group>
      <mesh geometry={paintGeo(stubble ? 'stubble' : 'beard', false, beardDensity('full'), stubble ? 0 : 0.006)} material={paintMat(color, stubble ? 0.45 : 0.95)} renderOrder={2} />
      {!stubble && <mesh geometry={paintGeo('tache', false, beardDensity('goatee'), 0.003)} material={paintMat(color, 0.9)} renderOrder={2} />}
    </group>
  );
}
// A soft layer painted over the head: per-vertex opacity from `density(x, y, z)` (0..1), lifted
// off the skin in proportion, so beards and short hair fade out at their edges instead of ending in a hard line.
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function paintGeo(key, woman, density, lift) {
  return once(`paint${key}${woman}`, () => {
    const g = headGeo(woman).clone();
    const p = g.attributes.position, n = g.attributes.normal;
    const col = new Float32Array(p.count * 4);
    const keep = new Uint8Array(p.count);
    for (let i = 0; i < p.count; i++) {
      const d = density(p.getX(i), p.getY(i), p.getZ(i));
      keep[i] = d > 0.01 ? 1 : 0;
      const l = 0.0003 + d * lift;
      p.setXYZ(i, p.getX(i) + n.getX(i) * l, p.getY(i) + n.getY(i) * l, p.getZ(i) + n.getZ(i) * l);
      col.set([1, 1, 1, d], i * 4);
    }
    const idx = g.index.array, tri = [];
    for (let t = 0; t < idx.length; t += 3) if (keep[idx[t]] || keep[idx[t + 1]] || keep[idx[t + 2]]) tri.push(idx[t], idx[t + 1], idx[t + 2]);
    g.setIndex(tri);
    g.setAttribute('color', new THREE.BufferAttribute(col, 4));
    return g;
  });
}
const paintMat = (color, max) => once(`paintm${color}${max}`, () => new THREE.MeshPhongMaterial({
  color: new THREE.Color(color).lerp(new THREE.Color('#3a2c24'), 0.12), map: coilTex(), vertexColors: true, transparent: true, opacity: max, depthWrite: false, shininess: 6,
}));
// Beard coverage: jaw, chin and cheeks; goatee: chin and around the mouth. Lips stay clear.
const beardDensity = (style) => (x, y, z) => {
  if (z < -0.01) return 0;
  const lips = Math.max(0, 1 - Math.hypot(x / 0.03, (y + 0.077) / 0.016));
  if (style === 'goatee') {
    const chin = smooth(0.05, 0.02, Math.hypot(x, (y + 0.125) * 0.9)) * smooth(0.04, 0.09, z);
    const tache = smooth(0.012, 0.004, Math.abs(y + 0.06)) * smooth(0.034, 0.02, Math.abs(x)) * smooth(0.06, 0.1, z);
    return Math.max(chin, tache) * (1 - lips);
  }
  const jaw = smooth(-0.045, -0.085, y + Math.max(0, z - 0.09) * 0.25);
  const back = smooth(0.01, 0.05, z);
  return jaw * back * (1 - lips * 1.2 > 0 ? 1 - lips : 0);
};
// Short hair (kiduku): hairline high at the forehead, above the ears at the sides, low at the nape.
const shortHairDensity = (x, y, z) => {
  const zn = z / HEAD.rz;
  const edge = zn > 0 ? 0.002 + 0.11 * zn ** 1.2 : 0.002 - 0.09 * Math.min(1, -zn);
  const ear = Math.hypot(Math.abs(x) - 0.125, y - 0.0, z + 0.008) < 0.04 ? 0 : 1;
  return smooth(edge - 0.008, edge + 0.014, y) * ear;
};
// ------------------------------------------------------------------ parts
function Hand({ s, skin }) {
  return (
    <group position={[0, LIMB.foreArm * -1 - 0.035, 0.004]}>
      <mesh geometry={geo('sphere', 1, 14, 10)} material={skin} scale={[0.026, 0.042, 0.016]} />
      {[-1.5, -0.5, 0.5, 1.5].map((f) => (
        <mesh key={f} userData={FINE} geometry={geo('capsule', 0.0075, 0.035 - Math.abs(f) * 0.004, 3, 6)} material={skin} position={[f * 0.0115, -0.058, 0.004]} rotation={[0.25, 0, 0]} />
      ))}
      <mesh userData={FINE} geometry={geo('capsule', 0.0085, 0.03, 3, 6)} material={skin} position={[-s * 0.026, -0.022, 0.014]} rotation={[0.5, 0, -s * 0.6]} />
    </group>
  );
}

function Eye({ s, woman, lid, skin }) {
  const x = s * 0.046, y = 0.021;
  const z = faceZ(woman, x, y) + 0.003;
  return (
    <group position={[x, y, z]}>
      <group ref={lid} scale={[1.05, 0.9, 0.7]}>
        <mesh geometry={geo('sphere', 0.017, 16, 12)} material={sclera} />
        <mesh geometry={geo('sphere', 0.0074, 14, 10)} material={iris} position={[0, -0.0008, 0.0155]} scale={[1, 1.05, 0.4]} />
        <mesh geometry={geo('sphere', 0.0036, 10, 8)} material={pupil} position={[0, -0.0008, 0.0172]} scale={[1, 1.1, 0.3]} />
        <mesh geometry={geo('sphere', 0.0016, 6, 6)} material={glint} position={[s * 0.0025, 0.0028, 0.0178]} />
        {/* upper and lower lids give the almond shape; the whole eye squashes to blink */}
        <mesh geometry={geo('sphere', 0.0182, 16, 8, 0, Math.PI * 2, 0, 1.0)} material={skin} rotation={[0.35, 0, 0]} />
        <mesh geometry={geo('torus', 0.0128, woman ? 0.0016 : 0.0011, 4, 18, Math.PI)} material={pupil} position={[0, 0.0098, 0.0118]} rotation={[-0.55, 0, 0]} scale={[1.2, 0.55, 1]} />
        <mesh geometry={geo('sphere', 0.018, 16, 6, 0, Math.PI * 2, 2.45, Math.PI - 2.45)} material={skin} rotation={[-0.2, 0, 0]} />
      </group>
    </group>
  );
}

// ------------------------------------------------------------------ the character
/**
 * Mbongo character. `motion` is a ref: { moving, mode, speed }.
 * Modes: idle walk run dance cheer sit eat sleep swim lift sing dj type knocked jump highfive hug pose box.
 */
export function Avatar({ appearance, motion, scale = 1 }) {
  const a = appearance || { body: 'man', skin: 2, hair: 'kiduku', hairColor: 0, outfit: 'tshirt' };
  const outfit = outfitById[a.outfit] || outfitById.tshirt;
  const woman = a.body === 'woman';
  const build = BUILD[a.build] ? a.build : 'avg';
  const bw = BUILD[build].w;
  const skinColor = SKIN_TONES[a.skin] || SKIN_TONES[2];
  const skin = skinMat(skinColor);
  const hairColor = HAIR_COLORS[a.hairColor] || HAIR_COLORS[0];
  const topMat = fabricMat(outfit.pattern || 'plain', outfit.top);
  const bottomMat = fabricMat(outfit.bottomPattern || 'plain', outfit.bottom);
  const bt = outfit.bottomType || 'pants';
  const robe = bt === 'robe';
  const longSkirt = bt === 'maxi' || bt === 'wrap';
  const bareLegs = bt !== 'pants';
  const sleeves = outfit.sleeves || 'short';
  const hijab = outfit.head === 'hijab';
  const kofia = outfit.head === 'kofia' && a.hair !== 'kilemba';
  const sw = (woman ? 0.36 : 0.44) * bw; // shoulder joint spacing
  const HIP = 0.98;
  const brow = useMemo(() => hairMat(hairColor, 'coil'), [hairColor]);

  const legL = useRef(), legR = useRef(), kneeL = useRef(), kneeR = useRef();
  const armL = useRef(), armR = useRef(), elbowL = useRef(), elbowR = useRef();
  const body = useRef(), pelvis = useRef(), chest = useRef(), head = useRef();
  const fine = useRef(null);
  const lookKey = JSON.stringify(a);
  useMemo(() => { fine.current = null; }, [lookKey]); // re-collect the fine parts when the look changes
  const lidL = useRef(), lidR = useRef();
  const phase = useRef(Math.random() * 6);
  const life = useRef(Math.random() * 100);
  const blink = useRef(2 + Math.random() * 3);
  const lodTick = useRef(Math.floor(Math.random() * 20));
  const tmp = useMemo(() => new THREE.Vector3(), []);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.1); // no jumps after the tab was in the background
    const mo = motion?.current || {};
    const mode = mo.mode || (mo.moving ? 'walk' : 'idle');
    const rate = { type: 6, walk: 9 * (mo.speed || 1), run: 15 * (mo.speed || 1), jump: 1, highfive: 5, hug: 3, pose: 2, box: 9, dance: 7, cheer: 6, swim: 5, lift: 3, sing: 4, dj: 7, eat: 2.5 }[mode] || 2;
    phase.current += dt * rate;
    life.current += dt;
    const p = phase.current;
    const t = life.current;
    let legL_ = 0, legR_ = 0, armL_ = 0, armR_ = 0, zL = 0.08, zR = -0.08, bob = 0, tilt = 0, yaw = null;
    let kL = 0, kR = 0, eL = 0.12, eR = 0.12, nod = 0;
    switch (mode) {
      case 'walk':
        legL_ = Math.sin(p) * 0.55; legR_ = -legL_;
        // knees bend while the leg swings forward
        kL = Math.max(0, Math.sin(p + 1.4)) * 0.75; kR = Math.max(0, Math.sin(p + 1.4 + Math.PI)) * 0.75;
        armL_ = -Math.sin(p) * 0.45; armR_ = -armL_;
        eL = 0.25 + Math.max(0, Math.sin(p)) * 0.3; eR = 0.25 + Math.max(0, -Math.sin(p)) * 0.3;
        bob = Math.abs(Math.cos(p)) * 0.035;
        nod = Math.sin(p * 2) * 0.03;
        break;
      case 'run':
        // Longer stride, knees high, arms pumping, leaning into it.
        legL_ = Math.sin(p) * 0.95; legR_ = -legL_;
        kL = Math.max(0, Math.sin(p + 1.3)) * 1.35; kR = Math.max(0, Math.sin(p + 1.3 + Math.PI)) * 1.35;
        armL_ = -Math.sin(p) * 0.95; armR_ = -armL_;
        eL = 1.1 + Math.max(0, Math.sin(p)) * 0.35; eR = 1.1 + Math.max(0, -Math.sin(p)) * 0.35;
        bob = Math.abs(Math.cos(p)) * 0.09;
        tilt = 0.18;
        nod = Math.sin(p * 2) * 0.04;
        break;
      case 'highfive': {
        // Right hand swings up and slaps forward, twice.
        const up = Math.sin(p) * 0.5 + 0.5;
        armR_ = -2.2 - up * 0.6; eR = 0.2 + (1 - up) * 0.5; zR = -0.15;
        armL_ = -0.2; bob = up * 0.03; nod = up * 0.05;
        break;
      }
      case 'hug':
        // Arms forward and wrapped, gentle sway.
        armL_ = armR_ = -1.35; eL = eR = 1.2; zL = 0.35; zR = -0.35;
        tilt = 0.08; yaw = Math.sin(p) * 0.12;
        break;
      case 'pose':
        // Selfie: one arm out holding the phone, the other a peace sign.
        armR_ = -1.9; eR = 0.15; zR = -0.25;
        armL_ = -2.6; eL = 1.4; zL = 0.3;
        nod = -0.08;
        break;
      case 'box': {
        // Play-boxing: guard up, alternating jabs, light bounce on the feet.
        const jabL = Math.max(0, Math.sin(p));
        const jabR = Math.max(0, Math.sin(p + Math.PI));
        armL_ = -1.3 - jabL * 0.35; eL = 1.6 - jabL * 1.3;
        armR_ = -1.3 - jabR * 0.35; eR = 1.6 - jabR * 1.3;
        zL = 0.2; zR = -0.2;
        legL_ = 0.25; legR_ = -0.2; kL = kR = 0.35;
        bob = Math.abs(Math.sin(p * 0.5)) * 0.06;
        tilt = 0.12;
        break;
      }
      case 'jump':
        // Tucked legs, arms thrown up.
        legL_ = legR_ = -0.55; kL = kR = 1.1;
        armL_ = armR_ = -2.5; eL = eR = 0.3;
        zL = 0.3; zR = -0.3;
        break;
      case 'dance':
        armL_ = -(2.0 + Math.sin(p * 2) * 0.3) + Math.sin(p) * 0.4; armR_ = -(1.8 + Math.sin(p * 2) * 0.3) - Math.sin(p) * 0.4;
        eL = 0.6 + Math.sin(p * 2) * 0.4; eR = 0.6 - Math.sin(p * 2) * 0.4;
        zL = 0.35; zR = -0.35;
        bob = Math.abs(Math.sin(p)) * 0.1 - 0.04;
        kL = 0.3 + Math.abs(Math.sin(p)) * 0.3; kR = 0.3 + Math.abs(Math.cos(p)) * 0.3;
        legL_ = -kL * 0.5 + Math.sin(p) * 0.15; legR_ = -kR * 0.5 - Math.sin(p) * 0.15;
        yaw = Math.sin(p * 0.5) * 0.5;
        nod = Math.sin(p * 2) * 0.12;
        break;
      case 'cheer': {
        const up = Math.sin(p * 0.35) > 0.55;
        legL_ = legR_ = -1.5; kL = kR = 1.5;
        armL_ = up ? -2.8 + Math.sin(p * 3) * 0.25 : -0.7; armR_ = up ? -2.8 - Math.sin(p * 3) * 0.25 : -0.7;
        eL = eR = up ? 0.2 : 1.1;
        zL = up ? 0.25 : 0.1; zR = up ? -0.25 : -0.1;
        bob = -0.4 + (up ? Math.abs(Math.sin(p * 3)) * 0.06 : 0);
        break;
      }
      case 'sit':
        legL_ = legR_ = -1.5; kL = kR = 1.5;
        armL_ = armR_ = -0.45; eL = eR = 0.9;
        bob = -0.4;
        nod = Math.sin(p * 0.5) * 0.03;
        break;
      case 'type':
        legL_ = legR_ = -1.5; kL = kR = 1.5;
        armL_ = -0.55 + Math.sin(p * 3) * 0.05; armR_ = -0.55 - Math.sin(p * 3 + 1) * 0.05;
        eL = eR = 1.1;
        bob = -0.4;
        nod = 0.12;
        break;
      case 'eat':
        legL_ = legR_ = -1.5; kL = kR = 1.5;
        armL_ = -0.45; eL = 0.9;
        armR_ = -0.5 - Math.max(0, Math.sin(p)) * 0.6; eR = 1.2 + Math.max(0, Math.sin(p)) * 0.9; // spoon to mouth
        bob = -0.4;
        break;
      case 'sleep':
        tilt = -Math.PI / 2;
        armL_ = armR_ = 0.1; eL = eR = 0.2;
        kL = 0.15;
        bob = 0.12 + Math.sin(p) * 0.01;
        break;
      case 'knocked':
        tilt = -Math.PI / 2;
        armL_ = -2.6; armR_ = 0.6; zL = 0.5; zR = -0.5;
        legL_ = 0.25; legR_ = -0.2; kL = 0.6;
        bob = 0.1;
        break;
      case 'swim':
        tilt = 1.25;
        armL_ = Math.sin(p) * 2.6; armR_ = Math.sin(p + Math.PI) * 2.6;
        legL_ = Math.sin(p * 2) * 0.35; legR_ = -legL_;
        kL = kR = 0.25;
        bob = -0.45 + Math.sin(p * 2) * 0.05;
        break;
      case 'lift':
        armL_ = armR_ = -(1.2 + Math.sin(p) * 0.9);
        eL = eR = 0.8 + Math.sin(p) * 0.6;
        kL = kR = 0.15 + Math.max(0, Math.sin(p)) * 0.15;
        bob = Math.sin(p) * 0.02 - 0.02;
        break;
      case 'sing':
        armR_ = -1.4; eR = 1.6 + Math.sin(p) * 0.08; // mic at the mouth
        armL_ = -0.4 - Math.max(0, Math.sin(p * 0.5)) * 1.4; zL = 0.35; eL = 0.3;
        bob = Math.abs(Math.sin(p)) * 0.04;
        yaw = Math.sin(p * 0.5) * 0.25;
        nod = -0.08 + Math.sin(p) * 0.05;
        break;
      case 'dj':
        armL_ = -0.9 + Math.sin(p) * 0.12; armR_ = -0.9 - Math.sin(p) * 0.12;
        eL = eR = 0.9;
        bob = Math.abs(Math.sin(p)) * 0.06;
        nod = Math.abs(Math.sin(p)) * 0.18;
        break;
      default:
        armL_ = Math.sin(p) * 0.03; armR_ = -armL_;
        nod = Math.sin(p * 0.6) * 0.02;
    }
    if (!legL.current) return;
    legL.current.rotation.x = legL_;
    legR.current.rotation.x = legR_;
    kneeL.current.rotation.x = kL;
    kneeR.current.rotation.x = kR;
    armL.current.rotation.x = armL_;
    armR.current.rotation.x = armR_;
    armL.current.rotation.z = zL;
    armR.current.rotation.z = zR;
    elbowL.current.rotation.x = -eL;
    elbowR.current.rotation.x = -eR;
    body.current.position.y = bob;
    body.current.rotation.x = tilt;
    if (yaw !== null) body.current.rotation.y = yaw;
    else body.current.rotation.y *= 0.9;
    // Hips swing with the stride and the shoulders counter it; idle shifts weight and looks around.
    const walking = mode === 'walk' || mode === 'run';
    const idle = mode === 'idle';
    pelvis.current.rotation.y = walking ? Math.sin(p) * (mode === 'run' ? 0.16 : 0.11) : 0;
    pelvis.current.rotation.z = walking ? Math.sin(p) * 0.035 : idle ? Math.sin(t * 0.45) * 0.025 : 0;
    chest.current.rotation.y = walking ? -Math.sin(p) * (mode === 'run' ? 0.2 : 0.12) : 0;
    chest.current.rotation.z = -pelvis.current.rotation.z * 0.8;
    const breath = Math.sin(t * (walking ? 3.2 : 1.7));
    chest.current.scale.set(1 + breath * 0.006, 1 + breath * 0.004, 1 + breath * 0.014);
    head.current.rotation.x = nod;
    head.current.rotation.y = idle ? Math.sin(t * 0.31) * 0.28 * Math.max(0, Math.sin(t * 0.13)) : 0;
    // Blink every few seconds (the upper lids close).
    blink.current -= dt;
    const closed = blink.current < 0.13 || mode === 'sleep' || mode === 'knocked';
    if (lidL.current) {
      const k = closed ? 0.1 : 0.9;
      lidL.current.scale.y = k;
      lidR.current.scale.y = k;
    }
    if (blink.current < 0) blink.current = 2.5 + Math.random() * 3.5;
    // Far away: hide the fine detail (face, fingers) to save draw calls.
    if (++lodTick.current % 20 === 0) {
      if (!fine.current) {
        fine.current = [];
        body.current.traverse((o) => { if (o.userData.fine) fine.current.push(o); });
      }
      body.current.getWorldPosition(tmp);
      const near = tmp.distanceTo(state.camera.position) < NEAR * scale;
      if (fine.current.length && fine.current[0].visible !== near) for (const o of fine.current) o.visible = near;
    }
  });

  const legMat = bareLegs ? skin : bottomMat;
  const formal = ['suti', 'ofisi-sketi', 'kanzu', 'kanzu-eid', 'kaunda'].includes(outfit.id);
  const dressy = woman && (bt === 'dress' || bt === 'skirt' || bt === 'maxi');
  const shoeMat = dressy ? mat('#7c2d12') : formal ? LEATHER : SNEAKER;
  const shoeKind = dressy ? 'heel' : 'flat';
  const loose = bt === 'pants' ? 1.06 : 1;
  const hideShin = robe || longSkirt; // covered to the ankle: the cloth hides the legs
  const hideThigh = hideShin || bt === 'dress';
  const sleeveK = 1.08;
  return (
    <group scale={scale}>
      <mesh geometry={geo('circle', 0.42, 20)} material={shadowMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} />
      <group ref={body}>
        {/* ---------- pelvis: legs, hips, skirts */}
        <group ref={pelvis} position={[0, HIP, 0]}>
          {[[-1, legL, kneeL], [1, legR, kneeR]].map(([s, ref, knee]) => (
            <group key={s} ref={ref} position={[s * (woman ? 0.092 : 0.1) * bw, 0, 0]}>
              {!hideThigh && <mesh geometry={thighGeo(woman, build)} material={bt === 'shorts' ? bottomMat : legMat} scale={[loose, 1, loose]} />}
              <group ref={knee} position={[0, -LIMB.thigh, 0]}>
                {bt === 'pants' && <mesh geometry={geo('sphere', 0.066, 14, 10)} material={bottomMat} scale={[1, 0.9, 1]} />}
                {!hideShin && <mesh geometry={shinGeo(woman, build)} material={legMat} scale={[bt === 'pants' ? 1.1 : 1, 1, bt === 'pants' ? 1.05 : 1]} />}
                {bt === 'pants' && <mesh userData={FINE} geometry={geo('cyl', 0.05, 0.052, 0.03, 16, 1, true)} material={bottomMat} position={[0, -LIMB.shin + 0.035, 0]} />}
                <group position={[0, -LIMB.shin - 0.035, 0]}>
                  <mesh geometry={shoeGeo(shoeKind)} material={shoeMat} />
                  <mesh geometry={soleGeo(shoeKind)} material={shoeMat === SNEAKER ? SOLE_DARK : SOLE} position={[0, -0.025, 0]} />
                  {shoeMat === SNEAKER && <mesh userData={FINE} geometry={geo('box', 0.04, 0.004, 0.07)} material={SOLE_DARK} position={[0, 0.04, 0.07]} rotation={[0.35, 0, 0]} />}
                </group>
              </group>
            </group>
          ))}
          {(bt === 'pants' || bt === 'shorts') && (
            <group>
              <mesh geometry={geo('cyl', (woman ? 0.19 : 0.178) * bw, (woman ? 0.176 : 0.164) * bw, 0.17, 24)} material={bottomMat} position={[0, 0.005, 0]} scale={[1, 1, 0.76]} />
              <mesh geometry={geo('sphere', 0.1, 16, 10)} material={bottomMat} position={[0, -0.08, 0]} scale={[1.45 * bw, 0.75, 1]} />
              {bt === 'pants' && !woman && (
                <group>
                  <mesh geometry={geo('cyl', 0.176 * bw, 0.176 * bw, 0.032, 24)} material={BELT} position={[0, 0.07, 0]} scale={[1, 1, 0.69]} />
                  <mesh userData={FINE} geometry={geo('box', 0.04, 0.026, 0.008)} material={BUCKLE} position={[0, 0.07, 0.121 * bw]} />
                </group>
              )}
            </group>
          )}
          {bt === 'skirt' && <mesh geometry={geo('cyl', 0.18 * bw, 0.27 * bw, 0.48, 26, 1, true)} material={bottomMat} position={[0, -0.12, 0]} scale={[1, 1, 0.8]} />}
          {bt === 'dress' && <mesh geometry={geo('cyl', 0.18 * bw, 0.32 * bw, 0.72, 26, 1, true)} material={bottomMat} position={[0, -0.2, 0]} scale={[1, 1, 0.8]} />}
          {longSkirt && <mesh geometry={geo('cyl', 0.18 * bw, (bt === 'maxi' ? 0.3 : 0.24) * bw, 1.0, 26, 1, true)} material={bottomMat} position={[0, -0.42, 0]} scale={[1, 1, 0.8]} />}
          {robe && <mesh geometry={geo('cyl', 0.2 * bw, 0.3 * bw, 1.42, 26, 1, true)} material={topMat} position={[0, -0.13, 0]} scale={[1, 1, 0.8]} />}
          {(bt === 'skirt' || bt === 'dress' || longSkirt || robe) && <mesh geometry={geo('sphere', 0.1, 16, 10)} material={robe ? topMat : bottomMat} position={[0, -0.02, 0]} scale={[1.75 * bw, 0.7, 1.3]} />}
        </group>

        {/* ---------- chest: torso, arms, neck, head */}
        <group ref={chest} position={[0, HIP, 0]}>
          <mesh geometry={torsoGeo(woman, build)} material={topMat} />
          {sleeves !== 'none' && !robe && !longSkirt && bt !== 'pants' && bt !== 'shorts' && <mesh geometry={geo('cyl', 0.162 * bw, 0.168 * bw, 0.06, 24, 1, false)} material={topMat} position={[0, 0.03, 0]} scale={[1, 1, 0.7]} />}
          {sleeves === 'none' && <mesh geometry={geo('sphere', 1, 16, 10)} material={skin} position={[0, 0.58, 0]} scale={[0.14 * bw, 0.05, 0.08]} />}
          {sleeves !== 'none' && !robe && <mesh geometry={geo('torus', 0.056, 0.012, 8, 20)} material={topMat} position={[0, 0.615, 0.005]} rotation={[Math.PI / 2 + 0.25, 0, 0]} />}
          {formal && !robe && [0.5, 0.42, 0.34, 0.26].map((y) => <mesh key={y} userData={FINE} geometry={geo('sphere', 0.006, 6, 5)} material={WHITE} position={[0, y, faceZChest(woman, y, bw)]} />)}
          {outfit.extra === 'tie' && (
            <group position={[0, 0.43, 0.128 * bw]}>
              <mesh geometry={geo('box', 0.1, 0.27, 0.008)} material={WHITE} />
              <mesh geometry={geo('box', 0.038, 0.24, 0.01)} material={mat('#b91c1c')} position={[0, -0.03, 0.005]} />
              <mesh geometry={geo('box', 0.03, 0.025, 0.014)} material={mat('#991b1b')} position={[0, 0.1, 0.007]} />
            </group>
          )}
          {/* arms: shoulder → elbow → hand */}
          {[[-1, armL, elbowL], [1, armR, elbowR]].map(([s, ref, elbow]) => {
            const sleeveMat = sleeves === 'none' ? skin : topMat;
            return (
              <group key={s} ref={ref} position={[s * sw / 2, 0.55, 0]}>
                <mesh geometry={geo('sphere', woman ? 0.05 : 0.058, 16, 12)} material={sleeveMat} position={[-s * 0.012, -0.01, 0]} />
                <mesh geometry={upperArmGeo(woman, build)} material={sleeveMat} scale={sleeves === 'long' ? [sleeveK, 1, sleeveK] : 1} />
                {sleeves === 'short' && (
                  <>
                    <mesh geometry={geo('capsule', (woman ? 0.046 : 0.052) * BUILD[build].limb, 0.11, 6, 14)} material={skin} position={[0, -0.215, 0]} />
                    <mesh geometry={geo('cyl', (woman ? 0.056 : 0.064) * BUILD[build].limb, (woman ? 0.057 : 0.065) * BUILD[build].limb, 0.035, 18, 1, false)} material={topMat} position={[0, -0.13, 0]} />
                  </>
                )}
                <group ref={elbow} position={[0, -LIMB.upperArm, 0]}>
                  <mesh geometry={foreArmGeo(woman, build)} material={sleeves === 'long' ? topMat : skin} scale={sleeves === 'long' ? [sleeveK, 1, sleeveK] : 1} />
                  {sleeves === 'long' && <mesh geometry={geo('cyl', 0.034, 0.036, 0.03, 14, 1, true)} material={topMat} position={[0, -LIMB.foreArm + 0.02, 0]} />}
                  <Hand s={s} skin={skin} />
                </group>
              </group>
            );
          })}
          <mesh geometry={neckGeo(woman)} material={skin} position={[0, 0.66, 0]} />
          {/* ---------- head */}
          <group ref={head} position={[0, 0.83, 0.005]}>
            <mesh geometry={headGeo(woman)} material={skin} />
            {[-1, 1].map((s) => <mesh key={s} geometry={earGeo()} material={skin} position={[s * 0.128, 0.0, -0.008]} rotation={[0, s * 0.25, 0]} scale={[s, 1, 1]} />)}
            <group userData={FINE}>
              <Eye s={-1} woman={woman} lid={lidL} skin={skin} />
              <Eye s={1} woman={woman} lid={lidR} skin={skin} />
              {[-1, 1].map((s) => (
                <mesh key={`b${s}`} geometry={tubeGeo(`brow${woman}${s}`, [[s * 0.022, 0.048, faceZ(woman, s * 0.022, 0.048) + 0.002], [s * 0.046, 0.056, faceZ(woman, s * 0.046, 0.056) + 0.003], [s * 0.07, 0.049, faceZ(woman, s * 0.07, 0.049) + 0.001]], woman ? 0.0034 : 0.0052, { taper: 0.5, radial: 4, seg: 6 })} material={brow} />
              ))}
              <mesh geometry={noseGeo(woman)} material={skin} position={[0, -0.03, faceZ(woman, 0, -0.03) - 0.004]} />
              <mesh geometry={lipGeo(true, woman)} material={lipMat(skinColor)} position={[0, -0.07, faceZ(woman, 0, -0.07) - 0.003]} />
              <mesh geometry={lipGeo(false, woman)} material={lipMat(skinColor)} position={[0, -0.083, faceZ(woman, 0, -0.083) - 0.003]} />
              <mesh geometry={geo('capsule', 0.0012, 0.044, 2, 6)} material={mouthLine} position={[0, -0.0765, faceZ(woman, 0, -0.0765) + 0.004]} rotation={[0, 0, Math.PI / 2]} />
              <Beard style={a.beard} color={hairColor} woman={woman} />
            </group>
            {hijab ? (
              <group>
                <mesh geometry={scalpGeo(woman, { cover: 2.25, lift: 0.02, front: 0.75 })} material={topMat} />
                <mesh geometry={geo('cyl', 0.13, 0.22, 0.24, 24, 1, true)} material={topMat} position={[0, -0.2, -0.015]} />
              </group>
            ) : kofia ? (
              <group>
                <mesh geometry={scalpGeo(woman, { cover: 1.72, lift: 0.005 })} material={hairMat(hairColor, 'coil')} />
                <mesh geometry={geo('cyl', 0.142, 0.145, 0.1, 24, 1, true)} material={mat('#f8fafc', { side: THREE.DoubleSide })} position={[0, 0.12, -0.01]} rotation={[-0.12, 0, 0]} />
              </group>
            ) : (
              <Hair style={a.hair} color={hairColor} woman={woman} fabric={fabricMat('kitenge', '#ea580c')} />
            )}
          </group>
        </group>
      </group>
    </group>
  );
}
// Front of the torso at height y (for shirt buttons).
function faceZChest(woman, y, bw) {
  return (woman ? 0.11 : 0.125) * (0.95 + Math.min(0.1, Math.max(0, y - 0.3))) * Math.min(1.1, bw);
}

export function avatarEmoji(appearance) {
  if (!appearance) return '🙂';
  return appearance.body === 'woman' ? ['👩🏿', '👩🏾', '👩🏾', '👩🏽', '👩🏽', '👩🏽'][appearance.skin] || '👩🏾' : ['👨🏿', '👨🏾', '👨🏾', '👨🏽', '👨🏽', '👨🏽'][appearance.skin] || '👨🏾';
}
