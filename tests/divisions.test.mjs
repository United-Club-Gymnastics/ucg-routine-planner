// Listed skills outside a level's divisions earn no credit (search hides them, but a copied
// or imported routine can still have them), and Platinum allows one tap swing on bars.
// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findSkill, loadDiscipline } from '../js/skill-search.js';
import { newEntry, scoreEntry } from '../js/model.js';

await loadDiscipline('wag');

const row = (id) => {
  const s = findSkill(id);
  return { name: s.label || s.name, skillId: id, letter: s.value, eg: String(s.group), link: false };
};
const ub = (level, ids) => {
  const e = newEntry('x', 'wag', level);
  e.routines.ub = ids.map(row);
  return scoreEntry(e).events.ub;
};
const CAST = 'USAG-UB-2.001-1'; // Bronze to Diamond only
const TAP = 'USAG-UB-2.003-1'; // Silver to Platinum, Platinum only one
const PULLOVER = 'USAG-UB-7.005-1'; // Silver and Gold only

test('Sapphire: a Bronze-Diamond cast earns no value part', () => {
  const r = ub('sapphire', [CAST]);
  assert.equal(r.items[0].reason, 'offLevel');
  assert.deepEqual(r.missingVp, ['C', 'B', 'B', 'B', 'A', 'A', 'A']);
});
test('Diamond: the same cast fills an "A" value part', () => {
  assert.equal(ub('diamond', [CAST]).items[0].status, 'counting');
});
test('Infinity: a Bronze-Diamond cast earns no difficulty or group bonus', () => {
  const r = ub('inf', [CAST]);
  assert.equal(r.items[0].reason, 'offLevel');
  assert.equal(r.difficulty, 0);
  assert.equal(r.egTotal, 0);
});
test('Platinum: only the first tap swing earns credit', () => {
  const r = ub('plat', [TAP, CAST, TAP]);
  assert.equal(r.items[0].status, 'counting');
  assert.equal(r.items[2].reason, 'onlyOne');
});
// It's a circle after a cast (the Code's Gold bars examples).
test('Long hang pullover: the circling requirement at Gold, no credit at Platinum', () => {
  assert.deepEqual(ub('gold', [CAST, PULLOVER]).detectedSr[1]?.by, [1]);
  const plat = ub('plat', [CAST, PULLOVER]);
  assert.equal(plat.items[1].reason, 'offLevel');
  assert.ok(!plat.detectedSr.some((d) => d?.by.includes(1)));
});
