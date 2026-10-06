import { useStore } from './store.js';

export const LANGS = [
  { id: 'sw', label: 'Kiswahili', flag: '🇹🇿' },
  { id: 'en', label: 'English', flag: '🇬🇧' },
];

export const getLang = () => useStore.getState().lang;
export const isEn = () => getLang() === 'en';

/** Inline bilingual string: L('Karibu', 'Welcome'). */
export const L = (sw, en) => (isEn() ? en : sw);

/** Localised catalog field: loc(place) → place.nameEn in English. */
export const loc = (obj, key = 'name') => (obj ? (isEn() && obj[key + 'En']) || obj[key] : '');

/** Server payloads may carry [sw, en] pairs. */
export const pick = (v) => (Array.isArray(v) ? (isEn() ? v[1] : v[0]) : v);

/** Re-render on language change. */
export const useLang = () => useStore((s) => s.lang);
