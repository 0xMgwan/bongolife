// Transactional email (password reset codes) via Resend's HTTP API.
// Set RESEND_API_KEY and MAIL_FROM (e.g. "Bongo Life <no-reply@yourdomain.com>").
// Without a key (dev), the message is printed to the server log instead.
export const mailEnabled = () => !!process.env.RESEND_API_KEY;
export const mailFrom = () => process.env.MAIL_FROM || 'Bongo Life <onboarding@resend.dev>';

// Recent send attempts (newest first) so admins can see why mail isn't arriving.
const recent = [];
const mask = (e) => String(e).replace(/^(.).*?(.)?@/, (_m, a, b) => `${a}***${b || ''}@`);
const record = (entry) => { recent.unshift({ at: Date.now(), ...entry }); recent.length = Math.min(recent.length, 20); };

export function mailStatus() {
  const from = mailFrom();
  const warnings = [];
  if (!mailEnabled()) warnings.push('RESEND_API_KEY is not set — reset codes are only printed to the server log, no email is sent.');
  if (/@resend\.dev>?$/i.test(from)) warnings.push('MAIL_FROM uses Resend\'s test sender (onboarding@resend.dev), which only delivers to the Resend account owner. Verify bongolife.app in Resend and set MAIL_FROM to e.g. "Bongo Life <no-reply@bongolife.app>".');
  return { enabled: mailEnabled(), from, warnings, recent };
}

export async function sendMail({ to, subject, text, html, kind = 'mail' }) {
  if (!mailEnabled()) {
    console.log(`[mail:dev] to=${to} subject=${subject}\n${text}`);
    record({ kind, to: mask(to), ok: false, error: 'RESEND_API_KEY not set (logged only)' });
    return false;
  }
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: mailFrom(), to, subject, text, html }),
    });
    const body = await r.text().catch(() => '');
    if (!r.ok) console.error('[mail] send failed', r.status, body);
    record({ kind, to: mask(to), ok: r.ok, status: r.status, error: r.ok ? null : body.slice(0, 300) });
    return r.ok;
  } catch (e) {
    console.error('[mail] send error', e);
    record({ kind, to: mask(to), ok: false, error: String(e?.message || e).slice(0, 300) });
    return false;
  }
}
