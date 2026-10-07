// The Xcel Code's own sample routines (82, Silver-Sapphire, from the extraction session):
// the planner's start value, missing special requirements, restricted count and Sapphire
// bonus must match the Code's. Details: node tools/check_xcel_fixtures.mjs --verbose
// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkAll, loadFixtures } from '../tools/check_xcel_fixtures.mjs';

const results = checkAll(await loadFixtures());

test('the Code\'s sample routines score as the Code says', () => {
  const bad = results
    .filter((x) => !x.ok)
    .map((x) => `${x.fx.division} ${x.fx.event} ${x.fx.section} #${x.fx.example}: ${x.diffs.join('; ')}`);
  assert.deepEqual(bad, []);
  assert.ok(results.length >= 80);
});
