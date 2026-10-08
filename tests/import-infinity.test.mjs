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
