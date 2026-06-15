"""Async run execution — executor settings, enqueue/poll, failure, worker claim."""
from __future__ import annotations

from config import Settings


def test_run_executor_settings_defaults():
    s = Settings()
    assert s.caos_run_concurrency == 2
    assert s.caos_run_lease_seconds == 600
    assert s.caos_run_max_attempts == 3


from database import Run


def test_run_model_has_lease_columns():
    cols = Run.__table__.columns
    for name in ("claimed_at", "lease_expires_at", "attempts", "worker_id", "error"):
        assert name in cols, f"Run is missing column {name}"
    assert cols["attempts"].default.arg == 0
