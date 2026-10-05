"""Makes the T&T competition card templates in assets/worksheets/ from the 2023
NAIGC cards: removes the NAIGC logo and corrects the level requirement boxes to
match the UCG T&T Code of Points (v3.41). One PDF per card.

Run: python tools/make_tt_cards.py [path to tt-competition-cards-v-2023-pdf.pdf]
"""
import os
import sys

import fitz  # PyMuPDF

SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser("~/Downloads/tt-competition-cards-v-2023-pdf.pdf")
OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "worksheets")

CARDS = {0: "tt-tr", 1: "tt-sy", 2: "tt-dmt", 3: "tt-tu-nf", 4: "tt-tu-if", 5: "tt-tu-hf"}

# (old lines, new lines, font size): old lines are removed, new lines are centred in their place.
FIXES = {
    0: [(["Max Skill DD: 2 @ 0.5 or 0.6", "(some exceptions)"], ["Max Skill DD: 0.4, plus up", "to 2 listed saltos (0.5-0.6)"], 11)],
    1: [(["Max Skill DD: 2 @ 0.5 or 0.6", "(some exceptions)"], ["Max Skill DD: 0.4, plus up", "to 2 listed saltos (0.5-0.6)"], 11)],
    2: [
        (["Max Skill DD:", "1 @ 0.6 or 0.7"], ["Max Skill DD: 0.5,", "plus one at 0.6-0.7"], 9.5),
        (["Min. 2 Saltos"], ["2 of 4 skills", "at 0.5 DD or more"], 11),
    ],
    3: [(["Any skill can be done 2x per pass if it", "has different entry/exit"],
         ["Handsprings/whips: any number; fulls: 3 per pass;", "other skills: 1 repeat with a different entry"], 10)],
}


def fix_page(page, fixes):
    for olds, news, size in fixes:
        rects = []
        for t in olds:
            found = page.search_for(t)
            if not found:
                raise SystemExit(f"not found on page {page.number + 1}: {t!r}")
            rects.append(found[0])
        box = fitz.Rect(rects[0])
        for r in rects[1:]:
            box |= r
        for r in rects:
            page.add_redact_annot(r, fill=(1, 1, 1))
        page.apply_redactions(images=0)
        cx = (box.x0 + box.x1) / 2
        lead = size * 1.2
        top = box.y0 + (box.height - lead * len(news)) / 2 + size * 0.9
        for i, line in enumerate(news):
            w = fitz.get_text_length(line, fontname="tiro", fontsize=size)
            page.insert_text((cx - w / 2, top + i * lead), line, fontname="tiro", fontsize=size, color=(0, 0, 0))


def main():
    src = fitz.open(SRC)
    for i, name in CARDS.items():
        doc = fitz.open()
        doc.insert_pdf(src, from_page=i, to_page=i)
        page = doc[0]
        for info in page.get_image_info():  # the NAIGC logo, top left
            page.add_redact_annot(fitz.Rect(info["bbox"]), fill=(1, 1, 1))
        page.apply_redactions(images=2)
        fix_page(page, FIXES.get(i, []))
        path = os.path.join(OUT, f"{name}.pdf")
        doc.save(path, garbage=3, deflate=True)
        print("wrote", os.path.normpath(path))


if __name__ == "__main__":
    main()
