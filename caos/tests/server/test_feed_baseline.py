"""Tests for the threat-feed baseline bridge (scripts/feed_baseline.py): log
parsing tolerance and the per-entity mean/std the analyzer consumes."""

from __future__ import annotations

import json
import shlex
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))

from feed_baseline import _analyzer_cmd, baselines, main, parse_line  # noqa: E402


def test_parse_line_tolerates_log_prefix_and_rejects_non_events():
    ev = parse_line('INFO:caos.access:{"timestamp":"2026-06-21T00:00:00Z",'
                    '"entity":"a@b.co","action":"GET /api/x","volume":100,"status":200}')
    assert ev == {"timestamp": "2026-06-21T00:00:00Z", "entity": "a@b.co",
                  "action": "GET /api/x", "volume": 100}  # trims to analyzer schema
    assert parse_line("not json at all") is None
    assert parse_line('{"entity":"x"}') is None  # missing required keys → skipped
    assert parse_line('INFO:caos:some other logger line') is None


def _ev(entity, volume):
    return {"timestamp": "t", "entity": entity, "action": "GET /api/x", "volume": volume}


def test_baselines_group_by_entity_with_sample_stdev():
    events = [_ev("a", 10), _ev("a", 20), _ev("a", 30), _ev("b", 100)]
    bl = baselines(events, "entity")
    assert bl["a"]["n"] == 3 and bl["a"]["mean"] == 20.0
    assert bl["a"]["std"] == 10.0  # sample stdev of 10,20,30
    assert bl["b"] == {"n": 1, "mean": 100.0, "std": 0.0}  # single sample → no spread


def test_baseline_mean_std_flag_a_real_outlier():
    # A bulk-pull / exfil row sits far outside the entity's baseline.
    normal = [_ev("a", v) for v in (100, 110, 90, 105, 95)]
    bl = baselines(normal, "entity")["a"]
    spike = 5000
    z = (spike - bl["mean"]) / bl["std"]
    assert z >= 3.0  # analyzer would escalate this as a hard anomaly


def test_main_reads_file_flags_thin_and_writes_events(tmp_path, capsys):
    log = tmp_path / "access.log"
    log.write_text(
        "\n".join(
            "INFO:caos.access:" + json.dumps(
                {"timestamp": "t", "entity": "a@b.co", "action": "GET /api/x", "volume": v}
            )
            for v in (100, 110, 90)
        )
        + "\nnot a log line\n",  # unparseable rows are skipped, not fatal
        encoding="utf-8",
    )
    events_out = tmp_path / "events.json"

    code = main([str(log), "--events-out", str(events_out)])

    out = capsys.readouterr().out
    assert "a@b.co: n=3 mean=100.0" in out
    assert "threat_signal_analyzer.py --mode anomaly" in out  # prints the runnable cmd
    assert code == 1  # 3 < default --min-samples=30 → every group thin → exit 1
    # --events-out holds the analyzer-schema events (the noise line dropped)
    assert json.loads(events_out.read_text()) == [
        {"timestamp": "t", "entity": "a@b.co", "action": "GET /api/x", "volume": v}
        for v in (100, 110, 90)
    ]


def test_analyzer_cmd_neutralizes_injection_in_entity():
    # `entity` comes from a forgeable X-Forwarded-* header; the printed command
    # must not let it become shell/jq code when an operator pastes it.
    evil = "'; rm -rf ~; echo '"
    cmd = _analyzer_cmd(evil, "entity", {"mean": 1.0, "std": 2.0})
    # match value travels as shell-quoted jq data, never raw program text
    assert shlex.quote(evil) in cmd
    assert "rm -rf ~; echo" not in cmd.replace(shlex.quote(evil), "")
    # output filename is a metacharacter-free slug (no breakout, no path traversal)
    fname = cmd.split(" > ", 1)[1].split(" ", 1)[0]
    assert fname.endswith(".json")
    assert not (set(fname) & set("'\";|&$ ()/~"))
