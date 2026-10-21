// Run with: npm test
// The rules tables the build generates from the bundle's rules digests (review 2026-10-20, M2) still
// equal their digest: a hand edit to js/data, or a builder that drops or reshapes a row, fails here.
// The Masters tables have their own test (masters-wg.test.mjs); MASTERS_MAP is a build-time check.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { VAULTS as MAG_VAULTS } from '../js/data/mag-vaults.js';
import { VAULTS as INFINITY_VAULTS } from '../js/data/wag-infinity-vaults.js';
import * as INFINITY from '../js/data/infinity-rules.js';
import * as XCEL from '../js/data/xcel.js';
import * as WAG from '../js/scoring/wag.js';

const json = (path) => JSON.parse(readFileSync(new URL(`../tools/source/${path}`, import.meta.url), 'utf8'));
const digest = (path) => json(`bundle/rules/${path}`);
const strip = ({ about, cite, ...rest }) => rest;

test('MAG vaults: Advanced values and flipping equal UCG-MAG vault.json', () => {
  const d = digest('UCG-MAG/digest/vault.json');
  const adv = Object.fromEntries(d.upgraded_fhs_vaults.rows.map((r) => [r.wg_vault, r.adv]));
  const nonFlipping = new Set(d.non_flipping.wg_vaults);
  const wg = MAG_VAULTS.filter((v) => v.src === 'WG');
  for (const v of wg) {
    assert.equal(v.adv, adv[v.id] ?? v.value, `vault ${v.id} adv`);
    assert.equal(v.flipping, !nonFlipping.has(v.id), `vault ${v.id} flipping`);
  }
  const ids = new Set(wg.map((v) => v.id));
  for (const n of [...Object.keys(adv), ...nonFlipping]) assert.ok(ids.has(n), `digest vault ${n} is a WG vault`);
  assert.equal(adv['228'], 5.6); // Nate 2026-10-21
});

test('Infinity tables equal UCG-WAG infinity.json and levels.json', () => {
  const d = digest('UCG-WAG/digest/infinity.json');
  const level = json('bundle/catalog/levels.json').WAG.infinity;
  assert.deepEqual(INFINITY.INFINITY_VALUES, strip(d.values));
  assert.deepEqual(INFINITY.INFINITY_VALUES, level.values);
  assert.equal(INFINITY.INFINITY_MAX_SKILLS, d.counting.count);
  assert.equal(INFINITY.INFINITY_MIN_SKILLS, d.short_routine.min_skills);
  assert.equal(INFINITY.INFINITY_EG_BONUS, d.condensed_eg_bonus.each);
  assert.equal(INFINITY.INFINITY_EVENT_BONUS, d.event_bonus.each);
  for (const ev of ['UB', 'BB', 'FX']) {
    const g = INFINITY.INFINITY_GROUPS[ev.toLowerCase()];
    assert.deepEqual(g.groups, d.condensed_eg_bonus.group_names[ev]);
    assert.equal(g.eventBonus, d.event_bonus.labels[ev]);
    assert.deepEqual(g.condensed, Object.fromEntries(Object.entries(level.eg.condensed[ev]).map(([k, l]) => [k, l.map(Number)])));
  }
  // scoring uses these very tables
  for (const k of ['INFINITY_GROUPS', 'INFINITY_VALUES', 'INFINITY_MAX_SKILLS', 'INFINITY_EG_BONUS', 'INFINITY_EVENT_BONUS']) assert.equal(WAG[k], INFINITY[k], k);
  assert.equal(WAG.MIN_SKILLS, INFINITY.INFINITY_MIN_SKILLS);
});

test('Infinity vault chart equals UCG-WAG infinity-vaults.json, with every permanent id', () => {
  const chart = digest('UCG-WAG/digest/infinity-vaults.json').vaults;
  assert.deepEqual(INFINITY_VAULTS.map(({ name, entry, usag, dv }) => ({ usag, name, entry, d: dv })), chart);
  const ids = json('infinity_vault_ids.json').vaults;
  assert.deepEqual(INFINITY_VAULTS.map((v) => v.id).sort(), ids.map((v) => v.id).sort());
  assert.equal(new Set(INFINITY_VAULTS.map((v) => v.id)).size, INFINITY_VAULTS.length);
});

test('Xcel tables equal USAG-XCEL-2022 levels.json', () => {
  const d = digest('USAG-XCEL-2022/digest/levels.json');
  assert.deepEqual(XCEL.XCEL_VP, strip(d.value_parts));
  assert.deepEqual(XCEL.XCEL_LIMITS, strip(d.limits));
  assert.deepEqual(XCEL.XCEL_SR, strip(d.special_requirements));
  assert.deepEqual(XCEL.XCEL_VAULTS, d.vaults.rows);
  assert.deepEqual(XCEL.XCEL_SILVER_VAULTS, d.silver_vaults.rows);
});
