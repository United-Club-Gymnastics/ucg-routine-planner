// UCG Masters (MAG and WAG), from the UCG Masters Rules Policy v2.01 and the
// Masters start value worksheets. Values depend on the gymnast's age decade.

export const DECADES = ['30', '40', '50', '60', '70'];
export const DECADE_LABELS = { 30: '30–39', 40: '40–49', 50: '50–59', 60: '60–69', 70: '70+' };
export const DEFAULT_DECADE = '30';

// Skill letters for Masters: miscellaneous skills, Masters Elements, then WG/UCG letters.
export const MASTERS_LETTERS = ['Misc', 'ME', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

const COLUMN = { 30: 0, 40: 1, 50: 2, 60: 3, 70: 4 };
const VALUES = {
  Misc: [null, null, 0.1, 0.2, 0.3], // not available in the 30s and 40s
  ME: [0.0, 0.1, 0.2, 0.3, 0.4],
  A: [0.2, 0.3, 0.4, 0.5, 0.6],
  B: [0.4, 0.5, 0.6, 0.7, 0.8],
  C: [0.6, 0.7, 0.8, 0.9, 1.0],
  D: [0.8, 0.9, 1.0, 1.1, 1.2], // D and higher
};
export const VAULT_AGE_BONUS = { mag: [0.8, 1.6, 2.4, 2.8, 3.2], wag: [1.8, 2.6, 3.4, 4.2, 5.0] };

export const decadeOf = (d) => (COLUMN[d] != null ? String(d) : DEFAULT_DECADE);
const col = (d) => COLUMN[decadeOf(d)];

/** Difficulty value of a Masters skill letter for an age decade (null if not allowed). */
export function mastersValue(letter, decade) {
  if (!letter) return 0;
  const key = VALUES[letter] ? letter : 'DEFGHIJ'.includes(letter) ? 'D' : null;
  if (!key) return 0;
  return VALUES[key][col(decade)];
}

/** Misc skills count for routine length and EG bonus from the 50s up; MEs and lettered skills always. */
export function meetsRequirement(letter, decade) {
  if (!letter) return false;
  if (letter === 'Misc') return col(decade) >= 2;
  return true;
}

export function vaultAgeBonus(disc, decade) {
  return VAULT_AGE_BONUS[disc][col(decade)];
}
