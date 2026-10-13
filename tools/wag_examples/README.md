# WAG Xcel example routines: import

Turns UCG's "WAG Example Routines" sheet into the `wag-*` entries of `tools/source/examples.json`
(how the sheet is read and every mapping choice: `tools/source/examples_notes.md`, Sheet 3).

1. Download the sheet as .xlsx (File → Download → Microsoft Excel) to a folder of its own.
2. Run from the repo root:

   ```
   python tools/wag_examples/parse_wag.py <download>.xlsx wag_routines.json
   node tools/wag_examples/build_wag.mjs wag_routines.json tools/wag_examples/overrides.json wag_examples.json
   python tools/wag_examples/merge.py wag_examples.json
   python tools/build_data.py
   node tools/check_examples.mjs
   ```

   `parse_wag.py` checks its own counts against the sheet's A/B/C tallies. `build_wag.mjs` reports
   names it couldn't match, sheet values that differ from the Xcel list, the links it inferred, and
   any Sapphire routine whose bonus doesn't come out as the sheet's.
3. A name that doesn't match, or matches the wrong skill: add it to `overrides.json` (keys
   `event|name`, `level|event|name` or `level|event|R<n>|<position>`; a skill id, or `{"typed": "A"}`
   for a typed-in skill with that value). Routines that repeat an element go in `EXCLUDE` in
   `tools/build_data.py`.
4. `git diff tools/source/examples.json` shows what changed in the sheet.
