// Banknotes thrown in a venue: they flutter down onto the floor; tap one to pick it up.
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../store.js';
import { api } from '../api.js';
import { sfx } from '../audio.js';
import { L } from '../i18n.js';

// TZS-style notes: 1,000 blue, 5,000 brown, 10,000 red.
const NOTE_COL = { 1000: ['#2563eb', '#bfdbfe'], 5000: ['#92400e', '#fde68a'], 10000: ['#b91c1c', '#fecaca'] };
const noteMats = new Map();
function noteMat(value) {
  const v = value >= 10000 ? 10000 : value >= 5000 ? 5000 : 1000;
  if (noteMats.has(v)) return noteMats.get(v);
  const [dark, light] = NOTE_COL[v];
  const c = document.createElement('canvas');
  c.width = 128; c.height = 64;
  const x = c.getContext('2d');
  x.fillStyle = light; x.fillRect(0, 0, 128, 64);
  x.fillStyle = dark; x.fillRect(0, 0, 128, 10); x.fillRect(0, 54, 128, 10);
  x.strokeStyle = dark; x.lineWidth = 3; x.strokeRect(4, 4, 120, 56);
  x.fillStyle = dark; x.font = "800 22px 'Plus Jakarta Sans', system-ui"; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(v.toLocaleString(), 82, 33);
  x.beginPath(); x.arc(28, 32, 13, 0, Math.PI * 2); x.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide });
  noteMats.set(v, m);
  return m;
}
const noteGeo = new THREE.PlaneGeometry(0.5, 0.25);

function Note({ d, placeId }) {
  const ref = useRef();
  const fall = 2.2;
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    const t = (Date.now() - d.at) / 1000 - d.delay;
    if (t < 0) { g.visible = false; return; }
    g.visible = true;
    const k = Math.min(1, t / fall);
    g.position.set(d.x + Math.sin(t * 3 + d.x) * (1 - k) * 0.6, 6 - k * 5.95, d.z + Math.cos(t * 2.4 + d.z) * (1 - k) * 0.4);
    if (k < 1) g.rotation.set(Math.sin(t * 5 + d.z) * 1.2, t * 2, Math.cos(t * 4) * 0.8);
    else g.rotation.set(-Math.PI / 2, d.x, 0);
  });
  const grab = async (e) => {
    e.stopPropagation();
    useStore.setState((s) => ({ rain: s.rain.filter((x) => x.id !== d.id) }));
    try {
      const r = await api(`/venues/${placeId}/pick`, { method: 'POST', body: { id: d.id } });
      if (r.value) { sfx('cash'); useStore.getState().toast(L(`💸 Umeokota TSh ${r.value.toLocaleString()}!`, `💸 You grabbed TSh ${r.value.toLocaleString()}!`)); }
      if (r.me) useStore.setState({ me: r.me });
    } catch {}
  };
  return (
    <group ref={ref} onClick={grab}>
      <mesh geometry={noteGeo} material={noteMat(d.value)} />
      {/* bigger invisible hit area so notes are easy to tap on a phone */}
      <mesh visible={false}><boxGeometry args={[0.9, 0.5, 0.9]} /></mesh>
    </group>
  );
}

export function MoneyRain({ placeId }) {
  const rain = useStore((s) => s.rain);
  const mine = useMemo(() => rain.filter((d) => d.placeId === placeId && d.expires > Date.now()), [rain, placeId]);
  return mine.map((d) => <Note key={d.id} d={d} placeId={placeId} />);
}
