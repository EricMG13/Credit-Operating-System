"""CP-0: Document Readiness & Run Type Classifier."""

from __future__ import annotations

from sqlalchemy import select

from core.claude_client import AgentMessage, run_fast_agent
from db.models import Document
from db.session import AsyncSessionLocal

FULL_RUN_DOCS = {"OM", "CreditAgreement", "LBOModel"}
DELTA_RUN_DOCS = {"InterimReport"}


async def run_cp0(issuer_id: str, document_id: str) -> dict:
    """
    Determine run type based on documents present for the issuer.
    FULL_RUN:  OM + CreditAgreement + LBOModel all present
    DELTA_RUN: InterimReport uploaded; base docs already exist
    """
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Document.doc_type, Document.id)
            .where(Document.issuer_id == issuer_id)
        )
        docs = result.all()

    present_types = {row.doc_type for row in docs}
    trigger_doc_type = next(
        (row.doc_type for row in docs if str(row.id) == document_id), None
    )

    # Determine run type
    if trigger_doc_type in DELTA_RUN_DOCS and FULL_RUN_DOCS.issubset(present_types):
        run_type = "DELTA_RUN"
        verdict = "READY"
        missing = []
    elif FULL_RUN_DOCS.issubset(present_types):
        run_type = "FULL_RUN"
        verdict = "READY"
        missing = []
    else:
        missing = list(FULL_RUN_DOCS - present_types)
        run_type = "FULL_RUN"
        verdict = "BLOCKED"

    return {
        "module_id": "CP-0",
        "issuer_id": issuer_id,
        "fiscal_period": "N/A",
        "run_type": run_type,
        "canonical_docs_present": list(present_types),
        "missing_docs": missing,
        "verdict": verdict,
        "blocking_reason": f"Missing canonical documents: {missing}" if missing else None,
        "has_inferred_metrics": False,
        "material_conclusions": [],
    }
