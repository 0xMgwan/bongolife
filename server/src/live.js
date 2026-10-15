// Live outside data for the game: real weather per city (Open-Meteo, no key) and the list of
// Tanzanian radio streams (radio-browser.info directory), both cached in memory.
const CITY_COORDS = { dar: [-6.79, 39.28, 'Dar es Salaam'], znz: [-6.16, 39.19, 'Zanzibar'], aru: [-3.37, 36.68, 'Arusha'], pwa: [-6.44, 38.9, 'Bagamoyo'] };
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
  return [{ ...def, tag: Array.isArray(def.tag) ? def.tag : ['Kituo chetu', 'Our station'], isDefault: true }, ...list.filter((s) => s.url !== def.url)];
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
// A natural voice reads the welcome. Providers (first one configured wins):
//   ElevenLabs — ELEVENLABS_API_KEY (+ ELEVENLABS_VOICE_ID, ELEVENLABS_MODEL_SW / _EN)
//   Azure      — AZURE_SPEECH_KEY + AZURE_SPEECH_REGION
// The welcome is spoken in short phrases ('Karibu Bongo!', the weather, the news, the sign-off);
// each phrase is generated once and kept on disk, so repeat welcomes cost nothing.
// Without a provider the app uses the device's own voice.
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { DATA_DIR } from './db.js';

const provider = () => (process.env.ELEVENLABS_API_KEY ? 'eleven' : process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION ? 'azure' : null);
export const voiceReady = () => !!provider();
export const voiceLog = { ok: null, error: null };
/** For the admin panel: which provider, and a fresh test phrase (bypasses the cache). */
export async function voiceTest(text = 'Karibu Bongo! Hii ni sauti ya majaribio.') {
  const p = provider();
  const info = { provider: p, voiceId: process.env.ELEVENLABS_VOICE_ID ? `${process.env.ELEVENLABS_VOICE_ID.slice(0, 4)}…` : p === 'eleven' ? 'default (Sarah)' : null, last: voiceLog };
  if (!p) return { ...info, ok: false, error: 'No ELEVENLABS_API_KEY (or Azure keys) set on the server.' };
  try {
    const buf = p === 'eleven' ? await eleven(text, 'sw') : await azure(text, 'sw');
    return { ...info, ok: true, bytes: buf.length, audio: buf.toString('base64') };
  } catch (e) {
    return { ...info, ok: false, error: e.message };
  }
}
/** Generate the shared welcome phrases ahead of time so the first welcome plays instantly. */
export async function warmVoice() {
  if (!provider()) return;
  const lines = ['Karibu Bongo!', 'Karibu tena Bongo!', 'Furahia mtaa. Redio inaanza sasa.', 'Welcome to Bongo!', 'Welcome back to Bongo!', "Enjoy the streets. The radio's coming on now."];
  for (const t of lines) await phrase(t, /[a-z]+ to Bongo|Enjoy/.test(t) ? 'en' : 'sw').catch(() => {});
}
const xml = (s) => String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));

/** The welcome as separate phrases (no names, so phrases are shared by everyone and cached). */
export function welcomePhrases({ w, news, returning, lang }) {
  if (lang === 'en') return [returning ? 'Welcome back to Bongo!' : 'Welcome to Bongo!', `Today in ${w.name} it's ${w.text[1].toLowerCase()}, ${w.temp} degrees.`, news ? `What's new: ${news.titleEn || news.title}.` : null, "Enjoy the streets. The radio's coming on now."].filter(Boolean);
  return [returning ? 'Karibu tena Bongo!' : 'Karibu Bongo!', `Leo ${w.name} kuna ${w.text[0].toLowerCase()}, nyuzi ${w.temp}.`, news ? `Habari mpya: ${news.title}.` : null, 'Furahia mtaa. Redio inaanza sasa.'].filter(Boolean);
}

async function eleven(text, lang) {
  const voice = process.env.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL';
  const models = lang === 'en' ? [process.env.ELEVENLABS_MODEL_EN || 'eleven_multilingual_v2'] : [process.env.ELEVENLABS_MODEL_SW || 'eleven_v3', 'eleven_multilingual_v2'];
  let last = null;
  for (const model of models) {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_64`, {
      method: 'POST',
      headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY, 'content-type': 'application/json', accept: 'audio/mpeg' },
      body: JSON.stringify({ text, model_id: model, voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.35, use_speaker_boost: true } }),
      signal: AbortSignal.timeout(20_000),
    });
    if (r.ok) { voiceLog.ok = { at: Date.now(), model }; return Buffer.from(await r.arrayBuffer()); }
    last = `${r.status} ${(await r.text().catch(() => '')).slice(0, 300)}`;
    voiceLog.error = { at: Date.now(), model, text: last };
    console.error('[voice] elevenlabs', model, last);
  }
  throw new Error(`elevenlabs ${last}`);
}
async function azure(text, lang) {
  const voice = lang === 'en' ? process.env.AZURE_VOICE_EN || 'en-TZ-ImaniNeural' : process.env.AZURE_VOICE_SW || 'sw-TZ-RehemaNeural';
  const locale = voice.split('-').slice(0, 2).join('-');
  const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${locale}"><voice name="${voice}"><prosody rate="-4%">${xml(text)}</prosody></voice></speak>`;
  const r = await fetch(`https://${process.env.AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: 'POST',
    headers: { 'Ocp-Apim-Subscription-Key': process.env.AZURE_SPEECH_KEY, 'Content-Type': 'application/ssml+xml', 'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3', 'User-Agent': 'BongoLife' },
    body: ssml,
    signal: AbortSignal.timeout(10_000),
  });
  if (!r.ok) throw new Error(`azure ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

const VOICE_DIR = path.join(DATA_DIR, 'voice');
const pending = new Map();
/** One phrase as MP3, from the disk cache or freshly generated. */
export async function phrase(text, lang) {
  const p = provider();
  const id = crypto.createHash('sha1').update([p, process.env.ELEVENLABS_VOICE_ID || '', process.env.ELEVENLABS_MODEL_SW || '', lang, text].join('|')).digest('hex');
  const file = path.join(VOICE_DIR, `${id}.mp3`);
  try { return await fsp.readFile(file); } catch {}
  if (pending.has(id)) return pending.get(id);
  const job = (async () => {
    const buf = p === 'eleven' ? await eleven(text, lang) : await azure(text, lang);
    await fsp.mkdir(VOICE_DIR, { recursive: true });
    await fsp.writeFile(file, buf);
    return buf;
  })().finally(() => pending.delete(id));
  pending.set(id, job);
  return job;
}
/** The whole welcome: phrases joined into one MP3 (same format, so frames concatenate cleanly). */
export async function welcomeAudio(opts) {
  const parts = await Promise.all(welcomePhrases(opts).map((t) => phrase(t, opts.lang)));
  return Buffer.concat(parts);
}
