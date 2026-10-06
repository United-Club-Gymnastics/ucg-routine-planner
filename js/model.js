// Disciplines, levels and events, and one scoring entry point for all of them.
// An athlete has entries: one per level they compete ({ disc, level, ... }).
import * as mag from './scoring/mag.js';
import * as wag from './scoring/wag.js';
import * as tt from './scoring/tt.js';
import { XCEL_SR } from './data/xcel.js';
import { DECADES, DECADE_LABELS, DEFAULT_DECADE, MASTERS_LETTERS } from './scoring/masters.js';

export { DECADES, DECADE_LABELS, DEFAULT_DECADE };
export const round1 = (n) => Math.round(n * 10) / 10;
export const fmt = (n) => (n == null || Number.isNaN(Number(n)) ? '—' : Number(n).toFixed(1));

export const DISCIPLINES = {
  wag: {
    name: 'WAG', full: "Women's artistic gymnastics",
    events: [
      { id: 'vt', label: 'Vault', short: 'Vault', kind: 'vault' },
      { id: 'ub', label: 'Uneven Bars', short: 'Bars', kind: 'routine' },
      { id: 'bb', label: 'Balance Beam', short: 'Beam', kind: 'routine' },
      { id: 'fx', label: 'Floor Exercise', short: 'Floor', kind: 'routine' },
    ],
    levels: [
      { id: 'silver', name: 'Xcel Silver', short: 'Silver', family: 'xcel' },
      { id: 'gold', name: 'Xcel Gold', short: 'Gold', family: 'xcel' },
      { id: 'plat', name: 'Xcel Platinum', short: 'Platinum', family: 'xcel' },
      { id: 'diamond', name: 'Xcel Diamond', short: 'Diamond', family: 'xcel' },
      { id: 'sapphire', name: 'Xcel Sapphire', short: 'Sapphire', family: 'xcel' },
      { id: 'inf', name: 'UCG Infinity', short: 'Infinity', family: 'infinity' },
      { id: 'masters', name: 'Masters', short: 'Masters', family: 'wagMasters', masters: true },
    ],
  },
  mag: {
    name: 'MAG', full: "Men's artistic gymnastics",
    events: [
      { id: 'fx', label: 'Floor Exercise', short: 'Floor', kind: 'routine' },
      { id: 'ph', label: 'Pommel Horse', short: 'Pommel', kind: 'routine' },
      { id: 'sr', label: 'Still Rings', short: 'Rings', kind: 'routine' },
      { id: 'vt', label: 'Vault', short: 'Vault', kind: 'vault' },
      { id: 'pb', label: 'Parallel Bars', short: 'P-Bars', kind: 'routine' },
      { id: 'hb', label: 'High Bar', short: 'High Bar', kind: 'routine' },
    ],
    levels: [
      { id: 'dev', name: 'Developmental', short: 'Dev', family: 'mag' },
      { id: 'int', name: 'Intermediate', short: 'Int', family: 'mag' },
      { id: 'adv', name: 'Advanced (GymACT)', short: 'Adv', family: 'mag' },
      { id: 'masters', name: 'Masters', short: 'Masters', family: 'mag', masters: true },
    ],
  },
  tt: {
    name: 'T&T', full: 'Trampoline and tumbling', noAllAround: true,
    events: [
      { id: 'tr', label: 'Trampoline', short: 'Trampoline', kind: 'tramp' },
      { id: 'dmt', label: 'Double Mini', short: 'Double Mini', kind: 'passes' },
      { id: 'tu', label: 'Tumbling', short: 'Tumbling', kind: 'passes' },
      { id: 'sy', label: 'Synchro Trampoline', short: 'Synchro', kind: 'tramp', synchro: true },
    ],
    levels: [
      { id: 'nf', name: 'New Flyers', short: 'New', family: 'tt' },
      { id: 'if', name: 'Intermediate Flyers', short: 'Inter.', family: 'tt' },
      { id: 'hf', name: 'High Flyers', short: 'High', family: 'tt' },
    ],
  },
};
export const DISC_IDS = Object.keys(DISCIPLINES);

export const levelInfo = (disc, level) => DISCIPLINES[disc]?.levels.find((l) => l.id === level) || null;
export const eventInfo = (disc, ev) => DISCIPLINES[disc].events.find((e) => e.id === ev);
export const entryName = (e) => `${DISCIPLINES[e.disc].name} ${levelInfo(e.disc, e.level)?.name || ''}`;

const ROMAN = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV' };
const groupList = (obj, roman = true) => Object.entries(obj).map(([k, v]) => ({ value: k, label: `${roman ? ROMAN[k] : k}. ${v}` }));

/**
 * What a skill row looks like for an event at a level: the letters offered,
 * element groups (if any), bonus options, Xcel special requirements, and
 * the legend groups shown under the routine.
 */
export function eventSpec(entry, evId) {
  const { disc, level } = entry;
  const ev = eventInfo(disc, evId);
  const fam = levelInfo(disc, level)?.family;
  const spec = { ...ev, family: fam, letters: [], groups: null, legend: [], options: [], sr: null, maxCounting: null, columns: 'letters' };
  if (ev.kind === 'vault') return spec;
  if (disc === 'tt') {
    spec.columns = 'dd';
    return spec;
  }
  if (fam === 'mag') {
    spec.letters = mag.lettersFor(level);
    spec.groups = groupList(mag.APPARATUS[evId].groups);
    spec.legend = Object.entries(mag.APPARATUS[evId].groups).map(([k, v]) => ({ key: Number(k), roman: ROMAN[k], label: v }));
    spec.options = mag.eventOptions(evId, level);
    spec.maxCounting = mag.LEVELS[level].maxSkills;
  } else if (fam === 'infinity') {
    const g = wag.INFINITY_GROUPS[evId];
    spec.letters = Object.keys(wag.INFINITY_VALUES);
    spec.groups = groupList(g.groups, false);
    spec.legend = Object.entries(g.condensed).map(([r, nums]) => ({ key: { I: 1, II: 2, III: 3, IV: 4 }[r], roman: r, label: nums.map((n) => g.groups[n]).join(' · ') }));
    spec.options = [{ id: 'eventBonus', kind: 'check', value: wag.INFINITY_EVENT_BONUS, label: 'Apparatus bonus', help: g.eventBonus }];
    spec.maxCounting = wag.INFINITY_MAX_SKILLS;
  } else if (fam === 'wagMasters') {
    spec.letters = MASTERS_LETTERS;
    spec.groups = groupList(wag.MASTERS_GROUPS[evId]);
    spec.legend = Object.entries(wag.MASTERS_GROUPS[evId]).map(([k, v]) => ({ key: Number(k), roman: ROMAN[k], label: v }));
    spec.maxCounting = 6;
  } else if (fam === 'xcel') {
    spec.letters = wag.XCEL_LETTERS;
    spec.sr = XCEL_SR[level][evId];
    spec.columns = 'xcel';
    // Beam and floor: the gymnast marks which skills are connected (bars routines are continuous).
    spec.links = evId === 'bb' || evId === 'fx';
    if (level === 'sapphire') spec.options = [{ id: 'bonus', kind: 'count', value: 0.1, max: 4, label: 'Sapphire bonus', help: 'Up to +0.40 (connection or difficulty bonus per the Xcel Code)' }];
  }
  return spec;
}

/** Score one event of an entry. Always returns { sv, totals, warnings, notes, ... }. */
export function scoreEvent(entry, evId) {
  const { disc, level } = entry;
  const ev = eventInfo(disc, evId);
  const fam = levelInfo(disc, level)?.family;
  const rows = entry.routines?.[evId] || [];
  const opts = entry.options?.[evId] || {};
  const ctx = { decade: entry.decade };
  const out = { sv: null, totals: [], warnings: [], notes: [], deductions: 0 };

  if (ev.kind === 'vault') {
    if (fam === 'mag') {
      const v = mag.scoreVault(level, entry.vault, ctx);
      if (v) {
        out.sv = v.startValue;
        out.vault = v;
        if (v.banned) out.notes.push('Flipping vaults are not allowed at the Developmental level and score 0. Choose a handspring vault with no salto.');
        if (v.capped) out.notes.push(`Start value capped at ${fmt(mag.LEVELS[level].cap)} (${fmt(v.raw)} before the cap).`);
        out.totals = [['Execution', 10], ['D score', v.dv], ...(v.ageBonus != null ? [['Age bonus', v.ageBonus]] : [])];
      }
    } else if (fam === 'infinity') {
      const v = wag.scoreInfinityVault(entry.vault);
      if (v) Object.assign(out, { sv: v.sv, vault: v, totals: [['Execution', 10], ['D score', v.dv]] });
    } else if (fam === 'xcel') {
      const v = wag.scoreXcelVault(level, entry.vault, { altBoard: !!opts.altBoard });
      if (v) Object.assign(out, { sv: v.sv, vault: v, totals: [['Start value', v.sv]] });
    } else if (fam === 'wagMasters') {
      const v = wag.scoreWagMastersVault(entry.vault, ctx);
      if (v) Object.assign(out, { sv: v.sv, vault: v, totals: [['Execution', 10], ['D score', v.dv], ['Age bonus', v.ageBonus]] });
    }
    out.totals.push(['Start value', out.sv]);
    return out;
  }

  if (ev.kind === 'tramp') {
    const r = tt.scoreTramp(level, rows);
    return { ...out, ...r, sv: r.sv };
  }
  if (ev.kind === 'passes') {
    const ps = entry.passes?.[evId] || [];
    const r = tt.scorePasses(evId, level, ps.map((p) => p.skills || []), ps.map((p) => p.start));
    return { ...out, ...r };
  }

  if (fam === 'mag') {
    const r = mag.scoreRoutine(evId, level, rows, opts, ctx);
    const any = r.rows.length > 0;
    if (r.capped) out.notes.push(`Start value capped at ${fmt(r.cap)} (${fmt(r.raw)} before the cap).`);
    if (r.deductions) out.notes.push(`Expected neutral deduction −${fmt(r.deductions)}: ${fmt(r.afterDeductions)} after deductions.`);
    return {
      ...out, ...r, sv: any ? r.startValue : null, earnedGroups: Object.keys(r.egBonus).map(Number),
      totals: [['Execution', 10], ['Difficulty', r.difficulty], ['EG bonus', r.egTotal], ['Other bonus', r.bonus], [`Short of ${mag.MIN_SKILLS}`, -r.shortDeduction], ['Start value', any ? r.startValue : null]],
      deductions: r.deductions,
    };
  }
  if (fam === 'infinity') {
    const r = wag.scoreInfinity(evId, rows, { eventBonus: !!opts.eventBonus });
    return { ...out, ...r, optionValues: { eventBonus: r.bonus }, totals: [...r.totals, ['Start value', r.sv]] };
  }
  if (fam === 'wagMasters') {
    const r = wag.scoreWagMasters(evId, rows, ctx);
    return { ...out, ...r, totals: [...r.totals, ['Start value', r.sv]] };
  }
  if (fam === 'xcel') {
    const r = wag.scoreXcel(level, evId, rows, { srMet: opts.sr || [], bonus: (Number(opts.bonus) || 0) / 10 });
    if (r.missingVp.length) out.notes.push(`Missing value parts: ${r.missingVp.join(', ')} (−${fmt(r.vpMissing)}).`);
    if (r.restricted) out.notes.push(`${r.restricted} restricted skill${r.restricted > 1 ? 's' : ''}: −0.50 each, and they don't count as value parts.`);
    return { ...out, ...r, optionValues: { bonus: r.bonus }, totals: [...r.totals, ['Start value', r.sv]] };
  }
  return out;
}

/** All events of an entry plus the all-around (not for T&T). */
export function scoreEntry(entry) {
  const d = DISCIPLINES[entry.disc];
  const events = Object.fromEntries(d.events.map((e) => [e.id, scoreEvent(entry, e.id)]));
  const allAround = d.noAllAround ? null : round1(d.events.reduce((t, e) => t + (events[e.id].sv || 0), 0));
  return { events, allAround };
}

// ---- entries ----------------------------------------------------------------

export function newEntry(id, disc, level) {
  const e = { id, disc, level, routines: {}, passes: {}, options: {}, vault: '' };
  if (levelInfo(disc, level)?.masters) e.decade = DEFAULT_DECADE;
  normalizeEntry(e);
  return e;
}

export const blankSkill = () => ({ name: '', letter: '', eg: '' });
export const blankTT = () => ({ name: '', notation: '', dd: '' });

export function minRows(entry, ev) {
  const spec = eventSpec(entry, ev.id);
  if (ev.kind === 'tramp') return tt.TRAMP_SKILLS;
  return spec.maxCounting || 8;
}

/** Fill in missing fields so every event has its rows. Returns true if anything changed. */
export function normalizeEntry(e) {
  let changed = false;
  for (const k of ['routines', 'passes', 'options']) if (!e[k]) { e[k] = {}; changed = true; }
  for (const ev of DISCIPLINES[e.disc].events) {
    if (ev.kind === 'vault') continue;
    if (ev.kind === 'passes') {
      const sizes = tt.PASS_SIZES[ev.id][e.level];
      const want = (i) => (Array.isArray(sizes[i]) ? sizes[i][1] : sizes[i]);
      // Stored as [{ skills }, { skills }]: Firestore can't hold nested arrays.
      const p = e.passes[ev.id] || [];
      for (const i of [0, 1]) {
        p[i] ||= { skills: [] };
        p[i].skills ||= [];
        while (p[i].skills.length < want(i)) { p[i].skills.push(blankTT()); changed = true; }
      }
      e.passes[ev.id] = p;
      continue;
    }
    const r = e.routines[ev.id] || [];
    const blank = ev.kind === 'tramp' ? blankTT : blankSkill;
    while (r.length < minRows(e, ev)) { r.push(blank()); changed = true; }
    e.routines[ev.id] = r;
  }
  return changed;
}

/** Put an example routine (js/data/examples.js) into an entry's event. */
export function applyExample(e, ex) {
  const ev = eventInfo(e.disc, ex.event);
  if (ev.kind === 'vault') {
    e.vault = ex.vault || '';
  } else if (ev.kind === 'passes') {
    e.passes[ex.event] = (ex.passes || [[], []]).map((p, i) => ({
      skills: p.map((s) => ({ ...blankTT(), ...s })),
      ...(ex.starts?.[i] ? { start: ex.starts[i] } : {}),
    }));
  } else {
    e.routines[ex.event] = (ex.skills || []).map((s) => ({ ...(ev.kind === 'tramp' ? blankTT() : blankSkill()), ...s }));
  }
  normalizeEntry(e);
}

/** True if an entry has any skill or vault filled in. */
export function hasContent(e) {
  if (e.vault) return true;
  if (Object.values(e.routines || {}).some((r) => r.some((s) => s.name || s.letter || s.notation))) return true;
  return Object.values(e.passes || {}).some((p) => p.some((x) => (x.skills || []).some((s) => s.name || s.notation)));
}

/**
 * Copy one entry's routines into another (same discipline). Skills keep their
 * names, values and element groups; anything the target level can't use is
 * recalculated by its own rules. Vaults copy only within the same vault list.
 */
export function copyRoutines(from, to) {
  const clone = (x) => JSON.parse(JSON.stringify(x));
  to.routines = clone(from.routines || {});
  to.passes = clone(from.passes || {});
  // Vault ids carry over where both levels use the same vault list (MAG levels).
  if (from.disc === 'mag' || from.level === to.level) to.vault = from.vault;
  normalizeEntry(to);
}
