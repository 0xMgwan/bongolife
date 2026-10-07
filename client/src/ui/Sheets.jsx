import { useEffect, useRef, useState } from 'react';
import {
  ENTERABLE, NEEDS, HANGOUT_PLACES, OUTFITS, AD_ROTATE_SECONDS, VEHICLES, VEHICLE_COLORS, BUILDINGS, ALLOWED_BUILDINGS, placeById, plotById, billboardById, buildingById,
  outfitFits, shiftPay, jobTitle, jobTitleEn, jobLevel, fmtTsh, fmtShort, vehicleById, TRAITS,
} from '@shared/world.js';
import { useStore } from '../store.js';
import { api } from '../api.js';
import { avatarEmoji } from '../three/Avatar.jsx';
import { AvatarPreview } from './Creator.jsx';
import { sfx } from '../audio.js';
import { setInside } from '../net.js';
import { inviteHome, goToPlayer } from './social.js';
import { sendHangout } from '../net.js';
import { livePartyAt, joinParty } from './events.js';
import { TravelCard } from './Travel.jsx';
import { share } from './share.js';
import { vehicleThumb, cachedThumb } from '../three/thumbs.jsx';
import { L, loc, isEn } from '../i18n.js';
import { useSlideSelect } from './useSlideSelect.js';

const jt = (j, n) => (isEn() ? jobTitleEn(j, n) : jobTitle(j, n));

export function Sheet({ title, icon, sub, onClose, children }) {
  const body = useRef(null);
  useSlideSelect(body);
  return (
    <div className="sheet-wrap" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <div className="grab" />
          <h2>{icon && <span>{icon}</span>}{title}</h2>
          {sub && <div className="small muted" style={{ marginTop: 4 }}>{sub}</div>}
          <button className="x" onClick={onClose} aria-label={L('Funga', 'Close')}>✕</button>
        </div>
        <div className="sheet-body" ref={body}>{children}</div>
      </div>
    </div>
  );
}

export function Effects({ effects, fame, health }) {
  const map = Object.fromEntries(NEEDS.map((n) => [n.id, n]));
  return (
    <div className="fx">
      {Object.entries(effects || {}).map(([k, v]) => (
        <span key={k} className={v > 0 ? 'up' : 'dn'}>{map[k]?.icon} {v > 0 ? '+' : ''}{v}</span>
      ))}
      {health ? <span className="up">❤️ +{health}</span> : null}
      {fame ? <span className="up">⭐ +{fame}</span> : null}
    </div>
  );
}

function OutfitShop({ me }) {
  const run = useStore((s) => s.run);
  return (
    <>
      <div className="section-t">{L('Duka la nguo', 'Clothes shop')}</div>
      {OUTFITS.filter((o) => o.price > 0).sort((x, y) => outfitFits(y, me.appearance?.body) - outfitFits(x, me.appearance?.body)).map((o) => {
        const owned = me.outfits.includes(o.id);
        const wearing = me.appearance?.outfit === o.id;
        return (
          <div key={o.id} className="item">
            <span className="em" style={{ background: `linear-gradient(135deg, ${o.top} 50%, ${o.bottom} 50%)` }}>{o.bottomType === 'robe' || o.bottomType === 'maxi' || o.bottomType === 'dress' ? '👗' : '👕'}</span>
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

const TIERS = [
  [0, '🛵 Kuanzia', '🛵 Getting around'],
  [1, '🚗 Gari la kwanza', '🚗 First car'],
  [2, '👨‍👩‍👧 Familia & kazi', '👨‍👩‍👧 Family & work'],
  [3, '💼 Mabosi', '💼 Executive'],
  [4, '👑 Kifahari', '👑 Luxury'],
  [5, '🔥 Watu wazito', '🔥 Big boss'],
  [6, '🏎️ Supercars', '🏎️ Supercars'],
];
function CarPic({ v, color }) {
  const [url, setUrl] = useState(() => cachedThumb(`v:${v.id}:${color}`));
  useEffect(() => {
    let live = true;
    setUrl(cachedThumb(`v:${v.id}:${color}`));
    vehicleThumb(v, color).then((u) => live && setUrl(u)).catch(() => {});
    return () => { live = false; };
  }, [v, color]);
  return url ? <img src={url} alt="" className="car-pic" /> : <span className="car-pic em">{v.emoji}</span>;
}

/** Car yard showroom: every vehicle with a 3D preview in the colour you pick, by tier. */
function VehicleShop({ me }) {
  const run = useStore((s) => s.run);
  const [color, setColor] = useState({});
  const owned = new Set(me.vehicles.map((v) => v.model));
  return (
    <>
      {TIERS.map(([tier, sw, en]) => {
        const list = VEHICLES.filter((v) => (v.tier || 0) === tier);
        if (!list.length) return null;
        return (
          <div key={tier}>
            <div className="section-t">{L(sw, en)}</div>
            {list.map((v) => {
              const c = color[v.id] || v.color;
              return (
                <div key={v.id} className="car-card">
                  <CarPic v={v} color={c} />
                  <div className="row between" style={{ alignItems: 'flex-start' }}>
                    <div>
                      <div className="t">{loc(v)} {owned.has(v.id) && <span className="tag friend">{L('Unalo', 'Owned')}</span>}</div>
                      <div className="s">{fmtTsh(v.price)} · {L('Spidi', 'Speed')} ×{v.speed}{v.lux ? ' · ✨' : ''}</div>
                    </div>
                    <button className="btn btn-green btn-sm" disabled={me.money < v.price} onClick={() => run('/shop/vehicle', { method: 'POST', body: { model: v.id, color: c } }).then((r) => r && useStore.getState().toast(L(`🎉 Hongera! ${v.name} ni yako — liko nje, gusa kuliendesha.`, `🎉 Congrats! The ${loc(v)} is yours — it's parked outside, tap it to drive.`)))}>
                      {L('Nunua', 'Buy')}
                    </button>
                  </div>
                  <div className="swatches" style={{ gap: 6, marginTop: 8 }}>
                    {VEHICLE_COLORS.map((col) => (
                      <button key={col} className={`swatch ${c === col ? 'on' : ''}`} style={{ background: col, width: 24, height: 24, borderWidth: 2 }} onClick={() => setColor({ ...color, [v.id]: col })} aria-label={col} />
                    ))}
                  </div>
                </div>
              );
            })}
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
  const party = livePartyAt(useStore((s) => s.events), id);
  const start = async (kind, actId) => {
    const r = await run('/act/start', { method: 'POST', body: { kind, placeId: id, id: actId } });
    if (r) {
      if (/^ogelea/.test(actId)) sfx('splash');
      onClose();
    }
  };
  return (
    <Sheet title={loc(p)} icon={p.icon} sub={`${p.district} · ${loc(p, 'blurb')}`} onClose={onClose}>
      <button className="link-share" onClick={() => share({ title: loc(p), text: L(`Tukutane ${p.name} kwenye Bongo Life! 🇹🇿`, `Meet me at ${loc(p)} in Bongo Life! 🇹🇿`), params: { place: id } })}>🔗 {L(`Shiriki link ya ${p.name}`, `Share a link to ${loc(p)}`)}</button>
      {party && useStore.getState().inside !== p.id && (
        <button className="btn btn-block party-btn" onClick={() => { onClose(); joinParty(party); }}>
          🎉 {L(`Ingia kwenye pati: ${party.title}`, `Join the party: ${party.title}`)} · 🙋 {party.going}
        </button>
      )}
      {(ENTERABLE[p.id] || party) && (
        useStore.getState().inside === p.id ? (
          <button className="btn btn-ghost btn-block" style={{ marginTop: 6 }} onClick={() => { setInside(null); onClose(); }}>🚪 {L('Toka nje', 'Leave')}</button>
        ) : (
          !party && <button className="btn btn-dark btn-block" style={{ marginTop: 6 }} onClick={() => { setInside(p.id); sfx('open'); onClose(); }}>🚪 {L('Ingia ndani', 'Go inside')} · {L('ona nani yupo', "see who's here")}</button>
        )
      )}
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
            <Effects effects={a.effects} fame={a.fame} health={a.special?.health} />
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
              {needsVehicle && <div className="s red">🔑 {L('Inahitaji', 'Needs')} {(j.requires.vehicle.length > 3 ? L('gari lolote', 'any car') : j.requires.vehicle.map((m) => loc(vehicleById[m])).join(' / '))}</div>}
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

/** Invite someone you met to hang out somewhere: club, beach, nyama choma… */
function GoOut({ username }) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(null);
  const send = async (placeId) => {
    const r = await sendHangout(username, placeId);
    if (r.ok) {
      setSent(placeId);
      sfx('pop');
      useStore.getState().toast(L(`📨 Umemwalika @${username} ${placeById[placeId].name}`, `📨 Invited @${username} to ${loc(placeById[placeId])}`));
    } else useStore.getState().toast(r.error === 'offline' ? L('Hayuko online.', "They're offline.") : r.error === 'slow' ? L('Subiri kidogo kabla ya kualika tena.', 'Wait a moment before inviting again.') : L('Imeshindikana.', "Couldn't send."), 'err');
  };
  if (!open) return <button className="btn btn-block go-out-btn" onClick={() => setOpen(true)}>🎉 {L('Mwalike mtoke pamoja', "Invite them out")}</button>;
  return (
    <div className="go-out">
      <div className="small bold" style={{ marginBottom: 8 }}>🎉 {L(`Mkatoke wapi na @${username}?`, `Where should you go with @${username}?`)}</div>
      <div className="go-grid">
        {HANGOUT_PLACES.map((id) => (
          <button key={id} className={sent === id ? 'on' : ''} onClick={() => send(id)}>
            <span>{placeById[id].icon}</span>
            <small>{loc(placeById[id]).replace(/ (Sinza|Mbagala|Kunduchi|Kwa Mrombo)$/, '')}</small>
          </button>
        ))}
      </div>
    </div>
  );
}

function PlayerSheet({ username, onClose }) {
  const [p, setP] = useState(null);
  const run = useStore((s) => s.run);
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
      <div className="row" style={{ marginTop: 8 }}>
        <button className="btn btn-white grow" style={{ border: '1px solid var(--line)' }} onClick={() => run('/contacts', { method: 'POST', body: { username: p.username } }).then((r) => r && useStore.getState().toast(r.find((c) => c.username === p.username)?.mutual ? L(`🤝 Sasa wewe na @${p.username} ni marafiki!`, `🤝 You and @${p.username} are now friends!`) : L(`📨 Ombi la urafiki limetumwa kwa @${p.username}`, `📨 Friend request sent to @${p.username}`)))}>➕ {L('Ongeza rafiki', 'Add friend')}</button>
      </div>
      {p.online && (
        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn btn-dark grow" onClick={() => inviteHome(p.username)}>🏠 {L('Mwalike kwako', 'Invite home')}</button>
          <button className="btn btn-ghost grow" onClick={() => goToPlayer(p.username)}>📍 {L('Nenda kwake', 'Go to them')}</button>
        </div>
      )}
      {p.online && <GoOut username={p.username} />}
      <button className="link-share" style={{ marginTop: 10 }} onClick={() => share({ title: `@${p.username}`, text: L(`Mcheki @${p.username} kwenye Bongo Life 🇹🇿`, `Check out @${p.username} on Bongo Life 🇹🇿`), params: { u: p.username } })}>🔗 {L('Shiriki profaili hii', 'Share this profile')}</button>
    </Sheet>
  );
}

function AdSheet({ id, onClose }) {
  const slot = billboardById[id];
  const ads = useStore((s) => s.ads).filter((a) => a.slot_id === id);
  const run = useStore((s) => s.run);
  const openPhone = useStore((s) => s.openPhone);
  const host = (url) => {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
  };
  return (
    <Sheet title={loc(slot)} icon="📢" sub={L('Skrini ya kidijitali · mjini', 'Digital screen · in town')} onClose={onClose}>
      <div className="row" style={{ gap: 8, marginBottom: 10 }}>
        <span className="onair">● ON AIR</span>
        <span className="small muted">
          {ads.length
            ? L(`Matangazo ${ads.length} yanapokezana, sekunde ${AD_ROTATE_SECONDS} kila moja`, `${ads.length} ad${ads.length > 1 ? 's take' : ' takes'} turns, ${AD_ROTATE_SECONDS}s each`)
            : L('Hakuna tangazo bado — kuwa wa kwanza!', 'No ads yet — be the first!')}
        </span>
      </div>
      {ads.length > 0 && (
        <div className="ad-carousel">
          {ads.map((ad) => (
            <div key={ad.id} className="ad-slide">
              <div className="adprev" style={{ background: ad.image ? `url(/uploads/${ad.image}) center/cover` : ad.bg }}>
                <b>{ad.title}</b>
                {ad.body && <span>{ad.body}</span>}
              </div>
              <div className="row between" style={{ marginTop: 8 }}>
                {ad.link ? (
                  <a className="btn btn-green btn-sm" href={ad.link} target="_blank" rel="noopener noreferrer nofollow">↗ {L('Tembelea', 'Visit')} {host(ad.link)}</a>
                ) : <span className="small muted">@{ad.username}</span>}
                <span className="small muted">{L('hadi', 'until')} {new Date(ad.ends_at).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
              </div>
              <button className="btn btn-ghost btn-xs" style={{ marginTop: 6 }} onClick={() => run(`/ads/${ad.id}/report`, { method: 'POST' }).then((r) => r && useStore.getState().toast(L('Asante, tumepokea ripoti yako.', 'Thanks, we got your report.')))}>🚩 {L('Ripoti', 'Report')}</button>
            </div>
          ))}
        </div>
      )}
      <button className="btn btn-white btn-block" style={{ marginTop: 12, border: '1px solid var(--line)' }} onClick={() => openPhone('matangazo', id)}>＋ {L('Weka tangazo lako hapa', 'Add your ad to this board')}</button>
      <div className="hint center" style={{ marginTop: 8 }}>
        {L(
          `Skrini ya kidijitali: tangazo lako linaanza ukilipia na linapokezana na mengine hapa · ${fmtTsh(slot.pricePerDay * 7)} kwa siku 7`,
          `A digital board: yours goes live as soon as you pay and takes turns with the ads here · ${fmtTsh(slot.pricePerDay * 7)} for 7 days`,
        )}
      </div>
    </Sheet>
  );
}

export function Sheets() {
  const sheet = useStore((s) => s.sheet);
  const set = useStore((s) => s.set);
  const close = () => set({ sheet: null });
  if (!sheet) return null;
  if (sheet.type === 'place') return <PlaceSheet id={sheet.id} onClose={close} />;
  if (sheet.type === 'travel') return <TravelCard id={sheet.id} onClose={close} />;
  if (sheet.type === 'plot') return <PlotSheet id={sheet.id} onClose={close} />;
  if (sheet.type === 'player') return <PlayerSheet username={sheet.id} onClose={close} />;
  if (sheet.type === 'ad') return <AdSheet id={sheet.id} onClose={close} />;
  return null;
}
