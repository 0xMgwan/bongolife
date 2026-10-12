// Post-processing for capable devices: soft ambient occlusion (contact shadows where walls meet
// the ground, under balconies and between buildings) and a bloom that makes lit windows, neon and
// street lamps glow — gentle by day, stronger at night.
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { EffectComposer, N8AO, Bloom } from '@react-three/postprocessing';
import { cityNight } from './CityDecor.jsx';

export function Effects({ interiorDark = false }) {
  const bloom = useRef();
  useFrame(() => {
    const b = bloom.current;
    if (!b) return;
    const night = interiorDark ? 1 : cityNight.v;
    b.intensity = 0.25 + night * 0.95;
    b.luminanceMaterial.threshold = 0.82 - night * 0.22;
  });
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <N8AO halfRes aoRadius={3.2} intensity={2.2} distanceFalloff={1.2} quality="performance" />
      <Bloom ref={bloom} mipmapBlur intensity={0.3} luminanceThreshold={0.82} luminanceSmoothing={0.2} radius={0.7} />
    </EffectComposer>
  );
}
