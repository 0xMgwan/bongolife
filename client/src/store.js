import { create } from 'zustand';
import { api, token } from './api.js';
import { sfx } from './audio.js';

let toastId = 0;

export const useStore = create((set, get) => ({
  screen: 'loading', // loading | landing | auth | creator | game | legal
  authTab: 'signup',
  me: null,
  world: { plots: {}, businesses: {}, event: null },
  ads: [],
  online: 0,
  roster: 0, // bumps when remote players join/leave
  sheet: null, // { type: 'place'|'plot'|'player'|'ad', id }
  phone: null, // null | 'home' | app id
  phoneArg: null,
  result: null,
  toasts: [],
  chatOpen: false,
  lang: (() => {
    // ?lang=en|sw (e.g. from the landing page) wins and is remembered.
    const q = new URLSearchParams(location.search).get('lang');
    if (q === 'sw' || q === 'en') {
      try { localStorage.setItem('bl_lang', q); } catch {}
      return q;
    }
    try {
      const saved = localStorage.getItem('bl_lang');
      if (saved) return saved;
    } catch {}
    return /^sw/i.test(navigator.language || '') ? 'sw' : 'en';
  })(),
  announcement: null,
  inside: null, // venue the player is inside (placeId) or null
  quality: (() => { try { return localStorage.getItem('bl_q') || 'auto'; } catch { return 'auto'; } })(),
  dmVersion: 0,
  publicFeed: [],

  set: (patch) => set(patch),
  setMe: (me) => set({ me }),
  setLang: (lang) => {
    try { localStorage.setItem('bl_lang', lang); } catch {}
    document.documentElement.lang = lang;
    set({ lang });
  },
  toast: (text, kind) => {
    if (Array.isArray(text)) text = get().lang === 'en' ? text[1] : text[0];
    if (kind === 'err') sfx('error');
    const id = ++toastId;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, text, kind }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3300);
  },
  openPhone: (app = 'home', arg = null) => {
    if (!get().phone) sfx('open');
    set({ phone: app, phoneArg: arg, sheet: null });
  },
  refreshMe: async () => {
    const me = await api('/me');
    set({ me });
    return me;
  },
  logout: () => {
    token.set(null);
    location.reload();
  },
  setQuality: (q) => {
    try { localStorage.setItem('bl_q', q); } catch {}
    set({ quality: q });
  },
  // Run an API call and handle errors/me-refresh uniformly.
  run: async (path, opts) => {
    try {
      const r = await api(path, opts);
      if (r.me) set({ me: r.me });
      if (/^\/(shop|plots|business|ads$)/.test(path) || /\/build$/.test(path)) sfx('cash');
      else if (path === '/income/collect') sfx('coin');
      else if (path === '/vehicle/use' && opts?.body?.vehicleId) sfx('horn');
      return r;
    } catch (e) {
      get().toast(e.message, 'err');
      return null;
    }
  },
}));
