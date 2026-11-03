// Still portraits of characters for lists (dating cards etc.). Each live <Canvas> costs a WebGL
// context and phones only allow a handful — a grid of 30 live previews blanked the images and
// then knocked out the game's own canvas. Here one hidden renderer draws each look once, caches
// it as an image, and every card is a plain <img>.
import { useEffect, useState } from 'react';
import { createRoot } from '@react-three/fiber';
import { Avatar } from '../three/Avatar.jsx';

const W = 240;
const H = 280;
const cache = new Map(); // key → data URL
const waiting = new Map(); // key → Promise
let root = null;
let canvas = null;
let queue = Promise.resolve();

const keyOf = (a) => JSON.stringify(a || {});
const settle = () => new Promise((r) => setTimeout(r, 30)); // rAF stalls in hidden tabs

function Pose({ appearance }) {
  return (
    <group position={[0, -1, 0]} rotation={[0, 0.3, 0]}>
      <Avatar appearance={appearance} motion={{ current: { mode: 'idle' } }} />
    </group>
  );
}

async function draw(appearance) {
  if (!root) {
    canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    root = createRoot(canvas);
    root.configure({
      frameloop: 'never',
      flat: true,
      dpr: 1,
      size: { width: W, height: H, top: 0, left: 0 },
      camera: { fov: 30, position: [0, -0.1, 3.7] },
      gl: { alpha: true, antialias: true, preserveDrawingBuffer: true, powerPreference: 'low-power' },
    });
  }
  const store = root.render(
    <>
      <hemisphereLight args={['#ffffff', '#b9c7d6', 1.6]} />
      <directionalLight position={[2, 4, 3]} intensity={1.4} />
      <Pose appearance={appearance} />
    </>,
  );
  await settle(); // let React commit the new look
  const st = store.getState();
  const t = performance.now();
  st.advance(t, true);
  st.advance(t + 16, true);
  return canvas.toDataURL('image/png');
}

function portrait(appearance) {
  const k = keyOf(appearance);
  if (cache.has(k)) return Promise.resolve(cache.get(k));
  if (!waiting.has(k)) {
    const p = (queue = queue.then(() => draw(appearance)).then((url) => { cache.set(k, url); waiting.delete(k); return url; }).catch(() => { waiting.delete(k); return null; }));
    waiting.set(k, p);
  }
  return waiting.get(k);
}

export function AvatarPortrait({ appearance, alt = '' }) {
  const k = keyOf(appearance);
  const [url, setUrl] = useState(() => cache.get(k) || null);
  useEffect(() => {
    let live = true;
    setUrl(cache.get(k) || null);
    portrait(appearance).then((u) => live && setUrl(u));
    return () => { live = false; };
  }, [k]); // eslint-disable-line react-hooks/exhaustive-deps
  return url ? <img className="av-portrait" src={url} alt={alt} draggable={false} /> : <div className="av-portrait loading" />;
}
