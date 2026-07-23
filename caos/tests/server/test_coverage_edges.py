"""Narrow branch tests for defensive paths left by the main server suite.

These cases are deliberately small: each protects a fail-closed or degradation
branch that is difficult to reach through the end-to-end API fixtures.
"""

from __future__ import annotations

import asyncio
import importlib
import json
import logging.config
import re
import runpy
import sys
from contextlib import asynccontextmanager, nullcontext
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from analysis_contracts import ArtifactRef
from engine.capstructure import synthesize_recovery_preference
from engine.catalysts import build_register
from engine.analyst import ValidatedClaim, _question_for
from engine.anomaly import Anomaly
from engine.earnings import synthesize_earnings_delta
from engine.entailment import EntailmentClaim, _format_evidence
from engine.gate import committee_status_from
from engine.metrics import derive_energy_cost_pct, extract_cost_facts
from engine import adjusted, anomaly as anomaly_module, autonomy, budget, cp1_sources, grounding, liquidity, llm_safety, metricengine, metricfactlane, peers, presets, prompt_bundles, queryoverlay, registry, reported_cp1, rerank as rerank_module, scenario_network, specialized_modules
from engine.eval import _num
from engine.planner import ReadinessEntry, _propagate_limitations, _topological_order
from engine.registry import FINANCIALS, ModuleSpec
from engine.reporter import compose_draft_report
from engine.schemas import ClaimSpec, EvidenceSpec, ModulePayload, validate_payload
from engine.textscan import _to_musd, amount_musd
import avscan
import context_lineage
import freshness
import identity
import lineage_service
import llm
import notification_service
import rate_limit
import run as run_launcher
import scenario as scenario_module
import seed
import deepresearch
import erase_analyst
from scripts import reconcile_lineage
from run_inputs import snapshot_run_inputs
import tenancy
from retrieval_types import CorpusHit
from routes import chat as chat_route
from routes import autonomy as autonomy_route
from routes import notifications as notifications_route
from routes import qa as qa_route
from routes import scenario as scenario_route
from routes import health as health_route


def _payload(module_id: str, runtime_output: dict) -> ModulePayload:
    return ModulePayload(module_id, "Test", "test_object", runtime_output)


def test_earnings_claim_can_be_grounded_by_ebitda_alone() -> None:
    """A missing revenue comparison must not suppress an EBITDA delta claim."""
    cp1 = _payload("CP-1", {
        "normalized_financials": {
            "revenue": {"FY2025": 1_000.0},
            "adj_ebitda": {"FY2024": 100.0, "FY2025": 120.0},
        }
    })

    result = synthesize_earnings_delta(cp1)

    assert result.confidence == "High"
    assert "adjusted EBITDA grew 20%" in result.claims[0].claim_text
    assert "revenue" not in result.claims[0].claim_text.lower()


def test_cost_fact_skips_claims_without_evidence() -> None:
    evidence = EvidenceSpec(
        "E-2", "sourced_fact", "Directly Sourced", "page 2", "High",
        resolved_chunk_id="chunk-2",
    )
    payload = _payload("CP-2", {"energy_cost_pct": 12.5})
    payload.claims = [
        ClaimSpec("C-1", "Unsupported claim"),
        ClaimSpec("C-2", "Supported claim", [evidence]),
    ]

    [fact] = extract_cost_facts("run-1", payload, "Passed")

    assert fact["source_claim_id"] == "C-2"
    assert fact["source_evidence_id"] == "E-2"
    assert fact["document_chunk_id"] == "chunk-2"


def test_energy_cost_percentage_outside_domain_is_rejected() -> None:
    assert derive_energy_cost_pct([
        ("chunk", "10-K", "Energy was 150 percent of cost of goods sold."),
    ]) is None


def test_entailment_prompt_includes_trusted_computed_numbers() -> None:
    rendered = _format_evidence(EntailmentClaim(
        index=0,
        text="Leverage is 4.5x.",
        evidence_numbers=[4.5, 125.0],
    ))

    assert rendered == "Computed figures (trusted): 4.5, 125"


def test_not_reviewed_status_is_draft_only() -> None:
    assert committee_status_from("Not Reviewed", "High") == "Draft Only"


def test_rate_limiter_sweeps_expired_windows(monkeypatch: pytest.MonkeyPatch) -> None:
    rate_limit.reset()
    try:
        rate_limit._windows.update(
            {f"expired-{index}": (0.0, 1) for index in range(rate_limit._SWEEP_THRESHOLD + 1)}
        )
        monkeypatch.setattr(rate_limit.time, "monotonic", lambda: 100.0)

        assert rate_limit.hit("current", max_attempts=1, window_seconds=10)
        assert list(rate_limit._windows) == ["current"]
    finally:
        rate_limit.reset()


def test_catalyst_register_tolerates_missing_optional_inputs() -> None:
    cp1b = _payload("CP-1B", {
        "monitoring_signals": ["Margin watch"],
        "summary": {},
    })

    register = build_register({"CP-1B": cp1b})

    assert register == [{
        "event": "Confirm/refute: Margin watch",
        "type": "earnings",
        "horizon": "next reporting period",
        "impact": "HIGH",
        "source": "CP-1B",
    }]


def test_recovery_reports_unsized_senior_tranche_limitation() -> None:
    async def retrieve(_query: str, _limit: int):
        return [
            SimpleNamespace(
                chunk_id="senior",
                text="The first-lien term loan amount is undisclosed.",
            ),
            SimpleNamespace(
                chunk_id="junior",
                text="The second-lien term loan is $100 million.",
            ),
        ]

    cp1 = _payload("CP-1", {
        "normalized_financials": {"adj_ebitda": {"FY2025": 100.0}},
    })

    result = asyncio.run(synthesize_recovery_preference(retrieve, cp1))

    assert any("unsized senior tranche" in flag for flag in result.limitation_flags)
    assert result.runtime_output["tranches"][1]["recovery_pct"] is None


def test_analyst_question_renders_each_optional_context() -> None:
    base = dict(
        kind="ts-jump",
        direction="up",
        severity=4.0,
        issuer_id="issuer-1",
        issuer_name="Acme",
        metric="net_leverage",
        chunk_id=None,
    )

    change_point = _question_for(Anomaly(
        **base, context={"change_point_period": "FY2025"},
    ))
    peer = _question_for(Anomaly(
        **base, context={"peer_scope": "same-industry"},
    ))
    bare = _question_for(Anomaly(**base))

    assert "Change-point at FY2025" in change_point
    assert "Peer scope: same-industry" in peer
    assert "Change-point" not in bare and "Peer scope" not in bare


def test_reporter_renders_claim_without_known_issuer() -> None:
    claim = ValidatedClaim(
        text="Unassigned signal.",
        claim_type="risk-flag",
        issuer_id=None,
        anomaly_kind="orphan",
        anomaly_severity=3.0,
    )

    draft = asyncio.run(compose_draft_report(None, [], [claim]))

    [section] = draft["sections"]
    assert section["issuer_id"] is None
    assert section["issuer_name"] == "Unknown"
    assert section["exhibit"] == []
    assert section["max_severity"] == 0.0


def test_planner_ignores_external_dependencies_and_deduplicates_flags() -> None:
    cp0 = ModuleSpec("CP-0", "Readiness", "L0", "readiness", implemented=True)
    child = ModuleSpec(
        "CP-1", "Foundation", "L1", "foundation",
        depends_on=("EXTERNAL",),
        required_sources=frozenset({FINANCIALS}),
        implemented=True,
    )
    assert _topological_order([child, cp0]) == ["CP-0", "CP-1"]

    readiness = [
        ReadinessEntry("CP-0", "Readiness", "L0", "Full Run", "Yes"),
        ReadinessEntry(
            "CP-1", "Foundation", "L1", "Ready with Limitations", "No",
            limitation_flags=["General source gap."],
        ),
    ]
    specs = {"CP-0": cp0, "CP-1": child}

    assert _propagate_limitations(
        ["No covenant package vaulted."], ["CP-0", "CP-1"], specs, readiness,
    ) == []
    limitations = _propagate_limitations(
        ["General source gap."], ["CP-0", "CP-1"], specs, readiness,
    )

    assert limitations[0].affected_modules == ["CP-1"]
    assert readiness[1].limitation_flags == ["General source gap."]


def test_avscan_reply_accepts_clean_eof_without_terminator() -> None:
    class Socket:
        def recv(self, _size: int) -> bytes:
            return b""

    assert avscan._recv_reply(Socket()) == b""


def test_chat_client_cache_and_empty_response_failure(monkeypatch: pytest.MonkeyPatch) -> None:
    cached = object()
    monkeypatch.setattr(llm, "_client", cached)
    assert llm._get_client() is cached

    monkeypatch.setattr(llm, "llm_configured", lambda: True)

    async def create(*_args, **_kwargs):
        return SimpleNamespace(content=[], stop_reason="end_turn")

    monkeypatch.setattr(llm.llm_client, "create", create)
    with pytest.raises(RuntimeError, match="Model returned no text"):
        asyncio.run(llm.ask_issuer([llm.ChatTurn(role="user", content="hello")]))


def test_textscan_defensive_parse_and_non_usd_forward_fallback() -> None:
    class InvalidAmount:
        def group(self, index: int) -> str | None:
            return {1: "$", 2: "not-a-number", 3: "million"}[index]

    assert _to_musd(InvalidAmount()) is None
    assert amount_musd(
        "$5 million senior pool includes a term loan of £10 million",
        re.compile("term loan"),
    ) == 5.0


def test_context_lineage_rejects_unknown_legacy_field_and_missing_context() -> None:
    with pytest.raises(ValueError, match="unsupported legacy artifact field"):
        context_lineage.merge_artifact_refs(
            {}, [], legacy_updates={"unknown_id": "value"},
        )

    class Result:
        def scalar_one_or_none(self):
            return None

    class DB:
        async def execute(self, _statement):
            return Result()

    with pytest.raises(LookupError, match="analysis context not found"):
        asyncio.run(context_lineage.bind_context_artifacts(
            DB(), context_id="missing", analyst_id="analyst", refs=[],
        ))


def _liquidity_cp1() -> ModulePayload:
    return _payload("CP-1", {
        "normalized_financials": {
            "adj_ebitda": {"FY2025": 100.0},
            "interest_coverage_ltm": 2.0,
        }
    })


def test_liquidity_runway_degrades_when_safe_division_fails(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(liquidity, "safe_div", lambda *_args: None)
    assert liquidity._interest_runway_months(100.0, _liquidity_cp1()) == (None, None)


def test_liquidity_runway_degrades_when_rounded_result_is_nonfinite(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    values = iter([50.0, float("nan")])
    monkeypatch.setattr(liquidity, "round", lambda *_args: next(values), raising=False)
    assert liquidity._interest_runway_months(100.0, _liquidity_cp1()) == (None, None)


def test_registry_validation_rejects_unknown_and_forward_dependencies(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    unknown = ModuleSpec("CP-0", "Readiness", "L0", "o", depends_on=("MISSING",))
    monkeypatch.setattr(registry, "_SPECS", (unknown,))
    monkeypatch.setattr(registry, "REGISTRY", {"CP-0": unknown})
    monkeypatch.setattr(registry, "DECLARATION_INDEX", {"CP-0": 0})
    with pytest.raises(ValueError, match="unknown module"):
        registry._validate_registry()

    child = ModuleSpec("CP-1", "Child", "L1", "child", depends_on=("CP-0",))
    parent = ModuleSpec("CP-0", "Parent", "L0", "parent")
    monkeypatch.setattr(registry, "_SPECS", (child, parent))
    monkeypatch.setattr(registry, "REGISTRY", {"CP-1": child, "CP-0": parent})
    monkeypatch.setattr(registry, "DECLARATION_INDEX", {"CP-1": 0, "CP-0": 1})
    with pytest.raises(ValueError, match="declared after"):
        registry._validate_registry()


def test_eval_count_treats_missing_and_invalid_values_as_zero() -> None:
    assert _num(SimpleNamespace(), "kept_count") == 0
    assert _num(SimpleNamespace(kept_count="not-an-int"), "kept_count") == 0


def test_identity_rejects_malformed_tokens_and_falls_back_locally(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    assert identity.read_session_token("no-separator", "secret") is None
    raw = "bm90LWpzb24"  # base64url("not-json")
    token = f"{raw}.{identity._sig(raw, 'secret')}"
    assert identity.read_session_token(token, "secret") is None

    request = SimpleNamespace(
        cookies={identity.COOKIE_NAME: "invalid"},
        headers={},
    )
    settings = SimpleNamespace(session_secret="secret", edge_proxy_secret="")
    monkeypatch.setattr(identity, "get_settings", lambda: settings)
    monkeypatch.setattr(identity, "is_deployed", lambda _settings: False)

    result = asyncio.run(identity.get_identity(request, None))
    assert result.source == "local"


def test_llm_safety_rejects_overflow_and_non_object(monkeypatch: pytest.MonkeyPatch) -> None:
    with pytest.raises(ValueError, match="overflows"):
        llm_safety._float_finite("1e999")

    monkeypatch.setattr(llm_safety, "first_json_value", lambda *_args: [1])
    with pytest.raises(ValueError, match="not a JSON object"):
        llm_safety.first_json_object("[1]")


def test_llm_safety_extractor_degrades_on_reply_without_json(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def retrieve(_query: str, _k: int):
        return [SimpleNamespace(chunk_id="c1", text="source text")]

    async def create(*_args, **_kwargs):
        return SimpleNamespace(content=[SimpleNamespace(type="text", text="no JSON")])

    monkeypatch.setattr(llm_safety, "document_egress_allowed", lambda _settings: True)
    monkeypatch.setattr(llm_safety.llm_client, "anthropic_client", lambda _settings: None)
    monkeypatch.setattr(llm_safety.llm_client, "create", create)

    result = asyncio.run(llm_safety.extract_json(
        retrieve, query="query", k=1, system="system",
    ))
    assert result is None


def test_reranker_rejects_boolean_scores_and_short_circuits_empty_head(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def create(*_args, **_kwargs):
        return SimpleNamespace(
            content=[SimpleNamespace(type="text", text='{"scores": [true]}')],
        )

    monkeypatch.setattr(rerank_module.llm_client, "anthropic_client", lambda: None)
    monkeypatch.setattr(rerank_module.llm_client, "create", create)
    hit = CorpusHit("c1", "text", 0.5, "issuer", "doc")
    with pytest.raises(ValueError, match="must be numeric"):
        asyncio.run(rerank_module._score_pairs_llm("query", [hit]))

    settings = SimpleNamespace(rerank_enabled=True, rerank_window=1)
    monkeypatch.setattr(rerank_module, "get_settings", lambda: settings)
    monkeypatch.setattr(rerank_module, "document_egress_allowed", lambda _settings: True)
    monkeypatch.setattr(rerank_module.presets, "can_run_model", lambda _model: True)
    monkeypatch.setattr(rerank_module.presets, "rerank_model", lambda: "test-model")

    hits = [hit]
    assert asyncio.run(rerank_module.rerank(None, "query", hits, k=2, window=1)) is hits
    assert asyncio.run(rerank_module.rerank(None, "query", hits, k=0, window=0)) is hits


def test_lineage_default_flag_can_disable_both_writer_shapes(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        lineage_service, "get_settings",
        lambda: SimpleNamespace(caos_lineage_v2_enabled=False),
    )
    common = dict(
        analyst_id="analyst",
        artifact=None,
        parent=None,
        transform="test",
        transform_version="1",
    )
    assert asyncio.run(lineage_service.write_lineage_edge(
        None, context_id="context", **common,
    )) is None
    assert asyncio.run(lineage_service.write_owned_artifact_lineage_edge(
        None, **common,
    )) is None


def test_notification_insert_supports_postgres_and_generic_dialects() -> None:
    class Session:
        def __init__(self, dialect: str):
            self.dialect = dialect
            self.statements = []

        def get_bind(self):
            return SimpleNamespace(dialect=SimpleNamespace(name=self.dialect))

        async def execute(self, statement):
            self.statements.append(statement)

    run = SimpleNamespace(
        id="run-1", issuer_id="issuer-1", analyst_id="analyst-1",
        status="failed", error=None,
    )
    for dialect in ("postgresql", "other"):
        session = Session(dialect)
        asyncio.run(notification_service._insert_terminal_notification(
            session, run, status="failed", issuer_label="Issuer",
        ))
        assert len(session.statements) == 1

    run.analyst_id = None
    assert asyncio.run(notification_service.emit_run_terminal_notification_fallback(
        None, run,
    )) is None


def test_run_launcher_main_uses_validated_environment(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls = []
    monkeypatch.setenv("PORT", "8123")
    monkeypatch.setenv("HOST", "127.0.0.2")
    monkeypatch.setenv("WEB_CONCURRENCY", "1")
    monkeypatch.setenv("DATABASE_URL", "sqlite:///test.db")
    monkeypatch.setattr(run_launcher.uvicorn, "run", lambda *args, **kwargs: calls.append((args, kwargs)))

    runpy.run_path(run_launcher.__file__, run_name="__main__")

    assert calls[0][1]["port"] == 8123
    assert calls[0][1]["host"] == "127.0.0.2"


def test_chat_payload_cap_rate_limit_and_backend_failure(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    with pytest.raises(ValueError, match="conversation payload too large"):
        chat_route.ChatRequest(messages=[
            chat_route.ChatMessage(role="user", content="x" * 16_000)
            for _ in range(4)
        ])

    body = chat_route.ChatRequest(messages=[
        chat_route.ChatMessage(role="user", content="hello"),
    ])
    caller = identity.CallerIdentity("analyst", "a@example.test", "Analyst")
    monkeypatch.setattr(chat_route.rate_limit, "hit", lambda *_args, **_kwargs: False)
    with pytest.raises(Exception) as limited:
        asyncio.run(chat_route.issuer_chat(body, caller))
    assert limited.value.status_code == 429

    async def fail(_messages):
        raise RuntimeError("backend failed")

    monkeypatch.setattr(chat_route.rate_limit, "hit", lambda *_args, **_kwargs: True)
    monkeypatch.setattr(chat_route, "ask_issuer", fail)
    with pytest.raises(Exception) as unavailable:
        asyncio.run(chat_route.issuer_chat(body, caller))
    assert unavailable.value.status_code == 502


def test_rerank_preset_normalizes_invalid_tier_and_uses_configured_key(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    settings = SimpleNamespace(
        rerank_model_tier="invalid",
        model_tier_cheap="claude-haiku-4-5-20251001",
        model_tier_fast="claude-sonnet-4-6",
        model_tier_strong="claude-sonnet-4-6",
        model_tier_top="claude-opus-4-8",
        anthropic_api_key="key",
        gemini_api_key="",
        openrouter_api_key="",
    )
    monkeypatch.setattr(presets, "get_settings", lambda: settings)

    assert presets.rerank_model() == settings.model_tier_cheap


def test_adjusted_extraction_none_and_llm_fallback_paths(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def no_json(*_args, **_kwargs):
        return None

    monkeypatch.setattr(adjusted, "extract_json", no_json)
    assert asyncio.run(adjusted._llm_addbacks(lambda *_args: None)) is None

    settings = SimpleNamespace(anthropic_api_key="key")
    monkeypatch.setattr(adjusted, "get_settings", lambda: settings)
    monkeypatch.setattr(adjusted.budget, "llm_allowed", lambda: True)

    async def retrieve(_query: str, _limit: int):
        return [SimpleNamespace(
            chunk_id="c1",
            text="Adjusted EBITDA add-backs represent 20 percent of adjusted EBITDA.",
        )]

    async def llm_none(_retrieve):
        return None

    monkeypatch.setattr(adjusted, "_llm_addbacks", llm_none)
    assert asyncio.run(adjusted.extract_addbacks(retrieve))[0] == pytest.approx(0.2)

    async def llm_fails(_retrieve):
        raise RuntimeError("provider failed")

    monkeypatch.setattr(adjusted, "_llm_addbacks", llm_fails)
    assert asyncio.run(adjusted.extract_addbacks(retrieve))[0] == pytest.approx(0.2)

    assert adjusted.derive_addbacks([
        ("bad", "Add-backs represent 150 percent of EBITDA."),
        ("good", "Add-backs represent 10 percent of EBITDA."),
    ])[2] == "good"


def test_query_overlay_caps_routes_edges_and_walks(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    capabilities = [
        {"id": f"cap-{index}", "label": f"Capability {index}", "enabled": True}
        for index in range(5)
    ]

    async def create(*_args, **_kwargs):
        return SimpleNamespace(content=[SimpleNamespace(
            type="text",
            text='{"candidates": [' + ",".join(
                f'{{"id":"cap-{index}","reason":"reason"}}' for index in range(5)
            ) + "]}",
        )])

    monkeypatch.setattr(queryoverlay.llm_client, "anthropic_client", lambda: None)
    monkeypatch.setattr(queryoverlay.llm_client, "create", create)
    routed = asyncio.run(queryoverlay.route("question", capabilities))
    assert len(routed["candidates"]) == queryoverlay._MAX_CANDIDATES

    graph = {
        "nodes": [{"id": f"n{index}"} for index in range(8)],
        "edges": [],
    }
    reply = queryoverlay._OverlayReply.model_validate({
        "edges": [
            {"source": "n0", "target": f"n{index}", "chunk_ids": ["c1"]}
            for index in range(1, 8)
        ],
        "suggested_walks": [f"walk-{index}" for index in range(5)],
    })
    validated = queryoverlay._validate_overlay(
        reply,
        graph,
        {"c1"},
        {f"walk-{index}" for index in range(5)},
        "current",
    )
    assert len(validated["edges"]) == queryoverlay._MAX_EDGES
    assert len(validated["suggested_walks"]) == queryoverlay._MAX_WALKS


def test_query_overlay_refuses_llm_lane_when_document_egress_is_disabled(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def build_graph(*_args, **_kwargs):
        return {"title": "Graph", "nodes": [{"id": "n1", "label": "Node"}], "edges": []}

    monkeypatch.setattr(queryoverlay.querygraph, "build_graph", build_graph)
    monkeypatch.setattr(queryoverlay, "document_egress_allowed", lambda: False)
    with pytest.raises(RuntimeError, match="Document egress is disabled"):
        asyncio.run(queryoverlay.overlay(None, "capability", force=True))


def test_scenario_network_defensive_nonfinite_paths(monkeypatch: pytest.MonkeyPatch) -> None:
    negative = scenario_network.propagate(
        scenario_network.ShockInput(
            issuer_id="issuer", run_id="run", ebitda_pct=0.1, rate_bps=0,
        ),
        {"CP-1": {"normalized_financials": {"adj_ebitda": {"FY2025": -100.0}}}},
    )
    assert negative.nodes[0].status == scenario_network.NodeStatus.NO_DATA

    base_payload = {
        "CP-1": {"normalized_financials": {"adj_ebitda": {"FY2025": 100.0}}},
        "CP-3B": {"tranches": [{
            "tranche": "First lien", "code": "1L", "seniority_rank": 0,
            "amount_musd": 100.0,
        }]},
    }
    monkeypatch.setattr(scenario_network, "recovery_waterfall", lambda *_args: [{
        "recovery_pct": None, "amount_musd": 100.0, "recovery_musd": None,
    }])
    no_weight = scenario_network.propagate(
        scenario_network.ShockInput(
            issuer_id="issuer", run_id="run", ebitda_pct=0.1, rate_bps=0,
        ),
        base_payload,
    )
    assert next(node for node in no_weight.nodes if node.node == "recovery").value is None

    monkeypatch.setattr(scenario_network, "recovery_waterfall", lambda *_args: [{
        "recovery_pct": -100.0, "amount_musd": 100.0, "recovery_musd": -100.0,
    }])
    overflow_payload = {
        **base_payload,
        "CP-3C": {"concentration": {"held_pct_nav": float.fromhex("0x1.fffffffffffffp+1023")}},
    }
    overflow = scenario_network.propagate(
        scenario_network.ShockInput(
            issuer_id="issuer", run_id="run", ebitda_pct=0.1, rate_bps=0,
        ),
        overflow_payload,
    )
    assert next(node for node in overflow.nodes if node.node == "portfolio").value is None


def test_tenancy_scopes_unassigned_portfolios_and_shared_run_access(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    settings = SimpleNamespace(
        caos_tenancy_enabled=True,
        caos_cross_analyst_run_sharing_enabled=True,
    )
    monkeypatch.setattr(tenancy, "get_settings", lambda: settings)
    caller = identity.CallerIdentity(
        "caller", "caller@example.test", "Caller", team_id=None,
    )
    statement = tenancy.scope_portfolios(SimpleNamespace(
        where=lambda condition: ("scoped", condition),
    ), caller)
    assert statement[0] == "scoped"

    run = SimpleNamespace(id="run", analyst_id="other", issuer_id="issuer")

    class DB:
        def __init__(self, issuer):
            self.issuer = issuer

        async def get(self, _model, _id):
            return self.issuer

    with pytest.raises(Exception) as denied:
        asyncio.run(tenancy.require_run_access(
            caller, run, DB(SimpleNamespace(team_id="other-team")),
        ))
    assert denied.value.status_code == 404

    assert asyncio.run(tenancy.require_run_access(
        caller, run, DB(SimpleNamespace(team_id=None)),
    )) is run


def test_qa_routes_rate_limits_create_and_apply_optional_filters(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    caller = identity.CallerIdentity("analyst", "a@example.test", "Analyst")
    monkeypatch.setattr(qa_route.rate_limit, "hit", lambda *_args, **_kwargs: False)
    with pytest.raises(Exception) as findings_limit:
        asyncio.run(qa_route.list_latest_findings(db=None, caller=caller))
    assert findings_limit.value.status_code == 429
    with pytest.raises(Exception) as flag_limit:
        asyncio.run(qa_route.create_flag(
            qa_route.QaFlagCreate(module_id="CP-1"), db=None, caller=caller,
        ))
    assert flag_limit.value.status_code == 429

    monkeypatch.setattr(qa_route.rate_limit, "hit", lambda *_args, **_kwargs: True)

    class CreateDB:
        def add(self, value):
            self.value = value

        async def commit(self):
            pass

        async def refresh(self, value):
            value.id = "flag-1"
            value.created_at = datetime.now(timezone.utc)

    created = asyncio.run(qa_route.create_flag(
        qa_route.QaFlagCreate(module_id="CP-1", note="  note  "),
        db=CreateDB(),
        caller=caller,
    ))
    assert created.id == "flag-1" and created.note == "note"

    class Rows:
        def scalars(self):
            return self

        def all(self):
            return []

    class ListDB:
        async def get(self, _model, _identifier):
            return SimpleNamespace(team_id=None)

        async def execute(self, _statement):
            return Rows()

    assert asyncio.run(qa_route.list_flags(
        module_id=None,
        step_ref="step",
        issuer_id="issuer",
        run_id="run",
        db=ListDB(),
        caller=caller,
    )) == []


def test_peer_benchmark_insufficient_and_nonfinite_comparison_paths(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    own_values = peers._own_values
    empty_cp1 = _payload("CP-1", {"normalized_financials": {}})
    issuer = SimpleNamespace(id="issuer", name="Issuer", industry=None)
    result = asyncio.run(peers.synthesize_peer_benchmark(None, issuer, empty_cp1))
    assert result.confidence == "Insufficient Information"

    async def no_peer_facts(*_args, **_kwargs):
        return {"net_leverage": []}

    monkeypatch.setattr(peers, "_peer_facts", no_peer_facts)
    cp1 = _payload("CP-1", {
        "normalized_financials": {"net_leverage_adj_ltm": 5.0},
    })
    no_peers = asyncio.run(peers.synthesize_peer_benchmark(None, issuer, cp1))
    assert no_peers.confidence == "Insufficient Information"

    monkeypatch.setattr(peers, "_own_values", lambda _cp1: {"net_leverage": float("nan")})

    async def one_peer(*_args, **_kwargs):
        return {"net_leverage": [("peer", 4.0)]}

    monkeypatch.setattr(peers, "_peer_facts", one_peer)

    class Names:
        def all(self):
            return [("peer", "Peer")]

    class DB:
        async def execute(self, _statement):
            return Names()

    degraded = asyncio.run(peers.synthesize_peer_benchmark(DB(), issuer, cp1))
    assert degraded.runtime_output["comparisons"] == []

    monkeypatch.setattr(peers, "safe_div", lambda *_args: None)
    margin_cp1 = _payload("CP-1", {"normalized_financials": {
        "revenue": {"FY2025": 100.0},
        "adj_ebitda": {"FY2025": 20.0},
    }})
    assert "ebitda_margin" not in own_values(margin_cp1)


def test_peer_fact_collapse_keeps_the_better_existing_row() -> None:
    now = datetime.now(timezone.utc)
    best = SimpleNamespace(
        issuer_id="peer", metric_key="net_leverage", value=4.0,
        provenance="run", created_at=now,
    )
    older = SimpleNamespace(
        issuer_id="peer", metric_key="net_leverage", value=5.0,
        provenance="run", created_at=datetime(2020, 1, 1, tzinfo=timezone.utc),
    )

    class Rows:
        def all(self):
            return [(best, None), (older, None)]

    class DB:
        async def execute(self, _statement):
            return Rows()

    result = asyncio.run(peers._peer_facts(
        DB(), SimpleNamespace(id="issuer", industry=None), ["net_leverage"], False,
    ))
    assert result == {"net_leverage": [("peer", 4.0)]}


def test_metric_engine_defensive_derivative_paths(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    unknown_facts = [
        SimpleNamespace(
            issuer_id="issuer", metric_key="not_catalogued", value=value,
            document_chunk_id=None,
        )
        for value in (2.0, 1.0)
    ]
    assert metricengine._delta_entries(unknown_facts, {}, None) == []

    own = SimpleNamespace(
        issuer_id="issuer", value=4.0, document_chunk_id="chunk-1",
    )
    assert metricengine._peerz_entries(
        {"not_catalogued": ([3.0, 5.0], own, "Issuer")}, None,
    ) == []
    assert metricengine._peerz_entries(
        {"net_leverage": ([], own, "Issuer")}, None,
    ) == []

    monkeypatch.setattr(metricengine, "safe_div", lambda *_args: None)
    assert metricengine._robust_z(4.0, [1.0, 2.0, 3.0]) is None


def test_metric_engine_peer_lookup_missing_issuer_and_no_industry() -> None:
    class ScalarResult:
        def __init__(self, value):
            self.value = value

        def scalars(self):
            return self

        def first(self):
            return self.value

    class RowResult:
        def all(self):
            return []

    class MissingIssuerDB:
        async def execute(self, _statement):
            return ScalarResult(None)

    assert asyncio.run(metricengine._peer_values(
        MissingIssuerDB(), "missing", "net_leverage",
    )) == ([], None)

    class NoIndustryDB:
        def __init__(self):
            self.results = iter([
                ScalarResult(SimpleNamespace(industry=None)),
                RowResult(),
                ScalarResult(None),
            ])

        async def execute(self, _statement):
            return next(self.results)

    assert asyncio.run(metricengine._peer_values(
        NoIndustryDB(), "issuer", "net_leverage",
    )) == ([], None)


def test_schema_validation_reports_every_nested_error() -> None:
    bad_evidence = EvidenceSpec(
        "E-1", "invalid", "invalid", "page 1", confidence="invalid",
    )
    payload = ModulePayload(
        "CP-1", "Test", "test_object", {"value": float("nan")},
        claims=[
            ClaimSpec("C-1", "first"),
            ClaimSpec("C-1", "duplicate", [bad_evidence]),
        ],
        schema_family="invalid",
    )
    errors = validate_payload(payload)
    assert "duplicate claim_id 'C-1'" in errors
    assert "C-1: extraction_type 'invalid' invalid" in errors
    assert "C-1: lineage_class 'invalid' invalid" in errors
    assert "C-1: evidence confidence 'invalid' invalid" in errors
    assert "schema_family 'invalid' is invalid" in errors
    assert "runtime_output contains a non-finite number (NaN/inf)" in errors

    payload.runtime_output = []
    assert "runtime_output must be an object" in validate_payload(payload)


def test_grounding_demo_and_unparseable_token(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    grounding.demo()
    assert capsys.readouterr().out == "grounding demo OK\n"

    monkeypatch.setattr(
        grounding, "_NUM_RE", SimpleNamespace(findall=lambda _text: ["invalid"]),
    )
    assert grounding.numbers_in("anything") == []

    runpy.run_path(grounding.__file__, run_name="__main__")
    assert capsys.readouterr().out == "grounding demo OK\n"


def test_metric_fact_lane_defensive_render_and_dedup_paths(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    assert asyncio.run(metricfactlane._raw_facts(None, [], None)) == []

    fact = SimpleNamespace(
        issuer_id="issuer", metric_key="not_catalogued", value=2.0,
        period="LTM", document_chunk_id=None,
    )
    assert metricfactlane._render_entries([fact], {}, {}, None) == []

    fact.metric_key = "net_leverage"
    [rendered] = metricfactlane._render_entries([fact], {}, {}, None)
    assert rendered.numbers == [2.0]

    monkeypatch.delitem(metricfactlane.CATALOG_BY_KEY, "net_leverage")
    assert metricfactlane._match_metric_keys("leverage") == {"net_leverage": 1}

    malformed_derivative = metricengine.MetricFactEntry(
        id="bad", kind="other", label="bad", text="bad", numbers=[],
    )
    raw = metricengine.MetricFactEntry(
        id="bad", kind="metric", label="raw", text="raw", numbers=[],
    )
    assert metricfactlane.dedup_against_derivatives(
        [raw], [malformed_derivative],
    ) == [raw]

    short_derivative = metricengine.MetricFactEntry(
        id="fact:issuer:net_leverage:other", kind="other", label="short",
        text="short", numbers=[1.0], issuer_id="issuer",
    )
    assert metricfactlane.dedup_against_derivatives(
        [raw], [short_derivative],
    ) == [raw]


def test_run_input_snapshot_explicit_empty_and_unavailable_refs() -> None:
    class Rows:
        def __init__(self, values):
            self.values = values

        def scalars(self):
            return self

        def all(self):
            return self.values

    class DB:
        def __init__(self, *results):
            self.results = iter(results)

        async def execute(self, _statement):
            return Rows(next(self.results))

    empty = asyncio.run(snapshot_run_inputs(
        DB(), issuer_id="issuer", analyst_id="analyst", input_refs=[],
    ))
    assert empty.document_ids == [] and empty.state == "empty"

    with pytest.raises(LookupError, match="source manifest"):
        asyncio.run(snapshot_run_inputs(
            DB([]), issuer_id="issuer", analyst_id="analyst",
            input_refs=[ArtifactRef(kind="source_manifest", id="missing")],
        ))

    with pytest.raises(LookupError, match="issuer document"):
        asyncio.run(snapshot_run_inputs(
            DB([]), issuer_id="issuer", analyst_id="analyst",
            input_refs=[ArtifactRef(kind="document", id="missing")],
        ))


def test_default_run_input_snapshot_ignores_unselected_manifest_files() -> None:
    manifest = SimpleNamespace(
        id="manifest", status="ready", authority={"approval_state": "ratified"},
        files=[
            {"document_id": "selected", "sha256": "a", "malware_scan": "clean"},
            {"document_id": "inactive", "sha256": "b", "malware_scan": "clean"},
        ],
    )
    document = SimpleNamespace(id="selected")

    class Rows:
        def __init__(self, values):
            self.values = values

        def scalars(self):
            return self

        def all(self):
            return self.values

    class DB:
        def __init__(self):
            self.results = iter(([manifest], [document]))

        async def execute(self, _statement):
            return Rows(next(self.results))

    snapshot = asyncio.run(snapshot_run_inputs(
        DB(), issuer_id="issuer", analyst_id="analyst", input_refs=None,
    ))
    assert snapshot.document_ids == ["selected"]
    assert snapshot.manifest_ids == ["manifest"]
    assert snapshot.state == "approved"


def test_freshness_invalid_and_defensive_inputs() -> None:
    now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    with pytest.raises(ValueError, match="now"):
        freshness.evaluate_freshness(source_kind="price", now="invalid")

    assert freshness.evaluate_freshness(
        source_kind="price", now=now, observed_at="invalid",
    ).reason == "invalid_observed_at"
    assert freshness.evaluate_freshness(
        source_kind="reported_financials", now=now, observed_at=now,
        effective_period_end="invalid", cadence="quarterly",
    ).reason == "invalid_effective_period_end"
    assert freshness.evaluate_freshness(
        source_kind="reported_financials", now=now,
        effective_period_end="2025-09-30", cadence="weekly",
    ).reason == "reporting_period_unknown"
    assert freshness.evaluate_freshness(
        source_kind="reported_financials", now=now,
        effective_period_end="2025-09-30", cadence="quarterly", grace_days=-1,
    ).reason == "invalid_reporting_policy"
    with pytest.raises(ValueError, match="source_kind"):
        freshness.evaluate_freshness(
            source_kind="unsupported", now=now, observed_at=now,
        )
    assert freshness.worst_freshness([]).reason == "freshness_evidence_missing"


def test_freshness_date_only_parser_fallback(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    real_datetime = datetime

    class DateOnlyFallback:
        @classmethod
        def fromisoformat(cls, _value):
            raise ValueError

        @classmethod
        def combine(cls, value, clock, tzinfo=None):
            return real_datetime.combine(value, clock, tzinfo=tzinfo)

    monkeypatch.setattr(freshness, "datetime", DateOnlyFallback)
    assert freshness._utc("2026-01-02") == real_datetime(
        2026, 1, 2, tzinfo=timezone.utc,
    )


def test_freshness_state_boundaries_and_worst_selection() -> None:
    now = datetime(2026, 1, 10, tzinfo=timezone.utc)
    current_report = freshness.evaluate_freshness(
        source_kind="reported_financials", now=now,
        effective_period_end="2025-12-31", cadence="quarterly",
    )
    due_report = freshness.evaluate_freshness(
        source_kind="reported_financials", now=datetime(2026, 5, 1, tzinfo=timezone.utc),
        effective_period_end="2025-12-31", cadence="quarterly",
    )
    stale_report = freshness.evaluate_freshness(
        source_kind="reported_financials", now=datetime(2026, 7, 1, tzinfo=timezone.utc),
        effective_period_end="2025-12-31", cadence="quarterly",
    )
    assert [current_report.state, due_report.state, stale_report.state] == [
        "current", "due", "stale",
    ]

    def state(kind, days):
        return freshness.evaluate_freshness(
            source_kind=kind, now=now,
            observed_at=now - freshness.timedelta(days=days),
        )

    assert [state("price", days).state for days in (1, 2, 4)] == [
        "current", "due", "stale",
    ]
    assert state("rating", 100).state == "current"
    assert [state("run", days).state for days in (30, 31, 46)] == [
        "current", "due", "stale",
    ]
    assert freshness.evaluate_freshness(
        source_kind="price", now=now,
    ).reason == "observation_time_unknown"
    assert freshness.evaluate_freshness(
        source_kind="price", now=now, observed_at=now + freshness.timedelta(days=1),
    ).reason == "future_observation"
    assert freshness.worst_freshness([
        current_report, due_report, stale_report,
    ]).state == "stale"


def test_autonomy_fingerprint_and_detector_failures(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class IssuerRows:
        def scalars(self):
            return self

        def all(self):
            return ["good", "bad"]

    class DB:
        async def execute(self, _statement):
            return IssuerRows()

    async def fingerprint(_db, issuer_id):
        if issuer_id == "bad":
            raise RuntimeError("bad issuer")
        return "fingerprint"

    monkeypatch.setattr(autonomy, "fingerprint_issuer", fingerprint)
    assert asyncio.run(autonomy._current_fingerprints(DB())) == {
        "good": "fingerprint",
    }

    async def current(_db):
        return {"issuer": "new"}

    async def fail_detector(*_args, **_kwargs):
        raise RuntimeError("detector unavailable")

    async def compose(_db, anomalies, claims):
        assert anomalies == [] and claims == []
        return {"status": "draft"}

    monkeypatch.setattr(autonomy, "_current_fingerprints", current)
    monkeypatch.setattr(autonomy, "detect_tickets", lambda *_args: [SimpleNamespace(
        issuer_id="issuer", kind="changed",
    )])
    monkeypatch.setattr(autonomy, "changed_issuers", lambda _tickets: ["issuer"])
    monkeypatch.setattr(autonomy, "detect_anomalies", fail_detector)
    monkeypatch.setattr(autonomy, "compose_draft_report", compose)
    result = asyncio.run(autonomy.run_cycle(None, {"issuer": "old"}))
    assert result["n_changed"] == 1 and result["n_anomalies"] == 0


def test_prompt_bundle_manifest_contract_errors(
    tmp_path, monkeypatch: pytest.MonkeyPatch,
) -> None:
    module_dir = tmp_path / "CP-4D"
    module_dir.mkdir()
    manifest_path = module_dir / "SHA256SUMS.json"

    manifest_path.write_text("not json", encoding="utf-8")
    with pytest.raises(prompt_bundles.PromptBundleError, match="invalid SHA256"):
        prompt_bundles._manifest("CP-4D", tmp_path)

    manifest_path.write_text(json.dumps({"algorithm": "md5", "files": []}), encoding="utf-8")
    with pytest.raises(prompt_bundles.PromptBundleError, match="sha256 files map"):
        prompt_bundles._manifest("CP-4D", tmp_path)

    with pytest.raises(prompt_bundles.PromptBundleError, match="missing Active"):
        prompt_bundles._ordered_names("CP-4D", {})
    required = {
        "CP-4D_ACTIVE_PROMPT.md": "hash",
        "SCHEMA_REFERENCE.md": "hash",
        "SYSTEM_REFERENCE.md": "hash",
        "unexpected.md": "hash",
    }
    with pytest.raises(prompt_bundles.PromptBundleError, match="unsupported"):
        prompt_bundles._ordered_names("CP-4D", required)
    with pytest.raises(prompt_bundles.PromptBundleError, match="no full-bundle"):
        prompt_bundles.load_prompt_bundle("CP-1", root=tmp_path)

    payload = b"prompt"
    digest = prompt_bundles.hashlib.sha256(payload).hexdigest()
    valid = {
        "algorithm": "sha256",
        "files": {
            "CP-4D_ACTIVE_PROMPT.md": digest,
            "SCHEMA_REFERENCE.md": digest,
            "SYSTEM_REFERENCE.md": digest,
        },
    }
    manifest_path.write_text(json.dumps(valid), encoding="utf-8")
    for name in valid["files"]:
        (module_dir / name).write_bytes(payload)
    with pytest.raises(prompt_bundles.PromptBundleError, match="shared CP-COMMON"):
        prompt_bundles.load_prompt_bundle("CP-4D", root=tmp_path)

    governance = tmp_path / "KNOWLEDGE SOURCES" / "00_GOVERNANCE"
    governance.mkdir(parents=True)
    (governance / "CP-COMMON_PREAMBLE.md").write_bytes(payload)
    monkeypatch.setattr(prompt_bundles, "MAX_BUNDLE_BYTES", 1)
    with pytest.raises(prompt_bundles.PromptBundleError, match="prompt bundle exceeds"):
        prompt_bundles.load_prompt_bundle("CP-4D", root=tmp_path)


def test_anomaly_detector_defensive_numeric_paths(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def series(values: list[float]) -> list[tuple[str, float, None]]:
        return [
            (f"FY{2020 + index}", value, None)
            for index, value in enumerate(values)
        ]
    assert anomaly_module._ts_jump(
        series([1.0, 2.0, float("nan")]), "metric", "issuer", "Issuer",
    ) is None
    assert anomaly_module._ts_jump(
        series([1.0, float("nan"), 3.0]), "metric", "issuer", "Issuer",
    ) is None
    monkeypatch.setattr(anomaly_module, "_robust_z", lambda *_args: None)
    assert anomaly_module._ts_jump(
        series([1.0, 2.0, 3.0]), "metric", "issuer", "Issuer",
    ) is None
    assert anomaly_module._peer_outlier(
        {"issuer": (float("nan"), "industry", None)},
        "issuer", "Issuer", "metric",
    ) is None

    assert anomaly_module._cusum_shift(
        series([float("nan")] * 4), "metric", "issuer", "Issuer",
    ) is None
    downward = anomaly_module._cusum_shift(
        series([1.0, 1.0, float("nan"), 1.0, 0.0]),
        "metric", "issuer", "Issuer",
    )
    assert downward is not None and downward.direction == "down"


def test_anomaly_headline_collapse_and_peer_append(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fact = SimpleNamespace(
        metric_key="net_leverage", issuer_id="issuer", value=5.0,
        document_chunk_id=None,
    )

    class Rows:
        def all(self):
            return [(fact, "Industry"), (fact, "Industry")]

    class DB:
        async def execute(self, _statement):
            return Rows()

    headlines = asyncio.run(anomaly_module._headlines_by_metric(DB()))
    assert headlines["net_leverage"] == {
        "issuer": (5.0, "Industry", None),
    }

    class NameRows:
        def all(self):
            return [("issuer", "Issuer")]

    class NamesDB:
        async def execute(self, _statement):
            return NameRows()

    async def no_series(*_args):
        return {}

    async def one_headline(*_args):
        return {key: {} for key in anomaly_module._KPI_KEYS}

    monkeypatch.setattr(anomaly_module, "_series_by_issuer_metric", no_series)
    monkeypatch.setattr(anomaly_module, "_headlines_by_metric", one_headline)
    monkeypatch.setattr(anomaly_module, "_peer_outlier", lambda *_args: Anomaly(
        kind="peer-outlier", direction="up", severity=4.0,
        issuer_id="issuer", issuer_name="Issuer", metric="net_leverage",
        chunk_id=None,
    ))
    result = asyncio.run(anomaly_module.detect_anomalies(
        NamesDB(), issuer_ids=["issuer"],
    ))
    assert len(result) == len(anomaly_module._KPI_KEYS)


def test_budget_missing_usage_invalid_cost_and_model_prices() -> None:
    active = budget.RunBudget(limit=100)
    budget.set_budget(active)
    try:
        budget.record_usage(SimpleNamespace())
        assert active.used == 0
    finally:
        budget.set_budget(None)

    invalid_cost = SimpleNamespace(
        cost="invalid", input_tokens=10, output_tokens=5,
        cache_read_input_tokens=0, cache_creation_input_tokens=0,
    )
    assert budget._estimated_cost(invalid_cost, "unknown") is None
    for model in (
        "gemini-2.5-pro", "gemini-3.5-flash", "gemini-3-flash-preview",
        "gemini-3.1-flash-lite", "gemini-3.1-pro-preview",
    ):
        assert budget._estimated_cost(invalid_cost, model) is not None


def test_budget_trace_tolerates_billing_and_response_attribute_failures(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import database

    class Session:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        def add(self, record):
            record.id = "record"

        async def commit(self):
            return None

    class Response:
        usage = SimpleNamespace(input_tokens=0, output_tokens=0)
        stop_reason = "stop"

        @property
        def llm_call_id(self):
            return None

        @llm_call_id.setter
        def llm_call_id(self, _value):
            raise AttributeError("immutable")

    monkeypatch.setattr(
        budget, "record_usage", lambda _resp: (_ for _ in ()).throw(ValueError("bad")),
    )
    monkeypatch.setattr(database, "AsyncSessionLocal", Session)
    asyncio.run(budget.trace_llm(Response(), lane="test", model="unknown"))


def test_autonomy_route_staleness_and_enqueue_edges(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    assert autonomy_route._is_stale(SimpleNamespace(
        completed_at=None, created_at=None,
    ))
    assert not autonomy_route._is_stale(SimpleNamespace(
        completed_at=datetime.now(timezone.utc), created_at=None,
    ))

    @asynccontextmanager
    async def not_acquired(*_args):
        yield False

    async def envelope(_db):
        return {"status": "draft"}

    monkeypatch.setattr(autonomy_route.locks, "advisory_lock", not_acquired)
    monkeypatch.setattr(autonomy_route, "_latest_draft_envelope", envelope)
    request = SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace()))
    assert asyncio.run(autonomy_route.refresh_autonomy_draft(
        request, db=None, action="autonomy-refresh",
    )) == {"status": "draft"}

    @asynccontextmanager
    async def acquired(*_args):
        yield True

    async def none(_db):
        return None

    async def enqueue(_db, prior_fingerprints=None):
        assert prior_fingerprints is None
        return "job"

    monkeypatch.setattr(autonomy_route.locks, "advisory_lock", acquired)
    monkeypatch.setattr(autonomy_route.pipeline, "latest_running", none)
    monkeypatch.setattr(autonomy_route.pipeline, "latest_complete", none)
    monkeypatch.setattr(autonomy_route.pipeline, "enqueue_cycle", enqueue)
    assert asyncio.run(autonomy_route.refresh_autonomy_draft(
        request, db=None, action="autonomy-refresh",
    )) == {"status": "draft"}


def test_autonomy_route_preserves_http_errors_and_maps_failures(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    @asynccontextmanager
    async def not_acquired(*_args):
        yield False

    async def http_error(_db):
        raise autonomy_route.HTTPException(409, "conflict")

    monkeypatch.setattr(autonomy_route.locks, "advisory_lock", not_acquired)
    monkeypatch.setattr(autonomy_route, "_latest_draft_envelope", http_error)
    request = SimpleNamespace(app=None)
    with pytest.raises(autonomy_route.HTTPException) as preserved:
        asyncio.run(autonomy_route.refresh_autonomy_draft(
            request, db=None, action="autonomy-refresh",
        ))
    assert preserved.value.status_code == 409

    @asynccontextmanager
    async def broken_lock(*_args):
        raise RuntimeError("database unavailable")
        yield

    monkeypatch.setattr(autonomy_route.locks, "advisory_lock", broken_lock)
    with pytest.raises(autonomy_route.HTTPException) as mapped:
        asyncio.run(autonomy_route.refresh_autonomy_draft(
            request, db=None, action="autonomy-refresh",
        ))
    assert mapped.value.status_code == 503


def test_cp1_source_edgar_precedence_resolves_all_evidence(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    payload = _payload("CP-1", {})
    payload.claims = [ClaimSpec(
        "C-1", "claim", [
            EvidenceSpec("E-1", "sourced_fact", "Directly Sourced", "line 1"),
            EvidenceSpec("E-2", "sourced_fact", "Directly Sourced", "line 2"),
        ],
    )]
    build = SimpleNamespace(payload=payload, facts_text="facts", cik="123")

    async def to_thread(*_args):
        return build

    async def vault(*_args):
        return "chunk"

    monkeypatch.setattr(
        cp1_sources, "get_settings",
        lambda: SimpleNamespace(edgar_user_agent="configured"),
    )
    monkeypatch.setattr(cp1_sources.asyncio, "to_thread", to_thread)
    monkeypatch.setattr(cp1_sources, "vault_edgar_facts", vault)
    issuer = SimpleNamespace(id="issuer", ticker="TICK")
    result = asyncio.run(cp1_sources.synthesize_cp1_reported(
        None, issuer, "Issuer", None, {}, None,
    ))
    assert result is payload
    assert all(
        evidence.resolved_chunk_id == "chunk"
        for claim in result.claims for evidence in claim.evidence
    )


def test_cp1_edgar_vault_refreshes_or_recreates_existing_chunk() -> None:  # noqa: C901 — many asserted branches, not decision logic
    issuer = SimpleNamespace(id="issuer")
    document = SimpleNamespace(id="document")
    chunk = SimpleNamespace(id="chunk", text="old")

    class Result:
        def __init__(self, value):
            self.value = value

        def scalar_one_or_none(self):
            return self.value

        def scalars(self):
            return self

        def first(self):
            return self.value

    class DB:
        def __init__(self, values):
            self.values = iter(values)
            self.added = []

        async def execute(self, _statement):
            return Result(next(self.values))

        async def flush(self):
            for value in self.added:
                if getattr(value, "id", None) is None:
                    value.id = "new-chunk"

        def add(self, value):
            self.added.append(value)

    refreshed_db = DB([document, chunk])
    assert asyncio.run(cp1_sources.vault_edgar_facts(
        refreshed_db, issuer, "new facts",
    )) == "chunk"
    assert chunk.text == "new facts"

    recreated_db = DB([document, None])
    assert asyncio.run(cp1_sources.vault_edgar_facts(
        recreated_db, issuer, "facts",
    )) == "new-chunk"
    assert len(recreated_db.added) == 1


def test_specialized_runtime_evidence_tree_and_unsupported_gate() -> None:
    with pytest.raises(ValueError, match="unsupported specialized module"):
        specialized_modules.source_gate("CP-1", [])

    runtime = {
        "evidence_ids": ["root", 3, None],
        "nested": [
            {"evidence_ids": ["child"]},
            [
                {"other": {"evidence_ids": ["leaf"]}},
                "ignored",
            ],
        ],
    }
    assert specialized_modules.runtime_evidence_ids(runtime) == {
        "root", "child", "leaf",
    }


def test_reported_amount_defensive_conversion_paths(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class Match:
        def __init__(self, number: str, scale: str = ""):
            self.number = number
            self.scale = scale

        def group(self, index):
            return {1: "£", 2: self.number, 3: self.scale}[index]

        def start(self, _index=None):
            return 0

        def end(self):
            return 1

    class Pattern:
        def __init__(self, match):
            self.match = match

        def search(self, _text):
            return self.match

    assert reported_cp1._amount(Pattern(Match("invalid")), "text") is None
    assert reported_cp1._amount(Pattern(Match("nan")), "text") is None

    monkeypatch.setattr(reported_cp1, "safe_mul", lambda *_args: None)
    assert reported_cp1._amount(Pattern(Match("2", "billion")), "text") is None
    assert reported_cp1._amount(Pattern(Match("2000", "thousand")), "text")[0] == 2.0
    assert reported_cp1._amount(Pattern(Match("10000000")), "text")[0] == 10.0
    monkeypatch.setattr(reported_cp1, "safe_div", lambda *_args: None)
    assert reported_cp1._amount(Pattern(Match("2", "thousand")), "text") is None
    assert reported_cp1._amount(Pattern(Match("10000000")), "text") is None

    assert reported_cp1._amount(
        reported_cp1._EBITDA_AMOUNT,
        "Adjusted EBITDA rose £12.3 million without a current level.",
    )[0] == 12.3


def test_reported_disclosure_picker_keeps_first_equal_candidate() -> None:
    chunks = [
        ("first", "Results to March 2026. value"),
        ("second", "Results to March 2026. value"),
    ]
    result, incompatible = reported_cp1._pick_for_disclosure(
        chunks, lambda _text: 1.0,
        anchor_cid="anchor", anchor_recency=2026 + 3 / 12,
    )
    assert result == (1.0, "first") and incompatible is False


def test_notifications_cursor_shape_and_feed_edges(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        notifications_route, "get_settings",
        lambda: SimpleNamespace(session_secret="secret"),
    )
    bad_payload = {
        "v": notifications_route._CURSOR_VERSION,
        "analyst_id": "analyst",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "event_id": 3,
    }
    raw = notifications_route.base64.urlsafe_b64encode(
        json.dumps(bad_payload).encode(),
    ).decode().rstrip("=")
    signature = notifications_route.hmac.new(
        b"secret", raw.encode("ascii"), notifications_route.hashlib.sha256,
    ).hexdigest()
    with pytest.raises(notifications_route.HTTPException):
        notifications_route._decode_cursor(
            f"{raw}.{signature}", analyst_id="analyst",
        )

    now = datetime.now(timezone.utc)
    row = SimpleNamespace(
        id="event", kind="complete", subject_kind="run", subject_id="run",
        issuer_id=None, title="Complete", body=None, href=None, seen_at=None,
        created_at=now,
    )

    class Scalars:
        def __init__(self, rows):
            self.rows = rows

        def scalars(self):
            return self

        def all(self):
            return self.rows

    class DB:
        def __init__(self, rows):
            self.rows = rows

        async def execute(self, _statement):
            return Scalars(self.rows)

    caller = SimpleNamespace(id="analyst")
    feed = asyncio.run(notifications_route.list_notifications(
        cursor=None, limit=10, db=DB([row]), caller=caller,
    ))
    assert [item.id for item in feed.items] == ["event"]
    assert feed.next_cursor

    empty = asyncio.run(notifications_route.list_notifications(
        cursor=feed.next_cursor, limit=10, db=DB([]), caller=caller,
    ))
    assert empty.items == [] and empty.next_cursor == feed.next_cursor


def test_notifications_seen_missing_new_and_existing() -> None:
    now = datetime.now(timezone.utc)
    caller = SimpleNamespace(id="analyst")

    class Result:
        def __init__(self, row):
            self.row = row

        def scalar_one_or_none(self):
            return self.row

    class DB:
        def __init__(self, row):
            self.row = row

        async def execute(self, _statement):
            return Result(self.row)

    with pytest.raises(notifications_route.HTTPException) as missing:
        asyncio.run(notifications_route.mark_notification_seen(
            "missing", db=DB(None), caller=caller,
        ))
    assert missing.value.status_code == 404

    def event(seen_at):
        return SimpleNamespace(
            id="event", kind="complete", subject_kind="run", subject_id="run",
            issuer_id=None, title="Complete", body=None, href=None,
            seen_at=seen_at, created_at=now,
        )
    unseen = event(None)
    assert asyncio.run(notifications_route.mark_notification_seen(
        "event", db=DB(unseen), caller=caller,
    )).seen_at is not None
    seen = event(now)
    assert asyncio.run(notifications_route.mark_notification_seen(
        "event", db=DB(seen), caller=caller,
    )).seen_at == now


def test_operator_cli_entry_points(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    assert erase_analyst.main([]) == 2
    assert "usage:" in capsys.readouterr().err

    async def erased(_email, _aliases=()):
        return {"profiles": 1}

    monkeypatch.setattr(erase_analyst, "erase_by_email", erased)
    assert erase_analyst.main([" analyst@example.com "]) == 0
    assert "analyst@example.com" in capsys.readouterr().out

    async def reconciled(_args):
        return 7

    monkeypatch.setattr(reconcile_lineage, "_run", reconciled)
    monkeypatch.setattr(reconcile_lineage.sys, "argv", [
        "reconcile_lineage", "--mode", "dry-run", "--limit", "2",
    ])
    assert reconcile_lineage.main() == 7

    monkeypatch.setattr(reconcile_lineage.sys, "argv", ["reconcile_lineage"])
    with pytest.raises(SystemExit) as reconcile_exit:
        runpy.run_path(reconcile_lineage.__file__, run_name="__main__")
    assert reconcile_exit.value.code == 2
    with pytest.raises(SystemExit) as erase_exit:
        runpy.run_path(erase_analyst.__file__, run_name="__main__")
    assert erase_exit.value.code == 2


def test_scenario_routes_rate_limits_mismatch_and_propagation(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    caller = SimpleNamespace(id="analyst")
    monkeypatch.setattr(scenario_route.rate_limit, "hit", lambda *_args, **_kwargs: False)
    with pytest.raises(scenario_route.HTTPException) as limited:
        asyncio.run(scenario_route.scenario_nl(
            scenario_route.ScenarioRequest(text="rate hike"), caller=caller,
        ))
    assert limited.value.status_code == 429

    body = scenario_route.ShockInput(
        issuer_id="issuer", run_id="run", ebitda_pct=-0.1,
    )
    with pytest.raises(scenario_route.HTTPException) as propagate_limited:
        asyncio.run(scenario_route.scenario_propagate(
            body, db=None, caller=caller,
        ))
    assert propagate_limited.value.status_code == 429

    monkeypatch.setattr(scenario_route.rate_limit, "hit", lambda *_args, **_kwargs: True)

    async def accessible(_caller, run, _db):
        return run

    monkeypatch.setattr(scenario_route, "require_run_access", accessible)

    class Rows:
        def scalars(self):
            return self

        def all(self):
            return []

    class DB:
        def __init__(self, issuer_id):
            self.run = SimpleNamespace(
                issuer_id=issuer_id, status="complete", qa_status="Passed",
                committee_status="Committee Ready",
            )

        async def get(self, _model, _id):
            return self.run

        async def execute(self, _statement):
            return Rows()

    with pytest.raises(scenario_route.HTTPException) as mismatch:
        asyncio.run(scenario_route.scenario_propagate(
            body, db=DB("other"), caller=caller,
        ))
    assert mismatch.value.status_code == 404

    monkeypatch.setattr(
        scenario_route, "propagate",
        lambda shock, payload, source: (shock, payload, source),
    )
    shock, payload, source = asyncio.run(scenario_route.scenario_propagate(
        body, db=DB("issuer"), caller=caller,
    ))
    assert shock is body and payload == {}
    assert source.included_modules == []


def test_health_readiness_reports_worker_and_database_degradation(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class DB:
        def __init__(self, error=False):
            self.error = error

        async def execute(self, _statement):
            if self.error:
                raise RuntimeError("database offline")

    class Healthy:
        def health(self):
            return {"status": "ok"}

    class Broken:
        def health(self):
            raise RuntimeError("worker offline")

    state = SimpleNamespace(
        executor=Healthy(), research_executor=Broken(),
        pipeline_executor=object(),
    )
    request = SimpleNamespace(app=SimpleNamespace(state=state))
    response = health_route.Response()
    degraded = asyncio.run(health_route.health(
        request, response, db=DB(error=True),
    ))
    assert degraded.status == "degraded" and degraded.db == "error"
    assert degraded.workers == {
        "runs": "ok", "research": "degraded", "autonomy": "ok",
        "reports": "degraded",
    }
    assert response.status_code == 503

    all_healthy = SimpleNamespace(
        executor=Healthy(), research_executor=Healthy(),
        pipeline_executor=Healthy(), research_report_executor=Healthy(),
    )
    monkeypatch.setattr(health_route, "llm_configured", lambda: True)
    response = health_route.Response()
    ready = asyncio.run(health_route.health(
        SimpleNamespace(app=SimpleNamespace(state=all_healthy)), response, db=DB(),
    ))
    assert ready.status == "ok" and ready.llm == "configured"
    assert response.status_code == 200


def test_migration_0059_name_preflight_and_populated_upgrade(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    migration = importlib.import_module(
        "migrations.versions.0059_issuer_identity_uniqueness",
    )

    class Rows:
        def __init__(self, rows):
            self.rows = rows

        def mappings(self):
            return self

        def __iter__(self):
            return iter(self.rows)

        def all(self):
            return self.rows

    class Connection:
        def __init__(self, rows):
            self.rows = rows
            self.calls = 0

        def execute(self, *_args):
            self.calls += 1
            return Rows(self.rows)

    with pytest.raises(RuntimeError, match="blank normalized name"):
        migration._preflight_existing_names(Connection([
            {"id": "1", "name": " ", "team_id": None},
        ]))
    with pytest.raises(RuntimeError, match="duplicate normalized issuer"):
        migration._preflight_existing_names(Connection([
            {"id": "1", "name": " Acme ", "team_id": None},
            {"id": "2", "name": "acme", "team_id": None},
        ]))
    migration._preflight_existing_names(Connection([
        {"id": "1", "name": "Acme", "team_id": None},
        {"id": "2", "name": "Beta", "team_id": "team"},
    ]))

    connection = Connection([
        {"id": "1", "name": " Acme ", "team_id": None},
    ])
    operation = MagicMock()
    operation.get_bind.return_value = connection
    monkeypatch.setattr(migration, "op", operation)
    monkeypatch.setattr(migration, "_preflight_existing_names", lambda _connection: None)
    migration.upgrade()
    assert connection.calls == 2


def test_migration_0057_fingerprints_online_gate_and_duplicate_backfill(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    migration = importlib.import_module(
        "migrations.versions.0057_model_workbook_import_idempotency",
    )
    operation = MagicMock()
    operation.get_context.return_value.as_sql = True
    monkeypatch.setattr(migration, "op", operation)
    with pytest.raises(RuntimeError, match="online-only"):
        migration._require_online("upgrade")

    base = {
        "id": "1", "analyst_id": "analyst", "issuer_id": "issuer",
        "workbook_sha256": "hash", "committed_revision": 1,
    }
    assert len(migration._fingerprint({**base, "mapping": {"a": 1}})) == 64
    assert len(migration._fingerprint({**base, "mapping": '{"a": 1}'})) == 64
    assert len(migration._fingerprint({**base, "mapping": "invalid-json"})) == 64

    rows = [{**base, "mapping": {}}, {**base, "id": "2", "mapping": {}}]

    class Rows:
        def mappings(self):
            return self

        def all(self):
            return rows

    connection = MagicMock()
    connection.execute.side_effect = [Rows(), None, None]
    operation = MagicMock()
    operation.get_bind.return_value = connection
    monkeypatch.setattr(migration, "op", operation)
    monkeypatch.setattr(migration, "_require_online", lambda _operation: None)
    migration.upgrade()
    assert connection.execute.call_count == 3

    monkeypatch.setattr(migration, "_v2_evidence_count", lambda _connection: 1)
    with pytest.raises(RuntimeError, match="model-v2 evidence exists"):
        migration.downgrade()


def test_migration_0062_normalizes_payload_shapes_and_versions(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    migration = importlib.import_module(
        "migrations.versions.0062_sector_review_version",
    )
    rows = [
        {"id": "1", "analyst_id": "a", "sector": "Tech", "payload": '{"authority": {}}'},
        {"id": "2", "analyst_id": "a", "sector": "Tech", "payload": "invalid"},
        {"id": "3", "analyst_id": "b", "sector": "Tech", "payload": []},
        {"id": "4", "analyst_id": "b", "sector": "Tech", "payload": {"authority": "legacy"}},
    ]

    class Rows:
        def mappings(self):
            return self

        def all(self):
            return rows

    bind = MagicMock()
    bind.execute.side_effect = [Rows(), None, None, None, None]
    operation = MagicMock()
    operation.get_bind.return_value = bind
    monkeypatch.setattr(migration, "op", operation)
    migration.upgrade()

    updates = [call.args[1] for call in bind.execute.call_args_list[1:]]
    assert [item["version"] for item in updates] == [1, 2, 1, 2]
    assert updates[0]["payload"]["authority"]["version_id"] == "v1"
    assert all(isinstance(item["payload"], dict) for item in updates)


def test_alembic_environment_offline_entry_point(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import alembic

    config = SimpleNamespace(
        config_file_name="alembic.ini", config_ini_section="alembic",
        set_main_option=MagicMock(),
        get_main_option=MagicMock(return_value="sqlite:///test"),
        get_section=MagicMock(return_value={}),
    )
    context = SimpleNamespace(
        config=config, configure=MagicMock(), begin_transaction=lambda: nullcontext(),
        run_migrations=MagicMock(), is_offline_mode=lambda: True,
    )
    monkeypatch.setattr(alembic, "context", context)
    monkeypatch.setattr(logging.config, "fileConfig", MagicMock())
    sys.modules.pop("migrations.env", None)
    try:
        importlib.import_module("migrations.env")
        context.configure.assert_called_once()
        context.run_migrations.assert_called_once()
    finally:
        sys.modules.pop("migrations.env", None)


def test_scenario_translation_live_and_fallback_edges(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    assert scenario_module._demo_translate("hawkish rate hike").rate_delta == 0.01
    assert scenario_module._demo_translate("dovish rate cut").rate_delta == -0.01

    monkeypatch.setattr(
        scenario_module, "get_settings",
        lambda: SimpleNamespace(anthropic_api_key="configured"),
    )
    monkeypatch.setattr(
        scenario_module.llm_client, "anthropic_client", lambda _settings: object(),
    )

    async def create_no_json(*_args, **_kwargs):
        return SimpleNamespace(content=[SimpleNamespace(type="tool", text="ignored")])

    monkeypatch.setattr(scenario_module.llm_client, "create", create_no_json)
    with pytest.raises(scenario_module.ScenarioError, match="no JSON"):
        asyncio.run(scenario_module._llm_translate("stress"))

    async def create_json(*_args, **_kwargs):
        return SimpleNamespace(content=[SimpleNamespace(
            type="text", text='prefix {"rate_delta": 0.01, "label": "Rates"} suffix',
        )])

    monkeypatch.setattr(scenario_module.llm_client, "create", create_json)
    assert asyncio.run(scenario_module._llm_translate("stress")).rate_delta == 0.01

    async def live(_text):
        return scenario_module.ScenarioSpec(rate_delta=0.01)

    monkeypatch.setattr(scenario_module, "_llm_translate", live)
    assert asyncio.run(scenario_module.translate_scenario("stress")).rate_delta == 0.01

    async def invalid(_text):
        raise scenario_module.ScenarioError("invalid")

    monkeypatch.setattr(scenario_module, "_llm_translate", invalid)
    with pytest.raises(scenario_module.ScenarioError, match="invalid"):
        asyncio.run(scenario_module.translate_scenario("stress"))

    async def unavailable(_text):
        raise RuntimeError("offline")

    monkeypatch.setattr(scenario_module, "_llm_translate", unavailable)
    assert asyncio.run(scenario_module.translate_scenario("rate hike")).rate_delta == 0.01


def test_seed_helpers_cover_insert_backfill_skip_and_derivation(  # noqa: C901 — many asserted branches, not decision logic
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class Result:
        def __init__(self, value):
            self.value = value

        def scalar(self):
            return self.value

        def all(self):
            return self.value

    class Session:
        def __init__(self, *, gets=(), results=()):
            self.gets = iter(gets)
            self.results = iter(results)
            self.added = []

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def get(self, *_args):
            return next(self.gets)

        def add(self, value):
            self.added.append(value)

        async def flush(self):
            for value in self.added:
                if hasattr(value, "id") and value.id is None:
                    value.id = "assigned"

        async def commit(self):
            return None

        async def execute(self, _statement):
            return Result(next(self.results))

    existing_without_figi = SimpleNamespace(figi=None)
    existing_with_figi = SimpleNamespace(figi="existing")
    issuer_session = Session(gets=[None, existing_without_figi, existing_with_figi])
    monkeypatch.setattr(seed, "AsyncSessionLocal", lambda: issuer_session)
    asyncio.run(seed.seed_demo_data())
    assert existing_without_figi.figi == seed.DEMO_ISSUERS[1]["figi"]
    assert len(issuer_session.added) == 1

    document_session = Session(results=[1, 0, 1])
    monkeypatch.setattr(seed, "AsyncSessionLocal", lambda: document_session)
    asyncio.run(seed.seed_demo_documents())
    assert any(isinstance(value, seed.DocumentChunk) for value in document_session.added)

    metric_session = Session(results=[
        1,
        0, [("chunk", "doc", "energy 20 percent of cost of goods sold")],
        0, [],
        1,
    ])
    derived_results = iter([(20.0, "chunk", "doc"), None])
    monkeypatch.setattr(seed, "derive_energy_cost_pct", lambda _chunks: next(derived_results))
    monkeypatch.setattr(seed, "AsyncSessionLocal", lambda: metric_session)
    asyncio.run(seed.seed_metrics())
    facts = [value for value in metric_session.added if isinstance(value, seed.MetricFact)]
    assert len(facts) == 16
    assert any(fact.provenance == "derived" for fact in facts)
    assert any(
        fact.metric_key == "energy_cost_pct" and fact.provenance == "seed"
        for fact in facts
    )


def test_deep_research_report_source_and_progress_fallbacks() -> None:
    class BrokenBlock:
        type = "web_search_tool_result"

        @property
        def content(self):
            raise RuntimeError("shape changed")

    sources = []
    deepresearch._collect_sources(BrokenBlock(), sources)
    assert sources == []
    assert "No report text was produced" in deepresearch._compose_report([], True)
    assert "No report produced" in deepresearch._compose_report([], False)
    assert deepresearch._compose_report(["report"], True).startswith(
        "> **Report may be incomplete**",
    )

    calls = []

    async def progress(value):
        calls.append(value)

    asyncio.run(deepresearch._emit_progress(None, [], 0))
    asyncio.run(deepresearch._emit_progress(
        progress,
        [deepresearch.Source(title="A", url="https://a"),
         deepresearch.Source(title="A2", url="https://a")],
        2,
    ))
    assert calls == [{"sources": 1, "searches": 2}]

    async def broken_progress(_value):
        raise RuntimeError("sink offline")

    asyncio.run(deepresearch._emit_progress(broken_progress, [], 0))
