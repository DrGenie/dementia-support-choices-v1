// Writes the tool-versus-package comparison used in Online Appendix Tables OA27 and OA28.
// Run with: node tests/check_table.mjs > tool_check_v17.csv
import { readFileSync } from 'node:fs';
import { Engine, mergeV17 } from '../assets/js/engine.js';

const model = JSON.parse(readFileSync(new URL('../data/model.json', import.meta.url)));
mergeV17(model, JSON.parse(readFileSync(new URL('../data/model_v17.json', import.meta.url))));
const e = new Engine(model);
const c = model.checkV17;
const out = ['table,item,tool,package,abs_diff'];
e.scenarios.forEach((s, i) => {
  const P = e.uptakeMxl(s.design, 0).point, W = e.valueDraws('mxlr', s.design, 1).point.CS;
  out.push(`acceptance,${s.id} ${s.name},${P},${c.scenarios.acceptance[i]},${Math.abs(P - c.scenarios.acceptance[i])}`);
  out.push(`welfare,${s.id} ${s.name},${W},${c.scenarios.welfare[i]},${Math.abs(W - c.scenarios.welfare[i])}`);
});
const keys = ['type', 'carer', 'mode', 'frequency', 'duration', 'distance'];
const toCodes = (d) => keys.map((k) => e.attribute(k).levels.findIndex((l) => l.key === d[k]) + 1).join('');
const grid = e.budgetGrid(e.budgetDesigns(), Array.from({ length: 101 }, (_, i) => i / 2));
const B = c.budget;
B.budgets_per_person_session.forEach((bud, j) => {
  const r = e.planBudget({ budgetPerPersonSession: bud, grid }).best;
  out.push(`budget,${['half', 'reference', 'twice'][j]} budget: design ${toCodes(r.design)} (package ${B.best_design[j].join('')}) fee,${r.fee},${B.best_fee[j]},${Math.abs(r.fee - B.best_fee[j])}`);
  out.push(`budget,${['half', 'reference', 'twice'][j]} budget: welfare,${r.W},${B.welfare[j]},${Math.abs(r.W - B.welfare[j])}`);
});
console.log(out.join('\n'));
