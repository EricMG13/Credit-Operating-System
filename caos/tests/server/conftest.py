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

SERVER_DIR = Path(__file__).resolve().parents[2] / "server"
sys.path.insert(0, str(SERVER_DIR))

_TMP = tempfile.mkdtemp(prefix="caos-tests-")
os.environ.setdefault("DATABASE_URL", f"sqlite+aiosqlite:///{_TMP}/caos_tests.db")
os.environ.setdefault("CAOS_STORAGE_DIR", f"{_TMP}/vault")
os.environ.setdefault("ANTHROPIC_API_KEY", "")

import pytest_asyncio


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
