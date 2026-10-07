// Catalogue thumbnails rendered from the real 3D furniture models, one at a time, on a
// single offscreen canvas (one extra WebGL context for the whole app). Cached as data URLs.
import { useLayoutEffect, useRef } from 'react';
import { createRoot, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { FurnitureModel } from './Furniture.jsx';

const SIZE = 192;
const cache = new Map(); // id -> dataURL
const waiting = new Map(); // id -> [resolve]
const queue = [];
let root = null;
let canvas = null;
let busy = false;

function Shot({ def, done }) {
  const group = useRef();
  const { gl, scene, camera } = useThree();
  useLayoutEffect(() => {
    // Frame the model from a 3/4 view, fitted to its bounding box.
    const box = new THREE.Box3().setFromObject(group.current);
    const size = box.getSize(new THREE.Vector3());
    const c = box.getCenter(new THREE.Vector3());
    const r = Math.max(size.x, size.y * 1.1, size.z) * 0.62 + 0.15;
    const dist = r / Math.tan(((camera.fov / 2) * Math.PI) / 180);
    camera.position.set(c.x + dist * 0.62, c.y + dist * 0.5, c.z + dist * 0.62);
    camera.lookAt(c);
    camera.updateProjectionMatrix();
    gl.render(scene, camera);
    done(gl.domElement.toDataURL('image/png'));
  }, [def]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <group ref={group}>
      <FurnitureModel def={def} />
    </group>
  );
}

function pump() {
  if (busy || !queue.length) return;
  busy = true;
  const def = queue.shift();
  if (!root) {
    canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIZE;
    root = createRoot(canvas);
    root.configure({
      frameloop: 'never',
      size: { width: SIZE, height: SIZE, top: 0, left: 0 },
      dpr: 1,
      camera: { fov: 28, near: 0.05, far: 100 },
      gl: { preserveDrawingBuffer: true, alpha: true, antialias: true },
      flat: true,
    });
  }
  const done = (url) => {
    cache.set(def.id, url);
    (waiting.get(def.id) || []).forEach((f) => f(url));
    waiting.delete(def.id);
    busy = false;
    // Let the browser breathe between renders.
    setTimeout(pump, 0);
  };
  root.render(
    <>
      <hemisphereLight args={['#ffffff', '#cbd5e1', 1.8]} />
      <directionalLight position={[3, 5, 4]} intensity={1.5} />
      <Shot key={def.id} def={def} done={done} />
    </>,
  );
}

/** Promise of a PNG data URL of the item's 3D model. */
export function furnitureThumb(def) {
  if (cache.has(def.id)) return Promise.resolve(cache.get(def.id));
  return new Promise((resolve) => {
    if (!waiting.has(def.id)) {
      waiting.set(def.id, []);
      queue.push(def);
    }
    waiting.get(def.id).push(resolve);
    pump();
  });
}
export const cachedThumb = (id) => cache.get(id) || null;
