import * as THREE from 'three';
import { mat, geo } from './textures.js';
import { shadowMat } from './Avatar.jsx';

const TIRE = mat('#111827');
const GLASS = mat('#9ec5e8');
const LIGHT = mat('#fef9c3');
const CHROME = mat('#cbd5e1');

function Wheels({ pts, r = 0.32, w = 0.22 }) {
  return pts.map(([x, z], i) => <mesh key={i} geometry={geo('cyl', r, r, w, 10)} material={TIRE} position={[x, r, z]} rotation={[0, 0, Math.PI / 2]} />);
}

/** Faces +z. Scale ~ real metres. */
export function Vehicle({ kind, color = '#e5e7eb', body: bodyStyle, lux }) {
  const body = mat(color);
  switch (kind) {
    case 'bike':
      return (
        <group>
          <mesh geometry={geo('circle', 0.6, 12)} material={shadowMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} scale={[0.5, 1.4, 1]} />
          <Wheels pts={[[0, 0.55], [0, -0.55]]} r={0.33} w={0.06} />
          <mesh geometry={geo('box', 0.06, 0.06, 1.1)} material={body} position={[0, 0.55, 0]} />
          <mesh geometry={geo('box', 0.5, 0.05, 0.05)} material={TIRE} position={[0, 0.95, 0.45]} />
        </group>
      );
    case 'moto':
      return (
        <group>
          <mesh geometry={geo('circle', 0.7, 12)} material={shadowMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} scale={[0.6, 1.5, 1]} />
          <Wheels pts={[[0, 0.65], [0, -0.65]]} r={0.33} w={0.12} />
          <mesh geometry={geo('box', 0.3, 0.35, 1.1)} material={body} position={[0, 0.6, 0]} />
          <mesh geometry={geo('box', 0.34, 0.12, 0.7)} material={TIRE} position={[0, 0.83, -0.2]} />
          <mesh geometry={geo('box', 0.7, 0.05, 0.05)} material={CHROME} position={[0, 1.05, 0.55]} />
          <mesh geometry={geo('box', 0.16, 0.12, 0.05)} material={LIGHT} position={[0, 0.85, 0.66]} />
        </group>
      );
    case 'bajaji':
      return (
        <group>
          <mesh geometry={geo('circle', 1, 12)} material={shadowMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} scale={[0.9, 1.3, 1]} />
          <Wheels pts={[[0, 1.0], [-0.6, -0.5], [0.6, -0.5]]} r={0.28} w={0.14} />
          <mesh geometry={geo('box', 1.3, 0.55, 2.1)} material={body} position={[0, 0.65, 0]} />
          <mesh geometry={geo('box', 1.36, 0.08, 2.2)} material={mat('#111827')} position={[0, 1.75, -0.05]} />
          <mesh geometry={geo('box', 1.2, 0.5, 0.05)} material={GLASS} position={[0, 1.25, 0.95]} />
          {[[-0.62, 0.9], [0.62, 0.9], [-0.62, -0.95], [0.62, -0.95]].map(([x, z], i) => (
            <mesh key={i} geometry={geo('box', 0.06, 0.8, 0.06)} material={TIRE} position={[x, 1.3, z]} />
          ))}
        </group>
      );
    case 'bus':
      return (
        <group>
          <mesh geometry={geo('circle', 1, 12)} material={shadowMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} scale={[1.3, 3.4, 1]} />
          <Wheels pts={[[-1, 2], [1, 2], [-1, -2], [1, -2]]} r={0.42} w={0.28} />
          <mesh geometry={geo('box', 2.2, 1.6, 6.4)} material={body} position={[0, 1.35, 0]} />
          <mesh geometry={geo('box', 2.24, 0.25, 6.44)} material={mat('#1d4ed8')} position={[0, 0.95, 0]} />
          <mesh geometry={geo('box', 2.24, 0.55, 5.6)} material={GLASS} position={[0, 1.75, -0.2]} />
          <mesh geometry={geo('box', 2.0, 0.6, 0.05)} material={GLASS} position={[0, 1.7, 3.21]} />
        </group>
      );
    default:
      return <Car body={bodyStyle || DEFAULT_BODY[kind] || 'hatch'} color={color} lux={lux} />;
  }
}


// ------------------------------------------------------------------ cars
// Each body is a side silhouette (z = length towards the nose, y = height) extruded
// across the car's width, plus a glass "greenhouse" profile. Facing +z, metres.
const DEFAULT_BODY = { car: 'hatch', suv: 'suv', van: 'van' };
const BODIES = {
  hatch: { L: 3.9, W: 1.7, wheel: 0.32, body: [[-1.95, 0.32], [-1.95, 0.95], [-1.8, 1.0], [1.05, 0.98], [1.95, 0.78], [1.95, 0.32]], cabin: [[-1.8, 0.98], [-1.65, 1.5], [0.2, 1.52], [1.05, 0.98]] },
  sedan: { L: 4.7, W: 1.8, wheel: 0.33, body: [[-2.35, 0.32], [-2.35, 0.88], [-2.2, 0.98], [-1.3, 1.0], [1.25, 0.95], [2.35, 0.78], [2.35, 0.32]], cabin: [[-1.35, 1.0], [-0.75, 1.46], [0.55, 1.46], [1.3, 0.95]] },
  luxury: { L: 5.2, W: 1.9, wheel: 0.36, body: [[-2.6, 0.34], [-2.6, 0.92], [-2.45, 1.02], [-1.45, 1.05], [1.4, 1.0], [2.6, 0.84], [2.6, 0.34]], cabin: [[-1.5, 1.05], [-0.85, 1.52], [0.65, 1.52], [1.45, 1.0]] },
  sports: { L: 4.5, W: 1.95, wheel: 0.34, low: true, body: [[-2.25, 0.25], [-2.25, 0.8], [-1.9, 0.88], [-0.9, 0.92], [1.2, 0.72], [2.25, 0.5], [2.25, 0.25]], cabin: [[-1.25, 0.9], [-0.55, 1.22], [0.15, 1.22], [1.15, 0.73]] },
  suv: { L: 4.6, W: 1.9, wheel: 0.4, body: [[-2.3, 0.45], [-2.3, 1.18], [-2.15, 1.25], [1.25, 1.22], [2.3, 1.0], [2.3, 0.45]], cabin: [[-2.15, 1.24], [-2.05, 1.85], [0.55, 1.88], [1.3, 1.22]] },
  'suv-big': { L: 5.0, W: 2.0, wheel: 0.43, body: [[-2.5, 0.48], [-2.5, 1.28], [-2.4, 1.34], [1.45, 1.32], [2.5, 1.12], [2.5, 0.48]], cabin: [[-2.4, 1.33], [-2.32, 2.02], [0.85, 2.04], [1.5, 1.32]] },
  'suv-sport': { L: 5.1, W: 2.05, wheel: 0.44, body: [[-2.55, 0.42], [-2.55, 1.05], [-2.3, 1.15], [1.3, 1.08], [2.55, 0.82], [2.55, 0.42]], cabin: [[-2.2, 1.14], [-1.75, 1.66], [0.35, 1.68], [1.35, 1.08]] },
  boxy: { L: 4.85, W: 2.0, wheel: 0.44, body: [[-2.42, 0.5], [-2.42, 1.3], [1.6, 1.3], [2.42, 1.22], [2.42, 0.5]], cabin: [[-2.42, 1.3], [-2.4, 2.0], [1.2, 2.0], [1.62, 1.3]] },
  van: { L: 4.7, W: 1.8, wheel: 0.34, body: [[-2.35, 0.35], [-2.35, 1.95], [1.2, 1.98], [2.35, 1.05], [2.35, 0.35]], cabin: [[-2.2, 1.35], [-2.2, 1.85], [1.1, 1.88], [1.95, 1.2], [1.95, 1.05]] },
};
const extrudeCache = new Map();
function profileGeo(key, pts, width, bevel = 0.05) {
  const k = `${key}:${width}`;
  if (!extrudeCache.has(k)) {
    const shape = new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(z, y)));
    const g = new THREE.ExtrudeGeometry(shape, { depth: width - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 4 });
    // shape is in (x=z, y); extrusion along +z → rotate so length runs along z and width along x.
    g.rotateY(-Math.PI / 2);
    g.translate((width - bevel * 2) / 2, 0, 0);
    g.computeVertexNormals();
    extrudeCache.set(k, g);
  }
  return extrudeCache.get(k);
}
const paintCache = new Map();
function paint(color) {
  if (!paintCache.has(color)) paintCache.set(color, new THREE.MeshPhongMaterial({ color, shininess: 90, specular: new THREE.Color('#ffffff').multiplyScalar(0.35) }));
  return paintCache.get(color);
}
const GLASS2 = new THREE.MeshPhongMaterial({ color: '#1e293b', shininess: 120, specular: '#9fb4d0', transparent: true, opacity: 0.88 });
const RIM = mat('#cbd5e1');
const RIM_LUX = new THREE.MeshPhongMaterial({ color: '#e5e7eb', shininess: 120 });
const TAIL = mat('#b91c1c');
const GRILLE = mat('#0f172a');

function CarWheels({ pts, r, lux }) {
  return pts.map(([x, z], i) => (
    <group key={i} position={[x, r, z]} rotation={[0, 0, Math.PI / 2]}>
      <mesh geometry={geo('cyl', r, r, 0.26, 16)} material={TIRE} />
      <mesh geometry={geo('cyl', r * 0.62, r * 0.62, 0.27, 12)} material={lux ? RIM_LUX : RIM} />
    </group>
  ));
}

export function Car({ body = 'hatch', color = '#e5e7eb', lux = false }) {
  const b = BODIES[body] || BODIES.hatch;
  const { L, W, wheel } = b;
  const m = paint(color);
  const front = b.body[b.body.length - 2][0];
  const noseY = (b.body[b.body.length - 2][1] + 0.4) / 2;
  const wz = L / 2 - (body === 'sports' ? 0.8 : 0.75);
  return (
    <group>
      <mesh geometry={geo('circle', 1, 16)} material={shadowMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} scale={[W * 0.62, L * 0.58, 1]} />
      <CarWheels r={wheel} lux={lux} pts={[[-W / 2 + 0.12, wz], [W / 2 - 0.12, wz], [-W / 2 + 0.12, -wz], [W / 2 - 0.12, -wz]]} />
      <mesh geometry={profileGeo(`b-${body}`, b.body, W)} material={m} />
      <mesh geometry={profileGeo(`c-${body}`, b.cabin, W - 0.16, 0.04)} material={GLASS2} />
      {/* roof panel in body colour */}
      {body !== 'van' && (() => {
        const top = b.cabin.filter((p) => p[1] === Math.max(...b.cabin.map((q) => q[1])));
        const z1 = Math.min(...top.map((p) => p[0]));
        const z2 = Math.max(...top.map((p) => p[0]));
        return <mesh geometry={geo('box', W - 0.14, 0.05, z2 - z1 + 0.2)} material={m} position={[0, top[0][1] + 0.01, (z1 + z2) / 2]} />;
      })()}
      {/* lights, grille, mirrors */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh geometry={geo('box', 0.34, 0.1, 0.05)} material={LIGHT} position={[s * (W / 2 - 0.3), noseY + 0.12, front + 0.02]} />
          <mesh geometry={geo('box', 0.34, 0.1, 0.05)} material={TAIL} position={[s * (W / 2 - 0.3), b.body[1][1] - 0.18, -L / 2 - 0.02]} />
          <mesh geometry={geo('box', 0.12, 0.09, 0.16)} material={m} position={[s * (W / 2 + 0.04), b.cabin[0][1] + 0.12, b.cabin[b.cabin.length - 1][0] - 0.25]} />
        </group>
      ))}
      <mesh geometry={geo('box', body === 'boxy' || lux ? W * 0.45 : W * 0.36, 0.16, 0.04)} material={lux ? RIM_LUX : GRILLE} position={[0, noseY, front + 0.02]} />
      {body === 'boxy' && <mesh geometry={geo('cyl', 0.38, 0.38, 0.22, 16)} material={TIRE} position={[0, 0.95, -L / 2 - 0.12]} rotation={[Math.PI / 2, 0, 0]} />}
      {body === 'sports' && <mesh geometry={geo('box', W * 0.9, 0.05, 0.3)} material={GRILLE} position={[0, 0.98, -L / 2 + 0.15]} />}
      {(body === 'suv' || body === 'suv-big') && <mesh geometry={geo('box', 0.06, 0.05, L * 0.42)} material={RIM} position={[W / 2 - 0.2, b.cabin[1][1] + 0.06, -L * 0.05]} />}
    </group>
  );
}

export function Boat({ color = '#f8fafc' }) {
  return (
    <group>
      <mesh geometry={geo('box', 4, 1.2, 10)} material={mat(color)} position={[0, 0.4, 0]} />
      <mesh geometry={geo('box', 3, 1.4, 4)} material={mat('#1d4ed8')} position={[0, 1.7, -1]} />
      <mesh geometry={geo('box', 3.05, 0.4, 4.05)} material={GLASS} position={[0, 1.9, -1]} />
    </group>
  );
}

/** Seat height for riders on open vehicles; null = rider hidden inside. */
export function riderOffset(kind) {
  if (kind === 'bike') return [0, 0.15, -0.1];
  if (kind === 'moto') return [0, 0.3, -0.15];
  return null;
}

/** Airliner (Air Tanzania colours), nose towards +z, ~30 m long. `gear` shows wheels. */
export function Plane({ livery = '#0ea5e9', tail = '#facc15', gear = true }) {
  const white = mat('#f8fafc');
  const dark = mat('#1e293b');
  const liv = mat(livery);
  const tl = mat(tail);
  const grey = mat('#94a3b8');
  return (
    <group>
      {/* fuselage */}
      <mesh geometry={geo('cyl', 1.7, 1.7, 24, 18)} material={white} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0]} />
      <mesh geometry={geo('sphere', 1.7, 18, 12)} material={white} position={[0, 0, 12]} scale={[1, 0.95, 1.6]} />
      <mesh geometry={geo('box', 1.6, 0.5, 0.9)} material={dark} position={[0, 0.75, 13.6]} rotation={[0.45, 0, 0]} />
      <mesh geometry={geo('cyl', 0.35, 1.7, 6, 18)} material={white} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.5, -15]} />
      {/* windows + livery stripe */}
      {[-1, 1].map((sd) => (
        <group key={sd}>
          <mesh geometry={geo('box', 0.05, 0.28, 19)} material={dark} position={[sd * 1.68, 0.45, 0.5]} />
          <mesh geometry={geo('box', 0.05, 0.22, 22)} material={liv} position={[sd * 1.69, -0.2, 0]} />
        </group>
      ))}
      {/* wings (swept) + engines */}
      {[-1, 1].map((sd) => (
        <group key={`w${sd}`}>
          <mesh geometry={geo('box', 11, 0.32, 3.4)} material={grey} position={[sd * 6.2, -0.8, 0.2]} rotation={[0, sd * 0.32, sd * 0.06]} />
          <mesh geometry={geo('box', 0.2, 1.1, 1.2)} material={tl} position={[sd * 11.6, -0.2, -1.6]} />
          <mesh geometry={geo('cyl', 0.75, 0.65, 3, 14)} material={white} rotation={[Math.PI / 2, 0, 0]} position={[sd * 4.6, -1.6, 1.8]} />
          <mesh geometry={geo('cyl', 0.6, 0.6, 0.1, 14)} material={dark} rotation={[Math.PI / 2, 0, 0]} position={[sd * 4.6, -1.6, 3.32]} />
          <mesh geometry={geo('box', 4.2, 0.2, 1.6)} material={grey} position={[sd * 2.4, 0.9, -16.4]} rotation={[0, sd * 0.3, 0]} />
        </group>
      ))}
      {/* tail fin with flag-yellow giraffe-ish livery */}
      <mesh geometry={geo('box', 0.3, 5, 3.6)} material={liv} position={[0, 3.2, -16]} rotation={[-0.38, 0, 0]} />
      <mesh geometry={geo('box', 0.34, 1.6, 1.4)} material={tl} position={[0, 3.6, -16.2]} rotation={[-0.38, 0, 0]} />
      {gear && (
        <group>
          {[[0, 9], [-1.6, -1], [1.6, -1]].map(([x, z], i) => (
            <group key={i} position={[x, -1.7, z]}>
              <mesh geometry={geo('box', 0.15, 0.9, 0.15)} material={grey} position={[0, 0.45, 0]} />
              <mesh geometry={geo('cyl', 0.4, 0.4, 0.35, 12)} material={mat('#111827')} rotation={[0, 0, Math.PI / 2]} position={[0, 0, 0]} />
            </group>
          ))}
        </group>
      )}
    </group>
  );
}
