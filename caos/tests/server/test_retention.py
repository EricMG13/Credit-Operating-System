"""metric_facts retention (AUDIT DATA-1): a new run supersedes its issuer's older
run-derived facts, so the store doesn't grow unbounded as runs scale. Seed facts
are untouched.
"""

from __future__ import annotations

import sqlite3

import pytest
from fastapi.testclient import TestClient

from config import get_settings
from conftest import wait_for_run
from engine.fixtures import REFERENCE_ISSUER_ID


@pytest.fixture(scope="module")
def client():
    from main import app

    with TestClient(app) as c:
        yield c


def _db_path() -> str:
    return get_settings().database_url.split("///")[-1]


def test_run_facts_pruned_to_latest_run(client):
    r1 = wait_for_run(client, client.post("/api/runs", json={"issuer_id": REFERENCE_ISSUER_ID}).json()["id"])
    r2 = wait_for_run(client, client.post("/api/runs", json={"issuer_id": REFERENCE_ISSUER_ID}).json()["id"])
    assert r1["id"] != r2["id"]

    con = sqlite3.connect(_db_path())
    try:
        run_ids = {
            row[0] for row in con.execute(
                "SELECT DISTINCT run_id FROM metric_facts "
                "WHERE issuer_id = ? AND provenance = 'run'",
                (REFERENCE_ISSUER_ID,),
            ).fetchall()
        }
        seed_count = con.execute(
            "SELECT COUNT(*) FROM metric_facts WHERE provenance = 'seed'"
        ).fetchone()[0]
    finally:
        con.close()

    # Only the latest run's facts survive; the earlier run's were superseded.
    assert run_ids == {r2["id"]}
    # Seed (illustrative) facts are never pruned.
    assert seed_count > 0


@pytest.mark.asyncio
async def test_retention_does_not_wipe_a_module_that_wrote_nothing_this_run(monkeypatch, seeded_db):
    """A module's prior run-provenance facts must only be superseded by a run
    that actually wrote a replacement for THAT module — not merely because the
    module wasn't Blocked, and not because some OTHER module on the same run
    succeeded.

    Root cause (confidence-review 2026-07-12): the old retention delete fired
    on ``cp1_ok or cp2_ok`` (only-not-Blocked), a strictly weaker condition
    than "wrote a fact" — extract_facts/extract_cost_facts can legitimately
    return zero rows for a not-Blocked module (e.g. no finite headline
    metric), and the single shared delete swept BOTH modules' prior rows
    whenever EITHER one merely wasn't Blocked. A run where CP-1 succeeds but
    CP-2 goes Blocked would silently wipe CP-2's last-known-good fact
    (e.g. energy_cost_pct) down to nothing, with no replacement written.

    Reproduces without needing the 1400+ test full suite: run1 writes a real
    CP-2 fact; run2 forces CP-2 to crash (Blocked) while CP-1 still succeeds
    and writes its own new facts. The seeded run1 CP-2 fact must survive.
    """
    from sqlalchemy import select

    import engine.runner as runner
    from database import AsyncSessionLocal, MetricFact, Run
    from run_executor import execute_run_by_id

    async def _cp2_run_facts():
        async with AsyncSessionLocal() as s:
            return (await s.execute(
                select(MetricFact).where(
                    MetricFact.issuer_id == REFERENCE_ISSUER_ID,
                    MetricFact.module_id == "CP-2",
                    MetricFact.provenance == "run",
                )
            )).scalars().all()

    async with AsyncSessionLocal() as s:
        run1 = Run(issuer_id=REFERENCE_ISSUER_ID, analyst_id="t")
        s.add(run1)
        await s.commit()
        run1_id = run1.id
    await execute_run_by_id(run1_id)

    seeded = await _cp2_run_facts()
    assert seeded, "run1 must have written a run-provenance CP-2 fact to seed the regression"
    seeded_ids = {f.id for f in seeded}

    orig_resolve = runner.resolve_binding

    async def _crash_cp2(ctx, *a, **k):
        if ctx.module_id == "CP-2":
            raise TypeError("simulated CP-2 crash — gates to Blocked")
        return await orig_resolve(ctx, *a, **k)

    monkeypatch.setattr(runner, "resolve_binding", _crash_cp2)

    async with AsyncSessionLocal() as s:
        run2 = Run(issuer_id=REFERENCE_ISSUER_ID, analyst_id="t")
        s.add(run2)
        await s.commit()
        run2_id = run2.id
    await execute_run_by_id(run2_id)

    async with AsyncSessionLocal() as s:
        run2_row = await s.get(Run, run2_id)
        assert run2_row.status == "complete"

    survivors = await _cp2_run_facts()
    # CP-2 wrote nothing this run (it crashed -> Blocked) — its run1 facts must
    # survive untouched, not be swept by CP-1's unrelated successful retention.
    assert {f.id for f in survivors} == seeded_ids
    assert all(f.run_id == run1_id for f in survivors)
