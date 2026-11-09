// The UCG MAG judging calculator's rules, with no DOM: the level tabs, the rules at a glance
// (levelRules) and the stick bonus (stickBonus), plus the scoring it is built on, re-exported so a
// consumer (ucg-platform vendors this file and its imports) has one stable list:
//   scoreEntry, bonusOptions, requirements, neutralOptions, neutralTotal, stickBonus, levelRules,
//   LEVEL_TABS, LETTERS, ROMAN, APPARATUS, VAULTS, offeredAt, devBanned, findVault, LEVELS.
// Keep that list stable; the markup is calculator.js.
import { APPARATUS, LEVELS, devBanned, findVault, neutralOptions, neutralTotal, offeredAt } from '../../js/scoring/mag.js';
import { VAULTS } from '../../js/data/mag-vaults.js';
import { LETTERS, ROMAN, bonusOptions, requirements, scoreEntry } from './key.js';

export { APPARATUS, LEVELS, LETTERS, ROMAN, VAULTS, bonusOptions, devBanned, findVault, neutralOptions, neutralTotal, offeredAt, requirements, scoreEntry };
export const LEVEL_TABS = [['dev', 'Developmental'], ['int', 'Intermediate'], ['adv', 'Advanced']];
export const EVENT_NAME = { fx: 'Floor', ph: 'Pommel Horse', sr: 'Rings', vt: 'Vault', pb: 'Parallel Bars', hb: 'High Bar' };
export const EVENT_SHORT = { fx: 'Floor', ph: 'Pommel', sr: 'Rings', vt: 'Vault', pb: 'P-Bars', hb: 'High Bar' };
export const COP_URL = 'https://unitedclubgymnastics.org/wp-content/uploads/UCG-MAG-CoP.pdf';
export const f1 = (n) => (Math.round(n * 10) / 10).toFixed(1);

// ---- the level's rules at a glance (UCG MAG Rules Breakdown 2026-28; the MAG judges' cheat sheets) ----
export const LEVEL_NOTE = { dev: 'Close to USAG Level 7', int: 'Close to USAG Level 9', adv: '2027 GymACT rules' };
const RANKS = 'A/B +0.3 · C +0.4 · D or higher +0.5';
const STICK = { dev: '+0.1', int: '+0.1', adv: '+0.1 for a B dismount · +0.2 for C or higher' };
const VAULT_STICK = { dev: '+0.1, any vault', int: '+0.1 non-flipping · +0.2 flipping', adv: '+0.2 flipping vaults only' };

/** [label, text or [lines]] rows: what the level counts and awards on this apparatus. */
/** [label, text or [lines]] rows: what the level counts and awards on this apparatus. */
export function levelRules(level, event) {
  const rows = [];
  if (event === 'vt') {
    rows.push(['Vault value', level === 'adv' ? 'UCG CoP vault table; front handspring and round-off ½-on saltos at GymACT values' : 'UCG CoP vault table (WG values)']);
    if (level === 'dev') rows.push(['Banned', 'flipping and round-off-entry vaults (score 0)']);
    rows.push(['Stick bonus', VAULT_STICK[level]]);
    rows.push(['Neutral', 'not landing feet first −2.0']);
  } else {
    rows.push(['Counting skills', level === 'dev' ? 'the 6 highest-valued · −0.5 per skill short of 6' : 'the dismount + the 7 highest-valued others · −1.0 per skill short of 6']);
    if (level === 'dev') rows.push(['Element groups', '+0.5 for each group with an A or higher · only 3 groups count (+1.5 max)']);
    else {
      rows.push(['EG I', '+0.5 for an A or higher']);
      // Advanced scores the dismount group on its own, except on floor (no dismount group).
      rows.push([level === 'adv' && event !== 'fx' ? 'EG II–III' : 'EG II–IV', level === 'int' ? 'A +0.3 · B or higher +0.5' : RANKS]);
      if (level === 'adv' && event !== 'fx') rows.push(['EG IV (dismount)', 'the dismount’s value (+0.5 max)']);
    }
    rows.push(['Start value cap', LEVELS[level].cap != null ? `${f1(LEVELS[level].cap)}, bonuses included` : 'none']);
    rows.push(['Stick bonus', event === 'ph' ? 'none on pommel horse' : STICK[level]]);
    if (event === 'fx') {
      rows.push(['Bonus', ['D or higher connected with B or C +0.1', 'D or higher connected with D or higher +0.2', 'double-salto dismount +0.1']]);
      if (level === 'adv') rows.push(['Required', ['a double salto', 'a tumbling pass first', 'a balance or jump per WG', '−0.3 for each one missing']]);
    }
    if (event === 'ph' && level === 'dev') rows.push(['Mushroom bonus', ['+0.1 per circle, +0.2 per other skill', 'the top 5 count (+1.0 max)']]);
    if (event === 'sr') {
      rows.push(['Bonus', '+0.3 once for a C or higher strength skill']);
      if (level === 'adv') rows.push(['Required', 'a swing to handstand (−0.3 if missing)']);
    }
    if (event === 'hb') rows.push(['Bonus', 'C + C connection +0.1: flight to flight, or in bar to flight and back']);
  }
  return rows;
}

/**
 * The stick bonus for a stuck landing: by level and, on the other apparatus, the dismount's value
 * (Advanced: +0.1 for a B, +0.2 for C or higher) or, on vault, whether it flips.
 * { value, why } — `why` explains it next to the checkbox.
 */
export function stickBonus(level, event, { dismount = '', vault = null } = {}) {
  if (event === 'ph') return { value: 0, why: 'none on pommel horse' };
  if (event === 'vt') {
    if (level === 'dev') return { value: 0.1, why: '+0.1, any vault' };
    if (!vault) return { value: 0, why: VAULT_STICK[level] };
    if (vault.flipping) return { value: 0.2, why: '+0.2, a flipping vault' };
    return level === 'int' ? { value: 0.1, why: '+0.1, a non-flipping vault' } : { value: 0, why: 'none for a non-flipping vault' };
  }
  if (level !== 'adv') return { value: 0.1, why: '+0.1' };
  if (!dismount) return { value: 0, why: STICK.adv };
  const rank = 'ABCDEFGHIJ'.indexOf(dismount) + 1;
  if (rank >= 3) return { value: 0.2, why: `+0.2, a ${dismount} dismount` };
  if (rank === 2) return { value: 0.1, why: '+0.1, a B dismount' };
  return { value: 0, why: `none for ${dismount === 'Sub-A' ? 'a Sub-A' : 'an A'} dismount` };
}
