import { useState } from 'react';
import { HAIRSTYLES, HAIR_COLORS, OUTFITS, TRAITS, outfitFits } from '@shared/world.js';
import { useStore } from '../../store.js';
import { AppHead } from '../Phone.jsx';
import { AvatarPreview, Swatch } from '../Creator.jsx';
import { LangToggle } from '../LangToggle.jsx';
import { L, loc } from '../../i18n.js';
import { setAudioSettings, sfx } from '../../audio.js';
import { useAudioSettings } from '../useAudioSettings.js';

function SoundSettings() {
  const s = useAudioSettings();
  const row = (key, label, hint) => (
    <div style={{ marginTop: 12 }}>
      <div className="row between small"><b>{label}</b><span className="muted">{Math.round(s[key] * 100)}%</span></div>
      <input type="range" min="0" max="1" step="0.05" value={s[key]} disabled={s.muted} onChange={(e) => setAudioSettings({ [key]: Number(e.target.value) })} onPointerUp={() => key === 'sfx' && sfx('coin')} style={{ width: '100%', accentColor: 'var(--green)' }} />
      {hint && <div className="hint" style={{ marginTop: 0 }}>{hint}</div>}
    </div>
  );
  return (
    <div className="box">
      <div className="row between">
        <div className="bold">{L('Sauti', 'Sound')}</div>
        <button className={`btn btn-xs ${s.muted ? 'btn-green' : 'btn-ghost'}`} onClick={() => setAudioSettings({ muted: !s.muted })}>{s.muted ? L('🔇 Imezimwa', '🔇 Muted') : L('🔊 Inawaka', '🔊 On')}</button>
      </div>
      {row('music', L('Muziki wa mtaani', 'Venue music'), L('Club, bar na studio. Punguza kama unasikiliza muziki wako mwenyewe.', 'Clubs, bars and the studio. Turn down if you are playing your own music.'))}
      {row('sfx', L('Sauti za mchezo', 'Game effects'))}
      {row('ambience', L('Mazingira', 'Ambience'), L('Kelele za mji, mawimbi ya bahari na injini.', 'City hum, ocean waves and engines.'))}
    </div>
  );
}

export function Kabati({ back }) {
  const me = useStore((s) => s.me);
  const run = useStore((s) => s.run);
  const [a, setA] = useState(me.appearance);
  const owned = OUTFITS.filter((o) => (o.price === 0 && outfitFits(o, a.body)) || me.outfits.includes(o.id));
  const save = async () => {
    const r = await run('/me/profile', { method: 'POST', body: { appearance: a } });
    if (r) {
      useStore.setState({ me: r });
      useStore.getState().toast(L('👗 Umependeza!', '👗 Looking good!'));
    }
  };
  return (
    <>
      <AppHead title={L('Kabati', 'Wardrobe')} onBack={back} right={<button className="btn btn-green btn-sm" onClick={save}>{L('Hifadhi', 'Save')}</button>} />
      <div className="app-body">
        <div style={{ height: 220, background: 'linear-gradient(180deg,#dbe9f7,#fff)', borderRadius: 18 }}>
          <AvatarPreview appearance={a} />
        </div>
        <div className="label">{L('Nguo zako', 'Your outfits')}</div>
        <div className="chips">
          {owned.map((o) => <button key={o.id} className={`chip ${a.outfit === o.id ? 'on' : ''}`} onClick={() => setA({ ...a, outfit: o.id })}><Swatch o={o} />{loc(o)}</button>)}
        </div>
        <div className="hint">{L('Nunua nguo zaidi Kariakoo Fashion au Mlimani City.', 'Buy more outfits at Kariakoo Fashion or Mlimani City.')}</div>
        <div className="label">{L('Nywele', 'Hairstyle')}</div>
        <div className="chips">
          {HAIRSTYLES.map((h) => <button key={h.id} className={`chip ${a.hair === h.id ? 'on' : ''}`} onClick={() => setA({ ...a, hair: h.id })}>{loc(h)}</button>)}
        </div>
        <div className="label">{L('Rangi ya nywele', 'Hair colour')}</div>
        <div className="swatches">
          {HAIR_COLORS.map((c, i) => <button key={c} className={`swatch ${a.hairColor === i ? 'on' : ''}`} style={{ background: c }} onClick={() => setA({ ...a, hairColor: i })} aria-label={c} />)}
        </div>
      </div>
    </>
  );
}

export function Mipangilio({ back }) {
  const me = useStore((s) => s.me);
  const quality = useStore((s) => s.quality);
  const setQuality = useStore((s) => s.setQuality);
  const logout = useStore((s) => s.logout);
  const trait = TRAITS.find((t) => t.id === me.trait);
  const row = (label, value) => (
    <div className="row between" style={{ marginTop: 8 }}><span className="muted">{label}</span><b>{value}</b></div>
  );
  return (
    <>
      <AppHead title={L('Mipangilio', 'Settings')} onBack={back} />
      <div className="app-body">
        <div className="box">
          {row(L('Jina', 'Name'), me.name)}
          {row('Username', `@${me.username}`)}
          {row(L('Tabia', 'Personality'), `${trait?.emoji} ${loc(trait)}`)}
          {row(L('Elimu', 'Education'), `Level ${me.elimu}`)}
          {row(L('Umaarufu', 'Fame'), `⭐ ${me.fame}`)}
          {row(L('Mjini tangu', 'In the city since'), new Date(me.createdAt).toLocaleDateString())}
        </div>
        <SoundSettings />
        <div className="box">
          <div className="bold" style={{ marginBottom: 8 }}>{L('Lugha', 'Language')}</div>
          <LangToggle full />
        </div>
        <div className="box">
          <div className="bold" style={{ marginBottom: 8 }}>Graphics</div>
          <div className="seg" style={{ marginBottom: 0 }}>
            {[['low', L('Chini', 'Low')], ['auto', 'Auto'], ['high', L('Juu', 'High')]].map(([id, n]) => (
              <button key={id} className={quality === id ? 'on' : ''} onClick={() => setQuality(id)}>{n}</button>
            ))}
          </div>
          <div className="hint">{L('Chagua "Chini" kama simu yako inakwama au betri inaisha haraka.', 'Choose "Low" if your phone lags or the battery drains fast.')}</div>
        </div>
        <div className="box small muted" style={{ lineHeight: 1.6 }}>
          <b style={{ color: 'var(--ink)' }}>{L('Jinsi ya kucheza', 'How to play')}</b><br />
          {L(
            <>• Gusa ardhi kutembea, au tumia joystick / WASD.<br />• Gusa jengo lenye alama kwenda huko na kuona shughuli.<br />• Njaa, Nguvu, Raha, Usafi na Jamii zikishuka, mood na mshahara vinashuka.<br />• Nunua usafiri, viwanja na biashara — tajiri namba 1 ndiye Mkuu wa Mkoa 👑</>,
            <>• Tap the ground to walk, or use the joystick / WASD.<br />• Tap a building with an icon to go there and see activities.<br />• When Hunger, Energy, Fun, Hygiene or Social drop, your mood and pay drop too.<br />• Buy vehicles, plots and businesses — the richest player becomes Mayor 👑</>,
          )}
        </div>
        {me.isAdmin && (
          <a className="btn btn-dark btn-block" style={{ marginBottom: 10 }} href="/admin">🛠️ Admin panel</a>
        )}
        <div className="row small" style={{ justifyContent: 'center', gap: 16, marginBottom: 10 }}>
          <a href="/terms" target="_blank">{L('Masharti', 'Terms')}</a>
          <a href="/privacy" target="_blank">{L('Faragha', 'Privacy')}</a>
          <a href="/ads-policy" target="_blank">{L('Matangazo', 'Ad Policy')}</a>
        </div>
        <button className="btn btn-ghost btn-block red" onClick={logout}>{L('Toka (Logout)', 'Log out')}</button>
      </div>
    </>
  );
}
