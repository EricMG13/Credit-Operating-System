"""Portfolio Lab backend contracts: tenancy, positions, analytics, and stress."""

from __future__ import annotations

import asyncio
import io
import json
import math
import time

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient


def _identity(team_id: str | None, *, role: str = "analyst"):
    from identity import CallerIdentity

    return lambda: CallerIdentity(
        id=f"portfolio-{team_id or 'none'}-{role}",
        email="portfolio@test.local",
        full_name="Portfolio Tester",
        role=role,
        source="profile",
        team_id=team_id,
    )


def test_portfolio_access_is_exact_team_only_when_enabled(monkeypatch):
    from config import get_settings
    from database import Portfolio
    from identity import CallerIdentity
    from tenancy import require_portfolio_access

    caller = CallerIdentity(id="a", email="", full_name="", team_id="team-a")
    own = Portfolio(id="own", name="Own", team_id="team-a")
    foreign = Portfolio(id="foreign", name="Foreign", team_id="team-b")
    legacy = Portfolio(id="legacy", name="Legacy", team_id=None)

    assert require_portfolio_access(caller, foreign) is foreign
    monkeypatch.setattr(get_settings(), "caos_tenancy_enabled", True)
    assert require_portfolio_access(caller, own) is own
    for portfolio in (foreign, legacy, None):
        with pytest.raises(HTTPException) as exc:
            require_portfolio_access(caller, portfolio)
        assert exc.value.status_code == 404


def test_server_role_helper_denies_read_only():
    from identity import CallerIdentity, require_write_role

    require_write_role(CallerIdentity(id="a", email="", full_name=""))
    with pytest.raises(HTTPException) as exc:
        require_write_role(CallerIdentity(
            id="v", email="", full_name="", role="read_only"
        ))
    assert exc.value.status_code == 403


def test_deterministic_stress_is_finite_and_zero_safe():
    from engine.portfolio import compute_stress_snapshot

    positions = [
        {"id": "1", "borrower_name": "Finite", "sector": "Software", "par_usd": 100.0, "price": 100.0},
        {"id": "2", "borrower_name": "NaN", "sector": "Software", "par_usd": math.nan, "price": 90.0},
        {"id": "3", "borrower_name": "Inf", "sector": "Other", "par_usd": 50.0, "price": math.inf},
    ]
    inputs = {"label": "Down", "book_price_shock_pct": -10.0, "sector_shock_pcts": {"Software": -5.0}}
    first = compute_stress_snapshot(positions, inputs, as_of="2026-07-13", portfolio_id="p")
    second = compute_stress_snapshot(positions, inputs, as_of="2026-07-13", portfolio_id="p")
    assert first == second
    assert first["base_nav"] == 150.0  # invalid price falls back to finite par
    assert first["stressed_nav"] == 130.0
    assert first["loss_amount"] == 20.0
    assert first["loss_percent"] == pytest.approx(13.3333333333)
    assert "invalid par value:2" in first["missing_dependencies"]
    assert all(math.isfinite(v) for v in (
        first["base_nav"], first["stressed_nav"], first["loss_amount"], first["loss_percent"]
    ))

    zero = compute_stress_snapshot([], inputs, as_of=None, portfolio_id="p")
    assert zero["loss_percent"] is None
    assert "non-zero base NAV" in zero["missing_dependencies"]


def test_extreme_finite_values_degrade_without_json_overflow():
    from engine.portfolio import (
        compute_exposure,
        compute_portfolio_analytics,
        compute_stress_snapshot,
    )

    positions = [
        {
            "id": f"huge-{index}",
            "borrower_name": f"Huge {index}",
            "sector": "Huge",
            "rating_moody": "B2",
            "par_usd": 1e308,
            "price": 100.0,
            "maturity": "2030-01-01",
        }
        for index in range(3)
    ]
    exposure = compute_exposure(positions)
    analytics = compute_portfolio_analytics(
        positions, [], as_of="2026-07-13", portfolio_id="huge"
    )
    stress = compute_stress_snapshot(
        positions,
        {"label": "Huge", "book_price_shock_pct": -10, "sector_shock_pcts": {}},
        as_of="2026-07-13",
        portfolio_id="huge",
    )
    assert exposure["total_par"] is None
    assert exposure["total_nav"] is None
    assert stress["base_nav"] is None
    assert stress["loss_percent"] is None
    assert any("overflow" in item for item in analytics["missing_dependencies"])
    for payload in (exposure, analytics, stress):
        json.dumps(payload, allow_nan=False)


def test_stress_preserves_base_nav_when_only_stressed_leg_overflows():
    from engine.portfolio import compute_stress_snapshot

    result = compute_stress_snapshot(
        [
            {
                "id": "ordinary",
                "borrower_name": "Ordinary",
                "sector": "Software",
                "par_usd": 100.0,
                "price": 100.0,
            },
            {
                "id": "extreme",
                "borrower_name": "Extreme",
                "sector": "Software",
                "par_usd": 1e308,
                "price": 100.0,
            },
        ],
        {
            "label": "Upside overflow",
            "book_price_shock_pct": 200.0,
            "sector_shock_pcts": {},
        },
        as_of="2026-07-13",
        portfolio_id="mixed-overflow",
    )

    assert result["base_nav"] == 1e308
    assert result["stressed_nav"] is None
    assert "overflow stressed market value:extreme" in result["missing_dependencies"]
    assert "stressed NAV unavailable" in result["missing_dependencies"]
    assert "non-zero base NAV" not in result["missing_dependencies"]
    json.dumps(result, allow_nan=False)


def test_large_analytics_outputs_are_bounded_and_json_safe():
    from engine.portfolio import compute_portfolio_analytics

    positions = [
        {
            "id": f"large-{index}",
            "borrower_name": f"Large {index}",
            "sector": f"Sector {index}",
            "rating_moody": f"R{index}",
            "par_usd": 1.0,
            "price": 100.0,
            "maturity": None,
        }
        for index in range(5_000)
    ]
    result = compute_portfolio_analytics(
        positions, [], as_of="2026-07-13", portfolio_id="large"
    )
    assert len(result["concentration"]["sectors"]) <= 51
    assert len(result["rating_distribution"]) <= 51
    assert len(result["missing_dependencies"]) <= 101
    assert any(
        item.startswith("additional_missing_dependencies:")
        for item in result["missing_dependencies"]
    )
    json.dumps(result, allow_nan=False)


@pytest.fixture
def portfolio_client(seeded_db):
    from main import app

    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()


def _seed_books() -> None:
    from database import AsyncSessionLocal, Portfolio, PortfolioPosition
    from sqlalchemy import delete

    async def seed():
        async with AsyncSessionLocal() as db:
            await db.execute(
                delete(PortfolioPosition).where(
                    PortfolioPosition.portfolio_id == "lab-team-a",
                    PortfolioPosition.id.not_in(
                        ("lab-pos-1", "lab-pos-2", "lab-pos-3")
                    ),
                )
            )
            for pid, team in (
                ("lab-team-a", "team-a"),
                ("lab-team-a-2", "team-a"),
                ("lab-team-b", "team-b"),
            ):
                if await db.get(Portfolio, pid) is None:
                    db.add(Portfolio(id=pid, name=pid, team_id=team, as_of_date="2026-06-30", created_by="seed"))
            rows = [
                ("lab-pos-1", "Alpha", "Software", "B2", "1L", 100.0, 100.0, "2027-06-30"),
                ("lab-pos-2", "Beta", "Software", "B3", "2L", 200.0, 90.0, "2028-06-30"),
                ("lab-pos-3", "Gamma", "Healthcare", "Ba3", "1L", 300.0, 80.0, None),
            ]
            for rid, name, sector, rating, ranking, par, price, maturity in rows:
                if await db.get(PortfolioPosition, rid) is None:
                    db.add(PortfolioPosition(
                        id=rid, portfolio_id="lab-team-a", borrower_name=name,
                        ticker="ALPHA" if rid == "lab-pos-1" else None,
                        sector=sector, rating_moody=rating, ranking=ranking,
                        par_usd=par, price=price, maturity=maturity,
                    ))
            if await db.get(PortfolioPosition, "lab-pos-foreign") is None:
                db.add(PortfolioPosition(
                    id="lab-pos-foreign", portfolio_id="lab-team-b",
                    borrower_name="Foreign", sector="Energy", par_usd=10.0,
                ))
            if await db.get(PortfolioPosition, "lab-pos-same-team") is None:
                db.add(PortfolioPosition(
                    id="lab-pos-same-team", portfolio_id="lab-team-a-2",
                    borrower_name="Same Team", sector="Energy", par_usd=10.0,
                ))
            await db.commit()

    asyncio.run(seed())


def _one_holding_xlsx() -> bytes:
    from openpyxl import Workbook

    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Holdings"
    sheet.append(["Borrower Name", "Holdings", "Bid", "Ask", "Index Sector"])
    sheet.append(["Stamped Co", 100.0, 100.0, 100.0, "Software"])
    buffer = io.BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


def test_positions_cursor_filters_sort_and_tenancy(portfolio_client, monkeypatch):
    from config import get_settings
    from identity import get_identity
    from main import app

    _seed_books()
    monkeypatch.setattr(get_settings(), "caos_tenancy_enabled", True)
    app.dependency_overrides[get_identity] = _identity("team-a")

    first = portfolio_client.get(
        "/api/portfolios/lab-team-a/positions",
        params={"limit": 2, "sort": "borrower_name", "direction": "asc"},
    )
    assert first.status_code == 200, first.text
    body = first.json()
    from analysis_contracts import AuthorityEnvelope
    assert AuthorityEnvelope.model_validate(body["authority"]).approval_state == "published"
    assert body["total"] == 3 and body["next_cursor"]
    second = portfolio_client.get(
        "/api/portfolios/lab-team-a/positions",
        params={"limit": 2, "sort": "borrower_name", "direction": "asc", "cursor": body["next_cursor"]},
    ).json()
    assert {item["id"] for item in body["items"]}.isdisjoint(
        {item["id"] for item in second["items"]}
    )
    assert body["items"][0]["market_value"] == 100.0
    filtered = portfolio_client.get(
        "/api/portfolios/lab-team-a/positions",
        params={"sector": "Software", "rating": "B3", "ranking": "2L"},
    ).json()
    assert [item["borrower_name"] for item in filtered["items"]] == ["Beta"]
    assert portfolio_client.get(
        "/api/portfolios/lab-team-a/positions",
        params={"limit": 2, "cursor": body["next_cursor"], "sector": "Software"},
    ).status_code == 422
    assert portfolio_client.get(
        "/api/portfolios/lab-team-a-2/positions",
        params={"limit": 2, "cursor": body["next_cursor"]},
    ).status_code == 422
    forged = body["next_cursor"][:-1] + (
        "A" if body["next_cursor"][-1] != "A" else "B"
    )
    assert portfolio_client.get(
        "/api/portfolios/lab-team-a/positions",
        params={"limit": 2, "cursor": forged},
    ).status_code == 422
    assert portfolio_client.get(
        "/api/portfolios/lab-team-a/positions",
        params={"limit": 2, "cursor": "not-a-cursor"},
    ).status_code == 422
    assert portfolio_client.get(
        "/api/portfolios/lab-team-a/positions", params={"sort": "not-a-field"}
    ).status_code == 422
    assert portfolio_client.get("/api/portfolios/lab-team-b/positions").status_code == 404
    assert portfolio_client.get("/api/portfolios/lab-team-b").status_code == 404
    assert all(
        row["id"] != "lab-team-b"
        for row in portfolio_client.get("/api/portfolios/").json()
    )


def test_command_snapshot_uses_only_exact_portfolio_bound_posture(portfolio_client, monkeypatch):
    from datetime import datetime, timedelta, timezone

    from config import get_settings
    from database import AsyncSessionLocal, Issuer, ModuleOutput, PortfolioPosition, Run
    from identity import get_identity
    from main import app

    _seed_books()
    monkeypatch.setattr(get_settings(), "caos_tenancy_enabled", True)
    app.dependency_overrides[get_identity] = _identity("team-a")

    async def seed():
        async with AsyncSessionLocal() as db:
            issuer = await db.get(Issuer, "command-issuer")
            if issuer is None:
                issuer = Issuer(id="command-issuer", name="Command Issuer", ticker="CMD", team_id="team-a")
                db.add(issuer)
            position = await db.get(PortfolioPosition, "lab-pos-1")
            assert position is not None
            position.issuer_id = issuer.id
            now = datetime.now(timezone.utc)
            bound = await db.get(Run, "command-bound-run")
            if bound is None:
                bound = Run(
                    id="command-bound-run", issuer_id=issuer.id, portfolio_id="lab-team-a",
                    analyst_id="portfolio-team-a-analyst", status="complete",
                    qa_status="Passed", committee_status="Committee Ready",
                    created_at=now - timedelta(days=2), completed_at=now - timedelta(days=2),
                )
                db.add(bound)
                db.add(ModuleOutput(
                    run_id=bound.id, module_id="CP-3", module_name="RV",
                    runtime_output={"recommendation": "OVERWEIGHT"},
                ))
            unbound = await db.get(Run, "command-newer-unbound-run")
            if unbound is None:
                unbound = Run(
                    id="command-newer-unbound-run", issuer_id=issuer.id, portfolio_id=None,
                    analyst_id="portfolio-team-a-analyst", status="complete",
                    qa_status="Passed", committee_status="Committee Ready",
                    created_at=now, completed_at=now,
                )
                db.add(unbound)
                db.add(ModuleOutput(
                    run_id=unbound.id, module_id="CP-3", module_name="RV",
                    runtime_output={"recommendation": "UNDERWEIGHT"},
                ))
            await db.commit()

    asyncio.run(seed())
    response = portfolio_client.get("/api/portfolios/lab-team-a/command")
    assert response.status_code == 200, response.text
    payload = response.json()
    item = next(row for row in payload["positions"] if row["id"] == "lab-pos-1")
    assert item["posture"] == "OVERWEIGHT"
    assert item["run_id"] == "command-bound-run"
    assert payload["posture_counts"]["UNKNOWN"] == 2
    assert payload["position_count"] == 3
    assert portfolio_client.get("/api/portfolios/lab-team-b/command").status_code == 404


def test_positions_cursor_round_trips_255_character_sort_boundary(
    portfolio_client, monkeypatch
):
    from config import get_settings
    from database import AsyncSessionLocal, PortfolioPosition
    from identity import get_identity
    from main import app

    _seed_books()
    monkeypatch.setattr(get_settings(), "caos_tenancy_enabled", True)
    app.dependency_overrides[get_identity] = _identity("team-a")
    prefix = "CURSORBOUNDARY-"
    first_name = prefix + "A" * (255 - len(prefix))
    second_name = prefix + "B" * (255 - len(prefix))

    async def seed_long_boundaries():
        async with AsyncSessionLocal() as db:
            db.add_all([
                PortfolioPosition(
                    id="lab-pos-long-a",
                    portfolio_id="lab-team-a",
                    borrower_name=first_name,
                    par_usd=1.0,
                ),
                PortfolioPosition(
                    id="lab-pos-long-b",
                    portfolio_id="lab-team-a",
                    borrower_name=second_name,
                    par_usd=1.0,
                ),
            ])
            await db.commit()

    asyncio.run(seed_long_boundaries())
    first = portfolio_client.get(
        "/api/portfolios/lab-team-a/positions",
        params={
            "limit": 1,
            "sort": "borrower_name",
            "direction": "asc",
            "text": prefix,
        },
    )
    assert first.status_code == 200, first.text
    first_payload = first.json()
    assert first_payload["items"][0]["borrower_name"] == first_name
    assert first_payload["next_cursor"]

    second = portfolio_client.get(
        "/api/portfolios/lab-team-a/positions",
        params={
            "limit": 1,
            "sort": "borrower_name",
            "direction": "asc",
            "text": prefix,
            "cursor": first_payload["next_cursor"],
        },
    )
    assert second.status_code == 200, second.text
    assert second.json()["items"][0]["borrower_name"] == second_name


def test_keyset_cursor_handles_mutation_nulls_and_staleness(
    portfolio_client, monkeypatch
):
    from config import get_settings
    from database import AsyncSessionLocal, PortfolioPosition
    from identity import get_identity
    from main import app

    _seed_books()
    monkeypatch.setattr(get_settings(), "caos_tenancy_enabled", True)
    app.dependency_overrides[get_identity] = _identity("team-a")
    first = portfolio_client.get(
        "/api/portfolios/lab-team-a/positions",
        params={"limit": 2, "sort": "borrower_name", "direction": "asc"},
    ).json()
    seen = {row["id"] for row in first["items"]}

    async def insert_before():
        async with AsyncSessionLocal() as db:
            db.add(PortfolioPosition(
                id="lab-pos-before", portfolio_id="lab-team-a",
                borrower_name="Aardvark", par_usd=1.0,
            ))
            await db.commit()

    asyncio.run(insert_before())
    second = portfolio_client.get(
        "/api/portfolios/lab-team-a/positions",
        params={
            "limit": 2,
            "sort": "borrower_name",
            "direction": "asc",
            "cursor": first["next_cursor"],
        },
    )
    assert second.status_code == 200, second.text
    assert seen.isdisjoint({row["id"] for row in second.json()["items"]})

    nullable_first = portfolio_client.get(
        "/api/portfolios/lab-team-a/positions",
        params={"limit": 2, "sort": "ticker", "direction": "desc"},
    ).json()
    nullable_second = portfolio_client.get(
        "/api/portfolios/lab-team-a/positions",
        params={
            "limit": 2,
            "sort": "ticker",
            "direction": "desc",
            "cursor": nullable_first["next_cursor"],
        },
    )
    assert nullable_second.status_code == 200, nullable_second.text
    assert {row["id"] for row in nullable_first["items"]}.isdisjoint(
        {row["id"] for row in nullable_second.json()["items"]}
    )

    stale_first = portfolio_client.get(
        "/api/portfolios/lab-team-a/positions", params={"limit": 2}
    ).json()

    replaced = portfolio_client.post(
        "/api/portfolios/lab-team-a/holdings",
        files={
            "holdings": (
                "holdings.xlsx",
                _one_holding_xlsx(),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )
    assert replaced.status_code == 200, replaced.text
    stale = portfolio_client.get(
        "/api/portfolios/lab-team-a/positions",
        params={"limit": 2, "cursor": stale_first["next_cursor"]},
    )
    assert stale.status_code == 409


def test_analytics_and_stress_persist_deterministically(portfolio_client, monkeypatch):
    from config import get_settings
    from identity import get_identity
    from main import app

    _seed_books()
    monkeypatch.setattr(get_settings(), "caos_tenancy_enabled", True)
    app.dependency_overrides[get_identity] = _identity("team-a")

    analytics = portfolio_client.get(
        "/api/portfolios/lab-team-a/analytics", params={"as_of": "2026-06-30"}
    )
    assert analytics.status_code == 200, analytics.text
    data = analytics.json()
    from analysis_contracts import AuthorityEnvelope
    assert AuthorityEnvelope.model_validate(data["authority"]).approval_state == "published"
    assert data["as_of"] == "2026-06-30"
    assert data["authority"]["method"] == "deterministic-portfolio-v1"
    assert data["concentration"]["n_positions"] == 3
    assert data["rating_distribution"]["B3"] == pytest.approx(180 / 520 * 100)
    assert data["maturity_wall"]["2027"] == 100.0
    assert "maturity:lab-pos-3" in data["missing_dependencies"]

    payload = {
        "label": "Committee downside",
        "book_price_shock_pct": -10,
        "sector_shock_pcts": {"Software": -5},
    }
    one = portfolio_client.post("/api/portfolios/lab-team-a/stress-runs", json=payload)
    two = portfolio_client.post("/api/portfolios/lab-team-a/stress-runs", json=payload)
    assert one.status_code == two.status_code == 201
    assert AuthorityEnvelope.model_validate(
        one.json()["authority"]
    ).approval_state == "published"
    assert AuthorityEnvelope.model_validate(
        one.json()["output"]["authority"]
    ).approval_state == "published"
    assert one.json()["source_fingerprint"] == two.json()["source_fingerprint"]
    assert one.json()["output"] == two.json()["output"]
    listed = portfolio_client.get("/api/portfolios/lab-team-a/stress-runs").json()
    assert AuthorityEnvelope.model_validate(
        listed["authority"]
    ).approval_state == "published"
    assert listed["total"] >= 2
    assert portfolio_client.get("/api/portfolios/lab-team-b/analytics").status_code == 404
    assert portfolio_client.get("/api/portfolios/lab-team-b/stress-runs").status_code == 404


def test_analytics_as_of_is_typed_and_never_claims_unsupported_history(
    portfolio_client, monkeypatch
):
    from config import get_settings
    from database import AsyncSessionLocal, Portfolio
    from identity import get_identity
    from main import app

    _seed_books()
    monkeypatch.setattr(get_settings(), "caos_tenancy_enabled", True)
    app.dependency_overrides[get_identity] = _identity("team-a")
    assert portfolio_client.get(
        "/api/portfolios/lab-team-a/analytics", params={"as_of": "not-a-date"}
    ).status_code == 422

    async def set_as_of(value):
        async with AsyncSessionLocal() as db:
            portfolio = await db.get(Portfolio, "lab-team-a")
            portfolio.as_of_date = value
            await db.commit()

    for stored in (None, "invalid", "2026-06-29"):
        asyncio.run(set_as_of(stored))
        body = portfolio_client.get(
            "/api/portfolios/lab-team-a/analytics",
            params={"as_of": "2026-06-30"},
        ).json()
        assert body["as_of"] is None
        assert body["authority"]["as_of"] is None
        assert "historical portfolio holdings for requested as_of" in body[
            "missing_dependencies"
        ]
    asyncio.run(set_as_of("2026-06-30"))
    supported = portfolio_client.get(
        "/api/portfolios/lab-team-a/analytics",
        params={"as_of": "2026-06-30"},
    ).json()
    assert supported["as_of"] == "2026-06-30"
    assert supported["authority"]["as_of"].startswith("2026-06-30T")


def test_read_only_and_foreign_mutations_are_denied(portfolio_client, monkeypatch):
    from config import get_settings
    from identity import get_identity
    from main import app

    _seed_books()
    monkeypatch.setattr(get_settings(), "caos_tenancy_enabled", True)
    app.dependency_overrides[get_identity] = _identity("team-a", role="read_only")
    response = portfolio_client.post("/api/portfolios/lab-team-a/stress-runs", json={
        "label": "No write", "book_price_shock_pct": -10,
    })
    assert response.status_code == 403
    assert portfolio_client.post(
        "/api/portfolios/lab-team-a/holdings",
        files={"holdings": ("invalid.xlsx", b"not parsed", "application/octet-stream")},
    ).status_code == 403
    app.dependency_overrides[get_identity] = _identity("team-a")
    assert portfolio_client.post("/api/portfolios/lab-team-b/stress-runs", json={
        "label": "Foreign", "book_price_shock_pct": -10,
    }).status_code == 404
    assert portfolio_client.post(
        "/api/portfolios/lab-team-b/holdings",
        files={"holdings": ("invalid.xlsx", b"not parsed", "application/octet-stream")},
    ).status_code == 404


def test_new_portfolio_stamps_team_and_read_only_cannot_create(
    portfolio_client, monkeypatch
):
    from config import get_settings
    from database import AsyncSessionLocal, Portfolio
    from identity import get_identity
    from main import app

    monkeypatch.setattr(get_settings(), "caos_tenancy_enabled", True)
    app.dependency_overrides[get_identity] = _identity("team-a")
    created = portfolio_client.post(
        "/api/portfolios/",
        data={"name": "Stamped Portfolio"},
        files={
            "holdings": (
                "holdings.xlsx",
                _one_holding_xlsx(),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )
    assert created.status_code == 201, created.text

    async def team_id():
        async with AsyncSessionLocal() as db:
            return (await db.get(Portfolio, created.json()["id"])).team_id

    assert asyncio.run(team_id()) == "team-a"
    app.dependency_overrides[get_identity] = _identity("team-a", role="read_only")
    denied = portfolio_client.post(
        "/api/portfolios/",
        data={"name": "Denied"},
        files={"holdings": ("invalid.xlsx", b"not parsed", "application/octet-stream")},
    )
    assert denied.status_code == 403


def test_read_only_decision_vote_denied(portfolio_client, monkeypatch):
    from config import get_settings
    from database import AsyncSessionLocal, Decision, Issuer, Run
    from identity import get_identity
    from main import app

    async def seed():
        async with AsyncSessionLocal() as db:
            if await db.get(Issuer, "portfolio-decision-issuer") is None:
                db.add(Issuer(
                    id="portfolio-decision-issuer",
                    name="Portfolio Decision Issuer",
                    team_id="team-a",
                ))
                db.add(Run(
                    id="portfolio-decision-run",
                    issuer_id="portfolio-decision-issuer",
                    status="complete",
                ))
                db.add(Decision(
                    id="portfolio-read-only-decision",
                    issuer_id="portfolio-decision-issuer",
                    run_id="portfolio-decision-run",
                    action="revisit",
                    status="active",
                    conditions=[],
                    snapshot={},
                    snapshot_sha256="4" * 64,
                    created_by="seed",
                ))
                await db.commit()

    asyncio.run(seed())
    monkeypatch.setattr(get_settings(), "caos_tenancy_enabled", True)
    app.dependency_overrides[get_identity] = _identity("team-a", role="read_only")
    response = portfolio_client.post(
        "/api/decisions/portfolio-read-only-decision/votes",
        json={"vote": "approve"},
    )
    assert response.status_code == 403


def test_persisted_roles_flow_through_real_cookie_proxy_and_me(
    portfolio_client, monkeypatch
):
    from config import get_settings
    from database import Analyst, AsyncSessionLocal, Portfolio
    from identity import COOKIE_NAME, make_session_token
    from main import app

    app.dependency_overrides.clear()
    monkeypatch.setattr(get_settings(), "caos_tenancy_enabled", False)

    async def seed():
        async with AsyncSessionLocal() as db:
            if await db.get(Portfolio, "role-portfolio") is None:
                db.add(Portfolio(id="role-portfolio", name="Role Portfolio"))
            for analyst_id, email, role in (
                ("role-read-only", "readonly-role@test.local", "read_only"),
                ("role-admin", "admin-role@test.local", "admin"),
                ("role-analyst", "analyst-role@test.local", "analyst"),
            ):
                if await db.get(Analyst, analyst_id) is None:
                    db.add(Analyst(
                        id=analyst_id,
                        name=analyst_id,
                        email=email,
                        role=role,
                    ))
            await db.commit()

    asyncio.run(seed())

    def token(analyst_id: str, email: str) -> str:
        now = int(time.time())
        # Deliberately legacy-compatible: no role claim. Persisted row is authority.
        return make_session_token(
            {
                "id": analyst_id,
                "name": analyst_id,
                "email": email,
                "v": 0,
                "iat": now,
                "exp": now + 600,
            },
            get_settings().session_secret,
        )

    portfolio_client.cookies.set(
        COOKIE_NAME, token("role-read-only", "readonly-role@test.local")
    )
    assert portfolio_client.get("/api/auth/me").json()["role"] == "read_only"
    denied = portfolio_client.post(
        "/api/portfolios/role-portfolio/stress-runs",
        json={"label": "Denied", "book_price_shock_pct": -10},
    )
    assert denied.status_code == 403

    portfolio_client.cookies.set(
        COOKIE_NAME, token("role-analyst", "analyst-role@test.local")
    )
    assert portfolio_client.get("/api/auth/me").json()["role"] == "analyst"
    assert portfolio_client.post(
        "/api/portfolios/role-portfolio/stress-runs",
        json={"label": "Analyst", "book_price_shock_pct": -10},
    ).status_code == 201

    portfolio_client.cookies.clear()
    proxy_headers = {
        "x-forwarded-email": "admin-role@test.local",
        "x-forwarded-user": "admin-proxy",
    }
    assert portfolio_client.get(
        "/api/auth/me", headers=proxy_headers
    ).json()["role"] == "admin"
    assert portfolio_client.post(
        "/api/portfolios/role-portfolio/stress-runs",
        json={"label": "Admin", "book_price_shock_pct": -10},
        headers=proxy_headers,
    ).status_code == 201
