"""
MS Graph / OneDrive webhook endpoint.
Listens for file change notifications on designated SharePoint folders.
Auto-ingests Master_Pricing_Run.xlsx on detection.
"""

import hmac
from typing import Any

import structlog
from fastapi import APIRouter, BackgroundTasks, HTTPException, Request, Response

from core import rate_limit
from core.config import get_settings
from ingestion.ms_graph import handle_graph_notification

logger = structlog.get_logger()
router = APIRouter()
settings = get_settings()

# Subscriptions have a known max lifetime (~3 days for files). Treat anything
# older than the dedup window as a replay attempt.
_DEDUP_TTL_SECONDS = 60 * 60 * 24  # 24h
_DEDUP_MAX = 1  # ie. accept exactly once within the window


@router.post("/msgraph/notify")
async def msgraph_notify(
    request: Request,
    background_tasks: BackgroundTasks,
    validationToken: str | None = None,
):
    """
    Microsoft Graph subscription endpoint.
    Handles both subscription validation (query param) and change notifications (POST).

    Graph does NOT sign basic resource-change notifications with an HMAC header.
    Authenticity is established by echoing back the `clientState` we set at
    subscription creation — every notification must carry the matching value.

    Replay defence: each notification's `subscriptionId + resourceData.id +
    changeType` is recorded in Redis with a TTL. Duplicates inside the
    window are silently dropped — a leaked notification body cannot be
    re-played for repeated ingestion.
    """
    # Validation handshake during subscription creation — echo the token verbatim
    # as text/plain (Graph rejects a JSON-wrapped body).
    if validationToken:
        return Response(content=validationToken, media_type="text/plain")

    payload: dict[str, Any] = await request.json()
    notifications = payload.get("value", [])

    if not notifications:
        return {"status": "accepted", "processed": 0}

    accepted = 0
    skipped_replay = 0
    for notification in notifications:
        client_state = notification.get("clientState", "")
        # Constant-time compare against the secret we registered the subscription with.
        if not hmac.compare_digest(client_state, settings.webhook_secret):
            logger.warning("Rejected Graph notification: clientState mismatch")
            raise HTTPException(403, "Invalid clientState")

        # Build a stable id from the bits Graph guarantees per notification.
        sub_id = notification.get("subscriptionId", "")
        resource = notification.get("resource", "")
        resource_id = (notification.get("resourceData") or {}).get("id", "")
        change_type = notification.get("changeType", "")
        dedup_key = f"msgraph:dedup:{sub_id}:{resource_id or resource}:{change_type}"

        # fail_open=False: without Redis we cannot prove this isn't a replay,
        # so reject with 503 — Graph retries with backoff once Redis is back.
        try:
            first_time = await rate_limit.hit(
                dedup_key, max_attempts=_DEDUP_MAX,
                window_seconds=_DEDUP_TTL_SECONDS, fail_open=False,
            )
        except rate_limit.RateLimitUnavailable:
            raise HTTPException(503, "Replay-protection store unavailable; retry later")
        if not first_time:
            skipped_replay += 1
            logger.info("Dropping replayed Graph notification", dedup_key=dedup_key)
            continue

        background_tasks.add_task(handle_graph_notification, notification)
        accepted += 1

    return {"status": "accepted", "processed": accepted, "replays_dropped": skipped_replay}
