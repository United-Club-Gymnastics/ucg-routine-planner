"""Builds js/data/mag-skills.js (the MAG skill list behind the skill search), mag-vaults.js
(the vault picker) and mag-redirects.js from the vendored skill bundle (tools/source/bundle/,
synced from gym-skill-extract with `npm run sync-skills`). Nothing outside this checkout is read.

  WG skills:  skills/wg-mag.json, the FIG MAG CoP 2025-2028. `description` is the name the
              planner shows (Nate's approved own-words name, or the Code's wording where he kept it).
  UCG skills: skills/ucg-mag.json, the UCG MAG CoP additions (code UCG-MAG-ADD), whose skill IDs
              are frozen in ucg-code-of-points. Records marked `removed` are left out. The
              `redirects` of ucg-mag.json and ucg-masters-mag.json (retired skill ID -> replacement)
              go to js/data/mag-redirects.js, so routines saved with a retired ID still open.

  Vault rules: rules/UCG-MAG/digest/vault.json. Its upgraded_fhs_vaults are the Advanced (GymACT)
              values that differ from the WG value (Advanced only, never another level: Nate
              2026-10-20; vault 228 at 5.6, Nate 2026-10-21) and non_flipping the WG vaults with no salto.

Run: python tools/build_skills.py   (npm run sync-skills runs it after a sync)
"""
import json
import os
import re

HERE = os.path.dirname(__file__)
BUNDLE = os.path.join(HERE, "source", "bundle", "skills")
OUT = os.path.join(HERE, "..", "js", "data", "mag-skills.js")
VAULT_OUT = os.path.join(HERE, "..", "js", "data", "mag-vaults.js")
REDIRECT_OUT = os.path.join(HERE, "..", "js", "data", "mag-redirects.js")

# Our edits to the Code's skill notes, as the skill picker shows them (see build_data.py).
NOTE_EDITS = json.load(open(os.path.join(HERE, "source", "note_edits.json"), encoding="utf-8"))["mag"]

VAULT_RULES = json.load(open(os.path.join(HERE, "source", "bundle", "rules", "UCG-MAG", "digest", "vault.json"), encoding="utf-8"))
# Advanced (GymACT) values that differ from the WG value, by WG vault number (a string, as in the
# skill files; wg_vaults normalises with str()).
ADV_VAULT = {r["wg_vault"]: r["adv"] for r in VAULT_RULES["upgraded_fhs_vaults"]["rows"]}
# Vaults with no salto.
NON_FLIPPING = set(VAULT_RULES["non_flipping"]["wg_vaults"])


# Developmental bans flipping and round-off-entry vaults (UCG MAG Rules Breakdown, Vault row; Nate
# 2026-10-20). Round-off entries are the WG 400s and 500s (Yurchenko and round-off ½-on vaults).
def round_off_entry(n):
    return n[:1] in ("4", "5")


APPS = ["FX", "PH", "SR", "PB", "HB"]
ROMAN = {"I": 1, "II": 2, "III": 3, "IV": 4}


def skill_file(name):
    return json.load(open(os.path.join(BUNDLE, name), encoding="utf-8"))


def wg_skills(wg):
    out = []
    for s in wg["records"]:
        if s["apparatus"] not in APPS:
            continue
        out.append({
            "id": f"WG-{s['apparatus']}-{s['element_group']}-{s['number']}",  # FIG numbers restart in each EG
            "app": s["apparatus"].lower(),
            "name": s["description"],  # the bundle's public name, not necessarily the Code's text
            "eponym": s["eponym"] or "",
            "value": s["value"].split("=")[0],
            "eg": ROMAN.get(s["element_group"]),
            "src": "WG",
            "note": "",
        })
    return out


def ucg_skills(ucg):
    # IDs are frozen in ucg-code-of-points, so renaming a box never changes one.
    out = []
    for r in ucg["records"]:
        if r["apparatus"] not in APPS + ["VT"] or r.get("removed"):
            continue
        note = r.get("note") or ""
        out.append({
            "id": r["id"],
            "app": r["apparatus"].lower(),
            "name": r["description"],
            "eponym": r["eponym"] or "",
            "value": r["value"],
            "eg": ROMAN.get(r["element_group"]),
            "src": "UCG",
            "note": NOTE_EDITS.get(note, note),
        })
    return out


def wg_vaults(wg):
    out = []
    for s in wg["records"]:
        if s["apparatus"] != "VT":
            continue
        n, v = str(s["number"]), float(s["value"])
        out.append({
            "id": n,
            "name": s["description"],
            "eponym": s["eponym"] or "",
            "eg": s["element_group"],
            "value": v,
            "adv": ADV_VAULT.get(n, v),
            "flipping": n not in NON_FLIPPING,
            "roundoff": round_off_entry(n),
            "src": "WG",
        })
    # A key that matches no vault means the number type or table changed: without this the
    # vaults would silently all become flipping, with adv = value.
    ids = {v["id"] for v in out}
    missing = (ADV_VAULT.keys() | NON_FLIPPING) - ids
    if missing:
        raise SystemExit(f"rules/UCG-MAG/digest/vault.json vault numbers not among the WG vaults in wg-mag.json: {sorted(missing)}")
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
            "roundoff": False,
            "src": "UCG",
        })
    return out


def main():
    wg = skill_file("wg-mag.json")
    ucg = ucg_skills(skill_file("ucg-mag.json"))
    redirects = {**skill_file("ucg-mag.json").get("redirects", {}), **skill_file("ucg-masters-mag.json").get("redirects", {})}
    with open(REDIRECT_OUT, "w", encoding="utf-8", newline="\n") as f:
        f.write("// Generated by tools/build_skills.py from the redirects of the bundle's ucg-mag.json and ucg-masters-mag.json:\n")
        f.write("// retired UCG / UCG Masters MAG skill id -> the skill it was merged into (routines saved with the old id open on it).\n")
        f.write(f"export const REDIRECTS = {json.dumps(redirects, ensure_ascii=False, indent=2)};\n")
    print(f"wrote {os.path.normpath(REDIRECT_OUT)}: {len(redirects)} redirects")
    vaults = ucg_vaults(ucg) + wg_vaults(wg)
    with open(VAULT_OUT, "w", encoding="utf-8", newline="\n") as f:
        f.write("// Generated by tools/build_skills.py: UCG MAG CoP vaults, then WG (FIG MAG CoP 2025-2028) vaults.\n")
        f.write("// value = D score for Developmental and Intermediate; adv = D score for Advanced (GymACT).\n")
        f.write("// flipping = false for vaults with no salto; roundoff = round-off entry. Developmental bans both.\n")
        rows = ",\n".join("  " + json.dumps(v, ensure_ascii=False) for v in vaults)
        f.write(f"export const VAULTS = [\n{rows}\n];\n")
    print(f"wrote {os.path.normpath(VAULT_OUT)}: {len(vaults)} vaults")
    skills = [s for s in ucg if s["app"] != "vt"] + wg_skills(wg)
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
