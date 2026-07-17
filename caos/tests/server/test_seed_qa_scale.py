"""Safety and determinism contracts for the production-scale QA seed."""

from __future__ import annotations

import random
import sys
import types
from pathlib import Path

import pytest

SCRIPTS_DIR = Path(__file__).resolve().parents[2] / "scripts"
sys.path.insert(0, str(SCRIPTS_DIR))

import seed_qa_scale  # noqa: E402


def test_300_issuer_book_is_deterministic_unique_and_conspicuously_fictional():
    first = [seed_qa_scale._issuer_for_index(index) for index in range(300)]
    second = [seed_qa_scale._issuer_for_index(index) for index in range(300)]

    assert first == second
    assert len({row[0] for row in first}) == 300
    assert len({row[1] for row in first}) == 300
    assert len({seed_qa_scale._figi(index + 1) for index in range(300)}) == 300
    assert all(" QA " in row[0] for row in first[len(seed_qa_scale.ISSUERS) :])


def test_metric_generation_is_finite_and_repeatable():
    left = seed_qa_scale._metrics_for(random.Random(42), 0.25)
    right = seed_qa_scale._metrics_for(random.Random(42), 0.25)

    assert left == right
    assert len(left) == len(seed_qa_scale._METRIC_KEYS) == 8
    assert all(isinstance(value, float | int) for value in left)


def test_workflow_cp1_fixture_is_finite_and_explicitly_sanitized():
    payload = seed_qa_scale._workflow_cp1_payload()
    financials = payload["normalized_financials"]

    assert payload["currency"] == "USD"
    assert payload["reporting_unit"] == "$M"
    assert financials["revenue"]["LTM-2026-03-31"] > 0
    assert financials["adj_ebitda"]["LTM-2026-03-31"] > 0
    assert financials["net_debt_ltm"] > 0
    assert financials["net_leverage_adj_ltm"] > 0
    assert seed_qa_scale.QA_WORKFLOW_RUN_ID.startswith("qa-scale-")
    assert seed_qa_scale.QA_WORKFLOW_CP1_ID.startswith("qa-scale-")
    assert seed_qa_scale.QA_WORKFLOW_ANALYST_EMAIL.endswith("@firm.test")
    assert seed_qa_scale.QA_WORKFLOW_ANALYST_NAME.startswith("E2E ")


@pytest.mark.asyncio
async def test_scale_seed_refuses_database_without_qa_marker(monkeypatch):
    initialized = False

    async def fake_init_db() -> None:
        nonlocal initialized
        initialized = True

    monkeypatch.setattr(
        seed_qa_scale,
        "get_settings",
        lambda: types.SimpleNamespace(
            database_url="postgresql+asyncpg://caos:local@127.0.0.1/caos"
        ),
    )
    monkeypatch.setattr(seed_qa_scale, "init_db", fake_init_db)

    with pytest.raises(RuntimeError, match="not visibly QA-scoped"):
        await seed_qa_scale.seed(300)
    assert initialized is False


@pytest.mark.asyncio
@pytest.mark.parametrize("count", [0, 10_001])
async def test_scale_seed_has_finite_count_bounds(count):
    with pytest.raises(ValueError, match="between 1 and 10,000"):
        await seed_qa_scale.seed(count)
