// UCG Trampoline & Tumbling (UCG T&T Code of Points v3.41): difficulty (DD)
// totals plus each level's routine requirements. A routine that misses a
// requirement gets a 2.0 deduction from the chair of the panel, so the planner
// flags those instead of computing a score.
export const round1 = (n) => Math.round(n * 10) / 10;
const isFilled = (s) => !!(s && (String(s.name || '').trim() || s.notation || s.dd !== '' && s.dd != null && s.dd !== undefined));
// Repeat matching ignores case, spaces and punctuation, but not fractions: "¾ front
// somersault" and "front somersault" are different skills (¾ -> 3/4 -> "34").
const FRACTIONS = { '½': '1/2', '¼': '1/4', '¾': '3/4' };
export const skillKey = (name) =>
  String(name || '').toLowerCase().replace(/[½¼¾]/g, (c) => FRACTIONS[c]).replace(/[^a-z0-9]/g, '');

export const TRAMP_SKILLS = 10;
export const PASS_SIZES = {
  dmt: { nf: [2, 2], if: [2, 2], hf: [2, 2] },
  tu: { nf: [[4, 7], [4, 7]], if: [[5, 8], [8, 8]], hf: [[8, 8], [8, 8]] },
};

// New Flyers trampoline: up to 2 of these (anything else must be 0.4 or less).
const NF_TRAMP_LIST = ['porpoise', 'front tuck', 'front pike', 'front straight', 'back pullover to back', 'back tuck', 'back pike', 'back straight', 'barani tuck', 'barani pike', 'barani straight',
  'front somersault', 'back somersault', 'barani', 'pullover'];

/**
 * Quarter somersaults in a FIG trampoline / double mini notation ("40o" = 4,
 * "800<" = 8, "12001" = 12): the leading number, followed by one twist digit
 * per somersault.
 */
export function quarterSomersaults(notation) {
  const digits = String(notation || '').replace(/[^0-9]/g, '');
  for (const len of [1, 2]) {
    const q = Number(digits.slice(0, len));
    const rest = digits.length - len;
    if (q && rest === Math.max(1, Math.round(q / 4))) return q;
  }
  return 0;
}
// With no FIG shorthand, recognise a full (360°+) somersault by its name.
const FLIP_NAME = /somersault|salto|\b(back|front) (tuck|pike|straight|layout)|barani|rudy|randy|\bfull\b(?! turn)|ball ?out|cody|porpoise|double|triple|half-in|full-in|\b1 1\/4\b/i;
const NOT_FLIP = /jump|drop|turn\b|seat|swivel|return|cradle|cruise|3\/4/i;
export const isSalto = (s) => {
  const q = quarterSomersaults(s.notation);
  if (q) return q >= 4;
  return FLIP_NAME.test(s.name || '') && !NOT_FLIP.test(s.name || '');
};

function items(list) {
  return (list || []).map((s, idx) => ({
    idx,
    name: String(s?.name || '').trim(),
    notation: s?.notation || '',
    dd: s?.dd === '' || s?.dd == null ? 0 : Number(s.dd) || 0,
    status: isFilled(s) ? 'counting' : 'blank',
  }));
}

/** Individual or synchro trampoline: 10 skills. */
export function scoreTramp(level, skills = []) {
  const it = items(skills);
  const warnings = [];
  const seen = new Map();
  const zeroRepeats = new Map();
  for (const s of it) {
    if (s.status === 'blank') continue;
    const key = skillKey(s.name) || skillKey(s.notation);
    if (!key) continue;
    if (seen.has(key)) {
      const ok = level === 'nf' && s.dd === 0 && !zeroRepeats.get(key);
      if (ok) zeroRepeats.set(key, true);
      else {
        s.status = 'repeat';
        s.repeatOf = seen.get(key);
      }
    } else seen.set(key, s.idx);
  }
  const counting = it.filter((s) => s.status === 'counting');
  const total = round1(counting.reduce((t, s) => t + s.dd, 0));
  const filled = it.filter((s) => s.status !== 'blank');
  if (filled.length && filled.length !== TRAMP_SKILLS) warnings.push(`A trampoline routine is ${TRAMP_SKILLS} skills (${filled.length} listed).`);
  if (it.some((s) => s.status === 'repeat')) warnings.push('Repeated skills get no difficulty and a 2.0 penalty.');
  if (level === 'nf') {
    const listed = counting.filter((s) => s.dd > 0.4);
    const offList = listed.filter((s) => !NF_TRAMP_LIST.some((n) => skillKey(s.name).startsWith(skillKey(n))));
    for (const s of listed) s.flag = 'over';
    if (listed.length > 2) warnings.push(`New Flyers: only 2 skills above 0.4 DD (from the allowed salto list); this routine has ${listed.length}.`);
    if (offList.length) warnings.push(`New Flyers: skills above 0.4 DD must be from the allowed list (porpoise, front/back somersaults, back pullover to back, barani). Check: ${offList.map((s) => s.name || s.notation).join(', ')}.`);
  }
  if (level === 'if') {
    const over = counting.filter((s) => s.dd > 0.8);
    for (const s of over) s.flag = 'over';
    if (over.length) warnings.push('Intermediate Flyers: skills may be at most 0.8 DD.');
    const flips = counting.filter(isSalto).length;
    if (filled.length && flips < 3) warnings.push(`Intermediate Flyers: at least 3 skills with a full (360°) somersault; this routine has ${flips}.`);
    if (total > 5.0) warnings.push(`Intermediate Flyers: routine DD may not exceed 5.0 (this one is ${total.toFixed(1)}).`);
  }
  if (level === 'hf' && filled.length && total < 4.5) warnings.push(`High Flyers: routine DD must be at least 4.5 (this one is ${total.toFixed(1)}).`);
  return { items: it, total, warnings, sv: filled.length ? total : null, totals: [['Total DD', total]] };
}

/**
 * Double mini or tumbling: two passes. starts: double mini only, whether each
 * pass's first skill is a 'mounter' (the default) or a 'spotter'.
 */
export function scorePasses(event, level, passes = [[], []], starts = []) {
  const ps = [0, 1].map((p) => items(passes[p]));
  const warnings = [];
  // Double mini: a skill repeated in the same position (mounter/spotter/dismount) gets no difficulty.
  // A mounter in one pass and a spotter in the other are different positions.
  if (event === 'dmt') {
    const sameStart = (starts[0] || 'mounter') === (starts[1] || 'mounter');
    for (const pos of sameStart ? [0, 1] : [1]) {
      const a = ps[0][pos];
      const b = ps[1][pos];
      // (A repeated 0.0 skill, like a tuck jump, loses nothing, so it isn't flagged.)
      if (a && b && a.status !== 'blank' && b.status !== 'blank' && b.dd > 0 && skillKey(a.name || a.notation) === skillKey(b.name || b.notation)) {
        b.status = 'repeat';
        b.repeatOf = pos;
        warnings.push(`Pass 2 repeats the ${pos ? 'dismount' : 'first skill'} of pass 1 in the same position, so it gets no difficulty.`);
      }
    }
  }
  const sums = ps.map((p) => round1(p.filter((s) => s.status === 'counting').reduce((t, s) => t + s.dd, 0)));
  const all = ps.flat().filter((s) => s.status === 'counting');
  const n = ps.map((p) => p.filter((s) => s.status !== 'blank').length);
  const label = (i) => `Pass ${i + 1}`;

  if (event === 'dmt') {
    for (const [i, c] of n.entries()) if (c && c !== 2) warnings.push(`${label(i)}: a double mini pass is 2 skills (a mounter or spotter, then a dismount).`);
    if (level === 'nf') {
      const mid = all.filter((s) => s.dd > 0.5);
      for (const s of all) if (s.dd > 0.7) s.flag = 'over';
      if (all.some((s) => s.dd > 0.7)) warnings.push('New Flyers: skills may be at most 0.7 DD.');
      if (mid.length > 1) warnings.push('New Flyers: only one skill valued at 0.6 or 0.7.');
      ps.forEach((p, i) => { if (p.filter((s) => s.status === 'counting' && isSalto(s)).length > 1) warnings.push(`${label(i)}: New Flyers may do at most one salto per pass.`); });
    }
    if (level === 'if') {
      for (const s of all) if (s.dd > 1.2) s.flag = 'over';
      if (all.some((s) => s.dd > 1.2)) warnings.push('Intermediate Flyers: skills may be at most 1.2 DD.');
      if (all.length === 4 && all.filter((s) => s.dd >= 0.5).length < 2) warnings.push('Intermediate Flyers: at least 2 of the 4 skills must be 0.5 DD or higher.');
      sums.forEach((d, i) => { if (d > 1.6) warnings.push(`${label(i)}: Intermediate Flyers passes may not exceed 1.6 DD (${d.toFixed(1)}).`); });
    }
    if (level === 'hf') sums.forEach((d, i) => { if (n[i] && d < 1.4) warnings.push(`${label(i)}: High Flyers passes need at least 1.4 DD (${d.toFixed(1)}).`); });
  }

  if (event === 'tu') {
    const sizes = PASS_SIZES.tu[level];
    n.forEach((c, i) => {
      const [lo, hi] = sizes[i];
      if (c && (c < lo || c > hi)) warnings.push(`${label(i)}: ${lo === hi ? `${lo}` : `${lo}–${hi}`} skills at this level (${c} listed).`);
    });
    if (level === 'nf') {
      for (const s of all) if (s.dd > 0.2) s.flag = 'over';
      if (all.some((s) => s.dd > 0.2)) warnings.push('New Flyers: skills may be at most 0.2 DD.');
      sums.forEach((d, i) => { if (d > 1.3) warnings.push(`${label(i)}: New Flyers passes may not exceed 1.3 DD (${d.toFixed(1)}).`); });
    }
    if (level === 'if') {
      for (const s of all) if (s.dd > 1.0 || (s.dd < 0.2 && !/rebound/i.test(s.name))) s.flag = 'over';
      if (all.some((s) => s.dd > 1.0)) warnings.push('Intermediate Flyers: skills may be at most 1.0 DD.');
      if (all.some((s) => s.dd < 0.2 && !/rebound/i.test(s.name))) warnings.push('Intermediate Flyers: skills must be 0.2 DD or higher (a rebound, 0.1, is allowed).');
      if (sums[0] > 2.6) warnings.push(`Pass 1: Intermediate Flyers may not exceed 2.6 DD (${sums[0].toFixed(1)}).`);
      if (sums[1] > 2.9) warnings.push(`Pass 2: Intermediate Flyers may not exceed 2.9 DD (${sums[1].toFixed(1)}).`);
    }
    if (level === 'hf') sums.forEach((d, i) => { if (n[i] && d < 2.0) warnings.push(`${label(i)}: High Flyers passes need at least 2.0 DD (${d.toFixed(1)}).`); });
    ps.forEach((p, i) => {
      const fulls = p.filter((s) => s.status === 'counting' && /^full\b|full twist/i.test(s.name)).length;
      if (fulls > 3) warnings.push(`${label(i)}: fulls earn difficulty at most 3 times per pass.`);
    });
  }

  const total = round1(sums[0] + sums[1]);
  const any = n[0] + n[1] > 0;
  return { passes: ps, sums, total, warnings, sv: any ? total : null, totals: [['Pass 1 DD', sums[0]], ['Pass 2 DD', sums[1]], ['Total DD', total]] };
}
