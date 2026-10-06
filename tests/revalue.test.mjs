// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadDiscipline } from '../js/skill-search.js';

// Skill lists load per discipline (as the app does before showing an athlete).
await Promise.all(['wag', 'mag', 'tt'].map(loadDiscipline));
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
  assert.deepEqual(summary, { exact: 1, approximate: 1, notCredited: 1, typed: 1, vault: '' });
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

test('Same code at both levels: skills keep their own record, unflagged; division-limited skills are not credited', () => {
  const { rows } = copyTo('wag', 'gold', 'plat', 'bb', [pick('USAG-BB-1.104-1', 'Jump to split sit or straddle stand', 'A')], WAG);
  assert.equal(rows[0].skillId, 'USAG-BB-1.104-1');
  assert.equal(rows[0].letter, 'A');
  assert.ok(!rows[0].approx && !rows[0].noCredit);
  const ltd = copyTo('wag', 'gold', 'plat', 'fx', [pick('USAG-FX-1.001-1', 'Leg swing hop', 'A')], WAG);
  assert.ok(ltd.rows[0].noCredit); // "Bronze/Silver/Gold only"
  const mag = copyTo('mag', 'dev', 'adv', 'fx', [pick('UCG-FX-pancake-stop-required', 'Pancake (stop required)', 'A', '1')], MAG);
  assert.equal(mag.rows[0].skillId, 'UCG-FX-pancake-stop-required');
});

const vaultTo = (disc, fromLevel, toLevel, vault, catalog) => {
  const to = newEntry('b', disc, toLevel);
  const result = revalueEntry(to, fromLevel, catalog, vault).vault;
  return [to.vault, result];
};
test("Vaults follow the same vault into the target level's own list", () => {
  assert.deepEqual(vaultTo('wag', 'gold', 'masters', '1.101', WAG), ['1.00', 'exact']); // handspring -> WG 1.00
  assert.deepEqual(vaultTo('wag', 'masters', 'gold', '1.00', WAG), ['1.101', 'exact']);
  assert.equal(vaultTo('wag', 'gold', 'inf', '1.101', WAG)[0], 'Front Handspring'); // Infinity table, by name
  // Not in the target's list: Masters counts it as any other vault; Xcel gets no vault.
  assert.deepEqual(vaultTo('wag', 'gold', 'masters', '1.108', WAG), ['other', 'other']); // ¼ on ¼ off: not a WG vault
  assert.deepEqual(vaultTo('wag', 'masters', 'gold', 'UCGM-wag-pike-hecht-over-table', WAG), ['', 'none']);
  assert.deepEqual(vaultTo('mag', 'adv', 'masters', '101', MAG), ['101', 'exact']);
  assert.deepEqual(vaultTo('mag', 'masters', 'adv', 'UCGM-mag-pike-hecht-over-table', MAG), ['', 'none']);
});

test('Masters MAG "GE" (gymnastics element) is a Miscellaneous skill, valued by age decade', async () => {
  const { searchSkills } = await import('../js/skill-search.js');
  const s = searchSkills('mag', 'hb', 'hopping grip change').find((x) => x.src === 'UCGM');
  assert.equal(s.value, 'Misc');
});
