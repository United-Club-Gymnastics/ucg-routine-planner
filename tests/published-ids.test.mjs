// Run with: npm test
// Every skill or vault ID this site ever shipped (tools/source/published-ids.json) still resolves in
// the loaded skill lists and vault tables, or ucg-code-of-points retired it on purpose. Saved
// routines hold these IDs, so a sync that renames one in place must fail here and in sync_bundle.py.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadDiscipline, findSkill } from '../js/skill-search.js';
import { retiredIds } from '../tools/check_bundle.mjs';

await Promise.all(['wag', 'mag'].map(loadDiscipline));
const published = JSON.parse(readFileSync(new URL('../tools/source/published-ids.json', import.meta.url), 'utf8'));
const { retired } = retiredIds();

async function vaultIds() {
  const ids = new Set();
  for (const f of ['mag-vaults', 'wag-vaults', 'masters-vaults', 'sapphire-vaults', 'wag-infinity-vaults']) {
    const m = await import(`../js/data/${f}.js`);
    for (const v of m.VAULTS || []) {
      ids.add(v.id);
      if (v.code) ids.add(v.code);
    }
  }
  return ids;
}

test('published-ids.json is append-only and seeded (the four pre-sweep PH IDs and the retired Masters WAG hecht vault are in it)', () => {
  for (const id of [
    'UCG-PH-name-tbd-pearce',
    'UCG-PH-spindle-to-handstand-dismount-from-over-the-handles',
    'UCGM-mag-PH-name-tbd-pearce',
    'UCGM-mag-PH-spindle-to-handstand-dismount-from-over-the-handles',
  ]) {
    assert.ok(published.mag.includes(id), id);
    assert.ok(retired.mag.has(id), `${id} must stay retired in ucg-code-of-points`);
  }
  assert.ok(published.wag.includes('UCGM-wag-straight-hecht-over-table'));
  assert.ok(retired.wag.has('UCGM-wag-straight-hecht-over-table'));
});

// Vault aliases (USAG-VT-*, WG numbers such as "101" / "1.01") are keyed differently by the vault
// charts, so they are guarded at the alias level only (tools/check_bundle.mjs).
const isVault = (id) => /-VT-/.test(id) || /^[0-9.]+$/.test(id);

test('every published skill ID resolves (findSkill, redirects included) or was retired by the CoP', async () => {
  const vaults = await vaultIds();
  const lost = [];
  for (const disc of ['mag', 'wag']) {
    for (const id of published[disc]) {
      if (isVault(id) || findSkill(id) || vaults.has(id) || retired[disc].has(id)) continue;
      lost.push(`${disc}:${id}`);
    }
  }
  assert.deepEqual(lost, []);
});
