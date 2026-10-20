// An athlete as saved (Firestore or local mode), and bringing older saved shapes up to date.
// Loading never deletes anything: a level this version doesn't know (a renamed or newer
// discipline or level) is kept aside, hidden, and written back unchanged with the athlete.
// Loading never saves either: the migrated athlete is written on the coach's next edit.
//
// Schema versions (athlete.schemaVersion):
//   none  before 2026-10: UCG Infinity vaults saved by their name.
//   2     Infinity vaults saved by id (INF-001 ..., js/data/wag-infinity-vaults.js).
import { DISCIPLINES, levelInfo, normalizeEntry } from './model.js';
import { findInfinityVault } from './scoring/wag.js';

export const SCHEMA_VERSION = 2;

/** A level this version of the planner can show: a known discipline and level. */
export const knownEntry = (e) => !!e && typeof e === 'object' && !!DISCIPLINES[e.disc] && !!levelInfo(e.disc, e.level);

/** The levels kept aside (not shown) for an athlete, or []. */
export const hiddenEntries = (a) => a?.hidden || [];

/** True if the athlete was saved by a newer version of the planner (don't save over it). */
export const savedByNewer = (a) => Number(a?.schemaVersion) > SCHEMA_VERSION;

/**
 * Bring a saved athlete up to date, in place, and return it: unknown levels are kept aside,
 * every shown level gets its rows, older saved values are converted.
 */
export function migrateAthlete(a) {
  const raw = Array.isArray(a.entries) ? a.entries : a.entries && typeof a.entries === 'object' ? Object.values(a.entries) : [];
  // Not enumerable: never shown, never spread into a copy; athleteDoc puts them back.
  Object.defineProperty(a, 'hidden', { value: raw.filter((e) => !knownEntry(e)), enumerable: false, writable: true, configurable: true });
  a.entries = raw.filter(knownEntry);
  const from = Number(a.schemaVersion) || 1;
  for (const e of a.entries) {
    if (from < 2) migrateVault(e);
    normalizeEntry(e);
  }
  return a;
}

// Schema 1 -> 2: a UCG Infinity vault saved by name becomes its id. A name the table doesn't
// have stays as it is (the vault box flags it).
function migrateVault(e) {
  if (e.disc !== 'wag' || e.level !== 'inf' || !e.vault) return;
  const v = findInfinityVault(e.vault);
  if (v) e.vault = v.id;
}

/** The athlete as it is saved: every level, the hidden ones too, and the schema version. */
export function athleteDoc(a) {
  return {
    ...a,
    entries: [...(Array.isArray(a.entries) ? a.entries : []), ...hiddenEntries(a)],
    schemaVersion: Math.max(SCHEMA_VERSION, Number(a.schemaVersion) || 0),
  };
}
