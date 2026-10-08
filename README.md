# UCG Routine Planner

One planner for every UCG discipline and level: **WAG** (Xcel Silver, Gold, Platinum, Diamond, Sapphire, UCG Infinity, Masters), **MAG** (Developmental, Intermediate, Advanced, Masters) and **T&T** (New, Intermediate and High Flyers). Gymnasts and coaches sign in with Google (or try it without signing in, which saves nothing), add athletes, add the levels each athlete competes, build routines, and export filled-in UCG worksheets and competition cards.

**Live site:** https://routines.unitedclubgymnastics.org/ (custom domain on GitHub Pages: a CNAME for `routines` in the WordPress.com DNS for unitedclubgymnastics.org; the old `united-club-gymnastics.github.io/ucg-routine-planner/` address redirects there. The domain is also in Firebase Authentication &rarr; Authorized domains.)

Grew out of the MAG planner ([ucg-mag-planner](https://github.com/United-Club-Gymnastics/ucg-mag-planner)) and Julia Sharpe's [UCG Infinity SV Sheets](https://github.com/jzsharpe/ucg-infinity-sv); both are still live and unchanged.

## Who owns what

| Piece | Where | Who can change it |
| --- | --- | --- |
| Code and hosting | This repo in the [United-Club-Gymnastics](https://github.com/United-Club-Gymnastics) GitHub organization, published by GitHub Pages | Organization owners and members with write access |
| Sign-in and saved routines | Firebase project `ucg-routine-planners`, in the unitedclubgymnastics.org Google Cloud organization | Everyone in `google-cloud-admin@unitedclubgymnastics.org` |
| Rules | UCG rules policies for each discipline | Each discipline's rules team |

Athletes are saved in Firestore at `users/{user id}/athletes/{athlete}`. Each athlete holds a list of **entries**, one per level they compete (`{ disc, level, decade?, routines, passes, options, vault }`). The MAG planner's data (`magAthletes`) is separate and untouched. Guests who haven't signed in are kept in memory only; if they sign in, their athletes are saved to their account.

## How it's organized

| File | What it does |
| --- | --- |
| [`js/model.js`](js/model.js) | Disciplines, levels and events; one `scoreEvent` / `scoreEntry` for every level; copying routines between levels |
| [`js/scoring/mag.js`](js/scoring/mag.js) | MAG Dev / Int / Adv / Masters |
| [`js/scoring/wag.js`](js/scoring/wag.js) | UCG Infinity, Xcel, WAG Masters |
| [`js/scoring/masters.js`](js/scoring/masters.js) | Masters age-decade values and vault age bonus (shared by MAG and WAG) |
| [`js/scoring/tt.js`](js/scoring/tt.js) | T&T difficulty totals and level requirement checks |
| [`js/data/`](js/data/) | Skill lists, vault tables, Xcel requirements, example routines (most generated, see below) |
| [`js/app.js`](js/app.js) | The screen: athlete search, levels, routines, skill picker |
| [`js/pdf.js`](js/pdf.js), [`js/pdf-infinity.js`](js/pdf-infinity.js) | PDF export |

## Scoring rules

**MAG** (2026-2028 UCG MAG Rules + MAG worksheets): see the MAG planner's README; unchanged here except that Masters is added, and that Advanced requirements and bonuses the routine itself shows are detected from the skill list: the floor double flip (any double or triple salto), the floor double flipping dismount (the last skill listed is a double or triple salto), and the rings swing to handstand (I.75, I.81, I.86, I.87, I.88, per the WG clarification). Skills typed in by hand are matched by name for the floor doubles; otherwise the gymnast ticks the box. **MAG Masters** (UCG Masters Rules Policy v2.01): values by age decade (Misc, Masters Element, A, B, C, D+), top 6 count, +0.5 per element group I-III with a skill at the decade's level, dismount group worth the dismount's value, -1.0 per skill under 6, vault = WG value + age bonus.

**UCG Infinity** (UCG Infinity Rules v1.2): A=0.1, B=0.3, C=0.5, D=0.7, E=0.9; top 8 count; +0.3 per condensed group with a B or higher (counting or not); +0.3 apparatus bonus; -1.0 per skill under 6; vault from the Infinity vault table.

**Xcel** (UCG Women's Rules Policy v6.0 + USAG Xcel Code 2022-2028 event charts): start 10.0 (Sapphire 9.6 + up to 0.4 bonus); -0.50 per missing special requirement; minus the value of each missing value part (A=0.1, B=0.3, C=0.5; a higher value part can fill a lower one); -0.50 per restricted skill (above the level's limit; Diamond allows one D; Sapphire has no restrictions, Ds and Es included; Platinum bars counts the clear hip, stalder and toe-on circle to handstand without turn as B). [`js/scoring/xcel-rules.js`](js/scoring/xcel-rules.js) works out, from each listed skill's catalog tags (acro, flight, salto, 360° circle, ...; `t` in `skill-index-wag.js`) and the connections: restrictions by kind of skill (Silver "B" acro, Gold giants, ...); which **special requirements** the routine meets and by which skills, some "assuming" what a plan can't show (a cast's angle, a leap's split, which bar), which the coach can untick (or tick one met by a typed-in skill; stored as `options[event].srSet`, only where it differs from the detection); and the **Sapphire bonus** (+0.1 per "C" and one "D", +0.1 per "B"+"B" connection, floor indirect acro too; only skills in the Xcel Code and UCG's own WAG additions, not the Development / Level 9-10 skills UCG allows at Sapphire; 0.40 max). Vaults from the Xcel vault chart; Gold 9.5 with the alternative springboard; Sapphire also lists the USAG Level 9/10 vaults that aren't in its chart, at 10.0. **Counting an element more than once** (Xcel CoP General D-F and each event's Chapter 2): an element earns value-part credit at most twice, the second time only in a different connection (a different element before or after it); never a third time. Bars routines are treated as one continuous sequence for repeats; on every event the gymnast marks directly connected skills with the link toggle between rows. On floor the connection that counts is the pass and the place in it, and acro flight elements with hand support (round-off, flic-flac, ...) earn credit every time in a different pass. Records the Code treats as several different elements are split into `forms` (from the extractor; one skill per form, e.g. `USAG-BB-7.104-1b` one-arm back walkover; the bare record id stays as an alias of form "a"), and `same_as` links division stand-ins to the regular skills. Which listed versions of one USAG number are the same element comes from a per-number review (`tools/source/wag_same_elements.json`; its `unsure` entries are open questions for the WAG rules lead). UCG Infinity: each element earns credit once, whatever the connection. **WAG skill search by level:** Xcel levels get the USAG Xcel skills (without ones limited to other divisions, e.g. "Bronze/Silver/Gold only") and the UCG additions; Sapphire and UCG Infinity (the Open Scoring Level) also get the USAG Development Program E elements; WAG Masters gets the WG skills. USAG skill names are our own short names, not the Code's text (see `wagSkillAllowed` in `js/skill-search.js`).

**WAG Masters**: values by age decade, top 6 count, +0.5 per condensed group with a skill at the decade's level (counting or not), -1.0 per skill under 6. The skill search offers the WG WAG skills and fills in the condensed group (WG groups mapped per the Masters policy). Vault = the vault's value + age bonus, from the UCG Masters vaults (squat on, roll over, hechts, forward headspring, sideways handsprings) or the WG WAG vault table, or 0.0 for any other vault.

**T&T** (UCG T&T Code of Points v3.41 + DD charts; double mini tuck/pike/straddle jumps are 0.0, per the UCG addendum, until the T&T team decides on WG's change): total DD per routine or pass, with each level's requirements flagged (max skill DD, salto counts, pass and routine DD limits, repeats, pass sizes). Double mini: each pass's first skill is marked mounter or spotter (stored as `start` on the pass, default mounter), since a repeat only loses its difficulty in the same position. Saltos are recognised from the FIG shorthand, or the skill name when there's no shorthand.

## Skill catalog: box numbers, other names, re-valuing

`tools/source/catalog/` holds the cross-code skill catalog built in Dropbox `Reference/gym_skill_extract/skill_catalog` (only the `*_public` catalogs, `aliases_*.json` and `levels.json`; the full catalogs carry the codes' text and stay private). `build_data.py` turns it into:
- `js/data/skill-index.js`: each planner skill's box number in its own code (`WG I.75`, `Xcel 7.104`, `DP 1.512`, `UCG FX 12`, `Masters PB 12` with the page) and other names coaches use. Shown in the skill list and on the picked row; searchable.
- `js/data/masters-skills.js`: the UCG Masters MAG and WAG skill lists. MAG Masters offers WG + this list instead of the main UCG MAG additions; WAG Masters offers WG + this list.
- `js/data/catalog-{wag,mag}.js`: loaded only when a routine is copied to another level. `js/revalue.js` then gives each listed skill the target level's code entry (value, element group, planner skill), per `levels.json`: first code in `value_codes` with an entry; WG `adjusted_value` (beam jumps in side position) wins; **approximate** when the routine's own record is broader than the element or maps to several; **not credited** (kept, flagged, worth nothing) when no code of that level has it; skills typed in by hand are flagged to check. The entry records the catalog and levels versions it was re-valued with. **Vaults** are carried over the same way: the same vault in the target level's own list (Masters: WG or UCG Masters vaults; Xcel: that level's chart, plus Level 9/10 vaults at Sapphire; Infinity: its vault table, matched by USAG number), approximate when only a broader record matches; otherwise the level's rule (Masters: any other vault, 0.0 + age bonus; otherwise no vault, flagged). The Masters MAG code's "GE" (gymnastics element) is the Rules Policy's Miscellaneous Gymnastics Skill: the planner's "Misc".

Routines store the planner's skill ids, which the catalog's aliases resolve (with `merged`), so catalog rebuilds don't break saved routines. To update: copy the new public files into `tools/source/catalog/` and run `python tools/build_data.py`.

## Data and how to rebuild it

| Data | Source | Rebuild |
| --- | --- | --- |
| `data/mag-skills.js`, `data/mag-vaults.js` | UCG MAG CoP master + FIG MAG CoP 2025-2028 extractor | `python tools/build_skills.py` (needs the Code of Points repo and Inkscape) |
| `data/wag-skills.js` | WG WAG CoP 2025-2028 (`tools/source/wag_wg_skills.json`, from the extractor in Dropbox `Reference/gym_skill_extract/WG WAG CoP Extraction`) + USAG Xcel 2022-2028, USAG Development Program 2026-2030 E elements and the UCG WAG CoP additions (`tools/source/ucg_wag_skills_simplified.json`, from `Reference/gym_skill_extract/UCG WAG Skills`). **Only the simplified file goes in this repo:** the full one has USAG's text, and this repo is public | `python tools/build_data.py` |
| `data/wag-same.js` | `tools/source/wag_same_elements.json`: which listed versions of a USAG number count as the same element, and the floor hand-support flight elements (reviewed against the Xcel and Development Program codes; reasons in our own words) | `python tools/build_data.py` |
| `data/sapphire-vaults.js` | USAG Level 9/10 vaults not in the Xcel Sapphire chart (same simplified file) | `python tools/build_data.py` |
| `data/wag-vaults.js` | WG WAG vault table (`wag_wg_skills.json`) | `python tools/build_data.py` |
| `data/masters-vaults.js` | `tools/source/Masters Vault Values.xlsx`: the vaults that aren't in the WG code (values as printed in the Masters CoP vault boxes, which win over its example table). The build also checks the table's WG vaults against the WG values and prints any mismatch | `python tools/build_data.py` |
| `data/tt-skills.js` | UCG T&T DD charts incl. the UCG addendum (`tools/source/tt_skills.json`) | `python tools/build_data.py` |
| `data/examples.js` | T&T and MAG Dev/Int example routine sheets (`tools/source/examples.json`, typos fixed). T&T example skills found in the DD chart take the chart's shorthand and DD (some sheets predate the UCG addendum). Examples that break their level's rules are left out (`EXCLUDE` in `build_data.py`; `node tools/check_examples.mjs` lists them, and a test keeps the rest clean) | `python tools/build_data.py` |
| `data/xcel.js` | Xcel event rules charts and vault chart (hand-entered) | edit directly |
| `data/wag-infinity-vaults.js` | Julia's Infinity vault table | edit directly |
| `assets/worksheets/tt-*.pdf` | 2023 NAIGC competition cards, logo removed, requirement boxes corrected | `python tools/make_tt_cards.py` |

`tools/source/*_notes.md` record the judgment calls made while extracting (e.g. the DMT jump values, strikethroughs on the DD charts).

## Worksheets

MAG Dev/Int/Adv, MAG Masters and the T&T cards are the printouts people already fill in by hand; the planner writes onto them at fixed positions measured from each PDF (`LAYOUTS` in `js/pdf.js`). **If a sheet changes, replace it in `assets/worksheets/` and re-measure.** UCG Infinity uses Julia's worksheet. Xcel uses a low-ink worksheet drawn in `js/pdf.js` (there's no official one), and WAG Masters a low-ink, UCG-branded drawing of the Masters WAG SV worksheet (2026 Individual World Cup) with its age-decade value table.

## Develop locally

```bash
npm start      # serves the source on http://localhost:8080 (no build needed)
npm test       # scoring tests (Node 20+)
```

Open <http://localhost:8080/?local> to try it without signing in (saved in that browser only). In development the files load as they are: Firebase and pdf-lib come from their CDNs, and there's no service worker.

## Bringing athletes over from the original UCG Infinity planner

Julia Sharpe's *UCG Infinity SV Sheets* (jzsharpe.github.io/ucg-infinity-sv, Firebase project `ucg-infinity-sv-generator`) is replaced by this planner. Signed-in members use **Bring over UCG Infinity routines** (athlete menu, or the first-run screen): [`js/import-infinity.js`](js/import-infinity.js) signs them in to the old project with Google (a second Firebase app), reads `users/{uid}/athletes`, and converts each into an athlete with a UCG Infinity level (bars/beam/floor -> ub/bb/fx; apparatus bonus; vault by name; each typed skill becomes the listed skill it clearly is, via `closestSkill` in `js/skill-search.js`: same value and USAG group, every typed word in its name or nicknames, at most one extra word and none for a one-word name, no equally close rival; such rows keep `matchedFrom` and are flagged "Matched" until edited; the rest stay as typed). Imported athletes carry `importedFrom: "infinity-sv:<old id>"`, so they aren't brought twice. Start values are identical: the conversion was checked against the old planner's own scoring on 8,000+ random routines. The old project must list `routines.unitedclubgymnastics.org` under Authentication -> Authorized domains, and must stay in place for as long as members may still import.

## Build and deploy

Pushing to `main` runs `.github/workflows/pages.yml`: `npm ci`, the scoring tests, `npm run build`, a browser smoke test of the build, then publishes `_site/` to GitHub Pages. To do the same locally:

```bash
npm ci                                  # once: esbuild, Firebase, pdf-lib, Playwright
npm run build                           # -> _site/
npm run preview                         # http://localhost:8139/ucg-routine-planner/ (like GitHub Pages)
npx playwright install chromium         # once
npm run smoke                           # browser smoke test of _site/
```

What the build does (`tools/build_site.mjs`):
- **Bundles** `js/app.js` with esbuild, with code splitting and hashed file names. Startup is about 140 KB of JavaScript. Firebase, PDF export, the skill catalog and each discipline's skill lists (`loadDiscipline` in `js/skill-search.js`) are separate chunks, loaded on demand and fetched ahead (on hovering a level, Export PDF, or showing the copy panel).
- **Swaps the pinned CDN imports** for the same versions from npm (`CDN` in the build script), so the live site doesn't depend on those CDNs. If you add a CDN import, pin it there too or the build fails.
- **Writes `sw.js`** (from `tools/sw-template.js`): a service worker that stores every file of the build on the device (about 1.25 MB, once). The planner opens instantly and works offline, including PDF export. Each build is a version; after a deploy, open pages show "A new version of the planner is ready — Reload".

Offline data: Firestore keeps a copy on the device. Edits save there with no signal ("Saved on this device · will sync when online") and sync later. Changes made on another device arrive live, but never redraw the screen while you're typing ("Changed on another device — Load latest").

The font (Saira Condensed, OFL) is served from `assets/fonts/`.

## Design

UCG Design System (2026 identity): navy / blue green / light blue, condensed caps display type (Saira Condensed as the web fallback for Greed Condensed), 20px cards. Discipline badges: WAG purple, MAG navy, T&T dark blue green.
