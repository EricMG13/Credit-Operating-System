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
