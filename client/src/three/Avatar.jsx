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
      return <mesh geometry={geo('sphere', 0.25, 12, 10)} material={m} position={[0, 0.08, -0.02]} />;
    case 'kibanio':
      return (
        <group>
          <mesh geometry={geo('sphere', 0.172, 12, 10, 0, Math.PI * 2, 0, Math.PI / 1.8)} material={m} position={[0, 0.01, -0.005]} />
          <mesh geometry={geo('sphere', 0.1, 10, 8)} material={m} position={[0, 0.2, -0.06]} />
        </group>
      );
    case 'mkia':
      return (
        <group>
          <mesh geometry={geo('sphere', 0.172, 12, 10, 0, Math.PI * 2, 0, Math.PI / 1.8)} material={m} position={[0, 0.01, -0.005]} />
          <mesh geometry={geo('cyl', 0.05, 0.03, 0.34, 6)} material={m} position={[0, -0.08, -0.2]} rotation={[0.35, 0, 0]} />
        </group>
      );
    case 'misuko':
    case 'rasta': {
      const len = style === 'rasta' ? 0.42 : 0.34;
      const n = style === 'rasta' ? 9 : 11;
      return (
        <group>
          <mesh geometry={geo('sphere', 0.175, 12, 10, 0, Math.PI * 2, 0, Math.PI / 1.7)} material={m} position={[0, 0.01, -0.005]} />
          {Array.from({ length: n }, (_, i) => {
            const a = -Math.PI * 0.5 + (i / (n - 1)) * Math.PI; // 0 = back of the head
            return <mesh key={i} geometry={geo('cyl', 0.022, 0.018, len, 5)} material={m} position={[Math.sin(a) * 0.155, -len / 2 + 0.05, -Math.cos(a) * 0.155]} />;
          })}
        </group>
      );
    }
    case 'kiduku':
      return <mesh geometry={geo('sphere', 0.168, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2.3)} material={m} position={[0, 0.012, 0]} />;
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

/**
 * Low-poly Mbongo. `motion` is a ref: { moving, mode: 'walk'|'sit'|'dance'|'idle', speed }.
 */
export function Avatar({ appearance, motion, scale = 1 }) {
  const a = appearance || { body: 'man', skin: 2, hair: 'kiduku', hairColor: 0, outfit: 'tshirt' };
  const outfit = outfitById[a.outfit] || outfitById.tshirt;
  const woman = a.body === 'woman';
  const skin = mat(SKIN_TONES[a.skin] || SKIN_TONES[2]);
  const hairColor = HAIR_COLORS[a.hairColor] || HAIR_COLORS[0];
  const topMat = fabricMat(outfit.pattern || 'plain', outfit.top);
  const bottomMat = fabricMat(outfit.bottomPattern || 'plain', outfit.bottom);
  const bt = outfit.bottomType || 'pants';
  const robe = bt === 'robe';
  const longSkirt = bt === 'maxi' || bt === 'wrap';
  const bareLegs = bt !== 'pants'; // legs show skin (or are hidden under fabric)
  const sleeves = outfit.sleeves || 'short';
  const hijab = outfit.head === 'hijab';
  const kofia = outfit.head === 'kofia' && a.hair !== 'kilemba';
  const sw = woman ? 0.36 : 0.42; // shoulder width

  const legL = useRef();
  const legR = useRef();
  const armL = useRef();
  const armR = useRef();
  const body = useRef();
  const phase = useRef(Math.random() * 6);

  useFrame((_, dt) => {
    const mo = motion?.current || {};
    const mode = mo.mode || (mo.moving ? 'walk' : 'idle');
    const rate = { walk: 9 * (mo.speed || 1), dance: 7, cheer: 6, swim: 5, lift: 3, sing: 4, dj: 7, eat: 2.5 }[mode] || 2;
    phase.current += dt * rate;
    const p = phase.current;
    let legL_ = 0, legR_ = 0, armL_ = 0, armR_ = 0, zL = 0.06, zR = -0.06, bob = 0, tilt = 0, yaw = null;
    switch (mode) {
      case 'walk':
        legL_ = Math.sin(p) * 0.6; legR_ = -legL_;
        armL_ = -Math.sin(p) * 0.5; armR_ = -armL_;
        bob = Math.abs(Math.cos(p)) * 0.04;
        break;
      case 'dance':
        armL_ = -(2.2 + Math.sin(p * 2) * 0.3) + Math.sin(p) * 0.4; armR_ = -(1.9 + Math.sin(p * 2) * 0.3) - Math.sin(p) * 0.4;
        zL = 0.3; zR = -0.3;
        bob = Math.abs(Math.sin(p)) * 0.12;
        legL_ = Math.sin(p) * 0.2; legR_ = -legL_;
        yaw = Math.sin(p * 0.5) * 0.5;
        break;
      case 'cheer': {
        // Seated fan: arms shoot up every few seconds.
        const up = Math.sin(p * 0.35) > 0.55;
        legL_ = legR_ = -1.4;
        armL_ = up ? -2.8 + Math.sin(p * 3) * 0.25 : -0.9; armR_ = up ? -2.8 - Math.sin(p * 3) * 0.25 : -0.9;
        zL = up ? 0.25 : 0.06; zR = up ? -0.25 : -0.06;
        bob = -0.38 + (up ? Math.abs(Math.sin(p * 3)) * 0.06 : 0);
        break;
      }
      case 'sit':
        legL_ = legR_ = -1.4;
        armL_ = armR_ = -0.9;
        bob = -0.38;
        break;
      case 'eat':
        legL_ = legR_ = -1.4;
        armL_ = -0.9;
        armR_ = -1.5 - Math.max(0, Math.sin(p)) * 0.9; // spoon to mouth
        bob = -0.38;
        break;
      case 'sleep':
        tilt = -Math.PI / 2;
        armL_ = armR_ = 0.1;
        bob = 0.12 + Math.sin(p) * 0.01;
        break;
      case 'swim':
        tilt = 1.25; // face down, head forward
        armL_ = Math.sin(p) * 2.6; armR_ = Math.sin(p + Math.PI) * 2.6;
        legL_ = Math.sin(p * 2) * 0.35; legR_ = -legL_;
        bob = -0.9 + Math.sin(p * 2) * 0.05;
        break;
      case 'lift':
        armL_ = armR_ = -(1.6 + Math.sin(p) * 1.3);
        bob = Math.sin(p) * 0.02;
        break;
      case 'sing':
        armR_ = -2.0 + Math.sin(p) * 0.08; // mic hand
        armL_ = -0.6 - Math.max(0, Math.sin(p * 0.5)) * 1.2; zL = 0.3;
        bob = Math.abs(Math.sin(p)) * 0.04;
        yaw = Math.sin(p * 0.5) * 0.25;
        break;
      case 'dj':
        armL_ = -1.25 + Math.sin(p) * 0.15; armR_ = -1.25 - Math.sin(p) * 0.15;
        bob = Math.abs(Math.sin(p)) * 0.06;
        break;
      default:
        armL_ = Math.sin(p) * 0.03; armR_ = -armL_;
    }
    if (legL.current) {
      legL.current.rotation.x = legL_;
      legR.current.rotation.x = legR_;
      armL.current.rotation.x = armL_;
      armR.current.rotation.x = armR_;
      armL.current.rotation.z = zL;
      armR.current.rotation.z = zR;
      body.current.position.y = bob;
      body.current.rotation.x = tilt;
      if (yaw !== null) body.current.rotation.y = yaw;
      else body.current.rotation.y *= 0.9;
    }
  });

  const legMat = bareLegs ? skin : bottomMat;
  const shoeMat = woman && (bt === 'dress' || bt === 'skirt' || bt === 'maxi') ? mat('#7c2d12') : SHOE;
  return (
    <group scale={scale}>
      <mesh geometry={geo('circle', 0.42, 16)} material={shadowMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} />
      <group ref={body}>
        {/* legs */}
        {[[-1, legL], [1, legR]].map(([s, ref]) => (
          <group key={s} ref={ref} position={[s * 0.1, 0.9, 0]}>
            <mesh geometry={geo('capsule', 0.085, 0.66, 4, 10)} material={legMat} position={[0, -0.42, 0]} />
            {bt === 'shorts' && <mesh geometry={geo('capsule', 0.094, 0.2, 4, 10)} material={bottomMat} position={[0, -0.16, 0]} />}
            <mesh geometry={geo('capsule', 0.07, 0.14, 4, 8)} material={shoeMat} position={[0, -0.84, 0.06]} rotation={[Math.PI / 2, 0, 0]} />
          </group>
        ))}
        {/* hips */}
        {(bt === 'pants' || bt === 'shorts') && <mesh geometry={geo('cyl', 0.19, woman ? 0.22 : 0.2, 0.22, 14)} material={bottomMat} position={[0, 0.9, 0]} scale={[1, 1, 0.7]} />}
        {bt === 'skirt' && <mesh geometry={geo('cyl', 0.19, 0.29, 0.44, 16)} material={bottomMat} position={[0, 0.8, 0]} scale={[1, 1, 0.8]} />}
        {bt === 'dress' && <mesh geometry={geo('cyl', 0.19, 0.34, 0.66, 16)} material={bottomMat} position={[0, 0.72, 0]} scale={[1, 1, 0.8]} />}
        {longSkirt && <mesh geometry={geo('cyl', 0.19, bt === 'maxi' ? 0.31 : 0.25, 0.9, 16)} material={bottomMat} position={[0, 0.55, 0]} scale={[1, 1, 0.8]} />}
        {robe && <mesh geometry={geo('cyl', 0.2, 0.3, 1.32, 16)} material={topMat} position={[0, 0.78, 0]} scale={[1, 1, 0.8]} />}
        {/* torso */}
        <mesh geometry={geo('cyl', sw / 2, woman ? sw / 2 - 0.05 : sw / 2 - 0.03, 0.58, 16)} material={topMat} position={[0, 1.2, 0]} scale={[1, 1, 0.62]} />
        <mesh geometry={geo('sphere', sw / 2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2)} material={topMat} position={[0, 1.49, 0]} scale={[1, 0.28, 0.62]} />
        {woman && (
          <group position={[0, 1.27, 0.08]}>
            <mesh geometry={geo('sphere', 0.085, 10, 8)} material={topMat} position={[-0.075, 0, 0]} />
            <mesh geometry={geo('sphere', 0.085, 10, 8)} material={topMat} position={[0.075, 0, 0]} />
          </group>
        )}
        {outfit.extra === 'tie' && (
          <group position={[0, 1.32, 0.115]}>
            <mesh geometry={geo('box', 0.11, 0.28, 0.01)} material={WHITE} />
            <mesh geometry={geo('box', 0.045, 0.24, 0.012)} material={mat('#b91c1c')} position={[0, -0.03, 0.004]} />
          </group>
        )}
        {/* arms */}
        {[[-1, armL], [1, armR]].map(([s, ref]) => (
          <group key={s} ref={ref} position={[s * (sw / 2 + 0.05), 1.45, 0]}>
            <mesh geometry={geo('capsule', 0.065, 0.16, 4, 10)} material={sleeves === 'none' ? skin : topMat} position={[0, -0.1, 0]} />
            <mesh geometry={geo('capsule', 0.055, 0.42, 4, 10)} material={sleeves === 'long' ? topMat : skin} position={[0, -0.34, 0]} />
            <mesh geometry={geo('sphere', 0.06, 8, 8)} material={skin} position={[0, -0.6, 0]} />
          </group>
        ))}
        {/* head */}
        <mesh geometry={geo('cyl', 0.065, 0.07, 0.12, 8)} material={skin} position={[0, 1.53, 0]} />
        <group position={[0, 1.7, 0]}>
          <mesh geometry={geo('sphere', 0.165, 14, 12)} material={skin} scale={[1, 1.12, 1]} />
          {[-1, 1].map((s) => (
            <group key={s} position={[s * 0.058, 0.02, 0.138]}>
              <mesh geometry={geo('sphere', 0.032, 8, 8)} material={WHITE} scale={[1, 0.8, 0.6]} />
              <mesh geometry={geo('sphere', 0.019, 6, 6)} material={EYE} position={[0, 0, 0.016]} />
            </group>
          ))}
          <mesh geometry={geo('box', 0.07, 0.015, 0.01)} material={mat('#5b2a1a')} position={[0, -0.07, 0.155]} />
          {hijab ? (
            // Headscarf: wraps the head with the face left open, draping to the shoulders.
            <group>
              <mesh geometry={geo('sphere', 0.19, 18, 14, Math.PI / 2 + 0.95, Math.PI * 2 - 1.9)} material={topMat} position={[0, 0.01, -0.01]} scale={[1, 1.1, 1]} />
              <mesh geometry={geo('sphere', 0.192, 18, 8, 0, Math.PI * 2, 0, 1.05)} material={topMat} position={[0, 0.01, -0.01]} scale={[1, 1.1, 1]} />
              <mesh geometry={geo('cyl', 0.15, 0.24, 0.24, 16, 1, true)} material={topMat} position={[0, -0.2, -0.01]} />
            </group>
          ) : kofia ? (
            <mesh geometry={geo('cyl', 0.165, 0.17, 0.12, 12)} material={outfit.top === '#f8fafc' ? WHITE : mat('#f8fafc')} position={[0, 0.12, 0]} />
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
