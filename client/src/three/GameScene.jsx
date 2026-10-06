import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { gameClock } from '@shared/world.js';
import { City } from './City.jsx';
import { LocalPlayer, RemotePlayers } from './Players.jsx';
import { local } from '../net.js';

const zoom = { value: 0.8, target: 0.8 };
export const setZoom = (z) => (zoom.target = Math.max(0.45, Math.min(2.6, z)));
export const getZoom = () => zoom.target;

function useZoomGestures() {
  const { gl } = useThree();
  useEffect(() => {
    const el = gl.domElement;
    const wheel = (e) => {
      e.preventDefault();
      setZoom(zoom.target * (1 + Math.sign(e.deltaY) * 0.1));
    };
    let pinch = null;
    const pts = new Map();
    const down = (e) => {
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: zoom.target };
      }
    };
    const move = (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pinch && pts.size === 2) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        setZoom(pinch.z * (pinch.d / Math.max(20, d)));
      }
    };
    const up = (e) => {
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = null;
    };
    el.addEventListener('wheel', wheel, { passive: false });
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      el.removeEventListener('wheel', wheel);
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [gl]);
}

function CameraRig({ mode }) {
  const { camera, size } = useThree();
  // Portrait phones need a wider lens to see enough of the street.
  useEffect(() => {
    const aspect = size.width / size.height;
    camera.fov = mode === 'overview' ? (aspect < 1 ? 62 : 45) : aspect < 1 ? 52 : 40;
    camera.updateProjectionMatrix();
  }, [camera, size, mode]);
  const focus = useRef(new THREE.Vector3(local.x, 0, local.z));
  const t = useRef(0);
  useZoomGestures();
  useFrame((_, dt) => {
    dt = Math.min(dt, 0.1);
    zoom.value += (zoom.target - zoom.value) * Math.min(1, dt * 8);
    if (mode === 'overview') {
      t.current += dt * 0.035;
      const cx = Math.sin(t.current) * 45;
      const cz = Math.cos(t.current * 0.7) * 35 - 10;
      camera.position.set(cx, 85, cz + 70);
      camera.lookAt(cx, 0, cz);
      return;
    }
    const a = 1 - Math.exp(-dt * 6);
    focus.current.x += (local.x - focus.current.x) * a;
    focus.current.z += (local.z - focus.current.z) * a;
    if (Math.hypot(local.x - focus.current.x, local.z - focus.current.z) > 40) focus.current.set(local.x, 0, local.z);
    const z = zoom.value;
    camera.position.set(focus.current.x, 4 + 26 * z, focus.current.z + 17 * z);
    camera.lookAt(focus.current.x, 1, focus.current.z);
  });
  return null;
}

const DAY_SKY = new THREE.Color('#cfe6f7');
const DUSK_SKY = new THREE.Color('#f6c48f');
const NIGHT_SKY = new THREE.Color('#2c3e66');

function DayNight() {
  const { scene } = useThree();
  const hemi = useRef();
  const sun = useRef();
  const last = useRef(-1);
  useMemo(() => {
    scene.background = DAY_SKY.clone();
    scene.fog = new THREE.Fog(DAY_SKY.clone(), 150, 320);
  }, [scene]);
  useFrame(() => {
    const { totalMin } = gameClock();
    if (totalMin === last.current) return;
    last.current = totalMin;
    const h = totalMin / 60;
    // daylight 0..1 with soft dawn (5–7) and dusk (18–20)
    const day = h < 5 || h > 20 ? 0 : h < 7 ? (h - 5) / 2 : h > 18 ? (20 - h) / 2 : 1;
    const duskness = Math.max(0, 1 - Math.abs(h - 18.8) / 1.4) + Math.max(0, 1 - Math.abs(h - 6) / 1.2);
    const sky = NIGHT_SKY.clone().lerp(DAY_SKY, day).lerp(DUSK_SKY, Math.min(0.55, duskness * 0.5));
    scene.background.copy(sky);
    scene.fog.color.copy(sky);
    hemi.current.intensity = 1.0 + day * 0.6;
    sun.current.intensity = 0.55 + day * 1.2;
    hemi.current.color.set(day > 0.3 ? '#ffffff' : '#9fb4ff');
    const ang = ((h - 6) / 12) * Math.PI;
    sun.current.position.set(Math.cos(ang) * 80, 40 + Math.max(0, Math.sin(ang)) * 80, 40);
  });
  return (
    <>
      <hemisphereLight ref={hemi} args={['#ffffff', '#8aa36b', 1.3]} />
      <directionalLight ref={sun} position={[60, 100, 40]} intensity={1.6} />
    </>
  );
}

export default function GameScene({ mode = 'play', me, world, ads, onPlace, onPlot, onBillboard, onGround, onPlayer, quality = 'auto' }) {
  const lowEnd = useMemo(() => {
    if (quality === 'low') return true;
    if (quality === 'high') return false;
    const mem = navigator.deviceMemory || 4;
    return mem <= 2 || (navigator.hardwareConcurrency || 4) <= 4;
  }, [quality]);
  return (
    <Canvas
      dpr={lowEnd ? [1, 1.25] : [1, 2]}
      gl={{ antialias: !lowEnd, powerPreference: 'high-performance', stencil: false }}
      camera={{ fov: 40, near: 1, far: 420, position: [0, 60, 60] }}
      flat
      onCreated={(state) => {
        state.gl.setClearColor('#cfe6f7');
        if (import.meta.env.DEV) window.__r3f = state;
      }}
    >
      <Suspense fallback={null}>
        <DayNight />
        <CameraRig mode={mode} />
        <City
          world={world}
          ads={ads}
          onPlace={onPlace}
          onPlot={onPlot}
          onBillboard={onBillboard}
          onGround={onGround}
          myUsername={me?.username}
          walkers={lowEnd ? 5 : 10}
          showLabels={mode === 'play'}
        />
        {mode === 'play' && me && (
          <>
            <LocalPlayer me={me} />
            <RemotePlayers onPlayer={onPlayer} />
          </>
        )}
      </Suspense>
    </Canvas>
  );
}
