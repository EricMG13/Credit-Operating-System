"""Backfill policy-backed freshness into immutable report authority.

Revision ID: 0054
Revises: 0053
Create Date: 2026-07-14

Legacy reports persisted a naked ``freshness=current`` without an evaluated
source-version proof. The safe additive correction is UNKNOWN; domain payloads
and all report identities remain untouched.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import context, op

revision: str = "0054"
down_revision: Union[str, None] = "0053"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_LEGACY_REASON = "legacy_report_freshness_unverified"
_EVALUATION = {
    "state": "unknown",
    "source_kind": "derived_artifact",
    "observed_at": None,
    "effective_period_end": None,
    "expected_next_at": None,
    "due_at": None,
    "age_days": None,
    "reason": _LEGACY_REASON,
    "policy_version": "caos-freshness-v1",
}
_STATES = {"current", "due", "stale", "unknown"}


def _has_evaluated_freshness(authority: object) -> bool:
    if not isinstance(authority, dict):
        return False
    evaluation = authority.get("freshness_evaluation")
    return (
        isinstance(evaluation, dict)
        and evaluation.get("state") in _STATES
        and isinstance(evaluation.get("source_kind"), str)
        and isinstance(evaluation.get("reason"), str)
        and isinstance(evaluation.get("policy_version"), str)
    )


def _offline_upgrade() -> None:
    """Emit the production PostgreSQL backfill in Alembic ``--sql`` mode."""
    if context.get_context().dialect.name != "postgresql":
        raise RuntimeError("0054 offline SQL generation is supported for PostgreSQL; use an online migration for SQLite")
    op.execute(sa.text("""
        UPDATE report_versions
        SET authority = (
            COALESCE(authority, '{}'::json)::jsonb
            || '{
                "freshness":"unknown",
                "freshness_evaluation":{
                    "state":"unknown",
                    "source_kind":"derived_artifact",
                    "observed_at": null,
                    "effective_period_end": null,
                    "expected_next_at": null,
                    "due_at": null,
                    "age_days": null,
                    "reason":"legacy_report_freshness_unverified",
                    "policy_version":"caos-freshness-v1"
                }
            }'::jsonb
        )::json
        WHERE NOT COALESCE((
            jsonb_typeof(COALESCE(authority, '{}'::json)::jsonb -> 'freshness_evaluation') = 'object'
            AND COALESCE(authority, '{}'::json)::jsonb -> 'freshness_evaluation' ->> 'state'
                IN ('current', 'due', 'stale', 'unknown')
            AND jsonb_typeof(COALESCE(authority, '{}'::json)::jsonb -> 'freshness_evaluation' -> 'source_kind') = 'string'
            AND jsonb_typeof(COALESCE(authority, '{}'::json)::jsonb -> 'freshness_evaluation' -> 'reason') = 'string'
            AND jsonb_typeof(COALESCE(authority, '{}'::json)::jsonb -> 'freshness_evaluation' -> 'policy_version') = 'string'
        ), FALSE)
    """))


def _offline_downgrade() -> None:
    if context.get_context().dialect.name != "postgresql":
        raise RuntimeError("0054 offline SQL generation is supported for PostgreSQL; use an online migration for SQLite")
    op.execute(sa.text("""
        UPDATE report_versions
        SET authority = (
            (COALESCE(authority, '{}'::json)::jsonb - 'freshness_evaluation')
            || '{"freshness":"unknown"}'::jsonb
        )::json
        WHERE COALESCE(authority, '{}'::json)::jsonb
            -> 'freshness_evaluation' ->> 'reason' = 'legacy_report_freshness_unverified'
    """))


def upgrade() -> None:
    if context.is_offline_mode():
        _offline_upgrade()
        return
    reports = sa.table(
        "report_versions",
        sa.column("id", sa.String()),
        sa.column("authority", sa.JSON()),
    )
    connection = op.get_bind()
    result = connection.execute(sa.select(reports.c.id, reports.c.authority).order_by(reports.c.id))
    while True:
        rows = result.fetchmany(500)
        if not rows:
            break
        for report_id, raw_authority in rows:
            if _has_evaluated_freshness(raw_authority):
                continue
            authority = dict(raw_authority) if isinstance(raw_authority, dict) else {}
            authority["freshness"] = "unknown"
            authority["freshness_evaluation"] = dict(_EVALUATION)
            connection.execute(
                reports.update().where(reports.c.id == report_id).values(authority=authority)
            )


def downgrade() -> None:
    """Remove only this migration's marker; never recreate fabricated CURRENT."""
    if context.is_offline_mode():
        _offline_downgrade()
        return
    reports = sa.table(
        "report_versions",
        sa.column("id", sa.String()),
        sa.column("authority", sa.JSON()),
    )
    connection = op.get_bind()
    result = connection.execute(sa.select(reports.c.id, reports.c.authority).order_by(reports.c.id))
    while True:
        rows = result.fetchmany(500)
        if not rows:
            break
        for report_id, raw_authority in rows:
            if not isinstance(raw_authority, dict):
                continue
            evaluation = raw_authority.get("freshness_evaluation")
            if not isinstance(evaluation, dict) or evaluation.get("reason") != _LEGACY_REASON:
                continue
            authority = dict(raw_authority)
            authority.pop("freshness_evaluation", None)
            authority["freshness"] = "unknown"
            connection.execute(
                reports.update().where(reports.c.id == report_id).values(authority=authority)
            )
