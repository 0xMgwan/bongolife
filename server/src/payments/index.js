// Real-money payments (wallet top-ups and billboard ads).
//  - payguard: Wooble (powered by PayGuard) mobile-money collection — a USSD push to the
//              player's M-Pesa / Mixx by Yas / Airtel Money. Callbacks are NOT signed, so they only
//              trigger a status Inquiry; only an Inquiry SUCCESS ever credits anyone.
//  - ntzs:     the previous provider. No longer used for new payments; kept so any of its
//              payments still pending can settle (only if NTZS_API_KEY is still set).
//  - demo:     simulated push for local development. Never enabled in production unless
//              ALLOW_DEMO_TOPUP=true is set explicitly.
import crypto from 'node:crypto';

const NTZS_BASE = process.env.NTZS_BASE_URL || 'https://www.ntzs.co.tz';
const NTZS_KEY = process.env.NTZS_API_KEY;
export const NTZS_WEBHOOK_SECRET = process.env.NTZS_WEBHOOK_SECRET;

// nTZS deposit lifecycle → our three states. Fiat confirmed or later = paid.
const PAID = new Set(['fiat_confirmed', 'bank_approved', 'platform_approved', 'mint_pending', 'mint_requires_safe', 'mint_processing', 'minted', 'mint_failed', 'completed']);
const FAILED = new Set(['kyc_rejected', 'rejected', 'cancelled', 'failed', 'expired']);

async function ntzsFetch(path, init = {}) {
  const res = await fetch(NTZS_BASE + path, {
    ...init,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${NTZS_KEY}`, ...(init.headers || {}) },
    signal: AbortSignal.timeout(20_000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    // nTZS puts the machine code in `code` or `error` depending on the endpoint.
    const code = body.code || body.error;
    const msg = code === 'kyb_required'
      ? ['Malipo yamefikia kikomo cha muda. Jaribu baadaye.', 'Top-ups have hit a temporary limit. Please try later.']
      : code === 'invalid_phone'
        ? ['Namba ya simu si sahihi.', 'Invalid phone number.']
        : null;
    const err = new Error(body.message || (typeof body.error === 'string' ? body.error : `nTZS ${res.status}`));
    err.status = res.status >= 500 ? 502 : 400;
    err.code = code;
    err.userMessage = msg;
    console.warn('[ntzs]', res.status, code, body.message || '');
    throw err;
  }
  return body;
}

const ntzs = {
  id: 'ntzs',
  label: 'Mobile Money (nTZS)',
  livemode: !!NTZS_KEY?.startsWith('ntzs_live_'),
  methods: ['mobile_money', 'lipa_namba'],
  async create({ amountTzs, phone, method, user }) {
    const body = await ntzsFetch('/api/v1/deposits', {
      method: 'POST',
      headers: { 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify({
        amountTzs,
        paymentMethod: method,
        phoneNumber: phone,
        endUser: { reference: `bl_${user.id}`, name: user.name, phone },
      }),
    });
    return { ref: body.id, status: 'pending', instructions: typeof body.instructions === 'object' ? body.instructions : body.instructions ? { note: body.instructions } : null };
  },
  async check(ref) {
    if (!NTZS_KEY) return 'pending';
    const body = await ntzsFetch(`/api/v1/deposits/${encodeURIComponent(ref)}`);
    if (PAID.has(body.status)) return 'paid';
    if (FAILED.has(body.status)) return 'failed';
    return 'pending';
  },
};


// ------------------------------------------------------------ Wooble / PayGuard
const PG_LIVE = process.env.PAYGUARD_ENV?.trim().toLowerCase() === 'live';
const PG_BASE = (process.env.PAYGUARD_BASE_URL || (PG_LIVE ? 'https://secure.payguard.tz' : 'http://102.223.19.6:8010')).replace(/\/$/, '');
// Trimmed: a stray space or newline from pasting into the dashboard would make every login fail.
const PG_KEY = process.env.PAYGUARD_COLLECTION_KEY?.trim();
const PG_SECRET = process.env.PAYGUARD_COLLECTION_SECRET?.trim();
/** Shared token in the callback URL (?token=…) — callbacks carry no signature of their own. */
export const PAYGUARD_CALLBACK_TOKEN = process.env.PAYGUARD_CALLBACK_TOKEN;

// Access tokens last 15 min: cache one and renew a minute early.
let pgToken = null;
async function pgAuth(force = false) {
  if (!force && pgToken && pgToken.until > Date.now()) return pgToken.value;
  const res = await fetch(PG_BASE + '/api/client/auth/generate-token', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ apiKey: PG_KEY, apiSecret: PG_SECRET }),
    signal: AbortSignal.timeout(30_000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.data?.token) {
    console.warn('[payguard] token failed', res.status, body.message || '');
    const err = new Error(`PayGuard auth ${res.status}`);
    err.status = 502;
    throw err;
  }
  pgToken = { value: body.data.token, until: Date.now() + Math.max(60, (body.data.expires_in || 900) - 60) * 1000 };
  return pgToken.value;
}
async function pgFetch(path, init = {}, retried = false) {
  const res = await fetch(PG_BASE + path, {
    ...init,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${await pgAuth()}`, ...(init.headers || {}) },
    signal: AbortSignal.timeout(30_000),
  });
  const body = await res.json().catch(() => ({}));
  // Expired / rotated token: get a fresh one and retry once.
  if (res.status === 401 && !retried) {
    pgToken = null;
    return pgFetch(path, init, true);
  }
  return { status: res.status, body };
}
// Which mobile network a Tanzanian number is on (255 + 9 digits).
const NETWORKS = { Mpesa: ['74', '75', '76'], Tigo: ['65', '67', '71', '77'], Airtel: ['68', '69', '78'] };
export function networkOf(phone) {
  const p = String(phone || '').slice(3, 5);
  return Object.keys(NETWORKS).find((n) => NETWORKS[n].includes(p)) || null;
}
const pgError = (message, status = 400, code) => Object.assign(new Error(message), { status, code, userMessage:
  /phone/i.test(message) ? ['Namba ya simu si sahihi.', 'Invalid phone number.']
    : /amount|tariff/i.test(message) ? ['Kiasi hicho hakikubaliki. Jaribu kiasi kingine.', "That amount isn't accepted. Try another amount."]
      : null });
// Inquiry pacing (per the guide): nothing in the first 2 minutes, then at most once a minute,
// slowing to every 5 minutes after half an hour. A callback can ask for an immediate look.
const lastLook = new Map();
const payguard = {
  id: 'payguard',
  label: PG_LIVE ? 'Mobile Money' : 'Mobile Money (sandbox)',
  livemode: PG_LIVE,
  methods: ['mobile_money'],
  networks: ['Mpesa', 'Tigo', 'Airtel'],
  async create({ amountTzs, phone, user }) {
    const network = networkOf(phone);
    if (!network) throw Object.assign(new Error('unsupported network'), { status: 400, userMessage: ['Tunapokea M-Pesa, Mixx by Yas na Airtel Money tu. Tumia namba ya mitandao hiyo.', 'We accept M-Pesa, Mixx by Yas and Airtel Money only. Use a number on one of those networks.'] });
    if (amountTzs > 5_000_000) throw pgError('Amount should be less than 5,000,000');
    // Our own id: unique per payment, and the key for inquiries and callbacks.
    const ref = `BL${user.id}-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`.toUpperCase();
    const { status, body } = await pgFetch('/api/client/mno/checkout', {
      method: 'POST',
      body: JSON.stringify({ transactionId: ref, phoneNumber: phone, amount: amountTzs, provider: network }),
    });
    if (status !== 200 || body.success === false) {
      console.warn('[payguard] checkout rejected', status, body.message || '', ref);
      throw pgError(body.message || `PayGuard ${status}`, status >= 500 && status !== 501 ? 502 : 400, body.code);
    }
    console.log('[payguard] checkout', ref, network, amountTzs, body.data?.data || '');
    const name = { Mpesa: 'M-Pesa', Tigo: 'Mixx by Yas', Airtel: 'Airtel Money' }[network];
    return { ref, status: 'pending', instructions: { note: `${name}: weka PIN yako kwenye simu kuthibitisha. / Enter your ${name} PIN on your phone to confirm.` } };
  },
  async check(ref, { createdAt = 0, force = false } = {}) {
    const age = Date.now() - createdAt;
    const gap = age > 30 * 60_000 ? 5 * 60_000 : 60_000;
    if (!force && (age < (PG_LIVE ? 2 * 60_000 : 10_000) || Date.now() - (lastLook.get(ref) || 0) < gap)) return 'pending';
    lastLook.set(ref, Date.now());
    const { status, body } = await pgFetch(`/api/client/mno/inquire/${encodeURIComponent(ref)}`);
    if (status === 200 && body.data) {
      const st = body.data.status;
      console.log('[payguard] inquiry', ref, st, body.data.providerReceiptId || '');
      if (st === 'SUCCESS' && body.data.isPaid !== false) { lastLook.delete(ref); return 'paid'; }
      if (st === 'FAILED') { lastLook.delete(ref); return 'failed'; }
      return 'pending';
    }
    // Never reached PayGuard (e.g. a timeout on create): safe to call it failed after a while.
    if (/does not exist/i.test(body.message || '') && age > 15 * 60_000) return 'failed';
    if (status !== 200) console.warn('[payguard] inquiry', status, body.message || body.code || '', ref);
    return 'pending';
  },
};

/**
 * Admin check: can these keys log in, and in which environment? Tries the configured base URL
 * and the other one, so keys made for the wrong environment show up plainly. Never returns the secret.
 */
export async function diagnosePayguard() {
  const SANDBOX = 'http://102.223.19.6:8010';
  const LIVE = 'https://secure.payguard.tz';
  const tryLogin = async (base) => {
    try {
      const res = await fetch(base + '/api/client/auth/generate-token', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ apiKey: PG_KEY, apiSecret: PG_SECRET }), signal: AbortSignal.timeout(20_000),
      });
      const body = await res.json().catch(() => ({}));
      return { ok: res.ok && !!body.data?.token, status: res.status, message: body.message || null };
    } catch (e) {
      return { ok: false, status: 0, message: e.message };
    }
  };
  const out = {
    env: PG_LIVE ? 'live' : 'sandbox', baseUrl: PG_BASE, active: provider?.id || null,
    key: PG_KEY ? { length: PG_KEY.length, starts: PG_KEY.slice(0, 4), ends: PG_KEY.slice(-2) } : null,
    secret: PG_SECRET ? { length: PG_SECRET.length, expected: 64 } : null,
    callbackToken: !!PAYGUARD_CALLBACK_TOKEN,
  };
  if (!PG_KEY || !PG_SECRET) return { ...out, verdict: 'PAYGUARD_COLLECTION_KEY / PAYGUARD_COLLECTION_SECRET are not set on the server.' };
  out.configured = await tryLogin(PG_BASE);
  const other = PG_BASE === LIVE ? SANDBOX : LIVE;
  if (!out.configured.ok) out.other = { env: other === LIVE ? 'live' : 'sandbox', ...(await tryLogin(other)) };
  out.verdict = out.configured.ok ? `Keys work on ${out.env}. Payments are ready.`
    : out.other?.ok ? `These keys are ${out.other.env} keys — set PAYGUARD_ENV=${out.other.env} in Railway.`
      : out.secret.length !== 64 ? `The secret is ${out.secret.length} characters; PayGuard secrets are 64. Re-copy it (or click "New secret" in the Wooble portal).`
        : 'PayGuard rejected the key/secret in both sandbox and live. Check they are the Collection product\'s keys, the secret wasn\'t regenerated, and (for live) that this server\'s IP is whitelisted.';
  return out;
}

const demo = {
  id: 'demo',
  label: 'Demo (pesa za majaribio)',
  livemode: false,
  methods: ['mobile_money'],
  async create() {
    return { ref: `demo_${Date.now().toString(36)}`, status: 'pending', instructions: { note: 'Demo mode: malipo yatathibitishwa yenyewe baada ya sekunde chache.' } };
  },
  async check(ref) {
    const started = parseInt(ref.slice(5), 36);
    return Date.now() - started > 6000 ? 'paid' : 'pending';
  },
};

const demoAllowed = process.env.ALLOW_DEMO_TOPUP ? process.env.ALLOW_DEMO_TOPUP === 'true' : process.env.NODE_ENV !== 'production';

// New payments go through PayGuard when its keys are set; nTZS is retired.
export const provider = PG_KEY && PG_SECRET ? payguard : demoAllowed ? demo : null;
export const providers = { payguard, ntzs, demo };
export const TOPUP_RATE = Number(process.env.TOPUP_RATE) || 100;

/** Verify an nTZS webhook: HMAC-SHA256 over `${timestamp}.${rawBody}`, hex. */
export function verifyNtzsWebhook(rawBody, signature, timestamp) {
  if (!NTZS_WEBHOOK_SECRET || !signature || !timestamp) return false;
  // Reject stale deliveries (replay protection). Accept seconds or ms timestamps; anything
  // non-numeric is rejected rather than skipping the check.
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  const ms = ts < 1e12 ? ts * 1000 : ts;
  if (Math.abs(Date.now() - ms) > 10 * 60_000) return false;
  const expected = crypto.createHmac('sha256', NTZS_WEBHOOK_SECRET).update(`${timestamp}.${rawBody}`).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature).replace(/^sha256=/, ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
