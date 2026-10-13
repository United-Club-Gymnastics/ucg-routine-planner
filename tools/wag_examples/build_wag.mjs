// Build WAG Xcel example routines (examples.json shape) from the parsed sheet + overrides.json,
// and report anything doubtful: unmatched names, sheet values that differ from the list,
// links inferred, and the Sapphire bonus vs the sheet's.
import { readFileSync, writeFileSync } from 'node:fs';

const [, , routinesPath, overridesPath, outPath] = process.argv;
const root = new URL('../../js/', import.meta.url).href;
const ss = await import(root + 'skill-search.js');
const model = await import(root + 'model.js');
await ss.loadDiscipline('wag');
const OV = JSON.parse(readFileSync(overridesPath, 'utf8'));
const routines = JSON.parse(readFileSync(routinesPath, 'utf8'));
const LEVEL = { silver: 'Xcel Silver', gold: 'Xcel Gold', plat: 'Xcel Platinum', diamond: 'Xcel Diamond', sapphire: 'Xcel Sapphire' };
const FORCE = { 'wag-sapphire-fx-6': [3] }; // Switch side leap → Popa: the sheet counts the connection (Popa B there, C in the Code)
const EVENT = { ub: 'Uneven Bars', bb: 'Balance Beam', fx: 'Floor Exercise' };

const report = { unmatched: [], valueDiffs: [], notAllowed: [], links: [], series: [], bonus: [] };
// A skill that rebounds straight into the next acro skill (tumbling and beam acro series).
const CONNECTOR = /\b(roundoff|round-off|handspring|flyspring|step-?out|whip|bhs|fhs)\b/i;

const out = [];
for (const r of routines) {
  const allowed = (x) => ss.wagSkillAllowed('xcel', r.level, x);
  const skills = r.skills.map((s, i) => {
    const ov = OV[`${r.level}|${r.event}|R${r.n}|${i + 1}`] ?? OV[`${r.level}|${r.event}|${s.name}`] ?? OV[`${r.event}|${s.name}`];
    let m = null;
    if (ov && typeof ov === 'object') return { sheetName: s.name, name: s.name, letter: ov.typed || s.letter || '', eg: '' };
    if (typeof ov === 'string') {
      m = ss.findSkill(ov);
      if (!m) throw new Error(`no skill ${ov} (${r.level} ${r.event} ${s.name})`);
      if (!allowed(m)) report.notAllowed.push(`${r.level} ${r.event} R${r.n}: ${s.name} -> ${ov}`);
    } else {
      m = ss.closestSkill('wag', r.event, s.name, (x) => allowed(x) && (!s.letter || x.value === s.letter));
    }
    if (!m) {
      report.unmatched.push(`${r.level} ${r.event} R${r.n}: ${s.name} (${s.letter || '-'})`);
      return { sheetName: s.name, name: s.name, letter: s.letter || '', eg: '' };
    }
    if (s.letter && s.letter !== m.value) report.valueDiffs.push(`${r.level} ${r.event} R${r.n}: "${s.name}" sheet ${s.letter}, list ${m.value} (${m.box} ${m.name})`);
    return { sheetName: s.name, name: m.label, skillId: m.id, letter: m.value, eg: String(m.group), fromList: true };
  });
  // Links: on floor and beam, a rebounding acro skill straight into the next acro skill.
  if (r.event !== 'ub') {
    const acro = (k) => { const x = skills[k]; const sk = x?.skillId && ss.findSkill(x.skillId); return sk && (r.event === 'fx' ? sk.group >= 4 : sk.group >= 6); };
    const g = (k) => { const x = skills[k]; const sk = x?.skillId && ss.findSkill(x.skillId); return sk ? sk.group : null; };
    for (let k = 0; k < skills.length - 1; k++) {
      // Floor: a roll or a Group 5 skill (handspring, walkover, cartwheel, round-off) into the next acro skill.
      const floorG5 = r.event === 'fx' && [4, 5].includes(g(k)) && g(k + 1) >= 4 && g(k + 1) <= 8;
      if ((CONNECTOR.test(r.skills[k].name) && acro(k) && acro(k + 1)) || floorG5) skills[k].link = true;
    }
    // Back-to-back skills the sheet lists as a series: see series() below.
  }
  const grp = (k) => { const x = skills[k]; const sk = x?.skillId && ss.findSkill(x.skillId); return sk ? sk.group : null; };
  // keep(k): whether linking k -> k+1 may stay (at Sapphire: not past the sheet's bonus).
  // Beam acro: any two acro skills before the dismount (a handstand into a back walkover,
  // round-off or back handspring is an acro series too).
  const beamAcro = (k) => { const sk = skills[k]?.skillId && ss.findSkill(skills[k].skillId); return !!sk?.tags?.acro && sk.group !== 9 && sk.group !== 1; };
  const series = (keep = () => true) => {
    if (r.event === 'ub') return;
    for (let k = 0; k < skills.length - 1; k++) {
      const [g1, g2] = [grp(k), grp(k + 1)];
      const pair = r.event === 'fx' ? (g1 === 1 && g2 === 1) || (g1 === 6 && g2 === 6) : (g1 === 2 && g2 === 2) || (beamAcro(k) && beamAcro(k + 1));
      // The same skill twice in a row is linked too: the second earns credit in a different connection.
      if (!pair || skills[k].link) continue;
      skills[k].link = true;
      if (keep(k)) report.series.push(`${r.level} ${r.event} R${r.n}: ${r.skills[k].name} → ${r.skills[k + 1].name}`);
      else { delete skills[k].link; report.series.push(`${r.level} ${r.event} R${r.n}: not linked ${r.skills[k].name} → ${r.skills[k + 1].name} (bonus past the sheet's)`); }
    }
  };
  const lastIs8 = r.event === 'ub' && grp(skills.length - 1) === 8;
  if (lastIs8 && r.level !== 'sapphire') skills[skills.length - 2].link = true;
  if (r.level !== 'sapphire') series();
  const ex = {
    id: `wag-${r.level}-${r.event}-${r.n}`,
    discipline: 'wag', level: r.level, event: r.event,
    title: `${LEVEL[r.level]} ${EVENT[r.event]} Routine ${r.n}`,
    ...(r.sheetBonus != null ? { sheetBonus: r.sheetBonus } : {}),
    skills,
  };
  if (r.level === 'sapphire') {
    const bonusOf = () => {
      const e = model.newEntry('x', 'wag', r.level);
      model.applyExample(e, { ...ex, disc: 'wag', skills: skills.map(({ sheetName, ...x }) => ({ ...x })) });
      return model.scoreEvent(e, r.event).bonus;
    };
    // The sheet puts a connection series' bonus on its first skill: from each skill with a
    // bonus cell, link forward one skill at a time while that raises the app's bonus toward
    // the sheet's (never past it).
    const added = [];
    for (let k = 0; k < r.skills.length && bonusOf() < r.sheetBonus - 1e-9; k++) {
      if (!r.skills[k].bonus) continue;
      for (let j = k; j < skills.length - 1 && bonusOf() < r.sheetBonus - 1e-9; j++) {
        if (skills[j].link) continue;
        const before = bonusOf();
        skills[j].link = true;
        if (bonusOf() > before + 1e-9 && bonusOf() <= r.sheetBonus + 1e-9) added.push(`${r.skills[j].name} → ${r.skills[j + 1].name}`);
        else { delete skills[j].link; break; }
      }
    }
    if (added.length) report.links.push(`${ex.id}: ${added.join('; ')}`);
    // Then the series the sheet lists, unless a link would earn more bonus than it gives
    // (not a connection the coach counted).
    series(() => bonusOf() <= r.sheetBonus + 1e-9);
    if (lastIs8 && !skills[skills.length - 2].link) {
      skills[skills.length - 2].link = true;
      if (bonusOf() > r.sheetBonus + 1e-9) delete skills[skills.length - 2].link;
    }
    // Forced: links the sheet's bonus shows but the app values differently (see the notes).
    for (const k of FORCE[ex.id] || []) skills[k].link = true;
    const app = bonusOf();
    if (Math.abs(app - r.sheetBonus) > 1e-9) report.bonus.push(`${ex.id}: sheet ${r.sheetBonus}, app ${app}`);
  }
  out.push(ex);
}
writeFileSync(outPath, JSON.stringify(out, null, 1));
for (const [k, v] of Object.entries(report)) console.log(`\n## ${k} (${v.length})\n${v.join('\n')}`);
