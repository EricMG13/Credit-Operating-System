"""Sentinel — the deterministic fingerprint-diff trigger (Phase 3).

Pure function over two issuer-fingerprint snapshots: given the current and prior
``{issuer_id: fingerprint}`` maps, emit ``Ticket`` records for issuers that
entered coverage, changed, or left. No DB, no LLM, no spend — the change-driven
contract (spend only when the vault moved, never on a schedule).

``changed_issuers`` routes the diff to the Anomaly Detector: only new-coverage +
changed issuers get re-scanned (dropped-coverage is informational — there is no
current data to scan). ``detect_tickets`` is idempotent on an unchanged book
(zero tickets → zero downstream work → zero LLM spend), and a scoped re-run
restricts the diff to the requested issuers so the Anomaly Detector only re-
scans them.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional, Sequence


@dataclass(frozen=True)
class Ticket:
    """One fingerprint-diff signal. ``detail`` is a fixed human-readable reason
    per kind so the downstream Analyst agent's evidence pack is consistent."""

    issuer_id: str
    kind: str  # new-coverage | changed | dropped-coverage
    detail: str


# Fixed reason strings — the Analyst lane reads these verbatim, so a wording
# change here is deliberate and reviewed.
_NEW_COVERAGE = "issuer entered coverage (no prior fingerprint)"
_CHANGED = "fingerprint moved (re-ingest / new run / link / finding)"
_DROPPED = "issuer left coverage (present in prior, absent now)"


def detect_tickets(
    current: Dict[str, str],
    prior: Dict[str, str],
    issuer_ids: Optional[Sequence[str]] = None,
) -> List[Ticket]:
    """Diff two issuer-fingerprint snapshots into a sorted ticket list.

    Kinds: ``new-coverage`` (in current, not prior), ``changed`` (in both,
    fingerprint differs), ``dropped-coverage`` (in prior, not current). An
    unchanged book → ``[]`` (no work, no spend). When ``issuer_ids`` is set, only
    those issuers are ticketed even if others also moved — the scoped-re-run gate
    the Anomaly Detector re-scans through. Output sorted by ``issuer_id`` for
    deterministic downstream ordering.
    """
    scope = set(issuer_ids) if issuer_ids is not None else None
    out: List[Ticket] = []
    for iid in current:
        if scope is not None and iid not in scope:
            continue
        if iid not in prior:
            out.append(Ticket(iid, "new-coverage", _NEW_COVERAGE))
        elif current[iid] != prior[iid]:
            out.append(Ticket(iid, "changed", _CHANGED))
    for iid in prior:
        if scope is not None and iid not in scope:
            continue
        if iid not in current:
            out.append(Ticket(iid, "dropped-coverage", _DROPPED))
    out.sort(key=lambda t: t.issuer_id)
    return out


def changed_issuers(tickets: Sequence[Ticket]) -> List[str]:
    """Issuer ids that need an Anomaly Detector re-scan: new-coverage + changed.
    ``dropped-coverage`` is excluded — the issuer has no current data to scan.
    Sorted by issuer id for deterministic downstream ordering."""
    return sorted(t.issuer_id for t in tickets
                  if t.kind in ("new-coverage", "changed"))
