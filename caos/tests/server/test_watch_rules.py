"""Focused contract tests for the C3 watch-rule repository."""

from __future__ import annotations

import asyncio
import json
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

import pytest
import pytest_asyncio
from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from alert_contracts import SignalObservation, SubjectScope
from alert_triggers import claim_scheduled_rule
from config import get_settings
from database import (
    Base,
    Issuer,
    Portfolio,
    WatchRule,
    WatchRuleEvaluation,
    WatchRuleVersion,
)
from identity import CallerIdentity
from watch_rules import (
    CreateWatchRuleCommand,
    RuleConfig,
    SHARED_TENANT_ID,
    UpdateWatchRulePatch,
    WatchRuleConflictError,
    WatchRuleIdempotencyConflictError,
    WatchRuleNotFoundError,
    WatchRuleValidationError,
    create_watch_rule,
    update_watch_rule,
)


NOW = datetime(2026, 7, 20, 12, tzinfo=timezone.utc)


def _exact_canonical_json_object(maximum: int) -> dict[str, str]:
    """Build an object whose compact, UTF-8 wire form is exactly ``maximum``."""
    payload = {"payload": ""}
    empty_size = len(
        json.dumps(
            payload,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        ).encode("utf-8")
    )
    unicode_units, ascii_remainder = divmod(maximum - empty_size, 2)
    payload["payload"] = "é" * unicode_units + "x" * ascii_remainder
    encoded = json.dumps(
        payload,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    assert len(encoded) == maximum
    return payload


def _caller(
    user_id: str = "alice", *, role: str = "analyst", team_id: str | None = "desk-a"
) -> CallerIdentity:
    return CallerIdentity(
        id=user_id,
        email=f"{user_id}@example.test",
        full_name=user_id.title(),
        role=role,
        team_id=team_id,
    )


def _config(**overrides: object) -> RuleConfig:
    payload = {
        "operator": "present",
        "threshold": None,
        "kind": "credit_change",
        "title": "Credit signal changed",
        "impact": "Review the governed evidence.",
    }
    payload.update(overrides)
    return RuleConfig.model_validate(payload)


def _command(**overrides: object) -> CreateWatchRuleCommand:
    payload = {
        "name": "Run finding watch",
        "signal_type": "run_finding",
        "enabled": True,
        "paused": False,
        "issuer_id": None,
        "portfolio_id": None,
        "schedule_kind": "event_driven",
        "schedule_interval_seconds": None,
        "next_evaluation_at": None,
        "config": _config(),
    }
    payload.update(overrides)
    return CreateWatchRuleCommand.model_validate(payload)


@pytest_asyncio.fixture
async def rule_db(tmp_path):
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'rules.db'}")
    async with engine.begin() as connection:
        await connection.run_sync(
            lambda sync: Base.metadata.create_all(
                sync,
                tables=[
                    Issuer.__table__,
                    Portfolio.__table__,
                    WatchRule.__table__,
                    WatchRuleVersion.__table__,
                    WatchRuleEvaluation.__table__,
                ],
            )
        )
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    try:
        yield sessions
    finally:
        await engine.dispose()


@pytest.mark.parametrize(
    ("payload", "message"),
    [
        ({"operator": "present", "threshold": 1}, "forbids"),
        ({"operator": "eq", "threshold": ""}, "requires"),
        ({"operator": "eq", "threshold": True}, "finite non-boolean"),
        ({"operator": "gt", "threshold": "4"}, "finite non-boolean"),
        ({"operator": "lte", "threshold": float("nan")}, "finite non-boolean"),
        ({"operator": "lte", "threshold": float("inf")}, "finite non-boolean"),
        ({"operator": "bogus", "threshold": None}, "operator"),
    ],
)
def test_rule_config_rejects_invalid_operator_threshold_pairs(payload, message) -> None:
    with pytest.raises(ValidationError, match=message):
        RuleConfig.model_validate(
            {
                **payload,
                "kind": "kind",
                "title": "title",
                "impact": "impact",
            }
        )


def test_rule_config_is_strict_frozen_and_bounded() -> None:
    with pytest.raises(ValidationError):
        RuleConfig.model_validate(
            {
                "operator": "present",
                "kind": "kind",
                "title": "title",
                "impact": "impact",
                "owner_user_id": "forged",
            }
        )
    with pytest.raises(ValidationError, match="65536"):
        RuleConfig(
            operator="eq",
            threshold="x" * 65_536,
            kind="kind",
            title="title",
            impact="impact",
        )
    config = _config()
    with pytest.raises(ValidationError):
        config.title = "changed"


@pytest.mark.parametrize(
    "overrides",
    [
        {"schedule_kind": "event_driven", "schedule_interval_seconds": 60},
        {"schedule_kind": "event_driven", "next_evaluation_at": NOW},
        {
            "schedule_kind": "interval",
            "schedule_interval_seconds": 59,
            "next_evaluation_at": NOW,
        },
        {
            "schedule_kind": "interval",
            "schedule_interval_seconds": 86_401,
            "next_evaluation_at": NOW,
        },
        {
            "schedule_kind": "interval",
            "schedule_interval_seconds": 60,
            "next_evaluation_at": None,
        },
        {
            "schedule_kind": "interval",
            "schedule_interval_seconds": 60,
            "next_evaluation_at": datetime(2026, 7, 20, 12),
        },
    ],
)
def test_create_command_validates_schedule_before_repository_use(overrides) -> None:
    with pytest.raises(ValidationError):
        _command(**overrides)


@pytest.mark.parametrize("signal_type", ["edgar_filing", "market_move", "news"])
def test_source_unavailable_rules_may_only_be_stored_disabled(signal_type: str) -> None:
    with pytest.raises(ValidationError, match="disabled"):
        _command(signal_type=signal_type, enabled=True)
    assert _command(signal_type=signal_type, enabled=False).enabled is False


def test_signal_operator_vocabulary_is_enforced() -> None:
    with pytest.raises(ValidationError, match="operator"):
        _command(
            signal_type="run_finding", config=_config(operator="gt", threshold=2.0)
        )
    assert (
        _command(
            signal_type="covenant", config=_config(operator="gte", threshold=4.0)
        ).config.threshold
        == 4.0
    )


def test_numeric_signal_rejects_eq_string_threshold_at_create_validation() -> None:
    with pytest.raises(ValidationError, match="numeric signals require"):
        _command(
            signal_type="covenant",
            config=_config(operator="eq", threshold="4"),
        )
    assert (
        _command(
            signal_type="qa_gate",
            config=_config(operator="eq", threshold="critical"),
        ).config.threshold
        == "critical"
    )


@pytest.mark.parametrize(
    "overrides",
    [
        {"enabled": "false"},
        {"paused": "true"},
        {
            "schedule_kind": "interval",
            "schedule_interval_seconds": "60",
            "next_evaluation_at": NOW,
        },
        {
            "schedule_kind": "interval",
            "schedule_interval_seconds": 60,
            "next_evaluation_at": "2026-07-20T12:00:00Z",
        },
    ],
)
def test_create_command_rejects_coercive_scalar_inputs(overrides) -> None:
    with pytest.raises(ValidationError):
        _command(**overrides)


@pytest.mark.parametrize(
    "payload",
    [
        {"enabled": "false"},
        {"paused": "true"},
        {"schedule_interval_seconds": "60"},
        {"next_evaluation_at": "2026-07-20T12:00:00Z"},
    ],
)
def test_update_patch_rejects_coercive_scalar_inputs(payload) -> None:
    with pytest.raises(ValidationError):
        UpdateWatchRulePatch.model_validate(payload)


def test_internal_models_still_accept_real_typed_values() -> None:
    command = _command(
        signal_type="covenant",
        schedule_kind="interval",
        schedule_interval_seconds=60,
        next_evaluation_at=NOW,
        config=_config(operator="eq", threshold=4),
    )
    assert command.enabled is True
    assert command.schedule_interval_seconds == 60
    assert command.config.threshold == 4.0


@pytest.mark.parametrize(
    "patch",
    [
        {"schedule_interval_seconds": 59},
        {"schedule_interval_seconds": 86_401},
        {"schedule_kind": "event_driven", "next_evaluation_at": NOW},
        {"signal_type": "news", "enabled": True},
        {
            "signal_type": "qa_gate",
            "config": _config(operator="gt", threshold=1.0),
        },
    ],
)
def test_update_patch_rejects_intrinsically_invalid_state_before_database_use(
    patch,
) -> None:
    with pytest.raises(ValidationError):
        UpdateWatchRulePatch.model_validate(patch)


@pytest.mark.asyncio
async def test_update_expected_version_type_is_a_stable_domain_validation_error() -> (
    None
):
    with pytest.raises(WatchRuleValidationError):
        # No database object is needed because validation must happen first.
        await update_watch_rule(None, _caller(), "rule", "1", UpdateWatchRulePatch())


@pytest.mark.asyncio
async def test_create_derives_shared_scope_and_never_accepts_identity_stamps(
    rule_db, monkeypatch
) -> None:
    monkeypatch.setattr(get_settings(), "caos_tenancy_enabled", False)
    with pytest.raises(ValidationError):
        CreateWatchRuleCommand.model_validate(
            {**_command().model_dump(), "tenant_id": "forged"}
        )

    async with rule_db() as session:
        first = await create_watch_rule(session, _caller(team_id="desk-a"), _command())
        second = await create_watch_rule(
            session, _caller("bob", team_id="desk-b"), _command(name="Second")
        )
        assert first.tenant_id == second.tenant_id
        assert first.team_id_snapshot == second.team_id_snapshot
        assert first.owner_user_id == "alice"
        assert first.current_version == 1
        versions = (
            (
                await session.execute(
                    select(WatchRuleVersion).order_by(WatchRuleVersion.created_at)
                )
            )
            .scalars()
            .all()
        )
        assert [(version.watch_rule_id, version.version) for version in versions] == [
            (first.id, 1),
            (second.id, 1),
        ]


@pytest.mark.asyncio
async def test_create_idempotency_replays_one_rule_and_keeps_caller_transaction(
    rule_db, monkeypatch
) -> None:
    monkeypatch.setattr(get_settings(), "caos_tenancy_enabled", False)
    command = _command(name="Durable create")
    key = "watch-rule-create-retry-1"

    async with rule_db() as session:
        async with session.begin():
            first = await create_watch_rule(
                session, _caller(), command, idempotency_key=key
            )
        first_id = first.id

    async with rule_db() as session:
        async with session.begin():
            replay = await create_watch_rule(
                session, _caller(), command, idempotency_key=key
            )
            assert replay.id == first_id
            with pytest.raises(WatchRuleIdempotencyConflictError):
                await create_watch_rule(
                    session,
                    _caller(),
                    _command(name="Changed analyst intent"),
                    idempotency_key=key,
                )
            # The conflict must not roll back or poison the caller-owned
            # transaction; an unrelated write can still commit.
            unrelated = await create_watch_rule(
                session, _caller(), _command(name="Unrelated transaction write")
            )
        unrelated_id = unrelated.id

    async with rule_db() as session:
        rules = (
            (
                await session.execute(
                    select(WatchRule).where(
                        WatchRule.name.in_(
                            ("Durable create", "Unrelated transaction write")
                        )
                    )
                )
            )
            .scalars()
            .all()
        )
        assert {rule.id for rule in rules} == {first_id, unrelated_id}
        durable = next(rule for rule in rules if rule.id == first_id)
        assert durable.create_idempotency_key == key
        assert len(durable.create_request_sha256) == 64
        assert await session.scalar(
            select(func.count())
            .select_from(WatchRuleVersion)
            .where(WatchRuleVersion.watch_rule_id == first_id)
        ) == 1


@pytest.mark.asyncio
async def test_create_idempotency_key_is_scoped_by_derived_tenant_and_owner(
    rule_db, monkeypatch
) -> None:
    monkeypatch.setattr(get_settings(), "caos_tenancy_enabled", True)
    key = "common-client-generated-key"
    async with rule_db() as session:
        async with session.begin():
            alice = await create_watch_rule(
                session,
                _caller("alice", team_id="desk-a"),
                _command(),
                idempotency_key=key,
            )
            bob = await create_watch_rule(
                session,
                _caller("bob", team_id="desk-a"),
                _command(),
                idempotency_key=key,
            )
            other_tenant = await create_watch_rule(
                session,
                _caller("alice", team_id="desk-b"),
                _command(),
                idempotency_key=key,
            )

    assert len({alice.id, bob.id, other_tenant.id}) == 3


@pytest.mark.asyncio
async def test_concurrent_create_retries_converge_on_one_rule_and_version(
    rule_db, monkeypatch
) -> None:
    monkeypatch.setattr(get_settings(), "caos_tenancy_enabled", False)
    command = _command(name="Concurrent durable create")
    key = "concurrent-watch-rule-create"

    async def create_once() -> str:
        async with rule_db() as session:
            async with session.begin():
                rule = await create_watch_rule(
                    session, _caller(), command, idempotency_key=key
                )
            return rule.id

    first_id, second_id = await asyncio.gather(create_once(), create_once())
    assert first_id == second_id

    async with rule_db() as session:
        assert await session.scalar(
            select(func.count())
            .select_from(WatchRule)
            .where(WatchRule.create_idempotency_key == key)
        ) == 1
        assert await session.scalar(
            select(func.count())
            .select_from(WatchRuleVersion)
            .where(WatchRuleVersion.watch_rule_id == first_id)
        ) == 1


@pytest.mark.asyncio
async def test_wire_valid_near_limit_unicode_detail_persists(rule_db, monkeypatch) -> None:
    """Dialect serialization expansion must not reject a wire-valid observation."""
    monkeypatch.setattr(get_settings(), "caos_tenancy_enabled", False)
    detail = _exact_canonical_json_object(64 * 1024)
    correlation = uuid4()
    observation = SignalObservation(
        signal_type="run_finding",
        subject_scope=SubjectScope(
            tenant_id=SHARED_TENANT_ID,
            issuer_id=None,
            portfolio_id=None,
        ),
        source_identity="manual:near-limit",
        observed_at=NOW,
        detail=detail,
        correlation_id=correlation,
        correlation_root_id=correlation,
        hop_count=0,
    )

    async with rule_db() as session:
        rule = await create_watch_rule(session, _caller(), _command())
        session.add(
            WatchRuleEvaluation(
                tenant_id=rule.tenant_id,
                owner_user_id=rule.owner_user_id,
                team_id_snapshot=rule.team_id_snapshot,
                watch_rule_id=rule.id,
                rule_version=rule.current_version,
                signal_type=observation.signal_type,
                subject_scope_json=observation.subject_scope.model_dump(mode="json"),
                source_identity=observation.source_identity,
                observation_key="f" * 64,
                outcome="observed",
                correlation_id=str(correlation),
                correlation_root_id=str(correlation),
                hop_count=0,
                evaluated_at=NOW,
                detail_json=observation.detail,
            )
        )
        await session.commit()

    async with rule_db() as session:
        persisted = await session.scalar(select(WatchRuleEvaluation))
        assert persisted is not None
        assert persisted.detail_json == detail


@pytest.mark.asyncio
async def test_create_uses_team_or_unassigned_scope_when_tenancy_is_enabled(
    rule_db, monkeypatch
) -> None:
    monkeypatch.setattr(get_settings(), "caos_tenancy_enabled", True)
    async with rule_db() as session:
        team_rule = await create_watch_rule(
            session, _caller(team_id="desk-a"), _command()
        )
        unassigned_rule = await create_watch_rule(
            session, _caller("bob", team_id=None), _command(name="Unassigned")
        )
        assert team_rule.tenant_id == "desk-a"
        assert team_rule.team_id_snapshot == "desk-a"
        assert unassigned_rule.tenant_id == unassigned_rule.team_id_snapshot
        assert unassigned_rule.tenant_id != team_rule.tenant_id


@pytest.mark.asyncio
async def test_create_checks_issuer_and_portfolio_visibility(
    rule_db, monkeypatch
) -> None:
    monkeypatch.setattr(get_settings(), "caos_tenancy_enabled", True)
    async with rule_db() as session:
        issuer = Issuer(id="issuer-b", name="Foreign issuer", team_id="desk-b")
        portfolio = Portfolio(id="portfolio-b", name="Foreign book", team_id="desk-b")
        session.add_all([issuer, portfolio])
        await session.flush()
        with pytest.raises(WatchRuleNotFoundError):
            await create_watch_rule(
                session, _caller(team_id="desk-a"), _command(issuer_id=issuer.id)
            )
        with pytest.raises(WatchRuleNotFoundError):
            await create_watch_rule(
                session, _caller(team_id="desk-a"), _command(portfolio_id=portfolio.id)
            )


@pytest.mark.asyncio
async def test_create_leaves_commit_and_rollback_to_the_caller(
    rule_db, monkeypatch
) -> None:
    monkeypatch.setattr(get_settings(), "caos_tenancy_enabled", False)
    async with rule_db() as session:
        await create_watch_rule(session, _caller(), _command())
        assert (await session.scalar(select(func.count()).select_from(WatchRule))) == 1
        await session.rollback()
    async with rule_db() as verify:
        assert await verify.scalar(select(func.count()).select_from(WatchRule)) == 0
        assert (
            await verify.scalar(select(func.count()).select_from(WatchRuleVersion)) == 0
        )


@pytest.mark.asyncio
async def test_update_masks_non_owner_and_foreign_tenant_as_not_found(
    rule_db, monkeypatch
) -> None:
    monkeypatch.setattr(get_settings(), "caos_tenancy_enabled", True)
    async with rule_db() as session:
        rule = await create_watch_rule(session, _caller(), _command())
        await session.commit()
        with pytest.raises(WatchRuleNotFoundError):
            await update_watch_rule(
                session,
                _caller("bob", team_id="desk-a"),
                rule.id,
                1,
                UpdateWatchRulePatch(name="Enumerated"),
            )
        with pytest.raises(WatchRuleNotFoundError):
            await update_watch_rule(
                session,
                _caller("mallory", team_id="desk-b"),
                rule.id,
                1,
                UpdateWatchRulePatch(name="Foreign"),
            )
        updated = await update_watch_rule(
            session,
            _caller("admin", role="admin", team_id="desk-a"),
            rule.id,
            1,
            UpdateWatchRulePatch(name="Admin edit"),
        )
        assert updated.name == "Admin edit"


@pytest.mark.asyncio
async def test_update_creates_one_immutable_version_and_rejects_stale_version(
    rule_db, monkeypatch
) -> None:
    monkeypatch.setattr(get_settings(), "caos_tenancy_enabled", False)
    async with rule_db() as session:
        rule = await create_watch_rule(session, _caller(), _command())
        await session.commit()
        updated = await update_watch_rule(
            session,
            _caller(),
            rule.id,
            1,
            UpdateWatchRulePatch(
                config=_config(
                    operator="eq", threshold="critical", title="Critical finding"
                )
            ),
        )
        assert updated.current_version == 2
        await session.commit()

        versions = (
            (
                await session.execute(
                    select(WatchRuleVersion)
                    .where(WatchRuleVersion.watch_rule_id == rule.id)
                    .order_by(WatchRuleVersion.version)
                )
            )
            .scalars()
            .all()
        )
        assert [version.version for version in versions] == [1, 2]
        assert versions[0].config_json["operator"] == "present"
        assert versions[1].config_json["threshold"] == "critical"

        with pytest.raises(WatchRuleConflictError):
            await update_watch_rule(
                session,
                _caller(),
                rule.id,
                1,
                UpdateWatchRulePatch(name="stale mutation"),
            )
        assert updated.name == "Run finding watch"
        assert updated.current_version == 2
        assert (
            await session.scalar(
                select(func.count())
                .select_from(WatchRuleVersion)
                .where(WatchRuleVersion.watch_rule_id == rule.id)
            )
            == 2
        )


@pytest.mark.asyncio
async def test_update_refreshes_a_stale_session_before_optimistic_version_check(
    rule_db, monkeypatch
) -> None:
    monkeypatch.setattr(get_settings(), "caos_tenancy_enabled", False)
    async with rule_db() as seed:
        rule = await create_watch_rule(seed, _caller(), _command())
        await seed.commit()
        rule_id = rule.id

    async with rule_db() as stale, rule_db() as winner:
        cached = await stale.get(WatchRule, rule_id)
        assert cached.current_version == 1
        await update_watch_rule(
            winner,
            _caller(),
            rule_id,
            1,
            UpdateWatchRulePatch(name="winner"),
        )
        await winner.commit()

        with pytest.raises(WatchRuleConflictError):
            await update_watch_rule(
                stale,
                _caller(),
                rule_id,
                1,
                UpdateWatchRulePatch(name="stale"),
            )
        assert cached.current_version == 2


@pytest.mark.asyncio
async def test_update_preserves_schedule_invariants_without_partial_mutation(
    rule_db, monkeypatch
) -> None:
    monkeypatch.setattr(get_settings(), "caos_tenancy_enabled", False)
    async with rule_db() as session:
        rule = await create_watch_rule(session, _caller(), _command())
        await session.commit()
        with pytest.raises(WatchRuleValidationError):
            await update_watch_rule(
                session,
                _caller(),
                rule.id,
                1,
                UpdateWatchRulePatch(
                    schedule_kind="interval",
                    schedule_interval_seconds=60,
                ),
            )
        assert rule.schedule_kind == "event_driven"
        assert rule.current_version == 1

        updated = await update_watch_rule(
            session,
            _caller(),
            rule.id,
            1,
            UpdateWatchRulePatch(
                schedule_kind="interval",
                schedule_interval_seconds=60,
                next_evaluation_at=NOW,
            ),
        )
        assert updated.current_version == 2
        assert updated.next_evaluation_at == NOW


@pytest.mark.asyncio
async def test_explicit_terminal_schedule_resume_resets_attempts_and_is_claimable(
    rule_db, monkeypatch
) -> None:
    monkeypatch.setattr(get_settings(), "caos_tenancy_enabled", False)
    watermark = NOW - timedelta(hours=1)
    async with rule_db() as session:
        rule = await create_watch_rule(
            session,
            _caller(),
            _command(
                paused=True,
                schedule_kind="interval",
                schedule_interval_seconds=60,
                next_evaluation_at=NOW - timedelta(minutes=1),
            ),
        )
        rule.claim_attempt_count = 5
        rule.schedule_cursor = "retained-cursor"
        rule.last_evaluated_at = watermark
        await session.commit()

        resumed = await update_watch_rule(
            session,
            _caller(),
            rule.id,
            1,
            UpdateWatchRulePatch(paused=False),
        )
        assert resumed.claim_attempt_count == 0
        assert resumed.schedule_cursor == "retained-cursor"
        persisted_watermark = resumed.last_evaluated_at
        if persisted_watermark.tzinfo is None:
            persisted_watermark = persisted_watermark.replace(tzinfo=timezone.utc)
        assert persisted_watermark == watermark
        await session.commit()

    async with rule_db() as session:
        claim = await claim_scheduled_rule(session, now=NOW)
        assert claim is not None
        assert claim.rule_id == UUID(rule.id)
        assert claim.attempt_count == 1


@pytest.mark.asyncio
async def test_numeric_signal_rejects_eq_string_threshold_on_merged_update(
    rule_db, monkeypatch
) -> None:
    monkeypatch.setattr(get_settings(), "caos_tenancy_enabled", False)
    async with rule_db() as session:
        rule = await create_watch_rule(
            session,
            _caller(),
            _command(
                signal_type="covenant",
                config=_config(operator="present"),
            ),
        )
        await session.commit()
        with pytest.raises(WatchRuleValidationError, match="numeric signals require"):
            await update_watch_rule(
                session,
                _caller(),
                rule.id,
                1,
                UpdateWatchRulePatch(config=_config(operator="eq", threshold="4")),
            )
        assert rule.current_version == 1
        assert (
            await session.scalar(
                select(func.count())
                .select_from(WatchRuleVersion)
                .where(WatchRuleVersion.watch_rule_id == rule.id)
            )
            == 1
        )


@pytest.mark.asyncio
async def test_fresh_session_name_patch_normalizes_sqlite_scheduled_datetime(
    rule_db, monkeypatch
) -> None:
    monkeypatch.setattr(get_settings(), "caos_tenancy_enabled", False)
    offset_time = datetime(
        2026,
        7,
        20,
        12,
        tzinfo=timezone(timedelta(hours=5, minutes=30)),
    )
    expected_utc = datetime(2026, 7, 20, 6, 30, tzinfo=timezone.utc)
    async with rule_db() as creator:
        rule = await create_watch_rule(
            creator,
            _caller(),
            _command(
                schedule_kind="interval",
                schedule_interval_seconds=60,
                next_evaluation_at=offset_time,
            ),
        )
        assert rule.next_evaluation_at == expected_utc
        await creator.commit()
        rule_id = rule.id

    async with rule_db() as fresh:
        reloaded = await fresh.get(WatchRule, rule_id)
        assert reloaded.next_evaluation_at is not None
        assert reloaded.next_evaluation_at.tzinfo is None  # SQLite driver behavior
        updated = await update_watch_rule(
            fresh,
            _caller(),
            rule_id,
            1,
            UpdateWatchRulePatch(name="Renamed schedule"),
        )
        assert updated.current_version == 2
        assert updated.next_evaluation_at == expected_utc
