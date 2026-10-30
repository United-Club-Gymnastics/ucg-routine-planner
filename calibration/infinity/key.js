// Judge practice: the answer key for a calibration routine, scored by the planner's own UCG
// Infinity rules, and how a judge's calculator entry compares with it. No DOM: tested in
// tests/calibration.test.mjs.
import { INFINITY_EG_BONUS, INFINITY_EVENT_BONUS, INFINITY_GROUPS, INFINITY_VALUES, INFINITY_VAULT_LIST, scoreInfinity } from '../../js/scoring/wag.js';

export const LETTERS = ['A', 'B', 'C', 'D', 'E'];
export const ROMAN = ['I', 'II', 'III', 'IV'];
const milli = (n) => Math.round(n * 1000);

// The sheet gives condensed groups (I-IV); the planner wants a USAG group number, so each row
// takes the first number in its condensed group (only the condensed group matters to Infinity).
const groupNumber = (ev, roman) => INFINITY_GROUPS[ev].condensed[roman]?.[0] ?? null;

/** The key: the counting skills by letter, the groups earned, the bonus, D-score and start value. */
export function answerKey(r) {
  if (r.event === 'vt') {
    const vault = r.vault ? INFINITY_VAULT_LIST.find((v) => v.name === r.vault) || null : null;
    return { d: r.dv, sv: r.sv, vault };
  }
  const rows = [...r.skills, ...r.extras.map((s) => ({ ...s, extra: true }))];
  const score = scoreInfinity(r.event, rows.map((s) => ({ name: s.name, letter: s.letter, eg: groupNumber(r.event, s.group) })), { eventBonus: r.eventBonus });
  return {
    rows,
    score,
    counts: Object.fromEntries(LETTERS.map((l) => [l, score.rows.filter((it) => it.letter === l).length])),
    egs: new Set(score.earnedGroups.map((n) => ROMAN[n - 1])),
    bonus: r.eventBonus,
    d: Math.round((score.difficulty + score.egTotal + score.bonus) * 10) / 10,
    sv: score.sv,
  };
}

/** A calculator entry's D-score: { counts: {A..E}, egs: Set, bonus } or { vault }. */
export function entryD(event, entry) {
  if (event === 'vt') return entry.vault?.dv ?? 0;
  const skills = LETTERS.reduce((t, l) => t + milli(INFINITY_VALUES[l]) * (entry.counts[l] || 0), 0);
  return (skills + milli(INFINITY_EG_BONUS) * entry.egs.size + (entry.bonus ? milli(INFINITY_EVENT_BONUS) : 0)) / 1000;
}

/**
 * Compare an entry with the key. Returns { right, d, keyD, letters: {A: ok}, groups: {I: ok}, bonus: ok, vault: ok, notes: [html] }.
 * `esc` escapes text for the notes (they are shown as HTML).
 */
export function compare(r, key, entry, esc = (s) => s) {
  const d = entryD(r.event, entry);
  const out = { d, keyD: key.d, right: milli(d) === milli(key.d), letters: {}, groups: {}, notes: [] };
  const names = (list) => list.map((s) => esc(s.name)).join(', ');

  if (r.event === 'vt') {
    const v = entry.vault;
    out.vault = key.vault ? v?.id === key.vault.id : !!v && milli(v.dv) === milli(key.d);
    if (!v) out.notes.push(`Pick the vault you saw. The key’s D-score is ${key.d.toFixed(1)}.`);
    else if (!out.vault && key.vault) out.notes.push(`You picked ${esc(v.name)} (${v.dv.toFixed(1)}). The vault is ${esc(key.vault.name)} (${key.vault.dv.toFixed(1)}).`);
    else if (!out.vault) {
      const same = INFINITY_VAULT_LIST.filter((x) => milli(x.dv) === milli(key.d));
      out.notes.push(`You picked ${esc(v.name)} (${v.dv.toFixed(1)}). The key’s vault is worth ${key.d.toFixed(1)}, like ${same.slice(0, 4).map((x) => esc(x.name)).join(', ')}${same.length > 4 ? '…' : '.'}`);
    }
    return out;
  }

  for (const l of LETTERS) {
    const mine = entry.counts[l] || 0;
    out.letters[l] = mine === key.counts[l];
    if (!out.letters[l]) {
      const list = key.score.rows.filter((it) => it.letter === l);
      out.notes.push(`<b>${l}:</b> you counted ${mine}, the key has ${key.counts[l]}${list.length ? ` (${names(list)})` : ''}.`);
    }
  }
  for (const k of ROMAN) {
    out.groups[k] = entry.egs.has(k) === key.egs.has(k);
    if (out.groups[k]) continue;
    if (key.egs.has(k)) {
      const by = key.score.items.find((it) => it.bonus && it.condensed === k);
      out.notes.push(`<b>Group ${k}</b> is earned by ${esc(by.name)} (${by.letter})${by.status === 'noncounting' ? ', which isn’t in the top 8: group credit doesn’t need it to be' : ''}.`);
    } else {
      const inGroup = key.rows.filter((s) => s.group === k);
      out.notes.push(`<b>Group ${k}</b> isn’t earned: ${inGroup.length ? `its skills (${names(inGroup)}) are all A` : 'no skill in this group'}.`);
    }
  }
  out.bonus = !!entry.bonus === key.bonus;
  if (!out.bonus) out.notes.push(`<b>Apparatus bonus</b> ${key.bonus ? 'is earned' : 'isn’t earned'}: ${esc(r.eventBonusWhy)}.`);
  return out;
}
