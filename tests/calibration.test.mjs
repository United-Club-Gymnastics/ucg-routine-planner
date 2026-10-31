// Judge practice (calibration/infinity/): the answer key, scored by the planner's UCG Infinity
// rules, matches the calibration sheet's start values, and a calculator entry is checked right.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INFINITY_VAULT_LIST } from '../js/scoring/wag.js';
import { LETTERS, answerKey, compare } from '../calibration/infinity/key.js';
import { ROUTINES } from '../calibration/infinity/routines.js';

const byId = (id) => ROUTINES.find((r) => r.id === id);
// The entry a judge would make from the key itself.
const keyEntry = (key) => ({ counts: { ...key.counts }, egs: new Set(key.egs), bonus: key.bonus });

test('every routine has a video, an orientation and a start value', () => {
  assert.equal(ROUTINES.filter((r) => r.event === 'vt').length, 6);
  for (const r of ROUTINES) {
    assert.match(r.video, /^[\w-]{20,}$/, r.id);
    assert.equal(typeof r.portrait, 'boolean', r.id);
    if (r.event !== 'vt') assert.ok(r.skills.length >= 1 && r.skills.length <= 8 && r.eventBonusWhy, r.id);
  }
});

test("the planner's scoring of each key gives the sheet's start value", () => {
  for (const r of ROUTINES) assert.equal(answerKey(r).sv, r.sv, r.id);
});

test('a skill outside the top 8 earns its group and the apparatus bonus, not difficulty (BB_2)', () => {
  const key = answerKey(byId('BB_2'));
  assert.deepEqual(key.counts, { A: 0, B: 2, C: 4, D: 0, E: 2 });
  assert.equal(key.d, 5.9);
  const dive = key.score.items.find((it) => it.name === 'Dive Cartwheel');
  assert.equal(dive.status, 'noncounting');
  // FX_2's extra skill is the one that earns group II.
  const fx2 = answerKey(byId('FX_2'));
  assert.ok(fx2.egs.has('II'));
  assert.equal(fx2.score.items.find((it) => it.bonus && it.condensed === 'II').reason, 'egOnly');
});

test('the key itself is right; each kind of slip is caught and explained', () => {
  for (const r of ROUTINES.filter((x) => x.event !== 'vt')) {
    const key = answerKey(r);
    assert.equal(compare(r, key, keyEntry(key)).right, true, r.id);
  }
  const r = byId('BB_2');
  const key = answerKey(r);
  const slip = keyEntry(key);
  slip.counts.B = 1;
  slip.egs.delete('IV');
  slip.bonus = false;
  const res = compare(r, key, slip);
  assert.equal(res.right, false);
  assert.equal(res.d, 5); // 5.9 less a B, group IV and the apparatus bonus (0.3 each)
  assert.deepEqual(LETTERS.filter((l) => !res.letters[l]), ['B']);
  assert.equal(res.groups.IV, false);
  assert.equal(res.bonus, false);
  assert.equal(res.notes.length, 3);
  assert.match(res.notes[0], /Roundoff, Body Wave/);
  assert.match(res.notes[2], /Dive Cartwheel connected into the Roundoff/);
});

test("a named vault is in the Infinity vault chart, at the D-score in its video's name", () => {
  for (const r of ROUTINES.filter((x) => x.event === 'vt' && x.vault)) {
    const v = answerKey(r).vault;
    assert.ok(v, `${r.id}: "${r.vault}" isn't a vault in the Infinity chart (tools/source/calibration_infinity.json)`);
    assert.equal(v.dv, r.dv, `${r.id}: ${r.vault} is ${v.dv}, the video says ${r.dv}`);
  }
});

test('vault: by value until the vault is named', () => {
  const r = { ...byId('VT_1'), vault: null };
  const key = answerKey(r);
  const pick = (dv) => INFINITY_VAULT_LIST.find((v) => v.dv === dv);
  assert.equal(compare(r, key, { vault: pick(5.1) }).right, true);
  const off = compare(r, key, { vault: pick(3.0) });
  assert.equal(off.right, false);
  assert.match(off.notes[0], /worth 5\.1/);
  const named = { ...r, vault: 'Tsuk Pike' };
  const namedKey = answerKey(named);
  assert.equal(namedKey.vault.dv, 5.1);
  assert.equal(compare(named, namedKey, { vault: namedKey.vault }).vault, true);
  assert.equal(compare(named, namedKey, { vault: INFINITY_VAULT_LIST.find((v) => v.dv === 5.1 && v.name !== 'Tsuk Pike') }).vault, false);
});

test('opened in the planner (?calibration=…), each routine keeps its start value, matched skills or not', async () => {
  const { calibrationAthlete, condensedOf } = await import('../js/calibration-view.js');
  const { closestSkill, loadDiscipline, wagSkillAllowed } = await import('../js/skill-search.js');
  const { scoreEvent } = await import('../js/model.js');
  await loadDiscipline('wag');
  // The planner's own matching (app.js openCalibration).
  const match = (ev, s) =>
    closestSkill('wag', ev, s.name, (x) => wagSkillAllowed('infinity', 'inf', x) && x.value === s.letter && condensedOf(ev, x.group) === s.group);
  let n = 0;
  let matched = 0;
  for (const r of ROUTINES.filter((x) => x.event !== 'vt')) {
    for (const m of [undefined, match]) {
      const { athlete } = calibrationAthlete(r.id, () => `id${n++}`, m);
      const e = athlete.entries[0];
      assert.equal(scoreEvent(e, r.event).sv, r.sv, `${r.id}${m ? ' (matched)' : ''}`);
      if (m) matched += e.routines[r.event].filter((row) => row.skillId).length;
    }
  }
  assert.ok(matched > 50, `only ${matched} skills matched to the skill list`);
  assert.equal(calibrationAthlete('VT_1', () => 'x'), null);
  assert.equal(calibrationAthlete('nope', () => 'x'), null);
});
