import hashlib

import pytest
from sqlalchemy import delete

from analysis_contracts import ArtifactRef
from database import AsyncSessionLocal, Document, DocumentChunk, SourceManifest
from engine.fixtures import REFERENCE_ISSUER_ID
from retrieval import build_issuer_index, rank_with_index, retrieve_corpus
from run_inputs import snapshot_run_inputs


@pytest.mark.asyncio
async def test_context_snapshot_is_approved_and_excludes_later_or_unreferenced_documents(seeded_db):
    analyst_id = "snapshot-analyst"
    async with AsyncSessionLocal() as db:
        selected = Document(
            issuer_id=REFERENCE_ISSUER_ID,
            analyst_id=analyst_id,
            doc_type="Document",
            file_name="selected.pdf",
            storage_key="test/selected.pdf",
            uploaded_by=analyst_id,
            chunk_count=1,
        )
        unselected = Document(
            issuer_id=REFERENCE_ISSUER_ID,
            analyst_id=analyst_id,
            doc_type="Document",
            file_name="later.pdf",
            storage_key="test/later.pdf",
            uploaded_by=analyst_id,
            chunk_count=1,
        )
        db.add_all([selected, unselected])
        await db.flush()
        db.add_all([
            DocumentChunk(document_id=selected.id, seq=0, text="selected covenant evidence"),
            DocumentChunk(document_id=unselected.id, seq=0, text="later unrelated upload"),
        ])
        manifest = SourceManifest(
            analyst_id=analyst_id,
            issuer_id=REFERENCE_ISSUER_ID,
            origin="live",
            method="reported",
            status="ready",
            files=[{
                "document_id": selected.id,
                "sha256": hashlib.sha256(b"selected").hexdigest(),
                "malware_scan": "clean",
            }],
            authority={"approval_state": "ratified"},
        )
        db.add(manifest)
        await db.flush()
        selected_id, unselected_id, manifest_id = selected.id, unselected.id, manifest.id
        await db.commit()

        try:
            snapshot = await snapshot_run_inputs(
                db,
                issuer_id=REFERENCE_ISSUER_ID,
                analyst_id=analyst_id,
                input_refs=[ArtifactRef(kind="source_manifest", id=manifest_id)],
            )
            assert snapshot.document_ids == [selected_id]
            assert snapshot.manifest_ids == [manifest_id]
            assert snapshot.state == "approved"
            assert len(snapshot.corpus_sha256) == 64

            index = await build_issuer_index(
                db, REFERENCE_ISSUER_ID, document_ids=snapshot.document_ids
            )
            assert rank_with_index(index, "selected covenant")
            assert rank_with_index(index, "later unrelated") == []
        finally:
            await db.execute(delete(DocumentChunk).where(
                DocumentChunk.document_id.in_([selected_id, unselected_id])
            ))
            await db.execute(delete(SourceManifest).where(SourceManifest.id == manifest_id))
            await db.execute(delete(Document).where(Document.id.in_([selected_id, unselected_id])))
            await db.commit()


@pytest.mark.asyncio
async def test_draft_manifest_snapshot_fails_closed(seeded_db):
    analyst_id = "snapshot-draft-analyst"
    async with AsyncSessionLocal() as db:
        document = Document(
            issuer_id=REFERENCE_ISSUER_ID,
            analyst_id=analyst_id,
            doc_type="Document",
            file_name="draft.pdf",
            storage_key="test/draft.pdf",
            uploaded_by=analyst_id,
            chunk_count=0,
        )
        db.add(document)
        await db.flush()
        manifest = SourceManifest(
            analyst_id=analyst_id,
            issuer_id=REFERENCE_ISSUER_ID,
            origin="live",
            method="reported",
            status="ready",
            files=[{
                "document_id": document.id,
                "sha256": "a" * 64,
                "malware_scan": "clean",
            }],
            authority={"approval_state": "draft"},
        )
        db.add(manifest)
        await db.flush()
        document_id, manifest_id = document.id, manifest.id
        await db.commit()

        try:
            snapshot = await snapshot_run_inputs(
                db,
                issuer_id=REFERENCE_ISSUER_ID,
                analyst_id=analyst_id,
                input_refs=[ArtifactRef(kind="source_manifest", id=manifest_id)],
            )
            assert snapshot.document_ids == [document_id]
            assert snapshot.state == "unapproved"
        finally:
            await db.execute(delete(SourceManifest).where(SourceManifest.id == manifest_id))
            await db.execute(delete(Document).where(Document.id == document_id))
            await db.commit()


@pytest.mark.asyncio
async def test_withdrawn_document_is_excluded_from_future_runs_and_retrieval(seeded_db):
    analyst_id = "withdrawal-analyst"
    async with AsyncSessionLocal() as db:
        document = Document(
            issuer_id=REFERENCE_ISSUER_ID,
            analyst_id=analyst_id,
            doc_type="Document",
            file_name="withdrawn.pdf",
            storage_key="test/withdrawn.pdf",
            uploaded_by=analyst_id,
            chunk_count=1,
            status="withdrawn",
        )
        db.add(document)
        await db.flush()
        db.add(DocumentChunk(
            document_id=document.id,
            seq=0,
            text="withdrawn secret covenant evidence",
        ))
        await db.commit()
        document_id = document.id

        try:
            index = await build_issuer_index(
                db, REFERENCE_ISSUER_ID, document_ids=[document_id]
            )
            assert rank_with_index(index, "withdrawn secret covenant") == []
            snapshot = await snapshot_run_inputs(
                db,
                issuer_id=REFERENCE_ISSUER_ID,
                analyst_id=analyst_id,
                input_refs=None,
            )
            assert document_id not in snapshot.document_ids
        finally:
            await db.execute(delete(DocumentChunk).where(
                DocumentChunk.document_id == document_id
            ))
            await db.execute(delete(Document).where(Document.id == document_id))
            await db.commit()


@pytest.mark.asyncio
async def test_cross_corpus_retrieval_never_reads_another_analysts_private_document(seeded_db):
    async with AsyncSessionLocal() as db:
        documents = [
            Document(
                issuer_id=REFERENCE_ISSUER_ID,
                analyst_id=owner,
                doc_type="Document",
                file_name=name,
                storage_key=f"test/{name}",
                uploaded_by=owner,
                chunk_count=1,
            )
            for owner, name in [
                (None, "institutional.pdf"),
                ("analyst-a", "analyst-a.pdf"),
                ("analyst-b", "analyst-b.pdf"),
            ]
        ]
        db.add_all(documents)
        await db.flush()
        for document in documents:
            db.add(DocumentChunk(
                document_id=document.id,
                seq=0,
                text=f"isolationmarker evidence in {document.file_name}",
            ))
        await db.commit()
        document_ids = [document.id for document in documents]

        try:
            analyst_a_hits = await retrieve_corpus(
                db, "isolationmarker", analyst_id="analyst-a", rerank=False
            )
            assert {hit.doc for hit in analyst_a_hits} == {
                "institutional.pdf",
                "analyst-a.pdf",
            }

            institutional_hits = await retrieve_corpus(
                db, "isolationmarker", rerank=False
            )
            assert {hit.doc for hit in institutional_hits} == {"institutional.pdf"}
        finally:
            await db.execute(delete(DocumentChunk).where(
                DocumentChunk.document_id.in_(document_ids)
            ))
            await db.execute(delete(Document).where(Document.id.in_(document_ids)))
            await db.commit()
