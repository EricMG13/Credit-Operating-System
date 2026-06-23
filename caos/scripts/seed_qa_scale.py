#!/usr/bin/env python3
"""Seed sanitized, production-scale issuers for QA.

Inserts ~30 clearly-fictional high-yield issuers across HY sectors, each with a
couple of source chunks and headline metric_facts, so every read-only view
(directory, search, command, cross-issuer query) has realistic volume to render.
Run-derived views (pipeline/deep-dive/report/monitor) get authentic data by
triggering real runs through the API after this seeds the registry.

Deterministic (fixed RNG) and idempotent (skips issuers already present by name).
Honors DATABASE_URL / CAOS_STORAGE_DIR — point it at the QA database, e.g.

    DATABASE_URL=sqlite+aiosqlite:///$PWD/server/data/caos_qa.db \\
      server/.venv/bin/python scripts/seed_qa_scale.py

All names are invented for QA. No real company is represented.
"""

from __future__ import annotations

import asyncio
import random
import sys
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parents[1] / "server"
sys.path.insert(0, str(SERVER_DIR))

from sqlalchemy import func, select  # noqa: E402

from database import (  # noqa: E402
    AsyncSessionLocal,
    Document,
    DocumentChunk,
    Issuer,
    MetricFact,
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


def _figi(i: int) -> str:
    # Synthetic but well-formed (12-char BBG... ). Deterministic per index.
    base = f"{i:07d}"
    return f"BBG00{base[:4]}{base[4:]}"[:12].ljust(12, "0")


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


async def seed() -> None:
    await init_db()
    rng = random.Random(42)
    created = 0
    async with AsyncSessionLocal() as session:
        for i, (name, ticker, sector, country, energy) in enumerate(ISSUERS):
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
        await session.commit()
    print(f"seed_qa_scale: created {created} issuer(s); {len(ISSUERS) - created} already present.")


if __name__ == "__main__":
    asyncio.run(seed())
