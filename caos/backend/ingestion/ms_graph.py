"""
Microsoft Graph API integration.
Monitors designated OneDrive/SharePoint folders for pricing sheet updates and
ingests mailbox messages for the email intelligence plane (P3, REF_CP-EMAIL).
"""

from __future__ import annotations

import io
from typing import Any

import httpx
import msal
import structlog

from core.config import get_settings
from db.session import AsyncSessionLocal
from governance.email_routing import CATEGORY_META, classify_email
from ingestion.xlsx_parser import ingest_pricing_sheet

logger = structlog.get_logger()
settings = get_settings()

# SharePoint folder path to watch (configure per deployment)
WATCHED_FILE_PATTERN = "Master_Pricing_Run"


def _get_access_token() -> str:
    """Acquire Graph API token via client credentials."""
    app = msal.ConfidentialClientApplication(
        client_id=settings.ms_graph_client_id,
        client_credential=settings.ms_graph_client_secret,
        authority=f"https://login.microsoftonline.com/{settings.ms_graph_tenant_id}",
    )
    result = app.acquire_token_for_client(scopes=["https://graph.microsoft.com/.default"])
    if "access_token" not in result:
        raise RuntimeError(f"MSAL token error: {result.get('error_description')}")
    return result["access_token"]


def _parse_resource(resource: str) -> tuple[str | None, str | None]:
    """
    Extract (drive_id, item_id) from a Graph notification `resource` string.

    App-only (client-credentials) tokens have no `/me` context, so every Graph
    call must be drive-scoped: `/drives/{drive_id}/items/{item_id}`.
    Typical resource formats:
      "drives/{drive-id}/items/{item-id}"
      "drives/{drive-id}/root"
    """
    drive_id = None
    item_id = None
    if "drives/" in resource:
        drive_id = resource.split("drives/")[1].split("/")[0]
    if "items/" in resource:
        item_id = resource.split("items/")[1].split("/")[0]
    return drive_id, item_id


async def download_drive_item(drive_id: str, item_id: str) -> bytes:
    """Download a file from a OneDrive/SharePoint drive by drive + item ID."""
    token = _get_access_token()
    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"https://graph.microsoft.com/v1.0/drives/{drive_id}/items/{item_id}/content",
            headers={"Authorization": f"Bearer {token}"},
            follow_redirects=True,
        )
        r.raise_for_status()
        return r.content


async def handle_graph_notification(notification: dict[str, Any]) -> None:
    """
    Process a single MS Graph change notification.
    If the changed file matches our pricing sheet pattern, auto-ingest.
    """
    resource = notification.get("resource", "")

    # Only process file changes (not folder, permission, etc.)
    change_type = notification.get("changeType", "")
    if change_type not in ("created", "updated"):
        return

    drive_id, item_id = _parse_resource(resource)
    if not drive_id or not item_id:
        # Drive-root subscriptions notify "something changed" without an item id;
        # those require a delta query (per-deployment) rather than a direct fetch.
        logger.warning(
            "Cannot resolve drive/item from resource — delta query required",
            resource=resource,
        )
        return

    # Fetch item metadata to check filename (drive-scoped for app-only auth)
    token = _get_access_token()
    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"https://graph.microsoft.com/v1.0/drives/{drive_id}/items/{item_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        r.raise_for_status()
        item_meta = r.json()

    filename: str = item_meta.get("name", "")
    if WATCHED_FILE_PATTERN.lower() not in filename.lower():
        logger.debug("Ignoring file change (not pricing sheet)", filename=filename)
        return

    logger.info("Pricing sheet detected via Graph webhook", filename=filename, item_id=item_id)

    # Download and ingest
    content = await download_drive_item(drive_id, item_id)
    from datetime import date
    run_date = date.today().isoformat()

    # TODO: resolve issuer_id from filename metadata or folder path convention
    # For now, log and skip — implement per-deployment folder→issuer mapping
    logger.info(
        "Auto-ingestion triggered for pricing sheet",
        filename=filename,
        run_date=run_date,
        note="Map issuer_id from folder convention to complete auto-ingestion",
    )


async def create_graph_subscription(notification_url: str, drive_id: str) -> dict[str, Any]:
    """
    Register a Graph API subscription to watch a drive.
    Call once during onboarding.
    """
    token = _get_access_token()
    from datetime import datetime, timedelta, timezone

    expiry = (datetime.now(timezone.utc) + timedelta(days=3)).strftime("%Y-%m-%dT%H:%M:%S.0000000Z")

    payload = {
        "changeType": "created,updated",
        "notificationUrl": notification_url,
        "resource": f"/drives/{drive_id}/root",
        "expirationDateTime": expiry,
        "clientState": settings.webhook_secret,
    }

    async with httpx.AsyncClient() as client:
        r = await client.post(
            "https://graph.microsoft.com/v1.0/subscriptions",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
        r.raise_for_status()
        return r.json()


# ─── Email intelligence ingestion (P3, REF_CP-EMAIL) ──────────────────────

async def fetch_mailbox_messages(
    user_id: str,
    top: int = 25,
    since_iso: str | None = None,
) -> list[dict[str, Any]]:
    """
    Fetch recent mailbox messages (app-only; drive-style `/users/{id}` path —
    `/me` is invalid for client-credentials tokens, per the F8 fix).
    """
    token = _get_access_token()
    params: dict[str, Any] = {
        "$top": top,
        "$orderby": "receivedDateTime desc",
        "$select": "subject,from,receivedDateTime,bodyPreview,webLink",
    }
    if since_iso:
        params["$filter"] = f"receivedDateTime ge {since_iso}"

    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"https://graph.microsoft.com/v1.0/users/{user_id}/messages",
            headers={"Authorization": f"Bearer {token}"},
            params=params,
        )
        r.raise_for_status()
        return r.json().get("value", [])


async def ingest_email_intelligence(user_id: str, since_iso: str | None = None) -> list[dict[str, Any]]:
    """
    Pull mailbox messages and classify each per REF_CP-EMAIL — producing the
    tier/staleness-annotated feed CP-MON and CP-SR consume.
    """
    messages = await fetch_mailbox_messages(user_id, since_iso=since_iso)
    annotated: list[dict[str, Any]] = []
    for m in messages:
        subject = m.get("subject", "")
        sender = (m.get("from", {}).get("emailAddress", {}) or {}).get("address", "")
        body = m.get("bodyPreview", "")
        category = classify_email(subject, sender, body)
        meta = CATEGORY_META[category]
        annotated.append({
            "subject": subject,
            "sender": sender,
            "received": m.get("receivedDateTime"),
            "web_link": m.get("webLink"),
            "email_category": category.value,
            "source_tier": meta.tier,
            "staleness_rule": meta.note,
        })
    logger.info("Email intelligence ingested", count=len(annotated), user_id=user_id)
    return annotated
