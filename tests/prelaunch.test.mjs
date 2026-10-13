// Run with: npm test
// Fixes from the pre-launch review.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadDiscipline, searchSkills } from '../js/skill-search.js';

await Promise.all(['wag', 'mag', 'tt'].map(loadDiscipline));
import { scoreWagMasters } from '../js/scoring/wag.js';
import { scoreRoutine } from '../js/scoring/mag.js';
import { scoreTramp, scorePasses, quarterSomersaults } from '../js/scoring/tt.js';
import { newEntry, applyExample, copyEvent, scoreEvent } from '../js/model.js';
import { EXAMPLES } from '../js/data/examples.js';

const t = (name, dd, notation = '') => ({ name, dd, notation });

test('MAG Masters: no connection bonuses (floor D + B, high bar C + C)', () => {
  const fx = [{ name: 'D skill', letter: 'D', eg: 2, link: true }, { name: 'B skill', letter: 'B', eg: 3 }];
  assert.equal(scoreRoutine('fx', 'masters', fx, {}, { decade: '30' }).bonus, 0);
  const hb = [{ name: 'C one', letter: 'C', eg: 2, link: true }, { name: 'C two', letter: 'C', eg: 3 }];
  assert.equal(scoreRoutine('hb', 'masters', hb, {}, { decade: '30' }).bonus, 0);
  // Developmental still earns them.
  assert.ok(scoreRoutine('fx', 'dev', fx).bonus > 0);
});

test('Masters top 6: on a tie the skill that counts toward length wins (30s: Misc and ME are both 0.0)', () => {
  const skills = ['A', 'A', 'A', 'A', 'A', 'Misc', 'ME'].map((letter, i) => ({ name: `S${i}`, letter, eg: '' }));
  assert.equal(scoreWagMasters('fx', skills, { decade: '30' }).shortBy, 0);
  assert.equal(scoreRoutine('fx', 'masters', skills, {}, { decade: '30' }).shortBy ?? 0, 0);
});

test('WAG Masters: an element group outside I-IV earns no group bonus', () => {
  const skills = [6, 7, 8].map((eg, i) => ({ name: `S${i}`, letter: 'A', eg }));
  assert.equal(scoreWagMasters('fx', skills, { decade: '30' }).egTotal, 0);
});

test('WAG Masters search: "back handspring" finds the WG flic-flac', () => {
  assert.ok(searchSkills('wag', 'fx', 'back handspring').some((s) => s.src === 'WG' && /flic/i.test(s.name)));
});

test('Xcel Gold vault: alternative springboard shows the chart value and -0.5, not Start value twice', () => {
  const e = newEntry('a', 'wag', 'gold');
  e.vault = '1.101';
  assert.deepEqual(scoreEvent(e, 'vt').totals.map(([l]) => l), ['Start value']);
  e.options = { vt: { altBoard: true } };
  const alt = scoreEvent(e, 'vt');
  assert.deepEqual(alt.totals.map(([l]) => l), ['Vault chart', 'Alternative springboard', 'Start value']);
  assert.equal(alt.sv, 9.5);
});

test('Replacing a routine (example or copy) drops the old special requirement ticks', () => {
  const e = newEntry('a', 'wag', 'gold');
  const ex = EXAMPLES.filter((x) => x.disc === 'wag' && x.level === 'gold' && x.event === 'ub');
  assert.ok(ex.length > 1);
  applyExample(e, ex[0]);
  e.options = { ub: { srSet: [false] } };
  applyExample(e, ex[1] || ex[0]);
  assert.equal(e.options.ub.srSet, undefined);
  const src = newEntry('b', 'wag', 'gold');
  applyExample(src, ex[0]);
  e.options.ub.srSet = [false];
  copyEvent(src, e, 'ub');
  assert.equal(e.options.ub.srSet, undefined);
  // Example skills retyped later aren't filtered by their value.
  assert.ok(e.routines.ub.filter((s) => s.skillId).length);
  applyExample(e, ex[0]);
  assert.ok(e.routines.ub.filter((s) => s.skillId).every((s) => s.fromList));
});

test('T&T New Flyers trampoline: doubles and ball-outs are not on the allowed list; allowed saltos are not flagged', () => {
  const jumps = Array.from({ length: 8 }, (_, i) => t(`Jump ${i}`, 0, ''));
  const ok = scoreTramp('nf', [...jumps, t('Back somersault tuck', 0.5, '40o'), t('Barani tuck', 0.6, '41o')].map((s, i) => ({ ...s, name: s.name.startsWith('Jump') ? ['Tuck jump', 'Pike jump', 'Straddle jump', 'Seat drop', 'Front drop', 'Back drop', 'Half twist', 'Full twist'][i] : s.name })));
  assert.ok(!ok.items.some((s) => s.flag === 'over'));
  assert.ok(!ok.warnings.some((w) => /allowed list/.test(w)));
  const bad = scoreTramp('nf', [...jumps, t('Barani-out tuck', 1.1, '801o'), t('Barani ball out tuck', 0.7, '51o')]);
  assert.ok(bad.warnings.some((w) => /allowed list/.test(w)));
  assert.equal(bad.items.filter((s) => s.flag === 'over').length, 2);
});

test('T&T New Flyers double mini: a repeated salto still counts toward one salto per pass', () => {
  const p = [t('Back somersault tuck', 0.5, '40o'), t('Barani tuck', 0.7, '41o')];
  const r = scorePasses('dmt', 'nf', [p, p], ['mounter', 'spotter']);
  assert.equal(r.warnings.filter((w) => /one salto per pass/.test(w)).length, 2);
});

test('T&T tumbling: the 4th full in a pass gets no difficulty', () => {
  const pass = [t('Roundoff', 0.2, ''), t('Back handspring', 0.1, ''), ...Array.from({ length: 6 }, () => t('Back full', 0.9, '42'))];
  const r = scorePasses('tu', 'hf', [pass, []]);
  assert.ok(r.warnings.some((w) => /fulls earn difficulty at most 3/.test(w)));
  assert.equal(r.sums[0], 3.0);
});

test('FIG "-" is a zero twist: pullover to back (4-o) is a salto', () => {
  assert.equal(quarterSomersaults('4-o'), 4);
  assert.equal(quarterSomersaults('40o'), 4);
});
