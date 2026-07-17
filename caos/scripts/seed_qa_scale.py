#!/usr/bin/env python3
"""Seed sanitized, production-scale issuers for QA.

Inserts a configurable number of clearly-fictional high-yield issuers across HY
sectors, each with a
couple of source chunks and headline metric_facts, so every read-only view
(directory, search, command, cross-issuer query) has realistic volume to render.
Run-derived views (pipeline/deep-dive/report/monitor) get authentic data by
triggering real runs through the API after this seeds the registry.

Deterministic (fixed RNG) and idempotent (skips issuers already present by name).
Honors DATABASE_URL / CAOS_STORAGE_DIR — point it at the QA database, e.g.

    DATABASE_URL=sqlite+aiosqlite:///$PWD/server/data/caos_qa.db \\
      server/.venv/bin/python scripts/seed_qa_scale.py --issuers 300

All names are invented for QA. No real company is represented.
"""

from __future__ import annotations

import argparse
import asyncio
import random
import sys
from datetime import datetime, timezone
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parents[1] / "server"
sys.path.insert(0, str(SERVER_DIR))

from sqlalchemy import func, select  # noqa: E402

from config import get_settings  # noqa: E402
from database import (  # noqa: E402
    Analyst,
    AsyncSessionLocal,
    Document,
    DocumentChunk,
    Issuer,
    MetricFact,
    ModuleOutput,
    Run,
    init_db,
)

# (name, ticker, sector, country, energy_intensity 0..1) — fictional HY universe.
ISSUERS = [
    ("Granite Peak Healthcare", "GPHC", "Healthcare", "United States", 0.05),
    ("Vantage Gaming Resorts", "VGMR", "Gaming & Leisure", "United States", 0.12),
    ("Cedar Hollow Packaging", "CDHP", "Packaging", "United States", 0.22),
    ("Ironside Building Products", "IRBP", "Building Products", "United States", 0.18),
    ("Maplewood Auto Components", "MWAC", "Auto Parts", "United States", 0.16),
    ("Beacon Street Media", "BSMD", "Media", "United States", 0.04),
    ("Northgate Cable Holdings", "NGCB", "Cable & Telecom", "United States", 0.09),
    ("Solvent Bay Chemicals", "SVBC", "Specialty Chemicals", "Germany", 0.31),
    ("Tideline Energy Services", "TLES", "Energy Services", "United States", 0.27),
    ("Crestmark Retail Group", "CMRG", "Retail", "United States", 0.06),
    ("Harbor & Vine Restaurants", "HVRS", "Restaurants", "United States", 0.08),
    ("Falconridge Aerospace", "FRAE", "Aerospace & Defense", "United States", 0.14),
    ("Copperline Metals", "CPLM", "Metals & Mining", "Canada", 0.29),
    ("Birchmont Paper Co.", "BRMP", "Paper & Forest", "United States", 0.26),
    ("Quanta Logic Software", "QLSW", "Software", "United States", 0.03),
    ("Lumen Household Brands", "LMHB", "Consumer Products", "United States", 0.10),
    ("Redwood Freight Lines", "RWFL", "Transportation", "United States", 0.19),
    ("Summit Crossing Homes", "SMCH", "Homebuilders", "United States", 0.11),
    ("Atlas Field Services", "ATFS", "Business Services", "United Kingdom", 0.07),
    ("Marisol Cruise Holdings", "MRCH", "Travel & Leisure", "United States", 0.13),
    ("Pinnacle Wireless Towers", "PNWT", "Communications Infra", "United States", 0.08),
    ("Vesper Pharma Holdings", "VSPH", "Pharmaceuticals", "Ireland", 0.05),
    ("Greenfield Agri Supply", "GFAS", "Agriculture", "United States", 0.20),
    ("Halcyon Hospitality", "HLCY", "Lodging", "United States", 0.12),
    ("Brightforge Industrial", "BFIN", "Industrials", "United States", 0.21),
    ("Sable Ridge Utilities", "SBRU", "Power & Utilities", "United States", 0.24),
    ("Continental Plastics Co.", "CTPL", "Plastics", "Mexico", 0.25),
    ("Oakcliff Insurance Svcs", "OKIS", "Insurance Services", "United States", 0.03),
    ("Twin Rivers Gaming", "TRGM", "Gaming & Leisure", "United States", 0.12),
    ("Meridian Cold Storage", "MRCS", "Logistics", "United States", 0.23),
]

_METRIC_KEYS = ["revenue", "adj_ebitda", "ebitda_margin", "gross_margin",
                "net_leverage", "interest_coverage", "fcf_conversion", "energy_cost_pct"]
_UNIT = {"revenue": "$M", "adj_ebitda": "$M", "ebitda_margin": "%", "gross_margin": "%",
         "net_leverage": "x", "interest_coverage": "x", "fcf_conversion": "%", "energy_cost_pct": "%"}

QA_WORKFLOW_RUN_ID = "qa-scale-model-run-000000000001"
QA_WORKFLOW_CP1_ID = "qa-scale-cp1-000000000000000001"
QA_WORKFLOW_ANALYST_EMAIL = "e2e-model@firm.test"
QA_WORKFLOW_ANALYST_NAME = "E2E Model Analyst"


def _workflow_cp1_payload() -> dict:
    """A finite, explicitly synthetic CP-1 anchor for mutation workflows.

    This is opt-in because it represents a completed analytical state without
    executing an LLM-backed run. It is production-shaped test data, never
    production evidence; the limitation flag remains attached to the module.
    """
    return {
        "currency": "USD",
        "reporting_unit": "$M",
        "normalized_financials": {
            "revenue": {"2025-12-31": 1_180.0, "LTM-2026-03-31": 1_225.0},
            "adj_ebitda": {"2025-12-31": 147.0, "LTM-2026-03-31": 155.0},
            "net_debt_ltm": 790.5,
            "net_leverage_adj_ltm": 5.10,
            "interest_coverage_ltm": 2.35,
        },
    }


def _figi(i: int) -> str:
    # Synthetic but well-formed (12-char BBG... ). Deterministic per index.
    base = f"{i:07d}"
    return f"BBG00{base[:4]}{base[4:]}"[:12].ljust(12, "0")


def _issuer_for_index(index: int) -> tuple[str, str, str, str, float]:
    """Return a deterministic fictional issuer, expanding the 30-name base cohort.

    Cohort one keeps the original readable names. Larger pilot/stress books add a
    conspicuous ``QA NN`` suffix and a synthetic ticker so no generated row can be
    mistaken for a real issuer or collide with another cohort.
    """
    name, ticker, sector, country, energy = ISSUERS[index % len(ISSUERS)]
    cohort = index // len(ISSUERS)
    if cohort == 0:
        return name, ticker, sector, country, energy
    return (
        f"{name} QA {cohort + 1:02d}",
        f"Q{index + 1:05d}",
        sector,
        country,
        energy,
    )


def _metrics_for(rng: random.Random, energy: float) -> list[float]:
    revenue = round(rng.uniform(300, 8000), 0)
    ebitda_margin = round(rng.uniform(8, 35), 1)
    adj_ebitda = round(revenue * ebitda_margin / 100, 0)
    gross_margin = round(min(72.0, ebitda_margin + rng.uniform(8, 30)), 1)
    net_leverage = round(rng.uniform(3.0, 7.5), 2)
    interest_coverage = round(rng.uniform(1.4, 4.5), 2)
    fcf_conversion = round(rng.uniform(20, 75), 0)
    energy_cost_pct = round(2 + energy * 28, 1)
    return [revenue, adj_ebitda, ebitda_margin, gross_margin,
            net_leverage, interest_coverage, fcf_conversion, energy_cost_pct]


def _docs_for(name: str, sector: str, energy: float) -> list[tuple[str, str, str]]:
    slug = name.lower().replace(" ", "_").replace("&", "and").replace(".", "")
    energy_line = (
        f"Energy and power are roughly {round(2 + energy * 28)} percent of cost of goods sold; "
        + ("margins are materially exposed to energy-price inflation."
           if energy > 0.2 else
           "direct exposure to energy-price inflation is limited.")
    )
    return [
        ("OM", f"{slug}_offering_memorandum.pdf",
         f"{name} offering memorandum. {sector} issuer in the leveraged-loan market. "
         f"{energy_line} The business funds operations with a senior secured term loan B "
         f"and a revolving credit facility; net leverage reflects an LBO capital structure."),
        ("Covenant", f"{slug}_credit_agreement.pdf",
         f"{name} credit agreement. Springing first-lien net leverage covenant tested when "
         f"the revolver is drawn beyond 35 percent; customary incremental and restricted-payment "
         f"baskets. Interest is SOFR plus a margin stepping with leverage."),
    ]


async def seed(  # noqa: C901 — linear fixture-assembly script, not decision logic
    target_count: int = len(ISSUERS), *, allow_non_qa_database: bool = False,
    with_workflow_fixture: bool = False,
) -> None:
    if not 1 <= target_count <= 10_000:
        raise ValueError("--issuers must be between 1 and 10,000")
    database_url = get_settings().database_url
    if (
        target_count > len(ISSUERS)
        and "qa" not in database_url.casefold()
        and not allow_non_qa_database
    ):
        raise RuntimeError(
            "Refusing a scale seed into a database whose URL is not visibly QA-scoped. "
            "Use an isolated URL containing 'qa', or pass --allow-non-qa-database "
            "only after verifying the target is disposable."
        )
    await init_db()
    rng = random.Random(42)
    created = 0
    target_names = [_issuer_for_index(index)[0] for index in range(target_count)]
    async with AsyncSessionLocal() as session:
        for i in range(target_count):
            name, ticker, sector, country, energy = _issuer_for_index(i)
            exists = (await session.execute(
                select(func.count()).select_from(Issuer).where(Issuer.name == name)
            )).scalar()
            if exists:
                continue
            issuer = Issuer(name=name, ticker=ticker, industry=sector,
                            country=country, figi=_figi(i + 1))
            session.add(issuer)
            await session.flush()  # assign issuer.id

            chunk_ids: list[str] = []
            for seq, (doc_type, file_name, text) in enumerate(_docs_for(name, sector, energy)):
                doc = Document(issuer_id=issuer.id, doc_type=doc_type, file_name=file_name,
                               storage_key=f"qa/{issuer.id}/{seq}", chunk_count=1,
                               uploaded_by="qa-scale-seed")
                session.add(doc)
                await session.flush()
                chunk = DocumentChunk(document_id=doc.id, seq=seq, text=text)
                session.add(chunk)
                await session.flush()
                chunk_ids.append(chunk.id)

            values = _metrics_for(rng, energy)
            for key, value in zip(_METRIC_KEYS, values):
                fact = MetricFact(
                    issuer_id=issuer.id, run_id=None, module_id=None,
                    metric_key=key, period="LTM", unit=_UNIT[key],
                    headline=True, qa_status="Not Reviewed",
                    value=float(value), provenance="seed", basis="adjusted",
                )
                if key == "energy_cost_pct" and chunk_ids:
                    fact.document_chunk_id = chunk_ids[0]
                    fact.provenance = "derived"
                session.add(fact)
            created += 1

        if with_workflow_fixture:
            workflow_issuer = (await session.execute(
                select(Issuer).where(Issuer.name == target_names[0])
            )).scalar_one()
            workflow_analyst = (await session.execute(
                select(Analyst).where(
                    func.lower(Analyst.email) == QA_WORKFLOW_ANALYST_EMAIL.casefold()
                )
            )).scalar_one_or_none()
            if workflow_analyst is None:
                workflow_analyst = Analyst(
                    name=QA_WORKFLOW_ANALYST_NAME,
                    email=QA_WORKFLOW_ANALYST_EMAIL,
                )
                session.add(workflow_analyst)
                await session.flush()
            elif workflow_analyst.name != QA_WORKFLOW_ANALYST_NAME:
                workflow_analyst.name = QA_WORKFLOW_ANALYST_NAME
            workflow_run = await session.get(Run, QA_WORKFLOW_RUN_ID)
            if workflow_run is None:
                now = datetime.now(timezone.utc)
                session.add(Run(
                    id=QA_WORKFLOW_RUN_ID,
                    issuer_id=workflow_issuer.id,
                    status="complete",
                    analyst_id=workflow_analyst.id,
                    as_of_date="2026-03-31",
                    model_id="qa-sanitized-workflow-fixture",
                    prompt_version="qa-fixture-v1",
                    qa_status="Restricted",
                    committee_status="Restricted",
                    completed_at=now,
                    created_at=now,
                ))
                await session.flush()
            elif workflow_run.issuer_id != workflow_issuer.id:
                raise RuntimeError("QA workflow run id is already bound to another issuer")
            else:
                workflow_run.analyst_id = workflow_analyst.id

            workflow_cp1 = await session.get(ModuleOutput, QA_WORKFLOW_CP1_ID)
            if workflow_cp1 is None:
                workflow_cp1 = ModuleOutput(
                    id=QA_WORKFLOW_CP1_ID,
                    run_id=QA_WORKFLOW_RUN_ID,
                    module_id="CP-1",
                    module_name="Sanitized QA financial foundation",
                    owned_object="normalized_financials",
                    runtime_output=_workflow_cp1_payload(),
                    confidence="High",
                    qa_status="Restricted",
                    committee_status="Restricted",
                    validation_status="Passed",
                    limitation_flags=["Sanitized QA fixture; not production evidence."],
                    downstream_consumers=["Model Builder", "Report Studio"],
                )
                session.add(workflow_cp1)
            elif workflow_cp1.run_id != QA_WORKFLOW_RUN_ID:
                raise RuntimeError("QA workflow CP-1 id is already bound to another run")
            else:
                workflow_cp1.runtime_output = _workflow_cp1_payload()
                workflow_cp1.limitation_flags = [
                    "Sanitized QA fixture; not production evidence."
                ]
        await session.commit()
        issuer_count = (await session.execute(
            select(func.count()).select_from(Issuer).where(Issuer.name.in_(target_names))
        )).scalar_one()
        document_count = (await session.execute(
            select(func.count()).select_from(Document)
            .join(Issuer, Document.issuer_id == Issuer.id)
            .where(Issuer.name.in_(target_names))
        )).scalar_one()
        metric_count = (await session.execute(
            select(func.count()).select_from(MetricFact)
            .join(Issuer, MetricFact.issuer_id == Issuer.id)
            .where(Issuer.name.in_(target_names))
        )).scalar_one()
        workflow_run_count = int(
            with_workflow_fixture
            and await session.get(Run, QA_WORKFLOW_RUN_ID) is not None
        )
    print(
        "seed_qa_scale: "
        f"created={created}; already_present={target_count - created}; "
        f"qa_issuers={issuer_count}; qa_documents={document_count}; "
        f"qa_metric_facts={metric_count}; qa_workflow_runs={workflow_run_count}; "
        "sanitized=true"
    )


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--issuers",
        type=int,
        default=len(ISSUERS),
        help="Number of fictional issuers to ensure (default: 30; pilot/stress target: 300).",
    )
    parser.add_argument(
        "--with-workflow-fixture",
        action="store_true",
        help=(
            "Add one clearly-labelled completed CP-1 fixture for live Model Builder "
            "save/reload testing; never treat it as production evidence."
        ),
    )
    parser.add_argument(
        "--allow-non-qa-database",
        action="store_true",
        help="Override the URL safety check after independently verifying the target is disposable.",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = _parse_args()
    asyncio.run(seed(
        args.issuers,
        allow_non_qa_database=args.allow_non_qa_database,
        with_workflow_fixture=args.with_workflow_fixture,
    ))
