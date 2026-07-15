"""Transactional, idempotent workflow-notification emission."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from urllib.parse import urlencode

from sqlalchemy import insert
from sqlalchemy.dialects.postgresql import insert as postgres_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.ext.asyncio import AsyncSession

from database import Issuer, NotificationEvent, Run


async def _insert_terminal_notification(
    session: AsyncSession,
    run: Run,
    *,
    status: str,
    issuer_label: str,
) -> None:
    """Insert one terminal event; the caller owns transaction boundaries."""

    kind = "run_complete" if status == "complete" else "run_failed"
    title = f"{issuer_label} analysis {'complete' if status == 'complete' else 'failed'}"
    body = (
        f"Run {run.id} completed and is ready to review."
        if status == "complete"
        else (run.error or "The analytical run failed before completion.")[:1000]
    )
    query = urlencode({"issuer": run.issuer_id, "run": run.id, "view": "graph"})
    values = {
        "id": str(uuid.uuid4()),
        "analyst_id": run.analyst_id,
        "kind": kind,
        "subject_kind": "run",
        "subject_id": run.id,
        "issuer_id": run.issuer_id,
        "title": title,
        "body": body,
        "href": f"/pipeline?{query}",
        "idempotency_key": f"run:{run.id}:{status}",
        "seen_at": None,
        "created_at": datetime.now(timezone.utc),
    }
    dialect = session.get_bind().dialect.name
    if dialect == "postgresql":
        stmt = postgres_insert(NotificationEvent).values(**values).on_conflict_do_nothing(
            index_elements=[NotificationEvent.idempotency_key]
        )
    elif dialect == "sqlite":
        stmt = sqlite_insert(NotificationEvent).values(**values).on_conflict_do_nothing(
            index_elements=[NotificationEvent.idempotency_key]
        )
    else:
        stmt = insert(NotificationEvent).values(**values)
    await session.execute(stmt)


async def emit_run_terminal_notification(
    session: AsyncSession,
    run: Run,
    *,
    terminal_status: str | None = None,
) -> None:
    """Add one analyst-owned event without committing the caller's transaction."""

    status = terminal_status or run.status
    if not run.analyst_id or status not in {"complete", "failed"}:
        return

    issuer = await session.get(Issuer, run.issuer_id)
    issuer_label = issuer.name if issuer is not None else "Issuer"
    await _insert_terminal_notification(
        session,
        run,
        status=status,
        issuer_label=issuer_label,
    )


async def emit_run_terminal_notification_fallback(
    session: AsyncSession,
    run: Run,
    *,
    terminal_status: str | None = None,
) -> None:
    """Emit without ancillary issuer reads when rich notification rendering fails."""

    status = terminal_status or run.status
    if not run.analyst_id or status not in {"complete", "failed"}:
        return
    await _insert_terminal_notification(
        session,
        run,
        status=status,
        issuer_label="Issuer",
    )
