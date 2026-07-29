"""B5 — breadth-corpus clean-run net (PRE_DEPLOYMENT_PLAN §B5; loop doc L6).

The sealed goldens (../golden/) assert exact numbers for 3 hand-verified
issuers; this corpus asserts *properties* across the captured cohort with no
numeric oracle: the full 19-module DAG completes through the real API, the
CP-5 gate emits an honest status, every citation resolves, no NaN/inf leaks
out of CP-1, any computed DM is plausible, and nothing in the run is a
mock-provenance number.

Marked ``corpus_run`` (pytest.ini). The 6-issuer smoke subset runs in the
per-PR server job; the full captured set runs when ``CORPUS_FULL=1``
(nightly). VMO2's reported-lane chain is asserted by the golden E2E suite —
the corpus does not duplicate it; the four private reported-lane names await
owner-sourced documents (MANIFEST.md).
"""
from __future__ import annotations

import json
import math
import os
import sqlite3
from pathlib import Path

import pytest

import config
from engine import edgar_cp1
from engine.periods import is_finite_number

HERE = Path(__file__).resolve().parent
FIXTURES = HERE / "fixtures"

pytestmark = pytest.mark.corpus_run

# ticker -> entity display name, from the capture manifest table.
from _capture import ISSUERS as _CAPTURE_ROWS  # noqa: E402

ENTITY = {t: name for t, name, _cik in _CAPTURE_ROWS}

# Per-PR smoke subset (manifest §loops: one per sector; VMO2 rides the golden
# reported-lane test).
SMOKE = {"SSNC", "THC", "CHTR", "TDG", "CZR"}

_captured = sorted(p.stem.removesuffix("_facts").upper() for p in FIXTURES.glob("*_facts.json"))
_full = os.environ.get("CORPUS_FULL") == "1"
PARAMS = [
    pytest.param(t, marks=() if (_full or t in SMOKE) else
                 pytest.mark.skip(reason="full corpus runs with CORPUS_FULL=1 (nightly)"))
    for t in _captured
]


def test_manifest_scope_matches_captured_fixtures():
    """MANIFEST core-33 EDGAR scope == committed fixtures (B5 exit criterion).
    Reported-lane names are excluded by design: VMO2 lives in the golden set;
    the four private issuers are owner-doc-pending (recorded in MANIFEST)."""
    manifest_edgar = {t for t, _n, _c in _CAPTURE_ROWS}
    assert set(_captured) == manifest_edgar, (
        f"fixtures {set(_captured) ^ manifest_edgar} out of step with the manifest"
    )


@pytest.fixture()
def corpus_client(monkeypatch):
    """Golden-e2e pattern: real TestClient, EDGAR fetch pinned to the captured
    fixture; everything downstream of fetch_cp1 is the real chain."""
    monkeypatch.setenv("EDGAR_USER_AGENT", "caos-corpus-run test@local")
    config.get_settings.cache_clear()

    def _fixture_fetch(ticker, entity_name):
        t = (ticker or "").upper()
        path = FIXTURES / f"{t.lower()}_facts.json"
        if not path.exists():
            return None
        facts = json.loads(path.read_text())
        payload = edgar_cp1.build_cp1_payload(ENTITY.get(t, entity_name), facts)
        if payload is None:
            return None
        return edgar_cp1.Cp1Build(
            payload=payload,
            facts_text=edgar_cp1.render_facts_text(ENTITY.get(t, entity_name), payload),
            cik="0000000000",
        )

    monkeypatch.setattr(edgar_cp1, "fetch_cp1", _fixture_fetch)
    from main import app
    from fastapi.testclient import TestClient

    with TestClient(app) as c:
        yield c
    config.get_settings.cache_clear()


def _walk_numbers(node, path=""):
    if isinstance(node, dict):
        for k, v in node.items():
            yield from _walk_numbers(v, f"{path}.{k}")
    elif isinstance(node, (list, tuple)):
        for i, v in enumerate(node):
            yield from _walk_numbers(v, f"{path}[{i}]")
    elif isinstance(node, float):
        yield path, node


@pytest.mark.parametrize("ticker", PARAMS)
def test_corpus_issuer_clean_run(corpus_client, ticker):
    from conftest import wait_for_run

    c = corpus_client
    r = c.post("/api/issuers", json={
        "name": f"{ENTITY[ticker]}", "ticker": ticker, "sector": "Corpus",
    })
    assert r.status_code == 201, r.text
    issuer_id = r.json()["id"]

    r = c.post("/api/runs", json={"issuer_id": issuer_id})
    assert r.status_code == 201, r.text
    run = wait_for_run(c, r.json()["id"], timeout_s=90.0)

    # 1. The DAG completed — no unhandled exception anywhere in the chain.
    assert run["status"] == "complete", run

    mods_r = c.get(f"/api/runs/{run['id']}/modules")
    assert mods_r.status_code == 200, mods_r.text
    mods = mods_r.json()
    assert mods, "run produced no modules"

    # 2. CP-5 emitted an honest gate status (engine/gate.py vocabulary), with
    # the severity roll-up present — a fired gate, not a rubber stamp.
    qa = c.get(f"/api/runs/{run['id']}/qa")
    assert qa.status_code == 200, qa.text
    gate = qa.json()
    assert gate.get("qa_status") in {"Passed", "Restricted", "Blocked"}, gate
    assert "findings_by_severity" in gate, gate

    # 3. Both data lanes ran inside the run: the EDGAR-sourced CP-1 plus
    # synth-lane modules producing output (demo-deterministic when keyless).
    by_id = {m["module_id"]: m for m in mods}
    assert "CP-1" in by_id, sorted(by_id)
    synth_outputs = [m for mid, m in by_id.items()
                     if mid != "CP-1" and m.get("runtime_output")]
    assert synth_outputs, "no downstream module produced output"

    # 4. No NaN/inf leaked into CP-1's numerics (the is_finite_number contract).
    nf = by_id["CP-1"]["runtime_output"].get("normalized_financials") or {}
    for path, value in _walk_numbers(nf):
        assert is_finite_number(value) or value is None, (
            f"{ticker} CP-1{path} leaked non-finite {value!r}"
        )
        assert not (isinstance(value, float) and math.isnan(value)), path

    # 5. Any computed DM lands in a plausible band (PR #95 guard's range).
    for m in mods:
        for path, value in _walk_numbers(m.get("runtime_output") or {}):
            if path.rsplit(".", 1)[-1] in {"dm", "dm_bps", "discount_margin"}:
                assert 0 < value < 5000, f"{ticker} {m['module_id']}{path}={value}"

    # 6. Nothing in the run carries mock provenance.
    blob = json.dumps(mods)
    assert '"prov": "mock"' not in blob and '"provenance": "mock"' not in blob

    # 7. Every claim's evidence chain resolves to a vaulted chunk
    # (golden-e2e's run-wide floor, applied breadth-wide).
    db_path = (os.environ.get("DATABASE_URL") or "").replace("sqlite+aiosqlite:///", "")
    if db_path and not db_path.startswith("postgresql"):
        con = sqlite3.connect(db_path, timeout=30)
        try:
            chunk_ids = {row[0] for row in con.execute("SELECT id FROM document_chunks")}
        finally:
            con.close()
        for m in mods:
            for claim in m.get("claims") or []:
                for ev in claim.get("evidence") or []:
                    rid = ev.get("document_chunk_id")
                    if rid is not None:
                        assert rid in chunk_ids, (
                            f"{ticker} {m['module_id']} cites nonexistent chunk {rid}"
                        )
