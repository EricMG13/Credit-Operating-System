"""Demo seed is order-independent.

The seed once gated on an empty database, so when any other rows were written
first the demo issuers/metrics were silently skipped — a state/ordering flake
that only surfaced when test modules ran in a different order. These tests pin
the per-entity ``ensure`` behaviour: the demo data must land on a *non-empty*
database too. ``seeded_db`` ensures the ATLF reference deal first, so the
Issuer table is already populated when the demo seed runs.
"""

from __future__ import annotations

import pytest
from sqlalchemy import func, select

from database import AsyncSessionLocal, Issuer, MetricFact
from seed import DEMO_ISSUERS, seed_demo_data, seed_demo_documents, seed_metrics


@pytest.mark.asyncio
async def test_seed_demo_data_lands_on_non_empty_db(seeded_db):
    await seed_demo_data()
    async with AsyncSessionLocal() as s:
        for row in DEMO_ISSUERS:
            assert (await s.get(Issuer, row["id"])) is not None, row["name"]


@pytest.mark.asyncio
async def test_seed_metrics_lands_for_each_demo_issuer(seeded_db):
    await seed_demo_data()
    await seed_demo_documents()
    await seed_metrics()
    async with AsyncSessionLocal() as s:
        for row in DEMO_ISSUERS:
            n = (await s.execute(
                select(func.count()).select_from(MetricFact)
                .where(MetricFact.issuer_id == row["id"])
                .where(MetricFact.provenance.in_(["seed", "derived"]))
            )).scalar()
            assert n > 0, row["name"]
