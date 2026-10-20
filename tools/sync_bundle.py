"""Vendors the skill bundle from gym-skill-extract into tools/source/bundle/ and rebuilds js/data.

    npm run sync-skills            (= python tools/sync_bundle.py)
    python tools/sync_bundle.py --check   verify the vendored bundle against the lock, copy nothing

The bundle (gym-skill-extract `bundle/`, see its docs/ARCHITECTURE.md §4) holds the public skill
files, the cross-code catalog, levels.json, the rules digest JSON and the schemas, with a manifest
listing every file's sha256. This script:
  1. copies it byte for byte from GYM_SKILL_EXTRACT_DIR (default C:/dev/gym-skill-extract),
  2. checks the file set and every sha256 against the manifest, each file against its schema
     (all bundled schemas registered by $id, format checking on), the schema major, and the
     catalog versions,
  3. writes tools/source/bundle.lock.json (the manifest's sha256, its source commits, the catalog
     versions and the gym-skill-extract commit it was copied from),
  4. runs build_skills.py and build_data.py, which read only the vendored bundle,
  5. prints what changed in the skill files: added, removed, renamed and revalued records, and
     new redirects.
Before copying it refuses a bundle in which an ID this site ever shipped (tools/source/published-ids.json,
append-only) is neither an alias, a redirect nor retired by ucg-code-of-points: such an ID would stop
resolving in saved routines. After copying it adds the bundle's IDs to that file.
CI re-checks the vendored files against the lock (tools/check_bundle.mjs), so hand edits fail.
Needs: pip install jsonschema rfc3987
"""
import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "source")
DEST = os.path.join(SRC, "bundle")
LOCK = os.path.join(SRC, "bundle.lock.json")
EXTRACT = os.environ.get("GYM_SKILL_EXTRACT_DIR", r"C:\dev\gym-skill-extract")
SCHEMA_MAJOR = 0  # the bundle schema major this planner is built for


def sha256(path):
    with open(path, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def files_in(root):
    out = set()
    for d, _, names in os.walk(root):
        for n in names:
            out.add(os.path.relpath(os.path.join(d, n), root).replace(os.sep, "/"))
    return out


def verify(root, schemas=True):
    """Problems with the bundle at `root` (empty = good), and its manifest."""
    problems = []
    manifest = load(os.path.join(root, "manifest.json"))
    listed = set(manifest["files"])
    present = files_in(root) - {"manifest.json"}
    problems += [f"not in the manifest: {p}" for p in sorted(present - listed)]
    problems += [f"missing: {p}" for p in sorted(listed - present)]
    for p in sorted(listed & present):
        if sha256(os.path.join(root, p)) != manifest["files"][p]["sha256"]:
            problems.append(f"sha256 differs from the manifest: {p}")
    major = int(manifest["schema_version"].split(".")[0])
    if major != SCHEMA_MAJOR:
        problems.append(f"schema_version {manifest['schema_version']}: this planner reads major {SCHEMA_MAJOR}")
    for disc, version in manifest["catalogs"].items():
        for name in (f"catalog/catalog_{disc.lower()}_public.json", f"catalog/aliases_{disc.lower()}.json"):
            got = load(os.path.join(root, name)).get("version")
            if got != version:
                problems.append(f"{name}: version {got}, manifest says {version}")
    if schemas and not problems:
        problems += schema_problems(root, manifest)
    return problems, manifest


def schema_problems(root, manifest):
    from jsonschema import Draft202012Validator
    from referencing import Registry, Resource
    schemas = {p.split("/", 1)[1]: load(os.path.join(root, p)) for p in manifest["files"] if p.startswith("schema/")}
    registry = Registry().with_resources((s["$id"], Resource.from_contents(s)) for s in schemas.values())
    problems = []
    checks = [("manifest.json", "manifest.schema.json")] + [(p, f["schema"]) for p, f in sorted(manifest["files"].items()) if f.get("schema")]
    for path, name in checks:
        v = Draft202012Validator(schemas[name], registry=registry, format_checker=Draft202012Validator.FORMAT_CHECKER)
        for e in list(v.iter_errors(load(os.path.join(root, path))))[:5]:
            problems.append(f"{path} ({name}): {'/'.join(map(str, e.absolute_path)) or '(file)'}: {e.message[:160]}")
    return problems


def lock_for(root, manifest, copied_from):
    return {
        "_doc": "Written by tools/sync_bundle.py. The vendored tools/source/bundle/ must match: CI checks the manifest's sha256 here and every file's sha256 in the manifest (tools/check_bundle.mjs).",
        "manifest_sha256": sha256(os.path.join(root, "manifest.json")),
        "schema_version": manifest["schema_version"],
        "catalogs": manifest["catalogs"],
        "sources": manifest["sources"],
        "copied_from": copied_from,
    }


def check_lock(root):
    problems, manifest = verify(root)
    lock = load(LOCK)
    if sha256(os.path.join(root, "manifest.json")) != lock["manifest_sha256"]:
        problems.append("manifest.json differs from bundle.lock.json")
    for k in ("schema_version", "catalogs", "sources"):
        if manifest[k] != lock[k]:
            problems.append(f"bundle.lock.json {k} differs from the manifest")
    return problems + published_problems(root)


# ---- published IDs never stop resolving ----

PUBLISHED = os.path.join(SRC, "published-ids.json")


def resolvable(root):
    """Per discipline: the IDs a bundle resolves (alias keys), the retired ones (CoP skill files and Masters
    vaults; a retired ID is a deliberate decision and may show as "Custom") and the redirected ones."""
    out = {}
    manifest = load(os.path.join(root, "manifest.json"))
    retired, redirected = {"mag": set(), "wag": set()}, {"mag": set(), "wag": set()}
    for p, f in manifest["files"].items():
        if f.get("schema") == "skill.schema.json":
            d = load(os.path.join(root, p))
            disc = (d.get("discipline") or "").lower()
            if disc in retired:
                retired[disc] |= set(d.get("retired") or [])
                redirected[disc] |= set(d.get("redirects") or {})
    vaults = load(os.path.join(root, "skills", "ucg-masters-vaults.json"))
    for disc in ("mag", "wag"):
        retired[disc] |= set(vaults.get(disc, {}).get("retired") or [])
        aliases = load(os.path.join(root, "catalog", f"aliases_{disc}.json"))["aliases"]
        out[disc] = (set(aliases), retired[disc], redirected[disc])
    return out


def published_problems(root):
    """Published IDs that the bundle at `root` neither resolves, redirects nor retires (empty = fine)."""
    if not os.path.exists(PUBLISHED):
        return []
    published = load(PUBLISHED)
    problems = []
    for disc, (keys, retired, redirected) in resolvable(root).items():
        for i in published.get(disc, []):
            if i not in keys and i not in retired and i not in redirected:
                problems.append(f"published {disc.upper()} ID {i} is neither an alias, a redirect nor retired: it would stop "
                                f"resolving in saved routines (retire or redirect it in ucg-code-of-points first)")
    return problems


def record_published(root):
    """Append the bundle's IDs to published-ids.json (never removes one)."""
    published = load(PUBLISHED) if os.path.exists(PUBLISHED) else {"mag": [], "wag": []}
    added = 0
    for disc, (keys, _, _) in resolvable(root).items():
        before = set(published.get(disc, []))
        published[disc] = sorted(before | keys)
        added += len(keys - before)
    with open(PUBLISHED, "w", encoding="utf-8", newline="\n") as f:
        f.write(json.dumps(published, indent=1, ensure_ascii=False) + "\n")
    return added


# ---- what changed, for the summary ----

def record_key(code, r):
    return r.get("id") or f"{r['apparatus']}|{r['number']}|{r.get('variant', 1)}"


def skill_files(root):
    out = {}
    if not os.path.isdir(root):
        return out
    manifest = load(os.path.join(root, "manifest.json"))
    for p, f in manifest["files"].items():
        if f.get("schema") == "skill.schema.json":
            d = load(os.path.join(root, p))
            out[d["code"]] = {"records": {record_key(d["code"], r): r for r in d["records"]}, "redirects": d.get("redirects") or {}}
    return out


def other_data(root):
    """Masters vault rows (by id, or description for WG rows) and age bonus, and catalog merges."""
    out = {}
    if not os.path.isdir(root):
        return out
    v = load(os.path.join(root, "skills", "ucg-masters-vaults.json"))
    for disc in ("mag", "wag"):
        out[f"Masters {disc.upper()} vault age bonus"] = v[disc]["age_bonus"]
        for r in (r for g in v[disc]["groups"] for r in g):
            out[f"Masters {disc.upper()} vault {r.get('id') or r['description']}"] = [r["description"], r["wg_value"]]
    for disc in ("mag", "wag"):
        for old, to in (load(os.path.join(root, "catalog", f"aliases_{disc}.json")).get("merged") or {}).items():
            out[f"catalog {disc} merged {old}"] = to
    return out


def summary(old, new, old_other=None, new_other=None):
    lines = []
    a, b = old_other or {}, new_other or {}
    for k in sorted(a.keys() | b.keys()):
        if a.get(k) != b.get(k):
            lines.append(f"{k}: {a.get(k, '(none)')} -> {b.get(k, '(removed)')}")
    for code in sorted(old.keys() | new.keys()):
        a, b = old.get(code, {"records": {}, "redirects": {}}), new.get(code, {"records": {}, "redirects": {}})
        ra, rb = a["records"], b["records"]
        added = sorted(rb.keys() - ra.keys())
        removed = sorted(ra.keys() - rb.keys())
        renamed = [(k, ra[k]["description"], rb[k]["description"]) for k in sorted(ra.keys() & rb.keys()) if ra[k]["description"] != rb[k]["description"]]
        revalued = [(k, ra[k]["value"], rb[k]["value"]) for k in sorted(ra.keys() & rb.keys()) if ra[k]["value"] != rb[k]["value"]]
        newly_removed = [k for k in sorted(ra.keys() & rb.keys()) if rb[k].get("removed") and not ra[k].get("removed")]
        redirects = {k: v for k, v in b["redirects"].items() if a["redirects"].get(k) != v}
        if not (added or removed or renamed or revalued or newly_removed or redirects):
            continue
        lines.append(f"{code}:")
        lines += [f"  added    {k}: {rb[k]['description']} ({rb[k]['value']})" for k in added]
        lines += [f"  removed  {k}: {ra[k]['description']}" for k in removed]
        lines += [f"  marked removed {k}" for k in newly_removed]
        lines += [f"  renamed  {k}: {x!r} -> {y!r}" for k, x, y in renamed]
        lines += [f"  revalued {k}: {x} -> {y}" for k, x, y in revalued]
        lines += [f"  redirect {k} -> {v}" for k, v in redirects.items()]
    return lines or ["no record changes in the skill files, Masters vaults or catalog merges"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="verify the vendored bundle against the lock; copy nothing")
    ap.add_argument("--no-build", action="store_true", help="copy and verify only; don't run the builders")
    a = ap.parse_args()
    if a.check:
        problems = check_lock(DEST)
        print("\n".join(problems) if problems else "tools/source/bundle/ matches bundle.lock.json")
        sys.exit(1 if problems else 0)

    src = os.path.join(EXTRACT, "bundle")
    dirty = subprocess.run(["git", "-C", EXTRACT, "status", "--porcelain", "--", "bundle"], capture_output=True, text=True, check=True).stdout
    if dirty.strip():
        sys.exit(f"{src} has uncommitted changes: commit them in gym-skill-extract first\n{dirty}")
    head = subprocess.run(["git", "-C", EXTRACT, "rev-parse", "HEAD"], capture_output=True, text=True, check=True).stdout.strip()
    problems, manifest = verify(src)
    problems += published_problems(src)
    if problems:
        sys.exit("BUNDLE CHECK FAILED (nothing copied):\n  " + "\n  ".join(problems))
    old, old_other = skill_files(DEST), other_data(DEST)
    old_catalogs = load(LOCK)["catalogs"] if os.path.exists(LOCK) else None
    if os.path.isdir(DEST):
        shutil.rmtree(DEST)
    for p in sorted(manifest["files"]) + ["manifest.json"]:
        os.makedirs(os.path.dirname(os.path.join(DEST, p)), exist_ok=True)
        shutil.copyfile(os.path.join(src, p), os.path.join(DEST, p))  # bytes, never re-serialised
    problems, _ = verify(DEST, schemas=False)
    if problems:
        sys.exit("COPY CHECK FAILED:\n  " + "\n  ".join(problems))
    with open(LOCK, "w", encoding="utf-8", newline="\n") as f:
        f.write(json.dumps(lock_for(DEST, manifest, {"repo": "nssharpe/gym-skill-extract", "commit": head}), indent=1, ensure_ascii=False) + "\n")
    print(f"vendored {len(manifest['files']) + 1} files from {src} (gym-skill-extract {head[:7]}); wrote {os.path.relpath(LOCK)}")
    print(f"published IDs: {record_published(DEST)} new in {os.path.relpath(PUBLISHED)}")
    print(f"catalogs: {old_catalogs or '(first sync)'} -> {manifest['catalogs']}", flush=True)
    if not a.no_build:
        for script in ("build_skills.py", "build_data.py"):
            subprocess.run([sys.executable, os.path.join(HERE, script)], check=True)
    print("\n".join(["changes:"] + summary(old, skill_files(DEST), old_other, other_data(DEST)) if old else ["first sync: no earlier bundle to compare"]))


if __name__ == "__main__":
    main()
