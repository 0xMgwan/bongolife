// Arriving in the game: a How-to-play guide for new players, then a spoken welcome
// (Swahili or English) with the city's real weather and what's new — and the radio comes on.
import { useEffect, useState } from 'react';
import { playVoiceClip } from '../audio.js';
import { cityAt } from '@shared/world.js';
import { useStore } from '../store.js';
import { api, token } from '../api.js';
import { L, isEn } from '../i18n.js';
import { playRadio, radioAutoOn, toggleRadio, nextStation } from '../radio.js';

const ls = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
const ss = { get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { sessionStorage.setItem(k, v); } catch {} } };
export const voiceOn = () => ls.get('bl_voice') !== '0';
export const setVoiceOn = (on) => ls.set('bl_voice', on ? '1' : '0');

// ---------------------------------------------------------------- how to play
const STEPS = [
  ['🌴', ['Karibu Bongo!', 'Welcome to Bongo!'], [
    ['Huu ni mchezo wa maisha: unaishi, unafanya kazi, unakula bata na kujenga jina lako — na watu halisi.', 'A life game: live, work, party and build your name — with real people.'],
    ['Mchezo unaenda kwa saa halisi ya Dar, na hali ya hewa ni ya kweli.', 'The game runs on real Dar time, with the real weather.'],
    ['Lengo lako ni ndoto uliyochagua. Ukiitimiza, unapata zawadi kubwa.', 'Your goal is the ambition you picked. Reach it for big rewards.'],
  ]],
  ['🚶🏾', ['Tembea & safiri', 'Walk & travel'], [
    ['Gusa ardhi kutembea, au tumia joystick / WASD.', 'Tap the ground to walk, or use the joystick / WASD.'],
    ['Panda daladala, bajaji, bodaboda — au endesha gari lako (🚗 Endesha).', 'Hop on a daladala, bajaji or boda — or drive your own car (🚗 Drive).'],
    ['Gundua (🧭) inaonyesha ramani. Safiri hadi Zanzibar na Arusha kwa boti au ndege.', 'Explore (🧭) shows the map. Travel to Zanzibar and Arusha by ferry or flight.'],
  ]],
  ['❤️', ['Mahitaji yako', 'Your needs'], [
    ['Njaa, Nguvu, Raha, Usafi na Jamii zinashuka taratibu.', 'Hunger, Energy, Fun, Hygiene and Social slowly drop.'],
    ['Zikiwa chini, mood inashuka — na mshahara pia. Kula, lala, oga, kula bata.', 'When they’re low your mood drops — and so does your pay. Eat, sleep, shower, have fun.'],
  ]],
  ['💼', ['Kazi & pesa', 'Work & money'], [
    ['Fungua Simu → Kazi. Piga shifti, pandishwa cheo, fikia kazi kubwa kama Hakimu au Daktari bingwa.', 'Open Phone → Jobs. Work shifts, get promoted, reach top careers like Magistrate or Surgeon.'],
    ['Ajira: makampuni ya wachezaji yanaajiri — omba kazi au ajiri watu kwenye kampuni yako.', 'Hiring: player companies are recruiting — apply, or hire people for your own company.'],
  ]],
  ['📱', ['Simu yako', 'Your phone'], [
    ['Chat, Penzi, Kampuni, Wekeza, Polisi, Mahakama, Redio na zaidi — vyote vipo kwenye simu.', 'Chat, Dating, Company, Invest, Police, Court, Radio and more — all in your phone.'],
    ['Washa arifa ili usikose meseji, mauzo na ajira.', 'Turn on notifications so you don’t miss messages, sales and jobs.'],
  ]],
  ['🚪', ['Ingia ndani', 'Go inside'], [
    ['Gusa jengo lenye alama kuona shughuli zake, kisha 🚪 Ingia.', 'Tap a building with an icon to see what you can do, then 🚪 Go inside.'],
    ['Ndani unaweza kutembea na kugusa duara za dhahabu: cheza muziki, agiza kinywaji, patana bei…', 'Inside you can walk around and tap the gold rings: dance, grab a drink, haggle…'],
  ]],
  ['👑', ['Kuwa mkubwa', 'Make it big'], [
    ['Nunua viwanja, jenga, anzisha kampuni na upande ngazi kutoka Manzese hadi Masaki.', 'Buy land, build, start a company and climb from Manzese to Masaki.'],
    ['Gombea Umeya kila wiki. Bahati njema mtaani! 🇹🇿', 'Run for Mayor every week. Good luck out there! 🇹🇿'],
  ]],
];

export function HowToPlay({ onClose }) {
  const [i, setI] = useState(0);
  const [emoji, title, lines] = STEPS[i];
  const last = i === STEPS.length - 1;
  return (
    <div className="sheet-wrap" onClick={onClose}>
      <div className="sheet htp" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2><span>❓</span>{L('Jinsi ya kucheza', 'How to play')}</h2>
          <button className="x" onClick={onClose} aria-label={L('Funga', 'Close')}>✕</button>
        </div>
        <div className="htp-bar">{STEPS.map((_, k) => <i key={k} className={k <= i ? 'on' : ''} />)}</div>
        <div className="sheet-body">
          <div className="htp-card">
            <div className="htp-title"><span>{emoji}</span> {L(...title)}</div>
            <ul>{lines.map((l) => <li key={l[1]}>{L(...l)}</li>)}</ul>
          </div>
          <div className="row between" style={{ marginTop: 14 }}>
            <button className="btn btn-ghost btn-sm" disabled={i === 0} onClick={() => setI(i - 1)}>← {L('Nyuma', 'Back')}</button>
            <span className="small muted">{i + 1} / {STEPS.length}</span>
            <button className="btn btn-green btn-sm" onClick={() => (last ? onClose() : setI(i + 1))}>{last ? L('Tuanze! 🚀', "Let's go! 🚀") : `${L('Endelea', 'Next')} →`}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- spoken welcome
function voices() {
  return new Promise((resolve) => {
    const v = speechSynthesis.getVoices();
    if (v.length) return resolve(v);
    const t = setTimeout(() => resolve(speechSynthesis.getVoices()), 1200);
    speechSynthesis.onvoiceschanged = () => { clearTimeout(t); resolve(speechSynthesis.getVoices()); };
  });
}
/** Speak in Swahili when the device has a Swahili voice, otherwise in English. */
async function speak({ sw, en }) {
  if (typeof speechSynthesis === 'undefined') return;
  const all = await voices();
  const swVoice = all.find((v) => /^sw/i.test(v.lang));
  const useSw = !isEn() && swVoice;
  const enVoice = all.find((v) => /^en[-_](GB|KE|ZA|NG|TZ)/i.test(v.lang)) || all.find((v) => /^en/i.test(v.lang));
  const u = new SpeechSynthesisUtterance(useSw ? sw : en);
  u.voice = useSw ? swVoice : enVoice || null;
  u.lang = useSw ? swVoice.lang : enVoice?.lang || 'en-GB';
  u.rate = 1;
  u.pitch = 1.05;
  speechSynthesis.cancel();
  await new Promise((resolve) => {
    u.onend = resolve;
    u.onerror = resolve;
    setTimeout(resolve, 20_000);
    speechSynthesis.speak(u);
  });
}

/** The welcome read by a real-sounding Tanzanian voice from our server; false if it isn't set up. */
async function naturalVoice(city, returning) {
  try {
    const lang = isEn() ? 'en' : 'sw';
    const r = await fetch(`/api/voice/welcome?lang=${lang}&city=${city}&returning=${returning ? 1 : 0}`, { headers: { authorization: `Bearer ${token.get()}` } });
    // 404 = no voice provider set up: use the device voice. Any other failure = the provider is
    // set up but errored — stay quiet rather than fall back to the robotic voice.
    if (r.status === 404) return false;
    if (!r.ok) { console.warn('[voice] welcome failed', r.status, await r.text().catch(() => '')); return true; }
    await playVoiceClip(await r.arrayBuffer());
    return true;
  } catch (e) {
    console.warn('[voice] welcome playback', e?.message);
    return true;
  }
}

function script(me, w, news, returning) {
  const first = String(me.name || me.username).split(' ')[0];
  const sw = `${returning ? 'Karibu tena' : 'Karibu'} Bongo, ${first}! Leo ${w.name} kuna ${w.text[0].toLowerCase()}, nyuzi ${w.temp}. ${news ? `Habari mpya: ${news.title}. ` : ''}Furahia mtaa — redio inaanza sasa.`;
  const en = `${returning ? 'Welcome back' : 'Welcome'} to Bongo, ${first}! Today in ${w.name} it's ${w.text[1].toLowerCase()}, ${w.temp} degrees. ${news ? `What's new: ${news.titleEn || news.title}. ` : ''}Enjoy the streets — the radio's coming on now.`;
  return { sw, en };
}

// The welcome runs once per session and lives in the store, so re-mounting the HUD can't lose it.
let started = false;
const setW = (patch) => useStore.setState((s) => ({ welcome: { ...(s.welcome || {}), ...patch } }));
async function greet(me, returning) {
  const city = cityAt(me.x, me.z)?.id || 'dar';
  const [w, n] = await Promise.all([api(`/weather?city=${city}`).catch(() => null), api('/news').catch(() => ({}))]);
  // Only mention news from the last 2 weeks.
  const news = n?.latest && Date.now() - n.latest.at < 14 * 86_400_000 ? n.latest : null;
  if (!w) return;
  const text = script(me, w, news, returning);
  setW({ card: { w, news, first: String(me.name || me.username).split(' ')[0] } });
  const go = async () => {
    setW({ needTap: false });
    if (voiceOn()) await (await naturalVoice(city, returning)) || (await speak(text));
    if (radioAutoOn()) playRadio();
  };
  // Browsers only allow sound after the player has touched the page.
  if (navigator.userActivation?.hasBeenActive ?? false) go();
  else {
    setW({ needTap: true });
    const once = () => { window.removeEventListener('pointerdown', once, true); go(); };
    window.addEventListener('pointerdown', once, true);
  }
  setTimeout(() => setW({ card: null }), 18_000);
}
// Settings → How to play reopens the guide.
if (typeof window !== 'undefined') window.addEventListener('bl:howto', () => setW({ guide: true }));

export function WelcomeFlow() {
  const me = useStore((s) => s.me);
  const wel = useStore((s) => s.welcome) || {};
  useEffect(() => {
    if (!me || started || ss.get('bl_welcomed')) return;
    started = true;
    ss.set('bl_welcomed', '1');
    if (!ls.get(`bl_guide_${me.id}`)) setW({ guide: true });
    else greet(me, true);
  }, [me?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const closeGuide = () => {
    setW({ guide: false });
    if (me && !ls.get(`bl_guide_${me.id}`)) { ls.set(`bl_guide_${me.id}`, '1'); greet(me, false); }
  };
  const card = wel.card;
  return (
    <>
      {wel.guide && <HowToPlay onClose={closeGuide} />}
      {card && (
        <div className="welcome-card card" onClick={() => setW({ card: null })}>
          <div className="wc-top">
            <b>👋 Karibu, {card.first}!</b>
            <span className="wc-w">{card.w.emoji} {card.w.temp}° · {L(card.w.text[0], card.w.text[1])}, {card.w.name}</span>
          </div>
          {card.news && <div className="wc-news">🆕 {L(card.news.title, card.news.titleEn || card.news.title)}</div>}
          {wel.needTap && <div className="wc-tap">🔊 {L('Gusa popote kusikiliza na kuwasha redio', 'Tap anywhere to hear it and start the radio')}</div>}
        </div>
      )}
    </>
  );
}

/** Small now-playing pill while the radio is on. */
export function RadioPill() {
  const radio = useStore((s) => s.radio);
  const openPhone = useStore((s) => s.openPhone);
  if (!radio || !(radio.playing || radio.loading) || !radio.current) return null;
  return (
    <div className="radio-pill">
      <button className="rp-name" onClick={() => openPhone('redio')}>📻 {radio.loading ? L('Inaunganisha…', 'Tuning in…') : radio.current.name}</button>
      <button onClick={() => nextStation(1)} aria-label="Next">⏭</button>
      <button onClick={() => toggleRadio()} aria-label="Stop">⏹</button>
    </div>
  );
}
