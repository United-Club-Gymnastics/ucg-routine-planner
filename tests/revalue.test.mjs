// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadDiscipline } from '../js/skill-search.js';

// Skill lists load per discipline (as the app does before showing an athlete).
await Promise.all(['wag', 'mag', 'tt'].map(loadDiscipline));
import { newEntry, copyEvent, copyRoutines, eventHasContent, scoreEntry } from '../js/model.js';
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
  assert.equal(vaultTo('wag', 'gold', 'inf', '1.101', WAG)[0], 'INF-001'); // Infinity table: Front Handspring, by its id
  // Not in the target's list: Masters counts it as any other vault; Xcel gets no vault.
  assert.deepEqual(vaultTo('wag', 'gold', 'masters', '1.108', WAG), ['other', 'other']); // ¼ on ¼ off: not a WG vault
  assert.deepEqual(vaultTo('wag', 'masters', 'gold', 'UCGM-wag-pike-hecht-over-table', WAG), ['', 'none']);
  assert.deepEqual(vaultTo('mag', 'adv', 'masters', '101', MAG), ['101', 'exact']);
  assert.deepEqual(vaultTo('mag', 'masters', 'adv', 'UCGM-mag-pike-hecht-over-table', MAG), ['', 'none']);
});

test('Masters MAG "GE" (gymnastics element) skills keep their GE value, valued by age decade', async () => {
  const { searchSkills } = await import('../js/skill-search.js');
  const s = searchSkills('mag', 'hb', 'hopping grip change').find((x) => x.src === 'UCGM');
  assert.equal(s.value, 'GE');
});

test('One event copied from another level: only that event is replaced and re-valued', () => {
  const from = newEntry('a', 'wag', 'gold');
  from.routines.bb = [pick('USAG-BB-1.101-2', 'Leap mount lowering into scale', 'A')];
  from.routines.fx = [pick('USAG-BB-1.101-2', 'Should not be copied', 'A')];
  from.vault = 'x';
  const to = newEntry('b', 'wag', 'masters');
  to.decade = '40';
  to.routines.fx = [{ name: 'Kept as it was', letter: 'B', eg: '' }];
  to.routines.bb = [{ name: 'Replaced', letter: 'C', eg: '' }];
  copyEvent(from, to, 'bb');
  const summary = revalueEntry(to, 'gold', WAG, from.vault, ['bb']);
  assert.equal(to.routines.bb[0].skillId, 'WGW-BB-1.101-1');
  assert.ok(!to.routines.bb.some((r) => r.name === 'Replaced'));
  assert.equal(to.routines.fx[0].name, 'Kept as it was');
  assert.ok(!to.routines.fx[0].check); // not re-valued: not flagged as typed in
  assert.equal(to.vault, '');
  assert.deepEqual(summary, { exact: 1, approximate: 0, notCredited: 0, typed: 0, vault: '' });
  assert.equal(to.revalued.event, 'bb');
  assert.ok(eventHasContent(to, 'bb') && !eventHasContent(to, 'vt'));
});

test('Infinity -> WAG Masters: split leap, handstand forward roll and arabesque full turn are credited (stand-ins)', () => {
  const fx = copyTo('wag', 'inf', 'masters', 'fx', [
    pick('USAG-FX-1.101-1', 'Split leap or split jump', 'A'),
    pick('USAG-FX-4.101-1b', 'Handstand forward roll', 'A'),
  ], WAG);
  assert.equal(fx.rows[0].skillId, 'WGW-FX-1.101-1');
  assert.ok(fx.rows[0].approx && !fx.rows[0].noCredit);
  assert.equal(fx.rows[1].letter, 'ME');
  assert.ok(!fx.rows[1].noCredit);
  const bb = copyTo('wag', 'inf', 'masters', 'bb', [pick('USAG-BB-3.304-1', 'Full turn in arabesque', 'C')], WAG);
  assert.equal(bb.rows[0].skillId, 'WGW-BB-3.302-1');
  assert.ok(bb.rows[0].approx && bb.rows[0].letter === 'C');
});
