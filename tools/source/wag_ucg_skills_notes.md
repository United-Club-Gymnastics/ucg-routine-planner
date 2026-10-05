# UCG WAG Code of Points: skill extraction notes

Source: `Code of Points/WAG/UCG WAG CoP.svg` (saved 2026-09-28 23:56), read through the built
`Code of Points/dist/UCG WAG CoP.pdf` (built 2026-09-28 23:58 from that SVG). I used PyMuPDF for the
positioned text and link annotations, and rendered page PNGs to check the result by eye. Every name word,
eponym and video URL was then checked against the SVG source: all 28 boxes match, and both files contain the
same 26 YouTube links. Nothing in the Code of Points folder was modified.

Output: `wag_ucg_skills.json` with 28 skills. **ub 9, bb 13, fx 6, vt 0.**

## Page layout

| PDF page | Content | app |
|---|---|---|
| 1 | Cover (UCG logo, "UCG CODE OF POINTS — WAG", intro text, "Last Updated 5/2026", womens-rules URL) | none |
| 2 | UNEVEN BARS | `ub` |
| 3 | BALANCE BEAM | `bb` |
| 4 | FLOOR EXERCISE | `fx` |
| 5 | VAULT | `vt` (no skills) |

The pages are portrait letter size. Each apparatus page has a dark title band, a light-blue rule band, a
**4 x 4 grid** of skill cells and a footer. MAG uses a landscape 6 x 4 grid. Cells are numbered left to
right, top to bottom. The PDF-point cell edges are approximately x = 27.5 / 166 / 305.6 / 445 / 584 and
y = 159 / 298 / 438 / 577 / 717.

A skill box contains these items:
- **Top left:** the box number and the description, in Suisse Intl at 7.9 pt, wrapped over 1–4 lines.
- **Top right:** the value (VP) letter, in Greed Condensed Bold at 18 pt.
- **Directly under the value:** a single digit in the same font and size. This is the **Element Group**. The
  rule band on each page says "Each skill's Element Group is listed in the skill box below its VP."
- **Middle:** the drawing. Some drawings have tiny degree labels such as "540°", "2x360°" and "1080°" (3–5 pt).
  These are annotations on the drawing, so I ignored them.
- **Bottom:** the eponym in parentheses, in bold at 5.4 pt, and a stylized QR code. The whole box is also a
  link annotation pointing to the YouTube video.

## Field rules

- `name`: the description lines joined with a single space. A line ending in a hyphen joins without a space
  ("L-" + "turn" gives "L-turn", "Y-" + "Scale" gives "Y-Scale"). The leading box number "N." is removed.
  Parentheticals inside the description stay part of the name: "(2 s.)", "(2 sec.)", "(no hold)", "(180°)".
  For FX 2–4 and FX 6, the PDF text order glued the box number onto the second line ("2. turn"), so I rebuilt
  those names from the rendered page.
- `eponym`: the small bold "(Name)" at the bottom of the box, without the brackets. It is `""` when the box has
  none. I did **not** take it from parentheses inside the description.
- `value`: the large letter (A–E occur). There are no vault start values, because no vaults are listed.
- `group`: the digit under the value, as a string ("1"–"9"). Every one of the 28 boxes has one. WAG uses arabic
  numerals, while MAG uses roman EGs (I–IV).
- `note`: only FX 1 has real note text, "(ineligible for naming)". I moved it out of the name and dropped the
  brackets.
- **Extra keys** (additive; none of the requested keys were renamed or dropped):
  - `num`: the box number printed in the cell.
  - `url`: the box's video link, or `null` when the box has none.

## Ambiguities

1. **Eponym suffixes are kept as printed.** Examples are "Denk-Lobnig 2", "Sharpe 1", "Sharpe 2", "Lim 1",
   "Lim 2", "Penn 1" and "Penn 2". The same person also appears without a suffix: Denk-Lobnig on UB 4 and BB 1,
   Sharpe on BB 12, Penn on UB 8 and Lim in BB 10. The suffix only tells apart several skills by the same person,
   and the numbering restarts on each apparatus. If you want plain names, strip `/ \d+$/`.
2. **BB 10 has two eponyms**, "(Lim)" under the top drawing and "(Niolet)" under the bottom one. The description
   is "Pistol squat in relevé or Y-Scale". Both drawings show the same movement (stand with a held leg, squat to a
   pistol, rise), so I can't tell which variant goes with which name. I kept one entry with
   `eponym: "Lim / Niolet"` rather than invent two split skills.
3. **BB 8 "Handstand drop to shoulderstand (no hold)"** shows a QR code but has no link annotation, in either the
   PDF or the SVG. It also has no eponym. Its `url` is `null`.
4. **BB 3 "Two scissors mount" and FX 1 "Stag or double-stag jump…"** have no QR code and no link. The README
   says this is by design. Their `url` is `null`, and neither has an eponym.
5. **UB 2 is printed "Jump with ³⁄₂ (540°) turn"** using superscript-3, fraction-slash and subscript-2 glyphs,
   and that is how I kept it. A search for "1½" or "3/2" will not match this text, though "540" will. The app may
   want to normalise it for search.
6. **The vault page has no skills.** Cell 1 holds the placeholder "No vaults have been submitted". The rule band
   says submitted vaults will show allowed levels, a Start Value and a group number, so a future vault entry would
   put a number in `value`.
7. **The WAG cover still reads "Last Updated 5/2026"**, which matches the README's note that it hasn't been bumped.

## Non-skill boxes and text (skipped)

- **Page 1:** the whole cover. It contains the logo, the title, intro text about using the USAG DP and Xcel codes,
  the QR/link explanation, "Last Updated 5/2026" and unitedclubgymnastics.org/womens-rules.
- **Pages 2–4, title bands:** "UNEVEN BARS", "BALANCE BEAM", "FLOOR EXERCISE".
- **Pages 2–4, rule band:** "All elements will be allowed at all appropriate levels as designated by the skill
  VP. Each skill's Element Group is listed in the skill box below its VP."
- **Page 5, title band:** "VAULT".
- **Page 5, rule band:** "Submitted Vaults will have their allowed levels and subsequent Start Value listed below
  along with the group number."
- **Page 5, cell 1:** "No vaults have been submitted".
- **Footer on pages 2–5:** "UCG CODE OF POINTS — WAG / Last Updated 5/2026".
- **Empty cells:**
  - UB cells 10–16
  - BB cells 14–16
  - FX cells 7–16
  - VT cells 2–16
- **Drawing degree labels:** in UB 2, BB 5, BB 6 and FX 1–5.
