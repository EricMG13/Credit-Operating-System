"""Shared test setup.

Routes the server at a throwaway SQLite database and vault dir so tests never
touch the real dev database, and puts the server dir on sys.path. pytest imports
conftest before any test module, so even top-level imports that pull in
``database`` bind to the temp DB.
"""

import os
import re
import sqlite3
import sys
import tempfile
from pathlib import Path

import pytest

SERVER_DIR = Path(__file__).resolve().parents[2] / "server"
sys.path.insert(0, str(SERVER_DIR))

_TMP = tempfile.mkdtemp(prefix="caos-tests-")
os.environ.setdefault("DATABASE_URL", f"sqlite+aiosqlite:///{_TMP}/caos_tests.db")
os.environ.setdefault("CAOS_STORAGE_DIR", f"{_TMP}/vault")
# Force-blank (NOT setdefault): with a real key exported, run-creating tests flip
# from the fixture path to LIVE synth — fixture-path assertions break and the
# suite spends real tokens (BE9-1). Export CAOS_TEST_LIVE=1 to deliberately keep
# your exported keys for a live lane.
if not os.environ.get("CAOS_TEST_LIVE"):
    os.environ["ANTHROPIC_API_KEY"] = ""
    os.environ["GEMINI_API_KEY"] = ""
    os.environ["OPENROUTER_API_KEY"] = ""
os.environ.setdefault("CAOS_TEST", "1")  # NullPool so async + TestClient loops don't share pooled conns
# Demo seeding is now OFF by default (prod safe-by-default, #34); the TestClient
# lifespan suite relies on the seeded demo issuers / reference deal, so opt in here.
os.environ.setdefault("CAOS_DEMO_SEED", "true")
# main.py hashes every inline <script> under the static Next export ONCE at
# import time (module-level _INLINE_SCRIPT_HASHES) and its deployed-posture
# lifespan guard refuses to boot without at least one hash. Some test modules
# `from main import app` at their own top level, importing main during pytest
# collection — before any fixture (even session-scoped) can run — so this has
# to be a real file on disk, staged here, before conftest finishes importing.
_STATIC_DIR = Path(f"{_TMP}/static")
_STATIC_DIR.mkdir(parents=True, exist_ok=True)
(_STATIC_DIR / "index.html").write_text(
    "<!doctype html><html><body><script>window.__caosTestBoot=1;</script></body></html>"
)
os.environ.setdefault("CAOS_STATIC_DIR", str(_STATIC_DIR))

import pytest_asyncio


@pytest.fixture(autouse=True)
def _reset_rate_limit():
    """The rate limiter is process-global; reset it per test so the suite's many
    run/query calls don't trip the per-caller window across tests."""
    import rate_limit

    rate_limit.reset()
    yield


# ── shared-DB isolation guard ────────────────────────────────────────────────
# Every test points at ONE process-global SQLite file (there is no per-test wipe).
# Direct-DB tests that COMMIT synthetic issuers (metricengine/metricfactlane/
# anomaly seed "Acme"/"Beta"; the bench contagion corpus seeds lowercase 'acme'…)
# leak those rows across tests, breaking later name/count/unscoped assertions
# (test_api's exact `?q=acme` set, test_vault_memo's autolink, the unscoped
# metric-fact read). This is the repo's #1 suite hazard — the fix is per-test
# cleanup, not per-test reseeding.
#
# SKIPPED for session-scoped ``client`` tests: those seed the demo book ONCE per
# session via lifespan, so deleting their issuers would break every sibling test
# sharing that client. Sync + stdlib sqlite3 so it works for sync and async tests
# alike (no event loop) and runs after the async engine is disposed (no file lock).
_DB_PATH = re.sub(r"^sqlite\+aiosqlite:///", "", os.environ.get("DATABASE_URL", ""))


def _snapshot_issuer_ids():
    # Empty set (NOT None) when the schema is absent: on the very first direct-DB
    # test the table doesn't exist yet at setup, but the test then creates it +
    # commits issuers — those must still be cleaned on teardown, so treat "no
    # table yet" as "no baseline rows" rather than "skip cleanup".
    if not _DB_PATH or not os.path.exists(_DB_PATH):
        return set()
    con = sqlite3.connect(_DB_PATH, timeout=30)
    try:
        return {r[0] for r in con.execute("SELECT id FROM issuers")}
    except sqlite3.OperationalError:
        return set()  # schema not created yet
    finally:
        con.close()


@pytest.fixture(autouse=True)
def _restore_issuer_baseline(request):
    """Delete issuers (and their metric_facts / documents / chunks / graph links)
    a direct-DB test committed, on teardown, so synthetic names can't leak across
    the shared process-global DB. No-op for session ``client`` tests (see above)."""
    if "client" in request.fixturenames:
        yield
        return
    before = _snapshot_issuer_ids()
    yield
    if not _DB_PATH or not os.path.exists(_DB_PATH):
        return
    con = sqlite3.connect(_DB_PATH, timeout=30)
    try:
        new = tuple({r[0] for r in con.execute("SELECT id FROM issuers")} - before)
        if not new:
            return
        ph = ",".join("?" * len(new))
        docs = [r[0] for r in con.execute(
            f"SELECT id FROM documents WHERE issuer_id IN ({ph})", new)]
        if docs:
            dph = ",".join("?" * len(docs))
            con.execute(f"DELETE FROM document_chunks WHERE document_id IN ({dph})", tuple(docs))
            con.execute(f"DELETE FROM documents WHERE id IN ({dph})", tuple(docs))
        con.execute(f"DELETE FROM metric_facts WHERE issuer_id IN ({ph})", new)
        con.execute(
            f"DELETE FROM query_accepted_links WHERE issuer_a IN ({ph}) OR issuer_b IN ({ph})",
            new + new)
        con.execute(f"DELETE FROM issuers WHERE id IN ({ph})", new)
        con.commit()
    except sqlite3.OperationalError:
        pass  # a referenced table is absent — nothing to clean
    finally:
        con.close()


@pytest_asyncio.fixture
async def seeded_db():
    """Ensure schema + the ATLF reference deal exist for direct-DB async tests.

    Disposes the engine on teardown so pooled aiosqlite connections are not
    reused across pytest-asyncio's per-test event loops.
    """
    from database import AsyncSessionLocal, init_db
    from database import engine as db_engine
    from engine.fixtures import ensure_reference_deal

    await init_db()
    async with AsyncSessionLocal() as s:
        await ensure_reference_deal(s)
        await s.commit()
    yield
    await db_engine.dispose()


def ratings_xlsx(rows: "list[tuple[str, str]]") -> bytes:
    """A minimal in-memory .xlsx with Borrower Name + Ratings columns — the
    structured shape ratings extraction reads on pricing-sheet upload.
    ``rows`` = [(borrower_name, ratings_cell)], e.g. [("Rated Co", "B1 / B+")]."""
    import io

    from openpyxl import Workbook

    wb = Workbook()
    ws = wb.active
    ws.append(["Borrower Name", "Ratings"])
    for name, rating in rows:
        ws.append([name, rating])
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


# Shared by the QueueWorker claim/reaper tests (run/research/report executors):
# SKIP LOCKED only exercises real multi-worker safety on Postgres.
requires_pg = pytest.mark.skipif(
    not os.environ.get("DATABASE_URL", "").startswith("postgresql"),
    reason="worker claim/lease requires Postgres (SKIP LOCKED) — run in the CI server "
           "job's Postgres step, or locally via DATABASE_URL=postgresql+asyncpg://...",
)


def wait_for_run(client, run_id: str, timeout_s: float = 10.0) -> dict:
    """Poll GET /runs/{id} until the run reaches a terminal state."""
    import time

    deadline = time.time() + timeout_s
    while time.time() < deadline:
        r = client.get(f"/api/runs/{run_id}")
        assert r.status_code == 200, r.text
        body = r.json()
        if body["status"] in ("complete", "failed"):
            return body
        time.sleep(0.05)
    raise AssertionError(f"run {run_id} did not finish within {timeout_s}s")
