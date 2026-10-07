// Activity scenes: interiors and set-pieces shown while you're inside a venue or doing
// something (dancing, watching the match, eating, sleeping…). Rendered far from the
// city at SCENE_ORIGIN, with every real player who's in the same place plus some regulars.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { randomAppearance, findActivity, gameClock, workStage, flightPhase } from '@shared/world.js';
import { Plane } from './Vehicle.jsx';
import { mat, geo, labelTexture, emojiTexture } from './textures.js';
import { Body, Overhead } from './Players.jsx';
import { remotes } from '../net.js';
import { useStore } from '../store.js';
import { L } from '../i18n.js';

export const SCENE_ORIGIN = [4000, 0, 4000];
/** Scenes flagged `dynamic` drive the camera themselves through this (scene-local coords). */
export const sceneCam = { pos: [0, 5, 10], look: [0, 1, 0] };

const unitBox = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
const basic = (color, opts) => new THREE.MeshBasicMaterial({ color, ...opts });
function Box({ p = [0, 0, 0], s, c, m, r }) {
  return <mesh geometry={unitBox} material={m || mat(c)} position={p} scale={s} rotation={r} />;
}
function rng(seed) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}
function Sign({ text, p, h = 1, bg = 'rgba(0,0,0,0)', fg = '#ffffff', size = 46 }) {
  const { texture, aspect } = useMemo(() => labelTexture(text, { bg, fg, size, bold: 800 }), [text, bg, fg, size]);
  return (
    <mesh position={p}>
      <planeGeometry args={[h * aspect, h]} />
      <meshBasicMaterial map={texture} transparent />
    </mesh>
  );
}
function Room({ w, d, h = 6, floor, wall, back }) {
  return (
    <group>
      <Box p={[0, -0.1, 0]} s={[w, 0.1, d]} c={floor} />
      <Box p={[0, 0, -d / 2]} s={[w, h, 0.3]} c={back || wall} />
      <Box p={[-w / 2, 0, 0]} s={[0.3, h, d]} c={wall} />
      <Box p={[w / 2, 0, 0]} s={[0.3, h, d]} c={wall} />
    </group>
  );
}

// ------------------------------------------------- animated canvas screens
function useCanvasTexture(w, h, draw, fps = 12) {
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [w, h]);
  const acc = useRef(Infinity); // draw on the first frame, then at `fps`
  const time = useRef(0);
  useFrame((_, dt) => {
    time.current += dt;
    acc.current += dt;
    if (acc.current < 1 / fps) return;
    acc.current = 0;
    draw(tex.image.getContext('2d'), time.current);
    tex.needsUpdate = true;
  });
  useEffect(() => () => tex.dispose(), [tex]);
  return tex;
}

/** A broadcast-style football match: pitch, 22 players chasing the ball, score bug. */
function drawMatch(ctx, t) {
  const W = 512, H = 288;
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i % 2 ? '#2f8f3a' : '#36a043';
    ctx.fillRect((i * W) / 8, 0, W / 8, H);
  }
  ctx.strokeStyle = 'rgba(255,255,255,.85)';
  ctx.lineWidth = 2;
  ctx.strokeRect(14, 14, W - 28, H - 28);
  ctx.beginPath(); ctx.moveTo(W / 2, 14); ctx.lineTo(W / 2, H - 14); ctx.stroke();
  ctx.beginPath(); ctx.arc(W / 2, H / 2, 34, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeRect(14, H / 2 - 50, 50, 100);
  ctx.strokeRect(W - 64, H / 2 - 50, 50, 100);
  const bx = W / 2 + Math.sin(t * 0.7) * 170 + Math.sin(t * 2.3) * 30;
  const by = H / 2 + Math.sin(t * 1.1) * 80;
  for (let i = 0; i < 22; i++) {
    const team = i < 11;
    const hx = (team ? 80 : W - 80) + ((i % 11) % 4) * (team ? 70 : -70) + Math.sin(i) * 20;
    const hy = 40 + ((i * 37) % 200);
    const chase = 0.25 + ((i * 13) % 10) / 30;
    const x = hx + (bx - hx) * chase + Math.sin(t * 2 + i) * 6;
    const y = hy + (by - hy) * chase + Math.cos(t * 2 + i) * 6;
    ctx.fillStyle = team ? '#dc2626' : '#facc15';
    ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = team ? '#fff' : '#15803d';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(bx, by, 4, 0, Math.PI * 2); ctx.fill();
  // score bug
  const min = 1 + (Math.floor(t * 2) % 90);
  ctx.fillStyle = 'rgba(17,24,39,.85)';
  ctx.fillRect(10, 8, 210, 30);
  ctx.font = '800 17px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = '#fff';
  ctx.fillText(`SIM ${min > 60 ? 2 : min > 23 ? 1 : 0} - ${min > 41 ? 1 : 0} YAN   ${min}'`, 20, 29);
}

function Tv({ p, w = 6 }) {
  const tex = useCanvasTexture(512, 288, drawMatch, 15);
  return (
    <group position={p}>
      <Box p={[0, -0.15, -0.1]} s={[w + 0.3, (w * 9) / 16 + 0.3, 0.2]} c="#0b0f17" />
      <mesh position={[0, ((w * 9) / 16) / 2, 0.02]}>
        <planeGeometry args={[w, (w * 9) / 16]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
    </group>
  );
}

// --------------------------------------------------------------- people
function useScenePeople(placeId, scene) {
  const roster = useStore((s) => s.roster);
  return useMemo(() => {
    const now = Date.now();
    return [...remotes.values()].filter((r) => r.inside === placeId || (r.busy && r.busy.endsAt > now && r.busy.placeId === placeId));
  }, [roster, placeId, scene]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** One person in a scene: avatar + name tag + optional prop, with a fixed pose. */
function Person({ slot, appearance, mode, id, username, height = 1.95, prop }) {
  const motion = useRef({ mode });
  motion.current.mode = mode;
  const [x, y, z, ry] = slot;
  return (
    <group position={[x, y, z]} rotation={[0, ry, 0]}>
      <Body appearance={appearance} motion={motion} />
      {username && <Overhead id={id} username={username} height={mode === 'sleep' ? 0.9 : mode === 'sit' || mode === 'eat' || mode === 'cheer' ? 1.55 : height} />}
      {prop}
    </group>
  );
}

const NPC_LOOKS = Array.from({ length: 24 }, (_, i) => {
  const r = rng(1000 + i * 77);
  const a = randomAppearance();
  return { ...a, skin: Math.floor(r() * 6) };
});

/**
 * Generic crowd renderer: local player at `localSlot`, real players next, then NPCs
 * until `crowd` is reached. `modeFor(kind, busy)` picks each person's pose.
 */
function Crowd({ me, myBusy, people, slots, localSlot, crowd, modeFor, extra }) {
  const used = [];
  const out = [];
  const take = () => {
    const i = slots.findIndex((_, k) => !used.includes(k));
    if (i < 0) return null;
    used.push(i);
    return slots[i];
  };
  // You get the most central seat so you're always in frame.
  let ls = localSlot;
  if (!ls) {
    const centre = slots.reduce((best, sl, i) => (Math.abs(sl[0]) + Math.abs(sl[2]) * 0.3 < Math.abs(slots[best][0]) + Math.abs(slots[best][2]) * 0.3 ? i : best), 0);
    used.push(centre);
    ls = slots[centre];
  }
  out.push(<Person key="me" slot={ls} appearance={me.appearance} mode={modeFor('me', myBusy)} id={me.id} username={me.username} prop={extra?.(ls, 'me')} />);
  for (const r of people) {
    const s = take();
    if (!s) break;
    out.push(<Person key={r.id} slot={s} appearance={r.appearance} mode={modeFor('real', r.busy)} id={r.id} username={r.username} prop={extra?.(s, r.id)} />);
  }
  let n = 0;
  while (out.length < crowd) {
    const s = take();
    if (!s) break;
    out.push(<Person key={`npc${n}`} slot={s} appearance={NPC_LOOKS[n % NPC_LOOKS.length]} mode={modeFor('npc', null, n)} prop={extra?.(s, `npc${n}`)} />);
    n++;
  }
  return out;
}

// ------------------------------------------------------------------ club
function DanceFloor() {
  const ref = useRef();
  const cols = 8, rows = 6, size = 1.4;
  const palette = useMemo(() => ['#ec4899', '#22d3ee', '#a855f7', '#facc15', '#22c55e', '#f97316'].map((c) => new THREE.Color(c)), []);
  useEffect(() => {
    const m = new THREE.Matrix4();
    let i = 0;
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        m.makeTranslation((c - (cols - 1) / 2) * size, 0.01, (r - (rows - 1) / 2) * size);
        ref.current.setMatrixAt(i++, m);
      }
    ref.current.instanceMatrix.needsUpdate = true;
  }, []);
  const acc = useRef(0);
  const beat = useRef(0);
  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < 0.27) return; // ~ one beat at 112bpm
    acc.current = 0;
    beat.current++;
    for (let i = 0; i < cols * rows; i++) {
      const on = (i + beat.current * 3) % 5 < 2;
      ref.current.setColorAt(i, on ? palette[(i + beat.current) % palette.length] : new THREE.Color('#1f1530'));
    }
    ref.current.instanceColor.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, cols * rows]}>
      <boxGeometry args={[size * 0.96, 0.05, size * 0.96]} />
      <meshBasicMaterial />
    </instancedMesh>
  );
}

function Spotlights({ colors = ['#ec4899', '#22d3ee', '#a855f7', '#facc15'] }) {
  const refs = useRef([]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    refs.current.forEach((g, i) => {
      if (!g) return;
      g.rotation.z = Math.sin(t * 0.9 + i * 1.7) * 0.6;
      g.rotation.x = Math.cos(t * 0.7 + i) * 0.4;
    });
  });
  const mats = useMemo(() => colors.map((c) => basic(c, { transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })), [colors]);
  return colors.map((c, i) => (
    <group key={c} ref={(el) => (refs.current[i] = el)} position={[(i - 1.5) * 4.5, 6.8, -3]}>
      <mesh material={mats[i]} position={[0, -3.4, 0]}>
        <coneGeometry args={[1.8, 6.8, 16, 1, true]} />
      </mesh>
    </group>
  ));
}

function DiscoBall() {
  const ref = useRef();
  useFrame((_, dt) => (ref.current.rotation.y += dt * 0.8));
  return (
    <group position={[0, 6.2, -1]}>
      <Box p={[0, 0.4, 0]} s={[0.04, 1.2, 0.04]} c="#9ca3af" />
      <mesh ref={ref} geometry={geo('sphere', 0.55, 10, 8)} material={new THREE.MeshLambertMaterial({ color: '#e5e7eb', emissive: '#6b7280', flatShading: true })} />
    </group>
  );
}

function Club({ me, myBusy, people, lounge }) {
  const slots = useMemo(() => {
    const s = [];
    for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) s.push([(c - 2) * 1.7 + (r % 2) * 0.5, 0, (r - 1.5) * 1.6 + 0.8, Math.PI * 0.1 * (c - 2) + (r % 2 ? 0.3 : -0.2)]);
    return s;
  }, []);
  const djSlot = [0, 0.25, -5.6, 0];
  const iAmDj = myBusy?.kind === 'job' && myBusy.id === 'dj';
  const dancing = (busy) => (busy && ['cheza', 'vip', 'mzunguko', 'sundowner'].includes(busy.id) ? 'dance' : 'dance');
  const pointA = useRef();
  const pointB = useRef();
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (pointA.current) pointA.current.position.set(Math.sin(t) * 6, 4, Math.cos(t * 0.8) * 4);
    if (pointB.current) pointB.current.position.set(Math.cos(t * 1.2) * 6, 4, Math.sin(t) * 4);
  });
  return (
    <group>
      {lounge ? (
        <group>
          <Box p={[0, -0.1, 0]} s={[24, 0.1, 18]} c="#8b5a2b" />
          {[-12, 12].map((x) => <Box key={x} p={[x, 0, 0]} s={[0.15, 1.1, 18]} m={basic('#bae6fd', { transparent: true, opacity: 0.35 })} />)}
          <Box p={[0, 0, -9]} s={[24, 1.1, 0.15]} m={basic('#bae6fd', { transparent: true, opacity: 0.35 })} />
          {/* city skyline below the rooftop */}
          {Array.from({ length: 26 }, (_, i) => (
            <Box key={i} p={[(i - 13) * 4.2, -30, -40 - (i % 3) * 8]} s={[3.2, 18 + ((i * 7) % 20), 3.2]} m={basic(i % 4 ? '#1e293b' : '#334155')} />
          ))}
          {Array.from({ length: 14 }, (_, i) => (
            <mesh key={'l' + i} geometry={geo('sphere', 0.09, 6, 6)} material={basic('#fde68a')} position={[(i - 6.5) * 1.7, 5 - Math.abs(Math.sin(i * 0.7)) * 0.4, -3]} />
          ))}
          <Sign text="MSASANI ROOFTOP" p={[0, 4.2, -9]} h={1} fg="#fde68a" />
          {[[-7, 3], [7, 3]].map(([x, z]) => (
            <group key={x} position={[x, 0, z]}>
              <Box s={[3.4, 0.5, 1.2]} c="#f5f5f4" />
              <Box p={[0, 0.5, -0.5]} s={[3.4, 0.8, 0.25]} c="#f5f5f4" />
            </group>
          ))}
        </group>
      ) : (
        <group>
          <Room w={26} d={20} h={7.5} floor="#120d1f" wall="#1e1b4b" back="#160f2e" />
          <DanceFloor />
          <Spotlights />
          <DiscoBall />
          <Sign text="CLUB MZUKA" p={[0, 5.2, -9.8]} h={1.2} fg="#f472b6" />
          {[-10.5, 10.5].map((x) => (
            <group key={x} position={[x, 0, -7.5]}>
              <Box s={[1.4, 3.2, 1.2]} c="#0b0f17" />
              <mesh geometry={geo('circle', 0.45, 18)} material={mat('#374151')} position={[0, 1, 0.61]} />
              <mesh geometry={geo('circle', 0.3, 18)} material={mat('#374151')} position={[0, 2.4, 0.61]} />
            </group>
          ))}
          {/* bar counter */}
          <group position={[10.5, 0, 3]}>
            <Box s={[1.4, 1.2, 7]} c="#3b0764" />
            {Array.from({ length: 6 }, (_, i) => <mesh key={i} geometry={geo('cyl', 0.08, 0.1, 0.45, 8)} material={basic(['#22c55e', '#f59e0b', '#ef4444'][i % 3])} position={[0, 1.42, -2.5 + i]} />)}
          </group>
          {/* VIP couch */}
          <group position={[-9.5, 0, 4]}>
            <Box s={[2.4, 0.55, 5]} c="#7e22ce" />
            <Box p={[-1, 0.55, 0]} s={[0.4, 0.9, 5]} c="#7e22ce" />
            <Box p={[1.8, 0, 0]} s={[0.9, 0.7, 2]} c="#111827" />
            <mesh geometry={geo('cyl', 0.09, 0.12, 0.5, 8)} material={basic('#facc15')} position={[1.8, 0.95, 0.3]} />
          </group>
          <pointLight ref={pointA} color="#ec4899" intensity={30} distance={14} />
          <pointLight ref={pointB} color="#22d3ee" intensity={30} distance={14} />
        </group>
      )}
      {/* DJ booth */}
      <group position={[0, 0, -6.6]}>
        <Box s={[5, 1.15, 1.3]} c={lounge ? '#292524' : '#0b0f17'} />
        <mesh geometry={geo('cyl', 0.38, 0.38, 0.05, 20)} material={mat('#111827')} position={[-1.1, 1.18, 0.1]} />
        <mesh geometry={geo('cyl', 0.38, 0.38, 0.05, 20)} material={mat('#111827')} position={[1.1, 1.18, 0.1]} />
        <Box p={[0, 1.15, 0.1]} s={[0.9, 0.08, 0.6]} c="#374151" />
        <Box p={[0, 0.3, 0.66]} s={[4.6, 0.2, 0.02]} m={basic('#ec4899')} />
      </group>
      {!iAmDj && <Person slot={djSlot} appearance={NPC_LOOKS[23]} mode="dj" />}
      <Crowd me={me} myBusy={myBusy} people={people} slots={slots} localSlot={iAmDj ? djSlot : lounge && myBusy?.id === 'sundowner' ? [-7, 0.45, 3.2, Math.PI / 2] : null} crowd={lounge ? 9 : 14} modeFor={(who, busy) => (who === 'me' && iAmDj ? 'dj' : who === 'me' && lounge && myBusy?.id === 'sundowner' ? 'sit' : dancing(busy))} />
    </group>
  );
}

// ------------------------------------------------------------------- bar
function Bar({ me, myBusy, people }) {
  // Two rows of red plastic chairs facing the TV.
  const slots = useMemo(() => {
    const s = [];
    for (let r = 0; r < 2; r++) for (let c = 0; c < 5; c++) s.push([(c - 2) * 1.9, 0.1, -0.5 + r * 2.4, Math.PI]);
    return s;
  }, []);
  const iAmStaff = myBusy?.kind === 'job' && myBusy.id === 'mhudumu';
  const mode = (busy) => (busy?.id === 'mpira' ? 'cheer' : busy?.id === 'nyamachoma' ? 'eat' : 'sit');
  return (
    <group>
      <Room w={18} d={14} h={6} floor="#d6c7a1" wall="#fef3c7" back="#b45309" />
      <Box p={[0, 0, -6.84]} s={[18, 1.4, 0.05]} c="#7c2d12" />
      <Tv p={[0, 1.55, -6.75]} w={6.2} />
      <Sign text={L('BAR YA KONA · MPIRA LIVE', 'CORNER BAR · LIVE FOOTBALL')} p={[0, 5.45, -6.7]} h={0.5} fg="#fef3c7" />
      {slots.map(([x, , z], i) => (
        <group key={i} position={[x, 0, z]}>
          <Box s={[0.7, 0.45, 0.7]} c="#dc2626" />
          <Box p={[0, 0.45, 0.32]} s={[0.7, 0.75, 0.08]} c="#dc2626" />
        </group>
      ))}
      {/* counter + fridges */}
      <group position={[6.6, 0, 3.5]}>
        <Box s={[3.6, 1.2, 1.2]} c="#78350f" />
        <Box p={[0, 1.2, 0]} s={[3.8, 0.08, 1.4]} c="#451a03" />
        {[-1.2, 0, 1.2].map((x, i) => <Box key={x} p={[x + 0.2, 0, 2.2]} s={[1, 2.2, 0.8]} m={basic(['#dc2626', '#16a34a', '#1d4ed8'][i])} />)}
      </group>
      {/* nyama choma grill */}
      <group position={[-7, 0, 4.5]}>
        <Box s={[1.6, 0.9, 0.9]} c="#1f2937" />
        <Box p={[0, 0.9, 0]} s={[1.5, 0.06, 0.8]} m={basic('#f97316')} />
        {[-0.4, 0, 0.4].map((x) => <Box key={x} p={[x, 0.98, 0]} s={[0.14, 0.12, 0.6]} c="#7c2d12" />)}
        <pointLight color="#f97316" intensity={6} distance={5} position={[0, 1.4, 0]} />
      </group>
      {!iAmStaff && <Person slot={[6.6, 0, 2.3, 0]} appearance={NPC_LOOKS[5]} mode="idle" />}
      <Crowd me={me} myBusy={myBusy} people={people} slots={slots} localSlot={iAmStaff ? [6.6, 0, 2.3, 0] : null} crowd={7} modeFor={(who, busy, n) => (who === 'me' ? (iAmStaff ? 'idle' : mode(myBusy)) : who === 'npc' ? (n % 3 ? 'cheer' : 'sit') : mode(busy))} />
    </group>
  );
}

// --------------------------------------------------------------- stadium
function Players22() {
  const refs = useRef([]);
  const ball = useRef();
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const bx = Math.sin(t * 0.45) * 18 + Math.sin(t * 1.7) * 3;
    const bz = Math.sin(t * 0.7) * 9;
    ball.current.position.set(bx, 0.25 + Math.abs(Math.sin(t * 3)) * 0.4, bz);
    refs.current.forEach((g, i) => {
      if (!g) return;
      const home = i < 11;
      const hx = (home ? -1 : 1) * (4 + (i % 11) * 1.8);
      const hz = ((i * 37) % 22) - 11;
      const k = 0.2 + ((i * 7) % 10) / 25;
      const x = hx + (bx - hx) * k;
      const z = hz + (bz - hz) * k;
      g.rotation.y = Math.atan2(x - g.position.x, z - g.position.z) || g.rotation.y;
      g.position.set(x, Math.abs(Math.sin(t * 8 + i)) * 0.08, z);
    });
  });
  return (
    <group>
      <mesh ref={ball} geometry={geo('sphere', 0.28, 10, 8)} material={mat('#ffffff')} />
      {Array.from({ length: 22 }, (_, i) => (
        <group key={i} ref={(el) => (refs.current[i] = el)}>
          <mesh geometry={geo('capsule', 0.28, 0.7, 4, 8)} material={mat(i < 11 ? '#dc2626' : '#facc15')} position={[0, 0.75, 0]} />
          <mesh geometry={geo('sphere', 0.22, 8, 8)} material={mat('#4a2c20')} position={[0, 1.5, 0]} />
        </group>
      ))}
    </group>
  );
}

function CrowdStands({ z, rows = 6, dir = 1 }) {
  const ref = useRef();
  const count = rows * 46;
  const seeds = useMemo(() => Array.from({ length: count }, (_, i) => Math.random() * 6), [count]);
  const base = useMemo(() => {
    const arr = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < 46; c++) arr.push([(c - 22.5) * 1.1, 0.6 + r * 0.9, z + dir * r * 1.2]);
    return arr;
  }, [rows, z, dir]);
  useEffect(() => {
    const col = new THREE.Color();
    base.forEach(([x], i) => ref.current.setColorAt(i, col.set(x < 0 ? (i % 5 ? '#dc2626' : '#f8fafc') : i % 5 ? '#facc15' : '#15803d')));
    ref.current.instanceColor.needsUpdate = true;
  }, [base]);
  const m = useMemo(() => new THREE.Matrix4(), []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    base.forEach(([x, y, zz], i) => {
      m.makeTranslation(x, y + Math.max(0, Math.sin(t * 4 + seeds[i])) * 0.25, zz);
      ref.current.setMatrixAt(i, m);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <group>
      {Array.from({ length: rows }, (_, r) => <Box key={r} p={[0, r * 0.9 - 0.5, z + dir * r * 1.2]} s={[52, 0.9, 1.2]} c="#9ca3af" />)}
      <instancedMesh ref={ref} args={[undefined, undefined, count]}>
        <boxGeometry args={[0.55, 0.8, 0.45]} />
        <meshLambertMaterial />
      </instancedMesh>
    </group>
  );
}

function drawScoreboard(ctx) {
  const { hour, minute } = gameClock();
  const min = ((hour * 60 + minute) % 95) + 1;
  ctx.fillStyle = '#0b0f17';
  ctx.fillRect(0, 0, 512, 160);
  ctx.font = '800 54px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = '#ef4444';
  ctx.fillText('SIMBA', 18, 70);
  ctx.fillStyle = '#facc15';
  ctx.fillText('YANGA', 316, 70);
  ctx.fillStyle = '#fff';
  ctx.fillText(`${min > 58 ? 2 : min > 21 ? 1 : 0}-${min > 44 ? 1 : 0}`, 210, 70);
  ctx.font = '700 34px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = '#22c55e';
  ctx.fillText(`${min}'`, 230, 130);
}

function Stadium({ me, myBusy, people }) {
  const board = useCanvasTexture(512, 160, drawScoreboard, 1);
  const slots = useMemo(() => Array.from({ length: 12 }, (_, i) => [(i - 5.5) * 1.3, 0.62, 18.6, Math.PI]), []);
  return (
    <group>
      <Box p={[0, -0.12, 0]} s={[90, 0.1, 70]} c="#4b5563" />
      {Array.from({ length: 10 }, (_, i) => <Box key={i} p={[-25 + i * 5 + 2.5, -0.05, 0]} s={[5, 0.06, 32]} c={i % 2 ? '#2f8f3a' : '#36a043'} />)}
      {[[0, 16, 50, 0.15], [0, -16, 50, 0.15]].map(([x, z, w, d], i) => <Box key={i} p={[x, 0.01, z]} s={[w, 0.02, d]} c="#ffffff" />)}
      {[-25, 0, 25].map((x) => <Box key={x} p={[x, 0.01, 0]} s={[0.15, 0.02, 32]} c="#ffffff" />)}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}><ringGeometry args={[4.4, 4.6, 40]} /><meshBasicMaterial color="#fff" /></mesh>
      {[-25, 25].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <Box p={[0, 0, -3.6]} s={[0.15, 2.4, 0.15]} c="#fff" />
          <Box p={[0, 0, 3.6]} s={[0.15, 2.4, 0.15]} c="#fff" />
          <Box p={[0, 2.4, 0]} s={[0.15, 0.15, 7.3]} c="#fff" />
        </group>
      ))}
      <Players22 />
      <CrowdStands z={19.6} dir={1} />
      <CrowdStands z={-19} dir={-1} />
      {[[-30, -22], [30, -22], [-30, 26], [30, 26]].map(([x, z]) => (
        <group key={`${x}${z}`} position={[x, 0, z]}>
          <Box s={[0.5, 22, 0.5]} c="#d1d5db" />
          <Box p={[0, 22, 0]} s={[4, 1.6, 0.6]} m={basic('#fefce8')} />
        </group>
      ))}
      <group position={[0, 12, -27]}>
        <Box p={[0, -1.5, -0.2]} s={[13.4, 4.4, 0.4]} c="#111827" />
        <mesh position={[0, 0.7, 0.05]}><planeGeometry args={[12.8, 4]} /><meshBasicMaterial map={board} toneMapped={false} /></mesh>
      </group>
      <Sign text={L('UWANJA WA TAIFA · DABI YA KARIAKOO', 'NATIONAL STADIUM · KARIAKOO DERBY')} p={[0, 15.8, -27]} h={1.2} />
      <Crowd me={me} myBusy={myBusy} people={people} slots={slots} crowd={0} modeFor={() => 'cheer'} />
    </group>
  );
}

// ---------------------------------------------------------------- dining
function Plate({ emoji }) {
  const tex = useMemo(() => emojiTexture(emoji || '🍛', { ring: '#ffffff' }), [emoji]);
  return (
    <sprite scale={[0.55, 0.55, 1]} position={[0, 1.05, 0.55]}>
      <spriteMaterial map={tex} depthWrite={false} />
    </sprite>
  );
}

function Dining({ me, myBusy, people }) {
  const fancy = myBusy?.placeId === 'masakigrill';
  const act = myBusy && findActivity(myBusy.placeId, myBusy.id);
  const slots = useMemo(() => [[0, 0.1, 0.9, Math.PI], [-3.2, 0.1, 0.9, Math.PI], [3.2, 0.1, 0.9, Math.PI], [0, 0.1, -1.4, 0], [-3.2, 0.1, -1.4, 0], [3.2, 0.1, -1.4, 0]], []);
  return (
    <group>
      <Room w={14} d={10} h={5} floor={fancy ? '#e7e5e4' : '#fcd34d'} wall={fancy ? '#f8fafc' : '#fde68a'} back={fancy ? '#0ea5e9' : '#f59e0b'} />
      {fancy && <Box p={[0, 1.2, -4.8]} s={[10, 2.6, 0.05]} m={basic('#38bdf8')} />}
      <Sign text={fancy ? 'MASAKI SEAFOOD GRILL' : L('MAMA NTILIE · CHAKULA CHA NYUMBANI', "MAMA NTILIE · HOME COOKING")} p={[0, 4.2, -4.8]} h={0.6} fg={fancy ? '#0f172a' : '#7c2d12'} />
      {[-3.2, 0, 3.2].map((x) => (
        <group key={x} position={[x, 0, -0.25]}>
          <Box s={[2, 0.85, 1.4]} c={fancy ? '#ffffff' : '#16a34a'} />
          {fancy && <mesh geometry={geo('cyl', 0.05, 0.05, 0.3, 8)} material={basic('#fef3c7')} position={[0, 1, 0]} />}
        </group>
      ))}
      {!fancy && (
        <group position={[-5, 0, -3.8]}>
          <Box s={[2.4, 0.9, 1]} c="#78350f" />
          <mesh geometry={geo('cyl', 0.45, 0.4, 0.5, 14)} material={mat('#9ca3af')} position={[-0.5, 1.15, 0]} />
          <Person slot={[0.5, 0, 0.9, Math.PI]} appearance={{ body: 'woman', skin: 2, hair: 'kilemba', outfit: 'kanga', hairColor: 0 }} mode="idle" />
        </group>
      )}
      {slots.map(([x, , z], i) => <Box key={'stool' + i} p={[x, 0, z]} s={[0.55, 0.42, 0.55]} c={fancy ? '#e7e5e4' : '#dc2626'} />)}
      <Crowd me={me} myBusy={myBusy} people={people} slots={slots} localSlot={[0, 0.1, -1.4, 0]} crowd={4} modeFor={() => 'eat'}
        extra={(slot, who) => (who === 'me' ? <Plate emoji={act?.emoji} /> : <Plate emoji={['🍛', '🍚', '🐟', '🍢'][slot[0] > 0 ? 1 : 2]} />)} />
    </group>
  );
}

// ------------------------------------------------------------------ room
function Shower() {
  const ref = useRef();
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.children.forEach((d, i) => (d.position.y = 2.6 - ((clock.elapsedTime * 3 + i * 0.37) % 2.4)));
  });
  return (
    <group position={[2.6, 0, -2.2]}>
      <Box s={[1.6, 0.05, 1.6]} c="#bae6fd" />
      <Box p={[0, 2.7, -0.3]} s={[0.4, 0.1, 0.4]} c="#9ca3af" />
      <group ref={ref}>
        {Array.from({ length: 14 }, (_, i) => <Box key={i} p={[((i * 37) % 10) / 10 - 0.5, 2, ((i * 53) % 10) / 10 - 0.5]} s={[0.03, 0.25, 0.03]} m={basic('#7dd3fc', { transparent: true, opacity: 0.7 })} />)}
      </group>
    </group>
  );
}

function Room1({ me, myBusy }) {
  const act = myBusy?.id;
  const zzz = useMemo(() => labelTexture('Z z z', { bg: 'rgba(0,0,0,0)', fg: '#ffffff', size: 40, bold: 800 }), []);
  const slot = act === 'lala' ? [-2, 0.75, -0.9, 0] : act === 'oga' ? [2.6, 0, -2.2, 0] : act === 'pika' ? [-0.2, 0, -2.6, Math.PI] : [0, 0, 0, 0];
  return (
    <group>
      <Room w={8} d={7} h={4.5} floor="#a8a29e" wall="#fca5a5" back="#f87171" />
      <group position={[-2, 0, -1.6]}>
        <Box s={[2.2, 0.55, 3.4]} c="#78350f" />
        <Box p={[0, 0.55, 0]} s={[2, 0.2, 3.2]} c="#f8fafc" />
        <Box p={[0, 0.75, 0.5]} s={[2, 0.08, 2]} c="#7c3aed" />
        <Box p={[0, 0.75, -1.2]} s={[1.2, 0.2, 0.6]} c="#ffffff" />
      </group>
      <Box p={[0.6, 2.2, -3.38]} s={[1.6, 1.2, 0.05]} m={basic(gameClock().hour >= 19 || gameClock().hour < 6 ? '#1e3a8a' : '#bae6fd')} />
      <group position={[-0.2, 0, -3]}>
        <Box s={[1.2, 0.9, 0.7]} c="#374151" />
        <mesh geometry={geo('cyl', 0.3, 0.26, 0.35, 12)} material={mat('#9ca3af')} position={[0, 1.08, 0]} />
        {act === 'pika' && <pointLight color="#f97316" intensity={3} distance={3} position={[0, 1.2, 0.3]} />}
      </group>
      <Shower />
      <pointLight color="#fef3c7" intensity={8} distance={10} position={[0, 4, 0]} />
      <Person slot={slot} appearance={me.appearance} mode={act === 'lala' ? 'sleep' : act === 'pika' ? 'lift' : 'idle'} id={me.id} username={me.username} />
      {act === 'lala' && (
        <sprite scale={[1.4 * zzz.aspect * 0.5, 0.7, 1]} position={[-2, 2.2, -2.6]}>
          <spriteMaterial map={zzz.texture} depthWrite={false} />
        </sprite>
      )}
    </group>
  );
}

// ------------------------------------------------------------------ beach
function Sea() {
  const ref = useRef();
  useFrame(({ clock }) => (ref.current.position.y = -0.15 + Math.sin(clock.elapsedTime * 0.8) * 0.06));
  return (
    <group>
      <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.15, -16]}>
        <planeGeometry args={[80, 24]} />
        <meshLambertMaterial color="#38bdf8" transparent opacity={0.72} depthWrite={false} />
      </mesh>
      <Box p={[0, -0.12, -4.2]} s={[80, 0.06, 0.6]} m={basic('#f0f9ff')} />
    </group>
  );
}

function Beach({ me, myBusy, people }) {
  const act = myBusy?.id;
  const swim = act === 'ogelea' || act === 'ogelea2';
  const lounger = act === 'pumzika';
  const localSlot = swim ? [0.5, 0, -7.5, Math.PI] : lounger ? [-3, 0.45, 1, 0] : [0, 0, 1.5, Math.PI * 0.9];
  const slots = useMemo(() => [[2, 0, 1.2, -2.6], [-1.6, 0, 2.2, 2.2], [4.5, 0, -1, -1.8], [-5, 0, -9, Math.PI], [6, 0, -10, Math.PI], [-4.5, 0, 0.5, 1.4]], []);
  return (
    <group>
      <Box p={[0, -0.2, 6]} s={[80, 0.1, 22]} c="#f3e3b5" />
      <Sea />
      {[[-3, 0.6, '#ef4444'], [4, -0.5, '#3b82f6'], [-8, 2, '#f59e0b']].map(([x, z, c]) => (
        <group key={x} position={[x, 0, z]}>
          <mesh geometry={geo('cyl', 0.06, 0.06, 2.6, 6)} material={mat('#e5e7eb')} position={[0, 1.3, -0.6]} />
          <mesh geometry={geo('cone', 1.6, 0.6, 10)} material={mat(c)} position={[0, 2.7, -0.6]} />
          <Box p={[0, 0, 0.6]} s={[0.8, 0.4, 2]} c="#ffffff" />
        </group>
      ))}
      {[[-12, -2], [10, 1], [14, -3]].map(([x, z]) => (
        <group key={x} position={[x, 0, z]}>
          <mesh geometry={geo('cyl', 0.2, 0.28, 6, 6)} material={mat('#9a7b4f')} position={[0, 3, 0]} rotation={[0, 0, 0.12]} />
          <mesh geometry={geo('cone', 2.2, 1, 7)} material={mat('#2f9e57')} position={[0.4, 6, 0]} />
        </group>
      ))}
      <Crowd me={me} myBusy={myBusy} people={people} slots={slots} localSlot={localSlot} crowd={5}
        modeFor={(who, busy, n) => (who === 'me' ? (swim ? 'swim' : lounger ? 'sleep' : act === 'mihogo' || act === 'madafu' ? 'eat' : 'idle') : who === 'npc' ? (n >= 3 ? 'swim' : 'idle') : busy?.id?.startsWith('ogelea') ? 'swim' : 'idle')} />
    </group>
  );
}

// ---------------------------------------------------------------- studio
function Studio({ me, myBusy, people }) {
  const onAir = useMemo(() => labelTexture('● ON AIR', { bg: '#dc2626', fg: '#ffffff', size: 40, bold: 800 }), []);
  const video = myBusy?.id === 'video';
  return (
    <group>
      <Room w={10} d={8} h={4.5} floor="#1f2937" wall="#111827" back="#1e1b4b" />
      {Array.from({ length: 24 }, (_, i) => <Box key={i} p={[-4.5 + (i % 8) * 1.28, 0.8 + Math.floor(i / 8) * 1.1, -3.82]} s={[1.1, 0.9, 0.1]} c={i % 2 ? '#312e81' : '#3730a3'} />)}
      <mesh position={[0, 3.9, -3.75]}><planeGeometry args={[1.6 * onAir.aspect * 0.5, 0.8]} /><meshBasicMaterial map={onAir.texture} transparent /></mesh>
      <group position={[0, 0, 0.4]}>
        <mesh geometry={geo('cyl', 0.03, 0.03, 1.5, 6)} material={mat('#9ca3af')} position={[0, 0.75, 0.55]} />
        <mesh geometry={geo('sphere', 0.1, 8, 8)} material={mat('#374151')} position={[0, 1.55, 0.5]} />
      </group>
      <group position={[3, 0, 1.5]}>
        <Box s={[2.4, 0.9, 1]} c="#0b0f17" />
        {Array.from({ length: 8 }, (_, i) => <Box key={i} p={[-0.9 + i * 0.26, 0.92, 0]} s={[0.12, 0.04, 0.5]} m={basic(i % 3 ? '#22c55e' : '#f59e0b')} />)}
        <Person slot={[0, 0.1, 1.1, Math.PI]} appearance={NPC_LOOKS[9]} mode="dj" />
      </group>
      {video && (
        <group position={[-2.5, 0, 2.5]}>
          <mesh geometry={geo('torus', 0.6, 0.06, 8, 24)} material={basic('#fefce8')} position={[0, 1.8, 0]} />
          <Box p={[0.8, 0, 0]} s={[0.5, 1.4, 0.5]} c="#111827" />
          <pointLight color="#fefce8" intensity={10} distance={6} position={[0, 2, 0]} />
        </group>
      )}
      <pointLight color="#a78bfa" intensity={10} distance={10} position={[0, 3.5, 1]} />
      <Crowd me={me} myBusy={myBusy} people={people} slots={[[0, 0, 0.55, 0], [-3, 0.1, 2.2, 0.6], [-1.8, 0.1, 2.6, 0.2]]} localSlot={[0, 0, 0.55, 0]} crowd={1}
        modeFor={(who) => (who === 'me' ? (myBusy ? 'sing' : 'idle') : 'sit')} />
    </group>
  );
}

// ---------------------------------------------------------------- cinema
function drawMovie(ctx, t) {
  const W = 512, H = 220;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  const hue = (t * 12) % 360;
  g.addColorStop(0, `hsl(${hue},60%,45%)`);
  g.addColorStop(1, `hsl(${(hue + 60) % 360},70%,18%)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(0,0,0,.55)';
  for (let i = 0; i < 6; i++) ctx.fillRect(i * 90 + ((t * 30) % 90) - 40, 120 - ((i * 37) % 60), 60, 100);
  ctx.fillStyle = '#fff';
  ctx.font = '800 34px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('BONGO MOVIE', 150, 60);
}
function Cinema({ me, myBusy, people }) {
  const screen = useCanvasTexture(512, 220, drawMovie, 10);
  const slots = useMemo(() => {
    const s = [];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) s.push([(c - 2.5) * 1.4, 0.15, 1 + r * 1.8, Math.PI]);
    return s;
  }, []);
  return (
    <group>
      <Room w={16} d={16} h={8} floor="#1f1f2e" wall="#18181b" back="#0b0b10" />
      <mesh position={[0, 4, -7.8]}><planeGeometry args={[13, 5.6]} /><meshBasicMaterial map={screen} toneMapped={false} /></mesh>
      {slots.map(([x, , z], i) => <Box key={i} p={[x, 0, z + 0.15]} s={[1.1, 0.5, 0.9]} c="#991b1b" />)}
      <pointLight color="#93c5fd" intensity={8} distance={18} position={[0, 4, -4]} />
      <Crowd me={me} myBusy={myBusy} people={people} slots={slots} crowd={9} modeFor={() => 'sit'} />
    </group>
  );
}

// ------------------------------------------------------------------- gym
function Gym({ me, myBusy, people }) {
  const slots = [[0, 0, 0.5, 0], [-3, 0, -0.5, 0.4], [3, 0, -0.5, -0.4], [-1.5, 0, -2.5, 0.2]];
  return (
    <group>
      <Room w={12} d={9} h={4.5} floor="#1f2937" wall="#e5e7eb" back="#bae6fd" />
      <Sign text="BONGO FITNESS" p={[0, 3.6, -4.3]} h={0.7} fg="#16a34a" />
      <group position={[4.5, 0, -2.5]}>
        <Box s={[0.4, 1.4, 3]} c="#374151" />
        {[-1, -0.3, 0.4, 1.1].map((z) => <mesh key={z} geometry={geo('cyl', 0.12, 0.12, 0.6, 8)} material={mat('#111827')} position={[0.3, 1.1, z]} rotation={[0, 0, Math.PI / 2]} />)}
      </group>
      <group position={[-4.5, 0, 1]}>
        <Box s={[1, 0.6, 2.4]} c="#111827" />
        <Box p={[0, 0.6, 0.9]} s={[1, 1.2, 0.2]} c="#111827" />
      </group>
      <Crowd me={me} myBusy={myBusy} people={people} slots={slots} crowd={3} modeFor={() => 'lift'} />
    </group>
  );
}

// ------------------------------------------------------------- classroom
function drawBoard(ctx) {
  ctx.fillStyle = '#14532d';
  ctx.fillRect(0, 0, 512, 200);
  ctx.fillStyle = '#f8fafc';
  ctx.font = '700 28px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('Elimu ni ufunguo wa maisha', 24, 50);
  ctx.font = '600 22px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('TSh 50,000 × 1.3 = TSh 65,000', 24, 100);
  ctx.fillText('f(x) = 2x + 7   →   x = ?', 24, 140);
  ctx.fillText('Mada: Ujasiriamali Dar es Salaam', 24, 180);
}
function Classroom({ me, myBusy, people }) {
  const board = useCanvasTexture(512, 200, drawBoard, 0.2);
  const slots = useMemo(() => {
    const s = [];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) s.push([(c - 1.5) * 2, 0.1, r * 1.9, Math.PI]);
    return s;
  }, []);
  return (
    <group>
      <Room w={12} d={11} h={5} floor="#d6d3d1" wall="#fef3c7" back="#fde68a" />
      <mesh position={[0, 2.5, -5.3]}><planeGeometry args={[7, 2.7]} /><meshBasicMaterial map={board} /></mesh>
      {slots.map(([x, , z], i) => <Box key={i} p={[x, 0, z - 0.75]} s={[1.4, 0.8, 0.6]} c="#a16207" />)}
      <Person slot={[-4, 0, -4, 0]} appearance={{ body: 'man', skin: 1, hair: 'kipara', outfit: 'shati-check', hairColor: 0 }} mode="idle" />
      <Crowd me={me} myBusy={myBusy} people={people} slots={slots} crowd={8} modeFor={() => 'sit'} />
    </group>
  );
}

// -------------------------------------------------------------- hospital
function drawEcg(ctx, t) {
  const w = ctx.canvas.width, h = ctx.canvas.height;
  ctx.fillStyle = '#04140c';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#22c55e';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let x = 0; x <= w; x += 2) {
    const ph = ((x / w) * 3 + t * 1.2) % 1;
    const y = ph > 0.42 && ph < 0.46 ? -0.8 : ph > 0.46 && ph < 0.5 ? 0.55 : ph > 0.6 && ph < 0.7 ? -0.12 : 0;
    ctx[x ? 'lineTo' : 'moveTo'](x, h * 0.55 + y * h * 0.45);
  }
  ctx.stroke();
  ctx.fillStyle = '#22c55e';
  ctx.font = 'bold 22px system-ui';
  ctx.fillText(`♥ ${72 + Math.round(Math.sin(t * 0.7) * 4)}`, 8, 24);
}
function Monitor({ p }) {
  const tex = useCanvasTexture(160, 96, drawEcg, 12);
  return (
    <group position={p}>
      <Box p={[0, 0, 0]} s={[0.08, 1.5, 0.08]} c="#9ca3af" />
      <Box p={[0, 1.5, -0.05]} s={[0.8, 0.52, 0.1]} c="#1f2937" />
      <mesh position={[0, 1.76, 0.01]}><planeGeometry args={[0.7, 0.42]} /><meshBasicMaterial map={tex} toneMapped={false} /></mesh>
    </group>
  );
}
function Bed({ x }) {
  return (
    <group position={[x, 0, -2.5]}>
      <Box s={[1.7, 0.5, 3.3]} c="#cbd5e1" />
      <Box p={[0, 0.5, 0]} s={[1.6, 0.2, 3.1]} c="#ffffff" />
      <Box p={[0, 0.7, 0.75]} s={[1.62, 0.06, 1.6]} c="#93c5fd" />
      <Box p={[0, 0.7, -1.15]} s={[1.1, 0.18, 0.55]} c="#f8fafc" />
      <Box p={[0, 0, -1.65]} s={[1.7, 1.3, 0.1]} c="#94a3b8" />
      {/* IV drip */}
      <Box p={[-1.15, 0, -1.2]} s={[0.05, 2.2, 0.05]} c="#9ca3af" />
      <Box p={[-1.15, 1.9, -1.2]} s={[0.25, 0.35, 0.08]} m={basic('#e0f2fe', { transparent: true, opacity: 0.85 })} />
      <Monitor p={[1.2, 0, -1.3]} />
      {/* privacy curtain rail + curtain */}
      <Box p={[1.45, 0, 0.1]} s={[0.04, 3.2, 0.04]} c="#cbd5e1" />
      <Box p={[1.45, 0.4, -0.7]} s={[0.03, 2.7, 1.5]} c="#a7f3d0" />
    </group>
  );
}
const STAFF_LOOK = [
  { body: 'woman', skin: 2, hair: 'misuko', outfit: 'scrubs', hairColor: 0 },
  { body: 'man', skin: 1, hair: 'kiduku', outfit: 'scrubs', hairColor: 0 },
];
function Hospital({ me, myBusy, people }) {
  const beds = [-6, -2, 2, 6];
  const slots = beds.map((x) => [x, 0.72, -1.4, 0]);
  const staffish = (b) => b?.kind === 'job' || b?.id === 'pima';
  const patients = people.filter((r) => !staffish(r.busy));
  const staff = people.filter((r) => staffish(r.busy));
  const meMode = myBusy?.kind === 'job' ? 'idle' : myBusy?.id === 'pima' ? 'sit' : myBusy ? 'sleep' : 'idle';
  const standSlots = [[-0.2, 0, 1.6, Math.PI], [3.8, 0, 1.4, Math.PI * 0.85], [-3.8, 0, 1.4, Math.PI * 1.15], [0, 0, 3, Math.PI]];
  const meSlot = meMode === 'sleep' ? slots[1] : meMode === 'sit' ? [-0.2, 0, 1.2, Math.PI] : standSlots[0];
  return (
    <group>
      <Room w={18} d={11} h={5} floor="#e2e8f0" wall="#f1f5f9" back="#dbeafe" />
      <Box p={[0, 0, -5.3]} s={[18, 1.1, 0.05]} c="#bfdbfe" />
      <Sign text="✚ MUHIMBILI · WODI YA DHARURA" p={[0, 3.7, -5.3]} h={0.6} fg="#dc2626" />
      {beds.map((x) => <Bed key={x} x={x} />)}
      {/* check-up desk */}
      <group position={[-0.2, 0, -0.1]}>
        {meMode === 'sit' && <Box p={[0, 0, -0.6]} s={[1.8, 0.85, 0.7]} c="#e5e7eb" />}
      </group>
      {beds.map((x, i) => <pointLight key={i} color="#f0f9ff" intensity={2.5} distance={6} position={[x, 3.6, -2]} />)}
      <Crowd
        me={me}
        myBusy={myBusy}
        people={patients}
        slots={slots.filter((sl) => sl !== meSlot)}
        localSlot={meSlot}
        crowd={3}
        modeFor={(kind) => (kind === 'me' ? meMode : 'sleep')}
      />
      {staff.slice(0, 3).map((r, i) => <Person key={r.id} slot={standSlots[i + 1]} appearance={r.appearance} mode="idle" id={r.id} username={r.username} />)}
      {meMode !== 'idle' && <Person slot={[2.4, 0, 0.9, Math.PI * 1.1]} appearance={STAFF_LOOK[0]} mode="idle" />}
      <Person slot={[-4, 0, 0.9, Math.PI * 0.9]} appearance={STAFF_LOOK[1]} mode="idle" />
    </group>
  );
}

// ------------------------------------------------------------ workplaces
/** Which part of the shift you're in (commute, locker, brief, job, wrap-up), re-checked each second. */
function useWorkStage(busy) {
  const [st, setSt] = useState(0);
  useEffect(() => {
    if (busy?.kind !== 'job') return undefined;
    const tick = () => setSt(workStage((Date.now() - busy.startedAt) / (busy.endsAt - busy.startedAt)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [busy?.kind, busy?.startedAt, busy?.endsAt]);
  return busy?.kind === 'job' ? st : 3;
}
function drawCode(ctx, t) {
  const w = ctx.canvas.width, h = ctx.canvas.height;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, w, h);
  const cols = ['#38bdf8', '#a78bfa', '#4ade80', '#f472b6', '#facc15'];
  const off = Math.floor(t * 3);
  for (let i = 0; i < 9; i++) {
    const r = (i + off) % 17;
    ctx.fillStyle = cols[(i + off) % cols.length];
    ctx.fillRect(8 + (r % 4) * 10, 8 + i * 13, 30 + ((r * 37) % 80), 6);
  }
}
function Desk({ p, ry = 0 }) {
  const tex = useCanvasTexture(128, 128, drawCode, 4);
  return (
    <group position={p} rotation={[0, ry, 0]}>
      <Box p={[0, 0, 0]} s={[1.8, 0.78, 0.9]} c="#e7e5e4" />
      <Box p={[0, 0, -0.32]} s={[1.8, 0.78, 0.05]} c="#d6d3d1" />
      <Box p={[0, 0.78, -0.22]} s={[0.12, 0.3, 0.12]} c="#374151" />
      <Box p={[0, 1.02, -0.25]} s={[0.9, 0.55, 0.05]} c="#111827" />
      <mesh position={[0, 1.3, -0.22]}><planeGeometry args={[0.82, 0.47]} /><meshBasicMaterial map={tex} toneMapped={false} /></mesh>
      <Box p={[0, 0.79, 0.1]} s={[0.6, 0.03, 0.2]} c="#9ca3af" />
      <Box p={[0, 0, 0.85]} s={[0.6, 0.45, 0.55]} c="#1f2937" />
      <Box p={[0, 0.45, 1.08]} s={[0.6, 0.7, 0.08]} c="#1f2937" />
    </group>
  );
}
function Lockers({ p }) {
  return (
    <group position={p}>
      {[0, 1, 2, 3, 4].map((i) => (
        <group key={i} position={[0, 0, (i - 2) * 0.75]}>
          <Box s={[0.6, 2.2, 0.7]} c={i % 2 ? '#64748b' : '#475569'} />
          <Box p={[0.31, 1.5, 0.2]} s={[0.02, 0.08, 0.15]} c="#e5e7eb" />
        </group>
      ))}
    </group>
  );
}
const COWORKERS = [0, 1, 2, 3, 4, 5].map((i) => ({ ...NPC_LOOKS[i + 6], outfit: ['suti', 'ofisi-sketi', 'polo', 'shati-check', 'kaunda', 'blauzi-jeans'][i] }));

/** Office / bank floor: desks with live screens, lockers, a brief corner, colleagues at work. */
function Office({ me, myBusy, people, bank }) {
  const stage = useWorkStage(myBusy);
  const desks = [[-4.5, 0, -2.2], [0, 0, -2.2], [4.5, 0, -2.2], [-4.5, 0, 1.4], [0, 0, 1.4], [4.5, 0, 1.4]];
  const seat = (d) => [d[0], 0, d[2] + 0.85, Math.PI];
  // Where you are depends on the shift stage.
  const mySlot = stage === 0 ? [0, 0, 5, Math.PI] : stage === 1 ? [-6.3, 0, -0.5, Math.PI / 2] : stage === 2 ? [5.2, 0, 4.6, -Math.PI * 0.8] : seat(desks[1]);
  const myMode = stage === 0 ? 'walk' : stage === 1 || stage === 2 ? 'idle' : stage === 4 ? 'idle' : 'type';
  const workers = people.filter((r) => r.busy?.kind === 'job');
  const others = [desks[0], desks[2], desks[3], desks[4], desks[5]];
  return (
    <group>
      <Room w={16} d={12} h={5} floor={bank ? '#e7e5e4' : '#cbd5e1'} wall="#f8fafc" back={bank ? '#1e3a8a' : '#e0f2fe'} />
      <Sign text={bank ? 'NMB · BANKING HALL' : 'BONGO HQ · OFISINI'} p={[0, 3.6, -5.8]} h={0.55} fg={bank ? '#fde047' : '#0f172a'} />
      {bank && (
        <group position={[0, 0, -4.4]}>
          <Box s={[12, 1.1, 0.8]} c="#0f172a" />
          <Box p={[0, 1.1, 0]} s={[12.2, 0.06, 1]} c="#f8fafc" />
          {[-4, 0, 4].map((x) => <Box key={x} p={[x, 1.16, -0.1]} s={[0.5, 0.35, 0.05]} c="#38bdf8" />)}
          {[-3, 1, 5].map((x, i) => <Person key={x} slot={[x, 0, 0.9, Math.PI]} appearance={NPC_LOOKS[i + 14]} mode="idle" />)}
        </group>
      )}
      {(bank ? desks.slice(3) : desks).map((d, i) => <Desk key={i} p={d} />)}
      <Lockers p={[-7.4, 0, -0.5]} />
      {/* brief corner: whiteboard + standing table */}
      <Box p={[6.5, 0, 4.2]} s={[1.2, 1.05, 1.2]} c="#a16207" />
      <Box p={[7.7, 1, 2.8]} s={[0.05, 1.4, 2.2]} c="#ffffff" />
      <Person slot={[6.5, 0, 5.4, Math.PI]} appearance={COWORKERS[0]} mode="idle" />
      {/* colleagues: real players working here first, then NPCs */}
      {others.filter((d) => !bank || d[2] > 0).map((d, i) => {
        const r = workers[i];
        return r
          ? <Person key={r.id} slot={seat(d)} appearance={r.appearance} mode="type" id={r.id} username={r.username} />
          : <Person key={`c${i}`} slot={seat(d)} appearance={COWORKERS[(i + 1) % COWORKERS.length]} mode="type" />;
      })}
      <Person slot={mySlot} appearance={me.appearance} mode={myMode} id={me.id} username={me.username} />
      {[[-4, 4.2, -1], [4, 4.2, -1], [0, 4.2, 3]].map((p, i) => <pointLight key={i} color="#f8fafc" intensity={4} distance={10} position={p} />)}
    </group>
  );
}

function drawTill(ctx, t) {
  ctx.fillStyle = '#022c22';
  ctx.fillRect(0, 0, 128, 64);
  ctx.fillStyle = '#4ade80';
  ctx.font = 'bold 22px monospace';
  ctx.fillText(`${(12000 + Math.floor(t * 937) % 88000).toLocaleString()}`, 8, 40);
}
/** Supermarket / Kariakoo shop floor: shelves of goods, a till, customers queueing. */
function Shop({ me, myBusy, people }) {
  const stage = useWorkStage(myBusy);
  const till = useCanvasTexture(128, 64, drawTill, 3);
  const goods = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#facc15', '#14b8a6'];
  const mySlot = stage === 0 ? [0, 0, 5, Math.PI] : stage === 1 ? [-6.3, 0, 2.8, Math.PI / 2] : stage === 2 ? [5, 0, 4, -Math.PI * 0.75] : [0, 0, -0.2, Math.PI];
  const t = useRef();
  useFrame(({ clock }) => {
    // the queue shuffles forward
    if (t.current) t.current.position.z = -((clock.elapsedTime * 0.3) % 1.2);
  });
  return (
    <group>
      <Room w={16} d={12} h={4.5} floor="#e5e7eb" wall="#fefce8" back="#fde68a" />
      <Sign text="SUPERMARKET · KARIBU" p={[0, 3.4, -5.8]} h={0.55} fg="#b91c1c" />
      {[-5.5, -2, 2, 5.5].map((x, k) => (
        <group key={x} position={[x, 0, -3.8]}>
          <Box s={[2.6, 2.4, 0.8]} c="#f1f5f9" />
          {[0.5, 1.2, 1.9].map((y, r) => Array.from({ length: 6 }, (_, i) => (
            <Box key={`${r}${i}`} p={[-1.05 + i * 0.42, y, 0.3]} s={[0.3, 0.45, 0.3]} c={goods[(i + r + k) % goods.length]} />
          )))}
        </group>
      ))}
      <group position={[0, 0, 0.6]}>
        <Box s={[3, 1, 0.9]} c="#334155" />
        <Box p={[0, 1, 0]} s={[3.1, 0.05, 1]} c="#0f172a" />
        <Box p={[-0.8, 1.05, 0]} s={[0.5, 0.35, 0.45]} c="#111827" />
        <mesh position={[-0.8, 1.3, 0.24]}><planeGeometry args={[0.44, 0.22]} /><meshBasicMaterial map={till} toneMapped={false} /></mesh>
        <Box p={[0.7, 1.05, 0]} s={[1.2, 0.04, 0.6]} c="#475569" />
      </group>
      <Lockers p={[-7.4, 0, 2.8]} />
      <group ref={t}>
        {[0, 1, 2, 3].map((i) => <Person key={i} slot={[0.2, 0, 2 + i * 1.2, Math.PI]} appearance={NPC_LOOKS[(i * 5 + 3) % NPC_LOOKS.length]} mode="idle" />)}
      </group>
      {people.filter((r) => r.busy?.kind === 'job').slice(0, 2).map((r, i) => <Person key={r.id} slot={[-4 + i * 8, 0, -2.4, Math.PI]} appearance={r.appearance} mode="lift" id={r.id} username={r.username} />)}
      <Person slot={[mySlot[0], 0, mySlot[2] - (stage >= 3 ? 0 : 0), stage >= 3 ? 0 : mySlot[3]]} appearance={me.appearance} mode={stage === 0 ? 'walk' : stage >= 3 && stage < 4 ? 'type' : 'idle'} id={me.id} username={me.username} />
      <pointLight color="#fffbeb" intensity={6} distance={14} position={[0, 4, 0]} />
    </group>
  );
}

// ---------------------------------------------------------------- flight
function drawWindowSky(ctx, t) {
  const w = ctx.canvas.width, h = ctx.canvas.height;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#38bdf8');
  g.addColorStop(1, '#e0f2fe');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(255,255,255,.95)';
  for (let i = 0; i < 6; i++) {
    const x = ((i * 53 - t * 40) % (w + 60) + w + 60) % (w + 60) - 30;
    const y = 30 + ((i * 37) % 60);
    ctx.beginPath();
    ctx.ellipse(x, y, 26, 9, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 14, y - 6, 16, 8, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}
const PAX = Array.from({ length: 40 }, (_, i) => NPC_LOOKS[(i * 7) % NPC_LOOKS.length]);
const CREW_LOOK = { body: 'woman', skin: 3, hair: 'kilemba', outfit: 'ofisi-sketi', hairColor: 0 };

/** Inside the cabin: 2+2 seating, windows with drifting clouds, bins, crew trolley. */
function Cabin({ me, phase, job, crewRef }) {
  const sky = useCanvasTexture(128, 128, drawWindowSky, 10);
  const rows = Array.from({ length: 9 }, (_, i) => -7 + i * 1.6);
  const seatsX = [-1.55, -0.85, 0.85, 1.55];
  const meSeat = [-1.55, 0.25, rows[3], 0];
  // Boarding: you walk down the aisle to your seat; crew/pilot jobs stand or fly.
  const walking = phase === 'boarding';
  const mine = job === 'rubani' ? [0, 0.25, 9.6, 0] : job ? [0, 0, rows[2] + 0.8, Math.PI] : meSeat;
  const meRef = useRef();
  const t0 = useRef(null);
  useFrame(({ clock }) => {
    const g = meRef.current;
    if (!g) return;
    if (walking && !job) {
      if (t0.current == null) t0.current = clock.elapsedTime;
      const k = Math.min(1, (clock.elapsedTime - t0.current) / 6);
      g.position.set(k < 0.85 ? 0 : -1.55 * ((k - 0.85) / 0.15), 0, 9 - k * (9 - rows[3]));
      g.rotation.y = k < 0.85 ? Math.PI : -Math.PI / 2;
    } else {
      g.position.set(mine[0], 0, mine[2]);
      g.rotation.y = 0;
    }
    if (crewRef.current) crewRef.current.position.z = Math.sin(clock.elapsedTime * 0.25) * 5;
  });
  const meMode = walking && !job ? 'walk' : job === 'mhudumu-ndege' ? 'idle' : 'sit';
  return (
    <group>
      <Box p={[0, -0.1, 0]} s={[4.8, 0.1, 22]} c="#475569" />
      <Box p={[0, -0.05, 0]} s={[0.9, 0.06, 22]} c="#1e3a8a" />
      {[-1, 1].map((sd) => (
        <group key={sd}>
          <Box p={[sd * 2.45, 0, 0]} s={[0.1, 2.8, 22]} c="#f1f5f9" />
          <Box p={[sd * 1.9, 2.05, 0]} s={[1.1, 0.5, 21]} c="#e2e8f0" />
          {rows.map((z) => (
            <mesh key={z} position={[sd * 2.39, 1.25, z + 0.2]} rotation={[0, -sd * Math.PI / 2, 0]}>
              <planeGeometry args={[0.45, 0.6]} />
              <meshBasicMaterial map={sky} toneMapped={false} />
            </mesh>
          ))}
        </group>
      ))}
      <Box p={[0, 2.75, 0]} s={[4.8, 0.08, 22]} c="#f8fafc" />
      {rows.map((z) => seatsX.map((x) => (
        <group key={`${x}${z}`} position={[x, 0, z]}>
          <Box s={[0.6, 0.45, 0.55]} c="#1e40af" />
          <Box p={[0, 0.45, -0.3]} s={[0.6, 0.75, 0.12]} c="#1e3a8a" />
          <Box p={[0, 1.15, -0.3]} s={[0.4, 0.12, 0.13]} c="#e2e8f0" />
        </group>
      )))}
      {/* passengers (sitting facing forward = +z... seats face -z here, so ry=π) */}
      {rows.map((z, r) => seatsX.map((x, c) => {
        if (x === meSeat[0] && z === meSeat[2]) return null;
        if ((r * 4 + c) % 3 === 1) return null; // some empty seats
        return <Person key={`p${r}${c}`} slot={[x, 0.25, z + 0.05, 0]} appearance={PAX[(r * 4 + c) % PAX.length]} mode={(r + c) % 5 === 0 ? 'sleep' : 'sit'} />;
      }))}
      {/* crew + trolley in the aisle */}
      <group ref={crewRef}>
        <Box p={[0, 0, -0.9]} s={[0.55, 0.95, 0.8]} c="#cbd5e1" />
        <Person slot={[0, 0, 0, Math.PI]} appearance={CREW_LOOK} mode="idle" />
      </group>
      {/* cockpit door + galley */}
      <Box p={[0, 0, 10.6]} s={[4.8, 2.8, 0.15]} c="#cbd5e1" />
      <Box p={[0, 0, 10.5]} s={[0.9, 2.1, 0.05]} c="#64748b" />
      <group ref={meRef}>
        <Person slot={[0, walking && !job ? 0 : mine[1], 0, mine[3]]} appearance={me.appearance} mode={meMode} id={me.id} username={me.username} />
      </group>
      {rows.map((z) => <pointLight key={z} color="#fef9c3" intensity={1.2} distance={4} position={[0, 2.5, z]} />)}
    </group>
  );
}

const CLOUDS = Array.from({ length: 26 }, (_, i) => {
  const r = rng(500 + i);
  return { x: (r() - 0.5) * 220, y: -18 - r() * 40, z: (r() - 0.5) * 420, s: 6 + r() * 10 };
});
/** Outside: the plane rolling down the runway, climbing through clouds, or landing at the destination. */
function Sky({ phase, k, flight }) {
  const plane = useRef();
  const world = useRef();
  const clouds = useRef();
  const dest = useMemo(() => labelTexture(`KARIBU ${flight?.dest || 'DAR'}`, { bg: 'rgba(0,0,0,0)', fg: '#ffffff', size: 60, bold: 900 }), [flight?.dest]);
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    // The plane stays put; the world moves under it.
    let alt = 0, pitch = 0, speed = 0, roll = Math.sin(t * 0.4) * 0.03;
    if (phase === 'takeoff') {
      speed = 20 + k * 140;
      alt = Math.max(0, (k - 0.45) / 0.55) ** 1.6 * 60;
      pitch = k > 0.45 ? -0.16 : 0;
    } else if (phase === 'landing') {
      speed = 140 - k * 120;
      alt = Math.max(0, 1 - k / 0.75) ** 1.4 * 60;
      pitch = k < 0.75 ? 0.05 : 0;
    } else {
      speed = 160;
      alt = 60;
      roll = Math.sin(t * 0.3) * 0.06;
    }
    plane.current.rotation.set(pitch, 0, roll);
    world.current.position.y = -alt;
    if (clouds.current) clouds.current.children.forEach((c) => {
      c.position.z -= speed * dt * 0.5;
      if (c.position.z < -210) c.position.z += 420;
    });
    // runway dashes stream past
    const ground = world.current.userData.dash;
    if (ground) ground.position.z = -((t * speed * 0.3) % 12);
  });
  const ground = phase === 'cruise' ? flight?.ground || '#0e7490' : phase === 'landing' ? flight?.land || '#a3e635' : '#86efac';
  return (
    <group>
      <group ref={world}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.6, 0]}><planeGeometry args={[1200, 1200]} /><meshBasicMaterial color={ground} /></mesh>
        {phase !== 'cruise' && (
          <group>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.55, 0]}><planeGeometry args={[18, 900]} /><meshBasicMaterial color="#334155" /></mesh>
            <group ref={(g) => { if (world.current && g) world.current.userData.dash = g; }}>
              {Array.from({ length: 70 }, (_, i) => <Box key={i} p={[0, -2.54, -400 + i * 12]} s={[0.5, 0.02, 5]} c="#f8fafc" />)}
            </group>
            {phase === 'landing' && (
              <mesh position={[16, 6, 60]} rotation={[0, Math.PI + 0.4, 0]}>
                <planeGeometry args={[26 * dest.aspect * 0.25, 6.5]} />
                <meshBasicMaterial map={dest.texture} transparent />
              </mesh>
            )}
            {[-30, -40, 30, 42].map((x, i) => (
              <group key={i} position={[x, -2.6, 40 + i * 25]}>
                <Box s={[0.5, 6, 0.5]} c="#7c5a3a" />
                <mesh geometry={geo('sphere', 2.6, 7, 5)} material={mat('#16a34a')} position={[0, 6.5, 0]} />
              </group>
            ))}
          </group>
        )}
      </group>
      <group ref={clouds}>
        {CLOUDS.map((c, i) => (
          <mesh key={i} geometry={geo('sphere', 1, 8, 6)} material={basic('#ffffff', { transparent: true, opacity: 0.9 })} position={[c.x, phase === 'cruise' ? c.y : c.y + 40, c.z]} scale={[c.s * 1.8, c.s * 0.6, c.s]} />
        ))}
      </group>
      <group ref={plane}><Plane gear={phase !== 'cruise'} /></group>
    </group>
  );
}

/** A whole trip: boarding inside, take-off outside, cruise (inside ⇄ outside), landing. */
function Flight({ me, myBusy }) {
  const view = useStore((s) => s.flightView);
  const crewRef = useRef();
  const [st, setSt] = useState({ phase: 'boarding', k: 0, f: 0 });
  const job = myBusy?.kind === 'job' ? myBusy.id : null;
  const act = myBusy?.kind === 'activity' ? findActivity(myBusy.placeId, myBusy.id) : null;
  useFrame(({ clock }) => {
    if (!myBusy) return;
    const f = Math.min(1, Math.max(0, (Date.now() - myBusy.startedAt) / (myBusy.endsAt - myBusy.startedAt)));
    const ph = flightPhase(job ? 0.5 : f); // crew jobs: mostly cruising
    const phases = [0, 0.16, 0.32, 0.8, 1];
    const i = ['boarding', 'takeoff', 'cruise', 'landing'].indexOf(ph[1]);
    const k = (f - phases[i]) / (phases[i + 1] - phases[i]);
    if (ph[1] !== st.phase || Math.abs(k - st.k) > 0.02) setSt({ phase: ph[1], k, f });
    // Camera: inside cabin vs. chase cam outside.
    const outsideAuto = st.phase === 'takeoff' || st.phase === 'landing' || (st.phase === 'cruise' && st.k > 0.5);
    const outside = view ? view === 'outside' : outsideAuto;
    const t = clock.elapsedTime;
    if (outside) {
      // Slow orbit while cruising; fixed rear-quarter chase for take-off/landing. Far enough
      // back that the whole airliner fits a portrait phone screen.
      const a = st.phase === 'cruise' ? 0.5 + Math.sin(t * 0.08) * 1.1 : 0.55;
      const r = st.phase === 'cruise' ? 78 : 66;
      sceneCam.pos = [OUT[0] + Math.sin(a) * r, OUT[1] + (st.phase === 'cruise' ? 16 : 9) + Math.sin(t * 0.2) * 2, OUT[2] - Math.cos(a) * r];
      sceneCam.look = [OUT[0], OUT[1], OUT[2] + 2];
    } else {
      sceneCam.pos = [0.5 + Math.sin(t * 0.3) * 0.1, 2.4, 9.8];
      sceneCam.look = [-0.7, 0.9, -3];
    }
  });
  return (
    <group>
      <Cabin me={me} phase={st.phase} job={job} crewRef={crewRef} />
      <group position={OUT}><Sky phase={st.phase} k={st.k} flight={act?.flight} /></group>
    </group>
  );
}
const OUT = [0, 300, -600];

// ---------------------------------------------------------------- config
export const SCENES = {
  club: { C: Club, camera: { pos: [0, 8.5, 13], look: [0, 1.2, -1.5] }, dark: true, bg: '#0b0614', light: 0.25 },
  lounge: { C: (p) => <Club {...p} lounge />, camera: { pos: [0, 7, 13], look: [0, 1.2, -2] }, bg: '#f59e0b', light: 0.7 },
  bar: { C: Bar, camera: { pos: [0, 6.2, 9.5], look: [0, 2, -5] }, bg: '#1c1917', light: 0.65 },
  stadium: { C: Stadium, camera: { pos: [0, 8, 27], look: [0, 1.5, 6] }, light: 1 },
  dining: { C: Dining, camera: { pos: [0, 6, 8.5], look: [0, 0.8, -1] }, bg: '#1c1917', light: 0.9 },
  room: { C: Room1, camera: { pos: [0.4, 5.5, 6], look: [-0.4, 0.6, -1.5] }, bg: '#1c1917', light: 0.6 },
  beach: { C: Beach, camera: { pos: [0, 6, 11], look: [0, 0.3, -4] }, light: 1 },
  studio: { C: Studio, camera: { pos: [0, 4.5, 7.5], look: [0, 1.4, 0] }, bg: '#0b0614', light: 0.4 },
  cinema: { C: Cinema, camera: { pos: [0, 6.5, 10.5], look: [0, 2.6, -8] }, bg: '#000000', light: 0.25 },
  gym: { C: Gym, camera: { pos: [0, 5, 8], look: [0, 1, -1] }, bg: '#1c1917', light: 0.9 },
  flight: { C: Flight, dynamic: true, bg: '#7dd3fc', light: 1.1 },
  office: { C: Office, camera: { pos: [0, 8, 11], look: [0, 0.6, -0.5] }, bg: '#0f172a', light: 1 },
  bank: { C: (p) => <Office {...p} bank />, camera: { pos: [0, 8, 11], look: [0, 0.6, -0.8] }, bg: '#0f172a', light: 1 },
  shop: { C: Shop, camera: { pos: [0, 7.5, 10.5], look: [0, 0.6, -0.5] }, bg: '#1c1917', light: 1 },
  hospital: { C: Hospital, camera: { pos: [0, 8.5, 12], look: [0, 0.6, -2.2] }, bg: '#0f172a', light: 1 },
  classroom: { C: Classroom, camera: { pos: [0, 5.5, 9], look: [0, 1.6, -4] }, bg: '#1c1917', light: 0.9 },
};

export function ActivityScene({ scene, placeId, me, myBusy }) {
  const cfg = SCENES[scene];
  const people = useScenePeople(placeId, scene);
  if (!cfg) return null;
  return (
    <group position={SCENE_ORIGIN}>
      <cfg.C me={me} myBusy={myBusy} people={people} />
    </group>
  );
}
