// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newEntry, copyRoutines, scoreEntry } from '../js/model.js';
import { revalueEntry } from '../js/revalue.js';
import { CATALOG as WAG } from '../js/data/catalog-wag.js';
import { CATALOG as MAG } from '../js/data/catalog-mag.js';

const pick = (skillId, name, letter, eg = '') => ({ skillId, name, letter, eg });

function copyTo(disc, fromLevel, toLevel, ev, rows, catalog) {
  const from = newEntry('a', disc, fromLevel);
  from.routines[ev] = rows;
  const to = newEntry('b', disc, toLevel);
  if (to.decade) to.decade = '40';
  copyRoutines(from, to);
  const summary = revalueEntry(to, fromLevel, catalog);
  return { to, rows: to.routines[ev].filter((r) => r.name || r.letter), summary };
}

test('Xcel -> WAG Masters: WG letter and Masters group, exact / approximate / not credited', () => {
  const { to, rows, summary } = copyTo('wag', 'gold', 'masters', 'bb', [
    pick('USAG-BB-1.101-2', 'Leap mount lowering into scale', 'A'), // WG 1.101 (A, group 1 -> Masters IV)
    pick('USAG-BB-1.104-1', 'Jump to straddle stand or to split sit', 'A'), // broad Xcel record
    pick('USAG-BB-1.101-1b', 'Jump mount to stand, two-foot take-off', 'A'), // no WG skill
    { name: 'My own skill', letter: 'B', eg: '' }, // typed in by hand
  ], WAG);
  assert.equal(rows[0].skillId, 'WGW-BB-1.101-1');
  assert.equal(rows[0].letter, 'A');
  assert.equal(rows[0].eg, '4');
  assert.ok(!rows[0].approx);
  assert.ok(rows[1].approx);
  assert.ok(rows[2].noCredit && !rows[2].letter && !rows[2].skillId);
  assert.ok(rows[3].check && rows[3].letter === 'B');
  assert.deepEqual(summary, { exact: 1, approximate: 1, notCredited: 1, typed: 1 });
  assert.equal(to.revalued.catalog, WAG.version);
  // The not-credited skill adds nothing: 3 skills count toward routine length, not 4.
  assert.equal(scoreEntry(to).events.bb.shortBy, 3);
});

test('Side-position beam jump: WG adjusted value, and exact', () => {
  const { rows } = copyTo('wag', 'gold', 'masters', 'bb', [pick('USAG-BB-2.301-3', 'Split jump from side stand', 'C')], WAG);
  assert.equal(rows[0].skillId, 'WGW-BB-2.202-1');
  assert.equal(rows[0].letter, 'C'); // B=0.2 printed, C=0.3 in side position
  assert.ok(!rows[0].approx);
});

test('Masters -> Infinity keeps the USAG element group (scoring condenses it)', () => {
  const { rows } = copyTo('wag', 'masters', 'inf', 'bb', [pick('WGW-BB-1.101-1', 'Leap mount to arabesque', 'A', '4')], WAG);
  assert.ok(rows[0].skillId?.startsWith('USAG-BB-1.101'));
  assert.equal(rows[0].eg, '1');
});

test('MAG: a UCG addition copied to Masters becomes its Masters entry', () => {
  const { rows } = copyTo('mag', 'adv', 'masters', 'fx', [pick('UCG-FX-pancake-stop-required', 'Pancake (stop required)', 'A', '1')], MAG);
  assert.equal(rows[0].skillId, 'UCGM-mag-FX-pancake-stop-required');
  assert.equal(rows[0].letter, 'ME');
  assert.equal(rows[0].eg, '1');
});
