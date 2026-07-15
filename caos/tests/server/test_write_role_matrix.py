"""Server-principal write authorization across the domain mutation surface."""

from __future__ import annotations

from fastapi.routing import APIRoute
from fastapi.testclient import TestClient


_WRITE_DEPENDENCY_HANDLERS = {
    "upsert_alert_state",
    "refresh_alert_events",
    "patch_alert_event",
    "create_context",
    "patch_context",
    "create_finding",
    "patch_finding",
    "vault_exhibit",
    "upload_document",
    "upload_pricing_sheet",
    "upload_memo",
    "put_reporting_profile",
    "create_research_report",
    "create_model_checkpoint",
    "restore_model_checkpoint",
    "save_model",
    "mark_notification_seen",
    "create_flag",
    "replace_watchlist",
    "accept_link",
    "retract_link",
    "create_query_run",
    "cancel_query_run",
    "create_research",
    "create_run",
    "export_to_vault",
    "create_rv_screen",
    "ratify_rv_candidate",
    "update_feeds",
    "refresh_review",
    "create_sector_review",
    "ratify_sector_review",
    "publish_sector_review",
    "write_analyst_settings",
    "patch_analyst_settings",
    "create_thesis",
    "realize_prediction",
}


def _dependency_calls(dependant) -> set[object]:
    calls: set[object] = set()
    for dependency in dependant.dependencies:
        if dependency.call is not None:
            calls.add(dependency.call)
        calls.update(_dependency_calls(dependency))
    return calls


def _api_routes(router) -> list[APIRoute]:
    """Flatten FastAPI 0.138's lazy ``_IncludedRouter`` containers."""
    routes: list[APIRoute] = []
    for route in router.routes:
        if isinstance(route, APIRoute):
            routes.append(route)
        elif hasattr(route, "original_router"):
            routes.extend(_api_routes(route.original_router))
    return routes


def test_domain_mutation_matrix_uses_server_write_identity():
    from identity import get_write_identity
    from main import app

    routes = {
        route.endpoint.__name__: route
        for route in _api_routes(app)
    }
    missing_routes = _WRITE_DEPENDENCY_HANDLERS - routes.keys()
    assert not missing_routes
    missing_dependency = sorted(
        name
        for name in _WRITE_DEPENDENCY_HANDLERS
        if get_write_identity not in _dependency_calls(routes[name].dependant)
    )
    assert not missing_dependency


def test_viewer_is_denied_mutations_but_keeps_read_style_posts():
    from identity import CallerIdentity, get_identity
    from main import app

    async def viewer_identity() -> CallerIdentity:
        return CallerIdentity(
            id="write-matrix-viewer",
            email="viewer@test.local",
            full_name="Read-only Viewer",
            role="viewer",
        )

    app.dependency_overrides[get_identity] = viewer_identity
    try:
        with TestClient(app) as client:
            assert client.post(
                "/api/runs", json={"issuer_id": "not-evaluated-before-authz"}
            ).status_code == 403
            assert client.post(
                "/api/qa/flags", json={"module_id": "CP-1"}
            ).status_code == 403
            assert client.post(
                "/api/query/links",
                json={
                    "source_issuer_id": "issuer-a",
                    "target_issuer_id": "issuer-b",
                    "capability_id": "peer-set",
                },
            ).status_code == 403

            # POST is also used for bounded analytical requests. These remain
            # available to viewers because they do not create domain artifacts.
            assert client.post(
                "/api/scenario/nl", json={"text": "revenue down 5%"}
            ).status_code != 403
            assert client.post(
                "/api/chat/issuer",
                json={"messages": [{"role": "user", "content": "Summarize leverage"}]},
            ).status_code != 403
    finally:
        app.dependency_overrides.clear()
