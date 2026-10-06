// Bongo Life — shared world catalog (used by both server and client).
// Coordinates: x grows east (towards the Indian Ocean), z grows south.

export const GAME = {
  name: 'Bongo Life',
  city: 'Dar es Salaam',
  startMoney: 50_000,
  // 1 real second = 1 game minute → one game day is 24 real minutes.
  minutesPerSecond: 1,
  // Real TZS paid on top-up → in-game TSh credited.
  defaultTopupRate: 100,
  minTopupTzs: 1_000,
  maxTopupTzs: 1_000_000,
  incomeCapHours: 12,
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

export function isWater(x, z) {
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
];

export function onRoad(x, z, pad = 0) {
  return ROADS.some(([x1, z1, x2, z2, w]) => {
    const h = w / 2 + pad;
    return x >= Math.min(x1, x2) - h && x <= Math.max(x1, x2) + h && z >= Math.min(z1, z2) - h && z <= Math.max(z1, z2) + h;
  });
}

// --------------------------------------------------------------- districts
export const DISTRICTS = [
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
  { id: 'hunger', name: 'Njaa', icon: '🍛', color: '#f59e0b', decay: 0.8 },
  { id: 'energy', name: 'Nguvu', icon: '⚡', color: '#3b82f6', decay: 0.55 },
  { id: 'fun', name: 'Raha', icon: '🎉', color: '#ec4899', decay: 0.7 },
  { id: 'hygiene', name: 'Usafi', icon: '🚿', color: '#06b6d4', decay: 0.5 },
  { id: 'social', name: 'Jamii', icon: '💬', color: '#8b5cf6', decay: 0.6 },
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
// pattern: plain | kitenge | kanga | stripes | jersey
export const OUTFITS = [
  { id: 'tshirt', name: 'T-shirt na Jeans', price: 0, top: '#f8fafc', bottom: '#1e3a8a', pattern: 'plain', style: 'casual' },
  { id: 'kitenge', name: 'Gauni la Kitenge', price: 0, top: '#f59e0b', bottom: '#f59e0b', pattern: 'kitenge', style: 'dress' },
  { id: 'kanga', name: 'Kanga', price: 0, top: '#16a34a', bottom: '#16a34a', pattern: 'kanga', style: 'dress' },
  { id: 'kanzu', name: 'Kanzu na Kofia', price: 0, top: '#f8fafc', bottom: '#f8fafc', pattern: 'plain', style: 'robe' },
  { id: 'shati', name: 'Shati la Kitenge', price: 0, top: '#dc2626', bottom: '#111827', pattern: 'kitenge', style: 'casual' },
  { id: 'jezi-simba', name: 'Jezi ya Simba', price: 35_000, top: '#dc2626', bottom: '#f8fafc', pattern: 'jersey', style: 'casual' },
  { id: 'jezi-yanga', name: 'Jezi ya Yanga', price: 35_000, top: '#facc15', bottom: '#15803d', pattern: 'jersey', style: 'casual' },
  { id: 'hoodie', name: 'Hoodie ya Bongo Flava', price: 60_000, top: '#111827', bottom: '#374151', pattern: 'stripes', style: 'casual' },
  { id: 'suti', name: 'Suti ya Kibosile', price: 250_000, top: '#0f172a', bottom: '#0f172a', pattern: 'plain', style: 'suit' },
  { id: 'gauni-sendoff', name: 'Gauni la Send-off', price: 400_000, top: '#a21caf', bottom: '#a21caf', pattern: 'kitenge', style: 'dress' },
  { id: 'gym', name: 'Nguo za Gym', price: 25_000, top: '#22c55e', bottom: '#111827', pattern: 'stripes', style: 'casual' },
];
export const outfitById = Object.fromEntries(OUTFITS.map((o) => [o.id, o]));

export function randomAppearance(seed = Math.random()) {
  const r = (n, k = 1) => Math.floor(((seed * 9301 * k + 49297) % 233280) / 233280 * n);
  const body = Math.random() < 0.5 ? 'woman' : 'man';
  const freeOutfits = OUTFITS.filter((o) => o.price === 0 && (body === 'woman' || o.style !== 'dress'));
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
  { id: 'ist', name: 'Toyota IST', kind: 'car', price: 16_000_000, speed: 2.4, emoji: '🚗', color: '#e5e7eb' },
  { id: 'noah', name: 'Toyota Noah', kind: 'van', price: 28_000_000, speed: 2.4, emoji: '🚐', color: '#1f2937' },
  { id: 'harrier', name: 'Toyota Harrier', kind: 'suv', price: 60_000_000, speed: 2.7, emoji: '🚙', color: '#7f1d1d' },
  { id: 'v8', name: 'Land Cruiser V8', kind: 'suv', price: 170_000_000, speed: 2.9, emoji: '🛻', color: '#111827' },
];
export const vehicleById = Object.fromEntries(VEHICLES.map((v) => [v.id, v]));
export const VEHICLE_COLORS = ['#e5e7eb', '#111827', '#dc2626', '#1d4ed8', '#16a34a', '#facc15', '#f97316', '#7c3aed'];

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
    id: 'bank', name: 'Benki ya Bongo', district: 'Posta', type: 'bank', icon: '🏦', pos: [44, 14], size: [12, 12], h: 20, color: '#94a3b8',
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
    id: 'gym', name: 'Bongo Fitness Gym', district: 'Mlimani', type: 'gym', icon: '🏋️', pos: [5, -62], size: [10, 8], h: 6, color: '#a3e635',
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
    id: 'club', name: 'Club Mzuka', district: 'Sinza', type: 'club', icon: '🪩', pos: [-92, -64], size: [13, 12], h: 9, color: '#312e81',
    blurb: 'Bongo Flava, Amapiano na Singeli mpaka asubuhi.',
    business: { price: 220_000_000, incomePerHour: 1_600_000 },
    activities: [
      { id: 'cheza', name: 'Ingia ucheze', cost: 10_000, secs: 20, effects: { fun: 40, social: 20, energy: -15, hygiene: -8 }, emoji: '💃' },
      { id: 'mzunguko', name: 'Nunua mzunguko kwa washkaji', cost: 30_000, secs: 8, effects: { social: 40, fun: 15 }, emoji: '🥂', fame: 1 },
      { id: 'vip', name: 'Meza ya VIP', cost: 180_000, secs: 25, effects: { fun: 70, social: 50, energy: -12 }, emoji: '🍾', fame: 3 },
    ],
    jobs: [{ id: 'dj', title: 'DJ', titles: ['DJ chipukizi', 'Resident DJ', 'DJ wa Mzuka', 'DJ Bingwa'], secs: 55, pay: 32_000, energy: 12 }],
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
      { id: 'taxi', title: 'Dereva wa Taxi Mtandao', titles: ['Dereva', 'Dereva nyota 5', 'Mmiliki wa fleet'], secs: 55, pay: 45_000, energy: 10, requires: { vehicle: ['ist', 'noah', 'harrier', 'v8'] } },
    ],
  },
  {
    id: 'yadi', name: 'Yadi ya Magari', district: 'Ubungo', type: 'yard', icon: '🚗', pos: [-130, -22], size: [16, 13], h: 3, color: '#e2e8f0',
    blurb: 'IST, Noah, Harrier, V8 — na bodaboda za kuanzia.',
    shop: 'vehicles', activities: [],
  },
  {
    id: 'uwanja', name: 'Uwanja wa Taifa', district: 'Temeke', type: 'stadium', icon: '🏟️', pos: [6, 76], size: [30, 22], h: 9, color: '#e5e7eb',
    blurb: 'Dabi ya Kariakoo — Simba vs Yanga!',
    activities: [
      { id: 'dabi', name: 'Tiketi ya Dabi: Simba vs Yanga', cost: 15_000, secs: 30, effects: { fun: 55, social: 35, energy: -10 }, emoji: '⚽' },
      { id: 'kimbia', name: 'Kimbia kwenye track', cost: 0, secs: 15, effects: { fun: 10, energy: -15, hygiene: -12 }, emoji: '🏃' },
    ],
    jobs: [{ id: 'mlinzi', title: 'Mlinzi wa Uwanja', titles: ['Mlinzi', 'Mkuu wa ulinzi'], secs: 45, pay: 16_000, energy: 10 }],
  },
  {
    id: 'masakigrill', name: 'Masaki Seafood Grill', district: 'Masaki', type: 'restaurant', icon: '🦞', pos: [106, -104], size: [12, 10], h: 7, color: '#fef3c7',
    blurb: 'Kamba, pweza na sunset ya Msasani.',
    activities: [
      { id: 'seafood', name: 'Seafood platter', cost: 45_000, secs: 12, effects: { hunger: 85, fun: 25, social: 10 }, emoji: '🦐' },
      { id: 'date', name: 'Dinner date ya kishua', cost: 120_000, secs: 20, effects: { hunger: 70, fun: 45, social: 45 }, emoji: '🕯️', fame: 2 },
    ],
    jobs: [{ id: 'chef', title: 'Chef', titles: ['Commis chef', 'Sous chef', 'Head chef'], secs: 55, pay: 35_000, energy: 11 }],
  },
  {
    id: 'lounge', name: 'Msasani Rooftop Lounge', district: 'Masaki', type: 'lounge', icon: '🍸', pos: [122, -104], size: [10, 10], h: 14, color: '#1e293b',
    blurb: 'Rooftop ya mastaa — kula bata kwa staili.',
    business: { price: 380_000_000, incomePerHour: 2_400_000 },
    activities: [
      { id: 'sundowner', name: 'Sundowner rooftop', cost: 60_000, secs: 20, effects: { fun: 55, social: 35 }, emoji: '🌅', fame: 2 },
    ],
  },
  {
    id: 'kigbeach', name: 'Kigamboni Beach Resort', district: 'Kigamboni', type: 'beach', icon: '🌴', pos: [90, 100], size: [8, 30], h: 0, color: '#fde68a',
    blurb: 'Fukwe safi za Kigamboni, mbali na kelele za mjini.',
    activities: [
      { id: 'pumzika', name: 'Pumzika ufukweni', cost: 5_000, secs: 20, effects: { energy: 30, fun: 25, hygiene: 5 }, emoji: '🏝️' },
      { id: 'ogelea2', name: 'Ogelea', cost: 0, secs: 15, effects: { fun: 25, hygiene: 12, energy: -8 }, emoji: '🏊' },
    ],
  },
  {
    id: 'airport', name: 'JNIA Airport', district: 'Temeke', type: 'airport', icon: '✈️', pos: [-82, 96], size: [36, 22], h: 8, color: '#cbd5e1',
    blurb: 'Safari za Zanzibar, Arusha na nje ya nchi — zinakuja hivi karibuni!',
    comingSoon: true, activities: [],
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

// ---------------------------------------------------------- fast travel
export const TRAVEL = {
  bajaji: { name: 'Bajaji', emoji: '🛺', perUnit: 25, min: 1_000 },
  daladala: { name: 'Daladala', emoji: '🚌', perUnit: 6, min: 500 },
};
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
  const totalMin = Math.floor((now / 1000) * GAME.minutesPerSecond) % 1440;
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
  travel: { bajaji: 'Bajaji (tuk-tuk)', daladala: 'Daladala (minibus)' },
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
    bank: ['Bongo Bank', 'Top up your wallet with M-Pesa, Mixx by Yas or Airtel Money.', {}],
    fishmarket: ['Feri Fish Market', 'Fresh fish from the ocean every morning.', { samakichoma: 'Grilled fish' }],
    techhub: ['Dar Tech Hub', "Startups, coders and Bongo's big ideas.", { hackathon: 'Join a hackathon' }],
    posta: ['Posta Towers', 'Offices of the big companies. AC and a tie.', {}],
    ferry: ['Kivukoni Ferry', 'Cross to Kigamboni on the ferry.', { vuka: 'Take the ferry to Kigamboni' }],
    ferrykig: ['Kigamboni Ferry', 'Head back to town on the ferry.', { rudi: 'Take the ferry to Posta' }],
    coco: ['Coco Beach', 'Roast cassava, coconuts and the ocean breeze.', {
      ogelea: 'Swim in the ocean', mihogo: 'Roast cassava', madafu: 'Fresh coconut', 'piga-stori': 'Hang out with friends' }],
    mall: ['Mlimani City', 'Mall, cinema, food court — a classy day out.', { sinema: 'Watch a movie', burger: 'Burger & juice', window: 'Window shopping' }],
    gym: ['Bongo Fitness Gym', 'Build muscle, lose the belly.', { mazoezi: 'Work out' }],
    chuo: ['University of Dar', 'Take courses to gain education — unlocks banking and tech jobs.', {
      kozi: 'Take a course (Education +1)', maktaba: 'Study in the library' }],
    club: ['Club Mzuka', 'Bongo Flava, Amapiano and Singeli till sunrise.', {
      cheza: 'Go in and dance', mzunguko: 'Buy a round for friends', vip: 'VIP table' }],
    bar: ['Corner Bar', 'Nyama choma, football on TV and street stories.', {
      nyamachoma: 'Nyama choma (grilled meat)', soda: 'Drinks with friends', mpira: 'Watch football' }],
    studio: ['Bongo Flava Studio', 'Record your track — tomorrow you could be a star.', { rekodi: 'Record a song', video: 'Shoot a music video' }],
    stendi: ['Magufuli Bus Terminal', 'Daladalas and upcountry buses. The conductor is calling!', { kijiweni: 'Hang at the base' }],
    yadi: ['Car Yard', 'IST, Noah, Harrier, V8 — and starter bodabodas.', {}],
    uwanja: ['National Stadium', 'The Kariakoo Derby — Simba vs Yanga!', { dabi: 'Derby ticket: Simba vs Yanga', kimbia: 'Run on the track' }],
    masakigrill: ['Masaki Seafood Grill', 'Prawns, octopus and the Msasani sunset.', { seafood: 'Seafood platter', date: 'Fancy dinner date' }],
    lounge: ['Msasani Rooftop Lounge', 'The celebs’ rooftop — enjoy life in style.', { sundowner: 'Rooftop sundowner' }],
    kigbeach: ['Kigamboni Beach Resort', 'Clean beaches far from the city noise.', { pumzika: 'Relax on the beach', ogelea2: 'Swim' }],
    airport: ['JNIA Airport', 'Flights to Zanzibar, Arusha and abroad — coming soon!', {}],
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
    dj: ['DJ', ['Rookie DJ', 'Resident DJ', 'Mzuka DJ', 'Champion DJ']],
    mhudumu: ['Bar Attendant', ['Waiter', 'Bartender', 'Bar Manager']],
    msanii: ['Artist', ['Upcoming artist', 'Street artist', 'Bongo Flava star', 'Legend']],
    konda: ['Daladala Conductor', ['Conductor', 'Daladala driver', 'Daladala owner']],
    bodaboda: ['Bodaboda Rider', ['Rider', 'Seasoned rider', 'Base boss']],
    taxi: ['Ride-hailing Driver', ['Driver', '5-star driver', 'Fleet owner']],
    mlinzi: ['Stadium Guard', ['Guard', 'Head of security']],
    chef: ['Chef', ['Commis chef', 'Sous chef', 'Head chef']],
  },
};

for (const n of NEEDS) n.nameEn = EN.needs[n.id];
for (const t of TRAITS) [t.nameEn, t.perkEn] = EN.traits[t.id];
for (const [id, s] of Object.entries(SPAWNS)) s.blurbEn = EN.spawns[id];
for (const h of HAIRSTYLES) h.nameEn = EN.hair[h.id];
for (const o of OUTFITS) o.nameEn = EN.outfits[o.id];
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
  for (const j of p.jobs || []) [j.titleEn, j.titlesEn] = EN.jobs[j.id];
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
