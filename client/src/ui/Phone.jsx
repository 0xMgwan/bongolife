import { useEffect, useState } from 'react';
import { gameClock } from '@shared/world.js';
import { useStore } from '../store.js';
import { sfx } from '../audio.js';
import { L, loc } from '../i18n.js';
import { Threads, Dm, Mtaa } from './apps/Messages.jsx';
import { Pesa } from './apps/Pesa.jsx';
import { Mali } from './apps/Mali.jsx';
import { Kazi } from './apps/Kazi.jsx';
import { Ramani } from './apps/Ramani.jsx';
import { Matangazo } from './apps/Matangazo.jsx';
import { Viongozi } from './apps/Viongozi.jsx';
import { Mipangilio, Kabati } from './apps/Mipangilio.jsx';
import { Contacts } from './apps/Contacts.jsx';
import { Browser } from './apps/Browser.jsx';
import { Msaada } from './apps/Msaada.jsx';
import { Watu } from './apps/Watu.jsx';
import { Matukio } from './apps/Matukio.jsx';
import { Safari } from './apps/Safari.jsx';
import { Ndoto } from './apps/Ndoto.jsx';
import { Wekeza } from './apps/Wekeza.jsx';
import { Polisi } from './apps/Polisi.jsx';
import { Majirani } from './apps/Majirani.jsx';
import { api } from '../api.js';

// Built-in apps. `g` is the icon gradient.
export const APPS = [
  { id: 'ndoto', name: 'Ndoto', nameEn: 'Ambitions', icon: '🌟', g: ['#fbbf24', '#ea580c'], C: Ndoto },
  { id: 'kazi', name: 'Kazi', nameEn: 'Jobs', icon: '💼', g: ['#34d399', '#059669'], C: Kazi },
  { id: 'wekeza', name: 'Wekeza', nameEn: 'Invest', icon: '📈', g: ['#4ade80', '#15803d'], C: Wekeza },
  { id: 'ujumbe', name: 'Ujumbe', nameEn: 'Messages', icon: '💬', g: ['#60a5fa', '#2563eb'], C: Threads },
  { id: 'watu', name: 'Watu', nameEn: 'People', icon: '🤝', g: ['#f472b6', '#db2777'], C: Watu },
  { id: 'safari', name: 'Safari', nameEn: 'Travel', icon: '✈️', g: ['#38bdf8', '#1d4ed8'], C: Safari },
  { id: 'matukio', name: 'Matukio', nameEn: 'Events', icon: '🎉', g: ['#c084fc', '#7c3aed'], C: Matukio },
  { id: 'majirani', name: 'Majirani', nameEn: 'Neighbours', icon: '🏘️', g: ['#f9a8d4', '#be185d'], C: Majirani },
  { id: 'polisi', name: 'Polisi', nameEn: 'Police', icon: '🚓', g: ['#60a5fa', '#1e3a8a'], C: Polisi },
  { id: 'anwani', name: 'Anwani', nameEn: 'Contacts', icon: '📞', g: ['#4ade80', '#16a34a'], C: Contacts },
  { id: 'mtaa', name: 'Mtaa', nameEn: 'Street Chat', icon: '📣', g: ['#fb923c', '#ea580c'], C: Mtaa },
  { id: 'pesa', name: 'Bongo Pesa', nameEn: 'Bank', icon: '🏦', g: ['#a78bfa', '#7c3aed'], C: Pesa },
  { id: 'ramani', name: 'Usafiri', nameEn: 'Ride', icon: '🛺', g: ['#fde047', '#eab308'], C: Ramani },
  { id: 'mali', name: 'Mali Yangu', nameEn: 'My Assets', icon: '🏡', g: ['#38bdf8', '#0284c7'], C: Mali },
  { id: 'matangazo', name: 'Matangazo', nameEn: 'Ads', icon: '📢', g: ['#fb7185', '#e11d48'], C: Matangazo },
  { id: 'kabati', name: 'Boutique', nameEn: 'Boutique', icon: '👠', g: ['#e879f9', '#a21caf'], C: Kabati },
  { id: 'viongozi', name: 'Uchaguzi', nameEn: 'Mayor & Votes', icon: '🗳️', g: ['#fcd34d', '#d97706'], C: Viongozi },
  { id: 'msaada', name: 'Msaada', nameEn: 'Help & guide', icon: '💡', g: ['#fde68a', '#f59e0b'], C: Msaada },
  { id: 'mipangilio', name: 'Mipangilio', nameEn: 'Settings', icon: '⚙️', g: ['#9ca3af', '#4b5563'], C: Mipangilio },
];
const byId = Object.fromEntries(APPS.map((a) => [a.id, a]));
byId.dm = { id: 'dm', name: 'Ujumbe', C: Dm, back: 'ujumbe' };
byId.web = { id: 'web', name: 'Web', C: Browser };

function useClock() {
  const [c, setC] = useState(gameClock());
  useEffect(() => {
    const t = setInterval(() => setC(gameClock()), 5000);
    return () => clearInterval(t);
  }, []);
  return c;
}
const hhmm = (c) => `${c.hour % 12 || 12}:${String(c.minute).padStart(2, '0')}`;

export function AppHead({ title, onBack, right }) {
  return (
    <div className="app-head">
      <button className="round" style={{ width: 36, height: 36, fontSize: 16 }} onClick={onBack} aria-label={L('Rudi', 'Back')}>‹</button>
      <h3>{title}</h3>
      {right}
    </div>
  );
}

/** Dar skyline silhouette for the wallpaper. */
function Skyline() {
  return (
    <svg className="skyline" viewBox="0 0 400 90" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 90V62h18V48h14v14h10V30h22v32h8V52h16v10h12V20l10-8 10 8v42h10V44h20v18h6V36h26v26h10V54h14v8h8V26h18v36h12V46h20v16h10V58h20v-8h16v12h18V40h22v50Z" fill="rgba(60,20,60,.55)" />
    </svg>
  );
}

function AppIcon({ icon, label, onClick, badge, g, img, color }) {
  return (
    <button className="app-ic" onClick={onClick}>
      <span className="ic" style={{ background: img ? '#fff' : `linear-gradient(160deg, ${g?.[0] || color}, ${g?.[1] || color})` }}>
        {img ? <img src={img} alt="" /> : icon}
        {badge != null && badge !== '' && <span className={`badge ${badge === 'NEW' ? 'new' : ''}`}>{badge}</span>}
      </span>
      <span className="app-name">{label}</span>
    </button>
  );
}

export function Phone() {
  const phone = useStore((s) => s.phone);
  const arg = useStore((s) => s.phoneArg);
  const me = useStore((s) => s.me);
  const set = useStore((s) => s.set);
  const world = useStore((s) => s.world);
  const announcement = useStore((s) => s.announcement);
  const partner = useStore((s) => s.phoneApps);
  const clock = useClock();
  useEffect(() => {
    if (phone && !partner) api('/phone/apps').then((a) => set({ phoneApps: a })).catch(() => set({ phoneApps: [] }));
  }, [phone, partner, set]);
  if (!phone) return null;
  const close = () => {
    sfx('close');
    set({ phone: null, phoneArg: null });
  };
  const app = byId[phone];
  const open = (id, a = null) => set({ phone: id, phoneArg: a });
  const back = () => open(app?.back || 'home');
  const openPartner = (pa) => {
    api(`/phone/apps/${pa.id}/open`, { method: 'POST' }).catch(() => {});
    open('web', pa);
  };
  const d = new Date();
  const days = L(['Jumapili', 'Jumatatu', 'Jumanne', 'Jumatano', 'Alhamisi', 'Ijumaa', 'Jumamosi'], ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']);
  const months = L(['Januari', 'Februari', 'Machi', 'Aprili', 'Mei', 'Juni', 'Julai', 'Agosti', 'Septemba', 'Oktoba', 'Novemba', 'Desemba'], ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']);
  const banner = announcement ? loc(announcement, 'text') : world?.mayor?.message ? `🏛️ @${world.mayor.username}: “${world.mayor.message}”` : world?.event ? loc(world.event, 'text') : null;
  const badges = { ujumbe: me?.unread || null, mali: me?.pendingIncome > 0 ? '$' : null };

  return (
    <div className="phone-wrap" onClick={close}>
      <button className="phone-close" onClick={close}>✕ {L('Funga', 'Close')}</button>
      <div className="phone" onClick={(e) => e.stopPropagation()}>
        <div className={`screen ${phone === 'home' || !app ? 'wall' : ''}`}>
          <div className="notch" />
          <div className="status"><span>{hhmm(clock)}</span><span>••• 4G <i className="batt" /></span></div>
          {phone === 'home' || !app ? (
            <div className="home">
              <div className="home-time">{hhmm(clock)}</div>
              <div className="home-date">{days[d.getDay()]} {d.getDate()} {months[d.getMonth()]} · Dar es Salaam</div>
              {banner && <div className="home-banner">✨ <span>{banner}</span></div>}
              <div className="apps">
                {APPS.slice(0, 2).map((a) => <AppIcon key={a.id} icon={a.icon} g={a.g} label={loc(a)} badge={badges[a.id]} onClick={() => open(a.id)} />)}
                {(partner || []).map((pa) => <AppIcon key={`p${pa.id}`} icon={pa.emoji || '🌐'} img={pa.icon_url} color={pa.color} label={pa.name} badge={pa.badge} onClick={() => openPartner(pa)} />)}
                {APPS.slice(2).map((a) => <AppIcon key={a.id} icon={a.icon} g={a.g} label={loc(a)} badge={badges[a.id]} onClick={() => open(a.id)} />)}
              </div>
              <Skyline />
            </div>
          ) : (
            <div className="app-view">
              <app.C arg={arg} open={open} back={back} close={close} />
            </div>
          )}
          <button className="home-ind" onClick={() => (phone === 'home' ? close() : open('home'))} aria-label="Home" />
        </div>
      </div>
    </div>
  );
}
