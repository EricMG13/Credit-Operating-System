"""Deterministic cross-module scenario propagation.

The network intentionally stops where CAOS has no defensible sensitivity model.
Each node either computes from persisted run outputs or says NO_DATA/DEGRADED;
it never invents market moves, positions, or committee conclusions.
"""

from __future__ import annotations

from enum import Enum
from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator

from engine.capstructure import recovery_waterfall
from engine.periods import is_finite_number, latest_annual, safe_div


class ShockInput(BaseModel):
    issuer_id: str
    run_id: str
    ebitda_pct: float = Field(ge=-0.9, le=0.5)
    rate_bps: int = Field(default=0, ge=-500, le=1000)

    @model_validator(mode="after")
    def reject_noop(self):
        if self.ebitda_pct == 0 and self.rate_bps == 0:
            raise ValueError("scenario must change EBITDA or rates")
        return self


class NodeStatus(str, Enum):
    COMPUTED = "computed"
    DEGRADED = "degraded"
    NO_DATA = "no-data"


PropagationNodeName = Literal[
    "stress", "liquidity", "covenant", "recovery", "rv",
    "portfolio", "recommendation", "report",
]


class PropagationNode(BaseModel):
    node: PropagationNodeName
    status: NodeStatus
    value: Optional[float] = None
    label: str
    basis: str


class PropagationSource(BaseModel):
    run_status: str
    qa_status: str
    committee_status: str
    included_modules: List[str]
    excluded_modules: List[str]


class PropagationResult(BaseModel):
    shock: ShockInput
    nodes: List[PropagationNode]
    source: Optional[PropagationSource] = None


class _ScenarioTranche(BaseModel):
    """Validated legacy CP-3B row before it reaches recovery arithmetic."""

    model_config = ConfigDict(extra="allow")

    tranche: str = Field(min_length=1)
    code: str = Field(min_length=1)
    seniority_rank: int = Field(ge=0)
    amount_musd: float = Field(gt=0, allow_inf_nan=False)


def _validated_tranches(value: object) -> Optional[List[dict]]:
    if not isinstance(value, list) or not value:
        return None
    try:
        return [_ScenarioTranche.model_validate(row).model_dump() for row in value]
    except (ValidationError, TypeError):
        return None


def _node(
    node: PropagationNodeName,
    status: NodeStatus,
    value: Optional[float],
    label: str,
    basis: str,
) -> PropagationNode:
    return PropagationNode(node=node, status=status, value=value, label=label, basis=basis)


def propagate(
    shock: ShockInput,
    payload: Dict[str, dict],
    *,
    source: Optional[PropagationSource] = None,
) -> PropagationResult:
    cp1 = payload.get("CP-1") or {}
    nf = cp1.get("normalized_financials") if isinstance(cp1, dict) else {}
    nf = nf if isinstance(nf, dict) else {}
    ebitda = latest_annual(nf.get("adj_ebitda") or {})
    net_debt = nf.get("net_debt_ltm")
    current_leverage = nf.get("net_leverage_adj_ltm")

    nodes: List[PropagationNode] = []
    stressed_ebitda: Optional[float] = None
    if is_finite_number(ebitda):
        candidate = ebitda * (1 + shock.ebitda_pct)
        if is_finite_number(candidate) and candidate > 0:
            stressed_ebitda = round(candidate, 1)
    nodes.append(_node(
        "stress",
        NodeStatus.COMPUTED if stressed_ebitda is not None else NodeStatus.NO_DATA,
        stressed_ebitda,
        f"Stressed EBITDA ${stressed_ebitda:g}M" if stressed_ebitda is not None else "EBITDA unavailable",
        "CP-1 adjusted EBITDA × (1 + shock)",
    ))

    cp2e = payload.get("CP-2E") or {}
    liquidity = cp2e.get("disclosed_liquidity_musd") if isinstance(cp2e, dict) else None
    annual_interest = cp2e.get("annual_cash_interest_musd") if isinstance(cp2e, dict) else None
    stressed_interest: Optional[float] = None
    if is_finite_number(annual_interest) and is_finite_number(net_debt):
        candidate = annual_interest + net_debt * shock.rate_bps / 10_000
        stressed_interest = candidate if is_finite_number(candidate) and candidate > 0 else None
    runway = (
        safe_div(liquidity * 12, stressed_interest)
        if is_finite_number(liquidity) and liquidity >= 0 else None
    )
    runway = round(runway, 1) if runway is not None and runway >= 0 else None
    nodes.append(_node(
        "liquidity",
        NodeStatus.COMPUTED if runway is not None else NodeStatus.DEGRADED,
        runway,
        f"{runway:g} months interest runway" if runway is not None else "Runway not computable",
        "CP-2E liquidity / stressed cash interest",
    ))

    cp4c = payload.get("CP-4C") or {}
    threshold = cp4c.get("leverage_covenant_x") if isinstance(cp4c, dict) else None
    stressed_leverage = safe_div(net_debt, stressed_ebitda)
    if stressed_leverage is None and is_finite_number(current_leverage):
        stressed_leverage = safe_div(current_leverage, 1 + shock.ebitda_pct)
    headroom = (
        round(threshold - stressed_leverage, 2)
        if is_finite_number(threshold) and stressed_leverage is not None else None
    )
    nodes.append(_node(
        "covenant",
        NodeStatus.COMPUTED if headroom is not None else NodeStatus.DEGRADED,
        headroom,
        f"{headroom:g}x stressed headroom" if headroom is not None else "Headroom unavailable",
        "CP-4C threshold − stressed net leverage",
    ))

    cp3b = payload.get("CP-3B") or {}
    raw_tranches = cp3b.get("tranches") if isinstance(cp3b, dict) else None
    tranches = _validated_tranches(raw_tranches)
    recovery: Optional[float] = None
    if stressed_ebitda is not None and tranches:
        stressed_rows = recovery_waterfall(tranches, stressed_ebitda * 5.0)
        recoveries = [r.get("recovery_pct") for r in stressed_rows]
        finite_recoveries = [float(v) for v in recoveries if is_finite_number(v)]
        if finite_recoveries:
            recovery = round(sum(finite_recoveries) / len(finite_recoveries), 1)
    nodes.append(_node(
        "recovery",
        NodeStatus.COMPUTED if recovery is not None else NodeStatus.DEGRADED,
        recovery,
        f"{recovery:g}% average sized-tranche recovery" if recovery is not None else "Recovery not computable",
        "CP-3B waterfall at 5.0x stressed EBITDA",
    ))

    nodes.append(_node(
        "rv", NodeStatus.NO_DATA, None, "No market sensitivity model",
        "CP-3 has fundamentals percentile only; no live spread-to-shock function",
    ))

    cp3c = payload.get("CP-3C") or {}
    concentration = cp3c.get("concentration") if isinstance(cp3c, dict) else None
    held_pct = concentration.get("held_pct_nav") if isinstance(concentration, dict) else None
    portfolio_loss = None
    if is_finite_number(held_pct) and recovery is not None:
        candidate = held_pct * (1 - recovery / 100)
        portfolio_loss = round(candidate, 2) if is_finite_number(candidate) else None
    nodes.append(_node(
        "portfolio",
        NodeStatus.COMPUTED if portfolio_loss is not None else NodeStatus.NO_DATA,
        portfolio_loss,
        f"{portfolio_loss:g}% NAV loss at stressed recovery" if portfolio_loss is not None else "No linked position exposure",
        "CP-3C held % NAV × (1 − stressed recovery)",
    ))

    cp3 = payload.get("CP-3") or {}
    recommendation = cp3.get("recommendation") if isinstance(cp3, dict) else None
    nodes.append(_node(
        "recommendation",
        NodeStatus.DEGRADED if recommendation else NodeStatus.NO_DATA,
        None,
        f"Re-underwrite current {recommendation} lean" if recommendation else "No current recommendation",
        "CP-3 recommendation cannot be automatically re-scored without peer/market refresh",
    ))
    nodes.append(_node(
        "report", NodeStatus.COMPUTED, 1.0, "Report stale — refresh required",
        "Any non-zero propagated shock invalidates the current report snapshot",
    ))
    return PropagationResult(shock=shock, nodes=nodes, source=source)
