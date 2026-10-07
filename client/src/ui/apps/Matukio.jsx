import { useEffect, useState } from 'react';
import { EVENT_LIMITS, EVENT_PLACES, placeById } from '@shared/world.js';
import { useStore } from '../../store.js';
import { api } from '../../api.js';
import { AppHead } from '../Phone.jsx';
import { L, loc } from '../../i18n.js';
import { visitHome } from '../social.js';
import { goToPlace } from '../../nav.js';
import { avatarEmoji } from '../../three/Avatar.jsx';
import { share } from '../share.js';
import { joinParty, loadEvents } from '../events.js';

const COVERS = [['#7c3aed', '#db2777'], ['#f59e0b', '#ef4444'], ['#0ea5e9', '#6366f1'], ['#10b981', '#0d9488'], ['#ec4899', '#f97316']];

const placeLabel = (id) => (id === 'home' ? L('🏠 Nyumbani kwa mwenyeji', "🏠 Host's home") : `${placeById[id]?.icon || '📍'} ${loc(placeById[id])}`);

function when(ts) {
  const d = new Date(ts);
  const now = new Date();
  const diff = ts - Date.now();
  const hm = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diff <= 0) return L('Inaendelea sasa', 'Happening now');
  if (diff < 3600_000) return L(`Baada ya dakika ${Math.ceil(diff / 60000)}`, `In ${Math.ceil(diff / 60000)} min`);
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
  if (d.toDateString() === now.toDateString()) return L(`Leo ${hm}`, `Today ${hm}`);
  if (d.toDateString() === tomorrow.toDateString()) return L(`Kesho ${hm}`, `Tomorrow ${hm}`);
  return `${d.toLocaleDateString([], { weekday: 'short', day: 'numeric' })} ${hm}`;
}

// Datetime-local value in the device's timezone.
const localInput = (ts) => {
  const d = new Date(ts - new Date().getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
};

/** Events: parties, match-watching, beach hangs — create, RSVP, go. */
export function Matukio({ back }) {
  const me = useStore((s) => s.me);
  const run = useStore((s) => s.run);
  const version = useStore((s) => s.eventsVersion);
  const [list, setList] = useState(null);
  const [form, setForm] = useState(null);
  useEffect(() => {
    api('/events').then(setList).catch(() => setList([]));
  }, [version]);
  const rsvp = async (e) => {
    const r = await run(`/events/${e.id}/rsvp`, { method: 'POST' });
    if (r) { setList(r); loadEvents(); }
  };
  const cancel = async (e) => {
    if (!confirm(L('Ghairi tukio hili?', 'Cancel this event?'))) return;
    const r = await run(`/events/${e.id}`, { method: 'DELETE' });
    if (r) setList(r);
  };
  const go = (e) => {
    if (e.place_id === 'home') return visitHome(e.host);
    useStore.setState({ phone: null, tab: 'town', cityView: 'follow' });
    goToPlace(e.place_id);
  };
  const create = async (ev) => {
    ev.preventDefault();
    const r = await run('/events', { method: 'POST', body: { ...form, startsAt: new Date(form.at).getTime() } });
    if (r) {
      setList(r);
      setForm(null);
      useStore.getState().toast(L('🎉 Tukio limetangazwa!', '🎉 Event announced!'));
    }
  };
  const soon = (e) => e.starts_at - Date.now() < EVENT_LIMITS.windowBeforeMs;

  return (
    <>
      <AppHead title={L('Matukio', 'Events')} onBack={back} right={!form && <button className="btn btn-green btn-xs" onClick={() => setForm({ title: '', description: '', placeId: 'home', at: localInput(Date.now() + 30 * 60000) })}>＋ {L('Andaa', 'Host')}</button>} />
      <div className="app-body">
        {form && (
          <form className="ev-form" onSubmit={create}>
            <b>{L('Andaa tukio 🎉', 'Host an event 🎉')}</b>
            <input className="field" maxLength={EVENT_LIMITS.titleMax} placeholder={L('Jina — mf. Pati ya Ijumaa', 'Name — e.g. Friday house party')} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            <input className="field" maxLength={EVENT_LIMITS.descMax} placeholder={L('Maelezo (si lazima)', 'Details (optional)')} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <select className="field" value={form.placeId} onChange={(e) => setForm({ ...form, placeId: e.target.value })}>
              {EVENT_PLACES.map((id) => <option key={id} value={id}>{id === 'home' ? L('🏠 Kwangu (pati ya nyumbani)', '🏠 My place (house party)') : placeLabel(id)}</option>)}
            </select>
            <input className="field" type="datetime-local" value={form.at} min={localInput(Date.now() + EVENT_LIMITS.minLeadMs)} onChange={(e) => setForm({ ...form, at: e.target.value })} required />
            <div className="small muted">{L('Waliojiandikisha wataweza kuja nyumbani kwako na watapata taarifa tukio likianza.', "Everyone who RSVPs can come to your place and gets a ping when it starts.")}</div>
            <div className="row" style={{ gap: 8 }}>
              <button type="button" className="btn btn-ghost grow" onClick={() => setForm(null)}>{L('Ghairi', 'Cancel')}</button>
              <button className="btn btn-green grow">{L('Tangaza', 'Announce')}</button>
            </div>
          </form>
        )}
        {list === null && <div className="small muted">{L('Inapakia…', 'Loading…')}</div>}
        {list?.length === 0 && !form && (
          <div className="box small muted" style={{ textAlign: 'center', padding: 20 }}>
            <div style={{ fontSize: 40 }}>🎊</div>
            {L('Hakuna matukio yanayokuja. Kuwa wa kwanza kuandaa pati!', 'No upcoming events. Be the first to throw a party!')}
          </div>
        )}
        {list?.map((e) => {
          const live = e.starts_at <= Date.now();
          const p = e.place_id === 'home' ? null : placeById[e.place_id];
          const [c1, c2] = COVERS[e.id % COVERS.length];
          return (
            <div key={e.id} className="ev">
              <div className="ev-cover" style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}>
                {live && <span className="tag live">● LIVE</span>}
                <span className="ev-ic">{p ? p.icon : '🏠'}</span>
                <div>
                  <span className="when">{when(e.starts_at)}</span>
                  <h4>{e.title}</h4>
                </div>
              </div>
              <div className="ev-body">
                {e.description && <div className="small" style={{ marginBottom: 6 }}>{e.description}</div>}
                <div className="small muted">{placeLabel(e.place_id)} · {L('na', 'by')} @{e.host}</div>
                <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                  <div className="faces">{(e.faces || []).map((f) => <span key={f.username} title={`@${f.username}`}>{avatarEmoji(f.appearance)}</span>)}</div>
                  <span className="small muted">🙋 {e.going} {L('wanakuja', 'going')}</span>
                </div>
                <div className="row" style={{ gap: 8, marginTop: 10 }}>
                  {e.host_id === me.id ? (
                    <button className="btn btn-ghost btn-xs grow" onClick={() => cancel(e)}>✕ {L('Ghairi tukio', 'Cancel event')}</button>
                  ) : (
                    <button className={`btn btn-xs grow ${e.mine ? 'btn-ghost' : 'btn-dark'}`} onClick={() => rsvp(e)}>{e.mine ? `✓ ${L('Nakuja', 'Going')}` : `🙋 ${L('Nitakuja', "I'm going")}`}</button>
                  )}
                  {live ? (
                    <button className="btn btn-xs grow party-btn" style={{ marginTop: 0 }} onClick={() => joinParty(e)}>🎉 {L('Ingia sasa', 'Join now')}</button>
                  ) : (soon(e) || e.place_id !== 'home') && (e.mine || e.host_id === me.id || e.place_id !== 'home') && (
                    <button className="btn btn-green btn-xs grow" onClick={() => go(e)}>{L('Nenda', 'Go')} →</button>
                  )}
                  <button className="btn btn-ghost btn-xs" onClick={() => share({ title: e.title, text: L(`Njoo kwenye "${e.title}" Bongo Life! 🎉`, `Come to "${e.title}" on Bongo Life! 🎉`), params: { event: e.id } })} aria-label="Share">🔗</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
