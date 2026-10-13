# examples.json: source notes

The first two sheets were exported in full from Google Drive as .xlsx and parsed with openpyxl. The build script is `examples_work/build_examples.py`, which reads `examples_work/tt.xlsx` and `examples_work/mag.xlsx`; together they have 131 examples. The WAG sheet (Sheet 3) adds 117.

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

## Sheet 3: "WAG Example Routines" (1B9TjeFnU-cZYmuCcBaUs-OOpIXrxv66LHrqHYrb2Gsg)

Restricted to UCG accounts; read from an .xlsx download. One tab per Xcel level (Silver, Gold, Platinum, Diamond, Sapphire), each with Uneven Bars, Balance Beam and Floor Exercise sections of up to 8 routines across. There is no vault. A sixth tab, "Sheet4", repeats Sapphire beam Routine 1 and is skipped.

| Tabs | Layout |
|---|---|
| Silver, Gold, Platinum | One column per routine, skill names only (no values). |
| Diamond | Name, value letter, gap per routine; an A/B/C count block under each event. |
| Sapphire | Name, value letter, bonus, gap per routine; A–D counts and a "Bonus" total under each event. |

117 routines (empty columns skipped: Platinum beam 8, Diamond bars 8; Sapphire bars has 7). Ids are `wag-<level>-<event>-<n>`, titles "<Level> <Event> Routine N", and each skill keeps the sheet's name as `sheetName`.

### Mapping choices

- **Every skill is matched to the Xcel skill list** for its level and event (division-limited entries respected), and stored as the skill picker sets it: the list's name, `skillId`, value, group and `fromList`. So values, groups and the special requirements follow the list, not the sheet. Names were matched automatically where unambiguous and by hand otherwise. Main hand choices:
  - "Cast" is each division's own cast entry (2.001 Silver / Gold / Platinum; Diamond's "Cast above 45°" is the Diamond one). Squat-on / stoop-on casts, with or without "jump to HB", are 2.102.
  - Underswing dismounts: from the low bar (8.006) at Silver, otherwise the HB underswing dismount (8.101). "Kip" after a jump to the high bar is the HB kip (1.106); the Silver routine that opens with "Kip" is a glide kip.
  - Beam leaps and jumps at Silver–Platinum use the division entries ("2.0 Silver / Gold / Platinum"). The last beam skill is the dismount even when the sheet doesn't say so (e.g. "Back Tuck", "Back Layout", "Gainer Back Tuck" → back salto dismount 9.106).
  - "Toe Up" and "Toe Circle to Handstand" are both toe-on back to handstand (7.309). "Giant" is the back giant to handstand (4.202).
- **Typed in, not from the list:** beam "Mount" (value A, as Diamond gives it), Sapphire bars "Jump to HB (Mount)" (A, a jump to hang before a separate long-hang kip), Platinum "Sole Circle - Jump to HB" and Diamond "Tap Swing" (no value given).
- **Links (connections):** the sheet doesn't mark connections, so they are inferred from the order skills are listed in:
  - Floor and beam acro: a round-off, handspring, step-out or whip into the next acro skill; on floor any Group 5 skill (handspring, walkover, cartwheel, round-off) into the next acro skill, and a front salto into another.
  - Dance: back-to-back different leaps and jumps (floor Group 1, beam Group 2) are a dance passage / series. Beam acro (Groups 6–7) back to back is an acro series.
  - Bars: the skill before the closing dismount is connected into it.
  - Sapphire: the bonus column puts a connection series' bonus on its first skill, so those links come first (added until the app's bonus equals the sheet's total), and an inferred link that would earn more bonus than the sheet gives is left out. One exception is forced: floor 6's switch side leap into the Popa, which the sheet counts; there the app's bonus is 0.4 to the sheet's 0.3, because the Popa is a C in the Code (the sheet says B).
- **Still short of a requirement as written (kept; the planner shows what's missing):** Platinum bars 1 and 2 and beam 2 (no B), Gold bars 6 (no second circling skill), Gold floor 4 and Platinum floor 2 (dance passage without a big enough split leap), Platinum beam 4 and Diamond beam 1–3, Sapphire beam 3–4 (no acro series), Diamond bars 2 (A underswing dismount), Sapphire beam 1 (no full turn).
- **Left out (repeats; `EXCLUDE` in build_data.py):** Silver and Gold floor 2 (split leap and split jump are one element), Platinum beam 1 (same) and 3 (two cartwheels), Platinum floor 5 (two front tucks), Diamond bars 7 (three cast handstands), Diamond floor 6 (two front layouts).

### Anomalies

- Diamond bars Routines 5 and 6: the sheet's A/B/C counts don't match the skills listed (5 B listed, count says 4; 6 A listed, count says 5). The listed skills are used.
- Values the sheet gives that differ from the Xcel list (the list's are used): Diamond beam 8 "Tuck Jump" B (list A), Sapphire floor 2 "Wolf Turn" A (list B, full turn in tuck stand) and "Split Leap" B (list A), Sapphire floor 6 "Straddle Jump Full" B (list C).

## Unsure / for review

- Whether the hidden IF Power Tumbling tab is meant to be public. It is included here.
- Whether to show the `tt-nf-tr-18` Straddle Jump 0.2 and the `tt-nf-dmt-13` Front Pike 0.7 as the sheet gives them, or correct them.
- What the two unnamed skills in HF Trampoline Routine 10 are.
- WAG: the hand-matched names above, especially Platinum "Swing Half Turn" (long-swing ½ turn, 4.101), "Front Tucked Flyaway" (reverse-grip front salto, 8.107), "Clear Hip Circle" at Gold/Platinum (clear hip to support, 3.204, a B), and the Sapphire links inferred from the bonus column.
