"""Committee report assembly + the export gate.

The export gate is the point where the CP-5 decision gets teeth: a run is only
exportable as a committee pack when its rolled-up ``committee_status`` is
"Committee Ready". A Restricted or Blocked run is refused. This is a stand-in
for the full CP-RENDER infrastructure module (later tier); for now it produces a
structured summary and, crucially, enforces the gate.
"""

from __future__ import annotations

from typing import Sequence

# Modules that are auditors / infrastructure, not committee-pack content.
# CP-5C (the committee-review process record) belongs here too — its omission
# put a QA-process section inside the committee pack (audit 2026-07-10 QA-6/B9).
_NON_CONTENT = {"CP-5", "CP-5B", "CP-5C", "CP-X"}


def committee_export_allowed(committee_status: str) -> bool:
    """A committee pack may only be produced from a Committee Ready run."""
    return committee_status == "Committee Ready"


def assemble_report(run, modules: Sequence) -> dict:
    """Build a committee report from a run and its module outputs.

    Pure over its inputs (``run`` and ``modules`` need only the read attributes
    below), so it is unit-testable without a database.
    """
    content = [m for m in modules if m.module_id not in _NON_CONTENT]
    return {
        "run_id": run.id,
        "issuer_id": run.issuer_id,
        "as_of_date": run.as_of_date,
        "qa_status": run.qa_status,
        "committee_status": run.committee_status,
        "prepared_by": run.analyst_id,
        "sections": [
            {
                "module_id": m.module_id,
                "module_name": m.module_name,
                "confidence": m.confidence,
                "qa_status": m.qa_status,
                "summary": m.runtime_output,
            }
            for m in content
        ],
    }
