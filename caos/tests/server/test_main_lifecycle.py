from __future__ import annotations

import asyncio

import pytest


def _fixture_credential(label: str, length: int) -> str:
    """Build non-secret boundary material without a credential-shaped literal."""
    return (f"{label}-" + "0123456789abcdef" * 4)[:length]


@pytest.mark.parametrize(
    ("name", "value", "minimum"),
    [
        ("EDGE_PROXY_SECRET", _fixture_credential("edge", 32), 32),
        ("SESSION_SECRET", _fixture_credential("session", 32), 32),
        ("ANALYST_SIGNUP_CODE", _fixture_credential("invite", 16), 16),
    ],
)
def test_deployed_credential_strength_accepts_exact_policy_boundaries(
    name: str,
    value: str,
    minimum: int,
):
    from main import _require_deployed_credential_strength

    assert len(value.encode("utf-8")) == minimum
    _require_deployed_credential_strength(name, value, min_bytes=minimum)


@pytest.mark.parametrize(
    ("value", "minimum"),
    [
        ("short", 32),
        ("a" * 32, 32),
        (" random-material-0123456789abcdef", 32),
        ("invite-code-a1b", 16),
    ],
)
def test_deployed_credential_strength_rejects_structurally_weak_values(
    value: str,
    minimum: int,
):
    from main import _require_deployed_credential_strength

    with pytest.raises(RuntimeError, match="too weak for production"):
        _require_deployed_credential_strength("TEST_SECRET", value, min_bytes=minimum)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("field", "expected_name"),
    [
        ("edge_proxy_secret", "EDGE_PROXY_SECRET"),
        ("session_secret", "SESSION_SECRET"),
        ("analyst_signup_code", "ANALYST_SIGNUP_CODE"),
    ],
)
async def test_lifespan_rejects_weak_deployed_credentials_before_startup(
    monkeypatch,
    field: str,
    expected_name: str,
):
    from fastapi import FastAPI

    import main

    deployed = main.settings.model_copy(
        update={
            "environment": "production",
            "edge_proxy_secret": _fixture_credential("edge", 32),
            "session_secret": _fixture_credential("session", 32),
            "analyst_signup_code": _fixture_credential("invite", 16),
            field: "short",
        }
    )
    monkeypatch.setattr(main, "settings", deployed)

    with pytest.raises(RuntimeError, match=expected_name):
        async with main.lifespan(FastAPI()):
            pytest.fail("Weak production credentials must fail before startup.")


@pytest.mark.asyncio
async def test_cancel_and_drain_finishes_a_blocked_warmup_task():
    from main import _cancel_and_drain

    started = asyncio.Event()
    cancelled = asyncio.Event()

    async def blocked_warmup():
        started.set()
        try:
            await asyncio.Event().wait()
        finally:
            cancelled.set()

    task = asyncio.create_task(blocked_warmup())
    await started.wait()
    await _cancel_and_drain(task)

    assert task.done()
    assert task.cancelled()
    assert cancelled.is_set()


@pytest.mark.asyncio
async def test_lifespan_retains_and_drains_embeddings_warmup_task(monkeypatch):
    """Pin the full lifespan wiring: the warmup task is strongly referenced on
    app.state and drained before executor shutdown completes."""
    from fastapi import FastAPI

    import engine.embeddings as embeddings
    import main

    events: list[str] = []
    started = asyncio.Event()
    cancelled = asyncio.Event()

    class DummyExecutor:
        name = "dummy"

        async def start(self):
            events.append(f"start:{self.name}")

        async def stop(self):
            events.append(f"stop:{self.name}")

    async def noop():
        return None

    async def blocked_warmup(_session):
        started.set()
        try:
            await asyncio.Event().wait()
        finally:
            cancelled.set()
            events.append("warmup:drained")

    run_executor = DummyExecutor()
    run_executor.name = "run"
    research_executor = DummyExecutor()
    research_executor.name = "research"
    report_executor = DummyExecutor()
    report_executor.name = "report"
    pipeline_executor = DummyExecutor()
    pipeline_executor.name = "pipeline"

    monkeypatch.setattr(main, "settings", main.settings.model_copy(update={
        "environment": "development",
        "caos_demo_seed": False,
    }))
    monkeypatch.setattr(main, "require_sane_environment", lambda _settings: None)
    monkeypatch.setattr(main, "require_postgres_in_production", lambda _settings: None)
    monkeypatch.setattr(main, "require_malware_scanner_in_production", lambda _settings: None)
    monkeypatch.setattr(main, "init_db", noop)
    monkeypatch.setattr(main, "get_executor", lambda: run_executor)
    monkeypatch.setattr(main, "get_research_executor", lambda: research_executor)
    monkeypatch.setattr(main, "get_report_executor", lambda: report_executor)
    monkeypatch.setattr(main, "PipelineExecutor", lambda: pipeline_executor)
    monkeypatch.setattr(embeddings, "warmup_embeddings_task", blocked_warmup)

    app = FastAPI()
    async with main.lifespan(app):
        await started.wait()
        retained = app.state.embeddings_warmup_task
        assert retained.get_name() == "caos-embeddings-warmup"
        assert retained.done() is False

    assert retained.done() and retained.cancelled()
    assert cancelled.is_set()
    assert events.index("warmup:drained") < events.index("stop:pipeline")
