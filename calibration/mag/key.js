// Judge practice for UCG MAG: the answer key for a calibration routine, scored by the planner's own
// MAG rules (js/scoring/mag.js), and how a judge's entry compares with it. No DOM: tested in
// tests/calibration-mag.test.mjs.
import { LEVELS, ROMAN, eventOptions, letterValue, round1, scoreRoutine, scoreVault } from '../../js/scoring/mag.js';

export { ROMAN };
// The values a judge picks from (Sub-A: a recognised skill worth 0.0, no element group).
export const LETTERS = ['Sub-A', 'A', 'B', 'C', 'D', 'E', 'F'];
// How far an execution total may be from the key's and still count as right.
export const E_TOLERANCE = 0.3;
const milli = (n) => Math.round(n * 1000);

/** The start value from its parts: the level's cap includes every bonus, stick bonus too. */
function startValue(level, raw, short) {
  const cap = LEVELS[level].cap;
  return round1((cap != null && raw > cap ? cap : raw) - short);
}

/** The bonus options a judge can tick or count (not the requirements, which are deductions). */
export const bonusOptions = (event, level) => eventOptions(event, level).filter((o) => !o.deduction);
/** The requirements whose absence is a neutral deduction. */
export const requirements = (event, level) => eventOptions(event, level).filter((o) => o.deduction);

/**
 * The routine's skills as the planner holds them: each listed skill by its name in the skill list, so
 * a repetition is the same name (scoreRoutine's repeat check); a skill the judges didn't recognise
 * for another reason is `notRecognised` (counts for nothing).
 */
export function skillRows(r) {
  return r.rows.map((s, i) => {
    const name = s.label || s.name;
    const repeat = r.rows.slice(0, i).some((x) => (x.label || x.name) === name);
    return { name, letter: s.letter, eg: s.eg || '', skillId: s.skillId || '', ...(s.nr && !repeat ? { notRecognised: true } : {}) };
  });
}

/**
 * The key: { score (scoreRoutine's), d, sv, nd, ndItems, e, final } or, for vault, { vault, d, sv, nd, e, final }.
 * d is the D-score with every bonus, stick bonus included.
 */
export function answerKey(r) {
  if (r.event === 'vt') {
    const v = scoreVault(r.level, r.vault);
    const d = round1(v.dv + r.stick);
    const sv = startValue(r.level, round1(10 + d), 0);
    return { vault: v, d, sv, nd: 0, ndItems: [], e: r.e, final: round1(sv - r.e) };
  }
  const score = scoreRoutine(r.event, r.level, skillRows(r), r.options);
  const d = round1(score.difficulty + score.egTotal + score.bonus + r.stick);
  const sv = startValue(r.level, round1(10 + d), score.shortDeduction);
  // The planner's requirement deductions (a missing double flip, ...) and the judge's own.
  const ndItems = [
    ...requirements(r.event, r.level).filter((o) => !r.options[o.id] && !score.detected[o.id])
      .map((o) => ({ what: r.lines.find((l) => l.rule === o.id)?.what || `Missing: ${o.label}`, v: o.value, rule: o.id })),
    ...r.lines.filter((l) => l.kind === 'neutral' && !l.rule).map((l) => ({ what: l.what, v: l.v })),
  ];
  const nd = round1(ndItems.reduce((t, x) => t + x.v, 0));
  return { score, d, sv, nd, ndItems, e: r.e, final: round1(sv - nd - r.e) };
}

/**
 * A judge's entry, scored the same way:
 *   skills [{ letter, eg, link }] (the counting skills in the order performed; link: connected to the
 *   next one), bonus { [optionId]: true | count } (the connection bonuses come from the links),
 *   stick (0, 0.1, 0.2), missing { [requirementId]: true }, otherNd, e; or, for vault, vault (id),
 *   stick, otherNd, e.
 */
export function scoreEntry(r, entry) {
  const nums = (n) => Math.max(0, Number(n) || 0);
  const e = round1(nums(entry.e));
  if (r.event === 'vt') {
    const v = entry.vault ? scoreVault(r.level, entry.vault) : null;
    const d = round1((v?.dv || 0) + nums(entry.stick));
    const sv = v ? startValue(r.level, round1(10 + d), 0) : 0;
    const nd = round1(nums(entry.otherNd));
    return { vault: v, d, sv, nd, e, final: round1(sv - nd - e), filled: !!v };
  }
  const rows = entry.skills.filter((s) => s.letter).map((s, i) => ({ name: `Skill ${i + 1}`, letter: s.letter, eg: s.letter === 'Sub-A' ? '' : s.eg || '', link: !!s.link }));
  // The ticked bonuses and the mushroom value; scoreRoutine counts the connections from the links.
  const options = Object.fromEntries(bonusOptions(r.event, r.level).filter((o) => !o.connect).map((o) => [o.id, o.kind === 'check' ? !!entry.bonus[o.id] : entry.bonus[o.id]]));
  const score = scoreRoutine(r.event, r.level, rows, options);
  const d = round1(score.difficulty + score.egTotal + score.bonus + nums(entry.stick));
  const sv = rows.length ? startValue(r.level, round1(10 + d), score.shortDeduction) : 0;
  const nd = round1(requirements(r.event, r.level).reduce((t, o) => t + (entry.missing[o.id] ? o.value : 0), 0) + nums(entry.otherNd));
  return { score, d, sv, nd, e, final: round1(sv - nd - e), filled: rows.length > 0 };
}

const listNames = (list, esc) => list.map((it) => `${esc(it.name)} (${it.letter})`).join(', ');

/**
 * Compare an entry with the key: { sv: ok, nd: ok, e: ok, right, mine, notes: [html] }. Right means the
 * start value and neutral deductions match exactly and the execution total is within E_TOLERANCE.
 * `esc` escapes text for the notes (they are shown as HTML).
 */
export function compare(r, key, entry, esc = (s) => s) {
  const mine = scoreEntry(r, entry);
  const out = {
    mine,
    sv: milli(mine.sv) === milli(key.sv),
    nd: milli(mine.nd) === milli(key.nd),
    e: Math.abs(mine.e - key.e) <= E_TOLERANCE + 1e-9,
    notes: [],
  };
  out.right = out.sv && out.nd && out.e;

  if (r.event === 'vt') {
    const v = key.vault;
    if (entry.vault !== r.vault) out.notes.push(`<b>Vault:</b> the vault is ${esc(v.name)} (${v.dv.toFixed(1)})${mine.vault ? `, not ${esc(mine.vault.name)} (${mine.vault.dv.toFixed(1)})` : ''}.`);
    if (milli(entry.stick || 0) !== milli(r.stick)) out.notes.push(`<b>Stick bonus:</b> ${r.stick ? `+${r.stick.toFixed(1)}, the landing is stuck` : 'none: the landing isn’t stuck'}.`);
  } else {
    const s = key.score;
    const counting = s.rows;
    const keyLetters = LETTERS.map((l) => [l, counting.filter((it) => it.letter === l)]);
    const myLetters = Object.fromEntries(LETTERS.map((l) => [l, entry.skills.filter((x) => x.letter === l).length]));
    for (const [l, list] of keyLetters) {
      if (list.length !== myLetters[l]) out.notes.push(`<b>${l}:</b> you entered ${myLetters[l]}, the key has ${list.length}${list.length ? ` (${listNames(list, esc)})` : ''}.`);
    }
    const mineEg = mine.score.egBonus;
    for (const g of [1, 2, 3, 4]) {
      const k = s.egBonus[g] || 0;
      const m = mineEg[g] || 0;
      if (milli(k) === milli(m)) continue;
      const by = counting.find((it) => it.eg === g && it.bonus);
      out.notes.push(`<b>EG ${ROMAN[g]}:</b> ${by ? `+${k.toFixed(1)}, earned by ${esc(by.name)} (${by.letter})` : 'not earned: no counting skill in this group'}${m ? `; you have +${m.toFixed(1)}` : ''}.`);
    }
    for (const o of bonusOptions(r.event, r.level)) {
      const k = s.optionValues[o.id] || 0;
      const m = mine.score.optionValues[o.id] || 0;
      if (milli(k) !== milli(m)) out.notes.push(`<b>${esc(o.label)}:</b> ${k ? `+${k.toFixed(1)}${s.detected[o.id] ? ` (${esc(s.detected[o.id])})` : ''}` : 'not earned'}.`);
    }
    if (milli(entry.stick || 0) !== milli(r.stick)) out.notes.push(`<b>Stick bonus:</b> ${r.stick ? `+${r.stick.toFixed(1)}, the dismount is stuck` : 'none'}.`);
    if (s.shortBy && !mine.score.shortBy) out.notes.push(`<b>Short routine:</b> only ${s.rows.length} recognised skills, −${s.shortDeduction.toFixed(1)}.`);
  }
  if (!out.nd) {
    out.notes.push(`<b>Neutral deductions:</b> ${key.ndItems.length ? key.ndItems.map((x) => `${esc(x.what)} −${x.v.toFixed(1)}`).join('; ') : 'none'}${mine.nd ? `; you have −${mine.nd.toFixed(1)}` : ''}.`);
  }
  if (!out.e) out.notes.push(`<b>Execution:</b> the key takes ${key.e.toFixed(1)}, you took ${mine.e.toFixed(1)} (right when within ${E_TOLERANCE.toFixed(1)}). See every deduction in the routine laid out.`);
  return out;
}

/** A skill's value as a number, for display. */
export const valueOf = (letter) => letterValue(letter);
