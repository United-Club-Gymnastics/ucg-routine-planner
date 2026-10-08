// Skill search for the routine editor: the skills for a discipline's apparatus,
// filtered by what's typed. MAG: WG skills + UCG MAG CoP additions, or the UCG Masters
// MAG list at Masters (magSkillAllowed). WAG: USAG Xcel and Development Program skills
// + UCG WAG CoP additions (Xcel levels, Infinity), WG skills + the UCG Masters WAG list
// (Masters); see wagSkillAllowed. T&T: the UCG DD charts.
// Every listed skill carries its box number in its own code (box: "WG I.75", "Xcel 7.104",
// "UCG FX 12", "Masters PB 12") and other names coaches use (aka), from the skill catalog.
// WG names use CoP shorthand ("Salto bwd. str. w. 1/1 t."), so common words are
// mapped onto it: "back layout full" finds that skill.
// Each discipline's lists load on demand (loadDiscipline), so a T&T coach never downloads
// the WAG list. Callers wait for an athlete's disciplines before showing them (app.js
// renderAll), so findSkill / searchSkills always see the data they need.

const FRACTIONS = { '½': '1/2', '¼': '1/4', '¾': '3/4' };
const ALIASES = {
  back: 'bwd', backward: 'bwd', backwards: 'bwd', bwd: 'bwd', bw: 'bwd',
  front: 'fwd', forward: 'fwd', forwards: 'fwd', fwd: 'fwd', fw: 'fwd',
  layout: 'str', stretched: 'str', straight: 'str', str: 'str',
  handstand: 'hdst', hdst: 'hdst', hs: 'hdst', hstd: 'hdst',
  double: 'dbl', dbl: 'dbl',
  bhs: 'flicflac',
  full: '1/1', half: '1/2',
  twist: 'turn', twists: 'turn', turns: 'turn', turn: 'turn',
  tucked: 'tuck', tuck: 'tuck', piked: 'pike', pike: 'pike', p: 'pike',
  straddled: 'straddle', straddle: 'straddle', strad: 'straddle',
};

// Compound words written one, two or hyphenated ways: "round off" = "round-off" = "roundoff".
const COMPOUNDS = [
  [/round[\s-]*off/g, 'roundoff'],
  [/(flic[\s-]*flac|flip[\s-]*flop)/g, 'flicflac'],
  [/hand[\s-]*spring/g, 'handspring'],
  [/lay[\s-]*out/g, 'layout'],
  [/tour[\s-]*jet[eé]/g, 'tourjete'],
  [/clear[\s-]*hip/g, 'clearhip'],
  [/straddle[\s-]*back/g, 'straddleback'],
  // "Scale on toe" is a scale on relevé.
  [/\bon (?:her |the )?toes?\b/g, 'on releve'],
  // A back handspring is a flic-flac: keep both words so either name finds it.
  [/back(?:ward)?\s+handspring/g, 'back flicflac handspring'],
];

// Turns written as mixed numbers or decimals read as the Codes write them: "1½", "1 1/2"
// and "1.5" are all 3/2 (and "½" is 1/2).
function improper(whole, num, den) {
  const n = Number(whole) * Number(den) + Number(num);
  return `${n}/${den}`;
}
function tokens(text) {
  return COMPOUNDS.reduce((t, [re, word]) => t.replace(re, word), String(text || '').toLowerCase())
    .replace(/(\d+)\s*([½¼¾])/g, (_, w, f) => improper(w, ...FRACTIONS[f].split('/')))
    .replace(/\b(\d+) (\d)\/(\d)\b/g, (_, w, n, d) => improper(w, n, d))
    .replace(/\b(\d+)\.5\b/g, (_, w) => improper(w, 1, 2))
    .replace(/[½¼¾]/g, (c) => FRACTIONS[c])
    // Options written with a slash ("squat-on/stoop-on") are alternatives.
    .replace(/([a-z])\/([a-z])/g, '$1 or $2')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // Stöckli -> stockli
    .split(/[^a-z0-9/]+/)
    .filter(Boolean)
    // WG shorthand "t." is a turn after a fraction ("½ t.", "1/1 t."), otherwise tucked
    // ("salto bwd. t.", "fwd. t. or p.").
    .map((w, i, all) => (w === 't' ? (/^\d+\/\d+$/.test(all[i - 1] || '') ? 'turn' : 'tuck') : ALIASES[w] || w));
}

// A typed word of 5+ letters one letter off a word of the skill's ("Varonin" for Voronin).
function near(w, t) {
  if (w.length < 5 || Math.abs(w.length - t.length) > 1 || t.length < 5) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < w.length && j < t.length) {
    if (w[i] === t[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (w.length > t.length) i++;
    else if (t.length > w.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (w.length - i) + (t.length - j) <= 1;
}
const hit = (w, t) => t.startsWith(w) || near(w, t);

export const skillLabel = (s) => (s.eponym ? `${s.name} (${s.eponym})` : s.name);

const byApp = {};
const SKILL_INDEX = new Map();

function add(disc, list, index = {}) {
  for (const s of list) {
    s.disc = disc;
    s.label = skillLabel(s);
    const info = index[s.id] || {};
    s.box = info.l || '';
    s.page = info.p || null;
    s.aka = info.a || s.aka || [];
    if (info.t) s.tags = info.t; // what the skill is (acro, salto, circle ...): Xcel special requirements
    if (info.m) s.markers = info.m; // marks printed in the Code, e.g. "D" = counts as dance
    s.tokens = tokens(`${s.label} ${s.note || ''} ${s.notation || ''} ${s.aka.join(' ')} ${s.box}`);
    s.nameTokens = tokens(`${s.label} ${s.notation || ''}`); // ranking: a match in the name beats one only in the note
    s.akaTokens = s.aka.map((a) => tokens(a)); // other names count as the name
    s.boxTokens = tokens(s.box); // "7.104" or "I.75" finds the skill
    (byApp[`${disc}.${s.app}`] ||= []).push(s);
    SKILL_INDEX.set(s.id, s);
    // A USAG record later split into forms keeps its old id as an alias of form "a".
    if (s.alias) SKILL_INDEX.set(s.alias, s);
  }
}

// Example routines (T&T, MAG Developmental / Intermediate) load with those disciplines.
export let EXAMPLES = [];
const examples = () => import('./data/examples.js').then((m) => (EXAMPLES = m.EXAMPLES));

const LOADERS = {
  wag: () =>
    Promise.all([import('./data/wag-skills.js'), import('./data/masters-skills-wag.js'), import('./data/skill-index-wag.js')]).then(
      ([a, b, ix]) => add('wag', [...a.SKILLS, ...b.SKILLS], ix.INDEX)
    ),
  mag: () =>
    Promise.all([import('./data/mag-skills.js'), import('./data/masters-skills-mag.js'), import('./data/skill-index-mag.js'), examples()]).then(
      ([a, b, ix]) => add('mag', [...a.SKILLS, ...b.SKILLS], ix.INDEX)
    ),
  tt: () => Promise.all([import('./data/tt-skills.js'), examples()]).then(([t]) => add('tt', t.SKILLS)),
};
const loading = {};
const loaded = new Set();

/** Load a discipline's skill lists (once). Resolves when findSkill / searchSkills have them. */
export function loadDiscipline(disc) {
  if (!LOADERS[disc]) return Promise.resolve();
  loading[disc] ||= LOADERS[disc]()
    .then(() => loaded.add(disc))
    .catch((err) => {
      delete loading[disc]; // try again next time (e.g. a dropped connection on first visit)
      throw err;
    });
  return loading[disc];
}
export const disciplineLoaded = (disc) => loaded.has(disc) || !LOADERS[disc];

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
  if (family === 'wagMasters') return s.src === 'WG' || s.src === 'UCGM';
  if (s.src === 'WG' || s.src === 'UCGM') return false;
  const lvl = family === 'infinity' ? 'sapphire' : level;
  if (s.prog === 'dp' && lvl !== 'sapphire') return false;
  return !s.divisions || s.divisions.includes(lvl);
}

// MAG: WG + the UCG MAG additions, or at Masters WG + the UCG Masters MAG list (which
// stands in for the UCG additions there, often re-valued as Masters Elements).
export function magSkillAllowed(level, s) {
  return level === 'masters' ? s.src !== 'UCG' : s.src !== 'UCGM';
}

export function findSkill(id) {
  return (id && SKILL_INDEX.get(id)) || null;
}

// Skills for an apparatus matching every typed word (as a word start).
// With nothing typed: the whole list by element group (no EG first), value,
// then UCG before WG. While searching: matches in the name before matches only in a
// note, then closest matches (fewest extra words) first.
// Ranking: how far a name is from what was typed, counting the words that weren't typed.
// Linking words and "salto"/"somersault" are free (a "back tuck" is a salto); a double or
// triple that wasn't asked for is a big step away from the single skill.
const FREE = new Set(['salto', 'saltos', 'somersault', 'or', 'also', 'with', 'w', 'to', 'and', 'the', 'a', 'of', 'in', 'on', 'from']);
const MULTI = new Set(['dbl', 'triple', 'tpl', 'quad', 'quadruple']);
const cost = (names, q) => names.reduce((c, t) => (q.some((w) => t.startsWith(w)) ? c : c + (FREE.has(t) ? 0 : MULTI.has(t) ? 3 : 1)), 0);
// The closest of the skill's name and its other names (box numbers don't count as extra words).
const extra = (s, q) => Math.min(cost(s.nameTokens, q), ...s.akaTokens.map((a) => cost(a, q)));

// Matching a typed-in name to a listed skill (e.g. routines brought over from another
// planner). The caller narrows the list first (same value and element group). Within it,
// words of the listed name that weren't typed count against it, except: words that only
// describe how or where ("landing", "step-out", "to stand", "jump", "turn", "reverse grip")
// count half; an amount of turn or twist that wasn't typed counts double (it's another
// skill); "on one foot" and the other options of "X or Y" / "X to Y" don't count; and a
// typed eponym is a match by itself.
const MATCH_FREE = new Set([...FREE, 'one', 'foot', 'feet']);
const QUALIFIERS = new Set(['landing', 'step', 'out', 'stepout', 'stand', 'end', 'side', 'support', 'two', 'sit', 'jump', 'leap', 'turn', 'hang',
  'grip', 'reverse', 'regular', 'mixed', 'el', 'overgrip', 'undergrip', 'extra']);
// Typed shorthand standing for several words of the listed name ("BHS": back handspring).
const COVERS = { flicflac: ['bwd', 'handspring'], tourjete: ['tour', 'jete'] };
const isFrac = (x) => /^\d+\/\d+$/.test(x || '');
function matchCost(tokensOfName, typed) {
  const typedWord = (t) => typed.some((w) => hit(w, t));
  // Filler words don't count; "or" and "to" stay to mark options and ranges.
  const ts = tokensOfName.filter((t) => t === 'or' || t === 'to' || !MATCH_FREE.has(t));
  // Options: "squat-on or stoop-on or straddle-on", "tucked or piked", a range "1/1 to 3/2".
  // When one option was typed, the others are free.
  const free = new Set();
  for (let i = 0; i < ts.length; i++) {
    if (!(ts[i] === 'or' || (ts[i] === 'to' && isFrac(ts[i - 1]) && isFrac(ts[i + 1])))) continue;
    let a = i - 1;
    let b = i + 1;
    while (ts[b + 1] === 'or' && ts[b + 2]) b += 2; // the whole run X or Y or Z
    const run = [];
    for (let j = a; j <= b; j += 2) run.push(j);
    if (run.some((j) => typedWord(ts[j]))) run.forEach((j) => free.add(j));
  }
  let c = 0;
  ts.forEach((t, i) => {
    if (t === 'or' || t === 'to' || free.has(i) || typedWord(t)) return;
    c += MULTI.has(t) ? 3 : isFrac(t) ? 2 : QUALIFIERS.has(t) ? 0.5 : 1;
  });
  return c;
}

/**
 * The listed skill a typed-in name means, or null. Among the skills `accept` allows (same
 * value, element group and level), those with every typed word in their name, eponym or
 * other names. It must be close (at most 2 extra words; and if several qualify, ½ for a
 * one-word name, since "Kip" could be several kips) and closer than the rest (versions of
 * one box tying: the first).
 */
export function closestSkill(disc, app, text, accept = () => true) {
  const q = tokens(text).filter((w) => !FREE.has(w));
  if (!q.length) return null;
  const typed = [...q, ...q.flatMap((w) => COVERS[w] || [])];
  const has = (ts) => q.every((w) => ts.some((t) => hit(w, t)));
  const scored = [];
  for (const s of byApp[`${disc}.${app}`] || []) {
    if (!accept(s)) continue;
    const name = tokens(s.name);
    const epo = tokens(s.eponym || '');
    const options = [[name, [...name, ...epo]], ...s.akaTokens.map((a) => [a, a])]; // [what costs, what can match]
    const named = epo.length && epo.every((t) => typed.some((w) => hit(w, t))); // "Popa"
    const costs = options.filter(([, all]) => has(all)).map(([ts]) => (named ? 0 : matchCost(ts, typed)));
    if (costs.length) scored.push([s, Math.min(...costs)]);
  }
  if (scored.length === 1) return scored[0][1] <= 2 ? scored[0][0] : null;
  scored.sort((a, b) => a[1] - b[1]);
  const [best, cost] = scored[0] || [];
  if (!best || cost > (q.length > 1 ? 2 : 0.5)) return null;
  const rivals = scored.slice(1).filter(([s, c]) => c === cost && (s.box || s.id) !== (best.box || best.id));
  return rivals.length ? null : best;
}

/** Does `text` match every typed word, the way skill search does (any order, word starts, synonyms)? */
export function matchesQuery(query, text) {
  const ts = tokens(text);
  return tokens(query).every((w) => ts.some((t) => hit(w, t)));
}

export function searchSkills(disc, app, query) {
  const q = tokens(query);
  const list = (byApp[`${disc}.${app}`] || []).filter((s) => q.every((w) => s.tokens.some((t) => hit(w, t))));
  const inName = (s) => q.every((w) => [s.nameTokens, s.boxTokens, ...s.akaTokens].some((ts) => ts.some((t) => hit(w, t))));
  return list.sort(q.length ? (a, b) => inName(b) - inName(a) || extra(a, q) - extra(b, q) || order(a, b) : order);
}
