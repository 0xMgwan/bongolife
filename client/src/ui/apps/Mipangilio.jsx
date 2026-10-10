import { useEffect, useState } from 'react';
import { token } from '../../api.js';
import { hapticsEnabled, setHaptics, onHaptics } from '../../haptics.js';
import { HAIRSTYLES, HAIR_COLORS, OUTFITS, TRAITS, outfitFits } from '@shared/world.js';
import { useStore } from '../../store.js';
import { AppHead } from '../Phone.jsx';
import { AvatarPreview, Swatch } from '../Creator.jsx';
import { LangToggle } from '../LangToggle.jsx';
import { L, loc } from '../../i18n.js';
import { setAudioSettings, sfx } from '../../audio.js';
import { useAudioSettings } from '../useAudioSettings.js';
import { InviteCard } from '../Invite.jsx';
import { InstallRow } from '../InstallApp.jsx';
import { Socials } from '../Socials.jsx';

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

function Haptics() {
  const [on, setOn] = useState(hapticsEnabled());
  useEffect(() => onHaptics(setOn), []);
  return (
    <div className="box">
      <div className="row between">
        <div>
          <div className="bold">📳 {L('Mitetemo (haptics)', 'Haptics & vibration')}</div>
          <div className="hint" style={{ marginTop: 2 }}>{L('Simu itetemeke ukibonyeza, ukilipwa au ukigongwa.', 'Feel taps, pay-outs, crashes and take-offs.')}</div>
        </div>
        <button className={`btn btn-xs ${on ? 'btn-green' : 'btn-ghost'}`} onClick={() => setHaptics(!on)}>{on ? L('Inawaka', 'On') : L('Imezimwa', 'Off')}</button>
      </div>
    </div>
  );
}

/** Change password + recovery email. */
function Security() {
  const me = useStore((s) => s.me);
  const run = useStore((s) => s.run);
  const toast = useStore((s) => s.toast);
  const [open, setOpen] = useState(null); // 'pw' | 'email' | 'name'
  const [name, setName] = useState(me.name || '');
  const [pw, setPw] = useState({ current: '', password: '', confirm: '' });
  const [email, setEmail] = useState(me.email || '');
  const [busy, setBusy] = useState(false);
  const changePw = async (e) => {
    e.preventDefault();
    if (pw.password !== pw.confirm) return toast(L('Password mpya hazifanani.', "New passwords don't match."), 'err');
    setBusy(true);
    const r = await run('/me/password', { method: 'POST', body: { current: pw.current, password: pw.password } });
    setBusy(false);
    if (!r) return;
    token.set(r.token);
    setPw({ current: '', password: '', confirm: '' });
    setOpen(null);
    toast(L('🔒 Password imebadilishwa. Vifaa vingine vimetolewa.', '🔒 Password changed. Other devices were signed out.'));
  };
  const saveName = async (e) => {
    e.preventDefault();
    const r = await run('/me/name', { method: 'POST', body: { name } });
    if (r) {
      setOpen(null);
      toast(L('✏️ Jina limebadilishwa.', '✏️ Name updated.'));
    }
  };
  const toggleUpdates = () => run('/me/email-updates', { method: 'POST', body: { on: !me.emailUpdates } });
  const saveEmail = async (e) => {
    e.preventDefault();
    const r = await run('/me/email', { method: 'POST', body: { email } });
    if (r) {
      setOpen(null);
      toast(L('📧 Email imehifadhiwa.', '📧 Email saved.'));
    }
  };
  return (
    <div className="box">
      <div className="bold" style={{ marginBottom: 6 }}>🔐 {L('Akaunti & usalama', 'Account & security')}</div>
      <div className="row between" style={{ marginTop: 8 }}>
        <span className="muted">{L('Jina', 'Name')}</span>
        <button className="btn btn-ghost btn-xs" onClick={() => { setName(me.name || ''); setOpen(open === 'name' ? null : 'name'); }}>{me.name} ✎</button>
      </div>
      {open === 'name' && (
        <form className="sec-form" onSubmit={saveName}>
          <input className="field" maxLength={40} placeholder={L('Jina lako', 'Your name')} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          <div className="hint">{L('@' + me.username + ' haibadiliki. Jina linaweza kubadilishwa mara moja kwa siku.', '@' + me.username + " stays the same. You can change your name once a day.")}</div>
          <button className="btn btn-green btn-sm" disabled={name.trim().length < 2 || name.trim() === me.name}>{L('Hifadhi', 'Save')}</button>
        </form>
      )}
      <div className="row between" style={{ marginTop: 10 }}>
        <span className="muted">{L('Email ya kurejesha', 'Recovery email')}</span>
        <button className="btn btn-ghost btn-xs" onClick={() => setOpen(open === 'email' ? null : 'email')}>{me.email ? me.email : L('Ongeza', 'Add')} ✎</button>
      </div>
      {!me.email && open !== 'email' && <div className="hint">{L('Bila email huwezi kurudisha password ukiisahau.', "Without an email you can't reset a forgotten password.")}</div>}
      {open === 'email' && (
        <form className="sec-form" onSubmit={saveEmail}>
          <input className="field" type="email" placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          <button className="btn btn-green btn-sm">{L('Hifadhi', 'Save')}</button>
        </form>
      )}
      {me.email && (
        <div className="row between" style={{ marginTop: 10 }}>
          <span className="muted">{L('Habari mpya kwa email', 'Update emails')}</span>
          <button className={`btn btn-xs ${me.emailUpdates ? 'btn-green' : 'btn-ghost'}`} onClick={toggleUpdates}>{me.emailUpdates ? L('Imewashwa ✓', 'On ✓') : L('Imezimwa', 'Off')}</button>
        </div>
      )}
      <div className="row between" style={{ marginTop: 10 }}>
        <span className="muted">Password</span>
        <button className="btn btn-ghost btn-xs" onClick={() => setOpen(open === 'pw' ? null : 'pw')}>{L('Badilisha', 'Change')} ✎</button>
      </div>
      {open === 'pw' && (
        <form className="sec-form" onSubmit={changePw}>
          <input className="field" type="password" placeholder={L('Password ya sasa', 'Current password')} value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} autoComplete="current-password" />
          <input className="field" type="password" placeholder={L('Password mpya (herufi 6+)', 'New password (6+ characters)')} value={pw.password} onChange={(e) => setPw({ ...pw, password: e.target.value })} autoComplete="new-password" />
          <input className="field" type="password" placeholder={L('Rudia password mpya', 'Repeat new password')} value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} autoComplete="new-password" />
          <button className="btn btn-green btn-sm" disabled={busy || !pw.current || pw.password.length < 6}>{L('Badilisha password', 'Change password')}</button>
        </form>
      )}
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
        {/* Pinned while the options scroll underneath, so every change stays in view. */}
        <div className="wardrobe-preview">
          <div className="wp-stage">
            <AvatarPreview appearance={a} />
          </div>
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
        <InviteCard />
        <Security />
        <SoundSettings />
        <Haptics />
        <InstallRow />
        <div className="box"><Socials /></div>
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
