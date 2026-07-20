#!/usr/bin/env python3
"""Compute per-entity baselines for the threat-detection anomaly feed.

The bridge between the running stack's logs and the skill's analyzer
(`threat_signal_analyzer.py --mode anomaly`), which scores events against a
*single* `--baseline-mean/--baseline-std`. Real hunting needs one baseline per
entity, and computing mean/std is the one step neither the analyzer nor a clean
jq gives you. This reads access-log lines, groups by entity (or action/source),
and prints each group's baseline plus the exact analyzer command to run.

Usage:
    docker compose logs app | python3 feed_baseline.py            # entity baselines
    python3 feed_baseline.py --group source access.log            # brute-force view
    python3 feed_baseline.py --json --events-out events.json *.log

Accepts raw `INFO:caos.access:{...}` lines or bare JSON, one per line; anything
unparseable is skipped. stdlib only — no install on the deploy host.

NOTE: a statistically valid baseline needs ≥14 days of telemetry (skill
anti-pattern #3). Groups below --min-samples are flagged `THIN` and must not be
used for alerting until the window fills.
"""

from __future__ import annotations

import argparse
from contextlib import ExitStack
import json
import re
import shlex
import statistics
import sys
from typing import Iterable, Optional

# 14 days of even light traffic clears this comfortably; below it, a baseline is
# noise. A sample-count proxy for the time-window requirement, not a substitute —
# the operator still confirms the log range spans ≥14 days.
DEFAULT_MIN_SAMPLES = 30

_EVENT_KEYS = ("timestamp", "entity", "action", "volume")


def parse_line(line: str) -> Optional[dict]:
    """Extract one analyzer event from a log line, or None if it isn't one.

    Tolerates the logging prefix (`INFO:caos.access:`) by slicing from the first
    brace; requires the analyzer's four fields to be present.
    """
    brace = line.find("{")
    if brace == -1:
        return None
    try:
        rec = json.loads(line[brace:])
    except (ValueError, TypeError):
        return None
    if not isinstance(rec, dict) or not all(k in rec for k in _EVENT_KEYS):
        return None
    return {k: rec[k] for k in _EVENT_KEYS}


def baselines(events: Iterable[dict], key: str) -> dict[str, dict]:
    """Group events by `key` and return {group: {n, mean, std}} over `volume`.

    Sample stdev (n-1) is the convention for z-scoring; a single-sample group has
    no spread, so std is 0.0 (and will be flagged thin regardless).
    """
    buckets: dict[str, list[float]] = {}
    for ev in events:
        buckets.setdefault(str(ev.get(key, "?")), []).append(float(ev["volume"]))
    out: dict[str, dict] = {}
    for group, vols in buckets.items():
        out[group] = {
            "n": len(vols),
            "mean": round(statistics.fmean(vols), 2),
            "std": round(statistics.stdev(vols), 2) if len(vols) > 1 else 0.0,
        }
    return out


def _analyzer_cmd(group: str, key: str, b: dict) -> str:
    # `group` is an access-log entity/source — i.e. an X-Forwarded-* header value,
    # attacker-influenced. This command is printed for an operator to paste into a
    # privileged shell, so the value must never become shell/jq *code*: pass it as
    # jq data (--arg, shell-quoted) and use a sanitized slug for the filename.
    # `key` is an argparse choice (entity|action|source) and the baselines are
    # floats from statistics, so those stay inline. ponytail: slug + shlex.quote,
    # no templating engine.
    val = shlex.quote(group)
    slug = re.sub(r"[^\w.@-]", "_", group) or "group"
    return (
        f"jq -c --arg v {val} 'map(select(.{key}==$v))' events.json > {slug}.json && "
        f"python3 scripts/threat_signal_analyzer.py --mode anomaly "
        f"--events-file {slug}.json --baseline-mean {b['mean']} "
        f"--baseline-std {b['std']} --json"
    )


def main(argv: Optional[list[str]] = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("files", nargs="*", help="log files; stdin if omitted")
    ap.add_argument("--group", choices=("entity", "action", "source"), default="entity")
    ap.add_argument("--min-samples", type=int, default=DEFAULT_MIN_SAMPLES)
    ap.add_argument("--events-out", help="write extracted events.json for the analyzer")
    ap.add_argument("--json", action="store_true", help="machine-readable output")
    args = ap.parse_args(argv)

    with ExitStack() as stack:
        streams = (
            [stack.enter_context(open(f, encoding="utf-8")) for f in args.files]
            if args.files
            else [sys.stdin]
        )
        events = [ev for s in streams for line in s if (ev := parse_line(line))]

    if args.events_out:
        with open(args.events_out, "w", encoding="utf-8") as fh:
            json.dump(events, fh)

    bl = baselines(events, args.group)
    thin = {g: b for g, b in bl.items() if b["n"] < args.min_samples}

    if args.json:
        json.dump({"group_by": args.group, "events": len(events), "baselines": bl,
                   "thin": sorted(thin)}, sys.stdout, indent=2)
        sys.stdout.write("\n")
    else:
        print(f"# {len(events)} events, grouped by {args.group}\n")
        for g, b in sorted(bl.items(), key=lambda kv: -kv[1]["n"]):
            flag = "  THIN — need ≥%d" % args.min_samples if g in thin else ""
            print(f"{g}: n={b['n']} mean={b['mean']} std={b['std']}{flag}")
            print("  " + _analyzer_cmd(g, args.group, b))
        if thin:
            print(f"\n# {len(thin)} group(s) below --min-samples; do not alert until the "
                  "log window spans ≥14 days.", file=sys.stderr)
    # Exit 1 if every group is thin — nothing trustworthy to baseline yet.
    return 1 if bl and len(thin) == len(bl) else 0


if __name__ == "__main__":
    raise SystemExit(main())
