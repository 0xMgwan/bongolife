// Catalogue thumbnails rendered from the real 3D furniture models, one at a time, on a
// single offscreen canvas (one extra WebGL context for the whole app). Cached as data URLs.
import { useLayoutEffect, useRef } from 'react';
import { createRoot, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { FurnitureModel } from './Furniture.jsx';
import { Vehicle } from './Vehicle.jsx';

const SIZE = 192;
const cache = new Map(); // id -> dataURL
const waiting = new Map(); // id -> [resolve]
const queue = [];
let root = null;
let canvas = null;
let busy = false;

function Shot({ item, done }) {
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
  }, [item]); // eslint-disable-line react-hooks/exhaustive-deps
  return <group ref={group}>{item.el}</group>;
}

function pump() {
  if (busy || !queue.length) return;
  busy = true;
  const item = queue.shift();
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
    cache.set(item.key, url);
    (waiting.get(item.key) || []).forEach((f) => f(url));
    waiting.delete(item.key);
    busy = false;
    // Let the browser breathe between renders.
    setTimeout(pump, 0);
  };
  root.render(
    <>
      <hemisphereLight args={['#ffffff', '#cbd5e1', 1.8]} />
      <directionalLight position={[3, 5, 4]} intensity={1.5} />
      <Shot key={item.key} item={item} done={done} />
    </>,
  );
}

function thumb(key, el) {
  if (cache.has(key)) return Promise.resolve(cache.get(key));
  return new Promise((resolve) => {
    if (!waiting.has(key)) {
      waiting.set(key, []);
      queue.push({ key, el });
    }
    waiting.get(key).push(resolve);
    pump();
  });
}

/** PNG data URL of a furniture item's 3D model. */
export const furnitureThumb = (def) => thumb(`f:${def.id}`, <FurnitureModel def={def} />);
/** PNG data URL of a vehicle in a given colour. */
export const vehicleThumb = (v, color) => thumb(`v:${v.id}:${color}`, <Vehicle kind={v.kind} body={v.body} lux={v.lux} color={color} />);
export const cachedThumb = (key) => cache.get(key) || null;
