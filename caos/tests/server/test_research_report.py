"""Issuer Research Report — synthesis service + endpoint tests.

Covers the pure functions (digest builder, figure validator, path resolver,
markdown renderer) and the three HTTP endpoints (POST create, GET latest,
GET by id poll).
"""

from __future__ import annotations

import json
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

    def test_phase4_modules_follow_registry_order_not_lexicographic_order(self):
        from research_report import build_module_digest
        mods = {
            "CP-4C": FakeModuleOutput("CP-4C"),
            "CP-4D": FakeModuleOutput("CP-4D", runtime_output={
                "overall_structural_view": "Structural view is limited by security evidence."
            }),
            "CP-2G": FakeModuleOutput("CP-2G", runtime_output={
                "overall_credit_view": "Transition exposure is directional."
            }),
        }
        digests = build_module_digest(mods)
        assert [d.module_id for d in digests] == ["CP-2G", "CP-4D", "CP-4C"]
        assert digests[0].layer == "L2" and digests[1].layer == "L4"
        assert "Structural view" in digests[1].overall_view

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

    def test_validation_mutates_payload_before_public_render(self):
        from research_report import render_validated_research_report, validate_report_figures

        mods = {
            "CP-1": FakeModuleOutput("CP-1", runtime_output={"leverage": 4.0}),
            "CP-6A": FakeModuleOutput("CP-6A", runtime_output={"action_bias": "Avoid"}),
        }
        payload = {
            "masthead": {},
            "bottom_line": {"summary": "", "action_bias": "Add / Increase", "thesis": "", "gated": False},
            "key_metrics": [{
                "label": "Unsupported leverage", "value": 9.9, "unit": "x",
                "source_module_id": "CP-1", "source_path": "leverage",
            }],
            "sections": [], "outlook": {"forward_signals": []},
            "risks": {}, "gaps": [], "provenance": [],
        }

        validate_report_figures(payload, mods)
        markdown = render_validated_research_report(payload)

        assert "9.9x" not in markdown
        assert "Unsupported leverage" not in markdown
        assert "(GATED)" in markdown


class _FakeReportStream:
    def __init__(self, response):
        self._response = response

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_args):
        return False

    async def get_final_message(self):
        if isinstance(self._response, BaseException):
            raise self._response
        return self._response


def _fake_report_client(responses):
    remaining = iter(responses)
    return SimpleNamespace(messages=SimpleNamespace(
        stream=lambda **_kwargs: _FakeReportStream(next(remaining))
    ))


def _fake_report_message(*blocks):
    return SimpleNamespace(
        content=list(blocks), stop_reason="end_turn",
        usage=SimpleNamespace(input_tokens=2, output_tokens=3),
    )


async def _noop_trace(*_args, **_kwargs):
    return None


@pytest.mark.asyncio
async def test_live_synthesis_returns_structured_payload_without_markdown(monkeypatch):
    import research_report

    payload = {"masthead": {"run_id": "run-1"}}
    msg = _fake_report_message(SimpleNamespace(type="tool_use", input=payload))
    monkeypatch.setattr(research_report, "llm_configured", lambda: True)
    monkeypatch.setattr(research_report, "_get_client", lambda: _fake_report_client([msg]))
    monkeypatch.setattr(research_report.budget, "trace_llm", _noop_trace)

    result = await research_report.synthesize_research_report([], "Issuer")

    assert result.payload == payload
    assert result.markdown == ""
    assert result.demo is False


@pytest.mark.asyncio
async def test_live_synthesis_repair_exception_fails_closed(monkeypatch):
    import research_report

    first = _fake_report_message(SimpleNamespace(type="text", text="unsafe prose"))
    monkeypatch.setattr(research_report, "llm_configured", lambda: True)
    monkeypatch.setattr(
        research_report, "_get_client",
        lambda: _fake_report_client([first, RuntimeError("repair unavailable")]),
    )
    monkeypatch.setattr(research_report.budget, "trace_llm", _noop_trace)

    with pytest.raises(research_report.ResearchReportSynthesisError, match="structured report repair failed"):
        await research_report.synthesize_research_report([], "Issuer")


@pytest.mark.asyncio
async def test_live_synthesis_second_missing_tool_fails_closed(monkeypatch):
    import research_report

    first = _fake_report_message(SimpleNamespace(type="text", text=""))
    second = _fake_report_message(SimpleNamespace(type="text", text="still prose"))
    monkeypatch.setattr(research_report, "llm_configured", lambda: True)
    monkeypatch.setattr(research_report, "_get_client", lambda: _fake_report_client([first, second]))
    monkeypatch.setattr(research_report.budget, "trace_llm", _noop_trace)

    with pytest.raises(research_report.ResearchReportSynthesisError, match="structured report missing after repair"):
        await research_report.synthesize_research_report([], "Issuer")


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


# ── Background execution: sweep-on-boot (mirrors test_research_jobs.py) ─────


async def _seed_durable_report(*, suffix: str = "") -> str:
    """Persist the minimum trusted run/digest needed by ``_run_report``."""
    from database import AsyncSessionLocal, Issuer, IssuerResearchReport, ModuleOutput, Run

    async with AsyncSessionLocal() as session:
        issuer = Issuer(name=f"Durable report acceptance {suffix}")
        session.add(issuer)
        await session.flush()
        run = Run(
            issuer_id=issuer.id,
            analyst_id="acceptance-analyst",
            status="complete",
            prompt_version="acceptance-v1",
        )
        session.add(run)
        await session.flush()
        session.add_all([
            ModuleOutput(
                run_id=run.id,
                module_id="CP-1",
                module_name="CanonicalDataFoundation",
                runtime_output={"headline": {"net_leverage": 4.0}},
            ),
            ModuleOutput(
                run_id=run.id,
                module_id="CP-2E",
                module_name="LiquidityCashFlowBridge",
                runtime_output={"overall_liquidity_view": "Adequate."},
            ),
            ModuleOutput(
                run_id=run.id,
                module_id="CP-6A",
                module_name="CreditRecommendation",
                runtime_output={"action_bias": "Avoid"},
            ),
        ])
        report = IssuerResearchReport(
            issuer_id=issuer.id,
            run_id=run.id,
            analyst_id="acceptance-analyst",
        )
        session.add(report)
        await session.commit()
        return report.id


@pytest.mark.asyncio
async def test_run_report_validates_before_persisting_payload_and_markdown(
    seeded_db, monkeypatch
):
    """The durable boundary must validate both public report artifacts."""
    import research_report_executor
    from database import AsyncSessionLocal, IssuerResearchReport
    from research_report import ResearchReportResult

    payload = {
        "masthead": {"as_of_date": "2026-07-16", "run_id": "run", "prompt_version": "v1", "analyst": "a"},
        "bottom_line": {
            "summary": "Unvalidated model output.",
            "action_bias": "Add / Increase",
            "thesis": "Unvalidated thesis.",
            "gated": False,
        },
        "key_metrics": [{
            "label": "Invented leverage",
            "value": 9.9,
            "unit": "x",
            "source_module_id": "CP-1",
            "source_path": "headline.net_leverage",
        }],
        "sections": [],
        "outlook": {"horizon": "", "narrative_markdown": "", "forward_signals": []},
        "risks": {"narrative_markdown": ""},
        "gaps": [],
        "provenance": [],
    }

    async def synthesize(**_kwargs):
        return ResearchReportResult(
            payload=payload,
            markdown="UNVALIDATED 9.9x",
            demo=False,
            truncated=True,
            tokens_used=17,
        )

    monkeypatch.setattr(research_report_executor, "synthesize_research_report", synthesize)
    report_id = await _seed_durable_report(suffix="validate")
    await research_report_executor.execute_report_by_id(report_id)

    async with AsyncSessionLocal() as session:
        report = await session.get(IssuerResearchReport, report_id)

    assert report.status == "complete"
    assert report.payload["key_metrics"] == []
    assert report.payload["bottom_line"]["gated"] is True
    assert "9.9" not in json.dumps(report.payload)
    assert "9.9x" not in report.markdown
    assert "Invented leverage" not in report.markdown
    assert "(GATED)" in report.markdown
    assert report.markdown.startswith("> **Report may be incomplete**")
    assert report.truncated is True
    assert report.validation["dropped"][0]["reason"] == "value mismatch"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("responses", "expected_error"),
    [
        (
            [
                _fake_report_message(SimpleNamespace(type="text", text="unsafe prose")),
                RuntimeError("repair provider unavailable " + "x" * 2_000),
            ],
            "structured report repair failed",
        ),
        (
            [
                _fake_report_message(SimpleNamespace(type="text", text="unsafe prose")),
                _fake_report_message(SimpleNamespace(type="text", text="still no tool payload")),
            ],
            "structured report missing after repair",
        ),
    ],
)
async def test_configured_live_repair_failure_is_durable_and_never_demo(
    seeded_db, monkeypatch, responses, expected_error
):
    """Both repair failures stay failed, bounded, and explicitly non-demo."""
    import research_report
    import research_report_executor
    from database import AsyncSessionLocal, IssuerResearchReport

    monkeypatch.setattr(research_report, "llm_configured", lambda: True)
    monkeypatch.setattr(research_report, "_get_client", lambda: _fake_report_client(responses))
    monkeypatch.setattr(research_report.budget, "trace_llm", _noop_trace)
    report_id = await _seed_durable_report(suffix=expected_error)

    await research_report_executor.execute_report_by_id(report_id)

    async with AsyncSessionLocal() as session:
        report = await session.get(IssuerResearchReport, report_id)

    assert report.status == "failed"
    assert report.demo is False
    assert report.payload is None and report.markdown is None
    assert report.error == expected_error
    assert len(report.error) <= 512
    assert report.completed_at is not None
    assert report.attempts == 1 and report.worker_id


@pytest.mark.asyncio
async def test_report_executor_sweeps_stranded_reports(seeded_db):
    """Hard-crash recovery: a report left 'running' by a restart must be swept to
    'failed' on the next start(); terminal reports untouched. No lease was ever
    set (mirrors a real crash before/just after the lease-set commit, or a
    pre-migration row) — NULL lease is reapable."""
    from database import AsyncSessionLocal, IssuerResearchReport
    from research_report_executor import ResearchReportExecutor

    async with AsyncSessionLocal() as s:
        stranded = IssuerResearchReport(status="running", issuer_id="i1", run_id="r1", analyst_id="t")
        done = IssuerResearchReport(status="complete", issuer_id="i1", run_id="r2", analyst_id="t")
        s.add_all([stranded, done])
        await s.commit()
        sid, did = stranded.id, done.id

    await ResearchReportExecutor().start()

    async with AsyncSessionLocal() as s:
        assert (await s.get(IssuerResearchReport, sid)).status == "failed"
        assert (await s.get(IssuerResearchReport, did)).status == "complete"


@pytest.mark.asyncio
async def test_report_executor_does_not_sweep_live_leased_report(seeded_db):
    """Multi-replica safety: a 'running' report whose lease has NOT expired is
    genuinely still running (on this replica or a live sibling) and must survive
    start()'s boot sweep — only a lease-expired report is a provable strand."""
    from datetime import datetime, timedelta, timezone

    from database import AsyncSessionLocal, IssuerResearchReport
    from research_report_executor import ResearchReportExecutor

    async with AsyncSessionLocal() as s:
        live = IssuerResearchReport(
            status="running", issuer_id="i2", run_id="r1", analyst_id="t",
            worker_id="sibling-replica:123",
            lease_expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
        )
        s.add(live)
        await s.commit()
        lid = live.id

    await ResearchReportExecutor().start()

    async with AsyncSessionLocal() as s:
        assert (await s.get(IssuerResearchReport, lid)).status == "running"


@pytest.mark.asyncio
async def test_report_executor_sweeps_expired_leased_report(seeded_db):
    """A 'running' report whose lease HAS expired is a provable strand and must be
    swept — exercises the SQL datetime comparison itself (not the NULL branch),
    so a driver-level tz/format mismatch in `lease_expires_at < now` fails here."""
    from datetime import datetime, timedelta, timezone

    from database import AsyncSessionLocal, IssuerResearchReport
    from research_report_executor import ResearchReportExecutor

    async with AsyncSessionLocal() as s:
        dead = IssuerResearchReport(
            status="running", issuer_id="i4", run_id="r1", analyst_id="t",
            worker_id="dead-replica:456",
            lease_expires_at=datetime.now(timezone.utc) - timedelta(minutes=10),
        )
        s.add(dead)
        await s.commit()
        did = dead.id

    await ResearchReportExecutor().start()

    async with AsyncSessionLocal() as s:
        swept = await s.get(IssuerResearchReport, did)
    assert swept.status == "failed"
    assert swept.lease_expires_at is None


@pytest.mark.asyncio
async def test_lease_set_failure_still_marks_report_failed(seeded_db, monkeypatch):
    """The lease-set commit must be INSIDE the try/except, not before it — a
    commit failure there (DB blip, pool exhaustion) must still mark the report
    failed, not strand it in 'running' with no error and no lease."""
    from database import AsyncSessionLocal, IssuerResearchReport
    import research_report_executor

    real_get_settings = research_report_executor.get_settings

    class _BoomSettings:
        def __getattr__(self, name):
            if name == "caos_report_lease_seconds":
                raise RuntimeError("synthetic lease-set failure")
            return getattr(real_get_settings(), name)

    monkeypatch.setattr(research_report_executor, "get_settings", lambda: _BoomSettings())

    async with AsyncSessionLocal() as s:
        report = IssuerResearchReport(status="running", issuer_id="i3", run_id="r1", analyst_id="t")
        s.add(report)
        await s.commit()
        rid = report.id

    await research_report_executor.execute_report_by_id(rid)

    async with AsyncSessionLocal() as s:
        report = await s.get(IssuerResearchReport, rid)
        assert report.status == "failed"
        assert "synthetic lease-set failure" in (report.error or "")


@pytest.mark.asyncio
async def test_stale_report_attempt_cannot_mark_sibling_failed(seeded_db):
    from database import AsyncSessionLocal, IssuerResearchReport
    from research_report_executor import ReportClaim, _mark_failed

    async with AsyncSessionLocal() as s:
        report = IssuerResearchReport(
            status="running", issuer_id="fenced-i", run_id="fenced-r",
            analyst_id="t", attempts=2, worker_id="new-owner",
        )
        s.add(report)
        await s.commit()
        report_id = report.id

    async with AsyncSessionLocal() as s:
        await _mark_failed(s, ReportClaim(report_id, "old-owner", 1), "stale failure")

    async with AsyncSessionLocal() as s:
        report = await s.get(IssuerResearchReport, report_id)
        assert report.status == "running"
        assert report.worker_id == "new-owner"
        assert report.error is None


@pytest.mark.asyncio
async def test_report_heartbeat_cancels_task_after_ownership_loss(seeded_db):
    import asyncio

    from database import AsyncSessionLocal, IssuerResearchReport
    from research_report_executor import ReportClaim, ReportQueueWorker

    async with AsyncSessionLocal() as s:
        report = IssuerResearchReport(
            status="running", issuer_id="heartbeat-i", run_id="heartbeat-r",
            analyst_id="t", attempts=2, worker_id="sibling-owner",
        )
        s.add(report)
        await s.commit()
        report_id = report.id

    worker = ReportQueueWorker()
    stale = ReportClaim(report_id, "stale-owner", 1)
    task = asyncio.create_task(asyncio.sleep(60))
    worker._inflight.add(task)
    worker._inflight_claims[report_id] = stale
    worker._inflight_tasks[report_id] = task

    await worker._heartbeat()
    await asyncio.gather(task, return_exceptions=True)

    assert task.cancelled()


# ── Endpoint tests (HTTP, DB) ────────────────────────────────────────────────


@pytest.fixture(scope="module")
def client():
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
    assert job["status"] == "queued"  # durable executor claims it (mirrors ResearchJob)
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
async def test_create_report_recovers_from_concurrent_insert_conflict(monkeypatch):  # noqa: C901
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


# ── Durable executor: settings, lease columns, QueueWorker (Postgres only) ───

def test_report_executor_settings_defaults():
    from config import Settings

    s = Settings()
    assert s.caos_report_lease_seconds == 600
    assert s.caos_report_max_attempts == 3
    assert s.caos_report_export_concurrency == 2


def test_report_model_has_lease_columns():
    from database import IssuerResearchReport

    cols = IssuerResearchReport.__table__.columns
    for name in ("claimed_at", "lease_expires_at", "attempts", "worker_id"):
        assert name in cols, f"IssuerResearchReport is missing column {name}"
    assert cols["attempts"].default.arg == 0
    assert cols["status"].default.arg == "queued"


from conftest import requires_pg


@pytest.mark.asyncio
async def test_report_inprocess_start_sweeps_stranded_reports(seeded_db):
    """Hard-crash recovery: a report left 'queued'/'running' by a SIGKILL (no
    stop()) must be swept to 'failed' on the next start() — SQLite has no reaper."""
    from database import AsyncSessionLocal, Issuer, IssuerResearchReport, Run
    from research_report_executor import ResearchReportExecutor

    async with AsyncSessionLocal() as s:
        # uq_issuer_run_report is (issuer_id, run_id) — distinct runs so the two
        # stranded rows don't collide with each other.
        issuer = Issuer(name="Report Sweep Test Co")
        s.add(issuer)
        await s.flush()
        run_a = Run(issuer_id=issuer.id, analyst_id="t", status="complete")
        run_b = Run(issuer_id=issuer.id, analyst_id="t", status="complete")
        s.add_all([run_a, run_b])
        await s.flush()
        stranded_running = IssuerResearchReport(issuer_id=issuer.id, run_id=run_a.id, analyst_id="t", status="running")
        stranded_queued = IssuerResearchReport(issuer_id=issuer.id, run_id=run_b.id, analyst_id="t", status="queued")
        s.add_all([stranded_running, stranded_queued])
        await s.commit()
        ids = (stranded_running.id, stranded_queued.id)

    await ResearchReportExecutor().start()

    async with AsyncSessionLocal() as s:
        r_running, r_queued = [await s.get(IssuerResearchReport, i) for i in ids]
        assert r_running.status == "failed" and "process restart" in (r_running.error or "")
        assert r_queued.status == "failed" and "process restart" in (r_queued.error or "")


@requires_pg
@pytest.mark.asyncio
async def test_two_report_workers_claim_one_report_once(seeded_db):
    from database import AsyncSessionLocal, Issuer, IssuerResearchReport, Run
    from research_report_executor import ReportQueueWorker

    async with AsyncSessionLocal() as s:
        issuer = Issuer(name="Report Claim Race Co")
        s.add(issuer)
        await s.flush()
        run = Run(issuer_id=issuer.id, analyst_id="t", status="complete")
        s.add(run)
        await s.flush()
        report = IssuerResearchReport(issuer_id=issuer.id, run_id=run.id, analyst_id="t")
        s.add(report)
        await s.commit()
        report_id = report.id

    w1, w2 = ReportQueueWorker(), ReportQueueWorker()
    id1 = await w1._claim_one()
    id2 = await w2._claim_one()
    claimed = [x for x in (id1, id2) if x and x.report_id == report_id]
    assert len(claimed) == 1, "exactly one worker may claim the report"


@requires_pg
@pytest.mark.asyncio
async def test_report_reaper_fails_exhausted_orphan(seeded_db):
    from datetime import datetime, timedelta, timezone

    from database import AsyncSessionLocal, Issuer, IssuerResearchReport, Run
    from research_report_executor import ReportQueueWorker

    past = datetime.now(timezone.utc) - timedelta(hours=1)
    async with AsyncSessionLocal() as s:
        issuer = Issuer(name="Report Reaper Orphan Co")
        s.add(issuer)
        await s.flush()
        run = Run(issuer_id=issuer.id, analyst_id="t", status="complete")
        s.add(run)
        await s.flush()
        report = IssuerResearchReport(
            issuer_id=issuer.id, run_id=run.id, analyst_id="t",
            status="running", attempts=3, lease_expires_at=past,
        )
        s.add(report)
        await s.commit()
        report_id = report.id

    await ReportQueueWorker()._reap_orphans()

    async with AsyncSessionLocal() as s:
        report = await s.get(IssuerResearchReport, report_id)
        assert report.status == "failed"
        assert "max attempts" in (report.error or "")


@requires_pg
@pytest.mark.asyncio
async def test_report_heartbeat_renews_same_attempt_after_original_lease_interval(
    seeded_db,
):
    """A long synthesis remains owned when its heartbeat runs after the lease's
    original deadline; renewal is fenced by owner token and attempt."""
    import asyncio
    from datetime import datetime, timedelta, timezone

    from database import AsyncSessionLocal, IssuerResearchReport
    from research_report_executor import ReportClaim, ReportQueueWorker

    report_id = await _seed_durable_report(suffix="heartbeat-renewal")
    owner = "heartbeat-owner"
    async with AsyncSessionLocal() as session:
        report = await session.get(IssuerResearchReport, report_id)
        report.status = "running"
        report.attempts = 1
        report.worker_id = owner
        report.lease_expires_at = datetime.now(timezone.utc) + timedelta(milliseconds=50)
        await session.commit()

    worker = ReportQueueWorker()
    worker._settings = SimpleNamespace(caos_report_lease_seconds=2)
    worker._inflight_claims[report_id] = ReportClaim(report_id, owner, 1)
    await asyncio.sleep(0.08)
    heartbeat_at = datetime.now(timezone.utc)
    await worker._heartbeat()

    async with AsyncSessionLocal() as session:
        report = await session.get(IssuerResearchReport, report_id)
    assert report.status == "running"
    assert report.worker_id == owner and report.attempts == 1
    assert report.lease_expires_at > heartbeat_at + timedelta(seconds=1)


@requires_pg
@pytest.mark.asyncio
async def test_sibling_worker_reclaims_expired_report_as_new_fenced_attempt(seeded_db):
    """A crashed owner's expired lease is reclaimable without reusing its fence."""
    from datetime import datetime, timedelta, timezone

    from database import AsyncSessionLocal, IssuerResearchReport
    from research_report_executor import ReportQueueWorker

    report_id = await _seed_durable_report(suffix="sibling-reclaim")
    async with AsyncSessionLocal() as session:
        report = await session.get(IssuerResearchReport, report_id)
        report.status = "running"
        report.attempts = 1
        report.worker_id = "crashed-sibling"
        report.lease_expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        await session.commit()

    claim = await ReportQueueWorker()._claim_one()
    assert claim is not None and claim.report_id == report_id
    assert claim.attempt == 2
    assert claim.owner_token != "crashed-sibling"

    async with AsyncSessionLocal() as session:
        report = await session.get(IssuerResearchReport, report_id)
    assert report.status == "running"
    assert report.attempts == 2 and report.worker_id == claim.owner_token


@requires_pg
@pytest.mark.asyncio
async def test_stale_report_completion_is_rejected_after_sibling_reclaim(
    seeded_db, monkeypatch
):
    """An old synthesis may finish, but its terminal payload cannot clobber the
    sibling attempt that reclaimed the durable row."""
    import asyncio
    from datetime import datetime, timedelta, timezone

    import research_report_executor
    from database import AsyncSessionLocal, IssuerResearchReport
    from research_report import ResearchReportResult

    report_id = await _seed_durable_report(suffix="stale-completion")
    async with AsyncSessionLocal() as session:
        report = await session.get(IssuerResearchReport, report_id)
        report.status = "running"
        report.attempts = 1
        report.worker_id = "old-owner"
        report.lease_expires_at = datetime.now(timezone.utc) + timedelta(minutes=1)
        await session.commit()

    entered = asyncio.Event()
    release = asyncio.Event()

    async def delayed_synthesis(**_kwargs):
        entered.set()
        await release.wait()
        return ResearchReportResult(
            payload={"masthead": {}, "bottom_line": {}, "key_metrics": [], "sections": []},
            demo=False,
        )

    monkeypatch.setattr(
        research_report_executor, "synthesize_research_report", delayed_synthesis
    )
    stale_task = asyncio.create_task(research_report_executor._run_report(
        report_id, owner_token="old-owner", attempt=1
    ))
    await entered.wait()

    async with AsyncSessionLocal() as session:
        report = await session.get(IssuerResearchReport, report_id)
        report.attempts = 2
        report.worker_id = "new-owner"
        report.lease_expires_at = datetime.now(timezone.utc) + timedelta(minutes=2)
        await session.commit()

    release.set()
    await stale_task

    async with AsyncSessionLocal() as session:
        report = await session.get(IssuerResearchReport, report_id)
    assert report.status == "running"
    assert report.attempts == 2 and report.worker_id == "new-owner"
    assert report.payload is None and report.markdown is None
