// Bongo Gist: everyone's in-game photos — like, comment, share your own.
import { useEffect, useState } from 'react';
import { useStore } from '../../store.js';
import { api } from '../../api.js';
import { AppHead } from '../Phone.jsx';
import { L } from '../../i18n.js';
import { openCamera } from '../Camera.jsx';
import { avatarEmoji } from '../../three/Avatar.jsx';
import { cityById } from '@shared/world.js';

const ago = (t) => { const m = Math.round((Date.now() - t) / 60000); return m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`; };

// A trip check-in: no photo, a postcard of the city they just landed in.
const POST = { dar: ['#0ea5e9', '#f59e0b'], znz: ['#06b6d4', '#fde68a'], aru: ['#65a30d', '#fef3c7'], mwz: ['#2563eb', '#a7f3d0'], pwa: ['#b45309', '#fde68a'] };
const BY = { flight: ['kwa ndege ✈️', 'by plane ✈️'], heli: ['kwa helikopta 🚁', 'by helicopter 🚁'], ferry: ['kwa boti ⛴️', 'by ferry ⛴️'], bus: ['kwa basi 🚌', 'by coach 🚌'], car: ['kwa gari 🚗', 'by road 🚗'] };
function Postcard({ c, place, who, onDoubleClick }) {
  const city = cityById[c.city];
  const [a, b] = POST[c.city] || POST.dar;
  return (
    <div className="postcard" style={{ background: `linear-gradient(160deg, ${a}, ${b})` }} onDoubleClick={onDoubleClick}>
      <span className="pc-stamp">{city?.icon || '📍'}</span>
      <small>{L('SALAMU KUTOKA', 'GREETINGS FROM')}</small>
      <b>{city?.name || c.city}</b>
      <span className="pc-line">📍 {L(`@${who} amefika ${place || city?.name}`, `@${who} checked in at ${place || city?.name}`)}</span>
      <span className="pc-line">{L(BY[c.mode]?.[0] || '', BY[c.mode]?.[1] || '')}{c.family ? L(' · na familia 👨‍👩‍👧', ' · with the family 👨‍👩‍👧') : ''}</span>
    </div>
  );
}

function Post({ p, onChange }) {
  const run = useStore((s) => s.run);
  const [open, setOpen] = useState(false);
  const [list, setList] = useState(null);
  const [text, setText] = useState('');
  const like = async () => { const r = await run(`/gist/${p.id}/like`, { method: 'POST' }); if (r) onChange({ ...p, liked: r.liked, likes: r.likes }); };
  const showComments = async () => { setOpen(!open); if (!list) setList(await api(`/gist/${p.id}/comments`).catch(() => [])); };
  const send = async (e) => { e.preventDefault(); const r = await run(`/gist/${p.id}/comments`, { method: 'POST', body: { text } }); if (r) { setList(r); setText(''); onChange({ ...p, comments: r.length }); } };
  return (
    <div className="gist-post">
      <div className="gp-head"><span className="gp-av">{avatarEmoji(p.appearance)}</span><span className="grow"><b>@{p.username}</b><small>{p.place ? `📍 ${p.place} · ` : ''}{ago(p.at)}</small></span>
        {p.mine && <button className="btn btn-ghost btn-xs" onClick={async () => { if (await run(`/gist/${p.id}`, { method: 'DELETE' })) onChange(null); }}>🗑️</button>}</div>
      {p.checkin ? <Postcard c={p.checkin} place={p.place} who={p.username} onDoubleClick={() => !p.liked && like()} />
        : <img src={p.image} alt="" loading="lazy" onDoubleClick={() => !p.liked && like()} />}
      <div className="gp-acts">
        <button onClick={like}>{p.liked ? '❤️' : '🤍'} {p.likes}</button>
        <button onClick={showComments}>💬 {p.comments}</button>
      </div>
      {p.caption && <p className="gp-cap"><b>@{p.username}</b> {p.caption}</p>}
      {open && (
        <div className="gp-comments">
          {(list || []).map((c) => <div key={c.id} className="small"><b>@{c.username}</b> {c.text}</div>)}
          <form className="row" style={{ gap: 6, marginTop: 6 }} onSubmit={send}>
            <input className="field" style={{ padding: '8px 12px', fontSize: 14 }} maxLength={300} placeholder={L('Andika maoni…', 'Add a comment…')} value={text} onChange={(e) => setText(e.target.value)} />
            <button className="btn btn-green btn-xs" disabled={!text.trim()}>{L('Tuma', 'Send')}</button>
          </form>
        </div>
      )}
    </div>
  );
}

export function Gist({ back }) {
  const [posts, setPosts] = useState(null);
  const [more, setMore] = useState(true);
  const load = async (before = null) => {
    const r = await api(`/gist${before ? `?before=${before}` : ''}`).catch(() => []);
    setPosts((prev) => (before ? [...(prev || []), ...r] : r));
    setMore(r.length === 20);
  };
  useEffect(() => { load(); }, []);
  return (
    <>
      <AppHead title="Bongo Gist" onBack={back} />
      <div className="app-body">
        <button className="btn btn-green btn-block" style={{ marginBottom: 12 }} onClick={() => openCamera()}>📷 {L('Piga picha', 'Take a photo')}</button>
        {posts === null && <div className="small muted">{L('Inapakia…', 'Loading…')}</div>}
        {posts?.length === 0 && <div className="box small">{L('Bado hakuna picha. Kuwa wa kwanza — piga picha club, nyumbani au ufukweni!', 'No photos yet. Be the first — snap the club, your home or the beach!')}</div>}
        {posts?.map((p, i) => <Post key={p.id} p={p} onChange={(np) => setPosts(np ? posts.map((x, k) => (k === i ? np : x)) : posts.filter((_, k) => k !== i))} />)}
        {posts?.length > 0 && more && <button className="btn btn-ghost btn-block btn-sm" onClick={() => load(posts[posts.length - 1].id)}>{L('Zaidi', 'Load more')}</button>}
      </div>
    </>
  );
}
