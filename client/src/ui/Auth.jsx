import { useState } from 'react';
import { useStore } from '../store.js';
import { api, token } from '../api.js';
import { L } from '../i18n.js';
import { Crown } from './Logo.jsx';
import { LangToggle } from './LangToggle.jsx';

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
      </div>
    </div>
  );
}
