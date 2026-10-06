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

export const APPS = [
  { id: 'ujumbe', name: 'Ujumbe', nameEn: 'Messages', icon: '💬', bg: '#22c55e', C: Threads },
  { id: 'mtaa', name: 'Mtaa', nameEn: 'Street Chat', icon: '📣', bg: '#f97316', C: Mtaa },
  { id: 'pesa', name: 'Bongo Pesa', nameEn: 'Wallet', icon: '💸', bg: '#16a34a', C: Pesa },
  { id: 'mali', name: 'Mali Yangu', nameEn: 'My Assets', icon: '🏡', bg: '#0ea5e9', C: Mali },
  { id: 'kazi', name: 'Kazi', nameEn: 'Jobs', icon: '💼', bg: '#334155', C: Kazi },
  { id: 'ramani', name: 'Ramani', nameEn: 'Map', icon: '🗺️', bg: '#14b8a6', C: Ramani },
  { id: 'matangazo', name: 'Matangazo', nameEn: 'Ads', icon: '📢', bg: '#e11d48', C: Matangazo },
  { id: 'viongozi', name: 'Matajiri', nameEn: 'Rich List', icon: '👑', bg: '#ca8a04', C: Viongozi },
  { id: 'kabati', name: 'Kabati', nameEn: 'Wardrobe', icon: '👗', bg: '#a855f7', C: Kabati },
  { id: 'mipangilio', name: 'Mipangilio', nameEn: 'Settings', icon: '⚙️', bg: '#6b7280', C: Mipangilio },
];
const byId = Object.fromEntries(APPS.map((a) => [a.id, a]));
byId.dm = { id: 'dm', name: 'Ujumbe', C: Dm, back: 'ujumbe' };

function useClock() {
  const [c, setC] = useState(gameClock());
  useEffect(() => {
    const t = setInterval(() => setC(gameClock()), 1000);
    return () => clearInterval(t);
  }, []);
  return `${String(c.hour).padStart(2, '0')}:${String(c.minute).padStart(2, '0')}`;
}

export function AppHead({ title, onBack, right }) {
  return (
    <div className="app-head">
      <button className="round" style={{ width: 36, height: 36, fontSize: 16 }} onClick={onBack} aria-label={L('Rudi', 'Back')}>‹</button>
      <h3>{title}</h3>
      {right}
    </div>
  );
}

export function Phone() {
  const phone = useStore((s) => s.phone);
  const arg = useStore((s) => s.phoneArg);
  const me = useStore((s) => s.me);
  const set = useStore((s) => s.set);
  const time = useClock();
  if (!phone) return null;
  const close = () => {
    sfx('close');
    set({ phone: null, phoneArg: null });
  };
  const app = byId[phone];
  const open = (id, a = null) => set({ phone: id, phoneArg: a });
  const back = () => open(app?.back || 'home');
  const days = L(['Jumapili', 'Jumatatu', 'Jumanne', 'Jumatano', 'Alhamisi', 'Ijumaa', 'Jumamosi'], ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']);
  const d = new Date();

  return (
    <div className="phone-wrap" onClick={close}>
      <div className="phone" onClick={(e) => e.stopPropagation()}>
        <div className="screen">
          <div className="notch" />
          {phone === 'home' || !app ? (
            <div className="home">
              <div className="status"><span>{time}</span><span>📶 Bongo 4G 🔋</span></div>
              <div className="home-time">{time}</div>
              <div className="home-date">{days[d.getDay()]}, Dar es Salaam</div>
              <div className="apps">
                {APPS.map((a) => (
                  <button key={a.id} className="app-ic" onClick={() => open(a.id)}>
                    <span className="ic" style={{ background: a.bg }}>
                      {a.icon}
                      {a.id === 'ujumbe' && me?.unread > 0 && <span className="badge">{me.unread}</span>}
                      {a.id === 'mali' && me?.pendingIncome > 0 && <span className="badge">$</span>}
                    </span>
                    {loc(a)}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="app-view">
              <div className="status"><span>{time}</span><span>📶 🔋</span></div>
              <app.C arg={arg} open={open} back={back} close={close} />
            </div>
          )}
        </div>
        <div className="home-ind">
          <button onClick={() => (phone === 'home' ? close() : open('home'))} aria-label="Home" />
        </div>
      </div>
    </div>
  );
}
