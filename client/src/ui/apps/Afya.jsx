// Afya (Health): your health, health plans, therapy sessions, an online doctor and a pharmacy.
import { useEffect, useRef, useState } from 'react';
import { fmtTsh, NEEDS, HEALTH, HOSPITAL_ID } from '@shared/world.js';
import { useStore } from '../../store.js';
import { api } from '../../api.js';
import { AppHead } from '../Phone.jsx';
import { ask } from '../Confirm.jsx';
import { goToPlace } from '../../nav.js';
import { L } from '../../i18n.js';
import { sfx } from '../../audio.js';

const mins = (ms) => Math.max(1, Math.ceil(ms / 60_000));

export function Afya({ back, close }) {
  const me = useStore((s) => s.me);
  const run = useStore((s) => s.run);
  const [d, setD] = useState(null);
  const [session, setSession] = useState(null);
  const [, tick] = useState(0);
  const load = () => api('/health').then(setD).catch(() => {});
  useEffect(() => { load(); const t = setInterval(() => tick((n) => n + 1), 15_000); return () => clearInterval(t); }, []);
  if (!d) return (<><AppHead title={L('Afya', 'Health')} onBack={back} /><div className="app-body"><div className="small muted" style={{ padding: 12 }}>{L('Inapakia…', 'Loading…')}</div></div></>);
  if (session) return <TherapySession th={session} price={d.therapy.price} onBack={() => setSession(null)} onDone={(r) => { setSession(null); if (r) setD(r); }} />;
  const health = me.health ?? d.health;
  const t = Date.now();
  const buyPlan = async (p) => {
    const renew = d.plan?.id === p.id;
    if (!(await ask({ icon: p.emoji, title: renew ? L(`Ongeza siku 30 za ${p.name}?`, `Add 30 days of ${p.nameEn}?`) : L(`Jiunge na ${p.name}?`, `Join ${p.nameEn}?`), text: `${fmtTsh(p.price)} · ${L('siku 30', '30 days')}`, ok: L('Lipa', 'Pay') }))) return;
    const r = await run('/health/plan', { method: 'POST', body: { id: p.id } });
    if (r) { setD(r); sfx('levelup'); useStore.getState().toast(L(`${p.emoji} Uko kwenye ${p.name} hadi ${new Date(r.plan.until).toLocaleDateString()}`, `${p.emoji} You're covered by ${p.nameEn} until ${new Date(r.plan.until).toLocaleDateString()}`)); }
  };
  const doctor = async () => {
    const r = await run('/health/doctor', { method: 'POST' });
    if (r) { setD(r); sfx('pop'); useStore.getState().toast(L(`📱 Daktari: "Kunywa maji mengi na pumzika." ❤️ Afya ${r.health}%`, `📱 Doctor: "Drink plenty of water and rest." ❤️ Health ${r.health}%`)); }
  };
  const buy = async (it) => {
    const r = await run('/health/pharmacy', { method: 'POST', body: { id: it.id } });
    if (r) { setD(r); sfx('cash'); useStore.getState().toast(`${it.emoji} ${L(it.name, it.nameEn)} · ❤️ ${r.health}%`); }
  };
  const ring = `conic-gradient(${health < HEALTH.injuredBelow ? '#ef4444' : health < 70 ? '#f59e0b' : '#22c55e'} ${health * 3.6}deg, rgba(255,255,255,.18) 0)`;
  return (
    <>
      <AppHead title={L('Afya', 'Health')} onBack={back} />
      <div className="app-body">
        <div className="afya-hero">
          <div className="afya-ring" style={{ background: ring }}><div><b>{health}%</b><small>{L('afya', 'health')}</small></div></div>
          <div className="grow">
            <b>{health < HEALTH.injuredBelow ? L('Unahitaji matibabu 🚑', 'You need treatment 🚑') : health < 70 ? L('Jitunze kidogo', 'Take it easy') : L('Uko fiti! 💪', "You're in great shape! 💪")}</b>
            <small>{d.plan ? `${d.plan.emoji} ${L(d.plan.name, d.plan.nameEn)} · ${L('hadi', 'until')} ${new Date(d.plan.until).toLocaleDateString()}` : L('Huna bima ya afya', 'No health cover')}</small>
            <div className="afya-needs">{NEEDS.map((n) => <span key={n.id} title={n.name}>{n.icon} {Math.round(me.needs?.[n.id] ?? 0)}</span>)}</div>
          </div>
        </div>
        {health < HEALTH.injuredBelow && (
          <button className="btn btn-green btn-block" style={{ marginTop: 8 }} onClick={() => { close?.(); goToPlace(HOSPITAL_ID); }}>🏥 {L('Nenda Muhimbili sasa', 'Go to Muhimbili now')}</button>
        )}

        <div className="section-t">{L('ONGEA NA MTAALAMU', 'TALK TO A THERAPIST')}</div>
        <div className="small muted" style={{ marginBottom: 6 }}>{L('Kikao cha faragha: elezea unavyojisikia, jifunze mbinu za kupumua na kutuliza akili.', 'A private session: talk about how you feel and learn breathing and calming techniques.')} · {d.therapy.price ? fmtTsh(d.therapy.price) : L('Bure kwa bima yako', 'Free with your cover')}</div>
        {d.therapists.map((th) => (
          <button key={th.id} className="afya-th" disabled={d.therapy.readyAt > t} onClick={() => { sfx('open'); setSession(th); }}>
            <span className="em">{th.emoji}</span>
            <span className="grow"><b>{th.name}</b><small>{L(th.focus[0], th.focus[1])}</small></span>
            <span className="go">{d.therapy.readyAt > t ? L(`dk ${mins(d.therapy.readyAt - t)}`, `${mins(d.therapy.readyAt - t)} min`) : L('Ongea', 'Talk')}</span>
          </button>
        ))}

        <div className="section-t">{L('DAKTARI MTANDAONI', 'ONLINE DOCTOR')}</div>
        <div className="inv-row">
          <span className="em">📱</span>
          <div className="grow"><b>{L('Ushauri wa video', 'Video consult')}</b><small>{L('+12 afya · majibu ndani ya dakika', '+12 health · answers in minutes')}</small></div>
          <button className="btn btn-green btn-sm" disabled={d.doctor.readyAt > t || me.money < d.doctor.price} onClick={doctor}>{d.doctor.readyAt > t ? L(`dk ${mins(d.doctor.readyAt - t)}`, `${mins(d.doctor.readyAt - t)} min`) : d.doctor.price ? fmtTsh(d.doctor.price) : L('Bure', 'Free')}</button>
        </div>

        <div className="section-t">{L('BIMA YA AFYA', 'HEALTH PLANS')}</div>
        {d.plans.map((p) => (
          <div key={p.id} className={`afya-plan ${d.plan?.id === p.id ? 'on' : ''}`} style={{ '--pc': p.color }}>
            <div className="row" style={{ alignItems: 'center', gap: 8 }}>
              <b className="grow">{p.emoji} {L(p.name, p.nameEn)}</b>
              <b>{fmtTsh(p.price)}<small>/{L('siku 30', '30 days')}</small></b>
            </div>
            <ul>{p.perks.map((x, i) => <li key={i}>{L(x[0], x[1])}</li>)}</ul>
            <button className="btn btn-sm btn-block" style={{ background: p.color, color: '#fff' }} disabled={me.money < p.price} onClick={() => buyPlan(p)}>
              {d.plan?.id === p.id ? L('Ongeza siku 30', 'Renew +30 days') : d.plan ? L('Badilisha', 'Switch') : L('Jiunge', 'Join')}
            </button>
          </div>
        ))}

        <div className="section-t">{L('DUKA LA DAWA', 'PHARMACY')}</div>
        {d.pharmacyReadyAt > t && <div className="small muted">{L(`Unaweza kununua tena baada ya dakika ${mins(d.pharmacyReadyAt - t)}.`, `You can buy again in ${mins(d.pharmacyReadyAt - t)} min.`)}</div>}
        <div className="afya-shop">
          {d.pharmacy.map((it) => (
            <button key={it.id} disabled={d.pharmacyReadyAt > t || me.money < it.price} onClick={() => buy(it)}>
              <span>{it.emoji}</span><b>{L(it.name, it.nameEn)}</b><small>+{it.health} ❤️ · {fmtTsh(it.price)}</small>
            </button>
          ))}
        </div>
        <div className="hint">{L('Afya hushuka ukikosa chakula au usingizi, au ukigongwa na gari. Bima hupunguza gharama za hospitali.', "Health drops when you're starving or exhausted, or hit by a car. Cover cuts your hospital bills.")}</div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- therapy session
const TOPICS = [
  { id: 'stress', emoji: '😟', label: ['Nina msongo wa mawazo', "I'm stressed"],
    reflect: ['Inasikika kama una mzigo mzito sana sasa hivi. Ni kawaida kujisikia hivyo unapobeba mengi — kazi, pesa, familia.', "It sounds like you're carrying a lot right now. That's a normal reaction when work, money and family all pile up."],
    tip: ['Andika vitu vitatu vinavyokusumbua, kisha chagua KIMOJA tu cha kushughulikia leo. Vingine vinaweza kusubiri.', 'Write down three things weighing on you, then pick just ONE to deal with today. The rest can wait.'] },
  { id: 'low', emoji: '😔', label: ['Najisikia chini', 'I feel low'],
    reflect: ['Asante kwa kuniambia. Siku za huzuni ni nzito, na si udhaifu kuzizungumzia.', "Thank you for telling me. Low days are heavy, and talking about them isn't weakness."],
    tip: ['Fanya kitu kidogo kinachokupa raha leo — tembea nje dakika 10, sikiliza wimbo unaoupenda, au mpigie rafiki.', 'Do one small thing that feels good today — a 10-minute walk outside, a favourite song, or a call to a friend.'] },
  { id: 'angry', emoji: '😡', label: ['Nina hasira', "I'm angry"],
    reflect: ['Hasira mara nyingi hutuambia kitu muhimu kimeguswa. Hebu tuipe nafasi bila kuiacha ikuendeshe.', "Anger often tells us something important was crossed. Let's give it room without letting it drive."],
    tip: ['Kabla ya kujibu mtu, hesabu hadi 10 na pumua polepole. Uamuzi mzuri hufanywa ukiwa umetulia.', 'Before you reply to anyone, count to 10 and breathe slowly. Good decisions are made calm.'] },
  { id: 'sleep', emoji: '😴', label: ['Silali vizuri', "I can't sleep"],
    reflect: ['Kukosa usingizi huchosha mwili na akili. Tutafute utaratibu utakaokusaidia kupumzika.', "Poor sleep wears down body and mind. Let's find a routine that helps you rest."],
    tip: ['Weka simu mbali dakika 30 kabla ya kulala, na ulale na kuamka muda uleule kila siku.', 'Put the phone away 30 minutes before bed, and sleep and wake at the same time every day.'] },
  { id: 'heart', emoji: '💔', label: ['Nimeumizwa moyoni', "I'm heartbroken"],
    reflect: ['Pole sana. Maumivu ya moyo ni halisi — yanahitaji muda, si haraka.', "I'm so sorry. Heartbreak is real pain — it needs time, not rushing."],
    tip: ['Jizungushe na watu wanaokujali, na jiruhusu kuhisi bila kujilaumu. Kila siku itakuwa nyepesi kidogo.', 'Surround yourself with people who care, and let yourself feel without blame. Each day gets a little lighter.'] },
  { id: 'checkin', emoji: '🙂', label: ['Nataka tu kuongea', 'I just want to talk'],
    reflect: ['Karibu sana. Kujali afya ya akili hata ukiwa sawa ni jambo la busara.', "You're very welcome. Looking after your mind even when you're okay is wise."],
    tip: ['Kila jioni, andika kitu kimoja ulichoshukuru kwa siku hiyo. Huimarisha furaha taratibu.', 'Each evening, write one thing you were grateful for that day. It builds happiness over time.'] },
];
const CLOSE = ['Umefanya kazi nzuri leo. Kumbuka: kuomba msaada ni ishara ya nguvu. Nipo hapa ukinihitaji tena. 💛', "You did good work today. Remember: asking for help is a sign of strength. I'm here whenever you need me again. 💛"];

function Breathing({ onDone }) {
  const [phase, setPhase] = useState(0); // 0 in, 1 hold, 2 out
  const [cycle, setCycle] = useState(0);
  useEffect(() => {
    const ms = [4000, 4000, 6000][phase];
    const t = setTimeout(() => {
      if (phase < 2) setPhase(phase + 1);
      else if (cycle < 2) { setCycle(cycle + 1); setPhase(0); }
      else onDone();
    }, ms);
    return () => clearTimeout(t);
  }, [phase, cycle, onDone]);
  return (
    <div className="breath">
      <div className={`breath-orb p${phase}`} />
      <b>{[L('Vuta pumzi…', 'Breathe in…'), L('Shikilia…', 'Hold…'), L('Toa pumzi polepole…', 'Breathe out slowly…')][phase]}</b>
      <small>{L(`Mzunguko ${cycle + 1} kati ya 3`, `Round ${cycle + 1} of 3`)}</small>
      {cycle > 0 && <button className="btn btn-ghost btn-xs" onClick={onDone}>{L('Inatosha', "That's enough")}</button>}
    </div>
  );
}

function TherapySession({ th, price, onBack, onDone }) {
  const run = useStore((s) => s.run);
  const name = useStore((s) => s.me?.name?.split(' ')[0] || '');
  const [msgs, setMsgs] = useState([]);
  const [typing, setTyping] = useState(false);
  const [step, setStep] = useState('topic'); // topic → choose → breathe/journal → end
  const [topic, setTopic] = useState(null);
  const [note, setNote] = useState('');
  const end = useRef();
  const say = (text, then) => {
    setTyping(true);
    setTimeout(() => { setTyping(false); setMsgs((m) => [...m, { from: 'th', text }]); then?.(); }, 900 + Math.min(1600, text.length * 12));
  };
  const me = (text) => setMsgs((m) => [...m, { from: 'me', text }]);
  useEffect(() => { say(L(`Habari ${name}, mimi ni ${th.name}. Karibu, uko salama hapa. Unajisikiaje leo?`, `Hi ${name}, I'm ${th.name}. Welcome — this is a safe space. How are you feeling today?`)); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { end.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }); }, [msgs.length, typing, step]);
  const pick = (t) => {
    setTopic(t);
    me(`${t.emoji} ${L(t.label[0], t.label[1])}`);
    setStep('wait');
    say(L(t.reflect[0], t.reflect[1]), () => say(L('Ungependa tufanye nini sasa?', 'What would you like to do now?'), () => setStep('choose')));
  };
  const afterExercise = () => say(L(topic.tip[0], topic.tip[1]), () => say(L(CLOSE[0], CLOSE[1]), () => setStep('end')));
  const choose = (k) => {
    if (k === 'breathe') { me(L('🫁 Tufanye zoezi la kupumua', "🫁 Let's do a breathing exercise")); setStep('wait'); say(L('Sawa. Fuata duara: vuta pumzi linapokua, toa linapopungua.', 'Okay. Follow the circle: breathe in as it grows, out as it shrinks.'), () => setStep('breathe')); }
    if (k === 'tip') { me(L('💡 Nipe ushauri', '💡 Give me a tip')); setStep('wait'); afterExercise(); }
    if (k === 'journal') { me(L('📝 Nataka kuandika', '📝 I want to write it down')); setStep('wait'); say(L('Andika kwa uhuru — hakuna atakayesoma ila wewe.', 'Write freely — nobody reads this but you.'), () => setStep('journal')); }
  };
  const finish = async () => {
    const r = await run('/health/therapy', { method: 'POST', body: { therapist: th.id } });
    if (r) { sfx('levelup'); useStore.getState().toast(L(`🧠 Kikao kimeisha · 😊 +15 furaha · ❤️ ${r.health}%`, `🧠 Session done · 😊 +15 fun · ❤️ ${r.health}%`)); }
    onDone(r);
  };
  return (
    <>
      <AppHead title={th.name} onBack={onBack} />
      <div className="app-body therapy">
        <div className="th-head"><span>{th.emoji}</span><div><b>{th.name}</b><small>{L(th.focus[0], th.focus[1])} · 🔒 {L('faragha', 'private')}</small></div></div>
        <div className="th-note">{L('Huyu ni mtaalamu wa ndani ya mchezo. Kama unapitia magumu kwenye maisha halisi, ongea na mtu unayemwamini au mtaalamu wa afya ya akili. 💛', "This is an in-game therapist. If you're going through a hard time in real life, please talk to someone you trust or a mental-health professional. 💛")}</div>
        <div className="msgs">
          {msgs.map((m, i) => <div key={i} className={`bubble ${m.from === 'me' ? 'me' : ''}`}>{m.text}</div>)}
          {typing && <div className="bubble typing"><i /><i /><i /></div>}
          {step === 'breathe' && <Breathing onDone={() => { setStep('wait'); me(L('😮‍💨 Najisikia mtulivu zaidi', '😮‍💨 I feel calmer')); afterExercise(); }} />}
          <div ref={end} />
        </div>
      </div>
      <div className="th-actions">
        {step === 'topic' && TOPICS.map((t) => <button key={t.id} onClick={() => pick(t)}>{t.emoji} {L(t.label[0], t.label[1])}</button>)}
        {step === 'choose' && (
          <>
            <button onClick={() => choose('breathe')}>🫁 {L('Zoezi la kupumua', 'Breathing exercise')}</button>
            <button onClick={() => choose('tip')}>💡 {L('Nipe ushauri', 'Give me a tip')}</button>
            <button onClick={() => choose('journal')}>📝 {L('Niandike', 'Write it down')}</button>
          </>
        )}
        {step === 'journal' && (
          <form className="composer" onSubmit={(e) => { e.preventDefault(); if (!note.trim()) return; me(note.trim()); setNote(''); setStep('wait'); afterExercise(); }}>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={L('Ninajisikia…', 'I feel…')} maxLength={400} autoFocus />
            <button className="btn btn-green btn-sm" disabled={!note.trim()}>{L('Tuma', 'Send')}</button>
          </form>
        )}
        {step === 'end' && <button className="th-end" onClick={finish}>✅ {L('Maliza kikao', 'End session')}{price ? ` · ${fmtTsh(price)}` : ` · ${L('bure', 'free')}`}</button>}
      </div>
    </>
  );
}
