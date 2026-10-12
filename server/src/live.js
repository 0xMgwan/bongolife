// Live outside data for the game: real weather per city (Open-Meteo, no key) and the list of
// Tanzanian radio streams (radio-browser.info directory), both cached in memory.
const CITY_COORDS = { dar: [-6.79, 39.28, 'Dar es Salaam'], znz: [-6.16, 39.19, 'Zanzibar'], aru: [-3.37, 36.68, 'Arusha'] };
// WMO weather codes → [emoji, sw, en]
const WMO = [
  [[0], '☀️', 'Jua kali', 'Sunny'], [[1], '🌤️', 'Jua na mawingu kidogo', 'Mostly sunny'], [[2], '⛅', 'Mawingu kiasi', 'Partly cloudy'],
  [[3], '☁️', 'Mawingu', 'Cloudy'], [[45, 48], '🌫️', 'Ukungu', 'Foggy'], [[51, 53, 55, 56, 57], '🌦️', 'Manyunyu', 'Drizzle'],
  [[61, 63, 66, 80, 81], '🌧️', 'Mvua', 'Rain'], [[65, 67, 82], '🌧️', 'Mvua kubwa', 'Heavy rain'], [[95, 96, 99], '⛈️', 'Radi na mvua', 'Thunderstorms'],
];
const weatherCache = new Map();
export async function weather(city = 'dar') {
  const c = CITY_COORDS[city] || CITY_COORDS.dar;
  const hit = weatherCache.get(city);
  if (hit && Date.now() - hit.at < 15 * 60_000) return hit.data;
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${c[0]}&longitude=${c[1]}&current=temperature_2m,weather_code,is_day&timezone=Africa/Dar_es_Salaam`, { signal: AbortSignal.timeout(6000) });
    const j = await r.json();
    const code = j.current?.weather_code ?? 1;
    const w = WMO.find(([cs]) => cs.includes(code)) || WMO[1];
    const data = { city, name: c[2], temp: Math.round(j.current?.temperature_2m ?? 29), code, isDay: !!j.current?.is_day, emoji: w[1], text: [w[2], w[3]] };
    weatherCache.set(city, { at: Date.now(), data });
    return data;
  } catch {
    return hit?.data || { city, name: c[2], temp: 29, code: 1, isDay: true, emoji: '🌤️', text: ['Jua na mawingu kidogo', 'Mostly sunny'] };
  }
}

// Known-good HTTPS streams, used if the directory is unreachable.
const FALLBACK = [
  { name: 'East Africa Radio', city: 'Dar es Salaam', tag: ['Muziki na burudani', 'Music and entertainment'], url: 'https://eatv.radioca.st/stream' },
  { name: 'Radio One Stereo', city: 'Dar es Salaam', tag: ['Habari na muziki', 'News and music'], url: 'https://radioonetanzania.radioca.st/stream' },
  { name: 'Capital Radio', city: 'Dar es Salaam', tag: ['Muziki na habari', 'Music and news'], url: 'https://capitalradio.radioca.st/stream' },
  { name: 'Crown FM', city: 'Dar es Salaam', tag: ['Bongo Flava na burudani', 'Bongo Flava and entertainment'], url: 'https://radio.crownmedia.co.tz:8443/crown' },
  { name: 'Nuru FM', city: 'Iringa', tag: ['Habari na muziki', 'News and music'], url: 'https://radiotadio.co.tz/nuru-fm-stream' },
  { name: 'Radio Kwizera', city: 'Ngara, Kagera', tag: ['Redio ya jamii', 'Community radio'], url: 'https://uk4-vn.mixstream.net/:8052/;listen.mp3' },
  { name: 'Radio Uhai', city: 'Tabora', tag: ['Injili', 'Gospel'], url: 'https://s2.citrus3.com:8050/stream' },
];
let radioCache = null;
/** The station list, with the admin-chosen default station first (when it has a stream link). */
export async function radioStations(def) {
  const list = await directory();
  if (!def?.url) return list;
  return [{ ...def, isDefault: true }, ...list.filter((s) => s.url !== def.url)];
}
async function directory() {
  if (radioCache && Date.now() - radioCache.at < 6 * 3600_000) return radioCache.list;
  try {
    const r = await fetch('https://de1.api.radio-browser.info/json/stations/bycountrycodeexact/TZ?hidebroken=true&order=clickcount&reverse=true&limit=80', { headers: { 'User-Agent': 'BongoLife/1.0 (+https://www.bongolife.app)' }, signal: AbortSignal.timeout(8000) });
    const rows = await r.json();
    const key = (n) => n.toLowerCase().replace(/\b(fm|radio|stereo)\b/g, '').replace(/[^a-z0-9]/g, '');
    const seen = new Set(FALLBACK.map((s) => key(s.name)));
    const urls = new Set(FALLBACK.map((s) => s.url));
    const extra = [];
    for (const s of rows) {
      let url = String(s.url_resolved || '');
      if (url.startsWith('http://stream.zeno.fm/')) url = url.replace('http://', 'https://');
      const name = String(s.name || '').trim();
      // Browsers block http streams on an https page; skip video/playlist streams too.
      if (!url.startsWith('https://') || /\.m3u8|\.pls/.test(url) || !name || seen.has(key(name)) || urls.has(url) || s.lastcheckok !== 1) continue;
      seen.add(key(name));
      urls.add(url);
      extra.push({ name, city: s.state || 'Tanzania', tag: [String(s.tags || 'Redio').split(',')[0] || 'Redio', String(s.tags || 'Radio').split(',')[0] || 'Radio'], url });
    }
    const list = [...FALLBACK, ...extra].slice(0, 24);
    radioCache = { at: Date.now(), list };
    return list;
  } catch {
    return radioCache?.list || FALLBACK;
  }
}

// ------------------------------------------------------------------ welcome voice
// Natural Tanzanian voices from Azure Speech (free tier: 0.5M characters/month):
//   AZURE_SPEECH_KEY, AZURE_SPEECH_REGION (e.g. westeurope). Optional AZURE_VOICE_SW / AZURE_VOICE_EN.
// Without a key the client falls back to the device's own voice.
export const voiceReady = () => !!(process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION);
const VOICE = { sw: () => process.env.AZURE_VOICE_SW || 'sw-TZ-RehemaNeural', en: () => process.env.AZURE_VOICE_EN || 'en-TZ-ImaniNeural' };
const xml = (s) => String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));

export function welcomeText({ name, w, news, returning, lang }) {
  const first = String(name || '').split(' ')[0] || 'Mbongo';
  if (lang === 'en') return `${returning ? 'Welcome back' : 'Welcome'} to Bongo, ${first}! Today in ${w.name} it's ${w.text[1].toLowerCase()}, ${w.temp} degrees. ${news ? `What's new: ${news.titleEn || news.title}. ` : ''}Enjoy the streets — the radio's coming on now.`;
  return `${returning ? 'Karibu tena' : 'Karibu'} Bongo, ${first}! Leo ${w.name} kuna ${w.text[0].toLowerCase()}, nyuzi ${w.temp}. ${news ? `Habari mpya: ${news.title}. ` : ''}Furahia mtaa — redio inaanza sasa.`;
}

const ttsCache = new Map(); // text -> Buffer (small LRU)
export async function speak(text, lang) {
  if (ttsCache.has(text)) return ttsCache.get(text);
  const voice = VOICE[lang === 'en' ? 'en' : 'sw']();
  const locale = voice.split('-').slice(0, 2).join('-');
  const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="${locale}"><voice name="${voice}"><mstts:express-as style="cheerful"><prosody rate="-4%">${xml(text)}</prosody></mstts:express-as></voice></speak>`;
  const r = await fetch(`https://${process.env.AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: 'POST',
    headers: { 'Ocp-Apim-Subscription-Key': process.env.AZURE_SPEECH_KEY, 'Content-Type': 'application/ssml+xml', 'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3', 'User-Agent': 'BongoLife' },
    body: ssml,
    signal: AbortSignal.timeout(10_000),
  });
  if (!r.ok) throw new Error(`tts ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  ttsCache.set(text, buf);
  if (ttsCache.size > 200) ttsCache.delete(ttsCache.keys().next().value);
  return buf;
}
