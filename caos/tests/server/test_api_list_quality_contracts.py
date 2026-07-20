"""Direct runtime contracts for the final unmapped API list/root surfaces."""

from __future__ import annotations

import io
import importlib
import inspect
import sys
import uuid
from contextlib import contextmanager
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from openpyxl import Workbook


SERVER_DIR = Path(__file__).resolve().parents[2] / "server"
sys.path.insert(0, str(SERVER_DIR))

_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def _identity(analyst_id: str):
    from identity import CallerIdentity

    return lambda: CallerIdentity(
        id=analyst_id,
        email=f"{analyst_id}@firm.test",
        full_name=analyst_id,
        source="profile",
    )


def _team_identity(analyst_id: str, team_id: str, *, role: str = "analyst"):
    from identity import CallerIdentity

    return lambda: CallerIdentity(
        id=analyst_id,
        email=f"{analyst_id}@firm.test",
        full_name=analyst_id,
        role=role,
        source="profile",
        team_id=team_id,
    )


@contextmanager
def _client_for(analyst_id: str):
    from identity import get_identity
    from main import app

    app.dependency_overrides[get_identity] = _identity(analyst_id)
    try:
        with TestClient(app) as client:
            yield app, client
    finally:
        app.dependency_overrides.clear()


def _minimal_holdings_xlsx() -> bytes:
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Holdings"
    sheet.append([
        "Ticker",
        "Borrower Name",
        "Index Sector",
        "Ranking",
        "Ratings",
        "Size ($Mn)",
        "Margin",
        "Bid",
        "Ask",
        "Holdings",
    ])
    sheet.append([
        "ROOT",
        "Root Alias Credit",
        "Software",
        "1L Sr. Secd",
        "B2 / B",
        500,
        400,
        99,
        100,
        1_000_000,
    ])
    buffer = io.BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


async def _failed_database_dependency():
    raise RuntimeError("quality-contract database failure")
    yield  # pragma: no cover - keeps this an async-generator dependency


def _call_list_contract(client: TestClient, method: str, path: str):
    if method == "POST":
        return client.post(
            path,
            data={"name": "Database failure probe", "kind": "CLO"},
            files={"holdings": ("holdings.xlsx", _minimal_holdings_xlsx(), _XLSX)},
        )
    return client.get(path)


LIST_API_FAILURE_CASES = [
    pytest.param("API-006", "GET", "/api/analysis/contexts", "/api/analysis/contexts", id="API-006"),
    pytest.param("API-093", "GET", "/api/portfolio/", "/api/portfolio/", id="API-093"),
    pytest.param("API-094", "GET", "/api/portfolios", "/api/portfolios", id="API-094"),
    pytest.param("API-095", "POST", "/api/portfolios", "/api/portfolios", id="API-095"),
    pytest.param("API-096", "GET", "/api/portfolios/", "/api/portfolios/", id="API-096"),
    pytest.param("API-097", "POST", "/api/portfolios/", "/api/portfolios/", id="API-097"),
    pytest.param("API-120", "GET", "/api/query/runs", "/api/query/runs", id="API-120"),
    pytest.param("API-133", "GET", "/api/research", "/api/research", id="API-133"),
    pytest.param("API-158", "GET", "/api/sector/reviews", "/api/sector/reviews", id="API-158"),
    pytest.param("API-168", "GET", "/api/sponsors", "/api/sponsors", id="API-168"),
    pytest.param("API-169", "GET", "/api/sponsors/", "/api/sponsors/", id="API-169"),
]


LIST_API_PERFORMANCE_CONTRACTS = [
    pytest.param(
        "API-006", "GET", "/api/analysis/contexts", "routes.analysis", "list_contexts",
        ("Query(25, ge=1, le=100)", ".limit(limit)", "_guard(caller, write=False)"), id="API-006",
    ),
    pytest.param(
        "API-093", "GET", "/api/portfolio/", "routes.portfolio", "get_portfolio",
        ("_read_rate_guard(identity)", ".limit(2000)"), id="API-093",
    ),
    pytest.param(
        "API-094", "GET", "/api/portfolios", "routes.portfolios", "list_portfolios",
        (".limit(200)",), id="API-094",
    ),
    pytest.param(
        "API-095", "POST", "/api/portfolios", "routes.portfolios", "create_portfolio",
        ("_rate_guard(caller)", "_read_xlsx(holdings)", "asyncio.to_thread", "ingest.read_capped"), id="API-095",
    ),
    pytest.param(
        "API-096", "GET", "/api/portfolios/", "routes.portfolios", "list_portfolios",
        (".limit(200)",), id="API-096",
    ),
    pytest.param(
        "API-097", "POST", "/api/portfolios/", "routes.portfolios", "create_portfolio",
        ("_rate_guard(caller)", "_read_xlsx(holdings)", "asyncio.to_thread", "ingest.read_capped"), id="API-097",
    ),
    pytest.param(
        "API-120", "GET", "/api/query/runs", "routes.query", "list_query_runs",
        ("_read_rate_guard(caller)", ".limit(100)"), id="API-120",
    ),
    pytest.param(
        "API-133", "GET", "/api/research", "routes.research", "list_research",
        ("Query(default=None, max_length=36)", ".limit(100)"), id="API-133",
    ),
    pytest.param(
        "API-158", "GET", "/api/sector/reviews", "routes.sector", "list_sector_reviews",
        ("_read_guard(caller)", ".limit(100)"), id="API-158",
    ),
    pytest.param(
        "API-168", "GET", "/api/sponsors", "routes.sponsors", "list_sponsors",
        ("_read_rate_guard(caller)", ".limit(_MAX_ISSUERS)"), id="API-168",
    ),
    pytest.param(
        "API-169", "GET", "/api/sponsors/", "routes.sponsors", "list_sponsors",
        ("_read_rate_guard(caller)", ".limit(_MAX_ISSUERS)"), id="API-169",
    ),
]


def test_list_contexts_is_owner_scoped_ordered_and_bounded() -> None:
    with _client_for("list-contexts-owner") as (app, client):
        first = client.post("/api/analysis/contexts", json={"name": "First context"})
        second = client.post("/api/analysis/contexts", json={"name": "Second context"})
        assert first.status_code == 201, first.text
        assert second.status_code == 201, second.text

        listed = client.get("/api/analysis/contexts", params={"limit": 1})
        assert listed.status_code == 200, listed.text
        assert [row["id"] for row in listed.json()] == [second.json()["id"]]
        assert client.get("/api/analysis/contexts", params={"limit": 0}).status_code == 422

        from identity import get_identity

        app.dependency_overrides[get_identity] = _identity("list-contexts-foreign")
        foreign_ids = {row["id"] for row in client.get("/api/analysis/contexts").json()}
        assert first.json()["id"] not in foreign_ids
        assert second.json()["id"] not in foreign_ids


def test_legacy_portfolio_root_with_slash_returns_bounded_board() -> None:
    with _client_for("legacy-portfolio-slash-owner") as (_, client):
        response = client.get("/api/portfolio/")

        assert response.status_code == 200, response.text
        assert set(response.json()) == {"rows", "issuer_count", "covered_count"}
        assert response.json()["issuer_count"] >= response.json()["covered_count"]


def test_portfolio_root_without_slash_creates_and_lists() -> None:
    with _client_for("portfolio-root-owner") as (_, client):
        created = client.post(
            "/api/portfolios",
            data={"name": "No-slash portfolio", "kind": "CLO"},
            files={"holdings": ("holdings.xlsx", _minimal_holdings_xlsx(), _XLSX)},
        )
        assert created.status_code == 201, created.text

        listed = client.get("/api/portfolios")
        assert listed.status_code == 200, listed.text
        assert created.json()["id"] in {row["id"] for row in listed.json()}


def test_list_query_runs_filters_owned_context_and_hides_foreign_context() -> None:
    with _client_for("list-query-owner") as (app, client):
        context = client.post(
            "/api/analysis/contexts", json={"name": "Query history context"}
        ).json()
        created = client.post(
            "/api/query/runs",
            json={
                "context_id": context["id"],
                "question": "What changed in the owned context?",
                "selected_lane": "grounded",
            },
        )
        assert created.status_code == 201, created.text

        listed = client.get("/api/query/runs", params={"context_id": context["id"]})
        assert listed.status_code == 200, listed.text
        assert [row["id"] for row in listed.json()] == [created.json()["id"]]

        from identity import get_identity

        app.dependency_overrides[get_identity] = _identity("list-query-foreign")
        hidden = client.get("/api/query/runs", params={"context_id": context["id"]})
        assert hidden.status_code == 404


def test_list_research_filters_owned_context_and_hides_foreign_context() -> None:
    with _client_for("list-research-owner") as (app, client):
        context = client.post(
            "/api/analysis/contexts", json={"name": "Research history context"}
        ).json()
        created = client.post(
            "/api/research",
            params={"context_id": context["id"]},
            json={"subject": "Owned research history", "mode": "issuer"},
        )
        assert created.status_code == 201, created.text

        listed = client.get("/api/research", params={"context_id": context["id"]})
        assert listed.status_code == 200, listed.text
        assert created.json()["id"] in {row["id"] for row in listed.json()}

        from identity import get_identity

        app.dependency_overrides[get_identity] = _identity("list-research-foreign")
        hidden = client.get("/api/research", params={"context_id": context["id"]})
        assert hidden.status_code == 404


def test_list_sector_reviews_filters_canonical_sector_and_owner() -> None:
    with _client_for("list-sector-owner") as (app, client):
        context = client.post(
            "/api/analysis/contexts",
            json={"name": "Sector history context", "sector_id": "Telecommunications"},
        ).json()
        created = client.post(
            "/api/sector/reviews",
            json={"context_id": context["id"], "sector_id": "Telecommunications"},
        )
        assert created.status_code == 201, created.text

        listed = client.get(
            "/api/sector/reviews",
            params={"context_id": context["id"], "sector_id": "Telecommunications"},
        )
        assert listed.status_code == 200, listed.text
        assert [row["id"] for row in listed.json()] == [created.json()["id"]]
        invalid = client.get("/api/sector/reviews", params={"sector_id": "not-a-sector"})
        assert invalid.status_code == 422

        from identity import get_identity

        app.dependency_overrides[get_identity] = _identity("list-sector-foreign")
        hidden = client.get("/api/sector/reviews", params={"context_id": context["id"]})
        assert hidden.status_code == 404


def test_sponsor_root_without_slash_lists_owned_sponsor_groups() -> None:
    with _client_for("sponsor-root-owner") as (_, client):
        created = client.post(
            "/api/issuers/",
            json={"name": "No-slash sponsor issuer", "sponsor": "No Slash Capital"},
        )
        assert created.status_code == 201, created.text

        listed = client.get("/api/sponsors")
        assert listed.status_code == 200, listed.text
        assert {row["sponsor"] for row in listed.json()} == {"No Slash Capital"}


@pytest.mark.parametrize(
    ("api_id", "method", "path", "recovery_path"),
    LIST_API_FAILURE_CASES,
)
def test_api_list_dependency_failure_returns_500_and_recovers(
    api_id: str,
    method: str,
    path: str,
    recovery_path: str,
) -> None:
    from database import get_db
    from identity import get_identity
    from main import app

    app.dependency_overrides[get_identity] = _identity(f"failure-{api_id.lower()}")
    app.dependency_overrides[get_db] = _failed_database_dependency
    try:
        with TestClient(app, raise_server_exceptions=False) as client:
            failed = _call_list_contract(client, method, path)
            assert failed.status_code == 500
            assert failed.json() == {"detail": "Internal Server Error"}

            del app.dependency_overrides[get_db]
            recovered = client.get(recovery_path)
            assert recovered.status_code == 200, recovered.text
    finally:
        app.dependency_overrides.clear()


@pytest.mark.parametrize(
    ("api_id", "method", "path", "module_name", "callable_name", "required_tokens"),
    LIST_API_PERFORMANCE_CONTRACTS,
)
def test_api_list_performance_contract_has_explicit_bound(
    api_id: str,
    method: str,
    path: str,
    module_name: str,
    callable_name: str,
    required_tokens: tuple[str, ...],
) -> None:
    source = inspect.getsource(getattr(importlib.import_module(module_name), callable_name))

    assert api_id.startswith("API-")
    assert method in {"GET", "POST"}
    assert path.startswith("/api/")
    for token in required_tokens:
        assert token in source, f"{api_id} lost its bounded-work contract: {token}"


def _assert_get_backpressure_and_recovery(
    client: TestClient,
    paths: tuple[str, ...],
    maximum: int,
) -> None:
    import rate_limit

    rate_limit.reset()
    for index in range(maximum):
        response = client.get(paths[index % len(paths)])
        assert response.status_code == 200, response.text
    blocked = client.get(paths[maximum % len(paths)])
    assert blocked.status_code == 429

    rate_limit.reset()
    recovered = client.get(paths[0])
    assert recovered.status_code == 200, recovered.text


def test_guarded_list_routes_apply_exact_backpressure_and_recover() -> None:
    import rate_limit

    with _client_for("list-backpressure-owner") as (_, client):
        _assert_get_backpressure_and_recovery(client, ("/api/analysis/contexts",), 120)
        _assert_get_backpressure_and_recovery(client, ("/api/portfolio/",), 60)
        _assert_get_backpressure_and_recovery(client, ("/api/query/runs",), 60)
        _assert_get_backpressure_and_recovery(client, ("/api/sector/reviews",), 90)
        _assert_get_backpressure_and_recovery(client, ("/api/sponsors", "/api/sponsors/"), 60)

        rate_limit.reset()
        for index in range(20):
            path = "/api/portfolios" if index % 2 == 0 else "/api/portfolios/"
            response = client.post(
                path,
                data={"name": " ", "kind": "CLO"},
                files={"holdings": ("holdings.xlsx", _minimal_holdings_xlsx(), _XLSX)},
            )
            assert response.status_code == 400, response.text
        blocked = client.post(
            "/api/portfolios",
            data={"name": " ", "kind": "CLO"},
            files={"holdings": ("holdings.xlsx", _minimal_holdings_xlsx(), _XLSX)},
        )
        assert blocked.status_code == 429

        rate_limit.reset()
        recovered = client.post(
            "/api/portfolios/",
            data={"name": " ", "kind": "CLO"},
            files={"holdings": ("holdings.xlsx", _minimal_holdings_xlsx(), _XLSX)},
        )
        assert recovered.status_code == 400, recovered.text


def test_parameterless_list_routes_ignore_unknown_query_keys() -> None:
    with _client_for("unknown-query-owner") as (_, client):
        for path in (
            "/api/portfolio/",
            "/api/portfolios",
            "/api/portfolios/",
            "/api/sponsors",
            "/api/sponsors/",
        ):
            response = client.get(path, params={"unexpected": "ignored"})
            assert response.status_code == 200, response.text


def test_validated_list_inputs_reject_out_of_contract_values() -> None:
    with _client_for("invalid-list-owner") as (_, client):
        assert client.get("/api/analysis/contexts", params={"limit": 0}).status_code == 422
        for path in ("/api/portfolios", "/api/portfolios/"):
            rejected = client.post(
                path,
                data={"name": " ", "kind": "CLO"},
                files={"holdings": ("holdings.xlsx", _minimal_holdings_xlsx(), _XLSX)},
            )
            assert rejected.status_code == 400, rejected.text
        assert client.get(
            "/api/query/runs", params={"context_id": "missing-context"}
        ).status_code == 404
        assert client.get(
            "/api/research", params={"context_id": "x" * 37}
        ).status_code == 422
        assert client.get(
            "/api/sector/reviews", params={"sector_id": "not-a-sector"}
        ).status_code == 422


def test_aliased_roots_enforce_team_scope_and_create_role(monkeypatch) -> None:
    from config import get_settings
    from conftest import wait_for_run
    from identity import get_identity
    from main import app

    monkeypatch.setattr(get_settings(), "caos_tenancy_enabled", True)
    token = uuid.uuid4().hex[:10]
    team_a = f"alias-team-a-{token}"
    team_b = f"alias-team-b-{token}"
    sponsor = f"Alias Capital {token}"

    try:
        with TestClient(app) as client:
            app.dependency_overrides[get_identity] = _team_identity(
                f"alias-owner-a-{token}", team_a
            )
            issuer = client.post(
                "/api/issuers/",
                json={"name": f"Alias Scope Issuer {token}", "sponsor": sponsor},
            )
            assert issuer.status_code == 201, issuer.text
            issuer_id = issuer.json()["id"]
            run = client.post("/api/runs", json={"issuer_id": issuer_id})
            assert run.status_code == 201, run.text
            wait_for_run(client, run.json()["id"])

            portfolio = client.post(
                "/api/portfolios",
                data={"name": f"Alias Scope Portfolio {token}", "kind": "CLO"},
                files={"holdings": ("holdings.xlsx", _minimal_holdings_xlsx(), _XLSX)},
            )
            assert portfolio.status_code == 201, portfolio.text
            portfolio_id = portfolio.json()["id"]
            assert issuer_id in {
                row["issuer_id"] for row in client.get("/api/portfolio/").json()["rows"]
            }
            assert portfolio_id in {row["id"] for row in client.get("/api/portfolios").json()}
            assert portfolio_id in {row["id"] for row in client.get("/api/portfolios/").json()}
            assert sponsor in {row["sponsor"] for row in client.get("/api/sponsors").json()}
            assert sponsor in {row["sponsor"] for row in client.get("/api/sponsors/").json()}

            app.dependency_overrides[get_identity] = _team_identity(
                f"alias-owner-b-{token}", team_b
            )
            assert issuer_id not in {
                row["issuer_id"] for row in client.get("/api/portfolio/").json()["rows"]
            }
            assert portfolio_id not in {row["id"] for row in client.get("/api/portfolios").json()}
            assert portfolio_id not in {row["id"] for row in client.get("/api/portfolios/").json()}
            assert sponsor not in {row["sponsor"] for row in client.get("/api/sponsors").json()}
            assert sponsor not in {row["sponsor"] for row in client.get("/api/sponsors/").json()}

            app.dependency_overrides[get_identity] = _team_identity(
                f"alias-viewer-{token}", team_b, role="viewer"
            )
            for path in ("/api/portfolios", "/api/portfolios/"):
                denied = client.post(
                    path,
                    data={"name": "Viewer portfolio", "kind": "CLO"},
                    files={"holdings": ("holdings.xlsx", _minimal_holdings_xlsx(), _XLSX)},
                )
                assert denied.status_code == 403, denied.text
    finally:
        app.dependency_overrides.clear()
