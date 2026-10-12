// Detailed districts: Posta (glass towers + colonial arcades), Kariakoo (dense commercial blocks
// with shopfronts, signs, balconies, laundry) and Masaki (apartments with balconies, villas with
// tiled hip roofs, compound walls and pools). Buildings are generated from the filler plots and
// merged into a handful of meshes (one per material) so phones stay smooth. Windows glow at night.
import { memo, useMemo } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { track } from './CityDecor.jsx';

// ------------------------------------------------------------------ zones
export const ZONES = {
  posta: { x1: 32, x2: 74, z1: -44, z2: 34 },
  kariakoo: { x1: -20, x2: 30, z1: -44, z2: 34 },
  masaki: { x1: 95, x2: 132, z1: -120, z2: -48 },
  sinza: { x1: -115, x2: -56, z1: -100, z2: -48 },
  mlimani: { x1: -54, x2: -18, z1: -100, z2: -50 },
  kigamboni: { x1: 40, x2: 85, z1: 58, z2: 140 },
  stonetown: { x1: 1531, x2: 1588, z1: -70, z2: 55 },
};
export const zoneOf = (x, z) => Object.keys(ZONES).find((k) => { const r = ZONES[k]; return x >= r.x1 && x <= r.x2 && z >= r.z1 && z <= r.z2; }) || null;

// ------------------------------------------------------------------ textures
function tex(w, h, draw, repeat = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
let seed = 11;
const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

// One tile = one bay wide × one floor high. White walls so per-building vertex colours tint them.
function facade(kind) {
  const W = 128, H = 128;
  const day = tex(W, H, (x) => {
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, W, H);
    if (kind === 'glass') {
      const g = x.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, '#3f6f99'); g.addColorStop(0.5, '#7fa7cc'); g.addColorStop(1, '#335d84');
      x.fillStyle = g; x.fillRect(0, 0, W, H);
      x.fillStyle = '#2b3a46'; x.fillRect(0, 0, W, 6); x.fillRect(0, 0, 5, H);
      x.fillStyle = 'rgba(255,255,255,.18)'; x.beginPath(); x.moveTo(20, H); x.lineTo(70, 0); x.lineTo(90, 0); x.lineTo(40, H); x.fill();
    } else if (kind === 'stone') {
      x.fillStyle = 'rgba(120,90,50,.10)'; for (let i = 0; i < 40; i++) x.fillRect(Math.random() * W, Math.random() * H, 8 + Math.random() * 20, 3 + Math.random() * 10);
      x.fillStyle = '#e7dcc4'; x.beginPath(); x.moveTo(30, 108); x.lineTo(30, 52); x.arc(64, 52, 34, Math.PI, 0); x.lineTo(98, 108); x.fill();
      x.fillStyle = '#2f5d4e'; x.fillRect(36, 54, 26, 52); x.fillRect(66, 54, 26, 52);
      x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 2; for (let y = 58; y < 104; y += 6) { x.beginPath(); x.moveTo(38, y); x.lineTo(60, y); x.moveTo(68, y); x.lineTo(90, y); x.stroke(); }
      x.fillStyle = '#40382e'; x.beginPath(); x.moveTo(36, 52); x.arc(64, 52, 28, Math.PI, 0); x.lineTo(92, 52); x.fill();
    } else if (kind === 'zdoor') {
      x.fillStyle = '#e9dfc8'; x.fillRect(0, 0, W, H);
      x.fillStyle = '#5b3a1e'; x.fillRect(30, 18, 68, 110); x.fillStyle = '#3d2614'; x.fillRect(30, 18, 68, 12);
      x.fillStyle = '#7a4f29'; x.fillRect(36, 34, 26, 90); x.fillRect(66, 34, 26, 90);
      x.fillStyle = '#d4a017'; for (let y = 40; y < 120; y += 14) { x.beginPath(); x.arc(49, y, 2.2, 0, 7); x.arc(79, y, 2.2, 0, 7); x.fill(); }
    } else if (kind === 'colonial') {
      x.fillStyle = '#e9e2d0'; x.fillRect(0, H - 10, W, 10);
      x.fillStyle = '#d8cfb8'; x.beginPath(); x.moveTo(24, H - 14); x.lineTo(24, 46); x.arc(64, 46, 40, Math.PI, 0); x.lineTo(104, H - 14); x.fill();
      x.fillStyle = '#3d5568'; x.beginPath(); x.moveTo(32, H - 20); x.lineTo(32, 48); x.arc(64, 48, 32, Math.PI, 0); x.lineTo(96, H - 20); x.fill();
      x.fillStyle = '#e9e2d0'; x.fillRect(62, 20, 4, 90); x.fillRect(32, 64, 64, 3);
    } else {
      // residential / commercial windows
      const big = kind === 'commercial';
      const [wx, wy, ww, wh] = big ? [14, 24, 100, 62] : [28, 22, 72, 66];
      x.fillStyle = '#d9d4ca'; x.fillRect(wx - 6, wy - 6, ww + 12, wh + 14); // frame + sill
      x.fillStyle = '#41586b'; x.fillRect(wx, wy, ww, wh);
      x.fillStyle = 'rgba(255,255,255,.22)'; x.fillRect(wx + 4, wy + 4, ww * 0.3, wh - 8);
      x.fillStyle = '#d9d4ca';
      if (big) { for (let i = 1; i < 4; i++) x.fillRect(wx + (ww / 4) * i - 2, wy, 4, wh); }
      else { x.fillRect(wx + ww / 2 - 2, wy, 4, wh); x.fillRect(wx, wy + wh / 2 - 2, ww, 4); }
      if (kind === 'commercial') { x.strokeStyle = 'rgba(30,30,30,.55)'; x.lineWidth = 2; for (let i = wx + 8; i < wx + ww; i += 10) { x.beginPath(); x.moveTo(i, wy); x.lineTo(i, wy + wh); x.stroke(); } }
      x.fillStyle = 'rgba(0,0,0,.08)'; x.fillRect(0, H - 4, W, 4);
    }
  });
  const glow = tex(W, H, (x) => { x.fillStyle = '#000'; x.fillRect(0, 0, W, H); });
  // Night: a mix of lit windows comes from a second, wider tile so the pattern doesn't repeat.
  const lit = tex(512, 512, (x) => {
    x.fillStyle = '#000'; x.fillRect(0, 0, 512, 512);
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
      if (rnd() > (kind === 'glass' ? 0.55 : 0.5)) continue;
      x.fillStyle = rnd() < 0.7 ? '#ffd9a0' : '#d6ecff';
      const [ox, oy] = [i * 128, j * 128];
      if (kind === 'glass') x.fillRect(ox + 6, oy + 6, 122, 122);
      else if (kind === 'colonial') { x.beginPath(); x.moveTo(ox + 32, oy + 108); x.lineTo(ox + 32, oy + 48); x.arc(ox + 64, oy + 48, 32, Math.PI, 0); x.lineTo(ox + 96, oy + 108); x.fill(); }
      else if (kind === 'commercial') x.fillRect(ox + 14, oy + 24, 100, 62);
      else x.fillRect(ox + 28, oy + 22, 72, 66);
    }
  });
  lit.repeat.set(0.25, 0.25);
  void glow;
  return track(new THREE.MeshLambertMaterial({ map: day, vertexColors: true, emissive: new THREE.Color('#ffffff'), emissiveMap: lit, emissiveIntensity: 0 }), 'emissive', 1.05);
}

// Ground-floor shopfronts: roller doors, glass, a sign band (signs come from the sign atlas).
function shopMat() {
  const t = tex(256, 128, (x) => {
    x.fillStyle = '#f3f0ea'; x.fillRect(0, 0, 256, 128);
    x.fillStyle = '#9aa3ab'; x.fillRect(12, 44, 104, 84);
    x.strokeStyle = 'rgba(0,0,0,.25)'; for (let y = 48; y < 128; y += 6) { x.beginPath(); x.moveTo(12, y); x.lineTo(116, y); x.stroke(); }
    x.fillStyle = '#4b6577'; x.fillRect(140, 44, 104, 84);
    x.fillStyle = 'rgba(255,255,255,.25)'; x.fillRect(146, 50, 30, 72);
    x.fillStyle = '#2d2d2d'; x.fillRect(0, 36, 256, 6);
  });
  const g = tex(256, 128, (x) => { x.fillStyle = '#000'; x.fillRect(0, 0, 256, 128); x.fillStyle = '#ffcf85'; x.fillRect(140, 44, 104, 84); });
  return track(new THREE.MeshLambertMaterial({ map: t, vertexColors: true, emissive: new THREE.Color('#ffffff'), emissiveMap: g, emissiveIntensity: 0 }), 'emissive', 1.2);
}

// Painted shop signs (all made-up businesses), one atlas: 4 × 4 signs.
const SIGNS = [
  ['DUKA LA JUMLA', '#b91c1c', '#fff'], ['MAMA ASHA FASHION', '#db2777', '#fff'], ['SIMU & VOCHA', '#1d4ed8', '#fde047'], ['KARIAKOO HARDWARE', '#f59e0b', '#111'],
  ['FAMASIA YA AFYA', '#16a34a', '#fff'], ['BUREAU DE CHANGE', '#0f172a', '#facc15'], ['VITENGE & KANGA', '#7c3aed', '#fff'], ['SPEA ZA MAGARI', '#334155', '#fff'],
  ['MGAHAWA WA KISASA', '#ea580c', '#fff'], ['SALOON YA KISASA', '#be185d', '#fff'], ['ELECTRONICS', '#0e7490', '#fff'], ['VIATU BEI POA', '#a16207', '#fff'],
  ['HOTEL & LODGE', '#1e3a8a', '#fff'], ['BENKI YA BONGO', '#7f1d1d', '#fde68a'], ['MAJI SAFI', '#0284c7', '#fff'], ['DUKA LA DAWA', '#15803d', '#fff'],
];
function signMat() {
  const t = tex(1024, 256, (x) => {
    SIGNS.forEach(([text, bg, fg], i) => {
      const ox = (i % 4) * 256, oy = Math.floor(i / 4) * 64;
      x.fillStyle = bg; x.fillRect(ox + 2, oy + 2, 252, 60);
      x.fillStyle = fg; x.font = '900 30px "Archivo Variable","Archivo","Arial Narrow",sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(text, ox + 128, oy + 33, 236);
    });
  }, false);
  return track(new THREE.MeshLambertMaterial({ map: t, emissive: new THREE.Color('#ffffff'), emissiveMap: t, emissiveIntensity: 0 }), 'emissive', 0.55);
}

let MATS = null;
const mats = () => (MATS ||= {
  residential: facade('residential'),
  commercial: facade('commercial'),
  glass: facade('glass'),
  colonial: facade('colonial'),
  stone: facade('stone'),
  zdoor: facade('zdoor'),
  shop: shopMat(),
  sign: signMat(),
  plain: new THREE.MeshLambertMaterial({ vertexColors: true }),
  water: new THREE.MeshLambertMaterial({ color: '#38bdf8', emissive: new THREE.Color('#0ea5e9'), emissiveIntensity: 0.25 }),
});

// ------------------------------------------------------------------ geometry builder
const C = new THREE.Color();
function colorize(g, color) {
  C.set(color);
  const n = g.attributes.position.count;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = C.r; a[i * 3 + 1] = C.g; a[i * 3 + 2] = C.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
/** A box with its side UVs scaled so the facade tile repeats once per bay and once per floor. */
function box(x, y, z, w, h, d, color, bay = 0, floor = 0, ry = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  // Face order: +x, -x, +y, -y, +z, -z (4 vertices each).
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
    const i = f * 4 + k;
    if (!bay || f === 2 || f === 3) { uv.setXY(i, 0.02, 0.02); continue; }
    const faceW = f < 2 ? d : w;
    uv.setXY(i, uv.getX(i) * Math.max(1, Math.round(faceW / bay)), uv.getY(i) * Math.max(1, Math.round(h / floor)));
  }
  if (ry) g.rotateY(ry);
  g.translate(x, y + h / 2, z);
  delete g.attributes.normal; g.computeVertexNormals();
  return colorize(g, color);
}
function cyl(x, y, z, r, h, color, seg = 10) {
  const g = new THREE.CylinderGeometry(r, r, h, seg);
  g.translate(x, y + h / 2, z);
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  return colorize(g, color);
}
function hipRoof(x, y, z, w, d, h, color) {
  const g = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4);
  g.scale(w, h, d);
  g.translate(x, y + h / 2, z);
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  delete g.attributes.normal; g.computeVertexNormals();
  return colorize(g, color);
}
/** A sign plane facing +z (before rotation), UV'd to one sign of the atlas. */
function sign(x, y, z, w, h, i, ry) {
  const g = new THREE.PlaneGeometry(w, h);
  const u0 = (i % 4) / 4, v1 = 1 - Math.floor(i / 4) / 4, v0 = v1 - 0.25;
  const uv = g.attributes.uv;
  uv.setXY(0, u0, v1); uv.setXY(1, u0 + 0.25, v1); uv.setXY(2, u0, v0); uv.setXY(3, u0 + 0.25, v0);
  g.rotateY(ry);
  g.translate(x, y, z);
  return g;
}

const WALLS = {
  kariakoo: ['#e7dfcf', '#d9cfbd', '#efe7d7', '#cfd8dc', '#e8d5c0', '#f1e4cf', '#d6dccf', '#ead9d0'],
  posta: ['#f2efe8', '#e4e7ea', '#efe7d6', '#dce3e8'],
  masaki: ['#fbf8f2', '#f5efe4', '#f7f3ec', '#eef2f2', '#f3ece0'],
};
const ROOF_TILES = ['#b5452f', '#a3402c', '#c2553a', '#8f3a2a'];
const LAUNDRY = ['#ef4444', '#3b82f6', '#facc15', '#22c55e', '#f8fafc', '#a855f7'];
const pick = (a) => a[Math.floor(rnd() * a.length)];

// Facing: the side towards the nearest road gets the shopfront and sign.
function build(b, parts) {
  const { zone, x, z } = b;
  const w = b.w, d = b.d;
  const push = (k, g) => (parts[k] ||= []).push(g);
  const ry = b.face; // rotation so local +z faces the street
  const P = (lx, lz) => { const c = Math.cos(ry), s = Math.sin(ry); return [x + lx * c + lz * s, z - lx * s + lz * c]; };
  if (zone === 'kariakoo') {
    const floors = 3 + Math.floor(rnd() * 6);
    const fh = 3, gh = 3.6;
    const wall = pick(WALLS.kariakoo);
    push('shop', box(x, 0, z, w, gh, d, '#ffffff', 4, gh, ry));
    push('commercial', box(x, gh, z, w, floors * fh, d, wall, 3.2, fh, ry));
    const top = gh + floors * fh;
    push('plain', box(x, top, z, w + 0.2, 0.6, d + 0.2, '#bdb5a6', 0, 0, ry));
    // sign + awning over the shopfront
    const [sx, sz] = P(0, d / 2 + 0.06);
    push('sign', sign(sx, gh - 0.55, sz, Math.min(w * 0.9, 6), 1.1, Math.floor(rnd() * SIGNS.length), ry));
    const [ax, az] = P(0, d / 2 + 0.7);
    push('plain', box(ax, gh - 1.25, az, w * 0.95, 0.12, 1.4, pick(['#dc2626', '#16a34a', '#2563eb', '#f59e0b', '#0f766e']), 0, 0, ry));
    // balconies with laundry on some floors
    for (let f = 1; f < floors; f++) {
      if (rnd() < 0.5) continue;
      const [bx, bz] = P(0, d / 2 + 0.5);
      const y = gh + f * fh;
      push('plain', box(bx, y - 0.05, bz, w * 0.7, 0.15, 1, '#cfc8ba', 0, 0, ry));
      const [rx, rz] = P(0, d / 2 + 0.98);
      push('plain', box(rx, y + 0.1, rz, w * 0.7, 0.9, 0.06, '#4b5563', 0, 0, ry));
      if (rnd() < 0.6) for (let k = 0; k < 3; k++) { const [lx, lz] = P(-w * 0.25 + k * w * 0.25, d / 2 + 0.95); push('plain', box(lx, y + 0.55, lz, 0.55, 0.7, 0.04, pick(LAUNDRY), 0, 0, ry)); }
    }
    // AC units and rooftop tanks
    for (let k = 0; k < 2; k++) { const [cx, cz] = P(w / 2 + 0.25, -d / 4 + k * d / 2); push('plain', box(cx, gh + 1 + rnd() * floors * fh * 0.7, cz, 0.45, 0.5, 0.8, '#e5e7eb', 0, 0, ry)); }
    push('plain', cyl(x + w * 0.2, top + 0.6, z - d * 0.2, 0.6, 1.3, '#111827'));
    if (rnd() < 0.5) push('plain', cyl(x - w * 0.25, top + 0.6, z + d * 0.15, 0.5, 1.1, '#1d4ed8'));
  } else if (zone === 'posta') {
    if (b.tower) {
      const h = b.h;
      push('shop', box(x, 0, z, w + 1.2, 4, d + 1.2, '#ffffff', 4, 4, ry));
      push('glass', box(x, 4, z, w, h, d, pick(['#ffffff', '#eef4fa', '#f4f6f8']), 2.6, 3.4, ry));
      push('plain', box(x, 4 + h, z, w + 0.3, 1, d + 0.3, '#334155', 0, 0, ry));
      if (rnd() < 0.5) push('glass', box(x, 5 + h, z, w * 0.6, h * 0.12, d * 0.6, '#ffffff', 2.6, 3.4, ry));
      push('plain', cyl(x, 5 + h, z, 0.08, 6, '#e5e7eb', 6));
      const [sx, sz] = P(0, (d + 1.2) / 2 + 0.06);
      push('sign', sign(sx, 3.2, sz, Math.min(w, 6), 1, 12 + Math.floor(rnd() * 4), ry));
    } else {
      // colonial 3-storey with a shaded arcade at street level
      const floors = 2 + Math.floor(rnd() * 2), fh = 3.4;
      const wall = pick(WALLS.posta);
      push('plain', box(x, 0, z, w, 3.6, d, '#a8a29e', 0, 0, ry));
      for (let k = 0; k < Math.max(2, Math.round(w / 2.4)); k++) { const [cx, cz] = P(-w / 2 + 0.3 + k * ((w - 0.6) / Math.max(1, Math.round(w / 2.4) - 1)), d / 2 + 1.1); push('plain', box(cx, 0, cz, 0.45, 3.6, 0.45, '#f5f5f4', 0, 0, ry)); }
      const [ox, oz] = P(0, 0.55);
      push('colonial', box(ox, 3.6, oz, w, floors * fh, d + 1.1, wall, 2.8, fh, ry));
      push('plain', box(ox, 3.6 + floors * fh, oz, w + 0.4, 0.5, d + 1.5, '#e7e5e4', 0, 0, ry));
      const [sx, sz] = P(0, d / 2 + 1.15);
      push('sign', sign(sx, 3.1, sz, Math.min(w * 0.8, 5), 0.8, Math.floor(rnd() * 12), ry));
    }
  } else if (zone === 'sinza' || zone === 'mlimani') {
    // Mixed streets: bars, lodges and shops below, flats above; Mlimani a little taller and more office-like.
    const tall = zone === 'mlimani';
    const floors = (tall ? 3 : 1) + Math.floor(rnd() * (tall ? 6 : 4));
    const fh = 3, gh = 3.4;
    const wall = pick(tall ? WALLS.posta : WALLS.kariakoo);
    const shop = rnd() < (tall ? 0.45 : 0.7);
    if (shop) push('shop', box(x, 0, z, w, gh, d, '#ffffff', 4, gh, ry));
    else push('residential', box(x, 0, z, w, gh, d, wall, 3, gh, ry));
    push(tall && rnd() < 0.5 ? 'commercial' : 'residential', box(x, gh, z, w, floors * fh, d, wall, 3, fh, ry));
    const top = gh + floors * fh;
    if (shop) {
      const [sx, sz] = P(0, d / 2 + 0.06);
      push('sign', sign(sx, gh - 0.55, sz, Math.min(w * 0.9, 5.5), 1, Math.floor(rnd() * SIGNS.length), ry));
      const [ax, az] = P(0, d / 2 + 0.7);
      push('plain', box(ax, gh - 1.2, az, w * 0.95, 0.12, 1.4, pick(['#dc2626', '#16a34a', '#2563eb', '#f59e0b', '#7c3aed']), 0, 0, ry));
    }
    for (let f = 1; f <= floors; f++) {
      if (rnd() < 0.55) continue;
      const [bx, bz] = P(0, d / 2 + 0.45);
      push('plain', box(bx, gh + (f - 1) * fh - 0.05, bz, w * 0.6, 0.14, 0.9, '#d6d3d1', 0, 0, ry));
      const [rx, rz] = P(0, d / 2 + 0.88);
      push('plain', box(rx, gh + (f - 1) * fh + 0.1, rz, w * 0.6, 0.85, 0.05, '#57534e', 0, 0, ry));
    }
    if (!tall && rnd() < 0.45) push('plain', hipRoof(x, top, z, w * 1.12, d * 1.12, 1.4, pick(ROOF_TILES)));
    else {
      push('plain', box(x, top, z, w + 0.2, 0.5, d + 0.2, '#c8c1b3', 0, 0, ry));
      push('plain', cyl(x + w * 0.2, top + 0.5, z - d * 0.2, 0.55, 1.2, pick(['#111827', '#1d4ed8'])));
    }
  } else if (zone === 'kigamboni') {
    if (rnd() < 0.5) return build({ ...b, zone: 'masaki', villa: true }, parts);
    // Low beach-side houses with tin hip roofs and a veranda.
    const wall = pick(WALLS.masaki.concat(['#fde7c8', '#e3f0e6', '#f7dfd4']));
    push('residential', box(x, 0, z, w, 3.2, d, wall, 3, 3.2, ry));
    const [vx, vz] = P(0, d / 2 + 0.9);
    push('plain', box(vx, 0, vz, w * 0.9, 0.2, 1.8, '#d6d3d1', 0, 0, ry));
    for (const k of [-1, 1]) { const [px, pz] = P(k * w * 0.4, d / 2 + 1.6); push('plain', box(px, 0, pz, 0.2, 2.8, 0.2, '#f5f5f4', 0, 0, ry)); }
    push('plain', hipRoof(x, 3.2, z + 0, w * 1.15, d * 1.3, 1.3, pick(['#8a8f96', '#9a4a2a', '#3b6ea5', '#b5452f'])));
  } else if (zone === 'stonetown') {
    // Coral-stone townhouses: carved doors, shuttered arches, wooden balconies, flat roofs.
    const floors = 2 + Math.floor(rnd() * 3), fh = 3.3;
    const wall = pick(['#efe3c8', '#e8d6b0', '#f4ead6', '#e2cfa8', '#f1e7d3', '#dcc9a6']);
    push('zdoor', box(x, 0, z, w, fh, d, wall, 3.4, fh, ry));
    push('stone', box(x, fh, z, w, (floors - 1) * fh, d, wall, 3, fh, ry));
    const top = floors * fh;
    if (rnd() < 0.7) {
      const f = 1 + Math.floor(rnd() * (floors - 1));
      const [bx, bz] = P(0, d / 2 + 0.55);
      push('plain', box(bx, f * fh - 0.1, bz, w * 0.75, 0.16, 1.1, '#5b3a1e', 0, 0, ry));
      const [rx, rz] = P(0, d / 2 + 1.05);
      push('plain', box(rx, f * fh + 0.1, rz, w * 0.75, 1, 0.08, '#6b4423', 0, 0, ry));
      const [cx, cz] = P(0, d / 2 + 0.55);
      push('plain', box(cx, f * fh + 2.2, cz, w * 0.78, 0.12, 1.2, '#4a2f18', 0, 0, ry));
    }
    if (rnd() < 0.35) push('plain', hipRoof(x, top, z, w * 1.05, d * 1.05, 0.9, '#9a4a2a'));
    else push('plain', box(x, top, z, w + 0.1, 0.55, d + 0.1, '#d9c7a1', 0, 0, ry));
  } else if (zone === 'masaki') {
    if (b.villa) {
      // walled compound: villa with tiled hip roof, garden, pool
      const W = w + 2, D = d + 2;
      for (const [lx, lz, ww, dd] of [[0, -D / 2, W, 0.3], [-W / 2, 0, 0.3, D], [W / 2, 0, 0.3, D], [-W * 0.3, D / 2, W * 0.4, 0.3], [W * 0.3, D / 2, W * 0.4, 0.3]]) { const [px, pz] = P(lx, lz); push('plain', box(px, 0, pz, ww, 1.8, dd, '#f1ece2', 0, 0, ry)); }
      const [gx, gz] = P(0, D / 2); push('plain', box(gx, 0, gz, W * 0.2, 1.6, 0.12, '#1f2937', 0, 0, ry));
      push('plain', box(x, 0.02, z, W - 0.4, 0.05, D - 0.4, '#86b36b', 0, 0, ry));
      const [vx, vz] = P(0, -D * 0.12);
      const vw = w * 0.75, vd = d * 0.55;
      push('residential', box(vx, 0, vz, vw, 6, vd, pick(WALLS.masaki), 3, 3, ry));
      push('plain', hipRoof(vx, 6, vz, vw * 1.15, vd * 1.2, 1.8, pick(ROOF_TILES)));
      const [px, pz] = P(w * 0.2, D * 0.28);
      const pool = new THREE.BoxGeometry(2.6, 0.08, 1.6); pool.translate(px, 0.06, pz);
      push('water', pool);
    } else {
      const floors = 4 + Math.floor(rnd() * 5), fh = 3.2;
      push('residential', box(x, 0, z, w, floors * fh, d, pick(WALLS.masaki), 3, fh, ry));
      for (let f = 1; f < floors; f++) {
        const [bx, bz] = P(0, d / 2 + 0.6);
        push('plain', box(bx, f * fh - 0.1, bz, w * 0.9, 0.18, 1.2, '#f8fafc', 0, 0, ry));
        const [rx, rz] = P(0, d / 2 + 1.18);
        push('glass', box(rx, f * fh + 0.08, rz, w * 0.9, 0.9, 0.05, '#ffffff', 2.6, 3.4, ry));
      }
      push('plain', box(x, floors * fh, z, w + 0.3, 0.5, d + 0.3, '#e7e5e4', 0, 0, ry));
      if (rnd() < 0.5) { const [px, pz] = P(0, 0); const pool = new THREE.BoxGeometry(w * 0.5, 0.1, d * 0.35); pool.translate(px, floors * fh + 0.5, pz); push('water', pool); }
    }
  }
}

/** The detailed district buildings. `items` come from the city's filler plots (see City.jsx). */
export const DetailedDistricts = memo(function DetailedDistricts({ items, faceOf }) {
  const meshes = useMemo(() => {
    seed = 20261012;
    const parts = {};
    for (const it of items) {
      const zone = zoneOf(it.x, it.z);
      if (!zone) continue;
      const b = { zone, x: it.x, z: it.z, face: faceOf(it.x, it.z) };
      if (zone === 'kariakoo') Object.assign(b, { w: it.w, d: it.d });
      else if (zone === 'posta') Object.assign(b, { w: it.w, d: it.d, tower: !!it.tower, h: it.h || 20 });
      else if (zone === 'masaki' || zone === 'kigamboni') Object.assign(b, { w: it.w - 1.6, d: it.d - 1.6, villa: rnd() < 0.55 });
      else Object.assign(b, { w: it.w, d: it.d });
      build(b, parts);
    }
    const M = mats();
    return Object.entries(parts).map(([k, list]) => {
      const clean = list.filter(Boolean).map((g) => {
        // Every part needs the same attributes to merge: position, normal, uv (+ color where used).
        if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
        if (k === 'sign' || k === 'water') g.deleteAttribute('color');
        return g.index ? g.toNonIndexed() : g;
      });
      const merged = mergeGeometries(clean, false);
      return merged && { k, geometry: merged, material: M[k] };
    }).filter(Boolean);
  }, [items, faceOf]);
  return meshes.map((m) => <mesh key={m.k} geometry={m.geometry} material={m.material} castShadow={m.k !== 'sign'} receiveShadow />);
});

/** The district glass, for landmark towers. */
export const districtGlass = () => mats().glass;

/** A facade box (bottom at y=0) for landmarks, with the window tile repeating per bay/floor. */
export function facadeBox(w, h, d, bay = 2.6, floor = 3.4) {
  const g = box(0, 0, 0, w, h, d, '#ffffff', bay, floor);
  return g.index ? g.toNonIndexed() : g;
}
