# examples.json: source notes

Both sheets were exported in full from Google Drive as .xlsx and parsed with openpyxl. The build script is `examples_work/build_examples.py`, which reads `examples_work/tt.xlsx` and `examples_work/mag.xlsx`. In total there are 131 examples.

## Sheet 1: T&T "Example Routines Website Spreadsheet" (1xV7YCE3GB7DZdBJOZO5wLKNPNlHSYkbz82dybMd0yu4)

There are nine tabs: {New Flyers, Intermediate Flyers, High Flyers} × {Trampoline, Double Mini, Power Tumbling}. There is no synchro tab, so the file has **no `sy` examples**.

| Tab | Layout | Examples |
|---|---|---|
| New Flyers Trampoline | 5 routines across × 4 blocks down. Each routine is "Routine N", then 10 rows of skill name + DD, then "Total:". No FIG notation. | 20 |
| New Flyers Double Mini | Same grid. Each routine has Pass 1 and Pass 2, each with 2 skills labelled "Spotter:"/"Mounter:" and "Dismount:", then pass and routine totals. | 20 |
| New Flyers Power Tumbling | 5 across × 2 blocks. Two passes of variable length (4–7 skills). | 10 |
| Intermediate Flyers Trampoline | Same as NF Trampoline. | 20 |
| Intermediate Flyers Double Mini | Same as NF DMT, except the first skill in each pass has **no** Spotter/Mounter label; only "Dismount:" is labelled. | 20 |
| Intermediate Flyers Power Tumbl(ing) | **Tab is hidden in the workbook.** B1 note: "Routine skill values include any applicable bonuses for Front or Back Whips". Grid is one row lower than NF. "-" placeholder rows are skipped. | 10 |
| High Flyers Trampoline | Like the other trampoline tabs but with a FIG notation column (e.g. `40o`, `41<`, `42`, `801o`, `Str.`, `--0`). Routines 1–19 only; there is no Routine 20. | 19 |
| High Flyers Double Mini | Empty. | 0 |
| High Flyers Power Tumbling | Empty and hidden. | 0 |

### Mapping choices

- **IDs:** I used `tt-<level>-<event>-<n>`, e.g. `tt-nf-tr-1`. The spec's example was `tt-nf-1`, but that would collide across events. `n` is the routine number from the sheet. MAG ids are `mag-<level>-<event>-1`.
- **Titles:** `"<Level> <Event> Routine N"`. The sheet only says "Routine N".
- **Extra fields beyond the spec:**
  - `totalDd`: the sheet's routine total.
  - `passTotals`: DMT/TU only.
  - `role` on DMT skills: `spotter`, `mounter` or `dismount`, exactly as labelled. It is omitted where the sheet has no label (the first skill of IF DMT passes).
- **Values kept verbatim:** names are whitespace-trimmed, but typos are kept ("Porpise Pike", "Front PIke"). Notation is always a string.

### Anomalies (flagged in each example's `note`, values not changed)

- `tt-hf-tr-10`: skills 4 and 5 have **no name** in the sheet, only notation `4/` (0.5) and `6o` (0.7). The `name` field is omitted for them, not guessed.
- `tt-nf-tr-18`: "Straddle Jump" is given DD 0.2; it is 0.0 everywhere else. The sheet total includes the 0.2.
- `tt-nf-dmt-13`: "Front Pike" is 0.7 here and 0.6 elsewhere in the tab.
- `tt-nf-tu-7`: the Routine Total cell is a typed 1.8, but the pass totals sum to 1.9. **This is the only T&T total (routine or pass) that doesn't match its skills.** MAG summary rows (difficulty, EG bonus, SV) were copied as given, not recomputed.
- Tumbling DD for the same skill name varies. Roundoff is 0.1 or 0.2 across New Flyers routines (e.g. 0.2 in Routines 2/3/5, 0.1 in Routine 7 pass 1), and 0.1 throughout Intermediate Flyers. "Roundoff (power hurdle)" is 0.1 in NF Routine 4 and 0.2 in Routines 9/10. These are kept as given.
- The IF Power Tumbling tab has an **unlabelled block at rows 47–56**. It contains three skill lists with sums (1.5 / 0.9 / 2.6) and no "Routine" header, and looks like scratch work. It is **not** included as an example.

## Sheet 2: "MAG Example Routines - (Public)" (12eJJrHjEh1SrfPa2Z_tvx5968QSEt6cQw-N1ugjjiHk)

There are three tabs.

- **Example Dev Routine** ("Level: NAIGC Developmental") and **Example Int Routine** ("Level: NAIGC Intermediate").
  - Each tab has one example per event: Floor, Pommel Horse, Rings, Vault, Parallel Bars, High Bar.
  - The event header cells "<Event> (video)" link to YouTube. The link is stored in a `video` field.
  - Columns are: Skill #, Skill Name, Value-letter, Value-points (formula from letter), EG, Bonus/Deduction, SV.
  - Each event ends with a "Number of Skills:" summary row (count, difficulty, EG bonus, bonus/deduction, SV). It is stored as `sv` and `sheetTotals`.
  - Column J lists element-group names and the level notes ("-1 for each skill fewer than 6", "SV Cap is 12.7" for Dev / "13.2" for Int). The notes are copied into each example's `note`.
  - Int has empty numbered slots 7–8 on each event, which are skipped.
  - AA SV totals in the sheet: Dev 69.8, Int 69.
- **Vault Reference Table:** FIG vault list (name, EG I–V, VT number, Value, "Advanced (GymACT)" value). This is reference data, not examples, so it is not exported.

### Mapping choices

- **EG:** taken from the sheet's EG column as an integer. Where the cell is blank, `eg` is `null`.
  - Many skills have no EG, which matches the sheet: EG is only filled for skills credited toward an element group.
- **Letter:** taken as given.
- **Vault examples:**
  - `vault` is set to "Hdspr. (FIG VT 201)" for Dev and "Hdspr. sw. 1/4t. (FIG VT 301)" for Int.
  - The parts are also stored separately as `vaultName`, `vaultNumber`, and `vaultEg`. `vaultEg` is converted from Roman numerals: EGII = 2, EGIII = 3.
  - Vault examples have no `skills` array.
- **Bonus/Deduction:** Dev Pommel has two entries in this column: "5 Mushroom Circles" on skill 1 and "+(0.5)" on skill 2. They are recorded in that example's `note`.
- **Video URLs:** the two High Bar URLs are malformed in the sheet (`watch?v=…?feature=share`) and are kept as-is.

## Unsure / for review

- Whether the hidden IF Power Tumbling tab is meant to be public. It is included here.
- Whether to show the `tt-nf-tr-18` Straddle Jump 0.2 and the `tt-nf-dmt-13` Front Pike 0.7 as the sheet gives them, or correct them.
- What the two unnamed skills in HF Trampoline Routine 10 are.
