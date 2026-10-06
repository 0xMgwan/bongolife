import { useEffect, useState } from 'react';
import { useStore } from '../../store.js';
import { api } from '../../api.js';
import { remotes } from '../../net.js';
import { avatarEmoji } from '../../three/Avatar.jsx';
import { AppHead } from '../Phone.jsx';
import { L } from '../../i18n.js';
import { inviteHome } from '../social.js';

export function Contacts({ back, open }) {
  const me = useStore((s) => s.me);
  const run = useStore((s) => s.run);
  const roster = useStore((s) => s.roster);
  const [list, setList] = useState(null);
  const [name, setName] = useState('');
  useEffect(() => {
    api('/contacts').then(setList).catch(() => setList([]));
  }, []);
  const add = async (username) => {
    const r = await run('/contacts', { method: 'POST', body: { username } });
    if (r) {
      setList(r);
      setName('');
      useStore.getState().toast(L(`📇 @${username} ameongezwa`, `📇 @${username} added`));
    }
  };
  const remove = async (username) => {
    const r = await run(`/contacts/${encodeURIComponent(username)}`, { method: 'DELETE' });
    if (r) setList(r);
  };
  void roster;
  const known = new Set((list || []).map((c) => c.username));
  const suggestions = [...remotes.values()].filter((r) => !known.has(r.username) && r.username !== me.username).slice(0, 6);
  return (
    <>
      <AppHead title={L('Anwani', 'Contacts')} onBack={back} />
      <div className="app-body">
        <form className="row" style={{ marginBottom: 12 }} onSubmit={(e) => { e.preventDefault(); if (name.trim()) add(name.trim().replace(/^@/, '')); }}>
          <input className="field" style={{ padding: '11px 16px' }} placeholder={L('@username ya kuongeza', '@username to add')} value={name} onChange={(e) => setName(e.target.value)} autoCapitalize="none" />
          <button className="btn btn-green btn-sm">＋ {L('Ongeza', 'Add')}</button>
        </form>
        <div className="box" style={{ padding: '4px 12px' }}>
          {list === null && <div className="small muted" style={{ padding: 12 }}>{L('Inapakia…', 'Loading…')}</div>}
          {list?.length === 0 && <div className="small muted" style={{ padding: 12 }}>{L('Bado huna anwani. Ongeza washkaji wako!', 'No contacts yet. Add your friends!')}</div>}
          {list?.map((c) => (
            <div key={c.id} className="thread">
              <span className="avatar-dot">{avatarEmoji(c.appearance)}{c.online && <span className="dot" style={{ position: 'absolute', right: 0, bottom: 0 }} />}</span>
              <div className="grow">
                <b>{c.name}</b>
                <div className="small muted">@{c.username} · {c.mutual ? L('rafiki', 'friend') + ' · ' : ''}{c.online ? L('yuko online', 'online') : 'offline'}</div>
              </div>
              {c.online && <button className="round" style={{ width: 36, height: 36, fontSize: 15 }} onClick={() => inviteHome(c.username)} aria-label={L('Mwalike nyumbani', 'Invite home')}>🏠</button>}
              <button className="round" style={{ width: 36, height: 36, fontSize: 15 }} onClick={() => open('dm', c.username)} aria-label={L('Ujumbe', 'Message')}>💬</button>
              <button className="round" style={{ width: 36, height: 36, fontSize: 15 }} onClick={() => open('pesa', { send: c.username })} aria-label={L('Tuma pesa', 'Send money')}>💸</button>
              <button className="round" style={{ width: 36, height: 36, fontSize: 13 }} onClick={() => remove(c.username)} aria-label={L('Ondoa', 'Remove')}>✕</button>
            </div>
          ))}
        </div>
        {suggestions.length > 0 && (
          <>
            <div className="section-t">{L('Walio online sasa', 'Online now')}</div>
            <div className="box" style={{ padding: '4px 12px' }}>
              {suggestions.map((r) => (
                <div key={r.id} className="thread">
                  <span className="avatar-dot">{avatarEmoji(r.appearance)}</span>
                  <div className="grow"><b>@{r.username}</b><div className="small muted">{r.name}</div></div>
                  <button className="btn btn-ghost btn-xs" onClick={() => add(r.username)}>＋ {L('Ongeza', 'Add')}</button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
