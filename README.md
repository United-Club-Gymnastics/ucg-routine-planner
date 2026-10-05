# UCG Routine Planner

One planner for every UCG discipline and level: **WAG** (Xcel Silver, Gold, Platinum, Diamond, Sapphire, UCG Infinity, Masters), **MAG** (Developmental, Intermediate, Advanced, Masters) and **T&T** (New, Intermediate and High Flyers). Gymnasts and coaches sign in with Google (or try it without signing in, which saves nothing), add athletes, add the levels each athlete competes, build routines, and export filled-in UCG worksheets and competition cards.

**Live site:** https://united-club-gymnastics.github.io/ucg-routine-planner/

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

**MAG** (2026-2028 UCG MAG Rules + MAG worksheets): see the MAG planner's README; unchanged here except that Masters is added, and that Advanced requirements and bonuses the routine itself shows are detected from the skill list: the floor double flip (any double or triple salto), the floor double flipping dismount (the last acrobatic skill listed is a double), and the rings swing to handstand (I.75, I.81, I.86, I.87, I.88, per the WG clarification). Skills typed in by hand are matched by name for the floor doubles; otherwise the gymnast ticks the box. **MAG Masters** (UCG Masters Rules Policy v2.01): values by age decade (Misc, Masters Element, A, B, C, D+), top 6 count, +0.5 per element group I-III with a skill at the decade's level, dismount group worth the dismount's value, -1.0 per skill under 6, vault = WG value + age bonus.

**UCG Infinity** (UCG Infinity Rules v1.2): A=0.1, B=0.3, C=0.5, D=0.7, E=0.9; top 8 count; +0.3 per condensed group with a B or higher (counting or not); +0.3 apparatus bonus; -1.0 per skill under 6; vault from the Infinity vault table.

**Xcel** (UCG Women's Rules Policy v6.0 + USAG Xcel Code 2022-2028 event charts): start 10.0 (Sapphire 9.6 + up to 0.4 bonus); -0.50 per missing special requirement (ticked by the gymnast); minus the value of each missing value part (A=0.1, B=0.3, C=0.5; a higher value part can fill a lower one); -0.50 per restricted skill (above the level's limit; Diamond allows one D; Sapphire has no restrictions, Ds and Es included). Restrictions that depend on the kind of skill (e.g. "no B acro" at Silver) are shown as notes; the planner only checks the letter. Vaults from the Xcel vault chart; Gold 9.5 with the alternative springboard; Sapphire also lists the USAG Level 9/10 vaults that aren't in its chart, at 10.0. **WAG skill search by level:** Xcel levels get the USAG Xcel skills (without ones limited to other divisions, e.g. "Bronze/Silver/Gold only") and the UCG additions; Sapphire and UCG Infinity (the Open Scoring Level) also get the USAG Development Program E elements; WAG Masters gets the WG skills. USAG skill names are our own short names, not the Code's text (see `wagSkillAllowed` in `js/skill-search.js`).

**WAG Masters**: values by age decade, top 6 count, +0.5 per condensed group with a skill at the decade's level (counting or not), -1.0 per skill under 6. The skill search offers the WG WAG skills and fills in the condensed group (WG groups mapped per the Masters policy). Vault = the vault's value + age bonus, from the UCG Masters vaults (squat on, roll over, hechts, sideways handsprings) or the WG WAG vault table, or 0.0 for any other vault.

**T&T** (UCG T&T Code of Points v3.41 + DD charts; double mini tuck/pike/straddle jumps are 0.0, per the UCG addendum, until the T&T team decides on WG's change): total DD per routine or pass, with each level's requirements flagged (max skill DD, salto counts, pass and routine DD limits, repeats, pass sizes). Double mini: each pass's first skill is marked mounter or spotter (stored as `start` on the pass, default mounter), since a repeat only loses its difficulty in the same position. Saltos are recognised from the FIG shorthand, or the skill name when there's no shorthand.

## Data and how to rebuild it

| Data | Source | Rebuild |
| --- | --- | --- |
| `data/mag-skills.js`, `data/mag-vaults.js` | UCG MAG CoP master + FIG MAG CoP 2025-2028 extractor | `python tools/build_skills.py` (needs the Code of Points repo and Inkscape) |
| `data/wag-skills.js` | WG WAG CoP 2025-2028 (`tools/source/wag_wg_skills.json`, from the extractor in Dropbox `Reference/gym_skill_extract/WG WAG CoP Extraction`) + USAG Xcel 2022-2028, USAG Development Program 2026-2030 E elements and the UCG WAG CoP additions (`tools/source/ucg_wag_skills_simplified.json`, from `Reference/gym_skill_extract/UCG WAG Skills`). **Only the simplified file goes in this repo:** the full one has USAG's text, and this repo is public | `python tools/build_data.py` |
| `data/sapphire-vaults.js` | USAG Level 9/10 vaults not in the Xcel Sapphire chart (same simplified file) | `python tools/build_data.py` |
| `data/wag-vaults.js` | WG WAG vault table (`wag_wg_skills.json`) | `python tools/build_data.py` |
| `data/masters-vaults.js` | `tools/source/Masters Vault Values.xlsx`: the vaults that aren't in the WG code. The build also checks the table's WG vaults against the WG values and prints any mismatch | `python tools/build_data.py` |
| `data/tt-skills.js` | UCG T&T DD charts incl. the UCG addendum (`tools/source/tt_skills.json`) | `python tools/build_data.py` |
| `data/examples.js` | T&T and MAG Dev/Int example routine sheets (`tools/source/examples.json`, typos fixed). T&T example skills found in the DD chart take the chart's shorthand and DD (some sheets predate the UCG addendum). Examples that break their level's rules are left out (`EXCLUDE` in `build_data.py`; `node tools/check_examples.mjs` lists them, and a test keeps the rest clean) | `python tools/build_data.py` |
| `data/xcel.js` | Xcel event rules charts and vault chart (hand-entered) | edit directly |
| `data/wag-infinity-vaults.js` | Julia's Infinity vault table | edit directly |
| `assets/worksheets/tt-*.pdf` | 2023 NAIGC competition cards, logo removed, requirement boxes corrected | `python tools/make_tt_cards.py` |

`tools/source/*_notes.md` record the judgment calls made while extracting (e.g. the DMT jump values, strikethroughs on the DD charts).

## Worksheets

MAG Dev/Int/Adv, MAG Masters, WAG Masters and the T&T cards are the printouts people already fill in by hand; the planner writes onto them at fixed positions measured from each PDF (`LAYOUTS` in `js/pdf.js`). **If a sheet changes, replace it in `assets/worksheets/` and re-measure.** UCG Infinity uses Julia's worksheet; Xcel uses a low-ink worksheet drawn in `js/pdf.js` (there's no official one).

## Develop locally

```bash
npm start      # serves on http://localhost:8080
npm test       # scoring tests (Node 20+)
```

Open <http://localhost:8080/?local> to try it without signing in (saved in that browser only). Pushing to `main` runs the tests and publishes to GitHub Pages.

## Design

UCG Design System (2026 identity): navy / blue green / light blue, condensed caps display type (Saira Condensed as the web fallback for Greed Condensed), 20px cards. Discipline badges: WAG purple, MAG navy, T&T dark blue green.
