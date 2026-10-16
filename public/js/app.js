import { t, setLang, getLang, fmtNum, fmtRank, money } from './i18n.js';
import { fpl, elite as fetchElite, pool, ApiError } from './api.js';
import * as M from './model.js';

// ---------------------------------------------------------------- state
const S = {
  id: null, bs: null, fixtures: null, elById: {}, teamById: {}, info: null,
  entry: null, history: null, picks: null, planPicks: null, live: null, gwFixtures: [], elite: null,
  proj: null, tab: 'live', ft: 1, bank: 0, horizon: 5, demo: false,
  cache: {}, pf: { q: '', pos: 0, team: 0, max: 0, sort: 'xp1', dir: -1, limit: 60 }, fxMode: 'att',
  league: null, leagueRows: null, timer: null, lastLive: null,
};
const TABS = ['live', 'team', 'transfers', 'captain', 'chips', 'elite', 'fixtures', 'players', 'leagues', 'rank', 'prices'];
const TAB_KEYS = {
  live: 'tabLive', team: 'tabTeam', transfers: 'tabTransfers', captain: 'tabCaptain', chips: 'tabChips', elite: 'tabElite',
  fixtures: 'tabFixtures', players: 'tabPlayers', leagues: 'tabLeagues', rank: 'tabRank', prices: 'tabPrices',
};

const $ = (s, r = document) => r.querySelector(s);
const app = $('#app');
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const el = (id) => S.elById[id];
const team = (id) => S.teamById[id] || { short_name: '?', name: '?' };
const xp = (id, gw) => (S.proj && S.proj.xp[id] ? S.proj.xp[id][gw] || 0 : 0);
const xpSum = (id, n) => S.proj.gws.slice(0, n).reduce((s, g) => s + xp(id, g), 0);
const sign = (n, d = 1) => (n > 0 ? '+' : n < 0 ? '−' : '') + fmtNum(Math.abs(n), d);
const posTag = (p) => `<span class="tag pos-${p}">${M.POS[p]}</span>`;

// ---------------------------------------------------------------- kits
const KITS = {
  ARS: ['#EF0107', '#ffffff'], AVL: ['#670E36', '#95BFE5'], BOU: ['#DA291C', '#111111'], BRE: ['#E30613', '#ffffff'],
  BHA: ['#0057B8', '#ffffff'], BUR: ['#6C1D45', '#99D6EA'], CHE: ['#034694', '#ffffff'], CRY: ['#1B458F', '#C4122E'],
  EVE: ['#003399', '#ffffff'], FUL: ['#ffffff', '#111111'], LEE: ['#ffffff', '#1D428A'], LIV: ['#C8102E', '#ffffff'],
  MCI: ['#6CABDD', '#ffffff'], MUN: ['#DA291C', '#111111'], NEW: ['#241F20', '#ffffff'], NFO: ['#DD0000', '#ffffff'],
  SUN: ['#EB172B', '#ffffff'], TOT: ['#ffffff', '#132257'], WHU: ['#7A263A', '#1BB1E7'], WOL: ['#FDB913', '#231F20'],
  IPS: ['#3A64A3', '#ffffff'], LEI: ['#003090', '#FDBE11'], SOU: ['#D71920', '#ffffff'], MID: ['#E21A23', '#ffffff'],
  COV: ['#59CBE8', '#ffffff'], NOR: ['#FFF200', '#00A650'], WAT: ['#FBEE23', '#ED2127'], SHU: ['#EE2737', '#ffffff'],
  LUT: ['#F78F1E', '#002D62'], HUL: ['#F5A12D', '#111111'], WBA: ['#122F67', '#ffffff'], STK: ['#E03A3E', '#ffffff'],
};
function kit(short) {
  if (KITS[short]) return KITS[short];
  let h = 0;
  for (const c of short) h = (h * 31 + c.charCodeAt(0)) % 360;
  return [`hsl(${h} 65% 42%)`, '#ffffff'];
}
function shirt(teamId, gk) {
  const [a, b] = gk ? ['#2f3a40', '#b6f09c'] : kit(team(teamId).short_name);
  return `<svg viewBox="0 0 40 36" aria-hidden="true"><path d="M13 2 L5 5 L1 13 L7 16 L9 13 L9 34 L31 34 L31 13 L33 16 L39 13 L35 5 L27 2 Q20 7 13 2Z" fill="${a}" stroke="rgba(0,0,0,.35)" stroke-width="1"/><path d="M13 2 Q20 7 27 2" fill="none" stroke="${b}" stroke-width="2.2"/><path d="M9 13 L9 34" stroke="${b}" stroke-width="1.2" opacity=".7"/><path d="M31 13 L31 34" stroke="${b}" stroke-width="1.2" opacity=".7"/></svg>`;
}

// ---------------------------------------------------------------- fixtures text
function fxText(teamId, gw) {
  const list = (S.proj && S.proj.fmap[teamId] && S.proj.fmap[teamId][gw]) || [];
  if (!list.length) return '—';
  return list.map((f) => (f.home ? team(f.opp).short_name : team(f.opp).short_name.toLowerCase())).join(' ');
}

// ---------------------------------------------------------------- pitch
function playerChip(id, value, o = {}) {
  const e = el(id);
  if (!e) return '';
  const flag = e.status === 'i' || e.status === 's' || e.status === 'u' ? 'i' : e.status === 'd' ? 'd' : '';
  return `<button class="pl ${o.cls || ''}" data-player="${id}" title="${esc(e.web_name)}">
    ${o.cap ? '<span class="badge">C</span>' : o.vice ? '<span class="badge v">V</span>' : ''}
    ${flag ? `<span class="flag ${flag}"></span>` : ''}
    <span class="shirt">${shirt(e.team, e.element_type === 1)}</span>
    <span class="nm">${esc(e.web_name)}</span>
    <span class="val num">${value}</span>
    ${o.fx ? `<span class="fx">${esc(o.fx)}</span>` : ''}
  </button>`;
}
function pitch(xiIds, benchIds, valFn, o = {}) {
  const rows = { 1: [], 2: [], 3: [], 4: [] };
  xiIds.forEach((id) => rows[el(id).element_type].push(id));
  const chip = (id) =>
    playerChip(id, valFn(id), { cap: id === o.cap, vice: id === o.vice, cls: o.cls ? o.cls(id) : '', fx: o.fx ? o.fx(id) : '' });
  return `<div class="pitch"><span class="box top"></span>
    ${[1, 2, 3, 4].map((p) => `<div class="row">${rows[p].map(chip).join('')}</div>`).join('')}
    ${benchIds && benchIds.length ? `<div class="bench">${benchIds.map(chip).join('')}</div>` : ''}
  </div>`;
}

// ---------------------------------------------------------------- loading
function showLoading(msg) {
  app.innerHTML = `<div class="loading"><div class="spinner"></div>${esc(msg || t('loadingData'))}</div>`;
}
function showError(e, retry) {
  let msg = t('errNetwork');
  if (e && e.status === 404) msg = t('errNotFound');
  else if (e && e.status === 503) msg = t('errUpdating');
  app.innerHTML = `<div class="panel error"><p>${esc(msg)}</p>${retry ? `<button class="btn" data-action="retry">${t('retry')}</button>` : ''}</div>`;
}

async function loadBase() {
  if (S.bs) return;
  const [bs, fixtures] = await Promise.all([fpl('bootstrap-static/'), fpl('fixtures/')]);
  S.bs = bs;
  S.fixtures = fixtures;
  S.elById = Object.fromEntries(bs.elements.map((e) => [e.id, e]));
  S.teamById = Object.fromEntries(bs.teams.map((x) => [x.id, x]));
  S.info = M.gwInfo(bs);
  S.proj = M.buildProjections(bs, fixtures, { horizon: 8 });
}

async function loadTeam(id) {
  stopTimer();
  S.id = id;
  S.cache = {};
  S.league = null;
  S.leagueRows = null;
  S.elite = null;
  showLoading();
  try {
    await loadBase();
    const [entry, history] = await Promise.all([fpl(`entry/${id}/`, { fresh: true }), fpl(`entry/${id}/history/`, { fresh: true })]);
    S.entry = entry;
    S.history = history;
    const gw = S.info.current;
    S.picks = null;
    S.live = null;
    S.gwFixtures = S.fixtures.filter((f) => f.event === gw);
    if (gw && entry.started_event <= gw) {
      const [picks, live] = await Promise.all([fpl(`entry/${id}/event/${gw}/picks/`), fpl(`event/${gw}/live/`, { fresh: true })]);
      S.picks = picks;
      S.live = live;
      S.lastLive = Date.now();
      S.planPicks = picks;
      // A Free Hit squad reverts afterwards: plan from the squad before it.
      if (picks.active_chip === 'freehit' && gw > 1) {
        try { S.planPicks = await fpl(`entry/${id}/event/${gw - 1}/picks/`); } catch (e) {}
      }
    } else {
      S.planPicks = null;
    }
    S.bank = (S.picks && S.picks.entry_history.bank) || entry.last_deadline_bank || 0;
    S.ft = M.freeTransfers(history, gw);
    saveRecent(id, entry.name);
    fetchElite(gw || 1).then((d) => { S.elite = d; if (['live', 'elite', 'captain'].includes(S.tab)) render(); }).catch(() => (S.elite = { error: true }));
    if (!TABS.includes(S.tab)) S.tab = 'live';
    render();
    startTimer();
  } catch (e) {
    console.error(e);
    showError(e, true);
  }
}

// ---------------------------------------------------------------- recent ids
function recent() {
  try { return JSON.parse(localStorage.getItem('recent') || '[]'); } catch (e) { return []; }
}
function saveRecent(id, name) {
  try {
    const r = recent().filter((x) => x.id !== id);
    r.unshift({ id, name });
    localStorage.setItem('recent', JSON.stringify(r.slice(0, 4)));
    localStorage.setItem('lastId', id);
  } catch (e) {}
}

// ---------------------------------------------------------------- landing
function renderLanding() {
  stopTimer();
  const rec = recent();
  app.innerHTML = `
  <section class="landing">
    <div>
      <h1>${t('heroTitle')}</h1>
      <p class="lede">${t('heroLede')}</p>
      <form class="bigform" data-form="id">
        <input name="id" inputmode="numeric" pattern="[0-9]*" maxlength="9" placeholder="${t('teamIdPh')}" aria-label="${t('teamIdLabel')}" required />
        <button class="btn" type="submit">${t('load')}</button>
      </form>
      <p class="howto">${t('howto')}<br /><code>fantasy.premierleague.com/entry/<b>1234567</b>/event/8</code></p>
      ${rec.length ? `<div class="recent"><span class="muted" style="font-size:13px">${t('recent')}:</span>${rec.map((r) => `<button class="btn ghost small" data-open="${r.id}">${esc(r.name || r.id)}</button>`).join('')}</div>` : ''}
      <ul class="feature-list">
        ${[1, 2, 3, 4, 5, 6].map((i) => `<li><b>${t('f' + i)}</b>${t('f' + i + 'd')}</li>`).join('')}
      </ul>
    </div>
    <div>${landingPitch()}</div>
  </section>`;
}
function landingPitch() {
  // A decorative formation drawn with blank shirts.
  const row = (n) => `<div class="row">${Array.from({ length: n }, () => `<span class="pl" style="cursor:default"><span class="shirt"><svg viewBox="0 0 40 36"><path d="M13 2 L5 5 L1 13 L7 16 L9 13 L9 34 L31 34 L31 13 L33 16 L39 13 L35 5 L27 2 Q20 7 13 2Z" fill="rgba(238,243,234,.9)"/></svg></span></span>`).join('')}</div>`;
  return `<div class="pitch" aria-hidden="true"><span class="box top"></span>${row(1)}${row(4)}${row(4)}${row(2)}</div>`;
}

// ---------------------------------------------------------------- main render
function render() {
  if (!S.entry) return renderLanding();
  const tabs = `<nav class="tabs" role="tablist">${TABS.map((k) => `<button class="tab" role="tab" aria-selected="${S.tab === k}" data-tab="${k}">${t(TAB_KEYS[k])}</button>`).join('')}</nav>`;
  let body = '';
  try {
    body = VIEWS[S.tab]();
  } catch (e) {
    console.error(e);
    body = `<div class="panel error">${esc(e.message)}</div>`;
  }
  app.innerHTML = summary() + tabs + `<section id="view">${body}</section>` + `<footer class="foot"><p>${t('modelNote')}</p><p>${t('disclaimer')}</p></footer>`;
  const ti = $('#teamid');
  if (ti && !ti.value) ti.value = S.id;
}

function liveCalc() {
  if (!S.picks || !S.live) return null;
  return M.liveTeam({ picks: S.picks, live: S.live, fixtures: S.gwFixtures, elById: S.elById });
}

function summary() {
  const e = S.entry;
  const lt = liveCalc();
  const hist = (S.history && S.history.current) || [];
  const last = hist[hist.length - 1];
  const prev = hist.find((h) => h.event === S.info.current - 1);
  const rank = e.summary_overall_rank;
  const move = prev && rank ? prev.overall_rank - rank : 0;
  const gwPts = lt ? lt.net : e.summary_event_points;
  const value = S.picks ? S.picks.entry_history.value : e.last_deadline_value;
  return `<div class="summary">
    <div><span class="team">${esc(e.name)}</span><span class="sub">${esc(e.player_first_name)} ${esc(e.player_last_name)} · ${t('gw')} ${S.info.current}${S.demo ? ' · ' + t('demo') : ''}</span></div>
    <div><span class="k">${t('overallRank')}</span><span class="v num">${fmtRank(rank)}</span> ${move ? `<span class="${move > 0 ? 'up' : 'down'}" style="font-size:12.5px">${move > 0 ? '▲' : '▼'}</span>` : ''}</div>
    <div><span class="k">${t('gwPoints')}</span><span class="v num">${fmtNum(gwPts)}</span></div>
    <div><span class="k">${t('totalPoints')}</span><span class="v num">${fmtNum(e.summary_overall_points)}</span></div>
    <div><span class="k">${t('bank')}</span><span class="v num">${money(S.bank)}</span><span class="sub" style="display:block">${value ? money(value) : ''}</span></div>
    <div><span class="k">${t('freeTransfers')}</span><span class="v num">${S.ft}</span></div>
  </div>`;
}

// ---------------------------------------------------------------- views
const VIEWS = {};

VIEWS.live = () => {
  const lt = liveCalc();
  if (!lt) return `<div class="panel empty">${t('noLive')}</div>`;
  const started = S.gwFixtures.some((f) => f.started);
  const anyLive = S.gwFixtures.some((f) => f.started && !f.finished_provisional);
  const starters = lt.rows.filter((r) => r.active).map((r) => r.element);
  const benchIds = lt.rows.filter((r) => !r.active).sort((a, b) => a.position - b.position).map((r) => r.element);
  const rowBy = Object.fromEntries(lt.rows.map((r) => [r.element, r]));
  const subIn = new Set(lt.subs.map((s) => s.in));
  const chips = pitch(starters, benchIds, (id) => {
    const r = rowBy[id];
    const v = r.active ? r.livePts : r.pts;
    return r.state === 'yet' || r.state === 'blank' ? '–' : fmtNum(v);
  }, {
    cap: lt.capId,
    vice: (lt.rows.find((r) => r.is_vice_captain) || {}).element,
    cls: (id) => {
      const r = rowBy[id];
      return [r.active ? '' : 'off', subIn.has(id) ? 'subin' : '', r.state === 'playing' ? 'playing' : r.state === 'dnp' ? 'dnp' : r.state === 'done' ? 'done' : ''].join(' ');
    },
    fx: (id) => {
      const r = rowBy[id];
      if (r.bonusProv) return `+${r.bonusProv} ${t('provBonus')}`;
      return r.state === 'yet' ? fxText(r.el.team, S.info.current) : stateText(r.state);
    },
  });

  // Rank estimates
  const prevRank = ((S.history.current || []).find((h) => h.event === S.info.current - 1) || {}).overall_rank;
  const eoAll = {};
  for (const e of S.bs.elements) eoAll[e.id] = (+e.selected_by_percent || 0) / 100;
  const mc = S.info.currentEvent && S.info.currentEvent.most_captained;
  if (mc) eoAll[mc] = (eoAll[mc] || 0) + 0.4;
  const refAvg = M.referenceScore(eoAll, S.live, S.gwFixtures);
  const estRank = started ? M.estimateRank(prevRank, lt.net, refAvg) : null;
  let refElite = null;
  if (S.elite && S.elite.eo) {
    const eoE = {};
    for (const k in S.elite.eo) eoE[k] = S.elite.eo[k] / 100;
    refElite = M.referenceScore(eoE, S.live, S.gwFixtures);
  }

  const mine = new Set(lt.rows.map((r) => r.element));
  const liveById = Object.fromEntries((S.live.elements || []).map((x) => [x.id, x]));
  let threats = '', diffs = '';
  if (S.elite && S.elite.eo) {
    const th = Object.entries(S.elite.eo)
      .map(([id, eo]) => ({ id: +id, eo, pts: (liveById[id] && liveById[id].stats.total_points) || 0 }))
      .filter((x) => !mine.has(x.id) && x.eo >= 15 && el(x.id))
      .sort((a, b) => b.eo * Math.max(b.pts, 0.5) - a.eo * Math.max(a.pts, 0.5))
      .slice(0, 8);
    threats = th.map((x) => `<tr class="click" data-player="${x.id}"><td><span class="pname">${esc(el(x.id).web_name)}</span> <span class="muted">${team(el(x.id).team).short_name}</span></td><td class="n num">${fmtNum(x.eo)}%</td><td class="n num">${fmtNum(x.pts)}</td></tr>`).join('');
    diffs = lt.rows
      .filter((r) => r.active)
      .map((r) => ({ id: r.element, eo: S.elite.eo[r.element] || 0, pts: r.livePts }))
      .filter((x) => x.eo < 30)
      .sort((a, b) => a.eo - b.eo)
      .slice(0, 6)
      .map((x) => `<tr class="click" data-player="${x.id}"><td><span class="pname">${esc(el(x.id).web_name)}</span></td><td class="n num">${fmtNum(x.eo)}%</td><td class="n num">${fmtNum(x.pts)}</td></tr>`)
      .join('');
  }

  return `<div class="grid2">
    <div class="stack">
      <div class="panel hero-panel">
        <div class="livebar">
          <div><span class="k muted" style="font-size:13px">${anyLive ? '<span class="pulse"></span>' : ''}${t('livePoints')}</span><div class="big num">${fmtNum(lt.net)}</div>
          ${lt.cost ? `<span class="muted" style="font-size:12.5px">${fmtNum(lt.total)} − ${lt.cost} ${t('hit')}</span>` : ''}</div>
          <div><span class="muted" style="font-size:13px">${t('estRank')}</span><div class="v num" style="font-size:24px;font-weight:600">${estRank ? fmtRank(estRank) : '–'}</div>
          ${estRank && prevRank ? `<span class="${estRank < prevRank ? 'up' : 'down'} num" style="font-size:13px">${estRank < prevRank ? '▲' : '▼'} ${fmtRank(Math.abs(prevRank - estRank))}</span>` : ''}</div>
          <div><span class="muted" style="font-size:13px">${t('playersLeft')}</span><div class="num" style="font-size:24px;font-weight:600">${lt.playersLeft}</div></div>
          <div><span class="muted" style="font-size:13px">${t('bench')}</span><div class="num" style="font-size:24px;font-weight:600">${fmtNum(lt.benchPts)}</div></div>
        </div>
        <div class="kv" style="margin-top:12px">
          <div><span class="k">${t('vsAvg')}</span><span class="v num ${lt.net - refAvg >= 0 ? 'up' : 'down'}">${sign(lt.net - refAvg)}</span></div>
          <div><span class="k">${t('vsElite')}</span><span class="v num ${refElite == null ? '' : lt.net - refElite >= 0 ? 'up' : 'down'}">${refElite == null ? '…' : sign(lt.net - refElite)}</span></div>
          ${lt.subs.length ? `<div><span class="k">${t('autoSubs')}</span><span class="v" style="font-size:14px">${lt.subs.map((s) => `${esc(el(s.out).web_name)} → ${esc(el(s.in).web_name)}`).join('<br>')}</span></div>` : ''}
        </div>
        <p class="note">${t('estRankNote')} ${anyLive ? t('refreshIn') : ''}</p>
      </div>
      ${chips}
    </div>
    <div class="stack">
      <div class="panel"><h2>${t('matches')}</h2>${matchList()}</div>
      ${S.elite && S.elite.eo ? `<div class="panel"><h2>${t('threats')}</h2><div class="tbl-wrap"><table><thead><tr><th></th><th class="n">${t('eo')}</th><th class="n">${t('pts')}</th></tr></thead><tbody>${threats}</tbody></table></div></div>
      <div class="panel"><h2>${t('yourDiffs')}</h2><div class="tbl-wrap"><table><thead><tr><th></th><th class="n">${t('eo')}</th><th class="n">${t('pts')}</th></tr></thead><tbody>${diffs || `<tr><td class="muted">–</td></tr>`}</tbody></table></div></div>` : S.elite && S.elite.error ? '' : `<div class="panel muted">${t('computing')}</div>`}
    </div>
  </div>`;
};

function stateText(s) {
  return { yet: t('statusYet'), playing: t('statusPlaying'), 'live-bench': t('statusPlaying'), done: t('statusDone'), 'done-more': t('statusPlaying'), dnp: t('statusDnp'), blank: t('blank') }[s] || '';
}

function matchList() {
  return S.gwFixtures
    .slice()
    .sort((a, b) => (a.kickoff_time || '').localeCompare(b.kickoff_time || ''))
    .map((f) => {
      const live = f.started && !f.finished_provisional;
      const sc = f.started ? `${f.team_h_score ?? 0} - ${f.team_a_score ?? 0}` : new Date(f.kickoff_time).toLocaleString(getLang() === 'ar' ? 'ar-EG' : 'en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
      return `<div class="match"><span>${esc(team(f.team_h).name)}</span><span class="sc ${live ? 'live' : ''} num">${esc(sc)}${live ? ` <small>${f.minutes}'</small>` : ''}</span><span class="t2">${esc(team(f.team_a).name)}</span></div>`;
    })
    .join('');
}

// ---------- My team
function planSquad() {
  const p = S.planPicks || S.picks;
  return p ? p.picks.map((x) => x.element) : [];
}
VIEWS.team = () => {
  const ids = planSquad();
  if (!ids.length) return `<div class="panel empty">${t('noLive')}</div>`;
  const g = S.proj.gws[0];
  const sq = ids.map((id) => ({ id, pos: el(id).element_type }));
  const lu = M.bestXI(sq, (id) => xp(id, g));
  const gws = S.proj.gws.slice(0, 6);
  const rows = ids
    .slice()
    .sort((a, b) => el(a).element_type - el(b).element_type || xpSum(b, 6) - xpSum(a, 6))
    .map((id) => {
      const e = el(id);
      return `<tr class="click" data-player="${id}"><td>${e.status !== 'a' ? `<span class="dot ${e.status}"></span>` : ''}<span class="pname">${esc(e.web_name)}</span> ${posTag(e.element_type)}</td>
        <td class="n num">${money(e.now_cost)}</td>
        ${gws.map((gw) => `<td class="n num" title="${esc(fxText(e.team, gw))}">${fmtNum(xp(id, gw), 1)}<br><span class="muted" style="font-size:11px">${esc(fxText(e.team, gw))}</span></td>`).join('')}
        <td class="n num"><b>${fmtNum(xpSum(id, 6), 1)}</b></td></tr>`;
    })
    .join('');
  return `<div class="grid2">
    <div class="stack">
      <div class="panel hero-panel"><h2>${t('planFor')} ${t('gw')} ${g}</h2>
        <div class="kv">
          <div><span class="k">${t('xp')} (${t('bestXI')})</span><span class="v num">${fmtNum(lu.points, 1)}</span></div>
          <div><span class="k">${t('formation')}</span><span class="v num">${lu.formation.join('-')}</span></div>
          <div><span class="k">${t('captain')}</span><span class="v" style="font-size:17px">${esc(el(lu.captain).web_name)}</span></div>
          <div><span class="k">${t('vice')}</span><span class="v" style="font-size:17px">${esc(el(lu.vice).web_name)}</span></div>
        </div>
      </div>
      ${pitch(lu.xi, lu.bench, (id) => fmtNum(xp(id, g), 1), { cap: lu.captain, vice: lu.vice, fx: (id) => fxText(el(id).team, g) })}
    </div>
    <div class="panel"><h2>${t('squadTable')}</h2>
      <div class="tbl-wrap"><table><thead><tr><th></th><th class="n">${t('price')}</th>${gws.map((gw) => `<th class="n">${t('gwShort')}${gw}</th>`).join('')}<th class="n">${t('xpTotal')}</th></tr></thead><tbody>${rows}</tbody></table></div>
    </div>
  </div>`;
};

// ---------- Transfers
function transferCtx() {
  return { bs: S.bs, proj: S.proj, squadIds: planSquad(), bank: S.bank, ft: S.ft, horizon: S.horizon, elById: S.elById };
}
function moveRow(m, showHit) {
  const outs = m.out.map((id) => el(id));
  const ins = m.in.map((id) => el(id));
  const who = (list, ids) => `<div class="who">${list.map((e, i) => `<span class="pname" data-player="${ids[i]}" style="cursor:pointer">${esc(e.web_name)}</span><span class="meta">${team(e.team).short_name} · ${money(e.now_cost)} · ${fmtNum(xpSum(ids[i], S.horizon), 1)} ${t('xp')}</span>`).join('')}</div>`;
  const hit = showHit ? Math.max(0, m.out.length - S.ft) * 4 : 0;
  const net = m.gain - hit;
  return `<div class="move">${who(outs, m.out)}<span class="arrow" aria-hidden="true">${getLang() === 'ar' ? '←' : '→'}</span>${who(ins, m.in)}
    <span class="gain num ${net >= 0 ? 'up' : 'down'}">${sign(net)}${hit ? `<br><span class="muted" style="font-size:11px;font-weight:400">−${hit} ${t('hit')}</span>` : ''}</span></div>`;
}
VIEWS.transfers = () => {
  if (!planSquad().length) return `<div class="panel empty">${t('noLive')}</div>`;
  const key = `tp-${S.horizon}-${S.ft}-${S.bank}`;
  if (!S.cache[key]) {
    defer(() => { S.cache[key] = M.transferPlans(transferCtx()); render(); });
    return controlsTransfers() + `<div class="loading"><div class="spinner"></div>${t('computing')}</div>`;
  }
  const P = S.cache[key];
  const rec = P.recommend;
  let recHtml;
  if (!rec || rec.k === 0 || rec.net <= 0) {
    recHtml = `<div class="reco"><h2>${t('recommendation')}: ${t('rollTransfer')}</h2><p>${t('rollWhy')}</p></div>`;
  } else {
    recHtml = `<div class="reco"><h2>${t('recommendation')}</h2>${moveRow(rec.plan, true)}<p style="margin:8px 0 0;font-size:13px;opacity:.85">${t('gainOver')} ${S.horizon} ${t('weeks')}</p></div>`;
  }
  const wcKey = `wc-${S.bank}`;
  const wc = S.cache[wcKey];
  return controlsTransfers() + `<div class="grid2">
    <div class="stack">${recHtml}
      <div class="panel"><h2>${t('singles')}</h2>${P.singles.slice(0, 8).map((m) => moveRow(m, true)).join('')}</div>
      <div class="panel"><h2>${t('doubles')}</h2>${P.doubles.slice(0, 6).map((m) => moveRow(m, true)).join('') || '<p class="muted">–</p>'}</div>
    </div>
    <div class="stack">
      <div class="panel"><h2>${t('wcSquad')}</h2>
        ${wc ? wcView(wc) : `<p class="muted">${t('buildNote')}</p><button class="btn" data-action="build-wc">${t('wildcardBuild')}</button>`}
      </div>
      <p class="note">${t('sellNote')}</p>
    </div>
  </div>`;
};
function controlsTransfers() {
  return `<div class="controls">
    <label>${t('freeTransfers')}<select data-set="ft">${[0, 1, 2, 3, 4, 5].map((n) => `<option ${n === S.ft ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    <label>${t('bank')} (£m)<input data-set="bank" type="number" step="0.1" min="0" max="100" value="${(S.bank / 10).toFixed(1)}" style="width:90px" /></label>
    <label>${t('horizon')}<span class="seg">${[3, 5, 8].map((n) => `<button type="button" data-horizon="${n}" aria-pressed="${S.horizon === n}">${n}</button>`).join('')}</span></label>
  </div>`;
}
function wcView(wc) {
  const cur = new Set(planSquad());
  const outs = planSquad().filter((id) => !wc.squadIds.includes(id));
  const ins = wc.squadIds.filter((id) => !cur.has(id));
  const g = wc.gws[0];
  return `<p><b class="up num">${sign(wc.gain)}</b> ${t('xp')} · ${t('bank')} ${money(wc.bank)}</p>
    ${pitch(wc.lineup.xi, wc.lineup.bench, (id) => fmtNum(xp(id, g), 1), { cap: wc.lineup.captain, vice: wc.lineup.vice, cls: (id) => (cur.has(id) ? '' : 'subin') })}
    <h3>${t('out')}</h3><p>${outs.map((id) => esc(el(id).web_name)).join('، ') || '–'}</p>
    <h3>${t('in')}</h3><p>${ins.map((id) => esc(el(id).web_name)).join('، ') || '–'}</p>`;
}

// ---------- Captain
VIEWS.captain = () => {
  const ids = planSquad();
  if (!ids.length) return `<div class="panel empty">${t('noLive')}</div>`;
  const g = S.proj.gws[0];
  const eliteCap = (S.elite && S.elite.captains) || {};
  const eliteEo = (S.elite && S.elite.eo) || {};
  const row = (id) => {
    const e = el(id);
    const c = eliteCap[id] || 0;
    const kind = c >= 30 ? `<span class="tag">${t('safe')}</span>` : c < 8 ? `<span class="tag">${t('diff')}</span>` : '';
    return `<tr class="click" data-player="${id}"><td><span class="pname">${esc(e.web_name)}</span> ${posTag(e.element_type)} ${kind}</td>
      <td>${esc(fxText(e.team, g))}</td><td class="n num"><b>${fmtNum(xp(id, g), 2)}</b></td>
      <td class="n num">${S.elite ? fmtNum(c) + '%' : '…'}</td><td class="n num">${S.elite ? fmtNum(eliteEo[id] || 0) + '%' : '…'}</td>
      <td class="n num">${S.elite ? fmtNum((c / 100) * xp(id, g), 2) : '…'}</td></tr>`;
  };
  const mineSorted = ids.slice().sort((a, b) => xp(b, g) - xp(a, g)).slice(0, 8);
  const overall = S.bs.elements.slice().sort((a, b) => xp(b.id, g) - xp(a.id, g)).slice(0, 10).map((e) => e.id);
  const head = `<thead><tr><th></th><th>${t('nextFixtures')}</th><th class="n">${t('xp')}</th><th class="n">${t('eliteCap')}</th><th class="n">${t('eo')}</th><th class="n" title="${esc(t('capRiskNote'))}">${t('capRisk')}</th></tr></thead>`;
  return `<div class="grid2">
    <div class="panel"><h2>${t('captainPicks')} — ${t('fromSquad')} (${t('gw')} ${g})</h2><div class="tbl-wrap"><table>${head}<tbody>${mineSorted.map(row).join('')}</tbody></table></div>
      <p class="note">${t('capRiskNote')}</p></div>
    <div class="panel"><h2>${t('captainPicks')} — ${t('all')}</h2><div class="tbl-wrap"><table>${head}<tbody>${overall.map(row).join('')}</tbody></table></div></div>
  </div>`;
};

// ---------- Chips
VIEWS.chips = () => {
  const ids = planSquad();
  if (!ids.length) return `<div class="panel empty">${t('noLive')}</div>`;
  const key = `chips-${S.bank}`;
  if (!S.cache[key]) {
    defer(() => { S.cache[key] = M.chipPlanner({ bs: S.bs, proj: S.proj, squadIds: ids, bank: S.bank, elById: S.elById, weeks: 6 }); render(); });
    return `<div class="loading"><div class="spinner"></div>${t('computing')}</div>`;
  }
  const C = S.cache[key];
  const st = M.chipStatus(S.history, S.proj.gws[0]);
  const best = (k) => C.rows.reduce((a, r) => (r[k] > a[k] ? r : a), C.rows[0]);
  const maxOf = (k) => Math.max(...C.rows.map((r) => r[k]));
  const minOf = (k) => Math.min(...C.rows.map((r) => r[k]));
  const cell = (r, k) => {
    const v = r[k];
    const isBest = best(k).gw === r.gw;
    const span = maxOf(k) - minOf(k);
    const pct = span < 0.3 ? 0 : (v - minOf(k)) / span;
    const cls = pct > 0.85 ? 'h1' : pct > 0.65 ? 'h2' : pct > 0.45 ? 'h3' : '';
    return `<td class="c num ${cls}" style="text-align:center">${fmtNum(v, 1)}${isBest ? ' ★' : ''}</td>`;
  };
  const chipCard = (k, label) => `<div><span class="k">${label}</span><span class="v" style="font-size:15px">${st[k].available ? `<span class="up">${t('available')}</span>` : `<span class="muted">${t('used')} ${st[k].usedIn.map((g) => t('gwShort') + g).join(', ')}</span>`}</span></div>`;
  return `<div class="stack">
    <div class="panel hero-panel"><h2>${t('chipsTitle')}</h2>
      <div class="kv">${chipCard('wildcard', t('wildcard'))}${chipCard('freehit', t('freehit'))}${chipCard('bboost', t('bboost'))}${chipCard('3xc', t('tc'))}</div>
      <p style="margin-top:12px">${t('wcGain')} <b class="num up">${fmtNum(C.wildcard.gain, 1)}</b> ${t('wcGainSuffix')}.</p>
    </div>
    <div class="panel"><div class="tbl-wrap"><table class="ticker"><thead><tr><th>${t('gw')}</th><th class="n">${t('bestXI')}</th><th style="text-align:center">${t('bboost')}</th><th style="text-align:center">${t('tc')}</th><th style="text-align:center">${t('freehit')} (+)</th><th>${t('captain')}</th></tr></thead>
      <tbody>${C.rows.map((r) => `<tr><td><b>${t('gwShort')}${r.gw}</b>${dgwBadge(r.gw)}</td><td class="n num">${fmtNum(r.base, 1)}</td>${cell(r, 'bboost')}${cell(r, 'tc')}${cell(r, 'freehit')}<td>${esc(el(r.captain).web_name)}</td></tr>`).join('')}</tbody></table></div>
      <p class="note">${t('chipsNote')}</p></div>
  </div>`;
};
function dgwBadge(gw) {
  let d = 0, b = 0;
  for (const tid in S.proj.fmap) {
    const n = (S.proj.fmap[tid][gw] || []).length;
    if (n >= 2) d++;
    if (n === 0) b++;
  }
  return (d ? ` <span class="tag">${t('dgw')} ${d}</span>` : '') + (b ? ` <span class="tag">${t('bgw')} ${b}</span>` : '');
}

// ---------- Elite / top 500
VIEWS.elite = () => {
  const E = S.elite;
  if (!E) return `<div class="loading"><div class="spinner"></div>${t('computing')}</div>`;
  if (E.error || !E.cutoffs) return `<div class="panel empty">${t('noElite')}</div>`;
  const my = S.entry.summary_overall_points;
  const left = Math.max(1, 38 - S.info.current);
  const bands = Object.keys(E.cutoffs).map(Number).sort((a, b) => a - b);
  const maxPts = Math.max(...bands.map((b) => E.cutoffs[b].total), my);
  const minPts = Math.min(...bands.map((b) => E.cutoffs[b].total), my) - 10;
  const w = (v) => Math.max(2, ((v - minPts) / (maxPts - minPts)) * 100);
  const rungs = bands
    .map((b) => {
      const c = E.cutoffs[b];
      const gap = c.total - my;
      return `<div class="rung"><span>${b === 1 ? '#1' : 'Top ' + fmtRank(b)}</span><div class="bar ${b === 500 ? 'gold' : ''}"><i style="width:${w(c.total)}%"></i></div><span class="num">${fmtNum(c.total)} <small class="${gap > 0 ? 'down' : 'up'}">${gap > 0 ? '−' + gap : '+' + -gap}</small></span></div>`;
    })
    .join('');
  const you = `<div class="rung you"><span>${t('youAre')}</span><div class="bar"><i style="width:${w(my)}%"></i></div><span class="num">${fmtNum(my)}</span></div>`;
  const gap500 = E.cutoffs[500] ? E.cutoffs[500].total - my : null;
  const mine = new Set(planSquad());
  const g = S.proj.gws[0];
  const template = Object.entries(E.owned || {})
    .map(([id, o]) => ({ id: +id, o, eo: E.eo[id] || 0 }))
    .filter((x) => el(x.id) && x.o >= 25)
    .sort((a, b) => b.eo - a.eo)
    .slice(0, 18);
  const diffs = S.bs.elements
    .filter((e) => (+e.selected_by_percent || 0) < 8 && !mine.has(e.id) && (E.owned[e.id] || 0) < 15)
    .sort((a, b) => xpSum(b.id, 4) - xpSum(a.id, 4))
    .slice(0, 10);
  const chips = Object.entries(E.chips || {}).map(([k, v]) => `${t({ bboost: 'bboost', '3xc': 'tc', freehit: 'freehit', wildcard: 'wildcard', manager: 'wildcard' }[k] || k)}: ${v}`).join(' · ');
  return `<div class="grid2">
    <div class="stack">
      <div class="panel hero-panel"><h2>${t('eliteTitle')}</h2>
        ${gap500 != null ? `<div class="kv"><div><span class="k">${t('gapTo')} (Top 500)</span><span class="v num ${gap500 > 0 ? 'down' : 'up'}">${gap500 > 0 ? gap500 : '+' + -gap500}</span></div>
        <div><span class="k">${t('perWeek')}</span><span class="v num">${gap500 > 0 ? fmtNum(gap500 / left, 1) : '0'}</span></div>
        <div><span class="k">${t('remaining')}</span><span class="v num">${left}</span></div></div>` : ''}
        <h3>${t('cutoffs')}</h3><div class="ladder">${rungs}${you}</div>
        <p class="note">${t('eliteSample')}: ${E.sample} ${t('managers')} (#1–50, #451–500). ${chips ? t('eliteChips') + ': ' + chips : ''}</p>
      </div>
      <div class="panel"><h2>${t('differentials')}</h2><div class="tbl-wrap"><table><thead><tr><th></th><th class="n">${t('price')}</th><th class="n">${t('ownership')}</th><th class="n">${t('xp')} 4${t('gwShort')}</th></tr></thead>
        <tbody>${diffs.map((e) => `<tr class="click" data-player="${e.id}"><td><span class="pname">${esc(e.web_name)}</span> ${posTag(e.element_type)} <span class="muted">${team(e.team).short_name}</span></td><td class="n num">${money(e.now_cost)}</td><td class="n num">${e.selected_by_percent}%</td><td class="n num"><b>${fmtNum(xpSum(e.id, 4), 1)}</b></td></tr>`).join('')}</tbody></table></div></div>
    </div>
    <div class="panel"><h2>${t('template')}</h2><div class="tbl-wrap"><table><thead><tr><th></th><th class="n">${t('owned')}</th><th class="n">${t('eo')}</th><th class="n">${t('xp')} ${t('gwShort')}${g}</th></tr></thead>
      <tbody>${template.map((x) => `<tr class="click ${mine.has(x.id) ? 'mine' : ''}" data-player="${x.id}"><td><span class="pname">${esc(el(x.id).web_name)}</span> ${posTag(el(x.id).element_type)}</td><td class="n num">${fmtNum(x.o)}%</td><td class="n num">${fmtNum(x.eo)}%</td><td class="n num">${fmtNum(xp(x.id, g), 1)}</td></tr>`).join('')}</tbody></table></div>
      <p class="note">${t('inYourTeam')}: <span style="background:color-mix(in srgb, var(--gold) 20%, transparent);padding:0 6px;border-radius:3px">■</span></p></div>
  </div>`;
};

// ---------- Fixtures
VIEWS.fixtures = () => {
  const gws = S.proj.gws;
  const mode = S.fxMode;
  const score = (f) => (mode === 'att' ? f.lamFor : Math.exp(-f.lamAg));
  const vals = [];
  for (const tid in S.proj.fmap) for (const g of gws) for (const f of S.proj.fmap[tid][g] || []) vals.push(score(f));
  vals.sort((a, b) => a - b);
  const q = (p) => vals[Math.floor(p * (vals.length - 1))] || 0;
  const cuts = [q(0.84), q(0.67), q(0.5), q(0.33), q(0.16)];
  const cls = (v) => (v >= cuts[0] ? 'h1' : v >= cuts[1] ? 'h2' : v >= cuts[2] ? 'h3' : v >= cuts[3] ? 'h4' : v >= cuts[4] ? 'h5' : 'h6');
  const teams = S.bs.teams
    .map((tm) => {
      let sum = 0;
      for (const g of gws) for (const f of S.proj.fmap[tm.id][g] || []) sum += score(f);
      return { tm, avg: sum / gws.length };
    })
    .sort((a, b) => b.avg - a.avg);
  return `<div class="panel"><h2>${t('fixturesTitle')}</h2>
    <div class="controls"><span class="seg"><button data-fx="att" aria-pressed="${mode === 'att'}">${t('attack')}</button><button data-fx="def" aria-pressed="${mode === 'def'}">${t('defence')}</button></span></div>
    <div class="tbl-wrap"><table class="ticker"><thead><tr><th>${t('team')}</th>${gws.map((g) => `<th style="text-align:center">${t('gwShort')}${g}</th>`).join('')}<th class="n">${t('avgEase')}</th></tr></thead>
    <tbody>${teams.map(({ tm, avg }) => `<tr><td><b>${esc(tm.short_name)}</b></td>${gws.map((g) => {
      const list = S.proj.fmap[tm.id][g] || [];
      if (!list.length) return `<td class="c blank">—</td>`;
      const v = list.reduce((s, f) => s + score(f), 0) / list.length;
      return `<td class="c ${cls(list.length > 1 ? Math.max(v, cuts[1]) : v)}">${list.map((f) => (f.home ? team(f.opp).short_name : team(f.opp).short_name.toLowerCase())).join('<br>')}</td>`;
    }).join('')}<td class="n num">${fmtNum(mode === 'att' ? avg : avg * 100, mode === 'att' ? 2 : 0)}${mode === 'att' ? '' : '%'}</td></tr>`).join('')}</tbody></table></div>
    <p class="note">${t('fixturesNote')} ${getLang() === 'ar' ? 'حروف كبيرة = على أرضه.' : 'Upper case = home.'}</p></div>`;
};

// ---------- Players
VIEWS.players = () => {
  const f = S.pf;
  const g = S.proj.gws[0];
  const mine = new Set(planSquad());
  const cols = {
    xp1: (e) => xp(e.id, g), xp5: (e) => xpSum(e.id, 5), price: (e) => e.now_cost, form: (e) => +e.form,
    own: (e) => +e.selected_by_percent, total: (e) => e.total_points, xmins: (e) => S.proj.profiles[e.id].expMins,
    ppm: (e) => xpSum(e.id, 5) / (e.now_cost / 10), xgi: (e) => S.proj.profiles[e.id].xg90 + S.proj.profiles[e.id].xa90,
  };
  let list = S.bs.elements.filter((e) =>
    (!f.pos || e.element_type === f.pos) && (!f.team || e.team === f.team) && (!f.max || e.now_cost <= f.max * 10) &&
    (!f.q || (e.web_name + ' ' + e.first_name + ' ' + e.second_name).toLowerCase().includes(f.q.toLowerCase())));
  list.sort((a, b) => f.dir * (cols[f.sort](a) - cols[f.sort](b)));
  const total = list.length;
  list = list.slice(0, f.limit);
  const th = (k, label) => `<th class="n sort" data-sort="${k}" data-active="${f.sort === k}">${label}${f.sort === k ? (f.dir < 0 ? ' ▾' : ' ▴') : ''}</th>`;
  return `<div class="panel">
    <div class="controls">
      <label>${t('search')}<input data-pf="q" value="${esc(f.q)}" type="search" style="min-width:160px" /></label>
      <label>${t('position')}<select data-pf="pos"><option value="0">${t('all')}</option>${[1, 2, 3, 4].map((p) => `<option value="${p}" ${f.pos === p ? 'selected' : ''}>${M.POS[p]}</option>`).join('')}</select></label>
      <label>${t('team')}<select data-pf="team"><option value="0">${t('all')}</option>${S.bs.teams.map((x) => `<option value="${x.id}" ${f.team === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>
      <label>${t('maxPrice')}<select data-pf="max"><option value="0">${t('all')}</option>${[4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 9, 10, 11, 12, 13].map((p) => `<option value="${p}" ${f.max === p ? 'selected' : ''}>£${p}</option>`).join('')}</select></label>
    </div>
    <div class="tbl-wrap"><table><thead><tr><th></th>${th('price', t('price'))}${th('xp1', t('xp') + ' ' + t('gwShort') + g)}${th('xp5', t('xp') + ' 5' + t('gwShort'))}${th('ppm', t('perMillion'))}${th('xmins', t('xmins'))}${th('xgi', 'xGI/90')}${th('form', t('form'))}${th('own', t('ownership'))}${th('total', t('totalPoints'))}<th>${t('nextFixtures')}</th></tr></thead>
    <tbody>${list.map((e) => `<tr class="click ${mine.has(e.id) ? 'mine' : ''}" data-player="${e.id}">
      <td>${e.status !== 'a' ? `<span class="dot ${e.status}"></span>` : ''}<span class="pname">${esc(e.web_name)}</span> ${posTag(e.element_type)} <span class="muted">${team(e.team).short_name}</span></td>
      <td class="n num">${money(e.now_cost)}</td><td class="n num"><b>${fmtNum(cols.xp1(e), 1)}</b></td><td class="n num">${fmtNum(cols.xp5(e), 1)}</td>
      <td class="n num">${fmtNum(cols.ppm(e), 2)}</td><td class="n num">${fmtNum(cols.xmins(e))}</td><td class="n num">${fmtNum(cols.xgi(e), 2)}</td>
      <td class="n num">${e.form}</td><td class="n num">${e.selected_by_percent}%</td><td class="n num">${e.total_points}</td>
      <td class="muted" style="font-size:12px">${S.proj.gws.slice(0, 4).map((gw) => fxText(e.team, gw)).join(' · ')}</td></tr>`).join('')}</tbody></table></div>
    <p class="note">${t('showing')} ${list.length} / ${total}${total > list.length ? ` <button class="btn ghost small" data-action="more">+60</button>` : ''}</p>
  </div>`;
};

// ---------- Leagues
VIEWS.leagues = () => {
  const leagues = (S.entry.leagues && S.entry.leagues.classic) || [];
  const list = `<div class="panel"><h2>${t('leaguesTitle')}</h2><div class="tbl-wrap"><table><thead><tr><th></th><th class="n">${t('rank')}</th></tr></thead><tbody>
    ${leagues.map((l) => `<tr class="click ${S.league === l.id ? 'mine' : ''}" data-league="${l.id}"><td>${esc(l.name)}</td><td class="n num">${fmtRank(l.entry_rank)} ${l.entry_last_rank && l.entry_rank ? (l.entry_rank < l.entry_last_rank ? '<span class="up">▲</span>' : l.entry_rank > l.entry_last_rank ? '<span class="down">▼</span>' : '') : ''}</td></tr>`).join('')}
  </tbody></table></div></div>`;
  let table = `<div class="panel empty">${getLang() === 'ar' ? 'اختار دوري عشان تشوف الترتيب لايف.' : 'Pick a league to see its live table.'}</div>`;
  if (S.league) {
    if (!S.leagueRows) table = `<div class="loading"><div class="spinner"></div>${t('computing')}</div>`;
    else if (S.leagueRows.error) table = `<div class="panel error">${t('errNetwork')}</div>`;
    else {
      const rows = S.leagueRows.rows;
      table = `<div class="panel"><h2>${t('liveTable')}</h2><div class="tbl-wrap"><table><thead><tr><th class="n">#</th><th>${t('team')}</th><th class="n">${t('gwShort')}</th><th class="n">${t('totalPoints')}</th><th>${t('captain')}</th><th class="n">${t('playersLeft')}</th></tr></thead><tbody>
        ${rows.map((r, i) => `<tr class="${r.entry === S.id ? 'mine' : ''}"><td class="n num">${i + 1} ${r.rank !== i + 1 ? `<small class="${r.rank > i + 1 ? 'up' : 'down'}">${r.rank > i + 1 ? '▲' : '▼'}</small>` : ''}</td>
          <td><span class="pname">${esc(r.entry_name)}</span><br><span class="muted" style="font-size:12px">${esc(r.player_name)}</span></td>
          <td class="n num">${fmtNum(r.liveGw)}${r.chip ? ` <span class="tag">${esc(r.chip)}</span>` : ''}</td><td class="n num"><b>${fmtNum(r.liveTotal)}</b></td>
          <td>${r.cap ? esc(el(r.cap).web_name) : '–'}</td><td class="n num">${r.left ?? '–'}</td></tr>`).join('')}
      </tbody></table></div><p class="note">${t('liveNote')}</p></div>`;
    }
  }
  return `<div class="grid2" style="grid-template-columns:minmax(0,.8fr) minmax(0,1.4fr)">${list}${table}</div>`;
};
async function loadLeague(id) {
  S.league = id;
  S.leagueRows = null;
  render();
  try {
    const st = await fpl(`leagues-classic/${id}/standings/`, { fresh: true });
    const rows = st.standings.results.slice(0, 25);
    const gw = S.info.current;
    const picks = await pool(rows, 6, (r) => fpl(`entry/${r.entry}/event/${gw}/picks/`));
    S.leagueRows = {
      rows: rows
        .map((r, i) => {
          const p = picks[i];
          if (!p || !S.live) return { ...r, liveGw: r.event_total, liveTotal: r.total };
          const lt = M.liveTeam({ picks: p, live: S.live, fixtures: S.gwFixtures, elById: S.elById });
          const base = r.total - r.event_total;
          return { ...r, liveGw: lt.net, liveTotal: base + lt.net, cap: lt.capId, left: lt.playersLeft, chip: p.active_chip };
        })
        .sort((a, b) => b.liveTotal - a.liveTotal),
    };
  } catch (e) {
    S.leagueRows = { error: true };
  }
  if (S.tab === 'leagues') render();
}

// ---------- Rank history
VIEWS.rank = () => {
  const h = (S.history && S.history.current) || [];
  if (!h.length) return `<div class="panel empty">–</div>`;
  const avg = Object.fromEntries(S.info.events.map((e) => [e.id, e.average_entry_score]));
  const W = 720, H = 260, P = 34;
  const ranks = h.map((x) => x.overall_rank).filter(Boolean);
  const lo = Math.log10(Math.max(1, Math.min(...ranks) * 0.8));
  const hi = Math.log10(Math.max(...ranks) * 1.2);
  const xs = (i) => P + (i * (W - 2 * P)) / Math.max(1, h.length - 1);
  const ys = (r) => P + ((Math.log10(r) - lo) / Math.max(0.01, hi - lo)) * (H - 2 * P);
  const line = h.map((x, i) => `${i ? 'L' : 'M'}${xs(i).toFixed(1)},${ys(x.overall_rank || 1).toFixed(1)}`).join(' ');
  const ticks = [1, 10, 100, 500, 1000, 1e4, 1e5, 1e6, 5e6].filter((v) => Math.log10(v) >= lo && Math.log10(v) <= hi);
  const y500 = Math.log10(500) >= lo && Math.log10(500) <= hi ? ys(500) : null;
  const svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${t('rankTitle')}" style="direction:ltr">
    ${ticks.map((v) => `<line x1="${P}" x2="${W - P}" y1="${ys(v)}" y2="${ys(v)}" stroke="var(--line)"/><text x="4" y="${ys(v) + 4}">${fmtRank(v)}</text>`).join('')}
    ${y500 ? `<line x1="${P}" x2="${W - P}" y1="${y500}" y2="${y500}" stroke="var(--gold)" stroke-dasharray="4 4"/><text x="${W - P - 40}" y="${y500 - 5}" style="fill:var(--gold-ink)">Top 500</text>` : ''}
    <path d="${line}" fill="none" stroke="var(--pitch)" stroke-width="2.5" stroke-linejoin="round"/>
    ${h.map((x, i) => `<circle cx="${xs(i)}" cy="${ys(x.overall_rank || 1)}" r="3.5" fill="var(--paper)" stroke="var(--pitch)" stroke-width="2"><title>${t('gwShort')}${x.event}: ${fmtNum(x.overall_rank)}</title></circle>`).join('')}
    ${h.map((x, i) => (i % Math.ceil(h.length / 12) === 0 ? `<text x="${xs(i) - 8}" y="${H - 8}">${x.event}</text>` : '')).join('')}
  </svg>`;
  const maxP = Math.max(...h.map((x) => Math.max(x.points, avg[x.event] || 0)), 1);
  const BH = 160;
  const bw = (W - 2 * P) / h.length;
  const bars = `<svg viewBox="0 0 ${W} ${BH + 30}" role="img" aria-label="${t('gwPoints')}" style="direction:ltr">
    ${h.map((x, i) => {
      const bh = (x.points / maxP) * BH;
      const a = avg[x.event] || 0;
      return `<rect x="${P + i * bw + 2}" y="${BH - bh + 6}" width="${Math.max(2, bw - 4)}" height="${bh}" rx="2" fill="${x.points >= a ? 'var(--pitch)' : 'var(--cold-3)'}"><title>${t('gwShort')}${x.event}: ${x.points} (${t('avgScore')} ${a})</title></rect>
        ${a ? `<line x1="${P + i * bw + 1}" x2="${P + (i + 1) * bw - 1}" y1="${BH - (a / maxP) * BH + 6}" y2="${BH - (a / maxP) * BH + 6}" stroke="var(--ink)" stroke-width="2"/>` : ''}
        <text x="${P + i * bw + bw / 2 - 6}" y="${BH + 24}">${x.event}</text>`;
    }).join('')}
  </svg>`;
  const best = h.reduce((a, x) => (x.points > a.points ? x : a), h[0]);
  const worst = h.reduce((a, x) => (x.points < a.points ? x : a), h[0]);
  const benchTotal = h.reduce((s, x) => s + (x.points_on_bench || 0), 0);
  const hits = h.reduce((s, x) => s + (x.event_transfers_cost || 0), 0);
  return `<div class="stack">
    <div class="panel"><h2>${t('rankTitle')}</h2><div class="chart">${svg}</div></div>
    <div class="grid2">
      <div class="panel"><h2>${t('gwPoints')} <span class="muted" style="font-size:12.5px;font-weight:400">— ${t('avgScore')}</span></h2><div class="chart">${bars}</div></div>
      <div class="panel"><div class="kv">
        <div><span class="k">${t('bestGw')}</span><span class="v num">${best.points}</span><span class="muted"> ${t('gwShort')}${best.event}</span></div>
        <div><span class="k">${t('worstGw')}</span><span class="v num">${worst.points}</span><span class="muted"> ${t('gwShort')}${worst.event}</span></div>
        <div><span class="k">${t('benchPts')}</span><span class="v num">${benchTotal}</span></div>
        <div><span class="k">${t('hit')}</span><span class="v num">−${hits}</span></div>
      </div>
      ${(S.history.past || []).length ? `<h3>${t('pastSeasons')}</h3><table><tbody>${S.history.past.slice().reverse().map((p) => `<tr><td>${esc(p.season_name)}</td><td class="n num">${p.total_points}</td><td class="n num">${fmtRank(p.rank)}</td></tr>`).join('')}</tbody></table>` : ''}
      </div>
    </div>
  </div>`;
};

// ---------- Prices
VIEWS.prices = () => {
  const total = S.bs.total_players;
  const mine = new Set(planSquad());
  const list = S.bs.elements.map((e) => ({ e, p: M.priceProgress(e, total) }));
  const up = list.filter((x) => x.p > 0).sort((a, b) => b.p - a.p).slice(0, 20);
  const down = list.filter((x) => x.p < 0).sort((a, b) => a.p - b.p).slice(0, 20);
  const tbl = (rows, cls) => `<div class="tbl-wrap"><table><thead><tr><th></th><th class="n">${t('price')}</th><th class="n">${t('netTransfers')}</th><th>${t('progress')}</th></tr></thead><tbody>
    ${rows.map(({ e, p }) => `<tr class="click ${mine.has(e.id) ? 'mine' : ''}" data-player="${e.id}"><td><span class="pname">${esc(e.web_name)}</span> <span class="muted">${team(e.team).short_name}</span></td><td class="n num">${money(e.now_cost)}</td>
      <td class="n num">${sign(e.transfers_in_event - e.transfers_out_event, 0)}</td><td><div class="bar ${cls}"><i style="width:${Math.min(100, Math.abs(p) * 100)}%"></i></div><span class="num" style="font-size:12px">${Math.round(Math.abs(p) * 100)}%</span></td></tr>`).join('')}
  </tbody></table></div>`;
  return `<div class="grid2"><div class="panel"><h2>${t('risers')}</h2>${tbl(up, '')}</div><div class="panel"><h2>${t('fallers')}</h2>${tbl(down, 'down')}</div></div><p class="note">${t('pricesNote')}</p>`;
};

// ---------------------------------------------------------------- player modal
async function openPlayer(id) {
  const e = el(id);
  if (!e) return;
  const prof = S.proj.profiles[id];
  const rows = S.proj.gws.map((g) => {
    const d = S.proj.detail[id][g];
    return `<tr><td>${t('gwShort')}${g}</td><td>${esc(fxText(e.team, g))}</td><td class="n num"><b>${fmtNum(xp(id, g), 2)}</b></td><td class="n num">${fmtNum(d.mins)}</td><td class="n num">${fmtNum(d.goals, 2)}</td><td class="n num">${fmtNum(d.assists, 2)}</td><td class="n num">${fmtNum(d.cs * 100)}%</td></tr>`;
  }).join('');
  $('#modalbody').innerHTML = `<h2 style="margin:0 0 4px">${esc(e.first_name)} ${esc(e.second_name)}</h2>
    <p class="muted" style="margin:0 0 10px">${esc(team(e.team).name)} · ${M.POS[e.element_type]} · ${money(e.now_cost)} · ${t('selectedBy')} ${e.selected_by_percent}%</p>
    ${e.news ? `<div class="callout" style="margin-bottom:12px">${esc(e.news)}</div>` : ''}
    <div class="kv" style="margin-bottom:12px">
      <div><span class="k">${t('totalPoints')}</span><span class="v num">${e.total_points}</span></div>
      <div><span class="k">${t('mins')}</span><span class="v num">${e.minutes}</span></div>
      <div><span class="k">xG / xA</span><span class="v num" style="font-size:17px">${(+e.expected_goals).toFixed(1)} / ${(+e.expected_assists).toFixed(1)}</span></div>
      <div><span class="k">xGI/90</span><span class="v num">${(prof.xg90 + prof.xa90).toFixed(2)}</span></div>
      <div><span class="k">${t('goals')} / ${t('assists')}</span><span class="v num">${e.goals_scored} / ${e.assists}</span></div>
      <div><span class="k">${t('bonusPts')}</span><span class="v num">${e.bonus}</span></div>
    </div>
    <h3>${t('playerFixtures')}</h3>
    <div class="tbl-wrap"><table><thead><tr><th>${t('gwShort')}</th><th></th><th class="n">${t('xp')}</th><th class="n">${t('xmins')}</th><th class="n">xG</th><th class="n">xA</th><th class="n">CS</th></tr></thead><tbody>${rows}</tbody></table></div>
    <div id="phist"></div>`;
  openModal();
  try {
    const s = await fpl(`element-summary/${id}/`);
    const last = (s.history || []).slice(-6);
    if (last.length && $('#phist'))
      $('#phist').innerHTML = `<h3>${getLang() === 'ar' ? 'آخر الجولات' : 'Recent gameweeks'}</h3><div class="tbl-wrap"><table><thead><tr><th>${t('gwShort')}</th><th class="n">${t('pts')}</th><th class="n">${t('mins')}</th><th class="n">G</th><th class="n">A</th><th class="n">xG</th><th class="n">xA</th></tr></thead><tbody>
      ${last.map((x) => `<tr><td>${x.round}</td><td class="n num"><b>${x.total_points}</b></td><td class="n num">${x.minutes}</td><td class="n num">${x.goals_scored}</td><td class="n num">${x.assists}</td><td class="n num">${(+x.expected_goals).toFixed(2)}</td><td class="n num">${(+x.expected_assists).toFixed(2)}</td></tr>`).join('')}</tbody></table></div>`;
  } catch (err) {}
}
function openModal() {
  const m = $('#modal');
  m.hidden = false;
  $('#modalx').focus();
}
function closeModal() {
  $('#modal').hidden = true;
}

// ---------------------------------------------------------------- helpers
function defer(fn) {
  setTimeout(() => {
    try { fn(); } catch (e) { console.error(e); toast(e.message); }
  }, 30);
}
function toast(msg) {
  const x = $('#toast');
  x.textContent = msg;
  x.hidden = false;
  clearTimeout(x._t);
  x._t = setTimeout(() => (x.hidden = true), 2600);
}

// Live refresh while matches are in play
function startTimer() {
  stopTimer();
  S.timer = setInterval(async () => {
    if (document.hidden || !S.picks) return;
    const anyLive = S.gwFixtures.some((f) => f.started && !f.finished);
    const soon = S.gwFixtures.some((f) => !f.started && new Date(f.kickoff_time) - Date.now() < 5 * 60000);
    if (!anyLive && !soon) return;
    try {
      const gw = S.info.current;
      const [live, fx] = await Promise.all([fpl(`event/${gw}/live/`, { fresh: true }), fpl(`fixtures/?event=${gw}`, { fresh: true })]);
      S.live = live;
      S.gwFixtures = fx;
      S.lastLive = Date.now();
      if (['live', 'leagues'].includes(S.tab) && $('#modal').hidden) {
        if (S.tab === 'leagues' && S.league) loadLeague(S.league);
        else render();
      }
    } catch (e) {}
  }, 60000);
}
function stopTimer() {
  if (S.timer) clearInterval(S.timer);
  S.timer = null;
}

// ---------------------------------------------------------------- routing & events
function go(id, tab) {
  const h = `#/${id}${tab ? '/' + tab : ''}`;
  if (location.hash !== h) location.hash = h;
  else route();
}
function route() {
  const m = location.hash.match(/^#\/(\d{1,9})(?:\/(\w+))?/);
  if (!m) {
    S.entry = null;
    S.id = null;
    return render();
  }
  const id = +m[1];
  const tab = m[2] && TABS.includes(m[2]) ? m[2] : S.tab || 'live';
  S.tab = tab;
  if (id !== S.id || !S.entry) loadTeam(id);
  else render();
}
window.addEventListener('hashchange', route);

document.addEventListener('submit', (ev) => {
  const f = ev.target;
  if (f.id === 'idform' || f.dataset.form === 'id') {
    ev.preventDefault();
    const v = (f.querySelector('input').value || '').replace(/\D/g, '');
    if (v) go(+v, S.tab || 'live');
  }
});

document.addEventListener('click', (ev) => {
  const tgt = ev.target.closest('[data-tab],[data-player],[data-open],[data-action],[data-horizon],[data-fx],[data-sort],[data-league]');
  if (!tgt) {
    if (ev.target.id === 'modal') closeModal();
    return;
  }
  if (tgt.dataset.tab) return go(S.id, tgt.dataset.tab);
  if (tgt.dataset.open) return go(+tgt.dataset.open, 'live');
  if (tgt.dataset.player) return openPlayer(+tgt.dataset.player);
  if (tgt.dataset.league) return loadLeague(+tgt.dataset.league);
  if (tgt.dataset.horizon) { S.horizon = +tgt.dataset.horizon; return render(); }
  if (tgt.dataset.fx) { S.fxMode = tgt.dataset.fx; return render(); }
  if (tgt.dataset.sort) {
    const k = tgt.dataset.sort;
    if (S.pf.sort === k) S.pf.dir *= -1;
    else { S.pf.sort = k; S.pf.dir = -1; }
    return render();
  }
  const a = tgt.dataset.action;
  if (a === 'retry') { S.bs = null; return S.id ? loadTeam(S.id) : render(); }
  if (a === 'more') { S.pf.limit += 60; return render(); }
  if (a === 'build-wc') {
    tgt.disabled = true;
    tgt.textContent = t('computing');
    defer(() => {
      S.cache[`wc-${S.bank}`] = M.optimiseSquad({ bs: S.bs, proj: S.proj, squadIds: planSquad(), bank: S.bank, horizon: 6, elById: S.elById });
      render();
    });
  }
});

let typingTimer;
document.addEventListener('input', (ev) => {
  const x = ev.target;
  if (x.dataset.pf === 'q') {
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
      S.pf.q = x.value;
      S.pf.limit = 60;
      render();
      const n = document.querySelector('[data-pf="q"]');
      if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); }
    }, 250);
  }
});
document.addEventListener('change', (ev) => {
  const x = ev.target;
  if (x.dataset.pf && x.dataset.pf !== 'q') { S.pf[x.dataset.pf] = +x.value; S.pf.limit = 60; return render(); }
  if (x.dataset.set === 'ft') { S.ft = +x.value; return render(); }
  if (x.dataset.set === 'bank') { S.bank = Math.max(0, Math.round(+x.value * 10)); return render(); }
});
document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && !$('#modal').hidden) closeModal();
});
$('#modalx').addEventListener('click', closeModal);

// Language & theme
$('#langbtn').addEventListener('click', () => {
  setLang(getLang() === 'ar' ? 'en' : 'ar');
  $('#langbtn').textContent = getLang() === 'ar' ? 'EN' : 'ع';
  render();
});
$('#themebtn').addEventListener('click', () => {
  const root = document.documentElement;
  const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  root.dataset.theme = dark ? 'light' : 'dark';
  try { localStorage.setItem('theme', root.dataset.theme); } catch (e) {}
});
try {
  const th = localStorage.getItem('theme');
  if (th) document.documentElement.dataset.theme = th;
} catch (e) {}

setLang(getLang());
$('#langbtn').textContent = getLang() === 'ar' ? 'EN' : 'ع';
if (!location.hash) {
  let last = null;
  try { last = localStorage.getItem('lastId'); } catch (e) {}
  if (last) location.hash = `#/${last}/live`;
}
route();
