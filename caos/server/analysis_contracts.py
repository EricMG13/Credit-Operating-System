"""Shared decision-grade contracts for Query, Sector Review and RV Screener."""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal, Optional, TypeAlias

from pydantic import BaseModel, Field

AnalysisJobState: TypeAlias = Literal[
    "queued",
    "running",
    "partial",
    "ready",
    "observed-empty",
    "stale",
    "offline",
    "unavailable",
    "error",
    "cancelled",
]

AnalysisSurfaceName: TypeAlias = Literal[
    "issuers",
    "upload",
    "research",
    "sponsors",
    "command",
    "deep-dive",
    "model",
    "reports",
    "pipeline",
    "monitor",
    "settings",
    "issuer-profile",
    "global-ask",
    "query",
    "sector-review",
    "rv-screener",
]

FindingSourceSurface: TypeAlias = Literal[
    "query",
    "sector-review",
    "rv-screener",
    "research",
    "sponsors",
    "command",
    "deep-dive",
    "model",
    "reports",
    "pipeline",
    "monitor",
    "issuer-profile",
    "global-ask",
]


class AnalysisArtifactRefs(BaseModel):
    """Typed links to the exact artifacts composing one analytical view.

    These are deliberately references, not embedded payloads: route adapters
    still own their domain data and render ``partial`` when a required link is
    absent or does not match the active context.
    """

    issuer_run_id: Optional[str] = Field(default=None, max_length=64)
    source_manifest_id: Optional[str] = Field(default=None, max_length=36)
    research_job_id: Optional[str] = Field(default=None, max_length=36)
    model_checkpoint_id: Optional[str] = Field(default=None, max_length=36)
    report_version_id: Optional[str] = Field(default=None, max_length=36)
    alert_event_id: Optional[str] = Field(default=None, max_length=36)
    sponsor_id: Optional[str] = Field(default=None, max_length=255)


class AnalysisSurfaceStateEntry(BaseModel):
    """Bounded, portable state shared by route adapters.

    Domain payloads remain in their owning APIs.  This contract persists only
    navigation continuity: a query, selected ids, active object, sort and view.
    """

    query: Optional[str] = Field(default=None, max_length=500)
    selected_ids: list[str] = Field(default_factory=list, max_length=500)
    active_id: Optional[str] = Field(default=None, max_length=160)
    sort: Optional[str] = Field(default=None, max_length=80)
    view: Optional[str] = Field(default=None, max_length=80)
    filters: dict[str, str | int | float | bool | None | list[str]] = Field(default_factory=dict)


class AnalysisSurfaceState(BaseModel):
    """Known surface keys only; legacy ``filters``/``selected`` remain adapters."""

    issuers: Optional[AnalysisSurfaceStateEntry] = None
    upload: Optional[AnalysisSurfaceStateEntry] = None
    research: Optional[AnalysisSurfaceStateEntry] = None
    sponsors: Optional[AnalysisSurfaceStateEntry] = None
    command: Optional[AnalysisSurfaceStateEntry] = None
    deep_dive: Optional[AnalysisSurfaceStateEntry] = Field(default=None, alias="deep-dive")
    model: Optional[AnalysisSurfaceStateEntry] = None
    reports: Optional[AnalysisSurfaceStateEntry] = None
    pipeline: Optional[AnalysisSurfaceStateEntry] = None
    monitor: Optional[AnalysisSurfaceStateEntry] = None
    settings: Optional[AnalysisSurfaceStateEntry] = None
    issuer_profile: Optional[AnalysisSurfaceStateEntry] = Field(default=None, alias="issuer-profile")
    global_ask: Optional[AnalysisSurfaceStateEntry] = Field(default=None, alias="global-ask")
    query: Optional[AnalysisSurfaceStateEntry] = None
    sector_review: Optional[AnalysisSurfaceStateEntry] = Field(default=None, alias="sector-review")
    rv_screener: Optional[AnalysisSurfaceStateEntry] = Field(default=None, alias="rv-screener")


class AuthorityEnvelope(BaseModel):
    origin: str = Field(min_length=1, max_length=32)
    method: str = Field(min_length=1, max_length=64)
    freshness: str = Field(min_length=1, max_length=32)
    as_of: Optional[datetime] = None
    source_ids: list[str] = Field(default_factory=list, max_length=500)
    run_id: Optional[str] = Field(default=None, max_length=64)
    version_id: Optional[str] = Field(default=None, max_length=64)
    confidence: Optional[float] = Field(default=None, ge=0, le=1)
    approval_state: Literal["draft", "ratified", "published", "rejected"] = "draft"
    analyst_override: Optional[str] = Field(default=None, max_length=2000)


class AnalysisContext(BaseModel):
    id: str
    name: str
    sector_id: Optional[str] = None
    sub_segments: list[str] = Field(default_factory=list)
    issuer_ids: list[str] = Field(default_factory=list)
    instrument_ids: list[str] = Field(default_factory=list)
    portfolio_scope: Optional[str] = None
    as_of: Optional[date] = None
    sector_review_run_id: Optional[str] = None
    rv_snapshot_id: Optional[str] = None
    rv_run_id: Optional[str] = None
    query_session_id: Optional[str] = None
    artifacts: AnalysisArtifactRefs = Field(default_factory=AnalysisArtifactRefs)
    surface_state: AnalysisSurfaceState = Field(default_factory=AnalysisSurfaceState)
    filters: dict = Field(default_factory=dict)
    selected: dict = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime


class Finding(BaseModel):
    id: str
    context_id: str
    kind: str
    title: str
    body: str
    source_surface: str
    source_run_id: Optional[str] = None
    status: Literal["draft", "ratified", "archived"]
    evidence: dict = Field(default_factory=dict)
    authority: AuthorityEnvelope
    created_at: datetime
    updated_at: datetime


class QueryRun(BaseModel):
    id: str
    context_id: str
    question: str
    selected_lane: Literal["metric", "graph", "grounded"]
    method_override: Optional[str] = None
    status: AnalysisJobState
    result: dict = Field(default_factory=dict)
    authority: AuthorityEnvelope
    error: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class SectorDimensionScore(BaseModel):
    id: str
    label: str
    score: Optional[float] = Field(default=None, ge=0, le=100)
    confidence: float = Field(ge=0, le=1)
    freshness: str
    source_ids: list[str] = Field(default_factory=list)
    missing_dependency: Optional[str] = None


class SectorReviewSectionV2(BaseModel):
    id: str
    title: str
    posture: str
    summary: str
    confidence: float = Field(ge=0, le=1)
    freshness: str
    signal_ids: list[str] = Field(default_factory=list)


class SectorRisk(BaseModel):
    id: str
    title: str
    likelihood: Literal["low", "medium", "high"]
    severity: Literal["low", "medium", "high", "critical"]
    mitigants: list[str] = Field(default_factory=list)
    residual_risk: str
    source_ids: list[str] = Field(default_factory=list)


class SectorComparable(BaseModel):
    issuer_id: Optional[str] = None
    issuer_name: str
    posture: str
    metrics: dict = Field(default_factory=dict)
    missing_dependencies: list[str] = Field(default_factory=list)


class SectorEarlyWarning(BaseModel):
    id: str
    indicator: str
    threshold: str
    current_state: str
    status: Literal["normal", "watch", "breached", "unavailable"]
    source_ids: list[str] = Field(default_factory=list)


class SectorSourceRegisterItem(BaseModel):
    id: str
    title: str
    origin: str
    method: str
    freshness: str
    as_of: datetime
    url: Optional[str] = None


class SectorUncertainty(BaseModel):
    id: str
    statement: str
    impact: str
    route_to_qa: bool = False
    source_ids: list[str] = Field(default_factory=list)


class SectorReviewV2(BaseModel):
    id: str
    context_id: str
    sector_id: str
    sector_label: str
    timeframe: str
    version: int
    status: AnalysisJobState
    as_of: datetime
    posture: str
    what_changed: str
    why_it_matters: str
    required_action: str
    evidence_health: str
    sections: list[SectorReviewSectionV2]
    dimension_scores: list[SectorDimensionScore]
    risks: list[SectorRisk]
    comparables: list[SectorComparable]
    early_warning: list[SectorEarlyWarning]
    source_register: list[SectorSourceRegisterItem]
    uncertainties: list[SectorUncertainty]
    downstream_readiness: dict
    missing_dependencies: list[str] = Field(default_factory=list)
    authority: AuthorityEnvelope
    ratifications: dict[str, str] = Field(default_factory=dict)
    created_at: datetime


class RVCandidateOut(BaseModel):
    id: str
    instrument_id: str
    instrument_key: str
    figi: Optional[str] = None
    borrower: str
    rank: int
    classification: Literal["actionable", "screen-only", "unavailable"]
    recommendation: str
    missing_gates: list[str] = Field(default_factory=list)
    market: dict = Field(default_factory=dict)
    pitch: dict = Field(default_factory=dict)
    evidence: dict = Field(default_factory=dict)
    portfolio_impact: dict = Field(default_factory=dict)
    ratified_at: Optional[datetime] = None


class RVScreenRun(BaseModel):
    id: str
    context_id: str
    snapshot_id: str
    status: AnalysisJobState
    filters: dict = Field(default_factory=dict)
    authority: AuthorityEnvelope
    candidates: list[RVCandidateOut] = Field(default_factory=list)
    counts: dict = Field(default_factory=dict)
    missing_dependencies: list[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime
