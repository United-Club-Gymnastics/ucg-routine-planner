// UCG MAG start value rules (2026-2028), from the UCG MAG Rules breakdown and
// rules policy, the MAG start value worksheets, and the MAG Routine
// Composition Planner spreadsheet.
import { VAULTS } from '../data/mag-vaults.js';
import { VAULTS as MASTERS_VAULTS } from '../data/masters-vaults.js';
import { MASTERS_LETTERS, mastersValue, meetsRequirement, vaultAgeBonus } from './masters.js';

// Rings: the five WG skills that meet the swing to handstand requirement (WG clarification).
export const SWING_HS = ['WG-SR-I-75', 'WG-SR-I-81', 'WG-SR-I-86', 'WG-SR-I-87', 'WG-SR-I-88'];

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
};

export const EXECUTION = 10;
export const MIN_SKILLS = 6;
export const MAX_ROUTINE = 20; // skills a routine list can hold (counting + non-counting)
export const MAX_PER_EG = 4; // WG: at most 4 counting skills from one element group

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
  int: {
    label: 'Intermediate',
    maxSkills: 8,
    shortDeduction: 1.0,
    cap: 13.1,
  },
  adv: {
    label: 'Advanced (GymACT)',
    maxSkills: 8,
    shortDeduction: 1.0,
    cap: null,
  },
  // Values depend on the age decade (masters.js); no cap.
  masters: {
    label: 'Masters',
    maxSkills: 6,
    shortDeduction: 1.0,
    cap: null,
    masters: true,
  },
};
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
  if (event === 'fx') {
    o.push({ id: 'conn1', kind: 'count', value: 0.1, max: 5, label: 'D or higher + B/C connection', help: '+0.1 each' });
    o.push({ id: 'conn2', kind: 'count', value: 0.2, max: 5, label: 'D or higher + D or higher connection', help: '+0.2 each' });
    if (level === 'adv') {
      o.push({ id: 'dblDismount', kind: 'check', value: 0.1, detect: true, label: 'Double flipping dismount',
        help: '+0.1. Ticked automatically when the last skill listed is a double or triple salto.' });
      o.push({ id: 'dblFlip', kind: 'check', value: 0.3, deduction: true, detect: true, label: 'Routine includes a double flip',
        help: 'Required: -0.3 neutral deduction if missing. Ticked automatically for a double salto from the skill list.' });
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
  if (event === 'hb') {
    o.push({ id: 'connCC', kind: 'count', value: 0.1, max: 5, label: 'C + C connection', help: 'Flight to flight, or in bar to flight / flight to in bar with no intermediate swing: +0.1 each' });
  }
  return o;
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

// Element group bonus for one group, from the highest-value counting skill in it.
function groupBonus(level, event, eg, value) {
  // Masters: +0.5 per group; the dismount group is worth the dismount's value.
  if (level === 'masters') return eg === 4 && event !== 'fx' ? value : 0.5;
  if (level === 'dev') return 0.5;
  if (eg === 1) return 0.5;
  if (level === 'int') return value >= 0.2 ? 0.5 : 0.3;
  // Advanced: the dismount group is worth the dismount's value (max 0.5),
  // except on floor, which has no dismount group.
  if (eg === 4 && event !== 'fx') return Math.min(value, 0.5);
  return value >= 0.4 ? 0.5 : value >= 0.3 ? 0.4 : 0.3;
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

  if (event === 'sr') {
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

  const perGroup = {};
  let counted = 0;
  const candidates = items.filter((it) => !it.status);
  for (const it of [...candidates].sort((a, b) => b.value - a.value || a.idx - b.idx)) {
    if (it.eg && (perGroup[it.eg] || 0) >= MAX_PER_EG) {
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

  const rows = items.filter((it) => it.status === 'counting');

  // Each element group's bonus goes to its highest-value counting skill
  // (the earliest one on a tie).
  const egBonus = {};
  for (const g of [1, 2, 3, 4]) {
    const best = rows
      .filter((r) => r.eg === g && r.letter && (!L.masters || meetsRequirement(r.letter, decade)))
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
    if (o.kind === 'count') got = Math.min(Math.max(0, Number(v) || 0), o.max) * o.value;
    if (o.kind === 'mushroom') got = Math.min(Math.max(0, Number(v) || 0), 1);
    optionValues[o.id] = round1(got);
    bonus += got;
  }
  bonus = round1(bonus);
  deductions = round1(deductions);

  // Masters: Misc skills only count toward routine length from the 50s up.
  const lengthRows = L.masters ? rows.filter((r) => meetsRequirement(r.letter, decade)) : rows;
  const shortBy = Math.max(0, MIN_SKILLS - lengthRows.length);
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
    raw,
    capped,
    cap: L.cap,
    startValue,
    deductions: rows.length ? deductions : 0,
    afterDeductions: rows.length ? round1(startValue - deductions) : 0,
  };
}

export const MAG_MASTERS_VAULTS = MASTERS_VAULTS.filter((v) => v.disc === 'mag');

export function findVault(id) {
  return VAULTS.find((v) => v.id === String(id)) ?? MAG_MASTERS_VAULTS.find((v) => v.id === id) ?? null;
}

// Masters: a vault not in the WG or UCG CoP is worth 0.0 plus the age bonus.
export const OTHER_VAULT = { id: 'other', name: 'Other vault (not in the WG or UCG CoP)', eponym: '', eg: '', value: 0, adv: 0, flipping: false, src: 'Custom' };

export function scoreVault(level, id, { decade } = {}) {
  const L = LEVELS[level] || LEVELS.int;
  const v = id === 'other' && L.masters ? OTHER_VAULT : findVault(id);
  if (!v) return null;
  if (L.masters) {
    const ageBonus = vaultAgeBonus('mag', decade);
    return { ...v, dv: v.value, ageBonus, banned: false, capped: false, raw: round1(EXECUTION + v.value + ageBonus), startValue: round1(EXECUTION + v.value + ageBonus) };
  }
  const dv = level === 'adv' ? v.adv : v.value;
  if (level === 'dev' && v.flipping) {
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
