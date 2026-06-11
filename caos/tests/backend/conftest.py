"""pytest fixtures for CAOS backend tests."""

import asyncio
import io
import json
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from db.models import Base
from main import app

# Use SQLite for tests (swap for test Postgres if needed)
TEST_DB_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(TEST_DB_URL, echo=False)
TestSession = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


@pytest_asyncio.fixture(scope="session")
async def setup_db():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def db_session(setup_db) -> AsyncGenerator[AsyncSession, None]:
    async with TestSession() as session:
        yield session
        await session.rollback()


@pytest_asyncio.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac


# ─── Sample payloads ──────────────────────────────────────────────────────

@pytest.fixture
def valid_cp2_payload():
    return {
        "module_id": "CP-2",
        "issuer_id": "test-issuer",
        "fiscal_period": "Q1-2026",
        "has_inferred_metrics": False,
        "material_conclusions": [
            {
                "label": "Net Leverage",
                "value": "5.2x",
                "evidence_chain": [
                    {
                        "evidence": "Total debt of $500mm / LTM EBITDA of $96mm = 5.2x",
                        "source_doc": "OM, p.47, Financial Summary",
                        "risk_mechanic": "High leverage constrains financial flexibility",
                        "credit_implication": "Limited capacity to absorb EBITDA decline",
                    }
                ],
            }
        ],
        "historical_periods": [],
        "ltm_period": {
            "period": "LTM Q1-2026",
            "revenue_mm": 300,
            "ebitda_mm": 96,
            "ebitda_margin_pct": 0.32,
            "net_leverage_x": 5.2,
            "interest_coverage_x": 2.5,
            "fcf_mm": 42,
        },
        "business_description": "Leading provider of XYZ services.",
        "key_revenue_drivers": ["Volume growth", "Pricing"],
        "key_cost_drivers": ["Labor", "Technology"],
    }


@pytest.fixture
def malformed_xlsx_bytes():
    """A valid XLSX shell with misnamed columns — tests normalization logic."""
    import openpyxl
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(["Issuer", "BOND", "Z_SPREAD", "Yield_To_Worst", "Discount_Margin"])
    ws.append(["AcmeCorp", "AcmeCorp 8% 2030", 450.0, 8.25, 380.0])
    ws.append(["BetaCorp", "BetaCorp 7.5% 2031", 390.0, 7.8, 310.0])
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


@pytest.fixture
def malformed_xlsx_no_price_cols():
    """XLSX with no recognizable spread/YTW/DM columns — should ingest 0 rows."""
    import openpyxl
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(["Name", "Color", "Size"])
    ws.append(["Widget", "Red", "Large"])
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()
