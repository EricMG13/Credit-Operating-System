"""Issuer Research Report — synthesis service + endpoint tests.

Covers the pure functions (digest builder, figure validator, path resolver,
markdown renderer) and the three HTTP endpoints (POST create, GET latest,
GET by id poll).
"""

from __future__ import annotations

import os
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from conftest import wait_for_run

SERVER_DIR = Path(__file__).resolve().parents[2] / "server"
sys.path.insert(0, str(SERVER_DIR))


# ── Pure-function tests (no DB, no LLM) ──────────────────────────────────────


class FakeModuleOutput:
    """Minimal stand-in for the ModuleOutput ORM model."""
    def __init__(self, module_id, module_name="", runtime_output=None,
                 confidence="Medium", qa_status="Passed",
                 committee_status="Committee Ready",
                 limitation_flags=None, downstream_consumers=None):
        self.module_id = module_id
        self.module_name = module_name or module_id
        self.runtime_output = runtime_output or {}
        self.confidence = confidence
        self.qa_status = qa_status
        self.committee_status = committee_status
        self.limitation_flags = limitation_flags or []
        self.downstream_consumers = downstream_consumers or []


class TestResolvePath:
    def test_simple_key(self):
        from research_report import _resolve_path
        assert _resolve_path({"a": 1}, "a") == 1

    def test_nested_key(self):
        from research_report import _resolve_path
        assert _resolve_path({"a": {"b": 2}}, "a.b") == 2

    def test_missing_key_returns_none(self):
        from research_report import _resolve_path
        assert _resolve_path({"a": 1}, "b") is None

    def test_missing_intermediate_returns_none(self):
        from research_report import _resolve_path
        assert _resolve_path({"a": 1}, "a.b.c") is None

    def test_non_dict_intermediate_returns_none(self):
        from research_report import _resolve_path
        assert _resolve_path({"a": 1}, "a.b") is None

    def test_empty_path_returns_none(self):
        from research_report import _resolve_path
        assert _resolve_path({"a": 1}, "") is None

    def test_none_obj_returns_none(self):
        from research_report import _resolve_path
        assert _resolve_path(None, "a") is None


class TestExtractOverallView:
    def test_canonical_key_found(self):
        from research_report import _extract_overall_view
        ro = {"overall_liquidity_view": "Liquidity is adequate with 18mo runway."}
        assert "18mo" in _extract_overall_view(ro, "CP-2E")

    def test_fallback_to_overall_view(self):
        from research_report import _extract_overall_view
        ro = {"overall_view": "General summary text."}
        assert "General" in _extract_overall_view(ro, "CP-2E")

    def test_nested_dict_narrative(self):
        from research_report import _extract_overall_view
        ro = {"overall_view": {"narrative": "Nested narrative text."}}
        assert "Nested" in _extract_overall_view(ro, "CP-2E")

    def test_empty_when_nothing_found(self):
        from research_report import _extract_overall_view
        assert _extract_overall_view({}, "CP-2E") == ""

    def test_whitespace_only_treated_as_empty(self):
        from research_report import _extract_overall_view
        assert _extract_overall_view({"overall_view": "   "}, "CP-2E") == ""


class TestBuildModuleDigest:
    def test_empty_mods_returns_empty_list(self):
        from research_report import build_module_digest
        assert build_module_digest({}) == []

    def test_single_module_with_figures(self):
        from research_report import build_module_digest
        mods = {
            "CP-1": FakeModuleOutput(
                "CP-1", "CanonicalDataFoundation",
                runtime_output={
                    "summary": {"revenue": 1200, "adj_ebitda": 300, "ebitda_margin": 25.0},
                    "headline": {"net_leverage": 3.5, "interest_coverage": 4.2, "fcf": 150},
                },
            ),
        }
        digests = build_module_digest(mods)
        assert len(digests) == 1
        d = digests[0]
        assert d.module_id == "CP-1"
        assert d.layer == "L1"
        assert d.confidence == "Medium"
        assert len(d.key_figures) == 6  # revenue, ebitda, margin, leverage, coverage, fcf

        # Check specific figures
        rev = next(f for f in d.key_figures if f.label == "Revenue")
        assert rev.value == 1200
        assert rev.unit == "$M"

        lev = next(f for f in d.key_figures if f.label == "Net leverage")
        assert lev.value == 3.5
        assert lev.unit == "x"

    def test_nan_value_excluded(self):
        from research_report import build_module_digest
        mods = {
            "CP-1": FakeModuleOutput(
                "CP-1", runtime_output={
                    "summary": {"revenue": float("nan")},
                    "headline": {"net_leverage": 3.5},
                },
            ),
        }
        digests = build_module_digest(mods)
        d = digests[0]
        labels = {f.label for f in d.key_figures}
        assert "Revenue" not in labels  # NaN excluded
        assert "Net leverage" in labels  # valid figure included

    def test_inf_value_excluded(self):
        from research_report import build_module_digest
        mods = {
            "CP-1": FakeModuleOutput(
                "CP-1", runtime_output={
                    "headline": {"net_leverage": float("inf")},
                },
            ),
        }
        digests = build_module_digest(mods)
        d = digests[0]
        labels = {f.label for f in d.key_figures}
        assert "Net leverage" not in labels  # inf excluded

    def test_non_numeric_signal_stored_as_label(self):
        from research_report import build_module_digest
        mods = {
            "CP-2B": FakeModuleOutput(
                "CP-2B", runtime_output={"fragility": "LOW"},
            ),
        }
        digests = build_module_digest(mods)
        d = digests[0]
        frag = next(f for f in d.key_figures if f.label == "Fragility")
        assert frag.value is None
        assert frag.unit == ""
        assert frag.display_value == "LOW"

    def test_multiple_modules_sorted(self):
        from research_report import build_module_digest
        mods = {
            "CP-2B": FakeModuleOutput("CP-2B"),
            "CP-1": FakeModuleOutput("CP-1"),
        }
        digests = build_module_digest(mods)
        assert [d.module_id for d in digests] == ["CP-1", "CP-2B"]  # sorted

    def test_overall_view_extracted(self):
        from research_report import build_module_digest
        mods = {
            "CP-2E": FakeModuleOutput(
                "CP-2E", runtime_output={
                    "overall_liquidity_view": "Adequate liquidity.",
                },
            ),
        }
        digests = build_module_digest(mods)
        assert "Adequate" in digests[0].overall_view

    def test_dict_runtime_output_handled(self):
        """When mods values are plain dicts (not ORM objects), still works."""
        from research_report import build_module_digest
        mods = {
            "CP-1": {
                "module_name": "CP-1",
                "runtime_output": {"headline": {"net_leverage": 2.0}},
                "confidence": "High",
                "qa_status": "Passed",
                "committee_status": "Committee Ready",
            },
        }
        digests = build_module_digest(mods)
        assert len(digests) == 1
        assert digests[0].key_figures[0].value == 2.0


class TestValidateReportFigures:
    def test_all_figures_verified(self):
        from research_report import validate_report_figures
        mods = {
            "CP-1": FakeModuleOutput(
                "CP-1", runtime_output={"headline": {"net_leverage": 3.5}},
            ),
        }
        payload = {
            "key_metrics": [
                {"label": "Net leverage", "value": 3.5, "unit": "x",
                 "source_module_id": "CP-1", "source_path": "headline.net_leverage"},
            ],
            "sections": [],
        }
        result = validate_report_figures(payload, mods)
        assert result.checked == 1
        assert result.verified == 1
        assert result.dropped == []
        assert len(payload["key_metrics"]) == 1  # figure survives

    def test_mismatched_figure_dropped(self):
        from research_report import validate_report_figures
        mods = {
            "CP-1": FakeModuleOutput(
                "CP-1", runtime_output={"headline": {"net_leverage": 3.5}},
            ),
        }
        payload = {
            "key_metrics": [
                {"label": "Net leverage", "value": 9.9, "unit": "x",
                 "source_module_id": "CP-1", "source_path": "headline.net_leverage"},
            ],
            "sections": [],
        }
        result = validate_report_figures(payload, mods)
        assert result.checked == 1
        assert result.verified == 0
        assert len(result.dropped) == 1
        assert result.dropped[0]["reason"] == "value mismatch"
        assert len(payload["key_metrics"]) == 0  # figure dropped

    def test_missing_source_module_dropped(self):
        from research_report import validate_report_figures
        payload = {
            "key_metrics": [
                {"label": "X", "value": 1, "unit": "", "source_module_id": "", "source_path": ""},
            ],
            "sections": [],
        }
        result = validate_report_figures(payload, {})
        assert result.checked == 1
        assert result.verified == 0
        assert len(result.dropped) == 1

    def test_module_not_in_run_unverified(self):
        from research_report import validate_report_figures
        payload = {
            "key_metrics": [
                {"label": "X", "value": 1, "unit": "",
                 "source_module_id": "CP-99", "source_path": "x"},
            ],
            "sections": [],
        }
        result = validate_report_figures(payload, {})
        assert result.checked == 1
        assert result.verified == 0
        assert len(result.unverified) == 1

    def test_section_figures_validated(self):
        from research_report import validate_report_figures
        mods = {
            "CP-2B": FakeModuleOutput(
                "CP-2B", runtime_output={"fragility": "LOW"},
            ),
        }
        payload = {
            "key_metrics": [],
            "sections": [{
                "id": "l2-downside",
                "layer": "L2",
                "title": "Downside",
                "narrative_markdown": "",
                "contributing_modules": ["CP-2B"],
                "key_figures": [
                    {"label": "Fragility", "value": "LOW", "unit": "",
                     "source_module_id": "CP-2B", "source_path": "fragility"},
                ],
            }],
        }
        result = validate_report_figures(payload, mods)
        assert result.verified == 1
        assert len(payload["sections"][0]["key_figures"]) == 1

    def test_both_none_values_match(self):
        from research_report import validate_report_figures
        mods = {
            "CP-1": FakeModuleOutput("CP-1", runtime_output={"x": None}),
        }
        payload = {
            "key_metrics": [
                {"label": "X", "value": None, "unit": "",
                 "source_module_id": "CP-1", "source_path": "x"},
            ],
            "sections": [],
        }
        result = validate_report_figures(payload, mods)
        assert result.verified == 1

    def test_nan_in_payload_dropped(self):
        from research_report import validate_report_figures
        mods = {
            "CP-1": FakeModuleOutput("CP-1", runtime_output={"x": 1.0}),
        }
        payload = {
            "key_metrics": [
                {"label": "X", "value": float("nan"), "unit": "",
                 "source_module_id": "CP-1", "source_path": "x"},
            ],
            "sections": [],
        }
        result = validate_report_figures(payload, mods)
        assert result.verified == 0
        assert len(result.dropped) == 1


class TestRenderSectionsMarkdown:
    def test_minimal_payload_renders(self):
        from research_report import _render_sections_markdown
        payload = {
            "masthead": {"as_of_date": "2026-07-07", "run_id": "r1",
                         "prompt_version": "abc123", "analyst": "test"},
            "bottom_line": {"summary": "Credit is sound.", "action_bias": "Core Hold",
                            "thesis": "Durable cash flows.", "gated": False},
            "key_metrics": [
                {"label": "Net leverage", "value": 3.5, "unit": "x",
                 "source_module_id": "CP-1"},
            ],
            "sections": [{
                "id": "l1-financials", "layer": "L1", "title": "Financial Profile",
                "narrative_markdown": "Revenue grew 5%.",
                "contributing_modules": ["CP-1", "CP-1B"],
                "key_figures": [],
            }],
            "outlook": {"horizon": "12-24 months", "narrative_markdown": "Stable outlook.",
                        "forward_signals": []},
            "risks": {"narrative_markdown": "Low fragility."},
            "gaps": [],
            "provenance": [{"module_id": "CP-1", "module_name": "CP-1",
                            "confidence": "High", "qa_status": "Passed",
                            "deep_dive_href": "/deepdive"}],
        }
        md = _render_sections_markdown(payload)
        assert "Research Report" in md
        assert "Core Hold" in md
        assert "Net leverage" in md
        assert "Financial Profile" in md
        assert "Forecasts & Outlook" in md
        assert "Risks" in md
        assert "Provenance" in md

    def test_gated_action_bias_shown(self):
        from research_report import _render_sections_markdown
        payload = {
            "masthead": {"as_of_date": "", "run_id": "", "prompt_version": "", "analyst": ""},
            "bottom_line": {"summary": "", "action_bias": "Overweight",
                            "thesis": "", "gated": True},
            "key_metrics": [],
            "sections": [],
            "outlook": {"horizon": "", "narrative_markdown": "", "forward_signals": []},
            "risks": {"narrative_markdown": ""},
            "gaps": [],
            "provenance": [],
        }
        md = _render_sections_markdown(payload)
        assert "GATED" in md


class TestFiguresEqual:
    def test_exact_numeric_match(self):
        from research_report import _figures_equal
        assert _figures_equal(3.5, 3.5) is True

    def test_close_numeric_match(self):
        from research_report import _figures_equal
        assert _figures_equal(3.51, 3.5) is True  # diff=0.01, tolerance=max(3.5*0.001=0.0035, floor=0.01)=0.01

    def test_far_numeric_mismatch(self):
        from research_report import _figures_equal
        assert _figures_equal(4.0, 3.5) is False

    def test_string_case_insensitive_match(self):
        from research_report import _figures_equal
        assert _figures_equal("LOW", "low") is True

    def test_string_mismatch(self):
        from research_report import _figures_equal
        assert _figures_equal("LOW", "HIGH") is False

    def test_both_none(self):
        from research_report import _figures_equal
        assert _figures_equal(None, None) is True

    def test_one_none(self):
        from research_report import _figures_equal
        assert _figures_equal(None, 1.0) is False

    def test_nan_not_equal(self):
        from research_report import _figures_equal
        assert _figures_equal(float("nan"), float("nan")) is False

    def test_large_value_mismatch_detected(self):
        """$1,200M vs $1,250M (diff=50) should fail — 0.1% tolerance = $1.25, diff=50 >> tolerance."""
        from research_report import _figures_equal
        assert _figures_equal(1250, 1200) is False

    def test_small_diff_within_tolerance(self):
        """3.50 vs 3.51 (diff=0.01) passes — tolerance = max(3.5*0.001, 0.01) = 0.01."""
        from research_report import _figures_equal
        assert _figures_equal(3.51, 3.5) is True

    def test_small_diff_exceeds_tolerance(self):
        """3.50 vs 3.53 (diff=0.03) fails — tolerance is 0.01."""
        from research_report import _figures_equal
        assert _figures_equal(3.53, 3.5) is False

    def test_zero_value_tolerance_floor(self):
        """0.0 vs 0.005 (diff=0.005) passes — tolerance floors at 0.01."""
        from research_report import _figures_equal
        assert _figures_equal(0.005, 0.0) is True


class TestValidateOutlookSignals:
    def test_forward_signal_verified_module_passes(self):
        from research_report import validate_report_figures
        mods = {
            "CP-2C": FakeModuleOutput("CP-2C"),
        }
        payload = {
            "key_metrics": [],
            "sections": [],
            "outlook": {
                "horizon": "12m",
                "narrative_markdown": "",
                "forward_signals": [
                    {"signal": "Maturity wall Q4 2026", "source_module_id": "CP-2C", "timing": "Q4 2026"},
                ],
            },
            "bottom_line": {"summary": "", "action_bias": "Core Hold", "thesis": "", "gated": False},
        }
        result = validate_report_figures(payload, mods)
        assert result.unverified == []
        assert len(payload["outlook"]["forward_signals"]) == 1

    def test_forward_signal_unverified_module_dropped(self):
        from research_report import validate_report_figures
        mods = {}
        payload = {
            "key_metrics": [],
            "sections": [],
            "outlook": {
                "horizon": "12m",
                "narrative_markdown": "",
                "forward_signals": [
                    {"signal": "Fabricated signal", "source_module_id": "CP-MON", "timing": "2027"},
                ],
            },
            "bottom_line": {"summary": "", "action_bias": "Core Hold", "thesis": "", "gated": False},
        }
        result = validate_report_figures(payload, mods)
        assert len(result.unverified) == 1
        assert result.unverified[0]["source_module_id"] == "CP-MON"
        assert len(payload["outlook"]["forward_signals"]) == 0  # dropped

    def test_forward_signal_missing_module_id_dropped(self):
        from research_report import validate_report_figures
        payload = {
            "key_metrics": [],
            "sections": [],
            "outlook": {
                "horizon": "12m",
                "narrative_markdown": "",
                "forward_signals": [
                    {"signal": "No source", "source_module_id": "", "timing": ""},
                ],
            },
            "bottom_line": {"summary": "", "action_bias": "Core Hold", "thesis": "", "gated": False},
        }
        result = validate_report_figures(payload, {})
        assert len(result.dropped) == 1
        assert "missing source_module_id" in result.dropped[0]["reason"]


class TestValidateActionBias:
    def test_action_bias_matches_cp6a_passes(self):
        from research_report import validate_report_figures
        mods = {
            "CP-6A": FakeModuleOutput("CP-6A", runtime_output={"action_bias": "Core Hold"}),
        }
        payload = {
            "key_metrics": [],
            "sections": [],
            "outlook": {"horizon": "", "narrative_markdown": "", "forward_signals": []},
            "bottom_line": {"summary": "", "action_bias": "Core Hold", "thesis": "", "gated": False},
        }
        result = validate_report_figures(payload, mods)
        assert result.dropped == []
        assert payload["bottom_line"]["gated"] is False

    def test_action_bias_mismatch_gates_report(self):
        from research_report import validate_report_figures
        mods = {
            "CP-6A": FakeModuleOutput("CP-6A", runtime_output={"action_bias": "Avoid"}),
        }
        payload = {
            "key_metrics": [],
            "sections": [],
            "outlook": {"horizon": "", "narrative_markdown": "", "forward_signals": []},
            "bottom_line": {"summary": "", "action_bias": "Add / Increase", "thesis": "", "gated": False},
        }
        result = validate_report_figures(payload, mods)
        assert len(result.dropped) == 1
        assert result.dropped[0]["reason"] == "action_bias mismatch with CP-6A — gating report"
        assert payload["bottom_line"]["gated"] is True

    def test_action_bias_no_cp6a_module_skips_validation(self):
        """When CP-6A is not in mods, the action_bias is left alone (cannot validate what's absent)."""
        from research_report import validate_report_figures
        payload = {
            "key_metrics": [],
            "sections": [],
            "outlook": {"horizon": "", "narrative_markdown": "", "forward_signals": []},
            "bottom_line": {"summary": "", "action_bias": "Avoid", "thesis": "", "gated": False},
        }
        result = validate_report_figures(payload, {})
        assert result.dropped == []
        assert payload["bottom_line"]["gated"] is False  # unchanged


# ── Endpoint tests (HTTP, DB) ────────────────────────────────────────────────


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    tmp = tmp_path_factory.mktemp("caos-rr")
    os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{tmp / 'test.db'}"
    os.environ["CAOS_STORAGE_DIR"] = str(tmp / "vault")
    os.environ["ANTHROPIC_API_KEY"] = ""  # demo/fixture fallback
    from main import app

    with TestClient(app) as c:
        yield c


def test_create_report_404_on_unknown_issuer(client):
    assert client.post("/api/issuers/nope-no-such/research-report").status_code == 404


def test_create_report_409_when_no_completed_run(client):
    """A hand-created issuer with no run cannot generate a report."""
    iid = client.post("/api/issuers/", json={"name": "No Run Inc"}).json()["id"]
    resp = client.post(f"/api/issuers/{iid}/research-report")
    assert resp.status_code == 409
    assert "No completed run" in resp.json()["detail"]


def test_create_report_201_and_poll_after_run(client):
    """After a completed run, POST creates a report job; GET polls it to completion."""
    iid = client.post("/api/issuers/", json={"name": "Reportable Co", "ticker": "RPT"}).json()["id"]
    run = client.post("/api/runs", json={"issuer_id": iid})
    assert run.status_code == 201, run.text
    finished = wait_for_run(client, run.json()["id"])
    assert finished["status"] == "complete"

    # Create the report
    create = client.post(f"/api/issuers/{iid}/research-report")
    assert create.status_code == 201, create.text
    job = create.json()
    assert job["status"] == "running"
    assert job["id"]

    # Poll until complete (demo mode — no API key, so it completes instantly)
    import time
    deadline = time.time() + 30
    while time.time() < deadline:
        poll = client.get(f"/api/issuers/{iid}/research-report/{job['id']}")
        assert poll.status_code == 200, poll.text
        status = poll.json()
        if status["status"] in ("complete", "failed"):
            break
        time.sleep(0.5)
    else:
        pytest.fail("Report did not complete within 30s")

    assert status["status"] == "complete"
    assert status["demo"] is True  # no API key → demo mode
    assert status["markdown"] is not None
    assert "Bottom Line" in (status["markdown"] or "")  # demo report starts with Bottom Line
    assert status["tokens_used"] == 0  # demo uses no tokens
    assert status["is_stale"] is False  # report is for the latest run


@pytest.mark.asyncio
async def test_create_report_recovers_from_concurrent_insert_conflict(monkeypatch):
    """#17: two near-simultaneous POSTs for the same issuer+run both pass the
    'existing running/complete?' check-then-insert before either commits — the
    loser hits uq_issuer_run_report. Unit-tested against a fake session (matches
    the SavedModel concurrent-first-save test's style) rather than a real DB:
    db.commit() raises IntegrityError once, then a re-query finds the winner's
    row. Must return 201 with the winner's row, not 500."""
    import routes.issuers as issuers_route
    from sqlalchemy.exc import IntegrityError

    monkeypatch.setattr(issuers_route.rate_limit, "hit", lambda *a, **k: True)

    issuer = SimpleNamespace(id="iss-1")
    run = SimpleNamespace(id="run-1", created_at=None)
    winner = SimpleNamespace(id="winner-report", status="failed")

    class _Result:
        def __init__(self, row):
            self._row = row

        def scalars(self):
            return self

        def first(self):
            return self._row

    class _DB:
        def __init__(self):
            self.select_calls = 0
            self.commit_calls = 0

        async def get(self, model, pk):
            return issuer  # Issuer lookup

        async def execute(self, stmt):
            self.select_calls += 1
            if self.select_calls == 1:
                return _Result(run)      # latest_complete Run lookup
            if self.select_calls == 2:
                return _Result(None)     # "existing" check: nothing running/complete yet
            return _Result(winner)       # post-conflict re-query finds the winner

        def add(self, obj):
            pass

        async def commit(self):
            self.commit_calls += 1
            if self.commit_calls == 1:
                raise IntegrityError("insert", {}, Exception("uq_issuer_run_report"))

        async def rollback(self):
            pass

    out = await issuers_route.create_research_report(
        "iss-1", caller=SimpleNamespace(id="a1"), db=_DB(),
    )
    assert out.id == "winner-report" and out.status == "failed"


def test_get_latest_report_404_when_none(client):
    iid = client.post("/api/issuers/", json={"name": "No Report Co"}).json()["id"]
    assert client.get(f"/api/issuers/{iid}/research-report").status_code == 404


def test_get_latest_report_returns_cached(client):
    """After a report is generated, GET /research-report returns it."""
    iid = client.post("/api/issuers/", json={"name": "Cached Co"}).json()["id"]
    run = client.post("/api/runs", json={"issuer_id": iid})
    assert run.status_code == 201
    wait_for_run(client, run.json()["id"])

    create = client.post(f"/api/issuers/{iid}/research-report")
    assert create.status_code == 201
    job_id = create.json()["id"]

    # Poll to completion
    import time
    deadline = time.time() + 30
    while time.time() < deadline:
        poll = client.get(f"/api/issuers/{iid}/research-report/{job_id}")
        if poll.json()["status"] == "complete":
            break
        time.sleep(0.5)

    # GET latest
    latest = client.get(f"/api/issuers/{iid}/research-report")
    assert latest.status_code == 200
    assert latest.json()["status"] == "complete"
    assert latest.json()["id"] == job_id


def test_get_latest_report_is_stale_after_new_run(client):
    """When a newer run completes, the cached report is marked stale."""
    iid = client.post("/api/issuers/", json={"name": "Stale Co"}).json()["id"]

    # First run + report
    run1 = client.post("/api/runs", json={"issuer_id": iid})
    assert run1.status_code == 201
    wait_for_run(client, run1.json()["id"])

    create = client.post(f"/api/issuers/{iid}/research-report")
    assert create.status_code == 201
    job_id = create.json()["id"]

    import time
    deadline = time.time() + 30
    while time.time() < deadline:
        poll = client.get(f"/api/issuers/{iid}/research-report/{job_id}")
        if poll.json()["status"] == "complete":
            break
        time.sleep(0.5)

    # Second run (newer)
    run2 = client.post("/api/runs", json={"issuer_id": iid})
    assert run2.status_code == 201
    wait_for_run(client, run2.json()["id"])

    # GET latest — should be stale
    latest = client.get(f"/api/issuers/{iid}/research-report")
    assert latest.status_code == 200
    assert latest.json()["is_stale"] is True


def test_report_poll_404_on_wrong_issuer(client):
    """Polling a report under a different issuer returns 404."""
    iid1 = client.post("/api/issuers/", json={"name": "Issuer A"}).json()["id"]
    iid2 = client.post("/api/issuers/", json={"name": "Issuer B"}).json()["id"]

    run = client.post("/api/runs", json={"issuer_id": iid1})
    assert run.status_code == 201
    wait_for_run(client, run.json()["id"])

    create = client.post(f"/api/issuers/{iid1}/research-report")
    assert create.status_code == 201
    job_id = create.json()["id"]

    # Poll under wrong issuer
    resp = client.get(f"/api/issuers/{iid2}/research-report/{job_id}")
    assert resp.status_code == 404


def test_report_rate_limited(client):
    """POST is rate-limited at 3/min per caller."""
    # Create 4 different issuers with completed runs so the idempotency
    # check doesn't block the rate-limit test.
    iids = []
    for i in range(4):
        iid = client.post("/api/issuers/", json={"name": f"Rate Ltd {i}"}).json()["id"]
        run = client.post("/api/runs", json={"issuer_id": iid})
        assert run.status_code == 201
        wait_for_run(client, run.json()["id"])
        iids.append(iid)

    # Fire 4 rapid POSTs — the first 3 should succeed (201), the 4th should 429
    statuses = []
    for iid in iids:
        resp = client.post(f"/api/issuers/{iid}/research-report")
        statuses.append(resp.status_code)

    assert 429 in statuses
    assert statuses[:3] == [201, 201, 201]  # first 3 within the 3/min budget
    assert statuses[3] == 429  # 4th hits the limit


def test_report_payload_has_expected_structure(client):
    """The completed report payload has the expected bank-research structure."""
    iid = client.post("/api/issuers/", json={"name": "Structure Co"}).json()["id"]
    run = client.post("/api/runs", json={"issuer_id": iid})
    assert run.status_code == 201
    wait_for_run(client, run.json()["id"])

    create = client.post(f"/api/issuers/{iid}/research-report")
    assert create.status_code == 201
    job_id = create.json()["id"]

    import time
    deadline = time.time() + 30
    status = None
    while time.time() < deadline:
        poll = client.get(f"/api/issuers/{iid}/research-report/{job_id}")
        status = poll.json()
        if status["status"] == "complete":
            break
        time.sleep(0.5)

    assert status is not None
    assert status["status"] == "complete"

    # Demo mode: payload is empty dict (no LLM), markdown is the demo report
    assert isinstance(status["payload"], dict)
    assert isinstance(status["markdown"], str)
    assert len(status["markdown"]) > 0
    assert status["demo"] is True
    assert status["truncated"] is False
    assert isinstance(status["validation"], dict) or status["validation"] is None
    assert isinstance(status["tokens_used"], int)
    assert status["is_stale"] is False