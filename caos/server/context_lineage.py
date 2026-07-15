"""Shared, transaction-bound helpers for analysis-context artifact lineage."""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from analysis_contracts import ArtifactRef
from database import AnalysisContextRecord


LEGACY_REF_FIELDS: dict[str, str] = {
    "issuer_run_id": "issuer_run",
    "source_manifest_id": "source_manifest",
    "research_job_id": "research_job",
    "model_checkpoint_id": "model_checkpoint",
    "report_version_id": "report_version",
    "alert_event_id": "alert_event",
    "sponsor_id": "sponsor",
    "portfolio_id": "portfolio",
    "decision_id": "decision",
    "insight_id": "insight",
}


def _ref_key(ref: ArtifactRef) -> tuple[str, str, str]:
    return ref.kind, ref.id, ref.version or ""


def merge_artifact_refs(
    artifacts: Optional[Mapping[str, object]],
    refs: Iterable[ArtifactRef],
    *,
    legacy_updates: Optional[Mapping[str, Optional[str]]] = None,
) -> dict:
    """Merge typed refs without dropping legacy, surface, or extension fields.

    The serialized ordering is canonical, making retries and producers that
    complete in a different order converge on the same JSON value.
    """
    merged = dict(artifacts or {})
    had_typed_refs = "artifact_refs" in merged
    by_key: dict[tuple[str, str, str], ArtifactRef] = {}
    for raw in merged.get("artifact_refs", []) or []:
        ref = ArtifactRef.model_validate(raw)
        by_key[_ref_key(ref)] = ref
    for raw in refs:
        ref = ArtifactRef.model_validate(raw)
        by_key[_ref_key(ref)] = ref
    if by_key or had_typed_refs:
        merged["artifact_refs"] = [
            ref.model_dump(mode="json") for _, ref in sorted(by_key.items())
        ]
    else:
        # Preserve the scalar-only v1 JSON shape for compatibility patches
        # made while lineage v2 is disabled or before a context has typed refs.
        merged.pop("artifact_refs", None)
    for field, value in (legacy_updates or {}).items():
        if field not in LEGACY_REF_FIELDS:
            raise ValueError(f"unsupported legacy artifact field: {field}")
        merged[field] = value
    return merged


def typed_refs_from_artifacts(
    artifacts: Optional[Mapping[str, object]], *, convert_legacy: bool = False
) -> list[ArtifactRef]:
    """Return exact typed refs, optionally adapting supported legacy scalars."""
    refs = [
        ArtifactRef.model_validate(raw)
        for raw in ((artifacts or {}).get("artifact_refs", []) or [])
    ]
    if convert_legacy:
        existing = {(ref.kind, ref.id) for ref in refs}
        for field, kind in LEGACY_REF_FIELDS.items():
            value = (artifacts or {}).get(field)
            if isinstance(value, str) and value and (kind, value) not in existing:
                refs.append(ArtifactRef(kind=kind, id=value))
    return sorted({_ref_key(ref): ref for ref in refs}.values(), key=_ref_key)


async def bind_context_artifacts(
    db: AsyncSession,
    *,
    context_id: str,
    analyst_id: str,
    refs: Iterable[ArtifactRef],
    legacy_updates: Optional[Mapping[str, Optional[str]]] = None,
) -> AnalysisContextRecord:
    """Lock, refresh, merge and flush an owned context in the caller transaction."""
    context = (await db.execute(
        select(AnalysisContextRecord).where(
            AnalysisContextRecord.id == context_id,
            AnalysisContextRecord.analyst_id == analyst_id,
        ).with_for_update().execution_options(populate_existing=True)
    )).scalar_one_or_none()
    if context is None:
        raise LookupError("analysis context not found")
    context.artifacts = merge_artifact_refs(
        context.artifacts, refs, legacy_updates=legacy_updates
    )
    context.updated_at = datetime.now(timezone.utc)
    await db.flush()
    return context
