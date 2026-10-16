// Sanity checks for the model, run against the demo data: `npm test`
import { createRequire } from 'module';
import * as M from '../public/js/model.js';
const require = createRequire(import.meta.url);
const mock = require('../lib/mock.js');

let failed = 0;
const ok = (cond, msg) => {
  console.log((cond ? 'PASS ' : 'FAIL ') + msg);
  if (!cond) failed++;
};

const bs = mock.route('bootstrap-static/');
const fixtures = mock.route('fixtures/');
const elById = Object.fromEntries(bs.elements.map((e) => [e.id, e]));
const info = M.gwInfo(bs);
ok(info.current === 8 && info.next === 9, 'gameweek detection');

let t = Date.now();
const proj = M.buildProjections(bs, fixtures, { horizon: 8 });
ok(Date.now() - t < 1500, `projections built in ${Date.now() - t}ms`);
const all = bs.elements.map((e) => proj.xp[e.id][9]);
ok(all.every((x) => Number.isFinite(x) && x >= 0 && x < 20), 'all xP finite and in range');
const top = bs.elements.slice().sort((a, b) => proj.xp[b.id][9] - proj.xp[a.id][9]).slice(0, 8);
console.log('  top xP GW9:', top.map((e) => `${e.web_name}(${M.POS[e.element_type]}) ${proj.xp[e.id][9].toFixed(2)}`).join(', '));
const injured = bs.elements.find((e) => e.status === 'i');
ok(proj.xp[injured.id][9] === 0, 'injured player projects 0 next week');
ok(proj.xp[injured.id][14] > 0 || proj.profiles[injured.id].expMins === 0, 'injured player recovers later');
// Double gameweek: GW11 team with 2 fixtures
const dgwTeam = Object.keys(proj.fmap).find((t) => (proj.fmap[t][11] || []).length === 2);
ok(!!dgwTeam, 'double gameweek detected in GW11');

const picks = mock.route('entry/1234567/event/8/picks/');
const squadIds = picks.picks.map((p) => p.element);
const squad = squadIds.map((id) => ({ id, pos: elById[id].element_type }));
const lu = M.bestXI(squad, (id) => proj.xp[id][9]);
ok(lu && lu.xi.length === 11 && lu.bench.length === 4, 'best XI has 11 + 4');
const c = { 1: 0, 2: 0, 3: 0, 4: 0 };
lu.xi.forEach((id) => c[elById[id].element_type]++);
ok(c[1] === 1 && c[2] >= 3 && c[3] >= 2 && c[4] >= 1, 'best XI formation valid ' + lu.formation.join('-'));

t = Date.now();
const plans = M.transferPlans({ bs, proj, squadIds, bank: picks.entry_history.bank, ft: 2, horizon: 5, elById });
ok(Date.now() - t < 4000, `transfer search in ${Date.now() - t}ms`);
ok(plans.singles.length > 0, 'found single transfers');
const s = plans.singles[0];
ok(elById[s.out[0]].element_type === elById[s.in[0]].element_type, 'transfer keeps position');
console.log('  best single:', elById[s.out[0]].web_name, '->', elById[s.in[0]].web_name, s.gain.toFixed(2));
if (plans.doubles[0]) {
  const d = plans.doubles[0];
  console.log('  best double:', d.out.map((i) => elById[i].web_name), '->', d.in.map((i) => elById[i].web_name), d.gain.toFixed(2));
}
console.log('  recommend k =', plans.recommend.k, 'net', plans.recommend.net.toFixed(2));

t = Date.now();
const wc = M.optimiseSquad({ bs, proj, squadIds, bank: picks.entry_history.bank, horizon: 6, elById });
ok(Date.now() - t < 6000, `wildcard optimiser in ${Date.now() - t}ms`);
ok(wc.squadIds.length === 15 && new Set(wc.squadIds).size === 15, 'wildcard squad has 15 unique');
const cost = wc.squadIds.reduce((a, id) => a + elById[id].now_cost, 0);
const startCost = squadIds.reduce((a, id) => a + elById[id].now_cost, 0) + picks.entry_history.bank;
ok(cost <= startCost, `wildcard within budget (${cost} <= ${startCost})`);
const tc = {};
wc.squadIds.forEach((id) => (tc[elById[id].team] = (tc[elById[id].team] || 0) + 1));
ok(Object.values(tc).every((x) => x <= 3), 'max 3 per team');
ok(wc.gain >= 0, 'wildcard gain ' + wc.gain.toFixed(1));

t = Date.now();
const chips = M.chipPlanner({ bs, proj, squadIds, bank: picks.entry_history.bank, elById, weeks: 6 });
ok(Date.now() - t < 12000, `chip planner in ${Date.now() - t}ms`);
ok(chips.rows.length === 6, 'chip rows for 6 weeks');
console.log('  chips:', chips.rows.map((r) => `GW${r.gw} BB${r.bboost.toFixed(1)} TC${r.tc.toFixed(1)} FH+${r.freehit.toFixed(1)}`).join(' | '));

// Live
const live = mock.route('event/8/live/');
const gwFx = fixtures.filter((f) => f.event === 8);
const lt = M.liveTeam({ picks, live, fixtures: gwFx, elById });
ok(Number.isFinite(lt.total), 'live total ' + lt.total + ' (subs ' + lt.subs.length + ', left ' + lt.playersLeft + ')');
const activeCount = lt.rows.filter((r) => r.active).length;
ok(activeCount === 11, 'exactly 11 count without bench boost');

// Bonus tie rules
const b = M.bonusFromBps({ stats: [{ identifier: 'bps', h: [{ value: 30, element: 1 }, { value: 30, element: 2 }], a: [{ value: 20, element: 3 }, { value: 10, element: 4 }] }] });
ok(b[1] === 3 && b[2] === 3 && b[3] === 1 && !b[4], 'bonus tie for first: 3,3,1');
const b2 = M.bonusFromBps({ stats: [{ identifier: 'bps', h: [{ value: 30, element: 1 }, { value: 20, element: 2 }], a: [{ value: 20, element: 3 }, { value: 10, element: 4 }] }] });
ok(b2[1] === 3 && b2[2] === 2 && b2[3] === 2 && !b2[4], 'bonus tie for second: 3,2,2');

const hist = mock.route('entry/1234567/history/');
const ft = M.freeTransfers(hist, 8);
ok(ft >= 1 && ft <= 5, 'free transfers ' + ft);
const chipsSt = M.chipStatus(hist, 9);
ok(chipsSt.wildcard.available === false && chipsSt.freehit.available === true, 'chip availability by half');
ok(M.chipStatus(hist, 20).wildcard.available === true, 'second-half wildcard available');

console.log(failed ? `\n${failed} failed` : '\nAll checks passed');
process.exit(failed ? 1 : 0);
