"""Whole-suite isolation established before test-module collection.

Some non-server tests import CAOS server modules while pytest is still
collecting.  The environment therefore belongs at the common ``tests`` root,
before any module can cache production/development settings.  Server-specific
fixtures remain in ``tests/server/conftest.py``.
"""

import os
import sys
import tempfile
from pathlib import Path


SERVER_DIR = Path(__file__).resolve().parents[1] / "server"
sys.path.insert(0, str(SERVER_DIR))

_TMP = tempfile.mkdtemp(prefix="caos-tests-")
os.environ.setdefault("DATABASE_URL", f"sqlite+aiosqlite:///{_TMP}/caos_tests.db")
os.environ.setdefault("CAOS_STORAGE_DIR", f"{_TMP}/vault")
os.environ.setdefault("CAOS_RATE_LIMIT_PATH", f"{_TMP}/rate_limit.sqlite3")

# Force-blank (NOT setdefault): with a real key exported, run-creating tests flip
# from the fixture path to LIVE synth, spend real tokens, and invalidate offline
# assertions.  CAOS_TEST_LIVE=1 remains the deliberate live-lane opt-in.
if not os.environ.get("CAOS_TEST_LIVE"):
    os.environ["ANTHROPIC_API_KEY"] = ""
    os.environ["GEMINI_API_KEY"] = ""
    os.environ["OPENROUTER_API_KEY"] = ""

os.environ.setdefault("CAOS_TEST", "1")
os.environ.setdefault("CAOS_DEMO_SEED", "true")

# ``main.py`` hashes inline scripts at import time and its deployed-posture
# guard requires at least one.  Stage a minimal static export before collection
# imports ``main`` so the cached hash set represents a valid test deployment.
_STATIC_DIR = Path(_TMP) / "static"
_STATIC_DIR.mkdir(parents=True, exist_ok=True)
(_STATIC_DIR / "index.html").write_text(
    "<!doctype html><html><body><script>window.__caosTestBoot=1;</script></body></html>"
)
os.environ.setdefault("CAOS_STATIC_DIR", str(_STATIC_DIR))
