// Opening a judge-practice calibration routine in the planner (?calibration=BB_2, from
// calibration/infinity/): the routine as an athlete with a UCG Infinity level, to look at
// skill by skill. Nothing is signed in to or saved. Loaded only for such a link.
import { newEntry, normalizeEntry } from './model.js';
import { INFINITY_GROUPS } from './scoring/wag.js';
import { ROUTINES } from '../calibration/infinity/routines.js';

/** The condensed group (I-IV) a USAG element group number is in, on one event. */
export const condensedOf = (ev, group) => Object.keys(INFINITY_GROUPS[ev].condensed).find((k) => INFINITY_GROUPS[ev].condensed[k].includes(Number(group))) ?? null;

/**
 * The calibration routine `id` as { routine, athlete }, or null (no such routine, or a vault).
 * Each of the sheet's skills (and the ones on the video outside its top 8) becomes the listed
 * skill it clearly is, when `match(eventId, { name, letter, group })` finds one with the same
 * value and condensed group; otherwise it stays as named, in the first group of its condensed
 * group. Either way the start value is the answer key's.
 */
export function calibrationAthlete(id, newId, match = () => null) {
  const r = ROUTINES.find((x) => x.id === id && x.event !== 'vt');
  if (!r) return null;
  const e = newEntry(newId(), 'wag', 'inf');
  e.routines[r.event] = [...r.skills, ...r.extras].map((s) => {
    const row = { name: s.name, letter: s.letter, eg: String(INFINITY_GROUPS[r.event].condensed[s.group]?.[0] ?? '') };
    const found = match(r.event, s);
    return found ? { ...row, name: found.label, skillId: found.id, eg: String(found.group), fromList: true } : row;
  });
  if (r.eventBonus) e.options[r.event] = { ...e.options[r.event], eventBonus: true };
  normalizeEntry(e);
  return { routine: r, athlete: { id: newId(), name: `Calibration ${r.id}`, club: '', entries: [e], createdAt: Date.now() } };
}
