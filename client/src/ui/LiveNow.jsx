import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store.js';
import { api } from '../api.js';
import { remotes } from '../net.js';
import { avatarEmoji } from '../three/Avatar.jsx';
import { L } from '../i18n.js';
import { whereIs, goToPlayer } from './social.js';
import { share } from './share.js';

/** Drop-down from the live-stats capsule: who's online right now, with Go / Message / Add. */
export function LiveNow({ onClose }) {
  const me = useStore((s) => s.me);
  const run = useStore((s) => s.run);
  const roster = useStore((s) => s.roster);
  const [contacts, setContacts] = useState(null);
  useEffect(() => {
    api('/contacts').then(setContacts).catch(() => setContacts([]));
  }, []);
  // Close on Escape or a tap anywhere outside the panel.
  useEffect(() => {
    const key = (e) => e.key === 'Escape' && onClose();
    const away = (e) => !e.target.closest?.('.live-now, .live-stats') && onClose();
    window.addEventListener('keydown', key);
    window.addEventListener('pointerdown', away, true);
    return () => {
      window.removeEventListener('keydown', key);
      window.removeEventListener('pointerdown', away, true);
    };
  }, [onClose]);
  const byName = useMemo(() => Object.fromEntries((contacts || []).map((c) => [c.username, c])), [contacts]);
  // Friends first, then everyone else by name.
  const live = useMemo(
    () => [...remotes.values()]
      .filter((r) => r.username !== me.username)
      .sort((a, b) => (byName[b.username]?.mutual ? 1 : 0) - (byName[a.username]?.mutual ? 1 : 0) || a.username.localeCompare(b.username)),
    [roster, byName, me.username], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const add = async (username) => {
    const r = await run('/contacts', { method: 'POST', body: { username } });
    if (!r) return;
    setContacts(r);
    const c = r.find((x) => x.username === username);
    useStore.getState().toast(c?.mutual ? L(`🤝 Sasa wewe na @${username} ni marafiki!`, `🤝 You and @${username} are now friends!`) : L(`📨 Ombi la urafiki limetumwa kwa @${username}`, `📨 Friend request sent to @${username}`));
  };
  const card = (username) => { onClose(); useStore.setState({ phone: null, sheet: { type: 'player', id: username } }); };
  const dm = (username) => { onClose(); useStore.getState().set({ phone: 'dm', phoneArg: username }); };
  const go = (username) => { onClose(); goToPlayer(username); };
  const invite = () => share({
    title: 'Bongo Life 🇹🇿',
    text: L('Njoo tuishi maisha ya Dar pamoja kwenye Bongo Life! Ukijiunga kwa link yangu unapata TSh 20,000 za bure 🎁', 'Come live the Dar life with me on Bongo Life! Join with my link and get TSh 20,000 free 🎁'),
  });

  return (
    <div className="live-now" role="dialog" aria-label={L('Walio online', 'Live now')}>
      <div className="ln-head">
        <span><i className="ls-dot" /> {L('Walio online sasa', 'Live now')}</span>
        <b>{live.length}</b>
      </div>
      <div className="ln-list">
        {live.map((r, i) => {
          const c = byName[r.username];
          return (
            <div key={r.id} className="ln-row" style={{ '--i': i }}>
              <button className="ln-who" onClick={() => card(r.username)}>
                <span className="ln-av">{avatarEmoji(r.appearance)}<i /></span>
                <span className="ln-txt">
                  <b>@{r.username} {c?.mutual && <em>{L('Rafiki', 'Friend')}</em>}</b>
                  <small>{whereIs(r)}</small>
                </span>
              </button>
              <div className="ln-acts">
                {r.inside !== 'home' && <button onClick={() => go(r.username)} aria-label={L('Nenda', 'Go')}>📍</button>}
                <button onClick={() => dm(r.username)} aria-label={L('Ujumbe', 'Message')}>💬</button>
                {!c && <button onClick={() => add(r.username)} aria-label={L('Ongeza rafiki', 'Add friend')}>➕</button>}
              </div>
            </div>
          );
        })}
        {!live.length && (
          <div className="ln-empty">
            <div>🌙</div>
            {L('Hakuna mwingine online sasa hivi.', 'Nobody else is online right now.')}
            <button className="btn btn-green" onClick={invite}>🎁 {L('Alika washkaji', 'Invite a friend')}</button>
          </div>
        )}
      </div>
      {live.length > 0 && (
        <button className="ln-all" onClick={() => { onClose(); useStore.getState().openPhone('watu'); }}>
          {L('Watu wote & marafiki', 'All people & friends')} ›
        </button>
      )}
    </div>
  );
}

/** "@x is online" alerts sliding in from the top-left; each fades after a few seconds. */
export function PresenceAlerts() {
  const presence = useStore((s) => s.presence);
  const drop = (key) => useStore.setState((s) => ({ presence: s.presence.filter((p) => p.key !== key) }));
  return (
    <div className="presence-alerts" aria-live="polite">
      {presence.map((p) => <PresenceAlert key={p.key} p={p} onDone={() => drop(p.key)} />)}
    </div>
  );
}

function PresenceAlert({ p, onDone }) {
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    const t1 = setTimeout(() => setLeaving(true), 5200);
    const t2 = setTimeout(onDone, 5600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const r = remotes.get(p.id);
  const dm = () => { onDone(); useStore.getState().set({ phone: 'dm', phoneArg: p.username }); };
  const go = () => { onDone(); goToPlayer(p.username); };
  return (
    <div className={`presence-alert ${leaving ? 'leaving' : ''}`}>
      <button className="pa-who" onClick={() => { onDone(); useStore.setState({ phone: null, sheet: { type: 'player', id: p.username } }); }}>
        <span className="ln-av">{avatarEmoji(p.appearance)}<i /></span>
        <span className="ln-txt">
          <b>👋 @{p.username} {L('yuko online', 'is online')}</b>
          <small>{r ? whereIs(r) : L('ameingia mjini', 'just arrived in town')}</small>
        </span>
      </button>
      <div className="ln-acts">
        {r?.inside !== 'home' && <button onClick={go} aria-label={L('Nenda', 'Go')}>📍</button>}
        <button onClick={dm} aria-label={L('Ujumbe', 'Message')}>💬</button>
      </div>
    </div>
  );
}
