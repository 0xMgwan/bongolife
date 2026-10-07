import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../../store.js';
import { api } from '../../api.js';
import { remotes } from '../../net.js';
import { avatarEmoji } from '../../three/Avatar.jsx';
import { AppHead } from '../Phone.jsx';
import { L } from '../../i18n.js';
import { inviteHome, whereIs, goToPlayer } from '../social.js';
import { InviteCard } from '../Invite.jsx';

/** People: who's online, your friends, and friend requests. */
export function Watu({ back, open }) {
  const me = useStore((s) => s.me);
  const run = useStore((s) => s.run);
  const roster = useStore((s) => s.roster);
  const [tab, setTab] = useState('online');
  const [contacts, setContacts] = useState(null);
  const [requests, setRequests] = useState(null);
  const [ignored, setIgnored] = useState(() => new Set());
  const load = () => {
    api('/contacts').then(setContacts).catch(() => setContacts([]));
    api('/contacts/requests').then(setRequests).catch(() => setRequests([]));
  };
  useEffect(load, []);
  const byName = useMemo(() => Object.fromEntries((contacts || []).map((c) => [c.username, c])), [contacts]);
  const live = useMemo(() => [...remotes.values()].filter((r) => r.username !== me.username), [roster]); // eslint-disable-line react-hooks/exhaustive-deps
  const liveByName = Object.fromEntries(live.map((r) => [r.username, r]));
  const add = async (username) => {
    const r = await run('/contacts', { method: 'POST', body: { username } });
    if (!r) return;
    setContacts(r);
    const c = r.find((x) => x.username === username);
    useStore.getState().toast(c?.mutual ? L(`🤝 Sasa wewe na @${username} ni marafiki!`, `🤝 You and @${username} are now friends!`) : L(`📨 Ombi la urafiki limetumwa kwa @${username}`, `📨 Friend request sent to @${username}`));
    api('/contacts/requests').then(setRequests).catch(() => {});
  };
  const reqs = (requests || []).filter((r) => !ignored.has(r.id));
  const friends = (contacts || []).filter((c) => c.mutual);
  const pending = (contacts || []).filter((c) => !c.mutual);
  const sorted = [...live].sort((a, b) => (byName[b.username]?.mutual ? 1 : 0) - (byName[a.username]?.mutual ? 1 : 0));

  const row = (u, r) => {
    const c = byName[u.username];
    const on = !!r || u.online;
    return (
      <div key={u.id} className="person">
        <span className="avatar-dot" onClick={() => useStore.setState({ phone: null, sheet: { type: 'player', id: u.username } })}>
          {avatarEmoji(u.appearance)}{on && <span className="dot" style={{ position: 'absolute', right: 0, bottom: 0 }} />}
        </span>
        <div className="grow">
          <b>@{u.username}</b> {c?.mutual && <span className="tag friend">{L('Rafiki', 'Friend')}</span>}
          <div className="small muted">{r ? whereIs(r) : on ? L('yuko online', 'online') : 'offline'}</div>
          <div className="acts">
          {!c && <button className="mini" onClick={() => add(u.username)}>➕ {L('Ongeza', 'Add')}</button>}
            {on && <button className="mini" onClick={() => inviteHome(u.username)}>🏠 {L('Alika', 'Invite')}</button>}
            {r && r.inside !== 'home' && <button className="mini" onClick={() => goToPlayer(u.username)}>📍 {L('Nenda', 'Go')}</button>}
            <button className="mini" onClick={() => open('dm', u.username)}>💬</button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <AppHead title={L('Watu', 'People')} onBack={back} />
      <div className="app-body">
        <InviteCard compact />
        <div className="seg">
          <button className={tab === 'online' ? 'on' : ''} onClick={() => setTab('online')}>{L('Online', 'Online')} · {live.length}</button>
          <button className={tab === 'friends' ? 'on' : ''} onClick={() => setTab('friends')}>{L('Marafiki', 'Friends')} · {friends.length}</button>
          <button className={tab === 'requests' ? 'on' : ''} onClick={() => setTab('requests')}>{L('Maombi', 'Requests')}{reqs.length ? ` · ${reqs.length}` : ''}</button>
        </div>
        {tab === 'online' && (
          <div className="box" style={{ padding: '2px 12px' }}>
            {!sorted.length && <div className="small muted" style={{ padding: 12 }}>{L('Hakuna mtu mwingine online sasa hivi. Waalike washkaji wako wajiunge!', 'Nobody else is online right now. Invite your friends to join!')}</div>}
            {sorted.map((r) => row(r, r))}
          </div>
        )}
        {tab === 'friends' && (
          <>
            <div className="box" style={{ padding: '2px 12px' }}>
              {contacts === null && <div className="small muted" style={{ padding: 12 }}>{L('Inapakia…', 'Loading…')}</div>}
              {contacts && !friends.length && <div className="small muted" style={{ padding: 12 }}>{L('Bado huna marafiki. Ongeza watu — wakikuongeza pia mnakuwa marafiki.', 'No friends yet. Add people — when they add you back you become friends.')}</div>}
              {friends.map((c) => row(c, liveByName[c.username]))}
            </div>
            {pending.length > 0 && (
              <>
                <div className="section-t">{L('Wanasubiri kukuongeza', 'Waiting for them to add you')}</div>
                <div className="box" style={{ padding: '2px 12px' }}>{pending.map((c) => row(c, liveByName[c.username]))}</div>
              </>
            )}
          </>
        )}
        {tab === 'requests' && (
          <div className="box" style={{ padding: '2px 12px' }}>
            {!reqs.length && <div className="small muted" style={{ padding: 12 }}>{L('Hakuna maombi mapya.', 'No new requests.')}</div>}
            {reqs.map((u) => (
              <div key={u.id} className="person">
                <span className="avatar-dot">{avatarEmoji(u.appearance)}</span>
                <div className="grow"><b>@{u.username}</b><div className="small muted">{L('anataka muwe marafiki', 'wants to be friends')}</div></div>
                <div className="acts">
                  <button className="btn btn-green btn-xs" onClick={() => add(u.username)}>✓ {L('Kubali', 'Accept')}</button>
                  <button className="round" onClick={() => setIgnored(new Set([...ignored, u.id]))} aria-label={L('Puuza', 'Ignore')}>✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
