// Bodyguards walking with their boss (a loose formation behind them, in black suits) — and the
// family when you take them out: spouse at your side, kids around you.
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Avatar } from './Avatar.jsx';
import { useStore } from '../store.js';
import { local, remotes } from '../net.js';

const SLOTS = [[-1.3, -1.4], [1.3, -1.4], [-1.6, 0.6], [1.6, 0.6]]; // [side, forward] relative to the boss
const LOOK = (i) => ({ body: 'man', skin: [1, 3, 4, 2][i % 4], hair: 'kipara', hairColor: 0, outfit: 'suti' });

/** One follower: walks to its slot beside the boss (guards in suits, or the family). */
function Guard({ i, boss, slots = SLOTS, look, scale = 1 }) {
  const g = useRef();
  const motion = useRef({ moving: false, mode: 'idle', speed: 1 });
  const p = useRef(null);
  useFrame((_, dt) => {
    const b = boss();
    const el = g.current;
    if (!el) return;
    el.visible = !!b && !b.hidden;
    if (!b || b.hidden) { p.current = null; return; }
    const [sx, fz] = slots[i % slots.length];
    const c = Math.cos(b.ry);
    const s = Math.sin(b.ry);
    const tx = b.x + sx * c + fz * s;
    const tz = b.z - sx * s + fz * c;
    if (!p.current || Math.hypot(tx - p.current.x, tz - p.current.z) > 25) p.current = { x: tx, z: tz, ry: b.ry };
    const cur = p.current;
    const dx = tx - cur.x;
    const dz = tz - cur.z;
    const d = Math.hypot(dx, dz);
    const step = Math.min(d, Math.max(scale < 0.6 ? 3 : 4, d * 3) * dt);
    if (d > 0.05) { cur.x += (dx / d) * step; cur.z += (dz / d) * step; }
    const want = d > 0.4 ? Math.atan2(dx, dz) : b.ry;
    let diff = want - cur.ry;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    cur.ry += diff * Math.min(1, dt * 6);
    motion.current.moving = d > 0.4;
    motion.current.mode = d > 2.5 ? 'run' : d > 0.4 ? 'walk' : 'idle';
    el.position.set(cur.x, 0.1, cur.z);
    el.rotation.y = cur.ry;
  });
  return (
    <group ref={g}>
      <group scale={scale}><Avatar appearance={look || LOOK(i)} motion={motion} /></group>
    </group>
  );
}

function Detail({ men, boss }) {
  return Array.from({ length: Math.min(4, men) }, (_, i) => <Guard key={i} i={i} boss={boss} />);
}

// The family walks close: spouse at your side, kids just ahead and behind.
const FAM_SLOTS = [[1.1, 0], [-0.9, 0.9], [0.9, 1.1], [-1.1, -0.8], [1.2, -1], [0, -1.4], [0, 1.5]];
function Family({ fam, boss }) {
  return fam.slice(0, FAM_SLOTS.length).map((m, i) => <Guard key={`${m.n}-${i}`} i={i} boss={boss} slots={FAM_SLOTS} look={m.look} scale={m.s || 1} />);
}

export function GuardsLayer() {
  const mine = useStore((s) => s.me?.guards?.men || 0);
  useStore((s) => s.roster); // re-render when remote guard counts change
  const inside = useStore((s) => s.inside);
  const stolen = useStore((s) => s.stolenCar);
  const driving = useStore((s) => !!s.me?.activeVehicle);
  const myFam = useStore((s) => s.me?.outing?.party || null);
  const others = [...remotes.values()].filter((r) => r.guards > 0 || r.fam?.length);
  const meBoss = () => ({ x: local.x, z: local.z, ry: local.ry, hidden: !!inside || !!stolen || driving || local.driving });
  const remoteBoss = (id) => () => { const x = remotes.get(id); return x ? { x: x.tx, z: x.tz, ry: x.tr || 0, hidden: !!x.v || !!x.inside } : null; };
  return (
    <>
      {mine > 0 && <Detail men={mine} boss={meBoss} />}
      {myFam && <Family fam={myFam} boss={meBoss} />}
      {others.map((r) => (
        <group key={r.id}>
          {r.guards > 0 && <Detail men={r.guards} boss={remoteBoss(r.id)} />}
          {r.fam?.length > 0 && <Family fam={r.fam} boss={remoteBoss(r.id)} />}
        </group>
      ))}
    </>
  );
}
