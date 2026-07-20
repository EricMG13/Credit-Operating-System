"""Mutation schemas reject pathological values before route work begins."""

from __future__ import annotations

import pytest
from pydantic import ValidationError


@pytest.mark.parametrize(
    ("factory", "field", "value"),
    [
        (
            lambda **kw: __import__("routes.decisions", fromlist=["DecisionCreate"]).DecisionCreate(**{
                "issuer_id": "issuer", "run_id": "run", "action": "approve", **kw,
            }),
            "issuer_id",
            "i" * 37,
        ),
        (
            lambda **kw: __import__("routes.decisions", fromlist=["DecisionCreate"]).DecisionCreate(**{
                "issuer_id": "issuer", "run_id": "run", "action": "approve", **kw,
            }),
            "conditions",
            ["c" * 2_001],
        ),
        (
            lambda **kw: __import__("routes.edgar", fromlist=["VaultExhibitRequest"]).VaultExhibitRequest(**{
                "issuer_id": "issuer", "exhibit_url": "https://www.sec.gov/x", **kw,
            }),
            "exhibit_url",
            "x" * 2_049,
        ),
        (
            lambda **kw: __import__("routes.edgar", fromlist=["VaultExhibitRequest"]).VaultExhibitRequest(**{
                "issuer_id": "issuer", "exhibit_url": "https://www.sec.gov/x", **kw,
            }),
            "doc_type",
            "d" * 65,
        ),
        (
            lambda **kw: __import__("routes.issuers", fromlist=["ResearchReportBrief"]).ResearchReportBrief(**kw),
            "ai_mode",
            "standard" * 2,
        ),
        (
            lambda **kw: __import__("routes.query", fromlist=["QueryRunCreate"]).QueryRunCreate(
                context_id="context", question="question", **kw
            ),
            "selected_lane",
            "grounded" * 2,
        ),
        (
            lambda **kw: __import__("routes.sector", fromlist=["SectorRefreshRequest"]).SectorRefreshRequest(**kw),
            "sector",
            "s" * 129,
        ),
        (
            lambda **kw: __import__("routes.sector", fromlist=["SectorAskRequest"]).SectorAskRequest(**kw),
            "signal_id",
            "s" * 129,
        ),
        (
            lambda **kw: __import__("routes.sector", fromlist=["SectorReviewCreate"]).SectorReviewCreate(
                context_id="context", **kw
            ),
            "as_of",
            "2" * 65,
        ),
        (
            lambda **kw: __import__("routes.thesis", fromlist=["ThesisVersionIn"]).ThesisVersionIn(
                issuer_id="issuer", thesis_md="thesis", **kw
            ),
            "linked_decision_id",
            "d" * 37,
        ),
        (
            lambda **kw: __import__("routes.analysis", fromlist=["ContextCreate"]).ContextCreate(**kw),
            "issuer_ids",
            ["i" * 37],
        ),
        (
            lambda **kw: __import__("routes.chat", fromlist=["ChatMessage"]).ChatMessage(
                content="question", **kw
            ),
            "role",
            "assistantx",
        ),
        (
            lambda **kw: __import__("routes.committee", fromlist=["AgendaCreate"]).AgendaCreate(
                issuer_id="issuer", scheduled_for="2026-07-19T12:00:00Z",
                recommendation="approve", thesis="thesis", **kw
            ),
            "conditions",
            ["c" * 2_001],
        ),
        (
            lambda **kw: __import__("routes.committee", fromlist=["ExceptionRequestIn"]).ExceptionRequestIn(
                expected_revision=1, rationale="rationale", expires_at="2026-07-20", **kw
            ),
            "mitigants",
            ["m" * 2_001],
        ),
        (
            lambda **kw: __import__("routes.opinions", fromlist=["AnalystOpinionIn"]).AnalystOpinionIn(
                stance="NEUTRAL", rationale_md="rationale", evidence_state="supported", **kw
            ),
            "unresolved_items",
            ["u" * 2_001],
        ),
        (
            lambda **kw: __import__("routes.query", fromlist=["AcceptLinkRequest"]).AcceptLinkRequest(
                source_issuer_id="source", target_issuer_id="target", capability_id="cap", **kw
            ),
            "chunk_ids",
            ["c" * 37],
        ),
        (
            lambda **kw: __import__("routes.query", fromlist=["WatchlistUpdate"]).WatchlistUpdate(**kw),
            "issuer_ids",
            ["i" * 37],
        ),
        (
            lambda **kw: __import__("routes.sector", fromlist=["SectorFeed"]).SectorFeed(**kw),
            "sector",
            "s" * 129,
        ),
    ],
)
def test_route_schema_rejects_overlong_values(factory, field, value):
    with pytest.raises(ValidationError):
        factory(**{field: value})
