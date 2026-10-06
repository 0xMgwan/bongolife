import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { isWater, vehicleById, placeById } from '@shared/world.js';
import { Avatar } from './Avatar.jsx';
import { Vehicle, riderOffset } from './Vehicle.jsx';
import { labelTexture, bubbleTexture, emojiTexture } from './textures.js';
import { local, input, remotes, bubbles, emotes, sendMove } from '../net.js';
import { useStore } from '../store.js';

const DANCE = new Set(['cheza', 'vip', 'mzunguko', 'sundowner', 'dabi']);
const SIT = new Set(['lala', 'pumzika', 'sinema', 'mpira', 'kijiweni', 'kozi', 'maktaba']);
export function busyMode(busy) {
  if (!busy) return null;
  if (busy.kind === 'job') return 'idle';
  if (DANCE.has(busy.id)) return 'dance';
  if (SIT.has(busy.id)) return 'sit';
  return 'idle';
}

/** Name tag, chat bubble, emote & busy indicator above a player. */
function Overhead({ id, username, height, getBusy }) {
  const tag = useMemo(() => labelTexture(`@${username}`, { size: 30, bg: 'rgba(17,24,39,.72)', fg: '#ffffff', bold: 700 }), [username]);
  const bubbleRef = useRef();
  const iconRef = useRef();
  const state = useRef({ text: null, icon: null });
  useFrame(() => {
    const now = Date.now();
    const b = bubbles.get(id);
    const text = b && b.until > now ? b.text : null;
    if (text !== state.current.text) {
      state.current.text = text;
      const s = bubbleRef.current;
      if (s.material.map) s.material.map.dispose();
      if (text) {
        const { texture, aspect } = bubbleTexture(text);
        s.material.map = texture;
        s.material.needsUpdate = true;
        s.scale.set(1.3 * aspect, 1.3, 1);
        s.visible = true;
      } else {
        s.material.map = null;
        s.visible = false;
      }
    }
    const e = emotes.get(id);
    const busy = getBusy?.();
    const icon = e && e.until > now ? e.e : busy?.emoji || null;
    if (icon !== state.current.icon) {
      state.current.icon = icon;
      const s = iconRef.current;
      s.visible = !!icon;
      if (icon) {
        s.material.map = emojiTexture(icon);
        s.material.needsUpdate = true;
      }
    }
    if (iconRef.current.visible) iconRef.current.position.y = height + 1.0 + Math.sin(now / 250) * 0.08;
  });
  return (
    <group>
      <sprite scale={[0.5 * tag.aspect, 0.5, 1]} position={[0, height + 0.35, 0]} renderOrder={6}>
        <spriteMaterial map={tag.texture} depthWrite={false} depthTest={false} />
      </sprite>
      <sprite ref={iconRef} scale={[0.9, 0.9, 1]} position={[0, height + 1, 0]} visible={false} renderOrder={6}>
        <spriteMaterial depthWrite={false} depthTest={false} />
      </sprite>
      <sprite ref={bubbleRef} position={[0, height + 1.9, 0]} visible={false} renderOrder={7}>
        <spriteMaterial depthWrite={false} depthTest={false} />
      </sprite>
    </group>
  );
}

function Body({ appearance, vehicle, motion }) {
  const v = vehicle && vehicleById[vehicle.model];
  if (!v) return <Avatar appearance={appearance} motion={motion} />;
  const seat = riderOffset(v.kind);
  return (
    <group>
      <Vehicle kind={v.kind} color={vehicle.color} />
      {seat && (
        <group position={seat}>
          <Avatar appearance={appearance} motion={{ current: { mode: 'sit' } }} />
        </group>
      )}
    </group>
  );
}
const overheadHeight = (vehicle) => {
  const v = vehicle && vehicleById[vehicle.model];
  if (!v) return 1.95;
  if (v.kind === 'bus') return 3.4;
  return riderOffset(v.kind) ? 1.9 : 2.3;
};

// ------------------------------------------------------------- local
export function LocalPlayer({ me, onArrive }) {
  const group = useRef();
  const motion = useRef({ moving: false, mode: 'idle', speed: 1 });
  const vehicle = useMemo(() => me.vehicles?.find((v) => v.id === me.activeVehicle) || null, [me.vehicles, me.activeVehicle]);
  const speedMult = vehicle ? vehicleById[vehicle.model]?.speed || 1 : 1;
  const busyRef = useRef(me.busy);
  busyRef.current = me.busy && me.busy.endsAt > Date.now() - 2000 ? me.busy : null;
  const energyRef = useRef(me.needs?.energy ?? 50);
  energyRef.current = me.needs?.energy ?? 50;
  const seen = useRef(local.teleported);

  useEffect(() => {
    // Only seed from the server once; remounts (e.g. language switch) keep the live position.
    if (!local.ready) {
      local.x = me.x;
      local.z = me.z;
      local.ready = true;
    }
    local.target = null;
    group.current.position.set(local.x, 0.1, local.z);
    sendMove(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((_, dt) => {
    dt = Math.min(dt, 0.1);
    const g = group.current;
    if (seen.current !== local.teleported) {
      seen.current = local.teleported;
      g.position.set(local.x, 0.1, local.z);
    }
    const busy = busyRef.current;
    let dx = 0;
    let dz = 0;
    const k = input.keys;
    if (k.has('w') || k.has('arrowup')) dz -= 1;
    if (k.has('s') || k.has('arrowdown')) dz += 1;
    if (k.has('a') || k.has('arrowleft')) dx -= 1;
    if (k.has('d') || k.has('arrowright')) dx += 1;
    dx += input.jx;
    dz += input.jz;
    let manual = Math.hypot(dx, dz) > 0.08;
    if (manual) {
      local.target = null;
      local.arrive = null;
    } else if (local.target) {
      dx = local.target[0] - local.x;
      dz = local.target[1] - local.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.5) {
        local.target = null;
        dx = dz = 0;
        const cb = local.arrive;
        local.arrive = null;
        cb?.();
      }
    }
    const len = Math.hypot(dx, dz);
    const moving = !busy && len > 0.05;
    if (moving) {
      const tired = energyRef.current < 12 ? 0.6 : 1;
      const speed = 7.5 * speedMult * tired * Math.min(1, manual ? len : 1);
      const step = Math.min(speed * dt, manual ? Infinity : len);
      const nx = local.x + (dx / len) * step;
      const nz = local.z + (dz / len) * step;
      if (!isWater(nx, nz)) {
        local.x = nx;
        local.z = nz;
      } else if (!isWater(nx, local.z)) local.x = nx;
      else if (!isWater(local.x, nz)) local.z = nz;
      else local.target = null;
      const want = Math.atan2(dx, dz);
      let diff = want - local.ry;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      local.ry += diff * Math.min(1, dt * 12);
    }
    local.moving = moving;
    motion.current.moving = moving;
    motion.current.speed = Math.min(1.6, speedMult);
    motion.current.mode = busy ? busyMode(busy) : moving ? 'walk' : 'idle';
    g.position.set(local.x, 0.1, local.z);
    g.rotation.y = local.ry;
    sendMove();
  });

  return (
    <group ref={group}>
      <Body appearance={me.appearance} vehicle={vehicle} motion={motion} />
      <Overhead id={me.id} username={me.username} height={overheadHeight(vehicle)} getBusy={() => busyRef.current} />
    </group>
  );
}

// ------------------------------------------------------------ remotes
function RemotePlayer({ r, onClick }) {
  const group = useRef();
  const motion = useRef({ moving: false, mode: 'idle', speed: 1 });
  const pos = useRef({ x: r.x, z: r.z, ry: r.ry || 0 });
  useFrame(({ camera }, dt) => {
    const p = pos.current;
    const dist = Math.hypot(r.tx - p.x, r.tz - p.z);
    if (dist > 30) {
      p.x = r.tx;
      p.z = r.tz;
    } else {
      const a = 1 - Math.exp(-dt * 10);
      p.x += (r.tx - p.x) * a;
      p.z += (r.tz - p.z) * a;
    }
    let diff = (r.tr || 0) - p.ry;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    p.ry += diff * Math.min(1, dt * 10);
    const g = group.current;
    g.position.set(p.x, 0.1, p.z);
    g.rotation.y = p.ry;
    // Cheap LOD: hide players far from the camera focus.
    g.visible = Math.hypot(camera.position.x - p.x, camera.position.z - p.z) < 140;
    const busy = r.busy && r.busy.endsAt > Date.now() ? r.busy : null;
    motion.current.moving = !!r.m || dist > 0.3;
    motion.current.mode = busy ? busyMode(busy) : motion.current.moving ? 'walk' : 'idle';
    motion.current.speed = r.v ? 1.5 : 1;
  });
  const click = (e) => {
    if (e.delta > 10) return;
    e.stopPropagation();
    onClick?.(r);
  };
  return (
    <group ref={group} onClick={click}>
      <Body appearance={r.appearance} vehicle={r.v} motion={motion} />
      <Overhead id={r.id} username={r.username} height={overheadHeight(r.v)} getBusy={() => (r.busy && r.busy.endsAt > Date.now() ? r.busy : null)} />
    </group>
  );
}

export function RemotePlayers({ onPlayer }) {
  const roster = useStore((s) => s.roster);
  const list = useMemo(() => [...remotes.values()].slice(0, 80), [roster]); // eslint-disable-line react-hooks/exhaustive-deps
  return list.map((r) => <RemotePlayer key={`${r.id}-${r.appearance?.outfit}-${r.appearance?.hair}-${r.v?.model}`} r={r} onClick={onPlayer} />);
}

export function placeDoor(placeId) {
  const p = placeById[placeId];
  const [px, pz] = p.pos;
  const cands = [[px, pz + p.size[1] / 2 + 2.2], [px, pz - p.size[1] / 2 - 2.2], [px - p.size[0] / 2 - 2.2, pz], [px + p.size[0] / 2 + 2.2, pz]];
  return cands.find(([x, z]) => !isWater(x, z)) || cands[0];
}
