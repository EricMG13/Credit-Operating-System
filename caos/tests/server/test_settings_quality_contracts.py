"""Scenario-complete contracts for the workspace and analyst Settings APIs."""

from __future__ import annotations

import ast
import importlib
import inspect
import uuid

import pytest
from fastapi.testclient import TestClient


async def _failed_database_dependency():
    raise RuntimeError("settings quality-contract database failure")
    yield  # pragma: no cover - retains FastAPI's async-generator dependency shape


async def _failed_identity_dependency():
    raise RuntimeError("settings quality-contract identity failure")


def _create_profile(client: TestClient, label: str) -> str:
    created = client.post(
        "/api/auth/profile",
        json={"code": "131113", "name": f"{label} {uuid.uuid4().hex[:10]}"},
    )
    assert created.status_code in (200, 201), created.text
    settings = client.get("/api/settings")
    assert settings.status_code == 200, settings.text
    return settings.json()["analyst"]


def _replacement_body(*, marker: str = "quality", role_view: str = "analyst") -> dict:
    return {
        "model_lanes": {"module_synthesis": "quality-model"},
        "email_intelligence": {"approved_senders": ["quality@firm.test"]},
        "role_view": role_view,
        "workspace": {"quality_marker": marker},
    }


def test_api_164_identity_failure_returns_json_500_and_recovers() -> None:
    from identity import get_identity
    from main import app

    app.dependency_overrides[get_identity] = _failed_identity_dependency
    try:
        with TestClient(app, raise_server_exceptions=False) as client:
            failed = client.get("/api/settings")
            assert failed.status_code == 500
            assert failed.json() == {"detail": "Internal Server Error"}

            del app.dependency_overrides[get_identity]
            recovered = client.get("/api/settings")
            assert recovered.status_code == 200, recovered.text
            assert set(recovered.json()) == {
                "model",
                "llm_configured",
                "gemini_configured",
                "openrouter_configured",
                "governance",
                "model_tiers",
                "engine_cost",
                "deep_research",
                "retrieval",
                "workspace",
                "features",
                "analyst",
            }
    finally:
        app.dependency_overrides.clear()


@pytest.mark.parametrize(
    ("api_id", "method", "payload"),
    [
        pytest.param("API-165", "GET", None, id="API-165"),
        pytest.param("API-166", "PATCH", {"expected_revision": 0, "role_view": "pm"}, id="API-166"),
        pytest.param("API-167", "PUT", _replacement_body(), id="API-167"),
    ],
)
def test_settings_analyst_database_failure_is_truthful_and_recovers(
    api_id: str,
    method: str,
    payload: dict | None,
) -> None:
    import rate_limit
    from database import get_db
    from main import app

    rate_limit.reset()
    try:
        with TestClient(app, raise_server_exceptions=False) as client:
            _create_profile(client, f"Failure {api_id}")
            app.dependency_overrides[get_db] = _failed_database_dependency
            failed = client.request(method, "/api/settings/analyst", json=payload)
            assert failed.status_code == 500
            assert failed.json() == {"detail": "Internal Server Error"}

            del app.dependency_overrides[get_db]
            recovered = client.request(method, "/api/settings/analyst", json=payload)
            assert recovered.status_code == 200, recovered.text
    finally:
        app.dependency_overrides.clear()
        rate_limit.reset()


def test_settings_reads_are_profile_scoped_and_viewers_cannot_write() -> None:
    import rate_limit
    from identity import CallerIdentity, get_identity
    from main import app

    rate_limit.reset()
    try:
        with TestClient(app) as first, TestClient(app) as second:
            first_id = _create_profile(first, "Settings Owner A")
            stored = first.put(
                "/api/settings/analyst",
                json=_replacement_body(marker="owner-a"),
            )
            assert stored.status_code == 200, stored.text

            _create_profile(second, "Settings Owner B")
            second_read = second.get("/api/settings/analyst")
            assert second_read.status_code == 200, second_read.text
            assert second_read.json()["workspace"].get("quality_marker") is None

            first_read = first.get("/api/settings/analyst")
            assert first_read.status_code == 200, first_read.text
            assert first_read.json()["workspace"]["quality_marker"] == "owner-a"

            async def viewer_identity() -> CallerIdentity:
                return CallerIdentity(
                    id=first_id,
                    email="settings-viewer@firm.test",
                    full_name="Settings Viewer",
                    role="viewer",
                    source="profile",
                )

            app.dependency_overrides[get_identity] = viewer_identity
            assert first.put(
                "/api/settings/analyst",
                json=_replacement_body(marker="forbidden"),
            ).status_code == 403
            assert first.patch(
                "/api/settings/analyst",
                json={"expected_revision": 1, "role_view": "qa"},
            ).status_code == 403
    finally:
        app.dependency_overrides.clear()
        rate_limit.reset()


def test_settings_inputs_are_bounded_and_invalid_writes_do_not_mutate() -> None:
    import rate_limit
    from main import app

    rate_limit.reset()
    try:
        with TestClient(app) as client:
            _create_profile(client, "Settings Validation")
            initial = client.get("/api/settings/analyst").json()

            assert client.get(
                "/api/settings", params={"unexpected": "ignored"}
            ).status_code == 200
            assert client.get(
                "/api/settings/analyst", params={"unexpected": "ignored"}
            ).status_code == 200
            assert client.put(
                "/api/settings/analyst", json={"role_view": 42}
            ).status_code == 422
            assert client.patch(
                "/api/settings/analyst", json={"expected_revision": -1}
            ).status_code == 422

            oversized = _replacement_body()
            oversized["workspace"] = {"blob": "x" * 100_001}
            assert client.put(
                "/api/settings/analyst", json=oversized
            ).status_code == 413
            assert client.patch(
                "/api/settings/analyst",
                json={"expected_revision": 0, "workspace": oversized["workspace"]},
            ).status_code == 413

            unchanged = client.get("/api/settings/analyst")
            assert unchanged.status_code == 200, unchanged.text
            assert unchanged.json() == initial
    finally:
        app.dependency_overrides.clear()
        rate_limit.reset()


def test_settings_mutations_share_exact_backpressure_and_recover() -> None:
    import rate_limit
    from main import app

    rate_limit.reset()
    try:
        with TestClient(app) as client:
            _create_profile(client, "Settings Backpressure")
            invalid_replacement = _replacement_body(role_view="admin")
            for _ in range(15):
                rejected = client.put(
                    "/api/settings/analyst", json=invalid_replacement
                )
                assert rejected.status_code == 422, rejected.text
            for _ in range(15):
                conflict = client.patch(
                    "/api/settings/analyst",
                    json={"expected_revision": 999, "role_view": "pm"},
                )
                assert conflict.status_code == 409, conflict.text

            blocked = client.put(
                "/api/settings/analyst", json=_replacement_body(marker="blocked")
            )
            assert blocked.status_code == 429, blocked.text

            rate_limit.reset()
            recovered = client.put(
                "/api/settings/analyst", json=_replacement_body(marker="recovered")
            )
            assert recovered.status_code == 200, recovered.text
            assert recovered.json()["workspace"]["quality_marker"] == "recovered"
    finally:
        app.dependency_overrides.clear()
        rate_limit.reset()


SETTINGS_API_BOUNDED_WORK = [
    pytest.param(
        "API-164",
        "read_settings",
        ("get_settings()", "llm_configured()", '"features"'),
        id="API-164",
    ),
    pytest.param(
        "API-165",
        "read_analyst_settings",
        ("db.get(Analyst, caller.id)", "_settings_out(analyst)"),
        id="API-165",
    ),
    pytest.param(
        "API-166",
        "patch_analyst_settings",
        ("_WRITES_PER_MINUTE", "_MAX_SETTINGS_BYTES", "await db.flush()"),
        id="API-166",
    ),
    pytest.param(
        "API-167",
        "write_analyst_settings",
        ("_WRITES_PER_MINUTE", "_MAX_SETTINGS_BYTES", "await db.commit()"),
        id="API-167",
    ),
]


@pytest.mark.parametrize(
    ("api_id", "callable_name", "required_tokens"),
    SETTINGS_API_BOUNDED_WORK,
)
def test_settings_api_handler_has_bounded_work_contract(
    api_id: str,
    callable_name: str,
    required_tokens: tuple[str, ...],
) -> None:
    source = inspect.getsource(
        getattr(importlib.import_module("routes.settings"), callable_name)
    )

    assert api_id.startswith("API-")
    assert len(source.splitlines()) <= 60
    assert not any(
        isinstance(node, (ast.For, ast.AsyncFor, ast.While))
        for node in ast.walk(ast.parse(source))
    )
    for token in required_tokens:
        assert token in source, f"{api_id} lost its bounded-work contract: {token}"
