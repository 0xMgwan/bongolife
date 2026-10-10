// Bongo Life landing page — language, theme, live stats and the interactive sections.
// Nothing typed on this page leaves the browser: the quiz, votes and billboard preview are local only.
const GAME_URL = 'https://play.bongolife.app';
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
const tsh = (n) => 'TSh ' + Math.round(n).toLocaleString('en-US');
const short = (n) => (n >= 1e9 ? +(n / 1e9).toFixed(1) + 'B' : n >= 1e6 ? +(n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? +(n / 1e3).toFixed(0) + 'k' : String(n));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
};

// ---------------------------------------------------------------- language
const params = new URLSearchParams(location.search);
function initialLang() {
  const q = params.get('lang');
  if (q === 'sw' || q === 'en') return q;
  const saved = store.get('bl_lang');
  if (saved === 'sw' || saved === 'en') return saved;
  return /^sw/i.test(navigator.language || '') ? 'sw' : 'en';
}
let lang = initialLang();
const T = (sw, en) => (lang === 'en' ? en : sw);

const META = {
  sw: { title: 'Bongo Life — Metaverse ya Tanzania | Bongo Game ya Maisha ya Dar (Bure)', desc: 'Bongo Life ni metaverse ya Tanzania — game ya maisha ya Dar es Salaam, Zanzibar na Arusha kwenye simu yako. Fanya kazi, anzisha kampuni, kula bata 1245, tafuta penzi na chat na watu halisi. Bure.' },
  en: { title: "Bongo Life — Tanzania's Metaverse | The Dar es Salaam Life Game (Free)", desc: "Bongo Life is Tanzania's metaverse — a free life game set in Dar es Salaam, Zanzibar and Arusha. Work, start a company, party at 1245, find love and chat with real people." },
};

const rerenders = [];
function applyLang() {
  document.documentElement.lang = lang;
  $$('[data-sw]').forEach((el) => {
    const text = el.dataset[lang];
    if (text == null) return;
    if (el.hasAttribute('data-html')) el.innerHTML = text;
    else el.textContent = text;
  });
  document.title = META[lang].title;
  $('meta[name="description"]').setAttribute('content', META[lang].desc);
  $('#lang').textContent = lang === 'en' ? '🇹🇿 SW' : '🇬🇧 EN';
  updateLinks();
  rerenders.forEach((f) => f());
}
$('#lang').addEventListener('click', () => {
  lang = lang === 'en' ? 'sw' : 'en';
  store.set('bl_lang', lang);
  applyLang();
});

// ------------------------------------------------------------------ theme
const darkNow = () => (document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')) === 'dark';
const themeIcon = () => ($('#theme').textContent = darkNow() ? '☀️' : '🌙');
$('#theme').addEventListener('click', () => {
  const next = darkNow() ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  store.set('bl_theme', next);
  themeIcon();
});
themeIcon();

// ------------------------------------------------------------------ links
function updateLinks() {
  // Carry the chosen language, campaign tags (utm_*) and invite code (ref) into the game.
  const out = new URLSearchParams({ lang });
  for (const [k, v] of params) if (k.startsWith('utm_') || k === 'ref' || k === 'place') out.set(k, v);
  if (!out.has('utm_source')) out.set('utm_source', 'landing');
  $$('.play').forEach((a) => (a.href = `${GAME_URL}/?${out}`));
  $$('.legal').forEach((a) => (a.href = `${GAME_URL}${a.dataset.path}`));
  $('#ads-policy').href = `${GAME_URL}/ads-policy`;
}

// ------------------------------------------------------------ reveal + route
const io = new IntersectionObserver((entries) => entries.forEach((e) => e.isIntersecting && (e.target.classList.add('in'), io.unobserve(e.target))), { threshold: 0.12 });
$$('.reveal').forEach((el) => io.observe(el));

const stops = $$('[data-stop]');
const stopDots = stops.map(() => document.createElement('i'));
$('#route-stops').append(...stopDots);
function layoutStops() {
  const max = document.documentElement.scrollHeight - innerHeight;
  stops.forEach((s, i) => (stopDots[i].style.left = `${Math.min(100, (Math.max(0, s.offsetTop - 120) / max) * 100)}%`));
}
function onScroll() {
  const max = document.documentElement.scrollHeight - innerHeight;
  const p = Math.min(1, scrollY / Math.max(1, max));
  const line = $('.route-line').offsetWidth;
  $('#route-fill').style.width = `${p * 100}%`;
  $('#route-bus').style.left = `${p * line}px`;
  let cur = 0;
  stops.forEach((s, i) => { if (s.offsetTop - innerHeight * 0.45 <= scrollY) cur = i; stopDots[i].classList.toggle('done', i <= cur); });
  const st = stops[cur];
  $('#route-label').textContent = lang === 'en' ? st.dataset.stopEn : st.dataset.stop;
  const inAds = st.id === 'brands';
  $$('.seg button').forEach((b) => b.classList.toggle('on', (b.dataset.mode === 'ads') === inAds));
}
addEventListener('scroll', onScroll, { passive: true });
addEventListener('resize', () => { layoutStops(); onScroll(); });
addEventListener('load', () => { layoutStops(); onScroll(); });
rerenders.push(onScroll);
$$('.seg button').forEach((b) => b.addEventListener('click', () => {
  $(b.dataset.mode === 'ads' ? '#brands' : '#luku').scrollIntoView({ behavior: calm ? 'auto' : 'smooth' });
}));

// ------------------------------------------------------------------ hero
$$('[data-callout]').forEach((c) => c.addEventListener('click', () => {
  const was = c.classList.contains('open');
  $$('[data-callout]').forEach((x) => x.classList.remove('open'));
  if (!was) c.classList.add('open');
}));

const heroVideo = $('.hero-video');
if (heroVideo && !calm) {
  // Muted autoplay can still be refused (Low Power Mode, a background tab): retry on visibility and the first tap.
  const play = () => heroVideo.play().catch(() => {});
  play();
  document.addEventListener('visibilitychange', () => !document.hidden && play());
  addEventListener('pointerdown', play, { once: true });
}

// ------------------------------------------------------------------ stats
let liveEvent = null;
let mayor = null;
function renderEvent() {
  const el = $('#s-event');
  if (!liveEvent) return;
  el.textContent = (lang === 'en' && liveEvent.textEn) || liveEvent.text;
  el.hidden = false;
}
rerenders.push(renderEvent);
const fmt = (n) => (n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'k' : String(n || 0));
function countTo(el, to) {
  to = Number(to) || 0;
  const first = el.dataset.v == null;
  const from = first ? 0 : Number(el.dataset.v);
  el.dataset.v = to;
  if (calm || from === to) return void (el.textContent = fmt(to));
  if (!first) { const s = el.closest('.stat'); s.classList.remove('bump'); void s.offsetWidth; s.classList.add('bump'); }
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
    countTo($('#s-online'), s.online);
    countTo($('#s-players'), s.players);
    countTo($('#s-plots'), s.plotsSold);
    $('#admit-no').textContent = String((s.players || 0) + 1).padStart(6, '0');
    mayor = s.mayor || null;
    if (mayor) $('#p-mayor').textContent = `@${mayor.username}`;
    liveEvent = s.event || null;
    renderEvent();
  } catch {
    // Stats are decorative; the page works without them.
  }
}

// --------------------------------------------------------------- clocks
const darTime = () => new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Dar_es_Salaam', hour: '2-digit', minute: '2-digit' }).format(new Date());
// Weekly election closes Monday 00:00 Dar time (mirrors electionEnds() in shared/world.js).
const WEEK_MS = 7 * 86_400_000;
const WEEK_OFF = 3 * 3_600_000 + 3 * 86_400_000;
function tickClocks() {
  const t = darTime();
  $('#clock').textContent = t;
  $('#board-clock').textContent = t;
  const now = Date.now();
  const ends = (Math.floor((now + WEEK_OFF) / WEEK_MS) + 1) * WEEK_MS - WEEK_OFF;
  let s = Math.max(0, Math.floor((ends - now) / 1000));
  const d = Math.floor(s / 86400); s %= 86400;
  const h = Math.floor(s / 3600); s %= 3600;
  const m = Math.floor(s / 60); s %= 60;
  $('#cd').textContent = `${d} ${T('siku', d === 1 ? 'day' : 'days')} · ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
setInterval(tickClocks, 1000);

// ================================================================ LUKU quiz
const QUESTIONS = [
  { q: ['Asubuhi unakunywa nini?', 'What is your morning drink?'], o: [['☕', 'Chai ya rangi na maandazi', 'Black tea and maandazi', -2], ['🥤', 'Energy drink ya kibandani', 'An energy drink from the kiosk', 0], ['🧋', 'Cappuccino Slipway', 'A cappuccino at Slipway', 2]] },
  { q: ['Unaendaje kazini?', 'How do you get to work?'], o: [['🚌', 'Daladala — nimebanwa mlangoni', 'Daladala, squeezed by the door', -2], ['🏍️', 'Bodaboda, foleni haitunihusu', 'Bodaboda, traffic is not my problem', 0], ['🚙', 'V8 yangu na dereva', 'My V8, with a driver', 2]] },
  { q: ['Weekend yako iko wapi?', 'Where is your weekend?'], o: [['🔊', 'Singeli Mbagala mpaka asubuhi', 'Singeli in Mbagala till sunrise', -2], ['🍖', 'Nyama choma Ubungo na washkaji', 'Nyama choma in Ubungo with the crew', 0], ['🥂', 'Brunch Masaki, kisha 1245 VIP', 'Brunch in Masaki, then VIP at 1245', 2]] },
  { q: ['Umeme ukikatika…', 'When the power goes out…'], o: [['🕯️', 'Nawasha kibatari, maisha yanaendelea', 'I light a lamp, life goes on', -2], ['🔢', 'Nanunua LUKU haraka kwa M-Pesa', 'I buy LUKU on M-Pesa, quick', 0], ['🔋', 'Generator inawaka yenyewe', 'The generator kicks in by itself', 2]] },
  { q: ['Simu yako ni ipi?', 'What phone do you carry?'], o: [['📟', 'Kitochi — betri wiki nzima', 'A kitochi, battery lasts all week', -2], ['📱', 'Tecno au Infinix', 'A Tecno or an Infinix', 0], ['🍏', 'iPhone mpya kabisa', 'The newest iPhone', 2]] },
  { q: ['Ndoto yako kubwa?', 'Your big dream?'], o: [['🧺', 'Kibanda changu Kariakoo', 'My own stall in Kariakoo', -2], ['🏢', 'Kampuni yangu Posta', 'My own company in Posta', 0], ['🏝️', 'Villa Masaki na boti Zanzibar', 'A Masaki villa and a boat in Zanzibar', 2]] },
];
const VERDICTS = [
  { min: -12, title: ['USWAZI HALISI', 'TRUE USWAZI'], mtaa: 'Manzese', job: ['Machinga Kariakoo', 'Kariakoo hawker'], ndoto: ['Kibanda → Duka → Kampuni', 'Stall → Shop → Company'], line: ['Umezaliwa mtaani. Hakuna kinachokushtua.', 'Born on the street. Nothing scares you.'] },
  { min: -5, title: ['USWAZI WA KISASA', 'SMART USWAZI'], mtaa: 'Sinza', job: ['Konda wa daladala', 'Daladala conductor'], ndoto: ['Daladala yako mwenyewe', 'Your own daladala'], line: ['Mjanja wa mjini. Unajua kila njia ya mkato.', 'Street smart. You know every shortcut.'] },
  { min: 0, title: ['MIDDLE CLASS YA BONGO', 'BONGO MIDDLE CLASS'], mtaa: 'Mlimani', job: ['Teller wa benki', 'Bank teller'], ndoto: ['Nyumba ya kisasa Mbezi', 'A modern house in Mbezi'], line: ['Kazi ya ofisi, bata la weekend.', 'Office job, weekend bata.'] },
  { min: 6, title: ['USHUANI', 'USHUANI'], mtaa: 'Masaki', job: ['Developer Posta', 'Developer in Posta'], ndoto: ['Hoteli ya ufukweni', 'A beach hotel'], line: ['Umezaliwa na kijiko cha dhahabu. Tutaona kama unaweza kuchakarika.', "Born with a gold spoon. Let's see if you can hustle."] },
];
const quiz = { step: -1, name: '', answers: [], token: '' };
const score = () => quiz.answers.reduce((a, b) => a + b, 0);
const verdict = () => [...VERDICTS].reverse().find((v) => score() >= v.min);

function renderMeter() {
  const s = score();
  $('#ms-units').textContent = (50 + s * 4).toFixed(1);
  $('#ms-needle').style.left = `${((s + 12) / 24) * 100}%`;
  $('#ms-q').textContent = `${quiz.answers.length}/6`;
  $('#ms-name').textContent = `${T('MTEJA', 'CUSTOMER')}: ${(quiz.name || '—').toUpperCase().slice(0, 14)}`;
  const tk = quiz.token.padEnd(12, '_');
  $('#ms-token').textContent = `TOKEN: ${tk.slice(0, 4)} ${tk.slice(4, 8)} ${tk.slice(8, 12)}`;
  $('#print').disabled = quiz.answers.length < QUESTIONS.length;
}
function renderQuiz() {
  const el = $('#quiz');
  if (quiz.step === -1) {
    el.innerHTML = `<div class="qn">${T('HATUA YA KWANZA', 'STEP ONE')}</div><h3>${T('Jina lako mtaani?', 'Your street name?')}</h3>
      <form class="name-in" id="name-form"><input id="name-in" maxlength="20" autocomplete="off" placeholder="${T('mf. Juma Kibanda', 'e.g. Juma Kibanda')}" value="${esc(quiz.name)}" />
      <button class="btn btn-gold" type="submit">${T('Anza →', 'Start →')}</button></form>
      <p class="sub" style="font-size:14px">${T('Jina linabaki kwenye browser yako tu.', 'Your name stays in your browser only.')}</p>`;
    $('#name-form').addEventListener('submit', (e) => {
      e.preventDefault();
      quiz.name = $('#name-in').value.trim() || T('Mbongo', 'Mbongo');
      quiz.step = 0;
      renderQuiz();
    });
  } else if (quiz.step < QUESTIONS.length) {
    const q = QUESTIONS[quiz.step];
    el.innerHTML = `<div class="qn">${T('SWALI', 'QUESTION')} ${quiz.step + 1} / 6 · ${T('au bonyeza 1-3 kwenye mita', 'or press 1-3 on the meter')}</div>
      <div class="qbar"><i style="width:${(quiz.step / 6) * 100}%"></i></div>
      <h3>${q.q[lang === 'en' ? 1 : 0]}</h3>
      <div class="opts">${q.o.map((o, i) => `<button class="opt" data-i="${i}"><span class="oe">${o[0]}</span>${T(o[1], o[2])}</button>`).join('')}</div>
      <button class="qback" id="q-back">← ${T('Rudi', 'Back')}</button>`;
    $$('.opt', el).forEach((b) => b.addEventListener('click', () => answer(+b.dataset.i)));
    $('#q-back').addEventListener('click', () => { quiz.step--; quiz.answers.pop(); renderQuiz(); renderMeter(); });
  } else {
    const v = verdict();
    el.innerHTML = `<div class="qn">${T('MATOKEO', 'RESULT')}</div><div class="qbar"><i style="width:100%"></i></div>
      <div class="verdict">${T(...v.title)}</div>
      <p class="sub">${esc(quiz.name)} — ${T(...v.line)}</p>
      <p class="sub" style="font-size:15px">👉 ${T('Bonyeza <b>PRINT</b> kwenye mita upate tiketi yako.', 'Hit <b>PRINT</b> on the meter for your ticket.')}</p>
      <button class="qback" id="q-again">↺ ${T('Anza upya', 'Start again')}</button>`;
    $('#q-again').addEventListener('click', () => { quiz.step = -1; quiz.answers = []; $('#ticket').hidden = true; renderQuiz(); renderMeter(); });
  }
}
function answer(i) {
  if (quiz.step < 0 || quiz.step >= QUESTIONS.length) return;
  quiz.answers.push(QUESTIONS[quiz.step].o[i][3]);
  quiz.step++;
  blink();
  renderQuiz();
  renderMeter();
}
function blink() { const l = $('#led'); l.classList.remove('blink'); void l.offsetWidth; l.classList.add('blink'); }
$('#keypad').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  const k = b.dataset.k || b.textContent;
  if (quiz.step >= 0 && quiz.step < QUESTIONS.length && ['1', '2', '3'].includes(k)) return answer(+k - 1);
  if (k === 'del') quiz.token = quiz.token.slice(0, -1);
  else if (k === 'ok') { if (!$('#print').disabled) printTicket(); else blink(); }
  else if (quiz.token.length < 12) quiz.token += k;
  blink();
  renderMeter();
});
function printTicket() {
  const v = verdict();
  const no = String(Math.floor(Math.random() * 900000) + 100000);
  const t = $('#ticket');
  t.hidden = false;
  t.innerHTML = `<div style="text-align:center;font-size:11px">TANESCO × BONGO LIFE · Nº ${no}</div>
    <h4>${T('TIKETI YA KUZALIWA', 'BIRTH TICKET')}</h4>
    <div class="t-row"><span>${T('JINA', 'NAME')}</span><b>${esc(quiz.name.toUpperCase())}</b></div>
    <div class="t-row"><span>${T('UMEZALIWA', 'BORN')}</span><b>${T(...v.title)}</b></div>
    <div class="t-row"><span>${T('MTAA', 'HOOD')}</span><b>${v.mtaa}</b></div>
    <div class="t-row"><span>${T('KAZI YA KWANZA', 'FIRST JOB')}</span><b>${T(...v.job)}</b></div>
    <div class="t-row"><span>${T('NDOTO', 'DREAM')}</span><b>${T(...v.ndoto)}</b></div>
    <div class="t-row"><span>${T('MFUKONI', 'POCKET')}</span><b>TSh 50,000 + IST</b></div>
    <div class="barcode"></div>
    <div class="t-cta"><a class="btn btn-gold play" href="#">${T('Ingia mtaani →', 'Hit the streets →')}</a><button class="btn btn-line" id="share">${T('Shiriki', 'Share')} ↗</button></div>`;
  updateLinks();
  $('#share').addEventListener('click', async () => {
    const text = T(`Nimezaliwa ${T(...v.title)} kwenye Bongo Life 🇹🇿 Wewe je?`, `I was born ${T(...v.title)} in Bongo Life 🇹🇿 What about you?`);
    const url = 'https://www.bongolife.app/#luku';
    try {
      if (navigator.share) await navigator.share({ title: 'Bongo Life', text, url });
      else { await navigator.clipboard.writeText(`${text} ${url}`); $('#share').textContent = T('Imenakiliwa ✓', 'Copied ✓'); }
    } catch {}
  });
  if (!calm) t.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
$('#print').addEventListener('click', printTicket);
rerenders.push(() => { renderQuiz(); renderMeter(); if (!$('#ticket').hidden) printTicket(); });

// ================================================================ spots + jobs (from shared/world.js → places.json)
const AREA_COLORS = { kariakoo: '#f5b800', masaki: '#5fb3ff', sinza: '#ff7aa8', temeke: '#7ed6a8', znz: '#2dd4bf', aru: '#ff9f1c' };
let AREAS = [];
let JOBS = [];
function renderAreas() {
  const open = new Set($$('.area.open').map((a) => a.dataset.id));
  $('#areas').innerHTML = AREAS.map((a) => `
    <div class="area${open.has(a.id) ? ' open' : ''}" data-id="${a.id}" style="--c:${AREA_COLORS[a.id]}">
      <button class="area-btn" aria-expanded="${open.has(a.id)}"><span class="area-name">${esc(T(a.sw, a.en))}</span><span class="area-meta">${a.places.length} ${T('sehemu', 'places')}</span><span class="area-plus">+</span></button>
      <div class="area-body"><div><div class="spot-grid">${a.places.map((p) => `
        <div class="spot"><div class="spot-top"><span class="spot-ic">${p.i}</span><div><b>${esc(T(p.n, p.ne))}</b><small>${esc(p.d)}</small></div></div>
        <p>${esc(T(p.b, p.be))}</p>${p.job ? `<span class="job">💼 ${esc(T(p.job.t, p.job.te))} · ${short(p.job.pay)}/${T('shifti', 'shift')}</span>` : ''}</div>`).join('')}
      </div></div></div>
    </div>`).join('');
  $$('.area-btn').forEach((b) => b.addEventListener('click', () => {
    const a = b.closest('.area');
    a.classList.toggle('open');
    b.setAttribute('aria-expanded', a.classList.contains('open'));
    setTimeout(layoutStops, 500);
  }));
}
function renderMarquee() {
  const names = AREAS.flatMap((a) => a.places.map((p) => `${p.i} ${T(p.n, p.ne)}`));
  const html = names.map((n) => `<span>${esc(n)}</span>`).join('');
  $('#marquee').innerHTML = html + html.replace(/<span>/g, '<span aria-hidden="true">');
}

// ---------------------------------------------------------------- ladder
const FLOORS = [
  { ic: '🛏️', n: ['Chumba cha kupanga', 'Rented room'], d: 'Manzese', price: 0 },
  { ic: '🏠', n: ['Nyumba ya kawaida', 'Simple house'], d: 'Temeke', price: 6_000_000 },
  { ic: '🏡', n: ['Nyumba ya kisasa', 'Modern house'], d: 'Mbezi', price: 28_000_000 },
  { ic: '🏢', n: ['Ghorofa la kupangisha', 'Apartment block'], d: ['Posta · +320k/saa', 'Posta · +320k/hr'], price: 85_000_000 },
  { ic: '🏰', n: ['Villa ya kifahari', 'Luxury villa'], d: 'Masaki', price: 160_000_000 },
  { ic: '🏨', n: ['Hoteli ya ufukweni', 'Beach hotel'], d: 'Kigamboni', price: 320_000_000 },
];
let goal = 4;
let jobIdx = 0;
const dur = (secs) => {
  const h = secs / 3600;
  return h >= 1 ? `${h.toFixed(h >= 10 ? 0 : 1)} ${T('saa', 'hrs')}` : `${Math.round(secs / 60)} ${T('dk', 'min')}`;
};
function renderLadder(dx = 0) {
  $('#tower').innerHTML = FLOORS.map((f, i) => `
    <button class="floor${i === goal ? ' goal' : ''}${i < goal ? ' reached' : ''}" data-i="${i}">
      <span class="fl-n">${i}</span><span class="fl-ic">${f.ic}</span>
      <span class="fl-name">${T(...f.n)}<small>${Array.isArray(f.d) ? T(...f.d) : f.d}</small></span>
      <span class="fl-price">${f.price ? short(f.price) : T('START', 'START')}</span>
      ${i === goal ? '<span class="me">🧍🏾</span>' : ''}
    </button>`).join('');
  $$('.floor').forEach((b) => b.addEventListener('click', () => { goal = +b.dataset.i; renderLadder(); }));
  if (!JOBS.length) return;
  const j = JOBS[jobIdx];
  $('#jc-idx').textContent = `${jobIdx + 1}/${JOBS.length}`;
  const jobEl = $('#jc-job');
  jobEl.innerHTML = `<span class="ji">${j.i}</span><b>${esc(T(j.t, j.te))}</b><small>${esc(j.place)} · ${tsh(j.pay)} / ${T('shifti', 'shift')} · ${Math.round(j.secs / 60)} ${T('dk', 'min')}</small>`;
  if (dx && !calm) { jobEl.style.setProperty('--dx', `${dx * 24}px`); jobEl.classList.remove('swap'); void jobEl.offsetWidth; jobEl.classList.add('swap'); }
  const f = FLOORS[goal];
  const need = Math.max(0, f.price - 50_000);
  const shifts = Math.ceil(need / j.pay);
  const best = JOBS[JOBS.length - 1];
  $('#calc').innerHTML = goal === 0
    ? `<div class="big">0 <small>${T('shifti', 'shifts')}</small></div><p>${T('Hapa ndipo kila mtu anaanzia — chumba ni bure. Chagua ghorofa juu zaidi.', 'This is where everyone starts — the room is free. Pick a higher floor.')}</p>`
    : `<div class="big">${shifts.toLocaleString('en-US')} <small>${T('shifti', 'shifts')}</small></div>
       <p>${T(`kama <b>${esc(j.t)}</b> mpaka ${esc(T(...f.n)).toLowerCase()} (${tsh(f.price)}) — takriban ${dur(shifts * j.secs)} za kuchakarika.`, `as a <b>${esc(j.te)}</b> to a ${esc(T(...f.n)).toLowerCase()} (${tsh(f.price)}) — about ${dur(shifts * j.secs)} of hustle.`)}</p>
       <div class="prog"><i style="width:${Math.min(100, (j.pay / best.pay) * 100)}%"></i></div>
       <p style="font-size:12.5px">${T('Mshahara ukilinganisha na kazi inayolipa zaidi. Vyeo, bonus na biashara vinakupandisha haraka.', 'Pay compared with the best-paid job. Promotions, bonuses and businesses get you there faster.')}</p>`;
  const b = Math.ceil(1e9 / j.pay);
  $('#billion').innerHTML = `<div class="big">${b.toLocaleString('en-US')}</div><p>${T(`shifti za ${esc(j.t)} mpaka <b>TSh 1 BILIONI</b>. Au… anzisha kampuni. 😏`, `${esc(j.te)} shifts to <b>TSh 1 BILLION</b>. Or… start a company. 😏`)}</p>`;
}
$('#jc-prev').addEventListener('click', () => { jobIdx = (jobIdx - 1 + JOBS.length) % JOBS.length; renderLadder(-1); });
$('#jc-next').addEventListener('click', () => { jobIdx = (jobIdx + 1) % JOBS.length; renderLadder(1); });
rerenders.push(() => renderLadder());

// ================================================================ phone
const APPS = [
  { id: 'pesa', ic: '💰', c: '#16a34a', n: ['Bongo Pesa', 'Bongo Pesa'], note: ['Pochi yako', 'Your wallet'], d: ['Mshahara, malipo, kutuma pesa kwa mshkaji na kuongeza salio kwa M-Pesa, Mixx au Airtel Money.', 'Wages, payments, sending money to a friend and topping up with M-Pesa, Mixx or Airtel Money.'] },
  { id: 'chat', ic: '💬', c: '#22c55e', n: ['Chat', 'Chat'], note: ['Washkaji halisi', 'Real people'], d: ['Chat ya mtaa, DM, makundi, voice notes, reactions, swipe to reply na @mentions.', 'Street chat, DMs, groups, voice notes, reactions, swipe to reply and @mentions.'] },
  { id: 'penzi', ic: '💞', c: '#ec4899', n: ['Penzi', 'Penzi'], note: ['Tafuta penzi', 'Find love'], d: ['Swipe, tuma ombi, nendeni date, chumbieni, fungeni ndoa.', 'Swipe, send a request, go on dates, get engaged, get married.'] },
  { id: 'kampuni', ic: '🏢', c: '#0ea5e9', n: ['Kampuni', 'Company'], note: ['Anzisha kampuni', 'Start a company'], d: ['Sajili kampuni, ajiri wachezaji, fungua maduka, lipa mishahara.', 'Register a company, hire players, open shops, run payroll.'] },
  { id: 'wekeza', ic: '📈', c: '#f59e0b', n: ['Wekeza', 'Invest'], note: ['Soko la hisa', 'Stock market'], d: ['Nunua hisa za kampuni za wachezaji — bei inapanda na kushuka kwa biashara yao.', 'Buy shares in player companies — prices move with their business.'] },
  { id: 'ramani', ic: '🗺️', c: '#6366f1', n: ['Ramani', 'Map'], note: ['Dar, Zanzibar, Arusha', 'Dar, Zanzibar, Arusha'], d: ['Gusa sehemu yoyote — daladala, bajaji, bodaboda au gari lako litakupeleka.', 'Tap any place — a daladala, bajaji, bodaboda or your own car takes you there.'] },
  { id: 'polisi', ic: '🚓', c: '#1d4ed8', n: ['Polisi', 'Police'], note: ['Ripoti tukio', 'Report a crime'], d: ['Umeibiwa? Ripoti. Polisi wachezaji wanafuatilia na kukamata.', 'Robbed? Report it. Player police follow up and make arrests.'] },
  { id: 'mahakama', ic: '⚖️', c: '#78350f', n: ['Mahakama', 'Court'], note: ['Kesi Kisutu', 'Kisutu court'], d: ['Fungua kesi, toa ushahidi kwa voice note, chagua hakimu mchezaji au Hakimu wa mfumo.', 'Open a case, give voice-note evidence, choose a player judge or the system judge.'] },
  { id: 'ndoto', ic: '🌟', c: '#a855f7', n: ['Ndoto', 'Dreams'], note: ['Malengo yako', 'Your ambitions'], d: ['Chagua ndoto — staa wa Bongo Flava, tajiri wa majengo, Mkuu wa Mkoa — ufuate hadithi yake.', 'Pick an ambition — Bongo Flava star, property tycoon, Mayor — and follow its storyline.'] },
  { id: 'muziki', ic: '🎶', c: '#e11d48', n: ['Muziki', 'Music'], note: ['Bongo Flava', 'Bongo Flava'], d: ['Bongo Flava, Singeli na Amapiano kwenye club, gari na nyumbani.', 'Bongo Flava, Singeli and Amapiano in the club, the car and at home.'] },
  { id: 'majirani', ic: '🏘️', c: '#14b8a6', n: ['Majirani', 'Neighbours'], note: ['Mtaa wako', 'Your block'], d: ['Tembelea majirani, chill ndani, alika washkaji nyumbani.', 'Visit neighbours, chill indoors, invite the crew over.'] },
  { id: 'matangazo', ic: '📢', c: '#f97316', n: ['Matangazo', 'Ads'], note: ['Mabango ya mji', 'City billboards'], d: ['Weka tangazo kwenye mabango 11 — lipa kwa nTZS.', 'Put your ad on 11 billboards — paid in nTZS.'] },
];
let openApp = null;
let swipeIdx = 0;
let stockTimer = 0;
const PROFILES = [['👩🏾', 'Neema, 24', 'Sinza · DJ'], ['🧑🏾', 'Baraka, 27', 'Masaki · Developer'], ['👩🏿', 'Zawadi, 25', 'Stone Town · Tour guide'], ['🧔🏾', 'Hamisi, 29', 'Kariakoo · Mfanyabiashara']];
const STOCKS = [['NTILIE', 'Mama Ntilie Ltd', 1200], ['BODA', 'Boda Express', 860], ['SINZA', 'Sinza Beats', 2400], ['SAMAKI', 'Feri Fish Co', 540]];
function appBody(id) {
  const row = (ic, t, s, v) => `<div class="row"><span class="r-ic">${ic}</span><span class="r-t">${t}<small>${s}</small></span><span class="r-v">${v}</span></div>`;
  switch (id) {
    case 'pesa': return `<div class="home-widget" style="background:#14532d;color:#fff"><small>${T('Salio', 'Balance')}</small><b>TSh 1,284,500</b></div>
      ${row('💼', T('Mshahara — DJ', 'Wages — DJ'), '1245 · 22:40', '+80,000')}${row('🍖', 'Nyama choma', 'Ubungo', '-12,000')}${row('🎁', '@zawadi', T('Zawadi', 'Gift'), '+20,000')}${row('⛽', T('Mafuta — IST', 'Fuel — IST'), 'Sinza → Posta', '-10,000')}
      <button class="av-act" data-act="topup">📲 ${T('Ongeza salio kwa M-Pesa', 'Top up with M-Pesa')}</button>`;
    case 'chat': return `<div class="bubble"><small>@baraka · Sinza</small>${T('Leo 1245 nani yupo? 🔥', 'Who is at 1245 tonight? 🔥')}</div>
      <div class="bubble"><small>@neema</small>🎙️ ▶︎ ▁▃▅▇▅▃▁ 0:07</div>
      <div class="bubble me"><small>${T('wewe', 'you')}</small>${T('Nipo njiani <b>@neema</b> 🚕', 'On my way <b>@neema</b> 🚕')}</div>
      <div class="bubble"><small>@hamisi</small>${T('Nimerusha 500k sakafuni 💸 kimbieni!', 'Just threw 500k on the floor 💸 run!')} <span>😂 3 · 🔥 5</span></div>
      <button class="av-act" data-act="reply">↩︎ ${T('Jibu', 'Reply')}</button>`;
    case 'penzi': { const p = PROFILES[swipeIdx % PROFILES.length]; return `<div class="swipe-card" id="swipe"><div class="sc-face">${p[0]}</div><b>${p[1]}</b><div>${p[2]}</div></div>
      <div class="swipe-btns"><button data-act="nope">✕</button><button data-act="like">💞</button></div>`; }
    case 'kampuni': return `${row('🏢', 'Sinza Beats Ltd', T('Studio · wafanyakazi 4', 'Studio · 4 staff'), '⭐ 4.6')}${row('🛍️', T('Duka — Kariakoo', 'Shop — Kariakoo'), T('Inauza vitenge', 'Sells vitenge'), '+42k/h')}${row('👥', T('Ajiri', 'Hiring'), 'DJ, Barista', '2')}
      <button class="av-act" data-act="company">＋ ${T('Sajili kampuni mpya', 'Register a new company')}</button>`;
    case 'wekeza': return STOCKS.map(([s, n, p]) => `<div class="row"><span class="r-ic">📊</span><span class="r-t"><b>${s}</b><small>${n}</small></span><span class="r-v" data-stock="${s}" data-p="${p}">${p.toLocaleString()}</span></div>`).join('');
    case 'ramani': return AREAS.map((a) => row(a.places[0]?.i || '📍', esc(T(a.sw, a.en)), `${a.places.length} ${T('sehemu', 'places')}`, '›')).join('');
    case 'polisi': return `${row('🚨', T('Wizi — Kariakoo', 'Robbery — Kariakoo'), T('Imeripotiwa 21:04', 'Reported 21:04'), '🟡')}${row('🚓', T('Doria — Posta', 'Patrol — Posta'), T('Polisi 3 wako zamu', '3 officers on duty'), '🟢')}
      <button class="av-act" data-act="report">🚨 ${T('Ripoti tukio', 'Report a crime')}</button>`;
    case 'mahakama': return `${row('⚖️', T('Kesi #214 — wizi', 'Case #214 — robbery'), T('Hakimu: @kadioko', 'Judge: @kadioko'), '⏳')}${row('🎙️', T('Ushahidi', 'Evidence'), T('Voice note 0:21', 'Voice note 0:21'), '▶︎')}${row('🏛️', T('Hukumu', 'Verdict'), T('Baada ya dakika 5', 'In 5 minutes'), '…')}
      <button class="av-act" data-act="case">📄 ${T('Fungua kesi', 'Open a case')}</button>`;
    case 'ndoto': return `${row('🎤', T('Staa wa Bongo Flava', 'Bongo Flava star'), T('Rekodi ngoma 3 studio', 'Record 3 tracks'), '2/3')}${row('🏗️', T('Tajiri wa majengo', 'Property tycoon'), T('Miliki ghorofa', 'Own an apartment block'), '0/1')}${row('👑', T('Mkuu wa Mkoa', 'Mayor'), T('Shinda uchaguzi', 'Win the election'), '—')}`;
    case 'muziki': return `<div class="home-widget" style="background:#881337;color:#fff"><small>${T('Inacheza sasa · 1245', 'Now playing · 1245')}</small><b>Bongo Flava Mix</b><div>▁▃▅▇▅▃▁▃▅▇</div></div>${row('🔊', 'Singeli Night', 'Mbagala', '▶︎')}${row('🌊', 'Amapiano Sunset', 'Coco Beach', '▶︎')}${row('🥁', 'Ngoma za Asili', 'Makumbusho', '▶︎')}`;
    case 'majirani': return `${row('🏡', '@zawadi', T('Mbezi · yuko nyumbani', 'Mbezi · at home'), '🚪')}${row('🛋️', '@baraka', T('Masaki · anachill', 'Masaki · chilling'), '🚪')}<button class="av-act" data-act="visit">🚪 ${T('Bisha hodi', 'Knock knock')}</button>`;
    case 'matangazo': return `${row('📢', 'Posta CBD', T('Inapatikana', 'Available'), 'nTZS')}${row('📢', T('Daraja la Nyerere', 'Nyerere Bridge'), T('Inapatikana', 'Available'), 'nTZS')}${row('📢', 'Coco Beach', T('Imechukuliwa', 'Taken'), '⏳')}<button class="av-act" data-act="ads">📢 ${T('Weka tangazo', 'Place an ad')}</button>`;
  }
  return '';
}
function renderPhone() {
  clearInterval(stockTimer);
  const sc = $('#screen');
  const home = `<div class="home-widget"><small>🏛️ ${T('Mkuu wa Mkoa', 'Mayor')}</small><b>${mayor ? '@' + esc(mayor.username) : '—'}</b><small id="ph-event">${liveEvent ? esc((lang === 'en' && liveEvent.textEn) || liveEvent.text) : T('Karibu Bongo 🇹🇿', 'Karibu Bongo 🇹🇿')}</small></div>
    <div class="home-grid">${APPS.map((a) => `<button class="app" data-app="${a.id}" style="--c:${a.c}"><i>${a.ic}</i>${T(...a.n)}</button>`).join('')}</div>`;
  if (!openApp) {
    sc.innerHTML = home;
    $('#app-note').innerHTML = `<b>${T('Gusa app', 'Tap an app')}</b><p>${T('Simu ya mchezo ina apps 12+. Hii ni ladha tu — zote zinafanya kazi ndani ya Bongo Life.', 'The in-game phone has 12+ apps. This is just a taste — they all work inside Bongo Life.')}</p>`;
  } else {
    const a = APPS.find((x) => x.id === openApp);
    sc.innerHTML = home + `<div class="appview" style="background:linear-gradient(180deg, ${a.c}40, transparent 45%) #fffdf8"><div class="av-top"><button data-act="home">‹ ${T('Nyumbani', 'Home')}</button><b>${a.ic} ${T(...a.n)}</b></div><div class="av-body">${appBody(a.id)}</div></div>`;
    $('#app-note').innerHTML = `<b>${a.ic} ${T(...a.note)}</b><p>${T(...a.d)}</p>`;
    if (a.id === 'wekeza' && !calm) stockTimer = setInterval(() => $$('[data-stock]').forEach((el) => {
      const p = Math.max(50, Math.round(+el.dataset.p * (1 + (Math.random() - 0.48) * 0.04)));
      el.style.color = p >= +el.dataset.p ? '#16a34a' : '#dc2626';
      el.dataset.p = p;
      el.textContent = p.toLocaleString();
    }), 900);
  }
}
$('#screen').addEventListener('click', (e) => {
  const app = e.target.closest('[data-app]');
  if (app) { openApp = app.dataset.app; return renderPhone(); }
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (!act) return;
  if (act === 'home') { openApp = null; return renderPhone(); }
  if (act === 'like' || act === 'nope') {
    const c = $('#swipe');
    c.classList.add(act === 'like' ? 'gone-r' : 'gone-l');
    setTimeout(() => { swipeIdx++; renderPhone(); }, 350);
    if (act === 'like') $('#app-note').innerHTML = `<b>💞 ${T('Ombi limetumwa!', 'Request sent!')}</b><p>${T('Ndani ya mchezo, mkikubaliana mnaweza kwenda date pamoja.', 'In the game, if they accept you can go on a date together.')}</p>`;
    return;
  }
  // Everything else is a real feature of the game: send people there.
  $('#app-note').innerHTML = `<b>${T('Hii iko ndani ya mchezo', 'This is in the game')}</b><p>${T('Jisajili bure ujaribu kwa kweli.', 'Sign up free to do it for real.')}</p><a class="btn btn-gold btn-sm play" href="#" style="margin-top:10px">${T('Cheza bure →', 'Play free →')}</a>`;
  updateLinks();
});
rerenders.push(renderPhone);

// ================================================================ election wall
$$('[data-tilt]').forEach((p) => {
  if (calm) return;
  p.addEventListener('pointermove', (e) => {
    const r = p.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    p.style.transform = `perspective(600px) rotateY(${x * 16}deg) rotateX(${-y * 16}deg) scale(1.04)`;
  });
  p.addEventListener('pointerleave', () => (p.style.transform = ''));
});
function renderVotes() {
  const voted = store.get('bl_vote');
  $$('.vote-btn').forEach((b, i) => {
    const on = voted === String(i);
    b.classList.toggle('voted', on);
    b.textContent = on ? T('✓ Umepiga kura', '✓ Voted') : T('🗳️ Piga kura', '🗳️ Vote');
    const poster = b.closest('.poster');
    poster.querySelector('.stamp')?.remove();
    if (on) poster.insertAdjacentHTML('beforeend', `<span class="stamp">${T('KURA ✓', 'VOTED ✓')}</span>`);
  });
}
$$('.vote-btn').forEach((b, i) => b.addEventListener('click', () => {
  store.set('bl_vote', store.get('bl_vote') === String(i) ? '' : String(i));
  renderVotes();
}));
rerenders.push(renderVotes);

// ================================================================ flip cards + make it rain
$$('.flip').forEach((f) => {
  const toggle = () => f.classList.toggle('flipped');
  f.addEventListener('click', (e) => { if (!e.target.closest('.rain-btn, .note')) toggle(); });
  f.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
});
let picked = 0;
$('#rain-btn').addEventListener('click', () => {
  const face = $('#rain-card .front');
  for (let i = 0; i < 18; i++) {
    const n = document.createElement('span');
    n.className = 'note';
    n.textContent = '💵';
    n.style.left = `${5 + Math.random() * 85}%`;
    n.style.animationDelay = `${Math.random() * 0.9}s`;
    n.style.setProperty('--d', `${1.8 + Math.random() * 1.4}s`);
    n.style.setProperty('--y', `${250 + Math.random() * 110}px`);
    n.style.setProperty('--rot', `${(Math.random() - 0.5) * 540}deg`);
    n.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      picked += 10_000;
      const r = face.getBoundingClientRect();
      const tag = document.createElement('span');
      tag.className = 'picked';
      tag.textContent = '+10k';
      tag.style.left = `${e.clientX - r.left}px`;
      tag.style.top = `${e.clientY - r.top}px`;
      face.append(tag);
      setTimeout(() => tag.remove(), 800);
      n.remove();
      $('#rain-btn').textContent = `${T('Umeokota', 'Picked up')} ${tsh(picked)} 💸`;
    });
    face.append(n);
    setTimeout(() => n.remove(), 6000);
  }
});

// ================================================================ travel board
const TRIPS = {
  znz: { to: 'ZANZIBAR', modes: [['ferry', '⛴️', ['Boti ya Azam', 'Azam fast ferry'], 40_000, ['Kivukoni hadi Bandari ya Zanzibar', 'Kivukoni to Zanzibar Port']], ['flight', '✈️', ['Ndege', 'Flight'], 95_000, ['Teksi hadi uwanja imejumuishwa', 'Cab to the airport included']], ['heli', '🚁', ['Helikopta', 'Helicopter'], 1_800_000, ['Kutoka mlangoni hadi mlangoni', 'Door to door']]] },
  aru: { to: 'ARUSHA', modes: [['bus', '🚌', ['Basi la abiria', 'Coach'], 45_000, ['Magufuli hadi stendi kuu ya Arusha', 'Magufuli terminal to Arusha']], ['car', '🚗', ['Endesha gari lako', 'Drive'], 70_000, ['Mafuta tu, lakini utafika umechoka', "Fuel only, but you'll arrive tired"]], ['flight', '✈️', ['Ndege', 'Flight'], 260_000, ['KIA — safari ya Serengeti inakusubiri', 'KIA — the Serengeti is waiting']], ['heli', '🚁', ['Helikopta', 'Helicopter'], 4_500_000, ['Kutoka mlangoni hadi mlangoni', 'Door to door']]] },
};
let dest = 'znz';
let mode = 0;
const FLAP = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
function flapTo(el, text) {
  const chars = [...text.toUpperCase()];
  el.innerHTML = chars.map(() => '<i></i>').join('');
  const cells = $$('i', el);
  chars.forEach((ch, i) => {
    if (calm || ch === ' ') return void (cells[i].textContent = ch === ' ' ? '' : ch);
    let n = 4 + i;
    const spin = () => {
      cells[i].classList.remove('spin'); void cells[i].offsetWidth; cells[i].classList.add('spin');
      cells[i].textContent = n-- > 0 ? FLAP[Math.floor(Math.random() * FLAP.length)] : ch;
      if (n >= 0) setTimeout(spin, 55);
    };
    spin();
  });
}
function renderTrip() {
  const t = TRIPS[dest];
  mode = Math.min(mode, t.modes.length - 1);
  $$('#dest button').forEach((b) => b.classList.toggle('on', b.dataset.dest === dest));
  $('#modes').innerHTML = t.modes.map((m, i) => `<button class="mode${i === mode ? ' on' : ''}" data-i="${i}"><span class="m-ic">${m[1]}</span><span class="m-t">${T(...m[2])}<small>${T(...m[4])}</small></span><b>${short(m[3])}</b></button>`).join('');
  $$('.mode').forEach((b) => b.addEventListener('click', () => { mode = +b.dataset.i; renderTrip(); }));
  const m = t.modes[mode];
  flapTo($('#b-to'), t.to);
  flapTo($('#b-via'), T(...m[2]).split(' ')[0].slice(0, 10));
  flapTo($('#b-fare'), short(m[3]));
  $('#board-note').textContent = T(`Fika ${dest === 'znz' ? 'Stone Town' : 'Arusha'}: ${dest === 'znz' ? 'Forodhani, Nungwi, Kendwa Rocks, Jozani.' : 'Clock Tower, Via Via, Mlima Meru, Serengeti.'} Bima ya safari ipo kwenye mchezo.`, `Arrive in ${dest === 'znz' ? 'Stone Town' : 'Arusha'}: ${dest === 'znz' ? 'Forodhani, Nungwi, Kendwa Rocks, Jozani.' : 'Clock Tower, Via Via, Mount Meru, the Serengeti.'} Trip insurance is in the game.`);
}
$$('#dest button').forEach((b) => b.addEventListener('click', () => { dest = b.dataset.dest; mode = 0; renderTrip(); }));
rerenders.push(renderTrip);

// ================================================================ billboard preview
const bbIn = $('#bb-text');
const showBB = () => {
  const v = bbIn.value.trim();
  if (v) $('#bb-show').textContent = v;
  else $('#bb-show').textContent = $('#bb-show').dataset[lang];
};
bbIn.addEventListener('input', showBB);
rerenders.push(showBB);

// ================================================================ boot
$('#year').textContent = new Date().getFullYear();
applyLang();
tickClocks();
loadStats().then(renderPhone);
setInterval(() => !document.hidden && loadStats(), 15_000);
document.addEventListener('visibilitychange', () => !document.hidden && loadStats());
fetch('places.json').then((r) => r.json()).then((areas) => {
  AREAS = areas;
  $('#spot-count').textContent = areas.reduce((n, a) => n + a.places.length, 0);
  const seen = new Set();
  JOBS = areas.flatMap((a) => a.places.filter((p) => p.job).map((p) => ({ ...p.job, i: p.i, place: T(p.n, p.ne), secs: p.job.secs || 150 })))
    .filter((j) => !seen.has(j.t) && seen.add(j.t))
    .sort((a, b) => a.pay - b.pay);
  jobIdx = Math.max(0, JOBS.findIndex((j) => /machinga/i.test(j.t)));
  rerenders.push(renderAreas, renderMarquee);
  renderAreas();
  renderMarquee();
  renderLadder();
  renderPhone();
  layoutStops();
}).catch(() => {});
