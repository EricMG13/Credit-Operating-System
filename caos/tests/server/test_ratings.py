"""Ratings scale, deterministic extraction, and the wiring that consumes them.

The rating scale + parse/bucket helpers and the xlsx extractor live in
``ratings.py`` (one home, shared by the digest WARF and the rating-distribution
query walk). These are pure/DB-free; the ingest→issuer write path is covered by
test_issuer_profile / test_sponsors_digest via the HTTP endpoint.
"""

from __future__ import annotations

import io
import sys
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parents[2] / "server"
sys.path.insert(0, str(SERVER_DIR))

import ratings  # noqa: E402


def test_parse_rating_cell_shapes():
    assert ratings.parse_rating_cell("B2 / B") == ("B2", "B")
    assert ratings.parse_rating_cell("Ba1 / BB+") == ("Ba1", "BB+")
    assert ratings.parse_rating_cell("B1 / BB- *") == ("B1", "BB-")   # watch marker dropped
    assert ratings.parse_rating_cell("Caa1") == ("Caa1", None)
    assert ratings.parse_rating_cell("B+") == (None, "B+")            # lone S&P grade
    assert ratings.parse_rating_cell("not-a-rating") == (None, None)  # off-scale → dropped
    assert ratings.parse_rating_cell(None) == (None, None)


def test_rating_index_and_bucket():
    # S&P / Moody's scales are index-aligned, outlooks drop, off-scale → None.
    assert ratings.rating_index(moody="B2") == ratings.rating_index(sp="B")
    assert ratings.rating_index(moody="B2 (negative)") == ratings.rating_index(moody="B2")
    assert ratings.rating_index(moody="Caa1", sp="BBB") == ratings.rating_index(moody="Caa1")
    assert ratings.rating_index() is None
    # Buckets mirror the CP-6A exposure report (IG / BB / B / CCC / Unrated).
    assert ratings.rating_bucket(ratings.rating_index(sp="BBB")) == "IG"
    assert ratings.rating_bucket(ratings.rating_index(moody="Ba2")) == "BB"
    assert ratings.rating_bucket(ratings.rating_index(moody="B1")) == "B"
    assert ratings.rating_bucket(ratings.rating_index(moody="Caa1")) == "CCC"
    assert ratings.rating_bucket(None) == "Unrated"


def _xlsx(headers, *rows) -> bytes:
    from openpyxl import Workbook

    wb = Workbook()
    ws = wb.active
    ws.append(list(headers))
    for r in rows:
        ws.append(list(r))
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def test_extract_from_holdings_shape():
    content = _xlsx(
        ["Ticker", "Borrower Name", "FIGI", "Ratings"],
        ["ACRISU", "Acrisure LLC", "BBG01B6UZZ33", "B2 / B"],
        ["NOISE", "No Rating Co", "BBG000", None],  # no rating → skipped
    )
    recs = ratings.extract_ratings_from_workbook(content)
    assert recs == [{"figi": "BBG01B6UZZ33", "ticker": "ACRISU",
                     "name": "Acrisure LLC", "moody": "B2", "sp": "B"}]


def test_extract_from_market_data_shape():
    # Different header vocabulary ("Company", no Ticker) still resolves.
    content = _xlsx(
        ["Company", "Sector", "FIGI", "Ratings"],
        ["TruGreen", "Industrials", "BBG00XXWRKF0", "B3 / B-"],
    )
    recs = ratings.extract_ratings_from_workbook(content)
    assert recs == [{"figi": "BBG00XXWRKF0", "ticker": None,
                     "name": "TruGreen", "moody": "B3", "sp": "B-"}]


def test_extract_no_rating_column_returns_empty():
    assert ratings.extract_ratings_from_workbook(_xlsx(["A", "B"], [1, 2])) == []
    assert ratings.extract_ratings_from_workbook(b"not a workbook") == []


def test_primary_run_mode_registered_everywhere():
    import routes.edgar as edgar
    import routes.ingestion as ingestion

    assert "primary" in ingestion.RUN_MODES
    assert "primary" in edgar.LEGAL_RUN_MODES


def test_rating_distribution_capability_registered():
    from engine.querygraph import CAP_BY_ID

    cap = CAP_BY_ID.get("rating-distribution")
    assert cap is not None and cap["mode"] == "concentration"
    assert cap["requires"] == "rated" and cap["params"] == {"by": "rating"}
