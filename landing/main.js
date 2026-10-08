// Bongo Life landing page — language switch, live stats and links into the game.
const GAME_URL = 'https://play.bongolife.app';

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
  // Carry the chosen language, campaign tags (utm_*) and invite code (ref) into the game.
  const out = new URLSearchParams({ lang });
  for (const [k, v] of params) if (k.startsWith('utm_') || k === 'ref' || k === 'place') out.set(k, v);
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

// Live counts: tick from the shown value to the new one; a change after the first load bumps the pill.
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
function countTo(el, to) {
  to = Number(to) || 0;
  const from = el.dataset.v == null ? 0 : Number(el.dataset.v);
  const first = el.dataset.v == null;
  el.dataset.v = to;
  if (calm || from === to) return void (el.textContent = fmt(to));
  if (!first) {
    const pill = el.closest('.pill');
    pill.classList.remove('bump');
    void pill.offsetWidth;
    pill.classList.add('bump');
  }
  const start = performance.now();
  const dur = first ? 1400 : 700;
  const step = (t) => {
    const k = Math.min(1, (t - start) / dur);
    el.textContent = fmt(Math.round(from + (to - from) * (1 - (1 - k) ** 3)));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

async function loadStats() {
  try {
    const r = await fetch(`${GAME_URL}/api/public/stats`, { signal: AbortSignal.timeout?.(6000) });
    if (!r.ok) return;
    const s = await r.json();
    countTo(document.getElementById('s-online'), s.online);
    countTo(document.getElementById('s-players'), s.players);
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
// Refresh while the page is open; skip while it's in a background tab.
setInterval(() => !document.hidden && loadStats(), 15_000);
document.addEventListener('visibilitychange', () => !document.hidden && loadStats());

// ---------------------------------------------------------------- hero video
// Muted autoplay can still be refused (Low Power Mode, a tab opened in the background):
// retry when the page becomes visible and on the first tap.
const heroVideo = document.querySelector('.hero-video');
if (heroVideo && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const play = () => heroVideo.play().catch(() => {});
  play();
  document.addEventListener('visibilitychange', () => !document.hidden && play());
  window.addEventListener('pointerdown', play, { once: true });
}
