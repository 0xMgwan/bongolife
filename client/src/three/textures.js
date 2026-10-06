import * as THREE from 'three';
import { isEn } from '../i18n.js';

const FONT = "'Plus Jakarta Sans', system-ui, sans-serif";
const EMOJI_FONT = "'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif";

// ---------------------------------------------------------- materials
const matCache = new Map();
export function mat(color, opts) {
  const key = color + (opts ? JSON.stringify(opts) : '');
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color, ...opts });
    matCache.set(key, m);
  }
  return m;
}

const geoCache = new Map();
export function geo(kind, ...args) {
  const key = kind + args.join(',');
  let g = geoCache.get(key);
  if (!g) {
    const C = { box: THREE.BoxGeometry, sphere: THREE.SphereGeometry, cyl: THREE.CylinderGeometry, cone: THREE.ConeGeometry, plane: THREE.PlaneGeometry, torus: THREE.TorusGeometry, capsule: THREE.CapsuleGeometry, circle: THREE.CircleGeometry }[kind];
    g = new C(...args);
    geoCache.set(key, g);
  }
  return g;
}

function canvasTex(w, h, draw, { repeat, srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(...repeat);
  }
  return t;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ------------------------------------------------------- sprites
const emojiCache = new Map();
/** White circle marker with an emoji, like the map pins in the reference. */
export function emojiTexture(emoji, { ring = '#ffffff', bg = '#ffffff' } = {}) {
  const key = emoji + ring + bg;
  if (emojiCache.has(key)) return emojiCache.get(key);
  const t = canvasTex(128, 128, (ctx) => {
    ctx.shadowColor = 'rgba(0,0,0,.25)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = ring;
    ctx.beginPath();
    ctx.arc(64, 60, 50, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(64, 60, 44, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = `56px ${EMOJI_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, 64, 64);
  });
  emojiCache.set(key, t);
  return t;
}

const labelCache = new Map();
/** Pill label. Returns { texture, aspect }. */
export function labelTexture(text, { bg = 'rgba(255,255,255,.95)', fg = '#111827', size = 40, bold = 700, emoji } = {}) {
  const key = [text, bg, fg, size, bold, emoji].join('|');
  if (labelCache.has(key)) return labelCache.get(key);
  const m = document.createElement('canvas').getContext('2d');
  m.font = `${bold} ${size}px ${FONT}`;
  const full = emoji ? `${emoji} ${text}` : text;
  const tw = Math.ceil(m.measureText(full).width);
  const pad = size * 0.6;
  const w = tw + pad * 2;
  const h = Math.round(size * 1.7);
  const texture = canvasTex(w, h + 8, (ctx) => {
    ctx.shadowColor = 'rgba(0,0,0,.18)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = bg;
    roundRect(ctx, 2, 2, w - 4, h - 2, (h - 2) / 2);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = fg;
    ctx.font = `${bold} ${size}px ${FONT}`;
    ctx.textBaseline = 'middle';
    ctx.fillText(full, pad, h / 2 + 2);
  });
  const res = { texture, aspect: w / (h + 8) };
  if (labelCache.size > 400) labelCache.clear();
  labelCache.set(key, res);
  return res;
}

/** Speech bubble (not cached — chat text is unique). */
export function bubbleTexture(text) {
  const size = 34;
  const m = document.createElement('canvas').getContext('2d');
  m.font = `600 ${size}px ${FONT}`;
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (m.measureText(test).width > 420 && line) {
      lines.push(line);
      line = w;
    } else line = test;
    if (lines.length === 3) break;
  }
  if (line && lines.length < 3) lines.push(line);
  const tw = Math.min(440, Math.max(...lines.map((l) => m.measureText(l).width)));
  const w = Math.ceil(tw + 40);
  const h = lines.length * 42 + 30;
  const texture = canvasTex(w, h + 18, (ctx) => {
    ctx.fillStyle = '#fff';
    ctx.shadowColor = 'rgba(0,0,0,.2)';
    ctx.shadowBlur = 8;
    roundRect(ctx, 4, 4, w - 8, h - 4, 22);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(w / 2 - 12, h - 1);
    ctx.lineTo(w / 2, h + 14);
    ctx.lineTo(w / 2 + 12, h - 1);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = '#111827';
    ctx.font = `600 ${size}px ${FONT}`;
    ctx.textBaseline = 'top';
    lines.forEach((l, i) => ctx.fillText(l, 20, 18 + i * 42, w - 40));
  });
  return { texture, aspect: w / (h + 18) };
}

// ------------------------------------------------------- fabrics
const fabricCache = new Map();
export function fabricTexture(pattern, color) {
  const key = pattern + color;
  if (fabricCache.has(key)) return fabricCache.get(key);
  const c = new THREE.Color(color);
  const hsl = {};
  c.getHSL(hsl);
  const alt = new THREE.Color().setHSL((hsl.h + 0.45) % 1, 0.75, 0.5).getStyle();
  const dark = new THREE.Color().setHSL(hsl.h, hsl.s, Math.max(0.12, hsl.l - 0.25)).getStyle();
  const t = canvasTex(128, 128, (ctx, w, h) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, h);
    if (pattern === 'kitenge') {
      for (let y = 0; y < 4; y++)
        for (let x = 0; x < 4; x++) {
          const cx = x * 32 + (y % 2) * 16 + 8;
          const cy = y * 32 + 16;
          ctx.fillStyle = dark;
          ctx.beginPath();
          ctx.arc(cx, cy, 12, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = alt;
          ctx.beginPath();
          ctx.arc(cx, cy, 6, 0, Math.PI * 2);
          ctx.fill();
        }
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      for (let y = 0; y < h; y += 32) {
        ctx.beginPath();
        for (let x = 0; x <= w; x += 8) ctx.lineTo(x, y + (x % 16 ? 4 : -4));
        ctx.stroke();
      }
    } else if (pattern === 'kanga') {
      ctx.fillStyle = dark;
      ctx.fillRect(0, 0, w, 14);
      ctx.fillRect(0, h - 14, w, 14);
      ctx.fillStyle = alt;
      for (let y = 26; y < h - 20; y += 22) for (let x = 10 + (y % 44 ? 11 : 0); x < w; x += 22) {
        ctx.beginPath();
        ctx.ellipse(x, y, 4, 7, Math.PI / 4, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (pattern === 'stripes') {
      ctx.fillStyle = alt;
      for (let y = 0; y < h; y += 32) ctx.fillRect(0, y, w, 6);
    } else if (pattern === 'jersey') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 54, w, 12);
      ctx.font = `800 40px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('10', 64, 110);
    }
  }, { repeat: pattern === 'jersey' ? [1, 1] : [2, 2] });
  fabricCache.set(key, t);
  return t;
}

// ------------------------------------------------------- facades
let windowTex;
export function windowTexture() {
  if (windowTex) return windowTex;
  windowTex = canvasTex(64, 64, (ctx) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#7aa7c7';
    for (let y = 6; y < 64; y += 16) for (let x = 6; x < 64; x += 16) ctx.fillRect(x, y, 9, 10);
  }, { repeat: [1, 1] });
  return windowTex;
}

let dashTex;
export function roadDashTexture() {
  if (dashTex) return dashTex;
  dashTex = canvasTex(64, 8, (ctx) => {
    ctx.fillStyle = '#6b7280';
    ctx.fillRect(0, 0, 64, 8);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(4, 3, 30, 2);
  }, { repeat: [1, 1] });
  return dashTex;
}

// ------------------------------------------------------- billboards
const imgCache = new Map();
function loadImage(src) {
  if (imgCache.has(src)) return imgCache.get(src);
  const p = new Promise((res, rej) => {
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.onload = () => res(im);
    im.onerror = rej;
    im.src = src;
  });
  imgCache.set(src, p);
  return p;
}

export function adTexture(ad, slotName) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const ctx = c.getContext('2d');
  const drawText = () => {
    const g = ctx.createLinearGradient(0, 120, 0, 256);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, ad?.image ? 'rgba(0,0,0,.65)' : 'rgba(0,0,0,.15)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 256);
    ctx.fillStyle = '#fff';
    ctx.font = `800 46px ${FONT}`;
    ctx.fillText((ad?.title || (isEn() ? 'Advertise Here!' : 'Tangaza Hapa!')).slice(0, 26), 24, ad?.body ? 186 : 220, 464);
    if (ad?.body) {
      ctx.font = `600 24px ${FONT}`;
      ctx.fillText(ad.body.slice(0, 48), 24, 226, 464);
    }
    ctx.font = `700 16px ${FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.fillText(ad ? `${isEn() ? 'Ad' : 'Tangazo'} · @${ad.username}` : isEn() ? `📢 ${slotName} · Advertise via Phone → Ads` : `📢 ${slotName} · Weka tangazo kwenye Simu → Matangazo`, 24, 36, 464);
    tex.needsUpdate = true;
  };
  ctx.fillStyle = ad?.bg || '#2fb06f';
  ctx.fillRect(0, 0, 512, 256);
  if (!ad) {
    ctx.fillStyle = 'rgba(255,255,255,.12)';
    for (let i = 0; i < 8; i++) ctx.fillRect(i * 70 - 20, 0, 30, 256);
  }
  drawText();
  if (ad?.image) {
    loadImage(`/uploads/${ad.image}`).then((im) => {
      const s = Math.max(512 / im.width, 256 / im.height);
      ctx.drawImage(im, (512 - im.width * s) / 2, (256 - im.height * s) / 2, im.width * s, im.height * s);
      drawText();
    }).catch(() => {});
  }
  return tex;
}
