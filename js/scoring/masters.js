// UCG Masters (MAG and WAG), from the UCG Masters Rules Policy v2.1 (Google Doc, the source of
// record: README "Scoring rules"), aligned with the international Masters Code of Points 2025-2028.
// Values depend on the gymnast's age decade. The tables come from the bundle's rules digest
// (data/masters-rules.js, built from rules/UCG-MASTERS/digest/scoring.json).
import { AGE_BONUS } from '../data/masters-vaults.js';
import { RULES } from '../data/masters-rules.js';

export const DECADES = ['30', '40', '50', '60', '70'];
export const DECADE_LABELS = { 30: '30–39', 40: '40–49', 50: '50–59', 60: '60–69', 70: '70+' };
export const DEFAULT_DECADE = '30';

// Skill letters for Masters: GE (Gymnastics Element), ME (Masters Element), then WG/UCG letters.
export const MASTERS_LETTERS = ['GE', 'ME', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
// "Misc" (Miscellaneous Gymnastics Skill) was GE's old name (retired 2026-10-20): saved rows may hold it.
export const mastersLetter = (letter) => (letter === 'Misc' ? 'GE' : letter);

const COLUMN = { 30: 0, 40: 1, 50: 2, 60: 3, 70: 4 };
// D and higher share one row (D+).
const key = (letter) => {
  const l = mastersLetter(letter);
  return RULES.values[l] ? l : 'DEFGHIJ'.includes(l) && l ? 'D+' : null;
};
// GE < ME < A < B < C < D+.
const RANK = { GE: 0, ME: 1, A: 2, B: 3, C: 4, 'D+': 5 };
// Vault age bonus per decade: from the Masters vault tables (ucg-code-of-points, via the skill bundle).
export const VAULT_AGE_BONUS = AGE_BONUS;

export const decadeOf = (d) => (COLUMN[d] != null ? String(d) : DEFAULT_DECADE);
const col = (d) => COLUMN[decadeOf(d)];

/** Difficulty value of a Masters skill letter for an age decade (null if not allowed: GE in the 30s and 40s). */
export function mastersValue(letter, decade) {
  const k = letter ? key(letter) : null;
  if (!k) return 0;
  return RULES.values[k][col(decade)];
}

/** Whether `letter` is at least the level a decade list names (null in the list: nothing qualifies). */
export function atLeast(letter, levels, decade) {
  const need = levels[col(decade)];
  const k = letter ? key(letter) : null;
  return need != null && k != null && RANK[k] >= RANK[need];
}

/** The lowest skill that counts toward routine length (and fills a requirement): ME in the 30s and 40s, GE from 50. */
export const meetsRequirement = (letter, decade) => atLeast(letter, RULES.lengthMin, decade);

/** Counting elements: 7 (6 + dismount), 6 (5 + dismount) from 60. */
export const countingTotal = (decade) => RULES.total[col(decade)];
export const bestCount = (decade) => RULES.best[col(decade)];
export const PER_MISSING = RULES.perMissing;

/** MAG element group bonus for the group's best counting element: 0.5, 0.3 or 0 by its level and the decade. */
export function magEgBonus(letter, decade) {
  const t = RULES.mag.egBonus;
  return atLeast(letter, t['0.5'], decade) ? 0.5 : atLeast(letter, t['0.3'], decade) ? 0.3 : 0;
}
export const DISMOUNT_EG_MAX = RULES.mag.dismountEgMax;

/** WAG dismount Composition Requirement: 0.5, 0.3 or 0 by the dismount's level and the decade. */
export function dismountCr(letter, decade) {
  const t = RULES.wag.dismountCr;
  return atLeast(letter, t['0.5'], decade) ? 0.5 : atLeast(letter, t['0.3'], decade) ? 0.3 : 0;
}
export const WAG_CR = RULES.wag;

/** WAG beam bonus (from 40): when the gymnast doesn't use a widening. null in the 30s. */
export const beamBonus = (decade) => RULES.wag.beamBonus[col(decade)];

export function vaultAgeBonus(disc, decade) {
  return VAULT_AGE_BONUS[disc][col(decade)];
}

export const decadeNumber = (decade) => Number(decadeOf(decade));

/** A decade's two-step table in words: "+0.5 for A or higher, +0.3 for an ME". */
export function tierText(t, decade) {
  const hi = t['0.5'][col(decade)];
  const lo = t['0.3'][col(decade)];
  return `+0.5 for ${hi} or higher${lo ? `, +0.3 for ${lo === 'A' ? 'an A' : `a${lo === 'ME' ? 'n' : ''} ${lo}`}` : ''}`;
}
export const mastersEgText = (decade) => tierText(RULES.mag.egBonus, decade);
export const dismountCrText = (decade) => tierText(RULES.wag.dismountCr, decade);
