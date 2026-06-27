"""The seeded ATLF reference deal — Atlas Forge Industrials.

Two roles:

1. ``ensure_reference_deal`` seeds a reference issuer plus a handful of
   document chunks (OM, SFA, indenture, audited financials, compliance
   certificate, sponsor model, intake manifest) so BM25 retrieval has real
   source text to resolve evidence against.

2. ``atlf_payload`` returns the canonical CP-0 / CP-1 payloads the
   FixtureSynthesizer emits when no model key is configured — the engine's
   deterministic counterpart to a live Claude call, mirroring the demo-mode
   fallback in [llm.py]. The numbers track the seeded frontend deal
   (module-outputs.ts) so a later UI adapter renders live output unchanged.

The CP-1 payload deliberately carries a Weak-Lineage claim (the Q4-25 derived
period) and a Conflicting claim (the SFA-vs-indenture EBITDA definition), so the
CP-5B/CP-5 gate independently arrives at *Restricted* — exactly the seeded
"CONDITIONAL / pack HELD" outcome.
"""

from __future__ import annotations

from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from database import Document, DocumentChunk, Issuer
from engine.gate import Finding
from engine.schemas import ClaimSpec, EvidenceSpec, ModulePayload

REFERENCE_ISSUER_ID = "a71f0000-0000-0000-0000-000000000001"

_REFERENCE_ISSUER = {
    "id": REFERENCE_ISSUER_ID,
    "name": "Atlas Forge Industrials",
    "ticker": "ATLF",
    "industry": "Industrials",
    "country": "USA",
    "figi": "BBG00TLSFRG5",
}

# (doc_id, doc_type, file_name, chunk text) — one chunk per doc keeps the
# reference deal small while giving retrieval distinctive targets.
_REFERENCE_DOCS = [
    ("D-00", "Intake", "intake_manifest.txt",
     "Intake manifest: fourteen source files classified and mapped. Document "
     "grades range from A to C. Files include offering memorandum, senior "
     "facilities agreement, indenture, audited financials, compliance "
     "certificate, lender presentation, and sponsor model extract."),
    ("D-01", "OM", "offering_memorandum.pdf",
     "Offering memorandum. Atlas Forge Industrials senior secured notes due "
     "2031. Adjusted EBITDA add-backs represent 18.2 percent of adjusted "
     "EBITDA. Top three OEM customers represent 38 percent of revenue, "
     "concentrated in the Drivetrain segment."),
    ("D-02", "SFA", "senior_facilities_agreement.pdf",
     "Senior facilities agreement. The EBITDA definition caps cost-saving "
     "add-backs at 25 percent over a trailing 24 month period."),
    ("D-03", "Indenture", "ssn_indenture.pdf",
     "Senior secured notes indenture due 2031. Add-backs to consolidated "
     "EBITDA are uncapped. Day-one incremental incurrence capacity of 612 "
     "million dollars."),
    ("D-04", "Audit", "audited_financials_fy23_fy25.pdf",
     "Audited consolidated financials FY2023 FY2024 FY2025. Revenue 2410 2588 "
     "2742. Adjusted EBITDA 358 392 415. Net debt 2380. Free cash flow "
     "conversion 41 percent."),
    ("D-05", "Covenant", "compliance_certificate_q1_2026.pdf",
     "Q1 2026 compliance certificate. Adjusted net leverage 5.68x. Interest "
     "coverage 2.1x. Net debt 2391 million."),
    ("D-06", "LP", "lender_presentation.pdf",
     "Lender presentation. Aftermarket attaches to a 1.9 million unit "
     "installed base with 92 percent contract renewal."),
    ("D-07", "Model", "sponsor_model_extract.xlsx",
     "Sponsor model extract. Q4 2025 management accounts were not provided. "
     "The Q4 2025 period is a derived period constructed from sponsor "
     "management projections (gap G-02)."),
    ("D-08", "Profile", "business_profile.pdf",
     "Atlas Forge cost structure. The cost base is dominated by raw materials "
     "and labour; energy and freight are roughly 12 percent of cost of goods "
     "sold, so margins carry moderate sensitivity to energy-price inflation."),
]


async def ensure_reference_deal(session: AsyncSession) -> None:
    """Idempotently seed the ATLF issuer, its documents, and their chunks."""
    if await session.get(Issuer, REFERENCE_ISSUER_ID) is not None:
        return
    session.add(Issuer(**_REFERENCE_ISSUER))
    await session.flush()  # insert the issuer before its documents (FK-enforcing DBs)
    for seq, (doc_id, doc_type, file_name, text) in enumerate(_REFERENCE_DOCS):
        doc = Document(
            issuer_id=REFERENCE_ISSUER_ID,
            doc_type=doc_type,
            file_name=file_name,
            storage_key=f"reference/atlf/{doc_id}",
            chunk_count=1,
            uploaded_by="reference-seed",
        )
        session.add(doc)
        await session.flush()  # assign doc.id
        session.add(DocumentChunk(document_id=doc.id, seq=seq, text=text))
    await session.commit()


def atlf_payload(module_id: str) -> Optional[ModulePayload]:
    """Canonical ATLF payload for an analytical module, or None if unsupported."""
    if module_id == "CP-0":
        return _cp0()
    if module_id == "CP-1":
        return _cp1()
    return None


# Substring that marks the persisted demo-fixture limitation (so a UI / test can find
# it without depending on the full wording).
DEMO_FIXTURE_LIMITATION = (
    "Financials are synthetic Atlas Forge demo-fixture data served because no model "
    "key is configured for this issuer — they are NOT sourced from this issuer's "
    "filings or any real disclosure. Treat as illustrative only; not committee-usable."
)


def demo_fixture_finding(issuer_id: Optional[str], cp1: Optional[ModulePayload]) -> Optional[Finding]:
    """A MATERIAL CP-5 finding when the deterministic ATLF fixture is served for an
    issuer that is NOT the genuine demo issuer.

    Keyless runs fall back to the FixtureSynthesizer, which returns the Atlas Forge
    demo CP-1 (5.68x leverage, ~$2.8bn revenue) for *any* issuer. For the genuine
    Atlas Forge reference issuer that is correct (and stays Restricted via its seeded
    Weak-Lineage / Conflicting claims). For any *other* issuer those numbers are
    fabricated, so without this they could persist looking authoritative. Emitting a
    MATERIAL finding restricts the run (qa_status → Restricted) and makes the synthetic
    origin explicit. Returns None for the genuine demo issuer or a non-fixture CP-1."""
    if cp1 is None or not getattr(cp1, "is_fixture", False):
        return None
    if issuer_id == REFERENCE_ISSUER_ID:
        return None
    return Finding(
        finding_id="CP-1-DEMO-FIXTURE", severity="MATERIAL", lane=6, module_id="CP-1",
        description=(
            "CP-1 served the Atlas Forge demo fixture (5.68x net leverage, ~$2.8bn "
            "revenue) for a non-demo issuer because no model key is configured — these "
            "figures are synthetic demo data, NOT sourced from this issuer."
        ),
        required_remediation=(
            "Configure a model key (or ingest this issuer's filings) so CP-1 is grounded "
            "in real sources; do not rely on these fixture figures."
        ),
    )


def _cp0() -> ModulePayload:
    return ModulePayload(
        module_id="CP-0",
        module_name="SourceReadiness",
        owned_object="source_readiness_assessment",
        confidence="High",
        downstream_consumers=["CP-X"],
        limitation_flags=["L-04: hedging register not provided (gap G-01)"],
        runtime_output={
            "readiness_score": 0.91,
            "files_classified": 14,
            "gaps_logged": 2,
            "unresolved_conflicts": 0,
            "document_map": [
                {"doc": "D-01", "name": "Offering Memorandum (SSN '31)", "type": "OM", "grade": "A"},
                {"doc": "D-02", "name": "Senior Facilities Agreement", "type": "SFA", "grade": "A"},
                {"doc": "D-03", "name": "SSN Indenture (final)", "type": "Indenture", "grade": "A"},
                {"doc": "D-04", "name": "FY23–FY25 Audited Financials", "type": "Audit", "grade": "A"},
                {"doc": "D-05", "name": "Q1-26 Compliance Certificate", "type": "Covenant", "grade": "A"},
                {"doc": "D-07", "name": "Sponsor Model (extract)", "type": "Model", "grade": "C"},
            ],
            "gap_log": [
                {"id": "G-01", "severity": "warning", "text": "Hedging register / swap confirms not provided — CP-2F degraded (L-04)."},
                {"id": "G-02", "severity": "low", "text": "Q4-25 management accounts missing — CP-1 to construct a derived period."},
            ],
        },
        claims=[
            ClaimSpec(
                claim_id="C-01",
                claim_text="Fourteen source files were classified and the document map is complete with grades from A to C.",
                evidence=[EvidenceSpec("E-01", "documentary_fact", "Directly Sourced",
                                       "Intake manifest", "High")],
            ),
            ClaimSpec(
                claim_id="C-02",
                claim_text="Q4 2025 management accounts were not provided, so CP-1 must construct a derived period from the sponsor model.",
                evidence=[EvidenceSpec("E-58", "gap", "Insufficient Information",
                                       "D-07 sponsor model extract (gap G-02)", "Medium")],
            ),
        ],
    )


def _cp1() -> ModulePayload:
    return ModulePayload(
        module_id="CP-1",
        module_name="CanonicalDataFoundation",
        owned_object="canonical_financials",
        confidence="Medium",
        is_fixture=True,  # ATLF demo numbers — flagged so they don't pose as a real run (#04)
        downstream_consumers=["CP-1B", "CP-1C", "CP-2", "CP-3", "CP-4"],
        limitation_flags=["Q4-25 is a derived period (G-02)"],
        runtime_output={
            "periods_normalized": 12,
            "kpis_registered": 41,
            "coverage_gate": "GREEN",
            "normalized_financials": {
                "revenue": {"FY23": 2410, "FY24": 2588, "FY25": 2742, "LTM_Q1_26": 2801},
                "adj_ebitda": {"FY23": 358, "FY24": 392, "FY25": 415, "LTM_Q1_26": 421},
                "net_debt_ltm": 2391,
                "net_leverage_adj_ltm": 5.68,
                "interest_coverage_ltm": 2.1,
            },
            "definition_conflicts": [
                {"id": "DC-1", "text": "SFA caps cost-saving add-backs at 25% (24mo); SSN indenture uncapped — covenant calcs diverge."},
            ],
        },
        claims=[
            ClaimSpec(
                claim_id="C-10",
                claim_text="Adjusted net leverage is 5.68x at LTM Q1 2026 on net debt of 2391 million.",
                evidence=[EvidenceSpec("E-20", "calculated_metric", "Calculated",
                                       "D-04 audited financials and D-05 compliance certificate", "High")],
            ),
            ClaimSpec(
                claim_id="C-11",
                claim_text="Adjusted EBITDA add-backs represent 18.2 percent of adjusted EBITDA.",
                evidence=[EvidenceSpec("E-09", "table_value", "Directly Sourced",
                                       "D-01 offering memorandum", "High")],
            ),
            ClaimSpec(
                claim_id="C-12",
                claim_text="The Q4 2025 period is a derived period constructed from the sponsor model because management accounts were not provided.",
                evidence=[EvidenceSpec("E-58", "calculated_metric", "Weak Lineage",
                                       "D-07 sponsor model extract (gap G-02)", "Low")],
            ),
            ClaimSpec(
                claim_id="C-13",
                claim_text="The EBITDA definition diverges: the senior facilities agreement caps cost-saving add-backs at 25 percent over 24 months while the senior secured notes indenture is uncapped.",
                evidence=[EvidenceSpec("E-103", "quoted_text", "Conflicting",
                                       "D-02 senior facilities agreement versus D-03 indenture", "Medium")],
            ),
        ],
    )
