import { useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { SKIN_TONES, HAIR_COLORS, HAIRSTYLES, OUTFITS, TRAITS, SPAWNS, randomAppearance, fmtTsh, outfitById, outfitFits } from '@shared/world.js';
import { Avatar } from '../three/Avatar.jsx';
import { useStore } from '../store.js';
import { L, loc } from '../i18n.js';

const STEPS = () => [L('Muonekano', 'Look'), L('Mavazi', 'Outfit'), L('Tabia', 'Personality'), L('Mtaa', 'Neighbourhood'), L('Tayari', 'Ready')];

function Spinner({ appearance, spin }) {
  const g = useRef();
  const motion = useRef({ mode: 'idle' });
  useFrame((_, dt) => {
    if (!spin.current.drag) spin.current.v *= 0.95;
    spin.current.ry += spin.current.v * dt + (spin.current.drag ? 0 : dt * 0.25);
    g.current.rotation.y = spin.current.ry;
  });
  return (
    <group ref={g} position={[0, -1, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <circleGeometry args={[0.9, 40]} />
        <meshBasicMaterial color="#d6dde6" />
      </mesh>
      <Avatar appearance={appearance} motion={motion} />
    </group>
  );
}

/** Two-tone dot showing an outfit's top and bottom colours. */
export function Swatch({ o }) {
  return <span className="outfit-dot" style={{ background: `linear-gradient(135deg, ${o.top} 50%, ${o.bottom} 50%)` }} />;
}

export function AvatarPreview({ appearance, height = '100%' }) {
  const spin = useRef({ ry: 0.3, v: 0, drag: false, x: 0 });
  const down = (e) => {
    spin.current.drag = true;
    spin.current.x = e.clientX;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const move = (e) => {
    if (!spin.current.drag) return;
    const dx = e.clientX - spin.current.x;
    spin.current.x = e.clientX;
    spin.current.ry += dx * 0.012;
    spin.current.v = dx * 0.4;
  };
  const up = () => (spin.current.drag = false);
  return (
    <div style={{ height, touchAction: 'none' }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      <Canvas dpr={[1, 2]} camera={{ fov: 30, position: [0, -0.1, 3.7] }} flat>
        <hemisphereLight args={['#ffffff', '#b9c7d6', 1.6]} />
        <directionalLight position={[2, 4, 3]} intensity={1.4} />
        <Spinner appearance={appearance} spin={spin} />
      </Canvas>
    </div>
  );
}

export default function Creator() {
  const me = useStore((s) => s.me);
  const run = useStore((s) => s.run);
  const set = useStore((s) => s.set);
  const [step, setStep] = useState(0);
  const steps = STEPS();
  const [a, setA] = useState(() => me?.appearance || { ...randomAppearance(), outfit: 'kitenge', body: 'woman', hair: 'misuko' });
  const [trait, setTrait] = useState('mchakarikaji');
  const [spawn, setSpawn] = useState('manzese');
  const [saving, setSaving] = useState(false);
  const up = (patch) => {
    const next = { ...a, ...patch };
    // Switching body keeps the outfit only if it fits; otherwise pick the first free one that does.
    if (!outfitFits(outfitById[next.outfit] || {}, next.body)) next.outfit = OUTFITS.find((o) => o.price === 0 && outfitFits(o, next.body)).id;
    setA(next);
  };
  const free = OUTFITS.filter((o) => o.price === 0 && outfitFits(o, a.body));
  const shop = OUTFITS.filter((o) => o.price > 0 && outfitFits(o, a.body));

  const finish = async () => {
    setSaving(true);
    const r = await run('/me/profile', { method: 'POST', body: { appearance: a, trait, spawn } });
    setSaving(false);
    if (r) set({ me: r, screen: 'game' });
  };
  const next = () => (step < steps.length - 1 ? setStep(step + 1) : finish());
  const shuffle = () => {
    setA(randomAppearance());
  };

  return (
    <div className="creator">
      <div className="creator-head">
        <button className="round" onClick={() => (step ? setStep(step - 1) : set({ screen: 'landing' }))} aria-label={L('Rudi', 'Back')}>‹</button>
        <div>
          <div className="creator-title">{steps[step]}</div>
          <div className="steps">{steps.map((_, i) => <i key={i} className={i <= step ? 'on' : ''} />)}</div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="round" onClick={shuffle} aria-label={L('Changanya', 'Shuffle')}>🔀</button>
          <button className="btn btn-green btn-sm" onClick={next} disabled={saving}>{step === steps.length - 1 ? L('Anza', 'Start') : L('Endelea', 'Next')}</button>
        </div>
      </div>
      <div className="creator-stage">
        <AvatarPreview appearance={a} />
        <div className="spin-hint">{L('Vuta kuzungusha', 'Drag to spin')}</div>
      </div>
      <div className="creator-panel">
        <div className="scroll">
          <div className="namebox">@{me?.username}<span>{L('jina la Sim wako', "your Sim's name")}</span></div>

          {step === 0 && (
            <>
              <div className="label">{L('Mwili', 'Body')}</div>
              <div className="row">
                {[['woman', L('Mwanamke', 'Woman')], ['man', L('Mwanaume', 'Man')]].map(([id, n]) => (
                  <button key={id} className={`chip grow ${a.body === id ? 'on' : ''}`} onClick={() => up({ body: id })}>{n}</button>
                ))}
              </div>
              <div className="label">{L('Rangi ya ngozi', 'Skin tone')}</div>
              <div className="swatches">
                {SKIN_TONES.map((c, i) => <button key={c} className={`swatch ${a.skin === i ? 'on' : ''}`} style={{ background: c }} onClick={() => up({ skin: i })} aria-label={`Ngozi ${i + 1}`} />)}
              </div>
              <div className="label">{L('Nywele', 'Hairstyle')}</div>
              <div className="chips">
                {HAIRSTYLES.map((h) => <button key={h.id} className={`chip ${a.hair === h.id ? 'on' : ''}`} onClick={() => up({ hair: h.id })}>{loc(h)}</button>)}
              </div>
              <div className="label">{L('Rangi ya nywele', 'Hair colour')}</div>
              <div className="swatches">
                {HAIR_COLORS.map((c, i) => <button key={c} className={`swatch ${a.hairColor === i ? 'on' : ''}`} style={{ background: c }} onClick={() => up({ hairColor: i })} aria-label={`Rangi ${i + 1}`} />)}
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <div className="label">{L('Mavazi ya kuanzia (bure)', 'Starter outfits (free)')}</div>
              <div className="chips">
                {free.map((o) => <button key={o.id} className={`chip ${a.outfit === o.id ? 'on' : ''}`} onClick={() => up({ outfit: o.id })}><Swatch o={o} />{loc(o)}</button>)}
              </div>
              <div className="label">{L('Dukani (nunua ndani ya mchezo)', 'In the shops (buy in-game)')}</div>
              <div className="chips">
                {shop.map((o) => (
                  <span key={o.id} className="chip lock">🔒 {loc(o)} · {fmtTsh(o.price)}</span>
                ))}
              </div>
              <div className="hint">{L('Nguo za dukani zinapatikana Kariakoo Fashion na Mlimani City.', 'Shop outfits are sold at Kariakoo Fashion and Mlimani City.')}</div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="label">{L('Wewe ni mtu wa aina gani?', 'What kind of person are you?')}</div>
              <div className="opt-list">
                {TRAITS.map((t) => (
                  <button key={t.id} className={`opt-card ${trait === t.id ? 'on' : ''}`} onClick={() => setTrait(t.id)}>
                    <span className="em">{t.emoji}</span>
                    <span><b>{loc(t)}</b><div className="small muted">{loc(t, 'perk')}</div></span>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="label">{L('Unaanzia mtaa gani?', 'Where do you start?')}</div>
              <div className="opt-list">
                {Object.entries(SPAWNS).map(([id, s]) => (
                  <button key={id} className={`opt-card ${spawn === id ? 'on' : ''}`} onClick={() => setSpawn(id)}>
                    <span className="em">{{ manzese: '🏘️', kariakoo: '🧺', sinza: '🪩', kigamboni: '🌴' }[id]}</span>
                    <span><b>{s.name}</b><div className="small muted">{loc(s, 'blurb')}</div></span>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <div className="label">{L('Kila kitu kiko tayari 🇹🇿', 'All set 🇹🇿')}</div>
              <div className="box" style={{ background: 'var(--chip)' }}>
                <div className="row between"><span className="muted">{L('Tabia', 'Personality')}</span><b>{loc(TRAITS.find((t) => t.id === trait))}</b></div>
                <div className="row between" style={{ marginTop: 8 }}><span className="muted">{L('Mtaa', 'Neighbourhood')}</span><b>{SPAWNS[spawn].name}</b></div>
                <div className="row between" style={{ marginTop: 8 }}><span className="muted">{L('Mfukoni', 'Wallet')}</span><b className="green">{fmtTsh(me?.money)}</b></div>
              </div>
              <p className="small muted" style={{ lineHeight: 1.5 }}>
                {L(
                  <>Utaanza na chumba cha kupanga Manzese. Fanya kazi, kula, lala, piga stori na washkaji, nunua bodaboda, kiwanja Kigamboni na ujenge villa yako. Ukiwa tajiri zaidi Dar, unakuwa <b>Mkuu wa Mkoa</b> 👑</>,
                  <>You start with a rented room in Manzese. Work, eat, sleep, hang out with friends, buy a bodaboda, a plot in Kigamboni and build your villa. Become the richest in Dar and you're the <b>Mayor</b> 👑</>,
                )}
              </p>
            </>
          )}
        </div>
        <div className="creator-foot">
          <button className="btn btn-green btn-block" onClick={next} disabled={saving}>
            {saving ? L('Subiri…', 'Please wait…') : step === steps.length - 1 ? L('Ingia Bongo 🚀', 'Enter Bongo 🚀') : L('Endelea', 'Continue')}
          </button>
        </div>
      </div>
    </div>
  );
}
