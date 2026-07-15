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
