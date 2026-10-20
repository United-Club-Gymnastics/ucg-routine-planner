# CLAUDE.md

Read `README.md` first: it is the manual ("Skill catalog" and "Data and how to rebuild it" cover the data).
This file only adds what a new session needs and the README doesn't say. The cross-repo plan (skill data
ownership, pinned bundle, rules library) is `docs/ARCHITECTURE.md` in nssharpe/gym-skill-extract.

## Shipping

Nate decided this on 2026-10-18, and it applies to all three repos (gym-skill-extract, ucg-code-of-points, ucg-routine-planner).

Work stops once, so Nate can review the work summary. After he approves it, finish everything in one go with no further pauses or questions:

1. commit;
2. push;
3. open the PR and merge it;
4. deploy (the planner deploys when main is pushed), and confirm the deploy run passed;
5. sync: fast-forward `main` in the local checkout under `C:/dev/`, and remove your worktree.

Stop early only if something fails: tests, the build, a merge conflict or the deploy. Then report what failed. If the change affects another repo (for example a catalog or ID change), say so in the summary, so the coordinator can start that repo's session. Anything destructive or outside this flow, such as deleting data or rewriting history, still needs its own OK.

## Handoff notes

Collected 2026-10-18 from the session that landed PR #12; updated 2026-10-20 by the review follow-up PRs.

**Rules sources** (Nate, 2026-10-20): UCG's rules live in Google Docs/Sheets, the source of record. The
links are in README "Scoring rules"; cite those, not PDF or Word copies. Rulings are recorded in
gym-skill-extract `rules/UCG-*/decisions.md`.

**Where the skill data comes from** (updated 2026-10-19, refactor step 4)
- **The skill bundle.** All skill data except T&T comes from gym-skill-extract's `bundle/`, vendored
  byte for byte in `tools/source/bundle/` and pinned by `tools/source/bundle.lock.json`. Update it only
  with `npm run sync-skills` (README, "Skill bundle"); never edit it by hand. `npm run check-bundle` (also
  `tests/bundle.test.mjs`) fails on a hand edit under `tools/source/bundle/`, on a lock mismatch, on
  `js/data/catalog-*.js` from another catalog version, and on a published ID the bundle drops
  (`tools/source/published-ids.json`, append-only; the other `js/data` files are covered by CI's rebuild, below).
  `.gitattributes` keeps its bytes (`-text`): without that, a Windows checkout would get CRLFs and fail its own
  hashes.
- **Two producers** write `js/data/`, both reading only this checkout:
  - `tools/build_skills.py` writes `mag-skills.js`, `mag-vaults.js` and `mag-redirects.js`.
  - `tools/build_data.py` writes everything else. `masters-skills-*.js` come from the catalog.
  - CI (`pages.yml`, every PR and push to main) reruns both and fails on any diff in `js/data`, then builds the site
    from the committed files.
- **Names:** a WG record's `description` in the bundle is the name the planner shows (Nate's approved
  own-words names; `code_text: true` where he kept the Code's wording). Name changes go to
  gym-skill-extract (`skill_catalog/wg_name_choices.json`), not here. UCG records' name is `description`.
- **MAG mapping:** element_group I-IV becomes eg 1-4. Notes go through `tools/source/note_edits.json["mag"]`,
  keyed by the raw note text without the "Note: " prefix.
- **Redirects:** each UCG skill file's `redirects` (MAG: ucg-mag + ucg-masters-mag; WAG: ucg-wag +
  ucg-masters-wag) become `js/data/{mag,wag}-redirects.js`. Both loaders in `js/skill-search.js` call
  `applyRedirects`, which maps a retired ID to its replacement only when the old ID is absent and the
  target exists. The first case is MAG PB 16 -> PB 15 (tested in `tests/mag.test.mjs`).
- **Masters vaults** come from the bundle's `ucg-masters-vaults.json` (owned by ucg-code-of-points),
  including the age bonus (`AGE_BONUS` in `masters-vaults.js`, used by `js/scoring/masters.js`).
- **Rules data still hard-coded** (no digest JSON yet): `ADV_VAULT`, `NON_FLIPPING` (build_skills.py),
  `SWING_HS` (mag.js), `TAG_FIXES`, `EXCLUDE`, `MASTERS_MAP` (a check only) (build_data.py), the Masters
  letter values and Infinity tables in `js/scoring/`, and `js/data/xcel.js`, `wag-infinity-vaults.js`.
  Infinity's values and condensed groups are tested against `levels.json`. WAG Masters counts a skill
  once by name (`js/scoring/wag.js`): a candidate for the bundle's WG-WAG-2025 same-element digest,
  which nothing reads yet (nor the WG-WAG composition and CV digests: no planner level scores them).

**IDs** (2026-10-20): `tools/source/published-ids.json` lists every skill and vault ID this site ever shipped.
`sync-skills` refuses a bundle in which one is neither an alias, a redirect nor retired by ucg-code-of-points;
`check-bundle` and `tests/published-ids.test.mjs` check the vendored bundle the same way. A retired ID with no
redirect is the CoP's deliberate decision (`cop.py remove --no-redirect`): saved rows holding it show as "Custom".
A bundle update is the last PR of a linked chain (CoP -> gym-skill-extract -> planner); merge in that order.

**Open**
- Masters MAG picked up raw "(same box as ...)" notes on 2 PB skills. They may deserve `note_edits.json`
  entries.
- Files are written with LF, and git's CRLF warnings on Windows are harmless.
- Rules data still hard-coded (above) should come from the bundle's digests, with a test that each table equals
  its digest (review 2026-10-20, M2/M4; `ADV_VAULT` 228 already disagrees with `rules/UCG-MAG/digest/vault.json`).
- Who owns the Firebase project, DNS and the other accounts: gym-skill-extract `docs/OPERATIONS.md`.
