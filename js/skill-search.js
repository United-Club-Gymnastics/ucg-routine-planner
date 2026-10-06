// Skill search for the routine editor: the skills for a discipline's apparatus,
// filtered by what's typed. MAG: UCG MAG CoP + WG skills. WAG: USAG Xcel and
// Development Program skills + UCG WAG CoP additions (Xcel levels, Infinity) and
// WG skills (Masters); see wagSkillAllowed. T&T: the UCG DD charts.
// WG names use CoP shorthand ("Salto bwd. str. w. 1/1 t."), so common words are
// mapped onto it: "back layout full" finds that skill.
import { SKILLS as MAG_SKILLS } from './data/mag-skills.js';
import { SKILLS as WAG_SKILLS } from './data/wag-skills.js';
import { SKILLS as TT_SKILLS } from './data/tt-skills.js';

const FRACTIONS = { '½': '1/2', '¼': '1/4', '¾': '3/4' };
const ALIASES = {
  back: 'bwd', backward: 'bwd', backwards: 'bwd', bwd: 'bwd', bw: 'bwd',
  front: 'fwd', forward: 'fwd', forwards: 'fwd', fwd: 'fwd', fw: 'fwd',
  layout: 'str', stretched: 'str', straight: 'str', str: 'str',
  handstand: 'hdst', hdst: 'hdst', hs: 'hdst', hstd: 'hdst',
  double: 'dbl', dbl: 'dbl',
  full: '1/1', half: '1/2',
  twist: 'turn', twists: 'turn', turns: 'turn', turn: 'turn', t: 'turn',
  tucked: 'tuck', tuck: 'tuck', piked: 'pike', pike: 'pike',
  straddled: 'straddle', straddle: 'straddle', strad: 'straddle',
};

function tokens(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[½¼¾]/g, (c) => FRACTIONS[c])
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // Stöckli -> stockli
    .split(/[^a-z0-9/]+/)
    .filter(Boolean)
    .map((w) => ALIASES[w] || w);
}

export const skillLabel = (s) => (s.eponym ? `${s.name} (${s.eponym})` : s.name);

const ALL = { mag: MAG_SKILLS, wag: WAG_SKILLS, tt: TT_SKILLS };
const byApp = {};
for (const [disc, list] of Object.entries(ALL)) {
  for (const s of list) {
    s.disc = disc;
    s.label = skillLabel(s);
    s.tokens = tokens(`${s.label} ${s.note || ''} ${s.notation || ''}`);
    (byApp[`${disc}.${s.app}`] ||= []).push(s);
  }
}
const SKILL_INDEX = new Map(Object.values(ALL).flat().map((s) => [s.id, s]));
// A USAG record later split into forms keeps its old id as an alias of form "a".
for (const s of WAG_SKILLS) if (s.alias) SKILL_INDEX.set(s.alias, s);

const VALUE_ORDER = ['Sub-A', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
const order = (a, b) =>
  (a.eg || a.group || 0) - (b.eg || b.group || 0) ||
  (a.dd ?? 0) - (b.dd ?? 0) ||
  VALUE_ORDER.indexOf(a.value) - VALUE_ORDER.indexOf(b.value) ||
  (a.src === b.src ? 0 : a.src === 'UCG' ? -1 : 1);

// Which WAG skills a level can use. Xcel levels and UCG Infinity use USAG values:
// Xcel skills (without the ones limited to other divisions, e.g. "Bronze/Silver/Gold
// only") and the UCG additions; Sapphire and Infinity (the Open Scoring Level: any
// Development Program or Xcel Sapphire skill) also get the Development Program E
// elements. WAG Masters uses WG values.
export function wagSkillAllowed(family, level, s) {
  if (family === 'wagMasters') return s.src === 'WG';
  if (s.src === 'WG') return false;
  const lvl = family === 'infinity' ? 'sapphire' : level;
  if (s.prog === 'dp' && lvl !== 'sapphire') return false;
  return !s.divisions || s.divisions.includes(lvl);
}

export function findSkill(id) {
  return (id && SKILL_INDEX.get(id)) || null;
}

// Skills for an apparatus matching every typed word (as a word start).
// With nothing typed: the whole list by element group (no EG first), value,
// then UCG before WG. While searching: closest matches (fewest extra words) first.
export function searchSkills(disc, app, query) {
  const q = tokens(query);
  const list = (byApp[`${disc}.${app}`] || []).filter((s) => q.every((w) => s.tokens.some((t) => t.startsWith(w))));
  return list.sort(q.length ? (a, b) => a.tokens.length - b.tokens.length || order(a, b) : order);
}
