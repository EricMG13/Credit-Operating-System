"""
Tests for the LangGraph DAG orchestration.
Verifies routing logic (FULL vs DELTA), cyclic dependency absence, and CP-0 blocking.
"""

import pytest
from agents.orchestration.planner_router import run_cpx, FULL_RUN_PLAN, DELTA_RUN_PLAN


class TestPlannerRouter:
    @pytest.mark.asyncio
    async def test_full_run_plan(self):
        plan = await run_cpx("FULL_RUN", "test-issuer")
        assert plan == FULL_RUN_PLAN
        # One-Owner-Per-Object: no duplicates
        assert len(plan) == len(set(plan))

    @pytest.mark.asyncio
    async def test_delta_run_plan(self):
        plan = await run_cpx("DELTA_RUN", "test-issuer")
        assert plan == DELTA_RUN_PLAN
        assert "CP-1" not in plan   # CP-1 skipped in delta
        assert "CP-1B" in plan      # CP-1B runs instead
        assert "CP-2" in plan

    @pytest.mark.asyncio
    async def test_force_full_overrides_delta(self):
        plan = await run_cpx("DELTA_RUN", "test-issuer", force_full=True)
        assert plan == FULL_RUN_PLAN

    def test_no_cyclic_dependencies(self):
        """Verify plans have no repeated module IDs (guards against infinite loops)."""
        assert len(FULL_RUN_PLAN) == len(set(FULL_RUN_PLAN))
        assert len(DELTA_RUN_PLAN) == len(set(DELTA_RUN_PLAN))


class TestCP0Readiness:
    @pytest.mark.asyncio
    async def test_blocks_on_missing_docs(self):
        """CP-0 should return BLOCKED if canonical docs are missing."""
        from unittest.mock import AsyncMock, MagicMock, patch

        with patch("agents.orchestration.readiness.AsyncSessionLocal") as mock_session_cls:
            mock_session = AsyncMock()
            mock_session_cls.return_value.__aenter__.return_value = mock_session

            class MockRow:
                doc_type = "InterimReport"
                id = "some-id"

            result = MagicMock()
            result.all.return_value = [MockRow()]
            mock_session.execute.return_value = result

            from agents.orchestration.readiness import run_cp0
            output = await run_cp0("test-issuer", "some-id")

        assert output["verdict"] == "BLOCKED"
        assert len(output["missing_docs"]) > 0

    @pytest.mark.asyncio
    async def test_full_run_on_complete_docs(self):
        """CP-0 should return READY + FULL_RUN when all canonical docs exist."""
        from unittest.mock import AsyncMock, MagicMock, patch

        doc_types = ["OM", "CreditAgreement", "LBOModel"]

        with patch("agents.orchestration.readiness.AsyncSessionLocal") as mock_session_cls:
            mock_session = AsyncMock()
            mock_session_cls.return_value.__aenter__.return_value = mock_session

            rows = [MagicMock(doc_type=dt, id=f"id-{dt}") for dt in doc_types]
            result = MagicMock()
            result.all.return_value = rows
            mock_session.execute.return_value = result

            from agents.orchestration.readiness import run_cp0
            output = await run_cp0("test-issuer", "id-OM")

        assert output["verdict"] == "READY"
        assert output["run_type"] == "FULL_RUN"
