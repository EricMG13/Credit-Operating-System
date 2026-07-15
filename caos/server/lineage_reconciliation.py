"""Restartable, non-destructive reconciliation for analyst-owned lineage v2."""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from analysis_contracts import ArtifactRef
from context_lineage import (
    bind_context_artifacts, typed_refs_from_artifacts,
)
from database import (
    AlertEvent, Analyst, AnalysisContextRecord, AnalysisInsight, Decision, Document,
    DocumentChunk, Issuer, LineageEdge, MarketInstrument, MarketSnapshot,
    ModelCheckpoint, Portfolio, ReportVersion, ResearchJob, Run, SourceManifest,
)
from identity import CallerIdentity
from lineage_service import (
    canonical_artifact_id, lineage_idempotency_key, write_lineage_edge,
)
from tenancy import issuer_visible, portfolio_visible, tenancy_enabled

ReconciliationMode = Literal["dry-run", "apply", "verify"]


class ReconciliationResult(BaseModel):
    mode: ReconciliationMode
    scanned_contexts: int = 0
    proposed_edges: int = 0
    applied_edges: int = 0
    existing_edges: int = 0
    typed_refs: int = 0
    proposed_typed_refs: int = 0
    applied_typed_refs: int = 0
    existing_typed_refs: int = 0
    dangling_refs: int = 0
    unauthorized_refs: int = 0
    integrity_failures: int = 0
    malformed_edges: int = 0
    unresolved_historical_relationships: int = 0
    next_cursor: Optional[str] = None


def _owner_identity(analyst: Analyst) -> CallerIdentity:
    return CallerIdentity(
        id=analyst.id,
        email=analyst.email or f"{analyst.id}@persisted.local",
        full_name=analyst.name,
        role=analyst.role,
        source="profile",
        team_id=analyst.team_id,
    )


def _fallback_owner_identity(owner_id: str) -> CallerIdentity:
    """Bounded identity for a persisted proxy/local owner when tenancy is off."""
    label = owner_id[:120] or "unknown-owner"
    return CallerIdentity(
        id=owner_id[:255],
        email=f"{label[:200]}@persisted.local",
        full_name=label,
        role="analyst",
        source="local",
        team_id=None,
    )


async def _ref_status(
    db: AsyncSession,
    context: AnalysisContextRecord,
    caller: CallerIdentity,
    ref: ArtifactRef,
) -> Literal["ok", "dangling", "unauthorized"]:
    """Classify a ref without exposing the underlying row to a caller."""
    row = None
    if ref.kind == "issuer_run":
        row = await db.get(Run, ref.id)
        if row is None:
            return "dangling"
        issuer = await db.get(Issuer, row.issuer_id)
        return "ok" if (
            row.analyst_id == caller.id and issuer_visible(caller, issuer)
            and row.issuer_id in (context.issuer_ids or [])
        ) else "unauthorized"
    if ref.kind == "source_manifest":
        row = await db.get(SourceManifest, ref.id)
        if row is None:
            return "dangling"
        if row.issuer_id is None:
            return "ok" if row.analyst_id == caller.id else "unauthorized"
        issuer = await db.get(Issuer, row.issuer_id)
        return "ok" if (
            row.analyst_id == caller.id and issuer_visible(caller, issuer)
            and row.issuer_id in (context.issuer_ids or [])
        ) else "unauthorized"
    if ref.kind == "document":
        row = await db.get(Document, ref.id)
        if row is None:
            return "dangling"
        if row.issuer_id is None:
            return "ok" if row.analyst_id == caller.id else "unauthorized"
        issuer = await db.get(Issuer, row.issuer_id)
        return "ok" if (
            issuer_visible(caller, issuer) and row.issuer_id in (context.issuer_ids or [])
        ) else "unauthorized"
    if ref.kind == "model_checkpoint":
        row = await db.get(ModelCheckpoint, ref.id)
        if row is None:
            return "dangling"
        if row.analyst_id != caller.id or row.context_id != context.id:
            return "unauthorized"
        return "dangling" if ref.version and ref.version != row.payload_hash else "ok"
    if ref.kind == "report_version":
        row = await db.get(ReportVersion, ref.id)
        if row is None:
            return "dangling"
        if row.analyst_id != caller.id or row.context_id != context.id:
            return "unauthorized"
        return "dangling" if ref.version and ref.version != row.document_sha256 else "ok"
    if ref.kind == "insight":
        row = await db.get(AnalysisInsight, ref.id)
        if row is None:
            return "dangling"
        if row.analyst_id != caller.id or row.context_id != context.id:
            return "unauthorized"
        return "dangling" if ref.version and ref.version != str(row.version) else "ok"
    if ref.kind == "research_job":
        row = await db.get(ResearchJob, ref.id)
        if row is None:
            return "dangling"
        return "ok" if (
            row.analyst_id == caller.id
            and (row.context_id is None or row.context_id == context.id)
        ) else "unauthorized"
    if ref.kind == "alert_event":
        row = await db.get(AlertEvent, ref.id)
        if row is None:
            return "dangling"
        if row.context_id and row.context_id != context.id:
            return "unauthorized"
        if row.issuer_id:
            issuer = await db.get(Issuer, row.issuer_id)
            return "ok" if issuer_visible(caller, issuer) else "unauthorized"
        return "ok" if row.created_by == caller.id else "unauthorized"
    if ref.kind == "portfolio":
        row = await db.get(Portfolio, ref.id)
        if row is None:
            return "dangling"
        return "ok" if portfolio_visible(caller, row) else "unauthorized"
    if ref.kind == "market_snapshot":
        row = await db.get(MarketSnapshot, ref.id)
        if row is None:
            return "dangling"
        if row.analyst_id is not None:
            return "ok" if row.analyst_id == caller.id else "unauthorized"
        # NULL ownership is the compatibility state for snapshots that existed
        # before analyst-owned market imports.  Preserve their prior visibility
        # and enforce issuer/team scope when tenancy is enabled.
        if not tenancy_enabled():
            return "ok"
        issuer_ids = list((await db.execute(select(MarketInstrument.issuer_id).where(
            MarketInstrument.snapshot_id == ref.id
        ))).scalars().all())
        if not issuer_ids or any(value is None for value in issuer_ids):
            return "unauthorized"
        for issuer_id in set(issuer_ids):
            issuer = await db.get(Issuer, issuer_id)
            if not issuer_visible(caller, issuer) or issuer_id not in (context.issuer_ids or []):
                return "unauthorized"
        return "ok"
    if ref.kind == "document_chunk":
        row = await db.get(DocumentChunk, ref.id)
        document = await db.get(Document, row.document_id) if row is not None else None
        if document is None:
            return "dangling"
        issuer = await db.get(Issuer, document.issuer_id)
        return "ok" if (
            issuer_visible(caller, issuer)
            and document.issuer_id in (context.issuer_ids or [])
        ) else "unauthorized"
    if ref.kind == "decision":
        row = await db.get(Decision, ref.id)
        if row is None:
            return "dangling"
        issuer = await db.get(Issuer, row.issuer_id)
        return "ok" if issuer_visible(caller, issuer) else "unauthorized"
    if ref.kind == "sponsor":
        issuers = (await db.execute(select(Issuer).where(
            Issuer.sponsor == ref.id
        ))).scalars().all()
        if not issuers:
            return "dangling"
        return "ok" if any(
            issuer.id in (context.issuer_ids or []) and issuer_visible(caller, issuer)
            for issuer in issuers
        ) else "unauthorized"
    return "dangling"


async def _edge_exists(
    db: AsyncSession,
    *,
    context: AnalysisContextRecord,
    artifact: ArtifactRef,
    parent: ArtifactRef,
    transform: str,
) -> bool:
    return (await db.execute(select(LineageEdge.id).where(
        LineageEdge.context_id == context.id,
        LineageEdge.analyst_id == context.analyst_id,
        LineageEdge.artifact_id == canonical_artifact_id(artifact),
        LineageEdge.parent_id == canonical_artifact_id(parent),
        LineageEdge.artifact_version == artifact.version,
        LineageEdge.parent_version == parent.version,
        LineageEdge.transform == transform,
        LineageEdge.transform_version == "2",
    ).limit(1))).scalar_one_or_none() is not None


async def reconcile_lineage(
    db: AsyncSession,
    *,
    mode: ReconciliationMode,
    limit: int = 100,
    cursor: Optional[str] = None,
) -> ReconciliationResult:
    """Reconcile a stable page of contexts; apply commits once per context."""
    if mode not in {"dry-run", "apply", "verify"}:
        raise ValueError("mode must be dry-run, apply, or verify")
    if limit < 1 or limit > 1000:
        raise ValueError("limit must be between 1 and 1000")
    result = ReconciliationResult(mode=mode)
    stmt = (
        select(AnalysisContextRecord)
        .order_by(AnalysisContextRecord.id)
        .limit(limit + 1)
    )
    if cursor:
        stmt = stmt.where(AnalysisContextRecord.id > cursor)
    rows = list((await db.execute(stmt)).scalars().all())
    page = rows[:limit]
    if len(rows) > limit and page:
        result.next_cursor = page[-1].id

    for context in page:
        result.scanned_contexts += 1
        analyst = await db.get(Analyst, context.analyst_id)
        missing_owner = analyst is None
        caller = (
            _owner_identity(analyst)
            if analyst is not None
            else _fallback_owner_identity(context.analyst_id)
        )
        context_authorized = True
        if missing_owner and tenancy_enabled():
            result.unauthorized_refs += 1
            result.integrity_failures += 1
            context_authorized = False
        for issuer_id in dict.fromkeys(context.issuer_ids or []):
            if not issuer_visible(caller, await db.get(Issuer, issuer_id)):
                result.unauthorized_refs += 1
                context_authorized = False
        if context.portfolio_scope and not portfolio_visible(
            caller, await db.get(Portfolio, context.portfolio_scope)
        ):
            result.unauthorized_refs += 1
            context_authorized = False

        refs: dict[tuple[str, str, str], ArtifactRef] = {}
        edges: dict[tuple, tuple[ArtifactRef, ArtifactRef, str]] = {}

        def add_ref(ref: ArtifactRef) -> None:
            refs[(ref.kind, ref.id, ref.version or "")] = ref

        def add_edge(artifact: ArtifactRef, parent: ArtifactRef, transform: str) -> None:
            add_ref(artifact)
            add_ref(parent)
            edges[(
                artifact.kind, artifact.id, artifact.version,
                parent.kind, parent.id, parent.version, transform,
            )] = (artifact, parent, transform)

        # Verify every persisted v2 row in scope, including manually inserted or
        # partially migrated rows that are not reconstructable as a proposal.
        persisted_edges = (await db.execute(select(LineageEdge).where(
            LineageEdge.context_id == context.id,
            LineageEdge.v2_idempotency_key.is_not(None),
        ))).scalars().all()
        for edge in persisted_edges:
            if edge.analyst_id != context.analyst_id:
                result.unauthorized_refs += 1
            try:
                artifact_prefix, artifact_separator, artifact_suffix = edge.artifact_id.partition(":")
                parent_prefix, parent_separator, parent_suffix = edge.parent_id.partition(":")
                if (
                    artifact_separator != ":"
                    or parent_separator != ":"
                    or artifact_prefix != edge.artifact_kind
                    or parent_prefix != edge.parent_kind
                ):
                    raise ValueError("canonical prefix mismatch")
                edge_refs = (
                    ArtifactRef(
                        kind=edge.artifact_kind,
                        id=artifact_suffix,
                        version=edge.artifact_version,
                    ),
                    ArtifactRef(
                        kind=edge.parent_kind,
                        id=parent_suffix,
                        version=edge.parent_version,
                    ),
                )
                if (
                    edge.artifact_id != canonical_artifact_id(edge_refs[0])
                    or edge.parent_id != canonical_artifact_id(edge_refs[1])
                    or edge.v2_idempotency_key != lineage_idempotency_key(
                        context_id=context.id,
                        analyst_id=edge.analyst_id or "",
                        artifact=edge_refs[0],
                        parent=edge_refs[1],
                        transform=edge.transform,
                        transform_version=edge.transform_version,
                    )
                ):
                    raise ValueError("v2 edge integrity mismatch")
            except (IndexError, ValueError):
                result.malformed_edges += 1
                result.integrity_failures += 1
                continue
            for edge_ref in edge_refs:
                edge_status = await _ref_status(db, context, caller, edge_ref)
                if edge_status == "dangling":
                    result.dangling_refs += 1
                elif edge_status == "unauthorized":
                    result.unauthorized_refs += 1

        # Preserve every explicitly bound version. Legacy scalar adaptation is
        # delayed until producer rows have supplied any exact version for the
        # same kind/id, avoiding a redundant unversioned sibling.
        for ref in typed_refs_from_artifacts(context.artifacts):
            add_ref(ref)

        manifest_ids = {
            ref.id for ref in refs.values() if ref.kind == "source_manifest"
        }
        scalar_manifest_id = (context.artifacts or {}).get("source_manifest_id")
        if isinstance(scalar_manifest_id, str) and scalar_manifest_id:
            manifest_ids.add(scalar_manifest_id)
        for manifest_id in sorted(manifest_ids):
            manifest = await db.get(SourceManifest, manifest_id)
            if manifest is None:
                continue
            manifest_ref = ArtifactRef(kind="source_manifest", id=manifest.id)
            for entry in manifest.files or []:
                document_id = entry.get("document_id") if isinstance(entry, dict) else None
                if not isinstance(document_id, str) or not document_id:
                    result.unresolved_historical_relationships += 1
                    continue
                add_edge(
                    manifest_ref,
                    ArtifactRef(kind="document", id=document_id),
                    "ingestion",
                )

        checkpoints = (await db.execute(select(ModelCheckpoint).where(
            ModelCheckpoint.context_id == context.id
        ).order_by(ModelCheckpoint.id))).scalars().all()
        for checkpoint in checkpoints:
            checkpoint_ref = ArtifactRef(
                kind="model_checkpoint", id=checkpoint.id, version=checkpoint.payload_hash
            )
            add_ref(checkpoint_ref)
            if checkpoint.issuer_run_id:
                add_edge(
                    checkpoint_ref,
                    ArtifactRef(kind="issuer_run", id=checkpoint.issuer_run_id),
                    "model-checkpoint",
                )
            if checkpoint.parent_checkpoint_id:
                parent = await db.get(ModelCheckpoint, checkpoint.parent_checkpoint_id)
                parent_ref = ArtifactRef(
                    kind="model_checkpoint",
                    id=checkpoint.parent_checkpoint_id,
                    version=parent.payload_hash if parent is not None else None,
                )
                add_edge(checkpoint_ref, parent_ref, "model-checkpoint")

        reports = (await db.execute(select(ReportVersion).where(
            ReportVersion.context_id == context.id
        ).order_by(ReportVersion.id))).scalars().all()
        for report in reports:
            report_ref = ArtifactRef(
                kind="report_version", id=report.id, version=report.document_sha256
            )
            add_edge(report_ref, ArtifactRef(kind="issuer_run", id=report.run_id), "report-publication")
            checkpoint = await db.get(ModelCheckpoint, report.model_checkpoint_id)
            add_edge(report_ref, ArtifactRef(
                kind="model_checkpoint",
                id=report.model_checkpoint_id,
                version=checkpoint.payload_hash if checkpoint is not None else None,
            ), "report-publication")
            manifest_id = (report.payload or {}).get("source_manifest_id")
            if isinstance(manifest_id, str) and manifest_id:
                add_edge(
                    report_ref,
                    ArtifactRef(kind="source_manifest", id=manifest_id),
                    "report-publication",
                )
            else:
                result.unresolved_historical_relationships += 1

        insights = (await db.execute(select(AnalysisInsight).where(
            AnalysisInsight.context_id == context.id
        ).order_by(AnalysisInsight.id))).scalars().all()
        for insight in insights:
            insight_ref = ArtifactRef(kind="insight", id=insight.id, version=str(insight.version))
            subjects = typed_refs_from_artifacts(insight.subject_refs, convert_legacy=True)
            if not subjects:
                result.unresolved_historical_relationships += 1
            for subject in subjects:
                add_edge(insight_ref, subject, "insight-generation")

        # Supported legacy scalars prove context association only. Add their
        # unversioned adapter iff no explicit/authoritative version is bound.
        for legacy_ref in typed_refs_from_artifacts(
            context.artifacts, convert_legacy=True
        ):
            if not any(
                ref.kind == legacy_ref.kind and ref.id == legacy_ref.id
                for ref in refs.values()
            ):
                add_ref(legacy_ref)

        # A historical run row proves the run belongs to the context, but no FK
        # records which of today's context inputs existed at its creation time.
        # Surface that uncertainty rather than manufacturing run-input edges.
        for run_ref in [ref for ref in refs.values() if ref.kind == "issuer_run"]:
            captured = (await db.execute(select(LineageEdge.id).where(
                LineageEdge.context_id == context.id,
                LineageEdge.artifact_id == canonical_artifact_id(run_ref),
                LineageEdge.transform == "run-creation",
                LineageEdge.v2_idempotency_key.is_not(None),
            ).limit(1))).scalar_one_or_none()
            if captured is None:
                result.unresolved_historical_relationships += 1

        existing_ref_keys = {
            (ref.kind, ref.id, ref.version or "")
            for ref in typed_refs_from_artifacts(context.artifacts)
        }
        valid_refs: list[ArtifactRef] = []
        for key, ref in sorted(refs.items()):
            ref_status = await _ref_status(db, context, caller, ref)
            if ref_status == "dangling":
                result.dangling_refs += 1
                continue
            if ref_status == "unauthorized" or not context_authorized:
                result.unauthorized_refs += 1
                continue
            valid_refs.append(ref)
            result.typed_refs += 1
            if key in existing_ref_keys:
                result.existing_typed_refs += 1
            else:
                result.proposed_typed_refs += 1

        for artifact, parent, transform in edges.values():
            if artifact not in valid_refs or parent not in valid_refs:
                continue
            if await _edge_exists(
                db, context=context, artifact=artifact, parent=parent, transform=transform
            ):
                result.existing_edges += 1
                continue
            result.proposed_edges += 1
            if mode == "apply":
                await write_lineage_edge(
                    db,
                    context_id=context.id,
                    analyst_id=context.analyst_id,
                    artifact=artifact,
                    parent=parent,
                    transform=transform,
                    transform_version="2",
                    enabled=True,
                )
                result.applied_edges += 1

        if mode == "apply" and valid_refs:
            before = set(existing_ref_keys)
            await bind_context_artifacts(
                db,
                context_id=context.id,
                analyst_id=context.analyst_id,
                refs=valid_refs,
            )
            result.applied_typed_refs += len({
                (ref.kind, ref.id, ref.version or "") for ref in valid_refs
            } - before)
            await db.commit()

    if mode != "apply":
        await db.rollback()
    return result


def verify_exit_code(result: ReconciliationResult) -> int:
    return 1 if (
        result.dangling_refs
        or result.unauthorized_refs
        or result.integrity_failures
        or result.malformed_edges
    ) else 0
