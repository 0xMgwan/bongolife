import { placeById, isWater, TRAVEL, ROADS } from '@shared/world.js';
import { placeDoor } from './three/Players.jsx';
import { useStore } from './store.js';
import { local } from './net.js';
import { L, loc } from './i18n.js';

/** Walk to a spot and run `then` on arrival (or now, if already there). */
export function walkTo(pos, then, label) {
  const d = Math.hypot(pos[0] - local.x, pos[1] - local.z);
  if (d < 3) {
    local.target = null;
    then?.();
    return;
  }
  local.target = pos;
  local.arrive = then || null;
  if (label) useStore.getState().toast(L(`🚶 Unaelekea ${label}…`, `🚶 Heading to ${label}…`));
}

export function goToPlace(placeId, open = true) {
  const p = placeById[placeId];
  walkTo(placeDoor(placeId), open ? () => useStore.setState({ sheet: { type: 'place', id: placeId } }) : null, loc(p));
}


// ------------------------------------------------------------------ rides
const clear = (a, b) => {
  const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2);
  for (let i = 1; i < n; i++) if (isWater(a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n)) return false;
  return true;
};
/** A dry, grid-like route (L-shapes, or via the Nyerere bridge) between two points. */
export function routeBetween(from, to) {
  const cands = [
    [from, [from[0], to[1]], to],
    [from, [to[0], from[1]], to],
    [from, [80, from[1]], [80, to[1]], to],
    [from, [from[0], 47], [80, 47], [80, to[1]], to],
    [from, [80, from[1]], [80, 47], [to[0], 47], to],
  ];
  for (const c of cands) if (c.every((p, i) => i === 0 || clear(c[i - 1], p))) return c;
  return [from, to];
}

/** Drive along the actual road grid: nearest road → shortest path over junctions → destination. */
export function roadRoute(from, to) {
  const snap = (p) => {
    let best = null;
    ROADS.forEach(([x1, z1, x2, z2], i) => {
      const x = Math.max(Math.min(x1, x2), Math.min(Math.max(x1, x2), p[0]));
      const z = Math.max(Math.min(z1, z2), Math.min(Math.max(z1, z2), p[1]));
      const d = Math.hypot(x - p[0], z - p[1]);
      if (!best || d < best.d) best = { pt: [x, z], road: i, d };
    });
    return best;
  };
  const a = snap(from);
  const b = snap(to);
  if (!a || !b) return null;
  const key = (p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`;
  const pts = new Map();
  const onRoadPts = ROADS.map(() => []);
  const add = (i, p) => { pts.set(key(p), p); onRoadPts[i].push(p); };
  ROADS.forEach(([x1, z1, x2, z2], i) => {
    add(i, [x1, z1]);
    add(i, [x2, z2]);
    ROADS.forEach(([u1, w1, u2, w2], j) => {
      if (j <= i) return;
      const hi = z1 === z2;
      const hj = w1 === w2;
      if (hi === hj) return;
      const [H, V] = hi ? [[x1, z1, x2, z2], [u1, w1, u2, w2]] : [[u1, w1, u2, w2], [x1, z1, x2, z2]];
      const x = V[0];
      const z = H[1];
      if (x >= Math.min(H[0], H[2]) && x <= Math.max(H[0], H[2]) && z >= Math.min(V[1], V[3]) && z <= Math.max(V[1], V[3])) {
        add(i, [x, z]);
        add(j, [x, z]);
      }
    });
  });
  add(a.road, a.pt);
  add(b.road, b.pt);
  const edges = new Map();
  const link = (p, q) => {
    const d = Math.hypot(p[0] - q[0], p[1] - q[1]);
    for (const [u, v] of [[p, q], [q, p]]) {
      if (!edges.has(key(u))) edges.set(key(u), []);
      edges.get(key(u)).push([key(v), d]);
    }
  };
  onRoadPts.forEach((list, i) => {
    const [x1, z1, x2, z2] = ROADS[i];
    const horiz = z1 === z2;
    const sorted = [...list].sort((p, q) => (horiz ? p[0] - q[0] : p[1] - q[1]));
    for (let k = 1; k < sorted.length; k++) link(sorted[k - 1], sorted[k]);
    void x1; void x2;
  });
  // Dijkstra (tiny graph, plain arrays are fine).
  const dist = new Map([[key(a.pt), 0]]);
  const prev = new Map();
  const open = new Set([key(a.pt)]);
  while (open.size) {
    let u = null;
    for (const k of open) if (u === null || dist.get(k) < dist.get(u)) u = k;
    open.delete(u);
    if (u === key(b.pt)) break;
    for (const [v, w] of edges.get(u) || []) {
      const nd = dist.get(u) + w;
      if (nd < (dist.get(v) ?? Infinity)) {
        dist.set(v, nd);
        prev.set(v, u);
        open.add(v);
      }
    }
  }
  if (!dist.has(key(b.pt))) return null;
  const chain = [];
  for (let k = key(b.pt); k; k = prev.get(k)) chain.unshift(pts.get(k));
  return [from, ...chain, to];
}

/** Ride a daladala / bajaji / taxi to a place: the vehicle actually drives there. */
export function startRide(mode, dest, placeId, onArrive) {
  const t = TRAVEL[mode];
  const path = roadRoute([local.x, local.z], dest) || routeBetween([local.x, local.z], dest);
  const len = path.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - path[i - 1][0], p[1] - path[i - 1][1]) : 0), 0);
  // Aim for a 8–25 s trip whatever the distance.
  const speed = Math.max(t.speed, len / 25);
  local.target = null;
  local.ride = { path, seg: 0, d: 0, speed, dest, onArrive };
  useStore.setState({ riding: { mode, placeId, kind: t.kind, color: t.color } });
}
export function skipRide() {
  if (local.ride) local.ride.skip = true;
}
