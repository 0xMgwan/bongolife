import { useState } from 'react';
import { useStore } from '../store.js';
import { api, token } from '../api.js';
import { L } from '../i18n.js';
import { Crown } from './Logo.jsx';
import { LangToggle } from './LangToggle.jsx';

/** Forgot password: request an emailed code, then set a new password with it. */
function Forgot({ onDone, onBack, initial }) {
  const set = useStore((s) => s.set);
  const [step, setStep] = useState(1);
  const [f, setF] = useState({ username: initial || '', code: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);
  const up = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const go = async (e) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      if (step === 1) {
        await api('/auth/forgot', { method: 'POST', body: { username: f.username.trim() } });
        setStep(2);
      } else {
        const r = await api('/auth/reset', { method: 'POST', body: { username: f.username.trim(), code: f.code, password: f.password } });
        token.set(r.token);
        set({ me: r.me, screen: r.me.onboarded ? 'game' : 'creator' });
        onDone?.();
      }
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="card" style={{ padding: 18 }} onSubmit={go}>
      <h3 style={{ margin: '2px 0 6px' }}>🔑 {L('Umesahau password?', 'Forgot your password?')}</h3>
      {step === 1 ? (
        <>
          <p className="muted small" style={{ marginTop: 0 }}>{L('Andika username au email yako. Tutatuma code ya tarakimu 6 kwenye email uliyosajili nayo.', "Enter your username or email. We'll send a 6-digit code to the email on your account.")}</p>
          <input className="field" placeholder={L('@username au email', '@username or email')} value={f.username} onChange={up('username')} autoCapitalize="none" autoCorrect="off" autoComplete="username" />
        </>
      ) : (
        <>
          <p className="muted small" style={{ marginTop: 0 }}>{L('Kama akaunti ina email, code imetumwa. Angalia inbox (na spam). Inaisha baada ya dakika 15.', 'If the account has an email, a code is on its way. Check your inbox (and spam). It expires in 15 minutes.')}</p>
          <div className="label">{L('Code ya tarakimu 6', '6-digit code')}</div>
          <input className="field" inputMode="numeric" maxLength={6} placeholder="123456" value={f.code} onChange={up('code')} autoComplete="one-time-code" style={{ letterSpacing: 6, fontWeight: 800 }} />
          <div className="label">{L('Password mpya', 'New password')}</div>
          <input className="field" type="password" value={f.password} onChange={up('password')} autoComplete="new-password" />
          <div className="hint">{L('Angalau herufi 6.', 'At least 6 characters.')}</div>
        </>
      )}
      {err && <div className="err">{err}</div>}
      <button className="btn btn-green btn-block" style={{ marginTop: 16 }} disabled={busy || (step === 1 ? !f.username.trim() : f.code.length !== 6 || f.password.length < 6)}>
        {busy ? L('Subiri…', 'Please wait…') : step === 1 ? L('Nitumie code', 'Send me a code') : L('Badilisha & ingia', 'Reset & log in')}
      </button>
      {step === 2 && <button type="button" className="link-btn" onClick={() => setStep(1)}>{L('Sikupata code — tuma tena', "Didn't get it — send again")}</button>}
      <button type="button" className="link-btn" onClick={onBack}>‹ {L('Rudi kuingia', 'Back to log in')}</button>
      <p className="hint" style={{ marginTop: 10 }}>{L('Hukuweka email ulipojisajili? Wasiliana na msaada wa Bongo Life ukiwa na username yako.', "No email on your account? Contact Bongo Life support with your username.")}</p>
    </form>
  );
}

export default function Auth() {
  const tab = useStore((s) => s.authTab);
  const set = useStore((s) => s.set);
  const [f, setF] = useState({ name: '', username: '', password: '', email: '', agree: false });
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const up = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const signup = tab === 'signup';

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const body = signup ? { ...f, username: f.username.replace(/^@/, '') } : { username: f.username.replace(/^@/, ''), password: f.password };
      const r = await api(signup ? '/auth/signup' : '/auth/login', { method: 'POST', body });
      token.set(r.token);
      set({ me: r.me, screen: r.me.onboarded ? 'game' : 'creator' });
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  };
  const ready = signup ? f.name && f.username && f.password.length >= 6 && f.agree : f.username && f.password;

  return (
    <div className="auth">
      <div className="auth-inner">
        <div className="row between" style={{ marginBottom: 6 }}>
          <button className="round" onClick={() => set({ screen: 'landing' })} aria-label={L('Rudi', 'Back')}>‹</button>
          <LangToggle />
        </div>
        <div className="center"><Crown size={64} /></div>
        <h1>Bongo Life <span className="badge18">18+</span></h1>
        <p className="center muted" style={{ margin: '0 0 22px', fontSize: 16 }}>{L('Ishi maisha yako ya Dar na watu halisi.', 'Live your Dar story with real people.')}</p>
        {forgot ? <Forgot initial={f.username} onBack={() => setForgot(false)} /> : (
        <form className="card" style={{ padding: 18 }} onSubmit={submit}>
          <div className="tabs">
            <button type="button" className={signup ? 'on' : ''} onClick={() => set({ authTab: 'signup' })}>{L('Fungua akaunti', 'Create account')}</button>
            <button type="button" className={!signup ? 'on' : ''} onClick={() => set({ authTab: 'login' })}>{L('Ingia', 'Log in')}</button>
          </div>
          {signup && (
            <>
              <div className="label">{L('Jina lako', 'Your name')}</div>
              <input className="field" placeholder={L('mf. Neema Mushi', 'e.g. Neema Mushi')} value={f.name} onChange={up('name')} autoComplete="name" maxLength={40} />
            </>
          )}
          <div className="label">Username</div>
          <div className="at">
            <span>@</span>
            <input className="field" placeholder="neema_dar" value={f.username} onChange={up('username')} autoCapitalize="none" autoCorrect="off" autoComplete="username" maxLength={20} />
          </div>
          {signup && <div className="hint">{L('Hili ndilo jina la Sim wako ndani ya Bongo Life.', "This is your Sim's name in Bongo Life.")}</div>}
          <div className="label">Password</div>
          <div className="at">
            <input className="field" style={{ paddingLeft: 20, paddingRight: 48 }} type={show ? 'text' : 'password'} value={f.password} onChange={up('password')} autoComplete={signup ? 'new-password' : 'current-password'} />
            <button type="button" className="eye" onClick={() => setShow(!show)} aria-label={L('Onyesha password', 'Show password')}>{show ? '🙈' : '👁️'}</button>
          </div>
          {signup && <div className="hint">{L('Angalau herufi 6.', 'At least 6 characters.')}</div>}
          {!signup && <button type="button" className="link-btn right" onClick={() => setForgot(true)}>{L('Umesahau password?', 'Forgot password?')}</button>}
          {signup && (
            <>
              <div className="label">{L('Email (hiari)', 'Email (optional)')}</div>
              <input className="field" type="email" placeholder={L('wewe@email.com', 'you@email.com')} value={f.email} onChange={up('email')} autoComplete="email" />
              <div className="hint">
                {L(
                  'Inatumika tu kurudisha password ukiisahau. Bila email, password iliyopotea haiwezi kurudishwa.',
                  "Only used to reset your password if you forget it. Without one, a lost password can't be recovered.",
                )}
              </div>
              <label className="agree">
                <input type="checkbox" checked={f.agree} onChange={up('agree')} />
                {L(
                  <span>Nina <b>miaka 18 au zaidi</b> na nakubali <a href="/terms" target="_blank">Masharti</a> na <a href="/privacy" target="_blank">Sera ya Faragha</a>.</span>,
                  <span>I'm <b>18 or older</b> and I agree to the <a href="/terms" target="_blank">Terms</a> and <a href="/privacy" target="_blank">Privacy Policy</a>.</span>,
                )}
              </label>
            </>
          )}
          {err && <div className="err">{err}</div>}
          <button className="btn btn-green btn-block" style={{ marginTop: 18 }} disabled={!ready || busy}>
            {busy ? L('Subiri…', 'Please wait…') : signup ? L('Jisajili · ni bure', "Sign up · it's free") : L('Ingia Bongo', 'Log in')}
          </button>
        </form>
        )}
      </div>
    </div>
  );
}
