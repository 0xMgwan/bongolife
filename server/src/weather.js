// Live weather: each city's real current weather (Open-Meteo), refreshed every 10 minutes and pushed
// to everyone. The game draws it (rain, storms, grey skies) and rain puts surge pay on taxi/delivery runs.
import { weather } from './live.js';
import { CITIES } from '../../shared/world.js';

export const current = {}; // city → { temp, code, emoji, text, isDay }
export const isRaining = (city) => { const c = current[city]?.code ?? 0; return (c >= 51 && c <= 67) || (c >= 80 && c <= 82) || c >= 95; };
export const RAIN_SURGE = 1.3;

export function startWeather(onChange) {
  const refresh = async () => {
    let changed = false;
    for (const c of CITIES) {
      try {
        const w = await weather(c.id);
        const prev = current[c.id];
        if (!prev || prev.code !== w.code || prev.temp !== w.temp) changed = true;
        current[c.id] = { temp: w.temp, code: w.code, emoji: w.emoji, text: w.text, isDay: w.isDay };
      } catch { /* keep the last known */ }
    }
    if (changed) onChange?.(current);
  };
  refresh();
  setInterval(refresh, 10 * 60_000).unref?.();
}
