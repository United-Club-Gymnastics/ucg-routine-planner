// Bars and beam catalog changes from UCG's WAG rules lead (Oct 2026): new skill versions,
// other names, the no-value cast at Sapphire / Infinity, and Diamond beam's 155° split.
// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findSkill, loadDiscipline, searchSkills, wagSkillAllowed } from '../js/skill-search.js';
import { newEntry, scoreEntry } from '../js/model.js';
import { SAME_ELEMENT } from '../js/data/wag-same.js';
import { XCEL_SR } from '../js/data/xcel.js';

await loadDiscipline('wag');

const row = (id, link = false) => {
  const s = findSkill(id);
  return { name: s.label || s.name, skillId: id, letter: s.value || '', eg: String(s.group), link };
};
const score = (level, ev, ids) => {
  const e = newEntry('x', 'wag', level);
  e.routines[ev] = ids.map((id) => (Array.isArray(id) ? row(...id) : row(id)));
  return scoreEntry(e).events[ev];
};
const found = (app, query, family, level) =>
  searchSkills('wag', app, query).filter((s) => wagSkillAllowed(family, level, s)).map((s) => s.id);

const NO_VALUE_CAST = 'USAG-UB-2.001-7';

test('Higgins: its own bars version, the same element as the cast handstand ½ turn', () => {
  assert.equal(findSkill('USAG-UB-2.301-4').value, 'C');
  assert.ok(found('ub', 'higgins', 'xcel', 'diamond').includes('USAG-UB-2.301-4'));
  assert.equal(SAME_ELEMENT['USAG-UB-2.301-4'], SAME_ELEMENT['USAG-UB-2.301-2']);
  assert.ok(!(findSkill('USAG-UB-2.301-2').aka || []).some((a) => /higgins/i.test(a)));
});

test('Other names: straddle back from handstand, toe up, cast handstand, toe circles', () => {
  // Listed with the other straddle backs; the new name tells it apart from the 2.305 counterswing.
  assert.ok(found('ub', 'straddle back from handstand', 'xcel', 'sapphire').slice(0, 3).includes('USAG-UB-5.403-1'));
  assert.ok(found('ub', 'toe up', 'xcel', 'diamond').includes('USAG-UB-7.301-1'));
  assert.ok(found('ub', 'cast handstand', 'xcel', 'plat').includes('USAG-UB-2.201-1'));
  assert.equal(found('ub', 'toe circle to clear support', 'xcel', 'plat')[0], 'USAG-UB-7.209-1');
  assert.equal(found('ub', 'toe circle to handstand', 'xcel', 'diamond')[0], 'USAG-UB-7.309-1');
});

test('Long hang kip is 1.101 and takes the HB kip names; 1.106 stays the kip mount', () => {
  const kip = findSkill('USAG-UB-1.101-3');
  assert.equal(kip.name, 'Long hang kip');
  assert.equal(found('ub', 'hb kip', 'xcel', 'gold')[0], 'USAG-UB-1.101-3');
  assert.equal(found('ub', 'high bar kip', 'xcel', 'gold')[0], 'USAG-UB-1.101-3');
  assert.ok(!(findSkill('USAG-UB-1.106-1a').aka || []).some((a) => /kip$/i.test(a)));
});

test('Cast squat on, jump to HB: its own version of 2.102, the same element', () => {
  assert.ok(found('ub', 'squat on jump to hb', 'xcel', 'silver').includes('USAG-UB-2.102-2'));
  assert.equal(SAME_ELEMENT['USAG-UB-2.102-2'], SAME_ELEMENT['USAG-UB-2.102-1']);
});

test('No-value cast: offered at Sapphire and Infinity only', () => {
  assert.ok(found('ub', 'high cast', 'xcel', 'sapphire').includes(NO_VALUE_CAST));
  assert.ok(found('ub', 'high cast', 'infinity', 'inf').includes(NO_VALUE_CAST));
  assert.ok(!found('ub', 'high cast', 'xcel', 'diamond').includes(NO_VALUE_CAST));
});

test('No-value cast at Sapphire: listed, adds no value part', () => {
  const r = score('sapphire', 'ub', [NO_VALUE_CAST]);
  assert.equal(r.items[0].reason, 'noValue');
  assert.deepEqual(r.missingVp, ['C', 'B', 'B', 'B', 'A', 'A', 'A']);
});

test('No-value cast at Infinity: no difficulty, and not one of the 6 skills', () => {
  const kips = ['USAG-UB-1.101-1', 'USAG-UB-7.101-1', 'USAG-UB-2.201-1', 'USAG-UB-7.209-1', 'USAG-UB-8.101-1'];
  const without = score('inf', 'ub', kips);
  const withCast = score('inf', 'ub', [...kips, NO_VALUE_CAST]);
  assert.equal(withCast.items[5].reason, 'noValue');
  assert.equal(withCast.difficulty, without.difficulty);
  assert.equal(withCast.shortBy, 1);
  assert.equal(withCast.sv, without.sv);
});

test('Beam Gold / Platinum: 120°-135° straddle jump and sissonne, A, same as the regular ones', () => {
  for (const [lvl, div] of [['gold', 'Gold'], ['plat', 'Platinum']]) {
    for (const [v, regular] of [[2, 'USAG-BB-2.202-1'], [3, 'USAG-BB-2.207-1']]) {
      const id = `USAG-BB-2.0 ${div}-${v}`;
      assert.equal(findSkill(id).value, 'A');
      assert.ok(found('bb', v === 2 ? 'straddle jump' : 'sissonne', 'xcel', lvl).includes(id), id);
      assert.equal(SAME_ELEMENT[id], SAME_ELEMENT[regular]);
    }
  }
  assert.ok(!found('bb', 'sissonne', 'xcel', 'diamond').some((id) => id.startsWith('USAG-BB-2.0 ')));
});

test('Diamond beam: the leap or jump needs a 155° split', () => {
  assert.match(XCEL_SR.diamond.bb[1], /155° split/);
  const r = score('diamond', 'bb', [['USAG-BB-2.201-2', true], 'USAG-BB-2.201-1']);
  assert.ok(JSON.stringify(r).includes('155°'));
});
