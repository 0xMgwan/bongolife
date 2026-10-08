import { useEffect, useState } from 'react';
import { useStore } from '../store.js';
import { interactWith, answerInteract, remotes } from '../net.js';
import { avatarEmoji } from '../three/Avatar.jsx';
import { placeById } from '@shared/world.js';
import { L, loc } from '../i18n.js';
import { sfx } from '../audio.js';
import { share } from './share.js';
import { TOGETHER, togetherById } from './together.js';
import { drawSelfie } from './selfieImage.js';

/** On a player's card: things you do *with* them (they accept, both sims animate). */
export function TogetherRow({ username, near }) {
  const toast = useStore((s) => s.toast);
  const go = async (t) => {
    const r = await interactWith(username, t.id);
    if (r.error) return toast(r.error, 'err');
    sfx('pop');
    if (r.ok === 'asked') toast(L(`${t.emoji} Umemwomba @${username}… subiri ajibu`, `${t.emoji} Asked @${username}… waiting for them`));
    useStore.setState({ sheet: null });
  };
  return (
    <>
      <div className="section-t">{L('Pamoja', 'Together')}</div>
      <div className="together-row">
        {TOGETHER.map((t) => (
          <button key={t.id} className="together-btn" disabled={!near} onClick={() => go(t)}>
            <span className="tg-em">{t.emoji}</span>
            <b>{t.name()}</b>
            {t.note && <small>{t.note()}</small>}
          </button>
        ))}
      </div>
    </>
  );
}

/** "@x wants to play-fight · Accept / No" — answers itself "no" when it runs out. */
export function InteractAsk() {
  const req = useStore((s) => s.interactAsk);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!req) return;
    const t = setInterval(() => {
      tick((n) => n + 1);
      if (Date.now() > req.exp) answerInteract(req.rid, false);
    }, 500);
    return () => clearInterval(t);
  }, [req]);
  if (!req) return null;
  const t = togetherById[req.kind];
  const left = Math.max(0, Math.ceil((req.exp - Date.now()) / 1000));
  const r = remotes.get(req.fromId);
  return (
    <div className="interact-ask" role="alertdialog" aria-label={`@${req.from}`}>
      <div className="ia-who">
        <span className="ia-av">{r ? avatarEmoji(r.appearance) : '🙂'}</span>
        <span className="ia-em">{t?.emoji}</span>
      </div>
      <b>{L(`@${req.from} anataka: ${t?.name()}`, `@${req.from} wants to: ${t?.name()}`)}</b>
      {req.kind === 'fight' && <small>{L('Kirafiki tu: hakuna atakayeumia sana.', 'Just for fun: nobody gets really hurt.')}</small>}
      {req.kind === 'treat' && <small>{L('Wanakununulia kinywaji 🍹', "They're buying you a drink 🍹")}</small>}
      <div className="ia-acts">
        <button className="btn btn-green" onClick={() => answerInteract(req.rid, true)}>{t?.emoji} {L('Kubali', 'Accept')}</button>
        <button className="btn btn-white" onClick={() => answerInteract(req.rid, false)}>{L('Hapana', 'No')} · {left}s</button>
      </div>
    </div>
  );
}

/** After a selfie: the branded photo card (brand kit layout, both @usernames tagged), ready to share. */
export function SelfieCard() {
  const selfie = useStore((s) => s.selfie);
  const me = useStore((s) => s.me);
  const inside = useStore((s) => s.inside);
  const lang = useStore((s) => s.lang);
  const [img, setImg] = useState(null);
  useEffect(() => {
    setImg(null);
    if (!selfie || !me) return;
    const them = [...remotes.values()].find((r) => r.username === selfie.with);
    drawSelfie({
      me: { username: me.username, face: avatarEmoji(me.appearance) },
      them: { username: selfie.with, face: them ? avatarEmoji(them.appearance) : '🙂' },
      place: placeById[inside] ? loc(placeById[inside]) : 'Dar es Salaam',
      sw: lang !== 'en',
    }).then(setImg).catch(() => {});
  }, [selfie]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!selfie || !me) return null;
  const close = () => useStore.setState({ selfie: null });
  const name = `bongo-life-selfie-${selfie.with}.png`;
  const text = L(`Selfie na @${selfie.with} kwenye Bongo Life 🇹🇿`, `Selfie with @${selfie.with} in Bongo Life 🇹🇿`);
  const shareImage = async () => {
    try {
      const file = new File([await (await fetch(img)).blob()], name, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) return await navigator.share({ files: [file], title: 'Bongo Life', text });
    } catch (e) {
      if (e?.name === 'AbortError') return;
    }
    share({ title: 'Bongo Life 🤳', text });
  };
  return (
    <div className="sheet-wrap" onClick={close}>
      <div className="selfie-card" onClick={(e) => e.stopPropagation()}>
        {img ? <img className="sf-img" src={img} alt={`@${me.username} × @${selfie.with}`} /> : <div className="sf-img sf-wait">🤳</div>}
        <div className="ia-acts">
          <button className="btn btn-green" disabled={!img} onClick={shareImage}>📤 {L('Shiriki', 'Share')}</button>
          {img && <a className="btn btn-white" href={img} download={name}>⬇️ {L('Hifadhi', 'Save')}</a>}
          <button className="btn btn-white" onClick={close}>{L('Poa', 'Nice')}</button>
        </div>
      </div>
    </div>
  );
}
