// Opening a judge-practice calibration routine in the planner (?calibration=BB_2 from
// calibration/infinity/, ?calibration=mag/adv-fx from calibration/mag/): the routine as an athlete
// with that level, to look at skill by skill. Nothing is signed in to or saved. Loaded only for such a link.
import { newEntry, normalizeEntry } from './model.js';
import { INFINITY_GROUPS } from './scoring/wag.js';
import { ROUTINES } from '../calibration/infinity/routines.js';
import { ROUTINES as MAG_ROUTINES } from '../calibration/mag/routines.js';
import { skillRows } from '../calibration/mag/key.js';

/** The condensed group (I-IV) a USAG element group number is in, on one event. */
export const condensedOf = (ev, group) => Object.keys(INFINITY_GROUPS[ev].condensed).find((k) => INFINITY_GROUPS[ev].condensed[k].includes(Number(group))) ?? null;

const LEVEL_NAME = { dev: 'Developmental', int: 'Intermediate', adv: 'Advanced' };
const EVENT_NAME = { fx: 'Floor', ph: 'Pommel Horse', sr: 'Rings', vt: 'Vault', pb: 'Parallel Bars', hb: 'High Bar' };
/** A MAG calibration routine's name, e.g. "Advanced Floor". */
export const magRoutineName = (r) => `${LEVEL_NAME[r.level]} ${EVENT_NAME[r.event]}`;

/**
 * The calibration routine `id` as { routine, athlete }, or null (no such routine, or a vault).
 * Each of the sheet's skills (and the ones on the video outside its top 8) becomes the listed
 * skill it clearly is, when `match(eventId, { name, letter, group })` finds one with the same
 * value and condensed group; otherwise it stays as named, in the first group of its condensed
 * group. Either way the start value is the answer key's.
 */
export function calibrationAthlete(id, newId, match = () => null) {
  if (id.startsWith('mag/')) return magAthlete(id.slice(4), newId);
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

/**
 * A MAG calibration routine (calibration/mag/routines.js) as { routine, athlete }, or null: its skills
 * as the answer key scores them (skillRows), its options and its vault. The stick bonus and the
 * judges' own neutral deductions aren't part of a plan, so the planner's start value leaves out the stick.
 */
function magAthlete(id, newId) {
  const r = MAG_ROUTINES.find((x) => x.id === id);
  if (!r) return null;
  const e = newEntry(newId(), 'mag', r.level);
  if (r.event === 'vt') e.vault = r.vault;
  else {
    e.routines[r.event] = skillRows(r).map((s) => ({
      name: s.name,
      letter: s.notRecognised ? '' : s.letter,
      eg: s.notRecognised ? '' : String(s.eg || ''),
      ...(s.skillId ? { skillId: s.skillId, fromList: true } : {}),
      ...(s.notRecognised ? { notRecognised: true } : {}),
    }));
    if (Object.keys(r.options).length) e.options[r.event] = { ...r.options };
  }
  normalizeEntry(e);
  const name = magRoutineName(r);
  return { routine: { ...r, id: name, practiceId: r.id }, athlete: { id: newId(), name: `Calibration ${name}`, club: '', entries: [e], createdAt: Date.now() } };
}
