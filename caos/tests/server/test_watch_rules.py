"""Focused contract tests for the C3 watch-rule repository."""

from __future__ import annotations

from datetime import datetime, timezone

import pytest
import pytest_asyncio
from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

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
    UpdateWatchRulePatch,
    WatchRuleConflictError,
    WatchRuleNotFoundError,
    WatchRuleValidationError,
    create_watch_rule,
    update_watch_rule,
)


NOW = datetime(2026, 7, 20, 12, tzinfo=timezone.utc)


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
