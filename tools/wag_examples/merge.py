"""Replace the WAG routines in tools/source/examples.json with a freshly built set."""
import json
import sys

src = "tools/source/examples.json"
rows = [x for x in json.load(open(src, encoding="utf-8")) if not x["id"].startswith("wag-")]
rows += json.load(open(sys.argv[1], encoding="utf-8"))
open(src, "w", encoding="utf-8", newline="\n").write(json.dumps(rows, ensure_ascii=False, indent=1) + "\n")
print(len(rows), "examples")
