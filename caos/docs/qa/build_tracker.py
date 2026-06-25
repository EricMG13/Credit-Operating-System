#!/usr/bin/env python3
"""Parse FEATURE_ROWS_*.txt blocks into one canonical CSV tracker.

ponytail: stdlib csv + glob; the raw .txt blocks are the source of truth,
this just emits the spreadsheet. Re-run after editing any FEATURE_ROWS_*.txt.
"""
import csv
import glob
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
FIELDS = ["id", "concept", "feature", "story", "expected", "trigger", "files", "endpoint"]
# Tracking columns filled during the test/fix phases:
TRACK = ["status", "test_result", "severity", "notes"]


def parse_block(block):
    row = {}
    for line in block.splitlines():
        m = re.match(r"^(id|concept|feature|story|expected|trigger|files|endpoint):\s?(.*)$", line)
        if m:
            row[m.group(1)] = m.group(2).strip()
    return row if "id" in row else None


def main():
    rows = []
    for path in sorted(glob.glob(os.path.join(HERE, "FEATURE_ROWS_*.txt"))):
        text = open(path, encoding="utf-8").read()
        for raw in re.split(r"^=ROW=\s*$", text, flags=re.M):
            raw = raw.replace("=END=", "").strip()
            if not raw:
                continue
            r = parse_block(raw)
            if r:
                rows.append(r)

    # stable order: by concept (declaration order), then numeric id suffix
    concept_order = []
    for r in rows:
        if r["concept"] not in concept_order:
            concept_order.append(r["concept"])

    def keyfn(r):
        num = re.search(r"-(\d+)$", r["id"])
        return (concept_order.index(r["concept"]), int(num.group(1)) if num else 0)

    rows.sort(key=keyfn)

    # default tracking columns (status=Documented from code, untested)
    for r in rows:
        r.setdefault("status", "Documented")
        r.setdefault("test_result", "")
        r.setdefault("severity", "")
        r.setdefault("notes", "")

    out = os.path.join(HERE, "FEATURE_TRACKER.csv")
    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS + TRACK)
        w.writeheader()
        w.writerows(rows)

    # quick per-concept tally for the console
    from collections import Counter
    tally = Counter(r["concept"] for r in rows)
    print(f"wrote {out}: {len(rows)} stories")
    for c in concept_order:
        print(f"  {c}: {tally[c]}")
    # assert ids unique (catch copy-paste dupes)
    ids = [r["id"] for r in rows]
    dupes = [i for i in ids if ids.count(i) > 1]
    assert not dupes, f"duplicate ids: {sorted(set(dupes))}"


if __name__ == "__main__":
    main()
