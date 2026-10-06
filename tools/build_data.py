"""Builds the WAG skill list, the T&T skill list and the example routines
(js/data/wag-skills.js, tt-skills.js, examples.js) from the JSON files in
tools/source/:

  wag_wg_skills.json   the WG (FIG) WAG Code of Points 2025-2028, from the
                       extractor in Dropbox Misc/Gymnastics/Reference/gym_skill_extract/WG WAG CoP Extraction
  Masters Vault Values.xlsx  UCG Masters vault values (Men / Women sheets)
  ucg_wag_skills_simplified.json  every skill UCG's Xcel levels and UCG Infinity credit:
                       USAG Xcel 2022-2028, USAG Development Program 2026-2030 E elements,
                       and the UCG WAG CoP additions. From the extractor in
                       Reference/gym_skill_extract/UCG WAG Skills. Only the simplified file
                       (USAG descriptions replaced by our own short names) belongs here:
                       the full one has the Code's text, and this repo is public.
  tt_skills.json       the UCG T&T DD charts (trampoline, double mini, tumbling),
                       including the UCG addendum's values
  examples.json        example routines: T&T (New / Intermediate / High Flyers)
                       and MAG (Developmental / Intermediate) Google Sheets

Run: python tools/build_data.py   (then commit the js/data files)
"""
import json
import os
import re

HERE = os.path.dirname(__file__)
SRC = os.path.join(HERE, "source")
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


def wg_value(v):
    return v.split("=")[0] if "=" in v else v


def wag():
    rows = []
    for s in json.load(open(os.path.join(SRC, "wag_wg_skills.json"), encoding="utf-8")):
        if s["apparatus"] == "VT":
            continue
        rows.append({
            "id": f"WGW-{s['apparatus']}-{s['number']}-{s.get('variant', 1)}",
            "app": s["apparatus"].lower(),
            "name": " ".join(s["description"].split()),
            "eponym": s.get("eponym") or "",
            "value": wg_value(s["value"]),
            "group": int(s["element_group"]),  # WG element group 1-6
            "src": "WG",
            "note": "",
        })
    # USAG Xcel A-D, USAG Development Program E, and the UCG WAG CoP additions: the skills
    # UCG's Xcel levels and UCG Infinity (the Open Scoring Level) credit, with USAG values.
    # From tools/source/ucg_wag_skills_simplified.json (built by the "UCG WAG Skills" extractor);
    # USAG descriptions there are our own short names, not the Code's text.
    division_ids = {"Bronze": "bronze", "Silver": "silver", "Gold": "gold", "Platinum": "plat", "Diamond": "diamond", "Sapphire": "sapphire"}
    # Records the Code treats as several different elements carry `forms` (one row each,
    # id + form letter, e.g. USAG-BB-7.104-1b); the bare record id stays as an alias of
    # form "a" so routines saved before the split still find their skill.
    links = {"aliases": {}, "same_as": [], "flight": {}}
    for s in json.load(open(os.path.join(SRC, "ucg_wag_skills_simplified.json"), encoding="utf-8")):
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
            "note": s.get("ucg_note") or "",
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
            # Hover note: the form's own detail ("also with alternating hands", ...), then the Code rule.
            form["note"] = " — ".join(x for x in (f.get("note"), s.get("forms_rule") or row["note"]) if x)
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
    write("wag-skills.js", "// Generated by tools/build_data.py: WG WAG CoP 2025-2028 skills (wag_wg_skills.json), USAG Xcel 2022-2028 and Development Program 2026-2030 E skills,\n// and UCG WAG CoP additions (ucg_wag_skills_simplified.json; USAG names are our own short names, not the Code's text).\n// group: WG element group (WG skills) or USAG element group (USAG / UCG skills). divisions: Xcel division-limited skills.\n", "SKILLS", rows)
    return set(ids), links

def wag_same(built):
    """Which listed versions of a USAG skill number count as the same element (Xcel CoP,
    each event's Chapter 2 "Elements considered the same / different" plus box notes),
    and which floor elements are acro flight elements with hand support. From
    tools/source/wag_same_elements.json (reviewed per number; reasons in our own words)."""
    skill_ids, links = built
    aliases = links["aliases"]
    known = lambda i: aliases.get(i, i)  # a record that gained forms means its form "a"
    path = os.path.join(SRC, "wag_same_elements.json")
    data = json.load(open(path, encoding="utf-8")) if os.path.exists(path) else {}
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
        f.write("// Generated by tools/build_data.py from tools/source/wag_same_elements.json.\n")
        f.write("// SAME_ELEMENT: listed versions of one USAG number that count as the same element (version id -> shared key).\n")
        f.write("// HAND_SUPPORT_FLIGHT: floor acro flight elements with hand support (credited every time, in different passes).\n")
        f.write("export const SAME_ELEMENT = " + json.dumps(same, indent=0, ensure_ascii=False).replace("\n", " ") + ";\n")
        f.write("export const HAND_SUPPORT_FLIGHT = " + json.dumps(flight, ensure_ascii=False) + ";\n")
    print(f"wrote js/data/wag-same.js: {len(same)} versions in same-element groups, {len(flight)} hand-support flight elements")

def sapphire_vaults():
    """USAG Level 9/10 vaults that aren't in the Xcel Sapphire table: UCG Xcel Sapphire
    allows them at 10.0 (UCG Women's Rules II.B.2). One row per vault number."""
    rows, by_num = [], {}
    for s in json.load(open(os.path.join(SRC, "ucg_wag_skills_simplified.json"), encoding="utf-8")):
        if s["apparatus"] != "VT" or not s["source"].startswith("USAG Development"):
            continue
        name = " ".join(s["description"].split()) + (f" ({s['eponym']})" if s.get("eponym") else "")
        if s["number"] in by_num:
            by_num[s["number"]]["name"] += f" / {name}"
            continue
        by_num[s["number"]] = row = {"id": f"L910-{s['number']}", "code": s["number"], "name": name,
                                     "group": int(s["element_group"]), "sv": float(s["start_values"]["Sapphire"])}
        rows.append(row)
    write("sapphire-vaults.js", "// Generated by tools/build_data.py from tools/source/ucg_wag_skills_simplified.json: USAG Level 9/10 vaults not in the\n// Xcel Sapphire table, allowed in UCG Xcel Sapphire at 10.0 (UCG Women's Rules II.B.2).\n", "VAULTS", rows)

def wag_vaults():
    rows = []
    for s in json.load(open(os.path.join(SRC, "wag_wg_skills.json"), encoding="utf-8")):
        if s["apparatus"] != "VT":
            continue
        rows.append({"id": s["number"], "name": " ".join(s["description"].split()), "eponym": s.get("eponym") or "", "eg": s["element_group"], "value": float(s["value"]), "src": "WG"})
    write("wag-vaults.js", "// Generated by tools/build_data.py from tools/source/wag_wg_skills.json: WG WAG vault table 2025-2028.\n", "VAULTS", rows)
    return {r["id"]: r for r in rows}


# Masters vault table rows -> the WG vault(s) they correspond to. Rows not listed
# here (squat on, roll over, hechts, ...) aren't in the WG code: UCG Masters vaults.
MASTERS_MAP = {
    "Men": {
        "Front handspring": ["201"], "Front handspring with 1/2 twist": ["202"], "Front handspring with 1/1 twist": ["203"], "Front handspring with 3/2 twist": ["204"],
        "Front handspring and salto fwd. tucked": ["207"], "Front handspring and salto fwd. tucked with ½ twist": ["101"],
        "Front handspring and salto fwd. piked": ["213"], "Front handspring and salto fwd. piked with ½ twist": ["107"],
        "Front handspring and salto fwd. stretched": ["219"], "Front handspring and salto fwd. stretched wit ½ twist": ["113"],
        "Front handspring sw with 1/4 twist": ["301"], "Front handspring sw with 3/4 twist": ["302"], "Front handspring sw with 5/4 twist": ["303"],
        "Tsukahara or Yurchenko tucked": ["307", "507"], "Tsukahara or Yurchenko piked": ["308", "509"],
        "Tsukahara or Yurchenko tucked with 1/2 twist": ["309", "508"], "Tsukahara or Yurchenko tucked with 1/1 twist": ["119", "401"],
        "Tsukahara or Yurchenko stretched": ["313", "510"], "Tsukahara or Yurchenko stretched with 1/2 twist": ["314", "511"],
        "Tsukahara or Yurchenko stretched with 1/1 twist": ["125", "405"],
    },
    "Women": {
        "Front handspring": ["1.00"], "Front handspring with 1/2 twist": ["1.01"], "Front handspring with 1/1 twist": ["1.02"], "Front handspring with 3/2 twist": ["1.03"],
        "Front handspring with ½ twist 1st phase": ["1.20"], "Front handspring with ½ twist 1st phase and ½ twist 2nd": ["1.21"],
        "Yamashita": ["1.10"], "Yamashita 1/2 twist": ["1.11"], "Yamashita 1/1 twist": ["1.12"],
        "Front handspring and salto fwd. tucked": ["2.10"], "Front handspring and salto fwd. tucked with ½ twist": ["2.11"],
        "Front handspring and salto fwd. piked": ["2.20"], "Front handspring and salto fwd. piked with ½ twist": ["2.21"],
        "Yurchenko tucked": ["4.10"], "Yurchenko piked": ["4.20"], "Yurchenko tucked with 1/2 twist": ["4.11"], "Yurchenko tucked with 1/1 twist": ["4.12"],
        "Yurchenko stretched": ["4.30"], "Yurchenko stretched with 1/2 twist": ["4.31"], "Yurchenko stretched with 1/1 twist": ["4.32"],
        "Tsukahara tucked": ["3.10"], "Tsukahara piked": ["3.20"], "Tsukahara tucked with 1/2 twist": ["3.11"], "Tsukahara tucked with 1/1 twist": ["3.12"],
        "Tsukahara stretched": ["3.30"], "Tsukahara stretched with 1/2 twist": ["3.31"], "Tsukahara stretched with 1/1 twist": ["3.32"],
    },
}


def masters_vaults(wag_by_id):
    """Write the Masters vaults that aren't in the WG code, and check the rest of
    the Masters table against the WG vault values."""
    import openpyxl
    text = open(os.path.join(OUT, "mag-vaults.js"), encoding="utf-8").read()
    mag_by_id = {v["id"]: v for v in json.loads(text[text.index("["): text.rindex("]") + 1])}
    wb = openpyxl.load_workbook(os.path.join(SRC, "Masters Vault Values.xlsx"), data_only=True)
    rows, problems = [], []
    for sheet, disc, by_id in (("Men", "mag", mag_by_id), ("Women", "wag", wag_by_id)):
        for r in list(wb[sheet].iter_rows(values_only=True))[4:]:
            name, value = (r[1] or "").strip(), r[2]
            if not name or value is None:
                continue
            ids = MASTERS_MAP[sheet].get(name)
            if ids:
                for i in ids:
                    wg = by_id.get(i)
                    if not wg or abs(wg["value"] - float(value)) > 1e-9:
                        problems.append(f"{sheet}: {name} = {value}, WG {i} = {wg and wg['value']}")
                continue
            rows.append({"id": f"UCGM-{disc}-{slug(name)}", "disc": disc, "name": name, "value": float(value), "src": "UCG",
                         "flipping": bool(re.search(r"(?i)salto|tsuk|yurch", name))})
    for p in problems:
        print("  MASTERS VAULT CHECK:", p)
    write("masters-vaults.js", "// Generated by tools/build_data.py from tools/source/Masters Vault Values.xlsx: Masters vaults that aren't in the WG code.\n// The table's other vaults were checked against the WG vault tables, which the planner uses for them.\n", "VAULTS", rows)


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


# ---- Cross-code skill catalog (tools/source/catalog/, from gym_skill_extract/skill_catalog) ----
# Only the *_public catalogs are copied here: the full ones carry the codes' text.

CAT = os.path.join(SRC, "catalog")
ROMAN_NUM = {"I": 1, "II": 2, "III": 3, "IV": 4, "V": 5}
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
    index, masters_rows, out = {}, [], {}
    for disc in ("wag", "mag"):
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
            g = ROMAN_NUM.get(x.get("element_group") or "")
            row = {"id": rid, "app": e["apparatus"].lower(), "name": x["short_name"], "eponym": x.get("eponym") or "",
                   "value": x["value"], "src": "UCGM", "note": x.get("note") or ""}
            # MAG: element group I-IV as the WG/UCG skills have it; WAG: the Masters condensed group.
            row["eg" if disc == "mag" else "mgroup"] = g
            if x.get("aka"):
                row["aka"] = x["aka"]
            masters_rows.append({**row, "disc": disc})

        # Lazily loaded re-valuing data: elements' code entries (skills only), aliases, merges.
        slim = {}
        for e in cat["elements"]:
            if e["apparatus"] == "VT":
                continue
            c = {}
            for code_key, xs in e["codes"].items():
                c[code_key] = [{k: v for k, v in (("r", x["rid"]),
                                                  ("v", x.get("value")), ("x", x.get("adjusted_value")), ("g", x.get("element_group")),
                                                  ("rel", x.get("relation"))) if v} for x in xs]
            slim[e["id"]] = {"s": e["short_name"], "c": c}
        out[disc] = {"version": cat["version"], "levels": levels["version"], "levelRules": levels[disc.upper()],
                     "elements": slim, "aliases": {k: v for k, v in ali["aliases"].items() if all(i in slim for i in v)},
                     "merged": ali.get("merged") or {}, "pidOf": pid_of}
        with open(os.path.join(OUT, f"catalog-{disc}.js"), "w", encoding="utf-8", newline="\n") as f:
            f.write(f"// Generated by tools/build_data.py from tools/source/catalog/ (cross-code skill catalog {cat['version']}, levels {levels['version']}).\n")
            f.write("// Loaded only when a routine is copied to another level: re-values each skill in the target level's code.\n")
            f.write("export const CATALOG = " + json.dumps(out[disc], ensure_ascii=False, separators=(",", ":")) + ";\n")
        print(f"wrote js/data/catalog-{disc}.js: {len(slim)} elements")

    # The planner's WAG Masters group map must agree with levels.json.
    lm = levels["WAG"]["masters"]["eg"]["map"]
    planner = {"UB": {1: 1, 2: 2, 4: 2, 5: 2, 3: 3, 6: 4}, "BB": {2: 1, 3: 2, 4: 3, 5: 3, 1: 4, 6: 4}, "FX": {1: 1, 2: 2, 3: 3, 4: 4, 5: 4}}
    for app, m in lm.items():
        for wg, roman in m.items():
            assert planner[app][int(wg)] == ROMAN_NUM[roman], f"WG_TO_MASTERS disagrees with levels.json: {app} {wg}"

    with open(os.path.join(OUT, "skill-index.js"), "w", encoding="utf-8", newline="\n") as f:
        f.write("// Generated by tools/build_data.py from tools/source/catalog/: per planner skill id, its box label in its own code\n")
        f.write("// (l: 'WG I.75', 'Xcel 7.104', 'UCG FX 12', 'Masters PB 12'), the Masters page (p) and other names coaches use (a).\n")
        f.write("export const INDEX = " + json.dumps(index, ensure_ascii=False, separators=(",", ":")) + ";\n")
    print(f"wrote js/data/skill-index.js: {len(index)}")
    write("masters-skills.js", "// Generated by tools/build_data.py from tools/source/catalog/: the UCG Masters MAG and WAG skill lists (not vaults).\n// eg (MAG): element group 1-4; mgroup (WAG): Masters condensed group 1-4. value: Masters letter (ME, A, ...).\n", "SKILLS", masters_rows)

if __name__ == "__main__":
    wag_same(wag())
    sapphire_vaults()
    masters_vaults(wag_vaults())
    tt()
    examples()
    catalog()
