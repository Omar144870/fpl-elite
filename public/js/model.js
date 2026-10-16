// FPL Elite — prediction model and optimisers.
// Pure functions: no DOM, no network. Works in the browser and in Node (for tests).

export const POS = { 1: 'GKP', 2: 'DEF', 3: 'MID', 4: 'FWD' };
const GOAL_PTS = { 1: 10, 2: 6, 3: 5, 4: 4 };
const CS_PTS = { 1: 4, 2: 4, 3: 1, 4: 0 };
const DC_THRESHOLD = { 1: 99, 2: 10, 3: 12, 4: 12 };
// Per-90 priors used to shrink small samples.
const PRIOR = {
  xg: { 1: 0, 2: 0.05, 3: 0.15, 4: 0.33 },
  xa: { 1: 0.01, 2: 0.07, 3: 0.14, 4: 0.12 },
  bonus: { 1: 0.25, 2: 0.25, 3: 0.3, 4: 0.35 },
  dc: { 1: 0, 2: 8.5, 3: 6.5, 4: 3 },
  saves: 2.8,
  yc: 0.12,
};
const HOME = 1.12;
const AWAY = 0.89;
export const FORMATIONS = [
  [3, 4, 3], [3, 5, 2], [4, 3, 3], [4, 4, 2], [4, 5, 1], [5, 2, 3], [5, 3, 2], [5, 4, 1],
];

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// ---------- Poisson helpers ----------
function poissonPmf(l, k) {
  let p = Math.exp(-l);
  for (let i = 1; i <= k; i++) p *= l / i;
  return p;
}
function poissonAtLeast(l, t) {
  if (l <= 0) return 0;
  let s = 0;
  for (let k = 0; k < t; k++) s += poissonPmf(l, k);
  return clamp(1 - s, 0, 1);
}
// E[floor(X / d)] for X ~ Poisson(l)
function expFloorDiv(l, d) {
  if (l <= 0) return 0;
  let e = 0;
  for (let k = d; k < 25; k++) e += Math.floor(k / d) * poissonPmf(l, k);
  return e;
}

// ---------- Gameweek helpers ----------
export function gwInfo(bs) {
  const ev = bs.events || [];
  const cur = ev.find((e) => e.is_current) || null;
  const next = ev.find((e) => e.is_next) || null;
  const curId = cur ? cur.id : 0;
  const nextId = next ? next.id : null;
  return { current: curId, next: nextId, plan: nextId || curId || 1, events: ev, currentEvent: cur };
}

// ---------- Team strength ----------
export function teamRatings(bs, fixtures) {
  const teams = bs.teams;
  const games = {}, gf = {}, ga = {}, xgf = {}, xga = {};
  for (const t of teams) games[t.id] = gf[t.id] = ga[t.id] = xgf[t.id] = xga[t.id] = 0;
  for (const f of fixtures) {
    if (!(f.finished || f.finished_provisional) || f.team_h_score == null) continue;
    games[f.team_h]++; games[f.team_a]++;
    gf[f.team_h] += f.team_h_score; ga[f.team_h] += f.team_a_score;
    gf[f.team_a] += f.team_a_score; ga[f.team_a] += f.team_h_score;
  }
  for (const e of bs.elements) {
    if (xgf[e.team] === undefined) continue;
    xgf[e.team] += +e.expected_goals || 0;
    if (e.element_type === 1) xga[e.team] += +e.expected_goals_conceded || 0;
  }
  let totG = 0, totGames = 0;
  for (const t of teams) {
    totG += 0.7 * xgf[t.id] + 0.3 * gf[t.id];
    totGames += games[t.id];
  }
  const mu = totGames > 0 ? clamp(totG / totGames, 1.0, 1.9) : 1.4;

  const avg = (k) => teams.reduce((s, t) => s + (t[k] || 1100), 0) / teams.length;
  const aMean = (avg('strength_attack_home') + avg('strength_attack_away')) / 2;
  const dMean = (avg('strength_defence_home') + avg('strength_defence_away')) / 2;
  const out = {};
  for (const t of teams) {
    const G = games[t.id];
    const sa = ((t.strength_attack_home || 1100) + (t.strength_attack_away || 1100)) / 2;
    const sd = ((t.strength_defence_home || 1100) + (t.strength_defence_away || 1100)) / 2;
    const attPrior = Math.pow(sa / aMean, 3);
    const defPrior = Math.pow(dMean / sd, 3);
    let attData = attPrior, defData = defPrior;
    if (G > 0) {
      const gfPer = (0.7 * xgf[t.id] + 0.3 * gf[t.id]) / G;
      const xgaPer = xga[t.id] > 0 ? xga[t.id] / G : ga[t.id] / G;
      const gaPer = 0.7 * xgaPer + 0.3 * (ga[t.id] / G);
      attData = gfPer / mu;
      defData = gaPer / mu;
    }
    const w = G / (G + 8);
    out[t.id] = {
      att: clamp(w * attData + (1 - w) * attPrior, 0.45, 2.2),
      def: clamp(w * defData + (1 - w) * defPrior, 0.45, 2.2), // >1 = leaky
      games: G,
    };
  }
  return { mu, teams: out };
}

// Fixtures grouped by team and gameweek, with model goal expectations.
export function fixtureMap(bs, fixtures, ratings) {
  const map = {}; // team -> gw -> [{opp, home, lamFor, lamAg, fid, kickoff}]
  for (const t of bs.teams) map[t.id] = {};
  const { mu, teams } = ratings;
  for (const f of fixtures) {
    if (!f.event) continue;
    const h = teams[f.team_h], a = teams[f.team_a];
    if (!h || !a) continue;
    const lamH = mu * h.att * a.def * HOME;
    const lamA = mu * a.att * h.def * AWAY;
    (map[f.team_h][f.event] = map[f.team_h][f.event] || []).push({
      opp: f.team_a, home: true, lamFor: lamH, lamAg: lamA, fid: f.id, kickoff: f.kickoff_time, fdr: f.team_h_difficulty,
    });
    (map[f.team_a][f.event] = map[f.team_a][f.event] || []).push({
      opp: f.team_h, home: false, lamFor: lamA, lamAg: lamH, fid: f.id, kickoff: f.kickoff_time, fdr: f.team_a_difficulty,
    });
  }
  return map;
}

// ---------- Player profiles ----------
function availability(e, k) {
  // k = gameweeks after the next one (0 = next gameweek)
  const st = e.status;
  if (st === 'u' || st === 'n') return 0;
  let c = e.chance_of_playing_next_round;
  if (c == null) c = st === 'a' ? 100 : st === 'd' ? 75 : 0;
  c /= 100;
  if (k <= 0) return c;
  const recovery = st === 's' ? 1.2 : st === 'i' ? 3.5 : 1.5;
  return clamp(c + (1 - c) * Math.min(1, k / recovery), 0, 1);
}

export function playerProfile(e, ratings) {
  const pos = e.element_type;
  const tr = ratings.teams[e.team];
  const G = tr ? tr.games : 0;
  const m = +e.minutes || 0;
  const starts = +e.starts || 0;
  const shrink = (total, prior, k = 270) => ((total + (prior * k) / 90) / (m + k)) * 90;

  // Minutes expectation when available.
  let expMins, p60;
  if (G > 0) {
    const minsPerGame = clamp(m / G, 0, 90);
    const startRate = clamp(starts / G, 0, 1);
    const minsPerStart = starts > 0 ? clamp(m / starts, 0, 95) : 0;
    p60 = startRate * clamp((minsPerStart - 45) / 35, 0.2, 0.95);
    expMins = minsPerGame;
    // Little data: lean on FPL's own expectation.
    const w = G / (G + 2);
    const epHint = clamp(((+e.ep_next || 0) / 4.5) * 75, 0, 85);
    expMins = w * expMins + (1 - w) * epHint;
    p60 = w * p60 + (1 - w) * clamp(epHint / 90, 0, 0.9);
  } else {
    const epHint = clamp(((+e.ep_next || 0) / 4.5) * 75, 0, 85);
    expMins = epHint;
    p60 = clamp(epHint / 90, 0, 0.9);
  }
  const pAny = clamp(p60 + Math.max(0, expMins - p60 * 88) / 25, p60, 1);

  const xg90 = shrink(+e.expected_goals || 0, PRIOR.xg[pos]);
  const xa90 = shrink(+e.expected_assists || 0, PRIOR.xa[pos]);
  const bonus90 = shrink(+e.bonus || 0, PRIOR.bonus[pos], 450);
  const saves90 = pos === 1 ? shrink(+e.saves || 0, PRIOR.saves, 450) : 0;
  const dcTotal = e.defensive_contribution != null ? +e.defensive_contribution : (PRIOR.dc[pos] * m) / 90;
  const dc90 = shrink(dcTotal, PRIOR.dc[pos], 450);
  const yc90 = shrink(+e.yellow_cards || 0, PRIOR.yc, 450);

  return { pos, expMins, p60, pAny, xg90, xa90, bonus90, saves90, dc90, yc90 };
}

// Expected points for one fixture (already scaled by availability `av`).
export function fixturePoints(prof, fx, ratings, av) {
  const { pos } = prof;
  const tr = ratings.teams;
  const mins = prof.expMins * av;
  const p60 = prof.p60 * av;
  const pAny = prof.pAny * av;
  if (mins <= 0.01) return { total: 0, mins: 0, goals: 0, assists: 0, cs: 0 };
  const scale = fx.lamFor / (ratings.mu * (tr[fx.teamId] ? tr[fx.teamId].att : 1));
  const goals = prof.xg90 * scale * (mins / 90);
  const assists = prof.xa90 * scale * (mins / 90);
  const pCS = Math.exp(-fx.lamAg);
  const cs = p60 * pCS;
  let pts = pAny * 1 + p60 * 1;
  pts += goals * GOAL_PTS[pos] + assists * 3;
  pts += cs * CS_PTS[pos];
  if (pos <= 2) pts -= p60 * expFloorDiv(fx.lamAg, 2);
  if (pos === 1) {
    const oppAtt = tr[fx.opp] ? tr[fx.opp].att : 1;
    pts += p60 * expFloorDiv(prof.saves90 * oppAtt * (fx.home ? AWAY : HOME), 3);
  }
  if (pos >= 2) pts += 2 * p60 * poissonAtLeast(prof.dc90 * 0.98, DC_THRESHOLD[pos]);
  const bonusFactor = pos <= 2 ? clamp(0.55 + (0.45 * pCS) / 0.3, 0.5, 1.6) : Math.sqrt(scale);
  pts += prof.bonus90 * (mins / 90) * bonusFactor;
  pts -= prof.yc90 * (mins / 90);
  return { total: Math.max(0, pts), mins, goals, assists, cs };
}

// Build the full projection table: xp[elementId][gw] = points
export function buildProjections(bs, fixtures, opts = {}) {
  const info = gwInfo(bs);
  const start = opts.startGW || info.plan;
  const horizon = opts.horizon || 8;
  const gws = [];
  for (let g = start; g < start + horizon && g <= 38; g++) gws.push(g);
  const ratings = teamRatings(bs, fixtures);
  const fmap = fixtureMap(bs, fixtures, ratings);
  const xp = {}, detail = {}, profiles = {};
  for (const e of bs.elements) {
    const prof = playerProfile(e, ratings);
    profiles[e.id] = prof;
    xp[e.id] = {};
    detail[e.id] = {};
    gws.forEach((g, k) => {
      const fxs = (fmap[e.team] && fmap[e.team][g]) || [];
      const av = availability(e, k);
      let tot = 0, mins = 0, goals = 0, assists = 0, cs = 0;
      for (const f of fxs) {
        const r = fixturePoints(prof, { ...f, teamId: e.team }, ratings, av);
        tot += r.total; mins += r.mins; goals += r.goals; assists += r.assists; cs += r.cs;
      }
      // Light blend with FPL's own projection for the very next gameweek.
      if (k === 0 && e.ep_next != null && fxs.length === 1 && av > 0) tot = 0.85 * tot + 0.15 * (+e.ep_next || 0);
      xp[e.id][g] = Math.round(tot * 100) / 100;
      detail[e.id][g] = { mins, goals, assists, cs, n: fxs.length, av };
    });
  }
  return { gws, xp, detail, profiles, ratings, fmap, start };
}

// ---------- Lineup optimiser ----------
// players: [{id, pos}] (15) ; val(id) => expected points
export function bestXI(players, val, opts = {}) {
  const byPos = { 1: [], 2: [], 3: [], 4: [] };
  for (const p of players) byPos[p.pos].push(p);
  for (const k in byPos) byPos[k].sort((a, b) => val(b.id) - val(a.id));
  if (!byPos[1].length) return null;
  let best = null;
  for (const [d, m, f] of FORMATIONS) {
    if (byPos[2].length < d || byPos[3].length < m || byPos[4].length < f) continue;
    const xi = [byPos[1][0], ...byPos[2].slice(0, d), ...byPos[3].slice(0, m), ...byPos[4].slice(0, f)];
    const s = xi.reduce((a, p) => a + val(p.id), 0);
    if (!best || s > best.sum) best = { sum: s, xi, form: [d, m, f] };
  }
  if (!best) return null;
  const xiIds = new Set(best.xi.map((p) => p.id));
  const benchGK = byPos[1].slice(1);
  const benchOut = players.filter((p) => !xiIds.has(p.id) && p.pos !== 1).sort((a, b) => val(b.id) - val(a.id));
  const bench = [...benchGK, ...benchOut];
  const ranked = best.xi.slice().sort((a, b) => val(b.id) - val(a.id));
  const captain = ranked[0];
  const vice = ranked[1];
  const capMult = opts.tripleCaptain ? 3 : 2;
  const benchSum = bench.reduce((a, p) => a + val(p.id), 0);
  let points = best.sum + (capMult - 1) * val(captain.id);
  if (opts.benchBoost) points += benchSum;
  return {
    xi: best.xi.map((p) => p.id), bench: bench.map((p) => p.id), formation: best.form,
    captain: captain.id, vice: vice ? vice.id : null, points, xiSum: best.sum, benchSum,
  };
}

// ---------- Squad evaluation and transfer search ----------
export function horizonWeights(n, decay = 0.88) {
  return Array.from({ length: n }, (_, i) => Math.pow(decay, i));
}

function makeEvaluator(proj, gws, weights) {
  return (squad) => {
    let s = 0;
    gws.forEach((g, i) => {
      const r = bestXI(squad, (id) => proj.xp[id][g] || 0);
      if (r) s += weights[i] * r.points;
    });
    return s;
  };
}

function teamCounts(squad, elById) {
  const c = {};
  for (const p of squad) {
    const t = elById[p.id].team;
    c[t] = (c[t] || 0) + 1;
  }
  return c;
}

function candidates(bs, proj, gws, weights, exclude, perPos = 36) {
  const score = (id) => gws.reduce((s, g, i) => s + weights[i] * (proj.xp[id][g] || 0), 0);
  const out = { 1: [], 2: [], 3: [], 4: [] };
  const pool = bs.elements.filter((e) => !exclude.has(e.id) && e.status !== 'u' && e.status !== 'n');
  for (const pos of [1, 2, 3, 4]) {
    const list = pool.filter((e) => e.element_type === pos).map((e) => ({ id: e.id, pos, cost: e.now_cost, team: e.team, v: score(e.id) }));
    list.sort((a, b) => b.v - a.v);
    const top = list.slice(0, perPos);
    // Add value picks (best points per £) so cheap enablers are considered.
    const value = list.slice().sort((a, b) => b.v / b.cost - a.v / a.cost).slice(0, 10);
    const cheap = list.filter((x) => x.cost <= 45).slice(0, 4);
    const seen = new Set();
    out[pos] = [...top, ...value, ...cheap].filter((x) => (seen.has(x.id) ? false : (seen.add(x.id), true)));
  }
  return { out, score };
}

/**
 * Search the best 0/1/2 transfer plans.
 * ctx = { bs, proj, squadIds, bank, ft, sell: {id: price}, horizon, locked:Set, banned:Set }
 */
export function transferPlans(ctx) {
  const { bs, proj } = ctx;
  const elById = ctx.elById || Object.fromEntries(bs.elements.map((e) => [e.id, e]));
  const gws = proj.gws.slice(0, ctx.horizon || 5);
  const weights = horizonWeights(gws.length);
  const evalSq = makeEvaluator(proj, gws, weights);
  const squad = ctx.squadIds.map((id) => ({ id, pos: elById[id].element_type }));
  const base = evalSq(squad);
  const banned = ctx.banned || new Set();
  const locked = ctx.locked || new Set();
  const inSquad = new Set(ctx.squadIds);
  const { out: cands, score } = candidates(bs, proj, gws, weights, new Set([...inSquad, ...banned]));
  const sell = (id) => (ctx.sell && ctx.sell[id] != null ? ctx.sell[id] : elById[id].now_cost);
  const counts = teamCounts(squad, elById);

  const singles = [];
  for (const o of squad) {
    if (locked.has(o.id)) continue;
    for (const c of cands[o.pos]) {
      if (ctx.bank + sell(o.id) - c.cost < 0) continue;
      const tc = (counts[c.team] || 0) - (elById[o.id].team === c.team ? 1 : 0);
      if (tc >= 3) continue;
      const ns = squad.map((p) => (p.id === o.id ? { id: c.id, pos: c.pos } : p));
      singles.push({ out: [o.id], in: [c.id], gain: evalSq(ns) - base, cost: c.cost - sell(o.id) });
    }
  }
  singles.sort((a, b) => b.gain - a.gain);

  // Doubles: weakest outfield/GK candidates to sell, top buys per position.
  const weakest = squad
    .filter((p) => !locked.has(p.id))
    .map((p) => ({ ...p, v: score(p.id) }))
    .sort((a, b) => a.v - b.v)
    .slice(0, 8);
  const outIds = new Set(weakest.map((p) => p.id));
  for (const s of singles.slice(0, 30)) outIds.add(s.out[0]);
  const outs = squad.filter((p) => outIds.has(p.id)).slice(0, 12);
  const doubles = [];
  for (let i = 0; i < outs.length; i++) {
    for (let j = i + 1; j < outs.length; j++) {
      const o1 = outs[i], o2 = outs[j];
      const budget = ctx.bank + sell(o1.id) + sell(o2.id);
      const minOther = (pos) => Math.min(...cands[pos].map((x) => x.cost));
      const c1 = cands[o1.pos].filter((x) => x.cost <= budget - minOther(o2.pos)).slice(0, 14);
      const c2 = cands[o2.pos].filter((x) => x.cost <= budget - minOther(o1.pos)).slice(0, 14);
      for (const a of c1) {
        for (const b of c2) {
          if (a.id === b.id || a.cost + b.cost > budget) continue;
          const tc = { ...counts };
          tc[elById[o1.id].team]--; tc[elById[o2.id].team]--;
          tc[a.team] = (tc[a.team] || 0) + 1; tc[b.team] = (tc[b.team] || 0) + 1;
          if (tc[a.team] > 3 || tc[b.team] > 3) continue;
          const ns = squad.map((p) => (p.id === o1.id ? { id: a.id, pos: a.pos } : p.id === o2.id ? { id: b.id, pos: b.pos } : p));
          doubles.push({ out: [o1.id, o2.id], in: [a.id, b.id], gain: evalSq(ns) - base, cost: a.cost + b.cost - sell(o1.id) - sell(o2.id) });
        }
      }
    }
  }
  doubles.sort((a, b) => b.gain - a.gain);

  const ft = ctx.ft == null ? 1 : ctx.ft;
  const hit = (k) => Math.max(0, k - ft) * 4;
  const rollValue = ft < 5 ? 1.5 : 0;
  const score0 = rollValue;
  const s1 = singles[0];
  const d1 = doubles[0];
  const options = [
    { k: 0, net: score0, plan: null },
    s1 ? { k: 1, net: s1.gain - hit(1) + (ft > 1 && ft < 5 ? rollValue * 0.5 : 0), plan: s1 } : null,
    d1 ? { k: 2, net: d1.gain - hit(2), plan: d1 } : null,
  ].filter(Boolean);
  options.sort((a, b) => b.net - a.net);
  return {
    base, gws, singles: dedupe(singles).slice(0, 12), doubles: dedupeDoubles(doubles).slice(0, 8),
    recommend: options[0], hitCost: hit, ft,
  };
}

function dedupe(list) {
  const seenIn = new Set();
  const r = [];
  for (const s of list) {
    const key = s.in[0];
    if (seenIn.has(key)) continue;
    seenIn.add(key);
    r.push(s);
  }
  return r;
}
function dedupeDoubles(list) {
  const seen = new Set();
  const r = [];
  for (const s of list) {
    const key = s.in.slice().sort().join('-');
    if (seen.has(key)) continue;
    seen.add(key);
    r.push(s);
  }
  return r;
}

/**
 * Build a strong squad from scratch for a wildcard (multi-week) or free hit (one week).
 * Hill-climbs from the current squad with unlimited transfers.
 */
export function optimiseSquad(ctx) {
  const { bs, proj } = ctx;
  const elById = ctx.elById || Object.fromEntries(bs.elements.map((e) => [e.id, e]));
  const gws = ctx.gws || proj.gws.slice(0, ctx.horizon || 6);
  const weights = horizonWeights(gws.length);
  const evalSq = makeEvaluator(proj, gws, weights);
  let squad = ctx.squadIds.map((id) => ({ id, pos: elById[id].element_type }));
  const sell = (id) => (ctx.sell && ctx.sell[id] != null ? ctx.sell[id] : elById[id].now_cost);
  let bank = ctx.bank;
  const startVal = evalSq(squad);
  let cur = startVal;
  const { out: cands } = candidates(bs, proj, gws, weights, ctx.banned || new Set(), 30);
  for (let iter = 0; iter < 40; iter++) {
    const ids = new Set(squad.map((p) => p.id));
    const counts = teamCounts(squad, elById);
    let best = null;
    for (const o of squad) {
      for (const c of cands[o.pos]) {
        if (ids.has(c.id)) continue;
        if (bank + sell(o.id) - c.cost < 0) continue;
        const tc = (counts[c.team] || 0) - (elById[o.id].team === c.team ? 1 : 0);
        if (tc >= 3) continue;
        const ns = squad.map((p) => (p.id === o.id ? { id: c.id, pos: c.pos } : p));
        const v = evalSq(ns);
        if (!best || v > best.v) best = { v, ns, o, c };
      }
    }
    if (!best || best.v - cur < 0.05) break;
    bank += sell(best.o.id) - best.c.cost;
    squad = best.ns;
    cur = best.v;
  }
  const g0 = gws[0];
  const lineup = bestXI(squad, (id) => proj.xp[id][g0] || 0);
  return { squadIds: squad.map((p) => p.id), bank, value: cur, gain: cur - startVal, lineup, gws };
}

// ---------- Chips ----------
export function chipStatus(history, gwPlan) {
  const used = (history && history.chips) || [];
  const half = (g) => (g <= 19 ? 1 : 2);
  const names = ['wildcard', 'freehit', 'bboost', '3xc'];
  const res = {};
  for (const n of names) {
    const inHalf = used.filter((c) => c.name === n && half(c.event) === half(gwPlan));
    res[n] = { available: inHalf.length === 0, usedIn: used.filter((c) => c.name === n).map((c) => c.event) };
  }
  return res;
}

export function chipPlanner(ctx) {
  const { bs, proj } = ctx;
  const elById = ctx.elById || Object.fromEntries(bs.elements.map((e) => [e.id, e]));
  const squad = ctx.squadIds.map((id) => ({ id, pos: elById[id].element_type }));
  const rows = [];
  for (const g of proj.gws.slice(0, ctx.weeks || 6)) {
    const val = (id) => proj.xp[id][g] || 0;
    const lu = bestXI(squad, val);
    if (!lu) continue;
    const fh = optimiseSquad({ ...ctx, gws: [g] });
    rows.push({
      gw: g,
      base: lu.points,
      bboost: lu.benchSum,
      tc: val(lu.captain),
      captain: lu.captain,
      freehit: Math.max(0, fh.lineup ? fh.lineup.points - lu.points : 0),
      fhSquad: fh.squadIds,
    });
  }
  const wc = optimiseSquad({ ...ctx, horizon: 6 });
  return { rows, wildcard: wc };
}

// ---------- Live scoring ----------
// Bonus from BPS (top three, FPL tie rules).
export function bonusFromBps(fixture) {
  const st = (fixture.stats || []).find((s) => s.identifier === 'bps');
  if (!st) return {};
  const rows = [...(st.h || []), ...(st.a || [])].sort((a, b) => b.value - a.value);
  const res = {};
  let given = 0, idx = 0;
  while (given < 3 && idx < rows.length) {
    const v = rows[idx].value;
    const tied = rows.filter((r) => r.value === v);
    const award = 3 - given;
    if (award <= 0) break;
    tied.forEach((r) => (res[r.element] = award));
    given += tied.length;
    idx += tied.length;
  }
  return res;
}

/**
 * Live points for a team in a gameweek.
 * picks: FPL picks response. live: event/{gw}/live. fixtures: fixtures of that gw.
 */
export function liveTeam({ picks, live, fixtures, elById }) {
  const liveById = {};
  for (const e of (live && live.elements) || []) liveById[e.id] = e;
  const fxById = {};
  const provBonus = {};
  for (const f of fixtures) {
    fxById[f.id] = f;
    if (f.started && !f.finished) {
      const b = bonusFromBps(f);
      for (const id in b) provBonus[id] = (provBonus[id] || 0) + b[id];
    }
  }
  const teamFx = {};
  for (const f of fixtures) {
    (teamFx[f.team_h] = teamFx[f.team_h] || []).push(f);
    (teamFx[f.team_a] = teamFx[f.team_a] || []).push(f);
  }
  const chip = picks.active_chip;
  const rows = picks.picks.map((p) => {
    const el = elById[p.element];
    const l = liveById[p.element];
    const s = (l && l.stats) || {};
    const fxs = teamFx[el.team] || [];
    const allDone = fxs.every((f) => f.finished_provisional || f.finished);
    const anyLive = fxs.some((f) => f.started && !(f.finished_provisional || f.finished));
    const anyStarted = fxs.some((f) => f.started);
    const mins = s.minutes || 0;
    const bonusProv = s.bonus ? 0 : provBonus[p.element] || 0;
    const pts = (s.total_points || 0) + bonusProv;
    let state = 'yet';
    if (fxs.length === 0) state = 'blank';
    else if (allDone) state = mins > 0 ? 'done' : 'dnp';
    else if (anyLive) state = mins > 0 ? 'playing' : 'live-bench';
    else if (anyStarted) state = mins > 0 ? 'done-more' : 'yet';
    return { ...p, el, pts, bonusProv, mins, state, stats: s };
  });

  const starters = rows.filter((r) => r.position <= 11);
  const bench = rows.filter((r) => r.position > 11).sort((a, b) => a.position - b.position);
  const out = (r) => r.state === 'dnp' || r.state === 'blank';
  const subs = [];
  if (chip !== 'bboost') {
    const xi = starters.slice();
    const used = new Set();
    const valid = (list) => {
      const c = { 1: 0, 2: 0, 3: 0, 4: 0 };
      list.forEach((r) => c[r.el.element_type]++);
      return c[1] === 1 && c[2] >= 3 && c[3] >= 2 && c[4] >= 1;
    };
    for (const s of starters) {
      if (!out(s)) continue;
      for (const b of bench) {
        if (used.has(b.element) || out(b) || b.mins === 0) continue;
        const trial = xi.map((r) => (r === s ? b : r));
        if (!valid(trial)) continue;
        used.add(b.element);
        subs.push({ out: s.element, in: b.element });
        xi.splice(xi.indexOf(s), 1, b);
        break;
      }
    }
  }
  const active = new Set();
  if (chip === 'bboost') rows.forEach((r) => active.add(r.element));
  else {
    starters.forEach((r) => active.add(r.element));
    subs.forEach((s) => { active.delete(s.out); active.add(s.in); });
  }
  // Captaincy
  const cap = rows.find((r) => r.is_captain);
  const vice = rows.find((r) => r.is_vice_captain);
  const capMult = chip === '3xc' ? 3 : 2;
  let capId = cap ? cap.element : null;
  if (cap && out(cap) && vice && !out(vice) && active.has(vice.element)) capId = vice.element;
  let total = 0, benchPts = 0;
  for (const r of rows) {
    r.active = active.has(r.element);
    r.mult = r.active ? (r.element === capId ? capMult : 1) : 0;
    r.livePts = r.pts * r.mult;
    if (r.active) total += r.livePts;
    else benchPts += r.pts;
  }
  const cost = (picks.entry_history && picks.entry_history.event_transfers_cost) || 0;
  const playersLeft = rows.filter((r) => r.active && (r.state === 'yet' || r.state === 'playing' || r.state === 'live-bench' || r.state === 'done-more')).length;
  return { rows, subs, total, net: total - cost, cost, benchPts, capId, chip, playersLeft };
}

// Points a reference manager would score, given effective ownership (fraction, 0..3).
export function referenceScore(eoById, live, fixtures) {
  const provBonus = {};
  for (const f of fixtures) {
    if (f.started && !f.finished) {
      const b = bonusFromBps(f);
      for (const id in b) provBonus[id] = (provBonus[id] || 0) + b[id];
    }
  }
  let s = 0;
  for (const e of (live && live.elements) || []) {
    const eo = eoById[e.id] || 0;
    if (!eo) continue;
    const pts = (e.stats.total_points || 0) + (e.stats.bonus ? 0 : provBonus[e.id] || 0);
    s += eo * pts;
  }
  return s;
}

// Rough live-rank estimate: each point above the reference moves rank by ~e^(1/s).
export function estimateRank(prevRank, myGw, refGw) {
  if (!prevRank) return null;
  const s = prevRank < 10000 ? 6 : prevRank < 200000 ? 8 : 10;
  const shift = Math.max(-Math.log(8), Math.min(Math.log(8), -(myGw - refGw) / s));
  return Math.max(1, Math.round(prevRank * Math.exp(shift)));
}

// ---------- Price change indicator ----------
export function priceProgress(e, totalPlayers) {
  const owners = ((+e.selected_by_percent || 0) / 100) * (totalPlayers || 10000000);
  const net = (e.transfers_in_event || 0) - (e.transfers_out_event || 0);
  const rise = 0.05 * owners + 30000;
  const fall = 0.035 * owners + 15000;
  return net >= 0 ? net / rise : -(-net / fall);
}

// ---------- Free transfers from history ----------
export function freeTransfers(history, upToGw) {
  const cur = (history && history.current) || [];
  const chips = (history && history.chips) || [];
  const chipAt = {};
  for (const c of chips) chipAt[c.event] = c.name;
  let ft = 0;
  for (const h of cur) {
    if (h.event > upToGw) break;
    if (h.event === cur[0].event) {
      ft = 1; // first gameweek: unlimited, next week starts with 1
      continue;
    }
    if (chipAt[h.event] === 'wildcard' || chipAt[h.event] === 'freehit') {
      ft = Math.min(5, ft + 1); // saved transfers are kept on chip weeks
      continue;
    }
    ft = Math.min(5, Math.max(0, ft - h.event_transfers) + 1);
  }
  return Math.max(1, ft);
}
