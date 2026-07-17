"""IC Book agenda, atomic finalization, and decision-book contracts."""

from __future__ import annotations

import asyncio
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta, timezone

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient


def _identity(
    caller_id: str, *, role: str = "analyst", team_id: str | None = None
):
    from identity import CallerIdentity

    return lambda: CallerIdentity(
        id=caller_id,
        email=f"{caller_id}@firm.test",
        full_name=caller_id,
        role=role,
        source="profile",
        team_id=team_id,
    )


@pytest.fixture(scope="module")
def ic_client():
    from main import app

    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()


def _seed_ready(
    prefix: str,
    *,
    team_id: str | None = None,
    committee_status: str = "Committee Ready",
    analyst_id: str | None = None,
) -> tuple[str, str, str]:
    from database import AnalystOpinionVersion, AsyncSessionLocal, Issuer, Portfolio, Run

    async def seed():
        async with AsyncSessionLocal() as db:
            issuer = Issuer(id=f"{prefix}-issuer", name=f"{prefix} Co", team_id=team_id)
            portfolio = Portfolio(
                id=f"{prefix}-portfolio", name=f"{prefix} Book", team_id=team_id
            )
            owner_id = analyst_id or f"{prefix}-owner"
            run = Run(
                id=f"{prefix}-run",
                issuer_id=issuer.id,
                portfolio_id=portfolio.id,
                status="complete",
                qa_status="Passed",
                committee_status=committee_status,
                analyst_id=owner_id,
                completed_at=datetime.now(timezone.utc),
            )
            opinion = AnalystOpinionVersion(
                id=f"{prefix}-opinion",
                issuer_id=issuer.id,
                analyst_id=owner_id,
                version=1,
                stance="NEUTRAL",
                rationale_md="Fixture analyst view.",
                evidence_state="supported",
                unresolved_items=[],
                analyst_link_ids=[],
            )
            db.add_all([issuer, portfolio, run, opinion])
            await db.commit()
            return issuer.id, portfolio.id, run.id

    return asyncio.run(seed())


def _agenda_payload(
    issuer_id: str,
    run_id: str | None = None,
    portfolio_id: str | None = None,
    *,
    agenda_status: str = "draft",
) -> dict:
    return {
        "issuer_id": issuer_id,
        "portfolio_id": portfolio_id,
        "scheduled_for": "2026-08-01T09:00:00Z",
        "recommendation": "approve",
        "conviction": 72,
        "thesis": "Liquidity and deleveraging support the proposed exposure.",
        "conditions": [" Monthly liquidity update ", ""],
        "expiry": "2026-12-31",
        "run_id": run_id,
        "status": agenda_status,
    }


def test_agenda_create_owner_protection_patch_and_filters(ic_client):
    from identity import get_identity
    from main import app

    issuer_id, portfolio_id, run_id = _seed_ready("ic-create")
    app.dependency_overrides[get_identity] = _identity("ic-create-owner")
    created = ic_client.post(
        "/api/committee/agenda",
        json={
            **_agenda_payload(issuer_id, run_id, portfolio_id),
            "owner_id": "spoofed-owner",
        },
    )
    assert created.status_code == 201, created.text
    item = created.json()
    assert item["owner_id"] == "ic-create-owner"
    assert item["conditions"] == ["Monthly liquidity update"]
    assert item["readiness_failures"] == []

    app.dependency_overrides[get_identity] = _identity("ic-create-other")
    assert ic_client.patch(
        f"/api/committee/agenda/{item['id']}",
        json={"expected_revision": 1, "thesis": "Unauthorized edit"},
    ).status_code == 403
    assert ic_client.post(
        f"/api/committee/agenda/{item['id']}/finalize",
        json={"expected_revision": 1},
    ).status_code == 403
    app.dependency_overrides[get_identity] = _identity("ic-create-owner")

    conflict = ic_client.patch(
        f"/api/committee/agenda/{item['id']}",
        json={"expected_revision": 99, "thesis": "Stale edit"},
    )
    assert conflict.status_code == 409
    assert conflict.json()["detail"]["current_revision"] == 1
    reassignment = ic_client.patch(
        f"/api/committee/agenda/{item['id']}",
        json={"expected_revision": 1, "owner_id": "spoofed-owner"},
    )
    assert reassignment.status_code == 403
    patched = ic_client.patch(
        f"/api/committee/agenda/{item['id']}",
        json={"expected_revision": 1, "status": "ready", "expiry": "2027-01-31"},
    )
    assert patched.status_code == 200, patched.text
    assert patched.json()["revision"] == 2
    assert patched.json()["status"] == "ready"
    assert patched.json()["expiry"] == "2027-01-31"

    filtered = ic_client.get(
        "/api/committee/agenda",
        params={"issuer_id": issuer_id, "status": "ready", "limit": 1},
    )
    assert filtered.status_code == 200, filtered.text
    assert filtered.json()["total"] == 1
    assert filtered.json()["items"][0]["id"] == item["id"]
    assert ic_client.get(f"/api/committee/agenda/{item['id']}").status_code == 200


def test_ready_requires_committee_run_and_cancel_is_terminal(ic_client):
    from identity import get_identity
    from main import app

    issuer_id, _, _ = _seed_ready("ic-draft")
    app.dependency_overrides[get_identity] = _identity("ic-draft-owner")
    refused = ic_client.post(
        "/api/committee/agenda",
        json=_agenda_payload(issuer_id, agenda_status="ready"),
    )
    assert refused.status_code == 409
    assert "missing_run" in refused.json()["detail"]["failures"]

    draft = ic_client.post(
        "/api/committee/agenda", json=_agenda_payload(issuer_id)
    ).json()
    cancelled = ic_client.patch(
        f"/api/committee/agenda/{draft['id']}",
        json={"expected_revision": draft["revision"], "status": "cancelled"},
    )
    assert cancelled.status_code == 200
    assert ic_client.patch(
        f"/api/committee/agenda/{draft['id']}",
        json={"expected_revision": cancelled.json()["revision"], "status": "draft"},
    ).status_code == 409


def test_analyst_views_are_append_only_and_provisional_views_name_gaps(ic_client):
    from identity import get_identity
    from main import app

    issuer_id, _, _ = _seed_ready("ic-opinion")
    app.dependency_overrides[get_identity] = _identity("ic-opinion-owner")

    initial = ic_client.get(f"/api/issuers/{issuer_id}/analyst-opinions")
    assert initial.status_code == 200
    assert initial.json()["current"]["version"] == 1

    provisional_without_gap = ic_client.post(
        f"/api/issuers/{issuer_id}/analyst-opinions",
        json={
            "stance": "UNDERWEIGHT", "rationale_md": "Needs a refreshed liquidity bridge.",
            "evidence_state": "provisional", "unresolved_items": [],
        },
    )
    assert provisional_without_gap.status_code == 422

    created = ic_client.post(
        f"/api/issuers/{issuer_id}/analyst-opinions",
        json={
            "stance": "UNDERWEIGHT", "conviction": 63,
            "rationale_md": "Liquidity risk outweighs the apparent carry.",
            "evidence_state": "provisional", "unresolved_items": ["Refresh liquidity bridge"],
        },
    )
    assert created.status_code == 201, created.text
    assert created.json()["version"] == 2
    history = ic_client.get(f"/api/issuers/{issuer_id}/analyst-opinions").json()
    assert history["current"]["id"] == created.json()["id"]
    assert [item["version"] for item in history["items"]] == [2, 1]


def test_evidence_exception_requires_independent_qa_and_never_rewrites_cp5(ic_client):
    from identity import get_identity
    from main import app

    issuer_id, portfolio_id, run_id = _seed_ready(
        "ic-exception", committee_status="Restricted"
    )
    app.dependency_overrides[get_identity] = _identity("ic-exception-owner")
    agenda = ic_client.post(
        "/api/committee/agenda", json=_agenda_payload(issuer_id, run_id, portfolio_id)
    )
    assert agenda.status_code == 201, agenda.text
    item = agenda.json()
    assert item["readiness_failures"] == ["run_not_committee_ready"]

    requested = ic_client.post(
        f"/api/committee/agenda/{item['id']}/exceptions",
        json={
            "expected_revision": item["revision"],
            "rationale": "The missing item is time-bound and does not affect current liquidity.",
            "mitigants": ["Obtain management bridge before IC"],
            "expires_at": str(date.today() + timedelta(days=7)),
        },
    )
    assert requested.status_code == 201, requested.text
    exception = requested.json()["evidence_exception"]
    assert exception["status"] == "pending"

    # The requester cannot self-approve, even if they hold a QA server role.
    app.dependency_overrides[get_identity] = _identity("ic-exception-owner", role="qa")
    assert ic_client.post(
        f"/api/committee/exceptions/{exception['id']}/review",
        json={"expected_revision": exception["revision"], "decision": "approve", "review_note": "Self review"},
    ).status_code == 403

    app.dependency_overrides[get_identity] = _identity("ic-exception-reviewer", role="qa")
    approved = ic_client.post(
        f"/api/committee/exceptions/{exception['id']}/review",
        json={"expected_revision": exception["revision"], "decision": "approve", "review_note": "Verified non-critical gap."},
    )
    assert approved.status_code == 200, approved.text
    assert approved.json()["readiness_state"] == "ready_under_exception"
    assert approved.json()["readiness_failures"] == []

    # The exception affects only this agenda readiness calculation. It does not
    # mutate the authoritative run's CP-5 committee status.
    from database import AsyncSessionLocal, Run

    async def read_run_status():
        async with AsyncSessionLocal() as db:
            return (await db.get(Run, run_id)).committee_status

    assert asyncio.run(read_run_status()) == "Restricted"


def test_agenda_cursor_is_bounded_and_filter_bound(ic_client):
    from database import engine
    from identity import get_identity
    from main import app
    from sqlalchemy import event

    issuer_id, portfolio_id, run_id = _seed_ready("ic-page")
    app.dependency_overrides[get_identity] = _identity("ic-page-owner")
    for day in (1, 2, 3):
        payload = _agenda_payload(issuer_id, run_id, portfolio_id)
        payload["scheduled_for"] = f"2026-09-{day:02d}T09:00:00Z"
        assert ic_client.post("/api/committee/agenda", json=payload).status_code == 201
    statements: list[str] = []

    def count_query(_conn, _cursor, statement, _params, _context, _many):
        statements.append(statement)

    event.listen(engine.sync_engine, "before_cursor_execute", count_query)
    try:
        first_response = ic_client.get(
            "/api/committee/agenda",
            params={"issuer_id": issuer_id, "limit": 2, "sort": "scheduled_for"},
        )
    finally:
        event.remove(engine.sync_engine, "before_cursor_execute", count_query)
    first = first_response.json()
    assert len(statements) <= 6, statements
    assert first["total"] == 3 and len(first["items"]) == 2
    assert first["next_cursor"]
    assert ic_client.get(
        "/api/committee/agenda",
        params={
            "issuer_id": issuer_id,
            "expiry_from": "2026-01-01",
            "expiry_to": "2026-12-31",
        },
    ).json()["total"] == 3
    second = ic_client.get(
        "/api/committee/agenda",
        params={
            "issuer_id": issuer_id,
            "limit": 2,
            "sort": "scheduled_for",
            "cursor": first["next_cursor"],
        },
    )
    assert second.status_code == 200
    assert len(second.json()["items"]) == 1
    assert ic_client.get(
        "/api/committee/agenda",
        params={"issuer_id": issuer_id, "limit": 2, "status": "ready", "cursor": first["next_cursor"]},
    ).status_code == 400


def test_agenda_rejects_run_portfolio_linkage_mismatch(ic_client):
    from database import AsyncSessionLocal, Portfolio
    from identity import get_identity
    from main import app

    issuer_id, _portfolio_id, run_id = _seed_ready("ic-link")

    async def seed_other_portfolio():
        async with AsyncSessionLocal() as db:
            db.add(Portfolio(id="ic-link-other-portfolio", name="Other portfolio"))
            await db.commit()

    asyncio.run(seed_other_portfolio())
    app.dependency_overrides[get_identity] = _identity("ic-link-owner")
    response = ic_client.post(
        "/api/committee/agenda",
        json=_agenda_payload(issuer_id, run_id, "ic-link-other-portfolio"),
    )
    assert response.status_code == 409
    assert "not linked" in response.json()["detail"]


def test_agenda_rejects_report_from_a_different_run(ic_client):
    from database import (
        AnalysisContextRecord,
        AsyncSessionLocal,
        ModelCheckpoint,
        ReportVersion,
    )
    from identity import get_identity
    from main import app

    owner = "ic-report-owner"
    issuer_id, portfolio_id, run_id = _seed_ready(
        "ic-report-a", analyst_id=owner
    )
    _other_issuer, _other_portfolio, other_run_id = _seed_ready(
        "ic-report-b", analyst_id=owner
    )

    async def seed_report():
        async with AsyncSessionLocal() as db:
            context = AnalysisContextRecord(
                id="ic-report-context", analyst_id=owner, name="Report context"
            )
            checkpoint = ModelCheckpoint(
                id="ic-report-checkpoint",
                issuer_id="ic-report-b-issuer",
                analyst_id=owner,
                context_id=context.id,
                issuer_run_id=other_run_id,
                label="Committee checkpoint",
                payload_hash="c" * 64,
                payload={},
                authority={},
            )
            report = ReportVersion(
                id="ic-report-version",
                context_id=context.id,
                analyst_id=owner,
                run_id=other_run_id,
                model_checkpoint_id=checkpoint.id,
                status="published",
                payload={},
                document_sha256="d" * 64,
                authority={"origin": "live", "source_ids": [other_run_id]},
            )
            db.add_all([context, checkpoint, report])
            await db.commit()

    asyncio.run(seed_report())
    app.dependency_overrides[get_identity] = _identity(owner)
    response = ic_client.post(
        "/api/committee/agenda",
        json={
            **_agenda_payload(issuer_id, run_id, portfolio_id),
            "report_version_id": "ic-report-version",
        },
    )
    assert response.status_code == 409
    assert "selected run" in response.json()["detail"]


def test_finalize_is_atomic_idempotent_and_freezes_snapshot(ic_client):
    from database import (
        AsyncSessionLocal,
        Claim,
        CommitteeAgendaItem,
        Decision,
        Document,
        DocumentChunk,
        EvidenceItem,
        ModuleOutput,
        PortfolioConstraint,
        PortfolioPosition,
        PortfolioStressRun,
        ThesisVersion,
    )
    from identity import get_identity
    from main import app

    issuer_id, portfolio_id, run_id = _seed_ready("ic-final")

    async def seed_sources():
        from engine import portfolio as portfolio_engine
        from routes.portfolios import _position_payload

        async with AsyncSessionLocal() as db:
            source_time = datetime.now(timezone.utc)
            document = Document(
                id="ic-final-document",
                issuer_id=issuer_id,
                doc_type="10-K",
                file_name="ic-final.pdf",
                storage_key="vault/ic-final.pdf",
            )
            chunk = DocumentChunk(
                id="ic-final-chunk",
                document_id=document.id,
                seq=7,
                text="Liquidity remains above the committee threshold.",
            )
            module = ModuleOutput(
                id="ic-final-module",
                run_id=run_id,
                module_id="CP-1",
                module_name="Credit snapshot",
                runtime_output={"liquidity": 125.0},
                qa_status="Passed",
                committee_status="Committee Ready",
                validation_status="Passed",
            )
            claim = Claim(
                id="ic-final-claim",
                module_output_id=module.id,
                claim_id="C-1",
                claim_text="Liquidity is sufficient.",
            )
            evidence = EvidenceItem(
                id="ic-final-evidence",
                claim_pk=claim.id,
                evidence_id="E-1",
                extraction_type="reported",
                lineage_class="primary",
                source_locator="10-K p.7",
                document_chunk_id=chunk.id,
                confidence="High",
            )
            position = PortfolioPosition(
                id="ic-final-position",
                portfolio_id=portfolio_id,
                issuer_id=issuer_id,
                borrower_name="IC Final Co",
                sector="Software",
                par_usd=100.0,
                price=99.0,
                created_at=source_time,
            )
            constraint = PortfolioConstraint(
                id="ic-final-constraint",
                portfolio_id=portfolio_id,
                code="MAX",
                parameter="Single name",
                limit_value=5.0,
                limit_unit="pct",
                limit_op="<=",
            )
            db.add_all([
                document, chunk, module, claim, evidence, position, constraint,
            ])
            await db.commit()
            await db.refresh(position)
            stress = PortfolioStressRun(
                id="ic-final-stress",
                portfolio_id=portfolio_id,
                created_by="ic-final-owner",
                label="Downside",
                inputs={"book_price_shock_pct": -10},
                output={"loss_percent": 10.0},
                source_fingerprint=portfolio_engine.stress_source_fingerprint(
                    [_position_payload(position)],
                    {"book_price_shock_pct": -10},
                    as_of=None,
                    portfolio_id=portfolio_id,
                ),
                authority={"origin": "live", "source_ids": [portfolio_id]},
                status="complete",
            )
            db.add(stress)
            await db.commit()

    asyncio.run(seed_sources())
    app.dependency_overrides[get_identity] = _identity("ic-final-owner")
    created = ic_client.post(
        "/api/committee/agenda",
        json=_agenda_payload(
            issuer_id, run_id, portfolio_id, agenda_status="ready"
        ),
    )
    assert created.status_code == 201, created.text
    item = created.json()
    stale = ic_client.post(
        f"/api/committee/agenda/{item['id']}/finalize",
        json={"expected_revision": item["revision"] + 1},
    )
    assert stale.status_code == 409
    assert stale.json()["detail"]["current_revision"] == item["revision"]
    finalized = ic_client.post(
        f"/api/committee/agenda/{item['id']}/finalize",
        json={"expected_revision": item["revision"]},
    )
    assert finalized.status_code == 200, finalized.text
    body = finalized.json()
    assert body["agenda"]["status"] == "decided"
    assert body["agenda"]["finalized_decision_id"] == body["decision"]["id"]
    assert body["agenda"]["snapshot_sha256"] == body["decision"]["snapshot_sha256"]
    assert len(body["decision"]["snapshot_sha256"]) == 64
    source_ids = set(body["agenda"]["frozen_authority"]["source_ids"])
    assert {run_id, portfolio_id, "ic-final-evidence", "ic-final-chunk", "ic-final-stress"} <= source_ids
    assert body["decision"]["id"]
    assert body["agenda"]["expiry"] == "2026-12-31"

    retry = ic_client.post(
        f"/api/committee/agenda/{item['id']}/finalize",
        # Replay the exact request body whose first response was hypothetically
        # lost, not a refreshed post-finalization revision.
        json={"expected_revision": item["revision"]},
    )
    assert retry.status_code == 200
    assert retry.json()["decision"]["id"] == body["decision"]["id"]
    assert ic_client.patch(
        f"/api/committee/agenda/{item['id']}",
        json={"expected_revision": body["agenda"]["revision"], "thesis": "mutate"},
    ).status_code == 409

    async def verify():
        async with AsyncSessionLocal() as db:
            agenda = await db.get(CommitteeAgendaItem, item["id"])
            decision = await db.get(Decision, body["decision"]["id"])
            versions = (await db.execute(
                __import__("sqlalchemy").select(ThesisVersion).where(
                    ThesisVersion.linked_decision_id == decision.id
                )
            )).scalars().all()
            assert agenda.snapshot["run"]["committee_status"] == "Committee Ready"
            assert agenda.snapshot["document_sha256"]
            assert agenda.snapshot["evidence_manifest"]["records"]["evidence"][0]["source_locator"] == "10-K p.7"
            assert agenda.snapshot["portfolio"]["records"]["holdings"][0]["par_usd"] == 100.0
            assert agenda.snapshot["portfolio"]["records"]["stress"]["status"] == "current"
            assert agenda.snapshot["portfolio"]["records"]["stress"]["id"] == "ic-final-stress"
            assert decision.expiry == date(2026, 12, 31)
            assert decision.snapshot == agenda.snapshot
            assert len(versions) == 1

    asyncio.run(verify())

    frozen_snapshot = ic_client.get(
        f"/api/decisions/{body['decision']['id']}"
    ).json()["snapshot"]

    async def mutate_sources():
        async with AsyncSessionLocal() as db:
            chunk = await db.get(DocumentChunk, "ic-final-chunk")
            position = await db.get(PortfolioPosition, "ic-final-position")
            stress = await db.get(PortfolioStressRun, "ic-final-stress")
            chunk.text = "MUTATED SOURCE"
            position.par_usd = 999.0
            stress.output = {"loss_percent": 99.0}
            await db.commit()

    asyncio.run(mutate_sources())
    after_mutation = ic_client.get(
        f"/api/decisions/{body['decision']['id']}"
    ).json()
    assert after_mutation["snapshot"] == frozen_snapshot
    assert after_mutation["snapshot_sha256"] == body["decision"]["snapshot_sha256"]


def test_finalize_rejects_stale_stress_output_after_holdings_change(ic_client):
    from database import AsyncSessionLocal, PortfolioPosition, PortfolioStressRun
    from engine import portfolio as portfolio_engine
    from identity import get_identity
    from main import app

    issuer_id, portfolio_id, run_id = _seed_ready("ic-stale-stress")
    source_time = datetime.now(timezone.utc)
    stress_inputs = {"book_price_shock_pct": -12}

    async def seed_then_change_holdings():
        from routes.portfolios import _position_payload

        async with AsyncSessionLocal() as db:
            position = PortfolioPosition(
                id="ic-stale-stress-position",
                portfolio_id=portfolio_id,
                issuer_id=issuer_id,
                borrower_name="IC Stale Stress Co",
                sector="Software",
                par_usd=100.0,
                price=98.0,
                created_at=source_time,
            )
            db.add(position)
            await db.commit()
            await db.refresh(position)
            original_payload = _position_payload(position)
            stress = PortfolioStressRun(
                id="ic-stale-stress-snapshot",
                portfolio_id=portfolio_id,
                created_by="ic-stale-stress-owner",
                label="Old holdings downside",
                inputs=stress_inputs,
                output={"loss_percent": 12.0, "loss_usd": 11.76},
                source_fingerprint=portfolio_engine.stress_source_fingerprint(
                    [original_payload],
                    stress_inputs,
                    as_of=None,
                    portfolio_id=portfolio_id,
                ),
                authority={"origin": "live", "source_ids": [portfolio_id]},
                status="complete",
            )
            db.add(stress)
            await db.commit()

            # The persisted stress is now stale relative to the exact holdings
            # that finalization will freeze.
            position.par_usd = 200.0
            await db.commit()

    asyncio.run(seed_then_change_holdings())
    app.dependency_overrides[get_identity] = _identity("ic-stale-stress-owner")
    item = ic_client.post(
        "/api/committee/agenda",
        json=_agenda_payload(
            issuer_id, run_id, portfolio_id, agenda_status="ready"
        ),
    ).json()
    finalized = ic_client.post(
        f"/api/committee/agenda/{item['id']}/finalize",
        json={"expected_revision": item["revision"]},
    )
    assert finalized.status_code == 200, finalized.text
    finalized_body = finalized.json()
    snapshot = ic_client.get(
        f"/api/decisions/{finalized_body['decision']['id']}"
    ).json()["snapshot"]
    frozen_stress = snapshot["portfolio"]["records"]["stress"]
    assert frozen_stress["status"] == "stale"
    assert frozen_stress["stored_source_fingerprint"] != frozen_stress["expected_source_fingerprint"]
    assert "inputs" not in frozen_stress
    assert "output" not in frozen_stress
    assert "ic-stale-stress-snapshot" not in snapshot["authority"]["source_ids"]


def test_finalize_failure_rolls_back_decision_and_agenda(ic_client, monkeypatch):
    from database import AsyncSessionLocal, CommitteeAgendaItem, Decision
    from identity import get_identity
    from main import app
    import routes.committee as committee_route

    issuer_id, portfolio_id, run_id = _seed_ready("ic-rollback")
    app.dependency_overrides[get_identity] = _identity("ic-rollback-owner")
    item = ic_client.post(
        "/api/committee/agenda",
        json=_agenda_payload(
            issuer_id, run_id, portfolio_id, agenda_status="ready"
        ),
    ).json()

    async def refuse(*_args, **_kwargs):
        raise HTTPException(409, "simulated thesis failure")

    monkeypatch.setattr(committee_route, "create_thesis_version", refuse)
    failed = ic_client.post(
        f"/api/committee/agenda/{item['id']}/finalize",
        json={"expected_revision": item["revision"]},
    )
    assert failed.status_code == 409

    async def verify():
        async with AsyncSessionLocal() as db:
            agenda = await db.get(CommitteeAgendaItem, item["id"])
            rows = (await db.execute(
                __import__("sqlalchemy").select(Decision).where(
                    Decision.agenda_item_id == item["id"]
                )
            )).scalars().all()
            assert agenda.status == "ready"
            assert agenda.finalized_decision_id is None
            assert rows == []

    asyncio.run(verify())


def test_read_only_and_tenant_isolation(ic_client, monkeypatch):
    from config import get_settings
    from identity import get_identity
    from main import app

    issuer_a, portfolio_a, run_a = _seed_ready("ic-team-a", team_id="team-a")
    issuer_b, portfolio_b, run_b = _seed_ready("ic-team-b", team_id="team-b")
    monkeypatch.setattr(get_settings(), "caos_tenancy_enabled", True)
    app.dependency_overrides[get_identity] = _identity(
        "ic-team-a-viewer", role="read_only", team_id="team-a"
    )
    assert ic_client.post(
        "/api/committee/agenda", json=_agenda_payload(issuer_a, run_a, portfolio_a)
    ).status_code == 403
    app.dependency_overrides[get_identity] = _identity("ic-team-a-owner", team_id="team-a")
    own = ic_client.post(
        "/api/committee/agenda", json=_agenda_payload(issuer_a, run_a, portfolio_a)
    )
    assert own.status_code == 201, own.text
    assert ic_client.post(
        "/api/committee/agenda", json=_agenda_payload(issuer_b, run_b, portfolio_b)
    ).status_code == 404
    assert all(
        row["issuer_id"] != issuer_b
        for row in ic_client.get("/api/committee/agenda").json()["items"]
    )
    monkeypatch.setattr(get_settings(), "caos_tenancy_enabled", False)


def test_erasure_drops_drafts_and_anonymizes_finalized_firm_records(ic_client):
    import hashlib
    import json

    from database import (
        AsyncSessionLocal,
        CommitteeAgendaItem,
        Decision,
        DecisionVote,
        ThesisVersion,
        erase_analyst_data,
    )
    from identity import get_identity
    from main import app

    owner = "ic-erase-owner"
    issuer_id, portfolio_id, run_id = _seed_ready("ic-erase")
    app.dependency_overrides[get_identity] = _identity(owner)
    draft = ic_client.post(
        "/api/committee/agenda", json=_agenda_payload(issuer_id, run_id, portfolio_id)
    ).json()
    ready = ic_client.post(
        "/api/committee/agenda",
        json=_agenda_payload(issuer_id, run_id, portfolio_id, agenda_status="ready"),
    ).json()
    finalized = ic_client.post(
        f"/api/committee/agenda/{ready['id']}/finalize",
        json={"expected_revision": ready["revision"]},
    ).json()
    decision_id = finalized["decision"]["id"]
    assert ic_client.post(
        f"/api/decisions/{decision_id}/votes", json={"vote": "approve"}
    ).status_code == 200

    async def embed_nested_attribution():
        async with AsyncSessionLocal() as db:
            agenda = await db.get(CommitteeAgendaItem, ready["id"])
            decision = await db.get(Decision, decision_id)
            snapshot = dict(agenda.snapshot)
            snapshot["report_version"] = {
                "payload": {"analyst_id": owner, "email": f"{owner}@firm.test"}
            }
            snapshot["context"] = {"artifacts": {"owner": owner}}
            canonical = json.dumps(snapshot, sort_keys=True, separators=(",", ":"))
            snapshot_hash = hashlib.sha256(canonical.encode()).hexdigest()
            agenda.snapshot = snapshot
            agenda.snapshot_sha256 = snapshot_hash
            decision.snapshot = snapshot
            decision.snapshot_sha256 = snapshot_hash
            await db.commit()

    asyncio.run(embed_nested_attribution())

    async def erase_and_verify():
        async with AsyncSessionLocal() as db:
            summary = await erase_analyst_data(
                db, analyst_id=owner, email=f"{owner}@firm.test"
            )
        assert summary["committee_agenda_deleted"] == 1
        assert summary["committee_agenda_anonymized"] == 1
        assert summary["decisions_anonymized"] == 1
        assert summary["decision_votes_anonymized"] == 1
        assert summary["thesis_versions_anonymized"] == 1
        assert summary["committee_snapshots_redacted"] >= 1
        async with AsyncSessionLocal() as db:
            assert await db.get(CommitteeAgendaItem, draft["id"]) is None
            retained = await db.get(CommitteeAgendaItem, ready["id"])
            decision = await db.get(Decision, decision_id)
            vote = (await db.execute(
                __import__("sqlalchemy").select(DecisionVote).where(
                    DecisionVote.decision_id == decision_id
                )
            )).scalar_one()
            thesis = (await db.execute(
                __import__("sqlalchemy").select(ThesisVersion).where(
                    ThesisVersion.linked_decision_id == decision_id
                )
            )).scalar_one()
            assert retained is not None and retained.status == "decided"
            assert decision is not None
            assert retained.owner_id.startswith("erased:")
            assert decision.created_by == retained.owner_id
            assert vote.member == retained.owner_id
            assert thesis.created_by == retained.owner_id
            assert retained.snapshot_sha256 == decision.snapshot_sha256
            serialized = json.dumps(retained.snapshot)
            assert owner not in serialized
            assert f"{owner}@firm.test" not in serialized
            assert retained.snapshot["privacy_redaction"]["principal"] == retained.owner_id
            assert retained.snapshot["report_version"]["payload"]["analyst_id"] == retained.owner_id

    asyncio.run(erase_and_verify())


def test_decision_book_pagination_filters_detail_and_legacy_array(ic_client):
    from database import (
        AsyncSessionLocal,
        Decision,
        DecisionVote,
        Issuer,
        Portfolio,
        Run,
    )
    from identity import get_identity
    from main import app

    app.dependency_overrides[get_identity] = _identity("ic-book-owner")

    async def seed():
        async with AsyncSessionLocal() as db:
            issuer = Issuer(id="ic-book-issuer", name="IC Book Co")
            run = Run(
                id="ic-book-run", issuer_id=issuer.id, status="complete",
                qa_status="Passed", committee_status="Committee Ready",
            )
            portfolio = Portfolio(id="ic-book-portfolio", name="IC Book Portfolio")
            db.add_all([issuer, run, portfolio])
            await db.flush()
            for index, decision_status in enumerate(("active", "active", "reopened")):
                decision = Decision(
                    id=f"ic-book-decision-{index}", issuer_id=issuer.id, run_id=run.id,
                    action="approve", status=decision_status, conditions=[], snapshot={},
                    snapshot_sha256=str(index) * 64, created_by="ic-book-owner",
                    portfolio_id=portfolio.id if index == 0 else None,
                    expiry=date(2026, 12, 31) if index == 0 else None,
                )
                db.add(decision)
                await db.flush()
                db.add(DecisionVote(
                    decision_id=decision.id, member=f"member-{index}", vote="approve"
                ))
            await db.commit()

    asyncio.run(seed())
    legacy = ic_client.get("/api/decisions", params={"issuer_id": "ic-book-issuer"})
    assert legacy.status_code == 200
    assert isinstance(legacy.json(), list)
    assert len(legacy.json()) == 3
    assert all(len(row["votes"]) == 1 for row in legacy.json())

    first = ic_client.get(
        "/api/decisions",
        params={"book": True, "issuer_id": "ic-book-issuer", "status": "active", "limit": 1},
    )
    assert first.status_code == 200, first.text
    assert first.json()["total"] == 2
    assert first.json()["next_cursor"]
    second = ic_client.get(
        "/api/decisions",
        params={
            "book": True,
            "issuer_id": "ic-book-issuer",
            "status": "active",
            "limit": 1,
            "cursor": first.json()["next_cursor"],
        },
    )
    assert second.status_code == 200
    assert second.json()["items"][0]["id"] != first.json()["items"][0]["id"]
    detail = ic_client.get(f"/api/decisions/{first.json()['items'][0]['id']}")
    assert detail.status_code == 200
    assert detail.json()["votes"][0]["vote"] == "approve"
    linked = ic_client.get(
        "/api/decisions",
        params={
            "book": True,
            "portfolio_id": "ic-book-portfolio",
            "owner_id": "ic-book-owner",
            "expiry_from": "2026-01-01",
            "expiry_to": "2026-12-31",
        },
    )
    assert linked.status_code == 200, linked.text
    assert [row["id"] for row in linked.json()["items"]] == ["ic-book-decision-0"]
    assert ic_client.get("/api/decisions").status_code == 422


def test_duplicate_vote_race_resolves_as_one_success_and_one_conflict(ic_client):
    from identity import get_identity
    from main import app

    issuer_id, _portfolio_id, run_id = _seed_ready("ic-vote-race")
    app.dependency_overrides[get_identity] = _identity("ic-vote-race-owner")
    decision = ic_client.post(
        "/api/decisions",
        json={
            "issuer_id": issuer_id,
            "run_id": run_id,
            "action": "approve",
            "snapshot": {"thesis_md": "Vote race fixture."},
        },
    )
    assert decision.status_code == 201, decision.text
    decision_id = decision.json()["id"]

    def cast_vote():
        return ic_client.post(
            f"/api/decisions/{decision_id}/votes", json={"vote": "approve"}
        ).status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        statuses = sorted(pool.map(lambda _index: cast_vote(), range(2)))
    assert statuses == [200, 409]
