"""Durable analyst-scoped workflow notification contracts."""

from __future__ import annotations

import asyncio

from fastapi.testclient import TestClient
from sqlalchemy import func, select


def _identity(analyst_id: str):
    from identity import CallerIdentity

    return lambda: CallerIdentity(
        id=analyst_id,
        email=f"{analyst_id}@firm.test",
        full_name=analyst_id,
        source="profile",
    )


def test_notification_feed_is_owned_cursor_based_and_seen_is_idempotent():
    from database import AsyncSessionLocal, NotificationEvent, Run
    from engine.fixtures import REFERENCE_ISSUER_ID
    from identity import get_identity
    from main import app
    from notification_service import emit_run_terminal_notification

    async def seed() -> tuple[str, str]:
        async with AsyncSessionLocal() as session:
            own = Run(
                issuer_id=REFERENCE_ISSUER_ID,
                analyst_id="notify-owner",
                status="complete",
            )
            foreign = Run(
                issuer_id=REFERENCE_ISSUER_ID,
                analyst_id="notify-other",
                status="failed",
                error="foreign failure",
            )
            session.add_all([own, foreign])
            await session.flush()
            await emit_run_terminal_notification(session, own)
            await emit_run_terminal_notification(session, own)
            await emit_run_terminal_notification(session, foreign)
            await session.commit()
            count = await session.scalar(select(func.count(NotificationEvent.id)).where(
                NotificationEvent.subject_id == own.id
            ))
            assert count == 1
            return own.id, foreign.id

    with TestClient(app) as client:
        own_run_id, foreign_run_id = asyncio.run(seed())
        try:
            app.dependency_overrides[get_identity] = _identity("notify-owner")
            first = client.get("/api/notifications")
            assert first.status_code == 200, first.text
            body = first.json()
            assert [row["subject_id"] for row in body["items"]] == [own_run_id]
            assert body["items"][0]["action_label"] == "Open dependency map"
            cursor = body["next_cursor"]
            assert cursor

            empty = client.get("/api/notifications", params={"cursor": cursor})
            assert empty.status_code == 200
            assert empty.json()["items"] == []
            assert empty.json()["next_cursor"] == cursor

            event_id = body["items"][0]["id"]
            seen = client.patch(f"/api/notifications/{event_id}/seen")
            assert seen.status_code == 200
            assert seen.json()["seen_at"] is not None
            seen_again = client.patch(f"/api/notifications/{event_id}/seen")
            assert seen_again.json()["seen_at"] == seen.json()["seen_at"]

            app.dependency_overrides[get_identity] = _identity("notify-other")
            hidden = client.patch(f"/api/notifications/{event_id}/seen")
            assert hidden.status_code == 404
            foreign = client.get("/api/notifications").json()["items"]
            assert [row["subject_id"] for row in foreign] == [foreign_run_id]

            tampered = client.get(
                "/api/notifications", params={"cursor": cursor[:-1] + ("0" if cursor[-1] != "0" else "1")}
            )
            assert tampered.status_code == 400
        finally:
            app.dependency_overrides.pop(get_identity, None)


def test_legacy_notification_without_action_label_remains_response_compatible():
    from datetime import datetime, timezone

    from database import NotificationEvent
    from routes.notifications import _notification_out

    legacy = NotificationEvent(
        id="legacy-notification",
        analyst_id="legacy-owner",
        kind="legacy_event",
        subject_kind="run",
        subject_id="legacy-run",
        issuer_id=None,
        title="Historical notification",
        body=None,
        href="/issuers",
        idempotency_key="legacy:notification",
        seen_at=None,
        created_at=datetime.now(timezone.utc),
    )

    assert _notification_out(legacy).action_label is None
