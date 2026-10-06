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
// Vaults (revalueVault): the same element in the target level's own vault list, else that
// level's rule for other vaults (Masters: "any other vault", 0.0 + age bonus; Sapphire: other
// Level 9/10 vaults at 10.0; otherwise no vault).
import { eventSpec, levelInfo } from './model.js';
import { findSkill, magSkillAllowed, wagSkillAllowed } from './skill-search.js';
import { INFINITY_VAULT_LIST, WAG_MASTERS_VAULTS, WAG_WG_VAULTS, WG_TO_MASTERS, xcelVaults } from './scoring/wag.js';
import { MAG_MASTERS_VAULTS } from './scoring/mag.js';
import { VAULTS as MAG_VAULTS } from './data/mag-vaults.js';

const ROMAN = { I: '1', II: '2', III: '3', IV: '4', V: '5' };
const FLAGS = ['approx', 'noCredit', 'check'];

/** Remove re-valuing flags from a skill row (when it's picked again or edited by hand). */
export const clearRevalueFlags = (row) => FLAGS.forEach((f) => delete row[f]);

export function revalueEntry(entry, fromLevel, catalog, fromVault = '') {
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
  summary.vault = revalueVault(entry, fromLevel, fromVault, catalog);
  entry.revalued = { catalog: catalog.version, levels: catalog.levels, from: fromLevel, summary };
  return summary;
}

// The catalog records for a planner vault id at a level (Infinity vaults go by name, with
// the USAG number in its table; Xcel by USAG number; Masters WAG by WG number; MAG by WG
// number or UCG id). Generic choices ("other", "l9l10") have none.
function vaultRids(disc, level, id, catalog) {
  if (!id || id === 'other' || id === 'l9l10') return [];
  const fam = levelInfo(disc, level).family;
  const usag = (n) => Object.keys(catalog.vaultOf).filter((r) => r.startsWith(`USAG-VT-${n}-`) || r.startsWith(`USAGDP-VT-${n}-`));
  if (disc === 'mag') return [/^\d+$/.test(id) ? `WG-VT-${id}` : id];
  if (id.startsWith('UCGM-')) return [id];
  if (id.startsWith('L910-')) return usag(id.slice(5));
  if (fam === 'infinity') {
    const v = INFINITY_VAULT_LIST.find((x) => x.name === id);
    return v?.usag ? usag(v.usag) : [];
  }
  if (fam === 'wagMasters') return [`WGW-VT-${id}-1`];
  return usag(id);
}

// The vault choices a level offers, by planner id.
function vaultOptions(disc, level) {
  const fam = levelInfo(disc, level).family;
  if (disc === 'mag') return [...MAG_VAULTS.map((v) => v.id), ...(level === 'masters' ? MAG_MASTERS_VAULTS.map((v) => v.id) : [])];
  if (fam === 'xcel') return xcelVaults(level).map((v) => v.id).filter((id) => id !== 'l9l10');
  if (fam === 'infinity') return INFINITY_VAULT_LIST.map((v) => v.name);
  return [...WAG_WG_VAULTS.map((v) => v.id), ...WAG_MASTERS_VAULTS.map((v) => v.id)];
}

/** Re-value the copied vault. Returns 'exact' | 'approx' | 'other' | 'none' | '' (no vault). */
export function revalueVault(entry, fromLevel, fromVault, catalog) {
  delete entry.vaultFlag;
  if (!fromVault) return '';
  const rule = Object.values(catalog.levelRules).find((r) => r.planner_id === entry.level);
  const masters = levelInfo(entry.disc, entry.level).masters;
  const option = {};
  for (const id of vaultOptions(entry.disc, entry.level)) for (const r of vaultRids(entry.disc, entry.level, id, catalog)) option[r] ??= id;
  const srcRids = vaultRids(entry.disc, fromLevel, fromVault, catalog);
  const all = [...new Set(srcRids.flatMap((r) => catalog.vaultOf[r] || []))];
  // The vault's own element (where its record is the element itself, not a broader record
  // listed under neighbouring vaults); only if there's none is the match approximate.
  const exact = all.filter((el) => catalog.vaults[el].some((x) => srcRids.includes(x.r) && !x.rel));
  const rank = (x) => (rule.value_codes.indexOf(x.c) + 1 || 99) * 2 + (x.rel ? 1 : 0);
  const find = (els) => els.flatMap((el) => catalog.vaults[el]).filter((x) => option[x.r]).sort((a, b) => rank(a) - rank(b));
  // Its own element first; failing that, the elements its broader record covers (approximate).
  let hits = exact.length ? find(exact) : [];
  const viaBroad = !hits.length;
  if (viaBroad) hits = find(all);
  if (hits.length) {
    entry.vault = option[hits[0].r];
    const approx = viaBroad || exact.length !== 1;
    if (approx) entry.vaultFlag = 'approx';
    return approx ? 'approx' : 'exact';
  }
  // Not in this level's own list: the level's rule for other vaults.
  if (masters) {
    entry.vault = 'other';
    entry.vaultFlag = 'other';
    return 'other';
  }
  if (entry.level === 'sapphire' && els.some((el) => catalog.vaults[el].some((x) => x.c === 'USAG-DP-2026'))) {
    entry.vault = 'l9l10';
    return 'exact';
  }
  entry.vault = '';
  entry.vaultFlag = 'none';
  return 'none';
}
