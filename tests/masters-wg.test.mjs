// Run with: npm test
// UCG Masters Rules Policy v2.1 (MAG and WAG) and the WG MAG newsletter rules (2026-10-20).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dismountOf, scoreRoutine, SWING_HS, FX_BALANCE_OR_JUMP } from '../js/scoring/mag.js';
import { scoreWagMasters } from '../js/scoring/wag.js';
import { dismountCr, mastersValue } from '../js/scoring/masters.js';
import { RULES as MASTERS_RULES } from '../js/data/masters-rules.js';
import { RULES as WG_RULES } from '../js/data/wg-mag-rules.js';
import { TAGS } from '../js/data/masters-wag-tags.js';
import { SKILLS as MASTERS_WAG } from '../js/data/masters-skills-wag.js';
import { newEntry, normalizeEntry } from '../js/model.js';

const s = (name, letter, eg, extra = {}) => ({ name, letter, eg, ...extra });
const w = (name, letter, skillId, link = false) => ({ name, letter, skillId, link });
const digest = (path) => JSON.parse(readFileSync(new URL(`../tools/source/bundle/rules/${path}`, import.meta.url), 'utf8'));

// ---- data from the bundle's digests -------------------------------------------------

test('Masters tables equal the rules digest (scoring.json)', () => {
  const d = digest('UCG-MASTERS/digest/scoring.json');
  assert.deepEqual(MASTERS_RULES.values.GE, d.difficulty_by_decade.GE);
  assert.deepEqual(MASTERS_RULES.values.GE, [null, null, 0.0, 0.1, 0.2]);
  assert.deepEqual(MASTERS_RULES.total, d.counting_elements.total);
  assert.deepEqual(MASTERS_RULES.mag.egBonus['0.3'], d.MAG.eg_bonus['0.3']);
  assert.deepEqual(MASTERS_RULES.mag.egBonus['0.5'], d.MAG.eg_bonus['0.5']);
  assert.deepEqual(MASTERS_RULES.wag.dismountCr['0.5'], d.WAG.composition_requirements.dismount_cr['0.5']);
  assert.deepEqual(MASTERS_RULES.wag.beamBonus, d.WAG.BB.beam_bonus);
});

test('WG MAG lists equal the rules digest (composition.json)', () => {
  const d = digest('WG-MAG-2025/digest/composition.json');
  const req = Object.fromEntries(Object.values(d.requirements).flat().map((r) => [r.id, r]));
  assert.deepEqual(SWING_HS, req.swing_to_handstand.elements);
  assert.deepEqual(FX_BALANCE_OR_JUMP, req.balance_or_jump.elements);
  assert.equal(WG_RULES.dismountEgMax, 0.5);
});

// ---- Masters MAG -------------------------------------------------------------------

test('Masters MAG: GE values one step below the old Misc; an old "Misc" row reads as GE', () => {
  assert.equal(mastersValue('GE', '50'), 0.0);
  assert.equal(mastersValue('GE', '70'), 0.2);
  assert.equal(mastersValue('Misc', '60'), 0.1);
  assert.equal(mastersValue('GE', '30'), null);
  const e = newEntry('x', 'mag', 'masters');
  e.routines.pb = [s('Swing', 'Misc', '1')];
  normalizeEntry(e);
  assert.equal(e.routines.pb[0].letter, 'GE');
});

const pb7 = [s('a', 'ME', 1), s('b', 'A', 2), s('c', 'B', 3), s('d', 'A', 1), s('e', 'A', 2), s('f', 'A', 3), s('Dismount', 'A', 4)];

test('Masters MAG: 7 counting (6 + dismount) to 59, 6 (5 + dismount) from 60', () => {
  const r30 = scoreRoutine('pb', 'masters', pb7, {}, { decade: '30' });
  // 30s: ME 0.0, A 0.2, B 0.4; EG I-III +0.5 (A or B), dismount group = A 0.2
  assert.equal(r30.rows.length, 7);
  assert.equal(r30.difficulty, 1.4);
  assert.equal(r30.egTotal, 1.7);
  assert.equal(r30.startValue, 13.1);
  const r60 = scoreRoutine('pb', 'masters', pb7, {}, { decade: '60' });
  // 60s: the ME (0.3) drops out; B 0.7 + 4 x A 0.5 + dismount A 0.5; four groups at 0.5
  assert.equal(r60.rows.length, 6);
  assert.equal(r60.items[0].status, 'noncounting');
  assert.equal(r60.difficulty, 3.2);
  assert.equal(r60.egTotal, 2.0);
  assert.equal(r60.shortBy, 0);
  assert.equal(r60.startValue, 15.2);
});

test('Masters MAG: a routine without a dismount is one element short (-1.0)', () => {
  const r = scoreRoutine('pb', 'masters', [...pb7.slice(0, 6), s('g', 'A', 2)], {}, { decade: '30' });
  assert.equal(r.dismount, null);
  assert.equal(r.rows.length, 6);
  assert.equal(r.shortBy, 1);
  assert.equal(r.shortDeduction, 1.0);
  // Floor: the last skill that isn't EG I is the dismount (a final balance doesn't change that).
  const items = [{ eg: 3, idx: 0 }, { eg: 1, idx: 1 }];
  assert.equal(dismountOf('fx', items), items[0]);
  assert.equal(dismountOf('pb', items), null);
});

test('Masters MAG EG bonus: +0.3 / +0.5 by level and decade; dismount group max 0.5', () => {
  const me = scoreRoutine('pb', 'masters', [s('a', 'ME', 1), s('b', 'A', 2), s('c', 'A', 3), s('d', 'A', 2), s('e', 'A', 3), s('f', 'A', 2), s('g', 'A', 4)], {}, { decade: '30' });
  assert.equal(me.egBonus[1], 0.3); // an ME in the 30s
  assert.equal(me.egBonus[2], 0.5);
  const ge = scoreRoutine('pb', 'masters', [s('a', 'GE', 1), s('b', 'GE', 2), s('c', 'GE', 3), s('d', 'GE', 2), s('e', 'GE', 3), s('g', 'C', 4)], {}, { decade: '70' });
  assert.equal(ge.egBonus[1], 0.5); // a GE from 70
  assert.equal(ge.egBonus[4], 0.5); // dismount C = 1.0 in the 70s, capped at 0.5
  const gk = scoreRoutine('pb', 'masters', [s('a', 'GE', 1), s('b', 'ME', 2), s('g', 'A', 4)], {}, { decade: '50' });
  assert.equal(gk.egBonus[1], 0.3); // a GE in the 50s
  assert.equal(gk.egBonus[2], 0.5); // an ME in the 50s
});

test('Masters MAG: no limit per element group', () => {
  const r = scoreRoutine('hb', 'masters', [...'abcdef'.split('').map((n) => s(n, 'A', 1)), s('Flyaway', 'A', 4)], {}, { decade: '30' });
  assert.equal(r.rows.length, 7);
  assert.ok(!r.items.some((it) => it.reason === 'eg'));
});

test('Masters MAG: an element-group skill is swapped in only when that helps', () => {
  const bs = [1, 2, 3, 4, 5, 6].map((n) => s(`b${n}`, 'B', 1));
  // A in EG II: lose a B (0.4), gain A 0.2 + EG II 0.5.
  const help = scoreRoutine('pb', 'masters', [...bs, s('a', 'A', 2), s('Dismount', 'A', 4)], {}, { decade: '30' });
  assert.equal(help.items[6].status, 'counting');
  assert.equal(help.items[5].reason, 'swap');
  assert.equal(help.startValue, 13.6); // 10 + 2.4 + EG 0.5 + 0.5 + 0.2
  // ME in EG II: lose 0.4, gain 0.0 + EG II 0.3: no swap.
  const no = scoreRoutine('pb', 'masters', [...bs, s('m', 'ME', 2), s('Dismount', 'A', 4)], {}, { decade: '30' });
  assert.equal(no.items[6].status, 'noncounting');
  assert.equal(no.items[6].reason, 'top');
  assert.equal(no.startValue, 13.3); // 10 + 2.6 + EG 0.5 + 0.2
});

test('Masters MAG rings: the WG strength-sequence (3 statics) rule does not apply', () => {
  const r = scoreRoutine('sr', 'masters', [s('a', 'A', 2), s('b', 'A', 2), s('c', 'A', 3), s('d', 'A', 2), s('e', 'A', 3), s('f', 'A', 2), s('g', 'A', 4)], {}, { decade: '30' });
  assert.ok(!r.items.some((it) => it.reason === 'sr'));
  assert.equal(r.rows.length, 7);
});

// ---- WG MAG newsletter rules -----------------------------------------------------------

test('Intermediate and Advanced count the dismount first, then the 7 best; Developmental the 6 highest', () => {
  const routine = [s('b1', 'B', 1), s('b2', 'B', 1), s('b3', 'B', 1), s('b4', 'B', 2), s('b5', 'B', 2), s('b6', 'B', 2), s('b7', 'B', 3), s('b8', 'B', 3), s('Dismount', 'A', 4)];
  for (const level of ['int', 'adv']) {
    const r = scoreRoutine('pb', level, routine);
    assert.equal(r.items[8].status, 'counting', level);
    assert.equal(r.items[7].reason, 'top', level);
    assert.equal(r.difficulty, 1.5, level); // A 0.1 + 7 x B 0.2
  }
  assert.equal(scoreRoutine('pb', 'dev', routine).items[8].status, 'noncounting');
  // Floor too (MAG-NL-1): the final salto counts even when it is the lowest.
  const fx = [s('f1', 'C', 1), s('f2', 'C', 2), s('f3', 'C', 3), s('f4', 'C', 4), s('f5', 'C', 1), s('f6', 'C', 2), s('f7', 'C', 3), s('f8', 'C', 4), s('Back tuck', 'A', 3)];
  assert.equal(scoreRoutine('fx', 'int', fx).items[8].status, 'counting');
});

test('Advanced floor: balance-or-jump list (outside the counting skills too) and start with a tumbling pass', () => {
  const jump = s('Forward jump full turn to push-up', 'A', 1, { skillId: 'WG-FX-I-115' });
  const acro = [s('Double back', 'D', 3, { skillId: 'WG-FX-III-3' }), s('Front tuck', 'A', 2), s('Back full', 'B', 4)];
  const startJump = scoreRoutine('fx', 'adv', [jump, ...acro]);
  assert.equal(startJump.detected.balance, jump.name);
  assert.equal(startJump.detected.tumbleStart, undefined);
  assert.equal(startJump.deductions, 0.3); // doesn't start with a tumbling pass
  const startAcro = scoreRoutine('fx', 'adv', [...acro, jump]);
  assert.equal(startAcro.deductions, 0);
  // Intermediate: neither requirement.
  assert.equal(scoreRoutine('fx', 'int', [jump, ...acro]).deductions, 0);
});

test('Advanced high bar: two flights per style (II.82 and II.83 are Kovacs style)', () => {
  const hb = [s('Kovacs piked', 'E', 2, { skillId: 'WG-HB-II-95' }), s('Tucked back salto ½ over bar', 'D', 2, { skillId: 'WG-HB-II-82' }), s('Kovacs', 'D', 2, { skillId: 'WG-HB-II-88' })];
  const adv = scoreRoutine('hb', 'adv', hb);
  assert.equal(adv.items[2].reason, 'style');
  assert.equal(adv.items[2].style, 'Kovacs');
  assert.equal(adv.items[1].status, 'counting');
  assert.ok(!scoreRoutine('hb', 'int', hb).items.some((it) => it.reason === 'style'));
});

test('Advanced high bar: a 5th flight counts when two flights are connected (C + C or better)', () => {
  const flights = ['f1', 'f2', 'f3', 'f4', 'f5'].map((n) => s(n, 'C', 2));
  assert.equal(scoreRoutine('hb', 'adv', flights).items.filter((it) => it.reason === 'eg').length, 1);
  const linked = [{ ...flights[0], link: true }, ...flights.slice(1)];
  assert.equal(scoreRoutine('hb', 'adv', linked).items.filter((it) => it.reason === 'eg').length, 0);
  assert.equal(scoreRoutine('hb', 'int', linked).items.filter((it) => it.reason === 'eg').length, 1);
});

// ---- Masters WAG -------------------------------------------------------------------

const ub = [
  w('Glide kip', 'A', 'WGW-UB-1.101-1'), w('Back hip circle', 'A', 'WGW-UB-2.105-1'), w('Back giant', 'B', 'WGW-UB-3.201-1'),
  w('Cast release full turn to HB', 'C', 'WGW-UB-2.303-1'), w('Cast handstand', 'A', 'WGW-UB-2.101-1'),
  w('Mill circle', 'ME', 'UCGM-wag-UB-mill-circle-fwd-or-bwd'), w('Flyaway', 'A', 'WGW-UB-6.104-1'),
];

test('Masters WAG bars: CR I-IV +0.5 each, dismount CR by level, 7 counting', () => {
  const r = scoreWagMasters('ub', ub, { decade: '30' });
  assert.deepEqual(r.sr, [true, true, true, true, true]);
  assert.deepEqual(r.crValues, [0.5, 0.5, 0.5, 0.5, 0.3]); // flyaway A in the 30s: 0.3
  assert.equal(r.difficulty, 1.8);
  assert.equal(r.shortBy, 0);
  assert.equal(r.sv, 14.1);
  assert.deepEqual(r.detectedSr[2].by, [1, 2]); // two different circles
  // The coach unticks CR I.
  assert.equal(scoreWagMasters('ub', ub, { decade: '30', crSet: [false] }).sv, 13.6);
});

test('Masters WAG bars from 60: CR I and II give +0.3 without the element', () => {
  const r = scoreWagMasters('ub', [ub[1], ub[2], ub[5], ub[4], w('Front hip circle', 'A', 'WGW-UB-2.104-1'), ub[6]], { decade: '60' });
  assert.deepEqual(r.sr, [false, false, true, true, true]);
  assert.deepEqual(r.crValues, [0.3, 0.3, 0.5, 0.5, 0.5]);
  assert.match(r.detectedSr[3].assumes, /turn/); // the giant's optional ½ turn
  assert.equal(r.sv, 15.1);
});

test('Masters WAG dismount CR: 0.0 / 0.3 / 0.5 by level and decade', () => {
  assert.equal(dismountCr('B', '30'), 0.5);
  assert.equal(dismountCr('A', '40'), 0.3);
  assert.equal(dismountCr('ME', '30'), 0);
  assert.equal(dismountCr('ME', '60'), 0.5);
  assert.equal(dismountCr('GE', '70'), 0.3);
});

const bb = [
  w('Leap mount', 'A', 'WGW-BB-1.101-1'), w('Split leap', 'A', 'WGW-BB-2.101-1', true), w('Wolf jump', 'A', 'WGW-BB-2.112-1'),
  w('Full turn', 'A', 'WGW-BB-3.101-1'), w('Back walkover', 'A', 'WGW-BB-4.109-1', true), w('Flic-flac', 'B', 'WGW-BB-5.202-1'),
  w('Front scale', 'A', 'WGW-BB-4.102-2'), w('Back tuck dismount', 'A', 'WGW-BB-6.104-1'),
];

test('Masters WAG beam: CRs, the beam bonus from 40, and the widening', () => {
  const r = scoreWagMasters('bb', bb, { decade: '40' });
  assert.deepEqual(r.sr, [true, true, true, true, true]);
  assert.equal(r.crTotal, 2.3);
  assert.equal(r.difficulty, 2.3); // dismount 0.3 + flic-flac 0.5 + 5 x A 0.3
  assert.equal(r.beamBonus, 0.5);
  assert.equal(r.sv, 15.1);
  assert.equal(scoreWagMasters('bb', bb, { decade: '40', widening: 'offered' }).sv, 15.1);
  assert.equal(scoreWagMasters('bb', bb, { decade: '40', widening: 'used' }).sv, 14.6);
  assert.equal(scoreWagMasters('bb', bb, { decade: '30' }).beamBonus, 0);
  assert.equal(scoreWagMasters('bb', bb, { decade: '70' }).beamBonus, 1.5);
});

test('Masters WAG beam from 60 without a widening (Table 2): a hold fills CR III', () => {
  const r = [w('Front scale', 'A', 'WGW-BB-4.102-2'), w('Full turn', 'A', 'WGW-BB-3.101-1'), w('Back tuck dismount', 'A', 'WGW-BB-6.104-1')];
  assert.equal(scoreWagMasters('bb', r, { decade: '60' }).sr[2], true);
  assert.equal(scoreWagMasters('bb', r, { decade: '60', widening: 'offered' }).sr[2], false);
  assert.equal(scoreWagMasters('bb', r, { decade: '50' }).sr[2], false);
});

test('Masters WAG floor: CRs from connected passes; the dismount is the last acro element', () => {
  const fx = [
    w('Split leap', 'A', 'WGW-FX-1.101-1', true), w('Wolf jump', 'A', 'WGW-FX-1.114-1'),
    w('Round-off', 'A', 'WGW-FX-3.106-1', true), w('Flic-flac', 'A', 'WGW-FX-3.107-1', true), w('Back tuck', 'A', 'WGW-FX-5.101-1'),
    w('Front tuck', 'A', 'WGW-FX-4.101-1'), w('Full turn', 'A', 'WGW-FX-2.101-1'),
  ];
  const r = scoreWagMasters('fx', fx, { decade: '30' });
  assert.equal(r.dismount, 5);
  assert.deepEqual(r.sr, [true, true, true, true, true]);
  assert.equal(r.sv, 13.7); // 10 + 7 x A 0.2 + CRs 2.3
  // From 60, an acro element connected to any element fills CR II.
  const pair = [w('Round-off', 'A', 'WGW-FX-3.106-1', true), w('Full turn', 'A', 'WGW-FX-2.101-1')];
  assert.equal(scoreWagMasters('fx', pair, { decade: '60' }).sr[1], true);
  assert.equal(scoreWagMasters('fx', pair, { decade: '50' }).sr[1], false);
});

test('Masters WAG: every Masters-only skill has CR tags reviewed (the mill circle is a circle, the crocodile a hold)', () => {
  assert.ok(TAGS['UCGM-wag-UB-mill-circle-fwd-or-bwd'].includes('circle'));
  assert.ok(TAGS['UCGM-wag-BB-crocodile-hold-2-sec-rogers'].includes('hold'));
  const src = JSON.parse(readFileSync(new URL('../tools/source/masters_wag_tags.json', import.meta.url), 'utf8')).tags;
  assert.deepEqual(MASTERS_WAG.filter((x) => !(x.id in src)).map((x) => x.id), []);
});
