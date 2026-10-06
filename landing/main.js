// Bongo Life landing page — language switch, live stats and links into the game.
const GAME_URL = 'https://bongolife-production.up.railway.app';

// ---------------------------------------------------------------- language
const params = new URLSearchParams(location.search);
function initialLang() {
  const q = params.get('lang');
  if (q === 'sw' || q === 'en') return q;
  try {
    const saved = localStorage.getItem('bl_lang');
    if (saved) return saved;
  } catch {}
  return /^sw/i.test(navigator.language || '') ? 'sw' : 'en';
}
let lang = initialLang();

const META = {
  sw: {
    title: 'Bongo Life — Ishi maisha yako ya Dar es Salaam',
    desc: 'Mchezo wa maisha ya Dar es Salaam kwenye simu yako. Fanya kazi, kula bata, endesha bodaboda, nunua kiwanja Kigamboni na chat na watu halisi. Bure — hakuna kudownload.',
  },
  en: {
    title: 'Bongo Life — Live your Dar es Salaam life',
    desc: 'A Dar es Salaam life-sim on your phone. Work, party, ride a bodaboda, buy a plot in Kigamboni and chat with real people. Free — no download.',
  },
};

function applyLang() {
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-sw]').forEach((el) => {
    const text = el.dataset[lang];
    if (text == null) return;
    if (el.hasAttribute('data-html')) el.innerHTML = text;
    else el.textContent = text;
  });
  document.title = META[lang].title;
  document.querySelector('meta[name="description"]').setAttribute('content', META[lang].desc);
  document.getElementById('lang').textContent = lang === 'en' ? '🇹🇿 SW' : '🇬🇧 EN';
  updateLinks();
  renderEvent();
}

document.getElementById('lang').addEventListener('click', () => {
  lang = lang === 'en' ? 'sw' : 'en';
  try { localStorage.setItem('bl_lang', lang); } catch {}
  applyLang();
});

// ------------------------------------------------------------------ links
function updateLinks() {
  // Carry the chosen language and campaign tags (utm_*) into the game.
  const out = new URLSearchParams({ lang });
  for (const [k, v] of params) if (k.startsWith('utm_')) out.set(k, v);
  if (!out.has('utm_source')) out.set('utm_source', 'landing');
  document.querySelectorAll('.play').forEach((a) => (a.href = `${GAME_URL}/?${out}`));
  document.querySelectorAll('.legal').forEach((a) => (a.href = `${GAME_URL}${a.dataset.path}`));
  document.getElementById('ads-policy').href = `${GAME_URL}/ads-policy`;
}

// ------------------------------------------------------------------ stats
let event = null;
function renderEvent() {
  const el = document.getElementById('s-event');
  if (!event) return;
  el.textContent = (lang === 'en' && event.textEn) || event.text;
  el.hidden = false;
}
const fmt = (n) => (n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'k' : String(n || 0));

async function loadStats() {
  try {
    const r = await fetch(`${GAME_URL}/api/public/stats`, { signal: AbortSignal.timeout?.(6000) });
    if (!r.ok) return;
    const s = await r.json();
    document.getElementById('s-online').textContent = fmt(s.online);
    document.getElementById('s-players').textContent = fmt(s.players);
    if (s.mayor) {
      document.getElementById('s-mayor').textContent = `@${s.mayor.username}`;
      document.getElementById('s-mayor-wrap').hidden = false;
    }
    document.getElementById('stats').hidden = false;
    event = s.event || null;
    renderEvent();
  } catch {
    // Stats are decorative; the page works without them.
  }
}

document.getElementById('year').textContent = new Date().getFullYear();
applyLang();
loadStats();
setInterval(loadStats, 30_000);
