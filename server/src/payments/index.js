// Wallet top-ups.
//  - ntzs: real mobile-money collection through the nTZS platform wallet. Deposits are made
//          WITHOUT a userId, so the money lands in your nTZS treasury, tagged with
//          endUser.reference = our player id. Credit happens on the signed `deposit.completed`
//          webhook, with status polling as a fallback.
//  - demo: simulated push for local development. Never enabled in production unless
//          ALLOW_DEMO_TOPUP=true is set explicitly.
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
    const body = await ntzsFetch(`/api/v1/deposits/${encodeURIComponent(ref)}`);
    if (PAID.has(body.status)) return 'paid';
    if (FAILED.has(body.status)) return 'failed';
    return 'pending';
  },
};

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

export const provider = NTZS_KEY ? ntzs : demoAllowed ? demo : null;
export const providers = { ntzs, demo };
export const TOPUP_RATE = Number(process.env.TOPUP_RATE) || 100;

/** Verify an nTZS webhook: HMAC-SHA256 over `${timestamp}.${rawBody}`, hex. */
export function verifyNtzsWebhook(rawBody, signature, timestamp) {
  if (!NTZS_WEBHOOK_SECRET || !signature || !timestamp) return false;
  // Reject stale deliveries (replay protection). Accept seconds or ms timestamps.
  const ts = Number(timestamp);
  if (Number.isFinite(ts)) {
    const ms = ts < 1e12 ? ts * 1000 : ts;
    if (Math.abs(Date.now() - ms) > 10 * 60_000) return false;
  }
  const expected = crypto.createHmac('sha256', NTZS_WEBHOOK_SECRET).update(`${timestamp}.${rawBody}`).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature).replace(/^sha256=/, ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
