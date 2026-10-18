"""Builds js/skills.js (the skill list behind the skill search) and js/vaults.js
(the vault picker) from:

  WG skills:  skills_verified.json from the FIG MAG CoP 2025-2028 extractor
              (repo: C:/dev/gym-skill-extract, or GYM_SKILL_EXTRACT_DIR)
  UCG skills: the UCG-MAG-ADD code in the UCG Code of Points catalog
              (repo: C:/dev/ucg-code-of-points/catalog/ucg_skills.json),
              whose skill IDs are frozen there (or UCG_COP_DIR). Its `redirects`
              (retired skill ID -> replacement, UCG and UCG Masters MAG) go to
              js/data/mag-redirects.js, so routines saved with a retired ID still open.

Run after the UCG CoP gets new skills (or a new WG CoP is extracted):
    python tools/build_skills.py
Paths can be overridden with --wg and --cop (the Code of Points repo folder).
Advanced (GymACT) vault values: GymACT raises some handspring vaults above their
WG value; those are in ADV_VAULT (from the MAG Routine Composition Planner sheet).
"""
import argparse
import json
import os
import re

EXTRACT = os.environ.get("GYM_SKILL_EXTRACT_DIR", r"C:\dev\gym-skill-extract")
WG_DEFAULT = os.path.join(EXTRACT, "WG MAG CoP Extraction", "skills_verified.json")
COP_DEFAULT = os.environ.get("UCG_COP_DIR", r"C:\dev\ucg-code-of-points")
OUT = os.path.join(os.path.dirname(__file__), "..", "js", "data", "mag-skills.js")
VAULT_OUT = os.path.join(os.path.dirname(__file__), "..", "js", "data", "mag-vaults.js")
REDIRECT_OUT = os.path.join(os.path.dirname(__file__), "..", "js", "data", "mag-redirects.js")

# Our edits to the Code's skill notes, as the skill picker shows them (see build_data.py).
NOTE_EDITS = json.load(open(os.path.join(os.path.dirname(__file__), "source", "note_edits.json"), encoding="utf-8"))["mag"]

# Advanced (GymACT) values that differ from the WG value, by WG vault number.
ADV_VAULT = {107: 3.6, 108: 4.4, 109: 4.8, 113: 4.0, 114: 4.4, 115: 4.8, 116: 5.2, 117: 5.6, 118: 6.0,
             213: 2.8, 219: 3.8, 225: 5.2, 226: 5.6, 228: 5.6, 231: 5.6, 232: 6.0}
# Vaults with no salto (the only ones allowed at Developmental).
NON_FLIPPING = set(range(201, 207)) | set(range(301, 304)) | set(range(501, 504)) | set(range(513, 516))

APPS = ["FX", "PH", "SR", "PB", "HB"]
ROMAN = {"I": 1, "II": 2, "III": 3, "IV": 4}


def wg_skills(path):
    out = []
    for s in json.load(open(path, encoding="utf-8")):
        if s["apparatus"] not in APPS:
            continue
        out.append({
            "id": f"WG-{s['apparatus']}-{s['element_group']}-{s['number']}",  # FIG numbers restart in each EG
            "app": s["apparatus"].lower(),
            "name": " ".join(s["description"].split()),
            "eponym": s["eponym"] or "",
            "value": s["value"].split("=")[0],
            "eg": ROMAN.get(s["element_group"]),
            "src": "WG",
            "note": "",
        })
    return out


def ucg_catalog(cop_dir):
    return json.load(open(os.path.join(cop_dir, "catalog", "ucg_skills.json"), encoding="utf-8"))


def ucg_skills(cat):
    # IDs are frozen in the CoP repo's catalog (catalog/ids.json), so renaming a box never changes one.
    out = []
    for r in cat["codes"]["UCG-MAG-ADD"]:
        if r["apparatus"] not in APPS + ["VT"]:
            continue
        out.append({
            "id": r["id"],
            "app": r["apparatus"].lower(),
            "name": r["name"],
            "eponym": r["eponym"],
            "value": r["value"],
            "eg": ROMAN.get(r["element_group"]),
            "src": "UCG",
            "note": NOTE_EDITS.get(r["note"], r["note"]),
        })
    return out


def wg_vaults(path):
    out = []
    for s in json.load(open(path, encoding="utf-8")):
        if s["apparatus"] != "VT":
            continue
        n, v = s["number"], float(s["value"])
        out.append({
            "id": str(n),
            "name": " ".join(s["description"].split()),
            "eponym": s["eponym"] or "",
            "eg": s["element_group"],
            "value": v,
            "adv": ADV_VAULT.get(n, v),
            "flipping": n not in NON_FLIPPING,
            "src": "WG",
        })
    return out


def ucg_vaults(ucg):
    out = []
    for s in ucg:
        if s["app"] != "vt":
            continue
        v = float(s["value"])
        out.append({
            "id": s["id"],
            "name": s["name"],
            "eponym": s["eponym"],
            "eg": "",
            "value": v,
            "adv": v,
            "flipping": bool(re.search(r"(?i)flip|salto", s["name"])),
            "src": "UCG",
        })
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--wg", default=WG_DEFAULT)
    ap.add_argument("--cop", default=COP_DEFAULT)
    a = ap.parse_args()
    cat = ucg_catalog(a.cop)
    ucg = ucg_skills(cat)
    redirects = {**cat.get("redirects", {}).get("UCG-MAG-ADD", {}), **cat.get("redirects", {}).get("UCG-MASTERS-MAG", {})}
    with open(REDIRECT_OUT, "w", encoding="utf-8", newline="\n") as f:
        f.write("// Generated by tools/build_skills.py from the UCG Code of Points catalog's redirects:\n")
        f.write("// retired UCG / UCG Masters MAG skill id -> the skill it was merged into (routines saved with the old id open on it).\n")
        f.write(f"export const REDIRECTS = {json.dumps(redirects, ensure_ascii=False, indent=2)};\n")
    print(f"wrote {os.path.normpath(REDIRECT_OUT)}: {len(redirects)} redirects")
    vaults = ucg_vaults(ucg) + wg_vaults(a.wg)
    with open(VAULT_OUT, "w", encoding="utf-8", newline="\n") as f:
        f.write("// Generated by tools/build_skills.py: UCG MAG CoP vaults, then WG (FIG MAG CoP 2025-2028) vaults.\n")
        f.write("// value = D score for Developmental and Intermediate; adv = D score for Advanced (GymACT).\n")
        f.write("// flipping = false for vaults with no salto (Developmental only allows these).\n")
        rows = ",\n".join("  " + json.dumps(v, ensure_ascii=False) for v in vaults)
        f.write(f"export const VAULTS = [\n{rows}\n];\n")
    print(f"wrote {os.path.normpath(VAULT_OUT)}: {len(vaults)} vaults")
    skills = [s for s in ucg if s["app"] != "vt"] + wg_skills(a.wg)
    rows = ",\n".join("  " + json.dumps(s, ensure_ascii=False) for s in skills)
    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        f.write("// Generated by tools/build_skills.py: UCG MAG CoP skills, then WG (FIG MAG CoP 2025-2028) skills.\n")
        f.write("// eg: element group 1-4, or null (no EG bonus). value: A-J or Sub-A.\n")
        f.write(f"export const SKILLS = [\n{rows}\n];\n")
    counts = {}
    for s in skills:
        counts[s["src"]] = counts.get(s["src"], 0) + 1
    print(f"wrote {os.path.normpath(OUT)}: {counts}")


if __name__ == "__main__":
    main()
