import { boot, el, per100, money, describe, debounce, priceLabel, stat, meaning, designQuery } from './common.js';
import { lineChart } from './charts.js';

const FEES = Array.from({ length: 101 }, (_, i) => i / 2);
const WEEKS = 52;
const COL = { line: '#2a6bc4' };

boot((engine) => {
  const out = document.getElementById('b-stats');
  if (!engine.m.models.mxlrpw || !engine.m.chsp) {
    out.replaceChildren(el('p', {}, 'The budget planner needs the model file data/model_v17.json, which could not be loaded.'));
    return;
  }
  const $ = (id) => document.getElementById(id);
  const ref = engine.scenarios.find((s) => s.id === 'S2');
  const refDesign = { ...ref.design, price: 5 };
  const allDesigns = engine.budgetDesigns(['peer', 'community', 'counselling']);
  const grid = engine.budgetGrid(allDesigns, FEES);           // computed once; costs do not change it
  const refP = engine.uptakeMxl(refDesign, 0).point;
  const refW = engine.valueDraws('mxlr', refDesign, 1).point.CS;

  const inputs = () => {
    const offered = Math.max(1, +$('b-offered').value || 1000);
    const scen = $('b-scen').value;
    const cap = +$('b-cap').value / 100;
    const types = [...document.querySelectorAll('input[name="b-type"]:checked')].map((x) => x.value);
    const refCost = engine.programmeCost(refDesign, scen);
    const refSub = Math.min(refP, cap) * (refCost - 5);            // public cost of the reference programme per person offered per session
    const share = +$('b-budget').value / 100;
    return { offered, scen, cap, types, refCost, refSub, share, perSession: share * refSub };
  };
  const yearly = (x, n) => x * n * WEEKS;

  function solve(inp, perSession) {
    const g = grid.filter((r) => inp.types.includes(r.design.type));
    return engine.planBudget({ budgetPerPersonSession: perSession, cap: inp.cap, scen: inp.scen, fees: FEES, grid: g });
  }

  function row(label, r, inp, budgetOk) {
    if (!r) return el('tr', {}, el('th', { scope: 'row' }, label), el('td', { colspan: 5 }, 'No programme fits within this budget.'));
    return el('tr', {},
      el('th', { scope: 'row' }, label),
      el('td', {}, describe(engine, { ...r.design, price: r.fee })),
      el('td', {}, `${per100(r.P)} in 100`),
      el('td', {}, money(yearly(r.W, inp.offered))),
      el('td', {}, money(yearly(r.subsidy, inp.offered))),
      el('td', {}, budgetOk == null ? '' : budgetOk ? 'Yes' : 'No'));
  }

  function update() {
    const inp = inputs();
    $('b-budget-out').textContent = money(yearly(inp.perSession, inp.offered));
    $('b-budget-hint').textContent = `${Math.round(100 * inp.share)}% of the public cost of the peer support group at A$5 per session (${money(yearly(inp.refSub, inp.offered))} a year for ${inp.offered.toLocaleString('en-AU')} people offered).`;
    $('b-cap-out').textContent = `${$('b-cap').value}% of people offered`;
    if (!inp.types.length) { out.replaceChildren(el('p', {}, 'Choose at least one programme type.')); return; }
    const res = solve(inp, inp.perSession);
    const b = res.best;
    const refServed = Math.min(refP, inp.cap);
    const refRow = { design: refDesign, fee: 5, P: refP, served: refServed, W: refW * refServed / refP, subsidy: inp.refSub, cost: inp.refCost };
    out.replaceChildren(
      stat('Highest value within the budget', b ? `${engine.label('type', b.design.type)}, ${priceLabel(b.fee).toLowerCase()}` : 'None fits', b ? describe(engine, { ...b.design, price: b.fee }) : 'Raise the budget or allow more programme types'),
      stat('Participants per year', b ? Math.round(b.served * inp.offered).toLocaleString('en-AU') : '-', b ? `${per100(b.P)} in 100 people offered would take it up` : ''),
      stat('Value to users per year', b ? money(yearly(b.W, inp.offered)) : '-', b ? `public spending ${money(yearly(b.subsidy, inp.offered))}` : ''),
    );
    const t = el('table', { class: 'data' },
      el('caption', {}, 'Three ways to choose a programme, and the reference programme'),
      el('thead', {}, el('tr', {}, ...['', 'Programme', 'Take-up', 'Value to users per year', 'Public spending per year', 'Within budget'].map((h) => el('th', { scope: 'col' }, h)))),
      el('tbody', {},
        row('Most taken up (no budget limit)', res.accMax, inp, res.accMax.subsidy <= inp.perSession + 1e-9),
        row('Most value to users (no budget limit)', res.wMax, inp, res.wMax.subsidy <= inp.perSession + 1e-9),
        row('Most value within the budget', b, inp, b ? true : null),
        row('Peer support group at A$5 (reference)', refRow, inp, inp.refSub <= inp.perSession + 1e-9)));
    $('b-table').replaceChildren(t);
    // frontier: best value for budgets from 0 to 200% of the reference programme's public cost
    const pts = [];
    for (let s = 0; s <= 200; s += 5) {
      const r = solve(inp, (s / 100) * inp.refSub).best;
      if (r) pts.push({ x: s, y: yearly(r.W, inp.offered) / 1e6 });
    }
    lineChart($('b-chart'), {
      title: 'Highest value to users for each budget',
      series: [{ name: 'Most value within the budget', color: COL.line, points: pts }],
      x: [0, 200], y: [0, Math.ceil(10 * Math.max(...pts.map((p) => p.y), 0.1)) / 10],
      xTicks: [0, 50, 100, 150, 200], xFormat: (v) => `${v}%`, yFormat: (v) => `$${v.toFixed(1)}m`,
      xLabel: 'Budget, % of the public cost of the reference programme', yLabel: 'Value to users per year (A$ million)', marker: Math.round(100 * inp.share),
    });
    const msgs = [];
    if (b) {
      const dW = yearly(b.W - refRow.W, inp.offered), dN = Math.round((b.served - refServed) * inp.offered);
      if (inp.refSub <= inp.perSession + 1e-9) {
        msgs.push(`With this budget the planner can do at least as well as the peer support group at A$5: users gain ${money(Math.max(0, dW))} a year in value and ${dN >= 0 ? `${dN.toLocaleString('en-AU')} more` : `${(-dN).toLocaleString('en-AU')} fewer`} people take part.`);
      } else {
        msgs.push('This budget is smaller than the public cost of the peer support group at A$5, so the planner chooses a cheaper design, a higher fee, or both.');
      }
      if (res.accMax.subsidy > inp.perSession + 1e-9) msgs.push(`The programme most people would take up costs ${money(yearly(res.accMax.subsidy, inp.offered))} a year in public spending, more than this budget.`);
      if (b.fee > 0) msgs.push(`A fee of ${money(b.fee, b.fee % 1 ? 2 : 0)} per session lets the budget cover a more valued design; the fee is paid by users and is already taken off their value.`);
    }
    msgs.push('The planner compares programmes using stated preferences and CHSP unit prices plus two cost assumptions. It is a guide to trade-offs, not a cost-effectiveness analysis.');
    meaning($('b-meaning'), b ? 'green' : 'amber', msgs);
    const plan = $('to-plan');
    if (b) plan.href = `plan.html${designQuery({ ...b.design, price: Math.round(b.fee) })}`;
  }
  const u = debounce(update, 150);
  ['b-offered', 'b-budget', 'b-scen', 'b-cap'].forEach((id) => $(id).addEventListener('input', u));
  document.querySelectorAll('input[name="b-type"]').forEach((x) => x.addEventListener('change', u));
  update();
});
