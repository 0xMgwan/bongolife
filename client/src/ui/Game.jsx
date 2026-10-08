import { useCallback, useEffect, useRef } from 'react';
import { plotById, placeById } from '@shared/world.js';
import { activeScene } from '../scene.js';
import GameScene from '../three/GameScene.jsx';
import { walkTo, goToPlace } from '../nav.js';
import { L, loc } from '../i18n.js';
import { useStore } from '../store.js';
import { api, visitorId } from '../api.js';
import { connect, local, input, setInside, enterHome, leaveHome, jump } from '../net.js';
import { SocialModals } from './Social.jsx';
import { InstallBanner } from './InstallApp.jsx';
import { PresenceAlerts } from './LiveNow.jsx';
import { DmPop } from './DmPop.jsx';
import { InteractAsk, SelfieCard } from './Together.jsx';
import { readDeepLink } from './share.js';
import { loadEvents } from './events.js';
import { sfx } from '../audio.js';
import { HUD } from './HUD.jsx';
import { Sheets } from './Sheets.jsx';
import { Phone } from './Phone.jsx';
import { HomeUI, loadHome } from './HomeUI.jsx';

export default function Game() {
  const me = useStore((s) => s.me);
  const world = useStore((s) => s.world);
  const ads = useStore((s) => s.ads);
  const quality = useStore((s) => s.quality);
  const inside = useStore((s) => s.inside);
  const tab = useStore((s) => s.tab);
  const cityView = useStore((s) => s.cityView);
  const set = useStore((s) => s.set);
  const finishing = useRef(false);

  useEffect(() => {
    connect();
    api('/world').then((w) => set({ world: { plots: w.plots, businesses: w.businesses, event: w.event, mayor: w.mayor }, ads: w.ads, announcement: w.announcement })).catch(() => {});
    const stats = () => api(`/public/stats?v=${visitorId()}`).then((s) => set({ visits: s.visits, online: s.online })).catch(() => {});
    stats();
    loadEvents();
    const statsTimer = setInterval(() => { stats(); loadEvents(); }, 60_000);
    api('/messages/public').then((rows) => set({ publicFeed: rows.map((r) => ({ ...r, mid: r.id, text: r.body, at: r.created_at })) })).catch(() => {});
    return () => clearInterval(statsTimer);
  }, [set]);

  // Kwangu/Duka put you at home (others stop seeing you in town); Mjini brings you back.
  // At home you join that home's live room so hosts and guests see each other.
  const visitingId = useStore((s) => s.visiting?.host.id);
  useEffect(() => {
    const home = tab === 'home' || tab === 'shop';
    const st = useStore.getState();
    if (home) {
      if (st.inside !== 'home') setInside('home');
      if (!visitingId) loadHome();
      const host = visitingId || st.me?.id;
      if (host && st.homeHost !== host) {
        useStore.setState({ homeHost: host });
        enterHome(host).then((r) => {
          if (r.error === 'not_invited') {
            useStore.getState().toast(L('Mwaliko umeisha muda.', 'That invite has expired.'), 'err');
            useStore.setState({ visiting: null });
          }
        });
      }
    } else {
      if (st.inside === 'home') setInside(null);
      if (st.homeHost) {
        useStore.setState({ homeHost: null, visiting: null });
        leaveHome();
      }
    }
  }, [tab, visitingId]);

  // Keyboard movement for desktop.
  useEffect(() => {
    const typing = (e) => /input|textarea|select/i.test(e.target.tagName);
    const down = (e) => {
      if (typing(e)) return;
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
        input.keys.add(k);
        e.preventDefault();
      }
      if (k === ' ') { jump(); e.preventDefault(); }
      if (k === 'enter') set({ chatOpen: true });
      if (k === 'p') set({ phone: useStore.getState().phone ? null : 'home' });
    };
    const up = (e) => input.keys.delete(e.key.toLowerCase());
    const blur = () => input.keys.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, [set]);

  // Auto-finish timed activities/shifts.
  useEffect(() => {
    if (!me?.busy) return;
    const ms = Math.max(0, me.busy.endsAt - Date.now()) + 300;
    const t = setTimeout(async () => {
      if (finishing.current) return;
      finishing.current = true;
      try {
        const r = await api('/act/finish', { method: 'POST' });
        set({ me: r.me, result: r.result });
        const promoted = r.result.lines?.some((l) => String(Array.isArray(l) ? l[1] : l).startsWith('🎉 Promoted'));
        sfx(promoted ? 'levelup' : r.result.kind === 'job' ? 'coin' : 'pop');
        if (r.result.teleport) {
          local.x = r.result.teleport[0];
          local.z = r.result.teleport[1];
          local.target = null;
          local.teleported++;
        }
      } catch (e) {
        if (e.code !== 'too_early') useStore.getState().toast(e.message, 'err');
        useStore.getState().refreshMe().catch(() => {});
      } finally {
        finishing.current = false;
      }
    }, ms);
    return () => clearTimeout(t);
  }, [me?.busy?.endsAt, set]); // eslint-disable-line react-hooks/exhaustive-deps

  const inScene = () => !!useStore.getState().inside || !!activeScene(useStore.getState());
  const onPlace = useCallback((id) => {
    // On the map: pop up the place card with ways to get there.
    if (useStore.getState().cityView === 'map') return useStore.setState({ sheet: { type: 'travel', id } });
    if (inScene()) return;
    goToPlace(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Shared links: ?place=… opens that place's card, ?u=… a profile, ?event=… the Events app.
  useEffect(() => {
    const link = readDeepLink();
    const t = setTimeout(() => {
      if (link.place && placeById[link.place]) set({ sheet: { type: 'travel', id: link.place } });
      else if (link.user) set({ sheet: { type: 'player', id: link.user } });
      else if (link.event) useStore.getState().openPhone('matukio');
    }, 1200);
    return () => clearTimeout(t);
  }, [set]);
  const onPlot = useCallback((id) => {
    if (inScene()) return;
    const p = plotById[id];
    walkTo([p.pos[0], p.pos[1] + p.size / 2 + 1.5], () => useStore.setState({ sheet: { type: "plot", id } }), loc(p));
  }, []);
  const onBillboard = useCallback((id) => useStore.setState({ sheet: { type: 'ad', id } }), []);
  const onGround = useCallback((pt) => {
    if (inScene()) return;
    local.target = pt;
    local.arrive = null;
  }, []);
  const onPlayer = useCallback((r) => useStore.setState({ sheet: { type: 'player', id: r.username } }), []);

  if (!me) return null;
  const homeTab = tab === 'home' || tab === 'shop';
  // The map always shows the city, even if you're inside somewhere.
  const scene = homeTab || cityView === 'map' ? null : activeScene({ me, inside });
  const mode = homeTab ? 'home' : cityView === 'map' ? 'map' : 'play';
  return (
    <div className="app">
      <GameScene mode={mode} me={me} world={world} ads={ads} quality={quality} scene={scene} onPlace={onPlace} onPlot={onPlot} onBillboard={onBillboard} onGround={onGround} onPlayer={onPlayer} />
      <HUD />
      <HomeUI />
      <Sheets />
      <Phone />
      <SocialModals />
      <PresenceAlerts />
      <DmPop />
      <InteractAsk />
      <SelfieCard />
      <InstallBanner />
    </div>
  );
}

