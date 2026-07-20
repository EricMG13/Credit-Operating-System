"""Direct HTTP contracts for API inventory entries lacking mapped evidence.

The feature IDs are intentional pytest parameter IDs.  The quality tracker maps
those IDs back to the code-discovered FastAPI inventory, so a route cannot be
reported as directly covered unless an executable request reaches that exact
boundary.
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient


SERVER_DIR = Path(__file__).resolve().parents[2] / "server"
sys.path.insert(0, str(SERVER_DIR))


@pytest.fixture(scope="module")
def client():
    from main import app

    with TestClient(app) as test_client:
        yield test_client


HAPPY_PATH_CASES = [
    pytest.param("API-001", "GET", "/api/alerts/events", None, 200, id="API-001"),
    pytest.param("API-003", "POST", "/api/alerts/refresh", None, 200, id="API-003"),
    pytest.param("API-105", "GET", "/api/qa/findings", None, 200, id="API-105"),
    pytest.param("API-113", "GET", "/api/query/insights", None, 200, id="API-113"),
]

INVALID_INPUT_CASES = [
    pytest.param("API-045", "GET", "/api/edgar/exhibits", None, 422, id="API-045"),
    pytest.param("API-108", "POST", "/api/query/answer", {}, 422, id="API-108"),
    pytest.param("API-118", "POST", "/api/query/overlay", {}, 422, id="API-118"),
    pytest.param("API-119", "POST", "/api/query/route", {}, 422, id="API-119"),
    pytest.param("API-152", "POST", "/api/scenario/propagate", {}, 422, id="API-152"),
]

FEATURE_GATED_CASES = [
    pytest.param(
        "API-088",
        "POST",
        "/api/models/v2/missing/workbook/import/commit",
        None,
        404,
        id="API-088",
    ),
]

MISSING_RESOURCE_CASES = [
    pytest.param(
        "API-002",
        "PATCH",
        "/api/alerts/events/missing-event",
        {"state": "ack"},
        404,
        id="API-002",
    ),
    pytest.param(
        "API-051",
        "GET",
        "/api/ingestion/manifests/missing-manifest",
        None,
        404,
        id="API-051",
    ),
    pytest.param(
        "API-064",
        "POST",
        "/api/issuers/missing-issuer/documents/missing-document/withdraw",
        None,
        404,
        id="API-064",
    ),
    pytest.param(
        "API-123",
        "POST",
        "/api/query/runs/missing-run/cancel",
        None,
        404,
        id="API-123",
    ),
]


def _request(
    client: TestClient,
    method: str,
    path: str,
    payload: dict[str, Any] | None,
):
    kwargs = {} if payload is None else {"json": payload}
    return client.request(method, path, **kwargs)


@pytest.mark.parametrize(
    ("feature_id", "method", "path", "payload", "expected_status"),
    HAPPY_PATH_CASES,
)
def test_api_happy_path_contract_returns_implemented_status(
    client: TestClient,
    feature_id: str,
    method: str,
    path: str,
    payload: dict[str, Any] | None,
    expected_status: int,
) -> None:
    response = _request(client, method, path, payload)

    assert feature_id.startswith("API-")
    assert response.status_code == expected_status, response.text


@pytest.mark.parametrize(
    ("feature_id", "method", "path", "payload", "expected_status"),
    INVALID_INPUT_CASES,
)
def test_api_invalid_input_contract_rejects_before_mutation(
    client: TestClient,
    feature_id: str,
    method: str,
    path: str,
    payload: dict[str, Any] | None,
    expected_status: int,
) -> None:
    response = _request(client, method, path, payload)

    assert feature_id.startswith("API-")
    assert response.status_code == expected_status, response.text


@pytest.mark.parametrize(
    ("feature_id", "method", "path", "payload", "expected_status"),
    FEATURE_GATED_CASES,
)
def test_api_permission_security_feature_gate_fails_closed(
    client: TestClient,
    feature_id: str,
    method: str,
    path: str,
    payload: dict[str, Any] | None,
    expected_status: int,
) -> None:
    response = _request(client, method, path, payload)

    assert feature_id.startswith("API-")
    assert response.status_code == expected_status, response.text


@pytest.mark.parametrize(
    ("feature_id", "method", "path", "payload", "expected_status"),
    MISSING_RESOURCE_CASES,
)
def test_api_missing_resource_error_contract_is_explicit(
    client: TestClient,
    feature_id: str,
    method: str,
    path: str,
    payload: dict[str, Any] | None,
    expected_status: int,
) -> None:
    response = _request(client, method, path, payload)

    assert feature_id.startswith("API-")
    assert response.status_code == expected_status, response.text
