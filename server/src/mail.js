// Transactional + update emails.
// Transports, tried in this order (the first one configured is used; SMTP failures fall back to an API):
//   1. Resend — RESEND_API_KEY (HTTPS). Needs a verified sending domain, e.g. MAIL_FROM="Bongo Life <hello@bongolife.app>".
//   2. Brevo  — BREVO_API_KEY (HTTPS). MAIL_FROM must be a sender verified in Brevo.
//   3. SMTP   — SMTP_USER + SMTP_PASS (e.g. a Gmail app password). SMTP_HOST defaults to smtp.gmail.com, SMTP_PORT to 465.
//              Many hosts (Railway Hobby, Render free…) block outbound SMTP ports, so prefer an HTTPS API there.
//   4. None (dev) — the message is printed to the server log.
import crypto from 'node:crypto';
import nodemailer from 'nodemailer';

const env = (k) => process.env[k] || '';
const smtpReady = () => !!(env('SMTP_USER') && env('SMTP_PASS'));
const transports = () => [env('RESEND_API_KEY') && 'resend', env('BREVO_API_KEY') && 'brevo', smtpReady() && 'smtp'].filter(Boolean);
export const mailEnabled = () => transports().length > 0;
export const mailTransport = () => transports()[0] || 'off';
export const mailFrom = () => env('MAIL_FROM') || (smtpReady() ? `Bongo Life <${env('SMTP_USER')}>` : 'Bongo Life <onboarding@resend.dev>');

let smtp = null;
function smtpTransport() {
  if (smtp) return smtp;
  const port = Number(env('SMTP_PORT')) || 465;
  smtp = nodemailer.createTransport({
    host: env('SMTP_HOST') || 'smtp.gmail.com',
    port,
    secure: port === 465,
    auth: { user: env('SMTP_USER'), pass: env('SMTP_PASS') },
    pool: true,
    maxConnections: 2,
    // Fail fast when the host blocks SMTP instead of hanging for two minutes.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
  });
  return smtp;
}

// Recent send attempts (newest first) so admins can see why mail isn't arriving.
const recent = [];
const mask = (e) => String(e).replace(/^(.).*?(.)?@/, (_m, a, b) => `${a}***${b || ''}@`);
const record = (entry) => { recent.unshift({ at: Date.now(), ...entry }); recent.length = Math.min(recent.length, 20); };

export function mailStatus() {
  const from = mailFrom();
  const warnings = [];
  const t = mailTransport();
  if (!mailEnabled()) warnings.push('No email transport — set RESEND_API_KEY (recommended) or BREVO_API_KEY, or SMTP_USER + SMTP_PASS. Until then emails are only printed to the server log.');
  if (t === 'resend' && /@resend\.dev>?$/i.test(from)) warnings.push('MAIL_FROM uses Resend\'s test sender (onboarding@resend.dev), which only delivers to the Resend account owner. Verify bongolife.app in Resend and set MAIL_FROM="Bongo Life <hello@bongolife.app>".');
  const smtpTimeouts = recent.filter((r) => r.via === 'smtp' && !r.ok && /timeout|ETIMEDOUT|ECONNREFUSED/i.test(r.error || '')).length;
  if (smtpTimeouts) warnings.push('SMTP connections are timing out — this server\'s host blocks outbound SMTP (Railway does on the Hobby plan). Use an HTTPS email API instead: set RESEND_API_KEY or BREVO_API_KEY.');
  const last = recent.find((r) => r.kind !== 'update');
  return { enabled: mailEnabled(), transport: t, transports: transports(), from, warnings, recent, lastOk: last ? last.ok : null, campaign: campaignStatus() };
}

async function viaResend({ to, subject, text, html, headers }) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${env('RESEND_API_KEY')}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: mailFrom(), to, subject, text, html, headers }),
    signal: AbortSignal.timeout(15_000),
  });
  const body = await r.text().catch(() => '');
  return { ok: r.ok, status: r.status, error: r.ok ? null : body.slice(0, 300) };
}

async function viaBrevo({ to, subject, text, html, headers }) {
  const m = /^\s*(?:"?([^"<]*)"?\s*)?<([^>]+)>\s*$/.exec(mailFrom());
  const sender = m ? { name: (m[1] || 'Bongo Life').trim(), email: m[2] } : { name: 'Bongo Life', email: mailFrom() };
  const r = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': env('BREVO_API_KEY'), 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ sender, to: [{ email: to }], subject, textContent: text, htmlContent: html, headers }),
    signal: AbortSignal.timeout(15_000),
  });
  const body = await r.text().catch(() => '');
  return { ok: r.ok, status: r.status, error: r.ok ? null : body.slice(0, 300) };
}

async function viaSmtp({ to, subject, text, html, headers }) {
  const info = await smtpTransport().sendMail({ from: mailFrom(), to, subject, text, html, headers });
  return { ok: true, status: 250, error: null, id: info.messageId };
}

const SENDERS = { resend: viaResend, brevo: viaBrevo, smtp: viaSmtp };

export async function sendMail({ to, subject, text, html, kind = 'mail', headers }) {
  if (!mailEnabled()) {
    console.log(`[mail:dev] to=${to} subject=${subject}\n${text}`);
    record({ kind, to: mask(to), ok: false, error: 'No email transport configured (logged only)' });
    return false;
  }
  let lastErr = null;
  for (const via of transports()) {
    try {
      const res = await SENDERS[via]({ to, subject, text, html, headers });
      if (!res.ok) console.error(`[mail] ${via} failed`, res.status, res.error);
      record({ kind, to: mask(to), via, ...res });
      if (res.ok) return true;
      lastErr = res.error;
    } catch (e) {
      lastErr = String(e?.message || e).slice(0, 300);
      console.error(`[mail] ${via} error`, lastErr);
      record({ kind, to: mask(to), ok: false, via, error: lastErr });
    }
  }
  return false;
}

// ------------------------------------------------------------- update emails
// One-click unsubscribe links are signed so nobody can unsubscribe someone else.
const secret = () => env('JWT_SECRET') || 'dev-secret';
export const unsubToken = (userId) => crypto.createHmac('sha256', secret()).update(`unsub:${userId}`).digest('base64url').slice(0, 22);
export const checkUnsubToken = (userId, t) => {
  const want = unsubToken(userId);
  return typeof t === 'string' && t.length === want.length && crypto.timingSafeEqual(Buffer.from(t), Buffer.from(want));
};
const API_BASE = () => env('PUBLIC_API_URL') || 'https://play.bongolife.app';
export const unsubUrl = (userId) => `${API_BASE()}/api/unsubscribe?u=${userId}&t=${unsubToken(userId)}`;

let campaign = null;
function campaignStatus() {
  return campaign && { subject: campaign.subject, total: campaign.total, sent: campaign.sent, failed: campaign.failed, running: campaign.running, startedAt: campaign.startedAt };
}
/** Send an update email to every recipient, one at a time (API rate limits), in the background. */
export function startCampaign({ recipients, build }) {
  if (campaign?.running) return false;
  campaign = { subject: build(recipients[0] || {}).subject, total: recipients.length, sent: 0, failed: 0, running: true, startedAt: Date.now() };
  (async () => {
    for (const u of recipients) {
      const mail = build(u);
      const ok = await sendMail({ kind: 'update', to: u.email, ...mail, headers: { 'List-Unsubscribe': `<${unsubUrl(u.id)}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } }).catch(() => false);
      if (ok) campaign.sent++; else campaign.failed++;
      await new Promise((r) => setTimeout(r, 600));
    }
    campaign.running = false;
  })();
  return true;
}

// ------------------------------------------------------------------ templates
// Email-safe HTML: tables + inline styles, no SVG/webfonts required (they fall back gracefully).
const PLAY = 'https://play.bongolife.app';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const FONT = "'Plus Jakarta Sans',-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

function layout({ preheader, body, unsub }) {
  return `<!doctype html><html lang="sw"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>Bongo Life</title></head>
<body style="margin:0;padding:0;background:#f6f1e7;">
<span style="display:none!important;opacity:0;color:transparent;height:0;width:0;overflow:hidden">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f1e7;padding:24px 12px;font-family:${FONT};">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:24px;overflow:hidden;border:2px solid #111827;">
<tr><td style="background:#111827;padding:18px 24px;" align="left">
  <span style="font-size:26px;vertical-align:middle">👑</span>
  <span style="font-family:${FONT};font-size:20px;font-weight:800;color:#f5b800;vertical-align:middle;margin-left:6px">Bongo Life</span>
  <span style="float:right;font-size:12px;color:#9ca3af;line-height:30px">Metaverse ya Tanzania 🇹🇿</span>
</td></tr>
${body}
<tr><td style="padding:18px 24px 22px;border-top:1px solid #f1ece2;background:#fbf8f2;font-family:${FONT}" align="center">
  <div style="font-size:13px;color:#374151;margin-bottom:10px;font-weight:700">Tufuate · Follow us</div>
  <a href="https://www.instagram.com/bongolifegames" style="display:inline-block;margin:0 4px;padding:8px 14px;border-radius:999px;background:#e1306c;color:#fff;text-decoration:none;font-size:13px;font-weight:700">Instagram</a>
  <a href="https://www.tiktok.com/@bongolifegames" style="display:inline-block;margin:0 4px;padding:8px 14px;border-radius:999px;background:#111827;color:#fff;text-decoration:none;font-size:13px;font-weight:700">TikTok</a>
  <a href="https://chat.whatsapp.com/KCgM5FOmzQE6byU18abpB1" style="display:inline-block;margin:0 4px;padding:8px 14px;border-radius:999px;background:#25d366;color:#fff;text-decoration:none;font-size:13px;font-weight:700">WhatsApp</a>
  <div style="font-size:11.5px;color:#9ca3af;margin-top:14px;line-height:1.5">Bongo Life · NEDA Labs Limited · Dar es Salaam<br>Umepokea email hii kwa sababu umejisajili Bongo Life. · You're getting this because you signed up for Bongo Life.${unsub ? `<br><a href="${unsub}" style="color:#9ca3af">Acha kupokea habari · Unsubscribe from updates</a>` : ''}</div>
</td></tr>
</table></td></tr></table></body></html>`;
}
const button = (href, label) => `<a href="${href}" style="display:inline-block;background:#f5b800;color:#111827;font-weight:800;font-size:16px;text-decoration:none;padding:14px 28px;border-radius:999px;border:2px solid #111827;box-shadow:0 4px 0 #111827">${label}</a>`;
const tile = (emoji, title, text, bg) => `<td width="33%" valign="top" style="padding:6px"><div style="background:${bg};border-radius:16px;padding:12px;border:1.5px solid #111827;font-family:${FONT}"><div style="font-size:24px">${emoji}</div><div style="font-weight:800;font-size:13.5px;color:#111827;margin:4px 0 2px">${title}</div><div style="font-size:12px;color:#374151;line-height:1.35">${text}</div></div></td>`;

/** The welcome email for a new player. */
export function welcomeEmail({ name, username, startMoney }) {
  const first = esc(String(name || username).split(' ')[0]);
  const invite = `${PLAY}/?ref=${encodeURIComponent(username)}`;
  const body = `
<tr><td style="padding:0;background:linear-gradient(135deg,#fde68a,#f5b800);" align="center">
  <div style="padding:30px 24px 26px;font-family:${FONT}">
    <div style="font-size:44px;line-height:1">🏙️</div>
    <div style="font-size:30px;font-weight:900;color:#111827;margin-top:8px;letter-spacing:-.5px">Karibu Bongo, ${first}!</div>
    <div style="font-size:15px;color:#3f2d00;margin-top:6px">Welcome to Bongo Life — your Dar es Salaam life starts now.</div>
  </div>
</td></tr>
<tr><td style="padding:24px;font-family:${FONT}">
  <p style="font-size:15px;color:#111827;line-height:1.6;margin:0 0 14px">Mambo <b>@${esc(username)}</b>! 👋🏾 Umeingia mtaani na <b>TSh ${Number(startMoney || 0).toLocaleString()}</b> mfukoni na Toyota IST yako. Chakarika, kula bata, jenga jina — na ndoto zako.</p>
  <p style="font-size:14px;color:#4b5563;line-height:1.6;margin:0 0 20px">You've landed with <b>TSh ${Number(startMoney || 0).toLocaleString()}</b> in your pocket and your own Toyota IST. Hustle, party, build a name — and chase your ambition.</p>
  <div style="text-align:center;margin:6px 0 24px">${button(PLAY, 'Cheza sasa · Play now →')}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
    ${tile('💼', 'Kazi · Jobs', 'Piga shifti, panda cheo. Work shifts, get promoted.', '#dcfce7')}
    ${tile('🌟', 'Ndoto · Ambitions', 'Nyota, tajiri, Meya… Pick your life path.', '#fef3c7')}
    ${tile('💃', 'Bata · Nightlife', '1245, Elements, Kendwa. VIP & make it rain.', '#fce7f3')}
  </tr><tr>
    ${tile('🏢', 'Kampuni', 'Anzisha biashara yako. Start a company.', '#e0f2fe')}
    ${tile('⛴️', 'Safari', 'Zanzibar & Arusha. Ferry, flights, safari.', '#ede9fe')}
    ${tile('💘', 'Penzi', 'Deti, zawadi, harusi. Dates & weddings.', '#ffe4e6')}
  </tr></table>
  <div style="margin-top:22px;background:#111827;border-radius:18px;padding:16px 18px;font-family:${FONT}">
    <div style="color:#f5b800;font-weight:800;font-size:14px">🎁 Alika washkaji · Invite friends</div>
    <div style="color:#e5e7eb;font-size:13px;line-height:1.5;margin:6px 0 10px">Mkiingia kupitia link yako, mnapata zawadi wote wawili. Friends who join with your link — you both get a bonus.</div>
    <a href="${invite}" style="color:#fde68a;font-size:13px;word-break:break-all">${invite}</a>
  </div>
  <p style="font-size:12.5px;color:#9ca3af;line-height:1.5;margin:18px 0 0">💡 Weka Bongo Life kwenye Home Screen ya simu yako — inafunguka kama app. Add it to your home screen for the full-screen app.</p>
</td></tr>`;
  return {
    subject: `Karibu Bongo, ${String(name || username).split(' ')[0]}! 👑 Your Dar life starts now`,
    text: `Karibu Bongo Life, @${username}!\n\nUmeanza na TSh ${Number(startMoney || 0).toLocaleString()} na Toyota IST yako.\nYou start with TSh ${Number(startMoney || 0).toLocaleString()} and your own Toyota IST.\n\nCheza sasa / Play now: ${PLAY}\nAlika washkaji / Invite friends: ${invite}\n\nInstagram: https://www.instagram.com/bongolifegames\nTikTok: https://www.tiktok.com/@bongolifegames\nWhatsApp: https://chat.whatsapp.com/KCgM5FOmzQE6byU18abpB1`,
    html: layout({ preheader: `Karibu Bongo, ${first}! Your Dar es Salaam life starts now 🇹🇿`, body }),
  };
}

/** Password reset code. */
export function resetEmail({ name, username, code }) {
  const body = `
<tr><td style="padding:28px 24px;font-family:${FONT}" align="center">
  <div style="font-size:40px">🔑</div>
  <div style="font-size:22px;font-weight:900;color:#111827;margin:6px 0">Code yako · Your reset code</div>
  <p style="font-size:14px;color:#4b5563;line-height:1.6;margin:0 0 18px">Mambo ${esc(name || username)}, hii ni code ya kubadilisha password ya <b>@${esc(username)}</b>.<br>Here's the code to reset the password for <b>@${esc(username)}</b>.</p>
  <div style="display:inline-block;background:#111827;color:#f5b800;font-size:36px;font-weight:900;letter-spacing:10px;padding:14px 22px 14px 32px;border-radius:16px">${esc(code)}</div>
  <p style="font-size:12.5px;color:#9ca3af;line-height:1.6;margin:18px 0 0">Inaisha baada ya dakika 15 · Expires in 15 minutes.<br>Kama hukuomba, puuza email hii · If you didn't ask, ignore this email.</p>
</td></tr>`;
  return {
    subject: `Bongo Life: ${code} ni code yako / is your reset code`,
    text: `Code ya @${username}: ${code}\nYour Bongo Life reset code for @${username}: ${code}\nInaisha baada ya dakika 15 / Expires in 15 minutes.`,
    html: layout({ preheader: `Your reset code: ${code}`, body }),
  };
}

/** "What's new" email sent to players from the admin panel. Body text: blank lines split paragraphs. */
export function updateEmail({ user, subject, title, titleEn, body, bodyEn, cta, ctaUrl }) {
  const name = esc(String(user.name || user.username || '').split(' ')[0] || 'Mbongo');
  const paras = (t) => String(t || '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
    .map((p) => `<p style="font-size:15px;color:#111827;line-height:1.6;margin:0 0 12px">${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
  const url = /^https:\/\//.test(ctaUrl || '') ? ctaUrl : PLAY;
  const html = `
<tr><td style="padding:0;background:#f5b800;border-bottom:2px solid #111827" align="left">
  <div style="padding:26px 24px 22px;font-family:${FONT}">
    <div style="display:inline-block;background:#111827;color:#f5b800;font-weight:800;font-size:11px;letter-spacing:2px;padding:5px 10px;border-radius:999px">HABARI MPYA · WHAT'S NEW</div>
    <div style="font-size:30px;font-weight:900;color:#111827;margin-top:12px;line-height:1.05;letter-spacing:-.5px;text-transform:uppercase">${esc(title)}</div>
    ${titleEn ? `<div style="font-size:15px;color:#3f2d00;margin-top:6px;font-weight:700">${esc(titleEn)}</div>` : ''}
  </div>
</td></tr>
<tr><td style="padding:24px;font-family:${FONT}">
  <p style="font-size:15px;color:#111827;line-height:1.6;margin:0 0 12px">Mambo ${name}! 👋🏾</p>
  ${paras(body)}
  ${bodyEn ? `<div style="border-top:1px dashed #e5e7eb;margin:16px 0 14px"></div><div style="color:#4b5563">${paras(bodyEn).replace(/color:#111827/g, 'color:#4b5563')}</div>` : ''}
  <div style="text-align:center;margin:18px 0 6px">${button(url, esc(cta || 'Cheza sasa · Play now →'))}</div>
</td></tr>`;
  return {
    subject: subject || `Bongo Life: ${title}`,
    text: `${title}${titleEn ? ` / ${titleEn}` : ''}\n\nMambo ${user.name || user.username}!\n\n${body}${bodyEn ? `\n\n---\n\n${bodyEn}` : ''}\n\n${url}\n\nAcha kupokea habari / Unsubscribe: ${user.id ? unsubUrl(user.id) : ''}`,
    html: layout({ preheader: titleEn || title, body: html, unsub: user.id ? unsubUrl(user.id) : null }),
  };
}
