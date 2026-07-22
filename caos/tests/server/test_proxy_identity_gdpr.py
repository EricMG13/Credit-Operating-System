"""Proxy/profile identity continuity through C3 ownership and GDPR erasure."""

from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select


@pytest.fixture
def client(monkeypatch):
    from config import get_settings
    from main import app

    settings = get_settings()
    monkeypatch.setattr(settings, "caos_alert_rules_v1_enabled", True)
    monkeypatch.setattr(settings, "caos_tenancy_enabled", True)
    app.dependency_overrides.clear()
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


async def _seed_profile(
    *, profile_id: str, email: str, name: str, team_id: str
) -> None:
    from database import Analyst, AsyncSessionLocal

    async with AsyncSessionLocal() as session:
        session.add(
            Analyst(
                id=profile_id,
                name=name,
                email=email,
                role="qa",
                team_id=team_id,
            )
        )
        await session.commit()


async def _seed_profileless_document(
    *, document_id: str, uploaded_by: str, analyst_id: str | None
) -> None:
    from database import AsyncSessionLocal, Document

    async with AsyncSessionLocal() as session:
        session.add(
            Document(
                id=document_id,
                issuer_id=None,
                analyst_id=analyst_id,
                doc_type="market_data",
                file_name=f"{document_id}.xlsx",
                storage_key=f"proxy-gdpr/{document_id}.xlsx",
                uploaded_by=uploaded_by,
            )
        )
        await session.commit()


async def _seed_case_variant_profiles(*, stem: str) -> tuple[str, str]:
    from database import Analyst, AsyncSessionLocal

    mixed_email = f"{stem}.Duplicate@Example.Test"
    normalized_email = mixed_email.lower()
    async with AsyncSessionLocal() as session:
        session.add_all(
            [
                Analyst(
                    id=f"{stem}-mixed-profile",
                    name=f"{stem} Mixed Profile",
                    email=mixed_email,
                ),
                Analyst(
                    id=f"{stem}-lower-profile",
                    name=f"{stem} Lower Profile",
                    email=normalized_email,
                ),
            ]
        )
        await session.commit()
    return mixed_email, normalized_email


async def _document_snapshot(document_id: str) -> tuple[str | None, str | None]:
    from database import AsyncSessionLocal, Document

    async with AsyncSessionLocal() as session:
        document = await session.get(Document, document_id)
        assert document is not None
        return document.uploaded_by, document.analyst_id


async def _c3_owner_row_count(owner_id: str) -> int:
    from database import (
        AlertDeliveryIntent,
        AlertEvent,
        AlertEventContext,
        AsyncSessionLocal,
        WatchRule,
        WatchRuleEvaluation,
        WatchRuleVersion,
    )

    async with AsyncSessionLocal() as session:
        total = 0
        for model, predicate in (
            (WatchRule, WatchRule.owner_user_id == owner_id),
            (WatchRuleVersion, WatchRuleVersion.owner_user_id == owner_id),
            (WatchRuleEvaluation, WatchRuleEvaluation.owner_user_id == owner_id),
            (AlertEventContext, AlertEventContext.owner_user_id == owner_id),
            (AlertDeliveryIntent, AlertDeliveryIntent.owner_user_id == owner_id),
            (AlertEvent, AlertEvent.created_by == owner_id),
        ):
            total += await session.scalar(
                select(func.count()).select_from(model).where(predicate)
            )
        return total


async def _profiles_for_email(email: str) -> list[tuple[str, str | None]]:
    from database import Analyst, AsyncSessionLocal

    async with AsyncSessionLocal() as session:
        return list(
            (
                await session.execute(
                    select(Analyst.id, Analyst.email).where(
                        func.lower(Analyst.email) == email.lower()
                    )
                )
            ).all()
        )


async def _seed_legacy_global_run(*, run_id: str, owner_id: str) -> None:
    from database import AsyncSessionLocal, Issuer, Run

    issuer_id = f"{run_id}-issuer"
    async with AsyncSessionLocal() as session:
        session.add(Issuer(id=issuer_id, name=f"{run_id} issuer"))
        session.add(
            Run(
                id=run_id,
                issuer_id=issuer_id,
                analyst_id=owner_id,
                status="complete",
            )
        )
        await session.commit()


async def _run_owner(run_id: str) -> str | None:
    from database import AsyncSessionLocal, Run

    async with AsyncSessionLocal() as session:
        run = await session.get(Run, run_id)
        assert run is not None
        return run.analyst_id


async def _profile_ids_for_case_insensitive_email(email: str) -> list[str]:
    from database import (
        Analyst,
        AsyncSessionLocal,
        case_insensitive_email_match,
    )

    async with AsyncSessionLocal() as session:
        return list(
            (
                await session.execute(
                    select(Analyst.id).where(
                        case_insensitive_email_match(
                            session,
                            Analyst.email,
                            email,
                        )
                    )
                )
            ).scalars()
        )


def _proxy_headers(*, forwarded_user: str, email: str, preferred_name: str) -> dict[str, str]:
    return {
        "X-Forwarded-User": forwarded_user,
        "X-Forwarded-Email": email,
        "X-Forwarded-Preferred-Username": preferred_name,
    }


def _create_full_c3_graph(
    client: TestClient, *, headers: dict[str, str], suffix: str
) -> tuple[str, str]:
    create = client.post(
        "/api/watch-rules",
        headers={**headers, "Idempotency-Key": f"proxy-gdpr-{suffix}"},
        json={
            "name": f"Proxy GDPR {suffix}",
            "signal_type": "qa_gate",
            "enabled": True,
            "paused": False,
            "issuer_id": None,
            "portfolio_id": None,
            "schedule_kind": "event_driven",
            "schedule_interval_seconds": None,
            "next_evaluation_at": None,
            "config": {
                "operator": "present",
                "threshold": None,
                "kind": "qa_change",
                "title": f"Proxy GDPR alert {suffix}",
                "impact": "Review governed evidence.",
            },
        },
    )
    assert create.status_code == 201, create.text
    rule_id = create.json()["id"]

    evaluate = client.post(
        f"/api/watch-rules/{rule_id}/evaluate",
        headers=headers,
        json={
            "source_identity": f"proxy-gdpr-observation:{suffix}",
            "observed_at": datetime.now(timezone.utc).isoformat(),
            "numeric_value": None,
            "categorical_value": "critical",
            "detail": {"fixture": suffix},
            "source_artifact_refs": [f"fact:proxy-gdpr:{suffix}"],
            "hop_count": 0,
        },
    )
    assert evaluate.status_code == 200, evaluate.text
    assert evaluate.json()["outcome"] == "matched"
    return rule_id, evaluate.json()["alert_event_id"]


async def _c3_snapshot(
    *, profile_id: str, rule_id: str, event_id: str
) -> dict[str, object]:
    from database import (
        AlertDeliveryIntent,
        AlertEvent,
        AlertEventContext,
        Analyst,
        AsyncSessionLocal,
        WatchRule,
        WatchRuleEvaluation,
        WatchRuleVersion,
    )

    async with AsyncSessionLocal() as session:
        event = await session.get(AlertEvent, event_id)
        private_row_count = 0
        for model, predicate in (
            (WatchRule, WatchRule.id == rule_id),
            (WatchRuleVersion, WatchRuleVersion.watch_rule_id == rule_id),
            (WatchRuleEvaluation, WatchRuleEvaluation.watch_rule_id == rule_id),
            (AlertEventContext, AlertEventContext.watch_rule_id == rule_id),
            (
                AlertDeliveryIntent,
                AlertDeliveryIntent.alert_event_id == event_id,
            ),
        ):
            private_row_count += await session.scalar(
                select(func.count()).select_from(model).where(predicate)
            )
        return {
            "profile_exists": await session.get(Analyst, profile_id) is not None,
            "rule_owners": list(
                (
                    await session.execute(
                        select(WatchRule.owner_user_id).where(WatchRule.id == rule_id)
                    )
                ).scalars()
            ),
            "version_owners": list(
                (
                    await session.execute(
                        select(WatchRuleVersion.owner_user_id).where(
                            WatchRuleVersion.watch_rule_id == rule_id
                        )
                    )
                ).scalars()
            ),
            "evaluation_owners": list(
                (
                    await session.execute(
                        select(WatchRuleEvaluation.owner_user_id).where(
                            WatchRuleEvaluation.watch_rule_id == rule_id
                        )
                    )
                ).scalars()
            ),
            "context_owners": list(
                (
                    await session.execute(
                        select(AlertEventContext.owner_user_id).where(
                            AlertEventContext.watch_rule_id == rule_id
                        )
                    )
                ).scalars()
            ),
            "intent_owners": list(
                (
                    await session.execute(
                        select(AlertDeliveryIntent.owner_user_id).where(
                            AlertDeliveryIntent.alert_event_id == event_id
                        )
                    )
                ).scalars()
            ),
            "event_created_by": event.created_by if event is not None else None,
            "event_payload": (
                json.dumps(
                    {
                        "kind": event.kind,
                        "title": event.title,
                        "impact": event.impact,
                        "evidence": event.evidence,
                        "authority": event.authority,
                    },
                    sort_keys=True,
                )
                if event is not None
                else None
            ),
            "private_row_count": private_row_count,
        }


def _assert_profile_uuid_owns_full_graph(
    snapshot: dict[str, object], *, profile_id: str
) -> None:
    assert snapshot["profile_exists"] is True
    assert snapshot["rule_owners"] == [profile_id]
    assert snapshot["version_owners"] == [profile_id]
    assert snapshot["evaluation_owners"] == [profile_id]
    assert snapshot["context_owners"] == [profile_id]
    assert snapshot["intent_owners"] == [profile_id, profile_id]
    assert snapshot["event_created_by"] == profile_id
    assert snapshot["private_row_count"] == 6


def _assert_erased(
    snapshot: dict[str, object], *, profile_id: str, email: str, forwarded_user: str
) -> None:
    assert snapshot["profile_exists"] is False
    assert snapshot["private_row_count"] == 0
    assert snapshot["event_created_by"].startswith("erased:")
    retained = str(snapshot["event_payload"])
    assert profile_id not in retained
    assert email.casefold() not in retained.casefold()
    assert forwarded_user not in retained


def test_proxy_profile_uuid_owns_c3_and_self_erasure_removes_full_graph(client) -> None:
    profile_id = "21000000-0000-0000-0000-000000000001"
    stored_email = "Proxy.Self@Example.Test"
    forwarded_user = "oidc-subject-self-not-a-profile-id"
    legacy_run_id = "proxy-self-legacy-global-run"
    profile_name = "Stored Proxy Self"
    asyncio.run(
        _seed_profile(
            profile_id=profile_id,
            email=stored_email,
            name=profile_name,
            team_id="proxy-self-team",
        )
    )
    headers = _proxy_headers(
        forwarded_user=forwarded_user,
        email=stored_email.swapcase(),
        preferred_name="Forwarded Name Is Not The Profile",
    )

    me = client.get("/api/auth/me", headers=headers)
    assert me.status_code == 200, me.text
    assert me.json() == {
        "id": forwarded_user,
        "email": stored_email,
        "full_name": profile_name,
        "role": "qa",
        "is_active": True,
        "source": "proxy",
    }
    rule_id, event_id = _create_full_c3_graph(
        client, headers=headers, suffix="self"
    )
    before = asyncio.run(
        _c3_snapshot(profile_id=profile_id, rule_id=rule_id, event_id=event_id)
    )
    _assert_profile_uuid_owns_full_graph(before, profile_id=profile_id)
    asyncio.run(
        _seed_legacy_global_run(
            run_id=legacy_run_id,
            owner_id=forwarded_user,
        )
    )
    assert asyncio.run(_run_owner(legacy_run_id)) == forwarded_user
    legacy_run = client.get(f"/api/runs/{legacy_run_id}", headers=headers)
    assert legacy_run.status_code == 200, legacy_run.text
    assert legacy_run.json()["analyst_id"] == forwarded_user

    erased = client.delete("/api/auth/profile", headers=headers)
    assert erased.status_code == 200, erased.text
    summary = erased.json()["erased"]
    assert summary["profile_deleted"] == 1
    assert summary["watch_rules_deleted"] == 1
    assert summary["watch_rule_versions_deleted"] == 1
    assert summary["watch_rule_evaluations_deleted"] == 1
    assert summary["alert_event_contexts_deleted"] == 1
    assert summary["alert_delivery_intents_deleted"] == 2
    assert summary["alert_events_anonymized"] == 1
    assert summary["runs_anonymized"] == 1

    after = asyncio.run(
        _c3_snapshot(profile_id=profile_id, rule_id=rule_id, event_id=event_id)
    )
    _assert_erased(
        after,
        profile_id=profile_id,
        email=stored_email,
        forwarded_user=forwarded_user,
    )
    assert asyncio.run(_run_owner(legacy_run_id)) is None


def test_profile_cookie_self_erasure_captures_only_matching_active_proxy_alias(client) -> None:
    profile_id = "26000000-0000-0000-0000-000000000006"
    stored_email = "Proxy.Cookie.Self@Example.Test"
    forwarded_user = "oidc-subject-cookie-self"
    protected_alias = "unrelated-proxy-subject-must-survive"
    legacy_run_id = "proxy-cookie-self-legacy-run"
    protected_run_id = "proxy-cookie-self-protected-run"
    asyncio.run(
        _seed_profile(
            profile_id=profile_id,
            email=stored_email,
            name="Stored Cookie Proxy Self",
            team_id="proxy-cookie-self-team",
        )
    )
    matching_headers = _proxy_headers(
        forwarded_user=forwarded_user,
        email=stored_email.swapcase(),
        preferred_name="Stored Cookie Proxy Self",
    )
    login = client.post(
        "/api/auth/profile",
        headers=matching_headers,
        json={"code": "131113", "name": "Stored Cookie Proxy Self"},
    )
    assert login.status_code == 201, login.text
    me = client.get("/api/auth/me", headers=matching_headers)
    assert me.status_code == 200, me.text
    assert me.json()["source"] == "profile"
    assert me.json()["id"] == profile_id

    asyncio.run(
        _seed_legacy_global_run(run_id=legacy_run_id, owner_id=forwarded_user)
    )
    asyncio.run(
        _seed_legacy_global_run(run_id=protected_run_id, owner_id=protected_alias)
    )
    erased = client.delete("/api/auth/profile", headers=matching_headers)
    assert erased.status_code == 200, erased.text
    assert erased.json()["erased"]["runs_anonymized"] == 1
    assert asyncio.run(_run_owner(legacy_run_id)) is None
    assert asyncio.run(_run_owner(protected_run_id)) == protected_alias


def test_profile_cookie_self_erasure_rejects_mismatched_proxy_alias(client) -> None:
    profile_id = "27000000-0000-0000-0000-000000000007"
    stored_email = "Proxy.Cookie.Mismatch@Example.Test"
    protected_alias = "mismatched-proxy-subject-must-survive"
    protected_run_id = "proxy-cookie-mismatch-protected-run"
    asyncio.run(
        _seed_profile(
            profile_id=profile_id,
            email=stored_email,
            name="Stored Cookie Proxy Mismatch",
            team_id="proxy-cookie-mismatch-team",
        )
    )
    matching_headers = _proxy_headers(
        forwarded_user="cookie-login-subject",
        email=stored_email,
        preferred_name="Stored Cookie Proxy Mismatch",
    )
    login = client.post(
        "/api/auth/profile",
        headers=matching_headers,
        json={"code": "131113", "name": "Stored Cookie Proxy Mismatch"},
    )
    assert login.status_code == 201, login.text
    asyncio.run(
        _seed_legacy_global_run(run_id=protected_run_id, owner_id=protected_alias)
    )

    mismatched_headers = _proxy_headers(
        forwarded_user=protected_alias,
        email="different.principal@example.test",
        preferred_name="Different Principal",
    )
    erased = client.delete("/api/auth/profile", headers=mismatched_headers)
    assert erased.status_code == 200, erased.text
    assert erased.json()["erased"]["runs_anonymized"] == 0
    assert asyncio.run(_run_owner(protected_run_id)) == protected_alias


def test_matched_proxy_without_forwarded_user_preserves_email_identity(client) -> None:
    profile_id = "24000000-0000-0000-0000-000000000004"
    stored_email = "Proxy.EmailFallback@Example.Test"
    forwarded_email = stored_email.swapcase()
    asyncio.run(
        _seed_profile(
            profile_id=profile_id,
            email=stored_email,
            name="Stored Email Fallback",
            team_id="proxy-email-fallback-team",
        )
    )

    response = client.get(
        "/api/auth/me",
        headers={
            "X-Forwarded-Email": forwarded_email,
            "X-Forwarded-Preferred-Username": "Forwarded Email Fallback",
        },
    )
    assert response.status_code == 200, response.text
    assert response.json() == {
        "id": forwarded_email,
        "email": stored_email,
        "full_name": "Stored Email Fallback",
        "role": "qa",
        "is_active": True,
        "source": "proxy",
    }


def test_unicode_case_variants_match_operator_profile_and_document(
    client,
) -> None:
    from erase_analyst import erase_by_email

    profile_id = "25000000-0000-0000-0000-000000000005"
    stored_email = "Ünicode.Proxy@Example.Test"
    lookup_email = "ünICODE.pROXY@eXAMPLE.tEST"
    document_email = "ÜNICODE.PROXY@EXAMPLE.TEST"
    document_id = "unicode-proxy-gdpr-document"
    asyncio.run(
        _seed_profile(
            profile_id=profile_id,
            email=stored_email,
            name="Unicode Proxy Profile",
            team_id="unicode-proxy-team",
        )
    )
    asyncio.run(
        _seed_profileless_document(
            document_id=document_id,
            uploaded_by=document_email,
            analyst_id=profile_id,
        )
    )
    assert asyncio.run(_profile_ids_for_case_insensitive_email(lookup_email)) == [
        profile_id
    ]

    summary = asyncio.run(erase_by_email(lookup_email))
    assert summary["profile_deleted"] == 1
    assert summary["documents_anonymized"] == 1
    assert asyncio.run(_profile_ids_for_case_insensitive_email(lookup_email)) == []
    uploaded_by, analyst_id = asyncio.run(_document_snapshot(document_id))
    assert uploaded_by is None
    assert analyst_id is not None and analyst_id.startswith("erased:")


def test_operator_erasure_resolves_proxy_c3_owner_from_email(client) -> None:
    from erase_analyst import erase_by_email

    profile_id = "22000000-0000-0000-0000-000000000002"
    stored_email = "Proxy.Operator@Example.Test"
    forwarded_user = "oidc-subject-operator-not-a-profile-id"
    asyncio.run(
        _seed_profile(
            profile_id=profile_id,
            email=stored_email,
            name="Stored Proxy Operator",
            team_id="proxy-operator-team",
        )
    )
    headers = _proxy_headers(
        forwarded_user=forwarded_user,
        email=stored_email.lower(),
        preferred_name="Untrusted Forwarded Display",
    )
    rule_id, event_id = _create_full_c3_graph(
        client, headers=headers, suffix="operator"
    )
    before = asyncio.run(
        _c3_snapshot(profile_id=profile_id, rule_id=rule_id, event_id=event_id)
    )
    _assert_profile_uuid_owns_full_graph(before, profile_id=profile_id)

    summary = asyncio.run(erase_by_email(stored_email.swapcase()))
    assert summary["profile_deleted"] == 1
    assert summary["watch_rules_deleted"] == 1
    assert summary["watch_rule_versions_deleted"] == 1
    assert summary["watch_rule_evaluations_deleted"] == 1
    assert summary["alert_event_contexts_deleted"] == 1
    assert summary["alert_delivery_intents_deleted"] == 2
    assert summary["alert_events_anonymized"] == 1

    after = asyncio.run(
        _c3_snapshot(profile_id=profile_id, rule_id=rule_id, event_id=event_id)
    )
    _assert_erased(
        after,
        profile_id=profile_id,
        email=stored_email,
        forwarded_user=forwarded_user,
    )


def test_profileless_proxy_c3_is_blocked_and_document_erases_case_insensitively(
    client,
) -> None:
    from erase_analyst import erase_by_email

    forwarded_email = "Profileless.Proxy@Example.Test"
    normalized_email = forwarded_email.lower()
    differently_cased_email = forwarded_email.swapcase()
    forwarded_user = "oidc-subject-profileless-not-the-email"
    document_id = "profileless-proxy-gdpr-document"
    headers = _proxy_headers(
        forwarded_user=forwarded_user,
        email=forwarded_email,
        preferred_name="Profileless Proxy Analyst",
    )

    me = client.get("/api/auth/me", headers=headers)
    assert me.status_code == 200, me.text
    assert me.json()["id"] == forwarded_user
    assert me.json()["email"] == forwarded_email

    rejected = client.post(
        "/api/watch-rules",
        headers={**headers, "Idempotency-Key": "proxy-gdpr-profileless"},
        json={
            "name": "Profileless proxy must bind a profile",
            "signal_type": "qa_gate",
            "enabled": True,
            "paused": False,
            "issuer_id": None,
            "portfolio_id": None,
            "schedule_kind": "event_driven",
            "schedule_interval_seconds": None,
            "next_evaluation_at": None,
            "config": {
                "operator": "present",
                "threshold": None,
                "kind": "qa_change",
                "title": "Blocked split owner",
                "impact": "A persisted profile is required.",
            },
        },
    )
    assert rejected.status_code == 403, rejected.text
    assert "profile" in rejected.json()["detail"].lower()

    nonexistent_rule = "00000000-0000-0000-0000-000000000001"
    blocked_surface = (
        client.get("/api/watch-rules", headers=headers),
        client.get(f"/api/watch-rules/{nonexistent_rule}", headers=headers),
        client.patch(
            f"/api/watch-rules/{nonexistent_rule}",
            headers=headers,
            json={"expected_version": 1, "patch": {"paused": True}},
        ),
        client.post(
            f"/api/watch-rules/{nonexistent_rule}/evaluate",
            headers=headers,
            json={
                "source_identity": "blocked:profileless-proxy",
                "observed_at": datetime.now(timezone.utc).isoformat(),
                "numeric_value": None,
                "categorical_value": "critical",
                "detail": {},
                "source_artifact_refs": [],
                "hop_count": 0,
            },
        ),
    )
    assert [response.status_code for response in blocked_surface] == [403] * 4
    assert all(
        "profile" in response.json()["detail"].lower()
        for response in blocked_surface
    )
    assert asyncio.run(_c3_owner_row_count(forwarded_user)) == 0
    assert asyncio.run(_c3_owner_row_count(normalized_email)) == 0

    asyncio.run(
        _seed_profileless_document(
            document_id=document_id,
            uploaded_by=differently_cased_email,
            analyst_id=None,
        )
    )
    assert asyncio.run(_document_snapshot(document_id)) == (
        differently_cased_email,
        None,
    )

    summary = asyncio.run(erase_by_email(differently_cased_email))
    assert summary["profile_deleted"] == 0
    assert summary["watch_rules_deleted"] == 0
    assert summary["watch_rule_versions_deleted"] == 0
    assert summary["watch_rule_evaluations_deleted"] == 0
    assert summary["alert_event_contexts_deleted"] == 0
    assert summary["alert_delivery_intents_deleted"] == 0
    assert summary["alert_events_anonymized"] == 0
    assert summary["documents_anonymized"] == 1

    uploaded_by, analyst_id = asyncio.run(_document_snapshot(document_id))
    assert uploaded_by is None
    assert analyst_id is None
    assert asyncio.run(_c3_owner_row_count(forwarded_user)) == 0
    assert asyncio.run(_c3_owner_row_count(normalized_email)) == 0


def test_proxy_without_email_keeps_forwarded_user_fallback(client) -> None:
    forwarded_user = "proxy-user-only-stable-id"
    response = client.get(
        "/api/auth/me",
        headers={
            "X-Forwarded-User": forwarded_user,
            "X-Forwarded-Preferred-Username": "User Only Proxy",
        },
    )
    assert response.status_code == 200, response.text
    assert response.json() == {
        "id": forwarded_user,
        "email": forwarded_user,
        "full_name": "User Only Proxy",
        "role": "analyst",
        "is_active": True,
        "source": "proxy",
    }


def test_proxy_case_variant_profile_ambiguity_is_deterministic_409(client) -> None:
    mixed_email, _normalized_email = asyncio.run(
        _seed_case_variant_profiles(stem="identity-ambiguity")
    )
    response = client.get(
        "/api/auth/me",
        headers=_proxy_headers(
            forwarded_user="identity-ambiguity-subject",
            email=mixed_email.swapcase(),
            preferred_name="Ambiguous Identity",
        ),
    )
    assert response.status_code == 409, response.text
    assert "ambiguous" in response.json()["detail"].lower()


def test_operator_erase_case_variant_profile_ambiguity_fails_closed(client) -> None:
    from erase_analyst import erase_by_email

    mixed_email, _normalized_email = asyncio.run(
        _seed_case_variant_profiles(stem="erase-ambiguity")
    )
    with pytest.raises(RuntimeError, match="Ambiguous analyst email identity"):
        asyncio.run(erase_by_email(mixed_email.swapcase()))


def test_sso_profile_create_case_variant_ambiguity_is_deterministic_409(client) -> None:
    mixed_email, _normalized_email = asyncio.run(
        _seed_case_variant_profiles(stem="create-ambiguity")
    )
    response = client.post(
        "/api/auth/profile",
        headers=_proxy_headers(
            forwarded_user="create-ambiguity-subject",
            email=mixed_email.swapcase(),
            preferred_name="Ambiguous Creator",
        ),
        json={"code": "131113", "name": "Ambiguous Creator"},
    )
    assert response.status_code == 409, response.text
    assert "ambiguous" in response.json()["detail"].lower()


def test_sso_profile_create_normalizes_and_reattaches_case_insensitively(client) -> None:
    profile_id = "23000000-0000-0000-0000-000000000003"
    mixed_email = "Case.Reattach@Example.Test"
    normalized_email = mixed_email.lower()
    asyncio.run(
        _seed_profile(
            profile_id=profile_id,
            email=mixed_email,
            name="Legacy Mixed Case Profile",
            team_id="case-reattach-team",
        )
    )

    response = client.post(
        "/api/auth/profile",
        headers=_proxy_headers(
            forwarded_user="case-reattach-subject",
            email=mixed_email.swapcase(),
            preferred_name="Case Reattach Renamed",
        ),
        json={"code": "131113", "name": "Case Reattach Renamed"},
    )
    assert response.status_code == 201, response.text
    assert response.json()["id"] == profile_id
    assert response.json()["email"] == normalized_email
    assert response.json()["full_name"] == "Case Reattach Renamed"
    assert asyncio.run(_profiles_for_email(normalized_email)) == [
        (profile_id, normalized_email)
    ]
