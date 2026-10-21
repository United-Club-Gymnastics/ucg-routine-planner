// Disciplines, levels and events, and one scoring entry point for all of them.
// An athlete has entries: one per level they compete ({ disc, level, ... }).
import * as mag from './scoring/mag.js';
import * as wag from './scoring/wag.js';
import * as tt from './scoring/tt.js';
import { XCEL_SR, XCEL_VP } from './data/xcel.js';
import { findSkill, wagSkillAllowed } from './skill-search.js';
import { DECADES, DECADE_LABELS, DEFAULT_DECADE, MASTERS_LETTERS, countingTotal } from './scoring/masters.js';

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
    spec.maxCounting = mag.countingFor(level, entry.decade);
    // Floor and high bar: linked skills earn the connection bonuses.
    spec.links = spec.options.some((o) => o.connect);
  } else if (fam === 'infinity') {
    const g = wag.INFINITY_GROUPS[evId];
    spec.letters = Object.keys(wag.INFINITY_VALUES);
    spec.groups = groupList(g.groups, false);
    spec.legend = Object.entries(g.condensed).map(([r, nums]) => ({ key: { I: 1, II: 2, III: 3, IV: 4 }[r], roman: r, label: nums.map((n) => g.groups[n]).join(' · ') }));
    // Beam and floor: the apparatus bonus is a connection, so the coach marks connected
    // skills and the bonus is ticked when listed skills meet it.
    const auto = evId !== 'ub';
    spec.options = [{
      id: 'eventBonus', kind: 'check', value: wag.INFINITY_EVENT_BONUS, label: 'Apparatus bonus', help: g.eventBonus, detect: auto,
      tip: auto ? `Ticked automatically when skills from the list, marked as connected, meet it: ${evId === 'bb' ? 'two directly connected acro flight elements (not the mount or dismount)' : 'two saltos in the same connected pass'}. A skill you typed in can't be checked: tick the box yourself.` : null,
    }];
    spec.links = auto;
    spec.maxCounting = wag.INFINITY_MAX_SKILLS;
  } else if (fam === 'wagMasters') {
    // No element groups: Composition Requirements CR I-V (policy v2.1), shown like the Xcel special
    // requirements (detected from the listed skills; the coach can tick or untick each).
    spec.letters = MASTERS_LETTERS;
    spec.maxCounting = countingTotal(entry.decade);
    spec.sr = wag.crTexts(evId);
    spec.srKind = 'cr';
    // Beam and floor combinations are connected skills.
    spec.links = evId !== 'ub';
    if (evId === 'bb') {
      spec.options = [{
        id: 'widening', kind: 'choice', label: 'Beam widening', choices: [
          ['none', 'The host has no widening: beam bonus from 40'],
          ['offered', 'Widening offered, not used: beam bonus from 40'],
          ['used', 'On the widening: no beam bonus'],
        ],
        help: 'The 20 cm widening some hosts provide (Masters Rules Policy §III.C.3.d). Without one, every gymnast 40+ gets the beam bonus (40s +0.5, 50s +0.8, 60s +1.2, 70+ +1.5) and the 60+ relaxations of Table 2 apply.',
      }];
    }
  } else if (fam === 'xcel') {
    spec.letters = wag.XCEL_LETTERS;
    // USAG element groups: no requirement at Xcel, but choosing one narrows the skill search.
    spec.groups = groupList(wag.INFINITY_GROUPS[evId].groups, false);
    spec.vp = XCEL_VP[level];
    spec.sr = XCEL_SR[level][evId];
    spec.columns = 'xcel';
    // The coach marks which skills are directly connected: special requirements and the
    // Sapphire bonus depend on it. (Repeats on bars go by the neighbouring skills either way.)
    spec.links = true;
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
      if (v) Object.assign(out, { sv: v.sv, vault: v, totals: v.sv !== v.chart ? [['Vault chart', v.chart], ['Alternative springboard', v.sv - v.chart]] : [] });
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
    if (any && mag.LEVELS[level].masters && r.dismount == null) {
      out.notes.push(evId === 'fx'
        ? 'No dismount: the last skill that isn’t from EG I is the dismount. Without one, the routine is one skill short.'
        : 'No dismount: the last skill should be the dismount (EG IV). Without one, the routine is one skill short.');
    }
    return {
      ...out, ...r, sv: any ? r.startValue : null, earnedGroups: Object.keys(r.egBonus).map(Number),
      totals: [['Execution', 10], ['Difficulty', r.difficulty], ['EG bonus', r.egTotal], ['Other bonus', r.bonus], [`Short of ${r.minSkills}`, -r.shortDeduction], ['Start value', any ? r.startValue : null]],
      deductions: r.deductions,
    };
  }
  // WAG Infinity and Xcel: the listed skill (its group and tags tell what it is) and whether
  // this level allows it. Search hides the others, but a copied or imported routine can have them.
  const listed = () =>
    rows.map((row) => {
      const skill = row?.skillId ? findSkill(row.skillId) : null;
      return skill ? { ...row, skill, offLevel: !wagSkillAllowed(fam, level, skill) } : row;
    });
  if (fam === 'infinity') {
    const r = wag.scoreInfinity(evId, listed(), { eventBonus: !!opts.eventBonus });
    return { ...out, ...r, optionValues: { eventBonus: r.bonus }, totals: [...r.totals, ['Start value', r.sv]] };
  }
  if (fam === 'wagMasters') {
    const r = wag.scoreWagMasters(evId, rows, { ...ctx, crSet: opts.srSet || [], widening: opts.widening || 'none' });
    if (r.sv != null && r.dismount == null) out.notes.push(evId === 'fx' ? 'No dismount: the last acro element is the dismount. Without one, the routine is one skill short.' : 'No dismount: the last skill should be the dismount. Without one, the routine is one skill short.');
    return { ...out, ...r, totals: [...r.totals, ['Start value', r.sv]] };
  }
  if (fam === 'xcel') {
    const r = wag.scoreXcel(level, evId, listed(), { srMet: opts.sr || [], srSet: opts.srSet || [] });
    if (r.missingVp.length) out.notes.push(`Missing value parts: ${r.missingVp.join(', ')} (−${fmt(r.vpMissing)}).`);
    if (r.restricted) out.notes.push(`${r.restricted} restricted skill${r.restricted > 1 ? 's' : ''}: −0.50 each, and they don't count as value parts.`);
    if (level === 'sapphire') {
      const earned = r.bonusParts.filter((p) => p.value);
      out.notes.push(earned.length
        ? `Bonus +${fmt(r.bonus)}: ${earned.map((p) => p.text).join(' · ')}.${r.bonusParts.length > earned.length ? ' (The 0.40 maximum is reached.)' : ''}`
        : 'No bonus yet: +0.10 for each "C", for one "D", and for each "B"+"B" (or higher) connection, up to +0.40.');
    }
    return { ...out, ...r, totals: [...r.totals, ['Start value', r.sv]] };
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

// The skill lists' version (the skill bundle's commit; the production build sets it, see
// tools/build_site.mjs). Stamped on an entry (entry.catalog) when values are taken from the lists.
export const SKILLS_VERSION = globalThis.UCG_SKILLS_VERSION || 'dev';

/**
 * The values a listed skill gives a row at this entry's level: { letter, eg } (only the ones
 * the list decides), or { dd } for T&T. Picking a skill uses these; so does valueChange.
 */
export function listedValues(e, evId, s) {
  if (e.disc === 'tt') return { dd: s.dd };
  const fam = levelInfo(e.disc, e.level)?.family;
  const out = {};
  const letters = eventSpec(e, evId).letters;
  if (letters.includes(s.value)) out.letter = s.value;
  else if (!s.value) out.letter = ''; // a listed skill with no value (Sapphire / Infinity no-value cast)
  if (fam === 'mag') out.eg = s.eg ? String(s.eg) : '';
  if (fam === 'infinity' || fam === 'xcel') out.eg = s.group ? String(s.group) : '';
  // WAG Masters has no element groups (Composition Requirements instead).
  return out;
}

/**
 * A skill picked from the list whose value or group in the Code is no longer what the
 * routine saved: { now, was, keys } (keys: 'letter' | 'eg' | 'dd'), or null. Saved routines
 * keep their values, so a change upstream shows here instead of changing a start value
 * quietly. A row re-valued from another level can hold a value the list doesn't give (a WG
 * adjusted value): row.base then holds the list's values at the time, and is compared instead.
 */
export function valueChange(e, evId, row) {
  if (!row?.skillId || !row.fromList || row.noCredit) return null;
  // Copied from another level before rows kept the list's values (row.base): can't tell.
  if (e.revalued && !e.catalog && !row.base) return null;
  const s = findSkill(row.skillId);
  if (!s) return null; // not loaded yet, or no longer listed
  const now = listedValues(e, evId, s);
  const was = row.base || row;
  const same = (a, b) => String(a ?? '') === String(b ?? '');
  const keys = Object.keys(now).filter((k) => !same(now[k], was[k]));
  return keys.length ? { now, was: Object.fromEntries(keys.map((k) => [k, was[k] ?? ''])), keys } : null;
}

/** Take the Code's current values for the rows valueChange flags (one event, or all). Returns how many changed. */
export function updateChangedValues(e, evId = null) {
  let n = 0;
  for (const ev of DISCIPLINES[e.disc].events) {
    if (evId && ev.id !== evId) continue;
    const rows = [...(e.routines?.[ev.id] || []), ...(e.passes?.[ev.id] || []).flatMap((p) => p.skills || [])];
    for (const row of rows) {
      const c = valueChange(e, ev.id, row);
      if (!c) continue;
      Object.assign(row, c.now);
      delete row.base;
      n++;
    }
  }
  if (n) e.catalog = SKILLS_VERSION;
  return n;
}

export const blankSkill = () => ({ name: '', letter: '', eg: '' });
export const blankTT = () => ({ name: '', notation: '', dd: '' });

/**
 * Most rows an event can hold. T&T: the card's rows (trampoline 10, double mini 2 per pass,
 * tumbling the level's pass size), so a routine always fits its printed card.
 */
export function maxRows(entry, evId, pass, fallback = 20) {
  if (entry.disc !== 'tt') return fallback;
  if (evId === 'tu') return tt.PASS_SIZES.tu[entry.level]?.[Number(pass) || 0]?.[1] ?? fallback;
  if (evId === 'dmt') return 2;
  return tt.TRAMP_SKILLS;
}

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
      const sizes = tt.PASS_SIZES[ev.id]?.[e.level] || []; // an unknown level: no rows to add
      const want = (i) => (Array.isArray(sizes[i]) ? sizes[i][1] : sizes[i] || 0);
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
    // Masters: "Misc" was GE's name until 2026-10-20.
    if (levelInfo(e.disc, e.level)?.masters) {
      for (const row of r) {
        for (const x of [row, row?.base]) if (x?.letter === 'Misc') { x.letter = 'GE'; changed = true; }
      }
    }
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
  markFromList(e, ex.event);
  resetSrTicks(e, ex.event);
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

/** True if an entry has anything filled in for one event. */
export function eventHasContent(e, evId) {
  const ev = eventInfo(e.disc, evId);
  if (ev.kind === 'vault') return !!e.vault;
  if (ev.kind === 'passes') return (e.passes?.[evId] || []).some((p) => (p.skills || []).some((s) => s.name || s.notation));
  return (e.routines?.[evId] || []).some((s) => s.name || s.letter || s.notation);
}

/**
 * Copy one event's routine from another entry (same discipline), replacing that
 * event only. Like copyRoutines: the vault copies only within the same vault list.
 */
export function copyEvent(from, to, evId) {
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const ev = eventInfo(to.disc, evId);
  if (ev.kind === 'vault') {
    to.vault = from.disc === 'mag' || from.level === to.level ? from.vault : '';
    delete to.vaultFlag;
  } else if (ev.kind === 'passes') to.passes[evId] = clone(from.passes?.[evId] || []);
  else to.routines[evId] = clone(from.routines?.[evId] || []);
  resetSrTicks(to, evId);
  normalizeEntry(to);
}

// A new routine in an event starts from the detected special requirements: ticks and
// unticks the coach made for the routine it replaces don't carry over.
function resetSrTicks(e, evId) {
  const o = e.options?.[evId];
  if (o) { delete o.srSet; delete o.sr; }
}

// Skills that came from a list (an example's skills) don't filter the picker by their
// value when they are retyped, the same as skills picked by hand.
function markFromList(e, evId) {
  const rows = [...(e.routines?.[evId] || []), ...(e.passes?.[evId] || []).flatMap((p) => p.skills || [])];
  for (const s of rows) if (s.skillId) s.fromList = true;
}
