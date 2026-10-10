import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store.js';
import { api, visitorId } from '../api.js';
import { Logo } from './Logo.jsx';
import { avatarEmoji } from '../three/Avatar.jsx';
import { L, pick } from '../i18n.js';
import { LangToggle } from './LangToggle.jsx';
import { Socials } from './Socials.jsx';

const k = (n) => (n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'k' : String(n ?? 0));

export default function Landing() {
  const set = useStore((s) => s.set);
  const [stats, setStats] = useState(null);
  const video = useRef(null);

  useEffect(() => {
    const load = () => api(`/public/stats?v=${visitorId()}`).then(setStats).catch(() => {});
    load();
    const t = setInterval(load, 20_000);
    return () => clearInterval(t);
  }, []);
  // The city flyover loops behind the landing. React doesn't reliably set the muted attribute that
  // iOS needs for autoplay, so mute in code and retry when visible / on the first tap.
  useEffect(() => {
    const v = video.current;
    if (!v || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    v.muted = true;
    const play = () => v.play().catch(() => {});
    play();
    const vis = () => !document.hidden && play();
    document.addEventListener('visibilitychange', vis);
    window.addEventListener('pointerdown', play, { once: true });
    return () => {
      document.removeEventListener('visibilitychange', vis);
      window.removeEventListener('pointerdown', play);
    };
  }, []);
  // Both start in the creator: sign-up designs the Mbongo first, log-in pops up over it.
  const go = (tab) => set({ screen: 'creator', me: null, loginOpen: tab === 'login' });
  const faces = stats?.faces?.length ? stats.faces : [{ body: 'woman', skin: 1 }, { body: 'man', skin: 0 }, { body: 'woman', skin: 3 }, { body: 'man', skin: 2 }];

  return (
    <div className="app">
      <video ref={video} className="land-video" autoPlay muted loop playsInline preload="auto" poster="/landing-hero.jpg" aria-hidden="true" tabIndex={-1}>
        <source src="/landing-hero-1080.mp4" type="video/mp4" media="(min-width: 900px), (min-resolution: 2dppx)" />
        <source src="/landing-hero-720.mp4" type="video/mp4" />
      </video>
      <div className="layer">
        <div className="land-top">
          <div className="land-bar">
            <Logo size={22} />
            <div className="row" style={{ gap: 4 }}>
              <LangToggle />
              <button className="btn btn-green btn-sm" onClick={() => go('signup')}>{L('Jisajili', 'Sign up')}</button>
              <button className="btn btn-sm" style={{ padding: '9px 10px' }} onClick={() => go('login')}>{L('Ingia', 'Log in')}</button>
            </div>
          </div>
          <div className="land-pills">
            <span className="pill"><span className="dot" /> {k(stats?.online)} {L('online sasa', 'online now')}</span>
            <span className="pill">👀 {k(stats?.visits)} visits</span>
          </div>
          <div className="land-pills">
            <span className="pill">🏛️ {L('Mkuu wa Mkoa', 'Mayor')} {stats?.mayor ? `@${stats.mayor.username}` : L('— bado wazi!', '— still open!')}</span>
            <span className="pill">🌊 {L('Viwanja vya Baharini', 'Sea Plots')}</span>
            <span className="pill">🏘️ {stats?.homes ?? 0} {L('nyumba', 'homes')}</span>
          </div>
          {stats?.event && <div className="banner">{L(stats.event.text, stats.event.textEn || stats.event.text)}</div>}
          {stats?.announcement && <div className="announce">📣 {L(stats.announcement.text, stats.announcement.textEn)}</div>}
          {stats?.maintenance && <div className="announce">🔧 {L('Tuko kwenye matengenezo — tutarudi hivi punde.', 'Under maintenance — back shortly.')}</div>}
        </div>
        <span className="coming" style={{ left: 12, top: '46%' }}>✈️ JNIA · {L('Ruka hadi Zanzibar', 'Fly to Zanzibar')}</span>
        <div className="land-bottom card">
          <div className="row" style={{ marginBottom: 12 }}>
            <div className="faces">
              {faces.slice(0, 4).map((f, i) => <span key={i} className="face" style={{ background: ['#fde68a', '#bbf7d0', '#bfdbfe', '#fecaca'][i] }}>{avatarEmoji(f)}</span>)}
            </div>
            <div className="small"><b>{k(stats?.players)} {L('Wabongo', 'Players')}</b> <span className="muted">{L('wameshajiunga · bure', 'joined · free')}</span></div>
          </div>
          <div className="row">
            <button className="btn btn-green grow" onClick={() => go('signup')}>{L('Jisajili bure', 'Sign up free')}</button>
            <button className="btn btn-white" onClick={() => go('login')}>{L('Ingia', 'Log in')}</button>
          </div>
          <Socials compact />
          <div className="land-legal">
            <a href="/terms">{L('Masharti', 'Terms')}</a>
            <a href="/privacy">{L('Faragha', 'Privacy')}</a>
            <a href="/ads-policy">{L('Sera ya Matangazo', 'Ad Policy')}</a>
          </div>
        </div>
      </div>
    </div>
  );
}
