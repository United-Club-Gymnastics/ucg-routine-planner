// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreInfinity, scoreInfinityVault, scoreXcel, scoreXcelVault, scoreWagMasters, scoreWagMastersVault } from '../js/scoring/wag.js';
import { scoreTramp, scorePasses, quarterSomersaults } from '../js/scoring/tt.js';
import { newEntry, scoreEntry, copyRoutines } from '../js/model.js';

const s = (name, letter, eg) => ({ name, letter, eg });
const t = (name, dd, notation = '') => ({ name, dd, notation });

// ---- UCG Infinity (same examples as Julia's planner) ----
const bars = [
  s('Peach salto', 'B', 6), s('Cast Pike Vault 1/2 (Sharpe)', 'C', 2), s('Cast Handstand', 'B', 2),
  s('Toe Catch', 'C', 1), s('Hop change', 'C', 2), s('Front giant', 'C', 5), s('Kip', 'A', 1), s('Butt Bounce', 'B', 8),
];
test('Infinity bars matches the spreadsheet (14.2), 14.5 with the apparatus bonus', () => {
  assert.equal(scoreInfinity('ub', bars).sv, 14.2);
  assert.equal(scoreInfinity('ub', bars, { eventBonus: true }).sv, 14.5);
});
test('Infinity vault: Tsuk Tuck is 14.8', () => {
  assert.equal(scoreInfinityVault('Tsuk Tuck').sv, 14.8);
});

// ---- Xcel ----
test('Xcel Gold: 6 A value parts + all SRs = 10.0; missing SR and VP come off', () => {
  const six = [s('a', 'A'), s('b', 'A'), s('c', 'B'), s('d', 'A'), s('e', 'A'), s('f', 'A')];
  assert.equal(scoreXcel('gold', 'ub', six, { srMet: [true, true, true, true] }).sv, 10.0);
  const r = scoreXcel('gold', 'ub', six.slice(0, 4), { srMet: [true, false, true, true] });
  assert.equal(r.sv, 9.3); // -0.5 SR, -0.2 for two missing A
});
test('Xcel restricted skills: -0.50 and no VP credit; Diamond allows one D', () => {
  const r = scoreXcel('gold', 'bb', [s('a', 'C'), s('b', 'A'), s('c', 'A'), s('d', 'A'), s('e', 'A'), s('f', 'A'), s('g', 'A')], { srMet: [1, 1, 1, 1] });
  assert.equal(r.items[0].status, 'restricted');
  assert.equal(r.sv, 9.5);
  const d = scoreXcel('diamond', 'fx', [s('a', 'D'), s('b', 'D'), s('c', 'B'), s('d', 'A'), s('e', 'A'), s('f', 'A'), s('g', 'A'), s('h', 'A')], { srMet: [1, 1, 1, 1] });
  assert.equal(d.items[1].status, 'restricted');
  assert.equal(d.sv, 9.5);
});
test('Xcel Sapphire starts at 9.6 plus up to 0.4 bonus', () => {
  const r = scoreXcel('sapphire', 'fx', [s('a', 'C'), s('b', 'B'), s('c', 'B'), s('d', 'B'), s('e', 'A'), s('f', 'A'), s('g', 'A')], { srMet: [1, 1, 1, 1], bonus: 0.3 });
  assert.equal(r.sv, 9.9);
});
test('Xcel vaults by level; Gold alternative springboard is 9.5', () => {
  assert.equal(scoreXcelVault('gold', '1.201').sv, 10.0);
  assert.equal(scoreXcelVault('gold', '1.201', { altBoard: true }).sv, 9.5);
  assert.equal(scoreXcelVault('plat', '4.101').sv, 9.8);
  assert.equal(scoreXcelVault('plat', '1.202'), null); // not allowed at Platinum
  assert.equal(scoreXcelVault('sapphire', 'l9l10').sv, 10.0);
  assert.equal(scoreXcelVault('sapphire', 'L910-1.402').sv, 10.0); // Level 9/10 vault not in the Sapphire chart
  assert.equal(scoreXcelVault('diamond', 'L910-1.402'), null);
});

// ---- WAG Masters ----
test('WAG Masters: decade values, EG +0.5 from any skill, 6 count', () => {
  const r = scoreWagMasters('bb', [s('a', 'A', 1), s('b', 'B', 2), s('c', 'A', 3), s('d', 'ME', 1), s('e', 'A', 4), s('f', 'Misc', 3), s('g', 'B', 3)], { decade: '40' });
  // 40s: A 0.3, B 0.5, ME 0.1, Misc n/a (0). Top 6: B B A A A ME = 2.0
  assert.equal(r.difficulty, 2.0);
  assert.equal(r.egTotal, 2.0);
  assert.equal(r.shortBy, 0);
  assert.equal(r.sv, 14.0);
  assert.equal(scoreWagMastersVault('1.11', { decade: '60' }).sv, 16.6); // Yamashita 1/2: 10 + 2.4 + 4.2
  assert.equal(scoreWagMastersVault('UCGM-wag-pike-hecht-over-table', { decade: '30' }).sv, 12.9); // 10 + 1.1 + 1.8
  assert.equal(scoreWagMastersVault('other', { decade: '70' }).sv, 15.0);
  assert.equal(scoreWagMastersVault('UCGM-wag-forward-headspring', { decade: '50' }).sv, 14.2); // 10 + 0.8 + 3.4
});

// ---- T&T ----
test('FIG shorthand: quarter somersaults', () => {
  assert.deepEqual(['40o', '42/', '800<', '12001', '901', '--/'].map(quarterSomersaults), [4, 4, 8, 12, 9, 0]);
});
test('Trampoline: DD total, repeats, level limits', () => {
  const r = scoreTramp('if', [t('Back tuck', 0.5), t('Barani tuck', 0.6), t('Back pike', 0.6), t('Back tuck', 0.5), t('Seat drop', 0)]);
  assert.equal(r.total, 1.7);
  assert.equal(r.items[3].status, 'repeat');
  assert.ok(r.warnings.some((w) => w.includes('10 skills')));
  const hf = scoreTramp('hf', Array.from({ length: 10 }, (_, i) => t(`skill ${i}`, 0.4)));
  assert.ok(hf.warnings.some((w) => w.includes('4.5')));
  const nf = scoreTramp('nf', [t('Seat drop', 0), t('Seat drop', 0), t('Seat drop', 0)]);
  assert.equal(nf.items[1].status, 'counting'); // a 0.0 skill may be repeated once
  assert.equal(nf.items[2].status, 'repeat');
});
test('Double mini: same skill in the same position gets no DD; pass limits', () => {
  const r = scorePasses('dmt', 'if', [[t('Barani tuck', 0.7), t('Back pike', 0.6)], [t('Barani tuck', 0.7), t('Back full', 0.9)]]);
  assert.equal(r.passes[1][0].status, 'repeat');
  assert.deepEqual(r.sums, [1.3, 0.9]);
  // A mounter in one pass and a spotter in the other are different positions.
  const ms = scorePasses('dmt', 'nf', [[t('Full Turn', 0.2), t('Back tuck', 0.5)], [t('Full Turn', 0.2), t('Tuck Jump', 0)]], ['spotter', 'mounter']);
  assert.equal(ms.passes[1][0].status, 'counting');
  assert.equal(ms.total, 0.9);
});
test('Tumbling: pass sizes and New Flyers limits', () => {
  const r = scorePasses('tu', 'nf', [[t('Roundoff', 0.2), t('Back handspring', 0.2), t('Back handspring', 0.2), t('Back tuck', 0.5)], []]);
  assert.ok(r.warnings.some((w) => w.includes('0.2 DD')));
  assert.equal(r.total, 1.1);
});

// ---- entries ----
test('Entries: each level scores on its own; copying routines rescores them', () => {
  const int = newEntry('a', 'mag', 'int');
  int.routines.fx = [s('a', 'B', 1), s('b', 'B', 2), s('c', 'B', 3), s('d', 'B', 4), s('e', 'A', 1), s('f', 'A', 2)];
  const adv = newEntry('b', 'mag', 'adv');
  copyRoutines(int, adv);
  assert.equal(scoreEntry(int).events.fx.sv, 13.0); // 1.0 + EG 2.0
  assert.equal(scoreEntry(adv).events.fx.sv, 12.4); // 1.0 + EG 0.5 + 0.3 + 0.3 + 0.3
  const tt = newEntry('c', 'tt', 'nf');
  assert.equal(scoreEntry(tt).allAround, null);
  assert.equal(tt.passes.tu[0].skills.length, 7);
});

// ---- WAG skill lists by level ----
test('WAG skill lists: Xcel levels, Sapphire and Infinity use USAG values; Masters uses WG', async () => {
  const { searchSkills, wagSkillAllowed, findSkill } = await import('../js/skill-search.js');
  const { SKILLS } = await import('../js/data/wag-skills.js');
  const list = (fam, level, app) => searchSkills('wag', app, '').filter((s) => wagSkillAllowed(fam, level, s));
  assert.equal(new Set(SKILLS.map((s) => s.id)).size, SKILLS.length);
  const silver = list('xcel', 'silver', 'ub');
  assert.ok(silver.length > 200 && silver.every((s) => s.src !== 'WG' && s.prog !== 'dp'));
  assert.ok(!silver.some((s) => s.divisions && !s.divisions.includes('silver')));
  assert.ok(!silver.some((s) => s.id === 'USAG-UB-1.001-1')); // Bronze only
  assert.ok(list('xcel', 'sapphire', 'ub').some((s) => s.prog === 'dp' && s.value === 'E'));
  assert.ok(list('infinity', 'inf', 'bb').some((s) => s.prog === 'dp'));
  assert.ok(list('wagMasters', 'masters', 'fx').every((s) => s.src === 'WG'));
  // UCG additions keep their ids, so saved routines still find them.
  assert.equal(findSkill('UCGW-BB-4').eponym, 'Michaels');
});
test('Xcel Sapphire: no difficulty restrictions, E skills count', () => {
  const r = scoreXcel('sapphire', 'ub', [s('a', 'E'), s('b', 'E'), s('c', 'D'), s('d', 'B'), s('e', 'A'), s('f', 'A'), s('g', 'A')], { srMet: [1, 1, 1, 1] });
  assert.ok(r.items.every((it) => it.status !== 'restricted'));
});

// ---- Xcel: counting the same element more than once (Code of Points examples) ----
const st = (r) => r.items.filter((it) => it.status !== 'blank').map((it) => (it.status === 'repeat' ? `x:${it.repeatWhy}` : 'ok'));
const sk = (name, letter = 'A', link = false) => ({ name, letter, link });
test('Xcel bars: twice at most, the second time in a different connection (UB Ch. 2 example)', () => {
  const r = scoreXcel('gold', 'ub', ['Pullover', 'Cast', 'Back hip circle', 'Cast', 'Back hip circle', 'Cast', 'Back hip circle', 'Underswing dismount'].map((n) => sk(n)), { srMet: [1, 1, 1, 1] });
  // 2nd back hip circle: same connection (cast before and after) -> no VP; 3rd cast -> no VP; 3rd back hip circle: different exit -> VP.
  assert.deepEqual(st(r), ['ok', 'ok', 'ok', 'ok', 'x:connection', 'x:third', 'ok', 'ok']);
});
test('Xcel beam: an isolated repeat is the same connection; connected to something else it counts (BB Ch. 2 example)', () => {
  const r = scoreXcel('gold', 'bb', [sk('Flic-flac step-out', 'B'), sk('Flic-flac step-out', 'B'), sk('Straddle jump', 'A', true), sk('Flic-flac step-out', 'B')], { srMet: [1, 1, 1, 1] });
  assert.deepEqual(st(r), ['ok', 'x:connection', 'ok', 'ok']);
});
test('Xcel floor: hand-support flight elements count every time unless the whole pass repeats', () => {
  const pass = (extra = []) => [sk('Round-off', 'A', true), sk('Flic-flac', 'A', true), ...extra, sk('Back tuck', 'A')];
  const same = scoreXcel('gold', 'fx', [...pass(), ...pass()], { srMet: [1, 1, 1, 1] });
  assert.deepEqual(st(same), ['ok', 'ok', 'ok', 'x:pass', 'x:pass', 'x:connection']);
  const diff = scoreXcel('gold', 'fx', [...pass(), ...pass([sk('Flic-flac', 'A', true)])], { srMet: [1, 1, 1, 1] });
  assert.deepEqual(st(diff), ['ok', 'ok', 'ok', 'ok', 'ok', 'ok', 'ok']);
});
test('UCG Infinity: each element earns credit once, whatever the connection', () => {
  const r = scoreInfinity('bb', [sk('Back walkover'), sk('Cartwheel', 'A', true), sk('Back walkover')]);
  assert.deepEqual(st(r), ['ok', 'ok', 'x:once']);
});
test('Same-element data: versions the Code counts as one element share a key; hand-support flight from the list', async () => {
  const { elementKey } = await import('../js/scoring/wag.js');
  const id = (skillId) => ({ skillId, name: '' });
  // UB 2.001: casts listed by division angle are one element.
  assert.equal(elementKey(id('USAG-UB-2.001-2')), elementKey(id('USAG-UB-2.001-4')));
  // FX 1.201: no turn vs full turn are different elements.
  assert.notEqual(elementKey(id('USAG-FX-1.201-1')), elementKey(id('USAG-FX-1.201-2')));
  // Two casts at different listed angles, in the same connection: the second is a repeat.
  const cast = (v) => ({ name: `cast ${v}`, letter: 'A', skillId: `USAG-UB-2.001-${v}` });
  const bhc = { name: 'Back hip circle', letter: 'A' };
  const r = scoreXcel('silver', 'ub', [{ name: 'Pullover', letter: 'A' }, cast(2), bhc, cast(3), bhc, cast(4), { name: 'Underswing dismount', letter: 'A' }], { srMet: [1, 1, 1, 1] });
  assert.equal(r.items[4].repeatWhy, 'connection'); // 2nd back hip circle: cast before and after, as the 1st
  assert.equal(r.items[5].repeatWhy, 'third'); // 3rd cast
  // Floor: a listed flic-flac counts again in a different pass.
  const ff = { name: 'Flic-flac', letter: 'B', skillId: 'USAG-FX-5.106-1', link: true };
  const ro = { name: 'Round-off', letter: 'A', skillId: 'USAG-FX-5.105-1', link: true };
  const f = scoreXcel('gold', 'fx', [ro, ff, { name: 'Back tuck', letter: 'A' }, ro, ff, ff, { name: 'Back tuck', letter: 'A' }], { srMet: [1, 1, 1, 1] });
  assert.ok(f.items.every((it) => it.status !== 'repeat'));
});
test('Forms: a record split into forms keeps its old id (form a); forms count as different elements', async () => {
  const { findSkill } = await import('../js/skill-search.js');
  const { elementKey } = await import('../js/scoring/wag.js');
  assert.equal(findSkill('USAG-BB-7.104-1').id, 'USAG-BB-7.104-1a');
  const k = (skillId) => elementKey({ skillId, name: '' });
  assert.equal(k('USAG-BB-7.104-1'), k('USAG-BB-7.104-1a'));
  assert.notEqual(k('USAG-BB-7.104-1a'), k('USAG-BB-7.104-1b')); // one-arm back walkover is a different element
  assert.equal(k('USAG-BB-2.0 Silver-1a'), k('USAG-BB-2.101-1')); // division stand-in = the regular stag leap
  assert.equal(k('USAG-UB-7.511-2b'), k('USAG-UB-7.511-1')); // piked form = the same element as v1
  // Round-off then aerial round-off in a repeated floor pass: only the round-off is a hand-support flight element.
  const ro = { name: 'Round-off', letter: 'A', skillId: 'USAG-FX-5.105-1a', link: true };
  const f = scoreXcel('gold', 'fx', [ro, { name: 'Back tuck', letter: 'A' }, ro, { name: 'Back tuck', letter: 'A' }], { srMet: [1, 1, 1, 1] });
  assert.equal(f.items[2].repeatWhy, 'pass');
});
test('Trampoline: a ¾ somersault is not a repeat of the full somersault', () => {
  const r = scoreTramp('if', [t('Front somersault tuck', 0.5, '40o'), t('¾ front somersault tuck', 0.3, '30o'), t('Front somersault tuck', 0.5, '40o')]);
  assert.deepEqual(r.items.map((it) => it.status), ['counting', 'counting', 'repeat']);
});
