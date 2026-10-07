import { useEffect, useState } from 'react';
import { fmtTsh } from '@shared/world.js';
import { api } from '../api.js';
import { L } from '../i18n.js';
import { share, shareUrl } from './share.js';

/** "Invite friends" card: your link, share button and what you've earned. */
export function InviteCard({ compact }) {
  const [r, setR] = useState(null);
  useEffect(() => {
    api('/me/referrals').then(setR).catch(() => {});
  }, []);
  const url = shareUrl();
  const go = () => share({
    title: 'Bongo Life 🇹🇿',
    text: L('Njoo tuishi maisha ya Dar pamoja kwenye Bongo Life! Ukijiunga kwa link yangu unapata TSh 20,000 za bure 🎁', 'Come live the Dar life with me on Bongo Life! Join with my link and get TSh 20,000 free 🎁'),
  });
  return (
    <div className="invite-card">
      <div className="row between">
        <b>🎁 {L('Alika washkaji', 'Invite friends')}</b>
        {r && <span className="small">{r.joined} {L('wamejiunga', 'joined')}</span>}
      </div>
      {!compact && (
        <div className="small" style={{ margin: '6px 0 10px', opacity: 0.9 }}>
          {L(
            `Rafiki anapata TSh ${(r?.rules.newPlayer ?? 20000).toLocaleString()} akijiunga. Wewe unapata TSh ${(r?.rules.referrer ?? 30000).toLocaleString()} akimaliza shifti yake ya kwanza.`,
            `Your friend gets TSh ${(r?.rules.newPlayer ?? 20000).toLocaleString()} when they join. You get TSh ${(r?.rules.referrer ?? 30000).toLocaleString()} when they finish their first shift.`,
          )}
        </div>
      )}
      <div className="invite-link">{url.replace(/^https?:\/\//, '')}</div>
      <div className="row" style={{ gap: 8, marginTop: 8 }}>
        <button className="btn btn-white btn-sm grow" onClick={go}>📤 {L('Shiriki link', 'Share link')}</button>
        <a className="btn btn-white btn-sm" href={`https://wa.me/?text=${encodeURIComponent(L('Njoo Bongo Life! ', 'Join me on Bongo Life! ') + url)}`} target="_blank" rel="noreferrer">WhatsApp</a>
      </div>
      {r?.earned > 0 && <div className="small" style={{ marginTop: 8 }}>💰 {L('Umepata', "You've earned")} {fmtTsh(r.earned)}</div>}
    </div>
  );
}
