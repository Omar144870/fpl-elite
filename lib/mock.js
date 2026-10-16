// Demo data that mirrors the shape of the official FPL API, used with `npm run mock`
// so the site can be tried without internet access. Deterministic (seeded).
let rngState = 7;
function rnd() {
  rngState = (rngState * 1103515245 + 12345) & 0x7fffffff;
  return rngState / 0x7fffffff;
}
function seeded(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
function poisson(l, r = rnd) {
  const L = Math.exp(-l);
  let k = 0,
    p = 1;
  do {
    k++;
    p *= r();
  } while (p > L);
  return k - 1;
}

const CURRENT = 8;
const TEAMS = [
  ['Arsenal', 'ARS', 5], ['Aston Villa', 'AVL', 4], ['Bournemouth', 'BOU', 3], ['Brentford', 'BRE', 3],
  ['Brighton', 'BHA', 3], ['Burnley', 'BUR', 2], ['Chelsea', 'CHE', 4], ['Crystal Palace', 'CRY', 3],
  ['Everton', 'EVE', 3], ['Fulham', 'FUL', 3], ['Leeds', 'LEE', 2], ['Liverpool', 'LIV', 5],
  ['Man City', 'MCI', 5], ['Man Utd', 'MUN', 4], ['Newcastle', 'NEW', 4], ["Nott'm Forest", 'NFO', 3],
  ['Sunderland', 'SUN', 2], ['Spurs', 'TOT', 4], ['West Ham', 'WHU', 3], ['Wolves', 'WOL', 2],
];
const SURNAMES = ('Hale Moreno Okafor Lindqvist Duarte Brennan Sato Kowalski Ferreira Adeyemi Novak Castell Rourke ' +
  'Haddad Pereira Mensah Vidal Larsen Quinn Barros Nakamura Ibarra Holt Delacroix Yilmaz Osei Varga Romero ' +
  'Kerrigan Strand Mbeki Laurent Dunn Abreu Petrov Silva Kane Marsh Ito Fofana Lund Grady Tavares Costa Byrne ' +
  'Amari Nilsen Oyelaran Rios Sorensen Patel Kovac Dias Weller Keita Morrow Albers Szabo Ncube Vance Rosa Elmi ' +
  'Hartley Bakar Ruiz Moss Achebe Lyle Sandoval Coyle Ivers Toure Saka Mendes Okoro Frey Halloran Pike Reyes').split(' ');

function build() {
  rngState = 7;
  const teams = TEAMS.map(([name, short, q], i) => ({
    id: i + 1, code: 100 + i, name, short_name: short, strength: q,
    strength_overall_home: 1000 + q * 60, strength_overall_away: 980 + q * 60,
    strength_attack_home: 1000 + q * 65 + Math.round(rnd() * 40), strength_attack_away: 980 + q * 65 + Math.round(rnd() * 40),
    strength_defence_home: 1000 + q * 60 + Math.round(rnd() * 40), strength_defence_away: 980 + q * 60 + Math.round(rnd() * 40),
    played: 0, win: 0, draw: 0, loss: 0, points: 0, position: 0, unavailable: false,
  }));

  // Double round-robin (circle method)
  const ids = teams.map((t) => t.id);
  const rounds = [];
  const arr = ids.slice();
  for (let r = 0; r < 19; r++) {
    const games = [];
    for (let i = 0; i < 10; i++) {
      const a = arr[i], b = arr[19 - i];
      games.push(r % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(games);
    arr.splice(1, 0, arr.pop());
  }
  const all = rounds.concat(rounds.map((g) => g.map(([h, a]) => [a, h])));
  let fid = 1;
  const fixtures = [];
  const start = Date.UTC(2026, 7, 22, 14, 0);
  all.forEach((games, ri) => {
    games.forEach(([h, a], gi) => {
      let ev = ri + 1;
      if (ev === 30 && gi === 0) ev = 11; // creates a double in GW11 and a blank in GW30
      const kickoff = new Date(start + (ev - 1) * 7 * 864e5 + (gi % 4) * 3 * 36e5 + (gi > 6 ? 864e5 : 0));
      fixtures.push({
        id: fid++, code: 9000 + fid, event: ev, team_h: h, team_a: a,
        team_h_score: null, team_a_score: null, started: false, finished: false, finished_provisional: false,
        minutes: 0, provisional_start_time: false, kickoff_time: kickoff.toISOString(),
        team_h_difficulty: 0, team_a_difficulty: 0, stats: [], pulse_id: fid,
      });
    });
  });
  fixtures.sort((x, y) => x.event - y.event || x.kickoff_time.localeCompare(y.kickoff_time));
  for (const f of fixtures) {
    f.team_h_difficulty = Math.min(5, Math.max(2, teams[f.team_a - 1].strength));
    f.team_a_difficulty = Math.min(5, Math.max(2, teams[f.team_h - 1].strength));
  }

  // Players
  const elements = [];
  let eid = 1, ni = 0;
  const shape = [[1, 2], [2, 6], [3, 6], [4, 4]];
  for (const t of teams) {
    for (const [pos, count] of shape) {
      for (let k = 0; k < count; k++) {
        const starter = pos === 1 ? k === 0 : pos === 4 ? k < 2 : k < 4;
        const star = starter && k === 0 && pos >= 3 && t.strength >= 4;
        const q = t.strength / 5;
        const base = { 1: 4.5, 2: 4.5, 3: 5.5, 4: 6.0 }[pos];
        let cost = base + (starter ? 0.5 + q * 2 : -0.3) + (star ? 3.5 + rnd() * 3 : 0) + rnd() * 0.8;
        cost = Math.round(Math.max(3.9, cost) * 10);
        const xg90 = { 1: 0, 2: 0.04 + q * 0.06, 3: 0.12 + q * 0.18, 4: 0.3 + q * 0.3 }[pos] * (star ? 1.8 : 1) * (0.7 + rnd() * 0.6);
        const xa90 = { 1: 0.01, 2: 0.05 + q * 0.06, 3: 0.12 + q * 0.14, 4: 0.1 + q * 0.08 }[pos] * (star ? 1.5 : 1) * (0.7 + rnd() * 0.6);
        elements.push({
          id: eid++, code: 50000 + eid, team: t.id, team_code: t.code, element_type: pos,
          web_name: SURNAMES[ni++ % SURNAMES.length] + (ni > SURNAMES.length ? ' ' + String.fromCharCode(65 + Math.floor(ni / SURNAMES.length)) : ''),
          first_name: 'Demo', second_name: 'Player', now_cost: cost,
          _starter: starter, _xg90: xg90, _xa90: xa90, _q: q,
          status: 'a', chance_of_playing_next_round: null, chance_of_playing_this_round: null, news: '',
          minutes: 0, starts: 0, goals_scored: 0, assists: 0, clean_sheets: 0, goals_conceded: 0, saves: 0,
          bonus: 0, bps: 0, yellow_cards: 0, red_cards: 0, total_points: 0, expected_goals: '0.00',
          expected_assists: '0.00', expected_goals_conceded: '0.00', defensive_contribution: 0,
          event_points: 0, penalties_order: null,
        });
      }
    }
  }
  // A few injuries / doubts
  [5, 40, 77, 120, 200, 260].forEach((i, n) => {
    const e = elements[i];
    e.status = n % 2 ? 'd' : 'i';
    e.chance_of_playing_next_round = n % 2 ? 50 : 0;
    e.news = n % 2 ? 'Knock - 50% chance of playing' : 'Hamstring injury - Expected back in 3 weeks';
  });

  // Simulate finished gameweeks
  const byTeam = {};
  for (const e of elements) (byTeam[e.team] = byTeam[e.team] || []).push(e);
  const gwPoints = {}; // gw -> element -> stats
  const live = {};
  const sim = (f, frac) => {
    const th = teams[f.team_h - 1], ta = teams[f.team_a - 1];
    const lh = 1.45 * (0.6 + th.strength * 0.18) / (0.6 + ta.strength * 0.15);
    const la = 1.15 * (0.6 + ta.strength * 0.18) / (0.6 + th.strength * 0.15);
    const gh = poisson(lh * frac), ga = poisson(la * frac);
    f.team_h_score = gh; f.team_a_score = ga;
    const stats = {};
    const bpsRows = { h: [], a: [] };
    for (const [side, team, gf, gaN, lam] of [['h', th, gh, ga, lh], ['a', ta, ga, gh, la]]) {
      const squad = byTeam[team.id];
      const playing = squad.filter((p) => (p._starter && p.status === 'a') || (!p._starter && rnd() < 0.25));
      const scorers = playing.filter((p) => p.element_type > 1);
      const pickBy = (key) => {
        const tot = scorers.reduce((s, p) => s + p[key], 0);
        let x = rnd() * tot;
        for (const p of scorers) { x -= p[key]; if (x <= 0) return p; }
        return scorers[0];
      };
      for (const p of playing) {
        const mins = Math.round((p._starter ? (rnd() < 0.8 ? 90 : 60 + rnd() * 25) : 10 + rnd() * 25) * frac);
        stats[p.id] = { minutes: mins, goals_scored: 0, assists: 0, clean_sheets: 0, goals_conceded: 0, saves: 0, bonus: 0, bps: 0, yellow_cards: rnd() < 0.08 ? 1 : 0, red_cards: 0, own_goals: 0, penalties_saved: 0, penalties_missed: 0, expected_goals: 0, expected_assists: 0, expected_goals_conceded: 0, defensive_contribution: 0, starts: p._starter ? 1 : 0, influence: '0', creativity: '0', threat: '0', ict_index: '0', total_points: 0, in_dreamteam: false };
        const s = stats[p.id];
        s.expected_goals = +(p._xg90 * mins / 90 * lam / 1.3).toFixed(2);
        s.expected_assists = +(p._xa90 * mins / 90 * lam / 1.3).toFixed(2);
        s.goals_conceded = mins >= 1 ? gaN : 0;
        s.expected_goals_conceded = +((p.element_type <= 2 ? 1 : 0) * (2.6 - lam) * mins / 90).toFixed(2);
        s.defensive_contribution = p.element_type === 2 ? poisson(8 * mins / 90) : p.element_type === 3 ? poisson(7 * mins / 90) : poisson(3 * mins / 90);
        if (p.element_type === 1) s.saves = poisson(2.8 * mins / 90);
        if (gaN === 0 && mins >= 60) s.clean_sheets = 1;
      }
      for (let g = 0; g < gf; g++) {
        const sc = pickBy('_xg90');
        if (stats[sc.id]) stats[sc.id].goals_scored++;
        if (rnd() < 0.75) { const as = pickBy('_xa90'); if (as !== sc && stats[as.id]) stats[as.id].assists++; }
      }
      for (const p of playing) {
        const s = stats[p.id];
        const pos = p.element_type;
        let pts = s.minutes >= 60 ? 2 : s.minutes > 0 ? 1 : 0;
        pts += s.goals_scored * { 1: 10, 2: 6, 3: 5, 4: 4 }[pos] + s.assists * 3;
        if (s.clean_sheets) pts += { 1: 4, 2: 4, 3: 1, 4: 0 }[pos];
        if (pos <= 2) pts -= Math.floor(s.goals_conceded / 2);
        if (pos === 1) pts += Math.floor(s.saves / 3);
        if ((pos === 2 && s.defensive_contribution >= 10) || (pos > 2 && s.defensive_contribution >= 12)) pts += 2;
        pts -= s.yellow_cards;
        s.bps = s.minutes >= 60 ? 6 : 3;
        s.bps += s.goals_scored * 24 + s.assists * 9 + s.clean_sheets * 12 + s.saves * 2 + Math.round(rnd() * 12);
        s.total_points = pts;
        bpsRows[side].push({ value: s.bps, element: p.id });
      }
    }
    // bonus
    const allRows = bpsRows.h.concat(bpsRows.a).sort((x, y) => y.value - x.value);
    const bonusMap = {};
    let given = 0, idx = 0, award = 3;
    while (given < 3 && idx < allRows.length && award > 0) {
      const v = allRows[idx].value;
      const tied = allRows.filter((r) => r.value === v);
      tied.forEach((r) => (bonusMap[r.element] = award));
      given += tied.length; idx += tied.length;
      award = 3 - given;
    }
    f.stats = [
      { identifier: 'goals_scored', a: [], h: [] },
      { identifier: 'bps', h: bpsRows.h.sort((x, y) => y.value - x.value), a: bpsRows.a.sort((x, y) => y.value - x.value) },
    ];
    return { stats, bonusMap };
  };

  for (const f of fixtures) {
    if (f.event < CURRENT) {
      const { stats, bonusMap } = sim(f, 1);
      f.started = f.finished = f.finished_provisional = true; f.minutes = 90;
      for (const id in stats) {
        const s = stats[id];
        s.bonus = bonusMap[id] || 0; s.total_points += s.bonus;
        (gwPoints[f.event] = gwPoints[f.event] || {})[id] = s;
        const e = elements[id - 1];
        e.minutes += s.minutes; e.starts += s.starts; e.goals_scored += s.goals_scored; e.assists += s.assists;
        e.clean_sheets += s.clean_sheets; e.goals_conceded += s.goals_conceded; e.saves += s.saves; e.bonus += s.bonus;
        e.bps += s.bps; e.yellow_cards += s.yellow_cards; e.total_points += s.total_points;
        e.expected_goals = (+e.expected_goals + s.expected_goals).toFixed(2);
        e.expected_assists = (+e.expected_assists + s.expected_assists).toFixed(2);
        e.expected_goals_conceded = (+e.expected_goals_conceded + s.expected_goals_conceded).toFixed(2);
        e.defensive_contribution += s.defensive_contribution;
      }
    } else if (f.event === CURRENT) {
      const idx = fixtures.filter((x) => x.event === CURRENT).indexOf(f);
      if (idx < 6) {
        const done = idx < 4;
        const { stats, bonusMap } = sim(f, done ? 1 : 0.6);
        f.started = true; f.finished_provisional = done; f.finished = done && idx < 2; f.minutes = done ? 90 : 55;
        for (const id in stats) {
          const s = stats[id];
          if (f.finished) { s.bonus = bonusMap[id] || 0; s.total_points += s.bonus; }
          live[id] = { s, fixture: f.id };
        }
      }
    }
  }
  // Season totals -> derived fields
  const finishedGames = (tid) => fixtures.filter((f) => f.finished && (f.team_h === tid || f.team_a === tid)).length;
  for (const e of elements) {
    const G = Math.max(1, finishedGames(e.team));
    const m = Math.max(e.minutes, 1);
    e.expected_goals_per_90 = +(e.expected_goals / m * 90).toFixed(2);
    e.expected_assists_per_90 = +(e.expected_assists / m * 90).toFixed(2);
    e.expected_goal_involvements = (+e.expected_goals + +e.expected_assists).toFixed(2);
    e.expected_goals_conceded_per_90 = +(e.expected_goals_conceded / m * 90).toFixed(2);
    e.saves_per_90 = +(e.saves / m * 90).toFixed(2);
    e.defensive_contribution_per_90 = +(e.defensive_contribution / m * 90).toFixed(2);
    e.starts_per_90 = +(e.starts / m * 90).toFixed(2);
    e.points_per_game = (e.total_points / G).toFixed(1);
    e.form = ((gwPoints[CURRENT - 1]?.[e.id]?.total_points || 0) * 0.4 + (gwPoints[CURRENT - 2]?.[e.id]?.total_points || 0) * 0.3 + (gwPoints[CURRENT - 3]?.[e.id]?.total_points || 0) * 0.3).toFixed(1);
    const own = Math.min(65, Math.max(0.1, (e.total_points / 4) ** 1.6 / (e.now_cost / 50)));
    e.selected_by_percent = own.toFixed(1);
    e.transfers_in_event = Math.round(rnd() * own * 9000);
    e.transfers_out_event = Math.round(rnd() * own * 9000);
    e.cost_change_event = 0; e.cost_change_start = Math.round((rnd() - 0.4) * 3);
    e.ep_next = (+e.form * 0.8 + 1).toFixed(1); e.ep_this = e.ep_next;
    e.photo = e.code + '.jpg';
    e.event_points = live[e.id]?.s.total_points || 0;
  }
  // Penalty takers
  for (const t of teams) {
    const top = byTeam[t.id].filter((p) => p.element_type >= 3).sort((a, b) => b._xg90 - a._xg90)[0];
    top.penalties_order = 1;
  }

  const events = [];
  for (let gw = 1; gw <= 38; gw++) {
    const dl = new Date(start + (gw - 1) * 7 * 864e5 - 3 * 36e5 - 864e5);
    const pts = gwPoints[gw];
    let avg = 0, hi = 0;
    if (pts) {
      avg = 52 + Math.round(rnd() * 12);
      hi = 110 + Math.round(rnd() * 30);
    }
    events.push({
      id: gw, name: 'Gameweek ' + gw, deadline_time: dl.toISOString(), finished: gw < CURRENT, data_checked: gw < CURRENT,
      is_previous: gw === CURRENT - 1, is_current: gw === CURRENT, is_next: gw === CURRENT + 1,
      average_entry_score: avg, highest_score: hi, most_captained: null, most_selected: null,
      chip_plays: [], transfers_made: 0,
    });
  }

  const element_types = [
    { id: 1, singular_name: 'Goalkeeper', singular_name_short: 'GKP', plural_name_short: 'GKP', squad_select: 2, squad_min_play: 1, squad_max_play: 1 },
    { id: 2, singular_name: 'Defender', singular_name_short: 'DEF', plural_name_short: 'DEF', squad_select: 5, squad_min_play: 3, squad_max_play: 5 },
    { id: 3, singular_name: 'Midfielder', singular_name_short: 'MID', plural_name_short: 'MID', squad_select: 5, squad_min_play: 2, squad_max_play: 5 },
    { id: 4, singular_name: 'Forward', singular_name_short: 'FWD', plural_name_short: 'FWD', squad_select: 3, squad_min_play: 1, squad_max_play: 3 },
  ];
  const cleanEls = elements.map((e) => {
    const o = {};
    for (const k in e) if (k[0] !== '_') o[k] = e[k];
    return o;
  });
  return { teams, fixtures, elements, cleanEls, events, element_types, gwPoints, live };
}

let DB = null;
function db() {
  if (!DB) DB = build();
  return DB;
}

// Build a valid 15-man squad for any entry id (deterministic).
function squadFor(entryId) {
  const { elements } = db();
  const r = seeded(entryId * 7919);
  const need = { 1: 2, 2: 5, 3: 5, 4: 3 };
  const perTeam = {};
  const picked = [];
  let budget = 1000;
  // Elite-ish managers (small ids) favour the best players.
  const sorted = elements.slice().sort((a, b) => b.total_points - a.total_points + (r() - 0.5) * (entryId < 100 ? 25 : 60));
  for (const pos of [4, 3, 2, 1]) {
    for (const e of sorted) {
      if (need[pos] === 0) break;
      if (e.element_type !== pos || picked.includes(e) || (perTeam[e.team] || 0) >= 3) continue;
      const slotsLeft = Object.values(need).reduce((a, b) => a + b, 0) - 1;
      if (budget - e.now_cost < slotsLeft * 42) continue;
      picked.push(e); need[pos]--; perTeam[e.team] = (perTeam[e.team] || 0) + 1; budget -= e.now_cost;
    }
  }
  const cheap = elements.slice().sort((a, b) => a.now_cost - b.now_cost);
  for (const pos of [1, 2, 3, 4]) {
    for (const e of cheap) {
      if (need[pos] === 0) break;
      if (e.element_type !== pos || picked.includes(e) || (perTeam[e.team] || 0) >= 3) continue;
      picked.push(e); need[pos]--; perTeam[e.team] = (perTeam[e.team] || 0) + 1; budget -= e.now_cost;
    }
  }
  const gk = picked.filter((p) => p.element_type === 1);
  const def = picked.filter((p) => p.element_type === 2);
  const mid = picked.filter((p) => p.element_type === 3);
  const fwd = picked.filter((p) => p.element_type === 4);
  const xi = [gk[0], ...def.slice(0, 4), ...mid.slice(0, 4), ...fwd.slice(0, 2)];
  const bench = [gk[1], fwd[2], mid[4], def[4]];
  const order = xi.concat(bench);
  const capIdx = 1 + 4 + Math.floor(r() * 2);
  return {
    bank: Math.max(0, budget),
    picks: order.map((e, i) => ({
      element: e.id, position: i + 1, multiplier: i === capIdx ? 2 : i < 11 ? 1 : 0,
      is_captain: i === capIdx, is_vice_captain: i === capIdx + 1, element_type: e.element_type,
    })),
  };
}

function entryTotals(id) {
  const r = seeded(id * 31);
  const hist = [];
  let total = 0;
  let rank = 2000000 + Math.floor(r() * 4000000);
  if (id === 1234567) rank = 620000;
  if (id < 1000) rank = id;
  for (let gw = 1; gw < CURRENT; gw++) {
    const pts = id < 1000 ? 70 + Math.floor(r() * 15) : 45 + Math.floor(r() * 35);
    total += pts;
    rank = id < 1000 ? id : Math.max(1, Math.round(rank * (0.6 + r() * 0.6)));
    hist.push({
      event: gw, points: pts, total_points: total, rank: Math.floor(r() * 9e6), rank_sort: 0, overall_rank: rank,
      percentile_rank: 20, bank: 5 + Math.floor(r() * 10), value: 1000 + gw * 2, event_transfers: gw % 3 === 0 ? 2 : gw > 1 ? 1 : 0,
      event_transfers_cost: gw === 6 ? 4 : 0, points_on_bench: Math.floor(r() * 12),
    });
  }
  return hist;
}

function overallTotal(rank) {
  return Math.round(560 - 34 * Math.log10(rank));
}

function route(path) {
  const d = db();
  let m;
  if (path === 'bootstrap-static/') {
    return {
      events: d.events, teams: d.teams, elements: d.cleanEls, element_types: d.element_types,
      total_players: 11843210, element_stats: [], game_settings: {}, phases: [],
      chips: [
        { name: 'wildcard', number: 2 }, { name: 'freehit', number: 2 }, { name: 'bboost', number: 2 }, { name: '3xc', number: 2 },
      ],
    };
  }
  if ((m = path.match(/^fixtures\/(\?event=(\d+))?$/))) {
    return m[2] ? d.fixtures.filter((f) => f.event === +m[2]) : d.fixtures;
  }
  if ((m = path.match(/^event\/(\d+)\/live\/$/))) {
    const gw = +m[1];
    const src = gw === CURRENT ? Object.fromEntries(Object.entries(d.live).map(([k, v]) => [k, v.s])) : d.gwPoints[gw] || {};
    return {
      elements: d.elements.map((e) => {
        const s = src[e.id];
        const stats = s || { minutes: 0, goals_scored: 0, assists: 0, clean_sheets: 0, goals_conceded: 0, saves: 0, bonus: 0, bps: 0, yellow_cards: 0, red_cards: 0, total_points: 0, starts: 0, defensive_contribution: 0, expected_goals: 0, expected_assists: 0 };
        const fx = gw === CURRENT ? d.live[e.id]?.fixture : null;
        return { id: e.id, stats, explain: fx ? [{ fixture: fx, stats: [{ identifier: 'minutes', points: stats.minutes >= 60 ? 2 : 1, value: stats.minutes }] }] : [] };
      }),
    };
  }
  if ((m = path.match(/^entry\/(\d+)\/$/))) {
    const id = +m[1];
    if (id > 20000000) return undefined;
    const hist = entryTotals(id);
    const last = hist[hist.length - 1];
    return {
      id, joined_time: '2026-07-20T10:00:00Z', started_event: 1, favourite_team: 12,
      player_first_name: id === 1234567 ? 'Ahmed' : 'Manager', player_last_name: id === 1234567 ? 'Hassan' : String(id),
      player_region_name: 'Egypt', name: id === 1234567 ? 'Alex Pharaohs' : 'Team ' + id,
      summary_overall_points: last.total_points, summary_overall_rank: last.overall_rank,
      summary_event_points: 0, summary_event_rank: null, current_event: CURRENT,
      last_deadline_bank: squadFor(id).bank, last_deadline_value: 1000, last_deadline_total_transfers: 9,
      leagues: {
        classic: [
          { id: 314, name: 'Overall', short_name: 'overall', league_type: 's', entry_rank: last.overall_rank, entry_last_rank: last.overall_rank },
          { id: 1001, name: 'Alexandria Friends', short_name: null, league_type: 'x', entry_rank: 4, entry_last_rank: 5 },
          { id: 1002, name: 'Work League', short_name: null, league_type: 'x', entry_rank: 2, entry_last_rank: 2 },
          { id: 123, name: 'Egypt', short_name: 'region-64', league_type: 's', entry_rank: 31000, entry_last_rank: 33000 },
        ],
        h2h: [], cup: {},
      },
    };
  }
  if ((m = path.match(/^entry\/(\d+)\/history\/$/))) {
    const id = +m[1];
    return {
      current: entryTotals(id), past: [{ season_name: '2025/26', total_points: 2311, rank: 412000 }, { season_name: '2024/25', total_points: 2190, rank: 820000 }],
      chips: [{ name: 'wildcard', time: '2026-09-20T10:00:00Z', event: 5 }],
    };
  }
  if ((m = path.match(/^entry\/(\d+)\/transfers\/$/))) return [];
  if ((m = path.match(/^entry\/(\d+)\/event\/(\d+)\/picks\/$/))) {
    const id = +m[1];
    const s = squadFor(id);
    const hist = entryTotals(id);
    const last = hist[hist.length - 1];
    return {
      active_chip: id < 100 && id % 9 === 0 ? 'bboost' : null, automatic_subs: [],
      entry_history: { event: +m[2], points: 0, total_points: last.total_points, rank: null, overall_rank: last.overall_rank, bank: s.bank, value: 1000 - s.bank, event_transfers: 1, event_transfers_cost: 0, points_on_bench: 0 },
      picks: s.picks,
    };
  }
  if ((m = path.match(/^leagues-classic\/(\d+)\/standings\/(\?page_standings=(\d+))?$/))) {
    const lid = +m[1];
    const page = +(m[3] || 1);
    if (lid === 314) {
      const results = [];
      for (let i = 0; i < 50; i++) {
        const rank = (page - 1) * 50 + i + 1;
        const id = page === 1 || page === 10 ? rank : 5000000 + rank;
        results.push({ id: rank, event_total: 60 + (rank % 20), player_name: 'Elite ' + rank, rank, last_rank: rank + 2, rank_sort: rank, total: overallTotal(rank), entry: id, entry_name: 'Elite XI ' + rank });
      }
      return { league: { id: 314, name: 'Overall' }, standings: { has_next: true, page, results } };
    }
    const results = [];
    for (let i = 0; i < 18; i++) {
      const id = i === 3 ? 1234567 : 3000000 + lid * 100 + i;
      const hist = entryTotals(id);
      const last = hist[hist.length - 1];
      results.push({ id: i, event_total: 0, player_name: id === 1234567 ? 'Ahmed Hassan' : 'Rival ' + (i + 1), rank: 0, last_rank: 0, rank_sort: 0, total: last.total_points, entry: id, entry_name: id === 1234567 ? 'Alex Pharaohs' : 'Rival FC ' + (i + 1) });
    }
    results.sort((a, b) => b.total - a.total).forEach((r, i) => { r.rank = i + 1; r.last_rank = i + 1; r.rank_sort = i + 1; });
    return { league: { id: lid, name: lid === 1001 ? 'Alexandria Friends' : 'Work League' }, standings: { has_next: false, page: 1, results } };
  }
  if ((m = path.match(/^element-summary\/(\d+)\/$/))) {
    const id = +m[1];
    const hist = [];
    for (let gw = 1; gw < CURRENT; gw++) {
      const s = d.gwPoints[gw]?.[id];
      hist.push({ round: gw, total_points: s?.total_points || 0, minutes: s?.minutes || 0, goals_scored: s?.goals_scored || 0, assists: s?.assists || 0, expected_goals: String(s?.expected_goals || 0), expected_assists: String(s?.expected_assists || 0), bonus: s?.bonus || 0 });
    }
    return { fixtures: [], history: hist, history_past: [] };
  }
  return undefined;
}

module.exports = { route };
