"""B1 — full-chain golden E2E (PRE_DEPLOYMENT_PLAN §4; loop doc L5).

`golden/test_golden_cp1.py` freezes the CP-1 *builder* on captured facts;
nothing froze the whole chain: issuer → (EDGAR | uploaded disclosure) → CP-1
source precedence → 19-module DAG → CP-5B lineage → CP-5 gate → persisted run.
These tests run that chain through the real API surface (`TestClient`), fully
offline, for each golden issuer on both lanes:

- **keyless** — EDGAR lane (VSAT, FUN: `fetch_cp1` pinned to the captured
  fixture facts, everything after it real) and reported-disclosure lane
  (VMO2: fixture chunks vaulted through the real upload endpoint).
- **keyed** — LLM-synth lane (VSAT: a fake Anthropic seam returning the
  reference payloads per module), proving EDGAR still preempts the LLM for
  CP-1 and the DAG/gate behave identically under a live synthesizer.

Marked ``golden_e2e`` (registered in the repo-root ``pytest.ini``) so the
nightly workflow can select exactly this chain with ``-m golden_e2e``; the
tests also run in the normal per-PR collection — they are offline and fast.

When a frozen value below changes, confirm the new number/status is *correct*
(filing for figures, gate rubric for statuses) before updating — that is the
whole point of the alarm.
"""
from __future__ import annotations

import re
import json
import os
import sqlite3
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

import config
from engine import edgar_cp1

HERE = Path(__file__).resolve().parent

pytestmark = pytest.mark.golden_e2e

# Frozen CP-1 headline figures — kept in lockstep with the builder-level
# goldens in test_golden_cp1.py (same capture, same validation trail).
GOLDEN = {
    "VSAT": {
        "fixture": "vsat_facts.json",
        "entity": "Viasat, Inc.",
        "revenue_latest": ("FY2026", 4640.3),
        "net_debt_ltm": 4701.8,
        "net_leverage_adj_ltm": 3.21,
    },
    "FUN": {
        "fixture": "fun_facts.json",
        "entity": "Six Flags Entertainment Corporation",
        "revenue_latest": ("FY2025", 3100.3),
        "net_debt_ltm": 5090.0,
        "net_leverage_adj_ltm": 8.09,
    },
}


@pytest.fixture()
def e2e_client(monkeypatch):
    """Function-scoped TestClient on the shared conftest DB. Deliberately NOT
    named ``client`` so conftest's `_restore_issuer_baseline` cleans the
    issuers each test creates (shared process-global DB — the repo's #1 suite
    hazard). EDGAR is enabled for the fixture's lifetime; `fetch_cp1` is
    pinned to the captured golden facts (the only non-real seam in the
    keyless chain)."""
    monkeypatch.setenv("EDGAR_USER_AGENT", "caos-golden-e2e test@local")
    config.get_settings.cache_clear()

    def _fixture_fetch(ticker, entity_name):
        g = GOLDEN.get((ticker or "").upper())
        if g is None:
            return None
        facts = json.loads((HERE / g["fixture"]).read_text())
        payload = edgar_cp1.build_cp1_payload(g["entity"], facts)
        assert payload is not None, f"golden facts for {ticker} no longer build"
        return edgar_cp1.Cp1Build(
            payload=payload,
            facts_text=edgar_cp1.render_facts_text(g["entity"], payload),
            cik="0000000000",
        )

    monkeypatch.setattr(edgar_cp1, "fetch_cp1", _fixture_fetch)
    from main import app

    with TestClient(app) as c:
        yield c
    config.get_settings.cache_clear()


def _run_full_chain(c: TestClient, issuer: dict) -> tuple[dict, list[dict]]:
    """POST issuer → POST run → wait → return (run row, module details)."""
    from conftest import wait_for_run

    r = c.post("/api/issuers", json=issuer)
    assert r.status_code == 201, r.text
    issuer_id = r.json()["id"]
    r = c.post("/api/runs", json={"issuer_id": issuer_id})
    assert r.status_code == 201, r.text
    run = wait_for_run(c, r.json()["id"], timeout_s=60.0)
    assert run["status"] == "complete", run
    mods = c.get(f"/api/runs/{run['id']}/modules")
    assert mods.status_code == 200, mods.text
    return run, mods.json()


def _assert_cp1_matches_golden(mods: list[dict], g: dict) -> None:
    cp1 = next(m for m in mods if m["module_id"] == "CP-1")
    nf = cp1["runtime_output"]["normalized_financials"]
    period, revenue = g["revenue_latest"]
    assert nf["revenue"][period] == revenue
    assert nf["net_debt_ltm"] == g["net_debt_ltm"]
    assert nf["net_leverage_adj_ltm"] == g["net_leverage_adj_ltm"]


def _assert_provenance_resolves_run_wide(mods: list[dict]) -> None:
    """B2 companion assertion at the run level: every claim across every
    produced module resolves claim → evidence → an existing vaulted chunk.
    (The full run-wide sweep incl. lineage classes is B2's own item; this
    holds the no-dangling-citation floor for the golden chain.)"""
    db_path = (os.environ.get("DATABASE_URL") or "").replace("sqlite+aiosqlite:///", "")
    con = sqlite3.connect(db_path, timeout=30)
    try:
        chunk_ids = {r[0] for r in con.execute("SELECT id FROM document_chunks")}
    finally:
        con.close()
    checked = 0
    for m in mods:
        for claim in m.get("claims") or []:
            for ev in claim.get("evidence") or []:
                rid = ev.get("document_chunk_id")
                if rid is not None:
                    assert rid in chunk_ids, (
                        f"{m['module_id']} claim {claim.get('claim_id')}: evidence "
                        f"{ev.get('evidence_id')} cites nonexistent chunk {rid}"
                    )
                    checked += 1
    assert checked > 0, "no resolved evidence anywhere in the run — chain not grounded"


def _text_pdf(text: str) -> bytes:
    """Minimal valid single-page PDF carrying ``text`` as WinAnsi Helvetica
    lines — the document upload endpoint is PDF-only by design (sniff_pdf),
    so the reported-lane fixture chunks travel the REAL ingestion path
    (sniff -> extract -> chunk) instead of bypassing it."""
    def esc(line: str) -> bytes:
        out = bytearray()
        for ch in line:
            if ch in "()\\":
                out += b"\\" + ch.encode()
            else:
                try:
                    b = ch.encode("cp1252")
                    out += b if 32 <= b[0] < 127 else ("\\%03o" % b[0]).encode()
                except UnicodeEncodeError:
                    out += b"?"
        return bytes(out)

    lines = [l for l in text.splitlines() if l.strip()] or [" "]
    content = b"BT /F1 10 Tf 12 TL 40 780 Td\n"
    for l in lines:
        content += b"(" + esc(l) + b") Tj T*\n"
    content += b"ET"
    objs = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        b"/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
        b"<< /Length " + str(len(content)).encode() + b" >>\nstream\n" + content + b"\nendstream",
    ]
    pdf = b"%PDF-1.4\n"
    offsets = []
    for i, o in enumerate(objs, 1):
        offsets.append(len(pdf))
        pdf += f"{i} 0 obj\n".encode() + o + b"\nendobj\n"
    xref_at = len(pdf)
    pdf += b"xref\n0 " + str(len(objs) + 1).encode() + b"\n0000000000 65535 f \n"
    for off in offsets:
        pdf += ("%010d 00000 n \n" % off).encode()
    pdf += (b"trailer\n<< /Size " + str(len(objs) + 1).encode()
            + b" /Root 1 0 R >>\nstartxref\n" + str(xref_at).encode() + b"\n%%EOF")
    return pdf


def _cleanup_run(run_id: str) -> None:
    """Delete the run's rows (runs/module_outputs/qa) — conftest cleans the
    issuer but not runs, and dangling run rows would skew later unscoped
    count/rollup assertions in the shared DB."""
    db_path = (os.environ.get("DATABASE_URL") or "").replace("sqlite+aiosqlite:///", "")
    con = sqlite3.connect(db_path, timeout=30)
    try:
        for table, col in (
            ("qa_findings", "run_id"), ("module_outputs", "run_id"),
            ("metric_facts", "run_id"), ("runs", "id"),
        ):
            try:
                con.execute(f"DELETE FROM {table} WHERE {col} = ?", (run_id,))
            except sqlite3.OperationalError:
                pass
        con.commit()
    finally:
        con.close()


@pytest.mark.parametrize("ticker", sorted(GOLDEN))
def test_golden_e2e_keyless_edgar_lane(e2e_client, ticker):
    """Keyless full chain for a US filer: EDGAR-grounded CP-1 (exact frozen
    figures), all 19 modules produced, provenance resolves run-wide."""
    g = GOLDEN[ticker]
    run, mods = _run_full_chain(e2e_client, {"name": g["entity"], "ticker": ticker})
    try:
        produced = {m["module_id"] for m in mods}
        assert "CP-1" in produced and len(produced) >= 19, sorted(produced)
        _assert_cp1_matches_golden(mods, g)
        _assert_provenance_resolves_run_wide(mods)
        # Frozen gate state: the EDGAR-grounded chain passes QA, but the
        # committee roll-up stays "Insufficient Information" — offline, the
        # non-CP-1 modules run their deterministic/degraded paths against an
        # empty document base, and worst-confidence gates the committee
        # verdict. A change here means the trust surface moved — verify
        # against the CP-5 rubric before re-freezing.
        assert run["qa_status"] == "Passed", run
        assert run["committee_status"] == "Insufficient Information", run
        cp1 = next(m for m in mods if m["module_id"] == "CP-1")
        assert cp1["qa_status"] == "Passed"
    finally:
        _cleanup_run(run["id"])


def test_golden_e2e_keyless_reported_lane_vmo2(e2e_client):
    """Keyless full chain for a non-EDGAR issuer: the captured VMO2 disclosure
    chunks go through the real upload endpoint; CP-1 grounds in the
    reported-disclosure extractor (frozen 4.38x)."""
    fixture = json.loads((HERE / "vmo2_reported_chunks.json").read_text())
    r = e2e_client.post("/api/issuers", json={"name": fixture["entity"]})
    assert r.status_code == 201, r.text
    issuer_id = r.json()["id"]

    for i, chunk in enumerate(fixture["chunks"]):
        up = e2e_client.post(
            "/api/ingestion/upload/document",
            data={"issuer_id": issuer_id, "run_mode": "earnings"},
            files={"file": (f"vmo2-disclosure-{i}.pdf", _text_pdf(chunk["text"]), "application/pdf")},
        )
        assert up.status_code == 200, up.text
        assert up.json()["chunks_created"] > 0, up.text

    from conftest import wait_for_run

    r = e2e_client.post("/api/runs", json={"issuer_id": issuer_id})
    assert r.status_code == 201, r.text
    run = wait_for_run(e2e_client, r.json()["id"], timeout_s=60.0)
    try:
        assert run["status"] == "complete", run
        mods = e2e_client.get(f"/api/runs/{run['id']}/modules").json()
        cp1 = next(m for m in mods if m["module_id"] == "CP-1")
        rt = cp1["runtime_output"]
        assert rt["basis"] == "reported_disclosure"
        assert rt["normalized_financials"]["net_leverage_adj_ltm"] == 4.38
        _assert_provenance_resolves_run_wide(mods)
    finally:
        _cleanup_run(run["id"])


def test_golden_e2e_keyed_llm_lane_vsat(e2e_client, monkeypatch):
    """Keyed full chain: a fake Anthropic seam (module id parsed from the
    call's lane tag) returns the reference payloads, so the LIVE synthesizer
    path — forced-tool call, extraction, validation — runs for the 18
    non-CP-1 modules while EDGAR precedence still grounds CP-1 in the frozen
    golden facts. Chain must complete and stay provenance-clean."""
    from engine import llm_client

    class _Usage:
        input_tokens, output_tokens = 10, 20

    class _Block:
        def __init__(self, data):
            self.type, self.id, self.name, self.input = "tool_use", "t1", "emit_module_payload", data

    class _Resp:
        def __init__(self, data):
            self.content, self.stop_reason, self.usage = [_Block(data)], "tool_use", _Usage()

    calls: list[str] = []

    async def _fake_create(client_obj, *, lane, **kwargs):
        module_id = lane.split(":", 1)[1] if ":" in lane else lane
        calls.append(module_id)
        # Cite a REAL vaulted chunk: the synthesizer's grounding block embeds
        # "[chunk <id>]" headers for the retrieval hits (for VSAT that includes
        # the EDGAR-vaulted facts chunk), so the fake behaves like a grounded
        # model — its claim must survive CP-5B lineage resolution, not bypass it.
        m = re.search(r"\[chunk ([\w-]+)\]", json.dumps(kwargs.get("messages", []), default=str))
        locator = f"chunk {m.group(1)}" if m else "no source"
        return _Resp({
            "module_name": f"{module_id} (keyed golden-e2e synthetic)",
            "owned_object": "keyed_lane_synthetic",
            "runtime_output": {"synthetic": True, "module": module_id},
            "confidence": "Medium",
            "limitation_flags": [],
            "downstream_consumers": [],
            "claims": [{
                "claim_id": "C1",
                "claim_text": "Synthetic keyed-lane claim grounded in the vaulted source.",
                "evidence": [{
                    "evidence_id": "E1",
                    "extraction_type": "sourced_fact",
                    "lineage_class": "Directly Sourced",
                    "source_locator": locator,
                    "confidence": "High",
                }],
            }],
        })

    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key-golden-e2e")
    # Live synthesis is egress-gated (MNPI opt-in) — a key alone no longer
    # selects the live lane; the keyed golden must opt in explicitly.
    monkeypatch.setenv("CAOS_DOCUMENT_EGRESS_ENABLED", "true")
    config.get_settings.cache_clear()
    monkeypatch.setattr(llm_client, "create", _fake_create)

    g = GOLDEN["VSAT"]
    run, mods = _run_full_chain(e2e_client, {"name": g["entity"], "ticker": "VSAT"})
    try:
        _assert_cp1_matches_golden(mods, g)  # EDGAR preempts the LLM for CP-1
        assert "CP-1" not in calls, "CP-1 must come from EDGAR precedence, not the LLM"
        assert calls, "keyed lane never reached the LLM seam"
        _assert_provenance_resolves_run_wide(mods)
        # Frozen: CP-2 is the ONLY module the offline-keyed DAG sends to the
        # LLM seam (the rest are deterministic engine modules). A new module
        # appearing here means the LLM trust surface widened — re-review
        # llm-safety invariants before re-freezing.
        assert set(calls) == {"CP-2"}, calls
        assert run["qa_status"] == "Passed", run
        assert run["committee_status"] == "Insufficient Information", run
        # Gate honesty on the synthetic citation: offline retrieval is empty,
        # so the fake's claim cites "no source" — CP-5B must surface that as
        # the unresolved-citation MINOR finding, never silently resolve it.
        qa = e2e_client.get(f"/api/runs/{run['id']}/qa")
        assert qa.status_code == 200, qa.text
        assert any(
            f["module_id"] == "CP-2" and f["severity"] == "MINOR"
            and "could not be resolved" in f["description"]
            for f in qa.json()["findings"]
        ), qa.json()["findings"]
    finally:
        _cleanup_run(run["id"])
        config.get_settings.cache_clear()
