from fastapi.testclient import TestClient

from main import app
from sector_logic import sector_materiality_score, sector_signal_dedup_hash


def test_sector_signal_dedup_and_materiality_are_deterministic():
    a = sector_signal_dedup_hash("Industrials", " Q2 Order Books  Soften ", "seed://x", "2026-07-06")
    b = sector_signal_dedup_hash("industrials", "q2 order books soften", "SEED://X", "2026-07-06")
    assert a == b

    high = sector_materiality_score("high", "earnings", issuer_count=2, source_tier="external_seed")
    medium = sector_materiality_score("medium", "earnings", issuer_count=2, source_tier="external_seed")
    assert high == sector_materiality_score("high", "earnings", issuer_count=2, source_tier="external_seed")
    assert high > medium


def test_sector_seed_review_signals_and_bounds():
    with TestClient(app) as client:
        feeds = client.get("/api/sector/feeds")
        assert feeds.status_code == 200, feeds.text
        assert any(row["sector"] == "Industrials" and row["provenance"] == "seed" for row in feeds.json())

        review = client.get("/api/sector/review", params={"sector": "Industrials", "timeframe": "today"})
        assert review.status_code == 200, review.text
        body = review.json()
        assert body["provenance"] == "seed"
        assert body["module_status"] == "CP-SR pending"
        assert body["signals"]
        assert body["signals"][0]["sources"][0]["provenance"] == "seed"

        filtered = client.get("/api/sector/signals", params={"sector": "Industrials", "category": "earnings"})
        assert filtered.status_code == 200, filtered.text
        assert {row["category"] for row in filtered.json()} == {"earnings"}
        assert client.get("/api/sector/signals", params={"limit": 101}).status_code == 422


def test_sector_feed_toggle_and_topic_ask():
    with TestClient(app) as client:
        saved = client.put(
            "/api/sector/feeds",
            json={"feeds": [{"sector": "Industrials", "enabled": False, "notify_pref": "in_app"}]},
        )
        assert saved.status_code == 200, saved.text
        industrials = next(row for row in saved.json() if row["sector"] == "Industrials")
        assert industrials["enabled"] is False
        assert industrials["provenance"] == "profile"

        ask = client.post(
            "/api/sector/ask",
            json={
                "signal_id": "seed-industrials-2026-07-06-01",
                "question": "What is the credit impact?",
            },
        )
        assert ask.status_code == 200, ask.text
        body = ask.json()
        assert body["provenance"] == "seed"
        assert "Restricted to this sector signal" in body["retrieval_scope"]
        assert body["sources"]


def test_sector_refresh_and_invalid_date_bounds():
    with TestClient(app) as client:
        refreshed = client.post(
            "/api/sector/review/refresh",
            json={"sector": "Industrials", "timeframe": "today"},
        )
        assert refreshed.status_code == 200, refreshed.text
        body = refreshed.json()
        assert body["refresh_trigger"] == "ad_hoc_seed"
        assert body["provenance"] == "seed"
        assert body["signals"]

        bad_date = client.get(
            "/api/sector/signals",
            params={"sector": "Industrials", "from": "not-a-date"},
        )
        assert bad_date.status_code == 422
