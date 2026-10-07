// The Xcel Code's own sample routines (82, Silver-Sapphire, from the extraction session):
// the planner's start value, missing special requirements, restricted count and Sapphire
// bonus must match the Code's. Details: node tools/check_xcel_fixtures.mjs --verbose
// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkAll, loadFixtures } from '../tools/check_xcel_fixtures.mjs';

// Known differences that aren't the planner's rules:
const KNOWN = {
  // The Code awards no bonus for back uprise + cast to handstand; the check links every
  // bars skill to the next (a coach would leave that pair unlinked).
  'Sapphire UB does_not_meet 2': 'bars connection the Code does not count',
  // BB 2.107 has no Xcel record, so its dance series can't be detected (the coach ticks it).
  'Platinum BB meets 1': 'element 2.107 not in the Xcel list',
  // An unnumbered "No VP" row the Code counts as restricted (a second "D"?).
  'Diamond FX does_not_meet 2': 'unnumbered restricted row',
};

const results = checkAll(await loadFixtures());

test('the Code\'s sample routines score as the Code says', () => {
  const bad = results
    .filter((x) => !x.ok && !KNOWN[`${x.fx.division} ${x.fx.event} ${x.fx.section} ${x.fx.example}`])
    .map((x) => `${x.fx.division} ${x.fx.event} ${x.fx.section} #${x.fx.example}: ${x.diffs.join('; ')}`);
  assert.deepEqual(bad, []);
  assert.ok(results.length >= 80);
});
