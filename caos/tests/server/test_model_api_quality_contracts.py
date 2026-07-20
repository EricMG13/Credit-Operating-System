"""Focused completeness and bounded-work contracts for the Model API family."""

from __future__ import annotations

import importlib
import inspect
import uuid

import pytest
from fastapi.testclient import TestClient


REFERENCE_ISSUER_ID = "a71f0000-0000-0000-0000-000000000001"


def _identity(analyst_id: str, *, role: str = "analyst"):
    from identity import CallerIdentity

    return lambda: CallerIdentity(
        id=analyst_id,
        email=f"{analyst_id}@firm.test",
        full_name=analyst_id,
        role=role,
        source="profile",
        team_id=None,
    )


def _as(analyst_id: str, *, role: str = "analyst") -> None:
    from identity import get_identity
    from main import app

    app.dependency_overrides[get_identity] = _identity(analyst_id, role=role)


@pytest.fixture(scope="module")
def client():
    from main import app

    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(autouse=True)
def _reset_model_api_contract():
    from config import get_settings
    from main import app

    settings = get_settings()
    original = (
        settings.caos_model_engine_v2_enabled,
        settings.caos_lineage_v2_enabled,
        settings.caos_tenancy_enabled,
    )
    settings.caos_model_engine_v2_enabled = True
    settings.caos_lineage_v2_enabled = True
    settings.caos_tenancy_enabled = False
    yield
    app.dependency_overrides.clear()
    (
        settings.caos_model_engine_v2_enabled,
        settings.caos_lineage_v2_enabled,
        settings.caos_tenancy_enabled,
    ) = original


def _legacy_context(client: TestClient, owner: str) -> dict:
    _as(owner)
    response = client.post(
        "/api/analysis/contexts",
        json={
            "name": f"Model API quality {uuid.uuid4().hex[:8]}",
            "issuer_ids": [REFERENCE_ISSUER_ID],
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def _save_legacy_model(client: TestClient, *, version: int) -> dict:
    response = client.put(
        f"/api/models/{REFERENCE_ISSUER_ID}",
        json={"payload": {"version": version, "overrides": {}}},
    )
    assert response.status_code == 200, response.text
    return response.json()


def _legacy_checkpoint_fixture(client: TestClient, owner: str) -> tuple[dict, dict, dict]:
    context = _legacy_context(client, owner)
    saved = _save_legacy_model(client, version=1)
    checkpoint = client.post(
        f"/api/models/{REFERENCE_ISSUER_ID}/checkpoints",
        json={
            "context_id": context["id"],
            "label": "Quality checkpoint",
            "expected_updated_at": saved["updated_at"],
        },
    )
    assert checkpoint.status_code == 201, checkpoint.text
    return context, saved, checkpoint.json()


def test_legacy_model_reads_are_analyst_scoped_empty_and_non_enumerable(client):
    owner = f"model-api-read-owner-{uuid.uuid4().hex[:10]}"
    _, _, checkpoint = _legacy_checkpoint_fixture(client, owner)

    saved = client.get(f"/api/models/{REFERENCE_ISSUER_ID}")
    checkpoints = client.get(f"/api/models/{REFERENCE_ISSUER_ID}/checkpoints")
    assert saved.status_code == 200
    assert saved.json()["payload"]["version"] == 1
    assert checkpoints.status_code == 200
    assert checkpoints.json()[0]["id"] == checkpoint["id"]

    _as(f"model-api-read-other-{uuid.uuid4().hex[:10]}")
    assert client.get(f"/api/models/{REFERENCE_ISSUER_ID}").json() is None
    assert client.get(f"/api/models/{REFERENCE_ISSUER_ID}/checkpoints").json() == []

    missing_model = client.get("/api/models/not-a-real-issuer")
    missing_checkpoints = client.get("/api/models/not-a-real-issuer/checkpoints")
    assert missing_model.status_code == 404
    assert missing_checkpoints.status_code == 404
    assert missing_model.json() == {"detail": "Issuer not found"}
    assert missing_checkpoints.json() == {"detail": "Issuer not found"}


def test_legacy_model_save_requires_write_role_and_preserves_durable_state(client):
    owner = f"model-api-save-role-{uuid.uuid4().hex[:10]}"
    _as(owner)
    _save_legacy_model(client, version=1)

    _as(owner, role="viewer")
    denied = client.put(
        f"/api/models/{REFERENCE_ISSUER_ID}",
        json={"payload": {"version": 2, "overrides": {}}},
    )
    assert denied.status_code == 403
    current = client.get(f"/api/models/{REFERENCE_ISSUER_ID}")
    assert current.status_code == 200
    assert current.json()["payload"]["version"] == 1


def test_legacy_checkpoint_create_rejects_unsaved_stale_and_invalid_requests(client):
    owner = f"model-api-create-{uuid.uuid4().hex[:10]}"
    context = _legacy_context(client, owner)
    endpoint = f"/api/models/{REFERENCE_ISSUER_ID}/checkpoints"

    unsaved = client.post(endpoint, json={"context_id": context["id"]})
    assert unsaved.status_code == 409
    assert "Save the working model" in unsaved.text

    first = _save_legacy_model(client, version=1)
    invalid_label = client.post(
        endpoint,
        json={"context_id": context["id"], "label": ""},
    )
    assert invalid_label.status_code == 422
    foreign_context = client.post(
        endpoint,
        json={"context_id": "not-an-owned-context"},
    )
    assert foreign_context.status_code == 404

    current = _save_legacy_model(client, version=2)
    stale = client.post(
        endpoint,
        json={
            "context_id": context["id"],
            "expected_updated_at": first["updated_at"],
        },
    )
    assert stale.status_code == 409
    created = client.post(
        endpoint,
        json={
            "context_id": context["id"],
            "expected_updated_at": current["updated_at"],
        },
    )
    assert created.status_code == 201, created.text


def test_legacy_checkpoint_restore_rejects_stale_malformed_and_foreign_requests(client):
    owner = f"model-api-restore-{uuid.uuid4().hex[:10]}"
    _, saved, checkpoint = _legacy_checkpoint_fixture(client, owner)
    endpoint = f"/api/models/checkpoints/{checkpoint['id']}/restore"

    current = _save_legacy_model(client, version=2)
    stale = client.post(endpoint, json={"expected_updated_at": saved["updated_at"]})
    assert stale.status_code == 409
    malformed = client.post(endpoint, json={"expected_updated_at": "not-a-datetime"})
    assert malformed.status_code == 422
    restored = client.post(endpoint, json={"expected_updated_at": current["updated_at"]})
    assert restored.status_code == 200, restored.text
    assert restored.json()["payload"]["version"] == 1

    missing = client.post("/api/models/checkpoints/not-a-checkpoint/restore", json={})
    assert missing.status_code == 404
    _as(f"model-api-restore-other-{uuid.uuid4().hex[:10]}")
    assert client.post(endpoint, json={}).status_code == 404


def test_legacy_checkpoint_create_rate_limit_stops_the_sixteenth_attempt(client):
    import rate_limit

    owner = f"model-api-rate-{uuid.uuid4().hex[:10]}"
    context = _legacy_context(client, owner)
    _save_legacy_model(client, version=1)
    rate_limit.reset()
    endpoint = f"/api/models/{REFERENCE_ISSUER_ID}/checkpoints"

    for index in range(15):
        response = client.post(
            endpoint,
            json={"context_id": context["id"], "label": f"Bounded {index}"},
        )
        assert response.status_code == 201, response.text
    blocked = client.post(endpoint, json={"context_id": context["id"]})
    assert blocked.status_code == 429
    assert blocked.json() == {"detail": "Checkpoint rate limit reached."}


MODEL_API_PERFORMANCE_CONTRACTS = [
    pytest.param("API-072", "GET", "/api/models/quality-issuer", "routes.models", ("get_saved_model",), ("scalar_one_or_none",), id="API-072"),
    pytest.param("API-073", "PUT", "/api/models/quality-issuer", "routes.models", ("save_model",), ("_MAX_PAYLOAD_BYTES", "_SAVES_PER_MINUTE"), id="API-073"),
    pytest.param("API-074", "GET", "/api/models/quality-issuer/checkpoints", "routes.models", ("list_model_checkpoints",), (".limit(100)",), id="API-074"),
    pytest.param("API-075", "POST", "/api/models/quality-issuer/checkpoints", "routes.models", ("create_model_checkpoint",), ("max_attempts=15", "window_seconds=60"), id="API-075"),
    pytest.param("API-076", "POST", "/api/models/checkpoints/quality-checkpoint/restore", "routes.models", ("restore_model_checkpoint",), ("await db.get(ModelCheckpoint", "scalar_one_or_none"), id="API-076"),
    pytest.param("API-077", "GET", "/api/models/v2/quality-issuer", "routes.model_v2", ("get_model_v2",), (".limit(1)",), id="API-077"),
    pytest.param("API-078", "PUT", "/api/models/v2/quality-issuer", "routes.model_v2", ("put_model_v2",), ("_bounded_payload", "_create_or_update"), id="API-078"),
    pytest.param("API-079", "POST", "/api/models/v2/quality-issuer/calculate", "routes.model_v2", ("calculate_model_v2",), ("_bounded_payload", "calculate_model"), id="API-079"),
    pytest.param("API-080", "GET", "/api/models/v2/quality-issuer/checkpoints", "routes.model_v2", ("list_model_v2_checkpoints",), (".limit(100)",), id="API-080"),
    pytest.param("API-081", "POST", "/api/models/v2/quality-issuer/checkpoints", "routes.model_v2", ("create_model_v2_checkpoint",), ("_reserve_draft_for_checkpoint", ".limit(1)"), id="API-081"),
    pytest.param("API-082", "POST", "/api/models/v2/quality-issuer/checkpoints/quality-checkpoint/restore", "routes.model_v2", ("restore_model_v2_checkpoint",), ("await db.get(ModelCheckpoint", "_cas_update"), id="API-082"),
    pytest.param("API-083", "GET", "/api/models/v2/quality-issuer/history", "routes.model_v2", ("list_model_v2_history",), (".limit(500)",), id="API-083"),
    pytest.param("API-084", "POST", "/api/models/v2/quality-issuer/history/quality-event/replay", "routes.model_v2", ("replay_model_v2_event",), ("ModelOverrideEvent.revision == event.revision", "_cas_update"), id="API-084"),
    pytest.param("API-085", "POST", "/api/models/v2/quality-issuer/overrides", "routes.model_v2", ("mutate_model_v2_override",), ("_cas_update", "calculate_model"), id="API-085"),
    pytest.param("API-086", "POST", "/api/models/v2/quality-issuer/overrides/batch", "routes.model_v2", ("mutate_model_v2_overrides_batch", "OverrideBatchBody"), ("max_length=500", "_cas_update"), id="API-086"),
    pytest.param("API-087", "GET", "/api/models/v2/quality-issuer/workbook/export", "routes.model_workbook", ("export_model_workbook",), ("asyncio.to_thread",), id="API-087"),
    pytest.param("API-088", "POST", "/api/models/v2/quality-issuer/workbook/import/commit", "routes.model_workbook", ("commit_model_workbook_import", "_guard", "_preview_bytes", "_semaphore"), ("max_attempts=_PREVIEWS_PER_MINUTE", "read_capped", "asyncio.to_thread", "asyncio.Semaphore"), id="API-088"),
    pytest.param("API-089", "POST", "/api/models/v2/quality-issuer/workbook/import/preview", "routes.model_workbook", ("preview_model_workbook_import", "_guard", "_preview_bytes", "_semaphore"), ("max_attempts=_PREVIEWS_PER_MINUTE", "read_capped", "asyncio.to_thread", "asyncio.Semaphore"), id="API-089"),
]


@pytest.mark.parametrize(
    (
        "api_id",
        "method",
        "concrete_path",
        "module_name",
        "callable_names",
        "required_tokens",
    ),
    MODEL_API_PERFORMANCE_CONTRACTS,
)
def test_model_api_performance_contract_has_explicit_bound(
    api_id: str,
    method: str,
    concrete_path: str,
    module_name: str,
    callable_names: tuple[str, ...],
    required_tokens: tuple[str, ...],
) -> None:
    module = importlib.import_module(module_name)
    source = "\n".join(inspect.getsource(getattr(module, name)) for name in callable_names)

    assert api_id.startswith("API-")
    assert method in {"GET", "PUT", "POST"}
    assert concrete_path.startswith("/api/models/")
    for token in required_tokens:
        assert token in source, f"{api_id} lost its bounded-work contract: {token}"
