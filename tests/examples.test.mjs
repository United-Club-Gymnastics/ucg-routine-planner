// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXAMPLES } from '../js/data/examples.js';
import { problems } from '../tools/check_examples.mjs';

test('Every example routine follows its level rules', () => {
  const bad = EXAMPLES.map((ex) => [ex.id, problems(ex)]).filter(([, p]) => p.length);
  assert.deepEqual(bad, []);
});
