import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { gameClock } from '@shared/world.js';
import { City } from './City.jsx';
import { LocalPlayer, RemotePlayers } from './Players.jsx';
import { AudioDriver } from './AudioDriver.jsx';
import { ActivityScene, SCENES, SCENE_ORIGIN } from './Scenes.jsx';
import { HomeScene, HOME_ORIGIN } from './HomeScene.jsx';
import { MapPins } from './MapPins.jsx';
import { useStore } from '../store.js';
import { local, view } from '../net.js';

const zoom = { value: 1, target: 1 };
export const setZoom = (z) => (zoom.target = Math.max(0.45, Math.min(2.6, z)));
export const getZoom = () => zoom.target;

/**
 * Camera gestures on the canvas:
 *  - wheel / two-finger pinch: zoom
 *  - one-finger (or mouse) drag: rotate + tilt around the player, or pan in map mode
 * Taps still reach the 3D scene; R3F ignores clicks that moved more than ~10px.
 */
function useCameraGestures(modeRef) {
  const { gl } = useThree();
  useEffect(() => {
    const el = gl.domElement;
    const isMap = () => modeRef.current === 'map';
    const isHome = () => modeRef.current === 'home';
    const wheel = (e) => {
      e.preventDefault();
      const f = 1 + Math.sign(e.deltaY) * 0.1;
      if (isMap()) view.mapDist = Math.max(50, Math.min(280, view.mapDist * f));
      else if (isHome()) view.homeDist = Math.max(14, Math.min(48, view.homeDist * f));
      else setZoom(zoom.target * f);
    };
    let pinch = null;
    let drag = null;
    const pts = new Map();
    const down = (e) => {
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: zoom.target, m: view.mapDist, h: view.homeDist };
        drag = null;
      } else if (pts.size === 1) drag = { x: e.clientX, y: e.clientY };
    };
    const move = (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pinch && pts.size === 2) {
        const [a, b] = [...pts.values()];
        const ratio = pinch.d / Math.max(20, Math.hypot(a[0] - b[0], a[1] - b[1]));
        if (isMap()) view.mapDist = Math.max(50, Math.min(280, pinch.m * ratio));
        else if (isHome()) view.homeDist = Math.max(14, Math.min(48, pinch.h * ratio));
        else setZoom(pinch.z * ratio);
        return;
      }
      if (!drag || useStore.getState().placing) return;
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      drag.x = e.clientX;
      drag.y = e.clientY;
      if (isMap()) {
        // Pan along the ground, relative to the current camera yaw.
        const k = view.mapDist / 450;
        const c = Math.cos(view.yaw);
        const s = Math.sin(view.yaw);
        view.mapX = Math.max(-150, Math.min(150, view.mapX - (dx * c + dy * s) * k));
        view.mapZ = Math.max(-150, Math.min(150, view.mapZ - (-dx * s + dy * c) * k));
      } else if (isHome()) {
        view.homeYaw -= dx * 0.008;
        view.homePitch = Math.max(0.45, Math.min(1.45, view.homePitch + dy * 0.005));
      } else {
        view.yaw -= dx * 0.008;
        view.pitch = Math.max(0.35, Math.min(1.4, view.pitch + dy * 0.005));
      }
    };
    const up = (e) => {
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = null;
      if (pts.size === 0) drag = null;
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
  }, [gl, modeRef]);
}

function CameraRig({ mode, sceneKey }) {
  const { camera, size } = useThree();
  // Portrait phones need a wider lens to see enough of the street.
  useEffect(() => {
    const aspect = size.width / size.height;
    camera.fov = mode === 'overview' ? (aspect < 1 ? 62 : 45) : aspect < 1 ? 52 : 40;
    camera.updateProjectionMatrix();
  }, [camera, size, mode]);
  const focus = useRef(new THREE.Vector3(local.x, 0, local.z));
  const t = useRef(0);
  const modeRef = useRef(mode);
  modeRef.current = mode;
  useCameraGestures(modeRef);
  useFrame((_, dt) => {
    dt = Math.min(dt, 0.1);
    zoom.value += (zoom.target - zoom.value) * Math.min(1, dt * 8);
    if (sceneKey && SCENES[sceneKey]) {
      // Interior camera with a slow handheld sway.
      t.current += dt;
      const { pos, look } = SCENES[sceneKey].camera;
      const [ox, oy, oz] = SCENE_ORIGIN;
      // Portrait screens are narrow: pull back so the whole room fits.
      const k = size.width / size.height < 1 ? 1.35 : 1;
      const px = look[0] + (pos[0] - look[0]) * k;
      const py = look[1] + (pos[1] - look[1]) * k;
      const pz = look[2] + (pos[2] - look[2]) * k;
      camera.position.set(ox + px + Math.sin(t.current * 0.25) * 0.8, oy + py + Math.sin(t.current * 0.4) * 0.15, oz + pz);
      camera.lookAt(ox + look[0], oy + look[1], oz + look[2]);
      return;
    }
    if (mode === 'overview') {
      t.current += dt * 0.035;
      const cx = Math.sin(t.current) * 45;
      const cz = Math.cos(t.current * 0.7) * 35 - 10;
      camera.position.set(cx, 85, cz + 70);
      camera.lookAt(cx, 0, cz);
      return;
    }
    if (mode === 'home') {
      const dist = view.homeDist;
      const flat = Math.cos(view.homePitch) * dist;
      camera.position.set(HOME_ORIGIN[0] + Math.sin(view.homeYaw) * flat, 1 + Math.sin(view.homePitch) * dist, HOME_ORIGIN[2] + Math.cos(view.homeYaw) * flat);
      camera.lookAt(HOME_ORIGIN[0], 0.5, HOME_ORIGIN[2]);
      return;
    }
    const a = 1 - Math.exp(-dt * 6);
    const map = mode === 'map';
    const fx = map ? view.mapX : local.x;
    const fz = map ? view.mapZ : local.z;
    focus.current.x += (fx - focus.current.x) * a;
    focus.current.z += (fz - focus.current.z) * a;
    if (!map && Math.hypot(fx - focus.current.x, fz - focus.current.z) > 40) focus.current.set(fx, 0, fz);
    const dist = map ? view.mapDist : 31 * zoom.value;
    const pitch = map ? 1.1 : view.pitch;
    const flat = Math.cos(pitch) * dist;
    camera.position.set(focus.current.x + Math.sin(view.yaw) * flat, 1 + Math.sin(pitch) * dist, focus.current.z + Math.cos(view.yaw) * flat);
    camera.lookAt(focus.current.x, 1, focus.current.z);
  });
  return null;
}

const DAY_SKY = new THREE.Color('#cfe6f7');
const DUSK_SKY = new THREE.Color('#f6c48f');
const NIGHT_SKY = new THREE.Color('#2c3e66');

function DayNight({ interior }) {
  const { scene } = useThree();
  const hemi = useRef();
  const sun = useRef();
  const last = useRef(-1);
  useMemo(() => {
    scene.background = DAY_SKY.clone();
    scene.fog = new THREE.Fog(DAY_SKY.clone(), 220, 560);
  }, [scene]);
  useFrame(() => {
    if (interior) {
      // Indoor scenes set their own mood: fixed backdrop + dimmed world light.
      if (interior.bg) {
        scene.background.set(interior.bg);
        scene.fog.color.set(interior.bg);
      }
      hemi.current.intensity = 1.3 * (interior.light ?? 1);
      sun.current.intensity = 1.2 * (interior.light ?? 1);
      last.current = -1;
      if (interior.bg) return;
    }
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

export default function GameScene({ mode = 'play', me, world, ads, onPlace, onPlot, onBillboard, onGround, onPlayer, quality = 'auto', scene = null }) {
  const sceneCfg = scene && SCENES[scene.key];
  const home = mode === 'home';
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
      camera={{ fov: 40, near: 0.5, far: 900, position: [0, 60, 60] }}
      flat
      onCreated={(state) => {
        state.gl.setClearColor('#cfe6f7');
        if (import.meta.env.DEV) window.__r3f = state;
      }}
    >
      <Suspense fallback={null}>
        <DayNight interior={sceneCfg ? { bg: sceneCfg.bg, light: sceneCfg.light } : null} />
        <CameraRig mode={mode} sceneKey={sceneCfg ? scene.key : null} />
        <group visible={!sceneCfg && !home}>
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
          mapMode={mode === 'map'}
        />
        </group>
        {home && me && <HomeScene me={me} />}
        {mode === 'map' && <MapPins me={me} onPlayer={onPlayer} />}
        {(mode === 'play' || mode === 'map' || home) && me && (
          <>
            <LocalPlayer me={me} frozen={!!sceneCfg || home} />
            <AudioDriver me={me} scene={home ? 'home' : sceneCfg ? scene.key : null} />
            {sceneCfg && <ActivityScene scene={scene.key} placeId={scene.placeId} me={me} myBusy={scene.busy} />}
            <RemotePlayers onPlayer={onPlayer} />
          </>
        )}
      </Suspense>
    </Canvas>
  );
}
