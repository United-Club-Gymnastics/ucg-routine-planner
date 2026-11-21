// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXAMPLES } from '../js/data/examples.js';
import { readFileSync } from 'node:fs';
import { problems } from '../tools/check_examples.mjs';
import { SKILLS } from '../js/data/mag-skills.js';
import { VAULTS } from '../js/data/mag-vaults.js';
import { round1, scoreRoutine } from '../js/scoring/mag.js';

test('Every example routine follows its level rules', () => {
  const bad = EXAMPLES.map((ex) => [ex.id, problems(ex)]).filter(([, p]) => p.length);
  assert.deepEqual(bad, []);
});

// MAG examples come from UCG's "MAG Example Routines" Google Sheet (tools/source/examples_notes.md).
// Each skill is matched to the skill list, so its letter and group must be the list's, and the planner
// must give the sheet's start value. The sheet's bonus column (the pommel mushroom bonus) isn't part
// of the example, so it is added back.
const SOURCE = JSON.parse(readFileSync(new URL('../tools/source/examples.json', import.meta.url), 'utf8')).filter((x) => x.discipline === 'mag');
const SKILL = Object.fromEntries(SKILLS.map((s) => [s.id, s]));

test('MAG example skills carry the skill list values', () => {
  const bad = SOURCE.flatMap((ex) => (ex.skills || [])
    .filter((s) => !SKILL[s.skillId] || SKILL[s.skillId].value !== s.letter || (SKILL[s.skillId].eg || null) !== (s.eg || null))
    .map((s) => `${ex.id}: ${s.name}`));
  assert.deepEqual(bad, []);
});

test('MAG examples score their sheet start values', () => {
  for (const ex of SOURCE) {
    if (ex.event === 'vt') {
      const v = VAULTS.find((x) => x.id === String(ex.vaultNumber));
      assert.equal(round1(10 + v.value), ex.sv, ex.id);
      continue;
    }
    const r = scoreRoutine(ex.event, ex.level, ex.skills.map((s) => ({ ...s, eg: s.eg || '' })));
    assert.equal(round1(r.startValue + ex.sheetTotals.bonusDeduction), ex.sv, ex.id);
  }
});
