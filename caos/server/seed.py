"""Demo seed — the three demo issuers, inserted once on an empty database.

Also backfills demo-row fields (e.g. FIGI) added after a database was first
seeded, so existing local/dev databases pick them up on restart.
"""

from __future__ import annotations

from sqlalchemy import func, select

from database import AsyncSessionLocal, Deal, DealTerm, Document, DocumentChunk, Issuer, MetricFact
from engine.fixtures import REFERENCE_ISSUER_ID
from engine.metrics import derive_energy_cost_pct
from engine.terms_catalog import BY_KEY

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


# ─── Loan Compare demo deals ─────────────────────────────────────────────────
# Three leveraged-loan documentation snapshots across distinct issuers, so the
# /compare grid (and its benchmark-delta / diff-only / loophole-heat behaviors)
# is exercisable before the CP-4D extractor exists. team.blue carries the rich
# term set from the reference UI; the others diff against it. Keys reference
# engine/terms_catalog; values route to value_num (numeric terms) or value_text
# automatically. Demo-only — gated by CAOS_DEMO_SEED (off in production).
SEED_DEALS = [
    {
        "issuer_id": "aaaa0000-0000-0000-0000-000000000001",
        "issuer_name": "team.blue Group", "industry": "Software", "country": "Belgium",
        "deal_id": "dddd0000-0000-0000-0000-000000000001",
        "label": "team.blue", "transaction_phase": "Final", "launch_date": "2021-03-08",
        "terms": {
            "company": "team.blue", "transaction_phase": "Final", "industry": "Software",
            "launch_date": "2021-03-08", "purpose": "Refinancing / Dividend Recap",
            "corporate_rating_close": "B/B3", "facility_rating": "B2/B",
            "lead_arrangers": "ING; JP Morgan; Credit Suisse; ABN AMRO; Bank of America / Merrill Lynch; BNP Paribas",
            "ownership_sponsor": "HgCapital",
            "call_term_months": 6, "call_type": "Soft", "term_loan_size_musd": 1787,
            "ytm": 0.069438209, "price": 1, "floor": 0.005, "spread_bps": 275,
            "libor_succession": "Negative lender consent", "mfn_hard_cap_musd": "—",
            "free_clear_incurs_mfn": "No", "free_clear_grower_type": "EBITDA",
            "free_clear_grower_pct": 100, "free_clear_hard_cap_musd": 660,
            "free_clear_ratio_name_1": "Net First Lien Leverage Ratio",
            "free_clear_ratio_level_1": 5.75, "inside_maturity_hard_cap_musd": 660,
            "reclassification": "Yes",
            "restructuring_business_optimization": "Uncapped",
            "synergies_cost_savings_cap": "Uncapped", "realized_action_window_months": 24,
            "builds_from_unswept_asset_sale_proceeds": "From step-down",
            "starter_base_amount_musd": 235, "starter_grower_type": "EBITDA", "starter_grower_pct": 35,
            "d1_unrestricted_sub_investments_musd": 1400.8, "d1_restricted_payments_musd": 576.8,
            "d1_general_purpose_debt_musd": 3519.8,
            "d1_unrestricted_sub_investments_pct": 1.7, "d1_restricted_payments_pct": 0.7,
            "d1_general_purpose_debt_pct": 4.3,
            "gb_hardcap_investments_musd": 465, "gb_hardcap_restricted_payments_musd": 200,
            "gbg_grower_type": "EBITDA", "gbg_investments_pct": 70,
            "gbg_restricted_payments_pct": 30, "gbg_liens_pct": 50,
            "portability": "No", "passthrough": "No",
            "ecf_sweep_initial_pct": 50, "ecf_sweep_ratio_type": "Net First Lien Leverage Ratio",
            "ecf_sweep_stepdown_1_pct": 25, "ecf_sweep_stepdown_1_ratio": 5.5,
            "ecf_sweep_stepdown_2_pct": 0, "ecf_sweep_stepdown_2_ratio": 5.25,
            "asset_sales_stepdown": "Yes", "asset_sales_reinvestment_period_months": 18,
            "asset_sales_reinvestment_extension_months": 6,
            "cov_lite": "Yes",
            "equity_cure_analysis": (
                "Permits use of qualified (or disqualified if reasonably acceptable to "
                "administrative agent) equity issuances / contributions to cure financial "
                "covenant default; cure amounts applied as deemed increase in EBITDA or, if "
                "actually used to repay debt, a debt decrease. Limited to: 2 cures in any "
                "4-quarter period, 5 cures in total (life of deal). Overcure: Not permitted"
            ),
            "springing_trigger_1_threshold": 40, "springing_trigger_1_initial_level": 9.6,
            "springing_trigger_1_ratio": "Net First Lien Leverage Ratio",
            "score_lenders_repricing_optionality": 4, "score_default_protection": 4,
            "score_collateral_protection": 4, "score_composite": 4,
            "ratio_debt_carveout": 6.75,
            "non_loan_party_debt": "> EUR265 million / 40% of EBITDA",
            "acquisition_debt": (
                "Uncapped subject to either 6.75x Net Total Leverage Ratio or 2x Fixed Charge "
                "Coverage Ratio; in each case subject to 'or no worse' optionality"
            ),
            "intercompany_debt": (
                "Uncapped among restricted group; debt of loan parties owing to non-loan "
                "parties must be subordinated"
            ),
            "rp_ratio_carveout": 5.25,
            "shared_general_basket": (
                "> of EUR165 million / 30% of EBITDA subject to no EoD (shared with Debt, "
                "Investments, and Junior Debt Prepayments covenants)"
            ),
        },
    },
    {
        "issuer_id": "aaaa0000-0000-0000-0000-000000000002",
        "issuer_name": "Alter Domus", "industry": "Financial Services", "country": "Luxembourg",
        "deal_id": "dddd0000-0000-0000-0000-000000000002",
        "label": "Alter Domus", "transaction_phase": "Final", "launch_date": "2021-02-08",
        "terms": {
            "company": "Alter Domus", "transaction_phase": "Final", "industry": "Financial Services",
            "launch_date": "2021-02-08", "purpose": "Merger or Acquisition Financing",
            "corporate_rating_close": "B/B3", "facility_rating": "NR",
            "lead_arrangers": "Goldman Sachs Bank USA; Mizuho Bank; Natwest; Macquarie; Bank of Ireland; HSBC; Royal Bank of Canada; National Westminster Bank",
            "ownership_sponsor": "Permira",
            "call_term_months": 6, "call_type": "Soft", "term_loan_size_musd": 1200,
            "price": 1, "floor": 0.005, "spread_bps": 400,
            "mfn_hard_cap_musd": 50, "free_clear_grower_type": "EBITDA", "free_clear_grower_pct": 100,
            "free_clear_hard_cap_musd": 450, "free_clear_ratio_name_1": "Net First Lien Leverage Ratio",
            "free_clear_ratio_level_1": 5.5, "reclassification": "Yes",
            "synergies_cost_savings_cap": "25% of EBITDA", "realized_action_window_months": 18,
            "d1_general_purpose_debt_musd": 2400,
            "ecf_sweep_initial_pct": 50, "ecf_sweep_stepdown_1_pct": 25,
            "cov_lite": "Yes", "springing_trigger_1_threshold": 40, "springing_trigger_1_initial_level": 8.5,
            "score_lenders_repricing_optionality": 3, "score_default_protection": 3,
            "score_collateral_protection": 4, "score_composite": 3,
            "ratio_debt_carveout": 6.5, "non_loan_party_debt": "> EUR200 million / 35% of EBITDA",
            "rp_ratio_carveout": 5.0,
        },
    },
    {
        "issuer_id": "aaaa0000-0000-0000-0000-000000000003",
        "issuer_name": "Verisure Holding", "industry": "Consumer Services", "country": "Sweden",
        "deal_id": "dddd0000-0000-0000-0000-000000000003",
        "label": "Verisure", "transaction_phase": "Final", "launch_date": "2021-04-12",
        "terms": {
            "company": "Verisure", "transaction_phase": "Final", "industry": "Consumer Services",
            "launch_date": "2021-04-12", "purpose": "Refinancing / Dividend Recap",
            "corporate_rating_close": "B+/B1", "facility_rating": "B1/B+",
            "lead_arrangers": "Goldman Sachs; Deutsche Bank; Morgan Stanley; Nordea",
            "ownership_sponsor": "Hellman & Friedman",
            "call_term_months": 6, "call_type": "Soft", "term_loan_size_musd": 2300,
            "price": 0.995, "floor": 0, "spread_bps": 300,
            "mfn_hard_cap_musd": 75, "free_clear_grower_pct": 100, "free_clear_hard_cap_musd": 700,
            "free_clear_ratio_level_1": 6.0, "reclassification": "No",
            "synergies_cost_savings_cap": "Uncapped", "realized_action_window_months": 24,
            "ecf_sweep_initial_pct": 75, "ecf_sweep_stepdown_1_pct": 50,
            "cov_lite": "Yes", "springing_trigger_1_initial_level": 9.0,
            "score_lenders_repricing_optionality": 4, "score_default_protection": 4,
            "score_collateral_protection": 5, "score_composite": 4,
            "ratio_debt_carveout": 7.0, "rp_ratio_carveout": 5.5,
        },
    },
]


async def seed_deals() -> None:
    """Seed the demo Loan Compare deals once, on an empty deals table. Creates the
    backing issuer if absent. Values route to value_num/value_text per the catalog
    type; non-numeric values on a numeric term (e.g. '—') land in value_text."""
    async with AsyncSessionLocal() as session:
        existing = (await session.execute(select(func.count()).select_from(Deal))).scalar()
        if existing:
            return
        for d in SEED_DEALS:
            if await session.get(Issuer, d["issuer_id"]) is None:
                session.add(Issuer(
                    id=d["issuer_id"], name=d["issuer_name"],
                    industry=d.get("industry"), country=d.get("country"),
                ))
            session.add(Deal(
                id=d["deal_id"], issuer_id=d["issuer_id"], label=d["label"],
                transaction_phase=d.get("transaction_phase"), launch_date=d.get("launch_date"),
                provenance="seed",
            ))
            for key, value in d["terms"].items():
                term = BY_KEY.get(key)
                if term is None:
                    continue
                row = DealTerm(
                    deal_id=d["deal_id"], term_key=key,
                    extraction_type="documentary_fact", lineage_class="Directly Sourced",
                    confidence="High",
                )
                if term.is_numeric and isinstance(value, (int, float)):
                    row.value_num = float(value)
                else:
                    row.value_text = str(value)
                    if term.vtype == "quote":
                        row.quote = str(value)
                session.add(row)
        await session.commit()
