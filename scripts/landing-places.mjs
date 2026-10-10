// Regenerates landing/places.json (the "real Bongo spots" accordion and job carousel) from shared/world.js.
// Run after adding or renaming places: node scripts/landing-places.mjs
import fs from 'node:fs';
import { PLACES } from '../shared/world.js';

const AREAS = [
  ['kariakoo', 'Kariakoo & Posta', ['Kariakoo', 'Posta', 'Kisutu', 'Upanga']],
  ['masaki', 'Masaki & Oysterbay', ['Masaki', 'Oysterbay', 'Coco Beach', 'Msasani']],
  ['sinza', 'Sinza & Mlimani', ['Sinza', 'Mlimani', 'Kijitonyama', 'Manzese', 'Ubungo', 'Mbezi', 'Kunduchi']],
  ['temeke', 'Temeke & Kigamboni', ['Temeke', 'Kigamboni', 'Mbagala']],
  ['znz', 'Zanzibar', ['Stone Town', 'Kizimbani', 'Jozani', 'Michamvi', 'Unguja', 'Nungwi', 'Kendwa']],
  ['aru', 'Arusha', ['Arusha CBD', 'Arusha', 'Ngorongoro · Serengeti', 'Kilimanjaro']],
];
const out = AREAS.map(([id, name, districts]) => ({
  id, sw: name, en: name,
  places: PLACES.filter((p) => districts.includes(p.district)).map((p) => {
    const j = p.jobs?.[0];
    return { i: p.icon, n: p.name, ne: p.nameEn || p.name, d: p.district, b: p.blurb, be: p.blurbEn || p.blurb, job: j ? { t: j.title, te: j.titleEn, pay: j.pay, secs: j.secs } : null };
  }),
}));
const missing = PLACES.filter((p) => !AREAS.some(([, , d]) => d.includes(p.district)));
if (missing.length) console.warn('Not in any landing area:', missing.map((p) => `${p.id} (${p.district})`).join(', '));
fs.writeFileSync(new URL('../landing/places.json', import.meta.url), JSON.stringify(out));
console.log(`landing/places.json: ${out.reduce((n, a) => n + a.places.length, 0)} places`);
