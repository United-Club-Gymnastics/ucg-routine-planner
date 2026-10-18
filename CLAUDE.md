# CLAUDE.md

Read `README.md` first: it is the manual ("Skill catalog" and "Data and how to rebuild it" cover the data).
This file only adds what a new session needs and the README doesn't say. The cross-repo plan (skill data
ownership, pinned bundle, rules library) is `docs/ARCHITECTURE.md` in nssharpe/gym-skill-extract.

## Handoff notes

Collected 2026-10-18 from the session that landed PR #12.

**Where the skill data comes from**
- **Two producers** write `js/data/`:
  - `tools/build_skills.py` writes `mag-skills.js`, `mag-vaults.js` and `mag-redirects.js`.
  - `tools/build_data.py` writes everything else. `masters-skills-mag.js` comes from the catalog, not
    from the CoP repo.
  - Neither runs in CI. CI builds from the committed `js/data` files.
- **`build_skills.py` reads both sibling repos live from disk:**
  - `UCG_COP_DIR` (default `C:/dev/ucg-code-of-points`): `catalog/ucg_skills.json`, code `UCG-MAG-ADD`,
    VT included. IDs come from the catalog and are frozen in that repo's `catalog/ids.json`. Don't
    recompute slugs.
  - `GYM_SKILL_EXTRACT_DIR` (default `C:/dev/gym-skill-extract`): `WG MAG CoP Extraction/skills_verified.json`.
  - The CoP commits must be on disk, not just on GitHub.
- **MAG mapping:** element_group I-IV becomes eg 1-4. Notes go through `tools/source/note_edits.json["mag"]`,
  keyed by the raw note text without the "Note: " prefix.
- **Redirects:** the CoP catalog's `redirects` (UCG-MAG-ADD and UCG-MASTERS-MAG) become
  `js/data/mag-redirects.js`. The `mag` loader in `js/skill-search.js` maps a retired ID to its
  replacement, but only when the old ID is absent and the target exists. The first case is PB 16 ->
  PB 15 (tested in `tests/mag.test.mjs`). **The WAG loader has no redirect hook yet**, so add one before
  any WAG code retires an ID.
- **Catalog element order:** `tools/source/catalog/catalog_wag_public.json` has the same content as
  upstream in a different element order. That's expected, because `version` hashes the content. Its
  bytes differ, though, so don't compare files by byte.
- **Masters vault values:** Nate decided (2026-10-18) that these move to ucg-code-of-points. Today they
  are here (`Masters Vault Values.xlsx` -> `masters-vaults.js`), and gym-skill-extract's `sources.py`
  reads `masters-vaults.js`.

**Open**
- Masters MAG picked up raw "(same box as ...)" notes on 2 PB skills. They may deserve `note_edits.json`
  entries.
- WG MAG and WAG records show the Code's description as their name. Nate decided (2026-10-18) to switch
  to own-words names, but only the ones he approves from a side-by-side list, and to stay close to the
  Code's wording.
- Files are written with LF, and git's CRLF warnings on Windows are harmless.
