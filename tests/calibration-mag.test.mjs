// Judge practice for MAG (calibration/mag/): the answer key, scored by the planner's MAG rules, gives
// this season's start values; every skill is the listed skill it says; execution totals add up; a
// judge's entry is checked right; and the planner opens each routine with the key's start value.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findVault } from '../js/scoring/mag.js';
import { E_TOLERANCE, answerKey, compare, scoreEntry, skillRows } from '../calibration/mag/key.js';
import { ROUTINES } from '../calibration/mag/routines.js';

const byId = (id) => ROUTINES.find((r) => r.id === id);
const sum = (xs) => Math.round(xs.reduce((a, b) => a + b, 0) * 10) / 10;

// This season's keys: start value, neutral deductions, final. Last season's doc had higher start
// values where an A became Sub-A (2026-28 UCG CoP; Intermediate high bar's half turn is UCG HB 3, Sub-A),
// and Intermediate rings EG I at 0.3 (now 0.5).
const KEYS = {
  'dev-fx': [11.4, 0, 10.6], 'int-fx': [11.6, 0, 11.1], 'adv-fx': [13.2, 0.6, 8.4],
  'dev-ph': [11.1, 0, 9.0], 'int-ph': [11.4, 0, 9.6], 'adv-ph': [13.4, 0, 10.5],
  'dev-sr': [12.0, 0, 11.3], 'int-sr': [11.6, 0, 10.9], 'adv-sr': [13.6, 0, 10.9],
  'dev-vt': [11.3, 0, 10.9], 'int-vt': [11.3, 0, 10.9], 'adv-vt': [12.8, 0, 12.1],
  'dev-pb': [12.0, 0, 10.3], 'int-pb': [12.1, 0, 11.3], 'adv-pb': [12.0, 0, 10.3],
  'dev-hb': [10.9, 0, 9.9], 'int-hb': [10.7, 0, 9.3], 'adv-hb': [12.0, 0, 8.1],
};

// The entry a judge would make from the key itself.
function keyEntry(r, key) {
  if (r.event === 'vt') return { vault: r.vault, stick: r.stick, otherNd: 0, e: key.e };
  const s = key.score;
  return {
    skills: s.rows.map((it) => ({ letter: it.letter, eg: it.eg || 0 })),
    bonus: Object.fromEntries(Object.entries(s.optionValues).filter(([, v]) => v).map(([id]) => [id, true])),
    stick: r.stick,
    missing: Object.fromEntries(key.ndItems.filter((x) => x.rule).map((x) => [x.rule, true])),
    otherNd: sum(key.ndItems.filter((x) => !x.rule).map((x) => x.v)),
    e: key.e,
  };
}

test('one routine for each level and apparatus, each with a video', () => {
  assert.equal(ROUTINES.length, 18);
  for (const level of ['dev', 'int', 'adv']) {
    for (const event of ['fx', 'ph', 'sr', 'vt', 'pb', 'hb']) {
      const r = byId(`${level}-${event}`);
      assert.ok(r, `${level}-${event}`);
      assert.equal([r.level, r.event].join('-'), r.id);
      assert.ok(/^[\w-]{11}$/.test(r.youtube || '') || /^[\w-]{25,}$/.test(r.drive || ''), r.id);
    }
  }
});

test("each key gives this season's start value, neutral deductions and final score", () => {
  for (const r of ROUTINES) {
    const k = answerKey(r);
    assert.deepEqual([k.sv, k.nd, k.final], KEYS[r.id], r.id);
  }
});

test('every listed skill is the skill list’s, with its current value and element group', async () => {
  const { findSkill, loadDiscipline, magSkillAllowed } = await import('../js/skill-search.js');
  await loadDiscipline('mag');
  for (const r of ROUTINES.filter((x) => x.event !== 'vt')) {
    for (const s of r.rows.filter((x) => x.skillId)) {
      const k = findSkill(s.skillId);
      assert.ok(k, `${r.id} ${s.skillId}`);
      assert.ok(magSkillAllowed(r.level, k), `${r.id} ${s.skillId}`);
      assert.deepEqual([s.label, s.letter, s.eg], [k.label, k.value, k.eg || 0], `${r.id} ${s.name}`);
    }
  }
  for (const r of ROUTINES.filter((x) => x.event === 'vt')) assert.ok(findVault(r.vault, r.level), r.id);
});

test('the execution total is the sum of the deductions the key lists', () => {
  for (const r of ROUTINES) {
    const listed = r.event === 'vt' ? [r.e] : [...r.rows.map((s) => s.e), ...r.lines.filter((l) => l.kind === 'execution').map((l) => l.v)];
    assert.equal(sum(listed), r.e, r.id);
    for (const s of r.rows || []) assert.equal(sum((s.ded.match(/\d*\.\d+/g) || []).map(Number)), s.e, `${r.id} ${s.name}`);
  }
});

test("a neutral deduction the planner takes itself is the one the doc lists, and isn't taken twice", () => {
  const key = answerKey(byId('adv-fx'));
  assert.deepEqual(key.ndItems.map((x) => [x.what, x.v, x.rule || '']), [
    ['No balance or leap element', 0.3, 'balance'],
    ['Same diagonal used 3 times in a row', 0.3, ''],
  ]);
  // The round-off opens the routine: a tumbling start, though it has no element group.
  assert.ok(answerKey(byId('adv-fx')).score.detected.tumbleStart);
  for (const r of ROUTINES.filter((x) => x.event !== 'vt')) {
    const rules = r.lines.filter((l) => l.rule).map((l) => l.rule).sort();
    assert.deepEqual(answerKey(r).ndItems.filter((x) => x.rule).map((x) => x.rule).sort(), rules, r.id);
  }
});

test('repetitions repeat the same listed skill; other non-recognitions earn nothing', () => {
  const rows = skillRows(byId('adv-hb'));
  const key = answerKey(byId('adv-hb'));
  assert.deepEqual(key.score.items.filter((it) => it.status === 'repeat').map((it) => it.name), ['Front giant', '½ turn through handstand', 'Back giant']);
  const fx = answerKey(byId('adv-fx'));
  assert.deepEqual(fx.score.items.filter((it) => it.status === 'blank').map((it) => it.name), ['V-sit then press to handstand', 'Straddle planche', 'Straddle planche press to handstand']);
  assert.ok(rows.every((s) => !s.notRecognised));
});

test('Sub-A skills count toward the 6 but are worth 0.0, with no element group bonus (Developmental high bar)', () => {
  const key = answerKey(byId('dev-hb'));
  assert.equal(key.score.rows.filter((it) => it.letter === 'Sub-A').length, 3);
  assert.equal(key.score.difficulty, 0.3);
  assert.equal(key.score.shortBy, 0);
  assert.deepEqual(key.score.egBonus, { 4: 0.5 });
});

test('the key itself is right; slips are caught and explained', () => {
  for (const r of ROUTINES) {
    const key = answerKey(r);
    const res = compare(r, key, keyEntry(r, key));
    assert.ok(res.right, `${r.id}: ${res.notes.join(' ')}`);
    assert.equal(res.mine.final, key.final, r.id);
  }
  // Execution within the tolerance is right; beyond it isn't.
  const r = byId('int-pb');
  const key = answerKey(r);
  assert.equal(compare(r, key, { ...keyEntry(r, key), e: key.e + E_TOLERANCE }).right, true);
  assert.equal(compare(r, key, { ...keyEntry(r, key), e: key.e + E_TOLERANCE + 0.1 }).e, false);
  // A missed stick bonus is a start value off by 0.1, explained.
  const noStick = compare(r, key, { ...keyEntry(r, key), stick: 0 });
  assert.equal(noStick.sv, false);
  assert.match(noStick.notes.join(' '), /Stick bonus/);
  // Counting a Sub-A skill as an A: a value off, and named.
  const dev = byId('dev-pb');
  const dkey = answerKey(dev);
  const entry = keyEntry(dev, dkey);
  entry.skills = entry.skills.map((s) => (s.letter === 'Sub-A' ? { letter: 'A', eg: 0 } : s));
  const slip = compare(dev, dkey, entry);
  assert.equal(slip.sv, false);
  assert.match(slip.notes.join(' '), /Sub-A:.*Forward roll/);
  // The wrong vault.
  const vt = byId('adv-vt');
  const vkey = answerKey(vt);
  const wrong = compare(vt, vkey, { ...keyEntry(vt, vkey), vault: '308' });
  assert.equal(wrong.sv, false);
  assert.match(wrong.notes[0], /Tsukahara layout/);
});

test('the start value cap includes the stick bonus', () => {
  const r = { ...byId('dev-vt'), vault: '203', stick: 0.1 }; // 1.6 + 0.1: 11.7, under the cap
  assert.equal(answerKey(r).sv, 11.7);
  const skills = [1, 2, 3, 4, 1, 2].map((eg) => ({ letter: 'F', eg }));
  assert.equal(scoreEntry(byId('dev-pb'), { skills, bonus: {}, stick: 0.1, missing: {}, otherNd: 0, e: 0 }).sv, 12.3);
});

test('opened in the planner (?calibration=mag/…), each routine has the key’s start value, less the stick bonus', async () => {
  const { calibrationAthlete } = await import('../js/calibration-view.js');
  const { loadDiscipline } = await import('../js/skill-search.js');
  const { scoreEvent } = await import('../js/model.js');
  await loadDiscipline('mag');
  let n = 0;
  for (const r of ROUTINES) {
    const found = calibrationAthlete(`mag/${r.id}`, () => `id${n++}`);
    assert.equal(found.routine.practiceId, r.id);
    const e = found.athlete.entries[0];
    assert.equal(e.level, r.level);
    assert.equal(scoreEvent(e, r.event).sv, Math.round((answerKey(r).sv - r.stick) * 10) / 10, r.id);
  }
  assert.equal(calibrationAthlete('mag/nope', () => 'x'), null);
});

test("Advanced pommel horse: the handstand dismount with 3/3 travel and 270° turn is IV.20's C form", () => {
  const r = byId('adv-ph');
  assert.equal(r.rows.at(-1).skillId, 'WG-PH-IV-20b');
  const d = answerKey(r).score.items.at(-1);
  assert.deepEqual([d.letter, d.status, d.bonus], ['C', 'counting', 0.3]);
});

// The calculator (calibration/mag/calculator.js, shared with calculator/mag/): the stick bonus a stuck
// landing earns, and connections marked between counting skills.
import { levelRules, stickBonus } from '../calibration/mag/calculator.js';

test('stick bonus: by level, and at Advanced by the dismount\'s value; on vault, by flipping', () => {
  const v = (level, dismount) => stickBonus(level, 'pb', { dismount }).value;
  assert.deepEqual(['dev', 'int'].map((l) => [v(l, 'A'), v(l, 'D')]), [[0.1, 0.1], [0.1, 0.1]]);
  assert.deepEqual(['Sub-A', 'A', 'B', 'C', 'E'].map((d) => v('adv', d)), [0, 0, 0.1, 0.2, 0.2]);
  assert.equal(stickBonus('adv', 'ph', { dismount: 'E' }).value, 0);
  const vt = (level, id) => stickBonus(level, 'vt', { vault: findVault(id, level) }).value;
  assert.deepEqual([vt('dev', '201'), vt('int', '201'), vt('int', '313'), vt('adv', '201'), vt('adv', '313')], [0.1, 0.1, 0.2, 0, 0.2]);
  // Every answer key's stick bonus is what its stuck landing earns.
  for (const r of ROUTINES.filter((x) => x.stick)) {
    const dismount = r.rows?.filter((x) => !x.nr).at(-1)?.letter;
    assert.equal(stickBonus(r.level, r.event, { dismount, vault: r.vault && findVault(r.vault, r.level) }).value, r.stick, r.id);
  }
});

test('connections: the judge connects counting skills, and the bonus follows', () => {
  const skills = [['D', 2, true], ['B', 3], ['A', 1], ['C', 4], ['B', 2], ['A', 1], ['C', 3]].map(([letter, eg, link]) => ({ letter, eg, link: !!link }));
  const entry = { skills, bonus: {}, stick: 0, missing: {}, otherNd: '', e: '' };
  const linked = scoreEntry({ event: 'fx', level: 'adv' }, entry);
  const none = scoreEntry({ event: 'fx', level: 'adv' }, { ...entry, skills: skills.map((s) => ({ ...s, link: false })) });
  assert.equal(linked.score.optionValues.conn1, 0.1);
  assert.equal(Math.round((linked.d - none.d) * 10) / 10, 0.1);
  const hb = [['C', 2, true], ['C', 2, true], ['D', 3], ['A', 4]].map(([letter, eg, link]) => ({ letter, eg, link: !!link }));
  assert.equal(scoreEntry({ event: 'hb', level: 'int' }, { ...entry, skills: hb }).score.optionValues.connCC, 0.2);
});

test('the rules panel: each level\'s rows, with the Advanced dismount group off floor only', () => {
  const labels = (l, e) => levelRules(l, e).map(([k]) => k);
  assert.ok(labels('adv', 'pb').includes('EG IV (dismount)') && !labels('adv', 'fx').includes('EG IV (dismount)'));
  assert.ok(labels('dev', 'ph').includes('Mushroom bonus') && labels('dev', 'vt').includes('Banned'));
  assert.equal(levelRules('int', 'sr').find(([k]) => k === 'Start value cap')[1], '13.1, bonuses included');
});

// The itemized neutral deductions (Nate 2026-11-09): in the engine, so every consumer scores them alike.
test('itemized neutral deductions: floor and vault', async () => {
  const { neutralOptions, neutralTotal } = await import('../js/scoring/mag.js');
  assert.deepEqual(neutralOptions('fx', 'int').map((o) => o.id), ['time', 'oobHand', 'oobBody', 'oobLand', 'diagonal', 'matRebound']);
  assert.deepEqual(neutralOptions('fx', 'adv').map((o) => o.id), ['time', 'oobHand', 'oobBody', 'oobLand', 'diagonal', 'corners', 'transitions', 'matRebound']);
  assert.deepEqual(neutralOptions('vt', 'dev').map((o) => o.id), ['oobHand', 'oobBody', 'oobLand', 'notFeetFirst']);
  assert.deepEqual(neutralOptions('pb', 'adv'), []);
  assert.equal(neutralTotal('fx', 'adv', { time: '0.3', oobHand: 2, oobBody: '1', corners: true, matRebound: 0 }), 1.1);
  assert.equal(neutralTotal('fx', 'int', { corners: true, time: '0.4' }), 0); // corners: Advanced only; 0.4 isn't a step
  assert.equal(neutralTotal('vt', 'int', { notFeetFirst: true, oobLand: 1 }), 2.3);
  const vt = scoreEntry({ event: 'vt', level: 'int' }, { vault: 'other', stick: 0, neutral: { oobHand: 1 }, otherNd: '0.2', e: '1' });
  assert.equal(vt.nd, 0.3);
});

// ucg-platform vendors calibration/mag/rules.js: its export list is an API.
test('rules.js: the stable export list, and no DOM', async () => {
  const rules = await import('../calibration/mag/rules.js');
  for (const name of ['scoreEntry', 'bonusOptions', 'requirements', 'neutralOptions', 'neutralTotal', 'stickBonus', 'levelRules', 'LEVEL_TABS', 'LETTERS', 'ROMAN', 'APPARATUS', 'VAULTS', 'offeredAt', 'devBanned', 'findVault', 'LEVELS']) {
    assert.ok(name in rules, name);
  }
  assert.equal(rules.stickBonus('adv', 'hb', { dismount: 'C' }).value, 0.2);
});

// A vault the level bans scores 0 (Developmental: flipping or round-off entry), stick and deductions too.
test('a banned Developmental vault scores 0', () => {
  const r = scoreEntry({ event: 'vt', level: 'dev' }, { vault: '101', stick: 0.1, neutral: { oobHand: 1 }, otherNd: '0.3', e: '1.2' });
  assert.equal(r.banned, true);
  assert.deepEqual([r.d, r.sv, r.nd, r.final], [0, 0, 0, 0]);
  assert.ok(scoreEntry({ event: 'vt', level: 'int' }, { vault: '101', stick: 0, e: '0' }).sv > 10);
});
