// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bundleProblems } from '../tools/check_bundle.mjs';

test('the vendored skill bundle matches its lock and manifest, and js/data is built from it', async () => {
  assert.deepEqual(await bundleProblems(), []);
});
