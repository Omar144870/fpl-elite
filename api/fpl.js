// GET /api/fpl?path=<fpl api path>  — a small, cached proxy to the official FPL API.
const { fetchFPL, isAllowed, ttlFor } = require('../lib/fpl-core');

module.exports = async (req, res) => {
  const path = (req.query && req.query.path) || '';
  if (!isAllowed(path)) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'path not allowed' }));
  }
  try {
    const data = await fetchFPL(path);
    const ttl = ttlFor(path);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', `public, s-maxage=${ttl}, stale-while-revalidate=${ttl * 4}`);
    res.statusCode = 200;
    res.end(JSON.stringify(data));
  } catch (e) {
    res.statusCode = e.status || 502;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify({ error: e.message || 'upstream error' }));
  }
};
