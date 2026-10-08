// Activity scenes: interiors and set-pieces shown while you're inside a venue or doing
// something (dancing, watching the match, eating, sleeping…). Rendered far from the
// city at SCENE_ORIGIN, with every real player who's in the same place plus some regulars.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { randomAppearance, findActivity, gameClock, workStage, flightPhase, placeById, vehicleById as vehicleByIdS, CITY_ARRIVAL } from '@shared/world.js';
import { Plane, Car, Vehicle as VehicleS } from './Vehicle.jsx';
import { PartyDecor } from './Party.jsx';
import { Shadows } from './Shadows.jsx';
import { livePartyAt } from '../ui/events.js';

// Where the party banner hangs per scene (defaults to the back wall).
const PARTY_BANNER = { stadium: [0, 7, -2], beach: [0, 4.5, -3], dhow: [0, 6.5, -3], golf: [0, 4.5, -6], karting: [0, 4, -7.3], concert: [0, 6.6, -7.6], cinema: [0, 6, -8], grill: [0, 3.4, -4.8], waterpark: [-3, 4.5, -4] };
import { mat, geo, labelTexture, emojiTexture } from './textures.js';
import { Body, Overhead } from './Players.jsx';
import { remotes } from '../net.js';
import { useStore } from '../store.js';
import { L, loc } from '../i18n.js';

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
  const cols = 7, rows = 5, size = 1.15;
  const palette = useMemo(() => ['#f472b6', '#60a5fa', '#a78bfa', '#fde047', '#4ade80', '#fb923c', '#22d3ee'].map((c) => new THREE.Color(c)), []);
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
      const c = i % cols;
      const r = Math.floor(i / cols);
      const col = palette[(c + r + beat.current) % palette.length].clone();
      col.multiplyScalar((i * 7 + beat.current) % 4 === 0 ? 1 : 0.62);
      ref.current.setColorAt(i, col);
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

function drawVideo(ctx, t) {
  const w = ctx.canvas.width, h = ctx.canvas.height;
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, `hsl(${(t * 30) % 360}, 80%, 60%)`);
  g.addColorStop(1, `hsl(${(t * 30 + 120) % 360}, 80%, 45%)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // a dancer silhouette grooving on the big screen
  const sway = Math.sin(t * 4) * 10;
  ctx.fillStyle = 'rgba(17,24,39,.85)';
  ctx.beginPath(); ctx.arc(w / 2 + sway, h * 0.3, 16, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(w / 2 - 14 + sway, h * 0.38, 28, 50);
  ctx.fillRect(w / 2 - 12 + sway * 1.4, h * 0.6, 10, 40);
  ctx.fillRect(w / 2 + 2 + sway * 0.6, h * 0.6, 10, 40);
  ctx.save(); ctx.translate(w / 2 + sway, h * 0.42); ctx.rotate(-1 + Math.sin(t * 4)); ctx.fillRect(0, 0, 8, 36); ctx.restore();
}

function Club({ me, myBusy, people, lounge, placeId }) {
  const venueName = (loc(placeById[placeId]) || 'CLUB').toUpperCase();
  const screenTex = useCanvasTexture(256, 144, drawVideo, 10);
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
          <Room w={22} d={17} h={6} floor="#141418" wall="#1f1f26" back="#18181f" />
          {/* glowing LED strips along the wall tops and the skirting */}
          <Box p={[0, 5.9, -8.35]} s={[22, 0.07, 0.07]} m={basic('#fbbf24')} />
          <Box p={[-10.85, 5.9, 0]} s={[0.07, 0.07, 17]} m={basic('#fbbf24')} />
          <Box p={[10.85, 5.9, 0]} s={[0.07, 0.07, 17]} m={basic('#fbbf24')} />
          <Box p={[0, 0.04, -8.3]} s={[22, 0.04, 0.05]} m={basic('#f59e0b')} />
          <Box p={[-10.8, 0.04, 0]} s={[0.05, 0.04, 17]} m={basic('#f59e0b')} />
          <group position={[0, 0, 1.2]}><DanceFloor /></group>
          <Spotlights />
          <DiscoBall />
          <Sign text={venueName} p={[0, 4.6, -8.3]} h={1.1} fg="#f472b6" />
          {/* back-lit bar with bottles, neon sign, stools and a bartender */}
          <group position={[-8.2, 0, -1]}>
            <Box s={[1.3, 1.15, 8]} c="#0f0f13" />
            <Box p={[0, 1.15, 0]} s={[1.5, 0.08, 8.2]} c="#27272a" />
            <Box p={[0.68, 0.08, 0]} s={[0.04, 0.05, 8]} m={basic('#fbbf24')} />
            {[-3, -1.5, 0, 1.5, 3].map((z) => (
              <group key={z} position={[1.3, 0, z]}>
                <mesh geometry={geo('cyl', 0.05, 0.05, 0.85, 8)} material={mat('#3f3f46')} position={[0, 0.42, 0]} />
                <mesh geometry={geo('cyl', 0.3, 0.3, 0.1, 16)} material={mat('#e11d48')} position={[0, 0.9, 0]} />
              </group>
            ))}
            <group position={[-2.35, 0, 0]}>
              <Box p={[0, 0.4, 0]} s={[0.4, 3.2, 7.6]} c="#18181b" />
              {[1.6, 2.4, 3.2].map((y) => (
                <group key={y}>
                  <Box p={[0.25, y - 0.05, 0]} s={[0.4, 0.04, 7.4]} m={basic('#f59e0b')} />
                  {Array.from({ length: 12 }, (_, i) => (
                    <mesh key={i} geometry={geo('cyl', 0.07, 0.08, 0.42, 8)} material={basic(['#22d3ee', '#f97316', '#a3e635', '#f472b6', '#facc15'][(i + y * 3) % 5])} position={[0.28, y + 0.2, -3.3 + i * 0.6]} />
                  ))}
                </group>
              ))}
              <Sign text="BAR" p={[0.45, 4.4, 0]} h={0.9} fg="#ff2bd6" />
            </group>
            <Person slot={[-1.2, 0, 0.5, Math.PI / 2]} appearance={NPC_LOOKS[5]} mode="lift" />
          </group>
          {/* big screen + LED stage panel */}
          <group position={[10.6, 0, -2]} rotation={[0, -Math.PI / 2, 0]}>
            <Box p={[0, 1.4, 0]} s={[6.4, 3.8, 0.2]} c="#0b0b0f" />
            <mesh position={[0, 3.3, 0.12]}><planeGeometry args={[6, 3.4]} /><meshBasicMaterial map={screenTex} toneMapped={false} /></mesh>
            <Box p={[0, 0, 0.6]} s={[5.6, 1, 1]} c="#1e1b4b" />
            <Box p={[0, 0.15, 1.11]} s={[5.4, 0.7, 0.02]} m={basic('#a855f7')} />
          </group>
          {/* speakers */}
          {[[6.2, -7.4], [7.6, -7.4], [-6.4, 6.8], [6.4, 6.8]].map(([x, z]) => (
            <group key={`${x}${z}`} position={[x, 0, z]}>
              <Box s={[1.1, 2.8, 1]} c="#f9a8d4" />
              {[0.6, 1.4, 2.2].map((y) => <mesh key={y} geometry={geo('circle', 0.32, 16)} material={mat('#3f3f46')} position={[0, y, 0.51]} />)}
            </group>
          ))}
          {/* plants */}
          {[[-9.8, -7.4], [9.8, 6.8], [-9.8, 7]].map(([x, z]) => (
            <group key={`p${x}${z}`} position={[x, 0, z]}>
              <mesh geometry={geo('cyl', 0.35, 0.28, 0.6, 12)} material={mat('#e7e5e4')} position={[0, 0.3, 0]} />
              {Array.from({ length: 7 }, (_, i) => <mesh key={i} geometry={geo('cone', 0.12, 1.4, 5)} material={mat('#15803d')} position={[Math.sin(i) * 0.15, 1.2, Math.cos(i) * 0.15]} rotation={[Math.sin(i * 2) * 0.5, 0, Math.cos(i * 2) * 0.5]} />)}
            </group>
          ))}
          {/* VIP couch */}
          <group position={[8.5, 0, 5]}>
            <Box s={[2.4, 0.5, 3.6]} c="#4c1d95" />
            <Box p={[1, 0.5, 0]} s={[0.4, 0.8, 3.6]} c="#4c1d95" />
            <Box p={[-1.6, 0, 0]} s={[0.8, 0.6, 1.6]} c="#18181b" />
            <mesh geometry={geo('cyl', 0.09, 0.12, 0.5, 8)} material={basic('#facc15')} position={[-1.6, 0.85, 0.3]} />
          </group>
          <pointLight ref={pointA} color="#ec4899" intensity={22} distance={14} />
          <pointLight ref={pointB} color="#22d3ee" intensity={22} distance={14} />
          <pointLight color="#fbbf24" intensity={6} distance={10} position={[-8, 3.5, -1]} />
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
  const tripFlight = myBusy?.kind === 'trip' ? CITY_ARRIVAL[myBusy.to] : null;
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
      <group position={OUT}><Sky phase={st.phase} k={st.k} flight={act?.flight || tripFlight} /></group>
    </group>
  );
}
const OUT = [0, 300, -600];

// ------------------------------------------------------------ new places
/** Players/NPCs gently bobbing or moving along a loop — handy for pools and tracks. */
function Mover({ fn, children }) {
  const ref = useRef();
  useFrame(({ clock }) => ref.current && fn(ref.current, clock.elapsedTime));
  return <group ref={ref}>{children}</group>;
}
const look = (i) => NPC_LOOKS[i % NPC_LOOKS.length];

/** Kinyozi & saluni: barber chairs, mirrors, a hood dryer, waiting bench with gossip. */
function Salon({ me, myBusy, people }) {
  const act = myBusy?.id;
  const meSlot = myBusy?.kind === 'job' ? [-1.8, 0, -1.6, Math.PI] : act === 'umbea' ? [3.2, 0.1, 1.8, -Math.PI / 2] : [-1.8, 0.35, -2.6, Math.PI];
  const seatSlots = [[1.8, 0.35, -2.6, Math.PI], [3.2, 0.1, 0.6, -Math.PI / 2], [3.2, 0.1, 3, -Math.PI / 2], [-4.6, 0.35, -2.6, Math.PI]];
  return (
    <group>
      <Room w={12} d={9} h={4.5} floor="#f5f5f4" wall="#fbcfe8" back="#f9a8d4" />
      <Sign text="💈 KINYOZI · SALUNI 💇🏾‍♀️" p={[0, 3.4, -4.28]} h={0.5} fg="#831843" />
      {[-4.6, -1.8, 1.8].map((x) => (
        <group key={x} position={[x, 0, -3.3]}>
          <Box p={[0, 1.1, -0.8]} s={[1.4, 1.5, 0.05]} m={basic('#e0f2fe')} />
          <Box p={[0, 0, 0.7]} s={[0.8, 0.35, 0.8]} c="#111827" />
          <Box p={[0, 0.35, 1.05]} s={[0.8, 0.8, 0.12]} c="#be185d" />
          <Box p={[0, 0.8, -0.5]} s={[1.6, 0.06, 0.4]} c="#e7e5e4" />
        </group>
      ))}
      <group position={[4.6, 0, -2.6]}>
        <Box s={[0.7, 0.4, 0.7]} c="#be185d" />
        <mesh geometry={geo('sphere', 0.45, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2)} material={mat('#e5e7eb')} position={[0, 1.45, 0]} />
      </group>
      <Box p={[4.2, 0, 1.8]} s={[0.7, 0.4, 3.6]} c="#9d174d" />
      <Person slot={[-4.6, 0, -1.6, Math.PI]} appearance={{ ...look(3), outfit: 'scrubs' }} mode="lift" />
      <Person slot={[1.8, 0, -1.6, Math.PI]} appearance={{ ...look(9), outfit: 'blauzi-jeans' }} mode="lift" />
      {myBusy?.kind !== 'job' && act !== 'umbea' && <Person slot={[-1.8, 0, -1.5, Math.PI]} appearance={{ ...look(14), outfit: 'polo' }} mode="lift" />}
      <Crowd me={me} myBusy={myBusy} people={people} slots={seatSlots} localSlot={meSlot} crowd={4}
        modeFor={(who) => (who === 'me' ? (myBusy?.kind === 'job' ? 'lift' : act === 'umbea' ? 'sit' : 'sit') : 'sit')} />
      <pointLight color="#fff1f2" intensity={7} distance={12} position={[0, 4, 0]} />
    </group>
  );
}

/** Nyama choma joint: grill with smoke, plastic tables under umbrellas, football on a big TV. */
function Grill({ me, myBusy, people }) {
  const act = myBusy?.id;
  const smoke = useRef();
  useFrame(({ clock }) => smoke.current?.children.forEach((c, i) => {
    const t = (clock.elapsedTime * 0.5 + i * 0.33) % 1;
    c.position.y = 1.4 + t * 2.4;
    c.scale.setScalar(0.3 + t * 0.6);
    c.material.opacity = 0.5 * (1 - t);
  }));
  const tables = [[-3, 1], [0.5, 1], [4, 1], [-3, 4], [0.5, 4], [4, 4]];
  const slots = tables.flatMap(([x, z]) => [[x - 0.8, 0, z, Math.PI / 2], [x + 0.8, 0, z, -Math.PI / 2]]);
  const meSlot = myBusy?.kind === 'job' ? [-5.2, 0, -2.4, 0] : slots[2];
  return (
    <group>
      <Box p={[0, -0.1, 0]} s={[18, 0.1, 14]} c="#d6b77a" />
      <Box p={[0, 0, -5]} s={[14, 3.2, 0.3]} c="#78350f" />
      <Tv p={[2, 1.4, -4.8]} w={4} />
      <group position={[-5.2, 0, -3.2]}>
        <Box s={[2.4, 0.9, 1]} c="#374151" />
        <Box p={[0, 0.9, 0]} s={[2.2, 0.05, 0.8]} m={basic('#f97316')} />
        {[-0.6, 0, 0.6].map((x) => <Box key={x} p={[x, 0.95, 0]} s={[0.4, 0.12, 0.25]} c="#7c2d12" />)}
        <group ref={smoke}>
          {[0, 1, 2].map((i) => <mesh key={i} geometry={geo('sphere', 0.5, 8, 6)} position={[(i - 1) * 0.3, 1.6, 0]}><meshBasicMaterial color="#e5e7eb" transparent opacity={0.4} depthWrite={false} /></mesh>)}
        </group>
        <pointLight color="#f97316" intensity={4} distance={4} position={[0, 1.2, 0.6]} />
      </group>
      {tables.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <Box s={[1, 0.75, 1]} c={i % 2 ? '#dc2626' : '#16a34a'} />
          <Plate emoji="🍖" />
          <mesh geometry={geo('cyl', 0.04, 0.04, 3, 6)} material={mat('#e5e7eb')} position={[0, 1.5, 0]} />
          <mesh geometry={geo('cone', 0.95, 0.35, 8)} material={mat(i % 2 ? '#facc15' : '#dc2626')} position={[0, 3.1, 0]} />
        </group>
      ))}
      <Crowd me={me} myBusy={myBusy} people={people} slots={slots} localSlot={meSlot} crowd={9}
        modeFor={(who, busy, n) => (who === 'me' ? (myBusy?.kind === 'job' ? 'lift' : act === 'mpira-tv' ? 'cheer' : 'eat') : n % 3 === 0 ? 'cheer' : 'eat')} />
    </group>
  );
}

/** Water park: slides with riders whooshing down, a wave pool and a lazy river. */
// A helix slide around the tower at (cx, cz): point k∈[0,1] → [x, y, z, heading].
const SLIDE = (k, cx, cz, r, top, turns = 1.6) => {
  const a = k * Math.PI * 2 * turns;
  return [cx + Math.cos(a) * r, top - k * (top - 0.4), cz + Math.sin(a) * r, -a];
};
function Slide({ cx, cz, r, top, color, turns }) {
  const segs = 30;
  return Array.from({ length: segs }, (_, i) => {
    const [x, y, z, h] = SLIDE(i / segs, cx, cz, r, top, turns);
    return <Box key={i} p={[x, y - 0.15, z]} s={[1.1, 0.25, 1.3]} r={[0, h, 0]} c={color} />;
  });
}
/** Water park: helix slides with riders whooshing down, a wave pool and a lazy river. */
function Waterpark({ me, myBusy, people }) {
  const act = myBusy?.id;
  const job = myBusy?.kind === 'job';
  const water = useRef();
  useFrame(({ clock }) => {
    if (water.current) water.current.position.y = 0.12 + Math.sin(clock.elapsedTime * 2) * 0.04;
  });
  const T = [7, -5];
  return (
    <group>
      <Box p={[0, -0.1, 0]} s={[32, 0.1, 24]} c="#e0f2fe" />
      <Box p={[-3, -0.06, 2]} s={[14.6, 0.1, 9.6]} c="#f8fafc" />
      <mesh ref={water} rotation={[-Math.PI / 2, 0, 0]} position={[-3, 0.12, 2]}><planeGeometry args={[14, 9]} /><meshLambertMaterial color="#0ea5e9" transparent opacity={0.85} /></mesh>
      {/* slide tower + two helix slides */}
      <Box p={[T[0], 0, T[1]]} s={[1.6, 7.2, 1.6]} c="#f97316" />
      <Box p={[T[0], 7.2, T[1]]} s={[2.4, 0.2, 2.4]} c="#fb923c" />
      <Slide cx={T[0]} cz={T[1]} r={2.6} top={7} color="#ef4444" turns={1.5} />
      <Slide cx={T[0]} cz={T[1]} r={4.2} top={5.5} color="#facc15" turns={1.1} />
      <Mover fn={(o, t) => { const k = (t * 0.25) % 1; const [x, y, z, h] = SLIDE(k, T[0], T[1], 2.6, 7, 1.5); o.position.set(x, y, z); o.rotation.y = h + Math.PI / 2; }}>
        <Person slot={[0, 0, 0, 0]} appearance={act === 'slides' ? me.appearance : look(5)} mode="sit" id={act === 'slides' ? me.id : undefined} username={act === 'slides' ? me.username : undefined} />
      </Mover>
      <Mover fn={(o, t) => { const k = (t * 0.3 + 0.5) % 1; const [x, y, z, h] = SLIDE(k, T[0], T[1], 4.2, 5.5, 1.1); o.position.set(x, y, z); o.rotation.y = h + Math.PI / 2; }}>
        <Person slot={[0, 0, 0, 0]} appearance={look(8)} mode="sit" />
      </Mover>
      {[[-7, 0], [-4, 4], [0, 1], [1, 4.5]].map(([x, z], i) => (
        <Mover key={i} fn={(o, t) => { o.position.y = 0.15 + Math.sin(t * 2 + i) * 0.06; }}>
          <Person slot={[x, 0, z, i]} appearance={look(i + 11)} mode="swim" />
        </Mover>
      ))}
      {act !== 'slides' && (
        <Mover fn={(o, t) => { if (act === 'lazy') o.position.set(-3 + Math.cos(t * 0.3) * 4.5, 0.15, 2 + Math.sin(t * 0.3) * 2.8); else o.position.y = job ? 0 : 0.15 + Math.sin(t * 2) * 0.06; }}>
          <Person slot={job ? [-11, 0, 7, Math.PI * 0.8] : [-2, 0, 2, Math.PI]} appearance={me.appearance} mode={job ? 'idle' : act === 'lazy' ? 'sit' : 'swim'} id={me.id} username={me.username} />
        </Mover>
      )}
      {act === 'lazy' && people.slice(0, 2).map((r, i) => <Person key={r.id} slot={[-5 + i * 3, 0.15, -0.5, 0]} appearance={r.appearance} mode="sit" id={r.id} username={r.username} />)}
      <Box p={[-11, 0, 7.6]} s={[1, 2.6, 1]} c="#dc2626" />
      {[[-13, 9], [13, 8], [-13, -8]].map(([x, z]) => (
        <group key={x} position={[x, 0, z]}>
          <mesh geometry={geo('cyl', 0.2, 0.28, 5, 6)} material={mat('#9a7b4f')} position={[0, 2.5, 0]} />
          <mesh geometry={geo('cone', 2, 1, 7)} material={mat('#2f9e57')} position={[0, 5, 0]} />
        </group>
      ))}
    </group>
  );
}

/** Village Museum: tribal huts around a fire circle, ngoma drummers and dancers. */
function Ngoma({ me, myBusy, people }) {
  const act = myBusy?.id;
  const ring = Array.from({ length: 10 }, (_, i) => {
    const a = (i / 10) * Math.PI * 2;
    return [Math.cos(a) * 3.4, 0, Math.sin(a) * 3.4 + 1, -a - Math.PI / 2];
  });
  const meSlot = act === 'tinga' ? [-6, 0, -2.6, Math.PI * 0.85] : act === 'makabila' ? [5.6, 0, -3.5, Math.PI] : myBusy?.kind === 'job' ? [-1.6, 0, -2.4, 0] : ring[2];
  return (
    <group>
      <Box p={[0, -0.1, 0]} s={[22, 0.1, 16]} c="#c2a26b" />
      {[[-7, -5], [-2, -6], [3, -6.4], [7.5, -4.6]].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh geometry={geo('cyl', 1.6, 1.6, 2.1, 10)} material={mat(i % 2 ? '#a16207' : '#d6b77a')} position={[0, 1.05, 0]} />
          <mesh geometry={geo('cone', 2.3, 2.1, 10)} material={mat('#713f12')} position={[0, 3.1, 0]} />
          <Box p={[0, 0, 1.55]} s={[0.7, 1.4, 0.1]} c="#3f2a1a" />
        </group>
      ))}
      {/* fire */}
      <group position={[0, 0, 1]}>
        {[0, 1, 2, 3].map((i) => <Box key={i} p={[0, 0.05, 0]} s={[1.2, 0.12, 0.15]} r={[0, (i * Math.PI) / 4, 0]} c="#57534e" />)}
        <Mover fn={(o, t) => o.scale.set(1, 0.85 + Math.sin(t * 9) * 0.15, 1)}>
          <mesh geometry={geo('cone', 0.45, 1.1, 8)} material={basic('#f97316')} position={[0, 0.6, 0]} />
          <mesh geometry={geo('cone', 0.25, 0.7, 8)} material={basic('#facc15')} position={[0, 0.5, 0]} />
        </Mover>
        <pointLight color="#f97316" intensity={6} distance={9} position={[0, 1.2, 0]} />
      </group>
      {/* drummers */}
      {[-1.6, 0, 1.6].map((x, i) => (
        <group key={x} position={[x, 0, -2.6]}>
          <mesh geometry={geo('cyl', 0.28, 0.22, 0.75, 10)} material={mat('#78350f')} position={[0, 0.38, 0.45]} />
          {!(myBusy?.kind === 'job' && i === 0) && <Person slot={[0, 0, 0, 0]} appearance={{ ...look(i + 2), outfit: 'shuka' }} mode="dj" />}
        </group>
      ))}
      {act === 'tinga' && (
        <group position={[-6, 0, -3.6]}>
          <Box p={[0, 0.7, 0]} s={[1.1, 1.1, 0.05]} m={basic('#0ea5e9')} />
          {[['#facc15', -0.2, 1.4], ['#ef4444', 0.2, 1.1], ['#22c55e', 0, 0.9]].map(([c, x, y]) => <mesh key={c} geometry={geo('circle', 0.14, 10)} material={basic(c)} position={[x, y, 0.03]} />)}
        </group>
      )}
      <Crowd me={me} myBusy={myBusy} people={people} slots={ring} localSlot={meSlot} crowd={9}
        modeFor={(who) => (who === 'me' ? (act === 'tinga' ? 'lift' : act === 'makabila' ? 'idle' : myBusy?.kind === 'job' ? 'dj' : 'dance') : 'dance')} />
    </group>
  );
}

/** Golf: a sunny fairway, the green with its flag, a buggy and a ball arcing away. */
function Golf({ me, myBusy, people }) {
  const act = myBusy?.id;
  const ball = useRef();
  useFrame(({ clock }) => {
    if (!ball.current) return;
    const k = (clock.elapsedTime * 0.4) % 1;
    ball.current.position.set(0.6 + k * 2, 0.3 + Math.sin(k * Math.PI) * 4, -k * 22);
  });
  const meSlot = act === 'dili' ? [3.6, 0, 3.4, -Math.PI / 2] : myBusy?.kind === 'job' ? [-1.8, 0, 1.6, Math.PI * 0.8] : [0, 0, 0.8, Math.PI];
  return (
    <group>
      <Box p={[0, -0.1, -10]} s={[60, 0.1, 50]} c="#86efac" />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -14]}><planeGeometry args={[10, 40]} /><meshLambertMaterial color="#4ade80" /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[2, 0.02, -28]}><circleGeometry args={[4, 24]} /><meshLambertMaterial color="#22c55e" /></mesh>
      <mesh geometry={geo('cyl', 0.05, 0.05, 2.4, 6)} material={mat('#f8fafc')} position={[2, 1.2, -28]} />
      <Box p={[2.45, 2.1, -28]} s={[0.9, 0.5, 0.04]} c="#dc2626" />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-6, 0.02, -16]}><circleGeometry args={[3, 18]} /><meshLambertMaterial color="#fde68a" /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[8, 0.02, -20]}><circleGeometry args={[3.5, 18]} /><meshLambertMaterial color="#38bdf8" /></mesh>
      <mesh ref={ball} geometry={geo('sphere', 0.12, 8, 6)} material={basic('#ffffff')} />
      {/* buggy */}
      <group position={[4.5, 0, 2.2]} rotation={[0, -0.3, 0]}>
        <Box p={[0, 0.3, 0]} s={[1.3, 0.5, 2.2]} c="#f8fafc" />
        <Box p={[0, 1.8, 0]} s={[1.4, 0.08, 2.2]} c="#16a34a" />
        {[-0.6, 0.6].map((x) => <Box key={x} p={[x, 0.8, -0.9]} s={[0.06, 1, 0.06]} c="#e5e7eb" />)}
      </group>
      <Box p={[3.6, 0, 4.2]} s={[1.2, 0.75, 1.2]} c="#f8fafc" />
      {act !== 'dili' && <Mover fn={(o, t) => (o.rotation.z = Math.sin(t * 3) * 1.1)}><group position={[0.25, 1.05, 0.9]}><Box p={[0, -1, 0]} s={[0.04, 1, 0.04]} c="#d4d4d8" /><Box p={[0.08, -1.02, 0]} s={[0.16, 0.06, 0.06]} c="#52525b" /></group></Mover>}
      <Person slot={[4.6, 0, 3.4, Math.PI / 2]} appearance={{ ...look(4), outfit: 'suti' }} mode="idle" />
      {[[-12, -6], [12, -10], [-14, -24], [14, -30], [-8, -36]].map(([x, z]) => (
        <group key={x} position={[x, 0, z]}>
          <mesh geometry={geo('cyl', 0.25, 0.35, 4, 6)} material={mat('#9a7b4f')} position={[0, 2, 0]} />
          <mesh geometry={geo('sphere', 2.4, 8, 6)} material={mat('#15803d')} position={[0, 5, 0]} />
        </group>
      ))}
      <Crowd me={me} myBusy={myBusy} people={people} slots={[[-2.4, 0, 1.6, Math.PI * 0.9], [2.4, 0, 2, -Math.PI * 0.9]]} localSlot={meSlot} crowd={2}
        modeFor={(who) => (who === 'me' ? (act === 'dili' ? 'idle' : myBusy?.kind === 'job' ? 'idle' : 'lift') : 'idle')} />
    </group>
  );
}

/** Dhow cruise at sunset (or the boat to Bongoyo for snorkelling). */
function Dhow({ me, myBusy, people }) {
  const act = myBusy?.id;
  const boat = useRef();
  useFrame(({ clock }) => {
    if (!boat.current) return;
    const t = clock.elapsedTime;
    boat.current.rotation.z = Math.sin(t * 0.9) * 0.04;
    boat.current.rotation.x = Math.sin(t * 0.6) * 0.03;
    boat.current.position.y = Math.sin(t * 1.1) * 0.08;
  });
  const snorkel = act === 'bongoyo';
  const deck = [[-0.6, 0.55, 0.2, 0], [0.6, 0.55, -0.6, Math.PI], [-0.5, 0.55, -1.8, 0.4], [0.5, 0.55, 1.4, -2.4]];
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, 0]}><planeGeometry args={[300, 300]} /><meshLambertMaterial color={snorkel ? '#06b6d4' : '#0e7490'} /></mesh>
      {/* sunset sun & island */}
      <mesh position={[0, 9, -90]}><circleGeometry args={[9, 32]} /><meshBasicMaterial color={snorkel ? '#fef9c3' : '#fb923c'} /></mesh>
      <group position={[18, -0.2, -40]}>
        <mesh geometry={geo('sphere', 12, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2)} material={mat('#fde68a')} scale={[1, 0.18, 0.6]} />
        {[-4, 0, 4].map((x) => (
          <group key={x} position={[x, 1.5, 0]}>
            <mesh geometry={geo('cyl', 0.2, 0.3, 5, 6)} material={mat('#9a7b4f')} position={[0, 2.5, 0]} rotation={[0, 0, 0.15]} />
            <mesh geometry={geo('cone', 2, 1, 7)} material={mat('#2f9e57')} position={[0.4, 5, 0]} />
          </group>
        ))}
      </group>
      <group ref={boat}>
        <mesh geometry={geo('sphere', 1, 16, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)} material={mat('#7c4a1e')} scale={[1.6, 0.9, 5]} position={[0, 0.55, 0]} />
        <Box p={[0, 0.45, 0]} s={[2.8, 0.1, 8]} c="#a16207" />
        <Box p={[0, 0.5, 1]} s={[0.15, 6, 0.15]} c="#78350f" />
        <mesh position={[0.1, 3.5, 0.8]} rotation={[0, Math.PI / 2, 0.12]}>
          <shapeGeometry args={[new THREE.Shape([new THREE.Vector2(-2, -0.6), new THREE.Vector2(2.6, -0.6), new THREE.Vector2(-2, 3.4)])]} />
          <meshLambertMaterial color="#fef3c7" side={THREE.DoubleSide} />
        </mesh>
        {!snorkel && (
          <Crowd me={me} myBusy={myBusy} people={people} slots={deck} localSlot={myBusy?.kind === 'job' ? [0, 0.5, -3.2, 0] : [0.6, 0.55, 1.6, Math.PI]} crowd={4}
            modeFor={(who) => (who === 'me' && myBusy?.kind === 'job' ? 'idle' : 'sit')} />
        )}
      </group>
      {snorkel && (
        <>
          {[[-2, 3], [2.5, 1.5], [0, 5]].map(([x, z], i) => (
            <Mover key={i} fn={(o, t) => { o.position.set(x + Math.sin(t * 0.4 + i) * 1.5, -0.45, z + Math.cos(t * 0.3 + i)); o.rotation.y = t * 0.2 + i; }}>
              <Person slot={[0, 0, 0, 0]} appearance={i === 0 ? me.appearance : look(i + 7)} mode="swim" id={i === 0 ? me.id : undefined} username={i === 0 ? me.username : undefined} />
            </Mover>
          ))}
          {Array.from({ length: 8 }, (_, i) => (
            <Mover key={`f${i}`} fn={(o, t) => o.position.set(Math.sin(t * 0.8 + i) * 4, -0.6, 3 + Math.cos(t * 0.6 + i * 2) * 3)}>
              <mesh geometry={geo('sphere', 0.12, 6, 4)} material={basic(['#f97316', '#facc15', '#22d3ee', '#ec4899'][i % 4])} scale={[1.6, 1, 0.6]} />
            </Mover>
          ))}
        </>
      )}
    </group>
  );
}

/** Singeli night: big outdoor stage, speaker stacks, lights and a jumping crowd. */
function Concert({ me, myBusy, people }) {
  const act = myBusy?.id;
  const onStage = act === 'jukwaani' || myBusy?.kind === 'job';
  const crowdSlots = useMemo(() => {
    const r = rng(77);
    return Array.from({ length: 22 }, (_, i) => [((i % 6) - 2.5) * 1.6 + (r() - 0.5) * 0.6, 0, 1 + Math.floor(i / 6) * 1.5 + (r() - 0.5) * 0.4, Math.PI + (r() - 0.5) * 0.6]);
  }, []);
  return (
    <group>
      <Box p={[0, -0.1, 2]} s={[30, 0.1, 22]} c="#a8a29e" />
      <Box p={[0, 0, -5]} s={[14, 1.4, 6]} c="#111827" />
      <Box p={[0, 0, -8]} s={[16, 7, 0.3]} c="#1f2937" />
      <mesh position={[0, 4.2, -7.8]}><planeGeometry args={[12, 4]} /><meshBasicMaterial color="#7e22ce" /></mesh>
      <Sign text="🔊 SINGELI NIGHT · MBAGALA" p={[0, 4.4, -7.7]} h={0.9} fg="#fdf4ff" />
      {[-1, 1].map((sx) => (
        <group key={sx} position={[sx * 8.5, 0, -5]}>
          {[0, 1.3, 2.6].map((y) => <Box key={y} p={[0, y, 0]} s={[1.8, 1.2, 1.4]} c="#0b0b0b" />)}
          {[0.6, 1.9, 3.2].map((y) => <mesh key={y} geometry={geo('circle', 0.4, 14)} material={mat('#374151')} position={[0, y, 0.72]} />)}
        </group>
      ))}
      <Spotlights colors={['#a855f7', '#f472b6', '#22d3ee', '#facc15']} />
      <Person slot={[-2.5, 1.4, -6, 0]} appearance={{ ...look(12), outfit: 'hoodie' }} mode="dj" />
      <Box p={[-2.5, 1.4, -5.2]} s={[2, 0.9, 0.7]} c="#0f172a" />
      {!onStage && <Person slot={[2.5, 1.4, -4.4, 0]} appearance={{ ...look(1), outfit: 'jaketi-ngozi' }} mode="sing" />}
      <Crowd me={me} myBusy={myBusy} people={people} slots={crowdSlots} localSlot={onStage ? [2.5, 1.4, -4.4, 0] : [0.2, 0, 1.2, Math.PI]} crowd={20}
        modeFor={(who, busy, n) => (who === 'me' ? (onStage ? 'sing' : act === 'chipsi-mayai' ? 'eat' : 'dance') : n % 4 === 1 ? 'cheer' : 'dance')} />
    </group>
  );
}

/** Go-kart race: karts chasing round a looping track, you in one of them. */
function Karting({ me, myBusy, people }) {
  const racing = myBusy?.kind === 'activity';
  const karts = useRef([]);
  useFrame(({ clock }) => {
    karts.current.forEach((g, i) => {
      if (!g) return;
      const t = clock.elapsedTime * (0.42 + i * 0.015) + i * 0.55;
      const x = Math.sin(t) * 11;
      const z = Math.sin(t * 2) * 4.5;
      g.position.set(x, 0.05, z);
      g.rotation.y = Math.atan2(Math.cos(t) * 11, Math.cos(t * 2) * 9);
    });
  });
  const colors = ['#ef4444', '#3b82f6', '#facc15', '#22c55e', '#a855f7'];
  return (
    <group>
      <Box p={[0, -0.1, 0]} s={[34, 0.1, 22]} c="#4ade80" />
      {Array.from({ length: 64 }, (_, i) => {
        const t = (i / 64) * Math.PI * 2;
        return <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[Math.sin(t) * 11, 0.02 + (i % 2) * 0.002, Math.sin(t * 2) * 4.5]}><circleGeometry args={[1.7, 12]} /><meshLambertMaterial color="#374151" /></mesh>;
      })}
      {Array.from({ length: 20 }, (_, i) => <Box key={i} p={[-13 + i * 1.4, 0, 8]} s={[0.7, 0.5, 0.5]} c={i % 2 ? '#dc2626' : '#f8fafc'} />)}
      <Box p={[0, 0, -8.5]} s={[12, 2.5, 2]} c="#f97316" />
      <Sign text="🏁 BONGO GO-KARTS" p={[0, 2, -7.45]} h={0.7} fg="#111827" />
      {colors.map((c, i) => (
        <group key={c} ref={(el) => (karts.current[i] = el)}>
          <group scale={0.45}><Car body="sports" color={c} /></group>
          <group position={[0, 0.05, -0.2]} scale={0.8}>
            <Person slot={[0, 0, 0, 0]} appearance={i === 0 && racing ? me.appearance : people[i - (racing ? 1 : 0)]?.appearance || look(i + 3)} mode="sit"
              id={i === 0 && racing ? me.id : undefined} username={i === 0 && racing ? me.username : undefined} />
          </group>
        </group>
      ))}
      {!racing && <Person slot={[-4, 0, 9.4, Math.PI]} appearance={me.appearance} mode={myBusy?.id === 'pitstop' ? 'eat' : 'lift'} id={me.id} username={me.username} />}
    </group>
  );
}

/** Serena spa: massage tables, candles, a calm pool — also the suite you sleep in. */
function Spa({ me, myBusy }) {
  const act = myBusy?.id;
  const job = myBusy?.kind === 'job';
  return (
    <group>
      <Room w={12} d={9} h={4.5} floor="#e7e5e4" wall="#f5f5f4" back="#d6d3d1" />
      {act === 'suite' ? (
        <group position={[0, 0, -2]}>
          <Box s={[3.2, 0.55, 3.6]} c="#78350f" />
          <Box p={[0, 0.55, 0]} s={[3, 0.25, 3.4]} c="#ffffff" />
          <Box p={[0, 0.8, 0.7]} s={[3.02, 0.06, 2]} c="#0f766e" />
          <Box p={[0, 0, -1.85]} s={[3.4, 1.8, 0.15]} c="#a16207" />
          <Person slot={[0.6, 0.8, -0.2, 0]} appearance={me.appearance} mode="sleep" id={me.id} username={me.username} />
        </group>
      ) : (
        <>
          {[-2.4, 2.4].map((x, i) => (
            <group key={x} position={[x, 0, -1.6]}>
              <Box s={[1.2, 0.75, 2.6]} c="#f5f5f4" />
              <Box p={[0, 0.75, 0]} s={[1.1, 0.12, 2.5]} c="#14b8a6" />
              {i === 0 && act === 'massage' && <Person slot={[0, 0.85, 0.9, 0]} appearance={me.appearance} mode="sleep" id={me.id} username={me.username} />}
              {i === 1 && <Person slot={[0, 0.85, 0.9, 0]} appearance={look(15)} mode="sleep" />}
              <Person slot={[1.1, 0, 0, -Math.PI / 2]} appearance={{ ...look(i + 18), outfit: 'scrubs' }} mode="lift" />
            </group>
          ))}
          {job && <Person slot={[0, 0, 2.6, Math.PI]} appearance={me.appearance} mode="idle" id={me.id} username={me.username} />}
        </>
      )}
      {[[-5, -3.8], [5, -3.8], [-5, 3], [5, 3]].map(([x, z]) => (
        <group key={x + ':' + z} position={[x, 0, z]}>
          <mesh geometry={geo('cyl', 0.08, 0.08, 0.3, 8)} material={mat('#fef3c7')} position={[0, 0.15, 0]} />
          <mesh geometry={geo('sphere', 0.05, 6, 4)} material={basic('#facc15')} position={[0, 0.35, 0]} />
          <pointLight color="#fbbf24" intensity={1.2} distance={3} position={[0, 0.5, 0]} />
        </group>
      ))}
      <mesh position={[0, 2.4, -4.4]}><planeGeometry args={[3, 1.6]} /><meshBasicMaterial color="#0f766e" /></mesh>
      <pointLight color="#fff7ed" intensity={4} distance={10} position={[0, 4, 0]} />
    </group>
  );
}

/** Serena rooftop pool party: skyline at dusk, pool, DJ and dancing. */
function Rooftop({ me, myBusy, people }) {
  const slots = useMemo(() => [[-3, 0, 2, Math.PI], [-1.5, 0, 3, Math.PI], [1, 0, 2.5, Math.PI], [3, 0, 3.4, Math.PI], [-4, 0, 4.4, Math.PI], [0, 0, 4.6, Math.PI], [4.2, 0, 1.4, -2]], []);
  return (
    <group>
      <Box p={[0, -0.1, 0]} s={[16, 0.1, 14]} c="#e7e5e4" />
      {[-8, 8].map((x) => <Box key={x} p={[x, 0, 0]} s={[0.1, 1, 14]} m={basic('#bae6fd', { transparent: true, opacity: 0.6 })} />)}
      <Box p={[0, 0, -7]} s={[16, 1, 0.1]} m={basic('#bae6fd', { transparent: true, opacity: 0.6 })} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, -3]}><planeGeometry args={[9, 4]} /><meshBasicMaterial color="#22d3ee" /></mesh>
      {/* skyline */}
      {Array.from({ length: 18 }, (_, i) => <Box key={i} p={[-60 + i * 7, -44, -45 - (i % 3) * 9]} s={[5, 36 + ((i * 37) % 16), 5]} c={i % 2 ? '#334155' : '#475569'} />)}
      <mesh position={[0, 6, -70]}><circleGeometry args={[6, 24]} /><meshBasicMaterial color="#fb923c" /></mesh>
      <Box p={[5.5, 0, -5.5]} s={[2, 1, 0.8]} c="#0f172a" />
      <Person slot={[5.5, 0, -6.2, 0]} appearance={{ ...look(6), outfit: 'hoodie' }} mode="dj" />
      <Spotlights colors={['#f472b6', '#22d3ee', '#facc15']} />
      <Crowd me={me} myBusy={myBusy} people={people} slots={slots} localSlot={[0.3, 0, 1.6, Math.PI]} crowd={7} modeFor={(who, b, n) => (n % 3 === 2 ? 'cheer' : 'dance')} />
      {[[-2, -3], [1.5, -2.6]].map(([x, z], i) => (
        <Mover key={i} fn={(o, t) => (o.position.y = -0.35 + Math.sin(t * 2 + i) * 0.06)}>
          <Person slot={[x, 0, z, i * 2]} appearance={look(i + 20)} mode="swim" />
        </Mover>
      ))}
    </group>
  );
}

// ------------------------------------------------------- police & court
const COP = { body: 'man', skin: 1, hair: 'kiduku', hairColor: 0, outfit: 'kaunda' };
const COP2 = { body: 'woman', skin: 3, hair: 'kibanio', hairColor: 0, outfit: 'ofisi-sketi' };
function Bars({ p, w = 6, h = 3 }) {
  return (
    <group position={p}>
      {Array.from({ length: Math.round(w / 0.35) }, (_, i) => <Box key={i} p={[-w / 2 + i * 0.35, 0, 0]} s={[0.06, h, 0.06]} c="#9ca3af" />)}
      <Box p={[0, h, 0]} s={[w, 0.12, 0.12]} c="#6b7280" />
      <Box p={[0, h * 0.5, 0]} s={[w, 0.08, 0.08]} c="#6b7280" />
    </group>
  );
}
/** Oysterbay Police Station: front desk, officers, and the cells — you're behind bars if held. */
function Police({ me, myBusy, people }) {
  const held = !!me.jail;
  const officer = myBusy?.kind === 'job';
  const flash = useRef();
  useFrame(({ clock }) => { if (flash.current) { const k = (Math.sin(clock.elapsedTime * 2.2) + 1) / 2; flash.current.color.setRGB(0.94 * (1 - k) + 0.23 * k, 0.27 * (1 - k) + 0.51 * k, 0.27 * (1 - k) + 0.96 * k); } });
  return (
    <group>
      <Room w={16} d={11} h={4.5} floor="#d6d3d1" wall="#dbeafe" back="#bfdbfe" />
      <Box p={[0, 3.2, -5.3]} s={[16, 0.5, 0.06]} c="#1e3a8a" />
      <Sign text="🚓 POLISI · KITUO CHA OYSTERBAY" p={[0, 3.45, -5.24]} h={0.42} fg="#ffffff" />
      {/* front desk */}
      <group position={[3.5, 0, -1.5]}>
        <Box s={[5, 1.1, 1]} c="#1e3a8a" />
        <Box p={[0, 1.1, 0]} s={[5.2, 0.06, 1.2]} c="#f8fafc" />
        <Box p={[-1.2, 1.16, 0]} s={[0.5, 0.35, 0.35]} c="#111827" />
        <Box p={[1.4, 1.16, 0.1]} s={[0.8, 0.04, 0.5]} c="#fef3c7" />
      </group>
      {!officer && <Person slot={[3.5, 0, -2.6, 0]} appearance={COP} mode="type" />}
      <Person slot={[6.2, 0, -2.2, -0.6]} appearance={COP2} mode="idle" />
      {officer && <Person slot={[3.5, 0, -2.6, 0]} appearance={me.appearance} mode="type" id={me.id} username={me.username} />}
      {/* cells */}
      <group position={[-4.9, 0, -2.3]} rotation={[0, Math.PI / 2, 0]}><Bars p={[0, 0, 0]} w={6.2} h={3} /></group>
      <Bars p={[-6.4, 0, 0.8]} w={3} h={3} />
      <Box p={[-6.4, 0.005, -2.3]} s={[3, 0.03, 6.2]} c="#a8a29e" />
      <Box p={[-7.2, 0, -3.6]} s={[1.4, 0.45, 3]} c="#78716c" />
      <Box p={[-6.4, 4.3, -2]} s={[0.5, 0.1, 0.5]} m={basic('#fef9c3')} />
      {held ? (
        <Person slot={[-7.2, 0.45, -3, Math.PI / 2]} appearance={me.appearance} mode="sit" id={me.id} username={me.username} />
      ) : !officer && (
        <Person slot={[1.5, 0, 1, Math.PI * 0.9]} appearance={me.appearance} mode="idle" id={me.id} username={me.username} />
      )}
      {people.slice(0, 3).map((r, i) => <Person key={r.id} slot={[-1 + i * 1.6, 0, 2.6, Math.PI]} appearance={r.appearance} mode="idle" id={r.id} username={r.username} />)}
      <Person slot={[-3.6, 0, 1.6, -Math.PI / 2]} appearance={COP} mode="idle" />
      {/* benches & poster */}
      <Box p={[4, 0, 3.6]} s={[3.6, 0.45, 0.6]} c="#475569" />
      <Box p={[7.8, 1.3, -1]} s={[0.05, 1.2, 0.9]} m={basic('#fde68a')} />
      <pointLight ref={flash} intensity={2.5} distance={8} position={[0, 3.6, 2]} />
      <pointLight color="#f8fafc" intensity={5} distance={14} position={[0, 4, 0]} />
    </group>
  );
}

/** Kisutu courtroom: magistrate on the bench, flag, lawyers, the dock and the gallery. */
function Court({ me, myBusy, people }) {
  const onTrial = me.jail?.phase === 'court';
  const lawyerJob = myBusy?.kind === 'job';
  const gallery = useMemo(() => {
    const s = [];
    for (let r = 0; r < 2; r++) for (let c = 0; c < 5; c++) s.push([(c - 2) * 1.5, 0.1, 3.2 + r * 1.5, Math.PI]);
    return s;
  }, []);
  return (
    <group>
      <Room w={14} d={12} h={5} floor="#a16207" wall="#fef3c7" back="#f5e6c8" />
      <Sign text="⚖️ MAHAKAMA YA HAKIMU MKAZI KISUTU" p={[0, 4.2, -5.78]} h={0.42} fg="#713f12" />
      {/* Tanzania flag */}
      <group position={[-4.5, 0, -5]}>
        <Box s={[0.06, 3.4, 0.06]} c="#a3a3a3" />
        <mesh position={[0.75, 2.8, 0]}>
          <planeGeometry args={[1.4, 0.95]} />
          <meshBasicMaterial map={useMemo(() => {
            const c = document.createElement('canvas');
            c.width = 140; c.height = 95;
            const x = c.getContext('2d');
            x.fillStyle = '#1eb53a'; x.beginPath(); x.moveTo(0, 0); x.lineTo(140, 0); x.lineTo(0, 95); x.fill();
            x.fillStyle = '#00a3dd'; x.beginPath(); x.moveTo(140, 0); x.lineTo(140, 95); x.lineTo(0, 95); x.fill();
            x.strokeStyle = '#fcd116'; x.lineWidth = 30; x.beginPath(); x.moveTo(0, 95); x.lineTo(140, 0); x.stroke();
            x.strokeStyle = '#000'; x.lineWidth = 18; x.beginPath(); x.moveTo(0, 95); x.lineTo(140, 0); x.stroke();
            const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
          }, [])} side={THREE.DoubleSide} />
        </mesh>
      </group>
      {/* bench */}
      <Box p={[0, 0, -4.4]} s={[6, 1.6, 1.4]} c="#713f12" />
      <Box p={[0, 1.6, -4.4]} s={[6.2, 0.1, 1.6]} c="#a16207" />
      <Person slot={[0, 0.9, -5.2, 0]} appearance={{ body: 'woman', skin: 2, hair: 'kibanio', hairColor: 0, outfit: 'suti' }} mode="sit" />
      <mesh geometry={geo('cyl', 0.08, 0.1, 0.3, 8)} material={mat('#78350f')} position={[1, 1.8, -4.1]} rotation={[0, 0, Math.PI / 2]} />
      {/* lawyers' tables */}
      {[-2.6, 2.6].map((x) => <Box key={x} p={[x, 0, -1.4]} s={[2.4, 0.8, 1]} c="#78350f" />)}
      <Person slot={[-2.6, 0, -0.6, Math.PI]} appearance={lawyerJob ? me.appearance : { body: 'man', skin: 0, hair: 'kiduku', hairColor: 0, outfit: 'suti' }} mode="idle" id={lawyerJob ? me.id : undefined} username={lawyerJob ? me.username : undefined} />
      <Person slot={[2.6, 0, -0.6, Math.PI]} appearance={{ body: 'woman', skin: 4, hair: 'mkia', hairColor: 0, outfit: 'ofisi-sketi' }} mode="idle" />
      {/* the dock */}
      <group position={[4.1, 0, 1.2]}>
        <Box s={[1.6, 1.1, 1.6]} c="#92400e" />
        {onTrial && <Person slot={[0, 0.15, 0, -Math.PI / 2]} appearance={me.appearance} mode="idle" id={me.id} username={me.username} />}
      </group>
      <Person slot={[5.4, 0, 0.4, -Math.PI / 2]} appearance={COP} mode="idle" />
      {gallery.map(([x, , z], i) => <Box key={i} p={[x, 0, z + 0.4]} s={[1.3, 0.45, 0.5]} c="#78350f" />)}
      <Crowd me={me} myBusy={myBusy} people={people} slots={gallery} localSlot={onTrial || lawyerJob ? [9, 0, 9, 0] : gallery[2]} crowd={6} modeFor={() => 'sit'} />
      <pointLight color="#fff7ed" intensity={6} distance={14} position={[0, 4.5, 0]} />
    </group>
  );
}

// ------------------------------------------------------- travel scenes
/** Ground that streams past underneath (sea, coast or savannah) to fake forward motion. */
function drawGround(kind) {
  return (ctx, t) => {
    const w = ctx.canvas.width, h = ctx.canvas.height;
    ctx.fillStyle = kind === 'sea' ? '#0e7490' : '#a3b56b';
    ctx.fillRect(0, 0, w, h);
    const off = (t * 40) % h;
    for (let i = -1; i < 4; i++) {
      const y = i * (h / 3) + off;
      if (kind === 'sea') {
        ctx.fillStyle = 'rgba(255,255,255,.25)';
        for (let k = 0; k < 6; k++) ctx.fillRect((k * 53 + i * 31) % w, y + (k * 17) % 40, 26, 3);
      } else {
        ctx.fillStyle = 'rgba(77,124,15,.55)';
        for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.arc((k * 61 + i * 37) % w, y + (k * 23) % 60, 10, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = 'rgba(146,64,14,.35)';
        ctx.fillRect(w / 2 - 4, y, 8, h / 3);
      }
    }
  };
}
const drawSeaGround = drawGround('sea');
const drawLandGround = drawGround('land');

function Helicopter() {
  const rotor = useRef();
  const tail = useRef();
  useFrame((_, dt) => {
    if (rotor.current) rotor.current.rotation.y += dt * 22;
    if (tail.current) tail.current.rotation.x += dt * 30;
  });
  return (
    <group>
      <mesh geometry={geo('sphere', 1.3, 18, 12)} material={mat('#f8fafc')} scale={[1, 0.9, 1.5]} />
      <mesh geometry={geo('sphere', 1, 16, 12)} material={mat('#0f172a', { transparent: true, opacity: 0.8 })} position={[0, 0.2, 0.75]} scale={[1.05, 0.8, 1.05]} />
      <mesh geometry={geo('box', 2.62, 0.25, 3.2)} material={mat('#dc2626')} position={[0, -0.35, -0.1]} />
      <mesh geometry={geo('cyl', 0.22, 0.12, 4.2, 10)} material={mat('#f8fafc')} rotation={[Math.PI / 2, 0, 0]} position={[0, 0.25, -3.6]} />
      <mesh geometry={geo('box', 0.12, 1.1, 0.8)} material={mat('#dc2626')} position={[0, 0.8, -5.5]} />
      <group ref={tail} position={[0.2, 0.7, -5.6]}>{[0, 1].map((i) => <mesh key={i} geometry={geo('box', 0.04, 1.2, 0.12)} material={mat('#111827')} rotation={[(i * Math.PI) / 2, 0, 0]} />)}</group>
      <mesh geometry={geo('cyl', 0.1, 0.1, 0.5, 8)} material={mat('#374151')} position={[0, 1.3, 0]} />
      <group ref={rotor} position={[0, 1.55, 0]}>{[0, 1].map((i) => <mesh key={i} geometry={geo('box', 9, 0.04, 0.3)} material={mat('#111827')} rotation={[0, (i * Math.PI) / 2, 0]} />)}</group>
      {[-0.8, 0.8].map((x) => <mesh key={x} geometry={geo('cyl', 0.06, 0.06, 3.2, 6)} material={mat('#374151')} rotation={[Math.PI / 2, 0, 0]} position={[x, -1.3, 0]} />)}
    </group>
  );
}
/** Helicopter: tilt forward over the sea (to Zanzibar) or the savannah (Arusha / Kilimanjaro). */
function Heli({ myBusy }) {
  const sea = myBusy?.kind === 'trip' ? myBusy.to === 'znz' || myBusy.from === 'znz' : myBusy?.placeId === 'zn-airport';
  const tex = useCanvasTexture(256, 256, sea ? drawSeaGround : drawLandGround, 20);
  useMemo(() => { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(6, 6); }, [tex]);
  const h = useRef();
  useFrame(({ clock }) => { if (h.current) { h.current.position.y = 30 + Math.sin(clock.elapsedTime * 0.8) * 0.4; h.current.rotation.z = Math.sin(clock.elapsedTime * 0.5) * 0.05; } });
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}><planeGeometry args={[400, 400]} /><meshBasicMaterial map={tex} /></mesh>
      {!sea && <group position={[30, 0, -150]}><mesh geometry={geo('cone', 70, 60, 10)} material={mat('#6b7280')} position={[0, 30, 0]} /><mesh geometry={geo('cone', 22, 20, 10)} material={mat('#f8fafc')} position={[0, 50, 0]} /></group>}
      {sea && <group position={[-20, 0, -160]}>{Array.from({ length: 14 }, (_, i) => <Box key={i} p={[(i - 7) * 6, 0, (i % 3) * 3]} s={[4.5, 4 + (i % 4) * 2, 4]} c={['#f5f5f4', '#fef3c7', '#fde68a'][i % 3]} />)}</group>}
      <group ref={h} rotation={[0.18, 0, 0]}><Helicopter /></group>
      {CLOUDS.slice(0, 12).map((c, i) => (
        <Mover key={i} fn={(o, t) => { o.position.set(c.x * 0.6, 22 + (i % 4) * 4, ((c.z + t * 25) % 300) - 150); }}>
          <mesh geometry={geo('sphere', 1, 8, 6)} material={basic('#ffffff', { transparent: true, opacity: 0.85 })} scale={[c.s, c.s * 0.4, c.s * 0.7]} />
        </Mover>
      ))}
    </group>
  );
}

/** Azam fast ferry: catamaran on the waves, passengers on deck, Zanzibar coming into view. */
function Ferry({ me, myBusy, people }) {
  const boat = useRef();
  const island = useRef();
  const toZnz = myBusy?.to === 'znz';
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (boat.current) { boat.current.position.y = Math.sin(t * 1.4) * 0.15; boat.current.rotation.z = Math.sin(t * 0.9) * 0.025; boat.current.rotation.x = Math.sin(t * 1.1) * 0.02; }
    if (island.current && myBusy) {
      const f = Math.min(1, (Date.now() - myBusy.startedAt) / (myBusy.endsAt - myBusy.startedAt));
      island.current.position.z = -220 + f * 150;
    }
  });
  const deck = [[-1, 3.2, 1, 0], [1, 3.2, 1.2, 0], [-1.2, 3.2, -1, 0.2], [1.2, 3.2, -0.8, -0.2], [0, 3.2, 2.4, 0], [-1.4, 3.2, 2.6, 0.4]];
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}><planeGeometry args={[600, 600]} /><meshLambertMaterial color="#0e7490" /></mesh>
      {Array.from({ length: 30 }, (_, i) => (
        <Mover key={i} fn={(o, t) => o.position.set(((i * 37) % 60) - 30, 0.05, (((i * 53) % 120) + t * 12) % 120 - 60)}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[2.5, 0.3]} /><meshBasicMaterial color="#e0f2fe" transparent opacity={0.6} /></mesh>
        </Mover>
      ))}
      <group ref={island} position={[10, 0, -200]}>
        <mesh geometry={geo('sphere', 40, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2)} material={mat('#fde68a')} scale={[1.6, 0.06, 0.5]} />
        {Array.from({ length: 16 }, (_, i) => <Box key={i} p={[(i - 8) * 5, 0, -6 + (i % 3) * 3]} s={[4, 4 + (i % 5) * 2, 4]} c={['#f5f5f4', '#fef3c7', '#fed7aa'][i % 3]} />)}
        {[-30, -12, 14, 32].map((x) => <group key={x} position={[x, 0, 6]}><mesh geometry={geo('cyl', 0.4, 0.5, 9, 6)} material={mat('#9a7b4f')} position={[0, 4.5, 0]} /><mesh geometry={geo('cone', 3.5, 1.5, 7)} material={mat('#2f9e57')} position={[0, 9, 0]} /></group>)}
      </group>
      <group ref={boat}>
        {[-1.8, 1.8].map((x) => <Box key={x} p={[x, 0, 0]} s={[1.2, 1.4, 14]} c="#f8fafc" />)}
        <Box p={[0, 1.2, 0]} s={[5, 0.5, 13]} c="#e2e8f0" />
        <Box p={[0, 1.7, -1.5]} s={[4.4, 1.6, 7]} c="#f8fafc" />
        <Box p={[0, 2.2, -1.5]} s={[4.45, 0.5, 6.8]} m={basic('#1e3a8a')} />
        <Sign text="AZAM MARINE · KILIMANJARO" p={[2.26, 2.25, -1.5]} h={0.35} fg="#ffffff" />
        <Box p={[0, 3.1, 0.5]} s={[4.6, 0.1, 4.5]} c="#cbd5e1" />
        <Crowd me={me} myBusy={myBusy} people={people} slots={deck} localSlot={[0.3, 3.2, 0.2, 0]} crowd={6} modeFor={(who, b, n) => (n % 3 === 2 ? 'sit' : 'idle')} />
      </group>
      {!toZnz && null}
    </group>
  );
}

/** Highway: your car (or the coach) on the open road, acacias & baobabs streaming past, Kili ahead. */
function Road({ me, myBusy }) {
  const own = myBusy?.id === 'car';
  const car = own && [...(me.vehicles || [])].filter((v) => ['car', 'van', 'suv'].includes(vehicleByIdS[v.model]?.kind)).sort((a, b) => vehicleByIdS[b.model].price - vehicleByIdS[a.model].price)[0];
  const def = car && vehicleByIdS[car.model];
  const dash = useRef();
  const scenery = useRef();
  const v = useRef();
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    if (dash.current) dash.current.position.z = (t * 18) % 6;
    if (scenery.current) scenery.current.children.forEach((c) => { c.position.z += dt * 18; if (c.position.z > 30) c.position.z -= 180; });
    if (v.current) v.current.position.y = Math.abs(Math.sin(t * 9)) * 0.03;
  });
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, -60]}><planeGeometry args={[400, 300]} /><meshLambertMaterial color="#c9b37a" /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -60]}><planeGeometry args={[9, 300]} /><meshLambertMaterial color="#3f3f46" /></mesh>
      <group ref={dash}>{Array.from({ length: 40 }, (_, i) => <Box key={i} p={[0, 0.01, -i * 6 + 20]} s={[0.25, 0.02, 3]} m={basic('#fde047')} />)}</group>
      <group ref={scenery}>
        {Array.from({ length: 24 }, (_, i) => {
          const side = i % 2 ? 1 : -1;
          const baobab = i % 5 === 0;
          return (
            <group key={i} position={[side * (9 + (i * 7) % 18), 0, -i * 7.5 + 20]}>
              <mesh geometry={geo('cyl', baobab ? 1.2 : 0.18, baobab ? 1.6 : 0.25, baobab ? 5 : 4, 7)} material={mat('#7c5a3a')} position={[0, baobab ? 2.5 : 2, 0]} />
              <mesh geometry={geo('sphere', 1, 8, 5)} material={mat(baobab ? '#65a30d' : '#4d7c0f')} position={[0, baobab ? 5.4 : 4.2, 0]} scale={baobab ? [2.6, 1, 2.6] : [3, 0.6, 3]} />
            </group>
          );
        })}
      </group>
      <group position={[20, 0, -180]}>
        <mesh geometry={geo('cone', 90, 55, 10)} material={mat('#6b7280')} position={[0, 27, 0]} />
        <mesh geometry={geo('cone', 28, 17, 10)} material={mat('#f8fafc')} position={[0, 46, 0]} />
      </group>
      <group ref={v} position={[1.6, 0, 0]} rotation={[0, Math.PI, 0]}>
        {def ? <Car body={def.body} color={car.color} lux={def.lux} /> : <VehicleS kind="bus" color="#1d4ed8" />}
      </group>
    </group>
  );
}

// ------------------------------------------------------ safari & hiking
function Giraffe({ p, ry = 0 }) {
  return (
    <group position={p} rotation={[0, ry, 0]}>
      {[[-0.35, -0.6], [0.35, -0.6], [-0.35, 0.6], [0.35, 0.6]].map(([x, z], i) => <Box key={i} p={[x, 0, z]} s={[0.18, 1.9, 0.18]} c="#d97706" />)}
      <Box p={[0, 1.9, 0]} s={[1, 0.9, 1.9]} c="#f59e0b" />
      <mesh geometry={geo('cyl', 0.16, 0.24, 2.4, 8)} material={mat('#f59e0b')} position={[0, 3.6, 0.85]} rotation={[0.35, 0, 0]} />
      <Box p={[0, 4.6, 1.3]} s={[0.35, 0.35, 0.7]} c="#d97706" />
    </group>
  );
}
function Zebra({ p, ry = 0 }) {
  const m = useMemo(() => {
    const c = document.createElement('canvas'); c.width = 64; c.height = 16;
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 64, 16); x.fillStyle = '#111';
    for (let i = 0; i < 8; i++) x.fillRect(i * 8, 0, 4, 16);
    const t = new THREE.CanvasTexture(c); return new THREE.MeshLambertMaterial({ map: t });
  }, []);
  return (
    <group position={p} rotation={[0, ry, 0]}>
      {[[-0.25, -0.5], [0.25, -0.5], [-0.25, 0.5], [0.25, 0.5]].map(([x, z], i) => <Box key={i} p={[x, 0, z]} s={[0.14, 0.9, 0.14]} c="#e5e7eb" />)}
      <mesh geometry={unitBox} material={m} position={[0, 0.9, 0]} scale={[0.7, 0.7, 1.5]} />
      <mesh geometry={unitBox} material={m} position={[0, 1.3, 0.95]} scale={[0.3, 0.8, 0.35]} rotation={[0.5, 0, 0]} />
    </group>
  );
}
function Elephant({ p, ry = 0 }) {
  return (
    <group position={p} rotation={[0, ry, 0]}>
      {[[-0.6, -0.8], [0.6, -0.8], [-0.6, 0.8], [0.6, 0.8]].map(([x, z], i) => <mesh key={i} geometry={geo('cyl', 0.32, 0.36, 1.6, 8)} material={mat('#78716c')} position={[x, 0.8, z]} />)}
      <mesh geometry={geo('sphere', 1.4, 12, 10)} material={mat('#78716c')} position={[0, 2.2, 0]} scale={[1, 0.85, 1.4]} />
      <mesh geometry={geo('sphere', 0.8, 10, 8)} material={mat('#78716c')} position={[0, 2.5, 1.9]} />
      {[-1, 1].map((s) => <mesh key={s} geometry={geo('circle', 0.8, 10)} material={mat('#6b6460', { side: THREE.DoubleSide })} position={[s * 0.75, 2.5, 1.6]} rotation={[0, s * 1.2, 0]} />)}
      <mesh geometry={geo('cyl', 0.16, 0.08, 1.6, 8)} material={mat('#78716c')} position={[0, 1.7, 2.45]} rotation={[0.25, 0, 0]} />
    </group>
  );
}
function Lion({ p, ry = 0 }) {
  return (
    <group position={p} rotation={[0, ry, 0]}>
      <Box p={[0, 0.35, 0]} s={[0.8, 0.6, 1.6]} c="#d4a017" />
      <mesh geometry={geo('sphere', 0.55, 10, 8)} material={mat('#92400e')} position={[0, 0.95, 0.85]} />
      <mesh geometry={geo('sphere', 0.32, 10, 8)} material={mat('#d4a017')} position={[0, 0.95, 1.2]} />
    </group>
  );
}
/** A thin straight rope/pole between two points. */
function Rope({ a, b, r = 0.025, c = '#3f2a14' }) {
  const { pos, quat, len } = useMemo(() => {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
    const d = B.clone().sub(A);
    return { pos: A.clone().add(B).multiplyScalar(0.5).toArray(), quat: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()), len: d.length() };
  }, [a, b]);
  return <mesh geometry={geo('cyl', r, r, 1, 5)} material={mat(c)} position={pos} quaternion={quat} scale={[1, len, 1]} />;
}

function wickerTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#8a5a2b'; x.fillRect(0, 0, 128, 128);
  for (let r = 0; r < 16; r++) for (let k = 0; k < 16; k++) {
    x.fillStyle = (r + k) % 2 ? '#b07a3f' : '#9c6731';
    x.fillRect(k * 8 + 1, r * 8 + 1, 6, 6);
  }
  x.fillStyle = 'rgba(60,35,10,.5)';
  for (let r = 0; r <= 16; r++) x.fillRect(0, r * 8, 128, 1);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 1);
  return t;
}
function goresTexture(colors) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 64;
  const x = c.getContext('2d');
  const n = 16;
  for (let i = 0; i < n; i++) { x.fillStyle = colors[i % colors.length]; x.fillRect((i * 512) / n, 0, 512 / n + 1, 64); }
  x.fillStyle = 'rgba(0,0,0,.18)';
  for (let i = 0; i < n; i++) x.fillRect((i * 512) / n, 0, 2, 64); // seams
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// Teardrop envelope profile (radius, height), throat at the bottom.
const ENVELOPE = [[0.5, 0], [0.75, 0.5], [1.35, 1.3], [2.15, 2.2], [2.75, 3.1], [3.1, 4.1], [3.15, 5.0], [2.95, 5.9], [2.45, 6.7], [1.7, 7.3], [0.8, 7.65], [0, 7.75]].map(([r, y]) => new THREE.Vector2(r, y));

/** Hot-air balloon: striped envelope, rigging, wicker basket and a burner that flares. */
function Balloon({ colors = ['#dc2626', '#facc15', '#f97316', '#facc15'], children }) {
  const env = useMemo(() => new THREE.LatheGeometry(ENVELOPE, 40), []);
  const envMat = useMemo(() => new THREE.MeshLambertMaterial({ map: goresTexture(colors), side: THREE.DoubleSide }), [colors]);
  const wicker = useMemo(() => new THREE.MeshLambertMaterial({ map: wickerTexture() }), []);
  const flame = useRef();
  useFrame(({ clock }) => {
    if (!flame.current) return;
    const t = clock.elapsedTime;
    const on = Math.sin(t * 0.9) > 0.35; // burner fires in bursts
    const k = on ? 1 + Math.sin(t * 40) * 0.15 : 0.001;
    flame.current.scale.set(k, k * 1.4, k);
  });
  const throat = 2.9;
  return (
    <group>
      <mesh geometry={env} material={envMat} position={[0, throat, 0]} />
      <mesh geometry={geo('torus', 0.5, 0.05, 6, 20)} material={mat('#3f2a14')} position={[0, throat, 0]} rotation={[Math.PI / 2, 0, 0]} />
      {/* basket */}
      <mesh geometry={unitBox} material={wicker} scale={[1.5, 1.05, 1.5]} />
      <Box p={[0, 1.0, 0]} s={[1.62, 0.12, 1.62]} c="#5b3a1a" />
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z], i) => (
        <group key={i}>
          <Rope a={[x * 0.74, 1.1, z * 0.74]} b={[x * 0.32, 2.2, z * 0.32]} />
          <Rope a={[x * 0.32, 2.2, z * 0.32]} b={[x * 0.36, throat + 0.02, z * 0.36]} />
        </group>
      ))}
      {/* burner + flame */}
      <mesh geometry={geo('cyl', 0.22, 0.26, 0.3, 10)} material={mat('#9ca3af')} position={[0, 2.25, 0]} />
      <mesh ref={flame} geometry={geo('cone', 0.2, 0.9, 10)} material={basic('#fb923c', { transparent: true, opacity: 0.9 })} position={[0, 2.85, 0]} />
      {children}
    </group>
  );
}

/** Open-sided Land Cruiser game-drive vehicle: canvas pop-top, bench seats, snorkel, spare wheel. Faces +z. */
function SafariJeep({ me, myBusy }) {
  const body = '#6b7d3a';
  const tyre = mat('#1f2937');
  const rim = mat('#9ca3af');
  return (
    <group>
      {[[-0.98, 1.6], [0.98, 1.6], [-0.98, -1.55], [0.98, -1.55]].map(([x, z], i) => (
        <group key={i} position={[x, 0.48, z]} rotation={[0, 0, Math.PI / 2]}>
          <mesh geometry={geo('cyl', 0.48, 0.48, 0.38, 18)} material={tyre} />
          <mesh geometry={geo('cyl', 0.26, 0.26, 0.4, 10)} material={rim} />
        </group>
      ))}
      <Box p={[0, 0.5, 0.1]} s={[1.95, 0.75, 4.85]} c={body} />
      {[[-1, 1.6], [1, 1.6], [-1, -1.55], [1, -1.55]].map(([x, z], i) => <Box key={i} p={[x, 0.82, z]} s={[0.1, 0.22, 1.25]} c="#1f2937" />)}
      <Box p={[0, 0.35, 0.1]} s={[2.0, 0.12, 2.0]} c="#1f2937" />
      {/* bonnet, grille, lights, bull bar */}
      <Box p={[0, 1.25, 1.65]} s={[1.85, 0.42, 1.6]} c={body} />
      <Box p={[0, 0.62, 2.48]} s={[1.55, 0.95, 0.06]} c="#1f2937" />
      {[-0.62, 0.62].map((x) => <mesh key={x} geometry={geo('cyl', 0.16, 0.16, 0.06, 14)} material={basic('#fef9c3')} position={[x, 1.2, 2.52]} rotation={[Math.PI / 2, 0, 0]} />)}
      <Rope a={[-0.95, 1.0, 2.68]} b={[0.95, 1.0, 2.68]} r={0.05} c="#111827" />
      {[-0.45, 0.45].map((x) => <Rope key={x} a={[x, 0.45, 2.66]} b={[x, 1.35, 2.66]} r={0.05} c="#111827" />)}
      {/* windscreen + cab roof */}
      {[-0.9, 0.9].map((x) => <Box key={x} p={[x, 1.6, 0.85]} s={[0.08, 0.95, 0.08]} c={body} />)}
      <Box p={[0, 1.62, 0.86]} s={[1.75, 0.9, 0.04]} m={mat('#1e293b', { transparent: true, opacity: 0.55 })} />
      <Box p={[0, 2.55, 0.35]} s={[1.98, 0.08, 1.15]} c={body} />
      {[-0.95, 0.95].map((x) => <Box key={x} p={[x, 1.6, -0.2]} s={[0.07, 0.95, 0.07]} c={body} />)}
      {/* open rear: waist-high sides, benches, pop-top canvas roof */}
      {[-0.95, 0.95].map((x) => <Box key={x} p={[x, 1.25, -1.15]} s={[0.06, 0.38, 2.6]} c={body} />)}
      <Box p={[0, 1.25, -2.43]} s={[1.95, 0.55, 0.06]} c={body} />
      {[-0.55, -1.65].map((z) => (
        <group key={z}>
          <Box p={[0, 1.25, z]} s={[1.75, 0.16, 0.5]} c="#7c4a21" />
          <Box p={[0, 1.4, z - 0.24]} s={[1.75, 0.45, 0.09]} c="#7c4a21" />
        </group>
      ))}
      {[[-0.92, -0.3], [0.92, -0.3], [-0.92, -2.35], [0.92, -2.35]].map(([x, z], i) => <Box key={i} p={[x, 1.25, z]} s={[0.07, 2.0, 0.07]} c="#374151" />)}
      <Box p={[0, 3.25, -1.33]} s={[2.1, 0.09, 2.35]} c="#d6c7a1" />
      <Box p={[0, 3.17, -1.33]} s={[2.14, 0.08, 2.39]} c="#a8946a" />
      {/* snorkel, spare wheel, roof rack */}
      <Rope a={[1.02, 0.9, 1.1]} b={[1.02, 2.55, 0.9]} r={0.07} c="#111827" />
      <Box p={[1.02, 2.5, 0.84]} s={[0.16, 0.12, 0.22]} c="#111827" />
      <group position={[0, 1.35, -2.62]} rotation={[Math.PI / 2, 0, 0]}>
        <mesh geometry={geo('cyl', 0.46, 0.46, 0.3, 18)} material={tyre} />
        <mesh geometry={geo('cyl', 0.24, 0.24, 0.32, 10)} material={rim} />
      </group>
      <group position={[1.0, 0.98, -0.6]} rotation={[0, Math.PI / 2, 0]}><Sign text="SERENGETI SAFARIS" p={[0, 0, 0]} h={0.26} fg="#fef3c7" /></group>
      <group position={[-1.0, 0.98, -0.6]} rotation={[0, -Math.PI / 2, 0]}><Sign text="SERENGETI SAFARIS" p={[0, 0, 0]} h={0.26} fg="#fef3c7" /></group>
      {/* people: guide driving, you standing up in the pop-top with a tourist */}
      <Person slot={[0.45, 0.75, 0.25, 0]} appearance={NPC_LOOKS[6]} mode="sit" />
      <Person slot={[0.4, 0.95, -1.05, 0]} appearance={me.appearance} mode={myBusy?.kind === 'job' ? 'idle' : 'cheer'} id={me.id} username={me.username} />
      <Person slot={[-0.45, 0.95, -1.95, 0]} appearance={NPC_LOOKS[11]} mode="idle" />
    </group>
  );
}

/** Safari: open savannah, a pop-top Land Cruiser on a game drive — or a hot-air balloon over the Serengeti. */
function SafariScene({ me, myBusy }) {
  const balloon = myBusy?.id === 'balloon';
  const crater = myBusy?.id === 'ngorongoro';
  const forest = myBusy?.placeId === 'jozani';
  const jeep = useRef();
  const herd = useRef();
  const bal = useRef();
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (jeep.current) {
      // Slow loop around the herd; nose follows the track.
      const a = t * 0.12;
      const x = Math.sin(a) * 7, z = -1 + Math.cos(a) * 2.5;
      jeep.current.position.set(x, Math.abs(Math.sin(t * 6)) * 0.02, z);
      jeep.current.rotation.y = Math.atan2(Math.cos(a) * 7, -Math.sin(a) * 2.5);
      sceneCam.pos = [8, 7, 15];
      sceneCam.look = [x * 0.6, -1.2, -3];
    }
    if (bal.current) {
      const bx = Math.sin(t * 0.05) * 10, by = 24 + Math.sin(t * 0.3) * 0.6, bz = -8 + Math.cos(t * 0.04) * 4;
      bal.current.position.set(bx, by, bz);
      bal.current.rotation.y = t * 0.03;
      sceneCam.pos = [bx + 13, by + 3, bz + 19];
      sceneCam.look = [bx, by + 3.2, bz];
    }
    if (herd.current) herd.current.position.x = Math.sin(t * 0.08) * 3;
  });
  const acacias = useMemo(() => {
    const rnd = (n) => { const v = Math.sin(n * 12.9898) * 43758.5453; return v - Math.floor(v); };
    const W = balloon ? 90 : 40, D = balloon ? 120 : 50;
    return Array.from({ length: balloon ? 70 : 22 }, (_, i) => [(rnd(i + 1) * 2 - 1) * W, -8 - rnd(i + 101) * D + (balloon ? 40 : 0)]).filter(([x, z]) => Math.abs(x) > 4 || z < -14);
  }, [balloon]);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -20]}><planeGeometry args={[400, 300]} /><meshLambertMaterial color={forest ? '#3f6212' : crater ? '#84a35a' : '#c9b37a'} /></mesh>
      {crater && <mesh geometry={geo('cyl', 90, 110, 22, 24, 1, true)} material={mat('#57534e', { side: THREE.DoubleSide })} position={[0, 11, -40]} />}
      {acacias.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh geometry={geo('cyl', 0.2, 0.3, forest ? 6 : 3.5, 6)} material={mat('#5b4636')} position={[0, forest ? 3 : 1.75, 0]} />
          <mesh geometry={geo('sphere', 1, 8, 5)} material={mat(forest ? '#166534' : '#4d7c0f')} position={[0, forest ? 6.5 : 3.8, 0]} scale={forest ? [2.5, 2, 2.5] : [3.2, 0.5, 3.2]} />
        </group>
      ))}
      {!forest && (
        <group ref={herd}>
          <Giraffe p={[-8, 0, -12]} ry={0.6} /><Giraffe p={[-5, 0, -16]} ry={0.9} />
          <Zebra p={[4, 0, -9]} ry={-0.4} /><Zebra p={[6, 0, -10.5]} ry={-0.2} /><Zebra p={[5, 0, -7.5]} ry={-0.6} />
          <Elephant p={[12, 0, -20]} ry={-0.8} /><Elephant p={[16, 0, -23]} ry={-1} />
          <Lion p={[-2, 0, -6]} ry={0.3} />
          {balloon && <><Giraffe p={[-20, 0, -30]} ry={1.2} /><Elephant p={[22, 0, -2]} ry={2} /><Zebra p={[10, 0, 4]} ry={1} /><Zebra p={[12, 0, 5]} ry={1.1} /><Zebra p={[11, 0, 7]} ry={0.8} /></>}
        </group>
      )}
      {forest && Array.from({ length: 6 }, (_, i) => (
        <Mover key={i} fn={(o, t) => { o.position.set(-6 + i * 2.4, 4.8 + Math.sin(t * 2 + i) * 0.4, -9 - (i % 2) * 2); }}>
          <mesh geometry={geo('sphere', 0.35, 8, 6)} material={mat(i % 2 ? '#7f1d1d' : '#111827')} />
        </Mover>
      ))}
      {balloon ? (
        <>
          <group ref={bal}>
            <Balloon>
              <Person slot={[0.3, 0.15, 0.2, 0.4]} appearance={me.appearance} mode="cheer" id={me.id} username={me.username} />
              <Person slot={[-0.35, 0.15, -0.3, 0.4]} appearance={NPC_LOOKS[3]} mode="idle" />
            </Balloon>
          </group>
          <group position={[-28, 20, -36]}><Balloon colors={['#2563eb', '#f8fafc', '#2563eb', '#22c55e']} /></group>
          <group position={[34, 15, -52]}><Balloon colors={['#a21caf', '#f472b6', '#facc15', '#f472b6']} /></group>
          <group position={[-10, 27, -75]}><Balloon colors={['#059669', '#fde047']} /></group>
        </>
      ) : (
        <group ref={jeep}><SafariJeep me={me} myBusy={myBusy} /></group>
      )}
    </group>
  );
}

/** Mountain trail: Mount Meru or the Kilimanjaro summit, with porters ahead. */
function Hike({ me, myBusy }) {
  const kili = myBusy?.id === 'kili';
  const walkers = useRef();
  useFrame(({ clock }) => { if (walkers.current) walkers.current.position.z = -((clock.elapsedTime * 0.6) % 6); });
  return (
    <group>
      <mesh geometry={geo('cone', 60, 40, 16)} material={mat(kili ? '#78716c' : '#4d7c0f')} position={[0, 15, -55]} />
      <mesh geometry={geo('cone', 20, 13, 16)} material={mat('#f8fafc')} position={[0, 28.5, -55]} />
      <mesh rotation={[-Math.PI / 2 + 0.12, 0, 0]} position={[0, 0, -10]}><planeGeometry args={[80, 60]} /><meshLambertMaterial color={kili ? '#a8a29e' : '#65a30d'} /></mesh>
      <mesh rotation={[-Math.PI / 2 + 0.12, 0, 0]} position={[0, 0.05, -10]}><planeGeometry args={[2.4, 60]} /><meshLambertMaterial color="#a16207" /></mesh>
      {Array.from({ length: 12 }, (_, i) => <mesh key={i} geometry={geo('sphere', 0.6 + (i % 3) * 0.3, 6, 5)} material={mat('#78716c')} position={[((i * 7) % 20) - 10 + (i % 2 ? 3 : -3), 0.3, -i * 3]} />)}
      <group ref={walkers}>
        {[0, 1, 2].map((i) => (
          <group key={i} position={[0.2, 0.4 + i * 0.6, -4 - i * 4]}>
            <Person slot={[0, 0, 0, Math.PI]} appearance={NPC_LOOKS[(i * 5) % NPC_LOOKS.length]} mode="walk" />
            <Box p={[0, 1.4, -0.25]} s={[0.6, 0.6, 0.4]} c={['#dc2626', '#2563eb', '#f59e0b'][i]} />
          </group>
        ))}
      </group>
      <Person slot={[0, 0, 1.5, Math.PI]} appearance={me.appearance} mode="walk" id={me.id} username={me.username} />
      {kili && <Sign text="UHURU PEAK 5,895 m" p={[0, 3, -16]} h={0.9} fg="#ffffff" bg="rgba(120,53,15,.85)" />}
    </group>
  );
}

// ---------------------------------------------------------------- casino
function drawSlotScreen(ctx, t) {
  const w = ctx.canvas.width, h = ctx.canvas.height;
  ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, w, h);
  const S = ['🍒', '7', '💎', '⭐'];
  ctx.font = 'bold 28px system-ui'; ctx.textAlign = 'center';
  for (let i = 0; i < 3; i++) { ctx.fillStyle = ['#f472b6', '#facc15', '#22d3ee'][i]; ctx.fillText(S[Math.floor(t * 4 + i * 1.7) % 4], w * (i + 0.5) / 3, h * 0.65); }
}
/** Le Grande Casino floor: gold-lit edges, slot machines, blackjack, roulette and poker. */
function CasinoScene({ me, myBusy, people }) {
  const screen = useCanvasTexture(96, 48, drawSlotScreen, 6);
  const wheel = useRef();
  useFrame((_, dt) => { if (wheel.current) wheel.current.rotation.y += dt * 1.6; });
  const slots = useMemo(() => [[-5, 1.5, 0], [-3, 1.5, 0], [-1, 1.5, 0], [1, 1.5, 0], [3, 1.5, 0], [5, 1.5, 0], [-6, 4.6, Math.PI], [-3, 4.6, Math.PI], [0, 4.6, Math.PI]], []);
  const croupier = myBusy?.kind === 'job';
  return (
    <group>
      <Room w={20} d={16} h={5} floor="#3f0d12" wall="#1c1917" back="#0c0a09" />
      {[[0, -7.85, 20, 0.08], [0, 7.85, 20, 0.08]].map(([x, z, w, d], i) => <Box key={i} p={[x, 0.02, z]} s={[w, 0.03, d]} m={basic('#fbbf24')} />)}
      {[-9.85, 9.85].map((x) => <Box key={x} p={[x, 0.02, 0]} s={[0.08, 0.03, 16]} m={basic('#fbbf24')} />)}
      <Box p={[0, 4.9, -7.85]} s={[20, 0.06, 0.06]} m={basic('#fbbf24')} />
      <Sign text="LE GRANDE CASINO" p={[0, 3.8, -7.82]} h={0.8} fg="#fde047" />
      {/* slot machines along the back wall */}
      {[-7, -5.6, -4.2, -2.8, 2.8, 4.2, 5.6, 7].map((x) => (
        <group key={x} position={[x, 0, -6.8]}>
          <Box s={[1.1, 2, 0.9]} c="#7f1d1d" />
          <mesh position={[0, 1.4, 0.46]}><planeGeometry args={[0.8, 0.45]} /><meshBasicMaterial map={screen} toneMapped={false} /></mesh>
          <Box p={[0, 2, 0.1]} s={[1.1, 0.25, 0.8]} m={basic('#facc15')} />
          <mesh geometry={geo('cyl', 0.03, 0.03, 0.6, 6)} material={mat('#9ca3af')} position={[0.6, 1.1, 0.2]} />
        </group>
      ))}
      {/* blackjack table */}
      <group position={[-4, 0, 0]}>
        <mesh geometry={geo('cyl', 1.95, 1.95, 0.84, 24, 1, false, 0, Math.PI)} material={mat('#a16207')} position={[0, 0.42, 0]} rotation={[0, -Math.PI / 2, 0]} />
        <mesh geometry={geo('cyl', 1.75, 1.75, 0.9, 24, 1, false, 0, Math.PI)} material={mat('#15803d')} position={[0, 0.45, 0.01]} rotation={[0, -Math.PI / 2, 0]} />
        <Person slot={[0, 0, -0.7, 0]} appearance={croupier ? me.appearance : NPC_LOOKS[4]} mode="idle" id={croupier ? me.id : undefined} username={croupier ? me.username : undefined} />
      </group>
      {/* roulette table with a spinning wheel */}
      <group position={[4, 0, 0]}>
        <Box s={[3.2, 0.84, 1.8]} c="#a16207" />
        <Box s={[2.9, 0.9, 1.5]} c="#15803d" />
        <group ref={wheel} position={[-0.9, 0.95, 0]}>
          <mesh geometry={geo('cyl', 0.55, 0.55, 0.08, 24)} material={mat('#111827')} />
          {Array.from({ length: 12 }, (_, i) => <Box key={i} p={[Math.cos((i / 12) * Math.PI * 2) * 0.4, 0.03, Math.sin((i / 12) * Math.PI * 2) * 0.4]} s={[0.12, 0.04, 0.12]} c={i % 2 ? '#dc2626' : '#111827'} />)}
        </group>
        <Person slot={[0.6, 0, -1.2, 0]} appearance={NPC_LOOKS[9]} mode="idle" />
      </group>
      {/* poker table */}
      <group position={[0, 0, 4]}>
        <mesh geometry={geo('cyl', 1.75, 1.75, 0.84, 24)} material={mat('#a16207')} position={[0, 0.42, 0]} scale={[1.4, 1, 1]} />
        <mesh geometry={geo('cyl', 1.55, 1.55, 0.9, 24)} material={mat('#15803d')} position={[0, 0.45, 0]} scale={[1.4, 1, 1]} />
        {[0, 1, 2, 3, 4].map((i) => <Box key={i} p={[-0.8 + i * 0.4, 0.9, 0.2]} s={[0.26, 0.01, 0.36]} c="#f8fafc" />)}
      </group>
      {/* bar */}
      <group position={[8.6, 0, 3]}>
        <Box s={[1.2, 1.1, 5]} c="#1c1917" />
        <Box p={[0, 1.1, 0]} s={[1.3, 0.06, 5.1]} m={basic('#fbbf24')} />
      </group>
      <Crowd me={croupier ? { ...me, appearance: NPC_LOOKS[2], id: undefined, username: undefined } : me} myBusy={myBusy} people={people} slots={slots.map(([x, z, ry], i) => (i < 6 ? [x * 0.7 - 4.2 + (i % 2) * 0, 0, 1.6 + (i % 2) * 0.2, Math.PI] : [x + 3, 0, 5.8, Math.PI]))} crowd={10} modeFor={(who, b, n) => (n % 3 === 0 ? 'cheer' : 'idle')} />
      {[[-5, 4, -2], [5, 4, -2], [0, 4, 4]].map((p, i) => <pointLight key={i} color={i === 2 ? '#fbbf24' : '#f472b6'} intensity={7} distance={12} position={p} />)}
    </group>
  );
}

// ---------------------------------------------------------------- config
export const SCENES = {
  club: { C: Club, camera: { pos: [3, 14, 13], look: [-1, 0.2, -2.2] }, dark: true, bg: '#0b0614', light: 0.25 },
  lounge: { C: (p) => <Club {...p} lounge />, camera: { pos: [0, 7, 13], look: [0, 1.2, -2] }, bg: '#f59e0b', light: 0.7 },
  bar: { C: Bar, camera: { pos: [0, 6.2, 9.5], look: [0, 2, -5] }, bg: '#1c1917', light: 0.65 },
  stadium: { C: Stadium, camera: { pos: [0, 8, 27], look: [0, 1.5, 6] }, light: 1 },
  dining: { C: Dining, camera: { pos: [0, 6, 8.5], look: [0, 0.8, -1] }, bg: '#1c1917', light: 0.9 },
  room: { C: Room1, camera: { pos: [0.4, 5.5, 6], look: [-0.4, 0.6, -1.5] }, bg: '#1c1917', light: 0.6 },
  beach: { C: Beach, camera: { pos: [0, 6, 11], look: [0, 0.3, -4] }, light: 1 },
  studio: { C: Studio, camera: { pos: [0, 4.5, 7.5], look: [0, 1.4, 0] }, bg: '#0b0614', light: 0.4 },
  cinema: { C: Cinema, camera: { pos: [0, 6.5, 10.5], look: [0, 2.6, -8] }, bg: '#000000', light: 0.25 },
  gym: { C: Gym, camera: { pos: [0, 5, 8], look: [0, 1, -1] }, bg: '#1c1917', light: 0.9 },
  heli: { C: Heli, camera: { pos: [9, 36, 16], look: [0, 29, -2] }, bg: '#7dd3fc', light: 1.1 },
  ferry: { C: Ferry, camera: { pos: [9, 8, 19], look: [0, 3, -24] }, bg: '#7dd3fc', light: 1.05 },
  road: { C: Road, camera: { pos: [3.5, 4.8, 9.5], look: [1, 1, -6] }, bg: '#bae6fd', light: 1.1 },
  safari: { C: SafariScene, camera: { pos: [6, 8, 14], look: [0, 2.5, -8] }, dynamic: true, bg: '#fed7aa', light: 1.1 },
  hike: { C: Hike, camera: { pos: [4, 5, 9], look: [0, 2, -10] }, bg: '#bae6fd', light: 1.1 },
  casino: { C: CasinoScene, camera: { pos: [3, 13, 13], look: [0, 0.2, -1.5] }, dark: true, bg: '#0c0a09', light: 0.45 },
  police: { C: Police, camera: { pos: [-1.5, 8, 9.5], look: [-3.6, 0.6, -1.6] }, bg: '#1c1917', light: 0.95 },
  court: { C: Court, camera: { pos: [0, 7, 11], look: [0, 1, -1.5] }, bg: '#1c1917', light: 0.95 },
  salon: { C: Salon, camera: { pos: [0.5, 7, 10], look: [0, 0.8, -1.2] }, bg: '#1c1917', light: 0.95 },
  grill: { C: Grill, camera: { pos: [0, 11, 11], look: [0, 0.4, 0.8] }, light: 1 },
  waterpark: { C: Waterpark, camera: { pos: [2, 13, 18], look: [2.5, 1.5, -1.5] }, light: 1.05 },
  ngoma: { C: Ngoma, camera: { pos: [0, 8, 13], look: [0, 0.8, -1] }, bg: '#7c2d12', light: 0.8 },
  golf: { C: Golf, camera: { pos: [-2, 4.5, 8.5], look: [0.5, 1, -8] }, light: 1.05 },
  dhow: { C: Dhow, camera: { pos: [11, 6.5, 12], look: [0, 1.2, -3] }, bg: '#fdba74', light: 0.95 },
  concert: { C: Concert, camera: { pos: [0, 7, 14], look: [0, 1.6, -2] }, dark: true, bg: '#0b0614', light: 0.35 },
  karting: { C: Karting, camera: { pos: [0, 20, 15], look: [0, 0, 0] }, light: 1.05 },
  spa: { C: Spa, camera: { pos: [0, 8.5, 10.5], look: [0, 0.4, -1.4] }, bg: '#1c1917', light: 0.8 },
  rooftop: { C: Rooftop, camera: { pos: [0, 6, 11], look: [0, 1, -2] }, bg: '#f59e0b', light: 0.8 },
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
  const events = useStore((s) => s.events);
  const party = livePartyAt(events, placeId);
  if (!cfg) return null;
  return (
    <group position={SCENE_ORIGIN}>
      <Shadows light={[4, 12, 8]} size={16} intensity={cfg.dark ? 0.25 : 0.6}>
      <cfg.C me={me} myBusy={myBusy} people={people} placeId={placeId} />
      {party && scene !== 'flight' && <PartyDecor event={party} banner={PARTY_BANNER[scene]} />}
      </Shadows>
    </group>
  );
}
