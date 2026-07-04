"""The CP-5 quality gate — deterministic, not LLM-decided.

The model (or a fixture) produces *findings*; these pure functions decide
``qa_status`` and ``committee_status`` from them. An LLM never gets to declare
its own output committee-ready. The severity mapping is the CP-5 decision gate
from ``SYSTEM_ROUTE_MAP_v2.md``:

    any CRITICAL  -> Blocked
    any MATERIAL  -> Restricted
    only MINOR/none -> Passed
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Optional, Sequence

SEVERITY_RANK = {"MINOR": 1, "MATERIAL": 2, "CRITICAL": 3}
_QA_RANK = {"Not Reviewed": -1, "Passed": 0, "Restricted": 1, "Blocked": 2}
_CONF_RANK = {"Insufficient Information": 0, "Low": 1, "Medium": 2, "High": 3}


@dataclass
class Finding:
    """A CP-5/CP-5B audit finding (CP_QA_RESULT.findings[])."""

    finding_id: str
    severity: str  # CRITICAL | MATERIAL | MINOR
    description: str
    lane: Optional[int] = None  # one of the 8 CP-5 audit lanes
    affected_claim_id: Optional[str] = None
    module_id: Optional[str] = None
    required_remediation: Optional[str] = None


def qa_status_from(findings: Sequence[Finding]) -> str:
    """CP-5 severity gate."""
    if any(f.severity == "CRITICAL" for f in findings):
        return "Blocked"
    if any(f.severity == "MATERIAL" for f in findings):
        return "Restricted"
    return "Passed"


def committee_status_from(qa_status: str, confidence: str) -> str:
    """Translate a gate result + confidence into committee usability."""
    if qa_status == "Blocked":
        return "Blocked"
    if qa_status == "Restricted":
        return "Restricted"
    if qa_status == "Not Reviewed":
        return "Draft Only"
    # Fail-closed: only an explicit "Passed" can reach committee-ready. Any
    # unrecognized/partial gate state (a stray "Pending", "", or a status a future
    # code path introduces) must degrade to non-committee, never fall through to
    # "Committee Ready" — a wrong-read on the money path.
    if qa_status != "Passed":
        return "Draft Only"
    if confidence == "Insufficient Information":
        return "Insufficient Information"
    return "Committee Ready"


def roll_up_qa_status(statuses: Iterable[str]) -> str:
    """Run-level status = the worst module status (Blocked > Restricted > Passed)."""
    statuses = list(statuses)
    if not statuses:
        return "Not Reviewed"
    # Fail-closed: an unrecognized status ranks WORST (99), not most-benign, so a
    # stray/unknown module status can't let the run roll up to Passed and then
    # slip through committee_status_from's fail-closed default too.
    return max(statuses, key=lambda s: _QA_RANK.get(s, 99))


def worst_confidence(confidences: Iterable[str]) -> str:
    """Lowest confidence across modules (drives run-level committee_status)."""
    confidences = list(confidences)
    if not confidences:
        return "Insufficient Information"
    return min(confidences, key=lambda c: _CONF_RANK.get(c, 0))
