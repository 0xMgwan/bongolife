import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { placeById, WATER, BEACHES, gameClock, vehicleById } from '@shared/world.js';
import { local } from '../net.js';
import { setVenueMusic, setAmbience } from '../audio.js';

// Venues that play music, with how far it carries (world units).
// Tanzanian sound: 1245 & bars play Bongo Flava, Mbagala plays Singeli, Stone Town plays Taarab.
const VENUES = [
  { id: 'club', style: 'bongoflava', radius: 48 },
  { id: 'lounge', style: 'amapiano', radius: 32 },
  { id: 'bar', style: 'bongoflava', radius: 30 },
  { id: 'studio', style: 'bongoflava', radius: 22 },
  { id: 'singeli', style: 'singeli', radius: 50 },
  { id: 'stonetown', style: 'taarab', radius: 26 },
  { id: 'forodhani', style: 'taarab', radius: 24 },
  { id: 'kendwa', style: 'amapiano', radius: 40 },
];
// Places whose interior plays a different style than its scene's default.
const PLACE_MUSIC = { club: 'bongoflava', lounge: 'amapiano', singeli: 'singeli', kendwa: 'amapiano', stonetown: 'taarab', forodhani: 'taarab', 'zn-hotel': 'taarab', bar: 'bongoflava', studio: 'bongoflava' };
const DANCING = new Set(['cheza', 'vip', 'mzunguko', 'sundowner']);

function rectDist(r, x, z) {
  const dx = Math.max(r.x1 - x, 0, x - r.x2);
  const dz = Math.max(r.z1 - z, 0, z - r.z2);
  return Math.hypot(dx, dz);
}
function placeDist(p, x, z) {
  const [px, pz] = p.pos;
  const [w, d] = p.size;
  return rectDist({ x1: px - w / 2, x2: px + w / 2, z1: pz - d / 2, z2: pz + d / 2 }, x, z);
}

/** Maps the player's surroundings to music + ambience, a few times per second. */
const SCENE_MUSIC = {
  club: ['bongoflava', 1], lounge: ['chill', 1], bar: ['bongoflava', 0.5], studio: ['bongoflava', 1], cinema: ['chill', 0.25],
  concert: ['bongoflava', 1], grill: ['bongoflava', 0.55], rooftop: ['amapiano', 0.9], ngoma: ['bongo', 0.7], waterpark: ['bongo', 0.4],
  dhow: ['chill', 0.5], salon: ['bongo', 0.4], spa: ['chill', 0.35],
};

export function AudioDriver({ me, scene, placeId, party }) {
  const acc = useRef(0);
  const vehicle = me.vehicles?.find((v) => v.id === me.activeVehicle);
  const speed = vehicle ? vehicleById[vehicle.model]?.speed || 1 : 0;
  const busy = me.busy && me.busy.endsAt > Date.now() ? me.busy : null;
  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < 0.25) return;
    acc.current = 0;
    const { x, z } = local;
    if (scene) {
      const radio = scene === 'home' && busy?.id === 'burudika';
      let [style, level] = party ? ['amapiano', 1] : radio ? ['bongoflava', 0.8] : SCENE_MUSIC[scene] || [null, 0];
      if (placeId && PLACE_MUSIC[placeId] && style) style = PLACE_MUSIC[placeId];
      setVenueMusic(style, level, placeId || scene);
      setAmbience({ city: 0, waves: scene === 'beach' ? 1 : 0, engine: 0 });
      return;
    }

    // Loudest venue wins; being on the dance floor maxes it out.
    let best = { style: null, level: 0 };
    for (const v of VENUES) {
      const d = placeDist(placeById[v.id], x, z);
      let level = Math.max(0, 1 - d / v.radius) ** 1.6;
      if (busy && busy.placeId === v.id) level = DANCING.has(busy.id) ? 1 : Math.max(level, 0.75);
      if (level > best.level) best = { style: v.style, level, venue: v.id };
    }
    if (busy?.placeId === 'studio' && busy.id === 'rekodi') best = { style: 'bongoflava', level: 1, venue: 'studio' };
    setVenueMusic(best.style, best.level, best.venue);

    const water = Math.min(...WATER.map((r) => rectDist(r, x, z)), ...BEACHES.map((r) => rectDist(r, x, z) + 4));
    const waves = Math.max(0, 1 - water / 40);
    const { hour } = gameClock();
    const night = hour < 6 || hour >= 20;
    setAmbience({
      city: Math.max(0.15, (night ? 0.45 : 0.75) - waves * 0.5 - best.level * 0.4),
      waves,
      engine: vehicle && vehicle.model !== 'baiskeli' && local.moving ? 1 : vehicle && vehicle.model !== 'baiskeli' ? 0.35 : 0,
      engineSpeed: local.moving ? speed / 3 : 0,
    });
  });
  return null;
}
