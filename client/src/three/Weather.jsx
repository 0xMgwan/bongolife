// Live weather in the city: the real current weather of the city you're in (from the server),
// drawn as rain streaks around the camera, a greyer sky and shorter fog, and lightning in storms.
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { cityAt } from '@shared/world.js';
import { useStore } from '../store.js';
import { local } from '../net.js';

/** The weather where the player is now, or null. */
export function weatherHere() {
  const w = useStore.getState().world?.weather;
  const c = cityAt(local.x, local.z)?.id || 'dar';
  return w?.[c] || null;
}
/** 0 (clear) … 1 (storm): how grey and dim the day gets. */
export function gloomOf(code) {
  if (code == null) return 0;
  if (code >= 95) return 0.8;
  if (code >= 80) return code === 82 ? 0.7 : 0.55;
  if (code >= 61) return code >= 65 ? 0.7 : 0.55;
  if (code >= 51) return 0.35;
  if (code >= 45) return 0.4;
  if (code === 3) return 0.25;
  if (code === 2) return 0.08;
  return 0;
}
/** 0 … 1: how hard it rains. */
export function rainOf(code) {
  if (code == null) return 0;
  if (code >= 95 || code === 82 || code === 65 || code === 67) return 1;
  if ((code >= 61 && code <= 66) || (code >= 80 && code <= 81)) return 0.65;
  if (code >= 51 && code <= 57) return 0.25;
  return 0;
}
export const isStorm = (code) => code >= 95;

const SPAN = 46; // half-width of the rain box around the camera
const TOP = 34;
const rainMat = new THREE.LineBasicMaterial({ color: '#eef6ff', transparent: true, opacity: 0.8, depthWrite: false });

export function Rain({ lowEnd }) {
  const n = lowEnd ? 700 : 1800;
  const ref = useRef();
  const center = useMemo(() => new THREE.Vector3(), []);
  const dir = useMemo(() => new THREE.Vector3(), []);
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(n * 6);
    for (let i = 0; i < n; i++) {
      const x = (Math.random() * 2 - 1) * SPAN, y = Math.random() * TOP, z = (Math.random() * 2 - 1) * SPAN;
      p.set([x, y, z, x + 0.18, y - 1.5, z + 0.08], i * 6);
    }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    g.setDrawRange(0, 0);
    return g;
  }, [n]);
  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const w = weatherHere();
    const amount = rainOf(w?.code);
    const shown = Math.floor(n * amount);
    geom.setDrawRange(0, shown * 2);
    if (!ref.current) return;
    ref.current.visible = shown > 0;
    if (!shown) return;
    // Keep the box under the camera's gaze.
    state.camera.getWorldDirection(dir);
    center.copy(state.camera.position).addScaledVector(dir, 26);
    ref.current.position.set(center.x, 0, center.z);
    const p = geom.attributes.position.array;
    const fall = (22 + amount * 10) * dt;
    for (let i = 0; i < shown; i++) {
      const o = i * 6;
      p[o + 1] -= fall; p[o + 4] -= fall;
      p[o] += 0.08 * fall; p[o + 3] += 0.08 * fall; // a little wind
      if (p[o + 4] < 0) {
        const x = (Math.random() * 2 - 1) * SPAN, z = (Math.random() * 2 - 1) * SPAN;
        p[o] = x; p[o + 1] = TOP; p[o + 2] = z;
        p[o + 3] = x + 0.18; p[o + 4] = TOP - 1.5; p[o + 5] = z + 0.08;
      }
    }
    geom.attributes.position.needsUpdate = true;
  });
  return <lineSegments ref={ref} geometry={geom} material={rainMat} frustumCulled={false} renderOrder={5} />;
}
