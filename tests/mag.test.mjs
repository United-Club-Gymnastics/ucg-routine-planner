// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadDiscipline, findSkill } from '../js/skill-search.js';

// Skill lists load per discipline (as the app does before showing an athlete).
await Promise.all(['wag', 'mag', 'tt'].map(loadDiscipline));
import { scoreRoutine, scoreVault, scoreAthlete } from '../js/scoring/mag.js';
import { VAULTS } from '../js/data/mag-vaults.js';

const s = (name, letter, eg) => ({ name, letter, eg });

// Example routines from the "NAIGC Advanced (GymACT)" sheet of the MAG
// Routine Composition Planner.
const advFloor = [
  s('Front full', 'C', 4), s('Pike press', 'B', 1), s('Front tuck', 'A', 2), s('Dive roll', 'A', 2),
  s('Scale', 'A', 1), s('Round off', 'A', ''), s('Back layout', 'B', 3),
];
const advPommel = [
  s('Double scissor travel', 'C', 1), s('Back scissor', 'A', 1), s('Scissor', 'A', 1),
  s('Circle travel', 'B', 3), s('Circle', 'A', 2), s('Circle handstand', 'B', 4),
];
const advRings = [
  s('Archer butterfly', 'B', 2), s('Cross', 'C', 2), s('Kip to L', 'B', 3), s('Support swing handstand', 'B', 1),
  s('L', 'A', 2), s('Str. Fwd roll', 'B', 2), s('Dislocate', 'A', 1), s('Back full', 'B', 4),
];
const advPbars = [
  s('Front uprise', 'A', 1), s('Swing handstand', 'A', 2), s('Peach to support', 'B', 3), s('L-sit', 'A', 2),
  s('Sharpe', 'B', 2), s('Press', 'B', 2), s('Back half', 'B', 4),
];
const advHbar = [
  s('Varonin', 'B', 2), s('Kip cast handstand', 'A', 3), s('Front giant', 'A', 1), s('Pirouette', 'A', 1),
  s('Flying giant', 'B', 1), s('Back giant', 'A', 1), s('Layout flyaway', 'A', 4),
];

test('Advanced floor matches spreadsheet (12.6, 12.3 with the missing double flip)', () => {
  // The typed-in scale can't be checked against the WG balance list: the coach ticks it.
  const r = scoreRoutine('fx', 'adv', advFloor, { balance: true });
  assert.equal(r.difficulty, 1.1);
  assert.equal(r.egTotal, 1.5); // I 0.5, II A 0.3, III B 0.3, IV (floor) C 0.4
  assert.equal(r.startValue, 12.6);
  assert.equal(r.deductions, 0.3);
  assert.equal(r.afterDeductions, 12.3);
  assert.equal(scoreRoutine('fx', 'adv', advFloor, { dblFlip: true, balance: true }).deductions, 0);
  // Not ticked: the balance or jump requirement (MAG-NL-1) is missing too.
  assert.equal(scoreRoutine('fx', 'adv', advFloor).deductions, 0.6);
});

test('Advanced pommel: dismount group is worth the dismount value (12.3)', () => {
  const r = scoreRoutine('ph', 'adv', advPommel);
  assert.equal(r.egTotal, 1.3);
  assert.equal(r.startValue, 12.3);
});

test('Advanced rings matches spreadsheet (12.9)', () => {
  const r = scoreRoutine('sr', 'adv', advRings, { swingHs: true });
  assert.equal(r.egTotal, 1.4);
  assert.equal(r.afterDeductions, 12.9);
});

test('Advanced p-bars and high bar match spreadsheet (12.4, 12.1)', () => {
  assert.equal(scoreRoutine('pb', 'adv', advPbars).startValue, 12.4);
  assert.equal(scoreRoutine('hb', 'adv', advHbar).startValue, 12.1);
});

test('Intermediate floor matches spreadsheet (12.8)', () => {
  const r = scoreRoutine('fx', 'int', [
    s('back layout 1/2', 'B', 3), s('front layout', 'B', 2), s('Dive roll', 'A', ''), s('Split', 'A', 1),
    s('V-sit', 'B', 1), s('standing scale 180', 'B', 1), s('roundoff', 'A', ''), s('back layout', 'B', 3),
  ]);
  assert.equal(r.difficulty, 1.3);
  assert.equal(r.egTotal, 1.5);
  assert.equal(r.startValue, 12.8);
});

test('Intermediate: A earns 0.3 and B or higher 0.5 in groups II-IV', () => {
  const r = scoreRoutine('ph', 'int', [s('a', 'A', 1), s('b', 'A', 2), s('c', 'B', 3), s('d', 'A', 4)]);
  assert.equal(r.egTotal, 1.6);
});

test('Developmental floor matches spreadsheet (11.6)', () => {
  const r = scoreRoutine('fx', 'dev', [
    s('Dive roll', 'A', 2), s('Press headstand', 'A', ''), s('L-sit', 'A', ''),
    s('Cartwheel', 'A', ''), s('Scale', 'A', 1), s('Front tuck', 'A', 2),
  ]);
  assert.equal(r.egTotal, 1.0);
  assert.equal(r.startValue, 11.6);
});

test('Developmental: only 3 groups count, 6 skills max, cap 12.3', () => {
  const r = scoreRoutine('hb', 'dev', [
    s('a', 'C', 1), s('b', 'C', 2), s('c', 'C', 3), s('d', 'C', 4), s('e', 'C', 1), s('f', 'C', 2), s('g', 'C', 3),
  ]);
  assert.equal(r.rows.length, 6);
  assert.equal(r.items[6].status, 'noncounting');
  assert.equal(r.egTotal, 1.5);
  assert.equal(r.raw, 13.3);
  assert.ok(r.capped);
  assert.equal(r.startValue, 12.3);
});

test('Intermediate cap is 13.1, applied before the short routine deduction', () => {
  const five = [s('a', 'E', 1), s('b', 'E', 2), s('c', 'E', 3), s('d', 'E', 4), s('e', 'E', 1)];
  const r = scoreRoutine('pb', 'int', five);
  assert.equal(r.raw, 14.5);
  assert.equal(r.startValue, 12.1); // 13.1 cap - 1.0 short
});

test('short routine: Developmental loses 0.5 per skill, others 1.0', () => {
  const four = [s('a', 'A', 1), s('b', 'A', 2), s('c', 'A', 3), s('d', 'A', 4)];
  assert.equal(scoreRoutine('pb', 'dev', four).shortDeduction, 1.0);
  assert.equal(scoreRoutine('pb', 'int', four).shortDeduction, 2.0);
});

test('at most 4 counting skills per element group', () => {
  const r = scoreRoutine('pb', 'adv', [
    s('a', 'C', 2), s('b', 'C', 2), s('c', 'C', 2), s('d', 'C', 2), s('e', 'B', 2), s('f', 'A', 1),
  ]);
  assert.equal(r.items[4].status, 'noncounting');
  assert.equal(r.items[4].reason, 'eg');
  assert.equal(r.difficulty, 1.3);
});

test('repeats do not count', () => {
  const r = scoreRoutine('hb', 'int', [s('Back giant', 'A', 1), s('back-giant', 'A', 1)]);
  assert.equal(r.items[1].status, 'repeat');
  assert.equal(r.difficulty, 0.1);
});

test('bonuses: rings strength +0.3, floor and high bar connections; no stick bonus', () => {
  assert.equal(scoreRoutine('sr', 'int', advRings, { strength: true }).bonus, 0.3);
  assert.equal(scoreRoutine('hb', 'int', advHbar, { stick: true }).bonus, 0);
});

test('connection bonuses come from linked skills (typed-in counts are ignored)', () => {
  const L = (x) => ({ ...x, link: true });
  // Floor: D + C (+0.1), then D + D (+0.2); an unlinked D + B earns nothing.
  const fx = scoreRoutine('fx', 'adv', [L(s('Double back', 'D', 3)), s('Front full', 'C', 4), L(s('Arabian double', 'D', 3)), s('Double front', 'D', 4), s('Back full', 'B', 3)], { conn1: 5 });
  assert.equal(fx.optionValues.conn1, 0.1);
  assert.equal(fx.optionValues.conn2, 0.2);
  assert.match(fx.detected.conn1, /Double back \+ Front full/);
  // High bar: flight to flight and in bar to flight count; in bar to in bar doesn't.
  const hb = scoreRoutine('hb', 'adv', [L(s('Kovacs', 'D', 2)), s('Gaylord', 'D', 2), L(s('Stalder 1/1', 'C', 3)), s('Tkatchev', 'C', 2), L(s('Endo', 'C', 3)), s('Stalder', 'C', 3)]);
  assert.equal(hb.optionValues.connCC, 0.2);
  // The same pair twice counts once.
  const twice = scoreRoutine('hb', 'adv', [L(s('Tkatchev', 'C', 2)), s('Kovacs', 'D', 2), L(s('Tkatchev', 'C', 2)), s('Kovacs', 'D', 2)]);
  assert.equal(twice.optionValues.connCC, 0.1);
});

test('rings: only 3 EG II/III skills count before a B or higher EG I skill', () => {
  const r = scoreRoutine('sr', 'int', [
    s('L', 'A', 2), s('Cross', 'C', 2), s('Kip to L', 'B', 3), s('Back lever', 'B', 2),
    s('Swing handstand', 'B', 1), s('Planche', 'D', 2), s('Dislocate', 'A', 1),
  ]);
  assert.equal(r.items[3].status, 'noncounting');
  assert.equal(r.items[3].reason, 'sr');
  assert.equal(r.items[5].status, 'counting'); // after the B EG I skill
  const a = scoreRoutine('sr', 'int', [s('a', 'A', 2), s('b', 'A', 3), s('c', 'A', 2), s('d', 'A', 1), s('e', 'A', 2)]);
  assert.equal(a.items[4].reason, 'sr'); // an A EG I skill doesn't reset the count
});

test('Sub-A skills count as skills worth 0.0', () => {
  const r = scoreRoutine('sr', 'int', [s('Basket pull up to L', 'Sub-A', ''), s('a', 'A', 1), s('b', 'A', 2), s('c', 'A', 3), s('d', 'A', 4), s('e', 'B', 1)]);
  assert.equal(r.rows.length, 6);
  assert.equal(r.shortBy, 0);
  assert.equal(r.difficulty, 0.6);
});

test('mushroom bonus counts toward the Developmental cap', () => {
  const r = scoreRoutine('ph', 'dev', advPommel, { mushroom: 1.0 });
  assert.equal(r.bonus, 1.0);
  assert.equal(r.startValue, 12.3);
});

test('vault: WG 2025-2028 values; Advanced uses GymACT values; Developmental bans flipping vaults', () => {
  assert.equal(scoreVault('adv', '202').startValue, 11.4);
  assert.equal(scoreVault('adv', '107').startValue, 13.0); // Cuervo piked: 2.8 WG, 3.0 GymACT 2027
  assert.equal(scoreVault('int', '107').startValue, 12.8);
  assert.equal(scoreVault('int', '405').startValue, 13.1); // Yurchenko str. 1/1: 3.6 in 2025-2028, capped
  assert.equal(scoreVault('adv', '405').startValue, 13.6);
  assert.equal(scoreVault('dev', '107').startValue, 0);
  assert.ok(scoreVault('dev', '107').banned);
  assert.equal(scoreVault('dev', 'UCG-VT-tuck-vault').startValue, 10.2);
  assert.ok(scoreVault('dev', 'UCG-VT-hecht-backflip').banned);
});

// tools/build_skills.py looks WG vaults up by number in ADV_VAULT / NON_FLIPPING. If the
// extractor's number type changes again (int -> string in schema v0.1), every WG vault would
// silently become flipping with adv = value; this pins the full tables.
test('WG vaults: exactly the no-salto vaults are non-flipping, and the GymACT values apply', () => {
  const wg = VAULTS.filter((v) => v.src === 'WG');
  const nonFlipping = ['201', '202', '203', '204', '205', '206', '301', '302', '303', '501', '502', '503', '513', '514', '515'];
  assert.deepEqual(wg.filter((v) => !v.flipping).map((v) => v.id).sort(), nonFlipping);
  // GymACT 2027: WG + 0.2 for the front handspring and round-off ½-on saltos (228 too, by Nate's ruling).
  const adv = { 101: 2.6, 107: 3.0, 108: 3.4, 109: 3.8, 113: 3.8, 114: 4.2, 115: 4.6, 116: 5.0, 117: 5.4, 118: 5.8,
    207: 2.2, 213: 2.6, 219: 3.4, 225: 5.0, 226: 5.4, 228: 5.4, 231: 5.4, 232: 5.8,
    413: 2.8, 414: 3.2, 415: 4.0, 416: 4.4, 417: 4.8, 419: 5.2, 420: 5.6, 516: 2.4, 517: 2.8, 518: 3.6 };
  assert.deepEqual(Object.fromEntries(wg.filter((v) => v.adv !== v.value).map((v) => [v.id, v.adv])),
    adv);
  assert.equal(scoreVault('dev', '201').banned, false); // front handspring is allowed at Developmental
  assert.equal(scoreVault('dev', '201').startValue, 11.2);
});

test('Masters MAG: the dismount group is worth the dismount value, max 0.5 (not on floor)', () => {
  const r = scoreRoutine('hb', 'masters', [s('a', 'A', 1), s('b', 'A', 2), s('c', 'A', 3), s('d', 'A', 1), s('e', 'A', 2), s('dis', 'D', 4)], {}, { decade: 70 });
  assert.equal(r.egBonus[4], 0.5); // D in the 70s is 1.2, capped
});

test('Masters rings: no limit on EG II/III elements in a row (policy waives WG 12.2.2.3)', () => {
  const st = [s('a', 'A', 2), s('b', 'A', 3), s('c', 'A', 2), s('d', 'A', 3), s('e', 'A', 2), s('f', 'A', 4)];
  assert.ok(scoreRoutine('sr', 'masters', st, {}, { decade: 30 }).items.every((it) => it.reason !== 'sr'));
  assert.ok(scoreRoutine('sr', 'int', st).items.some((it) => it.reason === 'sr'));
});

// Nate 2026-10-20: the Rules Breakdown bans round-off-entry vaults at Developmental too.
test('Developmental bans round-off-entry vaults, flipping or not', () => {
  for (const id of ['501', '503', '513', '515', '401']) assert.ok(scoreVault('dev', id).banned, id);
  for (const id of ['201', '206', '301', '303']) assert.equal(scoreVault('dev', id).banned, false, id);
  assert.equal(scoreVault('int', '501').banned, false);
});

// Nate 2026-10-20: Masters offers WG vaults and the Masters CoP vaults, never the UCG MAG CoP's own.
test('Masters MAG: no UCG MAG CoP vaults; WG and Masters vaults stay', () => {
  assert.equal(scoreVault('masters', 'UCG-VT-tuck-vault', { decade: 30 }), null);
  assert.equal(scoreVault('masters', '201', { decade: 30 }).startValue, 12.0);
  assert.ok(scoreVault('masters', 'UCGM-mag-pike-hecht-over-table', { decade: 30 }));
  assert.equal(scoreVault('int', 'UCG-VT-tuck-vault').startValue, 10.2);
});

test('all-around adds vault and the five events', () => {
  const aa = scoreAthlete({
    level: 'adv',
    vault: '202',
    routines: { fx: advFloor, ph: advPommel, sr: advRings, pb: advPbars, hb: advHbar },
  }).allAround;
  assert.equal(aa, 73.7); // the spreadsheet's 73.4 also takes off the floor neutral deduction
});

test('blank rows are ignored; empty routine scores 0', () => {
  assert.equal(scoreRoutine('fx', 'int', [s('', '', '')]).startValue, 0);
});

test('Masters: values by age decade, EG bonus by level, dismount EG = dismount value', () => {
  const r = scoreRoutine('pb', 'masters', [
    s('a', 'ME', 1), s('b', 'A', 2), s('c', 'B', 3), s('d', 'A', 2), s('e', 'ME', 1), s('g', 'ME', 3), s('f', 'A', 4),
  ], {}, { decade: '50' });
  // 50s: ME 0.2, A 0.4, B 0.6
  assert.equal(r.difficulty, 2.4);
  assert.equal(r.egTotal, 1.9); // ME, A and B all earn 0.5 in the 50s (x 3) + dismount A 0.4
  assert.equal(r.startValue, 14.3);
});

test('Masters: GE skills count from the 50s; not in the 30s (an old "Misc" row reads as GE)', () => {
  const six = [s('a', 'GE', 1), s('b', 'GE', 2), s('c', 'Misc', 3), s('d', 'GE', 1), s('e', 'GE', 2), s('f', 'GE', 4)];
  assert.equal(scoreRoutine('hb', 'masters', six, {}, { decade: '60' }).shortBy, 0); // 6 from 60
  assert.equal(scoreRoutine('hb', 'masters', six, {}, { decade: '60' }).difficulty, 0.6); // GE 0.1 each
  assert.equal(scoreRoutine('hb', 'masters', six, {}, { decade: '50' }).shortBy, 1); // 7 in the 50s
  const r30 = scoreRoutine('hb', 'masters', six, {}, { decade: '30' });
  assert.equal(r30.shortBy, 7);
  assert.equal(r30.egTotal, 0);
});

test('Masters vault: WG value plus the age bonus', () => {
  assert.equal(scoreVault('masters', '202', { decade: '40' }).startValue, 13.0); // 10 + 1.4 + 1.6
  assert.equal(scoreVault('masters', 'other', { decade: '70' }).startValue, 13.2);
  assert.equal(scoreVault('masters', 'UCGM-mag-straight-hecht-over-table', { decade: '50' }).startValue, 14.0); // 10 + 1.6 (box value) + 2.4
});

test('Advanced rings: a listed swing to handstand (I.75, I.81, I.86-88) meets the requirement', () => {
  const sk = (name, letter, eg, skillId) => ({ name, letter, eg, skillId });
  const base = [sk('Kip', 'A', 1), sk('L-sit', 'A', 2), sk('Shoulder stand', 'A', 1), sk('Back lever', 'B', 2), sk('Inlocate', 'A', 1), sk('Dislocate', 'A', 1)];
  assert.equal(scoreRoutine('sr', 'adv', base).deductions, 0.3);
  const r = scoreRoutine('sr', 'adv', [...base, sk('From support swing bwd. to handstand (2 s.).', 'B', 1, 'WG-SR-I-86')]);
  assert.equal(r.deductions, 0);
  assert.equal(r.detected.swingHs, 'From support swing bwd. to handstand (2 s.).');
  // Not a listed one, and not ticked by hand: still missing.
  assert.equal(scoreRoutine('sr', 'adv', [...base, sk('Uprise bwd. str. through handstand.', 'B', 1, 'WG-SR-I-32')]).deductions, 0.3);
  assert.equal(scoreRoutine('sr', 'adv', base, { swingHs: true }).deductions, 0);
});

test('Advanced floor: double flip and double flipping dismount are detected from the routine', () => {
  const sk = (name, letter, eg, skillId) => ({ name, letter, eg, skillId });
  const kolyvanov = sk('Salto bwd. str. with 2/1 t and salto bwd piked.', 'F', 3, 'WG-FX-III-36');
  const routine = [sk('Front tuck', 'A', 2), sk('Back tuck', 'A', 3), sk('Full twist', 'B', 4), sk('Scale', 'A', 1), sk('Back handspring', 'A', 3), sk('L-sit', 'A', 1)];
  // A double in the middle meets the requirement but isn't the dismount.
  const mid = scoreRoutine('fx', 'adv', [kolyvanov, ...routine], { balance: true });
  assert.equal(mid.deductions, 0);
  assert.equal(mid.detected.dblFlip, kolyvanov.name);
  assert.equal(mid.detected.dblDismount, undefined);
  assert.equal(mid.optionValues.dblDismount, 0);
  // The last skill is a double: +0.1. Anything after it (even a non-acrobatic skill) means it isn't the dismount.
  const end = scoreRoutine('fx', 'adv', [...routine.slice(0, 5), kolyvanov]);
  assert.equal(end.detected.dblDismount, kolyvanov.name);
  assert.equal(end.optionValues.dblDismount, 0.1);
  assert.equal(scoreRoutine('fx', 'adv', [...routine.slice(0, 5), kolyvanov, sk('L-sit', 'A', 1)]).detected.dblDismount, undefined);
  // Typed in by hand: go by the name.
  assert.equal(scoreRoutine('fx', 'adv', [...routine, sk('Double back', 'C', 3)]).optionValues.dblDismount, 0.1);
  assert.equal(scoreRoutine('fx', 'adv', [...routine, sk('Back layout', 'A', 3)], { balance: true }).deductions, 0.3);
});

test('Skill search: synonyms, any word order, compound words, plain skill first', async () => {
  const { searchSkills } = await import('../js/skill-search.js');
  const first = (d, app, q) => searchSkills(d, app, q)[0]?.name;
  const top = (d, app, q, n) => searchSkills(d, app, q).slice(0, n).map((s) => s.id);
  for (const q of ['back tuck', 'tuck back']) assert.equal(top('mag', 'fx', q, 1)[0], 'WG-FX-III-1'); // back salto tucked or piked
  for (const q of ['front layout', 'forward straight', 'fwd stretched']) assert.ok(top('mag', 'fx', q, 2).includes('WG-FX-II-14'), q);
  assert.equal(first('mag', 'fx', 'double back'), 'Double back tuck');
  for (const q of ['round off', 'roundoff', 'round-off']) assert.equal(first('tt', 'tu', q), 'Roundoff');
  for (const q of ['flip flop', 'bhs', 'back handspring']) assert.equal(first('tt', 'tu', q), 'Back handspring');
});

test('Catalog: box numbers, other names, Masters lists', async () => {
  const { searchSkills, magSkillAllowed, findSkill } = await import('../js/skill-search.js');
  const ids = (d, app, q) => searchSkills(d, app, q).map((s) => s.id);
  assert.equal(findSkill('WG-SR-I-75').box, 'WG I.75');
  assert.equal(findSkill('USAG-BB-7.104-1b').box, 'Xcel 7.104');
  assert.equal(findSkill('UCG-FX-pancake-stop-required').box, 'UCG FX 5'); // after the 4 Sub-A boxes (CoP Sub-A review, 2026-10)
  assert.ok(ids('mag', 'sr', 'I.75').includes('WG-SR-I-75'));
  assert.ok(ids('wag', 'bb', '7.104').includes('USAG-BB-7.104-1a'));
  // Other names coaches use find the skill, and it comes first.
  assert.equal(searchSkills('mag', 'pb', 'peach basket')[0].id, 'WG-PB-III-116'); // Felge to support
  assert.match(searchSkills('wag', 'ub', 'free hip')[0].label, /^Clear hip/);
  assert.equal(searchSkills('wag', 'ub', 'toe front')[0].id, 'USAG-UB-8.301-1'); // HB underswing front salto
  // MAG Masters offers WG + the UCG Masters list, not the main UCG additions (and the reverse below Masters).
  const at = (level) => searchSkills('mag', 'fx', '').filter((s) => magSkillAllowed(level, s));
  assert.ok(at('masters').some((s) => s.src === 'UCGM') && !at('masters').some((s) => s.src === 'UCG'));
  assert.ok(at('adv').some((s) => s.src === 'UCG') && !at('adv').some((s) => s.src === 'UCGM'));
  // Routines saved with a UCG addition at Masters still resolve.
  assert.ok(findSkill('UCG-FX-pancake-stop-required'));
});

test('HB search: "back tuck" is not a half turn; one-letter typos in names are forgiven', async () => {
  const { searchSkills } = await import('../js/skill-search.js');
  const ids = (q) => searchSkills('mag', 'hb', q).map((s) => s.id);
  assert.ok(ids('back tuck').includes('WG-HB-IV-50')); // over-bar tucked double back
  assert.ok(ids('half turn handstand').includes('WG-HB-I-19'));
  assert.ok(!ids('back tuck').includes('WG-HB-I-19'));
  // The WG Voronin (eponym) and the UCG "Voronin from kip-cast" (named for it) both survive the typo.
  assert.ok(ids('varonin').includes('WG-HB-II-26'));
  assert.ok(ids('varonin').includes('UCG-HB-voronin-from-kip-cast'));
});

test('retired UCG skill ids open on the skill they were merged into (PB 16 -> PB 15)', () => {
  assert.equal(findSkill('UCG-PB-backward-roll-to-l-with-straight-body')?.id, 'UCG-PB-bwd-roll-from-upper-arm-to-support');
  assert.equal(findSkill('UCGM-mag-PB-backward-roll-to-l-with-straight-body')?.id, 'UCGM-mag-PB-bwd-roll-from-upper-arm-to-support');
});

test('redirect hook (MAG and WAG loaders): only a missing id is mapped, and only to a skill that exists', async () => {
  const { applyRedirects } = await import('../js/skill-search.js');
  const beam = { id: 'UCGW-BB-6' }, kept = { id: 'UCGW-BB-2' };
  const index = new Map([['UCGW-BB-6', beam], ['UCGW-BB-2', kept]]);
  applyRedirects({ 'UCGW-BB-5': 'UCGW-BB-6', 'UCGW-BB-2': 'UCGW-BB-6', 'UCGW-BB-9': 'UCGW-BB-404' }, index);
  assert.equal(index.get('UCGW-BB-5'), beam); // retired id -> replacement
  assert.equal(index.get('UCGW-BB-2'), kept); // an id still in the list is never redirected
  assert.ok(!index.has('UCGW-BB-9')); // no replacement, no redirect
  const { REDIRECTS } = await import('../js/data/wag-redirects.js');
  assert.equal(typeof REDIRECTS, 'object'); // generated from the bundle (empty while no WAG id is retired)
});

// MAG-NL-1: an Advanced floor routine must open with an acro element (−0.3 otherwise). The round-off
// has no element group but is one.
test('Advanced floor: a routine opening with a round-off starts with a tumbling pass', () => {
  const pass = [
    { name: 'Round-off', letter: 'A', eg: '', skillId: 'UCG-FX-round-off-stuck-rebound-or-connected-to-other-acro' },
    { name: 'Back handspring', letter: 'A', eg: 3, skillId: 'WG-FX-III-2' },
    { name: 'Double back tuck', letter: 'C', eg: 3, skillId: 'WG-FX-III-3' },
  ];
  const tumbles = (skills) => !!scoreRoutine('fx', 'adv', skills).detected.tumbleStart;
  assert.equal(tumbles(pass), true);
  assert.equal(tumbles([{ name: 'Round off', letter: 'A', eg: '' }, ...pass.slice(1)]), true); // typed in
  assert.equal(tumbles([{ name: 'L-sit (2 s.)', letter: 'A', eg: '', skillId: 'UCG-FX-l-sit-2-s' }, ...pass]), false);
  assert.equal(tumbles([{ name: 'Cartwheel', letter: 'Sub-A', eg: '', skillId: 'UCG-FX-cartwheel' }, ...pass]), false);
});

// WG pommel horse 2.c.4 (Nate, 2026-11-02): handstand elements are listed at each value they can earn,
// one form per value; form a keeps the bare ID.
test('pommel horse handstand elements: one skill per upgraded value', async () => {
  await loadDiscipline('mag');
  const v = (id) => findSkill(id)?.value;
  assert.deepEqual(['WG-PH-IV-20a', 'WG-PH-IV-20b'].map(v), ['B', 'C']);
  assert.equal(findSkill('WG-PH-IV-20c'), null); // with both, it is IV.4 (D)
  assert.equal(findSkill('WG-PH-IV-20').id, 'WG-PH-IV-20a'); // saved routines
  assert.deepEqual(['WG-PH-IV-21a', 'WG-PH-IV-21b', 'WG-PH-IV-21c'].map(v), ['C', 'D', 'E']);
  assert.deepEqual(['WG-PH-II-51a', 'WG-PH-II-51b', 'WG-PH-II-51c'].map(v), ['C', 'D', 'E']);
  const ucg = 'UCG-PH-half-spindle-to-handstand-dismount-from-over-the-handles';
  assert.deepEqual([`${ucg}-a`, `${ucg}-b`, `${ucg}-c`].map(v), ['D', 'E', 'F']);
  assert.equal(findSkill(ucg).id, `${ucg}-a`);
  // Masters: an upgrade above D counts as D+.
  const dismount = (id) => scoreRoutine('ph', 'masters', [{ name: findSkill(id).label, letter: v(id), eg: 4, skillId: id }], {}, { decade: 40 }).rows[0].value;
  assert.equal(dismount(`${ucg}-c`), dismount(`${ucg}-a`));
});

// Nate 2026-11-09: at most 4 counting skills per element group at every level, Developmental too.
// A skill with no element group (Sub-A, or none) never counts toward the 4 and is never cut by it.
test('4 per element group at Developmental; skills with no group are outside the limit', () => {
  const r = scoreRoutine('pb', 'dev', [
    s('One', 'C', 1), s('Two', 'C', 1), s('Three', 'B', 1), s('Four', 'B', 1), s('Five', 'D', 1),
    s('Sub one', 'Sub-A', null), s('No group', 'A', null),
  ]);
  const st = (n) => r.items.find((it) => it.name === n);
  assert.equal(r.rows.filter((x) => x.eg === 1).length, 4);
  assert.equal(st('Four').status, 'noncounting'); // the lowest EG I skill, the latest on a tie
  assert.equal(st('Four').reason, 'eg');
  assert.equal(st('Sub one').status, 'counting');
  assert.equal(st('No group').status, 'counting');
  assert.equal(r.rows.length, 6);
  for (const level of ['int', 'adv']) {
    const many = scoreRoutine('pb', level, [s('a', 'A', null), s('b', 'A', null), s('c', 'A', null), s('d', 'A', null), s('e', 'A', null), s('f', 'Sub-A', null), s('g', 'B', 4)]);
    assert.equal(many.rows.length, 7, level);
  }
});
