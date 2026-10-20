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

The rules' sources of record are UCG's Google Docs and Sheets (Nate, 2026-10-20). Cite and check these,
not PDF or Word copies, which go out of date:

| Rules | Source of record |
|---|---|
| UCG Women's Rules (Xcel levels) | https://docs.google.com/document/d/1FuuEUaLWjk0NTADYSfr2RDprikdjxjcqEdrdHRmIAtg/edit |
| UCG Infinity (Open Scoring Level) Rules | https://docs.google.com/document/d/1Us_lv6CADGZSOZDHEWb5nHzq7Z5XhhIFFwyFnTWlbVA/edit |
| UCG MAG Rules Policy 2026-28 | https://docs.google.com/document/d/1hTJjtE5UNa6bj1nWi37LvoJ3coeobLuD2-TLoO066Us/edit |
| UCG MAG Rules Breakdown (level table) | https://docs.google.com/spreadsheets/d/13lx3jKzxjbMOovUb6ZZNI4FzzsVF6rApsPDvUjCnTps/edit#gid=1498227199 |
| UCG Masters Rules Policy | https://docs.google.com/document/d/1VeRTNv1KVrkCbHEo9r36qbRBxt0Me6VJ66E8jkvck_c/edit |

They open with the UCG account (nate.sharpe@unitedclubgymnastics.org). gym-skill-extract's `rules/UCG-*`
holds dated text extracts and own-words digests of them (`rules/gdoc_text.py` refreshes the extracts).

**MAG** (2026-2028 UCG MAG Rules + MAG worksheets): see the MAG planner's README; unchanged here except that Masters is added, and that Advanced requirements and bonuses the routine itself shows are detected from the skill list: the floor double flip (any double or triple salto), the floor double flipping dismount (the last skill listed is a double or triple salto; every level), and the rings swing to handstand (I.75, I.81, I.86, I.87, I.88, per the WG clarification). Skills typed in by hand are matched by name for the floor doubles; otherwise the gymnast ticks the box. **MAG Masters** (UCG Masters Rules Policy v2.01): values by age decade (Misc, Masters Element, A, B, C, D+), top 6 count, +0.5 per element group I-III with a skill at the decade's level, dismount group worth the dismount's value up to 0.5 (floor has no dismount group), -1.0 per skill under 6, vault = WG or Masters CoP vault value + age bonus (the UCG MAG CoP's own vaults aren't offered at Masters). **Developmental vaults:** flipping and round-off-entry vaults are banned (score 0); only the front and sideways handsprings without salto remain. **Sub-A** skills are worth 0.0 but count toward the 6 skills.

**UCG Infinity** (UCG Infinity Rules v1.2; the +0.3 event bonuses are back in v1.2): A=0.1, B=0.3, C=0.5, D=0.7, E=0.9; top 8 count; +0.3 per condensed group with a B or higher (counting or not); +0.3 apparatus bonus; -1.0 per skill under 6 (a listed skill with no value, e.g. the no-value high cast offered at Sapphire and Infinity, shows in the routine but earns nothing and isn't one of the 6); vault from the Infinity vault table.

**Xcel** (UCG Women's Rules v6.0 + USAG Xcel Code 2022-2028 event charts): start 10.0 (Sapphire 9.6 + up to 0.4 bonus); -0.50 per missing special requirement; minus the value of each missing value part (A=0.1, B=0.3, C=0.5; a higher value part can fill a lower one); -0.50 per restricted skill (above the level's limit; Diamond allows one D; Sapphire has no restrictions, Ds and Es included; Platinum bars counts the clear hip, stalder and toe-on circle to handstand without turn as B). [`js/scoring/xcel-rules.js`](js/scoring/xcel-rules.js) works out, from each listed skill's catalog tags (acro, flight, salto, 360° circle, ...; `t` in `skill-index-wag.js`) and the connections: restrictions by kind of skill (Silver "B" acro, Gold giants, ...); which **special requirements** the routine meets and by which skills, some "assuming" what a plan can't show (a cast's angle, a leap's split, which bar), which the coach can untick (or tick one met by a typed-in skill; stored as `options[event].srSet`, only where it differs from the detection); and the **Sapphire bonus** (+0.1 per "C" and one "D" or "E", +0.1 per "B"+"B" connection, floor indirect acro too; only skills in the Xcel Code and UCG's own WAG additions, except that a Development Program E can earn the one-"D" bonus, since an E counts as a D (Nate, 2026-10-20); 0.40 max). Vaults from the Xcel vault chart; Gold 9.5 with the alternative springboard; Sapphire also lists the USAG Level 9/10 vaults that aren't in its chart, at 10.0. **Counting an element more than once** (Xcel CoP General D-F and each event's Chapter 2): an element earns value-part credit at most twice, the second time only in a different connection (a different element before or after it); never a third time. Bars routines are treated as one continuous sequence for repeats; on every event the gymnast marks directly connected skills with the link toggle between rows. On floor the connection that counts is the pass and the place in it, and acro flight elements with hand support (round-off, flic-flac, ...) earn credit every time in a different pass. Records the Code treats as several different elements are split into `forms` (from the extractor; one skill per form, e.g. `USAG-BB-7.104-1b` one-arm back walkover; the bare record id stays as an alias of form "a"), and `same_as` links division stand-ins to the regular skills. Which listed versions of one USAG number are the same element comes from a per-number review (the skill bundle's `rules/USAG-XCEL-2022/digest/same-element.json`; Nate ruled on its `unsure` calls on 2026-10-19). UCG Infinity: each element earns credit once, whatever the connection. **WAG skill search by level:** Xcel levels get the USAG Xcel skills (without ones limited to other divisions, e.g. "Bronze/Silver/Gold only") and the UCG additions; Sapphire and UCG Infinity (the Open Scoring Level) also get the USAG Development Program E elements; WAG Masters gets the WG skills. USAG skill names are our own short names, not the Code's text (see `wagSkillAllowed` in `js/skill-search.js`).

**WAG Masters**: values by age decade, top 6 count, +0.5 per condensed group with a skill at the decade's level (counting or not), -1.0 per skill under 6. The skill search offers the WG WAG skills and fills in the condensed group (WG groups mapped per the Masters policy). Vault = the vault's value + age bonus, from the UCG Masters vaults (squat on, roll over, hechts, forward headspring, sideways handsprings) or the WG WAG vault table, or 0.0 for any other vault.

**T&T** (UCG T&T Code of Points v3.41 + DD charts; double mini tuck/pike/straddle jumps are 0.0, per the UCG addendum, until the T&T team decides on WG's change): total DD per routine or pass, with each level's requirements flagged (max skill DD, salto counts, pass and routine DD limits, repeats, pass sizes). Double mini: each pass's first skill is marked mounter or spotter (stored as `start` on the pass, default mounter), since a repeat only loses its difficulty in the same position. Saltos are recognised from the FIG shorthand, or the skill name when there's no shorthand.

## Skill catalog: box numbers, other names, re-valuing

The skill bundle's `catalog/` (`tools/source/bundle/catalog/`, see "Skill bundle" below) holds the cross-code skill catalog built in the `gym-skill-extract` repo (only the `*_public` catalogs, `aliases_*.json` and `levels.json`; the full catalogs carry the codes' text and stay private). `build_data.py` turns it into:
- `js/data/skill-index.js`: each planner skill's box number in its own code (`WG I.75`, `Xcel 7.104`, `DP 1.512`, `UCG FX 12`, `Masters PB 12` with the page) and other names coaches use. Shown in the skill list and on the picked row; searchable.
- `js/data/masters-skills.js`: the UCG Masters MAG and WAG skill lists. MAG Masters offers WG + this list instead of the main UCG MAG additions; WAG Masters offers WG + this list.
- `js/data/catalog-{wag,mag}.js`: loaded only when a routine is copied to another level. `js/revalue.js` then gives each listed skill the target level's code entry (value, element group, planner skill), per `levels.json`: first code in `value_codes` with an entry; WG `adjusted_value` (beam jumps in side position) wins; **approximate** when the routine's own record is broader than the element or maps to several; **not credited** (kept, flagged, worth nothing) when no code of that level has it; skills typed in by hand are flagged to check. The entry records the catalog and levels versions it was re-valued with. **Vaults** are carried over the same way: the same vault in the target level's own list (Masters: WG or UCG Masters vaults; Xcel: that level's chart, plus Level 9/10 vaults at Sapphire; Infinity: its vault table, matched by USAG number), approximate when only a broader record matches; otherwise the level's rule (Masters: any other vault, 0.0 + age bonus; otherwise no vault, flagged). The Masters MAG code's "GE" (gymnastics element) is the Rules Policy's Miscellaneous Gymnastics Skill: the planner's "Misc".

Routines store the planner's skill ids, which the catalog's aliases resolve (with `merged`), so catalog rebuilds don't break saved routines. To update: `npm run sync-skills`.

**WAG catalog 06016336f87b, MAG catalog 416d8893cfa6 (2026-10-19, the first synced skill bundle):** UCG MAG PB "Peach 1/2 to hang" (UCG and Masters, same IDs) is now "Felge (peach) ½ to hang", and its other names are "Felge (basket) ½ to hang" and "Felge (peach basket) ½ to hang". The retired Masters WAG straight hecht vault (`UCGM-wag-straight-hecht-over-table`, already gone from the Masters vault list since 2026-10-06) loses its catalog element entry and box label, so copying a routine that still holds it to another level gives "no vault, flagged". No other skill's name, value, element group or other names changed, and no skills were added or removed.

**WAG catalog 65d08096cdae, MAG catalog 7aca10f8a5d5 (2026-10-18):** the re-laid-out UCG WAG and Masters WAG Codes. Masters WAG gains 8 skills copied from the UCG WAG additions (UB straddle vault mount with ½ turn; BB handstand drop to shoulderstand (no hold), front lever, jump backward with ½ turn to chest stand, two and three scissors mounts, mount with 2 circles and a 360° russian; FX round-off from both feet), each in the same catalog element as its UCG WAG original. A new Masters page 5 (Balance Beam cont.) moves FX and UB (cont.) one page later, and 18 Masters boxes are renumbered (`skill-index-wag.js` shows the new numbers and pages). Masters eponyms now match UCG WAG (BB 21 and UCG BB 10 are "Lim/Niolet"). The MAG change is a video link only; `build_skills.py` also picks up the Code of Points' "Penn 1/Sharpe" spelling on the UCG HB toe-on. No planner IDs changed or were retired.

**MAG catalog 1ddacb9a8d8b (2026-10-17):** UCG MAG PB 16 (Backward roll to L with straight body) is retired into PB 15, now "Bwd. roll piked or stretched from upper arm to support" (`MAG-PB-0193` forwards to `MAG-PB-0192`). Routines saved with the old UCG or Masters ID open on PB 15 (`js/data/mag-redirects.js`).

**MAG catalog e403916a0bb1 (2026-10-16):** the Code of Points repo's corrections: video links on UCG MAG records, Masters MAG notes that were missing, two PH drawing labels no longer read as eponyms, fuller Masters names ("... x2"), the two renamed UCG boxes (SR basket pull up to L, VT hecht backflip) under their new names with the same IDs, and the Masters "Russian + Flop combo" merged into the UCG addition (`MAG-PH-0127` forwards to `MAG-PH-0115`, under `merged` in `aliases_mag.json`). No planner IDs changed.

**Planner-side additions (2026-10-13), now in the skill catalog (4c6890300dcb):** stand-ins so these copy to WAG Masters instead of "not credited": `WAG-FX-0112` (Xcel split leap or split jump) gets WG FX 1.101 split leap and `WAG-BB-0283` (full turn in arabesque) gets WG BB 3.302 full turn in back attitude, both with `"relation": "stand_in"` (re-valued as approximate); `WAG-FX-0165` (handstand forward roll) gets the UCG Masters ME "Handstand (any entry, no hold) forward roll out", also a stand-in. The Dropbox catalog builds them from `skill_catalog/matching/ucg_rulings.json` (`stand_ins`).

**Planner-side additions (2026-10-14, WAG rules lead's bars and beam feedback), now in the skill catalog (4c6890300dcb, now in the `gym-skill-extract` repo).** The new records are in `UCG WAG Skills/ucg_rulings.json`; the catalog's same / covers / stand-in rulings and element names in `skill_catalog/matching/ucg_rulings.json`; tags in `skill_catalog/tags/tags_manual.json`; other names in `skill_catalog/aka.json` (2.301-4's Higgins names under `records_only`). Later changes to these go there, not to the copies here:
- New skills (simplified file, Xcel source; catalog record in the element named): UB `1.101` v3 Long hang kip, A (new element `WAG-UB-0507`, tags HB + kip); UB `2.001` v7 High cast, 21°+ off vertical (no value), value null, Sapphire only, so Sapphire and Infinity (`WAG-UB-0508`); UB `2.102` v2 Cast squat/stoop/straddle on, jump to HB, A (`covers_more` record in each of 2.102-1's elements, tags LB + bar change); UB `2.301` v4 Cast handstand, Higgins ½ turn to L grip, C (Xcel record added to `WAG-UB-0382`, the DP 2.301-3 element); BB `2.0 Gold` and `2.0 Platinum` v2 Straddle jump, 120°–135° and v3 Sissonne, 120°–135°, A, division stand-ins `same_as` 2.202-1 and 2.207-1 (`WAG-BB-0542` to `0545`).
- Other names: 5.403 "Straddle back from handstand to handstand"; 7.301 "Toe up"; 2.201 "Cast handstand"; 7.209 "Toe circle to clear support"; 7.309 "Toe circle to handstand"; 2.301-4 "Higgins" and the ½ turn to L grip wordings (on its Xcel record only: other names on the `WAG-UB-0382` element would also reach 2.301-2, which maps there). "Long hang kip", "High bar kip" and "HB kip" move from 1.106 (both its listings, `WAG-UB-0370` and `0371`) to the new 1.101 long hang kip.
- Same-element review (`wag_same_elements.json`, repo only): 2.301-4 is the same element as 2.301-2 (grip only, as in 2.401), 2.102-2 as 2.102-1, 2.001-7 joins the 2.001 casts.

## Data and how to rebuild it

| Data | Source | Rebuild |
| --- | --- | --- |
| `data/mag-skills.js`, `data/mag-vaults.js`, `data/mag-redirects.js` | Bundle `skills/ucg-mag.json` (UCG MAG CoP additions, code `UCG-MAG-ADD`, whose skill IDs are frozen in ucg-code-of-points; `removed` records left out) + `skills/wg-mag.json` (FIG MAG CoP 2025-2028). Redirects (retired ID -> the skill it was merged into) from `ucg-mag.json` and `ucg-masters-mag.json`. GymACT vault values (`ADV_VAULT`) and the no-salto vaults (`NON_FLIPPING`) are in `build_skills.py` | `python tools/build_skills.py` |
| `data/wag-skills.js` | Bundle `skills/wg-wag.json` (WG WAG CoP 2025-2028; `tags.salto` marks the saltos) + `skills/ucg_wag_skills_simplified.json` (USAG Xcel 2022-2028, USAG Development Program 2026-2030 E elements and the UCG WAG CoP additions, with our own short names for the USAG skills) | `python tools/build_data.py` |
| `data/wag-redirects.js` | Redirects from bundle `skills/ucg-wag.json` and `ucg-masters-wag.json` (none yet); the WAG loader maps them as the MAG one does | `python tools/build_data.py` |
| `data/wag-same.js` | Bundle `rules/USAG-XCEL-2022/digest/same-element.json`: which listed versions of a USAG number count as the same element, and the floor hand-support flight elements (reviewed against the Xcel and Development Program codes; reasons in our own words) | `python tools/build_data.py` |
| `data/sapphire-vaults.js` | USAG Level 9/10 vaults not in the Xcel Sapphire chart (same simplified file) | `python tools/build_data.py` |
| `data/wag-vaults.js` | WG WAG vault table (`wg-wag.json`) | `python tools/build_data.py` |
| `data/masters-vaults.js` | Bundle `skills/ucg-masters-vaults.json` (owned by ucg-code-of-points): the vaults that aren't in the WG code (rows with a planner ID; retired IDs left out) and the vault age bonus per decade. The build also checks the table's WG rows against the WG values and stops on a mismatch | `python tools/build_data.py` |
| `data/tt-skills.js` | UCG T&T DD charts incl. the UCG addendum (`tools/source/tt_skills.json`) | `python tools/build_data.py` |
| `data/examples.js` | T&T, MAG Dev/Int and WAG Xcel example routine sheets (`tools/source/examples.json`, typos fixed; WAG skills matched to the Xcel list, see `tools/source/examples_notes.md`). T&T example skills found in the DD chart take the chart's shorthand and DD (some sheets predate the UCG addendum). Examples that break their level's rules are left out (`EXCLUDE` in `build_data.py`; `node tools/check_examples.mjs` lists them, and a test keeps the rest clean) | `python tools/build_data.py` |
| `data/xcel.js` | Xcel event rules charts and vault chart (hand-entered) | edit directly |
| `data/wag-infinity-vaults.js` | Julia's Infinity vault table | edit directly |
| `assets/worksheets/tt-*.pdf` | 2023 NAIGC competition cards, logo removed, requirement boxes corrected | `python tools/make_tt_cards.py` |

`tools/source/*_notes.md` record the judgment calls made while extracting (e.g. the DMT jump values, strikethroughs on the DD charts).

### Skill bundle

All skill data except T&T and the hand-entered `js/data/xcel.js` and `wag-infinity-vaults.js` comes from the skill bundle that gym-skill-extract publishes (its `bundle/`, `docs/ARCHITECTURE.md` §4 there): the public skill files, the cross-code catalog, `levels.json`, the rules digest JSON and the schemas, with a `manifest.json` listing each file's sha256. It is vendored, unchanged, in `tools/source/bundle/` and pinned by `tools/source/bundle.lock.json`, so the planner builds from its own checkout.

- **Update:** `npm run sync-skills` (`python tools/sync_bundle.py`; needs `pip install jsonschema rfc3987` and the gym-skill-extract checkout, `GYM_SKILL_EXTRACT_DIR`, default `C:/dev/gym-skill-extract`, with its `bundle/` committed). It copies the bundle, checks the file set and every sha256 against the manifest, each file against its schema, the schema major (0) and the catalog versions, writes the lock, runs both builders and prints the added, removed, renamed and revalued records and new redirects of the skill files, the Masters vault rows and age bonus that changed, and the catalogs' new `merged` entries. Then commit `tools/source/bundle/`, the lock and `js/data/`.
- **Check:** `npm run check-bundle` (also a test and a CI step before the tests) fails if a vendored file differs from the manifest or the manifest from the lock (a hand edit), or if `js/data/catalog-*.js` wasn't rebuilt from the bundle's catalog. `python tools/sync_bundle.py --check` does the same plus the schemas.
- **Never edit `tools/source/bundle/`.** Fix the data where it's owned (gym-skill-extract, or ucg-code-of-points for UCG skills and Masters vaults), rebuild the bundle there, and sync.
- **Planner-owned sources** (not in the bundle): `note_edits.json` (our short skill notes), `tt_skills.json` and its notes (the T&T DD charts, not yet in gym-skill-extract), `examples.json` and its notes (routine examples aren't skill data), and the hand-entered `js/data/xcel.js` and `wag-infinity-vaults.js`.

## Worksheets

MAG Dev/Int/Adv, MAG Masters and the T&T cards are the printouts people already fill in by hand; the planner writes onto them at fixed positions measured from each PDF (`LAYOUTS` in `js/pdf.js`). **If a sheet changes, replace it in `assets/worksheets/` and re-measure.** UCG Infinity uses Julia's worksheet. Xcel uses a low-ink worksheet drawn in `js/pdf.js` (there's no official one), and WAG Masters a low-ink, UCG-branded drawing of the Masters WAG SV worksheet (2026 Individual World Cup) with its age-decade value table.

## Develop locally

```bash
npm start      # serves the source on http://localhost:8080 (no build needed)
npm test       # scoring tests (Node 20+)
```

Open <http://localhost:8080/?local> to try it without signing in (saved in that browser only). In development the files load as they are: Firebase and pdf-lib come from their CDNs, and there's no service worker.

## Bringing athletes over from the original UCG Infinity planner

Julia Sharpe's *UCG Infinity SV Sheets* (jzsharpe.github.io/ucg-infinity-sv, Firebase project `ucg-infinity-sv-generator`) is replaced by this planner. Signed-in members use **Bring over UCG Infinity routines** (the athlete switcher in the header) or **Import from UCG Infinity** (the first-run screen): [`js/import-infinity.js`](js/import-infinity.js) signs them in to the old project with Google (a second Firebase app), reads `users/{uid}/athletes`, and converts each into an athlete with a UCG Infinity level (bars/beam/floor -> ub/bb/fx; apparatus bonus; vault by name; each typed skill becomes the listed skill it clearly is, via `closestSkill` in `js/skill-search.js`: among skills with the same value and USAG group, every typed word in its name or nicknames, closest name first (descriptive extras like landing / step-out / jump / turn count half), at most 2 extra words (half a word for a one-word name), and closer than any rival; such rows keep `matchedFrom` and are flagged "Matched" until edited; the rest stay as typed). Imported athletes carry `importedFrom: "infinity-sv:<old id>"`, so they aren't brought twice. Start values are identical: the conversion was checked against the old planner's own scoring on 8,000+ random routines. The old project must list `routines.unitedclubgymnastics.org` under Authentication -> Authorized domains, and must stay in place for as long as members may still import.

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

Fonts are served from `assets/fonts/`. The brand typefaces, Greed Condensed (titles, numbers, buttons) and Suisse Intl (everything else), are licensed, so their files (`GreedCondensed-Bold.woff2`, `SuisseIntl-Regular.woff2`, `SuisseIntl-RegularIt.woff2`, `SuisseIntl-Bold.woff2`) are kept out of git (`.gitignore`). When they're in `assets/fonts/`, the build adds them to the stylesheet; without them the planner uses Saira Condensed (OFL, in the repo) and Arial.

## Design

UCG Design System (2026 identity): navy / blue green / light blue, condensed caps for titles, numbers and buttons only (Greed Condensed, or Saira Condensed without it), sentence-case labels in the body face, 20px cards. One header bar (athlete switcher, account menu with feedback and sign in/out); the athlete's name and club on a navy band; an event strip with each start value. On phones, skills fold to two lines and open to edit, and the open event's start value stays in a bar at the bottom (Breakdown opens its parts). Discipline badges: WAG purple, MAG navy, T&T dark blue green.
