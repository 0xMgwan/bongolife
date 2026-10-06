import { useEffect, useState } from 'react';
import {
  NEEDS, OUTFITS, VEHICLES, VEHICLE_COLORS, BUILDINGS, ALLOWED_BUILDINGS, placeById, plotById, billboardById, buildingById,
  shiftPay, jobTitle, jobTitleEn, jobLevel, fmtTsh, fmtShort, vehicleById, TRAITS,
} from '@shared/world.js';
import { useStore } from '../store.js';
import { api } from '../api.js';
import { avatarEmoji } from '../three/Avatar.jsx';
import { AvatarPreview } from './Creator.jsx';
import { L, loc, isEn } from '../i18n.js';

const jt = (j, n) => (isEn() ? jobTitleEn(j, n) : jobTitle(j, n));

export function Sheet({ title, icon, sub, onClose, children }) {
  return (
    <div className="sheet-wrap" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <div className="grab" />
          <h2>{icon && <span>{icon}</span>}{title}</h2>
          {sub && <div className="small muted" style={{ marginTop: 4 }}>{sub}</div>}
          <button className="x" onClick={onClose} aria-label={L('Funga', 'Close')}>✕</button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

export function Effects({ effects, fame }) {
  const map = Object.fromEntries(NEEDS.map((n) => [n.id, n]));
  return (
    <div className="fx">
      {Object.entries(effects || {}).map(([k, v]) => (
        <span key={k} className={v > 0 ? 'up' : 'dn'}>{map[k]?.icon} {v > 0 ? '+' : ''}{v}</span>
      ))}
      {fame ? <span className="up">⭐ +{fame}</span> : null}
    </div>
  );
}

function OutfitShop({ me }) {
  const run = useStore((s) => s.run);
  return (
    <>
      <div className="section-t">{L('Duka la nguo', 'Clothes shop')}</div>
      {OUTFITS.filter((o) => o.price > 0).map((o) => {
        const owned = me.outfits.includes(o.id);
        const wearing = me.appearance?.outfit === o.id;
        return (
          <div key={o.id} className="item">
            <span className="em" style={{ background: o.top }}>👕</span>
            <div className="grow">
              <div className="t">{loc(o)}</div>
              <div className="s">{owned ? L('Unayo tayari', 'You own this') : fmtTsh(o.price)}</div>
            </div>
            {owned ? (
              <button className="btn btn-ghost btn-sm" disabled={wearing} onClick={() => run('/me/profile', { method: 'POST', body: { appearance: { ...me.appearance, outfit: o.id } } }).then((r) => r && useStore.setState({ me: r }))}>
                {wearing ? L('Umevaa', 'Wearing') : L('Vaa', 'Wear')}
              </button>
            ) : (
              <button className="btn btn-green btn-sm" disabled={me.money < o.price} onClick={() => run('/shop/outfit', { method: 'POST', body: { outfitId: o.id } })}>{L('Nunua', 'Buy')}</button>
            )}
          </div>
        );
      })}
    </>
  );
}

function VehicleShop({ me }) {
  const run = useStore((s) => s.run);
  const [color, setColor] = useState({});
  return (
    <>
      <div className="section-t">{L('Magari yanayouzwa', 'Vehicles for sale')}</div>
      {VEHICLES.map((v) => {
        const c = color[v.id] || v.color;
        return (
          <div key={v.id} className="item" style={{ flexWrap: 'wrap' }}>
            <span className="em">{v.emoji}</span>
            <div className="grow">
              <div className="t">{loc(v)}</div>
              <div className="s">{fmtTsh(v.price)} · {L('Spidi', 'Speed')} ×{v.speed}</div>
            </div>
            <button className="btn btn-green btn-sm" disabled={me.money < v.price} onClick={() => run('/shop/vehicle', { method: 'POST', body: { model: v.id, color: c } }).then((r) => r && useStore.getState().toast(L(`🎉 Hongera! ${v.name} ni yako. Bonyeza kitufe cha gari kuendesha.`, `🎉 Congrats! The ${loc(v)} is yours. Tap the vehicle button to drive.`)))}>
              {L('Nunua', 'Buy')}
            </button>
            <div className="swatches" style={{ width: '100%', gap: 6, marginTop: 8, paddingLeft: 52 }}>
              {VEHICLE_COLORS.map((col) => (
                <button key={col} className={`swatch ${c === col ? 'on' : ''}`} style={{ background: col, width: 26, height: 26, borderWidth: 2 }} onClick={() => setColor({ ...color, [v.id]: col })} aria-label={col} />
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}

function PlaceSheet({ id, onClose }) {
  const p = placeById[id];
  const me = useStore((s) => s.me);
  const world = useStore((s) => s.world);
  const run = useStore((s) => s.run);
  const openPhone = useStore((s) => s.openPhone);
  const owner = world.businesses?.[id];
  const busy = !!me.busy;
  const start = async (kind, actId) => {
    const r = await run('/act/start', { method: 'POST', body: { kind, placeId: id, id: actId } });
    if (r) onClose();
  };
  return (
    <Sheet title={loc(p)} icon={p.icon} sub={`${p.district} · ${loc(p, 'blurb')}`} onClose={onClose}>
      {p.comingSoon && <div className="box center" style={{ background: '#fef9c3' }}>🚧 {L('Inakuja hivi karibuni! Safari za ndege zitafunguliwa update ijayo.', 'Coming soon! Flights open in the next update.')}</div>}
      {p.business && (
        <div className="row between" style={{ marginTop: 6 }}>
          {owner ? (
            <span className="owner">👑 {L('Mmiliki', 'Owner')}: @{owner.owner}</span>
          ) : (
            <>
              <span className="small muted">{L('Biashara inauzwa · mapato', 'Business for sale · earns')} {fmtTsh(p.business.incomePerHour)}/{L('saa', 'hr')}</span>
              <button className="btn btn-dark btn-sm" disabled={me.money < p.business.price} onClick={() => run(`/business/${id}/buy`, { method: 'POST' })}>
                {L('Nunua', 'Buy')} {fmtShort(p.business.price)}
              </button>
            </>
          )}
        </div>
      )}
      {p.activities?.length > 0 && <div className="section-t">{L('Shughuli', 'Activities')}</div>}
      {p.activities?.map((a) => (
        <div key={a.id} className="item">
          <span className="em">{a.emoji}</span>
          <div className="grow">
            <div className="t">{loc(a)}</div>
            <div className="s">{a.cost ? fmtTsh(a.cost) : L('Bure', 'Free')} · {a.secs}s</div>
            <Effects effects={a.effects} fame={a.fame} />
          </div>
          <button className="btn btn-green btn-sm" disabled={busy || me.money < a.cost} onClick={() => start('activity', a.id)}>{L('Fanya', 'Do')}</button>
        </div>
      ))}
      {p.jobs?.length > 0 && <div className="section-t">{L('Kazi hapa', 'Jobs here')}</div>}
      {p.jobs?.map((j) => {
        const shifts = me.jobXp?.[j.id] || 0;
        const pay = shiftPay(j, { shifts, mood: me.mood, trait: me.trait, fame: me.fame });
        const needsElimu = j.requires?.elimu && me.elimu < j.requires.elimu;
        const needsVehicle = j.requires?.vehicle && !me.vehicles.some((v) => j.requires.vehicle.includes(v.model));
        return (
          <div key={j.id} className="item">
            <span className="em">💼</span>
            <div className="grow">
              <div className="t">{jt(j, shifts)}</div>
              <div className="s">~{fmtTsh(pay)} / {L('shifti', 'shift')} · {j.secs}s · ⚡ -{j.energy} · Level {jobLevel(shifts) + 1} ({shifts} {L('shifti', 'shifts')})</div>
              {needsElimu && <div className="s red">🎓 {L('Inahitaji Elimu level', 'Needs Education level')} {j.requires.elimu}</div>}
              {needsVehicle && <div className="s red">🔑 {L('Inahitaji', 'Needs')} {j.requires.vehicle.map((m) => loc(vehicleById[m])).join(' / ')}</div>}
            </div>
            <button className="btn btn-dark btn-sm" disabled={busy || needsElimu || needsVehicle} onClick={() => start('job', j.id)}>{L('Anza', 'Start')}</button>
          </div>
        );
      })}
      {p.shop === 'outfits' && <OutfitShop me={me} />}
      {p.shop === 'vehicles' && <VehicleShop me={me} />}
      {p.shop === 'topup' && (
        <button className="btn btn-green btn-block" style={{ marginTop: 14 }} onClick={() => openPhone('pesa', 'topup')}>💳 {L('Ongeza salio la wallet', 'Top up your wallet')}</button>
      )}
    </Sheet>
  );
}

function PlotSheet({ id, onClose }) {
  const plot = plotById[id];
  const me = useStore((s) => s.me);
  const world = useStore((s) => s.world);
  const run = useStore((s) => s.run);
  const st = world.plots?.[id];
  const mine = st && st.owner === me.username;
  const current = st?.building && buildingById[st.building];
  return (
    <Sheet title={loc(plot)} icon="🏞️" sub={`${plot.area} · ${plot.size}×${plot.size}m`} onClose={onClose}>
      {!st && (
        <div className="box" style={{ background: 'var(--chip)' }}>
          <div className="row between">
            <div>
              <div className="bold">{L('Kiwanja kinauzwa', 'Plot for sale')}</div>
              <div className="small muted">{L('Hati safi, umeme na maji yapo karibu 😄', 'Clean title, power and water nearby 😄')}</div>
            </div>
            <div className="bold green">{fmtTsh(plot.price)}</div>
          </div>
          <button className="btn btn-green btn-block" style={{ marginTop: 12 }} disabled={me.money < plot.price} onClick={() => run(`/plots/${id}/buy`, { method: 'POST' })}>
            {me.money < plot.price ? L(`Unahitaji ${fmtTsh(plot.price - me.money)} zaidi`, `You need ${fmtTsh(plot.price - me.money)} more`) : L('Nunua kiwanja', 'Buy plot')}
          </button>
        </div>
      )}
      {st && !mine && (
        <div className="box">
          <span className="owner">🏠 {L('Mmiliki', 'Owner')}: @{st.owner}</span>
          <div className="small muted" style={{ marginTop: 8 }}>{current ? loc(current) : L('Bado hakijajengwa.', 'Not built yet.')}</div>
        </div>
      )}
      {mine && (
        <>
          <span className="owner">✅ {L('Hiki ni kiwanja chako', 'This is your plot')}{current ? ` · ${loc(current)}` : ''}</span>
          {current && (
            <>
              <div className="section-t">{L('Nyumbani', 'At home')}</div>
              <div className="row">
                <button className="btn btn-ghost grow" disabled={!!me.busy} onClick={() => run(`/home/${id}/lala`, { method: 'POST' }).then((r) => r && useStore.getState().toast(L('😴 Umelala vizuri nyumbani kwako!', '😴 You slept well at home!')))}>😴 {L('Lala', 'Sleep')}</button>
                <button className="btn btn-ghost grow" disabled={!!me.busy} onClick={() => run(`/home/${id}/oga`, { method: 'POST' }).then((r) => r && useStore.getState().toast(L('🚿 Uko fresh!', "🚿 You're fresh!")))}>🚿 {L('Oga', 'Shower')}</button>
              </div>
            </>
          )}
          <div className="section-t">{current ? L('Pandisha hadhi', 'Upgrade') : L('Jenga', 'Build')}</div>
          {BUILDINGS.filter((b) => ALLOWED_BUILDINGS[plot.area]?.includes(b.id)).map((b) => {
            const cost = b.price - (current ? Math.round(current.price * 0.5) : 0);
            const disabled = (current && current.price >= b.price) || me.money < cost;
            return (
              <div key={b.id} className="item">
                <span className="em">{b.pool ? '🏖️' : b.floors > 2 ? '🏢' : '🏠'}</span>
                <div className="grow">
                  <div className="t">{loc(b)}</div>
                  <div className="s">{fmtTsh(cost)}{b.incomePerHour ? ` · ${L('kodi', 'rent')} ${fmtTsh(b.incomePerHour)}/${L('saa', 'hr')}` : ''} · ⚡ +{b.energyBonus} {L('ukilala', 'when sleeping')}</div>
                </div>
                <button className="btn btn-green btn-sm" disabled={disabled} onClick={() => run(`/plots/${id}/build`, { method: 'POST', body: { building: b.id } })}>
                  {current?.id === b.id ? L('Umejenga', 'Built') : L('Jenga', 'Build')}
                </button>
              </div>
            );
          })}
        </>
      )}
    </Sheet>
  );
}

function PlayerSheet({ username, onClose }) {
  const [p, setP] = useState(null);
  const openPhone = useStore((s) => s.openPhone);
  useEffect(() => {
    api(`/players/${encodeURIComponent(username)}`).then(setP).catch((e) => useStore.getState().toast(e.message, 'err'));
  }, [username]);
  if (!p) return null;
  const trait = TRAITS.find((t) => t.id === p.trait);
  return (
    <Sheet title={p.name} icon={avatarEmoji(p.appearance)} sub={`@${p.username} · ${p.online ? '🟢 online' : 'offline'}`} onClose={onClose}>
      <div style={{ height: 200, background: 'linear-gradient(180deg,#dbe9f7,#fff)', borderRadius: 18 }}>
        <AvatarPreview appearance={p.appearance} />
      </div>
      <div className="row" style={{ gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <span className="pill">💰 {fmtShort(p.netWorth)}</span>
        <span className="pill">⭐ {p.fame}</span>
        <span className="pill">🎓 {L('Elimu', 'Education')} {p.elimu}</span>
        {trait && <span className="pill">{trait.emoji} {loc(trait)}</span>}
        <span className="pill">🏠 {p.plots.length} {L('viwanja', 'plots')}</span>
        {p.vehicles.length > 0 && <span className="pill">{p.vehicles.map((v) => vehicleById[v.model]?.emoji).join(' ')}</span>}
      </div>
      <div className="row" style={{ marginTop: 16 }}>
        <button className="btn btn-green grow" onClick={() => openPhone('dm', p.username)}>💬 {L('Tuma ujumbe', 'Message')}</button>
        <button className="btn btn-ghost grow" onClick={() => openPhone('pesa', { send: p.username })}>💸 {L('Tuma pesa', 'Send money')}</button>
      </div>
    </Sheet>
  );
}

function AdSheet({ id, onClose }) {
  const slot = billboardById[id];
  const ads = useStore((s) => s.ads);
  const run = useStore((s) => s.run);
  const openPhone = useStore((s) => s.openPhone);
  const ad = ads.find((a) => a.slot_id === id);
  return (
    <Sheet title={loc(slot)} icon="📢" sub={`${L('Bango', 'Billboard')} · ${fmtTsh(slot.pricePerDay)}/${L('siku', 'day')}`} onClose={onClose}>
      {ad ? (
        <>
          <div className="adprev" style={{ background: ad.image ? `url(/uploads/${ad.image}) center/cover` : ad.bg }}>
            <b>{ad.title}</b>
            {ad.body && <span>{ad.body}</span>}
          </div>
          <div className="small muted" style={{ marginTop: 8 }}>{L('Tangazo la', 'Ad by')} @{ad.username} · {L('linaisha', 'ends')} {new Date(ad.ends_at).toLocaleDateString()}</div>
          <div className="row" style={{ marginTop: 12 }}>
            {ad.link && <a className="btn btn-green grow" href={ad.link} target="_blank" rel="noopener noreferrer nofollow">{L('Fungua link', 'Open link')} ↗</a>}
            <button className="btn btn-ghost" onClick={() => run(`/ads/${ad.id}/report`, { method: 'POST' }).then((r) => r && useStore.getState().toast(L('Asante, tumepokea ripoti yako.', 'Thanks, we got your report.')))}>🚩 {L('Ripoti', 'Report')}</button>
          </div>
        </>
      ) : (
        <div className="box center" style={{ background: 'var(--chip)' }}>{L('Bango hili liko wazi. Tangaza biashara yako kwa Wabongo wote!', 'This billboard is free. Advertise your business to every player!')}</div>
      )}
      <button className="btn btn-dark btn-block" style={{ marginTop: 12 }} onClick={() => openPhone('matangazo', id)}>📢 {L('Weka tangazo hapa', 'Advertise here')}</button>
    </Sheet>
  );
}

export function Sheets() {
  const sheet = useStore((s) => s.sheet);
  const set = useStore((s) => s.set);
  const close = () => set({ sheet: null });
  if (!sheet) return null;
  if (sheet.type === 'place') return <PlaceSheet id={sheet.id} onClose={close} />;
  if (sheet.type === 'plot') return <PlotSheet id={sheet.id} onClose={close} />;
  if (sheet.type === 'player') return <PlayerSheet username={sheet.id} onClose={close} />;
  if (sheet.type === 'ad') return <AdSheet id={sheet.id} onClose={close} />;
  return null;
}
