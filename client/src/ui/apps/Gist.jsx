// Bongo Gist: everyone's in-game photos — like, comment, share your own.
import { useEffect, useState } from 'react';
import { useStore } from '../../store.js';
import { api } from '../../api.js';
import { AppHead } from '../Phone.jsx';
import { L } from '../../i18n.js';
import { openCamera } from '../Camera.jsx';
import { avatarEmoji } from '../../three/Avatar.jsx';

const ago = (t) => { const m = Math.round((Date.now() - t) / 60000); return m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`; };

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
      <img src={p.image} alt="" loading="lazy" onDoubleClick={() => !p.liked && like()} />
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
