"""Optional multi-team tenancy enforcement (CAOS_TENANCY_ENABLED).

The platform is a single shared coverage desk by default; these helpers are NO-OPS
unless tenancy is enabled, so the single-team deployment behaves exactly as before.

The **issuer is the tenancy anchor**: runs, documents, metric_facts, and the
portfolio board all key off ``issuer_id``, so scoping issuer access scopes everything
derived from it. Three primitives:

  * ``scope_issuers(stmt, caller)`` — append the team filter to any SELECT over Issuer
    (list / portfolio / cross-issuer query).
  * ``require_issuer(caller, issuer)`` — gate by-id issuer access; raise 404 on a
    cross-team issuer (404 not 403, so team B cannot probe the existence of team A's
    issuer).
  * ``require_run_access(caller, run, db)`` — gate a run by its issuer's team.

A NULL ``issuer.team_id`` is shared/global (visible to every team, e.g. the reference
demo issuer). A caller whose ``team_id`` is None (proxy/local/unassigned) sees only
those shared issuers.
"""
from __future__ import annotations

from typing import Optional

from fastapi import HTTPException
from sqlalchemy import or_
from sqlalchemy.ext.asyncio import AsyncSession

from config import get_settings
from database import Issuer, Run
from identity import CallerIdentity


def tenancy_enabled() -> bool:
    return get_settings().caos_tenancy_enabled


def issuer_visible(caller: CallerIdentity, issuer: Optional[Issuer]) -> bool:
    """Whether ``caller`` may see ``issuer`` under the active tenancy setting."""
    if issuer is None:
        return False
    if not tenancy_enabled():
        return True
    # Shared/global issuers (team_id None) are visible to everyone; otherwise the
    # issuer's team must match the caller's.
    return issuer.team_id is None or issuer.team_id == caller.team_id


def require_issuer(caller: CallerIdentity, issuer: Optional[Issuer]) -> Issuer:
    """Return ``issuer`` if the caller may access it, else 404 — never leak the
    existence of another team's issuer. Routes that already 404 a missing issuer can
    route both cases through here."""
    if issuer is None or not issuer_visible(caller, issuer):
        raise HTTPException(404, "Issuer not found")
    return issuer


def scope_issuers(stmt, caller: CallerIdentity):
    """Append the team filter to a SELECT over Issuer (no-op when tenancy is off)."""
    if not tenancy_enabled():
        return stmt
    return stmt.where(or_(Issuer.team_id.is_(None), Issuer.team_id == caller.team_id))


async def require_run_access(caller: CallerIdentity, run: Optional[Run], db: AsyncSession) -> Run:
    """Gate a run by its issuer's team; 404 (as "Run not found") if the run is missing
    or its issuer isn't visible to the caller. One extra indexed lookup only when
    tenancy is enabled."""
    if run is None:
        raise HTTPException(404, "Run not found")
    if tenancy_enabled():
        issuer = await db.get(Issuer, run.issuer_id)
        if not issuer_visible(caller, issuer):
            raise HTTPException(404, "Run not found")
    return run


def new_issuer_team(caller: CallerIdentity) -> Optional[str]:
    """The team_id to stamp on an issuer ``caller`` creates — the caller's team when
    tenancy is enabled, else None (single-team default leaves issuers shared/global)."""
    return caller.team_id if tenancy_enabled() else None


def block_if_tenancy_unscoped() -> None:
    """Fail closed for cross-issuer AGGREGATE lanes that are not yet team-scoped —
    the cross-issuer NL query, the Query graph/overlay, and the sponsor/digest
    roll-ups. Under multi-team tenancy these would mix issuers across teams, so refuse
    them (501) rather than leak; the per-object issuer/run/portfolio/chunk surfaces
    ARE scoped and remain available. No-op when tenancy is off (single shared desk)."""
    if tenancy_enabled():
        raise HTTPException(
            501,
            "Cross-issuer aggregate lanes are not available under multi-team tenancy "
            "(not team-scoped yet). Use the per-issuer views.",
        )
