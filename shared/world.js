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
  {
    id: 'pwa', name: 'Pwani', icon: '🏭', center: [0, -1600], half: 120, ground: '#c5c9a4',
    // Kibaha & Mlandizi industrial parks, Mapinga retirement homes, old Bagamoyo on the coast.
    land: [{ x1: -120, z1: -120, x2: 96, z2: 120 }, { x1: 96, z1: -110, x2: 104, z2: 110 }],
    beaches: [{ x1: 96, z1: -110, x2: 104, z2: 110 }],
  },
];
export const cityById = Object.fromEntries(CITIES.map((c) => [c.id, c]));
export const cityAt = (x, z) => CITIES.find((c) => Math.abs(x - c.center[0]) <= c.half && Math.abs(z - c.center[1]) <= c.half) || null;
const Z = (x, z) => [1600 + x, z];
const A = (x, z) => [-1600 + x, z];
const P = (x, z) => [x, -1600 + z];

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
  // Pwani
  [...P(-115, 0), ...P(95, 0), 7, 'Barabara ya Bagamoyo'],
  [...P(-115, -60), ...P(95, -60), 6, 'Barabara ya Mlandizi'],
  [...P(-115, 60), ...P(95, 60), 6, 'Barabara ya Mapinga'],
  [...P(-40, -115), ...P(-40, 115), 7, 'Barabara ya Viwanda'],
  [...P(30, -115), ...P(30, 115), 6, 'Barabara ya Kibaha'],
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
  { id: 'kibaha', name: 'Kibaha Industrial', pos: P(-80, -30) },
  { id: 'mlandizi', name: 'Mlandizi', pos: P(-80, 30) },
  { id: 'mapinga', name: 'Mapinga', pos: P(65, -88) },
  { id: 'bagamoyo', name: 'Bagamoyo', pos: P(55, 30) },
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
  // ---- more wardrobe: everyday, street, sport, culture, work and big nights
  { id: 'tee-black', name: 'T-shirt Nyeusi', nameEn: 'Black Tee', price: 0, for: 'all', top: '#111827', bottom: '#1e3a8a', bottomPattern: 'denim', bottomType: 'pants', sleeves: 'short' },
  { id: 'tee-mustard', name: 'T-shirt ya Haradali', nameEn: 'Mustard Tee & Chinos', price: 0, for: 'all', top: '#ca8a04', bottom: '#1f2937', bottomType: 'pants', sleeves: 'short' },
  { id: 'tank-shorts', name: 'Singlet na Kaptula', nameEn: 'Tank & Shorts', price: 0, for: 'all', top: '#f8fafc', bottom: '#0369a1', bottomType: 'shorts', sleeves: 'none' },
  { id: 'cargo', name: 'Suruali ya Cargo', nameEn: 'Cargo Fit', price: 0, for: 'all', top: '#365314', bottom: '#78716c', bottomType: 'pants', sleeves: 'short' },
  { id: 'camo', name: 'Kamuflaji', nameEn: 'Camo Street', price: 70_000, for: 'all', top: '#111827', bottom: '#3f6212', bottomPattern: 'camo', bottomType: 'pants', sleeves: 'short' },
  { id: 'denim-jacket', name: 'Jaketi la Jinsi', nameEn: 'Denim Jacket', price: 0, for: 'all', top: '#1e40af', pattern: 'denim', bottom: '#111827', bottomType: 'pants', sleeves: 'long' },
  { id: 'bomber', name: 'Jaketi la Bomber', nameEn: 'Bomber Jacket', price: 110_000, for: 'all', top: '#365314', bottom: '#1f2937', bottomType: 'pants', sleeves: 'long' },
  { id: 'hoodie-red', name: 'Hoodie Nyekundu', nameEn: 'Red Hoodie', price: 0, for: 'all', top: '#b91c1c', bottom: '#111827', bottomType: 'pants', sleeves: 'long' },
  { id: 'hoodie-sky', name: 'Hoodie ya Bluu', nameEn: 'Sky Hoodie', price: 0, for: 'all', top: '#38bdf8', bottom: '#e5e7eb', bottomType: 'pants', sleeves: 'long' },
  { id: 'track-red', name: 'Tracksuit Nyekundu', nameEn: 'Red Tracksuit', price: 0, for: 'all', top: '#dc2626', pattern: 'stripes', bottom: '#dc2626', bottomType: 'pants', sleeves: 'long' },
  { id: 'track-black', name: 'Tracksuit Nyeusi', nameEn: 'Black Tracksuit', price: 0, for: 'all', top: '#111827', pattern: 'stripes', bottom: '#111827', bottomType: 'pants', sleeves: 'long' },
  { id: 'jezi-taifa', name: 'Jezi ya Taifa Stars', nameEn: 'Taifa Stars Jersey', price: 0, for: 'all', top: '#16a34a', pattern: 'jersey', bottom: '#1e3a8a', bottomType: 'shorts', sleeves: 'short' },
  { id: 'jezi-azam', name: 'Jezi ya Azam', nameEn: 'Azam FC Jersey', price: 0, for: 'all', top: '#38bdf8', pattern: 'jersey', bottom: '#0c4a6e', bottomType: 'shorts', sleeves: 'short' },
  { id: 'ankara-shirt', name: 'Shati la Ankara', nameEn: 'Ankara Shirt', price: 65_000, for: 'all', top: '#f97316', pattern: 'ankara', bottom: '#111827', bottomType: 'pants', sleeves: 'short' },
  { id: 'ankara-blue', name: 'Ankara ya Bluu', nameEn: 'Blue Ankara Set', price: 120_000, for: 'all', top: '#1d4ed8', pattern: 'ankara', bottom: '#1d4ed8', bottomPattern: 'ankara', bottomType: 'pants', sleeves: 'long' },
  { id: 'kitenge-shirt', name: 'Shati la Kitenge', nameEn: 'Kitenge Shirt', price: 0, for: 'all', top: '#059669', pattern: 'kitenge', bottom: '#f5f5f4', bottomType: 'pants', sleeves: 'short' },
  { id: 'shuka-maasai', name: 'Shuka la Kimasai', nameEn: 'Maasai Shuka', price: 50_000, for: 'all', top: '#dc2626', pattern: 'shuka', bottom: '#dc2626', bottomPattern: 'shuka', bottomType: 'robe', sleeves: 'none' },
  { id: 'kanzu-white', name: 'Kanzu Nyeupe', nameEn: 'White Kanzu', price: 90_000, for: 'man', top: '#f8fafc', bottom: '#f8fafc', bottomType: 'robe', sleeves: 'long', head: 'kofia' },
  { id: 'blazer-navy', name: 'Blazer ya Kibluu', nameEn: 'Navy Blazer', price: 180_000, for: 'all', top: '#1e3a8a', bottom: '#e7e5e4', bottomType: 'pants', sleeves: 'long' },
  { id: 'suti-cream', name: 'Suti ya Krimu', nameEn: 'Cream Suit', price: 300_000, for: 'all', top: '#f5e6c8', bottom: '#f5e6c8', bottomType: 'pants', sleeves: 'long', extra: 'tie' },
  { id: 'suti-wine', name: 'Suti ya Mvinyo', nameEn: 'Wine Suit', price: 320_000, for: 'all', top: '#7f1d1d', bottom: '#7f1d1d', bottomType: 'pants', sleeves: 'long', extra: 'tie' },
  { id: 'scrubs-blue', name: 'Sare za Daktari', nameEn: 'Doctor Scrubs', price: 0, for: 'all', top: '#1d4ed8', bottom: '#1e40af', bottomType: 'pants', sleeves: 'short' },
  { id: 'crop-jeans', name: 'Crop Top na Jinsi', nameEn: 'Crop Top & Jeans', price: 0, for: 'woman', top: '#f472b6', bottom: '#1e40af', bottomPattern: 'denim', bottomType: 'pants', sleeves: 'none' },
  { id: 'sundress', name: 'Gauni la Jua', nameEn: 'Floral Sundress', price: 0, for: 'woman', top: '#fde68a', pattern: 'floral', bottom: '#fde68a', bottomPattern: 'floral', bottomType: 'dress', sleeves: 'none' },
  { id: 'floral-maxi', name: 'Maxi ya Maua', nameEn: 'Floral Maxi', price: 110_000, for: 'woman', top: '#be185d', pattern: 'floral', bottom: '#be185d', bottomPattern: 'floral', bottomType: 'maxi', sleeves: 'short' },
  { id: 'pencil-skirt', name: 'Sketi ya Ofisi', nameEn: 'Pencil Skirt & Blouse', price: 0, for: 'woman', top: '#f8fafc', bottom: '#111827', bottomType: 'skirt', sleeves: 'long' },
  { id: 'jumpsuit', name: 'Jumpsuit', nameEn: 'Jumpsuit', price: 0, for: 'woman', top: '#0f766e', bottom: '#0f766e', bottomType: 'pants', sleeves: 'none' },
  { id: 'kanga-dress', name: 'Gauni la Kanga', nameEn: 'Kanga Dress', price: 0, for: 'woman', top: '#7c3aed', pattern: 'kanga', bottom: '#7c3aed', bottomPattern: 'kanga', bottomType: 'dress', sleeves: 'short' },
  { id: 'abaya', name: 'Abaya', nameEn: 'Abaya', price: 85_000, for: 'woman', top: '#111827', bottom: '#111827', bottomType: 'maxi', sleeves: 'long', head: 'hijab' },
  { id: 'ankara-gown', name: 'Gauni la Ankara', nameEn: 'Ankara Gown', price: 160_000, for: 'woman', top: '#ea580c', pattern: 'ankara', bottom: '#ea580c', bottomPattern: 'ankara', bottomType: 'maxi', sleeves: 'short' },
  { id: 'party-red', name: 'Gauni la Pati', nameEn: 'Red Party Dress', price: 200_000, for: 'woman', top: '#dc2626', bottom: '#dc2626', bottomType: 'dress', sleeves: 'none' },
  { id: 'wedding-gown', name: 'Shela la Harusi', nameEn: 'Wedding Gown', price: 900_000, for: 'woman', top: '#ffffff', bottom: '#ffffff', bottomType: 'maxi', sleeves: 'none' },
  { id: 'tux', name: 'Tuxedo', nameEn: 'Tuxedo', price: 600_000, for: 'all', top: '#020617', bottom: '#020617', bottomType: 'pants', sleeves: 'long', extra: 'tie' },
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
  { id: 'range', name: 'Range Rover Vogue', kind: 'suv', body: 'range', tier: 4, price: 280_000_000, speed: 3.0, emoji: '🚙', color: '#14532d', lux: true },
  { id: 'benz-s', name: 'Mercedes-Benz S-Class', kind: 'car', body: 'luxury', tier: 5, price: 320_000_000, speed: 3.0, emoji: '🚘', color: '#0f172a', lux: true },
  { id: 'porsche', name: 'Porsche 911 Carrera', kind: 'car', body: 'sports', tier: 5, price: 380_000_000, speed: 3.4, emoji: '🏎️', color: '#facc15', lux: true },
  { id: 'gwagon', name: 'Mercedes-AMG G63 (G-Wagon)', kind: 'suv', body: 'boxy', tier: 5, price: 450_000_000, speed: 3.1, emoji: '🚙', color: '#111827', lux: true },
  { id: 'urus', name: 'Lamborghini Urus', kind: 'suv', body: 'suv-sport', tier: 6, price: 650_000_000, speed: 3.4, emoji: '🏎️', color: '#f97316', lux: true },
  { id: 'aventador', name: 'Lamborghini Aventador', kind: 'car', body: 'sports', tier: 6, price: 950_000_000, speed: 3.7, emoji: '🏎️', color: '#84cc16', lux: true },
  { id: 'cullinan', name: 'Rolls-Royce Cullinan', kind: 'suv', body: 'rolls', tier: 6, price: 1_400_000_000, speed: 3.1, emoji: '👑', color: '#f5f5f4', lux: true },
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
  // `kind` picks a special 3D model; `blurb` explains what it's for.
  { id: 'shamba', kind: 'farm', name: 'Shamba la Kisasa', price: 12_000_000, incomePerHour: 70_000, energyBonus: 5, color: '#dc2626', floors: 1,
    blurb: ['Mahindi, nyanya na mboga — mavuno yanauzwa kila saa.', 'Maize, tomatoes and greens — the harvest sells every hour.'] },
  { id: 'kontena', kind: 'container', name: 'Nyumba ya Makontena', price: 18_000_000, incomePerHour: 0, energyBonus: 22, color: '#f97316', floors: 2,
    blurb: ['Makontena ya rangi yaliyopangwa kuwa nyumba ya kisasa.', 'Colourful shipping containers stacked into a stylish home.'] },
  { id: 'hostel', kind: 'hostel', name: 'Hosteli ya Wasafiri', price: 45_000_000, incomePerHour: 190_000, energyBonus: 10, color: '#a855f7', floors: 3,
    blurb: ['Vitanda vya wasafiri — kipato cha kila saa.', 'Bunks for backpackers — steady hourly income.'] },
  { id: 'resort', kind: 'resort', name: 'Eco Resort ya Makuti', price: 220_000_000, incomePerHour: 950_000, energyBonus: 35, color: '#fef3c7', floors: 1, pool: true,
    blurb: ['Bungalow za makuti kuzunguka bwawa — watalii wanalipa vizuri.', 'Thatched bungalows around a pool — tourists pay well.'] },
  // Industry: warehouses and factories earn big — Pwani's industrial parks, plus light industry in a few Dar/Arusha areas.
  { id: 'ghala', kind: 'factory', variant: 'warehouse', name: 'Ghala la Usafirishaji', price: 60_000_000, incomePerHour: 270_000, energyBonus: 0, color: '#2563eb', floors: 1,
    blurb: ['Ghala kubwa la mizigo na malori — kipato cha kila saa.', 'A big logistics warehouse with trucks — steady hourly income.'] },
  { id: 'kiwanda-chakula', kind: 'factory', variant: 'food', name: 'Kiwanda cha Vyakula', price: 120_000_000, incomePerHour: 540_000, energyBonus: 0, color: '#16a34a', floors: 1,
    blurb: ['Juisi, unga na vyakula vya kusindika — matangi na silo.', 'Juices, flour and packaged food — tanks and silos.'] },
  { id: 'kiwanda-nguo', kind: 'factory', variant: 'textile', name: 'Kiwanda cha Nguo', price: 150_000_000, incomePerHour: 680_000, energyBonus: 0, color: '#c026d3', floors: 1,
    blurb: ['Vitenge, kanga na sare — paa la msumeno na mashine.', 'Vitenge, kanga and uniforms — sawtooth roof and looms.'] },
  { id: 'sola', kind: 'solar', name: 'Shamba la Umeme wa Jua', price: 200_000_000, incomePerHour: 820_000, energyBonus: 0, color: '#1e3a8a', floors: 1,
    blurb: ['Paneli za sola zinazouza umeme kwa TANESCO.', 'Solar panels selling power to the grid.'] },
  { id: 'kiwanda-saruji', kind: 'factory', variant: 'cement', name: 'Kiwanda cha Saruji', price: 400_000_000, incomePerHour: 1_750_000, energyBonus: 0, color: '#78716c', floors: 1,
    blurb: ['Silo ndefu, mkanda wa kusafirisha na moshi — biashara nzito.', 'Tall silos, conveyors and a stack — heavy industry, heavy profits.'] },
  { id: 'wazee', kind: 'retire', name: 'Makazi ya Wazee', price: 90_000_000, incomePerHour: 380_000, energyBonus: 15, color: '#fef3c7', floors: 1,
    blurb: ['Makazi tulivu ya wastaafu — bustani, kibanda na huduma.', 'A calm retirement home — gardens, a gazebo and care staff.'] },
  { id: 'kesho', kind: 'future', name: 'Nyumba ya Kesho', price: 260_000_000, incomePerHour: 0, energyBonus: 60, color: '#f8fafc', floors: 2,
    blurb: ['Nyumba-janja ya baadaye: kuba la kioo, taa za LED, sola na pedi ya drone.', 'A smart home from the future: glass dome, LED rings, solar canopy and a drone pad.'] },
];
const BUILDING_EMOJI = { ghala: '📦', 'kiwanda-chakula': '🏭', 'kiwanda-nguo': '🧵', sola: '☀️', 'kiwanda-saruji': '🏗️', wazee: '👵🏾', banda: '🏠', kisasa: '🏡', ghorofa: '🏢', villa: '🏖️', hoteli: '🏨', shamba: '🌽', kontena: '📦', hostel: '🛏️', resort: '🌴', kesho: '🛸' };
for (const b of BUILDINGS) b.emoji = BUILDING_EMOJI[b.id];
export const buildingById = Object.fromEntries(BUILDINGS.map((b) => [b.id, b]));
// Upgrading a house you've built: extra storeys and features. Rentals earn +25% per extra storey.
export const HOUSE_UPGRADES = {
  maxFloors: { banda: 2, kisasa: 3, villa: 3, ghorofa: 6, hoteli: 4, shamba: 1, kontena: 3, hostel: 5, resort: 1, kesho: 3, ghala: 1, 'kiwanda-chakula': 1, 'kiwanda-nguo': 1, sola: 1, 'kiwanda-saruji': 1, wazee: 2 },
  floorCostPct: 0.35, // of the building's price, per storey
  floorIncome: 0.25,
  floorEnergy: 5,
  features: [
    { id: 'wall', emoji: '🧱', name: ['Ukuta wa uzio na geti', 'Compound wall & gate'], price: 1_500_000, value: 0.8 },
    { id: 'garden', emoji: '🌳', name: ['Bustani na miti', 'Garden & trees'], price: 800_000, value: 0.8, energy: 3 },
    { id: 'solar', emoji: '☀️', name: ['Sola juu ya paa', 'Rooftop solar'], price: 2_500_000, value: 0.8, income: 0.1 },
    { id: 'garage', emoji: '🚗', name: ['Gereji', 'Garage'], price: 3_000_000, value: 0.8 },
    { id: 'pool', emoji: '🏊', name: ['Bwawa la kuogelea', 'Swimming pool'], price: 6_000_000, value: 0.8, energy: 5 },
    { id: 'terrace', emoji: '🌇', name: ['Terrace ya juu', 'Rooftop terrace'], price: 2_000_000, value: 0.8, energy: 2 },
  ],
  paintPrice: 300_000,
  paints: ['#fef3c7', '#fde68a', '#fecaca', '#bfdbfe', '#bbf7d0', '#e9d5ff', '#fed7aa', '#f5f5f4', '#cbd5e1', '#99f6e4'],
};
export const houseFeatureById = Object.fromEntries(HOUSE_UPGRADES.features.map((f) => [f.id, f]));
/** A built plot's numbers after upgrades: income per hour, energy bonus, floors. */
export function houseStats(b, up = {}) {
  const extra = up.floors || 0;
  const feats = (up.features || []).map((id) => houseFeatureById[id]).filter(Boolean);
  const incomeMult = 1 + extra * HOUSE_UPGRADES.floorIncome + feats.reduce((n, f) => n + (f.income || 0), 0);
  return {
    floors: b.floors + extra,
    incomePerHour: Math.round((b.incomePerHour || 0) * incomeMult),
    energyBonus: b.energyBonus + extra * HOUSE_UPGRADES.floorEnergy + feats.reduce((n, f) => n + (f.energy || 0), 0),
  };
}

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
  // Zanzibar
  ...plotGrid('nwv', 'Nungwi', [1650, 1663, 1676, 1689], [-92], 80_000_000, 11),
  ...plotGrid('pje', 'Paje', [1688, 1701], [-45, -31, -17], 55_000_000),
  ...plotGrid('fmb', 'Fumba', [1598, 1611], [22, 36], 25_000_000),
  ...plotGrid('mtw', 'Matemwe', [1646, 1659, 1672], [-40, -54], 40_000_000),
  // Arusha
  ...plotGrid('njr', 'Njiro', [-1695, -1682], [15, 29, 43], 20_000_000),
  ...plotGrid('kjg', 'Kijenge', [-1520, -1507], [15, 29, 43], 35_000_000),
  ...plotGrid('usa', 'Usa River', [-1635, -1622, -1609], [75, 89], 15_000_000),
  // Pwani: industrial parks (big 14 m plots), retirement homes and coastal Bagamoyo
  ...plotGrid('kbh', 'Kibaha', [-100, -82, -64], [-1648, -1630, -1612], 40_000_000, 14),
  ...plotGrid('kbc', 'Kibaha', [-25, -7, 11], [-1646, -1628], 45_000_000, 14),
  ...plotGrid('mld', 'Mlandizi', [-100, -82, -64], [-1587, -1569, -1552], 30_000_000, 14),
  ...plotGrid('mpg', 'Mapinga', [45, 58, 71, 84], [-1675, -1690, -1705], 15_000_000, 11),
  ...plotGrid('bgm', 'Bagamoyo', [42, 55, 68], [-1585, -1570, -1555], 20_000_000, 11),
];
for (const p of PLOTS) { p.district = p.area; p.city = cityAt(p.pos[0], p.pos[1])?.id || 'dar'; }
export const plotById = Object.fromEntries(PLOTS.map((p) => [p.id, p]));
export const ALLOWED_BUILDINGS = {
  Kigamboni: ['banda', 'kisasa', 'villa', 'hoteli', 'kontena', 'resort', 'kesho'],
  Masaki: ['kisasa', 'villa', 'ghorofa', 'hoteli', 'kesho', 'kontena'],
  Mbezi: ['banda', 'kisasa', 'ghorofa', 'villa', 'shamba', 'kontena', 'hostel', 'ghala', 'kiwanda-chakula', 'wazee'],
  Kinondoni: ['banda', 'kisasa', 'ghorofa', 'hostel', 'kontena', 'ghala', 'wazee'],
  Temeke: ['banda', 'kisasa', 'ghorofa', 'shamba', 'hostel', 'kontena', 'ghala', 'kiwanda-nguo', 'kiwanda-chakula'],
  Nungwi: ['kisasa', 'villa', 'hoteli', 'resort', 'hostel', 'kesho'],
  Paje: ['banda', 'kisasa', 'villa', 'hoteli', 'resort', 'hostel', 'kontena'],
  Fumba: ['banda', 'kisasa', 'villa', 'ghorofa', 'shamba', 'kesho', 'ghala'],
  Matemwe: ['banda', 'kisasa', 'villa', 'hoteli', 'resort'],
  Njiro: ['banda', 'kisasa', 'villa', 'ghorofa', 'shamba', 'hostel', 'ghala', 'kiwanda-chakula', 'wazee'],
  Kijenge: ['kisasa', 'villa', 'ghorofa', 'hoteli', 'kesho', 'hostel'],
  'Usa River': ['banda', 'kisasa', 'villa', 'shamba', 'resort', 'wazee'],
  Kibaha: ['ghala', 'kiwanda-nguo', 'kiwanda-chakula', 'kiwanda-saruji', 'sola', 'shamba'],
  Mlandizi: ['ghala', 'kiwanda-nguo', 'kiwanda-chakula', 'kiwanda-saruji', 'sola', 'shamba'],
  Mapinga: ['wazee', 'banda', 'kisasa', 'villa', 'kontena'],
  Bagamoyo: ['wazee', 'kisasa', 'villa', 'hostel', 'resort', 'banda'],
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
    id: 'gym-znz', name: 'Zanzibar Fitness Club', district: 'Mwera', type: 'gym', icon: '🏋️', pos: Z(45, -15), size: [12, 10], h: 7, color: '#2dd4bf',
    blurb: 'Gym ya kisasa ya Unguja — vyuma, ndondi na yoga.',
    activities: [{ id: 'mazoezi-znz', name: 'Fanya mazoezi', cost: 5_000, secs: 20, effects: { fun: 15, energy: -18, hygiene: -15, social: 8 }, emoji: '💪' }],
    jobs: [{ id: 'trainer-znz', title: 'Personal Trainer', titles: ['Trainer', 'Senior Trainer', 'Coach'], secs: 45, pay: 22_000, energy: 14 }],
  },
  {
    id: 'kanisa-dar', name: 'Kanisa la Neema Magomeni', nameEn: 'Grace Church Magomeni', district: 'Magomeni', type: 'church', icon: '⛪', pos: [-98, 22], size: [12, 16], h: 8, color: '#fefce8',
    blurb: 'Ibada ya Jumapili, kwaya, harusi na maombi. Kila mtu anakaribishwa.', blurbEn: 'Sunday service, choir, weddings and prayer. Everyone is welcome.',
    activities: [
      { id: 'ibada', name: 'Hudhuria ibada', nameEn: 'Attend the service', cost: 0, secs: 25, effects: { fun: 15, social: 25, energy: 5 }, emoji: '🙏' },
      { id: 'kwaya', name: 'Imba kwenye kwaya', nameEn: 'Sing in the choir', cost: 0, secs: 20, effects: { fun: 25, social: 15, energy: -5 }, emoji: '🎶', fame: 1 },
      { id: 'sadaka', name: 'Toa sadaka (10K)', nameEn: 'Give an offering (10K)', cost: 10_000, secs: 6, effects: { social: 10, fun: 5 }, emoji: '💝', fame: 1 },
      { id: 'fungu', name: 'Toa fungu la kumi (500K)', nameEn: 'Pay a big tithe (500K)', cost: 500_000, secs: 8, effects: { social: 30, fun: 15 }, emoji: '🕊️', fame: 6 },
      { id: 'maombi', name: 'Ombewa na mchungaji', nameEn: 'Get prayed for by the pastor', cost: 20_000, secs: 15, effects: { fun: 20, energy: 15 }, emoji: '✋' },
    ],
    jobs: [
      { id: 'mchungaji', title: 'Mchungaji', titleEn: 'Pastor', titles: ['Mzee wa kanisa', 'Mchungaji msaidizi', 'Mchungaji', 'Askofu', 'Askofu Mkuu'], titlesEn: ['Church elder', 'Assistant pastor', 'Pastor', 'Bishop', 'Archbishop'], secs: 60, pay: 30_000, energy: 10 },
      { id: 'mwimbaji', title: 'Mwimbaji wa kwaya', titleEn: 'Choir singer', titles: ['Mwimbaji', 'Kiongozi wa kwaya', 'Msanii wa injili'], titlesEn: ['Singer', 'Choir leader', 'Gospel star'], secs: 45, pay: 16_000, energy: 10 },
    ],
  },
  {
    id: 'msikiti-dar', name: 'Msikiti wa Nuru Kariakoo', nameEn: 'Nuru Mosque Kariakoo', district: 'Kariakoo', type: 'mosque', icon: '🕌', pos: [-35, 13], size: [14, 14], h: 7, color: '#f0fdf4',
    blurb: 'Swala tano, darsa la Qur\'an na swala ya Ijumaa. Kila mtu anakaribishwa.', blurbEn: "Daily prayers, Qur'an classes and Friday prayer. Everyone is welcome.",
    activities: [
      { id: 'swala', name: 'Swali msikitini', nameEn: 'Pray at the mosque', cost: 0, secs: 20, effects: { fun: 12, social: 25, energy: 5 }, emoji: '🤲' },
      { id: 'darsa', name: "Darsa la Qur'an", nameEn: "Qur'an class", cost: 0, secs: 25, effects: { fun: 15, social: 15 }, emoji: '📖' },
      { id: 'sadakam', name: 'Toa sadaka (10K)', nameEn: 'Give charity (10K)', cost: 10_000, secs: 6, effects: { social: 10, fun: 5 }, emoji: '💝', fame: 1 },
      { id: 'zaka', name: 'Toa zaka (500K)', nameEn: 'Pay zakat (500K)', cost: 500_000, secs: 8, effects: { social: 30, fun: 15 }, emoji: '🕊️', fame: 6 },
      { id: 'futari', name: 'Kula futari ya pamoja', nameEn: 'Share an iftar meal', cost: 0, secs: 15, effects: { hunger: 45, social: 20 }, emoji: '🍲' },
    ],
    jobs: [
      { id: 'imamu', title: 'Imamu', titleEn: 'Imam', titles: ['Muadhini', 'Mwalimu wa madrasa', 'Imamu', 'Shehe', 'Shehe Mkuu'], titlesEn: ['Muezzin', 'Madrasa teacher', 'Imam', 'Sheikh', 'Chief Sheikh'], secs: 60, pay: 30_000, energy: 10 },
      { id: 'kaswida', title: 'Mwimbaji wa kaswida', titleEn: 'Qaswida singer', titles: ['Mwimbaji', 'Kiongozi wa kikundi', 'Msanii wa kaswida'], titlesEn: ['Singer', 'Group leader', 'Qaswida star'], secs: 45, pay: 16_000, energy: 10 },
    ],
  },
  {
    id: 'msikiti-znz', name: 'Msikiti wa Baraka', nameEn: 'Baraka Mosque', district: 'Stone Town', type: 'mosque', icon: '🕌', pos: Z(-4, -13), size: [14, 14], h: 7, color: '#ecfeff',
    blurb: 'Swala tano, darsa la Qur\'an na swala ya Ijumaa. Kila mtu anakaribishwa.', blurbEn: "Daily prayers, Qur'an classes and Friday prayer. Everyone is welcome.",
    activities: [
      { id: 'swala-znz', name: 'Swali msikitini', nameEn: 'Pray at the mosque', cost: 0, secs: 20, effects: { fun: 12, social: 25, energy: 5 }, emoji: '🤲' },
      { id: 'darsa-znz', name: "Darsa la Qur'an", nameEn: "Qur'an class", cost: 0, secs: 25, effects: { fun: 15, social: 15 }, emoji: '📖' },
      { id: 'sadakam-znz', name: 'Toa sadaka (10K)', nameEn: 'Give charity (10K)', cost: 10_000, secs: 6, effects: { social: 10, fun: 5 }, emoji: '💝', fame: 1 },
      { id: 'zaka-znz', name: 'Toa zaka (500K)', nameEn: 'Pay zakat (500K)', cost: 500_000, secs: 8, effects: { social: 30, fun: 15 }, emoji: '🕊️', fame: 6 },
      { id: 'futari-znz', name: 'Kula futari ya pamoja', nameEn: 'Share an iftar meal', cost: 0, secs: 15, effects: { hunger: 45, social: 20 }, emoji: '🍲' },
    ],
    jobs: [
      { id: 'imamu-znz', title: 'Imamu', titleEn: 'Imam', titles: ['Muadhini', 'Mwalimu wa madrasa', 'Imamu', 'Shehe', 'Shehe Mkuu'], titlesEn: ['Muezzin', 'Madrasa teacher', 'Imam', 'Sheikh', 'Chief Sheikh'], secs: 60, pay: 30_000, energy: 10 },
      { id: 'kaswida-znz', title: 'Mwimbaji wa kaswida', titleEn: 'Qaswida singer', titles: ['Mwimbaji', 'Kiongozi wa kikundi', 'Msanii wa kaswida'], titlesEn: ['Singer', 'Group leader', 'Qaswida star'], secs: 45, pay: 16_000, energy: 10 },
    ],
  },
  {
    id: 'kanisa-aru', name: 'Kanisa la Mlima Meru', nameEn: 'Mount Meru Church', district: 'Arusha CBD', type: 'church', icon: '⛪', pos: A(13, 25), size: [12, 16], h: 8, color: '#fff7ed',
    blurb: 'Ibada ya Jumapili, kwaya, harusi na maombi. Kila mtu anakaribishwa.', blurbEn: 'Sunday service, choir, weddings and prayer. Everyone is welcome.',
    activities: [
      { id: 'ibada-aru', name: 'Hudhuria ibada', nameEn: 'Attend the service', cost: 0, secs: 25, effects: { fun: 15, social: 25, energy: 5 }, emoji: '🙏' },
      { id: 'kwaya-aru', name: 'Imba kwenye kwaya', nameEn: 'Sing in the choir', cost: 0, secs: 20, effects: { fun: 25, social: 15, energy: -5 }, emoji: '🎶', fame: 1 },
      { id: 'sadaka-aru', name: 'Toa sadaka (10K)', nameEn: 'Give an offering (10K)', cost: 10_000, secs: 6, effects: { social: 10, fun: 5 }, emoji: '💝', fame: 1 },
      { id: 'fungu-aru', name: 'Toa fungu la kumi (500K)', nameEn: 'Pay a big tithe (500K)', cost: 500_000, secs: 8, effects: { social: 30, fun: 15 }, emoji: '🕊️', fame: 6 },
      { id: 'maombi-aru', name: 'Ombewa na mchungaji', nameEn: 'Get prayed for by the pastor', cost: 20_000, secs: 15, effects: { fun: 20, energy: 15 }, emoji: '✋' },
    ],
    jobs: [
      { id: 'mchungaji-aru', title: 'Mchungaji', titleEn: 'Pastor', titles: ['Mzee wa kanisa', 'Mchungaji msaidizi', 'Mchungaji', 'Askofu', 'Askofu Mkuu'], titlesEn: ['Church elder', 'Assistant pastor', 'Pastor', 'Bishop', 'Archbishop'], secs: 60, pay: 30_000, energy: 10 },
      { id: 'mwimbaji-aru', title: 'Mwimbaji wa kwaya', titleEn: 'Choir singer', titles: ['Mwimbaji', 'Kiongozi wa kwaya', 'Msanii wa injili'], titlesEn: ['Singer', 'Choir leader', 'Gospel star'], secs: 45, pay: 16_000, energy: 10 },
    ],
  },
  {
    id: 'gym-aru', name: 'Arusha Peak Gym', district: 'Arusha CBD', type: 'gym', icon: '🏋️', pos: A(35, 40), size: [12, 10], h: 7, color: '#f97316',
    blurb: 'Fanya mazoezi kwa mwonekano wa Mlima Meru.',
    activities: [{ id: 'mazoezi-aru', name: 'Fanya mazoezi', cost: 5_000, secs: 20, effects: { fun: 15, energy: -18, hygiene: -15, social: 8 }, emoji: '💪' }],
    jobs: [{ id: 'trainer-aru', title: 'Personal Trainer', titles: ['Trainer', 'Senior Trainer', 'Coach'], secs: 45, pay: 22_000, energy: 14 }],
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
  // ----------------------------------------------------------------- Pwani
  {
    id: 'pw-stendi', name: 'Stendi ya Bagamoyo', district: 'Kibaha', type: 'terminal', icon: '🚌', pos: P(0, 18), size: [14, 10], h: 5, color: '#e5e7eb',
    blurb: 'Mabasi kwenda Dar na Arusha — lango la Pwani.',
    activities: [{ id: 'chai-stendi', name: 'Chai na maandazi', cost: 1_500, secs: 10, effects: { hunger: 15, energy: 5 }, emoji: '☕' }],
  },
  {
    id: 'pw-industrial', name: 'Kibaha Industrial Park', district: 'Kibaha', type: 'office', icon: '🏭', pos: P(-75, 85), size: [16, 12], h: 9, color: '#94a3b8',
    blurb: 'Ofisi kuu ya viwanda — kazi za viwandani na ushauri wa kujenga kiwanda.',
    activities: [{ id: 'ziara-kiwanda', name: 'Ziara ya viwanda', cost: 10_000, secs: 20, effects: { fun: 10, social: 5 }, emoji: '🏭' }],
    jobs: [
      { id: 'opereta', title: 'Opereta wa mashine', titles: ['Opereta', 'Opereta mkuu', 'Msimamizi wa zamu', 'Meneja wa kiwanda'], secs: 60, pay: 30_000, energy: 14 },
      { id: 'fundi-mitambo', title: 'Fundi mitambo', titles: ['Fundi', 'Fundi mkuu', 'Mhandisi wa mitambo'], secs: 70, pay: 55_000, energy: 14, requires: { elimu: 1 } },
      { id: 'dereva-lori', title: 'Dereva wa lori', titles: ['Dereva', 'Dereva mzoefu', 'Msimamizi wa usafirishaji'], secs: 60, pay: 35_000, energy: 12 },
    ],
  },
  {
    id: 'bagamoyo-old', name: 'Mji Mkongwe wa Bagamoyo', district: 'Bagamoyo', type: 'museum', icon: '🏛️', pos: P(62, 88), size: [16, 12], h: 6, color: '#e7d7b8',
    blurb: 'Magofu ya Kaole, ngome ya zamani na Chuo cha Sanaa cha Bagamoyo.',
    activities: [
      { id: 'kaole', name: 'Tembelea magofu ya Kaole', cost: 15_000, secs: 25, effects: { fun: 20, social: 5 }, emoji: '🏛️', fame: 1 },
      { id: 'sanaa', name: 'Onyesho la Chuo cha Sanaa', cost: 20_000, secs: 30, effects: { fun: 30, social: 10 }, emoji: '🥁' },
    ],
  },
  {
    id: 'pw-jetty', name: 'Gati la Bagamoyo', district: 'Bagamoyo', type: 'port', icon: '⛵', pos: P(86, 35), size: [8, 12], h: 3, color: '#e2e8f0',
    blurb: 'Boti kwenda Zanzibar na samaki wabichi.',
    activities: [{ id: 'samaki-pw', name: 'Nunua samaki wa kukaanga', cost: 3_000, secs: 10, effects: { hunger: 25 }, emoji: '🐟' }],
  },
  {
    id: 'pw-soko', name: 'Soko la Mlandizi', district: 'Mlandizi', type: 'market', icon: '🧺', pos: P(0, 88), size: [14, 10], h: 5, color: '#fca5a5',
    blurb: 'Matunda, mboga na mchele kwa bei ya jumla.',
    activities: [{ id: 'matunda-pw', name: 'Nunua matunda', cost: 2_000, secs: 10, effects: { hunger: 18 }, emoji: '🍍' }],
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

// Senior careers. The best-paid jobs need more than Education: experience in a related job
// (requires.exp = { jobId: shifts }) and/or fame. Pay here is before the shift scaling below.
const CAREER_JOBS = {
  posta: [{ id: 'mhasibu', title: 'Mhasibu', titles: ['Mhasibu msaidizi', 'Mhasibu', 'Mhasibu mkuu', 'CFO'], secs: 70, pay: 60_000, energy: 9, requires: { elimu: 2 } }],
  bank: [{ id: 'afisa-uwekezaji', title: 'Afisa Uwekezaji', titles: ['Mchambuzi', 'Afisa uwekezaji', 'Mkuu wa uwekezaji', 'Mkurugenzi Mtendaji'], secs: 90, pay: 190_000, energy: 13, requires: { elimu: 3, exp: { teller: 10 } } }],
  techhub: [
    { id: 'designer', title: 'Mbunifu wa Apps', titles: ['Junior designer', 'Product designer', 'Lead designer', 'Head of design'], secs: 70, pay: 70_000, energy: 10, requires: { elimu: 1 } },
    { id: 'ai-engineer', title: 'Mhandisi wa AI', titles: ['ML engineer', 'Senior AI engineer', 'Head of AI', 'Chief AI Officer'], secs: 90, pay: 200_000, energy: 14, requires: { elimu: 4, exp: { developer: 10 } } },
  ],
  hospitali: [
    { id: 'mfamasia', title: 'Mfamasia', titles: ['Mfamasia', 'Mfamasia mkuu', 'Mkuu wa famasia'], secs: 60, pay: 50_000, energy: 9, requires: { elimu: 2 } },
    { id: 'daktari-bingwa', title: 'Daktari bingwa wa upasuaji', titles: ['Daktari wa upasuaji', 'Bingwa wa upasuaji', 'Profesa wa upasuaji'], secs: 90, pay: 210_000, energy: 16, requires: { elimu: 4, exp: { daktari: 15 } } },
  ],
  mahakama: [{ id: 'hakimu', title: 'Hakimu', titles: ['Hakimu mkazi', 'Hakimu mfawidhi', 'Jaji', 'Jaji Mkuu'], secs: 90, pay: 230_000, energy: 12, requires: { elimu: 5, exp: { wakili: 20 } } }],
  airport: [{ id: 'mhandisi-ndege', title: 'Mhandisi wa ndege', titles: ['Fundi wa ndege', 'Mhandisi wa ndege', 'Mhandisi mkuu'], secs: 90, pay: 170_000, energy: 14, requires: { elimu: 3, exp: { fundi: 10 } } }],
  uwanja: [{ id: 'mchezaji', title: 'Mchezaji wa Ligi Kuu', titles: ['Mchezaji wa akiba', 'Mchezaji wa kikosi', 'Nahodha', 'Staa wa taifa'], secs: 90, pay: 120_000, energy: 18, fameBonus: true, requires: { fame: 60, exp: { trainer: 10 } } }],
  studio: [{ id: 'producer', title: 'Producer', titles: ['Producer chipukizi', 'Producer', 'Hitmaker', 'Mmiliki wa label'], secs: 80, pay: 90_000, energy: 12, fameBonus: true, requires: { fame: 30, exp: { msanii: 10 } } }],
  club: [{ id: 'promota', title: 'Promota wa matamasha', titles: ['Promota', 'Promota mkubwa', 'Mratibu wa tamasha'], secs: 70, pay: 70_000, energy: 12, fameBonus: true, requires: { fame: 20 } }],
  polisi: [{ id: 'mpelelezi', title: 'Mpelelezi', titles: ['Mpelelezi', 'Mpelelezi mkuu', 'Mkuu wa upelelezi'], secs: 80, pay: 90_000, energy: 13, requires: { exp: { askari: 15 } } }],
  serena: [{ id: 'meneja-hoteli', title: 'Meneja wa hoteli', titles: ['Meneja msaidizi', 'Meneja wa hoteli', 'Meneja mkuu'], secs: 80, pay: 130_000, energy: 11, requires: { elimu: 2, exp: { receptionist: 10 } } }],
  'zn-port': [{ id: 'afisa-forodha', title: 'Afisa Forodha', titles: ['Afisa forodha', 'Afisa mkuu', 'Kamishna wa forodha'], secs: 70, pay: 70_000, energy: 10, requires: { elimu: 2 } }],
  coffee: [{ id: 'mtaalamu-kahawa', title: 'Mtaalamu wa kahawa', titles: ['Mwonjaji wa kahawa', 'Mtaalamu', 'Msafirishaji wa kahawa'], secs: 70, pay: 65_000, energy: 10, requires: { elimu: 1 } }],
};
for (const p of PLACES) if (CAREER_JOBS[p.id]) p.jobs = [...(p.jobs || []), ...CAREER_JOBS[p.id]];
export const placeById = Object.fromEntries(PLACES.map((p) => [p.id, p]));

// ------------------------------------------------------------ yachts & private jets
// Bought from the Anasa (Luxury) app. Each owner's yacht/jet is a private room: the owner and
// whoever they invite aboard. The interior scene is shared code; who you see is per owner.
export const LUXURY = [
  { id: 'yacht-s', kind: 'yacht', tier: 1, name: 'Azimut 60 Flybridge', price: 900_000_000, guests: 8, emoji: '🛥️', blurb: ['Yacht ya mita 18: deki ya juu, jakuzi na baa.', '18 m yacht: flybridge, jacuzzi and a bar.'] },
  { id: 'yacht-m', kind: 'yacht', tier: 2, name: 'Sunseeker 95 Yacht', price: 2_500_000_000, guests: 12, emoji: '🛥️', blurb: ['Mita 29, deki tatu, DJ booth na jet ski.', '29 m, three decks, DJ booth and a jet ski.'] },
  { id: 'yacht-l', kind: 'yacht', tier: 3, name: 'Lürssen 60m Superyacht', price: 7_500_000_000, guests: 20, emoji: '🛳️', blurb: ['Superyacht yenye helipad, bwawa la kuogelea na sinema.', 'A superyacht with a helipad, pool and cinema.'] },
  { id: 'jet-s', kind: 'jet', tier: 1, name: 'Cessna Citation CJ4', price: 1_500_000_000, guests: 8, emoji: '🛩️', blurb: ['Jet ndogo ya kifahari — viti vya ngozi na baa.', 'A light jet — leather seats and a bar.'] },
  { id: 'jet-m', kind: 'jet', tier: 2, name: 'Bombardier Challenger 650', price: 4_000_000_000, guests: 12, emoji: '✈️', blurb: ['Kabini pana, sofa na meza ya chakula.', 'A wide cabin with a sofa and dining table.'] },
  { id: 'jet-l', kind: 'jet', tier: 3, name: 'Gulfstream G700', price: 9_500_000_000, guests: 16, emoji: '✈️', blurb: ['Chumba cha kulala, bafu na sebule ya kifahari angani.', 'A bedroom, shower and a lounge in the sky.'] },
];
export const luxuryById = Object.fromEntries(LUXURY.map((l) => [l.id, l]));
export const LUXURY_RESALE = 0.6;
export const LUXURY_COLORS = ['#f8fafc', '#0f172a', '#1e3a8a', '#7f1d1d', '#14532d', '#d4af37'];
// Where a yacht can sail to / a jet can fly to, per city (a place id to arrive at).
export const LUXURY_PORTS = { yacht: { dar: 'slipway', znz: 'zn-port', pwa: 'pw-jetty' }, jet: { dar: 'airport', znz: 'zn-airport', aru: 'kia' } };
const PRIVATE_PLACES = [
  { id: 'yacht', private: true, name: 'Yacht', nameEn: 'Yacht', type: 'yacht', icon: '🛥️', district: 'Bahari ya Hindi', pos: [0, 0], size: [1, 1], h: 0, color: '#f8fafc', activities: [], blurb: 'Yacht binafsi.' },
  { id: 'block', private: true, name: 'Jengo la Ghorofa', nameEn: 'Apartment block', type: 'block', icon: '🏢', district: 'Plot', pos: [0, 0], size: [1, 1], h: 0, color: '#e2e8f0', activities: [], blurb: 'Ndani ya jengo.' },
  { id: 'jet', private: true, name: 'Private Jet', nameEn: 'Private jet', type: 'jet', icon: '🛩️', district: 'Angani', pos: [0, 0], size: [1, 1], h: 0, color: '#f8fafc', activities: [], blurb: 'Ndege binafsi.' },
];
for (const p of PRIVATE_PLACES) placeById[p.id] = p;
export const isPrivatePlace = (id) => id === 'yacht' || id === 'jet' || id === 'block';
// Plot buildings you can walk inside, floor by floor.
export const ENTERABLE_BUILDINGS = ['ghorofa', 'hostel', 'hoteli', 'wazee'];
export const jobById = Object.fromEntries(PLACES.flatMap((p) => (p.jobs || []).map((j) => [j.id, j])));

/** What's still missing before a player can take this job: [[icon, sw, en], …]. Vehicles are checked separately. */
export function jobLocks(job, u) {
  const r = job.requires || {};
  const out = [];
  if (r.elimu && (u.elimu || 0) < r.elimu) out.push(['🎓', `Inahitaji Elimu level ${r.elimu}`, `Needs Education level ${r.elimu}`]);
  if (r.fame && (u.fame || 0) < r.fame) out.push(['⭐', `Inahitaji umaarufu ${r.fame} (una ${u.fame || 0})`, `Needs ${r.fame} fame (you have ${u.fame || 0})`]);
  for (const [id, n] of Object.entries(r.exp || {})) {
    const have = u.jobXp?.[id] || 0;
    const j = jobById[id];
    if (have < n) out.push(['💼', `Inahitaji shifti ${n} kama ${j?.title || id} (${have}/${n})`, `Needs ${n} shifts as ${j?.titleEn || j?.title || id} (${have}/${n})`]);
  }
  return out;
}

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
export const REFERRAL = { newPlayer: 80_000, referrer: 100_000, maxPaid: 50 };
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
  buildings: { banda: 'Simple House', kisasa: 'Modern House', ghorofa: 'Apartment Block', villa: 'Luxury Villa', hoteli: 'Beach Hotel', shamba: 'Modern Farm', kontena: 'Container Home', hostel: 'Backpackers Hostel', resort: 'Thatched Eco Resort', kesho: 'Home of Tomorrow', ghala: 'Logistics Warehouse', 'kiwanda-chakula': 'Food Processing Plant', 'kiwanda-nguo': 'Textile Mill', sola: 'Solar Farm', 'kiwanda-saruji': 'Cement Plant', wazee: 'Retirement Home' },
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
    'pw-stendi': ['Bagamoyo Bus Stand', 'Coaches to Dar and Arusha — the gateway to Pwani.', { 'chai-stendi': 'Chai & maandazi' }],
    'pw-industrial': ['Kibaha Industrial Park', 'The industrial park office — factory jobs and advice on building one.', { 'ziara-kiwanda': 'Factory tour' }],
    'bagamoyo-old': ['Old Bagamoyo', 'The Kaole ruins, the old fort and the Bagamoyo College of Arts.', { kaole: 'Visit the Kaole ruins', sanaa: 'Arts college show' }],
    'pw-jetty': ['Bagamoyo Jetty', 'Boats to Zanzibar and fresh fish.', { 'samaki-pw': 'Buy fried fish' }],
    'pw-soko': ['Mlandizi Market', 'Fruit, vegetables and rice at wholesale prices.', { 'matunda-pw': 'Buy fruit' }],
    'gym-znz': ['Zanzibar Fitness Club', "Unguja's modern gym — weights, boxing and yoga.", { 'mazoezi-znz': 'Work out' }],
    'gym-aru': ['Arusha Peak Gym', 'Train with a view of Mount Meru.', { 'mazoezi-aru': 'Work out' }],
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
    'trainer-znz': ['Personal Trainer', ['Trainer', 'Senior Trainer', 'Coach']],
    'trainer-aru': ['Personal Trainer', ['Trainer', 'Senior Trainer', 'Coach']],
    opereta: ['Machine Operator', ['Operator', 'Senior Operator', 'Shift Supervisor', 'Plant Manager']],
    'fundi-mitambo': ['Plant Technician', ['Technician', 'Senior Technician', 'Plant Engineer']],
    'dereva-lori': ['Truck Driver', ['Driver', 'Senior Driver', 'Logistics Supervisor']],
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
    mhasibu: ['Accountant', ['Junior accountant', 'Accountant', 'Senior accountant', 'CFO']],
    'afisa-uwekezaji': ['Investment Banker', ['Analyst', 'Investment officer', 'Head of investments', 'CEO']],
    designer: ['App Designer', ['Junior designer', 'Product designer', 'Lead designer', 'Head of design']],
    'ai-engineer': ['AI Engineer', ['ML engineer', 'Senior AI engineer', 'Head of AI', 'Chief AI Officer']],
    mfamasia: ['Pharmacist', ['Pharmacist', 'Senior pharmacist', 'Head of pharmacy']],
    'daktari-bingwa': ['Surgeon', ['Surgeon', 'Senior surgeon', 'Professor of surgery']],
    hakimu: ['Magistrate', ['Resident magistrate', 'Senior magistrate', 'Judge', 'Chief Justice']],
    'mhandisi-ndege': ['Aircraft Engineer', ['Aircraft technician', 'Aircraft engineer', 'Chief engineer']],
    mchezaji: ['Premier League Footballer', ['Substitute', 'First-team player', 'Captain', 'National star']],
    producer: ['Music Producer', ['Upcoming producer', 'Producer', 'Hitmaker', 'Label owner']],
    promota: ['Event Promoter', ['Promoter', 'Big promoter', 'Festival organiser']],
    mpelelezi: ['Detective', ['Detective', 'Senior detective', 'Head of CID']],
    'meneja-hoteli': ['Hotel Manager', ['Assistant manager', 'Hotel manager', 'General manager']],
    'afisa-forodha': ['Customs Officer', ['Customs officer', 'Senior officer', 'Customs commissioner']],
    'mtaalamu-kahawa': ['Coffee Specialist', ['Coffee taster', 'Specialist', 'Coffee exporter']],
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
  // Newer places carry their English inline.
  const [name, blurb, acts] = EN.places[p.id] || [p.nameEn, p.blurbEn, {}];
  p.nameEn = name;
  p.blurbEn = blurb;
  for (const a of p.activities || []) a.nameEn = acts[a.id] || a.nameEn || a.name;
  for (const j of p.jobs || []) {
    if (EN.jobs[j.id]) [j.titleEn, j.titlesEn] = EN.jobs[j.id];
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
export const ENTERABLE = { yadi: 'showroom', posta: 'plaza', ferry: 'terminal', ferrykig: 'terminal', 'zn-port': 'terminal', casino: 'casino', kendwa: 'concert', polisi: 'police', mahakama: 'court', club: 'club', lounge: 'club', bar: 'bar', uwanja: 'stadium', studio: 'studio', singeli: 'concert', kinyozi: 'salon', nyamachoma: 'grill' };
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
  'gym-znz': { 'mazoezi-znz': 'gym' },
  'gym-aru': { 'mazoezi-aru': 'gym' },
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
const JOB_SCENES = { konda: 'stand', dj: 'club', mhudumu: 'bar', msanii: 'studio', trainer: 'gym', chef: 'dining', msaidizi: 'dining', cashier: 'shop', machinga: 'market', nesi: 'hospital', daktari: 'hospital', teller: 'bank', karani: 'office', developer: 'office', mlinzi: 'stadium', mvuvi: 'beach', 'mhudumu-ndege': 'flight', rubani: 'flight' , lifeguard: 'waterpark', 'mpiga-ngoma': 'ngoma', caddie: 'golf', nahodha: 'dhow', fundi: 'karting', receptionist: 'spa' , 'mpishi-pizza': 'grill', mwongoza: null, croupier: 'casino', 'safari-guide': 'safari', porter: 'hike', barista: 'dining', mhasibu: 'office', 'afisa-uwekezaji': 'bank', designer: 'office', 'ai-engineer': 'office', mfamasia: 'hospital', 'daktari-bingwa': 'hospital', 'mhandisi-ndege': 'flight', mchezaji: 'stadium', producer: 'studio', promota: 'club', 'meneja-hoteli': 'spa', 'mtaalamu-kahawa': 'dining' };

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
export const YARD = { w: 12, d: 12, h: 6, maxBlocks: 400, refund: 0.5 };
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
// Upgrading Kwangu: each level grows the home to the back (-z) and left (-x) — the door,
// driveway and yard stay put — adds rooms, and makes resting at home more effective.
export const HOME_LEVELS = [
  { level: 0, emoji: '🛏️', name: 'Chumba kimoja', nameEn: 'Studio', price: 0, grow: [0, 0], comfort: 0 },
  { level: 1, emoji: '🏢', name: 'Apartment', nameEn: 'Apartment', price: 8_000_000, grow: [3, 2], comfort: 0.1 },
  { level: 2, emoji: '🏡', name: 'Nyumba ya familia', nameEn: 'Family house', price: 30_000_000, grow: [6, 4], comfort: 0.2, room: true },
  { level: 3, emoji: '🏰', name: 'Jumba la kifahari', nameEn: 'Mansion', price: 120_000_000, grow: [9, 6], comfort: 0.35, room: true },
];
// Second storey: a glass-floored upper level over the back of the original home, reached by a
// staircase that rises toward the back (-z). Furniture can't go on the stairs.
export const HOME_UP_Y = 2.45;
export const HOME_STAIRS = { x1: 0.2, x2: 1.2, z1: 0, z2: 2.8 };
export const HOME_UPPER = { x1: -6, x2: 6, z1: -5, z2: 0, terrace: 1.6 };
export const homeStairY = (z) => HOME_UP_Y * Math.max(0, Math.min(1, (HOME_STAIRS.z2 - z) / (HOME_STAIRS.z2 - HOME_STAIRS.z1)));
export const homeBounds = (level = 0, features = []) => {
  const [gx, gz] = HOME_LEVELS[level]?.grow || [0, 0];
  return { x1: -HOME.w / 2 - gx, x2: HOME.w / 2, z1: -HOME.d / 2 - gz, z2: HOME.d / 2, blocks: features?.includes?.('storey') ? [HOME_STAIRS] : [] };
};
export const HOME_WALLS = ['#15806b', '#1e3a8a', '#7c2d12', '#374151', '#9d174d', '#b45309', '#e7e5e4', '#0f766e'];
export const HOME_FLOORS = [
  { id: 'tile', name: 'Vigae', nameEn: 'Tiles', a: '#ece6d8', b: '#e2dac8', kind: 'tile' },
  { id: 'marble', name: 'Marumaru', nameEn: 'Marble', a: '#f8fafc', b: '#e5e7eb', kind: 'tile' },
  { id: 'wood', name: 'Mbao', nameEn: 'Wood', a: '#b98552', b: '#a8744a', kind: 'wood' },
  { id: 'dark', name: 'Mbao nyeusi', nameEn: 'Dark wood', a: '#5b3a1f', b: '#4a2f19', kind: 'wood' },
  { id: 'terrazzo', name: 'Terrazzo', nameEn: 'Terrazzo', a: '#d6d3d1', b: '#cbd5e1', kind: 'small' },
];
export const HOME_STYLE_PRICE = { wall: 400_000, floor: 1_500_000 };
// Build-by-build add-ons for Kwangu. Each has spots where your Sim can do something:
// spot = [x, y, z, facing] in home coords; `up` = on the second storey (upstairs view).
export const HOME_FEATURES = [
  { id: 'bbq', emoji: '🍖', name: 'Bustani na jiko la BBQ', nameEn: 'Garden & BBQ grill', price: 2_500_000,
    acts: [{ id: 'grill', emoji: '🍖', name: ['Choma nyama', 'Fire up the grill'], effects: { hunger: 25, social: 4 }, mode: 'lift', spot: [3.2, 0, 12.6, Math.PI] },
      { id: 'garden', emoji: '🌻', name: ['Mwagilia maua', 'Water the flowers'], effects: { fun: 5 }, mode: 'idle', spot: [6.4, 0, 12.8, Math.PI] }] },
  { id: 'balcony', emoji: '🌇', name: 'Balcony', nameEn: 'Balcony', price: 3_000_000,
    acts: [{ id: 'chill', emoji: '🌇', name: ['Pumzika balcony', 'Chill on the balcony'], effects: { fun: 6, energy: 4 }, mode: 'sit', spot: [-1.6, 2.45, 5.9, 0] }] },
  { id: 'cinema', emoji: '🎬', name: 'Sinema ya bustanini', nameEn: 'Garden cinema', price: 5_000_000,
    acts: [{ id: 'movie', emoji: '🎬', name: ['Tazama filamu', 'Watch a film'], effects: { fun: 12, energy: 3 }, mode: 'sit', spot: [-12.5, 0, 10.4, Math.PI] }] },
  { id: 'jacuzzi', emoji: '🛁', name: 'Jakuzi la nje', nameEn: 'Outdoor jacuzzi', price: 7_000_000,
    acts: [{ id: 'soak', emoji: '🛁', name: ['Jiloweke jakuzi', 'Soak in the jacuzzi'], effects: { fun: 8, hygiene: 10, energy: 6 }, health: 2, mode: 'sit', spot: [9.6, -0.15, 11.6, Math.PI] }] },
  { id: 'pool', emoji: '🏊🏾', name: 'Bwawa la kuogelea', nameEn: 'Swimming pool', price: 12_000_000,
    acts: [{ id: 'swim', emoji: '🏊🏾', name: ['Ogelea', 'Go for a swim'], effects: { fun: 10, hygiene: 8, energy: -3 }, health: 2, mode: 'swim', spot: [5.4, -0.3, 8.6, Math.PI / 2] },
      { id: 'sunbathe', emoji: '😎', name: ['Ota jua', 'Sunbathe'], effects: { fun: 5, energy: 6 }, mode: 'sleep', spot: [8.4, 0.35, 8.2, 0] }] },
  { id: 'storey', emoji: '🏢', name: 'Ghorofa ya pili', nameEn: 'Second storey', price: 15_000_000,
    acts: [{ id: 'master', emoji: '🛌', name: ['Lala chumba kikuu', 'Sleep in the master suite'], effects: { energy: 40 }, health: 3, cd: 10 * 60_000, mode: 'sleep', spot: [3.6, 3.05, -2.6, 0], up: true },
      { id: 'lounge', emoji: '🛋️', name: ['Pumzika sebule ya juu', 'Relax in the upstairs lounge'], effects: { fun: 8, social: 2, energy: 3 }, mode: 'sit', spot: [-3.5, 2.45, -2.2, 0], up: true }] },
  { id: 'rooftop', emoji: '🌃', name: 'Terrace ya juu', nameEn: 'Upstairs terrace', price: 6_000_000, requires: 'storey',
    acts: [{ id: 'stars', emoji: '🌃', name: ['Tazama nyota', 'Stargaze'], effects: { fun: 8, energy: 3 }, mode: 'sleep', spot: [-2.4, 2.85, 0.8, Math.PI], up: true },
      { id: 'party', emoji: '🎶', name: ['Pati ya terrace', 'Terrace party'], effects: { fun: 12, social: 8, energy: -5 }, mode: 'dance', spot: [3.6, 2.45, 0.8, Math.PI], up: true }] },
];
export const homeFeatureById = Object.fromEntries(HOME_FEATURES.map((f) => [f.id, f]));
export const HOME_ACT_CD = 2 * 60_000;
export function homeFits(def, x, z, rot, others = [], b = homeBounds(0)) {
  const [w, d] = footprint(def, rot);
  if (x - w / 2 < b.x1 - 1e-6 || x + w / 2 > b.x2 + 1e-6 || z - d / 2 < b.z1 - 1e-6 || z + d / 2 > b.z2 + 1e-6) return false;
  if ((b.blocks || []).some((k) => x + w / 2 > k.x1 + 1e-6 && x - w / 2 < k.x2 - 1e-6 && z + d / 2 > k.z1 + 1e-6 && z - d / 2 < k.z2 - 1e-6)) return false;
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

// ---------------------------------------------------------------- Afya (health app)
// Health plans last 30 days: cheaper hospital care, free ambulance, cheaper/free therapy.
export const HEALTH_PLANS = [
  { id: 'nhif', emoji: '🟢', name: 'NHIF Msingi', nameEn: 'NHIF Basic', price: 60_000, days: 30, hospitalOff: 0.5, therapyOff: 0.5, doctorOff: 0.5, ambulance: true, regen: 0, color: '#16a34a',
    perks: [['Nusu bei hospitalini', 'Half-price hospital care'], ['Gari la wagonjwa bure', 'Free ambulance'], ['Ushauri nasaha nusu bei', 'Half-price therapy']] },
  { id: 'jubilee', emoji: '🔵', name: 'Jubilee Afya Silver', nameEn: 'Jubilee Silver', price: 250_000, days: 30, hospitalOff: 0.8, therapyOff: 1, doctorOff: 1, ambulance: true, regen: 0, color: '#2563eb',
    perks: [['80% punguzo hospitalini', '80% off hospital care'], ['Ushauri nasaha bure', 'Free therapy sessions'], ['Daktari mtandaoni bure', 'Free online doctor'], ['Gari la wagonjwa bure', 'Free ambulance']] },
  { id: 'aar', emoji: '🟡', name: 'AAR Gold Premier', nameEn: 'AAR Gold Premier', price: 750_000, days: 30, hospitalOff: 1, therapyOff: 1, doctorOff: 1, ambulance: true, regen: 1, color: '#ca8a04',
    perks: [['Matibabu yote bure', 'All hospital care free'], ['Ushauri nasaha + daktari bure', 'Free therapy + online doctor'], ['Afya inapanda yenyewe kila dakika', 'Health slowly recovers on its own'], ['Gari la wagonjwa bure', 'Free ambulance']] },
];
export const healthPlanById = Object.fromEntries(HEALTH_PLANS.map((p) => [p.id, p]));
export const THERAPISTS = [
  { id: 'neema', name: 'Dkt. Neema Mushi', emoji: '👩🏾‍⚕️', focus: ['Msongo wa mawazo na kazi', 'Stress & work'], look: { body: 'woman', skin: 3, hair: 'bun', outfit: 'ofisi-sketi', hairColor: 0 } },
  { id: 'juma', name: 'Bw. Juma Kileo', emoji: '👨🏾‍⚕️', focus: ['Mahusiano na familia', 'Relationships & family'], look: { body: 'man', skin: 2, hair: 'fade', outfit: 'kaunda', hairColor: 0 } },
  { id: 'aisha', name: 'Dkt. Aisha Salim', emoji: '🧕🏾', focus: ['Usingizi na wasiwasi', 'Sleep & anxiety'], look: { body: 'woman', skin: 4, hair: 'kilemba', outfit: 'buibui', hairColor: 0 } },
];
export const AFYA = {
  therapy: { price: 40_000, cooldownMs: 20 * 60_000, effects: { fun: 15, social: 10, energy: 5 }, health: 5 },
  doctor: { price: 10_000, cooldownMs: 30 * 60_000, health: 12 },
  pharmacy: [
    { id: 'panadol', emoji: '💊', name: 'Panadol', nameEn: 'Painkillers', price: 3_000, health: 8 },
    { id: 'ors', emoji: '🧃', name: 'ORS', nameEn: 'Rehydration salts', price: 1_500, health: 4, effects: { energy: 8 } },
    { id: 'vitamini', emoji: '🍊', name: 'Vitamini', nameEn: 'Multivitamins', price: 15_000, health: 12, effects: { energy: 5 } },
    { id: 'firstaid', emoji: '🩹', name: 'Huduma ya kwanza', nameEn: 'First aid kit', price: 25_000, health: 20 },
  ],
  pharmacyCooldownMs: 10 * 60_000,
};
// ---------------------------------------------------------------- Gym (fitness)
// Fitness 0–100: workouts raise it, it slips if you stop training, and fit players move faster.
export const GYM = {
  places: ['gym', 'gym-znz', 'gym-aru', 'zn-hotel', 'ar-hotel'], // where gym workouts count (city gyms + hotel gyms)
  memberships: [
    { id: 'day', emoji: '🎟️', name: 'Pasi ya siku', nameEn: 'Day pass', price: 5_000, days: 1, gain: 0 },
    { id: 'month', emoji: '💪', name: 'Uanachama wa mwezi', nameEn: 'Monthly membership', price: 80_000, days: 30, gain: 0 },
    { id: 'elite', emoji: '👑', name: 'Elite (sauna + bwawa)', nameEn: 'Elite (sauna + pool)', price: 300_000, days: 30, gain: 0.25, elite: true },
  ],
  workouts: [
    { id: 'home', emoji: '🏠', name: 'Mazoezi ya nyumbani', nameEn: 'Home workout', secs: 30, energy: -8, fitness: 0.6, health: 2, effects: { fun: 2 }, home: true,
      moves: [['Push-ups x10', 'Push-ups x10'], ['Squats x15', 'Squats x15'], ['Plank sekunde 30', '30-second plank']] },
    { id: 'cardio', emoji: '🏃🏾', name: 'Cardio (treadmill)', nameEn: 'Cardio (treadmill)', secs: 40, energy: -12, fitness: 1.4, health: 4, effects: { fun: 3 },
      moves: [['Joto: tembea haraka', 'Warm-up: brisk walk'], ['Kimbia vipindi', 'Running intervals'], ['Poa: tembea', 'Cool-down walk']] },
    { id: 'strength', emoji: '🏋🏾', name: 'Vyuma (nguvu)', nameEn: 'Strength (weights)', secs: 45, energy: -14, fitness: 1.6, health: 3, effects: { fun: 2 },
      moves: [['Bench press 3x10', 'Bench press 3x10'], ['Deadlift 3x8', 'Deadlift 3x8'], ['Bicep curls 3x12', 'Bicep curls 3x12']] },
    { id: 'hiit', emoji: '🔥', name: 'HIIT', nameEn: 'HIIT', secs: 35, energy: -16, fitness: 1.8, health: 4, effects: { fun: 3 },
      moves: [['Burpees', 'Burpees'], ['Mountain climbers', 'Mountain climbers'], ['Jump squats', 'Jump squats'], ['Pumzika', 'Rest']] },
    { id: 'yoga', emoji: '🧘🏾', name: 'Yoga', nameEn: 'Yoga', secs: 40, energy: -4, fitness: 0.9, health: 5, effects: { fun: 4, energy: 0 },
      moves: [['Salamu ya jua', 'Sun salutation'], ['Mkao wa shujaa', 'Warrior pose'], ['Pumua kwa kina', 'Deep breathing']] },
    { id: 'boxing', emoji: '🥊', name: 'Ndondi', nameEn: 'Boxing', secs: 40, energy: -15, fitness: 1.7, health: 3, effects: { fun: 5 },
      moves: [['Jab-cross', 'Jab-cross'], ['Ngumi za begi', 'Heavy bag'], ['Kuruka kamba', 'Skipping rope']] },
    { id: 'swim', emoji: '🏊🏾', name: 'Kuogelea (Elite)', nameEn: 'Swimming (Elite)', secs: 40, energy: -10, fitness: 1.5, health: 5, effects: { fun: 4, hygiene: 10 }, elite: true,
      moves: [['Freestyle mizunguko 4', 'Freestyle x4 lengths'], ['Breaststroke', 'Breaststroke'], ['Sauna', 'Sauna']] },
  ],
  cooldownMs: 8 * 60_000,
  decayPerDay: 1.5, // fitness lost per day without training
  trainerBonus: 0.5, // +50% gains while you have a trainer
  trainerTogether: 0.25, // extra when your player-trainer is in the gym with you
  trainerCut: 0.1, // the gym keeps 10% of player-trainer fees
  trainerMinFitness: 50,
  trainerPrice: [20_000, 2_000_000],
  npcTrainers: [
    { id: 'baraka', name: 'Coach Baraka', emoji: '🏋🏾‍♂️', focus: ['Nguvu na misuli', 'Strength & muscle'], price: 150_000 },
    { id: 'zuhura', name: 'Coach Zuhura', emoji: '🧘🏾‍♀️', focus: ['Yoga na cardio', 'Yoga & cardio'], price: 120_000 },
    { id: 'mo', name: 'Coach Mo "Simba"', emoji: '🥊', focus: ['Ndondi na HIIT', 'Boxing & HIIT'], price: 200_000 },
  ],
};
export const gymWorkoutById = Object.fromEntries(GYM.workouts.map((w) => [w.id, w]));
export const fitnessLabel = (f) => (f >= 85 ? ['Mwanamichezo 🏆', 'Athlete 🏆'] : f >= 65 ? ['Fiti sana 💪', 'Very fit 💪'] : f >= 40 ? ['Fiti 🙂', 'Fit 🙂'] : ['Anza mazoezi 🛋️', 'Couch mode 🛋️']);

// ---------------------------------------------------------------- lifts
// Seats for passengers when you give someone a lift (driver not counted).
export function liftSeats(model) {
  const v = vehicleById[model];
  if (!v) return 0;
  if (v.kind === 'moto') return 1;
  if (v.kind === 'bajaji') return 2;
  if (v.kind === 'van' || v.body === 'suv-big' || v.body === 'range' || v.body === 'rolls') return 5;
  if (v.kind === 'suv' || v.kind === 'car') return v.body === 'sports' ? 1 : 3;
  return 0;
}
export const LIFT = { boardDist: 10, askTtlMs: 90_000 };
export const POLICE_ID = 'polisi';

// ------------------------------------------------------- city-to-city trips
// Prices keyed by the two city ids sorted alphabetically.
export const tripKey = (a, b) => [a, b].sort().join('-');
export const TRIP_MODES = {
  flight: { emoji: '✈️', name: 'Ndege', nameEn: 'Flight', secs: 60, ins: 10_000, risk: 1 / 8, price: { 'dar-znz': 95_000, 'aru-dar': 260_000, 'aru-znz': 320_000 }, note: ['Teksi hadi uwanja imejumuishwa', 'Cab to the airport included'] },
  heli: { emoji: '🚁', name: 'Helikopta', nameEn: 'Helicopter', secs: 40, ins: 60_000, risk: 1 / 12, price: { 'dar-znz': 1_800_000, 'aru-dar': 4_500_000, 'aru-znz': 5_000_000, 'dar-pwa': 900_000, 'pwa-znz': 1_500_000, 'aru-pwa': 4_200_000 }, note: ['Kutoka mlangoni hadi mlangoni', 'Door to door'] },
  ferry: { emoji: '⛴️', name: 'Boti ya Azam', nameEn: 'Azam fast ferry', secs: 70, ins: 5_000, risk: 1 / 7, price: { 'dar-znz': 40_000, 'pwa-znz': 30_000 }, note: ['Kivukoni hadi Bandari ya Zanzibar', 'Kivukoni to Zanzibar Port'] },
  bus: { emoji: '🚌', name: 'Basi la abiria', nameEn: 'Coach', secs: 80, ins: 5_000, risk: 1 / 6, price: { 'aru-dar': 45_000, 'dar-pwa': 6_000, 'aru-pwa': 42_000 }, note: ['Magufuli hadi stendi kuu ya Arusha', 'Magufuli terminal to Arusha'] },
  car: { emoji: '🚗', name: 'Endesha gari lako', nameEn: 'Drive', secs: 75, ins: 20_000, risk: 1 / 5, own: true, price: { 'aru-dar': 70_000, 'dar-pwa': 12_000, 'aru-pwa': 65_000 }, note: ['Mafuta tu, lakini utafika umechoka', "Fuel only, but you'll arrive tired"] },
};
// What a flight looks like on arrival in each city.
export const CITY_ARRIVAL = { znz: { dest: 'ZANZIBAR', ground: '#0e7490', land: '#fde68a' }, aru: { dest: 'ARUSHA · KILIMANJARO', ground: '#4d7c0f', land: '#a3e635' }, dar: { dest: 'DAR ES SALAAM', ground: '#0e7490', land: '#86efac' }, pwa: { dest: 'PWANI · BAGAMOYO', ground: '#0e7490', land: '#c5c9a4' } };
// Where you arrive in each city, by mode.
export const ARRIVAL_PLACE = { dar: { flight: 'airport', heli: 'airport', ferry: 'ferry', bus: 'stendi', car: 'stendi' }, znz: { flight: 'zn-airport', heli: 'zn-airport', ferry: 'zn-port' }, aru: { flight: 'kia', heli: 'kia', bus: 'ar-bus', car: 'ar-bus' }, pwa: { heli: 'pw-stendi', bus: 'pw-stendi', car: 'pw-stendi', ferry: 'pw-jetty' } };

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
export const EVENT_PLACES = ['home', 'club', 'bar', 'lounge', 'singeli', 'nyamachoma', 'serena', 'coco', 'kigbeach', 'slipway', 'waterpark', 'karting', 'golf', 'makumbusho', 'uwanja', 'mall', 'masakigrill', 'studio',
  // Zanzibar
  'forodhani', 'nungwi', 'kendwa', 'therock', 'zn-hotel', 'stonetown', 'darajani', 'spice',
  // Arusha
  'viavia', 'ar-hotel', 'clocktower', 'maasai', 'coffee', 'safari',
  // Pwani
  'bagamoyo-old', 'pw-jetty', 'pw-soko'];
// Venues without their own walk-in interior use this scene while a party is live there.
// Every place has an inside: explicit venues first, then the closest interior for its type.
const TYPE_SCENES = { block: 'block', yacht: 'yacht', jet: 'jet', market: 'market', terminal: 'stand', mall: 'shop', shop: 'shop', stonetown: 'shop', restaurant: 'dining', food: 'dining', fish: 'dining', grill: 'grill', bar: 'bar', club: 'club', lounge: 'club', hotel: 'rooftop', gesti: 'room', beach: 'beach', waterpark: 'waterpark', golf: 'golf', karting: 'karting', slipway: 'dhow', stage: 'concert', stadium: 'stadium', studio: 'studio', gym: 'gym', salon: 'salon', office: 'office', tower: 'office', bank: 'bank', hospital: 'hospital', campus: 'classroom', church: 'church', mosque: 'mosque', police: 'police', court: 'court', casino: 'casino', safari: 'safari', mountain: 'hike', forest: 'safari', museum: 'ngoma' };
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
// Things to do while you're inside a venue: walk up to a hotspot and tap it.
// effects are small need boosts; cd = cooldown (s); cost in TSh; reward = [min, max] TSh found/saved.
export const VIBES = {
  dance: { emoji: '💃', name: ['Cheza muziki', 'Dance'], effects: { fun: 4, energy: -2 }, cd: 20, mode: 'dance' },
  drink: { emoji: '🍹', name: ['Agiza kinywaji', 'Get a drink'], cost: 3_000, effects: { fun: 3, hunger: 2 }, cd: 30, mode: 'eat' },
  greet: { emoji: '🤝', name: ['Salimia watu', 'Greet people'], effects: { social: 4 }, cd: 25, mode: 'cheer' },
  selfie: { emoji: '🤳', name: ['Piga selfie', 'Take a selfie'], effects: { fun: 2, social: 1 }, cd: 40, mode: 'pose' },
  eat: { emoji: '🍽️', name: ['Onja chakula', 'Grab a bite'], cost: 2_000, effects: { hunger: 7 }, cd: 30, mode: 'eat' },
  haggle: { emoji: '🛍️', name: ['Patana bei', 'Haggle'], effects: { fun: 2, social: 2 }, cd: 30, reward: [0, 1_500], mode: 'cheer' },
  fruit: { emoji: '🍊', name: ['Nunua tunda', 'Buy fruit'], cost: 500, effects: { hunger: 4, hygiene: 0 }, cd: 25, mode: 'eat' },
  swim: { emoji: '🏊', name: ['Ogelea', 'Swim'], effects: { fun: 4, hygiene: 3, energy: -2 }, cd: 25, mode: 'swim' },
  ball: { emoji: '⚽', name: ['Cheza mpira', 'Kick a ball'], effects: { fun: 4, energy: -3 }, cd: 25, mode: 'cheer' },
  lift: { emoji: '🏋️', name: ['Nyanyua vyuma', 'Lift weights'], effects: { energy: -3, fun: 1 }, health: 1, cd: 30, mode: 'lift' },
  sing: { emoji: '🎤', name: ['Imba freestyle', 'Freestyle'], effects: { fun: 4 }, cd: 30, mode: 'sing' },
  rest: { emoji: '🪑', name: ['Pumzika kidogo', 'Take a seat'], effects: { energy: 4 }, cd: 30, mode: 'sit' },
  play: { emoji: '🎱', name: ['Cheza pool', 'Play pool'], effects: { fun: 4, social: 2 }, cd: 30, mode: 'cheer' },
  pray: { emoji: '🙏🏾', name: ['Toa sadaka', 'Give alms'], cost: 1_000, effects: { social: 3, fun: 1 }, cd: 60, mode: 'idle' },
  work: { emoji: '💻', name: ['Jibu email', 'Answer emails'], effects: { fun: -1, social: 1 }, cd: 30, mode: 'type' },
  cheer: { emoji: '📣', name: ['Shangilia', 'Cheer'], effects: { fun: 4, social: 1 }, cd: 20, mode: 'cheer' },
  photo: { emoji: '📸', name: ['Piga picha', 'Take a photo'], effects: { fun: 2 }, cd: 30, mode: 'pose' },
  news: { emoji: '📰', name: ['Soma gazeti', 'Read the paper'], cost: 500, effects: { fun: 2, social: 1 }, cd: 40, mode: 'idle' },
  shine: { emoji: '👞', name: ['Ng\'arisha viatu', 'Shoe shine'], cost: 1_000, effects: { hygiene: 3, fun: 1 }, cd: 60, mode: 'sit' },
  coffee: { emoji: '☕', name: ['Kahawa na kashata', 'Coffee & kashata'], cost: 500, effects: { energy: 3, social: 1 }, cd: 30, mode: 'eat' },
  fish: { emoji: '🐟', name: ['Nunua samaki wa kukaanga', 'Buy fried fish'], cost: 2_000, effects: { hunger: 7 }, cd: 30, mode: 'eat' },
  // yachts & jets
  sunbathe: { emoji: '😎', name: ['Ota jua', 'Sunbathe'], effects: { fun: 5, energy: 3 }, cd: 25, mode: 'sleep' },
  jacuzzi: { emoji: '🛁', name: ['Jakuzi', 'Jacuzzi'], effects: { fun: 6, hygiene: 6, energy: 2 }, cd: 30, mode: 'swim' },
  angling: { emoji: '🎣', name: ['Vua samaki', 'Go fishing'], effects: { fun: 5 }, cd: 45, reward: [0, 40_000], mode: 'idle' },
  champagne: { emoji: '🍾', name: ['Fungua champagne', 'Pop champagne'], cost: 50_000, effects: { fun: 8, social: 4 }, cd: 40, mode: 'eat' },
  chef: { emoji: '🦞', name: ['Chakula cha mpishi', "Chef's dinner"], cost: 80_000, effects: { hunger: 30, fun: 3 }, cd: 60, mode: 'eat' },
  decks: { emoji: '🎧', name: ['Piga muziki (DJ)', 'Play DJ'], effects: { fun: 6, social: 3 }, cd: 30, mode: 'dance' },
  jetski: { emoji: '🌊', name: ['Endesha jet ski', 'Ride the jet ski'], effects: { fun: 9, energy: -4 }, cd: 45, mode: 'cheer' },
  helm: { emoji: '🧭', name: ['Shika usukani', 'Take the helm'], effects: { fun: 4 }, cd: 30, mode: 'pose' },
  nap: { emoji: '🛏️', name: ['Lala kitandani', 'Nap in the bedroom'], effects: { energy: 25 }, cd: 90, mode: 'sleep' },
  movie: { emoji: '🎬', name: ['Tazama filamu', 'Watch a film'], effects: { fun: 6, energy: 2 }, cd: 45, mode: 'sit' },
  cockpit: { emoji: '👨🏾‍✈️', name: ['Tembelea cockpit', 'Visit the cockpit'], effects: { fun: 4 }, cd: 40, mode: 'pose' },
  lounge: { emoji: '🛋️', name: ['Pumzika sofani', 'Relax on the sofa'], effects: { energy: 6, fun: 2 }, cd: 30, mode: 'sit' },
};
export const VIBE_DAILY = 40; // per player per day across all hotspots

// Real monuments and big buildings, for the look of the city and the map (not enterable).
export const LANDMARKS = [
  { id: 'askari', city: 'dar', kind: 'statue', emoji: '🗿', pos: [56, 8], size: [5, 5], name: 'Askari Monument', blurb: ['Sanamu ya askari katikati ya Posta, tangu 1927 — kitovu cha mji.', 'The soldier statue in the heart of Posta since 1927 — the centre of town.'] },
  { id: 'clock', city: 'dar', kind: 'clock', emoji: '🕰️', pos: [42, -8], size: [4, 4], name: 'Saa ya Mnara', blurb: ['Mnara wa saa wa Posta, alama ya uhuru wa Tanganyika.', "Posta's clock tower, a landmark of Tanganyika's independence."] },
  { id: 'stjoseph', city: 'dar', kind: 'cathedral', emoji: '⛪', pos: [85, 21], size: [9, 12], name: "St Joseph's Cathedral", blurb: ['Kanisa kuu la Kikatoliki la mwaka 1897, ufukweni mwa bandari.', 'The 1897 Catholic cathedral on the harbour front.'] },
  { id: 'azania', city: 'dar', kind: 'church', emoji: '⛪', pos: [29, 49], size: [8, 10], name: 'Azania Front Lutheran Church', blurb: ['Kanisa la Kilutheri lenye paa jekundu, tangu 1898.', 'The red-roofed Lutheran church, since 1898.'] },
  { id: 'uhuru', city: 'dar', kind: 'torch', emoji: '🔥', pos: [23, 7], size: [5, 5], name: 'Mnara wa Uhuru · Mnazi Mmoja', blurb: ['Mwenge wa Uhuru — "kumulika hata nje ya mipaka yetu".', 'The Uhuru Torch — "to shine even beyond our borders".'] },
  { id: 'millennium', city: 'dar', kind: 'twin', emoji: '🏙️', pos: [-5, -35], size: [12, 8], name: 'Millennium Towers', blurb: ['Minara pacha ya ofisi Kijitonyama.', 'The twin office towers of Kijitonyama.'] },
  { id: 'bot', city: 'dar', kind: 'twin', emoji: '🏦', pos: [65, -37], size: [12, 8], name: 'Minara Pacha ya BoT', blurb: ['Minara pacha ya Benki Kuu ya Tanzania, ufukweni Posta.', 'The Bank of Tanzania twin towers on the Posta waterfront.'] },
  { id: 'mkapa', city: 'dar', kind: 'tower', emoji: '🏢', pos: [20, -28], size: [8, 8], name: 'Mkapa Tower', blurb: ['Moja ya majengo marefu zaidi Dar.', 'One of the tallest buildings in Dar.'] },
  { id: 'tanzanite', city: 'dar', kind: 'bridge', emoji: '🌉', pos: [100, -28], name: 'Daraja la Tanzanite', blurb: ['Daraja jipya la baharini kutoka Agakhan hadi Coco Beach na Masaki.', 'The new sea bridge from Aga Khan to Coco Beach and Masaki.'] },
  { id: 'ubungo', city: 'dar', kind: 'flyover', emoji: '🛣️', pos: [-110, 0], name: 'Ubungo Interchange', blurb: ['Barabara za juu za Ubungo — mwisho wa foleni ya Morogoro Road.', 'The Ubungo flyovers — the end of the Morogoro Road jam.'] },
  { id: 'wonders', city: 'znz', kind: 'wonders', emoji: '🏛️', pos: [1563, -9], size: [10, 8], name: 'Beit al-Ajaib · House of Wonders', blurb: ['Jumba la Maajabu, nyumba ya kwanza Afrika Mashariki kuwa na umeme na lifti.', 'The House of Wonders — first building in East Africa with electricity and a lift.'] },
  { id: 'oldfort', city: 'znz', kind: 'fort', emoji: '🏰', pos: [1537, 10], size: [10, 10], name: 'Ngome Kongwe · Old Fort', blurb: ['Ngome ya Waomani ya karne ya 17.', 'The 17th-century Omani fort.'] },
  { id: 'christchurch', city: 'znz', kind: 'church', emoji: '⛪', pos: [1562, 31], size: [8, 10], name: 'Christ Church Cathedral', blurb: ['Imejengwa juu ya soko la zamani la watumwa.', 'Built on the site of the old slave market.'] },
  { id: 'aicc', city: 'aru', kind: 'twin', emoji: '🏙️', pos: [-1571, -45], size: [12, 8], name: 'AICC Arusha', blurb: ['Kituo cha mikutano cha kimataifa cha Arusha.', "Arusha's international conference centre."] },
  { id: 'arushatorch', city: 'aru', kind: 'torch', emoji: '🔥', pos: [-1580, -10], size: [5, 5], name: 'Mnara wa Azimio la Arusha', blurb: ['Mnara wa Azimio la Arusha, 1967.', 'The Arusha Declaration monument, 1967.'] },
];

// Hiring other players into your company.
export const HIRING = {
  maxWageMult: 8, // wage per shift: industry wage … 8× it
  maxSlots: 5,
  maxOpenPosts: 3,
  maxEmployers: 2, // a player can work for at most this many player companies
  announceEveryMs: 60 * 60_000,
  shiftSecs: 150,
  shiftEnergy: 10,
  outputMult: 2, // each finished shift earns the company 2× the industry wage
  activeMs: 24 * 3_600_000, // staff who worked within a day count towards capacity
  staffWeight: 2, // a real player counts as two NPC staff
  // Where each industry's staff go to work (the shift shows at this place).
  places: { food: 'mamantilie', salon: 'kinyozi', duka: 'kariakoo', fashion: 'fashion', events: 'club', pharmacy: 'hospitali', dispatch: 'stendi', tech: 'techhub' },
};
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
export const SHOP = {
  stockCost: 0.55, markups: [1, 1.2, 1.5, 2], buyCooldownMs: 3000,
  // An open player shop pays weekly rent from the company account: 1% of the industry's startup cost.
  rentPct: 0.01, rentEveryMs: 7 * 86_400_000, warnBeforeMs: 24 * 3_600_000, graceMs: 3 * 86_400_000,
};
export const shopRent = (industry) => Math.round(((industryById[industry]?.cost || 1_500_000) * SHOP.rentPct) / 500) * 500;

// ============================================================ dating (opt-in, 18+)
export const LOVE = {
  bioMax: 120,
  decayPerDay: 2, // affection fades without dates or gifts
  coupleAt: 40, // can ask "be my partner?"
  proposeAt: 75, // can propose (needs a ring)
  ringPrice: 5_000_000,
  weddingPrice: 3_000_000,
  dateCooldownMs: 30 * 60_000,
  askTtlMs: 15 * 60_000,
};
// Where you can take a date. Both of you must be there to start it; the inviter pays.
export const DATE_SPOTS = [
  { id: 'dinner', placeId: 'serena', emoji: '🍷', name: ['Chakula cha jioni Serena', 'Dinner at the Serena'], cost: 180_000, affection: 12, effects: { hunger: 40, social: 20, fun: 15 } },
  { id: 'sunset', placeId: 'coco', emoji: '🌅', name: ['Machweo Coco Beach', 'Sunset at Coco Beach'], cost: 20_000, affection: 8, effects: { fun: 20, social: 20 } },
  { id: 'cinema', placeId: 'mall', emoji: '🎬', name: ['Sinema Mlimani City', 'Movie at Mlimani City'], cost: 50_000, affection: 9, effects: { fun: 30, social: 15 } },
  { id: 'dhow', placeId: 'slipway', emoji: '⛵', name: ['Safari ya ngalawa Slipway', 'Dhow cruise from the Slipway'], cost: 120_000, affection: 11, effects: { fun: 30, social: 20 } },
  { id: 'dance', placeId: 'club', emoji: '💃', name: ['Usiku wa kucheza 1245', 'Dancing at 1245'], cost: 80_000, affection: 9, effects: { fun: 35, social: 25, energy: -10 } },
  { id: 'coffee', placeId: 'masakigrill', emoji: '☕', name: ['Kahawa Karambezi', 'Coffee at Karambezi'], cost: 25_000, affection: 6, effects: { social: 20, energy: 10 } },
  { id: 'nyama', placeId: 'nyamachoma', emoji: '🍖', name: ['Nyama choma Ubungo', 'Nyama choma at Ubungo'], cost: 40_000, affection: 7, effects: { hunger: 45, social: 15 } },
  { id: 'getaway', placeId: 'kendwa', emoji: '🏝️', name: ['Mapumziko Kendwa, Zanzibar', 'Kendwa getaway, Zanzibar'], cost: 600_000, affection: 20, effects: { fun: 45, social: 30, energy: 15 } },
];
export const dateSpotById = Object.fromEntries(DATE_SPOTS.map((d) => [d.id, d]));
export const LOVE_GIFTS = [
  { id: 'rose', emoji: '🌹', name: ['Waridi', 'A rose'], price: 20_000, affection: 4 },
  { id: 'choc', emoji: '🍫', name: ['Chokoleti', 'Chocolates'], price: 35_000, affection: 6 },
  { id: 'teddy', emoji: '🧸', name: ['Dubu la kuchezea', 'Teddy bear'], price: 60_000, affection: 9 },
  { id: 'bouquet', emoji: '💐', name: ['Shada la maua', 'Bouquet'], price: 120_000, affection: 13 },
  { id: 'perfume', emoji: '🌸', name: ['Manukato', 'Perfume'], price: 400_000, affection: 20 },
  { id: 'watch', emoji: '⌚', name: ['Saa ya kifahari', 'Luxury watch'], price: 1_500_000, affection: 30 },
];
export const loveGiftById = Object.fromEntries(LOVE_GIFTS.map((g) => [g.id, g]));
export const LOVE_STATUS = { match: ['Mmeendana', 'Matched'], couple: ['Wapenzi', 'Partners'], engaged: ['Wachumba', 'Engaged'], married: ['Wameoana', 'Married'] };

// ------------------------------------------------------------ love life with game characters
// Not matched with a real player yet? Date one of these Bongo singles: chat, dates, gifts,
// partner, proposal, wedding. vibe = what wins them over in chats: 'sweet' | 'fun' | 'chill'.
export const LOVE_NPCS = [
  { id: 'neema', name: 'Neema', age: 26, body: 'woman', city: 'Dar', job: ['Daktari', 'Doctor'], vibe: 'sweet', spot: 'dinner', gift: 'bouquet', bio: ['Napenda watu wakarimu na machweo ya Coco.', 'I like kind people and Coco Beach sunsets.'], look: { body: 'woman', skin: 3, hair: 'misuko', hairColor: 0, outfit: 'gauni-kitenge-refu', accent: 2 } },
  { id: 'zuhura', name: 'Zuhura', age: 24, body: 'woman', city: 'Zanzibar', job: ['Mpiga picha', 'Photographer'], vibe: 'chill', spot: 'getaway', gift: 'perfume', bio: ['Fukwe za Kendwa, kahawa na picha nzuri.', 'Kendwa beaches, coffee and good photos.'], look: { body: 'woman', skin: 4, hair: 'kilemba', hairColor: 0, outfit: 'maxi', accent: 4 } },
  { id: 'aisha', name: 'Aisha', age: 28, body: 'woman', city: 'Dar', job: ['Mfanyabiashara', 'Entrepreneur'], vibe: 'fun', spot: 'dance', gift: 'watch', bio: ['Boss lady. Singeli Ijumaa, biashara Jumatatu.', 'Boss lady. Singeli on Friday, business on Monday.'], look: { body: 'woman', skin: 2, hair: 'afro', hairColor: 1, outfit: 'blauzi-jeans', accent: 1 } },
  { id: 'rehema', name: 'Rehema', age: 25, body: 'woman', city: 'Arusha', job: ['Mwongozaji wa safari', 'Safari guide'], vibe: 'fun', spot: 'nyama', gift: 'teddy', bio: ['Simba, twiga na nyama choma — maisha matamu!', 'Lions, giraffes and nyama choma — sweet life!'], look: { body: 'woman', skin: 1, hair: 'mkia', hairColor: 0, outfit: 'kitenge', accent: 3 } },
  { id: 'faraja', name: 'Faraja', age: 27, body: 'woman', city: 'Dar', job: ['Mwalimu', 'Teacher'], vibe: 'sweet', spot: 'cinema', gift: 'choc', bio: ['Vitabu, sinema na mazungumzo marefu.', 'Books, films and long conversations.'], look: { body: 'woman', skin: 3, hair: 'kibanio', hairColor: 0, outfit: 'ofisi-sketi', accent: 0 } },
  { id: 'salma', name: 'Salma', age: 23, body: 'woman', city: 'Zanzibar', job: ['Mbunifu wa mitindo', 'Fashion designer'], vibe: 'chill', spot: 'dhow', gift: 'rose', bio: ['Mitindo ya Kiswahili na safari za ngalawa.', 'Swahili fashion and dhow trips.'], look: { body: 'woman', skin: 5, hair: 'misuko', hairColor: 2, outfit: 'gauni-sendoff', accent: 5 } },
  { id: 'baraka', name: 'Baraka', age: 29, body: 'man', city: 'Dar', job: ['Mhandisi', 'Engineer'], vibe: 'chill', spot: 'coffee', gift: 'watch', bio: ['Kahawa nzuri, gari safi, moyo mtulivu.', 'Good coffee, clean car, calm heart.'], look: { body: 'man', skin: 2, hair: 'kiduku', hairColor: 0, outfit: 'suti', accent: 2 } },
  { id: 'juma', name: 'Juma', age: 27, body: 'man', city: 'Zanzibar', job: ['Nahodha wa ngalawa', 'Dhow captain'], vibe: 'fun', spot: 'dhow', gift: 'perfume', bio: ['Bahari ni ofisi yangu. Twende tukaogelee!', "The sea is my office. Let's go swimming!"], look: { body: 'man', skin: 4, hair: 'rasta', hairColor: 0, outfit: 'kanzu', accent: 4 } },
  { id: 'khalid', name: 'Khalid', age: 30, body: 'man', city: 'Dar', job: ['Msanii wa Bongo Flava', 'Bongo Flava artist'], vibe: 'fun', spot: 'dance', gift: 'bouquet', bio: ['Nakuandikia wimbo ukinikubalia 🎤', "I'll write you a song if you say yes 🎤"], look: { body: 'man', skin: 1, hair: 'kofia', hairColor: 0, outfit: 'jaketi-ngozi', accent: 1 } },
  { id: 'daudi', name: 'Daudi', age: 31, body: 'man', city: 'Arusha', job: ['Mkulima wa kahawa', 'Coffee farmer'], vibe: 'sweet', spot: 'sunset', gift: 'choc', bio: ['Mlima Meru asubuhi, kahawa yangu mchana.', 'Mount Meru mornings, my own coffee by noon.'], look: { body: 'man', skin: 3, hair: 'kipara', hairColor: 0, outfit: 'shati-check', accent: 3 } },
  { id: 'emma', name: 'Emmanuel', age: 26, body: 'man', city: 'Dar', job: ['Mchezaji wa Simba SC', 'Simba SC footballer'], vibe: 'fun', spot: 'nyama', gift: 'teddy', bio: ['Mpira, gym na familia. Simba nguvu moja!', 'Football, gym and family. Simba nguvu moja!'], look: { body: 'man', skin: 2, hair: 'kiduku', hairColor: 0, outfit: 'jezi-simba', accent: 0 } },
  { id: 'omari', name: 'Omari', age: 28, body: 'man', city: 'Dar', job: ['Daktari wa meno', 'Dentist'], vibe: 'sweet', spot: 'dinner', gift: 'rose', bio: ['Tabasamu lako ni kazi yangu 😁', 'Your smile is literally my job 😁'], look: { body: 'man', skin: 3, hair: 'afro', hairColor: 0, outfit: 'polo', accent: 5 } },
];
export const loveNpcById = Object.fromEntries(LOVE_NPCS.map((n) => [n.id, n]));
// Chats: they ask, you pick a reply. Their vibe likes one style best.
export const NPC_CHAT = [
  { q: ['Unapenda kufanya nini wikendi?', 'What do you like doing on weekends?'], a: { sweet: ['Kukaa na mtu maalum kama wewe 😊', 'Spending time with someone special like you 😊'], fun: ['Kucheza Singeli mpaka asubuhi! 🔊', 'Dancing to Singeli till sunrise! 🔊'], chill: ['Kahawa na machweo ufukweni 🌅', 'Coffee and a beach sunset 🌅'] } },
  { q: ['Chakula unachopenda zaidi?', 'Your favourite food?'], a: { sweet: ['Chochote tukila pamoja 🥰', 'Anything, as long as we eat together 🥰'], fun: ['Chipsi mayai ya saa nane usiku 😂', 'Chips mayai at 2am 😂'], chill: ['Pilau ya mama, hakuna kama hiyo', "Mum's pilau — nothing beats it"] } },
  { q: ['Ndoto yako kubwa ni ipi?', "What's your biggest dream?"], a: { sweet: ['Familia yenye furaha na upendo', 'A happy, loving family'], fun: ['Kuzunguka Afrika nzima kwa gari 🚙', 'A road trip across the whole of Africa 🚙'], chill: ['Nyumba ndogo ufukweni Zanzibar', 'A little house on a Zanzibar beach'] } },
  { q: ['Siku yako imeendaje?', 'How was your day?'], a: { sweet: ['Imekuwa nzuri zaidi sasa unaponiandikia 💕', 'Better now that you texted 💕'], fun: ['Kama sinema ya action — nitakusimulia! 🎬', "Like an action movie — I'll tell you all about it! 🎬"], chill: ['Taratibu tu, nashukuru 🙏🏾', 'Slow and steady, grateful 🙏🏾'] } },
  { q: ['Wimbo gani unaupenda sasa hivi?', "What song are you loving right now?"], a: { sweet: ['Wimbo wa mapenzi wa Diamond 🎶', 'A Diamond love song 🎶'], fun: ['Singeli mpya — inanichezesha! 💃🏾', 'The new Singeli — it makes me dance! 💃🏾'], chill: ['Taarab ya zamani, inatuliza roho', 'Old-school taarab, it calms the soul'] } },
  { q: ['Ungenipeleka wapi deti ya kwanza?', 'Where would you take me on a first date?'], a: { sweet: ['Chakula cha jioni chenye mishumaa 🕯️', 'A candlelit dinner 🕯️'], fun: ['Go-kart kisha club! 🏎️', 'Go-karting, then the club! 🏎️'], chill: ['Ngalawa wakati wa machweo ⛵', 'A dhow at sunset ⛵'] } },
  { q: ['Unaamini katika mapenzi ya kweli?', 'Do you believe in true love?'], a: { sweet: ['Ndiyo — na nadhani nimeanza kuyaona 😉', 'Yes — and I think I might be seeing it 😉'], fun: ['Naamini katika vibes nzuri kwanza 😎', 'I believe in good vibes first 😎'], chill: ['Yanakuja polepole, kama chai nzuri ☕', 'It comes slowly, like good chai ☕'] } },
  { q: ['Unanikumbuka?', 'Were you thinking about me?'], a: { sweet: ['Kila siku 💭💕', 'Every single day 💭💕'], fun: ['Ndiyo, hasa wakati wa njaa 😂', 'Yes — mostly when I was hungry 😂'], chill: ['Kidogo… sana 😌', 'A little… a lot 😌'] } },
];
export const NPC_LOVE = { chatCooldownMs: 3 * 60_000, chatGood: 6, chatOk: 2, likeChance: 0.75, favouriteBonus: 6 };

// ============================================================ music (real tracks)
// Venues that can play uploaded tracks (admin tags each track with where it plays).
export const MUSIC_VENUES = [
  { id: 'club', name: '1245 Club', style: 'Bongo Flava' },
  { id: 'lounge', name: 'Elements', style: 'Amapiano' },
  { id: 'bar', name: 'Bar', style: 'Bongo Flava' },
  { id: 'studio', name: 'Bongo Flava Studio', style: 'Bongo Flava' },
  { id: 'singeli', name: 'Mbagala Singeli', style: 'Singeli' },
  { id: 'kendwa', name: 'Kendwa Rocks', style: 'Amapiano' },
  { id: 'stonetown', name: 'Stone Town', style: 'Taarab' },
  { id: 'forodhani', name: 'Forodhani', style: 'Taarab' },
  { id: 'home', name: 'Home radio', style: 'Any' },
];

// ============================================================ Zanzibar & Arusha businesses
// Buyable like the Dar ones: walk up (or use an agent in the Invest app) and it pays every hour.
const MORE_BUSINESS = {
  forodhani: { price: 15_000_000, incomePerHour: 100_000, label: 'Banda la Zanzibar pizza Forodhani', labelEn: 'Zanzibar pizza stall, Forodhani' },
  darajani: { price: 12_000_000, incomePerHour: 85_000, label: 'Kibanda cha viungo Darajani', labelEn: 'Spice stall, Darajani' },
  stonetown: { price: 30_000_000, incomePerHour: 200_000, label: 'Duka la vinyago Stone Town', labelEn: 'Curio shop, Stone Town' },
  spice: { price: 60_000_000, incomePerHour: 380_000, label: 'Shamba la Viungo (ziara)', labelEn: 'Spice farm tours' },
  therock: { price: 150_000_000, incomePerHour: 1_000_000 },
  nungwi: { price: 45_000_000, incomePerHour: 300_000, label: 'Baa ya ufukweni Nungwi', labelEn: 'Nungwi beach bar' },
  kendwa: { price: 260_000_000, incomePerHour: 1_800_000 },
  'zn-hotel': { price: 600_000_000, incomePerHour: 3_800_000 },
  maasai: { price: 14_000_000, incomePerHour: 95_000, label: 'Kibanda cha shanga za Kimasai', labelEn: 'Maasai beadwork stall' },
  coffee: { price: 80_000_000, incomePerHour: 520_000, label: 'Shamba la Kahawa (mavuno)', labelEn: 'Coffee farm (harvests)' },
  viavia: { price: 55_000_000, incomePerHour: 360_000 },
  'ar-hotel': { price: 450_000_000, incomePerHour: 2_900_000 },
  safari: { price: 200_000_000, incomePerHour: 1_350_000, label: 'Kampuni ya safari', labelEn: 'Safari company' },
};
for (const [id, b] of Object.entries(MORE_BUSINESS)) if (placeById[id] && !placeById[id].business) placeById[id].business = b;

// ============================================================ hustles (unlimited small businesses)
// No map spot needed — anyone can own several. Each earns per 6-hour shift (minus running
// costs), sometimes breaks down, and pays out when you collect income.
export const HUSTLES = [
  { id: 'chips', emoji: '🍟', name: ['Banda la chipsi mayai', 'Chips mayai stall'], price: 1_500_000, earn: [55_000, 85_000], cost: 6_000, breakChance: 0.05, repair: 120_000 },
  { id: 'boda', emoji: '🏍️', name: ['Bodaboda ya kukodisha', 'Bodaboda on hire'], price: 2_500_000, earn: [90_000, 140_000], cost: 15_000, breakChance: 0.07, repair: 200_000 },
  { id: 'wakala', emoji: '📱', name: ['Wakala wa pesa (M-Pesa)', 'Mobile money agent'], price: 4_000_000, earn: [140_000, 200_000], cost: 12_000, breakChance: 0.03, repair: 250_000 },
  { id: 'bajaji', emoji: '🛺', name: ['Bajaji ya kukodisha', 'Bajaji on hire'], price: 7_000_000, earn: [260_000, 380_000], cost: 35_000, breakChance: 0.07, repair: 500_000 },
  { id: 'carwash', emoji: '🧽', name: ['Car wash', 'Car wash'], price: 9_000_000, earn: [330_000, 480_000], cost: 45_000, breakChance: 0.04, repair: 600_000 },
  { id: 'container', emoji: '🏪', name: ['Duka la kontena', 'Container shop'], price: 15_000_000, earn: [550_000, 800_000], cost: 60_000, breakChance: 0.04, repair: 900_000 },
  { id: 'daladala', emoji: '🚐', name: ['Daladala', 'Daladala minibus'], price: 28_000_000, earn: [1_000_000, 1_500_000], cost: 150_000, breakChance: 0.1, repair: 1_800_000 },
  { id: 'carhire', emoji: '🚙', name: ['Gari la kukodisha', 'Car hire'], price: 40_000_000, earn: [1_500_000, 2_100_000], cost: 180_000, breakChance: 0.06, repair: 2_500_000 },
];
export const hustleById = Object.fromEntries(HUSTLES.map((h) => [h.id, h]));
export const HUSTLE = { periodMs: 6 * 3600_000, maxPeriods: 8, maxEach: 25, resale: 0.6 };

// ============================================================ stock exchange (Soko la Hisa)
// Prices (TSh per share) move every few minutes; dividends pay daily.
export const STOCKS = [
  { id: 'KIBO', name: 'Kibo Bank', emoji: '🏦', sector: ['Benki', 'Banking'], base: 650, vol: 0.012, div: 0.0006 },
  { id: 'MZLD', name: 'Mzalendo Bank', emoji: '🏦', sector: ['Benki', 'Banking'], base: 4_200, vol: 0.01, div: 0.0007 },
  { id: 'SIMU', name: 'SimuPoa Telecom', emoji: '📶', sector: ['Mawasiliano', 'Telecoms'], base: 750, vol: 0.014, div: 0.0005 },
  { id: 'KILI', name: 'Kili Breweries', emoji: '🍺', sector: ['Vinywaji', 'Beverages'], base: 10_900, vol: 0.009, div: 0.0008 },
  { id: 'SRJ', name: 'Saruji Cement', emoji: '🏗️', sector: ['Ujenzi', 'Construction'], base: 4_100, vol: 0.012, div: 0.0007 },
  { id: 'MAZA', name: 'Maziwa Foods', emoji: '🥤', sector: ['Vyakula', 'Food'], base: 2_500, vol: 0.011, div: 0.0006 },
  { id: 'NDGE', name: 'Ndege Air', emoji: '✈️', sector: ['Usafiri', 'Airlines'], base: 380, vol: 0.03, div: 0 },
  { id: 'MAFT', name: 'Mafuta Oil & Gas', emoji: '🛢️', sector: ['Nishati', 'Energy'], base: 450, vol: 0.035, div: 0 },
  { id: 'NEDA', name: 'NEDA Labs (nTZS)', emoji: '🪙', sector: ['Fintech', 'Fintech'], base: 1_000, vol: 0.03, div: 0.0002 },
  { id: 'BONGO', name: 'Bongo Flava Records', emoji: '🎤', sector: ['Burudani', 'Entertainment'], base: 1_200, vol: 0.025, div: 0.0003 },
];
export const stockById = Object.fromEntries(STOCKS.map((s) => [s.id, s]));
export const MARKET = { tickMs: 5 * 60_000, feePct: 0.005, impact: 0.02, historyLen: 96 };

// ============================================================ street life: wanted, missions, heists
export const STREET = {
  maxStars: 5,
  decayMs: 90_000, // one star drops by itself after this long without new crimes
  copSpeed: [14, 16, 18, 20, 23], // police chasing a car (you drive ~19, ~32 flat out)
  copFoot: [8, 9, 10, 11, 12], // police chasing you on foot (walk 7.5, run 13 — keep running!)
  copsPerStar: [1, 2, 3, 4, 5],
  bustRange: 3.2,
  bustHoldMs: 1500,
  loseRange: 48,
  loseHoldMs: 22_000,
  bustFine: [60_000, 150_000, 300_000, 600_000, 1_000_000],
  carjackStars: 1,
  robStars: 2,
  heistStars: 4,
  chop: [-138, 30], // chop shop in Ubungo, west Dar
  chopPay: { car: 2_500_000, suv: 4_000_000, van: 2_000_000, moto: 600_000, bajaji: 1_200_000 },
  heist: { gear: 250_000, cooldownMs: 30 * 60_000, timeMs: 150_000, loot: [2_500_000, 7_000_000], places: ['bank'] },
  missions: {
    delivery: { emoji: '📦', name: ['Mzigo wa haraka', 'Rush delivery'], base: 30_000, perM: 450, speed: 9 },
    taxi: { emoji: '🚕', name: ['Teksi ya dharura', 'Taxi rush'], base: 20_000, perM: 380, speed: 10, needCar: true },
    race: { emoji: '🏁', name: ['Mbio za mtaani', 'Street race'], base: 60_000, perM: 250, speed: 15, needCar: true, points: 5 },
  },
};
export const CARJACK_MODEL = { car: 'crown', suv: 'prado', van: 'noah', moto: 'bodaboda', bajaji: 'bajaji' };

// ============================================================ news & media
// In-game media houses (fictional, Bongo-flavoured). Stories are written by the server from what
// players actually do: fortunes, crimes, scandals, launches, rivalries and rankings.
export const NEWS_OUTLETS = [
  { id: 'forbz', name: 'Forbz Bongo', emoji: '💎', color: '#0f172a', accent: '#facc15', tag: ['Utajiri na mabilionea', 'Wealth & billionaires'] },
  { id: 'mwanabongo', name: 'Mwanabongo', emoji: '📰', color: '#b91c1c', accent: '#fef2f2', tag: ['Gazeti la kila siku', 'The daily paper'] },
  { id: 'wasafa', name: 'Wasafa TV', emoji: '🎤', color: '#7c3aed', accent: '#f5f3ff', tag: ['Burudani, mapenzi na skendo', 'Showbiz, love & scandal'] },
  { id: 'tbx', name: 'TBX Taifa', emoji: '📺', color: '#1d4ed8', accent: '#eff6ff', tag: ['Habari za kitaifa na usalama', 'National news & crime'] },
  { id: 'eavision', name: 'EA Vision TV', emoji: '📡', color: '#0f766e', accent: '#f0fdfa', tag: ['Biashara Afrika Mashariki', 'East African business'] },
  { id: 'dailybongo', name: 'The Bongo Daily', emoji: '🗞️', color: '#374151', accent: '#f9fafb', tag: ['Habari kwa Kiingereza', 'News in English'] },
];
export const outletById = Object.fromEntries(NEWS_OUTLETS.map((o) => [o.id, o]));
export const NEWS_CATS = {
  wealth: { emoji: '💰', name: ['Utajiri', 'Wealth'], outlets: ['forbz', 'dailybongo', 'eavision'] },
  milestone: { emoji: '🏆', name: ['Hatua mpya', 'Milestones'], outlets: ['forbz', 'mwanabongo'] },
  ranking: { emoji: '📊', name: ['Orodha', 'Rankings'], outlets: ['forbz', 'eavision'] },
  business: { emoji: '🏢', name: ['Biashara', 'Business'], outlets: ['eavision', 'dailybongo', 'forbz'] },
  luxury: { emoji: '🛥️', name: ['Anasa', 'Luxury'], outlets: ['forbz', 'wasafa'] },
  crime: { emoji: '🚨', name: ['Uhalifu', 'Crime'], outlets: ['tbx', 'mwanabongo'] },
  scandal: { emoji: '🫢', name: ['Skendo', 'Scandal'], outlets: ['wasafa', 'mwanabongo'] },
  love: { emoji: '💘', name: ['Mapenzi', 'Love'], outlets: ['wasafa'] },
  politics: { emoji: '🏛️', name: ['Siasa', 'Politics'], outlets: ['tbx', 'mwanabongo', 'dailybongo'] },
  sport: { emoji: '🏁', name: ['Michezo', 'Sport'], outlets: ['mwanabongo', 'wasafa'] },
};
// Net-worth milestones that make the papers.
export const WEALTH_MARKS = [1e6, 1e7, 1e8, 1e9, 1e10, 1e11, 1e12, 1e13, 1e14, 1e15, 1e18];
export function bigMoney(n) {
  const u = [[1e18, ['kwintilioni', 'quintillion']], [1e15, ['kwadrilioni', 'quadrillion']], [1e12, ['trilioni', 'trillion']], [1e9, ['bilioni', 'billion']], [1e6, ['milioni', 'million']]];
  for (const [v, [sw, en]] of u) if (n >= v) { const x = n / v; const s = x >= 100 ? Math.round(x) : +x.toFixed(1); return [`TSh ${s} ${sw}`, `TSh ${s} ${en}`]; }
  return [`TSh ${Math.round(n).toLocaleString()}`, `TSh ${Math.round(n).toLocaleString()}`];
}

// ============================================================ security
// Hire protection by the day. Guards walk with you, put robbers off and can delay an arrest.
export const GUARDS = [
  { id: 'mlinzi', emoji: '🧍🏾‍♂️', name: ['Mlinzi binafsi', 'Personal guard'], perDay: 60_000, men: 1, protect: 0.3, copDelay: 0, blurb: ['Mlinzi mmoja wa kampuni ya ulinzi.', 'One guard from a security firm.'] },
  { id: 'bodyguard', emoji: '💪🏾', name: ['Bodyguards wawili', 'Two bodyguards'], perDay: 200_000, men: 2, protect: 0.5, copDelay: 0, blurb: ['Mabaunsa wawili, suti nyeusi.', 'Two big men in black suits.'] },
  { id: 'elite', emoji: '🕶️', name: ['Ulinzi wa VIP', 'VIP close protection'], perDay: 700_000, men: 3, protect: 0.75, copDelay: 0.5, blurb: ['Walinzi watatu waliofunzwa, miwani na redio.', 'Three trained agents with shades and radios.'] },
  { id: 'convoy', emoji: '🚙', name: ['Msafara wa ulinzi', 'Security convoy'], perDay: 2_500_000, men: 4, protect: 0.92, copDelay: 1, blurb: ['Walinzi wanne — kama Rais. Wezi hawasogei.', 'Four agents — presidential style. Robbers stay away.'] },
];
export const guardById = Object.fromEntries(GUARDS.map((g) => [g.id, g]));
