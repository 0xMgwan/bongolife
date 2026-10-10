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
// Email-safe HTML in the www.bongolife.app style: cream paper, ink outlines, gold, condensed caps.
// Tables + inline styles only; images are PNG/JPG on the landing site (email apps don't show SVG).
// Archivo loads in Apple Mail / iOS; Gmail and Outlook fall back to Arial Narrow / Arial.
const PLAY = 'https://play.bongolife.app';
const ASSETS = () => (env('MAIL_ASSETS_URL') || 'https://www.bongolife.app/assets/email').replace(/\/$/, '');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const FONT = "'Plus Jakarta Sans',-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const DISPLAY = "'Archivo','Arial Narrow','Helvetica Neue Condensed',Arial,sans-serif";
const INK = '#141414';
const GOLD = '#f5b800';
const PAPER = '#fffdf8';
const CREAM = '#f6f1e6';

const headline = (text, size = 38, color = INK) =>
  `<div style="font-family:${DISPLAY};font-stretch:75%;font-size:${size}px;line-height:.95;font-weight:900;letter-spacing:-.5px;text-transform:uppercase;color:${color}">${text}</div>`;
const kicker = (text, bg = INK, fg = GOLD) =>
  `<span style="display:inline-block;background:${bg};color:${fg};font-family:${FONT};font-weight:800;font-size:11px;letter-spacing:2px;padding:6px 11px;border-radius:999px;border:2px solid ${INK}">${text}</span>`;
const button = (href, label) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" align="center"><tr><td style="background:${GOLD};border:3px solid ${INK};border-radius:999px;box-shadow:4px 4px 0 ${INK}">` +
  `<a href="${href}" style="display:inline-block;padding:15px 30px;font-family:${FONT};font-weight:800;font-size:16px;color:${INK};text-decoration:none">${label}</a></td></tr></table>`;
const tile = (emoji, title, text, bg) =>
  `<td width="33%" valign="top" style="padding:5px"><div style="background:${bg};border-radius:16px;padding:12px;border:2px solid ${INK};font-family:${FONT}">` +
  `<div style="font-size:24px;line-height:1">${emoji}</div><div style="font-family:${DISPLAY};font-stretch:80%;font-weight:900;font-size:15px;text-transform:uppercase;color:${INK};margin:6px 0 3px">${title}</div>` +
  `<div style="font-size:12px;color:#3d3a35;line-height:1.35">${text}</div></div></td>`;
const social = (href, label, bg, fg = '#fff') =>
  `<a href="${href}" style="display:inline-block;margin:3px;padding:8px 14px;border-radius:999px;background:${bg};color:${fg};border:2px solid ${INK};text-decoration:none;font-family:${FONT};font-size:13px;font-weight:800">${label}</a>`;

function layout({ preheader, body, unsub, hero = false }) {
  return `<!doctype html><html lang="sw"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light">
<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,800..900&family=Plus+Jakarta+Sans:wght@500;700;800&display=swap" rel="stylesheet">
<title>Bongo Life</title></head>
<body style="margin:0;padding:0;background:${CREAM};">
<span style="display:none!important;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};padding:22px 10px;font-family:${FONT};">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${PAPER};border-radius:22px;overflow:hidden;border:3px solid ${INK};box-shadow:7px 7px 0 ${INK};">
<tr><td style="background:${GOLD};padding:14px 18px;border-bottom:3px solid ${INK}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
    <td valign="middle" width="46"><img src="${ASSETS()}/logo-192.png" width="40" height="40" alt="" style="display:block;border:0;border-radius:10px;background:#fff"></td>
    <td valign="middle" style="font-family:${DISPLAY};font-stretch:75%;font-weight:900;font-size:24px;letter-spacing:.5px;color:${INK};text-transform:uppercase">Bongo Life</td>
    <td valign="middle" align="right">${kicker('🇹🇿 METAVERSE')}</td>
  </tr></table>
</td></tr>
${hero ? `<tr><td style="border-bottom:3px solid ${INK};line-height:0;font-size:0"><a href="${PLAY}"><img src="${ASSETS()}/hero.jpg" width="554" alt="Bongo Life — Dar es Salaam" style="display:block;width:100%;height:auto;border:0"></a></td></tr>` : ''}
${body}
<tr><td style="padding:20px 22px 22px;border-top:3px solid ${INK};background:${INK}" align="center">
  <div style="font-family:${DISPLAY};font-stretch:78%;font-weight:900;font-size:18px;color:${GOLD};text-transform:uppercase;margin-bottom:10px">Tufuate · Follow us</div>
  ${social('https://www.instagram.com/bongolifegames', 'Instagram', '#e1306c')}${social('https://www.tiktok.com/@bongolifegames', 'TikTok', '#ffffff', INK)}${social('https://chat.whatsapp.com/KCgM5FOmzQE6byU18abpB1', 'WhatsApp', '#25d366')}
  <div style="font-size:11.5px;color:#b8b2a6;margin-top:14px;line-height:1.55;font-family:${FONT}">Bongo Life · NEDA Labs Limited · Dar es Salaam 🇹🇿<br>Umepokea email hii kwa sababu umejisajili Bongo Life. · You're getting this because you signed up for Bongo Life.${unsub ? `<br><a href="${unsub}" style="color:#b8b2a6">Acha kupokea habari · Unsubscribe from updates</a>` : ''}</div>
</td></tr>
</table></td></tr></table></body></html>`;
}

/** The welcome email for a new player. */
export function welcomeEmail({ name, username, startMoney }) {
  const first = esc(String(name || username).split(' ')[0]);
  const invite = `${PLAY}/?ref=${encodeURIComponent(username)}`;
  const money = Number(startMoney || 0).toLocaleString('en-US');
  const body = `
<tr><td style="padding:26px 24px 8px;font-family:${FONT}">
  ${kicker('TIKETI YA KUZALIWA · BIRTH TICKET', GOLD, INK)}
  <div style="height:12px"></div>
  ${headline(`Karibu Bongo,<br><span style="color:${GOLD};text-shadow:2px 2px 0 ${INK}">${first}!</span>`, 44)}
  <p style="font-size:15px;color:${INK};line-height:1.6;margin:16px 0 6px">Mambo <b>@${esc(username)}</b>! 👋🏾 Umeingia mtaani na <b>TSh ${money}</b> mfukoni na Toyota IST yako. Chakarika, kula bata, jenga jina — na fuata ndoto zako.</p>
  <p style="font-size:14px;color:#6b655b;line-height:1.6;margin:0 0 22px">You've landed with <b>TSh ${money}</b> in your pocket and your own Toyota IST. Hustle, party, build a name — and chase your ambition.</p>
  ${button(PLAY, 'Cheza sasa · Play now →')}
</td></tr>
<tr><td style="padding:22px 19px 6px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
    ${tile('💼', 'Kazi', 'Shifti, vyeo, mshahara. Work shifts, get promoted.', '#dcfce7')}
    ${tile('🌟', 'Ndoto', 'Staa, tajiri, Meya… Pick your life path.', '#fff4cc')}
    ${tile('🍾', 'Bata', '1245 VIP, tip DJ, rusha pesa. Nightlife.', '#ffd6e2')}
  </tr><tr>
    ${tile('🏢', 'Kampuni', 'Anzisha biashara. Start a company.', '#dbeafe')}
    ${tile('⛴️', 'Safari', 'Zanzibar & Arusha. Ferry, flights.', '#ede9fe')}
    ${tile('💞', 'Penzi', 'Deti, pete, harusi. Dates & weddings.', '#ffe4e6')}
  </tr></table>
</td></tr>
<tr><td style="padding:16px 24px 26px;font-family:${FONT}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:3px dashed ${INK};border-radius:16px;background:${GOLD}"><tr>
    <td style="padding:16px 18px">
      ${headline('🎁 Alika washkaji', 22)}
      <div style="color:#3f2d00;font-size:13px;line-height:1.5;margin:6px 0 10px">Mshkaji akijiunga kwa link yako na kumaliza shifti ya kwanza, mnapata zawadi wote wawili. · Friends who join with your link — you both get a bonus.</div>
      <a href="${invite}" style="display:inline-block;background:${INK};color:${GOLD};font-size:13px;font-weight:700;padding:8px 12px;border-radius:10px;text-decoration:none;word-break:break-all">${invite}</a>
    </td>
  </tr></table>
  <p style="font-size:12.5px;color:#8a8478;line-height:1.5;margin:16px 0 0">💡 Weka Bongo Life kwenye Home Screen ya simu yako — inafunguka kama app. · Add it to your home screen for the full-screen app.</p>
</td></tr>`;
  return {
    subject: `Karibu Bongo, ${String(name || username).split(' ')[0]}! 👑 Your Dar life starts now`,
    text: `Karibu Bongo Life, @${username}!\n\nUmeanza na TSh ${money} na Toyota IST yako.\nYou start with TSh ${money} and your own Toyota IST.\n\nCheza sasa / Play now: ${PLAY}\nAlika washkaji / Invite friends: ${invite}\n\nInstagram: https://www.instagram.com/bongolifegames\nTikTok: https://www.tiktok.com/@bongolifegames\nWhatsApp: https://chat.whatsapp.com/KCgM5FOmzQE6byU18abpB1`,
    html: layout({ preheader: `Karibu Bongo, ${first}! Your Dar es Salaam life starts now 🇹🇿`, body, hero: true }),
  };
}

/** Password reset code. */
export function resetEmail({ name, username, code }) {
  const body = `
<tr><td style="padding:28px 24px;font-family:${FONT}" align="center">
  <div style="font-size:40px;line-height:1">🔑</div>
  <div style="height:8px"></div>
  ${headline('Code yako · Your code', 30)}
  <p style="font-size:14px;color:#3d3a35;line-height:1.6;margin:12px 0 18px">Mambo ${esc(name || username)}, hii ni code ya kubadilisha password ya <b>@${esc(username)}</b>.<br>Here's the code to reset the password for <b>@${esc(username)}</b>.</p>
  <div style="display:inline-block;background:${INK};color:${GOLD};font-family:${DISPLAY};font-size:40px;font-weight:900;letter-spacing:10px;padding:14px 22px 14px 32px;border-radius:16px;border:3px solid ${INK};box-shadow:4px 4px 0 ${GOLD}">${esc(code)}</div>
  <p style="font-size:12.5px;color:#8a8478;line-height:1.6;margin:20px 0 0">Inaisha baada ya dakika 15 · Expires in 15 minutes.<br>Kama hukuomba, puuza email hii · If you didn't ask, ignore this email.</p>
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
  const paras = (t, color) => String(t || '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
    .map((p) => `<p style="font-size:15px;color:${color};line-height:1.6;margin:0 0 12px">${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
  const url = /^https:\/\//.test(ctaUrl || '') ? ctaUrl : PLAY;
  const html = `
<tr><td style="padding:26px 24px 6px;font-family:${FONT}">
  ${kicker("HABARI MPYA · WHAT'S NEW", GOLD, INK)}
  <div style="height:12px"></div>
  ${headline(esc(title), 40)}
  ${titleEn ? `<div style="font-size:15px;color:#6b655b;margin-top:8px;font-weight:700">${esc(titleEn)}</div>` : ''}
</td></tr>
<tr><td style="padding:16px 24px 6px;font-family:${FONT}">
  <p style="font-size:15px;color:${INK};line-height:1.6;margin:0 0 12px">Mambo ${name}! 👋🏾</p>
  ${paras(body, INK)}
  ${bodyEn ? `<div style="border-top:2px dashed #d9d1bf;margin:16px 0 14px"></div>${paras(bodyEn, '#6b655b')}` : ''}
</td></tr>
<tr><td style="padding:10px 24px 28px">${button(url, esc(cta || 'Cheza sasa · Play now →'))}</td></tr>`;
  return {
    subject: subject || `Bongo Life: ${title}`,
    text: `${title}${titleEn ? ` / ${titleEn}` : ''}\n\nMambo ${user.name || user.username}!\n\n${body}${bodyEn ? `\n\n---\n\n${bodyEn}` : ''}\n\n${url}\n\nAcha kupokea habari / Unsubscribe: ${user.id ? unsubUrl(user.id) : ''}`,
    html: layout({ preheader: titleEn || title, body: html, unsub: user.id ? unsubUrl(user.id) : null, hero: true }),
  };
}
