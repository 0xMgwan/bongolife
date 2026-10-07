// Transactional email (password reset codes) via Resend's HTTP API.
// Set RESEND_API_KEY and MAIL_FROM (e.g. "Bongo Life <no-reply@yourdomain.com>").
// Without a key (dev), the message is printed to the server log instead.
export const mailEnabled = () => !!process.env.RESEND_API_KEY;

export async function sendMail({ to, subject, text, html }) {
  if (!mailEnabled()) {
    console.log(`[mail:dev] to=${to} subject=${subject}\n${text}`);
    return true;
  }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: process.env.MAIL_FROM || 'Bongo Life <onboarding@resend.dev>', to, subject, text, html }),
  });
  if (!r.ok) console.error('[mail] send failed', r.status, await r.text().catch(() => ''));
  return r.ok;
}
