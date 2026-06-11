"""
Canonical CP enums — ported verbatim from the Modular OS prompt corpus
(`KNOWLEDGE SOURCES/01_TAXONOMY/` and `00_GOVERNANCE/`).

These are the single source of truth for the values used in the payload
envelope and in render-time enum validation (CP_RENDER_COMPILE_BOUNDARY VE-010).
Keep in lock-step with the corpus taxonomy files.
"""

from __future__ import annotations

from enum import Enum


class Confidence(str, Enum):
    HIGH = "High"
    MEDIUM = "Medium"
    LOW = "Low"
    INSUFFICIENT = "Insufficient Information"


class QaStatus(str, Enum):  # D1
    NOT_REVIEWED = "Not Reviewed"
    PASSED = "Passed"
    RESTRICTED = "Restricted"
    BLOCKED = "Blocked"


class SchemaFamily(str, Enum):
    NESTED = "Nested"
    INFRASTRUCTURE = "Infrastructure"


class Severity(str, Enum):  # D8
    CRITICAL = "CRITICAL"
    MATERIAL = "MATERIAL"
    MINOR = "MINOR"


class ValidationStatus(str, Enum):  # D5
    PASSED = "Passed"
    RESTRICTED = "Restricted"
    BLOCKED = "Blocked"
    NOT_EXECUTED = "Not Executed"


class ExtractionStatus(str, Enum):  # D6
    SUCCESS = "Success"
    PARTIAL = "Partial"
    FAILED = "Failed"


class CommitteeStatus(str, Enum):  # D2
    COMMITTEE_READY = "Committee Ready"
    DRAFT_ONLY = "Draft Only"
    REQUIRES_MORE_WORK = "Requires More Work"
    INSUFFICIENT = "Insufficient Information"
    RESTRICTED = "Restricted"
    BLOCKED = "Blocked"


class CalculationStatus(str, Enum):  # D3
    SUPPORTED = "Supported"
    DERIVED = "Derived"
    IMPLIED = "Implied"
    PROVISIONAL = "Provisional"
    NOT_AVAILABLE = "Not Available"
    NOT_COMPARABLE = "Not Comparable"
    NOT_CALCULABLE = "Not Calculable"
    INSUFFICIENT = "Insufficient Information"


class SourceQuality(str, Enum):  # D4
    PRIMARY_VERIFIED = "Primary-Verified"
    PRIMARY_UNVERIFIED = "Primary-Unverified"
    SECONDARY_REPUTABLE = "Secondary-Reputable"
    SECONDARY_UNVERIFIED = "Secondary-Unverified"
    TERTIARY = "Tertiary"
    USER_PROVIDED = "User-Provided"
    NOT_AVAILABLE = "Not Available"


class LineageClass(str, Enum):  # evidence classification — 8
    DIRECTLY_SOURCED = "Directly Sourced"
    CALCULATED = "Calculated"
    ASSUMPTION_BASED = "Assumption-Based"
    ANALYST_INFERENCE = "Analyst Inference"
    WEAK_LINEAGE = "Weak Lineage"
    UNTRACED = "Untraced"
    CONFLICTING = "Conflicting"
    INSUFFICIENT = "Insufficient Information"


# ── Render-time validated enums (CP_RENDER_COMPILE_BOUNDARY SEC3, VE-010) ──

class CreditImplication(str, Enum):  # 13 values
    POS_DELEVERAGING = "Positive-Deleveraging"
    POS_MARGIN_EXPANSION = "Positive-Margin Expansion"
    POS_REVENUE_GROWTH = "Positive-Revenue Growth"
    POS_LIQUIDITY_IMPROVEMENT = "Positive-Liquidity Improvement"
    POS_COVENANT_HEADROOM = "Positive-Covenant Headroom Expansion"
    NEUTRAL_STABLE = "Neutral-Stable"
    NEG_LEVERAGE_INCREASE = "Negative-Leverage Increase"
    NEG_MARGIN_COMPRESSION = "Negative-Margin Compression"
    NEG_REVENUE_DECLINE = "Negative-Revenue Decline"
    NEG_LIQUIDITY_DETERIORATION = "Negative-Liquidity Deterioration"
    NEG_COVENANT_EROSION = "Negative-Covenant Erosion"
    NEG_REFINANCING_RISK = "Negative-Refinancing Risk"
    INSUFFICIENT = "Insufficient Information"


class IcActionBias(str, Enum):  # CP-6A — 8 values
    AVOID = "Avoid"
    WATCHLIST = "Watchlist"
    STARTER_POSITION = "Starter Position"
    CORE_HOLD = "Core Hold"
    ADD_INCREASE = "Add / Increase"
    REDUCE_TRIM = "Reduce / Trim"
    EXIT = "Exit"
    REQUIRES_MORE_WORK = "Requires More Work"


class SectorCreditPosture(str, Enum):  # CP-SR — 6 values
    STRONG_BUY = "STRONG_BUY"
    CONSTRUCTIVE = "CONSTRUCTIVE"
    NEUTRAL = "NEUTRAL"
    CAUTIOUS = "CAUTIOUS"
    DEFENSIVE = "DEFENSIVE"
    AVOID = "AVOID"


class AlertTier(str, Enum):  # CP-MON — REF_CP-MON_H materiality bands
    CRITICAL = "Critical"      # >= 0.85
    MATERIAL = "Material"      # 0.60–0.84
    NOTEWORTHY = "Noteworthy"  # 0.40–0.59
    LOGGED = "Logged"          # < 0.40

    @classmethod
    def from_score(cls, score: float) -> "AlertTier":
        if score >= 0.85:
            return cls.CRITICAL
        if score >= 0.60:
            return cls.MATERIAL
        if score >= 0.40:
            return cls.NOTEWORTHY
        return cls.LOGGED


class SizingPosture(str, Enum):  # CP-3C — 7-value decision-taxonomy subset
    AVOID = "Avoid"
    WATCHLIST = "Watchlist"
    STARTER_POSITION = "Starter Position"
    CORE_HOLD = "Core Hold"
    HOLD_EXISTING_ONLY = "Hold Existing Only"
    REDUCE_TRIM = "Reduce / Trim"
    REQUIRES_MORE_WORK = "Requires More Work"


class RefinancingPathType(str, Enum):  # CP-3D — 7 values
    CONSENSUAL_REFINANCING = "Consensual Refinancing"
    AMEND_AND_EXTEND = "Amend-and-Extend"
    EXCHANGE_OFFER = "Exchange Offer"
    DISTRESSED_EXCHANGE = "Distressed Exchange"
    UPTIER = "Uptier"
    DROP_DOWN = "Drop-Down"
    PRIMING_DEBT = "Priming Debt"


class PortfolioPosture(str, Enum):  # CP-6E — 6 values
    INCLUDE = "Include"
    AVOID = "Avoid"
    RESIZE_REDUCE = "Resize-Reduce"
    RESIZE_INCREASE = "Resize-Increase"
    MAINTAIN_HOLD = "Maintain-Hold"
    REQUIRES_MORE_WORK = "Requires More Work"


# NOTE (P1 TODO): binding_constraint (CP-6E, 9 values + None) is validated at
# render time but its 9 canonical values are defined in the CP-6E refs, not the
# 01_TAXONOMY files. Port them from CP-6E before enabling that VE-010 check.

# Convenience: the four render-validated enums keyed by field name.
RENDER_VALIDATED_ENUMS = {
    "credit_implication": CreditImplication,
    "ic_action_bias": IcActionBias,
    "portfolio_posture": PortfolioPosture,
    # "binding_constraint": BindingConstraint,  # pending CP-6E port
}
