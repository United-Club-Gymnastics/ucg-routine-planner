// UCG MAG start value rules (2026-2028), from the UCG MAG Rules Breakdown and
// Rules Policy (Google Sheet / Doc, the sources of record: README "Scoring rules"),
// the MAG start value worksheets, and the MAG Routine Composition Planner spreadsheet.
import { VAULTS } from '../data/mag-vaults.js';
import { VAULTS as MASTERS_VAULTS } from '../data/masters-vaults.js';
import { RULES as WG } from '../data/wg-mag-rules.js';
import { DISMOUNT_EG_MAX, MASTERS_LETTERS, bestCount, countingTotal, magEgBonus, mastersValue, meetsRequirement, vaultAgeBonus } from './masters.js';

// WG MAG rules from the bundle's rules digest (data/wg-mag-rules.js), current to the newsletters.
// Rings: the five WG skills that meet the swing to handstand requirement (MAG-NL-1).
export const SWING_HS = WG.srSwingHs;
// Floor (MAG-NL-1, NL-3, NL-4): a one-leg balance or a jump from the newsletter list.
export const FX_BALANCE_OR_JUMP = WG.fxBalanceOrJump.elements;
// High bar: each flight's style for the WG special repetition rule (our own table).
export const HB_FLIGHT_STYLE = WG.hbFlightStyle;
export const MAX_PER_STYLE = 2;

// Floor: the double (and triple) saltos in the skill list, including the ones whose
// names don't say "double" (e.g. Kolyvanov, Tsukahara).
export const FX_DOUBLE_SALTOS = [
  'WG-FX-II-16', 'WG-FX-II-17', 'WG-FX-II-36', 'WG-FX-II-42', 'WG-FX-II-46', 'WG-FX-II-48',
  'WG-FX-III-3', 'WG-FX-III-4', 'WG-FX-III-5', 'WG-FX-III-6', 'WG-FX-III-11', 'WG-FX-III-12', 'WG-FX-III-16',
  'WG-FX-III-18', 'WG-FX-III-24', 'WG-FX-III-29', 'WG-FX-III-30', 'WG-FX-III-35', 'WG-FX-III-36', 'WG-FX-III-41',
  'WG-FX-III-42', 'WG-FX-III-48', 'WG-FX-III-54', 'WG-FX-III-60', 'WG-FX-III-66', 'WG-FX-III-72',
];
// A skill typed in by hand: go by its name.
const DOUBLE_NAME = /\b(double|dbl|triple|full[- ]?in|full[- ]?out|half[- ]?in|half[- ]?out)\b/i;
export const isDoubleSalto = (it) => (it.skillId ? FX_DOUBLE_SALTOS.includes(it.skillId) : DOUBLE_NAME.test(it.name));

// Requirements and bonuses the routine itself can show. Each takes the listed
// skills (no blanks) and returns the skill that meets it, if any.
const DETECT = {
  swingHs: (skills) => skills.find((it) => SWING_HS.includes(it.skillId)),
  dblFlip: (skills) => skills.find(isDoubleSalto),
  // The dismount is the last skill in the routine.
  dblDismount: (skills) => {
    const last = skills.at(-1);
    return last && isDoubleSalto(last) ? last : undefined;
  },
  balance: (skills) => skills.find((it) => FX_BALANCE_OR_JUMP.includes(it.skillId)),
  // The first skill is an acro element (EG II-IV): the routine starts with a tumbling pass.
  tumbleStart: (skills) => ([2, 3, 4].includes(skills[0]?.eg) ? skills[0] : undefined),
};

export const EXECUTION = 10;
export const MIN_SKILLS = 6;
export const MAX_ROUTINE = 20; // skills a routine list can hold (counting + non-counting)
export const MAX_PER_EG = WG.counting.maxPerEg; // WG: at most 4 counting skills from one element group

// Sub-A skills (UCG CoP) are recognised skills worth 0.0, with no EG.
export const LETTER_VALUES = { 'Sub-A': 0, A: 0.1, B: 0.2, C: 0.3, D: 0.4, E: 0.5, F: 0.6, G: 0.7, H: 0.8, I: 0.9, J: 1.0 };
export const LETTERS = Object.keys(LETTER_VALUES);
export const ROMAN = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV' };

export const LEVELS = {
  dev: {
    label: 'Developmental',
    maxSkills: 6,
    shortDeduction: 0.5,
    cap: 12.3,
  },
  // Intermediate and Advanced count as WG: the dismount first, then the 7 best (WG §6.1; floor from
  // 2026-01-01, MAG-NL-1). Developmental counts its 6 highest (Nate 2026-10-20).
  int: {
    label: 'Intermediate',
    maxSkills: 8,
    shortDeduction: 1.0,
    cap: 13.1,
    dismountFirst: true,
  },
  adv: {
    label: 'Advanced (GymACT)',
    maxSkills: 8,
    shortDeduction: 1.0,
    cap: null,
    dismountFirst: true,
  },
  // Values depend on the age decade (masters.js): 6 best + the dismount, 5 + the dismount from 60
  // (maxSkills is the most, see countingFor); no cap.
  masters: {
    label: 'Masters',
    maxSkills: 7,
    shortDeduction: 1.0,
    cap: null,
    masters: true,
  },
};
/** How many skills count (and the routine needs) at a level: Masters by age decade. */
export const countingFor = (level, decade) => (LEVELS[level]?.masters ? countingTotal(decade) : (LEVELS[level] || LEVELS.int).maxSkills);
export const minSkillsFor = (level, decade) => (LEVELS[level]?.masters ? countingTotal(decade) : MIN_SKILLS);
export const lettersFor = (level) => (level === 'masters' ? MASTERS_LETTERS : LETTERS);
export const LEVEL_IDS = Object.keys(LEVELS);

export const EVENTS = ['fx', 'ph', 'sr', 'pb', 'hb']; // vault is scored separately
export const ALL_EVENTS = ['fx', 'ph', 'sr', 'vt', 'pb', 'hb']; // Olympic order

export const APPARATUS = {
  fx: {
    label: 'Floor Exercise',
    short: 'Floor',
    groups: {
      1: 'Non acrobatic elements',
      2: 'Forward acrobatic elements',
      3: 'Backward acrobatic elements',
      4: 'Single saltos with at least one twist',
    },
  },
  ph: {
    label: 'Pommel Horse',
    short: 'Pommel',
    groups: {
      1: 'Single leg swings and scissors',
      2: 'Circles, kehrs, russians, and flops',
      3: 'Travels',
      4: 'Dismounts',
    },
  },
  sr: {
    label: 'Still Rings',
    short: 'Rings',
    groups: { 1: 'Kips and swings', 2: 'Strength', 3: 'Swing to strength', 4: 'Dismounts' },
  },
  vt: { label: 'Vault', short: 'Vault' },
  pb: {
    label: 'Parallel Bars',
    short: 'P-Bars',
    groups: { 1: 'Upper arm', 2: 'Support', 3: 'Basket and long hang swings', 4: 'Dismounts' },
  },
  hb: {
    label: 'High Bar',
    short: 'High Bar',
    groups: { 1: 'Long hang', 2: 'Flight', 3: 'In bar', 4: 'Dismounts' },
  },
};

// Bonus and requirement options for each event and level. `kind`:
//   check    one-time bonus when ticked (value) or, for `deduction`, a
//            requirement whose absence costs the value
//   count    number of times a bonus is earned (value each, max `max`)
//   mushroom Pommel Horse mushroom bonus, 0.0-1.0
// Stick bonuses aren't here: they depend on the live routine, not the plan.
export function eventOptions(event, level) {
  const o = [];
  // Masters (UCG Masters Rules Policy): skill values, group bonuses and the short deduction
  // only; no connection, strength or other bonuses.
  if (event === 'fx' && level !== 'masters') {
    o.push({ id: 'conn1', kind: 'count', connect: true, value: 0.1, max: 5, label: 'D or higher + B/C connection', help: '+0.1 each. Mark connected skills with Connect skills (under the routine) to count them.' });
    o.push({ id: 'conn2', kind: 'count', connect: true, value: 0.2, max: 5, label: 'D or higher + D or higher connection', help: '+0.2 each. Mark connected skills with Connect skills (under the routine) to count them.' });
    // Double flipping dismount: every level (Nate 2026-10-20: Developmental too, though in practice
    // nobody there dismounts with a double salto).
    o.push({ id: 'dblDismount', kind: 'check', value: 0.1, detect: true, label: 'Double flipping dismount',
      help: '+0.1. Ticked automatically when the last skill listed is a double or triple salto.' });
    if (level === 'adv') {
      o.push({ id: 'dblFlip', kind: 'check', value: 0.3, deduction: true, detect: true, label: 'Routine includes a double flip',
        help: 'Required: -0.3 neutral deduction if missing. Ticked automatically for a double salto from the skill list.' });
    }
    // WG newsletters (MAG-NL-1, NL-3, NL-4): Advanced only (Nate 2026-10-20).
    if (WG.fxBalanceOrJump.ucg_levels.includes(level)) {
      o.push({ id: 'balance', kind: 'check', value: WG.fxBalanceOrJump.neutral, deduction: true, detect: true, label: 'Balance or jump requirement',
        help: 'Required: -0.3 neutral deduction if missing. A one-leg balance (I.61, I.62) or a jump from the WG list (I.67, I.68, I.74, I.75, I.115-I.117, I.43, II.8); it need not be a counting skill. Ticked automatically for those skills from the list.' });
    }
    if (WG.fxStartTumbling.ucg_levels.includes(level)) {
      o.push({ id: 'tumbleStart', kind: 'check', value: WG.fxStartTumbling.neutral, deduction: true, detect: true, label: 'Starts with a tumbling pass',
        help: "Required: -0.3 neutral deduction if the routine doesn't start with a tumbling pass. Ticked automatically when the first skill listed is from EG II, III or IV." });
    }
  }
  if (event === 'ph' && level === 'dev') {
    o.push({ id: 'mushroom', kind: 'mushroom', label: 'Mushroom bonus', help: '+0.1 per circle, +0.2 per other skill; top 5 count, max +1.0' });
  }
  if (event === 'sr' && level !== 'masters') {
    o.push({ id: 'strength', kind: 'check', value: 0.3, label: 'C or higher strength skill', help: 'One-time +0.3' });
    if (level === 'adv') {
      o.push({ id: 'swingHs', kind: 'check', value: 0.3, deduction: true, detect: true, label: 'Routine includes a swing to handstand',
        help: 'Required: -0.3 neutral deduction if missing. Ticked automatically for I.75, I.81, I.86, I.87 or I.88 from the skill list.' });
    }
  }
  if (event === 'hb' && level !== 'masters') {
    o.push({ id: 'connCC', kind: 'count', connect: true, value: 0.1, max: 5, label: 'C + C connection', help: 'Flight to flight, or in bar to flight / flight to in bar with no intermediate swing: +0.1 each. Mark connected skills with Connect skills (under the routine) to count them.' });
  }
  return o;
}

// Connection bonuses, from the skills the gymnast links (`link`: connected to the next
// skill): which linked pairs earn each option. Rank: A=1, B=2, ... (Masters letters 0).
const RANK = (it) => 'ABCDEFGHIJ'.indexOf(String(it.letter || '').toUpperCase()) + 1;
const B_OR_C = (it) => RANK(it) === 2 || RANK(it) === 3;
const CONNECT = {
  conn1: ([a, b]) => (RANK(a) >= 4 && B_OR_C(b)) || (B_OR_C(a) && RANK(b) >= 4),
  conn2: ([a, b]) => RANK(a) >= 4 && RANK(b) >= 4,
  // High bar: flight (EG II) to flight, or in bar (EG III) to flight and back.
  connCC: ([a, b]) => RANK(a) >= 3 && RANK(b) >= 3 && (a.eg === 2 || b.eg === 2) && [2, 3].includes(a.eg) && [2, 3].includes(b.eg),
};
function linkedPairs(items) {
  const live = items.filter((it) => it.status !== 'blank');
  return live.slice(1).map((b, k) => [live[k], b]).filter(([a, b]) => a.link && a.status !== 'repeat' && b.status !== 'repeat');
}

// Avoid floating point noise (0.1 + 0.2 etc.).
export const round1 = (n) => Math.round(n * 10) / 10;
export const fmt = (n) => Number(n || 0).toFixed(1);

export function letterValue(letter) {
  const l = String(letter || '');
  return LETTER_VALUES[l] ?? LETTER_VALUES[l.toUpperCase()] ?? 0;
}

// A skill re-valued as "not credited at this level" (revalue.js) counts for nothing, routine length included.
const isFilled = (s) => !!(s && !s.noCredit && (String(s.name || '').trim() || s.letter));
export const SR_MAX_STATIC = 3; // WG rings: EG II/III skills before a B or higher EG I skill

// "Back giant", "backgiant" and "Back-Giant" are the same skill.
// Repeat matching ignores case, spaces and punctuation, but not fractions: "¾ front
// somersault" and "front somersault" are different skills (¾ -> 3/4 -> "34").
const FRACTIONS = { '½': '1/2', '¼': '1/4', '¾': '3/4' };
export const skillKey = (name) =>
  String(name || '').toLowerCase().replace(/[½¼¾]/g, (c) => FRACTIONS[c]).replace(/[^a-z0-9]/g, '');

// Element group bonus for one group, from the highest-value counting skill in it (not Masters).
function groupBonus(level, event, eg, value) {
  if (level === 'dev') return 0.5;
  if (eg === 1) return 0.5;
  if (level === 'int') return value >= 0.2 ? 0.5 : 0.3;
  // Advanced: the dismount group is worth the dismount's value (max 0.5),
  // except on floor, which has no dismount group.
  if (eg === 4 && event !== 'fx') return Math.min(value, WG.dismountEgMax);
  return value >= 0.4 ? 0.5 : value >= 0.3 ? 0.4 : 0.3;
}

/**
 * The routine's dismount among the skills still in play (no status yet): the last one listed.
 * Floor: the last skill that isn't EG I (an acro element may end in a straight jump; the acro element
 * is the dismount). Other apparatus: an EG IV skill, or a last skill with no group (typed in, or a
 * Sub-A dismount).
 */
export function dismountOf(event, items) {
  const live = items.filter((it) => !it.status);
  if (event === 'fx') return live.findLast((it) => it.eg !== 1) || null;
  const last = live.at(-1);
  if (last && (last.eg === 4 || !last.eg)) return last;
  return live.findLast((it) => it.eg === 4) || null;
}

// Masters element groups (UCG Masters Rules Policy §III.B.2): each group's bonus comes from its best
// counting skill, +0.3 or +0.5 by the skill's level and the decade (masters.js). The dismount group
// (not on floor) is worth the dismount's value, max 0.5 (Nate, N1).
function mastersGroups(event, rows, decade) {
  const out = {};
  for (const g of [1, 2, 3, 4]) {
    const dismountGroup = g === 4 && event !== 'fx';
    const best = rows
      .filter((r) => r.eg === g && meetsRequirement(r.letter, decade))
      .map((r) => ({ row: r, bonus: dismountGroup ? Math.min(r.value, DISMOUNT_EG_MAX) : magEgBonus(r.letter, decade) }))
      .filter((x) => x.bonus > 0)
      .sort((a, b) => b.bonus - a.bonus || b.row.value - a.row.value || a.row.idx - b.row.idx)[0];
    if (best) out[g] = best;
  }
  return out;
}

function mastersTotal(event, rows, decade) {
  const eg = Object.values(mastersGroups(event, rows, decade)).reduce((t, x) => t + x.bonus, 0);
  const short = Math.max(0, countingTotal(decade) - rows.filter((r) => meetsRequirement(r.letter, decade)).length);
  return round1(rows.reduce((t, r) => t + r.value, 0) + eg - short);
}

/**
 * Masters counting skills: the dismount plus the best 6 others (5 from 60). There is no limit per
 * element group, but a skill that fills a group must be counting: the judge swaps it in for a
 * higher-valued skill when that is to the gymnast's benefit (§III.B.2.c). Tries every set of the
 * groups the best skills leave empty; ties keep the plain best skills.
 */
function mastersCounting(event, candidates, dismount, decade) {
  const n = bestCount(decade);
  const meets = (it) => (meetsRequirement(it.letter, decade) ? 1 : 0);
  const sorted = candidates.filter((it) => it !== dismount).sort((a, b) => b.value - a.value || meets(b) - meets(a) || a.idx - b.idx);
  const groups = event === 'fx' ? [1, 2, 3, 4] : [1, 2, 3];
  const fills = (it, g) => it.eg === g && magEgBonus(it.letter, decade) > 0;
  const withDismount = (set) => (dismount ? [...set, dismount] : set);
  const base = sorted.slice(0, n);
  const open = groups.filter((g) => !base.some((it) => fills(it, g)) && sorted.some((it) => fills(it, g)));
  let best = { set: base, total: mastersTotal(event, withDismount(base), decade) };
  for (let mask = 1; mask < 1 << open.length; mask++) {
    const forced = open.filter((_, i) => mask & (1 << i)).map((g) => sorted.find((it) => fills(it, g)));
    if (forced.length > n) continue;
    const set = [...forced, ...sorted.filter((it) => !forced.includes(it)).slice(0, n - forced.length)];
    const total = mastersTotal(event, withDismount(set), decade);
    if (total > best.total) best = { set, total };
  }
  return { counting: new Set(withDismount(best.set)), base: new Set(base) };
}

/**
 * Score one routine (floor, pommel, rings, p-bars or high bar).
 * skills: the whole routine in order, [{ name, letter, eg }] (blank rows allowed).
 *   - Each skill counts once: a later skill with the same name (ignoring case,
 *     spaces and punctuation) is a repeat and doesn't count.
 *   - Rings (WG rule): only the first 3 EG II/III skills count until a B or
 *     higher EG I skill is performed (reason 'sr').
 *   - The level's highest-value skills count (6 Developmental, 8 otherwise),
 *     at most 4 from one element group. Ties: the earlier skill wins.
 * options: { [optionId]: true | number } for the event's bonus options.
 *
 * Returns:
 *   items   one entry per input row with status 'blank' | 'counting' |
 *           'noncounting' | 'repeat' (repeatOf) and, for non-counting skills,
 *           reason 'top' | 'eg' (over the 4-per-group limit) | 'sr'
 *   rows    counting skills in routine order
 *   and totals.
 */
export function scoreRoutine(event, level, skills = [], options = {}, { decade } = {}) {
  const L = LEVELS[level] || LEVELS.int;
  const value = (letter) => (L.masters ? mastersValue(letter, decade) ?? 0 : letterValue(letter));
  const items = skills.map((s, idx) => ({
    idx,
    name: String(s?.name || '').trim(),
    letter: s?.letter || '',
    value: value(s?.letter),
    eg: s?.eg ? Number(s.eg) : null,
    skillId: s?.skillId || '',
    link: !!s?.link, // floor / high bar: connected to the next skill
    bonus: 0,
    status: isFilled(s) ? null : 'blank',
  }));

  const firstSeen = new Map();
  for (const it of items) {
    if (it.status) continue;
    const key = skillKey(it.name);
    if (key && firstSeen.has(key)) {
      it.status = 'repeat';
      it.repeatOf = firstSeen.get(key);
    } else if (key) firstSeen.set(key, it.idx);
  }

  // WG MAG 12.2.2.3. The UCG Masters Rules Policy (III.B.3.d.2) waives it at Masters.
  if (event === 'sr' && !L.masters) {
    let statics = 0;
    for (const it of items) {
      if (it.status) continue;
      if (it.eg === 1 && it.value >= 0.2) break;
      if (it.eg === 2 || it.eg === 3) {
        statics++;
        if (statics > SR_MAX_STATIC) {
          it.status = 'noncounting';
          it.reason = 'sr';
        }
      }
    }
  }

  // High bar, Advanced (WG §15.2.2.5 c, MAG-NL-1; Nate 2026-10-20): at most two flights of each style
  // count (the highest-valued; the earlier on a tie).
  if (event === 'hb' && level === 'adv') {
    const byStyle = {};
    for (const it of items) if (!it.status && HB_FLIGHT_STYLE[it.skillId]) (byStyle[HB_FLIGHT_STYLE[it.skillId]] ||= []).push(it);
    for (const [style, list] of Object.entries(byStyle)) {
      for (const it of list.sort((a, b) => b.value - a.value || a.idx - b.idx).slice(MAX_PER_STYLE)) Object.assign(it, { status: 'noncounting', reason: 'style', style });
    }
  }

  const candidates = items.filter((it) => !it.status);
  // WG counts the dismount first, then the best others (Intermediate, Advanced, Masters).
  const dismount = L.dismountFirst || L.masters ? dismountOf(event, items) : null;
  if (L.masters) {
    const { counting, base } = mastersCounting(event, candidates, dismount, decade);
    for (const it of candidates) {
      it.status = counting.has(it) ? 'counting' : 'noncounting';
      if (!counting.has(it)) it.reason = base.has(it) ? 'swap' : 'top';
    }
  } else {
    // High bar, Advanced (WG §15.2.2.6, MAG-NL-1): a 5th flight (EG II) counts when two flights are
    // directly connected, C + C or better.
    const fifthFlight = event === 'hb' && level === 'adv' && linkedPairs(items).some((p) => p.every((x) => x.eg === 2 && RANK(x) >= 3));
    const egMax = (g) => (g === 2 && fifthFlight ? MAX_PER_EG + 1 : MAX_PER_EG);
    const perGroup = {};
    let counted = 0;
    const rest = candidates.filter((it) => it !== dismount).sort((a, b) => b.value - a.value || a.idx - b.idx);
    for (const it of dismount ? [dismount, ...rest] : rest) {
      if (it.eg && (perGroup[it.eg] || 0) >= egMax(it.eg)) {
        it.status = 'noncounting';
        it.reason = 'eg';
      } else if (counted >= L.maxSkills) {
        it.status = 'noncounting';
        it.reason = 'top';
      } else {
        it.status = 'counting';
        counted++;
        if (it.eg) perGroup[it.eg] = (perGroup[it.eg] || 0) + 1;
      }
    }
  }

  const rows = items.filter((it) => it.status === 'counting');

  // Each element group's bonus goes to its highest-value counting skill
  // (the earliest one on a tie).
  const egBonus = {};
  if (L.masters) {
    for (const [g, { row, bonus }] of Object.entries(mastersGroups(event, rows, decade))) {
      row.bonus = bonus;
      egBonus[g] = bonus;
    }
  }
  for (const g of L.masters ? [] : [1, 2, 3, 4]) {
    const best = rows
      .filter((r) => r.eg === g && r.letter)
      .sort((a, b) => b.value - a.value || a.idx - b.idx)[0];
    if (!best) continue;
    best.bonus = groupBonus(level, event, g, best.value);
    egBonus[g] = best.bonus;
  }
  let egTotal = Object.values(egBonus).reduce((t, b) => t + b, 0);
  if (level === 'dev') egTotal = Math.min(egTotal, 1.5); // only 3 groups count
  egTotal = round1(egTotal);

  const difficulty = round1(rows.reduce((t, r) => t + r.value, 0));

  let bonus = 0;
  let deductions = 0;
  const optionValues = {};
  const detected = {}; // option id -> the skill that meets it
  for (const o of eventOptions(event, level)) {
    const v = options?.[o.id];
    let got = 0;
    if (o.detect) {
      const hit = DETECT[o.id](items.filter((it) => it.status !== 'blank'));
      if (hit) detected[o.id] = hit.name;
    }
    if (o.kind === 'check' && o.deduction) {
      if (!v && !detected[o.id]) deductions += o.value;
      continue;
    }
    if (o.kind === 'check' && (v || detected[o.id])) got = o.value;
    if (o.kind === 'count' && o.connect) {
      // Each different pair of skills counts once.
      const seen = new Set();
      const hits = linkedPairs(items).filter((p) => CONNECT[o.id](p) && !seen.has(p.map((x) => skillKey(x.name)).join('>')) && seen.add(p.map((x) => skillKey(x.name)).join('>')));
      if (hits.length) detected[o.id] = hits.map((p) => p.map((x) => (x.name || `Skill ${x.idx + 1}`).replace(/\.+$/, '')).join(' + ')).join('; ');
      got = Math.min(hits.length, o.max) * o.value;
    } else if (o.kind === 'count') got = Math.min(Math.max(0, Number(v) || 0), o.max) * o.value;
    if (o.kind === 'mushroom') got = Math.min(Math.max(0, Number(v) || 0), 1);
    optionValues[o.id] = round1(got);
    bonus += got;
  }
  bonus = round1(bonus);
  deductions = round1(deductions);

  // Masters: 7 skills (6 from 60), including the dismount: a routine without one is short by one.
  // GE skills only count toward routine length from the 50s up.
  const lengthRows = L.masters ? rows.filter((r) => meetsRequirement(r.letter, decade)) : rows;
  const minSkills = minSkillsFor(level, decade);
  const shortBy = Math.max(0, minSkills - lengthRows.length);
  const shortDeduction = round1(shortBy * L.shortDeduction);
  const raw = round1(EXECUTION + difficulty + egTotal + bonus);
  const capped = L.cap != null && raw > L.cap;
  const startValue = rows.length ? round1((capped ? L.cap : raw) - shortDeduction) : 0;

  return {
    items,
    rows,
    difficulty,
    egBonus,
    egTotal,
    bonus,
    optionValues,
    detected,
    shortBy,
    shortDeduction,
    minSkills,
    dismount: dismount && dismount.status === 'counting' ? dismount.idx : null,
    raw,
    capped,
    cap: L.cap,
    startValue,
    deductions: rows.length ? deductions : 0,
    afterDeductions: rows.length ? round1(startValue - deductions) : 0,
  };
}

export const MAG_MASTERS_VAULTS = MASTERS_VAULTS.filter((v) => v.disc === 'mag');

// Developmental bans flipping and round-off-entry vaults (UCG MAG Rules Breakdown, Vault row).
export const devBanned = (v) => !!(v.flipping || v.roundoff);

// Masters offers the WG vaults and the Masters CoP vaults, never the UCG MAG CoP's own vaults
// (Nate 2026-10-20).
const UCG_MAG_VAULTS = new Set(VAULTS.filter((v) => v.src === 'UCG').map((v) => v.id));
export const offeredAt = (level, v) => level !== 'masters' || !UCG_MAG_VAULTS.has(v.id);

export function findVault(id, level) {
  const v = VAULTS.find((x) => x.id === String(id)) ?? MAG_MASTERS_VAULTS.find((x) => x.id === id) ?? null;
  return v && (level === undefined || offeredAt(level, v)) ? v : null;
}

// Masters: a vault in neither the WG Code nor the Masters CoP is worth 0.0 plus the age bonus.
export const OTHER_VAULT = { id: 'other', name: 'Other vault (not in the WG Code or the Masters CoP)', eponym: '', eg: '', value: 0, adv: 0, flipping: false, src: 'Custom' };

export function scoreVault(level, id, { decade } = {}) {
  const L = LEVELS[level] || LEVELS.int;
  const v = id === 'other' && L.masters ? OTHER_VAULT : findVault(id, level);
  if (!v) return null;
  if (L.masters) {
    const ageBonus = vaultAgeBonus('mag', decade);
    return { ...v, dv: v.value, ageBonus, banned: false, capped: false, raw: round1(EXECUTION + v.value + ageBonus), startValue: round1(EXECUTION + v.value + ageBonus) };
  }
  const dv = level === 'adv' ? v.adv : v.value;
  if (level === 'dev' && devBanned(v)) {
    return { ...v, dv, banned: true, capped: false, startValue: 0 };
  }
  const raw = round1(EXECUTION + dv);
  const capped = L.cap != null && raw > L.cap;
  return { ...v, dv, banned: false, raw, capped, startValue: capped ? L.cap : raw };
}

export function scoreAthlete(athlete) {
  const level = LEVELS[athlete.level] ? athlete.level : 'int';
  const ctx = { decade: athlete.decade };
  const vault = scoreVault(level, athlete.vault, ctx);
  const events = Object.fromEntries(
    EVENTS.map((e) => [e, scoreRoutine(e, level, athlete.routines?.[e] || [], athlete.options?.[e] || {}, ctx)])
  );
  const allAround = round1((vault?.startValue || 0) + EVENTS.reduce((t, e) => t + events[e].startValue, 0));
  return { level, vault, events, allAround };
}
