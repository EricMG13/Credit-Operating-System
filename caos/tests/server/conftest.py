"""Shared test setup.

Routes the server at a throwaway SQLite database and vault dir so tests never
touch the real dev database, and puts the server dir on sys.path. pytest imports
conftest before any test module, so even top-level imports that pull in
``database`` bind to the temp DB.
"""

import os
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

import pytest_asyncio


@pytest.fixture(autouse=True)
def _reset_rate_limit():
    """The rate limiter is process-global; reset it per test so the suite's many
    run/query calls don't trip the per-caller window across tests."""
    import rate_limit

    rate_limit.reset()
    yield


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
