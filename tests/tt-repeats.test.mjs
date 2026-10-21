// Run with: npm test
// T&T tumbling repeats (UCG T&T Code of Points, TU §III.A).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scorePasses } from '../js/scoring/tt.js';
import { EXAMPLES } from '../js/data/examples.js';

const t = (name, dd, notation = '') => ({ name, dd, notation });
const RO = t('Roundoff', 0.2);
const BHS = t('Back handspring', 0.2);
const WHIP = t('Whipback (whip)', 0.3, '^');
const TUCK = t('Back somersault tuck', 0.5);
const statuses = (r, p) => r.passes[p].map((s) => s.repeatWhy || s.status);

test('III.A.3, the Code\'s example: back handspring–back tuck and whip–back tuck both earn difficulty', () => {
  const r = scorePasses('tu', 'hf', [[RO, BHS, TUCK, WHIP, TUCK], []]);
  assert.deepEqual(statuses(r, 0), ['counting', 'counting', 'counting', 'counting', 'counting']);
  assert.equal(r.sums[0], 1.7);
  // Once in each pass, from different entries, also counts.
  const across = scorePasses('tu', 'hf', [[RO, BHS, TUCK], [RO, WHIP, TUCK]]);
  assert.equal(across.passes[1][2].status, 'counting');
});

test('III.A.3: a repeat from the same entry gets no difficulty', () => {
  const r = scorePasses('tu', 'hf', [[RO, BHS, TUCK], [RO, BHS, BHS, TUCK]]);
  assert.equal(r.passes[1][3].repeatWhy, 'entry');
  assert.equal(r.passes[1][3].repeatOf, 2);
  assert.equal(r.passes[1][3].repeatPass, 0);
  assert.equal(r.sums[1], 0.6);
  assert.ok(r.warnings.some((w) => /Pass 2: Back somersault tuck is repeated from the same entry/.test(w)));
});

test('III.A.3: a third use (twice in one pass and again in the other) is an interruption, with no difficulty', () => {
  const r = scorePasses('tu', 'hf', [[RO, BHS, TUCK, WHIP, TUCK], [RO, t('Back walkover', 0.1), TUCK]]);
  assert.equal(r.passes[1][2].repeatWhy, 'interrupt');
  assert.equal(r.sums[1], 0.3);
  assert.ok(r.warnings.some((w) => /Back somersault tuck is used a 3rd time/.test(w)));
});

test('III.A.1: handsprings, flysprings and whips repeat any number of times', () => {
  const r = scorePasses('tu', 'hf', [[RO, BHS, BHS, WHIP, WHIP, BHS, WHIP, BHS], [t('Front handspring', 0.2), ...Array(6).fill(t('Flyspring', 0.2)), t('Forward Whip', 0.3)]]);
  assert.ok(r.passes.flat().every((s) => s.status === 'counting'));
  assert.equal(r.total, 3.6);
});

test('A pass\'s first skill: its entry (run or power hurdle) is only known from the name', () => {
  // Roundoff opening both passes: the entries aren't recorded, so both count.
  const r = scorePasses('tu', 'hf', [[RO, BHS, TUCK], [RO, WHIP, TUCK]]);
  assert.equal(r.passes[1][0].status, 'counting');
  const same = scorePasses('tu', 'hf', [[t('Roundoff (run)', 0.2), BHS], [t('Roundoff (run)', 0.2), WHIP]]);
  assert.equal(same.passes[1][0].repeatWhy, 'entry');
  const diff = scorePasses('tu', 'hf', [[t('Roundoff (run)', 0.2), BHS], [t('Roundoff (power hurdle)', 0.2), WHIP]]);
  assert.equal(diff.passes[1][0].status, 'counting');
});

test('III.A.2 unchanged: the 4th full in a pass gets no difficulty, and fulls aren\'t limited by III.A.3', () => {
  const full = t('Back full', 0.9, '42');
  const r = scorePasses('tu', 'hf', [[RO, BHS, full, full, full, full], [RO, BHS, full]]);
  assert.deepEqual(statuses(r, 0).slice(2), ['counting', 'counting', 'counting', 'fulls']);
  assert.equal(r.passes[1][2].status, 'counting');
});

test('III.A.4: a second straight jump or rebound in a pass is a warning only (the Code gives no consequence)', () => {
  const reb = t('Straight Jump/Rebound', 0.1);
  const r = scorePasses('tu', 'if', [[RO, BHS, reb, RO, BHS, reb], []]);
  assert.ok(r.warnings.some((w) => /Pass 1: a straight jump or rebound without a turn may be used only once per pass/.test(w)));
  assert.equal(r.passes[0][5].status, 'counting');
  // One in each pass, and jumps with a turn, are fine.
  const ok = scorePasses('tu', 'if', [[RO, BHS, reb, t('Jump 1/2 Turn', 0.1), t('Jump Full Turn', 0.1)], [RO, BHS, reb]]);
  assert.ok(!ok.warnings.some((w) => /straight jump or rebound/.test(w)));
});

test('III.A.6: a repeated pass must start from a different entry (a warning; the Code gives no consequence)', () => {
  const pass = [RO, BHS, BHS, TUCK];
  const r = scorePasses('tu', 'hf', [pass, pass]);
  assert.ok(r.warnings.some((w) => /Pass 2 repeats pass 1/.test(w)));
  assert.equal(r.passes[1][3].status, 'counting'); // III.A.3 isn't applied between repeated passes
  const twice = [RO, BHS, TUCK, WHIP, TUCK];
  assert.ok(scorePasses('tu', 'hf', [twice, twice]).passes.flat().every((s) => s.status === 'counting'));
  // The Code's example: a running roundoff and a power hurdle roundoff (example sheet NF 10).
  const ex = EXAMPLES.find((e) => e.id === 'tt-nf-tu-10');
  const nf = scorePasses('tu', 'nf', ex.passes);
  assert.ok(!nf.warnings.some((w) => /repeats pass 1/.test(w)));
  assert.ok(nf.passes.flat().every((s) => s.status === 'counting'));
});
