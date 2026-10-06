// Re-valuing a routine copied from another level, using the cross-code skill catalog
// (js/data/catalog-{wag,mag}.js, loaded only when needed). Each skill picked from the
// list is looked up as a catalog element and given the target level's own code entry:
// its value, element group and planner skill (e.g. an Xcel skill copied to Masters
// becomes the WG skill). Rules (catalog README, levels.json):
//   - Target code: the first of the level's value_codes with an entry for the element,
//     preferring an entry that is the element itself over a broader one ("covers_more").
//   - WG "adjusted_value" (beam jumps in side position, WG p.23) wins over "value".
//   - Approximate: the routine's own record is broader than the element, or its id maps
//     to several elements: the value depends on which version was performed.
//   - No entry in the level's codes: not credited there (kept, flagged, worth nothing).
//   - Skills typed in by hand can't be looked up: kept as they are, flagged to check.
import { eventSpec, levelInfo } from './model.js';
import { findSkill, magSkillAllowed, wagSkillAllowed } from './skill-search.js';
import { WG_TO_MASTERS } from './scoring/wag.js';

const ROMAN = { I: '1', II: '2', III: '3', IV: '4', V: '5' };
const FLAGS = ['approx', 'noCredit', 'check'];

/** Remove re-valuing flags from a skill row (when it's picked again or edited by hand). */
export const clearRevalueFlags = (row) => FLAGS.forEach((f) => delete row[f]);

export function revalueEntry(entry, fromLevel, catalog) {
  const fam = levelInfo(entry.disc, entry.level).family;
  const rule = Object.values(catalog.levelRules).find((r) => r.planner_id === entry.level);
  const allowed = (s) =>
    !!s && (entry.disc === 'wag' ? wagSkillAllowed(fam, entry.level, s) : magSkillAllowed(entry.level, s));
  const element = (id) => catalog.elements[catalog.merged[id] || id];
  const summary = { exact: 0, approximate: 0, notCredited: 0, typed: 0 };

  for (const [evId, rows] of Object.entries(entry.routines || {})) {
    const letters = eventSpec(entry, evId).letters || [];
    for (const row of rows) {
      if (!String(row.name || '').trim() && !row.letter) continue;
      clearRevalueFlags(row);
      const ids = (row.skillId && catalog.aliases[row.skillId]) || [];
      const els = ids.map(element).filter(Boolean);
      if (!els.length) {
        row.check = true;
        summary.typed++;
        continue;
      }
      const el = els[0];
      const isOwn = (x) => x.r === row.skillId || catalog.pidOf[x.r] === row.skillId;
      const own = Object.values(el.c).flat().find(isOwn);
      const ownCode = Object.keys(el.c).find((c) => el.c[c].some(isOwn));
      // Same code at both levels (Xcel Gold -> Platinum, MAG Dev -> Adv, Sapphire <-> Infinity):
      // the skill keeps its own record and value.
      if (ownCode && rule.value_codes.includes(ownCode) && allowed(findSkill(row.skillId))) {
        row.fromList = true;
        summary.exact++;
        continue;
      }
      const approx = ids.length > 1 || own?.rel === 'covers_more';

      let code, pick;
      for (const c of rule.value_codes) {
        const xs = el.c[c];
        if (xs?.length) {
          code = c;
          pick = xs.find((x) => !x.rel) || xs[0];
          break;
        }
      }
      if (!pick) {
        // Not in any code this level uses: keep the skill so the gymnast sees it, worth nothing.
        Object.assign(row, { letter: '', eg: '', noCredit: true });
        delete row.skillId;
        row.fromList = true;
        summary.notCredited++;
        continue;
      }

      // The planner skill to show: the target entry itself, else another record of the same
      // element that this level's skill list offers.
      const pidFor = (x) => catalog.pidOf[x.r] || (findSkill(x.r) ? x.r : null);
      let pid = pidFor(pick);
      if (!allowed(findSkill(pid))) pid = Object.values(el.c).flat().map(pidFor).find((p) => allowed(findSkill(p))) || null;
      const listed = pid && findSkill(pid);
      if (!listed) {
        // The level's code has the element, but not as a skill this level offers (e.g. an Xcel
        // skill limited to Bronze/Silver/Gold copied to Platinum): not credited there.
        Object.assign(row, { letter: '', eg: '', noCredit: true });
        delete row.skillId;
        row.fromList = true;
        summary.notCredited++;
        continue;
      }

      const value = String(pick.x || pick.v || '').split('=')[0];
      const g = String(pick.g || '');
      let eg = '';
      if (fam === 'mag') eg = ROMAN[g] || '';
      else if (fam === 'infinity') eg = /^\d+$/.test(g) ? g : ''; // the USAG group; scoring condenses it
      else if (fam === 'wagMasters') eg = code === 'WG-WAG-2025' ? String(WG_TO_MASTERS[evId]?.[g] || '') : ROMAN[g] || '';

      row.name = listed.label;
      row.skillId = listed.id;
      row.letter = letters.includes(value) ? value : '';
      if (fam !== 'xcel') row.eg = eg;
      row.fromList = true;
      if (approx) {
        row.approx = true;
        summary.approximate++;
      } else summary.exact++;
    }
  }
  entry.revalued = { catalog: catalog.version, levels: catalog.levels, from: fromLevel, summary };
  return summary;
}
