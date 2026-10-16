// GET /api/elite?gw=N
// Samples the very top of the overall league so the app can show what elite managers own
// (effective ownership, captaincy, chips) and the points you need for each rank band.
const { fetchFPL, pool } = require('../lib/fpl-core');

const OVERALL = 314; // FPL's overall league
const PER_PAGE = 50;
const BANDS = [1, 500, 1000, 10000, 100000];

module.exports = async (req, res) => {
  const gw = parseInt((req.query && req.query.gw) || '0', 10);
  res.setHeader('Content-Type', 'application/json');
  if (!gw || gw < 1 || gw > 38) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ error: 'gw required' }));
  }
  try {
    // Rank cut-offs: the last row on the page that contains each rank.
    const pages = [...new Set(BANDS.map((r) => Math.ceil(r / PER_PAGE)))];
    const standings = await pool(pages, 5, (p) =>
      fetchFPL(`leagues-classic/${OVERALL}/standings/?page_standings=${p}`)
    );
    const byPage = {};
    pages.forEach((p, i) => (byPage[p] = standings[i]));
    const cutoffs = {};
    for (const r of BANDS) {
      const s = byPage[Math.ceil(r / PER_PAGE)];
      const rows = (s && s.standings && s.standings.results) || [];
      const row = rows.find((x) => x.rank >= r) || rows[rows.length - 1];
      if (row) cutoffs[r] = { total: row.total, event_total: row.event_total, rank: row.rank };
    }

    // Sample managers: the top 50 and ranks ~451-500.
    const sampleEntries = [];
    for (const p of [1, 10]) {
      const rows = (byPage[p] && byPage[p].standings && byPage[p].standings.results) || [];
      rows.forEach((x) => sampleEntries.push(x.entry));
    }
    const picks = await pool(sampleEntries, 12, (id) => fetchFPL(`entry/${id}/event/${gw}/picks/`));

    const eo = {}; // element -> summed multiplier
    const owned = {}; // element -> count in squad
    const cap = {};
    const chips = {};
    let n = 0;
    for (const p of picks) {
      if (!p || !p.picks) continue;
      n++;
      if (p.active_chip) chips[p.active_chip] = (chips[p.active_chip] || 0) + 1;
      for (const pk of p.picks) {
        owned[pk.element] = (owned[pk.element] || 0) + 1;
        eo[pk.element] = (eo[pk.element] || 0) + pk.multiplier;
        if (pk.is_captain) cap[pk.element] = (cap[pk.element] || 0) + 1;
      }
    }
    const pct = (o) => {
      const r = {};
      for (const k in o) r[k] = Math.round((o[k] / Math.max(n, 1)) * 1000) / 10;
      return r;
    };
    res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=3600');
    res.statusCode = 200;
    res.end(
      JSON.stringify({ gw, sample: n, cutoffs, eo: pct(eo), owned: pct(owned), captains: pct(cap), chips })
    );
  } catch (e) {
    res.statusCode = e.status || 502;
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify({ error: e.message || 'upstream error' }));
  }
};
