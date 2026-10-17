// Checks that the browser engine reproduces the MATLAB results and the
// published estimates. Run with: npm test
import { readFileSync, existsSync } from 'node:fs';
import { Engine, mergeV17 } from '../assets/js/engine.js';

const model = JSON.parse(readFileSync(new URL('../data/model.json', import.meta.url)));
const v17url = new URL('../data/model_v17.json', import.meta.url);
const hasV17 = existsSync(v17url);
if (hasV17) mergeV17(model, JSON.parse(readFileSync(v17url)));
const e = new Engine(model);
let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) failures++; };
check(hasV17, 'data/model_v17.json (piecewise-cost mixed logit, CHSP costs) is present');

for (const r of e.validate()) {
  check(r.mnlOk, `${r.id} MNL uptake ${r.mnl.toFixed(4)} vs MATLAB ${r.mnlMatlab.toFixed(4)}`);
  check(r.keepOk, `${r.id} retention ${r.keep.toFixed(4)} vs MATLAB ${r.keepMatlab.toFixed(4)}`);
  check(r.mxlOk, `${r.id} mixed logit uptake ${r.mxl.toFixed(4)} vs MATLAB ${r.mxlMatlab.toFixed(4)}`);
}

// Published MNL willingness to pay, A$ per session
const published = { 'caregiver: Yes': 17.5, 'type: Psychological counselling': 16.5, 'frequency: Weekly': 15.4,
  'distance: Wider community (50+ km)': -21.0 };
const w = e.wtp('mnl');
for (const [param, val] of Object.entries(published)) {
  const row = w.find((x) => e.level(x.attribute, x.level).param === param);
  check(Math.abs(row.point - val) < 0.06, `WTP ${row.label} ${row.point.toFixed(2)} vs published ${val}`);
}

// Feasible design space: 384 combinations of the six non-cost attributes x 4 prices = 1,536
const n = e.allFeasibleDesigns(0).length;
check(n * 4 === 1536, `feasible combinations ${n} x 4 prices = ${n * 4} (expected 1536)`);
for (const sc of e.scenarios) check(e.isFeasible(sc.design), `${sc.id} is an admissible design`);

// Reference programme uptake when free and at A$50 (MNL 0.74 and 0.52)
const ref = { type: 'peer', carer: 'yes', mode: 'hybrid', frequency: 'weekly', duration: '2h', distance: 'local' };
const u0 = e.uptakeFixed('mnl', { ...ref, price: 0 }).point, u50 = e.uptakeFixed('mnl', { ...ref, price: 50 }).point;
check(Math.abs(u0 - 0.736) < 0.002 && Math.abs(u50 - 0.520) < 0.002, `reference programme MNL uptake ${u0.toFixed(3)} free, ${u50.toFixed(3)} at A$50`);

// MNL consumer surplus per person offered per session (MATLAB welfare_scenarios.csv)
const S = (id) => e.scenarios.find((x) => x.id === id).design;
const cs1 = e.valueDraws('mnl', { ...S('S1'), price: 0 }).point.CS;
const cs2 = e.valueDraws('mnl', S('S2')).point.CS;
check(Math.abs(cs1 - 74.64) < 0.2 && Math.abs(cs2 - 66.76) < 0.2, `MNL consumer surplus S1 free ${cs1.toFixed(2)} (MATLAB 74.64), S2 at A$5 ${cs2.toFixed(2)} (MATLAB 66.76)`);

if (hasV17) {
  const c = model.checkV17;
  // welfare (area under the acceptance curve to A$50) and CHSP-based costs of the eight scenarios
  e.scenarios.forEach((s, i) => {
    const W = e.valueDraws('mxlr', s.design, 1).point.CS;
    check(Math.abs(W - c.scenarios.welfare[i]) < 1e-6, `${s.id} welfare ${W.toFixed(4)} vs MATLAB ${c.scenarios.welfare[i].toFixed(4)}`);
    const cc = e.programmeCost(s.design, 'central'), cl = e.programmeCost(s.design, 'low'), ch = e.programmeCost(s.design, 'high'), cf = e.programmeCost(s.design, 'funded');
    const ok = (a, b) => (b == null || Number.isNaN(b) ? a == null : Math.abs(a - b) < 1e-9);
    check(ok(cc, c.scenarios.cost_central[i]) && ok(cl, c.scenarios.cost_low[i]) && ok(ch, c.scenarios.cost_high[i]) && ok(cf, c.scenarios.cost_funded[i]),
      `${s.id} provider cost ${cc == null ? 'none' : cc.toFixed(2)} vs MATLAB ${c.scenarios.cost_central[i] == null ? 'none' : c.scenarios.cost_central[i].toFixed(2)}`);
  });
  // fee table of the reference programme
  c.fees.fee.forEach((p, j) => {
    const P = e.uptakeMxl({ ...ref, price: p }, 0).point;
    const L = e.valueDraws('mxlr', { ...ref, price: 0 }, 1).point.CS - e.valueDraws('mxlr', { ...ref, price: p }, 1).point.CS;
    check(Math.abs(P - c.fees.acceptance[j]) < 1e-6 && Math.abs(L - c.fees.welfare_loss[j]) < 1e-6,
      `fee A$${p}: acceptance ${P.toFixed(4)} (MATLAB ${c.fees.acceptance[j].toFixed(4)}), welfare loss ${L.toFixed(4)} (MATLAB ${c.fees.welfare_loss[j].toFixed(4)})`);
  });
  const reach = e.reach({ ...ref, price: 0 });
  check(Math.abs(reach.neverShare - c.never_free) < 1e-9, `would not use the reference programme even if free ${(100 * reach.neverShare).toFixed(1)}% (MATLAB ${(100 * c.never_free).toFixed(1)}%)`);
  const couns = { type: 'counselling', carer: 'no', mode: 'inperson', frequency: 'weekly', duration: '30min', distance: 'local', price: 20 };
  const sub = e.substitution({ ...ref, price: 20 }, couns);
  check(Math.abs(sub.mxl.diversionNone - c.diversion_none) < 1e-6 && Math.abs(sub.mxl.none - c.share_none_two) < 1e-6,
    `diversion to no programme ${sub.mxl.diversionNone.toFixed(4)} (MATLAB ${c.diversion_none.toFixed(4)})`);
  // budget planner reproduces plan_budget.m
  const keys = ['type', 'carer', 'mode', 'frequency', 'duration', 'distance'];
  const toCodes = (d) => keys.map((k) => e.attribute(k).levels.findIndex((l) => l.key === d[k]) + 1);
  const grid = e.budgetGrid(e.budgetDesigns(), Array.from({ length: 101 }, (_, i) => i / 2));
  const B = c.budget;
  B.budgets_per_person_session.forEach((bud, j) => {
    for (const [cap, des, fee, wel, tag] of [[1, B.best_design[j], B.best_fee[j], B.welfare[j], ''], [0.5, B.cap50_best_design[j], B.cap50_best_fee[j], B.cap50_welfare[j], ', places for 50%']]) {
      const r = e.planBudget({ budgetPerPersonSession: bud, cap, grid }).best;
      const same = r && toCodes(r.design).every((x, i) => x === des[i]) && Math.abs(r.fee - fee) < 1e-9 && Math.abs(r.W - wel) < 1e-6;
      check(same, `budget A$${bud.toFixed(2)} per person offered per session${tag}: ${r ? `${toCodes(r.design).join('')} at A$${r.fee}` : 'none'} (MATLAB ${des.join('')} at A$${fee})`);
    }
  });
  const r0 = e.planBudget({ budgetPerPersonSession: 0, grid });
  check(toCodes(r0.accMax.design).every((x, i) => x === B.acc_max_design[i]) && r0.accMax.fee === B.acc_max_fee, `highest-acceptance design ${toCodes(r0.accMax.design).join('')} (MATLAB ${B.acc_max_design.join('')})`);
  check(toCodes(r0.wMax.design).every((x, i) => x === B.w_max_design[i]) && r0.wMax.fee === B.w_max_fee, `highest-welfare design ${toCodes(r0.wMax.design).join('')} (MATLAB ${B.w_max_design.join('')})`);
}

if (failures) { console.error(`\n${failures} check(s) failed`); process.exit(1); }
console.log('\nAll checks passed');
