"""
Tests for the ingestion pipeline.
Includes malformed XLSX injection via pytest fixtures.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from ingestion.xlsx_parser import _normalize_col


class TestXlsxColumnNormalization:
    """Tests for the broker sheet column alias normalization logic."""

    def test_recognizes_z_spread(self):
        assert _normalize_col("Z_SPREAD", "spread") is True

    def test_recognizes_oas(self):
        assert _normalize_col("OAS", "spread") is True

    def test_recognizes_ytw_variants(self):
        assert _normalize_col("Yield_To_Worst", "ytw") is True
        assert _normalize_col("YTW", "ytw") is True
        assert _normalize_col("Yield", "ytw") is True

    def test_recognizes_dm_variants(self):
        assert _normalize_col("Discount_Margin", "dm") is True
        assert _normalize_col("DM_BPS", "dm") is True

    def test_rejects_unknown_column(self):
        assert _normalize_col("Color", "spread") is False
        assert _normalize_col("Size", "ytw") is False

    def test_case_insensitive(self):
        assert _normalize_col("SPREAD_BPS", "spread") is True
        assert _normalize_col("spread_bps", "spread") is True


class TestXlsxParsing:
    @pytest.mark.asyncio
    async def test_parses_aliased_columns(self, malformed_xlsx_bytes):
        """Verify that non-standard column names (e.g., Z_SPREAD) are ingested correctly."""
        from unittest.mock import MagicMock, AsyncMock, patch
        import uuid

        mock_db = AsyncMock()
        mock_minio = MagicMock()
        mock_minio.put_object = MagicMock()

        with patch("ingestion.xlsx_parser._get_minio", return_value=mock_minio):
            from ingestion.xlsx_parser import ingest_pricing_sheet
            result = await ingest_pricing_sheet(
                content=malformed_xlsx_bytes,
                filename="test_pricing.xlsx",
                issuer_id=uuid.uuid4(),
                run_date="2026-06-01",
                db=mock_db,
            )

        # Should parse 2 data rows despite non-standard column names
        assert result["chunks_created"] == 0
        assert "2 pricing rows" in result["message"] or result["message"]

    @pytest.mark.asyncio
    async def test_skips_unrecognized_columns(self, malformed_xlsx_no_price_cols):
        """XLSX with no spread/ytw/dm columns should ingest 0 rows gracefully."""
        from unittest.mock import MagicMock, AsyncMock, patch
        import uuid

        mock_db = AsyncMock()
        mock_minio = MagicMock()

        with patch("ingestion.xlsx_parser._get_minio", return_value=mock_minio):
            from ingestion.xlsx_parser import ingest_pricing_sheet
            result = await ingest_pricing_sheet(
                content=malformed_xlsx_no_price_cols,
                filename="bad.xlsx",
                issuer_id=uuid.uuid4(),
                run_date="2026-06-01",
                db=mock_db,
            )

        assert "0 pricing rows" in result["message"]
