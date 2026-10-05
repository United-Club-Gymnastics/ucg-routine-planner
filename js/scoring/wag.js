// UCG WAG start values: UCG Infinity (open scoring; ported from Julia Sharpe's
// UCG Infinity SV Sheets), the UCG Xcel levels, and WAG Masters.
import { VAULTS as INFINITY_VAULTS } from '../data/wag-infinity-vaults.js';
import { XCEL_LIMITS, XCEL_SR, XCEL_SILVER_VAULTS, XCEL_VAULTS, XCEL_VP } from '../data/xcel.js';
import { VAULTS as SAPPHIRE_L910_VAULTS } from '../data/sapphire-vaults.js';
import { MASTERS_LETTERS, mastersValue, meetsRequirement, vaultAgeBonus } from './masters.js';
import { VAULTS as WG_VAULTS } from '../data/wag-vaults.js';
import { VAULTS as MASTERS_VAULTS } from '../data/masters-vaults.js';

export const EXECUTION = 10;
export const MIN_SKILLS = 6;
export const round1 = (n) => Math.round(n * 10) / 10;
const isFilled = (s) => !!(s && (String(s.name || '').trim() || s.letter));
export const skillKey = (name) => String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
export const XCEL_LEVELS = ['silver', 'gold', 'plat', 'diamond', 'sapphire'];

// ---- Element groups ---------------------------------------------------------

// UCG Infinity: USAG DP / Xcel element groups, condensed into I-IV.
export const INFINITY_GROUPS = {
  ub: {
    groups: { 1: 'Mounts', 2: 'Casts/Counterswings', 3: 'Underswings/Clear Hips', 4: 'Giant Swings Backward', 5: 'Giant Swings/Circles Fwd.', 6: 'Stalder Circles', 7: 'Circle Swings/Hechts', 8: 'Dismounts' },
    condensed: { I: [1, 8], II: [2], III: [3, 6, 7], IV: [4, 5] },
    eventBonus: 'Minimum of 2 bar changes',
  },
  bb: {
    groups: { 1: 'Mounts', 2: 'Leaps/Jumps/Hops', 3: 'Turns', 4: 'Waves', 5: 'Holds/Stands', 6: 'Rolls', 7: 'Walkovers/Cartwheels etc.', 8: 'Saltos', 9: 'Dismounts' },
    condensed: { I: [1, 9], II: [2, 3], III: [4, 5, 6], IV: [7, 8] },
    eventBonus: 'Acro series with 2 connected flight elements on beam',
  },
  fx: {
    groups: { 1: 'Leaps/Jumps/Hops', 2: 'Turns', 3: 'Handstands', 4: 'Rolls', 5: 'Walkovers/Cartwheels etc.', 6: 'Saltos Forward', 7: 'Saltos Sideward/Arabians', 8: 'Saltos Backward' },
    condensed: { I: [1, 2], II: [3, 4, 5], III: [6, 7], IV: [8] },
    eventBonus: 'Acro pass with min. of 2 connected saltos (direct or indirect)',
  },
};

// WAG Masters: WG groups condensed into I-IV (Masters Rules Policy).
export const MASTERS_GROUPS = {
  ub: { 1: 'Mounts', 2: 'Casts, clear hip, stalder and pike circles', 3: 'Giant circles', 4: 'Dismounts' },
  bb: { 1: 'Leaps, jumps and hops', 2: 'Turns', 3: 'Holds and acro (non-flight and flight)', 4: 'Mounts and dismounts' },
  fx: { 1: 'Leaps, jumps and hops', 2: 'Turns', 3: 'Hand support elements', 4: 'Saltos forward, sideward and backward' },
};

const ROMAN = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV' };

// ---- UCG Infinity ----------------------------------------------------------

export const INFINITY_VALUES = { A: 0.1, B: 0.3, C: 0.5, D: 0.7, E: 0.9 };
export const INFINITY_MAX_SKILLS = 8;
export const INFINITY_EG_BONUS = 0.3;
export const INFINITY_EVENT_BONUS = 0.3;

const condensedOf = (event, eg) => {
  const c = INFINITY_GROUPS[event].condensed;
  return Object.keys(c).find((k) => c[k].includes(Number(eg))) ?? null;
};

/**
 * UCG Infinity bars / beam / floor. The 8 highest-value skills count; +0.3 per
 * condensed group with a B or higher skill (counting or not); +0.3 apparatus
 * bonus; -1.0 per skill under 6.
 */
export function scoreInfinity(event, skills = [], { eventBonus = false } = {}) {
  const items = baseItems(skills, (l) => INFINITY_VALUES[l] ?? 0);
  for (const it of items) it.condensed = it.eg ? condensedOf(event, it.eg) : null;
  markRepeats(items);
  const cand = items.filter((it) => !it.status);
  const counting = new Set([...cand].sort((a, b) => b.value - a.value || a.idx - b.idx).slice(0, INFINITY_MAX_SKILLS).map((it) => it.idx));
  for (const it of cand) {
    it.status = counting.has(it.idx) ? 'counting' : 'noncounting';
    if (it.status === 'noncounting') it.reason = 'top';
  }
  const rows = items.filter((it) => it.status === 'counting');
  const earned = new Set();
  for (const list of [rows, items.filter((it) => it.status === 'noncounting')]) {
    for (const r of list) {
      if (r.condensed && r.value >= 0.3 && !earned.has(r.condensed)) {
        earned.add(r.condensed);
        r.bonus = INFINITY_EG_BONUS;
        if (r.status === 'noncounting') r.reason = 'egOnly';
      }
    }
  }
  const difficulty = round1(rows.reduce((t, r) => t + r.value, 0));
  const egTotal = round1(earned.size * INFINITY_EG_BONUS);
  const bonus = eventBonus ? INFINITY_EVENT_BONUS : 0;
  const shortBy = Math.max(0, MIN_SKILLS - rows.length);
  const sv = rows.length ? round1(EXECUTION + difficulty + egTotal + bonus - shortBy) : null;
  return {
    items, rows, difficulty, egTotal, bonus, shortBy, sv,
    earnedGroups: [...earned].map((k) => ({ I: 1, II: 2, III: 3, IV: 4 })[k]),
    totals: [['Execution', 10], ['Difficulty', difficulty], ['EG bonus', egTotal], ['Apparatus bonus', bonus], [`Short of ${MIN_SKILLS}`, -shortBy]],
  };
}

export function findInfinityVault(id) {
  return INFINITY_VAULTS.find((v) => v.name === id) ?? null;
}
export const INFINITY_VAULT_LIST = INFINITY_VAULTS;

export function scoreInfinityVault(id) {
  const v = findInfinityVault(id);
  return v ? { ...v, dv: v.dv, sv: round1(v.dv + EXECUTION) } : null;
}

// ---- Xcel ----------------------------------------------------------------

export const XCEL_LETTERS = ['A', 'B', 'C', 'D', 'E'];
const XCEL_VALUE = { A: 0.1, B: 0.3, C: 0.5, D: 0.5, E: 0.5 };
const RANK = { A: 1, B: 2, C: 3, D: 4, E: 5 };
export const XCEL_RESTRICTED = 0.5;
export const XCEL_MISSING_SR = 0.5;

/**
 * Xcel bars / beam / floor: start from 10.0 (Sapphire 9.6 + up to 0.4 bonus),
 * -0.50 per missing Special Requirement, minus the value of each missing Value
 * Part, -0.50 per restricted skill. srMet: [bool x4]. bonus: Sapphire only.
 */
export function scoreXcel(level, event, skills = [], { srMet = [], bonus = 0 } = {}) {
  const items = baseItems(skills, (l) => XCEL_VALUE[l] ?? 0);
  markRepeats(items);
  const limit = XCEL_LIMITS[level][event];
  let topLetterCount = 0;
  for (const it of items) {
    if (it.status || !it.letter) continue;
    const over = RANK[it.letter] > RANK[limit.max];
    const atMax = it.letter === limit.max && limit.maxCount != null && ++topLetterCount > limit.maxCount;
    if (over || atMax) {
      it.status = 'restricted';
      it.reason = 'restricted';
    }
  }
  const usable = items.filter((it) => !it.status && it.letter).sort((a, b) => RANK[b.letter] - RANK[a.letter] || a.idx - b.idx);
  const req = XCEL_VP[level];
  const used = new Set();
  const missing = [];
  for (const need of req) {
    const fill = usable.find((it) => !used.has(it.idx) && RANK[it.letter] >= RANK[need]);
    if (fill) {
      used.add(fill.idx);
      fill.vp = need;
    } else missing.push(need);
  }
  for (const it of items) {
    if (it.status) continue;
    it.status = used.has(it.idx) ? 'counting' : 'noncounting';
    if (it.status === 'noncounting') it.reason = it.letter ? 'extraVp' : 'noValue';
  }
  const restricted = items.filter((it) => it.status === 'restricted').length;
  const srCount = XCEL_SR[level][event].length;
  const srMissing = Array.from({ length: srCount }, (_, i) => !srMet[i]).filter(Boolean).length;
  const vpMissing = round1(missing.reduce((t, l) => t + XCEL_VALUE[l], 0));
  const base = level === 'sapphire' ? 9.6 : 10;
  const sapphireBonus = level === 'sapphire' ? Math.min(0.4, Math.max(0, Number(bonus) || 0)) : 0;
  const any = items.some((it) => it.status !== 'blank');
  const sv = any ? round1(base + sapphireBonus - srMissing * XCEL_MISSING_SR - vpMissing - restricted * XCEL_RESTRICTED) : null;
  return {
    items, sv, srMissing, vpMissing, missingVp: missing, restricted, base, bonus: sapphireBonus,
    totals: [
      ['Start', base],
      ...(level === 'sapphire' ? [['Bonus', sapphireBonus]] : []),
      ['Missing SRs', -srMissing * XCEL_MISSING_SR],
      ['Missing VPs', -vpMissing],
      ['Restricted', -restricted * XCEL_RESTRICTED],
    ],
  };
}

export function xcelVaults(level) {
  if (level === 'silver') return XCEL_SILVER_VAULTS.map((v) => ({ id: v.code, label: v.name, sv: v.sv }));
  const list = XCEL_VAULTS.filter((v) => (level === 'gold' ? v.gold : v[level] != null)).map((v) => ({
    id: v.code, label: `${v.code} · ${v.name}`, sv: level === 'gold' ? 10.0 : v[level],
  }));
  if (level === 'sapphire') {
    // USAG Level 9/10 vaults not in the Sapphire chart: 10.0 (UCG Women's Rules II.B.2).
    for (const v of SAPPHIRE_L910_VAULTS) list.push({ id: v.id, label: `${v.code} · ${v.name}`, sv: v.sv, l910: true });
    list.push({ id: 'l9l10', label: 'Other USAG Level 9 or 10 vault (not in the Sapphire chart)', sv: 10.0, l910: true });
  }
  return list;
}

export function scoreXcelVault(level, id, { altBoard = false } = {}) {
  const v = xcelVaults(level).find((x) => x.id === id);
  if (!v) return null;
  const sv = level === 'gold' && altBoard ? 9.5 : v.sv;
  return { ...v, sv };
}

// ---- WAG Masters -------------------------------------------------------------

/**
 * WAG Masters bars / beam / floor: the 6 highest-value skills count; +0.5 per
 * condensed group with a skill at the decade's level (any skill in the routine);
 * -1.0 per counting skill under 6.
 */
export function scoreWagMasters(event, skills = [], { decade } = {}) {
  const items = baseItems(skills, (l) => mastersValue(l, decade) ?? 0);
  markRepeats(items);
  const cand = items.filter((it) => !it.status);
  const counting = new Set([...cand].sort((a, b) => b.value - a.value || a.idx - b.idx).slice(0, MIN_SKILLS).map((it) => it.idx));
  for (const it of cand) {
    it.status = counting.has(it.idx) ? 'counting' : 'noncounting';
    if (it.status === 'noncounting') it.reason = 'top';
  }
  const rows = items.filter((it) => it.status === 'counting');
  const earned = new Set();
  for (const list of [rows, items.filter((it) => it.status === 'noncounting')]) {
    for (const r of list) {
      if (r.eg && meetsRequirement(r.letter, decade) && !earned.has(r.eg)) {
        earned.add(r.eg);
        r.bonus = 0.5;
        if (r.status === 'noncounting') r.reason = 'egOnly';
      }
    }
  }
  const difficulty = round1(rows.reduce((t, r) => t + r.value, 0));
  const egTotal = round1(earned.size * 0.5);
  const shortBy = Math.max(0, MIN_SKILLS - rows.filter((r) => meetsRequirement(r.letter, decade)).length);
  const sv = rows.length ? round1(EXECUTION + difficulty + egTotal - shortBy) : null;
  return {
    items, rows, difficulty, egTotal, shortBy, sv, earnedGroups: [...earned],
    totals: [['Execution', 10], ['Difficulty', difficulty], ['EG bonus', egTotal], [`Short of ${MIN_SKILLS}`, -shortBy]],
  };
}

// WAG Masters vaults: the UCG Masters vaults (squat on, hechts, ...), the WG vault
// table, and any other vault (0.0).
export const WAG_MASTERS_VAULTS = MASTERS_VAULTS.filter((v) => v.disc === 'wag');
export const WAG_WG_VAULTS = WG_VAULTS;
export const WAG_OTHER_VAULT = { id: 'other', name: 'Other vault (not in the WG or UCG CoP)', value: 0, src: 'Custom' };
export const findWagMastersVault = (id) =>
  id === 'other' ? WAG_OTHER_VAULT : WAG_MASTERS_VAULTS.find((v) => v.id === id) || WG_VAULTS.find((v) => v.id === id) || null;

/** WAG Masters vault: the vault's value plus the age bonus. */
export function scoreWagMastersVault(id, { decade } = {}) {
  const v = findWagMastersVault(id);
  if (!v) return null;
  const ageBonus = vaultAgeBonus('wag', decade);
  return { ...v, dv: v.value, ageBonus, sv: round1(EXECUTION + v.value + ageBonus) };
}

// WG element group -> WAG Masters condensed group (Masters Rules Policy).
export const WG_TO_MASTERS = {
  ub: { 1: 1, 2: 2, 4: 2, 5: 2, 3: 3, 6: 4 },
  bb: { 2: 1, 3: 2, 4: 3, 5: 3, 1: 4, 6: 4 },
  fx: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 4 },
};

export const WAG_MASTERS_LETTERS = MASTERS_LETTERS;
export { ROMAN };

// ---- shared ----------------------------------------------------------------

function baseItems(skills, valueOf) {
  return skills.map((s, idx) => ({
    idx,
    name: String(s?.name || '').trim(),
    letter: s?.letter || '',
    value: valueOf(s?.letter || ''),
    eg: s?.eg ? Number(s.eg) : null,
    bonus: 0,
    status: isFilled(s) ? null : 'blank',
  }));
}

function markRepeats(items) {
  const seen = new Map();
  for (const it of items) {
    if (it.status) continue;
    const key = skillKey(it.name);
    if (key && seen.has(key)) {
      it.status = 'repeat';
      it.repeatOf = seen.get(key);
    } else if (key) seen.set(key, it.idx);
  }
}
