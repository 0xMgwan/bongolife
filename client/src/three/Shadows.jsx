// Soft real-time shadows for small spaces (homes, interiors). Only active when the
// renderer has shadows on (not on "Low" graphics), so phones that struggle skip it.
import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

export function Shadows({ children, light = [5, 11, 6], size = 13, intensity = 0.85, color = '#fff7ed' }) {
  const group = useRef();
  const { gl } = useThree();
  const on = gl.shadowMap.enabled;
  const target = useMemo(() => new THREE.Object3D(), []);
  const acc = useRef(1);
  useFrame((_, dt) => {
    if (!on || !group.current) return;
    acc.current += dt;
    if (acc.current < 0.8) return; // re-tag new meshes now and then
    acc.current = 0;
    group.current.traverse((o) => {
      if (!o.isMesh || o.userData.noShadow) return;
      const m = o.material;
      const unlit = m && (m.isMeshBasicMaterial || m.transparent);
      o.castShadow = !unlit;
      o.receiveShadow = !unlit;
    });
  });
  return (
    <group ref={group}>
      {on && (
        <>
          <primitive object={target} />
          <directionalLight
            castShadow
            target={target}
            position={light}
            color={color}
            intensity={intensity}
            shadow-mapSize={[1024, 1024]}
            shadow-bias={-0.0006}
            shadow-normalBias={0.02}
            shadow-camera-left={-size}
            shadow-camera-right={size}
            shadow-camera-top={size}
            shadow-camera-bottom={-size}
            shadow-camera-near={1}
            shadow-camera-far={40}
          />
        </>
      )}
      {children}
    </group>
  );
}
