"""Immutable, authority-aware document snapshots for issuer runs."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from typing import Optional, Sequence

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from analysis_contracts import ArtifactRef
from database import Document, SourceManifest


_APPROVED_STATES = frozenset({"ratified", "published"})


@dataclass(frozen=True)
class RunInputSnapshot:
    document_ids: list[str]
    manifest_ids: list[str]
    corpus_sha256: str
    state: str


def _manifest_files(manifest: SourceManifest) -> list[dict]:
    return [item for item in (manifest.files or []) if isinstance(item, dict)]


def manifest_is_approved(manifest: SourceManifest) -> bool:
    authority = manifest.authority if isinstance(manifest.authority, dict) else {}
    files = _manifest_files(manifest)
    return (
        manifest.status == "ready"
        and authority.get("approval_state") in _APPROVED_STATES
        and bool(files)
        and all(item.get("malware_scan") == "clean" for item in files)
    )


async def snapshot_run_inputs(
    db: AsyncSession,
    *,
    issuer_id: str,
    analyst_id: str,
    input_refs: Optional[Sequence[ArtifactRef]],
) -> RunInputSnapshot:
    """Resolve and hash the exact corpus visible at run creation.

    ``input_refs=None`` snapshots the issuer's current non-memo corpus. A concrete
    sequence (including an empty sequence) is authoritative context scope. Every
    referenced artifact is ownership- and issuer-checked before it can enter the
    run. Approval is fail-closed: all selected documents must be covered by only
    ready, analyst-ratified/published manifests.
    """
    requested_documents = {
        ref.id for ref in (input_refs or ()) if ref.kind == "document"
    }
    requested_manifests = {
        ref.id for ref in (input_refs or ()) if ref.kind == "source_manifest"
    }
    manifests: list[SourceManifest] = []

    manifest_stmt = select(SourceManifest).where(
        SourceManifest.issuer_id == issuer_id,
        SourceManifest.analyst_id == analyst_id,
    )
    if input_refs is not None:
        if requested_manifests:
            manifest_stmt = manifest_stmt.where(SourceManifest.id.in_(requested_manifests))
    if input_refs is None or requested_manifests:
        manifests = list((await db.execute(manifest_stmt)).scalars().all())
    if input_refs is not None and {row.id for row in manifests} != requested_manifests:
        raise LookupError("analysis context contains an unavailable source manifest")

    for manifest in manifests:
        requested_documents.update(
            str(item["document_id"])
            for item in _manifest_files(manifest)
            if isinstance(item.get("document_id"), str) and item.get("document_id")
        )

    document_stmt = select(Document).where(
        Document.issuer_id == issuer_id,
        Document.doc_type != "analyst-memo",
        Document.status == "active",
        or_(Document.analyst_id == analyst_id, Document.analyst_id.is_(None)),
    )
    if input_refs is not None:
        if requested_documents:
            document_stmt = document_stmt.where(Document.id.in_(requested_documents))
        else:
            documents: list[Document] = []
    if input_refs is None or requested_documents:
        documents = list((await db.execute(document_stmt)).scalars().all())
    document_ids = sorted(row.id for row in documents)
    if input_refs is not None and set(document_ids) != requested_documents:
        raise LookupError("analysis context contains an unavailable issuer document")

    selected_document_ids = set(document_ids)
    if input_refs is None:
        # Only manifests that actually cover the default corpus belong in the
        # snapshot; unrelated/empty historical manifests cannot poison approval.
        manifests = [
            manifest for manifest in manifests
            if any(item.get("document_id") in selected_document_ids for item in _manifest_files(manifest))
        ]
    manifest_ids = sorted(manifest.id for manifest in manifests)

    covered_by_approved: set[str] = set()
    digest_entries: list[dict[str, object]] = []
    all_manifests_approved = bool(manifests)
    for manifest in sorted(manifests, key=lambda item: item.id):
        approved = manifest_is_approved(manifest)
        all_manifests_approved = all_manifests_approved and approved
        for item in sorted(_manifest_files(manifest), key=lambda value: str(value.get("document_id", ""))):
            document_id = item.get("document_id")
            if document_id not in selected_document_ids:
                continue
            if approved:
                covered_by_approved.add(str(document_id))
            digest_entries.append({
                "document_id": document_id,
                "manifest_id": manifest.id,
                "sha256": item.get("sha256"),
            })
    # Preserve the identity of a selected document even when its authority
    # record is absent; that absence must change the digest and state.
    represented = {str(item["document_id"]) for item in digest_entries}
    digest_entries.extend(
        {"document_id": document_id, "manifest_id": None, "sha256": None}
        for document_id in document_ids if document_id not in represented
    )
    canonical = json.dumps(digest_entries, sort_keys=True, separators=(",", ":"))
    state = (
        "empty" if not document_ids
        else "approved"
        if all_manifests_approved and covered_by_approved == selected_document_ids
        else "unapproved"
    )
    return RunInputSnapshot(
        document_ids=document_ids,
        manifest_ids=manifest_ids,
        corpus_sha256=hashlib.sha256(canonical.encode("utf-8")).hexdigest(),
        state=state,
    )
