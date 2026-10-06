import { lazy, Suspense, useEffect } from 'react';
import { useStore } from './store.js';
import { api, token } from './api.js';
import { L } from './i18n.js';
import { Logo } from './ui/Logo.jsx';
import { Toasts } from './ui/Toasts.jsx';
import Auth from './ui/Auth.jsx';
import Legal from './ui/Legal.jsx';

const Landing = lazy(() => import('./ui/Landing.jsx'));
const Creator = lazy(() => import('./ui/Creator.jsx'));
const Game = lazy(() => import('./ui/Game.jsx'));
const Admin = lazy(() => import('./admin/Admin.jsx'));

function Loading() {
  return (
    <div className="loading">
      <div className="center">
        <Logo size={30} />
        <div className="muted small" style={{ marginTop: 10 }}>{L('Inapakia mtaa…', 'Loading the city…')}</div>
      </div>
    </div>
  );
}

export default function App() {
  const screen = useStore((s) => s.screen);
  const lang = useStore((s) => s.lang);
  const set = useStore((s) => s.set);

  useEffect(() => {
    document.documentElement.lang = lang;
    if (!location.pathname.startsWith('/admin')) document.title = lang === 'en' ? 'Bongo Life — Life in Dar es Salaam' : 'Bongo Life — Maisha ya Dar es Salaam';
  }, [lang]);

  useEffect(() => {
    const path = location.pathname;
    if (path === '/terms' || path === '/privacy') return set({ screen: 'legal' });
    if (path.startsWith('/admin')) return set({ screen: 'admin' });
    if (!token.get()) return set({ screen: 'landing' });
    api('/me')
      .then((me) => set({ me, screen: me.onboarded ? 'game' : 'creator' }))
      .catch((e) => {
        if (e.status === 401) token.set(null);
        set({ screen: 'landing' });
      });
  }, [set]);

  return (
    // Keyed by language so every screen (including 3D labels) re-renders in the new language.
    <div className="app" key={lang}>
      <Suspense fallback={<Loading />}>
        {screen === 'loading' && <Loading />}
        {screen === 'landing' && <Landing />}
        {screen === 'auth' && <Auth />}
        {screen === 'creator' && <Creator />}
        {screen === 'game' && <Game />}
        {screen === 'legal' && <Legal />}
        {screen === 'admin' && <Admin />}
      </Suspense>
      <Toasts />
    </div>
  );
}
