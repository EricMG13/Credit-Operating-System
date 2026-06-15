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
