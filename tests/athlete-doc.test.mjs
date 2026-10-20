// Saved athletes: loading older or unknown shapes never loses anything (H5), the
// "value changed in the Code" check (M3), and retired-id redirect chains (L3).
// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { loadDiscipline, findSkill, applyRedirects } from '../js/skill-search.js';

await Promise.all(['wag', 'mag', 'tt'].map(loadDiscipline));
const { SCHEMA_VERSION, athleteDoc, hiddenEntries, migrateAthlete, savedByNewer } = await import('../js/athlete-doc.js');
const { newEntry, copyRoutines, listedValues, scoreEntry, updateChangedValues, valueChange } = await import('../js/model.js');
const { revalueEntry } = await import('../js/revalue.js');
const { CATALOG: WAG } = await import('../js/data/catalog-wag.js');
const { VAULTS: INF_VAULTS } = await import('../js/data/wag-infinity-vaults.js');
const { scoreInfinityVault } = await import('../js/scoring/wag.js');

const DIR = new URL('./fixtures/athletes/', import.meta.url);
const fixture = (name) => JSON.parse(readFileSync(new URL(name, DIR), 'utf8'));
const clone = (x) => JSON.parse(JSON.stringify(x));
const ids = (list) => (Array.isArray(list) ? list : Object.values(list || {})).map((e) => e?.id ?? null);

// Every fixture: load it, save it straight back: every level saved is still there.
for (const file of readdirSync(DIR)) {
  test(`fixture ${file}: loading and saving keeps every level`, () => {
    const saved = fixture(file);
    const a = migrateAthlete(clone(saved));
    const doc = athleteDoc(a);
    assert.deepEqual(ids(doc.entries).sort(), ids(saved.entries).sort());
    assert.ok(doc.schemaVersion >= SCHEMA_VERSION);
    // Every shown level can be scored (nothing in it crashes the planner).
    for (const e of a.entries) scoreEntry(e);
    // Saved, loaded again: the same.
    assert.deepEqual(athleteDoc(migrateAthlete(clone(doc))), doc);
  });
}

test('unknown disciplines and levels are kept aside, not shown, and saved back as they were', () => {
  const saved = fixture('v1-unknown-levels.json');
  const a = migrateAthlete(clone(saved));
  assert.deepEqual(ids(a.entries), ['m1', 't2']);
  assert.deepEqual(ids(hiddenEntries(a)), ['a1', 't1', 'w1', null]);
  // Hidden levels never reach a copy of the athlete, only the saved document.
  assert.ok(!('hidden' in { ...a }));
  const doc = athleteDoc(a);
  assert.deepEqual(doc.entries.find((e) => e?.id === 'a1'), saved.entries[0]);
  assert.deepEqual(doc.entries.find((e) => e?.id === 't1'), saved.entries[1]);
  // A shown level gets its rows (T&T High Flyers: tumbling passes of 8).
  assert.equal(a.entries[1].passes.tu[0].skills.length, 8);
});

test('a Masters MAG level holding a UCG MAG CoP vault keeps it (flagged in the planner, worth nothing)', () => {
  const a = migrateAthlete(fixture('v1-unknown-levels.json'));
  const m = a.entries.find((e) => e.id === 'm1');
  assert.equal(m.vault, 'UCG-VT-tuck-vault');
  assert.equal(scoreEntry(m).events.vt.sv, null);
});

test('schema 1 -> 2: an Infinity vault saved by name becomes its id, same start value', () => {
  const a = migrateAthlete(fixture('v1-infinity-by-name.json'));
  const [e1, e2] = a.entries;
  assert.equal(e1.vault, 'INF-012');
  assert.equal(scoreEntry(e1).events.vt.sv, 13.6);
  assert.equal(e2.vault, 'A vault since renamed'); // unknown: kept as saved
  assert.equal(athleteDoc(a).schemaVersion, 2);
});

test('Infinity vault ids are unique and permanent-looking, and old names still score', () => {
  assert.equal(new Set(INF_VAULTS.map((v) => v.id)).size, INF_VAULTS.length);
  assert.ok(INF_VAULTS.every((v) => /^INF-\d{3}$/.test(v.id)));
  for (const v of INF_VAULTS) assert.equal(scoreInfinityVault(v.name)?.id, v.id);
});

test('an athlete saved by a newer version is recognised (the planner does not save over it)', () => {
  const a = migrateAthlete(fixture('v99-newer.json'));
  assert.ok(savedByNewer(a));
  assert.equal(athleteDoc(a).schemaVersion, 99);
  assert.ok(!savedByNewer(migrateAthlete(fixture('v1-no-entries.json'))));
});

// ---- M3: value changed in the Code -------------------------------------------------------

const picked = (e, ev, id) => {
  const s = findSkill(id);
  return { name: s.label, skillId: s.id, fromList: true, ...listedValues(e, ev, s) };
};

test('a picked skill whose value or group in the Code changed is flagged, and Update takes the new values', () => {
  const e = newEntry('x', 'mag', 'int');
  const row = picked(e, 'fx', 'UCG-FX-pancake-stop-required');
  e.routines.fx = [row];
  assert.equal(valueChange(e, 'fx', row), null);
  const was = row.letter;
  row.letter = was === 'A' ? 'B' : 'A'; // as if the Code's value had been different when saved
  const c = valueChange(e, 'fx', row);
  assert.deepEqual(c.keys, ['letter']);
  assert.equal(c.now.letter, was);
  assert.equal(updateChangedValues(e, 'fx'), 1);
  assert.equal(row.letter, was);
  assert.equal(valueChange(e, 'fx', row), null);
});

test('no flag for typed skills, skills changed by hand, or a list not loaded', () => {
  const e = newEntry('x', 'tt', 'hf');
  const s = findSkill('TT-tr-3-4-front-somersault-tuck-30o');
  const row = { name: s.label, skillId: s.id, notation: s.notation, dd: s.dd + 0.1 }; // DD edited by hand: no fromList
  assert.equal(valueChange(e, 'tr', row), null);
  assert.ok(valueChange(e, 'tr', { ...row, fromList: true })); // from the list, DD differs: flagged
  assert.equal(valueChange(e, 'tr', { name: 'My skill', dd: 0.3 }), null);
  assert.equal(valueChange(e, 'tr', { name: 'Gone', skillId: 'TT-no-such-skill', fromList: true, dd: 0.3 }), null);
});

test('every example routine opens with no "value changed" flag', async () => {
  const { EXAMPLES } = await import('../js/data/examples.js');
  const { applyExample, eventInfo } = await import('../js/model.js');
  for (const ex of EXAMPLES) {
    const e = newEntry('x', ex.disc, ex.level);
    if (eventInfo(ex.disc, ex.event).kind === 'vault') continue;
    applyExample(e, ex);
    const rows = [...(e.routines[ex.event] || []), ...(e.passes[ex.event] || []).flatMap((p) => p.skills)];
    assert.deepEqual(rows.filter((r) => valueChange(e, ex.event, r)).map((r) => r.name), [], ex.id);
  }
});

test("a copy whose value isn't the list's own (WG adjusted value) is not flagged", () => {
  const from = newEntry('a', 'wag', 'diamond');
  const s = findSkill('USAG-BB-2.301-3');
  from.routines.bb = [{ name: s.label, skillId: s.id, fromList: true, ...listedValues(from, 'bb', s) }];
  const to = newEntry('b', 'wag', 'masters');
  copyRoutines(from, to);
  revalueEntry(to, 'diamond', WAG);
  const row = to.routines.bb[0];
  assert.equal(row.skillId, 'WGW-BB-2.202-1');
  assert.equal(row.letter, 'C'); // the WG adjusted value
  assert.equal(row.base.letter, 'B'); // the list's own value, kept to compare against
  assert.equal(valueChange(to, 'bb', row), null);
  assert.ok(to.catalog);
});

// ---- L3: redirect chains ----------------------------------------------------------------

test('redirects follow a chain to its end in any key order, and a loop redirects nothing', () => {
  const live = { id: 'C' };
  for (const redirects of [{ A: 'B', B: 'C' }, { B: 'C', A: 'B' }]) {
    const index = new Map([['C', live]]);
    applyRedirects(redirects, index);
    assert.equal(index.get('A'), live);
    assert.equal(index.get('B'), live);
  }
  const index = new Map([['C', live]]);
  applyRedirects({ A: 'B', B: 'A', S: 'S', D: 'E' }, index);
  assert.deepEqual([...index.keys()], ['C']);
  // A chain through a skill still listed stops there.
  const b = { id: 'B' };
  const index2 = new Map([['B', b], ['C', live]]);
  applyRedirects({ A: 'B', B: 'C' }, index2);
  assert.equal(index2.get('A'), b);
  assert.equal(index2.get('B'), b);
});
