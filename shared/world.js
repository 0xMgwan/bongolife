// Bongo Life — shared world catalog (used by both server and client).
// Coordinates: x grows east (towards the Indian Ocean), z grows south.

export const GAME = {
  name: 'Bongo Life',
  city: 'Dar es Salaam',
  startMoney: 50_000,
  // The game runs on real Dar es Salaam time (EAT, UTC+3, no daylight saving).
  utcOffsetMinutes: 180,
  // Real TZS paid on top-up → in-game TSh credited.
  defaultTopupRate: 100,
  minTopupTzs: 1_000,
  maxTopupTzs: 1_000_000,
  incomeCapHours: 24,
};

export const WORLD_SIZE = 300; // square, centred on origin

// ---------------------------------------------------------------- terrain
export const WATER = [
  { id: 'ocean', x1: 95, z1: -160, x2: 170, z2: 170 },
  { id: 'channel', x1: 35, z1: 42, x2: 95, z2: 54 },
];
// Land that sits on top of the ocean rectangle.
export const LAND_PATCHES = [{ id: 'masaki', x1: 95, z1: -120, x2: 132, z2: -48 }];
// Walkable crossings over water.
export const BRIDGES = [{ id: 'nyerere-bridge', x1: 77, z1: 40, x2: 83, z2: 56, name: 'Daraja la Nyerere' }];
export const BEACHES = [
  { id: 'coco', x1: 84, z1: -46, x2: 95, z2: -8 },
  { id: 'kigamboni', x1: 86, z1: 56, x2: 95, z2: 140 },
  { id: 'masaki-beach', x1: 127, z1: -120, x2: 132, z2: -48 },
];

const inRect = (r, x, z) => x >= r.x1 && x <= r.x2 && z >= r.z1 && z <= r.z2;

// ---------------------------------------------------------------- cities
// Each city is its own map far away from the others in the same world space.
export const CITIES = [
  { id: 'dar', name: 'Dar es Salaam', icon: '🏙️', center: [0, 0], half: 150 },
  {
    id: 'znz', name: 'Zanzibar', icon: '🏝️', center: [1600, 0], half: 125, ground: '#b9d58f',
    // land (local coords): the island plus its beaches; everything else is the Indian Ocean
    land: [{ x1: -70, z1: -110, x2: 110, z2: 110 }, { x1: -78, z1: -60, x2: -70, z2: 70 }, { x1: -20, z1: -118, x2: 90, z2: -110 }, { x1: 110, z1: -60, x2: 118, z2: 60 }],
    beaches: [{ x1: -78, z1: -60, x2: -70, z2: 70 }, { x1: -20, z1: -118, x2: 90, z2: -110 }, { x1: 110, z1: -60, x2: 118, z2: 60 }],
  },
  { id: 'aru', name: 'Arusha', icon: '⛰️', center: [-1600, 0], half: 120, ground: '#a9c48c' },
];
export const cityById = Object.fromEntries(CITIES.map((c) => [c.id, c]));
export const cityAt = (x, z) => CITIES.find((c) => Math.abs(x - c.center[0]) <= c.half && Math.abs(z - c.center[1]) <= c.half) || null;
const Z = (x, z) => [1600 + x, z];
const A = (x, z) => [-1600 + x, z];

export function isWater(x, z) {
  const c = cityAt(x, z);
  if (!c) return true;
  if (c.id !== 'dar') {
    if (!c.land) return false;
    const lx = x - c.center[0];
    const lz = z - c.center[1];
    return !c.land.some((r) => inRect(r, lx, lz));
  }
  const half = WORLD_SIZE / 2;
  if (Math.abs(x) > half || Math.abs(z) > half) return true;
  if (BRIDGES.some((b) => inRect(b, x, z))) return false;
  if (LAND_PATCHES.some((p) => inRect(p, x, z))) return false;
  return WATER.some((w) => inRect(w, x, z));
}

// ------------------------------------------------------------------ roads
// Horizontal roads run along z, vertical along x. [x1,z1,x2,z2,width,name]
export const ROADS = [
  [-148, 0, 92, 0, 7, 'Barabara ya Morogoro'],
  [-148, -45, 92, -45, 6, 'Barabara ya Shekilango'],
  [-148, -90, 128, -90, 6, 'Barabara ya Bagamoyo'],
  [-148, 35, 92, 35, 6, 'Barabara ya Nyerere'],
  [-110, -148, -110, 148, 6, 'Barabara ya Mandela'],
  [-55, -148, -55, 148, 6, 'Barabara ya Kawawa'],
  [-15, -148, -15, 148, 6, 'Barabara ya Uhuru'],
  [30, -148, 30, 38, 6, 'Barabara ya Ali Hassan Mwinyi'],
  [75, -90, 75, 38, 6, 'Barabara ya Ocean'],
  [80, 35, 80, 148, 6, 'Barabara ya Kigamboni'],
  // Zanzibar
  [...Z(-62, 0), ...Z(105, 0), 6, 'Barabara ya Michamvi'],
  [...Z(-50, -100), ...Z(-50, 100), 6, 'Barabara ya Malawi'],
  [...Z(30, -100), ...Z(30, 100), 6, 'Barabara ya Nungwi'],
  [...Z(-50, 60), ...Z(105, 60), 6, 'Barabara ya Uwanja wa Ndege'],
  [...Z(-50, -70), ...Z(30, -70), 6, 'Barabara ya Bububu'],
  // Arusha
  [...A(-110, 0), ...A(110, 0), 6, 'Barabara ya Sokoine'],
  [...A(0, -110), ...A(0, 110), 6, 'Barabara ya Boma'],
  [...A(-110, -60), ...A(110, -60), 6, 'Barabara ya Nairobi'],
  [...A(-60, -110), ...A(-60, 110), 6, 'Barabara ya Njiro'],
  [...A(60, -110), ...A(60, 110), 6, 'Barabara ya Moshi'],
  [...A(-110, 60), ...A(110, 60), 6, 'Barabara ya Dodoma'],
];

export function onRoad(x, z, pad = 0) {
  return ROADS.some(([x1, z1, x2, z2, w]) => {
    const h = w / 2 + pad;
    return x >= Math.min(x1, x2) - h && x <= Math.max(x1, x2) + h && z >= Math.min(z1, z2) - h && z <= Math.max(z1, z2) + h;
  });
}

// --------------------------------------------------------------- districts
export const DISTRICTS = [
  { id: 'stonetown', name: 'Stone Town', pos: Z(-45, -45) },
  { id: 'nungwi', name: 'Nungwi', pos: Z(55, -92) },
  { id: 'michamvi', name: 'Michamvi', pos: Z(85, 15) },
  { id: 'arusha-cbd', name: 'Arusha CBD', pos: A(18, -15) },
  { id: 'njiro', name: 'Njiro', pos: A(-80, 20) },
  { id: 'kariakoo', name: 'Kariakoo', pos: [7, 18] },
  { id: 'posta', name: 'Posta', pos: [52, 0] },
  { id: 'sinza', name: 'Sinza', pos: [-82, -66] },
  { id: 'mlimani', name: 'Mlimani', pos: [-35, -70] },
  { id: 'manzese', name: 'Manzese', pos: [-35, -22] },
  { id: 'masaki', name: 'Masaki', pos: [112, -85] },
  { id: 'coco', name: 'Coco Beach', pos: [89, -28] },
  { id: 'ubungo', name: 'Ubungo', pos: [-128, 0] },
  { id: 'kigamboni', name: 'Kigamboni', pos: [62, 95] },
  { id: 'mbezi', name: 'Mbezi', pos: [-88, -118] },
  { id: 'temeke', name: 'Temeke', pos: [0, 80] },
];

export const SPAWNS = {
  manzese: { name: 'Manzese', blurb: 'Kitaa cha wachakarikaji. Gesti iko jirani.', pos: [-35, -12] },
  kariakoo: { name: 'Kariakoo', blurb: 'Soko kuu — kila mchongo uko hapa.', pos: [7, 4] },
  sinza: { name: 'Sinza', blurb: 'Starehe zote. Club na bar kila kona.', pos: [-80, -50] },
  kigamboni: { name: 'Kigamboni', blurb: 'Upepo wa bahari, viwanja vya ufukweni.', pos: [80, 70] },
};

// ------------------------------------------------------------------ needs
export const NEEDS = [
  { id: 'hunger', name: 'Njaa', icon: '🍛', color: '#f59e0b', decay: 0.4 },
  { id: 'energy', name: 'Nguvu', icon: '⚡', color: '#3b82f6', decay: 0.28 },
  { id: 'fun', name: 'Raha', icon: '🎉', color: '#ec4899', decay: 0.35 },
  { id: 'hygiene', name: 'Usafi', icon: '🚿', color: '#06b6d4', decay: 0.25 },
  { id: 'social', name: 'Jamii', icon: '💬', color: '#8b5cf6', decay: 0.3 },
];
export const NEED_TICK_SECONDS = 10; // decay values above are per tick

export function moodOf(needs) {
  const vals = NEEDS.map((n) => needs?.[n.id] ?? 50);
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}
export function moodLabel(m) {
  if (m >= 80) return { text: 'Mzuka kibao', emoji: '😎' };
  if (m >= 60) return { text: 'Poa tu', emoji: '🙂' };
  if (m >= 40) return { text: 'Kawaida', emoji: '😐' };
  if (m >= 20) return { text: 'Hali tete', emoji: '😩' };
  return { text: 'Hoi kabisa', emoji: '🥴' };
}

// ----------------------------------------------------------------- traits
export const TRAITS = [
  { id: 'mchakarikaji', name: 'Mchakarikaji', emoji: '💪', perk: 'Mshahara +10% kwenye kila shifti' },
  { id: 'mtoko', name: 'Mtu wa Mtoko', emoji: '🪩', perk: 'Raha inapungua polepole' },
  { id: 'msomi', name: 'Msomi', emoji: '📚', perk: 'Kozi za chuo zinaisha haraka' },
  { id: 'mjanja', name: 'Mjanja wa Mjini', emoji: '🧠', perk: 'Punguzo 5% kwenye manunuzi' },
  { id: 'msanii', name: 'Msanii', emoji: '🎤', perk: 'Umaarufu mara mbili studio' },
];

// --------------------------------------------------------------- avatars
export const SKIN_TONES = ['#3b2219', '#4a2c20', '#5c3826', '#704532', '#8a5a3c', '#a26f4c'];
export const HAIR_COLORS = ['#111111', '#2b1a12', '#5a3a22', '#8b5a2b', '#c9a227', '#7c2d12'];
export const HAIRSTYLES = [
  { id: 'misuko', name: 'Misuko' },
  { id: 'afro', name: 'Afro' },
  { id: 'kibanio', name: 'Kibanio' },
  { id: 'mkia', name: 'Mkia' },
  { id: 'rasta', name: 'Rasta' },
  { id: 'kiduku', name: 'Kiduku' },
  { id: 'kilemba', name: 'Kilemba' },
  { id: 'kofia', name: 'Kofia' },
  { id: 'kipara', name: 'Kipara' },
];
// Outfits are built from garment pieces the avatar knows how to draw:
//   bottom:  pants | shorts | skirt | dress | maxi | wrap | robe (full-length from the shoulders)
//   sleeves: short | long | none
//   head:    kofia | hijab (optional)   extra: tie (optional)
//   pattern / bottomPattern: plain | kitenge | kanga | stripes | jersey | shuka | dots | check
//   for:     all | woman | man  — which body the outfit is offered to in the creator
export const OUTFITS = [
  // ---- free · everyone
  { id: 'tshirt', name: 'T-shirt na Jeans', nameEn: 'T-shirt & Jeans', price: 0, for: 'all', top: '#f8fafc', bottom: '#1e3a8a', bottomType: 'pants', sleeves: 'short' },
  { id: 'shati', name: 'Shati la Kitenge', nameEn: 'Kitenge Shirt', price: 0, for: 'all', top: '#dc2626', pattern: 'kitenge', bottom: '#111827', bottomType: 'pants', sleeves: 'short' },
  { id: 'polo', name: 'Polo na Khaki', nameEn: 'Polo & Khakis', price: 0, for: 'all', top: '#0f766e', bottom: '#c8b48a', bottomType: 'pants', sleeves: 'short' },
  { id: 'tracksuit', name: 'Tracksuit', nameEn: 'Tracksuit', price: 0, for: 'all', top: '#1d4ed8', pattern: 'stripes', bottom: '#1e3a8a', bottomType: 'pants', sleeves: 'long' },
  { id: 'ufukweni', name: 'Vesti na Bukta', nameEn: 'Vest & Shorts', price: 0, for: 'all', top: '#f97316', bottom: '#0ea5e9', bottomType: 'shorts', sleeves: 'none' },
  { id: 'shuka', name: 'Shuka la Kimasai', nameEn: 'Maasai Shuka', price: 0, for: 'all', top: '#dc2626', pattern: 'shuka', bottom: '#dc2626', bottomType: 'robe', sleeves: 'none' },
  { id: 'jeans-nyeusi', name: 'T-shirt Nyeusi na Jeans', nameEn: 'Black Tee & Jeans', price: 0, for: 'all', top: '#111827', bottom: '#475569', bottomType: 'pants', sleeves: 'short' },
  // ---- free · women
  { id: 'kitenge', name: 'Gauni la Kitenge', nameEn: 'Kitenge Dress', price: 0, for: 'woman', top: '#f59e0b', pattern: 'kitenge', bottom: '#f59e0b', bottomPattern: 'kitenge', bottomType: 'dress', sleeves: 'short' },
  { id: 'kanga', name: 'Kanga', nameEn: 'Kanga', price: 0, for: 'woman', top: '#16a34a', pattern: 'kanga', bottom: '#16a34a', bottomPattern: 'kanga', bottomType: 'dress', sleeves: 'none' },
  { id: 'sketi-kitenge', name: 'Blauzi na Sketi ya Kitenge', nameEn: 'Blouse & Kitenge Skirt', price: 0, for: 'woman', top: '#f8fafc', bottom: '#7c3aed', bottomPattern: 'kitenge', bottomType: 'skirt', sleeves: 'short' },
  { id: 'blauzi-jeans', name: 'Blauzi na Jeans', nameEn: 'Blouse & Jeans', price: 0, for: 'woman', top: '#f472b6', bottom: '#1e40af', bottomType: 'pants', sleeves: 'short' },
  { id: 'maxi', name: 'Gauni Refu la Madoa', nameEn: 'Polka Maxi Dress', price: 0, for: 'woman', top: '#0ea5e9', pattern: 'dots', bottom: '#0ea5e9', bottomPattern: 'dots', bottomType: 'maxi', sleeves: 'none' },
  { id: 'buibui', name: 'Buibui na Hijabu', nameEn: 'Buibui & Hijab', price: 0, for: 'woman', top: '#111827', bottom: '#111827', bottomType: 'robe', sleeves: 'long', head: 'hijab' },
  { id: 'ofisi-sketi', name: 'Suti ya Ofisini (Sketi)', nameEn: 'Office Skirt Suit', price: 0, for: 'woman', top: '#1e3a8a', bottom: '#1e3a8a', bottomType: 'skirt', sleeves: 'long' },
  // ---- free · men
  { id: 'kanzu', name: 'Kanzu na Kofia', nameEn: 'Kanzu & Kofia', price: 0, for: 'man', top: '#f8fafc', bottom: '#f8fafc', bottomType: 'robe', sleeves: 'long', head: 'kofia' },
  { id: 'kaunda', name: 'Suti ya Kaunda', nameEn: 'Kaunda Suit', price: 0, for: 'man', top: '#a8916b', bottom: '#a8916b', bottomType: 'pants', sleeves: 'short' },
  { id: 'kikoi', name: 'Shati na Kikoi', nameEn: 'Shirt & Kikoi', price: 0, for: 'man', top: '#e0f2fe', bottom: '#0f766e', bottomPattern: 'stripes', bottomType: 'wrap', sleeves: 'short' },
  { id: 'shati-check', name: 'Shati la Cheki na Kadeti', nameEn: 'Check Shirt & Chinos', price: 0, for: 'man', top: '#b91c1c', pattern: 'check', bottom: '#57534e', bottomType: 'pants', sleeves: 'long' },
  // ---- shops
  { id: 'jezi-simba', name: 'Jezi ya Simba', nameEn: 'Simba Jersey', price: 35_000, for: 'all', top: '#dc2626', pattern: 'jersey', bottom: '#f8fafc', bottomType: 'shorts', sleeves: 'short' },
  { id: 'jezi-yanga', name: 'Jezi ya Yanga', nameEn: 'Yanga Jersey', price: 35_000, for: 'all', top: '#facc15', pattern: 'jersey', bottom: '#15803d', bottomType: 'shorts', sleeves: 'short' },
  { id: 'gym', name: 'Nguo za Gym', nameEn: 'Gym Wear', price: 25_000, for: 'all', top: '#22c55e', pattern: 'stripes', bottom: '#111827', bottomType: 'shorts', sleeves: 'none' },
  { id: 'reflekta', name: 'Jaketi la Bodaboda', nameEn: 'Bodaboda Reflector Jacket', price: 45_000, for: 'all', top: '#f97316', pattern: 'stripes', bottom: '#1f2937', bottomType: 'pants', sleeves: 'long' },
  { id: 'scrubs', name: 'Sare za Hospitali', nameEn: 'Hospital Scrubs', price: 30_000, for: 'all', top: '#14b8a6', bottom: '#0f766e', bottomType: 'pants', sleeves: 'short' },
  { id: 'hoodie', name: 'Hoodie ya Bongo Flava', nameEn: 'Bongo Flava Hoodie', price: 60_000, for: 'all', top: '#111827', pattern: 'stripes', bottom: '#374151', bottomType: 'pants', sleeves: 'long' },
  { id: 'jaketi-ngozi', name: 'Jaketi la Ngozi', nameEn: 'Leather Jacket', price: 120_000, for: 'all', top: '#1c1917', bottom: '#1e293b', bottomType: 'pants', sleeves: 'long' },
  { id: 'kanzu-eid', name: 'Kanzu ya Eid', nameEn: 'Eid Kanzu', price: 150_000, for: 'man', top: '#fef3c7', bottom: '#fef3c7', bottomType: 'robe', sleeves: 'long', head: 'kofia' },
  { id: 'gauni-kitenge-refu', name: 'Gauni Refu la Kitenge', nameEn: 'Kitenge Maxi Gown', price: 180_000, for: 'woman', top: '#be123c', pattern: 'kitenge', bottom: '#be123c', bottomPattern: 'kitenge', bottomType: 'maxi', sleeves: 'short' },
  { id: 'suti', name: 'Suti ya Kibosile', nameEn: 'Boss Suit', price: 250_000, for: 'all', top: '#0f172a', bottom: '#0f172a', bottomType: 'pants', sleeves: 'long', extra: 'tie' },
  { id: 'gauni-sendoff', name: 'Gauni la Send-off', nameEn: 'Send-off Gown', price: 400_000, for: 'woman', top: '#a21caf', pattern: 'kitenge', bottom: '#a21caf', bottomPattern: 'kitenge', bottomType: 'maxi', sleeves: 'none' },
];
export const outfitById = Object.fromEntries(OUTFITS.map((o) => [o.id, o]));
export const outfitFits = (o, body) => !o.for || o.for === 'all' || o.for === body;

export function randomAppearance(seed = Math.random()) {
  const r = (n, k = 1) => Math.floor(((seed * 9301 * k + 49297) % 233280) / 233280 * n);
  const body = Math.random() < 0.5 ? 'woman' : 'man';
  const freeOutfits = OUTFITS.filter((o) => o.price === 0 && outfitFits(o, body));
  return {
    body,
    skin: Math.floor(Math.random() * SKIN_TONES.length),
    hair: HAIRSTYLES[Math.floor(Math.random() * HAIRSTYLES.length)].id,
    hairColor: Math.floor(Math.random() * 3),
    outfit: freeOutfits[Math.floor(Math.random() * freeOutfits.length)].id,
    accent: r(6),
  };
}

// --------------------------------------------------------------- vehicles
export const VEHICLES = [
  { id: 'baiskeli', name: 'Baiskeli', kind: 'bike', price: 180_000, speed: 1.5, emoji: '🚲', color: '#0ea5e9' },
  { id: 'bodaboda', name: 'Bodaboda (Boxer)', kind: 'moto', price: 1_800_000, speed: 2.1, emoji: '🏍️', color: '#dc2626' },
  { id: 'bajaji', name: 'Bajaji', kind: 'bajaji', price: 6_500_000, speed: 1.9, emoji: '🛺', color: '#facc15' },
  // `body` picks the 3D shape; `tier` groups the showroom (1 = starter … 6 = supercars).
  { id: 'ist', name: 'Toyota IST', kind: 'car', body: 'hatch', tier: 1, price: 16_000_000, speed: 2.3, emoji: '🚗', color: '#e5e7eb' },
  { id: 'noah', name: 'Toyota Noah', kind: 'van', body: 'van', tier: 2, price: 28_000_000, speed: 2.4, emoji: '🚐', color: '#1f2937' },
  { id: 'crown', name: 'Toyota Crown Athlete', kind: 'car', body: 'sedan', tier: 2, price: 38_000_000, speed: 2.5, emoji: '🚘', color: '#f8fafc' },
  { id: 'harrier', name: 'Toyota Harrier', kind: 'suv', body: 'suv', tier: 3, price: 60_000_000, speed: 2.7, emoji: '🚙', color: '#7f1d1d' },
  { id: 'benz-c', name: 'Mercedes-Benz C200', kind: 'car', body: 'sedan', tier: 3, price: 78_000_000, speed: 2.8, emoji: '🚘', color: '#94a3b8', lux: true },
  { id: 'prado', name: 'Toyota Land Cruiser Prado', kind: 'suv', body: 'suv', tier: 3, price: 95_000_000, speed: 2.8, emoji: '🚙', color: '#f8fafc' },
  { id: 'bmw-x5', name: 'BMW X5', kind: 'suv', body: 'suv', tier: 4, price: 140_000_000, speed: 2.9, emoji: '🚙', color: '#1e3a8a', lux: true },
  { id: 'v8', name: 'Land Cruiser V8', kind: 'suv', body: 'suv-big', tier: 4, price: 170_000_000, speed: 2.9, emoji: '🛻', color: '#111827' },
  { id: 'range', name: 'Range Rover Vogue', kind: 'suv', body: 'suv-big', tier: 4, price: 280_000_000, speed: 3.0, emoji: '🚙', color: '#14532d', lux: true },
  { id: 'benz-s', name: 'Mercedes-Benz S-Class', kind: 'car', body: 'luxury', tier: 5, price: 320_000_000, speed: 3.0, emoji: '🚘', color: '#0f172a', lux: true },
  { id: 'porsche', name: 'Porsche 911 Carrera', kind: 'car', body: 'sports', tier: 5, price: 380_000_000, speed: 3.4, emoji: '🏎️', color: '#facc15', lux: true },
  { id: 'gwagon', name: 'Mercedes-AMG G63 (G-Wagon)', kind: 'suv', body: 'boxy', tier: 5, price: 450_000_000, speed: 3.1, emoji: '🚙', color: '#111827', lux: true },
  { id: 'urus', name: 'Lamborghini Urus', kind: 'suv', body: 'suv-sport', tier: 6, price: 650_000_000, speed: 3.4, emoji: '🏎️', color: '#f97316', lux: true },
  { id: 'aventador', name: 'Lamborghini Aventador', kind: 'car', body: 'sports', tier: 6, price: 950_000_000, speed: 3.7, emoji: '🏎️', color: '#84cc16', lux: true },
  { id: 'cullinan', name: 'Rolls-Royce Cullinan', kind: 'suv', body: 'suv-big', tier: 6, price: 1_400_000_000, speed: 3.1, emoji: '👑', color: '#f5f5f4', lux: true },
];
export const vehicleById = Object.fromEntries(VEHICLES.map((v) => [v.id, v]));
export const VEHICLE_COLORS = ['#e5e7eb', '#f5f5f4', '#94a3b8', '#111827', '#0f172a', '#dc2626', '#1d4ed8', '#1e3a8a', '#16a34a', '#14532d', '#84cc16', '#facc15', '#f97316', '#7c3aed'];

// ------------------------------------------------------------ buildings
export const BUILDINGS = [
  { id: 'banda', name: 'Nyumba ya Kawaida', price: 6_000_000, incomePerHour: 0, energyBonus: 10, color: '#fde68a', floors: 1 },
  { id: 'kisasa', name: 'Nyumba ya Kisasa', price: 28_000_000, incomePerHour: 0, energyBonus: 25, color: '#e0f2fe', floors: 2 },
  { id: 'ghorofa', name: 'Ghorofa la Kupangisha', price: 85_000_000, incomePerHour: 320_000, energyBonus: 15, color: '#e2e8f0', floors: 6 },
  { id: 'villa', name: 'Villa ya Kifahari', price: 160_000_000, incomePerHour: 0, energyBonus: 40, color: '#fef3c7', floors: 2, pool: true },
  { id: 'hoteli', name: 'Hoteli ya Ufukweni', price: 320_000_000, incomePerHour: 1_300_000, energyBonus: 30, color: '#f0fdfa', floors: 4, pool: true },
];
export const buildingById = Object.fromEntries(BUILDINGS.map((b) => [b.id, b]));

// ------------------------------------------------------------------ plots
function plotGrid(prefix, area, xs, zs, price, size = 10) {
  const out = [];
  let i = 1;
  for (const z of zs) for (const x of xs) out.push({ id: `${prefix}-${i}`, area, name: `Kiwanja ${area} #${i++}`, pos: [x, z], size, price });
  return out;
}
export const PLOTS = [
  ...plotGrid('kig', 'Kigamboni', [44, 57, 70], [66, 80, 94, 108, 122], 22_000_000),
  ...plotGrid('msk', 'Masaki', [103, 116], [-80, -66], 95_000_000, 11),
  ...plotGrid('mbz', 'Mbezi', [-100, -86, -72], [-108, -122], 14_000_000),
  ...plotGrid('knd', 'Kinondoni', [0, 14], [-108, -122], 18_000_000),
  ...plotGrid('tmk', 'Temeke', [-40, -28], [52, 66, 80], 9_000_000),
];
export const plotById = Object.fromEntries(PLOTS.map((p) => [p.id, p]));
export const ALLOWED_BUILDINGS = {
  Kigamboni: ['banda', 'kisasa', 'villa', 'hoteli'],
  Masaki: ['kisasa', 'villa', 'ghorofa', 'hoteli'],
  Mbezi: ['banda', 'kisasa', 'ghorofa', 'villa'],
  Kinondoni: ['banda', 'kisasa', 'ghorofa'],
  Temeke: ['banda', 'kisasa', 'ghorofa'],
};

// ----------------------------------------------------------------- places
// activity: { id, name, cost, secs, effects: {need: delta}, fame?, special? }
// job:      { id, title, titles: [...promotions], secs, pay, energy, requires? }
export const PLACES = [
  {
    id: 'gesti', name: 'Chumba cha Kupanga', district: 'Manzese', type: 'gesti', icon: '🛏️', pos: [-35, -24], size: [12, 9], h: 6, color: '#fca5a5',
    blurb: 'Chumba chako cha kupanga. Lala, oga, pika — bure kabisa.',
    activities: [
      { id: 'lala', name: 'Lala usingizi', cost: 0, secs: 30, effects: { energy: 70, hunger: -6 }, emoji: '😴' },
      { id: 'oga', name: 'Oga', cost: 0, secs: 10, effects: { hygiene: 80 }, emoji: '🚿' },
      { id: 'pika', name: 'Pika ugali na mboga', cost: 2_000, secs: 15, effects: { hunger: 45, fun: 5 }, emoji: '🍲' },
    ],
  },
  {
    id: 'mamantilie', name: 'Genge la Mama Ntilie', district: 'Kariakoo', type: 'food', icon: '🍛', pos: [-3, -14], size: [8, 7], h: 4, color: '#fb923c',
    blurb: 'Chakula cha bei poa, ladha ya nyumbani.',
    business: { price: 8_000_000, incomePerHour: 60_000 },
    activities: [
      { id: 'chipsi', name: 'Chipsi Mayai', cost: 3_000, secs: 6, effects: { hunger: 35, fun: 5 }, emoji: '🍳' },
      { id: 'walimaharage', name: 'Wali Maharage', cost: 2_500, secs: 6, effects: { hunger: 40 }, emoji: '🍚' },
      { id: 'ugalisamaki', name: 'Ugali Samaki', cost: 6_000, secs: 8, effects: { hunger: 60, fun: 5 }, emoji: '🐟' },
      { id: 'chai', name: 'Chai na Maandazi', cost: 1_500, secs: 4, effects: { hunger: 15, energy: 8 }, emoji: '☕' },
    ],
    jobs: [{ id: 'msaidizi', title: 'Msaidizi wa Mama Ntilie', titles: ['Mosha vyombo', 'Mpishi msaidizi', 'Mpishi mkuu', 'Meneja wa genge'], secs: 35, pay: 11_000, energy: 8 }],
  },
  {
    id: 'kariakoo', name: 'Soko la Kariakoo', district: 'Kariakoo', type: 'market', icon: '🧺', pos: [7, 18], size: [20, 15], h: 7, color: '#fbbf24',
    blurb: 'Soko kubwa Afrika Mashariki. Machinga, wauzaji na kila mchongo.',
    business: { price: 25_000_000, incomePerHour: 180_000, label: 'Duka la Jumla' },
    activities: [
      { id: 'zunguka', name: 'Zunguka sokoni', cost: 0, secs: 12, effects: { fun: 10, social: 15, energy: -5 }, emoji: '🛍️' },
      { id: 'mishkaki', name: 'Mishkaki ya Kariakoo', cost: 5_000, secs: 6, effects: { hunger: 40, fun: 8 }, emoji: '🍢' },
    ],
    jobs: [{ id: 'machinga', title: 'Machinga', titles: ['Machinga', 'Muuzaji mzoefu', 'Mwenye kibanda', 'Dalali wa Kariakoo', 'Mfanyabiashara'], secs: 30, pay: 8_000, energy: 7 }],
    shop: 'outfits',
  },
  {
    id: 'fashion', name: 'Kariakoo Fashion', district: 'Kariakoo', type: 'shop', icon: '👗', pos: [18, -15], size: [10, 8], h: 6, color: '#f472b6',
    blurb: 'Jezi, suti, magauni ya send-off — pendeza mtaani.',
    shop: 'outfits', activities: [],
  },
  {
    id: 'bank', name: 'NMB Bank', district: 'Posta', type: 'bank', icon: '🏦', pos: [44, 14], size: [12, 12], h: 20, color: '#94a3b8',
    blurb: 'Weka pesa kwenye wallet yako kwa M-Pesa, Tigo Pesa au Airtel Money.',
    shop: 'topup',
    activities: [],
    jobs: [{ id: 'teller', title: 'Teller wa Benki', titles: ['Teller', 'Afisa Mikopo', 'Meneja wa Tawi', 'Mkurugenzi'], secs: 60, pay: 40_000, energy: 10, requires: { elimu: 1 } }],
  },
  {
    id: 'fishmarket', name: 'Soko la Samaki Feri', district: 'Posta', type: 'fish', icon: '🐟', pos: [62, 20], size: [12, 9], h: 5, color: '#5eead4',
    blurb: 'Samaki fresh kutoka baharini kila asubuhi.',
    activities: [{ id: 'samakichoma', name: 'Samaki wa kuchoma', cost: 8_000, secs: 8, effects: { hunger: 65, fun: 10 }, emoji: '🐠' }],
    jobs: [{ id: 'mvuvi', title: 'Mvuvi', titles: ['Mvuvi', 'Nahodha wa ngalawa', 'Mmiliki wa mashua', 'Tajiri wa samaki'], secs: 50, pay: 18_000, energy: 12 }],
  },
  {
    id: 'techhub', name: 'Dar Tech Hub', district: 'Posta', type: 'office', icon: '💻', pos: [44, -22], size: [12, 12], h: 16, color: '#86efac',
    blurb: 'Startups, coders na mawazo makubwa ya Bongo.',
    activities: [{ id: 'hackathon', name: 'Shiriki hackathon', cost: 0, secs: 25, effects: { social: 25, fun: 10, energy: -15 }, emoji: '🧑‍💻', fame: 1 }],
    jobs: [{ id: 'developer', title: 'Developer', titles: ['Junior Dev', 'Developer', 'Senior Dev', 'CTO', 'Founder'], secs: 80, pay: 85_000, energy: 14, requires: { elimu: 2 } }],
  },
  {
    id: 'posta', name: 'Posta Towers', district: 'Posta', type: 'tower', icon: '🏢', pos: [62, -22], size: [12, 14], h: 38, color: '#bae6fd',
    blurb: 'Ofisi za makampuni makubwa. Kazi ya ofisini, AC na tie.',
    activities: [],
    jobs: [{ id: 'karani', title: 'Karani wa Ofisi', titles: ['Karani', 'Afisa', 'Meneja', 'Mkurugenzi Mtendaji'], secs: 60, pay: 30_000, energy: 10 }],
  },
  {
    id: 'ferry', name: 'Kivukoni Feri', district: 'Posta', type: 'ferry', icon: '⛴️', pos: [66, 38], size: [12, 5], h: 3, color: '#cbd5e1',
    blurb: 'Vuka kwenda Kigamboni kwa pantoni.',
    activities: [{ id: 'vuka', name: 'Panda feri kwenda Kigamboni', cost: 500, secs: 5, effects: { fun: 4 }, emoji: '⛴️', special: { teleport: [62, 60] } }],
  },
  {
    id: 'ferrykig', name: 'Feri ya Kigamboni', district: 'Kigamboni', type: 'ferry', icon: '⛴️', pos: [62, 58], size: [12, 5], h: 3, color: '#cbd5e1',
    blurb: 'Rudi mjini kwa pantoni.',
    activities: [{ id: 'rudi', name: 'Panda feri kwenda Posta', cost: 500, secs: 5, effects: { fun: 4 }, emoji: '⛴️', special: { teleport: [66, 31] } }],
  },
  {
    id: 'coco', name: 'Coco Beach', district: 'Coco Beach', type: 'beach', icon: '🏖️', pos: [89, -28], size: [10, 34], h: 0, color: '#fde68a',
    blurb: 'Mihogo ya kuchoma, madafu na upepo wa bahari.',
    activities: [
      { id: 'ogelea', name: 'Ogelea baharini', cost: 0, secs: 15, effects: { fun: 25, hygiene: 10, energy: -10 }, emoji: '🏊' },
      { id: 'mihogo', name: 'Mihogo ya kuchoma', cost: 1_500, secs: 5, effects: { hunger: 25, fun: 5 }, emoji: '🍠' },
      { id: 'madafu', name: 'Madafu', cost: 1_000, secs: 4, effects: { hunger: 10, energy: 10 }, emoji: '🥥' },
      { id: 'piga-stori', name: 'Piga stori na washkaji', cost: 0, secs: 12, effects: { social: 30, fun: 10 }, emoji: '🗣️' },
    ],
  },
  {
    id: 'mall', name: 'Mlimani City', district: 'Mlimani', type: 'mall', icon: '🛒', pos: [-35, -66], size: [24, 16], h: 10, color: '#c4b5fd',
    blurb: 'Mall, sinema, food court — mtoko wa kishua.',
    shop: 'outfits',
    activities: [
      { id: 'sinema', name: 'Tazama filamu', cost: 12_000, secs: 20, effects: { fun: 40, social: 10 }, emoji: '🎬' },
      { id: 'burger', name: 'Burger na juisi', cost: 15_000, secs: 6, effects: { hunger: 55, fun: 10 }, emoji: '🍔' },
      { id: 'window', name: 'Window shopping', cost: 0, secs: 10, effects: { fun: 12, social: 8, energy: -4 }, emoji: '🛍️' },
    ],
    jobs: [{ id: 'cashier', title: 'Cashier wa Supermarket', titles: ['Cashier', 'Supervisor', 'Store Manager'], secs: 40, pay: 15_000, energy: 8 }],
  },
  {
    id: 'gym', name: 'Gym ya Mlimani', district: 'Mlimani', type: 'gym', icon: '🏋️', pos: [5, -62], size: [10, 8], h: 6, color: '#a3e635',
    blurb: 'Tunisha misuli, kata kitambi.',
    activities: [{ id: 'mazoezi', name: 'Fanya mazoezi', cost: 5_000, secs: 20, effects: { fun: 15, energy: -18, hygiene: -15, social: 8 }, emoji: '💪' }],
    jobs: [{ id: 'trainer', title: 'Personal Trainer', titles: ['Trainer', 'Senior Trainer', 'Coach'], secs: 45, pay: 22_000, energy: 14 }],
  },
  {
    id: 'chuo', name: 'Chuo Kikuu cha Dar', district: 'Mlimani', type: 'campus', icon: '🎓', pos: [-35, -112], size: [20, 12], h: 10, color: '#fdba74',
    blurb: 'Soma kozi upate elimu — inafungua kazi za benki na tech.',
    activities: [
      { id: 'kozi', name: 'Soma kozi (Elimu +1)', cost: 120_000, secs: 60, effects: { energy: -25, fun: -5 }, emoji: '📖', special: { elimu: 1 } },
      { id: 'maktaba', name: 'Jisomee maktaba', cost: 0, secs: 15, effects: { energy: -5, social: -2, fun: 3 }, emoji: '📚' },
    ],
  },
  {
    id: 'club', name: '1245 Club', district: 'Sinza', type: 'club', icon: '🪩', pos: [-92, -64], size: [13, 12], h: 9, color: '#312e81',
    blurb: 'Klabu ya usiku — Bongo Flava, Amapiano na Singeli mpaka asubuhi.',
    business: { price: 220_000_000, incomePerHour: 1_600_000 },
    activities: [
      { id: 'cheza', name: 'Ingia ucheze', cost: 10_000, secs: 20, effects: { fun: 40, social: 20, energy: -15, hygiene: -8 }, emoji: '💃' },
      { id: 'mzunguko', name: 'Nunua mzunguko kwa washkaji', cost: 30_000, secs: 8, effects: { social: 40, fun: 15 }, emoji: '🥂', fame: 1 },
      { id: 'vip', name: 'Meza ya VIP', cost: 180_000, secs: 25, effects: { fun: 70, social: 50, energy: -12 }, emoji: '🍾', fame: 3 },
    ],
    jobs: [{ id: 'dj', title: 'DJ', titles: ['DJ chipukizi', 'Resident DJ', 'DJ wa Elements', 'DJ Bingwa'], secs: 55, pay: 32_000, energy: 12 }],
  },
  {
    id: 'bar', name: 'Bar ya Kona', district: 'Sinza', type: 'bar', icon: '🍻', pos: [-70, -60], size: [9, 8], h: 5, color: '#b45309',
    blurb: 'Nyama choma, mpira kwenye TV na stori za mtaani.',
    business: { price: 40_000_000, incomePerHour: 280_000 },
    activities: [
      { id: 'nyamachoma', name: 'Nyama choma', cost: 12_000, secs: 10, effects: { hunger: 60, social: 15, fun: 10 }, emoji: '🍖' },
      { id: 'soda', name: 'Kunywa soda na washkaji', cost: 2_000, secs: 8, effects: { social: 20, fun: 10 }, emoji: '🥤' },
      { id: 'mpira', name: 'Angalia mpira', cost: 0, secs: 15, effects: { fun: 25, social: 15 }, emoji: '⚽' },
    ],
    jobs: [{ id: 'mhudumu', title: 'Mhudumu wa Bar', titles: ['Mhudumu', 'Bartender', 'Meneja wa Bar'], secs: 35, pay: 12_000, energy: 9 }],
  },
  {
    id: 'studio', name: 'Studio ya Bongo Flava', district: 'Sinza', type: 'studio', icon: '🎤', pos: [-72, -78], size: [9, 8], h: 6, color: '#f43f5e',
    blurb: 'Rekodi ngoma yako — kesho unaweza kuwa staa.',
    activities: [
      { id: 'rekodi', name: 'Rekodi wimbo', cost: 50_000, secs: 30, effects: { fun: 30, energy: -12 }, emoji: '🎶', fame: 5 },
      { id: 'video', name: 'Shuti video ya wimbo', cost: 400_000, secs: 45, effects: { fun: 40, social: 30, energy: -20 }, emoji: '🎥', fame: 18 },
    ],
    jobs: [{ id: 'msanii', title: 'Msanii', titles: ['Msanii chipukizi', 'Msanii wa mtaa', 'Staa wa Bongo Flava', 'Legend'], secs: 55, pay: 25_000, energy: 12, fameBonus: true }],
  },
  {
    id: 'stendi', name: 'Stendi ya Magufuli', district: 'Ubungo', type: 'terminal', icon: '🚌', pos: [-130, 16], size: [16, 14], h: 6, color: '#60a5fa',
    blurb: 'Daladala na mabasi ya mikoani. Konda anakuita!',
    activities: [{ id: 'kijiweni', name: 'Kaa kijiweni', cost: 0, secs: 12, effects: { social: 22, fun: 6 }, emoji: '🪑' }],
    jobs: [
      { id: 'konda', title: 'Konda wa Daladala', titles: ['Konda', 'Dereva wa daladala', 'Mmiliki wa daladala'], secs: 40, pay: 14_000, energy: 9 },
      { id: 'bodaboda', title: 'Dereva wa Bodaboda', titles: ['Boda', 'Boda mzoefu', 'Bosi wa kijiwe'], secs: 40, pay: 24_000, energy: 9, requires: { vehicle: ['bodaboda'] } },
      { id: 'taxi', title: 'Dereva wa Taxi Mtandao', titles: ['Dereva', 'Dereva nyota 5', 'Mmiliki wa fleet'], secs: 55, pay: 45_000, energy: 10, requires: { vehicle: VEHICLES.filter((v) => ['car', 'van', 'suv'].includes(v.kind)).map((v) => v.id) } },
    ],
  },
  {
    id: 'yadi', name: 'Yadi ya Magari', district: 'Ubungo', type: 'yard', icon: '🚗', pos: [-130, -22], size: [16, 13], h: 3, color: '#e2e8f0',
    blurb: 'Kuanzia IST, Crown na Prado hadi G-Wagon, Lamborghini na Rolls-Royce. Panda ngazi taratibu!',
    shop: 'vehicles', activities: [],
  },
  {
    id: 'uwanja', name: 'Uwanja wa Benjamin Mkapa', district: 'Temeke', type: 'stadium', icon: '🏟️', pos: [6, 76], size: [30, 22], h: 9, color: '#e5e7eb',
    blurb: 'Dabi ya Kariakoo — Simba vs Yanga!',
    activities: [
      { id: 'dabi', name: 'Tiketi ya Dabi: Simba vs Yanga', cost: 15_000, secs: 30, effects: { fun: 55, social: 35, energy: -10 }, emoji: '⚽' },
      { id: 'kimbia', name: 'Kimbia kwenye track', cost: 0, secs: 15, effects: { fun: 10, energy: -15, hygiene: -12 }, emoji: '🏃' },
    ],
    jobs: [{ id: 'mlinzi', title: 'Mlinzi wa Uwanja', titles: ['Mlinzi', 'Mkuu wa ulinzi'], secs: 45, pay: 16_000, energy: 10 }],
  },
  {
    id: 'masakigrill', name: 'Karambezi Café', district: 'Masaki', type: 'restaurant', icon: '🦞', pos: [106, -104], size: [12, 10], h: 7, color: '#fef3c7',
    blurb: 'Kamba, pweza na machweo ya Sea Cliff, Masaki.',
    activities: [
      { id: 'seafood', name: 'Seafood platter', cost: 45_000, secs: 12, effects: { hunger: 85, fun: 25, social: 10 }, emoji: '🦐' },
      { id: 'date', name: 'Dinner date ya kishua', cost: 120_000, secs: 20, effects: { hunger: 70, fun: 45, social: 45 }, emoji: '🕯️', fame: 2 },
    ],
    jobs: [{ id: 'chef', title: 'Chef', titles: ['Commis chef', 'Sous chef', 'Head chef'], secs: 55, pay: 35_000, energy: 11 }],
  },
  {
    id: 'lounge', name: 'Elements', district: 'Masaki', type: 'lounge', icon: '🍸', pos: [122, -104], size: [10, 10], h: 14, color: '#1e293b',
    blurb: 'Klabu ya mastaa Masaki — DJ kali, VIP na kula bata kwa staili.',
    business: { price: 380_000_000, incomePerHour: 2_400_000 },
    activities: [
      { id: 'sundowner', name: 'Sundowner rooftop', cost: 60_000, secs: 20, effects: { fun: 55, social: 35 }, emoji: '🌅', fame: 2 },
    ],
  },
  {
    id: 'kigbeach', name: 'Kipepeo Beach', district: 'Kigamboni', type: 'beach', icon: '🌴', pos: [90, 100], size: [8, 30], h: 0, color: '#fde68a',
    blurb: 'Fukwe safi za Kigamboni, mbali na kelele za mjini.',
    activities: [
      { id: 'pumzika', name: 'Pumzika ufukweni', cost: 5_000, secs: 20, effects: { energy: 30, fun: 25, hygiene: 5 }, emoji: '🏝️' },
      { id: 'ogelea2', name: 'Ogelea', cost: 0, secs: 15, effects: { fun: 25, hygiene: 12, energy: -8 }, emoji: '🏊' },
    ],
  },
  {
    id: 'hospitali', name: 'Hospitali ya Muhimbili', district: 'Upanga', type: 'hospital', icon: '🏥', pos: [-80, 20], size: [16, 12], h: 12, color: '#f8fafc',
    blurb: 'Matibabu ya dharura na ukaguzi wa afya — saa 24.',
    activities: [
      { id: 'matibabu', name: 'Pata matibabu', cost: 20_000, secs: 25, effects: { energy: 10 }, emoji: '🩺', special: { health: 70, heal: true } },
      { id: 'pima', name: 'Pima afya (checkup)', cost: 5_000, secs: 12, effects: {}, emoji: '🩻', special: { health: 15 } },
      { id: 'pumzika-wodini', name: 'Pumzika wodini', cost: 8_000, secs: 30, effects: { energy: 45 }, emoji: '🛏️', special: { health: 25 } },
    ],
    jobs: [
      { id: 'nesi', title: 'Nesi', titles: ['Nesi', 'Nesi mkuu', 'Msimamizi wa wodi'], secs: 60, pay: 38_000, energy: 12, requires: { elimu: 1 } },
      { id: 'daktari', title: 'Daktari', titles: ['Daktari', 'Daktari bingwa', 'Mkurugenzi wa hospitali'], secs: 80, pay: 120_000, energy: 15, requires: { elimu: 3 } },
    ],
  },
  {
    id: 'airport', name: 'JNIA Airport', district: 'Temeke', type: 'airport', icon: '✈️', pos: [-82, 96], size: [36, 22], h: 8, color: '#cbd5e1',
    blurb: 'Panda ndege — Zanzibar, Arusha, Mwanza, Nairobi hadi Dubai. Safari njema!',
    // `flight` = destination shown on landing; secs is the whole trip (boarding → landing).
    activities: [
      { id: 'zanzibar', name: 'Ruka hadi Zanzibar', cost: 180_000, secs: 80, effects: { fun: 45, social: 15, energy: -8 }, emoji: '🏝️', fame: 2, flight: { dest: 'ZANZIBAR', ground: '#0e7490', land: '#fde68a' } },
      { id: 'arusha', name: 'Ruka hadi Arusha (Safari)', cost: 260_000, secs: 90, effects: { fun: 55, social: 10, energy: -12 }, emoji: '🦒', fame: 3, flight: { dest: 'ARUSHA · KILIMANJARO', ground: '#4d7c0f', land: '#a3e635' } },
      { id: 'mwanza', name: 'Ruka hadi Mwanza', cost: 150_000, secs: 80, effects: { fun: 35, social: 12, energy: -8 }, emoji: '🐟', fame: 1, flight: { dest: 'MWANZA', ground: '#1d4ed8', land: '#86efac' } },
      { id: 'nairobi', name: 'Ruka hadi Nairobi', cost: 420_000, secs: 100, effects: { fun: 50, social: 20, energy: -12 }, emoji: '🇰🇪', fame: 4, flight: { dest: 'NAIROBI', ground: '#65a30d', land: '#d9f99d' } },
      { id: 'dubai', name: 'Ruka hadi Dubai (Business class)', cost: 1_800_000, secs: 120, effects: { fun: 80, social: 25, hygiene: 10, energy: -5 }, emoji: '🏙️', fame: 8, flight: { dest: 'DUBAI', ground: '#d6b77a', land: '#fcd34d' } },
    ],
    jobs: [
      { id: 'mbebaji', title: 'Mbeba mizigo', titles: ['Mbeba mizigo', 'Msimamizi wa mizigo'], secs: 45, pay: 14_000, energy: 10 },
      { id: 'mhudumu-ndege', title: 'Mhudumu wa ndege', titles: ['Mhudumu wa ndege', 'Mhudumu mkuu', 'Purser'], secs: 70, pay: 48_000, energy: 12, requires: { elimu: 1 } },
      { id: 'rubani', title: 'Rubani', titles: ['Rubani msaidizi', 'Rubani', 'Kapteni', 'Kapteni mkuu'], secs: 90, pay: 160_000, energy: 15, requires: { elimu: 3 } },
    ],
  },
  {
    id: 'polisi', name: 'Kituo cha Polisi Oysterbay', district: 'Oysterbay', type: 'police', icon: '🚓', pos: [44, -112], size: [14, 10], h: 8, color: '#1e3a8a',
    blurb: 'Ripoti uhalifu, lipa faini au dhamana — au kaa rumande.',
    activities: [
      { id: 'tembelea', name: 'Tembelea mahabusu', cost: 0, secs: 12, effects: { social: 12 }, emoji: '🫂' },
    ],
    jobs: [{ id: 'askari', title: 'Askari Polisi', titles: ['Konstebo', 'Koplo', 'Sajenti', 'Inspekta', 'Mrakibu'], secs: 60, pay: 26_000, energy: 12 }],
  },
  {
    id: 'mahakama', name: 'Mahakama ya Kisutu', district: 'Kisutu', type: 'court', icon: '⚖️', pos: [14, 50], size: [12, 10], h: 10, color: '#e7e5e4',
    blurb: 'Mahakama ya Hakimu Mkazi Kisutu — kesi zinasikilizwa hapa.',
    activities: [
      { id: 'sikiliza', name: 'Sikiliza kesi', cost: 0, secs: 15, effects: { fun: 10, social: 6 }, emoji: '👀' },
    ],
    jobs: [
      { id: 'karani-mahakama', title: 'Karani wa mahakama', titles: ['Karani', 'Karani mkuu'], secs: 60, pay: 24_000, energy: 8, requires: { elimu: 1 } },
      { id: 'wakili', title: 'Wakili', titles: ['Wakili msaidizi', 'Wakili', 'Wakili mwandamizi', 'Wakili wa Serikali'], secs: 80, pay: 140_000, energy: 14, requires: { elimu: 3 } },
    ],
  },
  {
    id: 'kinyozi', name: 'Kinyozi & Saluni Sinza', district: 'Sinza', type: 'salon', icon: '💈', pos: [-85, -30], size: [10, 8], h: 5, color: '#f9a8d4',
    blurb: 'Kiduku safi, misuko mipya na umbea wa mtaa mzima.',
    business: { price: 12_000_000, incomePerHour: 80_000 },
    activities: [
      { id: 'nyoa', name: 'Nyoa kiduku safi', cost: 3_000, secs: 12, effects: { hygiene: 20, fun: 6 }, emoji: '💈' },
      { id: 'suka', name: 'Suka nywele (misuko/rasta)', cost: 15_000, secs: 25, effects: { hygiene: 15, fun: 12, social: 8 }, emoji: '💇🏾‍♀️' },
      { id: 'kucha', name: 'Manicure & pedicure', cost: 8_000, secs: 14, effects: { hygiene: 18, fun: 8 }, emoji: '💅🏾' },
      { id: 'umbea', name: 'Piga umbea saluni', cost: 0, secs: 10, effects: { social: 24, fun: 8 }, emoji: '🗣️' },
    ],
    jobs: [{ id: 'kinyozi', title: 'Kinyozi', titles: ['Kinyozi chipukizi', 'Kinyozi mzoefu', 'Mmiliki wa saluni'], secs: 45, pay: 15_000, energy: 8 }],
  },
  {
    id: 'nyamachoma', name: 'Nyama Choma Ubungo', district: 'Ubungo', type: 'grill', icon: '🍖', pos: [-130, 62], size: [12, 10], h: 4, color: '#b45309',
    blurb: 'Mbuzi wa kuchoma, ndizi, kachumbari na mpira kwenye TV kubwa.',
    business: { price: 18_000_000, incomePerHour: 110_000 },
    activities: [
      { id: 'kilo', name: 'Kilo ya nyama choma na ndizi', cost: 12_000, secs: 15, effects: { hunger: 55, social: 10, fun: 8 }, emoji: '🍖' },
      { id: 'supu', name: 'Supu ya utumbo', cost: 3_000, secs: 8, effects: { hunger: 25, energy: 10 }, emoji: '🍲' },
      { id: 'mbuzi', name: 'Mbuzi mzima na washkaji', cost: 60_000, secs: 30, effects: { hunger: 60, social: 40, fun: 25 }, emoji: '🐐', fame: 1 },
      { id: 'mpira-tv', name: 'Cheki mpira kwenye TV kubwa', cost: 2_000, secs: 20, effects: { fun: 25, social: 15 }, emoji: '📺' },
    ],
    jobs: [{ id: 'mchoma', title: 'Mchoma nyama', titles: ['Msaidizi wa jiko', 'Mchoma nyama', 'Bingwa wa grill'], secs: 45, pay: 16_000, energy: 10 }],
  },
  {
    id: 'waterpark', name: "Wet 'n' Wild Kunduchi", district: 'Kunduchi', type: 'waterpark', icon: '🌊', pos: [-130, 120], size: [26, 20], h: 7, color: '#38bdf8',
    blurb: 'Slides ndefu, wave pool na lazy river — burudani ya familia nzima.',
    activities: [
      { id: 'slides', name: 'Teleza kwenye slides', cost: 15_000, secs: 20, effects: { fun: 40, hygiene: 10, energy: -12 }, emoji: '🎢' },
      { id: 'wave', name: 'Ogelea kwenye wave pool', cost: 10_000, secs: 18, effects: { fun: 30, hygiene: 10, energy: -10 }, emoji: '🌊' },
      { id: 'lazy', name: 'Lazy river na marafiki', cost: 8_000, secs: 18, effects: { fun: 20, social: 22 }, emoji: '🛟' },
      { id: 'aiskrimu-wp', name: 'Aiskrimu ya Azam', cost: 2_000, secs: 5, effects: { hunger: 10, fun: 8 }, emoji: '🍦' },
    ],
    jobs: [{ id: 'lifeguard', title: 'Mlinzi wa bwawa', titles: ['Lifeguard', 'Lifeguard mkuu'], secs: 50, pay: 20_000, energy: 12 }],
  },
  {
    id: 'makumbusho', name: 'Kijiji cha Makumbusho', district: 'Kijitonyama', type: 'museum', icon: '🥁', pos: [-35, 105], size: [16, 12], h: 5, color: '#d6b77a',
    blurb: 'Nyumba za makabila, ngoma za asili na sanaa ya Tingatinga.',
    activities: [
      { id: 'ngoma', name: 'Cheza ngoma za asili', cost: 4_000, secs: 20, effects: { fun: 30, social: 15, energy: -8 }, emoji: '🥁' },
      { id: 'makabila', name: 'Tembelea nyumba za makabila', cost: 3_000, secs: 15, effects: { fun: 15, social: 5 }, emoji: '🛖' },
      { id: 'tinga', name: 'Darasa la Tingatinga', cost: 20_000, secs: 25, effects: { fun: 20 }, emoji: '🎨', fame: 2 },
      { id: 'mtori', name: 'Kula mtori na ndizi', cost: 4_000, secs: 8, effects: { hunger: 35 }, emoji: '🍌' },
    ],
    jobs: [{ id: 'mpiga-ngoma', title: 'Mpiga ngoma', titles: ['Mpiga ngoma', 'Kiongozi wa kikundi'], secs: 50, pay: 18_000, energy: 12 }],
  },
  {
    id: 'golf', name: 'Gymkhana Golf Club', district: 'Mbezi', type: 'golf', icon: '⛳', pos: [-130, -125], size: [22, 18], h: 4, color: '#4ade80',
    blurb: 'Golf, mabosi na dili kubwa — hapa ndipo pesa inaongea.',
    business: { price: 300_000_000, incomePerHour: 2_000_000 },
    activities: [
      { id: 'golf9', name: 'Cheza mashimo 9', cost: 45_000, secs: 30, effects: { fun: 30, social: 20, energy: -12 }, emoji: '⛳', fame: 1 },
      { id: 'range', name: 'Driving range', cost: 15_000, secs: 15, effects: { fun: 18, energy: -6 }, emoji: '🏌🏾' },
      { id: 'dili', name: 'Piga dili na mabosi', cost: 25_000, secs: 20, effects: { social: 30 }, emoji: '🤝', fame: 2 },
    ],
    jobs: [{ id: 'caddie', title: 'Caddie', titles: ['Caddie', 'Caddie mkuu'], secs: 50, pay: 22_000, energy: 12 }],
  },
  {
    id: 'slipway', name: 'Msasani Slipway', district: 'Msasani', type: 'slipway', icon: '⛵', pos: [88, -70], size: [12, 8], h: 4, color: '#fef3c7',
    blurb: 'Jahazi wakati wa machweo, boti hadi Bongoyo, aiskrimu na soko la sanaa.',
    activities: [
      { id: 'jahazi', name: 'Safari ya jahazi machweo', cost: 35_000, secs: 30, effects: { fun: 40, social: 15 }, emoji: '⛵', fame: 1 },
      { id: 'bongoyo', name: 'Boti hadi Bongoyo + snorkel', cost: 50_000, secs: 35, effects: { fun: 50, hygiene: 10, energy: -15 }, emoji: '🤿', fame: 1 },
      { id: 'aiskrimu', name: 'Aiskrimu ya Slipway', cost: 4_000, secs: 5, effects: { hunger: 10, fun: 10 }, emoji: '🍨' },
      { id: 'sanaa', name: 'Zunguka soko la sanaa', cost: 0, secs: 12, effects: { fun: 10, social: 8 }, emoji: '🛍️' },
    ],
    jobs: [{ id: 'nahodha', title: 'Nahodha wa jahazi', titles: ['Baharia', 'Nahodha', 'Mmiliki wa jahazi'], secs: 60, pay: 30_000, energy: 12 }],
  },
  {
    id: 'singeli', name: 'Uwanja wa Singeli Mbagala', district: 'Mbagala', type: 'stage', icon: '🔊', pos: [10, 125], size: [24, 16], h: 3, color: '#a855f7',
    blurb: 'Singeli kali, MC wanapiga kelele, chipsi mayai na vumbi la Mbagala!',
    activities: [
      { id: 'singeli', name: 'Cheza Singeli', cost: 5_000, secs: 20, effects: { fun: 40, social: 20, energy: -15 }, emoji: '🕺🏾' },
      { id: 'jukwaani', name: 'Panda jukwaani (freestyle)', cost: 0, secs: 20, effects: { fun: 20, energy: -10 }, emoji: '🎤', fame: 3 },
      { id: 'chipsi-mayai', name: 'Chipsi mayai za tamasha', cost: 3_000, secs: 6, effects: { hunger: 35 }, emoji: '🍟' },
    ],
    jobs: [{ id: 'mc', title: 'MC wa Singeli', titles: ['Hype man', 'MC', 'MC bingwa'], secs: 55, pay: 28_000, energy: 12, fameBonus: true }],
  },
  {
    id: 'karting', name: 'Go-Kart Temeke', district: 'Temeke', type: 'karting', icon: '🏎️', pos: [-80, 133], size: [28, 16], h: 2, color: '#f97316',
    blurb: 'Shindana na washkaji kwenye track — mshindi anakula sifa!',
    activities: [
      { id: 'race', name: 'Shindana mizunguko 5', cost: 25_000, secs: 25, effects: { fun: 45, energy: -10 }, emoji: '🏎️', fame: 1 },
      { id: 'grandprix', name: 'Bongo Grand Prix na washkaji', cost: 60_000, secs: 35, effects: { fun: 60, social: 25, energy: -15 }, emoji: '🏁', fame: 2 },
      { id: 'pitstop', name: 'Soda baridi pitstop', cost: 1_500, secs: 4, effects: { hunger: 6, energy: 8 }, emoji: '🥤' },
    ],
    jobs: [{ id: 'fundi', title: 'Fundi wa magari', titles: ['Fundi msaidizi', 'Fundi', 'Mkuu wa pit'], secs: 50, pay: 24_000, energy: 12 }],
  },
  {
    id: 'serena', name: 'Serena Hotel & Spa', district: 'Posta', type: 'hotel', icon: '🏨', pos: [56, -62], size: [14, 10], h: 22, color: '#e2e8f0',
    blurb: 'Massage, pool party ya rooftop, dinner ya kifahari na suite za kulala.',
    business: { price: 500_000_000, incomePerHour: 3_200_000 },
    activities: [
      { id: 'massage', name: 'Massage ya mwili mzima', cost: 40_000, secs: 25, effects: { energy: 40, hygiene: 20, fun: 15 }, emoji: '💆🏾' },
      { id: 'rooftop', name: 'Pool party ya rooftop', cost: 30_000, secs: 25, effects: { fun: 40, social: 30 }, emoji: '🍹', fame: 1 },
      { id: 'dinner', name: 'Dinner ya kifahari', cost: 55_000, secs: 18, effects: { hunger: 70, social: 15, fun: 15 }, emoji: '🍽️' },
      { id: 'suite', name: 'Lala kwenye suite', cost: 120_000, secs: 30, effects: { energy: 90, hygiene: 30, fun: 10 }, emoji: '🛏️' },
    ],
    jobs: [{ id: 'receptionist', title: 'Mpokeaji wageni', titles: ['Receptionist', 'Meneja wa mapokezi', 'Meneja wa hoteli'], secs: 60, pay: 34_000, energy: 10, requires: { elimu: 1 } }],
  },
  // ------------------------------------------------------------- Zanzibar
  {
    id: 'zn-port', name: 'Bandari ya Zanzibar', district: 'Stone Town', type: 'port', icon: '⛴️', pos: Z(-66, 32), size: [8, 12], h: 4, color: '#e2e8f0',
    blurb: 'Boti za Azam kutoka Dar zinatia nanga hapa. Karibu Unguja!',
    activities: [{ id: 'gereza', name: 'Boti hadi Kisiwa cha Changuu (Prison Island)', cost: 30_000, secs: 25, effects: { fun: 30 }, emoji: '🐢', fame: 1 }],
  },
  {
    id: 'forodhani', name: 'Bustani ya Forodhani', district: 'Stone Town', type: 'grill', icon: '🍕', pos: Z(-62, -12), size: [10, 12], h: 3, color: '#fde68a',
    blurb: 'Soko la usiku: Zanzibar pizza, urojo, mishkaki na juisi ya miwa — machweo baharini.',
    activities: [
      { id: 'pizza', name: 'Zanzibar pizza', cost: 5_000, secs: 8, effects: { hunger: 35, fun: 6 }, emoji: '🍕' },
      { id: 'urojo', name: 'Urojo (Zanzibar mix)', cost: 4_000, secs: 8, effects: { hunger: 30, fun: 4 }, emoji: '🥣' },
      { id: 'miwa', name: 'Juisi ya miwa', cost: 2_000, secs: 4, effects: { energy: 12, hunger: 6 }, emoji: '🧃' },
      { id: 'machweo', name: 'Tazama vijana wakiruka baharini', cost: 0, secs: 12, effects: { fun: 16, social: 8 }, emoji: '🌅' },
    ],
    jobs: [{ id: 'mpishi-pizza', title: 'Mpishi wa Zanzibar pizza', titles: ['Mpishi', 'Mpishi mkuu'], secs: 45, pay: 15_000, energy: 9 }],
  },
  {
    id: 'stonetown', name: 'Mji Mkongwe (Stone Town)', district: 'Stone Town', type: 'stonetown', icon: '🏛️', pos: Z(-38, -25), size: [14, 14], h: 9, color: '#f5e6c8',
    blurb: 'Vichochoro, milango ya Kizanzibari, Ngome Kongwe na nyumba ya Freddie Mercury.',
    activities: [
      { id: 'ziara', name: 'Ziara ya Mji Mkongwe', cost: 15_000, secs: 20, effects: { fun: 22, social: 10, energy: -6 }, emoji: '🚶🏾' },
      { id: 'milango', name: 'Picha za milango ya Zanzibar', cost: 0, secs: 12, effects: { fun: 12 }, emoji: '🚪', fame: 1 },
      { id: 'kahawa-baraza', name: 'Kahawa na kashata barazani', cost: 2_000, secs: 8, effects: { energy: 12, social: 12 }, emoji: '☕' },
    ],
    jobs: [{ id: 'mwongoza', title: 'Mwongoza watalii', titles: ['Mwongoza watalii', 'Mwongoza mzoefu', 'Mmiliki wa tour'], secs: 60, pay: 30_000, energy: 10 }],
  },
  {
    id: 'darajani', name: 'Soko la Darajani', district: 'Stone Town', type: 'market', icon: '🧺', pos: Z(-36, 18), size: [12, 10], h: 5, color: '#fca5a5',
    blurb: 'Viungo, matunda, samaki na kanga — soko kuu la Unguja.',
    activities: [
      { id: 'viungo', name: 'Nunua viungo (karafuu, mdalasini)', cost: 8_000, secs: 8, effects: { fun: 8 }, emoji: '🌶️' },
      { id: 'matunda', name: 'Matunda ya msimu', cost: 3_000, secs: 6, effects: { hunger: 20, energy: 6 }, emoji: '🥭' },
    ],
  },
  {
    id: 'spice', name: 'Shamba la Viungo', district: 'Kizimbani', type: 'farm', icon: '🌿', pos: Z(8, -30), size: [14, 12], h: 3, color: '#4d7c0f',
    blurb: 'Ziara ya shamba la karafuu, vanila na pilipili manga.',
    activities: [{ id: 'ziara-viungo', name: 'Ziara ya shamba la viungo', cost: 30_000, secs: 22, effects: { fun: 25, hunger: 10 }, emoji: '🌿' }],
  },
  {
    id: 'jozani', name: 'Msitu wa Jozani', district: 'Jozani', type: 'forest', icon: '🐒', pos: Z(60, 30), size: [16, 14], h: 2, color: '#166534',
    blurb: 'Kima punju (red colobus) na mikoko — hazina ya Zanzibar.',
    activities: [{ id: 'kima', name: 'Tembelea kima punju', cost: 25_000, secs: 22, effects: { fun: 30, energy: -6 }, emoji: '🐒', fame: 1 }],
  },
  {
    id: 'therock', name: 'The Rock Restaurant', district: 'Michamvi', type: 'restaurant', icon: '🪨', pos: Z(100, 30), size: [8, 8], h: 5, color: '#f5f5f4',
    blurb: 'Mgahawa juu ya mwamba baharini — wa kipekee duniani.',
    activities: [{ id: 'dinner-rock', name: 'Dinner juu ya mwamba', cost: 90_000, secs: 18, effects: { hunger: 70, fun: 25, social: 10 }, emoji: '🦞', fame: 2 }],
  },
  {
    id: 'zn-airport', name: 'Uwanja wa Ndege wa Abeid Amani Karume', district: 'Unguja', type: 'airport', icon: '✈️', pos: Z(0, 82), size: [30, 16], h: 7, color: '#cbd5e1',
    blurb: 'Uwanja wa ndege wa kimataifa wa Zanzibar.',
    activities: [{ id: 'heli-znz', name: 'Ziara ya helikopta juu ya Unguja', cost: 450_000, secs: 40, effects: { fun: 60 }, emoji: '🚁', fame: 4 }],
  },
  {
    id: 'nungwi', name: 'Fukwe za Nungwi', district: 'Nungwi', type: 'beach', icon: '🏖️', pos: Z(55, -108), size: [40, 10], h: 0, color: '#fde68a',
    blurb: 'Maji ya rangi ya feruzi, machweo na jahazi za Nungwi.',
    activities: [
      { id: 'ogelea', name: 'Ogelea Nungwi', cost: 0, secs: 15, effects: { fun: 30, hygiene: 10, energy: -8 }, emoji: '🏊' },
      { id: 'jahazi', name: 'Jahazi la machweo', cost: 40_000, secs: 30, effects: { fun: 45, social: 15 }, emoji: '⛵', fame: 1 },
      { id: 'mnemba', name: 'Snorkel Mnemba', cost: 80_000, secs: 35, effects: { fun: 55, hygiene: 10, energy: -12 }, emoji: '🤿', fame: 2 },
    ],
  },
  {
    id: 'kendwa', name: 'Kendwa Rocks', district: 'Kendwa', type: 'stage', icon: '🌕', pos: Z(5, -100), size: [14, 10], h: 3, color: '#f59e0b',
    blurb: 'Full Moon Party maarufu ufukweni — kula bata mpaka alfajiri.',
    activities: [
      { id: 'fullmoon', name: 'Full Moon Party', cost: 25_000, secs: 25, effects: { fun: 55, social: 30, energy: -15 }, emoji: '🌕', fame: 2 },
      { id: 'cocktail-kendwa', name: 'Cocktail ufukweni', cost: 12_000, secs: 8, effects: { fun: 15, social: 8 }, emoji: '🍹' },
    ],
  },
  {
    id: 'zn-hotel', name: 'Park Hyatt Zanzibar', district: 'Stone Town', type: 'hotel', icon: '🏨', pos: Z(-62, -45), size: [10, 12], h: 12, color: '#fef3c7',
    blurb: 'Hoteli ya kifahari ufukweni mwa Mji Mkongwe.',
    activities: [
      { id: 'massage', name: 'Spa na massage', cost: 60_000, secs: 25, effects: { energy: 40, hygiene: 25, fun: 15 }, emoji: '💆🏾' },
      { id: 'suite', name: 'Lala kwenye suite', cost: 150_000, secs: 30, effects: { energy: 95, hygiene: 30, fun: 10 }, emoji: '🛏️' },
    ],
  },
  // --------------------------------------------------------------- Arusha
  {
    id: 'clocktower', name: 'Mnara wa Saa', district: 'Arusha CBD', type: 'monument', icon: '🕰️', pos: A(10, 10), size: [8, 8], h: 8, color: '#f5f5f4',
    blurb: 'Katikati ya Arusha — nusu ya njia kati ya Cairo na Cape Town.',
    activities: [{ id: 'picha-mnara', name: 'Piga picha kwenye Mnara wa Saa', cost: 0, secs: 8, effects: { fun: 8 }, emoji: '📸', fame: 1 }],
  },
  {
    id: 'ar-bus', name: 'Stendi Kuu ya Arusha', district: 'Arusha CBD', type: 'terminal', icon: '🚌', pos: A(-25, 20), size: [14, 12], h: 6, color: '#e5e7eb',
    blurb: 'Mabasi kutoka Dar yanafika hapa.',
    activities: [],
  },
  {
    id: 'maasai', name: 'Soko la Wamasai', district: 'Arusha CBD', type: 'market', icon: '🛡️', pos: A(-30, -25), size: [16, 12], h: 5, color: '#dc2626',
    blurb: 'Shuka, shanga, vinyago na tanzanite — na ngoma ya kuruka ya Wamasai.',
    activities: [
      { id: 'adumu', name: 'Tazama ngoma ya kuruka (adumu)', cost: 5_000, secs: 18, effects: { fun: 25, social: 10 }, emoji: '🦘' },
      { id: 'shanga', name: 'Nunua shanga na shuka', cost: 20_000, secs: 8, effects: { fun: 10 }, emoji: '📿' },
    ],
  },
  {
    id: 'coffee', name: 'Shamba la Kahawa Arusha', district: 'Arusha', type: 'farm', icon: '☕', pos: A(35, -30), size: [14, 12], h: 3, color: '#65a30d',
    blurb: 'Kutoka mbegu hadi kikombe — ziara ya kahawa ya mlima Meru.',
    activities: [{ id: 'ziara-kahawa', name: 'Ziara na kuonja kahawa', cost: 25_000, secs: 20, effects: { fun: 20, energy: 18 }, emoji: '☕' }],
    jobs: [{ id: 'barista', title: 'Barista', titles: ['Barista', 'Barista mkuu'], secs: 45, pay: 18_000, energy: 8 }],
  },
  {
    id: 'viavia', name: 'Via Via Café', district: 'Arusha', type: 'bar', icon: '🎸', pos: A(30, 25), size: [10, 8], h: 4, color: '#b45309',
    blurb: 'Muziki wa live, chakula na wasanii wa Arusha.',
    activities: [{ id: 'live', name: 'Usiku wa muziki wa live', cost: 10_000, secs: 20, effects: { fun: 30, social: 20 }, emoji: '🎸' }],
  },
  {
    id: 'ar-hotel', name: 'Gran Meliá Arusha', district: 'Arusha', type: 'hotel', icon: '🏨', pos: A(-30, 40), size: [16, 12], h: 14, color: '#e7e5e4',
    blurb: 'Hoteli yenye mwonekano wa Mlima Meru.',
    activities: [
      { id: 'massage', name: 'Spa na massage', cost: 50_000, secs: 25, effects: { energy: 40, hygiene: 25, fun: 15 }, emoji: '💆🏾' },
      { id: 'rooftop', name: 'Siku kwenye bwawa', cost: 30_000, secs: 20, effects: { fun: 30, social: 20 }, emoji: '🏊' },
    ],
  },
  {
    id: 'safari', name: 'Lango la Safari', district: 'Ngorongoro · Serengeti', type: 'safari', icon: '🦒', pos: A(85, -85), size: [20, 16], h: 4, color: '#a16207',
    blurb: 'Hifadhi ya Arusha, Kreta ya Ngorongoro na Serengeti — Big Five!',
    activities: [
      { id: 'game-drive', name: 'Game drive — Hifadhi ya Arusha', cost: 120_000, secs: 40, effects: { fun: 50 }, emoji: '🦓', fame: 2 },
      { id: 'ngorongoro', name: 'Kreta ya Ngorongoro', cost: 350_000, secs: 50, effects: { fun: 70, energy: -10 }, emoji: '🦁', fame: 4 },
      { id: 'balloon', name: 'Puto la hewa — Serengeti', cost: 1_200_000, secs: 50, effects: { fun: 90 }, emoji: '🎈', fame: 8 },
    ],
    jobs: [{ id: 'safari-guide', title: 'Dereva wa safari', titles: ['Dereva wa safari', 'Mwongoza mzoefu', 'Mmiliki wa kampuni ya safari'], secs: 80, pay: 60_000, energy: 14, requires: { elimu: 1 } }],
  },
  {
    id: 'meru', name: 'Mlima Meru & Kilimanjaro', district: 'Arusha', type: 'mountain', icon: '🏔️', pos: A(-85, -85), size: [18, 14], h: 4, color: '#57534e',
    blurb: 'Panda Mlima Meru — au fika kilele cha Kilimanjaro, paa la Afrika!',
    activities: [
      { id: 'meru', name: 'Panda Mlima Meru', cost: 60_000, secs: 40, effects: { fun: 40, energy: -30 }, emoji: '🥾', fame: 2 },
      { id: 'kili', name: 'Kilele cha Kilimanjaro (Uhuru Peak)', cost: 900_000, secs: 60, effects: { fun: 80, energy: -60 }, emoji: '🏔️', fame: 10 },
    ],
    jobs: [{ id: 'porter', title: 'Mbeba mizigo mlimani', titles: ['Porter', 'Porter mkuu', 'Kiongozi wa msafara'], secs: 60, pay: 22_000, energy: 16 }],
  },
  {
    id: 'kia', name: 'Uwanja wa Ndege wa Kilimanjaro (KIA)', district: 'Kilimanjaro', type: 'airport', icon: '✈️', pos: A(85, 85), size: [28, 16], h: 7, color: '#cbd5e1',
    blurb: 'Lango la safari na Kilimanjaro.',
    activities: [{ id: 'heli-kili', name: 'Ziara ya helikopta — Kilimanjaro', cost: 1_500_000, secs: 40, effects: { fun: 80 }, emoji: '🚁', fame: 6 }],
  },
  // ----------------------------------------------------------------- Dar
  {
    id: 'casino', name: 'Le Grande Casino', district: 'Kisutu', type: 'casino', icon: '🎰', pos: [-1, 50], size: [12, 10], h: 8, color: '#111827',
    blurb: 'Slot machines, blackjack na roulette — pesa ya mchezo tu, kwa burudani.',
    activities: [
      { id: 'cocktail', name: 'Cocktail kwenye baa ya kasino', cost: 15_000, secs: 8, effects: { fun: 15, social: 8 }, emoji: '🍸' },
      { id: 'buffet', name: 'Buffet ya usiku wa manane', cost: 25_000, secs: 12, effects: { hunger: 60, fun: 6 }, emoji: '🍤' },
    ],
    jobs: [{ id: 'croupier', title: 'Croupier', titles: ['Croupier', 'Pit boss', 'Meneja wa kasino'], secs: 60, pay: 30_000, energy: 10 }],
  },
];
export const placeById = Object.fromEntries(PLACES.map((p) => [p.id, p]));

export function findActivity(placeId, id) {
  return placeById[placeId]?.activities?.find((a) => a.id === id) || null;
}
export function findJob(id) {
  for (const p of PLACES) for (const j of p.jobs || []) if (j.id === id) return { job: j, place: p };
  return null;
}
export function jobLevel(shifts = 0) {
  return Math.min(4, Math.floor(Math.sqrt(shifts / 4)));
}
export function jobTitle(job, shifts) {
  const lvl = jobLevel(shifts);
  return job.titles[Math.min(lvl, job.titles.length - 1)];
}
// ------------------------------------------------------------------ work
// Shifts are real stretches of time (2–4 min) with things to do while you're there.
export const WORK = {
  minStayFrac: 0.5, // clock out early after half the shift for pro-rated pay
  starsAt: 4, // finish this many good tasks for the bonus
  starBonus: 0.15,
  tasks: [
    { id: 'work', emoji: '👷', name: 'Fanya kazi', nameEn: 'Do your work', perf: 7, cooldown: 6, good: true },
    { id: 'hustle', emoji: '🔥', name: 'Chakarika', nameEn: 'Hustle hard', perf: 14, cooldown: 25, needs: { energy: -4 }, good: true },
    { id: 'chat', emoji: '💬', name: 'Piga stori', nameEn: 'Chat with coworkers', perf: -2, cooldown: 15, needs: { social: 8, fun: 3 } },
    { id: 'boss', emoji: '🙇', name: 'Mfurahishe bosi', nameEn: 'Impress the boss', perf: 18, cooldown: 60, once: true, good: true },
    { id: 'nap', emoji: '😴', name: 'Sinzia kidogo', nameEn: 'Sneak a nap', perf: -8, cooldown: 30, needs: { energy: 6 } },
  ],
  // [fraction of shift, sw, en]
  stages: [
    [0, 'Njiani kazini', 'Commute'],
    [0.07, 'Kubadili nguo kabatini', 'Changing at the locker'],
    [0.14, 'Kikao cha asubuhi', 'Morning brief'],
    [0.22, 'Kazini', 'On the job'],
    [0.9, 'Kumalizia', 'Wrapping up'],
  ],
};
export const workStage = (frac) => {
  let i = 0;
  WORK.stages.forEach((s, k) => { if (frac >= s[0]) i = k; });
  return i;
};
/** Pay multiplier from performance (0–100) and good tasks done. */
export const perfMult = (perf = 50, done = 0) => (0.8 + (perf / 100) * 0.4) * (done >= WORK.starsAt ? 1 + WORK.starBonus : 1);

export function shiftPay(job, { shifts = 0, mood = 70, trait, fame = 0 }) {
  const lvl = jobLevel(shifts);
  let pay = job.pay * (1 + 0.3 * lvl) * (0.6 + 0.4 * (mood / 100));
  if (trait === 'mchakarikaji') pay *= 1.1;
  if (job.fameBonus) pay += Math.min(200_000, fame * 400);
  return Math.round(pay / 100) * 100;
}

// ------------------------------------------------------------- billboards
// rot = rotation around Y in radians. pricePerDay in TSh (game money).
export const BILLBOARDS = [
  { id: 'bb-posta', name: 'Posta CBD', pos: [36, -4], rot: 0, pricePerDay: 250_000 },
  { id: 'bb-kariakoo', name: 'Kariakoo Market', pos: [-8, 28], rot: Math.PI / 2, pricePerDay: 180_000 },
  { id: 'bb-morogoro', name: 'Morogoro Rd — Magomeni', pos: [-70, -5], rot: 0, pricePerDay: 120_000 },
  { id: 'bb-ubungo', name: 'Ubungo Interchange', pos: [-100, 8], rot: Math.PI / 2, pricePerDay: 150_000 },
  { id: 'bb-sinza', name: 'Sinza Mori', pos: [-62, -38], rot: 0, pricePerDay: 140_000 },
  { id: 'bb-mlimani', name: 'Mlimani City', pos: [-22, -50], rot: 0, pricePerDay: 160_000 },
  { id: 'bb-coco', name: 'Coco Beach', pos: [80, -50], rot: -Math.PI / 2, pricePerDay: 200_000 },
  { id: 'bb-masaki', name: 'Masaki Peninsula', pos: [100, -94], rot: 0, pricePerDay: 300_000 },
  { id: 'bb-ferry', name: 'Kivukoni Feri', pos: [52, 30], rot: 0, pricePerDay: 170_000 },
  { id: 'bb-stadium', name: 'Uwanja wa Taifa', pos: [-12, 64], rot: Math.PI / 2, pricePerDay: 220_000 },
  { id: 'bb-kigamboni', name: 'Daraja la Nyerere', pos: [86, 62], rot: -Math.PI / 2, pricePerDay: 130_000 },
];
export const billboardById = Object.fromEntries(BILLBOARDS.map((b) => [b.id, b]));
export const AD_MAX_DAYS = 14;
// Billboards are paid in real money (nTZS mobile money), not game cash.
export const adTzsPerDay = (slot) => Math.max(1_000, Math.round(slot.pricePerDay / 50 / 500) * 500);
export const adPriceTzs = (slot, days) => adTzsPerDay(slot) * days;
// Billboards are digital screens: up to this many ads share a board, taking turns.
export const ADS_PER_BOARD = 9;
export const AD_ROTATE_SECONDS = 10;

// ---------------------------------------------------------- fast travel
// `kind` is the vehicle model shown during the ride.
export const TRAVEL = {
  daladala: { name: 'Daladala', emoji: '🚌', perUnit: 6, min: 500, kind: 'bus', color: '#fde047', speed: 16 },
  bajaji: { name: 'Bajaji', emoji: '🛺', perUnit: 25, min: 1_000, kind: 'bajaji', color: '#facc15', speed: 20 },
  boda: { name: 'Bodaboda', emoji: '🏍️', perUnit: 15, min: 700, kind: 'moto', color: '#dc2626', speed: 24 },
  taxi: { name: 'Taxi Mtandao', emoji: '🚕', perUnit: 45, min: 2_500, kind: 'car', color: '#f8fafc', speed: 26 },
  // Your own vehicle: you pay fuel (see fuelCost), drives you there along the roads (skippable).
  gari: { name: 'Gari langu', emoji: '🚗', perUnit: 0, min: 0, kind: 'car', color: '#2563eb', speed: 26, own: true },
};

// ---------------------------------------------------------------- mayor
// Weekly elections (Monday 00:00 Dar time). Last week's winner is Mkuu wa Mkoa.
export const ELECTION = { fee: 50_000, salary: 500_000, minShifts: 1, candidateShifts: 3, sloganMax: 60, messageMax: 140 };
const WEEK_MS = 7 * 86_400_000;
const WEEK_OFF = 3 * 3_600_000 + 3 * 86_400_000; // EAT offset + Thursday→Monday
export const electionPeriod = (t = Date.now()) => Math.floor((t + WEEK_OFF) / WEEK_MS);
export const electionEnds = (p) => (p + 1) * WEEK_MS - WEEK_OFF;

// Invite friends: both sides earn once the new player finishes their first shift.
export const REFERRAL = { newPlayer: 20_000, referrer: 30_000, maxPaid: 50 };
// Every new player gets a used car to drive around in.
export const STARTER_CAR = 'ist';
export const CAR_KINDS = ['car', 'van', 'suv'];
// Fuel for your own vehicle: bigger, faster cars drink more. Bodas and bajajis sip.
export function fuelMult(model) {
  const v = vehicleById[model];
  if (!v) return 1;
  if (v.kind === 'bike') return 0;
  if (v.kind === 'moto') return 0.4;
  if (v.kind === 'bajaji') return 0.6;
  return 0.7 + (v.tier || 1) * 0.3;
}
export function fuelCost(model, from, to) {
  const m = fuelMult(model);
  if (!m) return 0;
  const d = Math.hypot(to[0] - from[0], to[1] - from[1]);
  return Math.max(500, Math.round((d * 9 * m) / 100) * 100);
}
/** Long-distance drive between cities: the base fuel price scaled by your car. */
export const tripFuel = (fare, model) => Math.max(10_000, Math.round((fare * fuelMult(model)) / 1000) * 1000);
/** The car you'd drive out of town: your priciest car/van/SUV. */
export const bestCar = (vehicles) => [...(vehicles || [])].filter((v) => ['car', 'van', 'suv'].includes(vehicleById[v.model]?.kind)).sort((a, b) => vehicleById[b.model].price - vehicleById[a.model].price)[0] || null;

export function travelCost(mode, from, to) {
  const t = TRAVEL[mode];
  const d = Math.hypot(to[0] - from[0], to[1] - from[1]);
  return Math.max(t.min, Math.round((d * t.perUnit) / 100) * 100);
}

// ----------------------------------------------------------------- events
export const EVENTS = [
  { text: '💃 Msimu wa Send-off — kula bata wiki hii!', boost: { club: 1.3 } },
  { text: '⚽ Wiki ya Dabi: Simba vs Yanga Uwanja wa Taifa!', boost: { stadium: 1.5 } },
  { text: '🎤 Bongo Flava Week — studio zimejaa!', boost: { studio: 1.4 } },
  { text: '🏖️ Sikukuu ya Sabasaba — fukweni kumechangamka!', boost: { beach: 1.4 } },
  { text: '💼 Mwezi wa Kuchakarika — mishahara juu!', boost: { jobs: 1.15 } },
];
export function currentEvent(now = Date.now()) {
  const week = Math.floor(now / (7 * 24 * 3600 * 1000));
  return EVENTS[week % EVENTS.length];
}

export function gameClock(now = Date.now()) {
  const totalMin = (Math.floor(now / 60000) + GAME.utcOffsetMinutes) % 1440;
  return { hour: Math.floor(totalMin / 60), minute: totalMin % 60, totalMin };
}

export const fmtTsh = (n) => 'TSh ' + Math.round(n || 0).toLocaleString('en-US');
export const fmtShort = (n) => {
  const a = Math.abs(n || 0);
  if (a >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
  if (a >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (a >= 1e3) return (n / 1e3).toFixed(0) + 'K';
  return String(Math.round(n || 0));
};

// ------------------------------------------------------------ English
// English copy for catalog content. Swahili stays the default; UIs pick `xxxEn`
// fields when the player chooses English.
const EN = {
  needs: { hunger: 'Hunger', energy: 'Energy', fun: 'Fun', hygiene: 'Hygiene', social: 'Social' },
  traits: {
    mchakarikaji: ['Hustler', '+10% pay on every shift'],
    mtoko: ['Party Person', 'Fun drops more slowly'],
    msomi: ['Scholar', 'University courses finish faster'],
    mjanja: ['Street Smart', '5% discount on purchases'],
    msanii: ['Artist', 'Double fame from the studio'],
  },
  spawns: {
    manzese: 'Home of the hustlers. Your guest house is nearby.',
    kariakoo: 'The big market — every deal is here.',
    sinza: 'All the fun. Clubs and bars on every corner.',
    kigamboni: 'Sea breeze and beachfront plots.',
  },
  hair: { misuko: 'Braids', afro: 'Afro', kibanio: 'Bun', mkia: 'Ponytail', rasta: 'Locs', kiduku: 'Low cut', kilemba: 'Head wrap', kofia: 'Cap', kipara: 'Bald' },
  outfits: {
    tshirt: 'T-shirt & Jeans', kitenge: 'Kitenge Dress', kanga: 'Kanga', kanzu: 'Kanzu & Kofia', shati: 'Kitenge Shirt',
    'jezi-simba': 'Simba Jersey', 'jezi-yanga': 'Yanga Jersey', hoodie: 'Bongo Flava Hoodie', suti: 'Boss Suit',
    'gauni-sendoff': 'Send-off Gown', gym: 'Gym Wear',
  },
  vehicles: { baiskeli: 'Bicycle' },
  buildings: { banda: 'Simple House', kisasa: 'Modern House', ghorofa: 'Apartment Block', villa: 'Luxury Villa', hoteli: 'Beach Hotel' },
  billboards: { 'bb-ferry': 'Kivukoni Ferry', 'bb-stadium': 'National Stadium', 'bb-kigamboni': 'Nyerere Bridge' },
  travel: { bajaji: 'Bajaji (tuk-tuk)', daladala: 'Daladala (minibus)', taxi: 'Ride-hail taxi', boda: 'Bodaboda (moto taxi)', gari: 'My car' },
  events: [
    '💃 Send-off season — party all week!',
    '⚽ Derby week: Simba vs Yanga at the National Stadium!',
    '🎤 Bongo Flava Week — the studios are packed!',
    '🏖️ Sabasaba holiday — the beaches are buzzing!',
    '💼 Hustle Month — salaries are up!',
  ],
  places: {
    gesti: ['Rented Room', 'Your rented room. Sleep, shower, cook — totally free.', {
      lala: 'Sleep', oga: 'Shower', pika: 'Cook ugali & greens' }],
    mamantilie: ["Mama Ntilie's Food Stall", 'Cheap food that tastes like home.', {
      chipsi: 'Chips Mayai (chips omelette)', walimaharage: 'Rice & Beans', ugalisamaki: 'Ugali & Fish', chai: 'Tea & Mandazi' }],
    kariakoo: ['Kariakoo Market', "East Africa's biggest market. Hawkers, traders and every hustle.", {
      zunguka: 'Wander the market', mishkaki: 'Kariakoo Mishkaki (skewers)' }],
    fashion: ['Kariakoo Fashion', 'Jerseys, suits, send-off gowns — look sharp on the streets.', {}],
    bank: ['NMB Bank', 'Top up your wallet with M-Pesa, Mixx by Yas or Airtel Money.', {}],
    fishmarket: ['Feri Fish Market', 'Fresh fish from the ocean every morning.', { samakichoma: 'Grilled fish' }],
    techhub: ['Dar Tech Hub', "Startups, coders and Bongo's big ideas.", { hackathon: 'Join a hackathon' }],
    posta: ['Posta Towers', 'Offices of the big companies. AC and a tie.', {}],
    ferry: ['Kivukoni Ferry', 'Cross to Kigamboni on the ferry.', { vuka: 'Take the ferry to Kigamboni' }],
    ferrykig: ['Kigamboni Ferry', 'Head back to town on the ferry.', { rudi: 'Take the ferry to Posta' }],
    coco: ['Coco Beach', 'Roast cassava, coconuts and the ocean breeze.', {
      ogelea: 'Swim in the ocean', mihogo: 'Roast cassava', madafu: 'Fresh coconut', 'piga-stori': 'Hang out with friends' }],
    mall: ['Mlimani City', 'Mall, cinema, food court — a classy day out.', { sinema: 'Watch a movie', burger: 'Burger & juice', window: 'Window shopping' }],
    gym: ['Mlimani Gym', 'Build muscle, lose the belly.', { mazoezi: 'Work out' }],
    chuo: ['University of Dar', 'Take courses to gain education — unlocks banking and tech jobs.', {
      kozi: 'Take a course (Education +1)', maktaba: 'Study in the library' }],
    club: ['1245 Club', 'Nightclub — Bongo Flava, Amapiano and Singeli till sunrise.', {
      cheza: 'Go in and dance', mzunguko: 'Buy a round for friends', vip: 'VIP table' }],
    bar: ['Corner Bar', 'Nyama choma, football on TV and street stories.', {
      nyamachoma: 'Nyama choma (grilled meat)', soda: 'Drinks with friends', mpira: 'Watch football' }],
    studio: ['Bongo Flava Studio', 'Record your track — tomorrow you could be a star.', { rekodi: 'Record a song', video: 'Shoot a music video' }],
    stendi: ['Magufuli Bus Terminal', 'Daladalas and upcountry buses. The conductor is calling!', { kijiweni: 'Hang at the base' }],
    yadi: ['Car Yard', 'From an IST, Crown and Prado all the way to a G-Wagon, Lamborghini and Rolls-Royce. Climb the ladder!', {}],
    uwanja: ['Benjamin Mkapa Stadium', 'The Kariakoo Derby — Simba vs Yanga!', { dabi: 'Derby ticket: Simba vs Yanga', kimbia: 'Run on the track' }],
    masakigrill: ['Karambezi Café', 'Prawns, octopus and the Sea Cliff sunset in Masaki.', { seafood: 'Seafood platter', date: 'Fancy dinner date' }],
    lounge: ['Elements', 'The Masaki club where the stars go — big DJs, VIP and style.', { sundowner: 'Rooftop sundowner' }],
    kigbeach: ['Kipepeo Beach', 'Clean beaches far from the city noise.', { pumzika: 'Relax on the beach', ogelea2: 'Swim' }],
    hospitali: ['Muhimbili Hospital', 'Emergency care and health check-ups — open 24 hours.', {
      matibabu: 'Get treatment', pima: 'Health check-up', 'pumzika-wodini': 'Rest on the ward' }],
    'zn-port': ['Zanzibar Port', 'The Azam ferries from Dar dock here. Welcome to Unguja!', { gereza: 'Boat to Prison Island (Changuu)' }],
    forodhani: ['Forodhani Gardens', 'Night food market: Zanzibar pizza, urojo, mishkaki and sugarcane juice — sunset by the sea.', { pizza: 'Zanzibar pizza', urojo: 'Urojo (Zanzibar mix)', miwa: 'Sugarcane juice', machweo: 'Watch the boys dive into the sea' }],
    stonetown: ['Stone Town', 'Narrow alleys, carved Zanzibar doors, the Old Fort and the Freddie Mercury House.', { ziara: 'Stone Town walking tour', milango: 'Photograph the Zanzibar doors', 'kahawa-baraza': 'Coffee and kashata on a baraza' }],
    darajani: ['Darajani Market', "Spices, fruit, fish and kangas — Unguja's main market.", { viungo: 'Buy spices (cloves, cinnamon)', matunda: 'Seasonal fruit' }],
    spice: ['Spice Farm', 'A tour of the clove, vanilla and pepper farm.', { 'ziara-viungo': 'Spice farm tour' }],
    jozani: ['Jozani Forest', "Red colobus monkeys and mangroves — Zanzibar's treasure.", { kima: 'See the red colobus monkeys' }],
    therock: ['The Rock Restaurant', "A restaurant on a rock in the sea — one of a kind.", { 'dinner-rock': 'Dinner on the rock' }],
    'zn-airport': ['Abeid Amani Karume Airport', "Zanzibar's international airport.", { 'heli-znz': 'Helicopter tour over Unguja' }],
    nungwi: ['Nungwi Beach', 'Turquoise water, sunsets and the dhows of Nungwi.', { ogelea: 'Swim at Nungwi', jahazi: 'Sunset dhow', mnemba: 'Snorkel at Mnemba' }],
    kendwa: ['Kendwa Rocks', 'The famous Full Moon Party on the beach — party till sunrise.', { fullmoon: 'Full Moon Party', 'cocktail-kendwa': 'Cocktail on the beach' }],
    'zn-hotel': ['Park Hyatt Zanzibar', 'A luxury hotel on the Stone Town seafront.', { massage: 'Spa & massage', suite: 'Sleep in a suite' }],
    clocktower: ['Clock Tower', 'The heart of Arusha — halfway between Cairo and Cape Town.', { 'picha-mnara': 'Take a photo at the Clock Tower' }],
    'ar-bus': ['Arusha Bus Terminal', 'Coaches from Dar arrive here.', {}],
    maasai: ['Maasai Market', 'Shukas, beads, carvings and tanzanite — and the Maasai jumping dance.', { adumu: 'Watch the jumping dance (adumu)', shanga: 'Buy beads and a shuka' }],
    coffee: ['Arusha Coffee Farm', 'From bean to cup — a Mount Meru coffee tour.', { 'ziara-kahawa': 'Coffee tour & tasting' }],
    viavia: ['Via Via Café', "Live music, food and Arusha's artists.", { live: 'Live music night' }],
    'ar-hotel': ['Gran Meliá Arusha', 'A hotel with a view of Mount Meru.', { massage: 'Spa & massage', rooftop: 'Pool day' }],
    safari: ['Safari Gate', 'Arusha National Park, Ngorongoro Crater and the Serengeti — the Big Five!', { 'game-drive': 'Game drive — Arusha National Park', ngorongoro: 'Ngorongoro Crater', balloon: 'Hot-air balloon — Serengeti' }],
    meru: ['Mount Meru & Kilimanjaro', 'Climb Mount Meru — or reach the top of Kilimanjaro, the roof of Africa!', { meru: 'Climb Mount Meru', kili: 'Kilimanjaro summit (Uhuru Peak)' }],
    kia: ['Kilimanjaro International Airport (KIA)', 'The gateway to safaris and Kilimanjaro.', { 'heli-kili': 'Helicopter tour — Kilimanjaro' }],
    casino: ['Le Grande Casino', 'Slot machines, blackjack and roulette — game money only, just for fun.', { cocktail: 'Cocktail at the casino bar', buffet: 'Midnight buffet' }],
    polisi: ['Oysterbay Police Station', 'Report crime, pay a fine or bail — or sit in the cell.', { tembelea: 'Visit someone in the cells' }],
    mahakama: ["Kisutu Resident Magistrate's Court", 'Cases are heard here.', { sikiliza: 'Watch a trial' }],
    kinyozi: ['Sinza Barber & Salon', 'Fresh fades, new braids and all the neighbourhood gossip.', { nyoa: 'Get a fresh fade', suka: 'Get braids / locs done', kucha: 'Manicure & pedicure', umbea: 'Gossip at the salon' }],
    nyamachoma: ['Ubungo Nyama Choma', 'Roast goat, plantains, kachumbari and football on the big screen.', { kilo: 'A kilo of nyama choma & plantains', supu: 'Tripe soup', mbuzi: 'A whole goat with the crew', 'mpira-tv': 'Watch the match on the big TV' }],
    waterpark: ["Wet 'n' Wild Kunduchi", 'Long slides, a wave pool and a lazy river — fun for the whole family.', { slides: 'Ride the water slides', wave: 'Swim in the wave pool', lazy: 'Lazy river with friends', 'aiskrimu-wp': 'Azam ice cream' }],
    makumbusho: ['Village Museum', 'Traditional houses of the tribes, ngoma dancing and Tingatinga art.', { ngoma: 'Dance traditional ngoma', makabila: 'Tour the tribal houses', tinga: 'Tingatinga painting class', mtori: 'Eat mtori & plantain stew' }],
    golf: ['Gymkhana Golf Club', 'Golf, big bosses and big deals — money talks here.', { golf9: 'Play 9 holes', range: 'Driving range', dili: 'Close deals with the bosses' }],
    slipway: ['Msasani Slipway', 'Sunset dhow cruises, boats to Bongoyo, ice cream and a craft market.', { jahazi: 'Sunset dhow cruise', bongoyo: 'Boat to Bongoyo + snorkelling', aiskrimu: 'Slipway ice cream', sanaa: 'Browse the craft market' }],
    singeli: ['Mbagala Singeli Ground', 'Hard-hitting Singeli, screaming MCs, chipsi mayai and Mbagala dust!', { singeli: 'Dance to Singeli', jukwaani: 'Jump on stage (freestyle)', 'chipsi-mayai': 'Festival chipsi mayai' }],
    karting: ['Temeke Go-Karts', 'Race your friends on the track — the winner gets the bragging rights!', { race: 'Race 5 laps', grandprix: 'Bongo Grand Prix with friends', pitstop: 'Cold soda at the pit stop' }],
    serena: ['Serena Hotel & Spa', 'Massages, a rooftop pool party, fine dining and suites to sleep in.', { massage: 'Full-body massage', rooftop: 'Rooftop pool party', dinner: 'Fine dining dinner', suite: 'Sleep in a suite' }],
    airport: ['JNIA Airport', 'Catch a flight — Zanzibar, Arusha, Mwanza, Nairobi, even Dubai. Safe travels!', {
      zanzibar: 'Fly to Zanzibar', arusha: 'Fly to Arusha (Safari)', mwanza: 'Fly to Mwanza', nairobi: 'Fly to Nairobi', dubai: 'Fly to Dubai (Business class)' }],
  },
  jobs: {
    msaidizi: ['Food Stall Helper', ['Dishwasher', 'Assistant cook', 'Head cook', 'Stall manager']],
    machinga: ['Street Hawker', ['Hawker', 'Seasoned seller', 'Stall owner', 'Kariakoo broker', 'Merchant']],
    teller: ['Bank Teller', ['Teller', 'Loan Officer', 'Branch Manager', 'Director']],
    mvuvi: ['Fisherman', ['Fisherman', 'Boat captain', 'Boat owner', 'Fish tycoon']],
    developer: ['Developer', ['Junior Dev', 'Developer', 'Senior Dev', 'CTO', 'Founder']],
    karani: ['Office Clerk', ['Clerk', 'Officer', 'Manager', 'CEO']],
    cashier: ['Supermarket Cashier', ['Cashier', 'Supervisor', 'Store Manager']],
    trainer: ['Personal Trainer', ['Trainer', 'Senior Trainer', 'Coach']],
    dj: ['DJ', ['Rookie DJ', 'Resident DJ', 'Elements DJ', 'Champion DJ']],
    mhudumu: ['Bar Attendant', ['Waiter', 'Bartender', 'Bar Manager']],
    msanii: ['Artist', ['Upcoming artist', 'Street artist', 'Bongo Flava star', 'Legend']],
    konda: ['Daladala Conductor', ['Conductor', 'Daladala driver', 'Daladala owner']],
    bodaboda: ['Bodaboda Rider', ['Rider', 'Seasoned rider', 'Base boss']],
    taxi: ['Ride-hailing Driver', ['Driver', '5-star driver', 'Fleet owner']],
    mlinzi: ['Stadium Guard', ['Guard', 'Head of security']],
    chef: ['Chef', ['Commis chef', 'Sous chef', 'Head chef']],
    nesi: ['Nurse', ['Nurse', 'Head nurse', 'Ward manager']],
    daktari: ['Doctor', ['Doctor', 'Specialist', 'Hospital director']],
    mbebaji: ['Baggage handler', ['Baggage handler', 'Baggage supervisor']],
    'mhudumu-ndege': ['Cabin crew', ['Cabin crew', 'Senior cabin crew', 'Purser']],
    rubani: ['Pilot', ['First officer', 'Pilot', 'Captain', 'Chief captain']],
    'mpishi-pizza': ['Zanzibar pizza cook', ['Cook', 'Head cook']],
    mwongoza: ['Tour guide', ['Tour guide', 'Senior guide', 'Tour company owner']],
    barista: ['Barista', ['Barista', 'Head barista']],
    'safari-guide': ['Safari driver-guide', ['Safari driver', 'Senior guide', 'Safari company owner']],
    porter: ['Mountain porter', ['Porter', 'Head porter', 'Expedition leader']],
    croupier: ['Croupier', ['Croupier', 'Pit boss', 'Casino manager']],
    askari: ['Police officer', ['Constable', 'Corporal', 'Sergeant', 'Inspector', 'Superintendent']],
    'karani-mahakama': ['Court clerk', ['Clerk', 'Senior clerk']],
    wakili: ['Lawyer', ['Junior advocate', 'Advocate', 'Senior advocate', 'State attorney']],
    kinyozi: ['Barber', ['Junior barber', 'Senior barber', 'Salon owner']],
    mchoma: ['Grill master', ['Kitchen helper', 'Grill master', 'Grill champion']],
    lifeguard: ['Lifeguard', ['Lifeguard', 'Head lifeguard']],
    'mpiga-ngoma': ['Ngoma drummer', ['Drummer', 'Troupe leader']],
    caddie: ['Caddie', ['Caddie', 'Head caddie']],
    nahodha: ['Dhow captain', ['Sailor', 'Captain', 'Dhow owner']],
    mc: ['Singeli MC', ['Hype man', 'MC', 'Champion MC']],
    fundi: ['Mechanic', ['Pit helper', 'Mechanic', 'Pit chief']],
    receptionist: ['Receptionist', ['Receptionist', 'Front desk manager', 'Hotel manager']],
  },
};

for (const n of NEEDS) n.nameEn = EN.needs[n.id];
for (const t of TRAITS) [t.nameEn, t.perkEn] = EN.traits[t.id];
for (const [id, s] of Object.entries(SPAWNS)) s.blurbEn = EN.spawns[id];
for (const h of HAIRSTYLES) h.nameEn = EN.hair[h.id];
for (const o of OUTFITS) o.nameEn = o.nameEn || EN.outfits[o.id] || o.name;
for (const v of VEHICLES) v.nameEn = EN.vehicles[v.id] || v.name;
for (const b of BUILDINGS) b.nameEn = EN.buildings[b.id];
for (const b of BILLBOARDS) b.nameEn = EN.billboards[b.id] || b.name;
for (const [k, t] of Object.entries(TRAVEL)) t.nameEn = EN.travel[k];
EVENTS.forEach((e, i) => (e.textEn = EN.events[i]));
for (const p of PLOTS) p.nameEn = p.name.replace('Kiwanja', 'Plot');
for (const p of PLACES) {
  const [name, blurb, acts] = EN.places[p.id];
  p.nameEn = name;
  p.blurbEn = blurb;
  for (const a of p.activities || []) a.nameEn = acts[a.id] || a.name;
  for (const j of p.jobs || []) {
    [j.titleEn, j.titlesEn] = EN.jobs[j.id];
    // Longer, more real shifts (2–4 min) that pay accordingly.
    j.secs = Math.round(Math.max(120, Math.min(240, j.secs * 3)) / 10) * 10;
    j.pay = Math.round((j.pay * 2.5) / 100) * 100;
  }
  if (p.business?.label) p.business.labelEn = 'Wholesale Shop';
}

export function jobTitleEn(job, shifts) {
  const lvl = jobLevel(shifts);
  return job.titlesEn[Math.min(lvl, job.titlesEn.length - 1)];
}
export function moodLabelEn(m) {
  if (m >= 80) return { text: 'Vibing', emoji: '😎' };
  if (m >= 60) return { text: 'Doing fine', emoji: '🙂' };
  if (m >= 40) return { text: 'Okay', emoji: '😐' };
  if (m >= 20) return { text: 'Struggling', emoji: '😩' };
  return { text: 'Wrecked', emoji: '🥴' };
}

// ------------------------------------------------------------ interiors
// Venues you can walk into (others see you there), and which scene an activity shows.
export const ENTERABLE = { casino: 'casino', kendwa: 'concert', polisi: 'police', mahakama: 'court', club: 'club', lounge: 'club', bar: 'bar', uwanja: 'stadium', studio: 'studio', singeli: 'concert', kinyozi: 'salon', nyamachoma: 'grill' };
const ACTIVITY_SCENES = {
  gesti: { lala: 'room', oga: 'room', pika: 'room' },
  mamantilie: { chipsi: 'dining', walimaharage: 'dining', ugalisamaki: 'dining', chai: 'dining' },
  kariakoo: { mishkaki: 'dining' },
  fishmarket: { samakichoma: 'dining' },
  masakigrill: { seafood: 'dining', date: 'dining' },
  mall: { sinema: 'cinema', burger: 'dining' },
  coco: { ogelea: 'beach', 'piga-stori': 'beach', mihogo: 'beach', madafu: 'beach' },
  kigbeach: { ogelea2: 'beach', pumzika: 'beach' },
  gym: { mazoezi: 'gym' },
  chuo: { kozi: 'classroom', maktaba: 'classroom' },
  hospitali: { matibabu: 'hospital', pima: 'hospital', 'pumzika-wodini': 'hospital' },
  airport: { zanzibar: 'flight', arusha: 'flight', mwanza: 'flight', nairobi: 'flight', dubai: 'flight' },
  'zn-airport': { 'heli-znz': 'heli' },
  kia: { 'heli-kili': 'heli' },
  'zn-port': { gereza: 'dhow' },
  forodhani: { pizza: 'grill', urojo: 'grill', miwa: 'grill', machweo: 'beach' },
  nungwi: { ogelea: 'beach', jahazi: 'dhow', mnemba: 'dhow' },
  kendwa: { fullmoon: 'concert', 'cocktail-kendwa': 'concert' },
  'zn-hotel': { massage: 'spa', suite: 'spa' },
  therock: { 'dinner-rock': 'dining' },
  maasai: { adumu: 'ngoma' },
  viavia: { live: 'bar' },
  'ar-hotel': { massage: 'spa', rooftop: 'rooftop' },
  safari: { 'game-drive': 'safari', ngorongoro: 'safari', balloon: 'safari' },
  meru: { meru: 'hike', kili: 'hike' },
  coffee: { 'ziara-kahawa': 'dining' },
  jozani: { kima: 'safari' },
  waterpark: { slides: 'waterpark', wave: 'waterpark', lazy: 'waterpark' },
  makumbusho: { ngoma: 'ngoma', makabila: 'ngoma', tinga: 'ngoma' },
  golf: { golf9: 'golf', range: 'golf', dili: 'golf' },
  slipway: { jahazi: 'dhow', bongoyo: 'dhow' },
  karting: { race: 'karting', grandprix: 'karting' },
  serena: { massage: 'spa', suite: 'spa', rooftop: 'rooftop', dinner: 'dining' },
};
const JOB_SCENES = { dj: 'club', mhudumu: 'bar', msanii: 'studio', trainer: 'gym', chef: 'dining', msaidizi: 'dining', cashier: 'shop', machinga: 'shop', nesi: 'hospital', daktari: 'hospital', teller: 'bank', karani: 'office', developer: 'office', mlinzi: 'stadium', mvuvi: 'beach', 'mhudumu-ndege': 'flight', rubani: 'flight' , lifeguard: 'waterpark', 'mpiga-ngoma': 'ngoma', caddie: 'golf', nahodha: 'dhow', fundi: 'karting', receptionist: 'spa' , 'mpishi-pizza': 'grill', mwongoza: null, croupier: 'casino', 'safari-guide': 'safari', porter: 'hike', barista: 'dining' };

/** Scene for a busy state ({ kind, id, placeId }), or null to stay outdoors. */
const TRIP_SCENES = { flight: 'flight', heli: 'heli', ferry: 'ferry', bus: 'road', car: 'road' };
export function sceneFor(busy) {
  if (!busy) return null;
  if (busy.kind === 'trip') return TRIP_SCENES[busy.id] || null;
  if (busy.kind === 'job') return JOB_SCENES[busy.id] ?? null;
  return ENTERABLE[busy.placeId] || ACTIVITY_SCENES[busy.placeId]?.[busy.id] || null;
}

// ------------------------------------------------------------------ home
// Every player has an apartment ("Kwangu"). Furniture sits on a grid; x/z are the
// item's centre in world units, rot is quarter turns. size = [w, d] in cells.
export const HOME = { w: 12, d: 10, sellBack: 0.5 };
// ------------------------------------------------------------------ yard (build mode)
// Every player gets a free empty yard beside their house to build on, Minecraft-style: one
// block per grid cell, stacked up to `h` high. Removing a block refunds half.
export const YARD = { w: 12, d: 12, h: 6, maxBlocks: 400, refund: 0.5, sale: 1_000 };
export const YARD_BLOCKS = [
  { id: 'floor', name: 'Sakafu', nameEn: 'Floor', emoji: '🟫', price: 300, color: '#b98552', slab: true },
  { id: 'brick', name: 'Tofali', nameEn: 'Brick wall', emoji: '🧱', price: 800, color: '#b4532a' },
  { id: 'plaster', name: 'Ukuta mweupe', nameEn: 'White wall', emoji: '⬜', price: 800, color: '#f1ece2' },
  { id: 'gold', name: 'Ukuta wa dhahabu', nameEn: 'Gold wall', emoji: '🟨', price: 1_200, color: '#f5b800' },
  { id: 'glass', name: 'Kioo', nameEn: 'Glass', emoji: '🪟', price: 1_000, color: '#bfe3f5', glass: true },
  { id: 'roof', name: 'Bati', nameEn: 'Roof', emoji: '🏠', price: 700, color: '#64748b', slab: true },
  { id: 'door', name: 'Mlango', nameEn: 'Door', emoji: '🚪', price: 1_500, color: '#7c4a22' },
  { id: 'counter', name: 'Kaunta', nameEn: 'Counter', emoji: '🪵', price: 2_000, color: '#8b5e34', counter: true },
  { id: 'shelf', name: 'Rafu', nameEn: 'Shelf', emoji: '🗄️', price: 1_800, color: '#a16207', shelf: true },
  { id: 'sign', name: 'Bango', nameEn: 'Sign', emoji: '🪧', price: 2_500, color: '#0f172a', sign: true },
  { id: 'plant', name: 'Mmea', nameEn: 'Plant', emoji: '🪴', price: 600, color: '#3f9b4a', plant: true },
  { id: 'lamp', name: 'Taa', nameEn: 'Lamp', emoji: '💡', price: 900, color: '#fde68a', lamp: true },
];
export const yardBlockById = Object.fromEntries(YARD_BLOCKS.map((b) => [b.id, b]));
export const FURNITURE_CATS = [
  { id: 'sleep', name: 'Kulala', nameEn: 'Sleep', icon: '🛏️' },
  { id: 'sit', name: 'Kukaa', nameEn: 'Seating', icon: '🛋️' },
  { id: 'kitchen', name: 'Jikoni', nameEn: 'Kitchen', icon: '🍳' },
  { id: 'bath', name: 'Bafuni', nameEn: 'Bath', icon: '🚿' },
  { id: 'tech', name: 'Elektroniki', nameEn: 'Electronics', icon: '📺' },
  { id: 'fun', name: 'Burudani', nameEn: 'Fun', icon: '🎮' },
  { id: 'skills', name: 'Ujuzi', nameEn: 'Skills', icon: '🎸' },
  { id: 'light', name: 'Taa', nameEn: 'Light', icon: '💡' },
  { id: 'decor', name: 'Mapambo', nameEn: 'Decor', icon: '🪴' },
  { id: 'pets', name: 'Wanyama', nameEn: 'Pets', icon: '🐶' },
];
// use: what tapping the item does. effects scale with stars.
const U = {
  lala: (s) => ({ act: 'lala', emoji: '😴', name: 'Lala', nameEn: 'Sleep', secs: 30, effects: { energy: 35 + s * 15, hunger: -4 } }),
  oga: (s) => ({ act: 'oga', emoji: '🚿', name: 'Oga', nameEn: 'Shower', secs: 10, effects: { hygiene: 45 + s * 14 } }),
  pika: (s) => ({ act: 'pika', emoji: '🍲', name: 'Pika', nameEn: 'Cook', secs: 15, cost: 2_000, effects: { hunger: 35 + s * 8, fun: 3 } }),
  snack: () => ({ act: 'snack', emoji: '🥤', name: 'Chukua kinywaji', nameEn: 'Grab a snack', secs: 4, cost: 1_000, effects: { hunger: 18, energy: 6 } }),
  kaa: (s) => ({ act: 'kaa', emoji: '🛋️', name: 'Pumzika', nameEn: 'Relax', secs: 10, effects: { fun: 4 + s * 3, energy: 4 + s * 2 } }),
  burudika: (s) => ({ act: 'burudika', emoji: '📺', name: 'Burudika', nameEn: 'Have fun', secs: 15, effects: { fun: 10 + s * 8 } }),
  surf: () => ({ act: 'surf', emoji: '💻', name: 'Chati mtandaoni', nameEn: 'Chat online', secs: 12, effects: { social: 22, fun: 6, energy: -3 } }),
  choo: () => ({ act: 'choo', emoji: '🚽', name: 'Tumia choo', nameEn: 'Use the toilet', secs: 5, effects: { hygiene: 15 } }),
  game: (s) => ({ act: 'game', emoji: '🎮', name: 'Cheza game', nameEn: 'Play games', secs: 15, effects: { fun: 14 + s * 7, energy: -3 } }),
  pool: (s) => ({ act: 'pool', emoji: '🎱', name: 'Cheza', nameEn: 'Play a round', secs: 14, effects: { fun: 12 + s * 6, social: 6 } }),
  dj: (s) => ({ act: 'dj', emoji: '🎧', name: 'Changanya ngoma', nameEn: 'Mix some tracks', secs: 16, effects: { fun: 14 + s * 5 }, fame: 1 }),
  imba: (s) => ({ act: 'imba', emoji: '🎤', name: 'Imba karaoke', nameEn: 'Sing karaoke', secs: 14, effects: { fun: 12 + s * 5, social: 8 } }),
  gitaa: (s) => ({ act: 'gitaa', emoji: '🎸', name: 'Piga gitaa', nameEn: 'Practise guitar', secs: 16, effects: { fun: 8 + s * 4, energy: -3 }, fame: 1 }),
  kinanda: (s) => ({ act: 'kinanda', emoji: '🎹', name: 'Piga kinanda', nameEn: 'Play the keys', secs: 16, effects: { fun: 9 + s * 4, energy: -3 }, fame: 1 }),
  soma: (s) => ({ act: 'soma', emoji: '📚', name: 'Soma kitabu', nameEn: 'Read a book', secs: 14, effects: { fun: 6 + s * 4, energy: -2 } }),
  bao: (s) => ({ act: 'bao', emoji: '♟️', name: 'Cheza bao', nameEn: 'Play bao', secs: 12, effects: { fun: 8 + s * 4, social: 8 } }),
  mazoezi: (s) => ({ act: 'mazoezi', emoji: '💪', name: 'Fanya mazoezi', nameEn: 'Work out', secs: 15, effects: { energy: -10, hygiene: -10, fun: 4 + s * 2 }, health: 3 + s * 2 }),
  chora: (s) => ({ act: 'chora', emoji: '🎨', name: 'Chora picha', nameEn: 'Paint', secs: 16, effects: { fun: 10 + s * 4 }, fame: 1 }),
  tazama: (s) => ({ act: 'tazama', emoji: '🐠', name: 'Tazama samaki', nameEn: 'Watch the fish', secs: 10, effects: { fun: 6 + s * 3, energy: 3 } }),
  jitazame: () => ({ act: 'jitazame', emoji: '🪞', name: 'Jiweke sawa', nameEn: 'Fix your look', secs: 6, effects: { hygiene: 8, fun: 3 } }),
  cheza: (s) => ({ act: 'cheza', emoji: '🐾', name: 'Cheza naye', nameEn: 'Play with your pet', secs: 12, effects: { fun: 12 + s * 4, social: 8 + s * 2 } }),
  kahawa: (s) => ({ act: 'kahawa', emoji: '☕', name: 'Tengeneza kahawa', nameEn: 'Make coffee', secs: 6, cost: 500, effects: { energy: 12 + s * 3, fun: 2 } }),
  juisi: () => ({ act: 'juisi', emoji: '🥭', name: 'Tengeneza juisi ya embe', nameEn: 'Blend a mango juice', secs: 6, cost: 1_000, effects: { hunger: 12, energy: 6 } }),
  nawa: () => ({ act: 'nawa', emoji: '🧼', name: 'Nawa uso', nameEn: 'Wash up', secs: 5, effects: { hygiene: 22 } }),
  jacuzzi: (s) => ({ act: 'jacuzzi', emoji: '🛁', name: 'Jipumzishe kwenye jacuzzi', nameEn: 'Soak in the jacuzzi', secs: 18, effects: { hygiene: 60, fun: 20 + s * 4, energy: 10 } }),
};
const F = (id, cat, name, nameEn, price, stars, size, color, use) => ({ id, cat, name, nameEn, price, stars, size, color, use: use ? U[use](stars) : null });
export const FURNITURE = [
  F('mkeka', 'sleep', 'Godoro na Mkeka', 'Floor Mattress', 0, 1, [1, 2], '#a16207', 'lala'),
  F('bed-single', 'sleep', 'Kitanda cha Mtu Mmoja', 'Single Bed', 45_000, 2, [1, 2], '#1d4ed8', 'lala'),
  F('bed-double', 'sleep', 'Kitanda cha Watu Wawili', 'Double Bed', 180_000, 3, [2, 2], '#f97316', 'lala'),
  F('bed-king', 'sleep', 'Kitanda cha Kifahari', 'King Bed', 650_000, 4, [2, 3], '#7c3aed', 'lala'),
  F('chair-plastic', 'sit', 'Kiti cha Plastiki', 'Plastic Chair', 5_000, 1, [1, 1], '#dc2626', 'kaa'),
  F('armchair', 'sit', 'Kiti cha Kupumzikia', 'Lounge Armchair', 90_000, 2, [1, 1], '#eab308', 'kaa'),
  F('sofa-velvet', 'sit', 'Sofa ya Velvet', 'Velvet Sofa', 120_000, 2, [2, 1], '#15803d', 'kaa'),
  F('sofa-3', 'sit', 'Sofa ya Watu Watatu', '3-Seater Family Sofa', 260_000, 3, [3, 1], '#c2410c', 'kaa'),
  F('sofa-leather', 'sit', 'Sofa ya Ngozi', 'Italian Leather Sofa', 480_000, 4, [2, 1], '#111827', 'kaa'),
  F('jiko', 'kitchen', 'Jiko la Mkaa', 'Charcoal Stove', 0, 1, [1, 1], '#374151', 'pika'),
  F('cooker', 'kitchen', 'Jiko la Gesi', 'Gas Cooker', 140_000, 3, [1, 1], '#e5e7eb', 'pika'),
  F('fridge', 'kitchen', 'Friji', 'Fridge', 220_000, 3, [1, 1], '#f8fafc', 'snack'),
  F('table-dining', 'kitchen', 'Meza ya Chakula', 'Dining Table', 66_000, 2, [2, 2], '#92400e', null),
  F('ndoo', 'bath', 'Ndoo ya Kuogea', 'Bucket Bath', 0, 1, [1, 1], '#2563eb', 'oga'),
  F('shower', 'bath', 'Bafu la Shower', 'Shower', 160_000, 3, [1, 1], '#bae6fd', 'oga'),
  F('toilet', 'bath', 'Choo cha Kisasa', 'Toilet', 70_000, 2, [1, 1], '#f8fafc', 'choo'),
  F('bathtub', 'bath', 'Bafu la Kuogelea', 'Bathtub', 520_000, 4, [2, 1], '#f8fafc', 'oga'),
  F('radio', 'tech', 'Redio', 'Radio', 15_000, 1, [1, 1], '#7c2d12', 'burudika'),
  F('speaker', 'tech', 'Spika ya Bongo Flava', 'Party Speaker', 180_000, 3, [1, 1], '#111827', 'burudika'),
  F('tv', 'tech', 'TV ya Flat', 'Flat TV', 300_000, 3, [2, 1], '#0b0f17', 'burudika'),
  F('laptop', 'tech', 'Meza na Laptop', 'Desk & Laptop', 350_000, 3, [2, 1], '#a16207', 'surf'),
  F('plant', 'decor', 'Mmea', 'Potted Plant', 8_000, 1, [1, 1], '#16a34a', null),
  F('lamp', 'light', 'Taa ya Sakafu', 'Floor Lamp', 18_000, 1, [1, 1], '#fde68a', null),
  F('rug', 'decor', 'Zulia la Kitenge', 'Kitenge Rug', 25_000, 2, [2, 2], '#f59e0b', null),
  F('art', 'decor', 'Picha ya Tingatinga', 'Tingatinga Painting', 60_000, 3, [1, 1], '#0ea5e9', null),
  // ---- more seating, sleep, kitchen & bath
  F('beanbag', 'sit', 'Bean Bag', 'Bean Bag', 55_000, 2, [1, 1], '#db2777', 'kaa'),
  F('egg-chair', 'sit', 'Kiti cha Kuning’inia', 'Hanging Egg Chair', 210_000, 3, [1, 1], '#f5f5f4', 'kaa'),
  F('machela', 'sleep', 'Machela ya Kamba', 'Rope Hammock', 70_000, 2, [2, 1], '#ea580c', 'lala'),
  F('coffee', 'kitchen', 'Mashine ya Kahawa', 'Coffee Machine', 160_000, 3, [1, 1], '#292524', 'kahawa'),
  F('blender', 'kitchen', 'Blenda ya Juisi', 'Juice Blender', 60_000, 2, [1, 1], '#fb923c', 'juisi'),
  F('counter', 'kitchen', 'Kaunta ya Jikoni', 'Kitchen Island', 240_000, 3, [2, 1], '#e7e5e4', null),
  F('sink', 'bath', 'Sinki na Kioo', 'Vanity Sink', 85_000, 2, [1, 1], '#f8fafc', 'nawa'),
  F('jacuzzi', 'bath', 'Jacuzzi', 'Jacuzzi', 2_400_000, 5, [2, 2], '#38bdf8', 'jacuzzi'),
  // ---- fun
  F('tv-65', 'fun', 'Smart TV ya Inchi 65', '65" Smart TV', 900_000, 4, [2, 1], '#0b0f17', 'burudika'),
  F('ps5', 'fun', 'PS5 na Kiti cha Gaming', 'PS5 Gaming Setup', 1_200_000, 4, [2, 1], '#111827', 'game'),
  F('arcade', 'fun', 'Mashine ya Arcade', 'Arcade Machine', 450_000, 3, [1, 1], '#7c3aed', 'game'),
  F('snooker', 'fun', 'Meza ya Pool', 'Pool Table', 1_600_000, 4, [3, 2], '#15803d', 'pool'),
  F('foosball', 'fun', 'Foosball (Kibao Mpira)', 'Foosball Table', 280_000, 3, [2, 1], '#a16207', 'pool'),
  F('dj-decks', 'fun', 'Meza ya DJ', 'DJ Decks', 750_000, 4, [2, 1], '#111827', 'dj'),
  F('karaoke', 'fun', 'Mashine ya Karaoke', 'Karaoke Machine', 320_000, 3, [1, 1], '#ec4899', 'imba'),
  // ---- skills
  F('guitar', 'skills', 'Gitaa', 'Acoustic Guitar', 120_000, 2, [1, 1], '#b45309', 'gitaa'),
  F('keyboard', 'skills', 'Kinanda', 'Keyboard Piano', 380_000, 3, [2, 1], '#111827', 'kinanda'),
  F('bookshelf', 'skills', 'Kabati la Vitabu', 'Bookshelf', 150_000, 2, [2, 1], '#78350f', 'soma'),
  F('bao', 'skills', 'Bao la Kiswahili', 'Bao Board Game', 45_000, 2, [1, 1], '#92400e', 'bao'),
  F('easel', 'skills', 'Easel ya Kuchora', 'Painting Easel', 90_000, 2, [1, 1], '#d6d3d1', 'chora'),
  F('weights', 'skills', 'Vyuma vya Mazoezi', 'Dumbbell Rack', 140_000, 2, [1, 1], '#374151', 'mazoezi'),
  F('treadmill', 'skills', 'Treadmill', 'Treadmill', 900_000, 4, [1, 2], '#1f2937', 'mazoezi'),
  // ---- light
  F('kandili', 'light', 'Kandili', 'Kerosene Lantern', 6_000, 1, [1, 1], '#f59e0b', null),
  F('fairy', 'light', 'Taa za Mapambo', 'Fairy Lights', 45_000, 2, [2, 1], '#fde047', null),
  F('rgb-lamp', 'light', 'Taa ya LED (RGB)', 'Smart RGB Lamp', 95_000, 3, [1, 1], '#a855f7', null),
  F('neon', 'light', 'Neon ya "BONGO"', '"BONGO" Neon Sign', 140_000, 3, [2, 1], '#f472b6', null),
  F('chandelier', 'light', 'Chandelier', 'Crystal Chandelier', 850_000, 4, [1, 1], '#fef3c7', null),
  // ---- decor
  F('aquarium', 'decor', 'Tangi la Samaki', 'Aquarium', 420_000, 3, [2, 1], '#0ea5e9', 'tazama'),
  F('mirror', 'decor', 'Kioo Kikubwa', 'Standing Mirror', 75_000, 2, [1, 1], '#d4d4d8', 'jitazame'),
  F('vase', 'decor', 'Chombo cha Maua', 'Flower Vase', 30_000, 2, [1, 1], '#e11d48', null),
  F('clock', 'decor', 'Saa ya Ukutani', 'Wall Clock', 22_000, 1, [1, 1], '#111827', null),
  F('shield', 'decor', 'Ngao ya Kimasai', 'Maasai Shield', 85_000, 3, [1, 1], '#b91c1c', null),
  F('zanzibar-door', 'decor', 'Mlango wa Zanzibar', 'Zanzibar Door', 1_100_000, 5, [2, 1], '#78350f', null),
  // ---- pets
  F('dog', 'pets', 'Mbwa', 'Dog', 300_000, 3, [1, 1], '#a16207', 'cheza'),
  F('cat', 'pets', 'Paka', 'Cat', 150_000, 2, [1, 1], '#f97316', 'cheza'),
  F('parrot', 'pets', 'Kasuku', 'Parrot', 200_000, 3, [1, 1], '#16a34a', 'cheza'),
];
export const furnitureById = Object.fromEntries(FURNITURE.map((f) => [f.id, f]));
// Starter furniture every new home gets.
export const STARTER_HOME = [
  { item: 'mkeka', x: 4, z: -3, rot: 0 },
  { item: 'radio', x: 2.5, z: -4.5, rot: 0 },
  { item: 'ndoo', x: -4.5, z: 4.5, rot: 0 },
  { item: 'jiko', x: 5.5, z: 3.5, rot: 0 },
  { item: 'chair-plastic', x: -1.5, z: -1.5, rot: 0 },
  { item: 'chair-plastic', x: -0.5, z: -1.5, rot: 0 },
  { item: 'plant', x: -5.5, z: -4.5, rot: 0 },
];
/** Footprint of an item after rotation, as [w, d]. */
export const footprint = (def, rot) => (rot % 2 ? [def.size[1], def.size[0]] : def.size);
export function homeFits(def, x, z, rot, others = []) {
  const [w, d] = footprint(def, rot);
  if (Math.abs(x) + w / 2 > HOME.w / 2 + 1e-6 || Math.abs(z) + d / 2 > HOME.d / 2 + 1e-6) return false;
  return !others.some((o) => {
    const od = furnitureById[o.item];
    if (!od) return false;
    const [ow, odd] = footprint(od, o.rot);
    return Math.abs(o.x - x) * 2 < w + ow - 1e-6 && Math.abs(o.z - z) * 2 < d + odd - 1e-6;
  });
}

// ---------------------------------------------------------------- health
// Health is separate from the needs: traffic accidents and neglect lower it, the hospital restores it.
export const HEALTH = {
  injuredBelow: 40, // below this you walk slowly and can't work
  accidentDamage: 45,
  accidentCooldownMs: 120_000,
  ambulanceCost: 5_000,
  neglectDrain: 0.5, // per needs tick while starving or exhausted
};
export const HOSPITAL_ID = 'hospitali';
export const POLICE_ID = 'polisi';

// ------------------------------------------------------- city-to-city trips
// Prices keyed by the two city ids sorted alphabetically.
export const tripKey = (a, b) => [a, b].sort().join('-');
export const TRIP_MODES = {
  flight: { emoji: '✈️', name: 'Ndege', nameEn: 'Flight', secs: 60, ins: 10_000, risk: 1 / 8, price: { 'dar-znz': 95_000, 'aru-dar': 260_000, 'aru-znz': 320_000 }, note: ['Teksi hadi uwanja imejumuishwa', 'Cab to the airport included'] },
  heli: { emoji: '🚁', name: 'Helikopta', nameEn: 'Helicopter', secs: 40, ins: 60_000, risk: 1 / 12, price: { 'dar-znz': 1_800_000, 'aru-dar': 4_500_000, 'aru-znz': 5_000_000 }, note: ['Kutoka mlangoni hadi mlangoni', 'Door to door'] },
  ferry: { emoji: '⛴️', name: 'Boti ya Azam', nameEn: 'Azam fast ferry', secs: 70, ins: 5_000, risk: 1 / 7, price: { 'dar-znz': 40_000 }, note: ['Kivukoni hadi Bandari ya Zanzibar', 'Kivukoni to Zanzibar Port'] },
  bus: { emoji: '🚌', name: 'Basi la abiria', nameEn: 'Coach', secs: 80, ins: 5_000, risk: 1 / 6, price: { 'aru-dar': 45_000 }, note: ['Magufuli hadi stendi kuu ya Arusha', 'Magufuli terminal to Arusha'] },
  car: { emoji: '🚗', name: 'Endesha gari lako', nameEn: 'Drive', secs: 75, ins: 20_000, risk: 1 / 5, own: true, price: { 'aru-dar': 70_000 }, note: ['Mafuta tu, lakini utafika umechoka', "Fuel only, but you'll arrive tired"] },
};
// What a flight looks like on arrival in each city.
export const CITY_ARRIVAL = { znz: { dest: 'ZANZIBAR', ground: '#0e7490', land: '#fde68a' }, aru: { dest: 'ARUSHA · KILIMANJARO', ground: '#4d7c0f', land: '#a3e635' }, dar: { dest: 'DAR ES SALAAM', ground: '#0e7490', land: '#86efac' } };
// Where you arrive in each city, by mode.
export const ARRIVAL_PLACE = { dar: { flight: 'airport', heli: 'airport', ferry: 'ferry', bus: 'stendi', car: 'stendi' }, znz: { flight: 'zn-airport', heli: 'zn-airport', ferry: 'zn-port' }, aru: { flight: 'kia', heli: 'kia', bus: 'ar-bus', car: 'ar-bus' } };

// ---------------------------------------------------------------- casino
// Game money only (it can never be cashed out). House edge keeps it a money sink.
export const CASINO = {
  minBet: 1_000,
  maxBet: 500_000,
  slots: { symbols: ['🍒', '🍋', '🔔', '⭐', '💎', '7️⃣'], weights: [30, 25, 18, 13, 9, 5], three: [5, 8, 12, 25, 50, 150], twoCherries: 2 },
  roulette: { redNumbers: [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36] },
};
export const COURT_ID = 'mahakama';

// ---------------------------------------------------------------- crime
export const CRIME = {
  robRange: 10, // must be this close to rob someone
  robCooldownMs: 10 * 60_000,
  robSuccess: 0.55, // otherwise the police catch you on the spot
  robPct: 0.1, // share of the victim's cash taken…
  robMin: 2_000,
  robMax: 250_000, // …capped
  reportWindowMs: 30 * 60_000, // victims can report within this time
  catchChance: 0.7, // police catch a reported robber
  fine: 100_000,
  cellMs: 3 * 60_000,
  bailPct: 0.6, // bail = 60% of the fine
  lawyerFee: 35_000,
  courtDelayMs: 2 * 60_000,
  winChance: 0.55,
};
// Quick ways to interact with someone you're standing next to.
export const INTERACTIONS = [
  { id: 'hello', emoji: '👋', name: 'Salimia', nameEn: 'Say hello', effects: { social: 6 }, them: { social: 4 } },
  { id: 'gist', emoji: '💬', name: 'Piga stori', nameEn: 'Gist', effects: { social: 10, fun: 6 }, them: { social: 8, fun: 4 } },
  { id: 'joke', emoji: '😂', name: 'Piga utani', nameEn: 'Crack a joke', chance: 0.84, effects: { fun: 12, social: 8 }, them: { fun: 10, social: 6 }, fail: { fun: -4, social: -2 } },
  { id: 'shade', emoji: '😒', name: 'Mpige kijembe', nameEn: 'Throw shade', effects: { fun: 8, social: 3 }, them: { fun: -3 } },
];
export const INTERACT_RANGE = 14;
export const REPORT_REASONS = [
  ['harass', 'Ananinyanyasa au kunionea', 'Harassing or bullying me'],
  ['sexual', 'Jumbe za ngono au za kutisha', 'Sexual or creepy messages'],
  ['hate', 'Chuki au matusi', 'Hate or insults'],
  ['scam', 'Utapeli au kuomba pesa', 'Scam or asking for money'],
  ['spam', 'Spam', 'Spam'],
  ['other', 'Kitu kingine', 'Something else'],
];

/** Stage of a flight from the trip fraction (0..1). */
export const FLIGHT_PHASES = [
  [0, 'boarding', 'Kupanda ndege', 'Boarding'],
  [0.16, 'takeoff', 'Ndege inapaa', 'Take-off'],
  [0.32, 'cruise', 'Angani', 'Cruising'],
  [0.8, 'landing', 'Inatua', 'Landing'],
];
export const flightPhase = (f) => {
  let p = FLIGHT_PHASES[0];
  for (const ph of FLIGHT_PHASES) if (f >= ph[0]) p = ph;
  return p;
};

// ---------------------------------------------------------------- events
export const EVENT_LIMITS = { titleMax: 40, descMax: 140, maxActivePerHost: 3, minLeadMs: 5 * 60_000, maxAheadMs: 7 * 86400_000, windowBeforeMs: 30 * 60_000, windowAfterMs: 3 * 3600_000 };
export const EVENT_PLACES = ['home', 'club', 'bar', 'lounge', 'singeli', 'nyamachoma', 'serena', 'coco', 'kigbeach', 'slipway', 'waterpark', 'karting', 'golf', 'makumbusho', 'uwanja', 'mall', 'masakigrill', 'studio'];
// Venues without their own walk-in interior use this scene while a party is live there.
// Every place has an inside: explicit venues first, then the closest interior for its type.
const TYPE_SCENES = { market: 'shop', mall: 'shop', shop: 'shop', stonetown: 'shop', restaurant: 'dining', food: 'dining', fish: 'dining', grill: 'grill', bar: 'bar', club: 'club', lounge: 'club', hotel: 'rooftop', gesti: 'room', beach: 'beach', waterpark: 'waterpark', golf: 'golf', karting: 'karting', slipway: 'dhow', stage: 'concert', stadium: 'stadium', studio: 'studio', gym: 'gym', salon: 'salon', office: 'office', tower: 'office', bank: 'bank', hospital: 'hospital', campus: 'classroom', police: 'police', court: 'court', casino: 'casino', safari: 'safari', mountain: 'hike', forest: 'safari', museum: 'ngoma' };
/** The interior scene for a place, or null for open-air landmarks (ports, airports…). */
export function venueOf(placeId) {
  const p = placeById[placeId];
  if (!p) return null;
  return ENTERABLE[placeId] || EVENT_SCENES[placeId] || TYPE_SCENES[p.type] || null;
}
export const EVENT_SCENES = { coco: 'beach', kigbeach: 'beach', mall: 'cinema', masakigrill: 'dining', waterpark: 'waterpark', serena: 'rooftop', karting: 'karting', slipway: 'dhow', golf: 'golf', makumbusho: 'ngoma' };
// Places you can invite someone to hang out at.
export const HANGOUT_PLACES = ['club', 'lounge', 'bar', 'singeli', 'nyamachoma', 'coco', 'waterpark', 'karting', 'serena', 'slipway', 'mall', 'masakigrill', 'kinyozi', 'golf', 'makumbusho', 'uwanja', 'gym', 'mamantilie'];
export const isEventLive = (e, t = Date.now()) => !e.cancelled && e.starts_at <= t && t <= e.starts_at + EVENT_LIMITS.windowAfterMs;

// ============================================================ ambitions & storylines
// Pick a life path; each chapter tells a bit of story, sets a goal and pays a reward.
// Goal kinds: stat (counter from play), fame, money (cash), worth (net worth), friends,
// plots, house, assets (businesses + trucks), mayor.
const ch = (title, story, goal, hint, go, reward) => ({ title, story, goal, hint, go, reward });
export const AMBITIONS = [
  {
    id: 'msanii', emoji: '🎤', name: ['Nyota wa Bongo Flava', 'Bongo Flava Star'], color: ['#ec4899', '#7c3aed'],
    blurb: ['Kutoka kuimba bafuni hadi kujaza Uwanja wa Taifa.', 'From singing in the shower to selling out the National Stadium.'],
    chapters: [
      ch(['Ndoto inaanza', 'The dream begins'], ['Una mistari kichwani tangu shule. Leo unaingia studio kwa mara ya kwanza — producer anakusubiri.', "You've had bars in your head since school. Today you step into a studio for the first time — the producer is waiting."], { stat: 'type:studio', n: 1 }, ['Rekodi kwenye Studio ya Bongo Flava', 'Record at the Bongo Flava Studio'], { place: 'studio' }, { money: 50_000, fame: 2 }),
      ch(['Mtaa usikie', 'Let the streets hear it'], ['Wimbo uko tayari, lakini hakuna anayekujua. Mbagala ndiko singeli inazaliwa — panda jukwaani.', "The track is ready, but nobody knows you. Mbagala is where singeli is born — get on that stage."], { stat: 'place:singeli', n: 2 }, ['Cheza Uwanja wa Singeli Mbagala mara 2', 'Perform at Mbagala Singeli Ground twice'], { place: 'singeli' }, { money: 100_000, fame: 3 }),
      ch(['Jina linakua', 'The name is growing'], ['Watu wameanza kukuita kwa jina la usanii. Endelea kujituma — umaarufu ndio mtaji.', 'People are calling you by your stage name now. Keep grinding — fame is capital.'], { fame: 25 }, ['Fikia umaarufu ⭐25', 'Reach ⭐25 fame'], null, { money: 250_000, fame: 0 }),
      ch(['EP ya kwanza', 'The first EP'], ['Label ndogo inataka EP. Rudi studio, rekodi nyimbo zaidi na video.', 'A small label wants an EP. Back to the studio — more tracks and a video.'], { stat: 'type:studio', n: 5 }, ['Vipindi 5 vya studio', '5 studio sessions'], { place: 'studio' }, { money: 500_000, fame: 5 }),
      ch(['Show ya Zanzibar', 'The Zanzibar show'], ['Kendwa Rocks wanakualika kwenye full moon party. Panda boti au ndege — usikose!', "Kendwa Rocks invites you to the full moon party. Take the ferry or a flight — don't miss it!"], { stat: 'place:kendwa', n: 1 }, ['Tumbuiza Kendwa Rocks, Zanzibar', 'Perform at Kendwa Rocks, Zanzibar'], { place: 'kendwa' }, { money: 1_000_000, fame: 10 }),
      ch(['Nyota wa Taifa', 'National star'], ['Redio zote zinapiga wimbo wako. Kitu kimoja kimebaki: kuwa jina kubwa kuliko wote.', 'Every radio station plays your song. One thing left: become the biggest name of all.'], { fame: 150 }, ['Fikia umaarufu ⭐150', 'Reach ⭐150 fame'], null, { money: 5_000_000, fame: 20 }),
    ],
  },
  {
    id: 'tajiri', emoji: '💼', name: ['Tajiri wa Bongo', 'Bongo Tycoon'], color: ['#16a34a', '#065f46'],
    blurb: ['Kutoka kwenye shifti ya kwanza hadi bilionea wa Masaki.', 'From your first shift to a Masaki billionaire.'],
    chapters: [
      ch(['Chakarika', 'The hustle'], ['Kila tajiri alianzia mahali. Tafuta kazi, piga shifti, jenga nidhamu ya pesa.', 'Every rich person started somewhere. Find a job, work shifts, build money discipline.'], { stat: 'shifts', n: 3 }, ['Fanya shifti 3 za kazi', 'Work 3 shifts'], { app: 'kazi' }, { money: 100_000, fame: 1 }),
      ch(['Akiba', 'Savings'], ['Pesa ya matumizi si mtaji. Weka akiba ya kutosha kununua ardhi.', "Spending money isn't capital. Save enough to buy land."], { money: 5_000_000 }, ['Kuwa na TSh 5M mkononi', 'Hold TSh 5M in cash'], null, { money: 200_000, fame: 1 }),
      ch(['Kiwanja cha kwanza', 'First plot'], ['Ardhi haipotei thamani. Nunua kiwanja chako cha kwanza.', "Land doesn't lose value. Buy your first plot."], { plots: 1 }, ['Nunua kiwanja (app ya Wekeza)', 'Buy a plot (Invest app)'], { app: 'wekeza' }, { money: 500_000, fame: 2 }),
      ch(['Nyumba yangu', 'My own house'], ['Kiwanja kitupu hakileti kodi. Jenga nyumba — ukae au upangishe.', "An empty plot pays no rent. Build a house — live in it or rent it out."], { house: 1 }, ['Jenga nyumba kwenye kiwanja chako', 'Build a house on your plot'], { app: 'mali' }, { money: 1_000_000, fame: 3 }),
      ch(['Pesa ikufanyie kazi', 'Make money work for you'], ['Matajiri hawalali na pesa — wanaiwekeza. Nunua biashara au lori la mizigo.', "The rich don't sit on cash — they invest it. Buy a business or a haulage truck."], { assets: 1 }, ['Anzisha kampuni, nunua biashara au lori', 'Start a company, buy a business or a truck'], { app: 'wekeza' }, { money: 2_000_000, fame: 5 }),
      ch(['Bilionea', 'Billionaire'], ['Jina lako linatajwa kwenye vikao vya biashara. Lengo la mwisho: mali ya TSh nusu bilioni.', 'Your name comes up in boardrooms. Final goal: half a billion in net worth.'], { worth: 500_000_000 }, ['Mali yenye thamani TSh 500M', 'TSh 500M net worth'], { app: 'wekeza' }, { money: 10_000_000, fame: 20 }),
    ],
  },
  {
    id: 'mwanasiasa', emoji: '🗳️', name: ['Mwanasiasa', 'Politician'], color: ['#f59e0b', '#b45309'],
    blurb: ['Jenga mtandao, shinda mioyo, uwe Meya wa jiji.', 'Build a network, win hearts, become the city Mayor.'],
    chapters: [
      ch(['Wajue watu', 'Know people'], ['Siasa ni watu. Anza kwa kupata marafiki wa kweli mtaani.', 'Politics is people. Start by making real friends on the street.'], { friends: 3 }, ['Pata marafiki 3', 'Make 3 friends'], { app: 'watu' }, { money: 100_000, fame: 1 }),
      ch(['Kusanya watu', 'Bring people together'], ['Kiongozi huwakusanya watu. Andaa tukio — sherehe, mechi au chakula.', 'A leader brings people together. Host an event — a party, a match, a meal.'], { stat: 'hosted', n: 1 }, ['Andaa tukio (app ya Matukio)', 'Host an event (Events app)'], { app: 'matukio' }, { money: 200_000, fame: 3 }),
      ch(['Sauti ya mtaa', 'Voice of the street'], ['Watu wanaanza kukusikiliza. Ongeza jina lako.', 'People are starting to listen. Grow your name.'], { fame: 30 }, ['Fikia umaarufu ⭐30', 'Reach ⭐30 fame'], null, { money: 300_000, fame: 0 }),
      ch(['Kugombea', 'Running'], ['Ni wakati. Jiandikishe kugombea umeya wiki hii.', "It's time. Register to run for Mayor this week."], { stat: 'ran', n: 1 }, ['Jiandikishe kugombea Meya', 'Register to run for Mayor'], { app: 'viongozi' }, { money: 500_000, fame: 3 }),
      ch(['Kampeni', 'Campaign'], ['Kura hazitoki hewani. Jenga ngome — marafiki kumi watakaokupigia kura.', "Votes don't fall from the sky. Build a base — ten friends who'll vote for you."], { friends: 10 }, ['Pata marafiki 10', 'Have 10 friends'], { app: 'watu' }, { money: 1_000_000, fame: 5 }),
      ch(['Mheshimiwa Meya', 'Your Honour the Mayor'], ['Siku ya kura imefika. Shinda uchaguzi na uongoze Dar.', 'Election day is here. Win and lead Dar.'], { mayor: 1 }, ['Shinda uchaguzi wa Meya', 'Win the Mayor election'], { app: 'viongozi' }, { money: 5_000_000, fame: 30 }),
    ],
  },
  {
    id: 'msafiri', emoji: '🌍', name: ['Msafiri', 'Explorer'], color: ['#0ea5e9', '#1d4ed8'],
    blurb: ['Zanzibar, Arusha, Serengeti hadi kilele cha Kilimanjaro.', 'Zanzibar, Arusha, the Serengeti and the top of Kilimanjaro.'],
    chapters: [
      ch(['Jua mji wako', 'Know your city'], ['Kabla ya kuona dunia, jua Dar. Panda daladala, bajaji au boda kwenda mahali.', 'Before seeing the world, know Dar. Ride a daladala, bajaji or boda somewhere.'], { stat: 'rides', n: 2 }, ['Safari 2 za usafiri wa mjini', 'Take 2 rides around town'], { app: 'ramani' }, { money: 30_000, fame: 1 }),
      ch(['Kisiwani', 'To the island'], ['Harufu ya karafuu inakuita. Panda boti ya Azam au ndege kwenda Zanzibar.', 'The scent of cloves is calling. Take the Azam ferry or a flight to Zanzibar.'], { stat: 'city:znz', n: 1 }, ['Fika Zanzibar', 'Get to Zanzibar'], { place: 'stonetown' }, { money: 150_000, fame: 2 }),
      ch(['Mji Mkongwe', 'Stone Town'], ['Vichochoro, milango ya kuchonga, historia kila kona. Tembelea Stone Town.', 'Alleys, carved doors, history on every corner. Explore Stone Town.'], { stat: 'place:stonetown', n: 1 }, ['Fanya kitu Stone Town', 'Do something in Stone Town'], { place: 'stonetown' }, { money: 150_000, fame: 2 }),
      ch(['Kaskazini', 'Up north'], ['Arusha — mji wa safari. Panda ndege, basi au endesha gari lako.', 'Arusha — the safari capital. Fly, take the coach or drive yourself.'], { stat: 'city:aru', n: 1 }, ['Fika Arusha', 'Get to Arusha'], { place: 'safari' }, { money: 300_000, fame: 3 }),
      ch(['Big Five', 'The Big Five'], ['Simba, tembo, twiga… Panda gari la safari uwaone kwa macho yako.', 'Lions, elephants, giraffes… Get in a safari jeep and see them yourself.'], { stat: 'place:safari', n: 1 }, ['Nenda safari', 'Go on safari'], { place: 'safari' }, { money: 500_000, fame: 5 }),
      ch(['Paa la Afrika', 'Roof of Africa'], ['Mita 5,895 juu ya bahari. Panda Kilimanjaro hadi Uhuru Peak.', '5,895 metres above the sea. Climb Kilimanjaro to Uhuru Peak.'], { stat: 'act:kili', n: 1 }, ['Panda Kilimanjaro', 'Climb Kilimanjaro'], { place: 'meru' }, { money: 3_000_000, fame: 20 }),
    ],
  },
  {
    id: 'sosholaiti', emoji: '💃', name: ['Sosholaiti', 'Socialite'], color: ['#f43f5e', '#be123c'],
    blurb: ['Kila mtu anakujua, kila sherehe inakusubiri.', 'Everyone knows you, every party waits for you.'],
    chapters: [
      ch(['Salamu', 'Hellos'], ['Bongo ni salamu. Msalimie mtu, piga stori, mchekeshe.', 'Bongo runs on greetings. Say hi, gist, crack a joke.'], { stat: 'interact', n: 3 }, ['Ongea na watu mara 3', 'Chat with players 3 times'], null, { money: 50_000, fame: 1 }),
      ch(['Jirani mwema', 'Good neighbour'], ['Gonga mlango wa jirani — chai, stori na kicheko.', "Knock on a neighbour's door — tea, gist and laughs."], { stat: 'visits', n: 1 }, ['Tembelea jirani', 'Visit a neighbour'], { app: 'majirani' }, { money: 100_000, fame: 2 }),
      ch(['Usiku wa Dar', 'Dar nights'], ['Club ndiko mastaa wanaonekana. Toka usiku mara tatu.', 'The clubs are where the stars get seen. Go out three nights.'], { stat: 'type:club', n: 3 }, ['Fanya kitu club mara 3', 'Do something at a club 3 times'], { place: 'club' }, { money: 200_000, fame: 3 }),
      ch(['Mtandao', 'Network'], ['Sosholaiti wa kweli ana watu kila kona. Fikisha marafiki 10.', 'A real socialite has people everywhere. Get to 10 friends.'], { friends: 10 }, ['Marafiki 10', '10 friends'], { app: 'watu' }, { money: 500_000, fame: 3 }),
      ch(['Mwenyeji', 'The host'], ['Sasa ni zamu yako kuwakaribisha. Andaa matukio mawili.', 'Now it’s your turn to host. Throw two events.'], { stat: 'hosted', n: 2 }, ['Andaa matukio 2', 'Host 2 events'], { app: 'matukio' }, { money: 1_000_000, fame: 5 }),
      ch(['Malkia/Mfalme wa Jiji', 'Queen/King of the City'], ['Kila picha ya sherehe una wewe. Fikia umaarufu wa juu.', "You're in every party photo. Reach the top of fame."], { fame: 100 }, ['Fikia umaarufu ⭐100', 'Reach ⭐100 fame'], null, { money: 3_000_000, fame: 15 }),
    ],
  },
];
export const ambitionById = Object.fromEntries(AMBITIONS.map((a) => [a.id, a]));
export const STORY = { switchCooldownMs: 24 * 3600_000, dilemmaEveryMs: 6 * 3600_000 };

// "Mambo ya mtaa": street dilemmas, one every few hours. Outcomes may be chancy.
// effects: money (TSh, or pct of cash when |x|<1), fame, needs, chance → win/lose.
export const DILEMMAS = [
  { id: 'binamu', emoji: '📞', text: ['Binamu yako kutoka Mwanza anapiga simu: anahitaji TSh 50,000 ya ada ya shule.', 'Your cousin from Mwanza calls: they need TSh 50,000 for school fees.'],
    choices: [
      { label: ['Mtumie 💸', 'Send it 💸'], out: { money: -50_000, fame: 1, needs: { social: 15 }, msg: ['Familia inakusifu. Baraka zimekujia. 🙏', 'The family is singing your praises. Blessings are coming. 🙏'] } },
      { label: ['Sina sasa hivi', "Can't right now"], out: { needs: { social: -8 }, msg: ['Alielewa… lakini shangazi amesikia. 😬', 'They understood… but auntie heard about it. 😬'] } },
    ] },
  { id: 'dili', emoji: '📱', text: ['Jamaa wa Kariakoo ana "dili": simu za mkononi nusu bei. Anataka TSh 200,000 sasa hivi.', 'A Kariakoo guy has a "deal": phones at half price. He wants TSh 200,000 right now.'],
    choices: [
      { label: ['Weka pesa 🤝', 'Put the money in 🤝'], out: { chance: 0.4, win: { money: 500_000, msg: ['Dili limetiki! Umeuza zote — faida TSh 300k. 🔥', 'The deal came through! Sold the lot — TSh 300k profit. 🔥'] }, lose: { money: -200_000, msg: ['Jamaa amepotea na pesa yako. Simu zilikuwa feki. 😤', 'The guy vanished with your money. The phones were fake. 😤'] } } },
      { label: ['Hapana, asante', 'No thanks'], out: { msg: ['Wiki ijayo unasikia polisi wamemkamata. Umepona! 😅', 'Next week you hear the police caught him. Dodged that one! 😅'] } },
    ] },
  { id: 'mafuriko', emoji: '🌧️', text: ['Mvua kubwa imeleta mafuriko Jangwani. Vijana wanajitolea kusaidia familia.', 'Heavy rain has flooded Jangwani. Young people are volunteering to help families.'],
    choices: [
      { label: ['Jitolee 🦺', 'Volunteer 🦺'], out: { fame: 3, needs: { energy: -20, social: 15 }, msg: ['Picha yako ikisaidia imesambaa mitandaoni. Shujaa wa mtaa! 🦸', 'A photo of you helping went viral. Street hero! 🦸'] } },
      { label: ['Kaa ndani', 'Stay in'], out: { needs: { energy: 10 }, msg: ['Umepumzika, lakini mtaa unaongea… 🤐', 'You rested, but the street is talking… 🤐'] } },
    ] },
  { id: 'producer', emoji: '🎧', text: ['Producer amesikia freestyle yako. Anataka TSh 100,000 kurekodi hook kwenye wimbo wake.', 'A producer heard your freestyle. He wants TSh 100,000 to put you on a hook.'],
    choices: [
      { label: ['Twende studio 🎤', "Let's record 🎤"], out: { money: -100_000, chance: 0.5, win: { fame: 6, msg: ['Wimbo umeshika redio! ⭐+6', 'The song is on the radio! ⭐+6'] }, lose: { fame: 1, msg: ['Wimbo haukuvuma, lakini umejifunza. ⭐+1', "The song didn't blow up, but you learned a lot. ⭐+1"] } } },
      { label: ['Siko tayari', 'Not ready'], out: { msg: ['Siku yako itafika. 🎶', 'Your day will come. 🎶'] } },
    ] },
  { id: 'mkopo', emoji: '🤲', text: ['Jirani yako anaomba mkopo wa TSh 30,000 — anaahidi kurudisha 40,000 Ijumaa.', 'Your neighbour asks to borrow TSh 30,000 — promises 40,000 back on Friday.'],
    choices: [
      { label: ['Mkopeshe', 'Lend it'], out: { chance: 0.7, win: { money: 10_000, needs: { social: 10 }, msg: ['Amerudisha 40k kama alivyoahidi. Jirani mwema! 🤝', 'They paid back 40k as promised. Good neighbour! 🤝'] }, lose: { money: -30_000, msg: ['Ijumaa imepita… na nyingine… 🙄', 'Friday came and went… and the next one… 🙄'] } } },
      { label: ['Kataa kwa upole', 'Politely decline'], out: { needs: { social: -5 }, msg: ['Ameelewa, ingawa amenuna kidogo.', 'They understood, though they sulked a little.'] } },
    ] },
  { id: 'kahawa', emoji: '☕', text: ['Karambezi Café ina shindano la kuonja kahawa. Kiingilio TSh 20,000, zawadi TSh 200,000.', 'Karambezi Café is running a coffee-tasting contest. TSh 20,000 to enter, TSh 200,000 prize.'],
    choices: [
      { label: ['Shiriki ☕', 'Enter ☕'], out: { money: -20_000, chance: 0.3, win: { money: 200_000, fame: 2, msg: ['Ulitambua kahawa ya Kilimanjaro kwa harufu tu. Bingwa! 🏆', 'You named the Kilimanjaro beans by smell alone. Champion! 🏆'] }, lose: { needs: { fun: 10 }, msg: ['Hukushinda, lakini kahawa ilikuwa tamu. 😋', "You didn't win, but the coffee was great. 😋"] } } },
      { label: ['Pita', 'Skip it'], out: { msg: ['Labda mwakani.', 'Maybe next year.'] } },
    ] },
  { id: 'harusi', emoji: '💍', text: ['Rafiki yako anaoa! Kamati ya harusi inaomba mchango wa TSh 100,000.', 'Your friend is getting married! The wedding committee asks for a TSh 100,000 contribution.'],
    choices: [
      { label: ['Changia 🎉', 'Contribute 🎉'], out: { money: -100_000, fame: 2, needs: { social: 25, fun: 20 }, msg: ['Ulitajwa kwenye hotuba na ukacheza hadi asubuhi! 💃', 'You got a shout-out in the speech and danced till morning! 💃'] } },
      { label: ['Sina hela sasa', "I'm broke right now"], out: { needs: { social: -12 }, msg: ['Hukualikwa kwenye send-off… 😶', "You weren't invited to the send-off… 😶"] } },
    ] },
  { id: 'wahuni', emoji: '🌙', text: ['Ni usiku Kariakoo na vijana wawili wanakufuata. Mmoja anakuita kwa jina.', "It's night in Kariakoo and two guys are following you. One calls your name."],
    choices: [
      { label: ['Kimbia 🏃', 'Run 🏃'], out: { needs: { energy: -15 }, msg: ['Umefika salama, unahema kama umekimbia marathon. 😮‍💨', 'You got home safe, panting like you ran a marathon. 😮‍💨'] } },
      { label: ['Simama uwakabili', 'Stand your ground'], out: { chance: 0.5, win: { fame: 2, msg: ['Kumbe ni mashabiki wako! Wameomba selfie. 🤳', 'Turns out they were fans! They wanted a selfie. 🤳'] }, lose: { money: -0.15, msg: ['Wamekunyang’anya pochi. Ripoti polisi. 😠', 'They snatched your wallet. Report it to the police. 😠'] } } },
    ] },
];
export const dilemmaById = Object.fromEntries(DILEMMAS.map((d) => [d.id, d]));

// ============================================================ investing
// Land grows in value the longer you hold it; agents take a cut when you sell.
export const INVEST = {
  landGrowthPerDay: 0.006, landGrowthCap: 0.6, agentFee: 0.05, remoteBuyFee: 0.05, buildingResale: 0.8,
  truck: { price: 18_000_000, resale: 11_000_000, earnMin: 600_000, earnMax: 1_100_000, driver: 150_000, breakChance: 0.1, repair: 500_000, max: 10, maxDays: 3 },
};

// ============================================================ neighbours: hanging out at home
// Things a visitor and host can do together indoors. Both get the effects.
export const TOGETHER = [
  { id: 'movie', emoji: '🍿', name: ['Tazameni filamu', 'Watch a movie'], effects: { fun: 20, social: 15 } },
  { id: 'fifa', emoji: '🎮', name: ['Chezeni FIFA', 'Play FIFA'], effects: { fun: 25, social: 10 } },
  { id: 'pika', emoji: '🍳', name: ['Pikeni pamoja', 'Cook together'], effects: { hunger: 30, social: 12 } },
  { id: 'chai', emoji: '☕', name: ['Chai na stori', 'Tea & gist'], effects: { social: 20, energy: 5 } },
  { id: 'muziki', emoji: '🎶', name: ['Sikilizeni muziki', 'Vibe to music'], effects: { fun: 15, social: 15 } },
  { id: 'karata', emoji: '🃏', name: ['Karata', 'Card games'], effects: { fun: 18, social: 18 } },
];
export const togetherById = Object.fromEntries(TOGETHER.map((t) => [t.id, t]));

// ============================================================ companies (start your own)
// Each evening (every 24h) a company runs a day: customers depend on price, staff, reputation,
// marketing and your fame. Profit lands in the company account; withdraw it to your wallet.
// ticket = average sale, margin = share of sales kept after stock, base = customers/day with no staff.
export const INDUSTRIES = [
  { id: 'food', emoji: '🍲', name: ['Genge la chakula', 'Food spot'], cost: 1_500_000, ticket: 4_000, margin: 0.45, base: 30, wage: 15_000, rent: 15_000, maxStaff: 4, logos: ['🍲', '🍗', '🌶️', '🍟', '🥘', '🍢'], blurb: ['Chipsi mayai, wali maharage, mishkaki. Mtaji mdogo kuanza.', 'Chips mayai, rice & beans, mishkaki. Cheap to start.'] },
  { id: 'salon', emoji: '💇🏾', name: ['Saluni', 'Salon'], cost: 3_000_000, ticket: 15_000, margin: 0.6, base: 10, wage: 25_000, rent: 30_000, maxStaff: 5, logos: ['💇🏾', '💈', '💅🏾', '✂️', '👑'], blurb: ['Kusuka, kunyoa, kucha. Wateja wa kudumu wanarudi.', 'Braids, cuts, nails. Regulars keep coming back.'] },
  { id: 'duka', emoji: '🛒', name: ['Duka la rejareja', 'Provisions'], cost: 5_000_000, ticket: 8_000, margin: 0.3, base: 45, wage: 20_000, rent: 35_000, maxStaff: 4, logos: ['🛒', '🧺', '🥫', '🧃', '🍞'], blurb: ['Sukari, unga, sabuni — wateja wengi, faida ndogo kwa kila mmoja.', 'Sugar, flour, soap — lots of customers, small margin each.'] },
  { id: 'fashion', emoji: '👗', name: ['Mitindo', 'Fashion'], cost: 9_000_000, ticket: 45_000, margin: 0.4, base: 8, wage: 30_000, rent: 60_000, maxStaff: 5, logos: ['👗', '👠', '🧥', '👜', '🕶️'], blurb: ['Vitenge, viatu, mitumba ya kwanza. Umaarufu wako unauza.', 'Kitenge, shoes, first-grade mitumba. Your fame sells.'] },
  { id: 'events', emoji: '🎉', name: ['Matukio & sherehe', 'Events'], cost: 12_000_000, ticket: 500_000, margin: 0.4, base: 1.2, wage: 30_000, rent: 70_000, maxStaff: 6, logos: ['🎉', '💍', '🎂', '🎈', '🎤'], blurb: ['Harusi, send-off, birthday. Siku chache, oda kubwa.', 'Weddings, send-offs, birthdays. Few days, big orders.'] },
  { id: 'pharmacy', emoji: '💊', name: ['Duka la dawa', 'Pharmacy'], cost: 18_000_000, ticket: 20_000, margin: 0.35, base: 40, wage: 45_000, rent: 80_000, maxStaff: 5, logos: ['💊', '🩺', '⚕️', '🧴'], blurb: ['Mahitaji hayaishi. Imara, lakini mtaji mkubwa.', 'Demand never stops. Steady, but costly to start.'] },
  { id: 'dispatch', emoji: '🛵', name: ['Usafirishaji', 'Dispatch'], cost: 25_000_000, ticket: 6_000, margin: 0.5, base: 90, wage: 35_000, rent: 70_000, maxStaff: 10, logos: ['🛵', '📦', '🚚', '🏍️'], blurb: ['Boda za delivery mjini kote. Waajiri madereva zaidi, safari zaidi.', 'Delivery bodas all over town. More riders, more trips.'] },
  { id: 'tech', emoji: '💻', name: ['Kampuni ya teknolojia', 'Tech startup'], cost: 50_000_000, ticket: 1_200_000, margin: 0.8, base: 0.6, wage: 120_000, rent: 150_000, maxStaff: 12, logos: ['💻', '📱', '🚀', '🤖', '🛰️'], blurb: ['Apps na mifumo kwa makampuni. Hatari kubwa, zawadi kubwa.', 'Apps and systems for businesses. High risk, high reward.'] },
];
export const industryById = Object.fromEntries(INDUSTRIES.map((i) => [i.id, i]));
export const COMPANY = {
  max: 2,
  prices: { cheap: { price: 0.8, cust: 1.35 }, normal: { price: 1, cust: 1 }, premium: { price: 1.35, cust: 0.7 } },
  staffBoost: 0.5, // +50% customers per staff member
  marketing: { costPct: 0.08, days: 3, boost: 0.35 },
  maxDays: 3, // unsettled days are capped (nobody minding the shop)
  sellBack: 0.5, // sell the company for half the startup cost (+ its balance)
  colors: ['#16a34a', '#0f766e', '#1d4ed8', '#7c3aed', '#db2777', '#dc2626', '#ea580c', '#111827'],
};
// Random things that happen on a company's day.
export const COMPANY_EVENTS = [
  { id: 'viral', p: 0.06, cust: 1.6, text: ['📱 Video ya biashara yako imesambaa TikTok!', '📱 A video of your business went viral on TikTok!'] },
  { id: 'umeme', p: 0.07, cust: 0.5, text: ['⚡ Umeme umekatika nusu siku.', '⚡ Power cut for half the day.'] },
  { id: 'mvua', p: 0.06, cust: 0.7, text: ['🌧️ Mvua kubwa — wateja wachache.', '🌧️ Heavy rain — fewer customers.'] },
  { id: 'tra', p: 0.05, fine: 0.04, text: ['🧾 Ukaguzi wa TRA — faini ya kodi.', '🧾 TRA inspection — tax fine.'] },
  { id: 'mteja', p: 0.05, bonus: 0.5, text: ['🤝 Mteja mkubwa ameweka oda ya jumla!', '🤝 A big client placed a bulk order!'] },
  { id: 'wizi', p: 0.03, fine: 0.03, text: ['🦹 Mfanyakazi ameiba mzigo.', '🦹 A worker made off with some stock.'] },
];

// ============================================================ player shops
// A company can open a shop: other players buy these items; the owner keeps (price − stock cost).
// price = base retail price (owner's markup multiplies it); effects apply to the buyer.
export const SHOP_ITEMS = {
  food: [
    { id: 'chipsi', emoji: '🍟', name: ['Chipsi mayai', 'Chips mayai'], price: 3_000, effects: { hunger: 35 } },
    { id: 'mishkaki', emoji: '🍢', name: ['Mishkaki', 'Mishkaki skewers'], price: 5_000, effects: { hunger: 30, fun: 8 } },
    { id: 'pilau', emoji: '🍛', name: ['Pilau ya nyama', 'Beef pilau'], price: 7_000, effects: { hunger: 50, social: 5 } },
  ],
  salon: [
    { id: 'kunyoa', emoji: '💈', name: ['Kunyoa', 'Fresh cut'], price: 8_000, effects: { hygiene: 25, fun: 10 } },
    { id: 'kusuka', emoji: '💇🏾', name: ['Kusuka', 'Braids'], price: 25_000, effects: { hygiene: 20, social: 15, fun: 10 } },
    { id: 'kucha', emoji: '💅🏾', name: ['Kucha', 'Nails'], price: 12_000, effects: { hygiene: 15, fun: 15 } },
  ],
  duka: [
    { id: 'soda', emoji: '🥤', name: ['Soda baridi', 'Cold soda'], price: 1_500, effects: { energy: 8, fun: 5 } },
    { id: 'mkate', emoji: '🍞', name: ['Mkate & maziwa', 'Bread & milk'], price: 4_000, effects: { hunger: 30 } },
    { id: 'sabuni', emoji: '🧼', name: ['Sabuni & mafuta', 'Soap & lotion'], price: 6_000, effects: { hygiene: 35 } },
  ],
  fashion: [
    { id: 'kitenge', emoji: '👗', name: ['Kitenge kipya', 'New kitenge'], price: 45_000, effects: { fun: 20, social: 20 } },
    { id: 'raba', emoji: '👟', name: ['Raba kali', 'Fresh sneakers'], price: 80_000, effects: { fun: 25, social: 15 } },
    { id: 'miwani', emoji: '🕶️', name: ['Miwani ya jua', 'Sunglasses'], price: 25_000, effects: { fun: 15, social: 10 } },
  ],
  pharmacy: [
    { id: 'panadol', emoji: '💊', name: ['Dawa ya maumivu', 'Painkillers'], price: 3_000, health: 10, effects: { energy: 5 } },
    { id: 'vitamini', emoji: '🍊', name: ['Vitamini', 'Vitamins'], price: 9_000, health: 5, effects: { energy: 20 } },
    { id: 'firstaid', emoji: '🩹', name: ['Kifaa cha huduma ya kwanza', 'First-aid kit'], price: 20_000, health: 30, effects: {} },
  ],
};
export const SHOP = { stockCost: 0.55, markups: [1, 1.2, 1.5, 2], buyCooldownMs: 3000 };
