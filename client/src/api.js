const TOKEN_KEY = 'bl_token';

export const token = {
  get: () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } },
  set: (t) => { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch {} },
};

export class ApiError extends Error {
  constructor(message, status, code) { super(message); this.status = status; this.code = code; }
}

export async function api(path, { method = 'GET', body, form } = {}) {
  const headers = { 'x-lang': (() => { try { return localStorage.getItem('bl_lang') || (/^sw/i.test(navigator.language) ? 'sw' : 'en'); } catch { return 'sw'; } })() };
  const t = token.get();
  if (t) headers.authorization = `Bearer ${t}`;
  if (body !== undefined) headers['content-type'] = 'application/json';
  let res;
  try {
    res = await fetch(`/api${path}`, { method, headers, body: form ?? (body !== undefined ? JSON.stringify(body) : undefined) });
  } catch {
    throw new ApiError(headers['x-lang'] === 'en' ? 'No connection. Check your internet.' : 'Hakuna mtandao. Angalia connection yako.', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || `Error (${res.status})`, res.status, data.code);
  return data;
}

export function visitorId() {
  try {
    let v = localStorage.getItem('bl_vid');
    if (!v) { v = crypto.randomUUID?.() || String(Math.random()).slice(2) + Date.now(); localStorage.setItem('bl_vid', v); }
    return v;
  } catch { return ''; }
}
