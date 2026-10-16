// Client for the site's own proxy (/api/fpl) — the FPL API itself blocks direct browser calls.
const cache = new Map();

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function getJSON(url, { fresh = false, ttl = 60000 } = {}) {
  const hit = cache.get(url);
  if (!fresh && hit && Date.now() - hit.t < ttl) return hit.data;
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetch(url, { cache: fresh ? 'no-cache' : 'default' });
      if (!r.ok) {
        let msg = '';
        try { msg = (await r.json()).error; } catch (e) {}
        throw new ApiError(r.status, msg || 'HTTP ' + r.status);
      }
      const data = await r.json();
      cache.set(url, { t: Date.now(), data });
      return data;
    } catch (e) {
      lastErr = e;
      if (e instanceof ApiError && e.status < 500) break;
      await new Promise((res) => setTimeout(res, 600));
    }
  }
  throw lastErr instanceof ApiError ? lastErr : new ApiError(0, 'network');
}

export const fpl = (path, opts) => getJSON('/api/fpl?path=' + encodeURIComponent(path), opts);
export const elite = (gw) => getJSON('/api/elite?gw=' + gw, { ttl: 600000 });

// Run many requests with a small concurrency limit.
export async function pool(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  const worker = async () => {
    while (i < items.length) {
      const k = i++;
      try { out[k] = await fn(items[k], k); } catch (e) { out[k] = null; }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}
