import { useEffect, useState } from 'react';
import { TOGETHER, NEEDS } from '@shared/world.js';
import { useStore } from '../store.js';
import { knock, replyKnock, homeGuests } from '../net.js';
import { avatarEmoji } from '../three/Avatar.jsx';
import { L, isEn } from '../i18n.js';
import { sfx } from '../audio.js';

/** Knock on a neighbour's door (shows the "Knock knock…" wait). */
export async function knockOn(username) {
  const r = await knock(username);
  const toast = useStore.getState().toast;
  if (r.ok) {
    sfx('knock');
    useStore.setState({ knocking: { username, at: Date.now() }, phone: null, sheet: null });
    return true;
  }
  toast({
    offline: L(`@${username} hayuko mtandaoni.`, `@${username} is offline.`),
    not_home: L(`@${username} hayuko nyumbani sasa hivi.`, `@${username} isn't home right now.`),
    slow: L('Subiri kidogo kabla ya kugonga tena.', 'Wait a moment before knocking again.'),
    blocked: L('Huwezi kumtembelea.', "You can't visit them."),
  }[r.error] || L('Imeshindikana.', "Couldn't knock."), 'err');
  return false;
}

/** Visitor: waiting at the door. Host: someone is knocking. */
export function KnockModals() {
  const knocking = useStore((s) => s.knocking);
  const knockIn = useStore((s) => s.knockIn);
  // Give up after a minute if nobody answers.
  useEffect(() => {
    if (!knocking) return;
    const t = setTimeout(() => {
      if (useStore.getState().knocking === knocking) {
        useStore.setState({ knocking: null });
        useStore.getState().toast(L(`🚪 Hakuna aliyefungua kwa @${knocking.username}.`, `🚪 Nobody answered at @${knocking.username}'s.`));
      }
    }, 60_000);
    return () => clearTimeout(t);
  }, [knocking]);
  useEffect(() => {
    if (!knockIn) return;
    const t = setTimeout(() => useStore.getState().knockIn === knockIn && useStore.setState({ knockIn: null }), 45_000);
    return () => clearTimeout(t);
  }, [knockIn]);
  if (knockIn) {
    const answer = (yes) => {
      replyKnock(knockIn.fromId, yes);
      sfx(yes ? 'open' : 'close');
      useStore.setState({ knockIn: null });
    };
    return (
      <div className="modal-wrap confirm-wrap">
        <div className="modal card confirm-card">
          <div className="big badge-ic">{avatarEmoji(knockIn.appearance)}</div>
          <h3>{L(`@${knockIn.from} yuko mlangoni`, `@${knockIn.from} is at your door`)}</h3>
          <p className="confirm-text">{L('Anataka kuja kukaa nawe. Mfungulie?', 'They want to come over and hang out. Let them in?')}</p>
          <div className="confirm-btns">
            <button className="btn btn-ghost" onClick={() => answer(false)}>{L('Si sasa', 'Not now')}</button>
            <button className="btn btn-green" onClick={() => answer(true)}>🚪 {L('Fungua', 'Open')}</button>
          </div>
        </div>
      </div>
    );
  }
  if (knocking) {
    return (
      <div className="modal-wrap confirm-wrap">
        <div className="modal card confirm-card">
          <div className="big knock-door">🚪</div>
          <h3>{L('Hodi hodi…', 'Knock knock…')}</h3>
          <p className="confirm-text">{L(`Tunasubiri @${knocking.username} afungue mlango.`, `Waiting for @${knocking.username} to open the door.`)}</p>
          <div className="confirm-btns">
            <button className="btn btn-ghost" onClick={() => { sfx('close'); useStore.setState({ knocking: null }); }}>{L('Ondoka', 'Walk away')}</button>
          </div>
        </div>
      </div>
    );
  }
  return null;
}

/** At home with company: things to do together (movie, FIFA, cooking…). */
export function TogetherBar() {
  const tab = useStore((s) => s.tab);
  const visiting = useStore((s) => s.visiting);
  const me = useStore((s) => s.me);
  useStore((s) => s.homeRoster); // re-render when guests come and go
  const [busy, setBusy] = useState(false);
  if (tab !== 'home' || !me) return null;
  const guests = [...homeGuests.values()];
  if (!guests.length) return null;
  const host = visiting ? visiting.host.username : me.username;
  const icon = Object.fromEntries(NEEDS.map((n) => [n.id, n.icon]));
  const go = async (t) => {
    setBusy(true);
    const r = await useStore.getState().run(`/visit/${encodeURIComponent(host)}/together`, { method: 'POST', body: { act: t.id } });
    setBusy(false);
    if (r) {
      sfx('pop');
      useStore.getState().toast(`${t.emoji} ${L(t.name[0], t.name[1])}! ${Object.entries(t.effects).map(([k, v]) => `${icon[k]}+${v}`).join(' ')}`);
    }
  };
  return (
    <div className="together-bar">
      <div className="tb-who">👥 {guests.map((g) => `@${g.username}`).join(', ')} · {visiting ? L('mko pamoja', "you're together") : L('wako kwako', 'are at yours')}</div>
      <div className="tb-acts">
        {TOGETHER.map((t) => (
          <button key={t.id} disabled={busy} onClick={() => go(t)}>
            <span>{t.emoji}</span>{isEn() ? t.name[1] : t.name[0]}
          </button>
        ))}
      </div>
    </div>
  );
}
