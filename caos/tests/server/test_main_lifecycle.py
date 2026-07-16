from __future__ import annotations

import asyncio

import pytest


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
