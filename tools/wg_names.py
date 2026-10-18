"""Own-words names for World Gymnastics skills and vaults (tools/source/wg_names.json).

The planner never shows the WG Code's descriptions: every WG record is named with the short
name written for it in gym-skill-extract (simplified_names.json in the WG WAG / WG MAG
extractions, copied here), except the short standard names listed in keep_code, which keep
the Code's own name. Used by build_data.py (WAG) and build_skills.py (MAG).
"""
import json
import os

_DATA = json.load(open(os.path.join(os.path.dirname(__file__), "source", "wg_names.json"), encoding="utf-8"))


def name_key(s):
    """Same key as gym-skill-extract's cop_common/simplified.py: "UB|1.101|1"; a WG MAG
    number restarts in each element group, so it gets the group: "FX|72|1|II"."""
    key = f"{s['apparatus']}|{s['number']}|{s.get('variant', 1)}"
    group = str(s.get("element_group") or "")
    if "." in str(s["number"]) and group and group != str(s["number"]).split(".")[0]:
        key += f"|{group}"
    elif str(s["number"]).isdigit() and group:
        key += f"|{group}"
    return key


def wg_name(disc, s):
    """The planner's name for WG record s ("wag" or "mag")."""
    key = name_key(s)
    if key in _DATA["keep_code"][disc]:
        return " ".join(s["description"].split()).rstrip(".")
    name = _DATA[disc].get(key)
    assert name, f"no own-words name for WG {disc.upper()} {key} in tools/source/wg_names.json"
    return name

