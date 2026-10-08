// Bringing athletes over from the original UCG Infinity planner (js/import-infinity.js).
// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { convertOldAthlete, importKey } from '../js/import-infinity.js';
import { scoreEntry } from '../js/model.js';

const ids = () => {
  let i = 0;
  return () => `id${i++}`;
};
const s = (name, letter, eg) => ({ name, letter, eg });

// The old planner's record: events bars/beam/floor, blank rows, apparatus bonus per event.
const old = {
  id: 'old-1', name: ' Julia ', club: 'UCG', vault: 'Yamashita - 1/2 Off', createdAt: 123,
  routines: {
    bars: [s('Peach salto', 'B', '6'), s('Cast Pike Vault 1/2 (Sharpe)', 'C', '2'), s('Cast Handstand', 'B', '2'), s('Toe Catch', 'C', '1'), s('Hop change', 'C', '2'), s('Front giant', 'C', '5'), s('Kip', 'A', '1'), s('Butt Bounce', 'B', '8'), s('', '', '')],
    beam: [s('', '', '')],
    floor: [s('Back tuck', 'B', '8')],
  },
  egSkills: { floor: [s('Switch leap', 'B', '1')] },
  eventBonus: { bars: true, beam: false, floor: false },
};

test('an old Infinity athlete becomes an athlete with a UCG Infinity level, same start values', () => {
  const a = convertOldAthlete(old, ids());
  assert.equal(a.name, 'Julia');
  assert.equal(a.importedFrom, importKey(old));
  assert.equal(a.entries.length, 1);
  const e = a.entries[0];
  assert.equal(e.level, 'inf');
  assert.equal(e.vault, 'Yamashita - 1/2 Off');
  assert.deepEqual(e.routines.ub.slice(0, 2), [s('Peach salto', 'B', '6'), s('Cast Pike Vault 1/2 (Sharpe)', 'C', '2')]);
  assert.equal(e.options.ub.eventBonus, true);
  // The old "EG bonus skills" come after the routine.
  assert.deepEqual(e.routines.fx.filter((x) => x.name).map((x) => x.name), ['Back tuck', 'Switch leap']);
  const sv = scoreEntry(e).events;
  assert.equal(sv.ub.sv, 14.5); // the spreadsheet's bars example, with the apparatus bonus
  assert.equal(sv.vt.sv, 13.6);
});

test('a vault the table no longer has is left empty', () => {
  assert.equal(convertOldAthlete({ ...old, vault: 'Not a vault' }, ids()).entries[0].vault, '');
});

test('typed skills become the listed skill they clearly are; unclear ones stay as typed', async () => {
  const { loadDiscipline, closestSkill, wagSkillAllowed } = await import('../js/skill-search.js');
  await loadDiscipline('wag');
  const match = (ev, row) => closestSkill('wag', ev, row.name, (sk) => wagSkillAllowed('infinity', 'inf', sk) && sk.value === row.letter && (!row.eg || String(sk.group) === row.eg));
  const a = convertOldAthlete({
    id: 'm', routines: {
      bars: [s('Cast handstand', 'B', '2'), s('Kip', 'A', '1'), s('Front giant', 'C', '5')],
      floor: [s('Round off', 'A', '5'), s('Back tuck', 'B', '8'), s('Wolf 1.5', 'D', '1'), s('Popa', 'C', '1')], // a "B" back tuck isn't the listed (A) one
    },
  }, ids(), match);
  const ub = a.entries[0].routines.ub;
  assert.equal(ub[0].name, 'Cast to handstand');
  assert.equal(ub[0].matchedFrom, 'Cast handstand');
  assert.equal(ub[0].letter, 'B');
  assert.ok(ub[0].skillId);
  assert.equal(ub[1].skillId, undefined); // "Kip" could be several kips
  assert.equal(ub[2].name, 'Front giant on HB (reverse grip)'); // "reverse grip" only describes it
  const fx = a.entries[0].routines.fx;
  assert.equal(fx[0].name, 'Round-off');
  assert.equal(fx[1].name, 'Back tuck');
  assert.equal(fx[1].skillId, undefined); // nor "Back tuck with ½ twist": a twist wasn't typed
  assert.equal(fx[2].name, 'Wolf jump with 1½ turns'); // 1.5 = 1½
  assert.equal(fx[3].name, 'Straddle jump, full turn (Popa)'); // by its eponym
});
