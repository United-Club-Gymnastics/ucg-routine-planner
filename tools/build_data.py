"""Builds the WAG skill list, the Masters lists and vaults, the T&T skill list, the example
routines and the catalog data (js/data/) from tools/source/.

From the vendored skill bundle (tools/source/bundle/, synced from gym-skill-extract with
`npm run sync-skills`; see tools/sync_bundle.py):
  skills/wg-wag.json   the WG (FIG) WAG Code of Points 2025-2028. `description` is the name the
                       planner shows (Nate's approved own-words name, or the Code's wording where
                       he kept it); `tags.salto` marks the saltos (UCG Infinity)
  skills/ucg_wag_skills_simplified.json  every skill UCG's Xcel levels and UCG Infinity credit:
                       USAG Xcel 2022-2028, USAG Development Program 2026-2030 E elements, and
                       the UCG WAG CoP additions, with our own short names for the USAG skills
  skills/ucg-wag.json, ucg-masters-wag.json  their `redirects` (retired id -> replacement)
  skills/ucg-masters-vaults.json  the UCG Masters vault tables and the vault age bonus
  rules/USAG-XCEL-2022/digest/same-element.json  which listed versions of a USAG number are the
                       same element, and the floor hand-support flight elements
  catalog/             the cross-code skill catalog and levels.json
  rules/UCG-WAG/digest/infinity.json, infinity-vaults.json  UCG Infinity's values, counting, bonuses,
                       element group names and vault chart (js/data/infinity-rules.js, wag-infinity-vaults.js)
  rules/USAG-XCEL-2022/digest/levels.json  the Xcel value parts, limits, special requirements and
                       vault charts (js/data/xcel.js)
  rules/UCG-MASTERS-{MAG,WAG}/digest/vault-values.json  table_wg_vaults: which WG vault each WG row
                       of the Masters vault table means (a check only)
Planner-owned (not skill data, or no bundle source yet):
  infinity_vault_ids.json  the Infinity vault chart's permanent ids, matched by name
  note_edits.json      our short versions of the skill notes
  tt_skills.json       the UCG T&T DD charts (trampoline, double mini, tumbling),
                       including the UCG addendum's values
  examples.json        example routines: T&T (New / Intermediate / High Flyers),
                       MAG (Developmental / Intermediate) and WAG (Xcel Silver to
                       Sapphire) Google Sheets

Run: python tools/build_data.py   (then commit the js/data files)
"""
import json
import os
import re

HERE = os.path.dirname(__file__)
SRC = os.path.join(HERE, "source")
BUNDLE = os.path.join(SRC, "bundle")
OUT = os.path.join(HERE, "..", "js", "data")
POS = {"o": "tuck", "<": "pike", "/": "straight", "": ""}


def slug(s):
    s = s.replace("¾", " 3-4 ").replace("½", " 1-2 ").replace("¼", " 1-4 ")
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")[:60]


def write(name, header, var, rows):
    body = ",\n".join("  " + json.dumps(r, ensure_ascii=False) for r in rows)
    with open(os.path.join(OUT, name), "w", encoding="utf-8", newline="\n") as f:
        f.write(header)
        f.write(f"export const {var} = [\n{body}\n];\n")
    print(f"wrote js/data/{name}: {len(rows)}")


# Our edits to the extractors' WAG skill notes (tools/source/note_edits.json, "wag"; build_skills.py
# uses "mag"): the source text, then the short note the skill picker shows ("" drops it). Kept apart
# from the source files so a fresh copy of them keeps the edits; an edit whose source text is gone
# is reported.
NOTE_EDITS = json.load(open(os.path.join(SRC, "note_edits.json"), encoding="utf-8"))["wag"]
notes_edited = set()


def edit_note(text):
    if text in NOTE_EDITS:
        notes_edited.add(text)
        return NOTE_EDITS[text]
    return text


def sentence(text):
    """A note as a sentence: no "Box note:" lead-in, a capital first letter, a full stop."""
    text = re.sub(r"^Box note(?: \([^)]*\))?:\s*", "", text.strip())
    return text[:1].upper() + text[1:] + ("" if text.endswith((".", "!", "?")) else ".") if text else ""


def wg_value(v):
    return v.split("=")[0] if "=" in v else v


def bundle(path):
    return json.load(open(os.path.join(BUNDLE, path), encoding="utf-8"))


def records(name):
    return bundle(f"skills/{name}")["records"]


def wag():
    rows = []
    for s in records("wg-wag.json"):
        if s["apparatus"] == "VT":
            continue
        rows.append({
            "id": f"WGW-{s['apparatus']}-{s['number']}-{s.get('variant', 1)}",
            "app": s["apparatus"].lower(),
            "name": s["description"],  # the bundle's public name, not necessarily the Code's text
            "eponym": s.get("eponym") or "",
            "value": wg_value(s["value"]),
            "group": int(s["element_group"]),  # WG element group 1-6
            "src": "WG",
            "note": "",
        })
        if (s.get("tags") or {}).get("salto"):  # UCG Infinity's salto counts
            rows[-1]["salto"] = True
    # USAG Xcel A-D, USAG Development Program E, and the UCG WAG CoP additions: the skills
    # UCG's Xcel levels and UCG Infinity (the Open Scoring Level) credit, with USAG values.
    # From the bundle's ucg_wag_skills_simplified.json (built by the "UCG WAG Skills" extractor);
    # USAG descriptions there are our own short names, not the Code's text.
    division_ids = {"Bronze": "bronze", "Silver": "silver", "Gold": "gold", "Platinum": "plat", "Diamond": "diamond", "Sapphire": "sapphire"}
    # Records the Code treats as several different elements carry `forms` (one row each,
    # id + form letter, e.g. USAG-BB-7.104-1b); the bare record id stays as an alias of
    # form "a" so routines saved before the split still find their skill.
    links = {"aliases": {}, "same_as": [], "flight": {}}
    for s in records("ucg_wag_skills_simplified.json"):
        if s["apparatus"] == "VT":
            continue
        app = s["apparatus"]
        ucg = s["source"].startswith("UCG")
        row = {
            # UCG additions keep their old ids ("UCG 3" -> UCGW-BB-3) so saved routines still find them.
            "id": f"UCGW-{app}-{s['number'].split()[1]}" if ucg else f"USAG-{app}-{s['number']}-{s.get('variant', 1)}",
            "app": app.lower(),
            "name": " ".join(s["description"].split()),
            "eponym": s.get("eponym") or "",
            "value": s["value"],
            "group": int(s["element_group"]),  # USAG element group (UCG Infinity condenses these into I-IV)
            "groupName": s.get("group_name") or "",
            "src": "UCG" if ucg else "USAG",
            "note": sentence(edit_note(s.get("ucg_note") or "")),
        }
        if s["source"].startswith("USAG Development"):
            row["prog"] = "dp"  # E elements: Sapphire and Infinity only
        if s.get("divisions"):
            row["divisions"] = [division_ids[d] for d in s["divisions"]]  # e.g. "Bronze/Silver/Gold only"
        if s.get("video"):
            row["video"] = s["video"]
        for t in s.get("same_as") or []:
            links["same_as"].append((row["id"] + ("a" if s.get("forms") else ""), t))
        if not s.get("forms"):
            rows.append(row)
            continue
        for f in s["forms"]:
            fid = row["id"] + f["form"]
            form = {**row, "id": fid, "name": f["name"], "eponym": f.get("eponym", row["eponym"]), "value": f.get("value", row["value"])}
            if f.get("element_group"):
                form["group"] = int(f["element_group"])
            # Note: the form's own detail ("Also with reverse grip."), then the Code rule.
            rule = sentence(edit_note(s["forms_rule"])) if s.get("forms_rule") else row["note"]
            form["note"] = " ".join(x for x in (sentence(edit_note(f.get("note") or "")), rule) if x)
            if f["form"] == "a":
                form["alias"] = row["id"]
                links["aliases"][row["id"]] = fid
            for t in f.get("same_as") or []:
                links["same_as"].append((fid, t))
            if "hand_support_flight" in f:
                links["flight"][fid] = f["hand_support_flight"]
            rows.append(form)
    ids = [r["id"] for r in rows]
    assert len(ids) == len(set(ids)), "duplicate WAG skill ids"
    for text in NOTE_EDITS.keys() - notes_edited:
        print(f"note_edits.json: no WAG skill note reads {text!r} any more (edit it or remove the entry)")
    write("wag-skills.js", "// Generated by tools/build_data.py from the skill bundle: WG WAG CoP 2025-2028 skills (wg-wag.json), USAG Xcel 2022-2028 and Development Program 2026-2030 E skills,\n// and UCG WAG CoP additions (ucg_wag_skills_simplified.json; USAG names are our own short names, not the Code's text).\n// group: WG element group (WG skills) or USAG element group (USAG / UCG skills). divisions: Xcel division-limited skills.\n", "SKILLS", rows)
    return set(ids), links

SAME_ELEMENT_DIGEST = "rules/USAG-XCEL-2022/digest/same-element.json"


def wag_redirects():
    """Retired UCG / UCG Masters WAG skill ids -> their replacements (the WAG loader in
    js/skill-search.js maps them, as the MAG one does), from the bundle's ucg-wag.json and
    ucg-masters-wag.json."""
    redirects = {**bundle("skills/ucg-wag.json").get("redirects", {}), **bundle("skills/ucg-masters-wag.json").get("redirects", {})}
    with open(os.path.join(OUT, "wag-redirects.js"), "w", encoding="utf-8", newline="\n") as f:
        f.write("// Generated by tools/build_data.py from the redirects of the bundle's ucg-wag.json and ucg-masters-wag.json:\n")
        f.write("// retired UCG / UCG Masters WAG skill id -> the skill it was merged into (routines saved with the old id open on it).\n")
        f.write(f"export const REDIRECTS = {json.dumps(redirects, ensure_ascii=False, indent=2)};\n")
    print(f"wrote js/data/wag-redirects.js: {len(redirects)} redirects")


def wag_same(built):
    """Which listed versions of a USAG skill number count as the same element (Xcel CoP,
    each event's Chapter 2 "Elements considered the same / different" plus box notes),
    and which floor elements are acro flight elements with hand support. From the bundle's
    rules/USAG-XCEL-2022/digest/same-element.json (reviewed per number; reasons in our own words)."""
    skill_ids, links = built
    aliases = links["aliases"]
    known = lambda i: aliases.get(i, i)  # a record that gained forms means its form "a"
    data = bundle(SAME_ELEMENT_DIGEST)
    parent = {}

    def find(i):
        while parent.get(i, i) != i:
            i = parent[i]
        return i

    def union(a, b):
        for i in (a, b):
            assert i in skill_ids, f"unknown skill id {i}"
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[rb] = ra
            parent.setdefault(ra, ra)

    for app in ("UB", "BB", "FX"):
        for box in data.get(app, {}).get("boxes", []):
            for group in box["same"]:
                for i in group[1:]:
                    union(known(group[0]), known(i))
    for a, b in links["same_as"]:  # e.g. the Bronze / Silver stand-ins and the regular leaps and jumps
        union(known(a), known(b))
    same = {i: find(i) for i in parent}  # only ids that were joined to another are in parent
    for bare, form_a in aliases.items():  # routines saved with the bare record id
        same[bare] = same.get(form_a, form_a)
    # Floor hand-support flight: the review's list (a record with forms means each form not
    # flagged false), plus forms flagged true.
    flight = []
    for i in data.get("FX", {}).get("handSupportFlight", []):
        assert i in skill_ids or i in aliases, f"unknown skill id {i}"
        if i in aliases:
            flight += [f for f in sorted(skill_ids) if f.startswith(i) and f[len(i):].isalpha() and links["flight"].get(f, True)]
        else:
            flight.append(i)
    flight += [f for f, v in links["flight"].items() if v and f not in flight]
    flight += [bare for bare, form_a in aliases.items() if form_a in flight]  # routines saved with the bare id
    with open(os.path.join(OUT, "wag-same.js"), "w", encoding="utf-8", newline="\n") as f:
        f.write(f"// Generated by tools/build_data.py from the skill bundle's {SAME_ELEMENT_DIGEST}.\n")
        f.write("// SAME_ELEMENT: listed versions of one USAG number that count as the same element (version id -> shared key).\n")
        f.write("// HAND_SUPPORT_FLIGHT: floor acro flight elements with hand support (credited every time, in different passes).\n")
        f.write("export const SAME_ELEMENT = " + json.dumps(same, indent=0, ensure_ascii=False).replace("\n", " ") + ";\n")
        f.write("export const HAND_SUPPORT_FLIGHT = " + json.dumps(flight, ensure_ascii=False) + ";\n")
    print(f"wrote js/data/wag-same.js: {len(same)} versions in same-element groups, {len(flight)} hand-support flight elements")

def sapphire_vaults():
    """USAG Level 9/10 vaults that aren't in the Xcel Sapphire table: UCG Xcel Sapphire
    allows them at 10.0 (UCG Women's Rules II.B.2). One row per vault number."""
    rows, by_num = [], {}
    for s in records("ucg_wag_skills_simplified.json"):
        if s["apparatus"] != "VT" or not s["source"].startswith("USAG Development"):
            continue
        name = " ".join(s["description"].split()) + (f" ({s['eponym']})" if s.get("eponym") else "")
        if s["number"] in by_num:
            by_num[s["number"]]["name"] += f" / {name}"
            continue
        by_num[s["number"]] = row = {"id": f"L910-{s['number']}", "code": s["number"], "name": name,
                                     "group": int(s["element_group"]), "sv": float(s["start_values"]["Sapphire"])}
        rows.append(row)
    write("sapphire-vaults.js", "// Generated by tools/build_data.py from the skill bundle's ucg_wag_skills_simplified.json: USAG Level 9/10 vaults not in the\n// Xcel Sapphire table, allowed in UCG Xcel Sapphire at 10.0 (UCG Women's Rules II.B.2).\n", "VAULTS", rows)

def wag_vaults():
    rows = []
    for s in records("wg-wag.json"):
        if s["apparatus"] != "VT":
            continue
        rows.append({"id": s["number"], "name": s["description"], "eponym": s.get("eponym") or "", "eg": s["element_group"], "value": float(s["value"]), "src": "WG"})
    write("wag-vaults.js", "// Generated by tools/build_data.py from the skill bundle's wg-wag.json: WG WAG vault table 2025-2028.\n", "VAULTS", rows)
    return {r["id"]: r for r in rows}


# Masters vault table rows without an id (WG vaults, which the planner values from the WG
# table) -> the WG vault(s) they correspond to, from the Masters vault digests. Only a check: the
# build stops if a row's printed WG value differs from the WG table's.
MASTERS_MAP = {sheet: bundle(f"rules/{code}/digest/vault-values.json")["table_wg_vaults"]["rows"]
               for sheet, code in (("Men", "UCG-MASTERS-MAG"), ("Women", "UCG-MASTERS-WAG"))}

# The table's UCG Masters vaults -> their planner ids. Ids are permanent (saved in routines),
# so they're pinned here, not derived from the names, which follow the CoP's printed wording.
# Retired: UCGM-wag-straight-hecht-over-table (dropped from the CoP table 2026-10-06).
DECADES = ["30", "40", "50", "60", "70"]  # js/scoring/masters.js's age columns


def masters_vaults(wag_by_id):
    """Write the Masters vaults that aren't in the WG code (the rows with a planner id) and the
    vault age bonus per decade, from the bundle's ucg-masters-vaults.json (owned by
    ucg-code-of-points), and check the table's WG rows against the WG vault values."""
    table = bundle("skills/ucg-masters-vaults.json")
    if table["decades"] != DECADES:
        raise SystemExit(f"ucg-masters-vaults.json decades {table['decades']}: js/scoring/masters.js has {DECADES}")
    text = open(os.path.join(OUT, "mag-vaults.js"), encoding="utf-8").read()
    mag_by_id = {v["id"]: v for v in json.loads(text[text.index("["): text.rindex("]") + 1])}
    rows, problems, bonus = [], [], {}
    for sheet, disc, by_id in (("Men", "mag", mag_by_id), ("Women", "wag", wag_by_id)):
        retired = set(table[disc].get("retired") or [])
        bonus[disc] = [float(b) for b in table[disc]["age_bonus"]]
        for r in (r for g in table[disc]["groups"] for r in g):
            name, value = r["description"], float(r["wg_value"])
            if r.get("id"):
                if r["id"] not in retired:
                    rows.append({"id": r["id"], "disc": disc, "name": name, "value": value, "src": "UCG",
                                 "flipping": bool(re.search(r"(?i)salto|tsuk|yurch", name))})
                continue
            ids = MASTERS_MAP[sheet].get(name)
            if not ids:
                problems.append(f"{sheet}: {name!r} has no id and isn't in the digest's table_wg_vaults")
            for i in ids or []:
                wg = by_id.get(i)
                if not wg or abs(wg["value"] - value) > 1e-9:
                    problems.append(f"{sheet}: {name} = {value}, WG {i} = {wg and wg['value']}")
    if problems:
        raise SystemExit("MASTERS VAULT CHECK:\n  " + "\n  ".join(problems))
    write("masters-vaults.js", "// Generated by tools/build_data.py from the skill bundle's ucg-masters-vaults.json: Masters vaults that aren't in the WG code.\n// The table's other vaults were checked against the WG vault tables, which the planner uses for them.\n// AGE_BONUS: the vault age bonus per decade (30s, 40s, 50s, 60s, 70+), added to the vault's value.\n"
          f"export const AGE_BONUS = {json.dumps(bonus)};\n", "VAULTS", rows)


def masters_rules():
    """The UCG Masters scoring tables the planner uses (js/scoring/masters.js, mag.js, wag.js), from the
    bundle's rules digest (rules/UCG-MASTERS/digest/scoring.json, from the UCG Masters Rules Policy)."""
    d = bundle("rules/UCG-MASTERS/digest/scoring.json")
    if d["decades"] != [f"{x}s" for x in DECADES]:
        raise SystemExit(f"scoring.json decades {d['decades']}: js/scoring/masters.js has {DECADES}")
    values = {k: v for k, v in d["difficulty_by_decade"].items() if k not in ("aliases", "cite")}
    mag, wag = d["MAG"], d["WAG"]
    cr = wag["composition_requirements"]
    rules = {
        "values": values,
        "lengthMin": d["min_level_for_length"]["levels"],
        "best": d["counting_elements"]["best"],
        "total": d["counting_elements"]["total"],
        "perMissing": d["short_routine"]["per_missing_element"],
        "mag": {"egBonus": {k: mag["eg_bonus"][k] for k in ("0.3", "0.5")}, "dismountEgMax": mag["dismount_eg"]["max"]},
        "wag": {
            "crEach": cr["cr_1_to_4"]["each"], "crMin": cr["cr_1_to_4"]["min_level"],
            "dismountCr": {k: cr["dismount_cr"][k] for k in ("0.3", "0.5")},
            "ubAuto": {k: v for k, v in wag["UB"]["automatic_from_age_60"].items() if k in ("I", "II")},
            "beamBonus": wag["BB"]["beam_bonus"],
            "cr": {app: wag[app]["cr"] for app in ("UB", "BB", "FX")},
        },
    }
    with open(os.path.join(OUT, "masters-rules.js"), "w", encoding="utf-8", newline="\n") as f:
        f.write("// Generated by tools/build_data.py from the skill bundle's rules/UCG-MASTERS/digest/scoring.json (UCG Masters\n")
        f.write("// Rules Policy v2.1). Lists run 30s, 40s, 50s, 60s, 70+; a level list gives the lowest letter that qualifies (null: none).\n")
        f.write("export const RULES = " + json.dumps(rules, ensure_ascii=False, indent=1) + ";\n")
    print("wrote js/data/masters-rules.js")


def wg_mag_rules():
    """WG MAG rules the planner applies (js/scoring/mag.js): counting, the floor balance-or-jump and
    tumbling-start requirements and the rings swing to handstand list, from the bundle's
    rules/WG-MAG-2025/digest/composition.json (current to the newsletters); and the high bar flight
    styles, which the planner owns (tools/source/hb_flight_styles.json)."""
    d = bundle("rules/WG-MAG-2025/digest/composition.json")
    req = {r["id"]: r for app in d["requirements"].values() for r in app}
    text = open(os.path.join(OUT, "mag-skills.js"), encoding="utf-8").read()
    skill_ids = {s["id"] for s in json.loads(text[text.index("["): text.rindex("]") + 1])}
    styles = json.load(open(os.path.join(SRC, "hb_flight_styles.json"), encoding="utf-8"))["styles"]
    style_of = {}
    for style, ids in styles.items():
        for i in ids:
            if i not in skill_ids or i in style_of:
                raise SystemExit(f"hb_flight_styles.json: {i} is {'listed twice' if i in style_of else 'not a MAG skill'}")
            style_of[i] = style
    for r in ("balance_or_jump", "swing_to_handstand"):
        missing = [i for i in req[r]["elements"] if i not in skill_ids]
        if missing:
            raise SystemExit(f"composition.json {r}: not in mag-skills.js: {missing}")
    rules = {
        "counting": {"dismount": d["counting"]["FX"]["dismount"], "others": d["counting"]["FX"]["others"],
                     "maxPerEg": d["counting"]["FX"]["max_per_eg"]},
        "dismountEgMax": d["dismount_group"]["max"],
        "fxBalanceOrJump": {k: req["balance_or_jump"][k] for k in ("elements", "neutral", "ucg_levels")},
        "fxStartTumbling": {k: req["start_with_tumbling"][k] for k in ("neutral", "ucg_levels")},
        "srSwingHs": req["swing_to_handstand"]["elements"],
        "hbFlightStyle": style_of,
    }
    with open(os.path.join(OUT, "wg-mag-rules.js"), "w", encoding="utf-8", newline="\n") as f:
        f.write("// Generated by tools/build_data.py from the skill bundle's rules/WG-MAG-2025/digest/composition.json (WG MAG 2025-2028\n")
        f.write("// with the newsletters) and tools/source/hb_flight_styles.json (hbFlightStyle: the planner's own reading).\n")
        f.write("export const RULES = " + json.dumps(rules, ensure_ascii=False, indent=1) + ";\n")
    print("wrote js/data/wg-mag-rules.js")


MASTERS_WAG_TAGS = {"ub": {"mount", "dismount", "kip", "bar_change", "circle", "turn180", "turn180_opt", "flight"},
                    "bb": {"mount", "dismount", "dance", "leap", "split", "turn", "acro", "flight", "hold"},
                    "fx": {"dance", "leap", "split", "turn", "acro", "flight", "fwd", "bwd"}}


EVENTS = ("UB", "BB", "FX")


def strip(block):
    """A digest block without its own-words notes (about, cite)."""
    return {k: v for k, v in block.items() if k not in ("about", "cite")}


def infinity():
    """UCG Infinity's scoring tables (js/data/infinity-rules.js, used by js/scoring/wag.js) and its vault
    chart (js/data/wag-infinity-vaults.js), from the bundle's rules/UCG-WAG digests (the UCG Infinity Rules,
    source of record) and levels.json (the condensed groups). Vault ids: tools/source/infinity_vault_ids.json."""
    d = bundle("rules/UCG-WAG/digest/infinity.json")
    level = bundle("catalog/levels.json")["WAG"]["infinity"]
    if strip(d["values"]) != level["values"]:
        raise SystemExit(f"infinity.json values {strip(d['values'])} differ from levels.json {level['values']}")
    names, labels = d["condensed_eg_bonus"]["group_names"], d["event_bonus"]["labels"]
    groups = {ev.lower(): {"groups": names[ev],
                           "condensed": {g: [int(n) for n in ns] for g, ns in level["eg"]["condensed"][ev].items()},
                           "eventBonus": labels[ev]} for ev in EVENTS}
    consts = {"INFINITY_VALUES": strip(d["values"]), "INFINITY_MAX_SKILLS": d["counting"]["count"],
              "INFINITY_MIN_SKILLS": d["short_routine"]["min_skills"], "INFINITY_EG_BONUS": d["condensed_eg_bonus"]["each"],
              "INFINITY_EVENT_BONUS": d["event_bonus"]["each"]}
    with open(os.path.join(OUT, "infinity-rules.js"), "w", encoding="utf-8", newline="\n") as f:
        f.write("// Generated by tools/build_data.py from the skill bundle's rules/UCG-WAG/digest/infinity.json (UCG Infinity\n")
        f.write("// Rules v1.2) and catalog/levels.json (condensed groups): USAG DP / Xcel element groups, condensed into I-IV.\n")
        f.write("export const INFINITY_GROUPS = " + json.dumps(groups, ensure_ascii=False, indent=2) + ";\n")
        for k, v in consts.items():
            f.write(f"export const {k} = {json.dumps(v)};\n")
    print("wrote js/data/infinity-rules.js")

    chart = bundle("rules/UCG-WAG/digest/infinity-vaults.json")["vaults"]
    ids = json.load(open(os.path.join(SRC, "infinity_vault_ids.json"), encoding="utf-8"))["vaults"]
    by_name = {n: v for v in ids for n in [v["name"], *v.get("was", [])]}
    rows, used = [], set()
    for r in chart:
        v = by_name.get(r["name"])
        if not v:
            raise SystemExit(f"Infinity vault {r['name']!r} ({r['usag']}) has no id in tools/source/infinity_vault_ids.json")
        if v["id"] in used:
            raise SystemExit(f"two Infinity chart rows match {v['id']}")
        used.add(v["id"])
        row = {"id": v["id"], "name": r["name"], "entry": r["entry"], "usag": r["usag"], "dv": r["d"]}
        if v.get("was"):
            row["was"] = v["was"]
        rows.append(row)
    gone = [v["id"] for v in ids if v["id"] not in used]
    if gone:
        raise SystemExit(f"Infinity vault ids with no chart row (saved routines hold them): {gone}")
    write("wag-infinity-vaults.js", "// Generated by tools/build_data.py from the skill bundle's rules/UCG-WAG/digest/infinity-vaults.json, the full\n"
          "// vault chart of the UCG Infinity Rules (source of record). dv = D score (start value is dv + 10).\n"
          "// id: the vault's permanent id (saved routines store it), from tools/source/infinity_vault_ids.json.\n",
          "VAULTS", rows)


def xcel():
    """The Xcel tables of UCG's Xcel levels (js/data/xcel.js), from the bundle's rules/USAG-XCEL-2022/digest/levels.json."""
    d = bundle("rules/USAG-XCEL-2022/digest/levels.json")
    tables = {"XCEL_VP": strip(d["value_parts"]), "XCEL_LIMITS": strip(d["limits"]), "XCEL_SR": strip(d["special_requirements"]),
              "XCEL_VAULTS": d["vaults"]["rows"], "XCEL_SILVER_VAULTS": d["silver_vaults"]["rows"]}
    with open(os.path.join(OUT, "xcel.js"), "w", encoding="utf-8", newline="\n") as f:
        f.write("// Generated by tools/build_data.py from the skill bundle's rules/USAG-XCEL-2022/digest/levels.json: UCG's Xcel\n")
        f.write("// levels (USAG Xcel Code of Points 2022-2028 event charts, with the UCG Women's Rules v6.0 changes).\n")
        f.write("// XCEL_VP: value parts required, highest first (a higher VP can fill a lower one). XCEL_LIMITS: highest letter\n")
        f.write("// allowed per event without the 0.50 restricted-skill deduction, and how many of it (maxCount). XCEL_SR: the\n")
        f.write("// special requirements, paraphrased. XCEL_VAULTS: gold = allowed at Gold; plat/diamond/sapphire = start value\n")
        f.write("// (a division missing from a row doesn't allow the vault). XCEL_SILVER_VAULTS: over a mat stack.\n")
        for k, v in tables.items():
            f.write(f"export const {k} = " + json.dumps(v, ensure_ascii=False, indent=2) + ";\n")
    print("wrote js/data/xcel.js")


def masters_wag_tags():
    """What each Masters WAG skill is, for the Composition Requirements (js/scoring/wag.js), from the
    planner's own tools/source/masters_wag_tags.json (the CoP prints no CR marks). Run after catalog()."""
    tags = json.load(open(os.path.join(SRC, "masters_wag_tags.json"), encoding="utf-8"))["tags"]
    app_of = {}
    for name in ("wag-skills.js", "masters-skills-wag.js"):
        text = open(os.path.join(OUT, name), encoding="utf-8").read()
        app_of.update({s["id"]: s["app"] for s in json.loads(text[text.index("["): text.rindex("]") + 1])})
    problems = [f"{i}: not a WAG skill" for i in tags if i not in app_of]
    problems += [f"{i}: unknown tags {sorted(set(t) - MASTERS_WAG_TAGS[app_of[i]])}" for i, t in tags.items()
                 if i in app_of and set(t) - MASTERS_WAG_TAGS[app_of[i]]]
    problems += [f"{i}: Masters skill with no entry" for i, a in app_of.items() if i.startswith("UCGM-") and i not in tags]
    if problems:
        raise SystemExit("masters_wag_tags.json:\n  " + "\n  ".join(problems))
    with open(os.path.join(OUT, "masters-wag-tags.js"), "w", encoding="utf-8", newline="\n") as f:
        f.write("// Generated by tools/build_data.py from tools/source/masters_wag_tags.json: what each Masters WAG skill is, for the\n")
        f.write("// Composition Requirements (the planner's own tags; the Masters CoP prints no CR marks).\n")
        f.write("export const TAGS = {\n" + ",\n".join(f"  {json.dumps(k)}: {json.dumps(v)}" for k, v in tags.items() if v) + "\n};\n")
    print(f"wrote js/data/masters-wag-tags.js: {len(tags)}")


def norm(name):
    n = re.sub(r"[^a-z0-9/ ]+", " ", name.lower().replace("¾", " 3/4 ").replace("½", " 1/2 ").replace("porpise", "porpoise"))
    n = re.sub(r"\b(back|front) (tuck|pike|straight|layout)\b", r"\1 somersault \2", n)
    n = n.replace("layout", "straight").replace("stepout", "step out").replace("step-out", "step out")
    return " ".join(n.split())


TT_ROWS = []


def tt():
    data = json.load(open(os.path.join(SRC, "tt_skills.json"), encoding="utf-8"))
    rows = []
    for key, apps in (("tramp", ["tr"]), ("dmt", ["dmt"])):
        for s in data[key]:
            for pos, dd in s["positions"].items():
                name = s["name"].strip()
                label = f"{name} {POS.get(pos, pos)}".strip() if len(s["positions"]) > 1 else name
                for app in apps:
                    rows.append({
                        "id": f"TT-{app}-{slug(label)}-{slug(s.get('fig', '') + pos) or 'x'}",
                        "app": app,
                        "name": label,
                        "notation": f"{s.get('fig', '')}{pos}".strip(),
                        "dd": dd,
                        "src": "UCG",
                    })
    for s in data["tumbling"]:
        rows.append({
            "id": f"TT-tu-{slug(s['name'])}",
            "app": "tu",
            "name": s["name"].strip(),
            "notation": s.get("symbol", ""),
            "dd": s["dd"],
            "src": "UCG",
        })
    seen = set()
    rows = [r for r in rows if not (r["id"] in seen or seen.add(r["id"]))]
    TT_ROWS[:] = rows
    write("tt-skills.js", "// Generated by tools/build_data.py from tools/source/tt_skills.json (UCG T&T DD charts).\n// notation: FIG shorthand; dd: difficulty.\n", "SKILLS", rows)


def match_tt(app, skill):
    """Fill in shorthand (and the skill id) for an example skill found in the DD charts."""
    app = "tr" if app == "sy" else app
    key = norm(skill.get("name", ""))
    for cand in (key, f"{key} tuck"):
        for r in TT_ROWS:
            if r["app"] == app and norm(r["name"]) == cand:
                # The chart's DD wins: several example sheets predate the UCG addendum.
                return {**skill, "notation": skill.get("notation") or r["notation"], "dd": r["dd"], "skillId": r["id"]}
    return skill


# Example routines left out because they break their level's rules with the current
# DD chart (found by tools/check_examples.mjs; tests/examples.test.mjs keeps the rest clean).
EXCLUDE = {
    "tt-if-tr-3",  # 2 full saltos; Intermediate Flyers need 3
    "tt-hf-tr-10",  # two skills given only as "4/" (0.5) and "6o" (0.7), not in the DD chart
    "tt-hf-tr-11",  # repeats Barani Straight
    "tt-if-tu-1", "tt-if-tu-2",  # 0.1 skills; Intermediate Flyers need 0.2+
    "tt-if-tu-5", "tt-if-tu-7",  # pass 2 has fewer than 8 skills
    "tt-if-tu-9",  # pass 2: 7 skills, a 0.1 skill and 3.0 DD (max 2.9)
    "tt-if-tu-10",  # pass 2 is 3.0 DD (max 2.9)
    "tt-if-tu-6", "tt-if-tu-8",  # pass 2 opens with a front salto step-out (1 salto, as the dismount)
}


def examples():
    rows = []
    stale = re.compile(r"(?i)sheet note: (-1 for each skill fewer than 6|sv cap is [\d.]+)\.?")
    for e in json.load(open(os.path.join(SRC, "examples.json"), encoding="utf-8")):
        if e["id"] in EXCLUDE:
            continue
        r = {"id": e["id"], "disc": e["discipline"], "level": e["level"], "event": e["event"], "title": e["title"]}
        if "skills" in e:
            if e["discipline"] == "tt":
                r["skills"] = [match_tt(e["event"], {"name": s.get("name", ""), "notation": s.get("notation", ""), "dd": s.get("dd", "")}) for s in e["skills"]]
            elif e["discipline"] == "wag":
                # Matched to the Xcel list already (see examples_notes.md): kept as the skill
                # picker would set it, so values, groups and special requirements follow the list.
                r["skills"] = [
                    {
                        "name": s.get("name", ""), "letter": s.get("letter", ""), "eg": s.get("eg", ""),
                        **({"skillId": s["skillId"], "fromList": True} if s.get("skillId") else {}),
                        **({"link": True} if s.get("link") else {}),
                    }
                    for s in e["skills"]
                ]
            else:
                r["skills"] = [{"name": s.get("name", ""), "letter": s.get("letter", ""), "eg": str(s["eg"]) if s.get("eg") else ""} for s in e["skills"]]
        if "passes" in e:
            r["passes"] = [[match_tt(e["event"], {"name": s.get("name", ""), "notation": s.get("notation", ""), "dd": s.get("dd", "")}) for s in p] for p in e["passes"]]
            # Double mini: whether each pass starts with a mounter or a spotter.
            starts = [(p[0].get("role") if p else None) for p in e["passes"]]
            if any(x in ("mounter", "spotter") for x in starts):
                r["starts"] = [x if x in ("mounter", "spotter") else "mounter" for x in starts]
        if e.get("vaultNumber"):
            r["vault"] = str(e["vaultNumber"])
        note = stale.sub("", e.get("note", "")).strip()
        if note:
            r["note"] = note
        if e.get("video"):
            r["video"] = e["video"]
        rows.append(r)
    write("examples.js", "// Generated by tools/build_data.py from tools/source/examples.json (UCG example routine sheets).\n", "EXAMPLES", rows)


# ---- Cross-code skill catalog (the skill bundle's catalog/, built in gym-skill-extract skill_catalog/) ----
# Only the *_public catalogs are copied here: the full ones carry the codes' text.

CAT = os.path.join(BUNDLE, "catalog")
ROMAN_NUM = {"I": 1, "II": 2, "III": 3, "IV": 4, "V": 5}
# The Masters value letters: GE (Gymnastics Element) replaced the old "Misc" (Nate 2026-10-20); a
# record still valued "Misc" reads as GE.
MASTERS_VALUE = {"Misc": "GE"}
CODE_PREFIX = {"WG-WAG-2025": "WG", "WG-MAG-2025": "WG", "USAG-XCEL-2022": "Xcel", "USAG-DP-2026": "DP",
               "UCG-WAG-ADD": "UCG", "UCG-MAG-ADD": "UCG", "UCG-MASTERS-WAG": "Masters", "UCG-MASTERS-MAG": "Masters"}


def box_label(code, x, app):
    """How the planner prints a skill's box number, e.g. 'WG I.75', 'Xcel 7.104', 'UCG FX 12'."""
    n = str(x.get("number") or "").strip()
    if not n:
        return ""
    pre = CODE_PREFIX[code]
    if code == "WG-MAG-2025" and app != "VT":
        return f"WG {x.get('element_group')}.{n}"
    if code.startswith("UCG-"):
        return f"{pre} {app} {n.replace('UCG ', '')}"
    return f"{pre} {n}"


def own_record(pid, entries):
    """The catalog entry that IS the planner record `pid` (not just another record of its element)."""
    # exact, then a record split into forms (bare id = form a), then the Development Program's
    # own ids (the planner names DP E skills USAG-...), then vault numbers.
    dp = pid.replace("USAG-", "USAGDP-", 1)
    tries = [pid, pid + "a", dp, dp + "a", "WG-VT-" + pid, f"WGW-VT-{pid}-1"]
    for t in tries:
        for code, x in entries:
            if x["rid"] == t or x["rid"] + (x.get("form") or "") == t:
                return code, x
    return None


def catalog():
    levels = json.load(open(os.path.join(CAT, "levels.json"), encoding="utf-8"))
    out = {}
    for disc in ("wag", "mag"):
        index, masters_rows = {}, []
        cat = json.load(open(os.path.join(CAT, f"catalog_{disc}_public.json"), encoding="utf-8"))
        ali = json.load(open(os.path.join(CAT, f"aliases_{disc}.json"), encoding="utf-8"))
        els = {e["id"]: e for e in cat["elements"]}
        pid_of, unlabelled = {}, []
        for pid, ids in ali["aliases"].items():
            entries = [(code, x) for i in ids for code, xs in els[i]["codes"].items() for x in xs]
            own = own_record(pid, entries)
            if not own:
                unlabelled.append(pid)
                continue
            code, x = own
            app = els[ids[0]]["apparatus"]
            aka = sorted({a for i in ids for a in els[i].get("aka") or []} | set(x.get("aka") or []))
            row = {"l": box_label(code, x, app)}
            if x.get("page") and code.startswith("UCG-MASTERS"):
                row["p"] = x["page"]
            if aka:
                row["a"] = aka
            # What the skill is (acro, flight, salto, 360° circle ...), for the Xcel special
            # requirements, restrictions and Sapphire bonus (js/scoring/xcel-rules.js). UCG's tag
            # rulings are already in the catalog (gym-skill-extract skill_catalog/tags/tags_overrides.json).
            if "tags" in x:  # {} = tagged, nothing applies
                row["t"] = x["tags"]
            if x.get("markers"):
                row["m"] = x["markers"]
            index[pid] = row
            # catalog record -> the planner id that names it (the record's own id when the planner uses it)
            if pid == x["rid"] or x["rid"] not in pid_of:
                pid_of[x["rid"]] = pid
        if unlabelled:
            print(f"  catalog {disc}: {len(unlabelled)} planner ids without their own record (e.g. {unlabelled[:4]})")

        # UCG Masters additions: skills the planner offers at Masters (vaults come from masters-vaults.js).
        code = f"UCG-MASTERS-{disc.upper()}"
        seen = {}
        for e in cat["elements"]:
            if e["apparatus"] == "VT":
                continue
            for x in e["codes"].get(code, []):
                if x["rid"] in seen and not x.get("relation"):
                    seen[x["rid"]][1] = x
                seen.setdefault(x["rid"], [e, x])
        for rid, (e, x) in seen.items():
            row = {"id": rid, "app": e["apparatus"].lower(), "name": x["short_name"], "eponym": x.get("eponym") or "",
                   "value": MASTERS_VALUE.get(x["value"], x["value"]), "src": "UCGM", "note": x.get("note") or ""}
            # MAG: element group I-IV as the WG/UCG skills have it. WAG Masters has no element groups
            # (Composition Requirements instead).
            if disc == "mag":
                row["eg"] = ROMAN_NUM.get(x.get("element_group") or "")
            if x.get("aka"):
                row["aka"] = x["aka"]
            masters_rows.append(row)

        # Loaded with the discipline's skill lists (skill-search.js loadDiscipline).
        with open(os.path.join(OUT, f"skill-index-{disc}.js"), "w", encoding="utf-8", newline="\n") as f:
            f.write("// Generated by tools/build_data.py from the skill bundle's catalog/: per planner skill id, its box label in its own code\n")
            f.write("// (l: 'WG I.75', 'Xcel 7.104', 'UCG FX 12', 'Masters PB 12'), the Masters page (p), other names coaches use (a),\n")
            f.write("// and what the skill is (t: tags) and the Code's printed marks (m: e.g. 'D' counts as dance).\n")
            f.write("export const INDEX = " + json.dumps(index, ensure_ascii=False, separators=(",", ":")) + ";\n")
        print(f"wrote js/data/skill-index-{disc}.js: {len(index)}")
        groups = "eg: element group 1-4" if disc == "mag" else "No element groups (Composition Requirements instead)"
        write(f"masters-skills-{disc}.js", f"// Generated by tools/build_data.py from the skill bundle's catalog/: the UCG Masters {disc.upper()} skill list (not vaults).\n// {groups}. value: Masters letter (GE, ME, A, ...).\n", "SKILLS", masters_rows)
        # Lazily loaded re-valuing data: elements' code entries (skills only), aliases, merges.
        slim = {}
        for e in cat["elements"]:
            if e["apparatus"] == "VT":
                continue
            c = {}
            for code_key, xs in e["codes"].items():
                c[code_key] = [{k: v for k, v in (("r", x["rid"]),
                                                  ("v", MASTERS_VALUE.get(x.get("value"), x.get("value"))), ("x", x.get("adjusted_value")), ("g", x.get("element_group")),
                                                  ("rel", x.get("relation"))) if v} for x in xs]
            slim[e["id"]] = {"s": e["short_name"], "c": c}
        # Vaults: each vault element's records in every code (rid, code, broader?), and rid -> elements.
        vaults, vault_of = {}, {}
        for e in cat["elements"]:
            if e["apparatus"] != "VT":
                continue
            ents = [{k: v for k, v in (("r", x["rid"]), ("c", c), ("rel", x.get("relation"))) if v} for c, xs in e["codes"].items() for x in xs]
            vaults[e["id"]] = ents
            for x in ents:
                vault_of.setdefault(x["r"], []).append(e["id"])
        out[disc] = {"version": cat["version"], "levels": levels["version"], "levelRules": levels[disc.upper()],
                     "elements": slim, "aliases": {k: v for k, v in ali["aliases"].items() if all(i in slim for i in v)},
                     "merged": ali.get("merged") or {}, "pidOf": pid_of, "vaults": vaults, "vaultOf": vault_of}
        with open(os.path.join(OUT, f"catalog-{disc}.js"), "w", encoding="utf-8", newline="\n") as f:
            f.write(f"// Generated by tools/build_data.py from the skill bundle's catalog/ (cross-code skill catalog {cat['version']}, levels {levels['version']}).\n")
            f.write("// Loaded only when a routine is copied to another level: re-values each skill in the target level's code.\n")
            f.write("export const CATALOG = " + json.dumps(out[disc], ensure_ascii=False, separators=(",", ":")) + ";\n")
        print(f"wrote js/data/catalog-{disc}.js: {len(slim)} elements")



if __name__ == "__main__":
    wag_same(wag())
    wag_redirects()
    sapphire_vaults()
    masters_vaults(wag_vaults())
    masters_rules()
    wg_mag_rules()
    infinity()
    xcel()
    tt()
    examples()
    catalog()
    masters_wag_tags()
