"""Demo seed — the three demo issuers, inserted once on an empty database.

Also backfills demo-row fields (e.g. FIGI) added after a database was first
seeded, so existing local/dev databases pick them up on restart.
"""

from __future__ import annotations

from sqlalchemy import func, select

from database import AsyncSessionLocal, Document, DocumentChunk, Issuer, MetricFact
from engine.fixtures import REFERENCE_ISSUER_ID
from engine.metrics import derive_energy_cost_pct

DEMO_ISSUERS = [
    {
        "id": "11111111-1111-1111-1111-111111111111",
        "name": "Acme Holdings Corp.",
        "ticker": "ACM",
        "industry": "Technology",
        "country": "USA",
        "figi": "BBG00CXKLMN4",
    },
    {
        "id": "22222222-2222-2222-2222-222222222222",
        "name": "Meridian Telecom Holdings",
        "ticker": "MRDN",
        "industry": "Telecom",
        "country": "UK",
        "figi": "BBG00MRDNTL7",
    },
    {
        "id": "33333333-3333-3333-3333-333333333333",
        "name": "Aurora Chemicals SA",
        "ticker": "AURC",
        "industry": "Specialty Chemicals",
        "country": "France",
        "figi": "BBG00RCHMCL2",
    },
]


async def seed_demo_data() -> None:
    async with AsyncSessionLocal() as session:
        count = (await session.execute(select(func.count()).select_from(Issuer))).scalar()
        if not count:
            for row in DEMO_ISSUERS:
                session.add(Issuer(**row))
        else:
            # Backfill newer demo fields on already-seeded databases.
            for row in DEMO_ISSUERS:
                issuer = await session.get(Issuer, row["id"])
                if issuer is not None and not issuer.figi:
                    issuer.figi = row["figi"]
        await session.commit()


# Illustrative headline metrics for cross-issuer NL query, differentiated so the
# canonical example ("margins most exposed to energy-price inflation") returns a
# sensible ranking (Aurora Chemicals most exposed). These are SEED facts; ATLF's
# financials are overridden by run-derived facts once a run completes (the engine
# projects CP-1), while energy_cost_pct stays illustrative for every issuer until
# a cost-structure module produces it. Keyed: (revenue, adj_ebitda, ebitda_margin,
# gross_margin, net_leverage, interest_coverage, fcf_conversion, energy_cost_pct).
_M = ["revenue", "adj_ebitda", "ebitda_margin", "gross_margin",
      "net_leverage", "interest_coverage", "fcf_conversion", "energy_cost_pct"]
_UNIT = {"revenue": "$M", "adj_ebitda": "$M", "ebitda_margin": "%", "gross_margin": "%",
         "net_leverage": "x", "interest_coverage": "x", "fcf_conversion": "%", "energy_cost_pct": "%"}
SEED_METRICS = {
    "11111111-1111-1111-1111-111111111111":  # Acme (Technology)
        [1850, 555, 30.0, 62.0, 2.3, 8.5, 68, 4.0],
    "22222222-2222-2222-2222-222222222222":  # Meridian Telecom
        [4200, 1680, 40.0, 55.0, 5.1, 3.2, 52, 7.0],
    "33333333-3333-3333-3333-333333333333":  # Aurora Chemicals — energy-intensive
        [3100, 527, 17.0, 24.0, 4.4, 3.8, 38, 28.0],
    REFERENCE_ISSUER_ID:                       # Atlas Forge (Industrials)
        [2801, 421, 15.0, 26.5, 5.68, 2.1, 41, 12.0],
}


# Distinctive source chunks per demo issuer, so cross-issuer semantic retrieval
# (Approach B) has real, differentiated text to ground qualitative questions in —
# e.g. "which issuers flag energy / input-cost pressure" surfaces Aurora. Mirrors
# the ATLF document seeding in engine/fixtures.py. (issuer_id -> [(doc_type,
# file_name, chunk_text)]). ATLF already has its own seeded documents.
DEMO_DOCS = {
    "11111111-1111-1111-1111-111111111111": [  # Acme Holdings (Technology / SaaS)
        ("OM", "acme_offering_memorandum.pdf",
         "Acme Holdings offering memorandum. Cloud software subscription revenue with a "
         "92 percent gross margin and high net revenue retention. Input costs are minimal — "
         "primarily cloud hosting and engineering payroll — so the business has negligible "
         "exposure to commodity or energy-price inflation; energy and power are roughly "
         "4 percent of cost of goods sold. Net leverage 2.3x with strong free cash flow "
         "conversion."),
        ("Covenant", "acme_compliance_certificate.pdf",
         "Acme compliance certificate. Springing first-lien leverage covenant at 5.0x with "
         "ample headroom; interest coverage 8.5x."),
    ],
    "22222222-2222-2222-2222-222222222222": [  # Meridian Telecom (Telecom / UK)
        ("LP", "meridian_lender_presentation.pdf",
         "Meridian Telecom Holdings lender presentation. The fibre-to-the-home build requires "
         "sustained capital expenditure; net leverage of 5.1x reflects the debt-funded network "
         "rollout. Revenue is largely contracted broadband ARPU, with limited direct exposure "
         "to energy prices beyond network power consumption — network power is roughly "
         "7 percent of cost of goods sold."),
        ("SFA", "meridian_senior_facilities_agreement.pdf",
         "Meridian senior facilities agreement. Maintenance net leverage covenant set at 5.75x; "
         "covenant headroom is tight given the ongoing capex program. Interest coverage 3.2x."),
    ],
    "33333333-3333-3333-3333-333333333333": [  # Aurora Chemicals (Specialty Chemicals / FR)
        ("OM", "aurora_offering_memorandum.pdf",
         "Aurora Chemicals SA offering memorandum. Production is energy-intensive: chlor-alkali "
         "electrolysis and ammonia synthesis make electricity and natural gas the single largest "
         "variable input cost, roughly 28 percent of cost of goods sold. EBITDA margins are "
         "highly exposed to energy-price inflation — a sustained rise in European power and gas "
         "prices compresses margins materially, with limited ability to pass through input-cost "
         "increases on contracted volumes."),
        ("Risk", "aurora_risk_factors.pdf",
         "Aurora risk factors. Energy and feedstock price volatility is the principal margin "
         "risk; carbon costs under the EU Emissions Trading System add further input-cost "
         "pressure in higher-inflation environments."),
    ],
}


async def seed_demo_documents() -> None:
    """Seed distinctive source documents + chunks for the demo issuers (idempotent
    per issuer), so cross-issuer semantic retrieval has real text to ground in."""
    async with AsyncSessionLocal() as session:
        for issuer_id, docs in DEMO_DOCS.items():
            has_docs = (await session.execute(
                select(func.count()).select_from(Document).where(Document.issuer_id == issuer_id)
            )).scalar()
            if has_docs:
                continue
            for seq, (doc_type, file_name, text) in enumerate(docs):
                doc = Document(
                    issuer_id=issuer_id, doc_type=doc_type, file_name=file_name,
                    storage_key=f"reference/demo/{issuer_id}/{seq}", chunk_count=1,
                    uploaded_by="demo-seed",
                )
                session.add(doc)
                await session.flush()  # assign doc.id
                session.add(DocumentChunk(document_id=doc.id, seq=seq, text=text))
        await session.commit()


async def seed_metrics() -> None:
    """Seed headline metric_facts once, on an empty store.

    energy_cost_pct is *derived* from each issuer's own filings where they
    disclose it (provenance "derived", cited to the source chunk) rather than
    hardcoded — the evidence-grounded value the cross-issuer ranking pins on.
    The remaining metrics stay illustrative seed until a module produces them.
    """
    async with AsyncSessionLocal() as session:
        existing = (await session.execute(
            select(func.count()).select_from(MetricFact)
            .where(MetricFact.provenance.in_(["seed", "derived"]))
        )).scalar()
        if existing:
            return
        for issuer_id, values in SEED_METRICS.items():
            # Pull this issuer's chunks once and try to derive energy exposure.
            chunks = (await session.execute(
                select(DocumentChunk.id, Document.file_name, DocumentChunk.text)
                .join(Document, Document.id == DocumentChunk.document_id)
                .where(Document.issuer_id == issuer_id)
            )).all()
            derived = derive_energy_cost_pct([(c[0], c[1], c[2]) for c in chunks])
            for key, value in zip(_M, values):
                fact = dict(
                    issuer_id=issuer_id, run_id=None, module_id=None,
                    metric_key=key, period="LTM", unit=_UNIT[key],
                    headline=True, qa_status="Not Reviewed",
                    value=float(value), provenance="seed",
                    basis="adjusted",  # illustrative seed values are covenant-adjusted style
                )
                if key == "energy_cost_pct" and derived is not None:
                    val, chunk_id, _doc = derived
                    fact.update(value=val, provenance="derived", document_chunk_id=chunk_id)
                session.add(MetricFact(**fact))
        await session.commit()
