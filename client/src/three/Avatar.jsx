import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SKIN_TONES, HAIR_COLORS, outfitById } from '@shared/world.js';
import { mat, geo, fabricTexture } from './textures.js';

const fabricMats = new Map();
function fabricMat(pattern, color) {
  if (pattern === 'plain') return mat(color);
  const key = pattern + color;
  if (!fabricMats.has(key)) fabricMats.set(key, new THREE.MeshLambertMaterial({ map: fabricTexture(pattern, color) }));
  return fabricMats.get(key);
}

export const shadowMat = new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.18, depthWrite: false });
const DARK = mat('#1f2937');
const SHOE = mat('#3f2a1d');
const WHITE = mat('#f8fafc');
const EYE = mat('#0b0b0b');

function Hair({ style, color, outfitPattern }) {
  const m = mat(color);
  switch (style) {
    case 'afro':
      return <mesh geometry={geo('sphere', 0.25, 20, 16)} material={m} position={[0, 0.12, -0.1]} scale={[1.05, 0.95, 0.9]} />;
    case 'kibanio':
      return (
        <group>
          <mesh geometry={geo('sphere', 0.172, 12, 10, 0, Math.PI * 2, 0, Math.PI / 1.8)} material={m} position={[0, 0.02, -0.01]} rotation={[-0.38, 0, 0]} />
          <mesh geometry={geo('sphere', 0.1, 10, 8)} material={m} position={[0, 0.2, -0.06]} />
        </group>
      );
    case 'mkia':
      return (
        <group>
          <mesh geometry={geo('sphere', 0.172, 12, 10, 0, Math.PI * 2, 0, Math.PI / 1.8)} material={m} position={[0, 0.02, -0.01]} rotation={[-0.38, 0, 0]} />
          <mesh geometry={geo('cyl', 0.05, 0.03, 0.34, 6)} material={m} position={[0, -0.08, -0.2]} rotation={[0.35, 0, 0]} />
        </group>
      );
    case 'misuko':
    case 'rasta': {
      const len = style === 'rasta' ? 0.42 : 0.34;
      const n = style === 'rasta' ? 9 : 11;
      return (
        <group>
          <mesh geometry={geo('sphere', 0.175, 12, 10, 0, Math.PI * 2, 0, Math.PI / 1.7)} material={m} position={[0, 0.02, -0.01]} rotation={[-0.38, 0, 0]} />
          {Array.from({ length: n }, (_, i) => {
            const a = -Math.PI * 0.5 + (i / (n - 1)) * Math.PI; // 0 = back of the head
            return <mesh key={i} geometry={geo('cyl', 0.022, 0.018, len, 5)} material={m} position={[Math.sin(a) * 0.155, -len / 2 + 0.05, -Math.cos(a) * 0.155]} />;
          })}
        </group>
      );
    }
    case 'kiduku':
      return <mesh geometry={geo('sphere', 0.17, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2.2)} material={m} position={[0, 0.02, -0.01]} rotation={[-0.32, 0, 0]} />;
    case 'kilemba':
      return (
        <group>
          <mesh geometry={geo('cyl', 0.2, 0.17, 0.2, 10)} material={fabricMat('kitenge', '#ea580c')} position={[0, 0.12, -0.01]} rotation={[-0.15, 0, 0]} />
          <mesh geometry={geo('sphere', 0.13, 8, 6)} material={fabricMat('kitenge', '#ea580c')} position={[0.07, 0.24, -0.04]} />
        </group>
      );
    case 'kofia':
      return (
        <group>
          <mesh geometry={geo('sphere', 0.175, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2)} material={mat('#1d4ed8')} position={[0, 0.03, 0]} />
          <mesh geometry={geo('box', 0.22, 0.02, 0.16)} material={mat('#1d4ed8')} position={[0, 0.04, 0.17]} />
        </group>
      );
    default:
      return null;
  }
}

// ---- smooth, per-pixel shaded materials (Lambert looks faceted on rounded bodies)
const phongCache = new Map();
function skinMat(color) {
  const key = `s${color}`;
  if (!phongCache.has(key)) phongCache.set(key, new THREE.MeshPhongMaterial({ color, shininess: 22, specular: new THREE.Color('#3b2a20') }));
  return phongCache.get(key);
}
function clothMat(m) {
  // Re-use the fabric texture/colour but with soft per-pixel shading.
  if (!phongCache.has(m.uuid)) phongCache.set(m.uuid, new THREE.MeshPhongMaterial({ color: m.color, map: m.map || null, shininess: 6, specular: new THREE.Color('#111111') }));
  return phongCache.get(m.uuid);
}
const LIP = new THREE.MeshPhongMaterial({ color: '#6b2f24', shininess: 40 });
const IRIS = new THREE.MeshPhongMaterial({ color: '#3b2314', shininess: 80 });
const EYE_W = new THREE.MeshPhongMaterial({ color: '#f8fafc', shininess: 60 });
const SOLE = mat('#e7e5e4');

// Torso as a lathe: hips → waist → chest → rounded shoulders. Cached per body type.
const torsoCache = new Map();
function torsoGeo(woman) {
  if (!torsoCache.has(woman)) {
    const pts = woman
      ? [[0.001, 0], [0.165, 0.0], [0.175, 0.05], [0.15, 0.2], [0.165, 0.33], [0.175, 0.44], [0.17, 0.52], [0.13, 0.58], [0.06, 0.62], [0.001, 0.625]]
      : [[0.001, 0], [0.17, 0.0], [0.175, 0.06], [0.17, 0.2], [0.19, 0.36], [0.205, 0.47], [0.2, 0.53], [0.15, 0.59], [0.06, 0.625], [0.001, 0.63]];
    torsoCache.set(woman, new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), 22));
  }
  return torsoCache.get(woman);
}

/**
 * Mbongo character. `motion` is a ref: { moving, mode, speed }.
 * Modes: idle walk dance cheer sit eat sleep swim lift sing dj type knocked.
 */
export function Avatar({ appearance, motion, scale = 1 }) {
  const a = appearance || { body: 'man', skin: 2, hair: 'kiduku', hairColor: 0, outfit: 'tshirt' };
  const outfit = outfitById[a.outfit] || outfitById.tshirt;
  const woman = a.body === 'woman';
  const skinColor = SKIN_TONES[a.skin] || SKIN_TONES[2];
  const skin = skinMat(skinColor);
  const hairColor = HAIR_COLORS[a.hairColor] || HAIR_COLORS[0];
  const topMat = clothMat(fabricMat(outfit.pattern || 'plain', outfit.top));
  const bottomMat = clothMat(fabricMat(outfit.bottomPattern || 'plain', outfit.bottom));
  const bt = outfit.bottomType || 'pants';
  const robe = bt === 'robe';
  const longSkirt = bt === 'maxi' || bt === 'wrap';
  const bareLegs = bt !== 'pants';
  const sleeves = outfit.sleeves || 'short';
  const hijab = outfit.head === 'hijab';
  const kofia = outfit.head === 'kofia' && a.hair !== 'kilemba';
  const sw = woman ? 0.36 : 0.42; // shoulder width
  const brow = useMemo(() => mat(hairColor), [hairColor]);

  const legL = useRef();
  const legR = useRef();
  const kneeL = useRef();
  const kneeR = useRef();
  const armL = useRef();
  const armR = useRef();
  const elbowL = useRef();
  const elbowR = useRef();
  const body = useRef();
  const head = useRef();
  const eyes = useRef();
  const phase = useRef(Math.random() * 6);
  const blink = useRef(2 + Math.random() * 3);

  useFrame((_, dt) => {
    const mo = motion?.current || {};
    const mode = mo.mode || (mo.moving ? 'walk' : 'idle');
    const rate = { type: 6, walk: 9 * (mo.speed || 1), dance: 7, cheer: 6, swim: 5, lift: 3, sing: 4, dj: 7, eat: 2.5 }[mode] || 2;
    phase.current += dt * rate;
    const p = phase.current;
    let legL_ = 0, legR_ = 0, armL_ = 0, armR_ = 0, zL = 0.08, zR = -0.08, bob = 0, tilt = 0, yaw = null;
    let kL = 0, kR = 0, eL = 0.12, eR = 0.12, nod = 0;
    switch (mode) {
      case 'walk':
        legL_ = Math.sin(p) * 0.55; legR_ = -legL_;
        // knees bend while the leg swings forward
        kL = Math.max(0, Math.sin(p + 1.4)) * 0.75; kR = Math.max(0, Math.sin(p + 1.4 + Math.PI)) * 0.75;
        armL_ = -Math.sin(p) * 0.45; armR_ = -armL_;
        eL = 0.25 + Math.max(0, Math.sin(p)) * 0.3; eR = 0.25 + Math.max(0, -Math.sin(p)) * 0.3;
        bob = Math.abs(Math.cos(p)) * 0.035;
        nod = Math.sin(p * 2) * 0.03;
        break;
      case 'dance':
        armL_ = -(2.0 + Math.sin(p * 2) * 0.3) + Math.sin(p) * 0.4; armR_ = -(1.8 + Math.sin(p * 2) * 0.3) - Math.sin(p) * 0.4;
        eL = 0.6 + Math.sin(p * 2) * 0.4; eR = 0.6 - Math.sin(p * 2) * 0.4;
        zL = 0.35; zR = -0.35;
        bob = Math.abs(Math.sin(p)) * 0.1 - 0.04;
        kL = 0.3 + Math.abs(Math.sin(p)) * 0.3; kR = 0.3 + Math.abs(Math.cos(p)) * 0.3;
        legL_ = -kL * 0.5 + Math.sin(p) * 0.15; legR_ = -kR * 0.5 - Math.sin(p) * 0.15;
        yaw = Math.sin(p * 0.5) * 0.5;
        nod = Math.sin(p * 2) * 0.12;
        break;
      case 'cheer': {
        const up = Math.sin(p * 0.35) > 0.55;
        legL_ = legR_ = -1.5; kL = kR = 1.5;
        armL_ = up ? -2.8 + Math.sin(p * 3) * 0.25 : -0.7; armR_ = up ? -2.8 - Math.sin(p * 3) * 0.25 : -0.7;
        eL = eR = up ? 0.2 : 1.1;
        zL = up ? 0.25 : 0.1; zR = up ? -0.25 : -0.1;
        bob = -0.4 + (up ? Math.abs(Math.sin(p * 3)) * 0.06 : 0);
        break;
      }
      case 'sit':
        legL_ = legR_ = -1.5; kL = kR = 1.5;
        armL_ = armR_ = -0.45; eL = eR = 0.9;
        bob = -0.4;
        nod = Math.sin(p * 0.5) * 0.03;
        break;
      case 'type':
        legL_ = legR_ = -1.5; kL = kR = 1.5;
        armL_ = -0.55 + Math.sin(p * 3) * 0.05; armR_ = -0.55 - Math.sin(p * 3 + 1) * 0.05;
        eL = eR = 1.1;
        bob = -0.4;
        nod = 0.12;
        break;
      case 'eat':
        legL_ = legR_ = -1.5; kL = kR = 1.5;
        armL_ = -0.45; eL = 0.9;
        armR_ = -0.5 - Math.max(0, Math.sin(p)) * 0.6; eR = 1.2 + Math.max(0, Math.sin(p)) * 0.9; // spoon to mouth
        bob = -0.4;
        break;
      case 'sleep':
        tilt = -Math.PI / 2;
        armL_ = armR_ = 0.1; eL = eR = 0.2;
        kL = 0.15;
        bob = 0.12 + Math.sin(p) * 0.01;
        break;
      case 'knocked':
        tilt = -Math.PI / 2;
        armL_ = -2.6; armR_ = 0.6; zL = 0.5; zR = -0.5;
        legL_ = 0.25; legR_ = -0.2; kL = 0.6;
        bob = 0.1;
        break;
      case 'swim':
        tilt = 1.25;
        armL_ = Math.sin(p) * 2.6; armR_ = Math.sin(p + Math.PI) * 2.6;
        legL_ = Math.sin(p * 2) * 0.35; legR_ = -legL_;
        kL = kR = 0.25;
        bob = -0.45 + Math.sin(p * 2) * 0.05;
        break;
      case 'lift':
        armL_ = armR_ = -(1.2 + Math.sin(p) * 0.9);
        eL = eR = 0.8 + Math.sin(p) * 0.6;
        kL = kR = 0.15 + Math.max(0, Math.sin(p)) * 0.15;
        bob = Math.sin(p) * 0.02 - 0.02;
        break;
      case 'sing':
        armR_ = -1.4; eR = 1.6 + Math.sin(p) * 0.08; // mic at the mouth
        armL_ = -0.4 - Math.max(0, Math.sin(p * 0.5)) * 1.4; zL = 0.35; eL = 0.3;
        bob = Math.abs(Math.sin(p)) * 0.04;
        yaw = Math.sin(p * 0.5) * 0.25;
        nod = -0.08 + Math.sin(p) * 0.05;
        break;
      case 'dj':
        armL_ = -0.9 + Math.sin(p) * 0.12; armR_ = -0.9 - Math.sin(p) * 0.12;
        eL = eR = 0.9;
        bob = Math.abs(Math.sin(p)) * 0.06;
        nod = Math.abs(Math.sin(p)) * 0.18;
        break;
      default:
        armL_ = Math.sin(p) * 0.03; armR_ = -armL_;
        nod = Math.sin(p * 0.6) * 0.02;
    }
    if (legL.current) {
      legL.current.rotation.x = legL_;
      legR.current.rotation.x = legR_;
      kneeL.current.rotation.x = kL;
      kneeR.current.rotation.x = kR;
      armL.current.rotation.x = armL_;
      armR.current.rotation.x = armR_;
      armL.current.rotation.z = zL;
      armR.current.rotation.z = zR;
      elbowL.current.rotation.x = -eL;
      elbowR.current.rotation.x = -eR;
      body.current.position.y = bob;
      body.current.rotation.x = tilt;
      if (yaw !== null) body.current.rotation.y = yaw;
      else body.current.rotation.y *= 0.9;
      head.current.rotation.x = nod;
      // blink every few seconds
      blink.current -= dt;
      const closed = blink.current < 0.12 || mode === 'sleep' || mode === 'knocked';
      eyes.current.scale.y = closed ? 0.12 : 1;
      if (blink.current < 0) blink.current = 2.5 + Math.random() * 3.5;
    }
  });

  const legMat = bareLegs ? skin : bottomMat;
  const shoeMat = woman && (bt === 'dress' || bt === 'skirt' || bt === 'maxi') ? mat('#7c2d12') : SHOE;
  const thigh = 0.36;
  const shin = 0.4;
  return (
    <group scale={scale}>
      <mesh geometry={geo('circle', 0.42, 20)} material={shadowMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} />
      <group ref={body}>
        {/* legs: hip → knee → ankle */}
        {[[-1, legL, kneeL], [1, legR, kneeR]].map(([s, ref, knee]) => (
          <group key={s} ref={ref} position={[s * 0.1, 0.9, 0]}>
            <mesh geometry={geo('capsule', woman ? 0.085 : 0.09, thigh - 0.08, 6, 14)} material={bt === 'shorts' ? bottomMat : legMat} position={[0, -thigh / 2, 0]} />
            <group ref={knee} position={[0, -thigh, 0]}>
              <mesh geometry={geo('capsule', 0.072, shin - 0.06, 6, 14)} material={legMat} position={[0, -shin / 2, 0]} />
              {/* shoe: rounded toe + sole */}
              <group position={[0, -shin - 0.06, 0.05]}>
                <mesh geometry={geo('capsule', 0.065, 0.13, 6, 12)} material={shoeMat} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 0.75]} />
                <mesh geometry={geo('box', 0.11, 0.022, 0.25)} material={SOLE} position={[0, -0.05, 0.01]} />
              </group>
            </group>
          </group>
        ))}
        {/* hips / skirts / robes */}
        {(bt === 'pants' || bt === 'shorts') && (
          <group>
            <mesh geometry={geo('cyl', woman ? 0.18 : 0.172, woman ? 0.165 : 0.155, 0.17, 20)} material={bottomMat} position={[0, 0.9, 0]} scale={[1, 1, 0.66]} />
            <mesh geometry={geo('sphere', 0.1, 14, 10)} material={bottomMat} position={[0, 0.82, 0]} scale={[1.3, 0.7, 0.9]} />
          </group>
        )}
        {bt === 'skirt' && <mesh geometry={geo('cyl', 0.18, 0.28, 0.44, 22)} material={bottomMat} position={[0, 0.8, 0]} scale={[1, 1, 0.8]} />}
        {bt === 'dress' && <mesh geometry={geo('cyl', 0.18, 0.33, 0.66, 22)} material={bottomMat} position={[0, 0.72, 0]} scale={[1, 1, 0.8]} />}
        {longSkirt && <mesh geometry={geo('cyl', 0.18, bt === 'maxi' ? 0.3 : 0.24, 0.9, 22)} material={bottomMat} position={[0, 0.55, 0]} scale={[1, 1, 0.8]} />}
        {robe && <mesh geometry={geo('cyl', 0.2, 0.3, 1.32, 22)} material={topMat} position={[0, 0.78, 0]} scale={[1, 1, 0.8]} />}
        {/* torso */}
        <mesh geometry={torsoGeo(woman)} material={topMat} position={[0, 0.9, 0]} scale={[sw / 0.4, 1, 0.64]} />
        {woman && (
          <group position={[0, 1.28, 0.06]}>
            <mesh geometry={geo('sphere', 0.07, 16, 12)} material={topMat} position={[-0.068, 0, 0]} scale={[1, 0.9, 0.75]} />
            <mesh geometry={geo('sphere', 0.07, 16, 12)} material={topMat} position={[0.068, 0, 0]} scale={[1, 0.9, 0.75]} />
          </group>
        )}
        {/* collar / neckline */}
        {sleeves !== 'none' && !robe && <mesh geometry={geo('torus', 0.075, 0.018, 8, 18)} material={topMat} position={[0, 1.515, 0]} rotation={[Math.PI / 2, 0, 0]} />}
        {outfit.extra === 'tie' && (
          <group position={[0, 1.33, 0.118]}>
            <mesh geometry={geo('box', 0.11, 0.28, 0.01)} material={WHITE} />
            <mesh geometry={geo('box', 0.045, 0.24, 0.012)} material={mat('#b91c1c')} position={[0, -0.03, 0.004]} />
          </group>
        )}
        {/* arms: shoulder → elbow → hand */}
        {[[-1, armL, elbowL], [1, armR, elbowR]].map(([s, ref, elbow]) => (
          <group key={s} ref={ref} position={[s * (sw / 2 + 0.035), 1.46, 0]}>
            <mesh geometry={geo('sphere', 0.06, 14, 10)} material={sleeves === 'none' ? skin : topMat} position={[-s * 0.012, -0.01, 0]} />
            <mesh geometry={geo('capsule', 0.058, 0.2, 6, 12)} material={sleeves === 'none' ? skin : topMat} position={[0, -0.13, 0]} />
            {sleeves === 'short' && <mesh geometry={geo('cyl', 0.062, 0.064, 0.08, 14, 1, true)} material={topMat} position={[0, -0.16, 0]} />}
            <group ref={elbow} position={[0, -0.27, 0]}>
              <mesh geometry={geo('capsule', 0.05, 0.2, 6, 12)} material={sleeves === 'long' ? topMat : skin} position={[0, -0.12, 0]} />
              <group position={[0, -0.29, 0.005]}>
                <mesh geometry={geo('sphere', 0.052, 12, 10)} material={skin} scale={[0.85, 1.2, 0.6]} />
                <mesh geometry={geo('capsule', 0.016, 0.04, 4, 6)} material={skin} position={[-s * 0.03, 0.0, 0.03]} rotation={[0.4, 0, -s * 0.5]} />
              </group>
            </group>
          </group>
        ))}
        {/* neck + head */}
        <mesh geometry={geo('cyl', 0.058, 0.066, 0.13, 12)} material={skin} position={[0, 1.55, 0]} />
        <group ref={head} position={[0, 1.71, 0]}>
          <mesh geometry={geo('sphere', 0.162, 24, 18)} material={skin} scale={[0.95, 1.12, 1]} />
          {/* jaw / chin */}
          <mesh geometry={geo('sphere', 0.12, 18, 12)} material={skin} position={[0, -0.075, 0.04]} scale={[1, 0.85, 0.95]} />
          {/* ears */}
          {[-1, 1].map((s) => <mesh key={s} geometry={geo('sphere', 0.04, 10, 8)} material={skin} position={[s * 0.152, 0, 0]} scale={[0.5, 1, 0.75]} />)}
          {/* eyes (blink by scaling the group) */}
          <group ref={eyes} position={[0, 0.03, 0]}>
            {[-1, 1].map((s) => (
              <group key={s} position={[s * 0.058, 0, 0.135]}>
                <mesh geometry={geo('sphere', 0.03, 12, 10)} material={EYE_W} scale={[1.15, 0.8, 0.55]} />
                <mesh geometry={geo('sphere', 0.017, 10, 8)} material={IRIS} position={[0, 0, 0.013]} />
                <mesh geometry={geo('sphere', 0.008, 6, 6)} material={EYE} position={[0, 0, 0.022]} />
              </group>
            ))}
          </group>
          {/* brows */}
          {[-1, 1].map((s) => <mesh key={`b${s}`} geometry={geo('box', 0.055, 0.012, 0.012)} material={brow} position={[s * 0.058, 0.075, 0.15]} rotation={[0, 0, s * -0.12]} />)}
          {/* nose + lips */}
          <mesh geometry={geo('sphere', 0.028, 10, 8)} material={skin} position={[0, -0.02, 0.165]} scale={[1.2, 0.9, 0.8]} />
          <mesh geometry={geo('capsule', 0.012, 0.045, 4, 8)} material={LIP} position={[0, -0.078, 0.148]} rotation={[0, 0, Math.PI / 2]} />
          {hijab ? (
            <group>
              <mesh geometry={geo('sphere', 0.19, 18, 14, Math.PI / 2 + 0.95, Math.PI * 2 - 1.9)} material={topMat} position={[0, 0.01, -0.01]} scale={[1, 1.1, 1]} />
              <mesh geometry={geo('sphere', 0.192, 18, 8, 0, Math.PI * 2, 0, 1.05)} material={topMat} position={[0, 0.01, -0.01]} scale={[1, 1.1, 1]} />
              <mesh geometry={geo('cyl', 0.15, 0.24, 0.24, 16, 1, true)} material={topMat} position={[0, -0.2, -0.01]} />
            </group>
          ) : kofia ? (
            <mesh geometry={geo('cyl', 0.165, 0.17, 0.12, 16)} material={outfit.top === '#f8fafc' ? WHITE : mat('#f8fafc')} position={[0, 0.12, 0]} />
          ) : (
            <Hair style={a.hair} color={hairColor} />
          )}
        </group>
      </group>
    </group>
  );
}

export function avatarEmoji(appearance) {
  if (!appearance) return '🙂';
  return appearance.body === 'woman' ? ['👩🏿', '👩🏾', '👩🏾', '👩🏽', '👩🏽', '👩🏽'][appearance.skin] || '👩🏾' : ['👨🏿', '👨🏾', '👨🏾', '👨🏽', '👨🏽', '👨🏽'][appearance.skin] || '👨🏾';
}
