// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadDiscipline } from '../js/skill-search.js';

// Skill lists load per discipline (as the app does before showing an athlete).
await Promise.all(['wag', 'mag', 'tt'].map(loadDiscipline));
import { scoreRoutine, scoreVault, scoreAthlete } from '../js/scoring/mag.js';

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
  const r = scoreRoutine('fx', 'adv', advFloor);
  assert.equal(r.difficulty, 1.1);
  assert.equal(r.egTotal, 1.5); // I 0.5, II A 0.3, III B 0.3, IV (floor) C 0.4
  assert.equal(r.startValue, 12.6);
  assert.equal(r.deductions, 0.3);
  assert.equal(r.afterDeductions, 12.3);
  assert.equal(scoreRoutine('fx', 'adv', advFloor, { dblFlip: true }).deductions, 0);
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
  assert.equal(scoreVault('adv', '107').startValue, 13.6); // Cuervo piked: 2.8 WG, 3.6 GymACT
  assert.equal(scoreVault('int', '107').startValue, 12.8);
  assert.equal(scoreVault('int', '405').startValue, 13.1); // Yurchenko str. 1/1: 3.6 in 2025-2028, capped
  assert.equal(scoreVault('adv', '405').startValue, 13.6);
  assert.equal(scoreVault('dev', '107').startValue, 0);
  assert.ok(scoreVault('dev', '107').banned);
  assert.equal(scoreVault('dev', 'UCG-VT-tuck-vault').startValue, 10.2);
  assert.ok(scoreVault('dev', 'UCG-VT-hecht-backflip').banned);
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

test('Masters: values by age decade, EG I-III +0.5, dismount EG = dismount value', () => {
  const r = scoreRoutine('pb', 'masters', [
    s('a', 'ME', 1), s('b', 'A', 2), s('c', 'B', 3), s('d', 'A', 2), s('e', 'ME', 1), s('f', 'A', 4),
  ], {}, { decade: '50' });
  // 50s: ME 0.2, A 0.4, B 0.6
  assert.equal(r.difficulty, 2.2);
  assert.equal(r.egTotal, 1.9); // 0.5 x 3 + dismount A 0.4
  assert.equal(r.startValue, 14.1);
});

test('Masters: Misc skills count from the 50s; not in the 30s', () => {
  const six = [s('a', 'Misc', 1), s('b', 'Misc', 2), s('c', 'Misc', 3), s('d', 'Misc', 1), s('e', 'Misc', 2), s('f', 'Misc', 3)];
  assert.equal(scoreRoutine('hb', 'masters', six, {}, { decade: '60' }).shortBy, 0);
  const r30 = scoreRoutine('hb', 'masters', six, {}, { decade: '30' });
  assert.equal(r30.shortBy, 6);
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
  const mid = scoreRoutine('fx', 'adv', [kolyvanov, ...routine]);
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
  assert.equal(scoreRoutine('fx', 'adv', [...routine, sk('Back layout', 'A', 3)]).deductions, 0.3);
});

test('Skill search: synonyms, any word order, compound words, plain skill first', async () => {
  const { searchSkills } = await import('../js/skill-search.js');
  const first = (d, app, q) => searchSkills(d, app, q)[0]?.name;
  assert.equal(first('mag', 'fx', 'back tuck'), 'Salto backwards tucked or piked.');
  assert.equal(first('mag', 'fx', 'tuck back'), 'Salto backwards tucked or piked.');
  for (const q of ['front layout', 'forward straight', 'fwd stretched']) assert.equal(first('mag', 'fx', q), 'Salto fwd. straight, also with ½ t.');
  assert.equal(first('mag', 'fx', 'double back'), 'Double salto bwd. tucked.');
  for (const q of ['round off', 'roundoff', 'round-off']) assert.equal(first('tt', 'tu', q), 'Roundoff');
  for (const q of ['flip flop', 'bhs', 'back handspring']) assert.equal(first('tt', 'tu', q), 'Back handspring');
});

test('Catalog: box numbers, other names, Masters lists', async () => {
  const { searchSkills, magSkillAllowed, findSkill } = await import('../js/skill-search.js');
  const ids = (d, app, q) => searchSkills(d, app, q).map((s) => s.id);
  assert.equal(findSkill('WG-SR-I-75').box, 'WG I.75');
  assert.equal(findSkill('USAG-BB-7.104-1b').box, 'Xcel 7.104');
  assert.equal(findSkill('UCG-FX-pancake-stop-required').box, 'UCG FX 1');
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

test('WG shorthand: "t." is tucked unless it follows a fraction; one-letter typos in names are forgiven', async () => {
  const { searchSkills } = await import('../js/skill-search.js');
  const names = (q) => searchSkills('mag', 'hb', q).map((s) => s.name);
  assert.ok(names('back tuck').includes('Double salto bwd. t. over the bar.'));
  assert.ok(names('half turn handstand').includes('½ t. thr. hdst.'));
  assert.ok(!names('back tuck').includes('½ t. thr. hdst.'));
  assert.equal(searchSkills('mag', 'hb', 'varonin')[0]?.eponym, 'Voronin');
});
