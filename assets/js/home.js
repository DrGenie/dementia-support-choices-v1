import { boot, iconArray, per100, money } from './common.js';

boot((engine) => {
  const best = engine.scenarios.find((s) => s.id === 'S1');
  const low = engine.scenarios.find((s) => s.id === 'S4');
  const u = engine.uptakeMxl(best.design, 0).point;
  const v = engine.uptakeMxl(low.design, 0).point;
  document.getElementById('hero-number').textContent = `${per100(u)} in 100`;
  document.getElementById('hero-text').textContent =
    `people in the study population would take up a free, local, weekly social group that includes the carer. ` +
    `For a virtual reality programme at home without carer support, the figure is ${per100(v)} in 100.`;
  iconArray(document.getElementById('hero-array'), u, `${per100(u)} of 100 people would take up the social group`);

  // Add the study's money values to the findings
  const w = engine.wtp('mxlr');
  const get = (param) => w.find((x) => engine.level(x.attribute, x.level).param === param);
  const carer = get('caregiver: Yes'), wider = get('distance: Wider community (50+ km)');
  const weekly = get('frequency: Weekly'), couns = get('type: Psychological counselling');
  const f = document.querySelectorAll('#findings .finding p');
  f[0].textContent += ` People valued it at about ${money(carer.point)} per session.`;
  f[1].textContent += ` Compared with a programme at home, it reduced the value by about ${money(-wider.point)} per session, more than carer inclusion added.`;
  f[2].textContent += ` Weekly contact was worth about ${money(weekly.point)} per session more than monthly contact.`;
  f[3].textContent += ` Counselling was worth about ${money(couns.point)} per session more than peer support.`;
  // Two different quantities, both for the free reference programme (peer support group
  // including the carer, hybrid, weekly, 2 hours, local): the share predicted not to choose it,
  // which includes the chance element of single choices, and the smaller share whose usual
  // preference is for no programme. Neither describes people who would never use support.
  const ref = { type: 'peer', carer: 'yes', mode: 'hybrid', frequency: 'weekly', duration: '2h', distance: 'local', price: 0 };
  const reach = engine.reach(ref);
  const notChoose = 1 - engine.uptakeMxl(ref, 0).point;
  f[6].textContent = `In the survey, about ${per100(notChoose)} in 100 respondents were predicted not to choose a weekly local peer support group that includes the carer even when it was free, and for about ${per100(reach.neverShare)} in 100 no programme was preferred on average. This describes choices in the survey, not a fixed unwillingness to use support. Measured characteristics explained little of the difference between people, although people with caring responsibilities were somewhat more likely to accept support. Referral, information and trust may matter as much as programme features.`;
});
