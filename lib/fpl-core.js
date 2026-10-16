// Shared server-side helpers: fetch from the official FPL API (or mock data locally).
const BASE = 'https://fantasy.premierleague.com/api/';

// Only these API paths may be proxied (keeps the proxy from being abused).
const ALLOWED = [
  /^bootstrap-static\/$/,
  /^fixtures\/(\?event=\d+)?$/,
  /^event\/\d+\/live\/$/,
  /^entry\/\d+\/$/,
  /^entry\/\d+\/history\/$/,
  /^entry\/\d+\/transfers\/$/,
  /^entry\/\d+\/event\/\d+\/picks\/$/,
  /^leagues-classic\/\d+\/standings\/(\?page_standings=\d+)?$/,
  /^element-summary\/\d+\/$/,
];

// How long the CDN may cache each kind of response (seconds).
function ttlFor(path) {
  if (path.startsWith('bootstrap-static')) return 120;
  if (path.includes('/live/')) return 30;
  if (path.startsWith('fixtures')) return 30;
  if (path.startsWith('leagues-classic')) return 60;
  if (path.startsWith('element-summary')) return 600;
  return 45;
}

function isAllowed(path) {
  return typeof path === 'string' && path.length < 120 && ALLOWED.some((re) => re.test(path));
}

const memo = new Map(); // small in-process cache (helps on warm serverless instances)

async function fetchFPL(path) {
  if (process.env.FPL_MOCK === '1') {
    const mock = require('./mock');
    const data = mock.route(path);
    if (data === undefined) {
      const err = new Error('Not found');
      err.status = 404;
      throw err;
    }
    return data;
  }
  const hit = memo.get(path);
  const ttl = ttlFor(path) * 1000;
  if (hit && Date.now() - hit.t < ttl) return hit.data;

  const r = await fetch(BASE + path, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36',
      Accept: 'application/json',
    },
  });
  const text = await r.text();
  if (!r.ok) {
    const err = new Error(r.status === 503 ? 'FPL is updating' : 'FPL error ' + r.status);
    err.status = r.status;
    throw err;
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    // FPL returns an HTML/text page while "The game is being updated"
    const err = new Error('FPL is updating');
    err.status = 503;
    throw err;
  }
  if (memo.size > 400) memo.clear();
  memo.set(path, { t: Date.now(), data });
  return data;
}

// Run async jobs with a concurrency limit.
async function pool(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      try {
        out[idx] = await fn(items[idx], idx);
      } catch (e) {
        out[idx] = null;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

module.exports = { fetchFPL, isAllowed, ttlFor, pool };
