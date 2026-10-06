// Wallet top-up providers.
//  - ntzs: real mobile-money collection through the nTZS WaaS API (M-Pesa / Tigo Pesa /
//          Airtel Money push, or Lipa Namba). Funds land in the game's treasury nTZS user.
//  - demo: simulated push for local development. Never enabled in production unless
//          ALLOW_DEMO_TOPUP=true is set explicitly.

const NTZS_BASE = process.env.NTZS_BASE_URL || 'https://www.ntzs.co.tz';
const NTZS_KEY = process.env.NTZS_API_KEY;
const NTZS_TREASURY = process.env.NTZS_TREASURY_USER_ID;

// nTZS deposit lifecycle → our three states. Fiat confirmed or later = paid.
const PAID = new Set(['fiat_confirmed', 'bank_approved', 'platform_approved', 'mint_pending', 'mint_requires_safe', 'mint_processing', 'minted', 'mint_failed']);
const FAILED = new Set(['kyc_rejected', 'rejected', 'cancelled']);

async function ntzsFetch(path, init = {}) {
  const res = await fetch(NTZS_BASE + path, {
    ...init,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${NTZS_KEY}`, ...(init.headers || {}) },
    signal: AbortSignal.timeout(20_000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.message || body.error || `nTZS ${res.status}`);
    err.status = res.status >= 500 ? 502 : 400;
    throw err;
  }
  return body;
}

const ntzs = {
  id: 'ntzs',
  label: 'Mobile Money (nTZS)',
  livemode: !!NTZS_KEY?.startsWith('ntzs_live_'),
  methods: ['mobile_money', 'lipa_namba'],
  async create({ amountTzs, phone, method }) {
    const body = await ntzsFetch('/api/v1/deposits', {
      method: 'POST',
      body: JSON.stringify({ userId: NTZS_TREASURY, amountTzs, paymentMethod: method, phoneNumber: phone }),
    });
    return { ref: body.id, status: 'pending', instructions: body.instructions || null };
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
    return { ref: `demo_${Date.now().toString(36)}`, status: 'pending', instructions: { note: 'Demo mode: malipo yatathibitishwa yenyewe baada ya sekunde chache.' }, startedAt: Date.now() };
  },
  async check(ref) {
    const started = parseInt(ref.slice(5), 36);
    return Date.now() - started > 6000 ? 'paid' : 'pending';
  },
};

const demoAllowed = process.env.ALLOW_DEMO_TOPUP ? process.env.ALLOW_DEMO_TOPUP === 'true' : process.env.NODE_ENV !== 'production';

export const provider = NTZS_KEY && NTZS_TREASURY ? ntzs : demoAllowed ? demo : null;
export const providers = { ntzs, demo };
export const TOPUP_RATE = Number(process.env.TOPUP_RATE) || 100;
