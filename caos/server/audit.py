"""E3 audit-write helper — the single call every mutating route uses.

Call ``write`` right before the route's own ``await session.commit()`` (not
after — a separate commit would let the mutation land without its audit row,
or vice versa, on a mid-transaction failure). ``write`` itself only
``session.add``s; it never commits, so it always rides the caller's existing
transaction atomically.

``before``/``after`` are small explicit dicts the caller builds from the
fields that changed — never a full model dump. That keeps the audit row
readable, keeps unrelated columns (and any PII beyond what's relevant to the
action) out of a table this permanent, and sidesteps datetime/relationship
JSON-serialization edge cases a generic dumper would hit.

Scope (E3, PRE_DEPLOYMENT_PLAN §7): every route that mutates FIRM/shared
institutional data — issuer create, document/pricing-sheet/memo/EDGAR-exhibit
upload, agency-rating edits (extracted from a pricing sheet), portfolio
create/holdings, run create, research-report create, QA flag create, query
link accept/retract, analyst create/register/SSO-adopt, GDPR erase. Excluded
by design: per-analyst PRIVATE working state that ``erase_analyst_data``
already deletes outright rather than anonymizes — SavedModel, ResearchJob
(Deep Research ad-hoc query) — plus pure per-caller UI preference with no
institutional-record value (watchlist, sector-feed toggles, analyst model/
email-intel settings) and session events that don't mutate business data
(login/logout/recover). Adding a new route to the excluded categories'
successors should re-examine this list, not silently skip it.
"""
from __future__ import annotations

from typing import Any, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from database import AuditLog


def write(
    session: AsyncSession,
    *,
    analyst_id: Optional[str],
    action: str,
    target_type: str,
    target_id: Optional[str] = None,
    before: Optional[dict[str, Any]] = None,
    after: Optional[dict[str, Any]] = None,
) -> None:
    session.add(AuditLog(
        analyst_id=analyst_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        before=before,
        after=after,
    ))
