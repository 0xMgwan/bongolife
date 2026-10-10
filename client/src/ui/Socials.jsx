import { L } from '../i18n.js';

export const SOCIALS = [
  { id: 'instagram', name: 'Instagram', handle: '@bongolifegames', url: 'https://www.instagram.com/bongolifegames', bg: 'linear-gradient(45deg,#f9ce34,#ee2a7b,#6228d7)',
    path: 'M12 2.2c3.2 0 3.6 0 4.8.1 1.2.1 1.8.2 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.4 1 .4 2.2.1 1.3.1 1.6.1 4.8s0 3.6-.1 4.8c-.1 1.2-.2 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1 .4-2.2.4-1.3.1-1.6.1-4.8.1s-3.6 0-4.8-.1c-1.2-.1-1.8-.2-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.2-.4-.4-1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.8c.1-1.2.2-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1-.4 2.2-.4C8.4 2.2 8.8 2.2 12 2.2zm0 4.9a4.9 4.9 0 1 0 0 9.8 4.9 4.9 0 0 0 0-9.8zm0 8a3.1 3.1 0 1 1 0-6.2 3.1 3.1 0 0 1 0 6.2zm5.1-9.4a1.1 1.1 0 1 0 0 2.3 1.1 1.1 0 0 0 0-2.3z' },
  { id: 'tiktok', name: 'TikTok', handle: '@bongolifegames', url: 'https://www.tiktok.com/@bongolifegames', bg: '#111111',
    path: 'M16.6 2h-3.3v13.1a2.9 2.9 0 1 1-2.9-2.9c.3 0 .6 0 .9.1V8.9a6.3 6.3 0 1 0 5.3 6.2V8.4a7.9 7.9 0 0 0 4.6 1.5V6.6a4.6 4.6 0 0 1-4.6-4.6z' },
  { id: 'whatsapp', name: 'WhatsApp', handle: L('Jumuiya', 'Community'), url: 'https://chat.whatsapp.com/KCgM5FOmzQE6byU18abpB1', bg: '#25d366',
    path: 'M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm4.5 12.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1-.7-.3-1.4-.7-2-1.3-.5-.5-1-1.1-1.3-1.7-.1-.2 0-.4.1-.5l.4-.5.3-.4v-.5l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.3-.9.9-.9 2.2s.9 2.5 1 2.7c.1.2 1.8 2.8 4.4 3.9.6.3 1.1.4 1.5.5.6.2 1.2.2 1.6.1.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3z' },
];

/** Follow Bongo Life: Instagram, TikTok and the WhatsApp community, with their logos. */
export function Socials({ compact = false }) {
  return (
    <div className={`socials ${compact ? 'compact' : ''}`}>
      {!compact && <div className="bold" style={{ marginBottom: 8 }}>📣 {L('Tufuate & jiunge na jumuiya', 'Follow us & join the community')}</div>}
      <div className="socials-row">
        {SOCIALS.map((s) => (
          <a key={s.id} href={s.url} target="_blank" rel="noopener noreferrer" className="social-btn" aria-label={s.name}>
            <span className="social-ic" style={{ background: s.bg }}><svg viewBox="0 0 24 24" width="20" height="20" fill="#fff"><path d={s.path} /></svg></span>
            {!compact && <span className="social-t"><b>{s.name}</b><small>{s.handle}</small></span>}
          </a>
        ))}
      </div>
    </div>
  );
}
