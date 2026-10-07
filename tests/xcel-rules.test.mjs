// Xcel special requirements, restrictions by kind of skill, and the Sapphire bonus
// (js/scoring/xcel-rules.js), with skills described the way the catalog tags them.
// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreXcel } from '../js/scoring/wag.js';

// A listed skill: name, value, element group, tags; `link` = connected to the next skill.
const sk = (name, letter, group, tags = {}, extra = {}) => ({
  name, letter, skillId: `TEST-${name}`, link: false,
  skill: { group, tags, src: 'USAG', ...extra.skill }, ...extra,
});
const linked = (s) => ({ ...s, link: true });
const by = (r, i) => r.detectedSr[i] && r.detectedSr[i].by;

// ---- Sapphire bonus (examples from the Xcel Code, General/Judges Ch. 9) ----
test('Sapphire bonus: C + C connection earns 0.10 each "C" plus 0.10 for the connection', () => {
  const r = scoreXcel('sapphire', 'fx', [
    linked(sk('Switch-side leap', 'C', 1, { dance_type: 'leap', split: true })),
    sk('Popa', 'C', 1, { dance_type: 'jump' }),
  ]);
  assert.equal(r.bonus, 0.3);
});
test('Sapphire bonus: the same "C" twice earns difficulty once; connection still counts', () => {
  const wolf = sk('Wolf jump full', 'C', 1, { dance_type: 'jump' });
  const r = scoreXcel('sapphire', 'fx', [linked(wolf), wolf]);
  assert.equal(r.bonus, 0.2);
});
test('Sapphire bonus: floor indirect acro connection (front pike + round-off + layout full)', () => {
  const r = scoreXcel('sapphire', 'fx', [
    linked(sk('Front pike', 'B', 6, { acro: true, flight: true, salto: true })),
    linked(sk('Round-off', 'A', 5, { acro: true, flight: true })),
    sk('Back layout full', 'B', 8, { acro: true, flight: true, salto: true, twist: true }),
  ]);
  assert.equal(r.bonus, 0.1);
});
test('Sapphire bonus: one "D" per event, 0.40 maximum, and only Xcel-listed skills', () => {
  const d = (n) => sk(n, 'D', 7, { acro: true });
  assert.equal(scoreXcel('sapphire', 'bb', [d('D1'), d('D2')]).bonus, 0.1);
  const cs = ['c1', 'c2', 'c3', 'c4', 'c5'].map((n) => sk(n, 'C', 2, {}));
  const r = scoreXcel('sapphire', 'bb', cs);
  assert.equal(r.bonus, 0.4);
  const dp = sk('Development E', 'E', 7, { acro: true }, { skill: { prog: 'dp' } });
  const dpC = sk('Development C', 'C', 7, { acro: true }, { skill: { prog: 'dp' } });
  assert.equal(scoreXcel('sapphire', 'bb', [dp, dpC]).bonus, 0);
});
test('Sapphire bonus: same B+B connection counts once; reversed order counts again', () => {
  const j = sk('Straddle jump', 'B', 2, { dance_type: 'jump', split: true });
  const f = sk('Flic-flac', 'B', 7, { acro: true, flight: true, inverted: true });
  assert.equal(scoreXcel('sapphire', 'bb', [linked(j), f, linked(j), f]).bonus, 0.1);
  assert.equal(scoreXcel('sapphire', 'bb', [linked(j), f, linked(f), j]).bonus, 0.2);
});

// ---- Restrictions by kind of skill ----
test('Silver beam: a "B" acro skill is restricted; a "B" dance skill is not', () => {
  const r = scoreXcel('silver', 'bb', [sk('Back walkover', 'B', 7, { acro: true, inverted: true }), sk('Split leap', 'B', 2, { dance_type: 'leap', split: true })]);
  assert.equal(r.items[0].status, 'restricted');
  assert.match(r.items[0].restrictWhy, /acro/);
  assert.notEqual(r.items[1].status, 'restricted');
});
test('Silver floor: only one salto or aerial', () => {
  const tuck = sk('Back tuck', 'A', 8, { acro: true, flight: true, salto: true });
  const r = scoreXcel('silver', 'fx', [tuck, sk('Front tuck', 'A', 6, { acro: true, flight: true, salto: true })]);
  assert.equal(r.items[0].status === 'restricted', false);
  assert.equal(r.items[1].status, 'restricted');
});
test('Gold bars: no giants; Platinum floor: "C" acro restricted, "C" dance allowed', () => {
  assert.equal(scoreXcel('gold', 'ub', [sk('Giant', 'B', 4, { giant: true, circle360: true })]).items[0].status, 'restricted');
  const r = scoreXcel('plat', 'fx', [sk('Front layout full', 'C', 6, { acro: true, flight: true, salto: true, twist: true }), sk('Switch leap', 'C', 1, { dance_type: 'leap', split: true })]);
  assert.equal(r.items[0].status, 'restricted');
  assert.notEqual(r.items[1].status, 'restricted');
});

// ---- Special requirements ----
test('Silver bars: the Code example (pullover, cast, back hip circle, underswing dismount) meets all four', () => {
  const r = scoreXcel('silver', 'ub', [
    sk('Pullover', 'A', 1),
    sk('Cast', 'A', 2, { cast_sr: true, support_angle: 'any' }),
    sk('Back hip circle', 'A', 7, { circle360: true }),
    sk('Underswing dismount', 'A', 8, { bar: 'LB' }),
  ]);
  assert.deepEqual(r.sr, [true, true, true, true]);
  assert.match(r.detectedSr[1].assumes, /45° below horizontal/); // the angle can't be planned
  assert.equal(r.detectedSr[0].assumes, null);
});
test('Silver bars: cast squat-on and the dismount circle do not count', () => {
  const r = scoreXcel('silver', 'ub', [
    sk('Pullover', 'A', 1), sk('Cast squat on', 'A', 2, { cast_sr: false }), sk('Sole circle dismount', 'A', 8, { circle360: true }),
  ]);
  assert.deepEqual(r.sr, [true, false, false, true]);
  assert.equal(r.sv, 8.8); // two SRs missing (-1.0); two of five "A"s missing (-0.2)
});
test('Gold bars SR 2/3: the same circle twice counts only connected, or on both bars', () => {
  const bhc = sk('Back hip circle', 'A', 7, { circle360: true, bar: 'LB' });
  const base = [sk('Glide kip', 'A', 1, { kip: true }), sk('Cast', 'A', 2, { cast_sr: true, support_angle: 'any' })];
  assert.deepEqual(scoreXcel('gold', 'ub', [...base, bhc, sk('Cast', 'A', 2, {}), bhc]).sr.slice(1, 3), [true, false]);
  assert.deepEqual(scoreXcel('gold', 'ub', [...base, linked(bhc), bhc]).sr.slice(1, 3), [true, true]);
  const hb = { ...bhc, skill: { ...bhc.skill, tags: { circle360: true, bar: 'HB' } } };
  assert.deepEqual(scoreXcel('gold', 'ub', [...base, bhc, sk('Cast', 'A', 2, {}), hb]).sr.slice(1, 3), [true, true]);
});
test('Restricted skills never meet a special requirement', () => {
  const r = scoreXcel('silver', 'bb', [sk('Back walkover', 'B', 7, { acro: true, inverted: true })]);
  assert.equal(r.sr[2], false);
});
test('Gold beam SR 3: two acro skills, one through inverted vertical', () => {
  const cw = sk('Cartwheel', 'A', 7, { acro: true, inverted: true });
  assert.equal(scoreXcel('gold', 'bb', [cw]).sr[2], false);
  assert.equal(scoreXcel('gold', 'bb', [cw, sk('Back roll', 'A', 6, { acro: true })]).sr[2], true);
});
test('Silver-Platinum floor: SR 1 and SR 2 must come from different passes', () => {
  const ro = sk('Round-off', 'A', 5, { acro: true, flight: true });
  const bhs = sk('Back handspring', 'A', 5, { acro: true, flight: true, inverted: true });
  const one = scoreXcel('silver', 'fx', [linked(ro), bhs]);
  assert.deepEqual(one.sr.slice(0, 2), [true, false]);
  const two = scoreXcel('silver', 'fx', [linked(ro), bhs, sk('Front handspring', 'A', 5, { acro: true, flight: true, inverted: true })]);
  assert.deepEqual(two.sr.slice(0, 2), [true, true]);
});
test('Floor dance passage: two different Group 1 elements in one passage, one a leap with split', () => {
  const leap = sk('Split leap', 'A', 1, { dance_type: 'leap', split: true });
  const jump = sk('Straight jump', 'A', 1, { dance_type: 'jump' });
  assert.equal(scoreXcel('gold', 'fx', [leap, jump]).sr[2], false); // not connected
  const r = scoreXcel('gold', 'fx', [linked(leap), jump]);
  assert.equal(r.sr[2], true);
  assert.match(r.detectedSr[2].assumes, /120°/);
});
test('Sapphire floor: a pass with two saltos; three different saltos, one "B"', () => {
  const r = scoreXcel('sapphire', 'fx', [
    linked(sk('Front layout', 'B', 6, { acro: true, flight: true, salto: true })),
    sk('Front tuck', 'A', 6, { acro: true, flight: true, salto: true }),
    sk('Back tuck', 'A', 8, { acro: true, flight: true, salto: true }),
  ]);
  assert.deepEqual(r.sr.slice(0, 2), [true, true]);
});
test('The coach can untick a detected requirement or tick one by hand', () => {
  const rows = [sk('Pullover', 'A', 1)];
  assert.equal(scoreXcel('silver', 'ub', rows).sr[0], true);
  assert.equal(scoreXcel('silver', 'ub', rows, { srSet: [false] }).sr[0], false);
  assert.equal(scoreXcel('silver', 'ub', rows, { srSet: [undefined, true] }).sr[1], true);
  assert.equal(scoreXcel('silver', 'ub', rows, { srMet: [false, true] }).sr[1], true); // ticks saved before detection
});
test('Skills typed in by hand meet nothing by themselves', () => {
  const r = scoreXcel('silver', 'ub', [{ name: 'Pullover', letter: 'A' }]);
  assert.deepEqual(r.sr, [false, false, false, false]);
});
