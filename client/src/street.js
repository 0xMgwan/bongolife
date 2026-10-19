// Mtaani client logic: police chase, mission markers, carjacking. Positions live outside React
// (like `local`); the HUD and 3D layer read from here every frame.
import { STREET, ROADS, cityAt, vehicleById } from '@shared/world.js';
import { useStore } from './store.js';
import { api } from './api.js';
import { local, trafficCars, view } from './net.js';
import { L } from './i18n.js';
import { sfx } from './audio.js';

export const chase = { cops: [], nearMs: 0, clearMs: 0, busy: false, cpBusy: false, lastCp: 0 };
export const near = { car: null, chop: false, bank: false };

export async function refreshStreet() {
  const d = await api('/street').catch(() => null);
  if (!d) return null;
  useStore.setState({ street: d });
  if (!d.stolen && useStore.getState().stolenCar) useStore.setState({ stolenCar: null });
  // Reloaded mid-joyride: the car is gone, let the server know.
  if (d.stolen && !useStore.getState().stolenCar) api('/street/ditch', { method: 'POST' }).catch(() => {});
  return d;
}

const st = () => useStore.getState();
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Spawn cops on a road behind you, out of sight. */
function spawnCop() {
  const city = cityAt(local.x, local.z)?.id || 'dar';
  const roads = ROADS.filter(([x1, z1]) => cityAt(x1, z1)?.id === city || cityAt(x1 + 1, z1 + 1)?.id === city);
  for (let i = 0; i < 30; i++) {
    const [x1, z1, x2, z2] = roads[Math.floor(Math.random() * roads.length)];
    const t = Math.random();
    const p = [x1 + (x2 - x1) * t, z1 + (z2 - z1) * t];
    const d = dist(p, [local.x, local.z]);
    if (d > 50 && d < 90) return { x: p[0], z: p[1], ry: 0, siren: 0 };
  }
  return { x: local.x + 50, z: local.z + 50, ry: 0, siren: 0 };
}

/** Called every frame from the 3D layer. */
export function streetFrame(dt) {
  const s = st();
  const stars = s.street?.stars || 0;
  const inTown = s.tab === 'town' && !s.inside && s.cityView !== 'map';
  // ---- police
  const want = inTown ? STREET.copsPerStar[stars - 1] || 0 : 0;
  while (chase.cops.length < want) chase.cops.push(spawnCop());
  if (chase.cops.length > want) chase.cops.length = want;
  if (want) {
    const onFoot = !s.stolenCar && !s.me?.activeVehicle;
    const speed = (onFoot ? STREET.copFoot : STREET.copSpeed)[stars - 1];
    let closest = Infinity;
    chase.cops.forEach((c, i) => {
      // Each cop aims a little to the side so they box you in instead of stacking up.
      const off = (i - (chase.cops.length - 1) / 2) * 3;
      const tx = local.x + Math.cos(local.ry) * off;
      const tz = local.z - Math.sin(local.ry) * off;
      const dx = tx - c.x;
      const dz = tz - c.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.5) {
        // Fresh units take a few seconds to get going; stragglers far behind catch up fast.
        const ramp = Math.min(1, (c.siren + 0.5) / 4);
        const step = Math.min(d, speed * ramp * dt * (d > 70 ? 1.5 : 1));
        c.x += (dx / d) * step;
        c.z += (dz / d) * step;
        let diff = Math.atan2(dx, dz) - c.ry;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        c.ry += diff * Math.min(1, dt * 5);
      }
      c.siren += dt;
      closest = Math.min(closest, Math.hypot(local.x - c.x, local.z - c.z));
    });
    chase.closest = closest;
    if (closest < STREET.bustRange) chase.nearMs += dt * 1000;
    else chase.nearMs = Math.max(0, chase.nearMs - dt * 2000);
    if (closest > STREET.loseRange) chase.clearMs += dt * 1000;
    else chase.clearMs = 0;
    // Bodyguards hold the cops off for a bit longer.
    if (chase.nearMs > STREET.bustHoldMs * (1 + (s.me?.guards?.copDelay || 0)) && !chase.busy) {
      chase.busy = true;
      api('/street/busted', { method: 'POST' }).then((r) => {
        if (r.me) useStore.setState({ me: r.me });
        useStore.setState({ stolenCar: null });
        chase.cops.length = 0;
        sfx('siren');
        if (r.ok) st().toast(L(`🚓 UMEKAMATWA! Faini ${r.fine.toLocaleString()}${r.lost ? ' — mzigo wa benki umechukuliwa' : ''}`, `🚓 BUSTED! Fine ${r.fine.toLocaleString()}${r.lost ? ' — the bank loot is gone' : ''}`), 'err');
        refreshStreet();
      }).catch(() => {}).finally(() => { chase.busy = false; chase.nearMs = 0; });
    }
    if (chase.clearMs > STREET.loseHoldMs && !chase.busy) {
      chase.busy = true;
      api('/street/escaped', { method: 'POST' }).then((r) => {
        if (r.escaped) {
          useStore.setState((x) => ({ street: { ...x.street, stars: r.stars } }));
          st().toast(L('😎 Umewapoteza polisi!', '😎 You lost the cops!'));
          sfx('levelup');
          chase.cops.length = 0;
        }
      }).catch(() => {}).finally(() => { chase.busy = false; chase.clearMs = 0; });
    }
  } else {
    chase.nearMs = 0;
    chase.clearMs = 0;
    chase.closest = Infinity;
  }
  // ---- markers
  const target = markerTarget();
  if (target && inTown && dist(target.pos, [local.x, local.z]) < 8 && !chase.cpBusy && Date.now() - chase.lastCp > 800) {
    chase.cpBusy = true;
    chase.lastCp = Date.now();
    api('/street/checkpoint', { method: 'POST' }).then(onCheckpoint).catch(() => {}).finally(() => { chase.cpBusy = false; });
  }
  // ---- nearby things for the HUD buttons
  const walking = inTown && !s.me?.activeVehicle && !s.stolenCar && !s.riding;
  let car = null;
  if (walking) {
    let best = 4.2;
    trafficCars.forEach((c, i) => {
      if (!c || c.gone || c.kind === 'bus') return;
      const d = Math.hypot(c.x - local.x, c.z - local.z);
      if (d < best) { best = d; car = i; }
    });
  }
  near.car = car;
  near.chop = !!s.stolenCar && dist(STREET.chop, [local.x, local.z]) < 12;
  near.bank = inTown && !!s.street?.bank && dist(s.street.bank, [local.x, local.z]) < 22;
}

/** Where the glowing beam is: next mission marker, the safehouse, or the chop shop. */
export function markerTarget() {
  const s = st().street;
  if (s?.heist) return { pos: s.heist.safe, color: '#f59e0b', kind: 'safe' };
  if (s?.mission) return { pos: s.mission.points[s.mission.idx], color: s.mission.kind === 'race' ? '#ef4444' : '#22c55e', kind: s.mission.kind };
  return null;
}

function onCheckpoint(r) {
  if (r.mission) {
    useStore.setState((x) => ({ street: { ...x.street, mission: r.mission } }));
    sfx('coin');
  }
  if (r.needCar) st().toast(L('Unahitaji gari kwa kazi hii.', 'You need wheels for this job.'), 'err');
  if (r.done) {
    sfx('cash');
    const extra = r.record ? L(' · 🏆 Rekodi mpya!', ' · 🏆 New record!') : r.tip ? L(` (tip ${r.tip.toLocaleString()})`, ` (tip ${r.tip.toLocaleString()})`) : '';
    st().toast(r.heist ? L(`💰 Umetoroka! +TSh ${r.paid.toLocaleString()}`, `💰 You got away! +TSh ${r.paid.toLocaleString()}`) : L(`✅ Kazi imekamilika: +TSh ${r.paid.toLocaleString()}${extra}`, `✅ Job done: +TSh ${r.paid.toLocaleString()}${extra}`));
    st().refreshMe?.().catch(() => {});
    refreshStreet();
  }
  if (r.failed) refreshStreet();
}

/** Pull someone out of the car next to you and drive off in it. */
export async function jackCar() {
  const i = near.car;
  const c = i != null && trafficCars[i];
  if (!c) return;
  const kind = c.kind === 'bus' ? 'van' : c.kind;
  const r = await st().run('/street/carjack', { method: 'POST', body: { kind, color: c.color } });
  if (!r) return;
  c.stolenAt = Date.now();
  local.x = c.x;
  local.z = c.z;
  local.teleported++;
  useStore.setState((x) => ({ stolenCar: { ...r.vehicle, id: 'stolen' }, street: { ...x.street, stolen: r.stolen } }));
  sfx('horn');
  st().toast(L(`😈 Umeiba ${vehicleById[r.vehicle.model]?.name || 'gari'}! Lipeleke gereji ya Ubungo upate TSh ${r.pay.toLocaleString()}`, `😈 You jacked a ${vehicleById[r.vehicle.model]?.nameEn || 'car'}! Take it to the Ubungo chop shop for TSh ${r.pay.toLocaleString()}`));
}
export async function ditchCar() {
  const r = await st().run('/street/ditch', { method: 'POST' });
  if (!r) return;
  useStore.setState((x) => ({ stolenCar: null, street: { ...x.street, stolen: null } }));
  if (r.paid) { sfx('cash'); st().toast(L(`🔧 Gereji imelinunua: +TSh ${r.paid.toLocaleString()}`, `🔧 The chop shop paid: +TSh ${r.paid.toLocaleString()}`)); st().refreshMe?.().catch(() => {}); }
}

/** Screen arrow angle (degrees, clockwise from up) toward a world point. */
export function arrowTo(pos) {
  const dx = pos[0] - local.x;
  const dz = pos[1] - local.z;
  const fx = -Math.sin(view.yaw);
  const fz = -Math.cos(view.yaw);
  const rx = Math.cos(view.yaw);
  const rz = -Math.sin(view.yaw);
  return (Math.atan2(dx * rx + dz * rz, dx * fx + dz * fz) * 180) / Math.PI;
}
if (import.meta.env.DEV) window.__street = { chase, near, local, trafficCars, jackCar, refreshStreet };
