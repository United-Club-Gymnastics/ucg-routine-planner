// Xcel rules that depend on what a skill is (acro, salto, circle, giant ...), worked out
// from the listed skills (Xcel Code of Points 2022-2028, each event's Chapter 1, and
// General/Judges Chapter 9 for the Sapphire bonus; UCG Women's Rules II.B-F):
//   - restrictions by kind of skill ("no B acro" ...), on top of the value limits;
//   - which special requirements the routine meets, and by which skill;
//   - the Sapphire bonus (difficulty and connection).
// What a skill is comes from the catalog's tags (skill.tags, tools/build_data.py). A skill
// typed in by hand has none, so it never meets a requirement by itself: the coach ticks it.
// Some requirements also depend on how a skill is done (a cast's angle, a leap's split,
// which bar): those are met "assuming" it is done that way, and the coach can untick them.

const RANK = { A: 1, B: 2, C: 3, D: 4, E: 5 };
const atLeast = (it, l) => (RANK[it.letter] || 0) >= RANK[l];
const T = (it) => it.skill?.tags || {};
const tagged = (it) => !!it.skill?.tags;
const group = (it) => Number(it.skill?.group) || null;
const credited = (it) => it.status === 'counting' || it.status === 'noncounting';

const MOUNT = { ub: 1, bb: 1 };
const DISMOUNT = { ub: 8, bb: 9 };
const isMount = (ev, it) => group(it) === MOUNT[ev];
const isDismount = (ev, it) => group(it) === DISMOUNT[ev];
const inner = (ev, it) => !isMount(ev, it) && !isDismount(ev, it);

// ---- connections -------------------------------------------------------------

/** Filled rows in order, split into passes: rows joined by `link` (an isolated skill is a pass of one). */
export function passesOf(items) {
  const filled = items.filter((it) => it.status !== 'blank');
  const passes = [];
  let pass = [];
  filled.forEach((it, k) => {
    pass.push(it);
    if (!(it.link && k < filled.length - 1)) {
      passes.push(pass);
      pass = [];
    }
  });
  return passes;
}

// Directly connected pairs in a pass. A round-off rebound (UCG Silver floor) joins the
// skills either side of it rather than counting as one of them.
function pairs(pass) {
  const els = pass.filter((it) => !T(it).rebound);
  return els.slice(1).map((b, i) => [els[i], b]);
}

// ---- restrictions by kind of skill ------------------------------------------------

// [level][event] -> list of [test, reason]. The value limits (max letter, Diamond's one D)
// are in data/xcel.js; these come from the same Difficulty Restrictions charts.
const KIND_RULES = {
  silver: {
    ub: [
      [(it) => T(it).giant && T(it).bar === 'LB', 'No low bar giants at Silver'],
      [(it, ev) => isDismount(ev, it) && T(it).salto, 'No salto dismounts at Silver'],
    ],
    bb: [[(it) => T(it).acro && it.letter === 'B', 'No "B" acro skills at Silver']],
    fx: [[(it) => T(it).acro && it.letter === 'B', 'No "B" acro skills at Silver']],
  },
  gold: {
    ub: [
      [(it) => T(it).giant, 'No giants at Gold'],
      [(it) => T(it).release && T(it).bar_change && it.letter === 'B', 'No "B" releases with a bar change at Gold'],
    ],
    fx: [[(it) => T(it).salto && T(it).twist && it.letter === 'B', 'No "B" twisting saltos at Gold']],
  },
  plat: {
    bb: [[(it) => T(it).acro && it.letter === 'C', 'No "C" acro skills at Platinum']],
    fx: [[(it) => T(it).acro && it.letter === 'C', 'No "C" acro skills at Platinum']],
  },
};

/** Marks restricted skills (not yet marked by value) with the reason. Returns how many. */
export function markKindRestrictions(level, ev, items) {
  const rules = KIND_RULES[level]?.[ev] || [];
  let n = 0;
  for (const it of items) {
    if (it.status || !tagged(it)) continue;
    const hit = rules.find(([test]) => test(it, ev));
    if (hit) {
      Object.assign(it, { status: 'restricted', reason: 'restricted', restrictWhy: hit[1] });
      n++;
    }
  }
  // Silver floor: at most one salto or aerial; any after the first is restricted.
  if (level === 'silver' && ev === 'fx') {
    const saltos = items.filter((it) => !it.status && (T(it).salto || T(it).aerial));
    for (const it of saltos.slice(1)) {
      Object.assign(it, { status: 'restricted', reason: 'restricted', restrictWhy: 'Only one salto or aerial at Silver' });
      n++;
    }
  }
  return n;
}

// ---- special requirements -------------------------------------------------------------

// A requirement met: by which rows, and what it assumes about how they're done (or null).
const met = (by, assumes = null) => ({ by: [].concat(by).map((it) => it.idx), assumes });
// The first that needs no assumption, else the first.
const best = (list) => list.filter(Boolean).sort((a, b) => !!a.assumes - !!b.assumes)[0] || null;

// Clear support / cast angle, lowest to highest.
const ANGLE = { below: 0, h: 1, above_h: 2, 45: 3, hs: 4 };
const ANGLE_TEXT = {
  below: 'the cast reaches at least 45° below horizontal',
  h: 'it finishes in clear support at least at horizontal',
  above_h: 'it finishes in clear support above horizontal',
  45: 'it finishes in clear support within 45° of vertical',
  hs: 'it finishes in handstand',
};
function support(ev, it, need) {
  const t = T(it);
  if (!t.cast_sr || !inner(ev, it)) return null;
  const a = t.support_angle;
  if (a && a !== 'any') return ANGLE[a] >= ANGLE[need] ? met(it) : null;
  return met(it, ANGLE_TEXT[need]);
}

const circle = (ev, it) => T(it).circle360 && inner(ev, it);
const fromHB = (it, what = 'it is from the high bar') => (T(it).bar === 'LB' ? null : met(it, T(it).bar === 'HB' ? null : what));

// Two circles for Gold SR 2/3: different elements, or the same one directly connected, or
// the same one on each bar.
function twoCircles(items, key) {
  const out = [];
  items.forEach((a, i) => items.slice(i + 1).forEach((b) => {
    if (key(a) !== key(b)) out.push(met([a, b]));
    else if (a.link && b.idx === a.next) out.push(met([a, b]));
    else if (T(a).bar && T(b).bar && T(a).bar !== 'either' && T(b).bar !== 'either') {
      if (T(a).bar !== T(b).bar) out.push(met([a, b]));
    } else out.push(met([a, b], 'one is on the low bar and one on the high bar'));
  }));
  return best(out);
}

// Beam/floor turn on one foot of at least `deg`.
const turnOneFoot = (ev, it, deg) => group(it) === (ev === 'bb' ? 3 : 2) && !T(it).turn_two_feet && (T(it).turn_deg || 0) >= deg;
const SPLIT = { bb: { silver: 90, gold: 120, plat: 120, diamond: 150, sapphire: 180 }, fx: { silver: 90, gold: 120, plat: 150, diamond: 150, sapphire: 180 } };
const splitText = (deg) => `a split of at least ${deg}°`;
// Beam dance series elements: Group 1 dance mounts, Group 2, Group 3 turns on one foot.
const beamDance = (it) => (group(it) === 1 && (T(it).dance || it.skill?.markers?.includes('D'))) || group(it) === 2 || (group(it) === 3 && !T(it).turn_two_feet);
const splitLeapOrJump = (it) => ['leap', 'jump'].includes(T(it).dance_type) && T(it).split;

const acro = (ev, it) => T(it).acro && (ev !== 'bb' || inner(ev, it));
const flight = (ev, it) => acro(ev, it) && T(it).flight;

function beamDanceSeries(passes, level) {
  const series = passes.flatMap(pairs).filter(([a, b]) => beamDance(a) && beamDance(b));
  const split = passes.flat().filter((it) => group(it) === 2 && splitLeapOrJump(it));
  if (!series.length || !split.length) return null;
  return met([...series[0], split[0]], splitText(SPLIT.bb[level]));
}

function floorDancePassage(passes, level, key) {
  const deg = SPLIT.fx[level];
  for (const pass of passes) {
    const dance = pass.filter((it) => group(it) === 1);
    const leap = dance.find((it) => T(it).dance_type === 'leap' && T(it).split);
    const other = leap && dance.find((it) => key(it) !== key(leap));
    if (other) return met([leap, other], splitText(deg));
  }
  return null;
}

// Floor acro passes.
const flightPair = (ev, pass) => pairs(pass).find(([a, b]) => flight(ev, a) && flight(ev, b));
const salto = (it) => T(it).salto;
const saltoOrAerial = (it) => T(it).salto || T(it).aerial;

/**
 * Which special requirements the routine meets. Uses credited skills only (restricted
 * skills and repeats without credit never meet one). Returns 4 entries:
 * { by: [row indexes], assumes: text | null } or null.
 */
export function detectSR(level, ev, items, key) {
  const filled = items.filter((it) => it.status !== 'blank');
  filled.forEach((it, k) => (it.next = filled[k + 1]?.idx));
  const live = items.filter((it) => credited(it) && it.skill);
  const passes = passesOf(items).map((p) => p.filter((it) => live.includes(it))).filter((p) => p.length);
  const find = (test) => live.find(test);
  const all = (test) => live.filter(test);
  const one = (test, assumes) => {
    const it = find(test);
    return it ? met(it, typeof assumes === 'function' ? assumes(it) : assumes) : null;
  };
  const dismount = (test = () => true) => all((it) => isDismount(ev, it) && test(it));

  if (ev === 'ub') {
    const circles = (l = 'A') => all((it) => circle(ev, it) && atLeast(it, l));
    if (level === 'silver') {
      return [
        one((it) => isMount(ev, it)),
        best(live.map((it) => support(ev, it, 'below'))),
        one((it) => circle(ev, it)),
        one((it) => isDismount(ev, it) && tagged(it) && !salto(it)),
      ];
    }
    if (level === 'gold') {
      const c = circles();
      return [
        best(live.map((it) => support(ev, it, 'h'))),
        c.length ? met(c[0]) : null,
        twoCircles(c, key),
        best(dismount(tagged).map((it) => fromHB(it))),
      ];
    }
    if (level === 'plat') {
      return [
        best(live.map((it) => support(ev, it, 'above_h'))),
        one((it) => circle(ev, it)),
        one((it) => T(it).kip),
        best(dismount(tagged).map((it) => fromHB(it))),
      ];
    }
    const c = circles('B');
    const turn = one((it) => inner(ev, it) && atLeast(it, 'B') && T(it).turn_deg);
    const release = one((it) => !isDismount(ev, it) && atLeast(it, 'B') && T(it).release);
    if (level === 'diamond') {
      return [
        best(live.map((it) => support(ev, it, '45'))),
        c.length ? met(c[0]) : null,
        best([turn, c.length > 1 ? met(c[1]) : null, release]),
        best(dismount((it) => tagged(it) && ((T(it).salto || T(it).hecht) || atLeast(it, 'B'))).map((it) => fromHB(it))),
      ];
    }
    // Sapphire
    const different = c.find((it) => key(it) !== key(c[0]));
    // ... or a "C" skill directly connected to an "A" salto dismount.
    const connected = dismount((d) => salto(d) && d.letter === 'A').map((d) => {
      const p = live.find((x) => x.link && x.next === d.idx && atLeast(x, 'C'));
      return p ? met([p, d]) : null;
    });
    return [
      best(live.filter((it) => atLeast(it, 'B')).map((it) => support(ev, it, 'hs'))),
      c.length ? met(c[0]) : null,
      best([turn, different ? met(different) : null, release]),
      best([...dismount((it) => atLeast(it, 'B')).map((it) => met(it)), ...connected]),
    ];
  }

  const sr4dismount = () => {
    if (level === 'diamond') return one((it) => isDismount(ev, it) && saltoOrAerial(it));
    if (level === 'sapphire') {
      const plain = one((it) => isDismount(ev, it) && atLeast(it, 'B'));
      const conn = dismount((d) => saltoOrAerial(d) && d.letter === 'A').map((d) => {
        const p = live.find((x) => x.link && x.next === d.idx && T(x).acro && T(x).flight);
        return p ? met([p, d]) : null;
      });
      return best([plain, ...conn]);
    }
    return one((it) => isDismount(ev, it));
  };

  if (ev === 'bb') {
    const turn = one((it) => turnOneFoot(ev, it, level === 'silver' ? 180 : 360));
    const deg = SPLIT.bb[level];
    const series = passes.flatMap(pairs).filter(([a, b]) => acro(ev, a) && acro(ev, b));
    let sr2;
    let sr3;
    if (level === 'silver') {
      sr2 = one((it) => group(it) === 2 && splitLeapOrJump(it), splitText(deg));
      sr3 = one((it) => acro(ev, it) && !T(it).flight);
    } else if (level === 'gold') {
      const g2 = all((it) => group(it) === 2);
      const split = g2.find(splitLeapOrJump);
      const other = split && g2.find((it) => key(it) !== key(split));
      sr2 = other ? met([split, other], splitText(deg)) : null;
      const inv = find((it) => acro(ev, it) && T(it).inverted);
      const second = inv && find((it) => acro(ev, it) && it !== inv);
      sr3 = second ? met([inv, second]) : null;
    } else {
      sr2 = beamDanceSeries(passes, level);
      const invSeries = series.find(([a, b]) => T(a).inverted || T(b).inverted);
      if (level === 'plat') {
        sr3 = best([one((it) => flight(ev, it) && T(it).inverted), invSeries ? met(invSeries) : null]);
      } else if (level === 'diamond') {
        const fl = find((it) => flight(ev, it));
        sr3 = invSeries && fl ? met([...invSeries, fl]) : null;
      } else {
        const s = series.find(([a, b]) => [a, b].some((x) => flight(ev, x) && (T(x).inverted || salto(x) || T(x).aerial)));
        sr3 = s ? met(s) : null;
      }
    }
    return [turn, sr2, sr3, sr4dismount()];
  }

  // Floor
  const turn = level === 'diamond' || level === 'sapphire'
    ? one((it) => turnOneFoot(ev, it, 1) && atLeast(it, 'B'))
    : one((it) => turnOneFoot(ev, it, 360));
  const dance = floorDancePassage(passes, level, key);
  let sr1 = null;
  let sr2 = null;
  if (level === 'diamond') {
    const fp = passes.filter((p) => flightPair(ev, p));
    const iso = find((it) => salto(it) && atLeast(it, 'C') && !fp.some((p) => p.includes(it)));
    if (fp.length >= 2) sr1 = met([...flightPair(ev, fp[0]), ...flightPair(ev, fp[1])]);
    else if (fp.length && iso) sr1 = met([...flightPair(ev, fp[0]), iso]);
    const saltos = all(salto);
    const b = saltos.find((it) => atLeast(it, 'B'));
    const other = b && saltos.find((it) => key(it) !== key(b));
    sr2 = other ? met([b, other]) : null;
  } else if (level === 'sapphire') {
    const p = passes.find((x) => x.filter(salto).length >= 2);
    sr1 = p ? met(p.filter(salto).slice(0, 2)) : null;
    const distinct = [...new Map(all(salto).map((it) => [key(it), it])).values()];
    sr2 = distinct.length >= 3 && distinct.some((it) => atLeast(it, 'B')) ? met(distinct.slice(0, 3)) : null;
  } else {
    // Silver - Platinum: SR 1 and SR 2 come from different passes.
    const tests = {
      silver: [(p) => pairs(p).find(([a, b]) => acro(ev, a) && acro(ev, b) && (flight(ev, a) || flight(ev, b))), (p) => pairs(p).find(([a, b]) => acro(ev, a) && acro(ev, b)) || p.filter((it) => flight(ev, it)).slice(0, 1)],
      gold: [(p) => flightPair(ev, p), (p) => flightPair(ev, p) || p.filter(saltoOrAerial).slice(0, 1)],
      plat: [(p) => p.some(salto) && flightPair(ev, p), (p) => flightPair(ev, p) || p.filter((it) => salto(it) && it.letter === 'B').slice(0, 1)],
    }[level];
    const hit = (test, p) => {
      const r = test(p);
      return r && (r.length ? r : null);
    };
    const a = passes.filter((p) => hit(tests[0], p));
    const b = passes.filter((p) => hit(tests[1], p));
    const p1 = a.find((p) => b.some((q) => q !== p)) || a[0];
    const p2 = b.find((q) => q !== p1);
    if (p1) sr1 = met(level === 'plat' ? [...flightPair(ev, p1), p1.find(salto)] : hit(tests[0], p1));
    if (p2) sr2 = met(hit(tests[1], p2));
  }
  return [sr1, sr2, dance, turn];
}

// ---- Sapphire bonus ----------------------------------------------------------------

export const BONUS_MAX = 0.4;
const FLOOR_ACRO_GROUPS = new Set([3, 4, 5, 6, 7, 8]);

/**
 * Sapphire bonus (General/Judges Ch. 9), up to 0.40, awarded in routine order:
 * - difficulty: +0.10 for each "C" (each element once) and for one "D" per event;
 * - connection: +0.10 for each "B"+"B" (or higher) direct connection (each exact
 *   connection once); on floor also "B"+ acro skills in the same pass with lower-valued
 *   acro between them (an indirect acro connection).
 * Only credited skills listed in the Xcel Code earn bonus (UCG's added Development / Level
 * 9-10 skills don't); skills typed in by hand count on the value given.
 * Sets it.bonus on the row that earns it and returns { total, parts }.
 */
export function sapphireBonus(ev, items, key) {
  const eligible = (it) => credited(it) && (!it.skill || (it.skill.src === 'USAG' && !it.skill.prog));
  const parts = [];
  const seenC = new Set();
  let dUsed = false;
  for (const it of items) {
    if (!eligible(it)) continue;
    if (it.letter === 'C' && !seenC.has(key(it))) {
      seenC.add(key(it));
      parts.push({ kind: 'difficulty', at: it.idx, rows: [it.idx], text: `"C" ${it.name}` });
    } else if (it.letter === 'D' && !dUsed) {
      dUsed = true;
      parts.push({ kind: 'difficulty', at: it.idx, rows: [it.idx], text: `"D" ${it.name}` });
    }
  }
  const seenPair = new Set();
  const connect = (a, b) => {
    const k = `${key(a)}>${key(b)}`;
    if (seenPair.has(k)) return;
    seenPair.add(k);
    parts.push({ kind: 'connection', at: b.idx, rows: [a.idx, b.idx], text: `${a.name} + ${b.name}` });
  };
  for (const pass of passesOf(items)) {
    for (let k = 1; k < pass.length; k++) {
      const [a, b] = [pass[k - 1], pass[k]];
      if (eligible(a) && eligible(b) && atLeast(a, 'B') && atLeast(b, 'B')) connect(a, b);
    }
    if (ev !== 'fx') continue;
    const bAcro = pass.filter((it) => eligible(it) && atLeast(it, 'B') && (it.skill ? FLOOR_ACRO_GROUPS.has(group(it)) : false));
    for (let k = 1; k < bAcro.length; k++) {
      if (pass.indexOf(bAcro[k]) - pass.indexOf(bAcro[k - 1]) > 1) connect(bAcro[k - 1], bAcro[k]);
    }
  }
  parts.sort((x, y) => x.at - y.at || (x.kind === 'difficulty' ? -1 : 1));
  let total = 0;
  for (const p of parts) {
    p.value = total + 0.1 <= BONUS_MAX + 1e-9 ? 0.1 : 0;
    total = Math.round((total + p.value) * 10) / 10;
    const row = items[p.at];
    if (p.value) row.bonus = Math.round(((row.bonus || 0) + p.value) * 10) / 10;
  }
  return { total, parts };
}
