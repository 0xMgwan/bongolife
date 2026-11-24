// Matamasha: the concert line-up across the country — buy a ticket, get to the venue, party.
import { useEffect, useState } from 'react';
import { fmtTsh, fmtShort, placeById, cityAt } from '@shared/world.js';
import { useStore } from '../../store.js';
import { api } from '../../api.js';
import { AppHead } from '../Phone.jsx';
import { goToPlace } from '../../nav.js';
import { avatarEmoji } from '../../three/Avatar.jsx';
import { local } from '../../net.js';
import { L, loc } from '../../i18n.js';
import { sfx } from '../../audio.js';

const when = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const mins = (ms) => {
  const m = Math.max(0, Math.ceil(ms / 60_000));
  return m >= 60 ? L(`saa ${Math.floor(m / 60)} dk ${m % 60}`, `${Math.floor(m / 60)}h ${m % 60}m`) : L(`dk ${m}`, `${m} min`);
};

function Show({ s, tiers, me, buy, attend, close }) {
  const place = placeById[s.placeId];
  const city = cityAt(...place.pos);
  const [tier, setTier] = useState(s.ticket?.tier || 'regular');
  const myTier = tiers.find((t) => t.id === s.ticket?.tier);
  const near = Math.hypot(local.x - place.pos[0], local.z - place.pos[1]) < Math.max(...place.size) / 2 + 14;
  return (
    <div className={`gig ${s.live ? 'live' : ''}`} style={{ '--gig': s.artist.color }}>
      <div className="gig-top">
        <span className="gig-em">{s.artist.emoji}</span>
        <div className="grow">
          <b>{s.artist.name}</b>
          <small>{s.artist.genre} · {place.icon} {loc(place)} · {city?.name}</small>
        </div>
        {s.live ? <span className="gig-live">● LIVE</span> : <span className="gig-time">{when(s.startsAt)}</span>}
      </div>
      <small className="gig-meta">
        {s.live ? L(`Linaendelea — linaisha baada ya ${mins(s.endsAt - Date.now())}`, `On now — ends in ${mins(s.endsAt - Date.now())}`) : L(`Linaanza baada ya ${mins(s.startsAt - Date.now())}`, `Starts in ${mins(s.startsAt - Date.now())}`)}
        {' · '}🎟️ {L(`tiketi ${s.sold}`, `${s.sold} sold`)}
      </small>
      {s.going.length > 0 && <div className="gig-going">{s.going.map((g) => <span key={g.username} title={`@${g.username}`}>{avatarEmoji(g.appearance)}</span>)}</div>}
      {s.ticket ? (
        <>
          <div className="gig-ticket">{myTier?.emoji} {L(`Una tiketi ya ${myTier?.name[0]}`, `You have a ${myTier?.name[1]} ticket`)}{s.ticket.attended ? L(' · umehudhuria ✓', ' · attended ✓') : ''}</div>
          {!s.ticket.attended && (
            s.live && near
              ? <button className="btn btn-green btn-block btn-sm" onClick={() => attend(s)}>🎶 {L('Ingia tamashani', 'Go in to the show')}</button>
              : <button className="btn btn-dark btn-block btn-sm" onClick={() => { close?.(); goToPlace(s.placeId); }}>📍 {L(`Nenda ${place.name}`, `Head to ${loc(place)}`)}</button>
          )}
          {!s.ticket.attended && s.ticket.tier !== 'vvip' && <button className="btn btn-ghost btn-block btn-xs" style={{ marginTop: 4 }} onClick={() => buy(s, s.ticket.tier === 'regular' ? 'vip' : 'vvip')}>⬆️ {L('Pandisha daraja', 'Upgrade')}</button>}
        </>
      ) : (
        <>
          <div className="gig-tiers">
            {tiers.map((t) => (
              <button key={t.id} className={tier === t.id ? 'on' : ''} onClick={() => setTier(t.id)}>
                <span>{t.emoji} {L(t.name[0], t.name[1])}</span>
                <b>{fmtShort(s.prices[t.id])}</b>
              </button>
            ))}
          </div>
          <button className="btn btn-green btn-block btn-sm" disabled={me.money < s.prices[tier]} onClick={() => buy(s, tier)}>🎟️ {L('Nunua tiketi', 'Buy ticket')} · {fmtTsh(s.prices[tier])}</button>
        </>
      )}
    </div>
  );
}

export function Matamasha({ back, close }) {
  const run = useStore((s) => s.run);
  const me = useStore((s) => s.me);
  const [d, setD] = useState(null);
  const load = () => api('/concerts').then(setD).catch(() => {});
  useEffect(() => { load(); const t = setInterval(load, 30_000); return () => clearInterval(t); }, []);
  const buy = async (s, tier) => {
    const r = await run(`/concerts/${s.slot}/ticket`, { method: 'POST', body: { tier } });
    if (r) { setD(r); sfx('cash'); useStore.getState().toast(L(`🎟️ Tiketi ya ${s.artist.name} — tukutane huko!`, `🎟️ Ticket for ${s.artist.name} — see you there!`)); }
  };
  const attend = async (s) => {
    const r = await run(`/concerts/${s.slot}/attend`, { method: 'POST' });
    if (r) { sfx('levelup'); close?.(); }
  };
  return (
    <>
      <AppHead title={L('Matamasha 🎤', 'Concerts 🎤')} onBack={back} />
      <div className="app-body">
        <div className="box small" style={{ background: '#faf5ff' }}>🎶 {L('Kila saa mbili kuna tamasha mahali fulani nchini. Nunua tiketi, fika ukumbini likiwa LIVE, na mle bata na wengine. VIP na VVIP zinakupa umaarufu — VVIP unakutana na msanii backstage.', 'Every two hours there’s a show somewhere in the country. Buy a ticket, be at the venue while it’s LIVE, and party with everyone else there. VIP and VVIP earn you fame — VVIP meets the artist backstage.')}</div>
        {!d && <div className="small muted" style={{ padding: 12 }}>{L('Inapakia…', 'Loading…')}</div>}
        {d?.shows.map((s) => <Show key={s.slot} s={s} tiers={d.tiers} me={me} buy={buy} attend={attend} close={close} />)}
      </div>
    </>
  );
}
