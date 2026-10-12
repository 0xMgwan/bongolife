// Yacht and private-jet scenes. The owner's model (size tier) and colour come from the store
// (`boat`), so every owner's yacht/jet looks like theirs. Scene-local coords: +z towards the
// camera, the yacht's bow and the jet's cockpit point to -z.
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { luxuryById } from '@shared/world.js';
import { mat, geo, labelTexture } from './textures.js';
import { useStore } from '../store.js';
import { Crowd, Person, NPC_LOOKS } from './Scenes.jsx';

const unit = new THREE.BoxGeometry(1, 1, 1);
function B({ p = [0, 0, 0], s, c, m, r }) {
  return <mesh geometry={unit} material={m || mat(c)} position={p} scale={s} rotation={r} />;
}
const phong = (color, shininess = 60, extra = {}) => new THREE.MeshPhongMaterial({ color, shininess, specular: new THREE.Color('#ffffff').multiplyScalar(0.35), ...extra });
const glow = (color, k = 1) => new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), toneMapped: false });

const M = {
  white: phong('#f8fafc', 80),
  hullWhite: phong('#ffffff', 110),
  chrome: phong('#e2e8f0', 140, { specular: new THREE.Color('#ffffff') }),
  glass: phong('#0b1626', 140, { specular: new THREE.Color('#9fc3e8') }),
  navy: phong('#1e293b', 40),
  cream: phong('#f5ead7', 25),
  leather: phong('#efe2c8', 45),
  walnut: phong('#5b3a1f', 70),
  marble: phong('#f4f1ec', 120),
  carpet: mat('#d6c7ad'),
  runner: mat('#b9a586'),
  cushion: mat('#f8fafc'),
  water: new THREE.MeshPhongMaterial({ color: '#1593c7', shininess: 120, specular: '#bfe9ff', transparent: true, opacity: 0.92 }),
  jacuzzi: glow('#5eead4', 1.1),
  led: glow('#ffd9a0', 1.4),
  ledCyan: glow('#67e8f9', 1.3),
  sky: glow('#bfe3ff', 1),
  instruments: glow('#38bdf8', 1.2),
};
const paintCache = new Map();
const paint = (c) => paintCache.get(c) || (paintCache.set(c, phong(c, 110)), paintCache.get(c));

// ---------------------------------------------------------------- shared bits
function teakTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const x = c.getContext('2d');
  for (let i = 0; i < 8; i++) {
    x.fillStyle = ['#b07a45', '#a8703d', '#b8824c', '#a46c3a'][i % 4];
    x.fillRect(i * 32, 0, 32, 256);
    x.fillStyle = '#3b2412';
    x.fillRect(i * 32 + 30, 0, 2, 256); // caulking
    x.fillRect(i * 32, ((i * 97) % 256), 32, 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.repeat.set(0.5, 0.5);
  return t;
}
let teakMat = null;
const teak = () => (teakMat ||= new THREE.MeshLambertMaterial({ map: teakTexture() }));

/** Extrude a plan outline (x, z) downwards from y = top by `depth`; optional taper to the keel. */
function planSlab(pts, depth, top, taper = 0, bevel = 0) {
  const shape = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, z)));
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 10 });
  g.rotateX(Math.PI / 2);
  g.translate(0, top, 0);
  if (taper) {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const k = Math.min(1, Math.max(0, (top - p.getY(i)) / depth));
      p.setX(i, p.getX(i) * (1 - taper * k * k));
    }
    g.computeVertexNormals();
  }
  return g;
}
/** Smooth hull outline: flat transom at +z, fine bow at -z. */
function hullOutline(halfW, stern, shoulder, bow, n = 14) {
  const pts = [[-halfW, stern], [halfW, stern], [halfW, shoulder]];
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    pts.push([halfW * (1 - t) * (1 + 0.15 * Math.sin(t * Math.PI)) * (1 - t * 0.15), shoulder + (bow - shoulder) * Math.pow(t, 0.9)]);
  }
  for (let i = n - 1; i >= 1; i--) {
    const [x, z] = pts[2 + i];
    pts.push([-x, z]);
  }
  pts.push([-halfW, shoulder]);
  return pts;
}

/** Waves: a gently heaving, rippling sea. */
function Ocean({ color = '#0e7ab8', y = -1.6 }) {
  const ref = useRef();
  const g = useMemo(() => new THREE.PlaneGeometry(260, 260, 64, 64).rotateX(-Math.PI / 2), []);
  const base = useMemo(() => Float32Array.from(g.attributes.position.array), [g]);
  const m = useMemo(() => new THREE.MeshPhongMaterial({ color, shininess: 90, specular: new THREE.Color('#d6f1ff'), flatShading: true }), [color]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = base[i * 3];
      const z = base[i * 3 + 2];
      p.array[i * 3 + 1] = Math.sin(x * 0.18 + t * 1.1) * 0.18 + Math.cos(z * 0.22 + t * 0.8) * 0.16 + Math.sin((x + z) * 0.07 + t * 0.5) * 0.25;
    }
    p.needsUpdate = true;
  });
  return <mesh ref={ref} geometry={g} material={m} position={[0, y, 0]} />;
}

/** Foam trail behind the stern while cruising. */
function Wake({ z = 9.5, w = 7, y = -1.45 }) {
  const ref = useRef();
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.children.forEach((c, i) => {
      const k = ((clock.elapsedTime * 0.25 + i / 6) % 1);
      c.position.z = z + k * 30;
      c.scale.set(w * (0.6 + k * 1.6), 1, 2 + k * 3);
      c.material.opacity = 0.55 * (1 - k);
    });
  });
  return (
    <group ref={ref}>
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[0, y, z]}>
          <circleGeometry args={[0.5, 16]} />
          <meshBasicMaterial color="#f0f9ff" transparent opacity={0.4} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

function Island({ p, s = 1 }) {
  return (
    <group position={p} scale={s}>
      <mesh geometry={geo('sphere', 14, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2)} material={mat('#e9d8a6')} scale={[1, 0.16, 0.55]} />
      <mesh geometry={geo('sphere', 10, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2)} material={mat('#3f8f4a')} scale={[1, 0.35, 0.45]} position={[1, 0.4, -1]} />
      {[-6, -2, 3, 7].map((x, i) => (
        <group key={x} position={[x, 1.2, 2.5 - (i % 2)]}>
          <mesh geometry={geo('cyl', 0.18, 0.28, 5, 6)} material={mat('#9a7b4f')} position={[0, 2.5, 0]} rotation={[0, 0, 0.18 - i * 0.1]} />
          <mesh geometry={geo('cone', 2, 0.9, 7)} material={mat('#2f9e57')} position={[0.4, 5, 0]} />
        </group>
      ))}
    </group>
  );
}

function Lounger({ p, ry = 0, accent }) {
  return (
    <group position={p} rotation={[0, ry, 0]}>
      <B p={[0, 0.14, 0]} s={[0.85, 0.28, 2]} m={M.white} />
      <B p={[0, 0.34, 0.15]} s={[0.8, 0.12, 1.6]} m={M.cushion} />
      <B p={[0, 0.5, -0.78]} s={[0.8, 0.12, 0.5]} m={M.cushion} r={[0.55, 0, 0]} />
      <B p={[0, 0.41, 0.35]} s={[0.6, 0.02, 0.9]} c={accent} />
    </group>
  );
}

// ---------------------------------------------------------------- the yacht
export function Yacht({ me, myBusy, people }) {
  const boat = useStore((s) => s.boat);
  const model = luxuryById[boat?.model] || luxuryById['yacht-m'];
  const tier = model.tier;
  const color = boat?.color || '#f8fafc';
  const accent = color === '#f8fafc' ? '#1e3a8a' : color;
  const rock = useRef();
  useFrame(({ clock }) => {
    if (!rock.current) return;
    const t = clock.elapsedTime;
    rock.current.rotation.z = Math.sin(t * 0.7) * 0.012;
    rock.current.rotation.x = Math.sin(t * 0.5) * 0.008;
    rock.current.position.y = Math.sin(t * 0.9) * 0.05;
  });
  const parts = useMemo(() => {
    const hw = tier === 1 ? 3.7 : 4;
    const bow = tier === 3 ? -22 : tier === 2 ? -18 : -15;
    const outline = hullOutline(hw, 8.2, -6, bow);
    const inner = outline.map(([x, z]) => [x * 0.93, z > 0 ? z - 0.2 : z * 0.97]);
    const cabin = [[-3, -2.4], [3, -2.4], [3, -8], [1.7, -10.6], [-1.7, -10.6], [-3, -8]];
    const fly = [[-3.1, -1.7], [3.1, -1.7], [3.1, -8], [1.6, -10.4], [-1.6, -10.4], [-3.1, -8]];
    const top3 = [[-2.4, -4], [2.4, -4], [2.4, -8], [1.2, -9.6], [-1.2, -9.6], [-2.4, -8]];
    // rail posts along the deck edge (open at the transom)
    const rail = [];
    for (let i = 0; i < inner.length; i++) {
      const a = inner[i];
      const b = inner[(i + 1) % inner.length];
      if (a[1] > 7.5 && b[1] > 7.5) continue;
      rail.push([a, b]);
    }
    return {
      hull: planSlab(outline, 2.5, 0.35, 0.32),
      stripe: planSlab(outline.map(([x, z]) => [x * 1.005, z]), 0.32, -1.05, 0),
      underglow: planSlab(outline.map(([x, z]) => [x * 0.97, z]), 0.06, -1.4, 0),
      deck: planSlab(inner, 0.2, 0.4),
      cabin: planSlab(cabin, 2.3, 2.7),
      band: planSlab(cabin.map(([x, z]) => [x * 1.015, z < -3 ? z * 1.004 : z + 0.02]), 0.85, 2.15),
      fly: planSlab(fly, 0.16, 2.86),
      top3: planSlab(top3, 1.8, 4.7),
      top3band: planSlab(top3.map(([x, z]) => [x * 1.02, z * 1.003]), 0.6, 4.4),
      rail,
      inner,
    };
  }, [tier]);
  const D = 0.4; // deck height
  const slots = useMemo(() => [[-1.2, D, 5.6, Math.PI], [1.6, D, 2.6, -2.4], [-0.5, D, 2.2, 2.6], [2.2, D, 1.6, Math.PI * 0.6], [-1.2, D, 0.2, 0.4], [0.9, D, 0.8, Math.PI], [-2.6, D, 3.6, Math.PI], [2.6, D, 4.2, Math.PI]], []);
  return (
    <group>
      <Ocean />
      <Wake />
      <Island p={[-38, -1.6, -70]} s={1.4} />
      <Island p={[46, -1.6, -95]} s={1} />
      <mesh position={[30, 18, -150]}><circleGeometry args={[10, 32]} /><meshBasicMaterial color="#fff2c7" toneMapped={false} /></mesh>
      <group ref={rock}>
        {/* hull, stripe, waterline glow */}
        <mesh geometry={parts.hull} material={tier === 3 ? paint(color) : M.hullWhite} />
        <mesh geometry={parts.stripe} material={tier === 3 ? M.navy : paint(accent)} />
        <mesh geometry={parts.underglow} material={M.ledCyan} />
        {/* hull windows */}
        {[-1, 1].map((s) => [-4, -6.5, -9].map((z) => <B key={`${s}${z}`} p={[s * 3.92, -0.45, z]} s={[0.05, 0.22, 1.6]} m={M.glass} />))}
        <mesh geometry={parts.deck} material={teak()} />
        {/* rails */}
        {parts.rail.map(([a, b], i) => {
          const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
          return (
            <group key={i}>
              <B p={[(a[0] + b[0]) / 2, D + 1.0, (a[1] + b[1]) / 2]} s={[0.05, 0.05, len + 0.03]} r={[0, Math.atan2(b[0] - a[0], b[1] - a[1]), 0]} m={M.chrome} />
              <B p={[a[0], D + 0.5, a[1]]} s={[0.04, 1, 0.04]} m={M.chrome} />
              {tier >= 2 && <B p={[(a[0] + b[0]) / 2, D + 0.45, (a[1] + b[1]) / 2]} s={[0.02, 0.8, len]} r={[0, Math.atan2(b[0] - a[0], b[1] - a[1]), 0]} m={M.glass} />}
            </group>
          );
        })}
        {/* swim platform + steps */}
        <B p={[0, -0.5, 8.8]} s={[6.6, 0.16, 1.4]} m={teak()} />
        {[-1.2, 1.2].map((x) => <B key={x} p={[x, 0.0, 8.25]} s={[1.2, 0.18, 0.4]} m={teak()} />)}
        {/* main cabin with wraparound glass, saloon doors */}
        <mesh geometry={parts.cabin} material={M.white} />
        <mesh geometry={parts.band} material={M.glass} />
        <B p={[0, D + 1.05, -2.38]} s={[4.2, 2, 0.05]} m={M.glass} />
        <B p={[0, D + 2.05, -2.36]} s={[4.2, 0.06, 0.04]} m={M.led} />
        {/* flybridge / sun deck */}
        <mesh geometry={parts.fly} material={M.white} />
        {[-0.8, 0.8].map((x) => [-1.95, -2.15].map((z) => <B key={`${x}${z}`} p={[x, 2.66, z]} s={[0.12, 0.04, 0.12]} m={M.led} />))}
        <group position={[0, 2.86, 0]}>
          {[-1.6, 0, 1.6].map((x) => <Lounger key={x} p={[x, 0, -3.6]} accent={accent} />)}
          <B p={[0, 0.5, -8.2]} s={[2.2, 1, 0.8]} m={M.white} />
          <B p={[0, 1.05, -8.4]} s={[2, 0.5, 0.06]} m={M.glass} r={[-0.5, 0, 0]} />
          <B p={[0, 1.04, -8.15]} s={[0.9, 0.05, 0.4]} m={M.instruments} />
          <Person slot={[0.4, 0, -7.4, Math.PI]} appearance={{ ...NPC_LOOKS[3], outfit: 'suti' }} mode="idle" />
          {/* radar arch */}
          {[-1.4, 1.4].map((x) => <B key={x} p={[x, 1.1, -5.9]} s={[0.25, 2.3, 0.9]} r={[0.25, 0, x * -0.06]} m={M.white} />)}
          <B p={[0, 2.25, -6.2]} s={[3.2, 0.25, 1]} m={M.white} />
          <mesh geometry={geo('cyl', 0.35, 0.35, 0.18, 16)} material={M.white} position={[0, 2.5, -6.2]} />
          <B p={[0, 3.1, -6.3]} s={[0.05, 1.1, 0.05]} m={M.chrome} />
          {tier >= 2 && <B p={[0, 2.38, -4.2]} s={[5.6, 0.1, 4.4]} m={M.white} />}
          {tier >= 2 && [-2.6, 2.6].map((x) => <B key={x} p={[x, 1.2, -2.3]} s={[0.08, 2.4, 0.08]} m={M.chrome} />)}
        </group>
        {/* third deck + helipad + pool (superyacht) */}
        {tier === 3 && (
          <>
            <mesh geometry={parts.top3} material={M.white} />
            <mesh geometry={parts.top3band} material={M.glass} />
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, D + 0.12, -15]}><circleGeometry args={[2.4, 32]} /><meshLambertMaterial color="#334155" /></mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, D + 0.13, -15]}><ringGeometry args={[2.1, 2.25, 32]} /><meshBasicMaterial color="#facc15" /></mesh>
            <HelipadH p={[0, D + 0.14, -15]} />
            <B p={[0, 2.95, -1.0]} s={[3.6, 0.2, 1.3]} m={M.white} />
          </>
        )}
        {tier < 3 && [-1, 1].map((s) => <Lounger key={s} p={[s * 0.9, D, -12.4]} ry={Math.PI} accent={accent} />)}
        {/* aft deck: sun loungers */}
        {[-1.9, 0, 1.9].map((x) => <Lounger key={x} p={[x, D, 4.4]} accent={accent} />)}
        {/* jacuzzi */}
        <group position={[-2.3, D, 1.3]}>
          <mesh geometry={geo('cyl', 1.05, 1.05, 0.55, 28)} material={M.white} position={[0, 0.27, 0]} />
          <mesh geometry={geo('cyl', 0.9, 0.9, 0.02, 28)} material={M.jacuzzi} position={[0, 0.5, 0]} />
          <Bubbles />
        </group>
        {/* bar */}
        <group position={[2.85, D, 0]}>
          <B p={[0, 0.5, 0]} s={[0.9, 1, 2.2]} m={M.walnut} />
          <B p={[0, 1.03, 0]} s={[1.05, 0.06, 2.35]} m={M.marble} />
          <B p={[-0.47, 0.3, 0]} s={[0.02, 0.05, 2.1]} m={M.led} />
          {[-0.7, 0, 0.7].map((z, i) => <mesh key={z} geometry={geo('cyl', 0.06, 0.06, 0.32, 8)} material={glow(['#22c55e', '#f59e0b', '#a855f7'][i], 0.9)} position={[0.1, 1.22, z]} />)}
          <mesh geometry={geo('cyl', 0.14, 0.11, 0.2, 12)} material={M.chrome} position={[0.15, 1.16, 0.95]} />
          {[-0.6, 0.4].map((z) => <mesh key={z} geometry={geo('cyl', 0.2, 0.2, 0.7, 12)} material={M.chrome} position={[-0.85, 0.35, z]} />)}
          <Person slot={[0.75, 0, -0.3, -Math.PI / 2]} appearance={{ ...NPC_LOOKS[8], outfit: 'shati' }} mode="idle" />
        </group>
        {/* DJ booth */}
        <group position={[0, D, -1.5]}>
          <B p={[0, 0.5, 0]} s={[1.6, 1, 0.6]} m={M.navy} />
          <B p={[0, 0.5, 0.31]} s={[1.5, 0.12, 0.02]} m={glow(accent === '#1e3a8a' ? '#60a5fa' : accent, 1.3)} />
          {[-0.45, 0.45].map((x) => <mesh key={x} geometry={geo('cyl', 0.2, 0.2, 0.04, 16)} material={M.chrome} position={[x, 1.03, 0]} />)}
          {[-1.15, 1.15].map((x) => <B key={x} p={[x, 0.6, -0.1]} s={[0.5, 1.2, 0.45]} m={M.navy} />)}
        </group>
        {/* dining */}
        <group position={[-1.8, D, -1.3]}>
          <mesh geometry={geo('cyl', 0.6, 0.6, 0.05, 20)} material={M.marble} position={[0, 0.75, 0]} />
          <mesh geometry={geo('cyl', 0.06, 0.2, 0.75, 8)} material={M.chrome} position={[0, 0.37, 0]} />
          {[0, 1, 2, 3].map((i) => <B key={i} p={[Math.sin(i * 1.57 + 0.78) * 0.85, 0.24, Math.cos(i * 1.57 + 0.78) * 0.85]} s={[0.42, 0.45, 0.42]} m={M.cushion} />)}
          {[0, 1, 2].map((i) => <mesh key={i} geometry={geo('cyl', 0.13, 0.13, 0.015, 14)} material={mat('#ffffff')} position={[Math.sin(i * 2.1) * 0.35, 0.79, Math.cos(i * 2.1) * 0.35]} />)}
        </group>
        {/* fishing rods + jet ski */}
        {[2.8, 3.2].map((x) => <mesh key={x} geometry={geo('cyl', 0.015, 0.02, 2.6, 5)} material={M.navy} position={[x, D + 1.3, 7.4]} rotation={[0.55, 0, -0.2]} />)}
        <group position={[-2.6, -1.25, 10.8]} rotation={[0, 0.3, 0]}>
          <mesh geometry={geo('sphere', 0.6, 14, 8)} material={paint(accent)} scale={[0.75, 0.42, 2]} />
          <B p={[0, 0.35, -0.1]} s={[0.35, 0.25, 0.9]} m={M.navy} />
          <B p={[0, 0.62, -0.55]} s={[0.7, 0.05, 0.06]} m={M.chrome} />
        </group>
        {/* sunset string lights over the aft deck */}
        {[-3.2, 3.2].map((x) => Array.from({ length: 8 }, (_, i) => <mesh key={`${x}${i}`} geometry={geo('sphere', 0.05, 6, 4)} material={M.led} position={[x * 0.97, D + 1.08, 6.8 - i * 1.15]} />))}
        <Crowd me={me} myBusy={myBusy} people={people} slots={slots} localSlot={[0.6, D, 6.2, Math.PI]} crowd={0} modeFor={() => 'idle'} />
      </group>
    </group>
  );
}

function HelipadH({ p }) {
  const { texture, aspect } = useMemo(() => labelTexture('H', { size: 120, bold: 900, fg: '#ffffff', bg: 'rgba(0,0,0,0)' }), []);
  return (
    <mesh position={p} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[2 * aspect, 2]} />
      <meshBasicMaterial map={texture} transparent />
    </mesh>
  );
}

function Bubbles() {
  const ref = useRef();
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.children.forEach((c, i) => {
      const k = (clock.elapsedTime * 0.7 + i * 0.37) % 1;
      c.position.set(Math.sin(i * 2.3) * 0.6, 0.5 + k * 0.25, Math.cos(i * 1.7) * 0.6);
      c.scale.setScalar(0.6 + k);
      c.material.opacity = 0.8 * (1 - k);
    });
  });
  return (
    <group ref={ref}>
      {Array.from({ length: 10 }, (_, i) => (
        <mesh key={i}>
          <sphereGeometry args={[0.05, 6, 4]} />
          <meshBasicMaterial color="#ecfeff" transparent opacity={0.6} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------- the jet
const R = 1.7; // fuselage radius
const CY = 1.0; // fuselage centre height (floor at y = 0)
function Clouds() {
  const ref = useRef();
  const items = useMemo(() => Array.from({ length: 26 }, (_, i) => ({ x: ((i * 37) % 90) - 45, z: ((i * 53) % 140) - 70, s: 3 + ((i * 7) % 5), y: -10 - ((i * 3) % 6) })), []);
  useFrame((_, dt) => {
    if (!ref.current) return;
    ref.current.children.forEach((c) => {
      c.position.z += dt * 9;
      if (c.position.z > 70) c.position.z -= 140;
    });
  });
  return (
    <group ref={ref}>
      {items.map((c, i) => (
        <group key={i} position={[c.x, c.y, c.z]}>
          {[[0, 0, 0, 1], [c.s * 0.8, -0.3, 0.4, 0.75], [-c.s * 0.7, -0.4, -0.3, 0.7], [0.3, 0.4, c.s * 0.5, 0.6]].map(([x, y, z, k], j) => (
            <mesh key={j} geometry={geo('sphere', c.s * k, 10, 8)} material={mat('#ffffff')} position={[x, y, z]} scale={[1.3, 0.55, 1]} />
          ))}
        </group>
      ))}
    </group>
  );
}

function Seat({ p, ry = 0 }) {
  return (
    <group position={p} rotation={[0, ry, 0]}>
      <B p={[0, 0.22, 0]} s={[0.72, 0.36, 0.72]} m={M.leather} />
      <B p={[0, 0.72, -0.32]} s={[0.72, 0.9, 0.16]} m={M.leather} r={[-0.08, 0, 0]} />
      {[-0.4, 0.4].map((x) => <B key={x} p={[x, 0.45, 0]} s={[0.1, 0.18, 0.7]} m={M.walnut} />)}
      <B p={[0, 0.04, 0]} s={[0.5, 0.08, 0.5]} m={M.chrome} />
    </group>
  );
}

export function Jet({ me, myBusy, people }) {
  const boat = useStore((s) => s.boat);
  const model = luxuryById[boat?.model] || luxuryById['jet-m'];
  const tier = model.tier;
  const color = boat?.color === '#f8fafc' ? '#1e3a8a' : boat?.color || '#1e3a8a';
  const sway = useRef();
  useFrame(({ clock }) => {
    if (!sway.current) return;
    const t = clock.elapsedTime;
    sway.current.rotation.z = Math.sin(t * 0.4) * 0.01;
    sway.current.position.y = Math.sin(t * 0.6) * 0.04;
  });
  const g = useMemo(() => {
    const L = 17;
    const shell = new THREE.CylinderGeometry(R, R, L, 40, 1, true, -Math.PI * 0.66, Math.PI * 1.32).rotateX(Math.PI / 2);
    const outer = new THREE.CylinderGeometry(R + 0.09, R + 0.09, L, 40, 1, true, -Math.PI * 0.66, Math.PI * 1.32).rotateX(Math.PI / 2);
    const stripe = (a0) => new THREE.CylinderGeometry(R + 0.1, R + 0.1, L, 40, 1, true, a0, Math.PI * 0.08).rotateX(Math.PI / 2);
    const nose = new THREE.SphereGeometry(R + 0.09, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(-Math.PI / 2).scale(1, 1, 2.2);
    const tail = new THREE.SphereGeometry(R + 0.09, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2).scale(1, 1, 3.4);
    const wingShape = new THREE.Shape([new THREE.Vector2(0, 2.4), new THREE.Vector2(0, -1.4), new THREE.Vector2(6.2, 1.6), new THREE.Vector2(6.2, 2.8)]);
    const wing = new THREE.ExtrudeGeometry(wingShape, { depth: 0.18, bevelEnabled: false }).rotateX(Math.PI / 2);
    return { shell, outer, stripes: [stripe(Math.PI * 0.42), stripe(-Math.PI * 0.5)], nose, tail, wing, L };
  }, []);
  const z0 = -8.6;
  const z1 = 7.4;
  const winX = Math.sqrt(R * R - 0.25 * 0.25) - 0.03;
  const windows = [-6.6, -5, -3.4, -1.8, -0.2, 1.4, 4.6, 6];
  const slots = useMemo(() => [[-0.75, 0.05, -5.4, 0], [0.75, 0.05, -5.4, 0], [-0.75, 0.05, -3.4, Math.PI], [0.75, 0.05, -3.4, Math.PI], [-0.95, 0.05, 0.6, Math.PI / 2], [-0.95, 0.05, 1.8, Math.PI / 2]], []);
  return (
    <group>
      <Clouds />
      <group ref={sway}>
        {/* fuselage (cut away on top so you can look in) */}
        <group position={[0, CY, (z0 + z1) / 2 - 0.6]}>
          <mesh geometry={g.shell} material={M.cream} />
          <mesh geometry={g.outer} material={M.hullWhite} />
          {g.stripes.map((s, i) => <mesh key={i} geometry={s} material={paint(color)} />)}
        </group>
        <mesh geometry={g.nose} material={M.hullWhite} position={[0, CY, z0 - 1.5]} />
        <B p={[0, CY + 0.75, z0 - 2.6]} s={[1.6, 0.35, 0.9]} r={[-0.6, 0, 0]} m={M.glass} />
        <mesh geometry={g.tail} material={M.hullWhite} position={[0, CY, z1 + 0.9]} />
        {/* tail fin & engines */}
        <B p={[0, CY + 2.6, z1 + 4.4]} s={[0.18, 3.6, 2.6]} r={[0.45, 0, 0]} m={paint(color)} />
        {tier >= 2 && <B p={[0, CY + 4.2, z1 + 5.4]} s={[4.4, 0.14, 1.1]} m={M.hullWhite} />}
        {[-1, 1].map((s) => (
          <group key={s} position={[s * 2.55, CY + 0.8, z1 + 2.2]}>
            <mesh geometry={geo('cyl', 0.62, 0.55, 3, 20)} material={M.hullWhite} rotation={[Math.PI / 2, 0, 0]} />
            <mesh geometry={geo('cyl', 0.5, 0.5, 0.05, 20)} material={M.navy} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -1.5]} />
            <B p={[-s * 0.6, 0, 0]} s={[0.7, 0.16, 1.2]} m={M.hullWhite} />
          </group>
        ))}
        {/* wings + winglets */}
        {[-1, 1].map((s) => (
          <group key={s} position={[s * (R - 0.1), 0.25, -1.4]} scale={[s, 1, 1]}>
            <mesh geometry={g.wing} material={M.hullWhite} />
            <B p={[6.15, 0.65, 2.3]} s={[0.12, 1.3, 1.1]} r={[0.35, 0, 0]} m={paint(color)} />
          </group>
        ))}
        {/* floor, carpet runner, wood trim */}
        <B p={[0, -0.03, (z0 + z1) / 2]} s={[2.8, 0.06, z1 - z0]} m={M.carpet} />
        <B p={[0, 0.005, (z0 + z1) / 2 - 1]} s={[0.9, 0.01, z1 - z0 - 3]} m={M.runner} />
        {[-1, 1].map((s) => <B key={s} p={[s * 1.38, 0.32, (z0 + z1) / 2]} s={[0.06, 0.06, z1 - z0]} m={M.walnut} />)}
        {/* windows (lit sky inside, glass outside) + LED cove lighting */}
        {[-1, 1].map((s) => windows.map((z) => (
          <group key={`${s}${z}`}>
            <mesh geometry={geo('circle', 0.2, 18)} material={M.sky} position={[s * winX, CY + 0.25, z]} rotation={[0, -s * Math.PI / 2, 0]} scale={[0.85, 1.25, 1]} />
            <mesh geometry={geo('circle', 0.2, 18)} material={M.glass} position={[s * (R + 0.1), CY + 0.25, z]} rotation={[0, s * Math.PI / 2, 0]} scale={[0.85, 1.25, 1]} />
          </group>
        )))}
        {[-1, 1].map((s) => <B key={s} p={[s * 1.5, 1.66, (z0 + z1) / 2]} s={[0.04, 0.03, z1 - z0]} m={M.led} />)}
        {/* cockpit bulkhead + door glow */}
        {[-1, 1].map((s) => <B key={s} p={[s * 0.95, 0.95, z0]} s={[0.9, 1.9, 0.08]} m={M.walnut} />)}
        <B p={[0, 1.85, z0]} s={[1, 0.1, 0.08]} m={M.walnut} />
        <B p={[0, 1.0, z0 - 0.6]} s={[0.9, 0.35, 0.05]} m={M.instruments} />
        {/* galley bar */}
        <group position={[0.98, 0, -7.4]}>
          <B p={[0, 0.5, 0]} s={[0.6, 1, 1.5]} m={M.walnut} />
          <B p={[0, 1.02, 0]} s={[0.66, 0.05, 1.56]} m={M.marble} />
          {[-0.45, -0.15, 0.15].map((z, i) => <mesh key={z} geometry={geo('cyl', 0.05, 0.05, 0.3, 8)} material={glow(['#facc15', '#22c55e', '#f8fafc'][i], 0.9)} position={[0.05, 1.2, z]} />)}
          <mesh geometry={geo('cyl', 0.12, 0.1, 0.18, 12)} material={M.chrome} position={[0.05, 1.13, 0.5]} />
        </group>
        {/* club seating with tables */}
        <Seat p={[-0.75, 0, -5.6]} />
        <Seat p={[0.75, 0, -5.6]} />
        <Seat p={[-0.75, 0, -3.2]} ry={Math.PI} />
        <Seat p={[0.75, 0, -3.2]} ry={Math.PI} />
        {[-0.75, 0.75].map((x) => <B key={x} p={[x, 0.7, -4.4]} s={[0.62, 0.05, 0.75]} m={M.walnut} />)}
        {[-0.75, 0.75].map((x) => <mesh key={x} geometry={geo('cyl', 0.04, 0.04, 0.18, 8)} material={glow('#fde68a', 0.9)} position={[x - 0.15, 0.82, -4.3]} />)}
        {/* divan + TV */}
        <B p={[-1.05, 0.22, 1.2]} s={[0.62, 0.44, 2.6]} m={M.leather} />
        <B p={[-1.32, 0.6, 1.2]} s={[0.14, 0.6, 2.6]} m={M.leather} />
        {[0.4, 1.3, 2.1].map((z, i) => <B key={z} p={[-1.1, 0.55, z]} s={[0.12, 0.3, 0.4]} r={[0, 0, 0.3]} c={i === 1 ? color : '#f5ead7'} />)}
        <B p={[1.32, 1.15, 1.3]} s={[0.05, 0.62, 1.05]} m={M.navy} />
        <B p={[1.29, 1.15, 1.3]} s={[0.01, 0.55, 0.97]} m={glow('#60a5fa', 0.8)} />
        {/* bedroom partition, bed, nightstands */}
        {[-1, 1].map((s) => <B key={s} p={[s * 0.98, 0.95, 3.6]} s={[0.8, 1.9, 0.08]} m={M.walnut} />)}
        <B p={[0, 0.25, 5.6]} s={[1.7, 0.5, 2.6]} m={M.white} />
        <B p={[0, 0.55, 5.8]} s={[1.65, 0.12, 2.2]} m={mat(color)} />
        {[-0.45, 0.45].map((x) => <B key={x} p={[x, 0.65, 6.6]} s={[0.6, 0.18, 0.35]} m={M.cushion} />)}
        <B p={[0, 0.85, 7.0]} s={[1.9, 1.2, 0.12]} m={M.leather} />
        {[-1.15, 1.15].map((x) => (
          <group key={x}>
            <B p={[x, 0.25, 6.6]} s={[0.4, 0.5, 0.4]} m={M.walnut} />
            <mesh geometry={geo('sphere', 0.1, 10, 8)} material={M.led} position={[x, 0.65, 6.6]} />
          </group>
        ))}
        <Person slot={[0.3, 0, -8.1, 0]} appearance={{ ...NPC_LOOKS[5], outfit: 'suti' }} mode="idle" />
        <Crowd me={me} myBusy={myBusy} people={people} slots={slots} localSlot={[0, 0.05, -2.2, Math.PI]} crowd={0} modeFor={(who) => (who === 'me' ? 'idle' : 'sit')} />
      </group>
    </group>
  );
}
