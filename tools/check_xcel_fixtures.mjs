// Runs the Xcel Code's sample routines (tests/fixtures/xcel-routine-examples.json: element
// numbers, connections and the Code's outcome per routine) through the planner and lists
// where the start value, missing special requirements, restricted count or bonus differ.
//   node tools/check_xcel_fixtures.mjs          (all)    --verbose   (each mismatch in detail)
// Also used by tests/xcel-fixtures.test.mjs.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { findSkill, loadDiscipline } from '../js/skill-search.js';
import { scoreXcel } from '../js/scoring/wag.js';
import { SKILLS } from '../js/data/wag-skills.js';

const LEVEL = { Silver: 'silver', Gold: 'gold', Platinum: 'plat', Diamond: 'diamond', Sapphire: 'sapphire' };
const LETTER = /^[A-E]$/;

export async function loadFixtures() {
  await loadDiscipline('wag');
  return JSON.parse(readFileSync(new URL('../tests/fixtures/xcel-routine-examples.json', import.meta.url), 'utf8'));
}

// The Code prints an element number; the planner lists each version in that box (variants,
// forms). Candidates: the Xcel versions with that number, those with the printed value first.
function candidates(app, row) {
  if (row.number == null) {
    if (row.vp === 'Not an element' || row.vp == null) return null; // steps, chassés ...: not listed
    // "Other mount" is an A; "2nd D" a D; "No VP" is listed but worth nothing.
    const letter = /2nd .D/.test(row.vp || '') ? 'D' : row.vp === 'No VP' ? '' : 'A';
    return [{ name: row.vp || 'Other', letter, link: row.link_next }];
  }
  const numberOf = (s) => s.id.replace(/^USAG-\w+-/, '').replace(/-\d+[a-z]?$/, '');
  const xcel = SKILLS.filter((s) => s.app === app && s.src === 'USAG' && !s.prog);
  // A division stand-in is named by its whole record ("2.0 Platinum-1").
  let all = xcel.filter((s) => numberOf(s) === row.number || s.id === `USAG-${app.toUpperCase()}-${row.number}`);
  // Printed without its letter (BB "5.106" for 5.106a / 5.106b).
  if (!all.length) all = xcel.filter((s) => /^[a-z]$/.test(numberOf(s).slice(row.number.length)) && numberOf(s).startsWith(row.number));
  const sameValue = LETTER.test(row.vp) ? all.filter((s) => s.value === row.vp) : all;
  const list = (sameValue.length ? sameValue : all).map((s) => {
    const skill = findSkill(s.id);
    // A leap the Code counts as an "A" for the division (split angle) keeps its tags.
    return { name: s.name, letter: LETTER.test(row.vp) ? row.vp : s.value, skillId: s.id, skill, link: row.link_next };
  });
  return list.length ? list : [{ name: `Xcel ${row.number}`, letter: LETTER.test(row.vp) ? row.vp : 'A', link: row.link_next }];
}

function compare(fx, r) {
  const missing = r.sr.map((m, i) => (m ? null : i + 1)).filter(Boolean);
  const diffs = [];
  if (r.sv !== fx.sv) diffs.push(`SV ${r.sv} vs ${fx.sv}`);
  if (JSON.stringify(missing) !== JSON.stringify([...fx.missing_sr].sort())) diffs.push(`missing SR [${missing}] vs [${fx.missing_sr}]`);
  if ((r.restricted || 0) !== (fx.restricted || 0)) diffs.push(`restricted ${r.restricted} vs ${fx.restricted}`);
  if (fx.bonus_total != null && r.bonus !== fx.bonus_total) diffs.push(`bonus ${r.bonus} vs ${fx.bonus_total}`);
  return diffs;
}

/** Each fixture: { fx, ok, diffs (best try), tries }. Tries every combination of versions (capped). */
export function checkAll(fixtures) {
  return fixtures.map((fx) => {
    const app = fx.event.toLowerCase();
    const level = LEVEL[fx.division];
    // Connected: the rows of each pass, passage or series the Code draws (its `groups`; direct,
    // indirect or in one block) - the rows a coach links in the planner.
    const linked = new Set();
    for (const g of fx.groups || []) for (const i of g.elements.slice(0, -1)) linked.add(i);
    const rows = fx.routine.map((row, i) => candidates(app, { ...row, link_next: linked.has(i) })).filter(Boolean);
    let combos = [[]];
    for (const opts of rows) {
      combos = combos.flatMap((c) => opts.map((o) => [...c, o]));
      if (combos.length > 2000) combos = combos.slice(0, 2000);
    }
    let best = null;
    for (const combo of combos) {
      const r = scoreXcel(level, app, combo);
      const diffs = compare(fx, r);
      if (!best || diffs.length < best.diffs.length) best = { diffs, r, combo };
      if (!diffs.length) break;
    }
    return { fx, ok: !best.diffs.length, diffs: best.diffs, best, tries: combos.length };
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const results = checkAll(await loadFixtures());
  const bad = results.filter((x) => !x.ok);
  for (const { fx, diffs, best } of bad) {
    console.log(`${fx.division} ${fx.event} p${fx.page} ${fx.section} #${fx.example}: ${diffs.join('; ')}`);
    if (process.argv.includes('--verbose')) {
      best.combo.forEach((c, i) => console.log(`   ${i}. ${c.skillId || '-'} ${c.letter} ${c.link ? '+' : ' '} ${JSON.stringify(c.skill?.tags || {})} -> ${best.r.items[i].status}`));
      console.log('   detected:', JSON.stringify(best.r.detectedSr));
    }
  }
  console.log(`${results.length - bad.length} of ${results.length} sample routines match the Code`);
}
