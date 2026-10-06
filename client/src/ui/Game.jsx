import { useCallback, useEffect, useRef } from 'react';
import { plotById } from '@shared/world.js';
import GameScene from '../three/GameScene.jsx';
import { walkTo, goToPlace } from '../nav.js';
import { loc } from '../i18n.js';
import { useStore } from '../store.js';
import { api } from '../api.js';
import { connect, local, input } from '../net.js';
import { HUD } from './HUD.jsx';
import { Sheets } from './Sheets.jsx';
import { Phone } from './Phone.jsx';

export default function Game() {
  const me = useStore((s) => s.me);
  const world = useStore((s) => s.world);
  const ads = useStore((s) => s.ads);
  const quality = useStore((s) => s.quality);
  const set = useStore((s) => s.set);
  const finishing = useRef(false);

  useEffect(() => {
    connect();
    api('/world').then((w) => set({ world: { plots: w.plots, businesses: w.businesses, event: w.event }, ads: w.ads, announcement: w.announcement })).catch(() => {});
    api('/messages/public').then((rows) => set({ publicFeed: rows.map((r) => ({ ...r, mid: r.id, text: r.body, at: r.created_at })) })).catch(() => {});
  }, [set]);

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

  const onPlace = useCallback((id) => goToPlace(id), []);
  const onPlot = useCallback((id) => {
    const p = plotById[id];
    walkTo([p.pos[0], p.pos[1] + p.size / 2 + 1.5], () => useStore.setState({ sheet: { type: "plot", id } }), loc(p));
  }, []);
  const onBillboard = useCallback((id) => useStore.setState({ sheet: { type: 'ad', id } }), []);
  const onGround = useCallback((pt) => {
    local.target = pt;
    local.arrive = null;
  }, []);
  const onPlayer = useCallback((r) => useStore.setState({ sheet: { type: 'player', id: r.username } }), []);

  if (!me) return null;
  return (
    <div className="app">
      <GameScene mode="play" me={me} world={world} ads={ads} quality={quality} onPlace={onPlace} onPlot={onPlot} onBillboard={onBillboard} onGround={onGround} onPlayer={onPlayer} />
      <HUD />
      <Sheets />
      <Phone />
    </div>
  );
}

