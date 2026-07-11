"""Audit finding #8: uploads were rate-limited (requests/minute per caller) but
not concurrency-capped — every in-flight upload buffers the whole file through
read+scan+parse, so many callers uploading large files at once scales resident
memory with the sum of their sizes. routes.ingestion._upload_semaphore bounds
simultaneous read+scan+parse work, mirroring research_executor's per-job semaphore."""

from __future__ import annotations

import asyncio

import pytest


@pytest.fixture(autouse=True)
def _reset_upload_semaphore():
    """The semaphore is a lazily-built module global — reset it per test so an
    earlier test's concurrency setting doesn't leak into a later one."""
    import routes.ingestion as ingestion

    ingestion._upload_sem = None
    yield
    ingestion._upload_sem = None


def test_upload_semaphore_lazy_inits_from_settings(monkeypatch):
    import routes.ingestion as ingestion
    from config import get_settings

    monkeypatch.setattr(get_settings(), "caos_upload_concurrency", 3)

    async def _check():
        sem = ingestion._upload_semaphore()
        assert isinstance(sem, asyncio.Semaphore)
        assert sem._value == 3  # not yet acquired
        assert ingestion._upload_semaphore() is sem  # same instance on re-call

    asyncio.run(_check())


def test_upload_semaphore_floors_at_one(monkeypatch):
    import routes.ingestion as ingestion
    from config import get_settings

    monkeypatch.setattr(get_settings(), "caos_upload_concurrency", 0)  # misconfigured

    async def _check():
        assert ingestion._upload_semaphore()._value == 1  # max(1, ...) floor

    asyncio.run(_check())


def test_upload_semaphore_bounds_actual_concurrency(monkeypatch):
    """The real property this fix buys: N tasks contending on the semaphore never
    run their guarded section more than `caos_upload_concurrency` at a time."""
    import routes.ingestion as ingestion
    from config import get_settings

    monkeypatch.setattr(get_settings(), "caos_upload_concurrency", 2)

    concurrent = 0
    peak = 0

    async def _guarded_work():
        nonlocal concurrent, peak
        async with ingestion._upload_semaphore():
            concurrent += 1
            peak = max(peak, concurrent)
            await asyncio.sleep(0.02)  # hold the slot long enough for others to queue
            concurrent -= 1

    async def _run():
        await asyncio.gather(*(_guarded_work() for _ in range(8)))

    asyncio.run(_run())
    assert peak == 2  # never exceeded the cap, and did contend (not trivially serial)


def test_upload_semaphore_acquired_around_read_scan_parse_in_all_three_handlers():
    """Structural pin: each handler's read+scan+parse sequence is inside
    `async with _upload_semaphore():` — grep the source rather than driving a
    full multipart upload through the API (heavier, and doesn't add signal over
    the semaphore-bounding test above)."""
    import inspect

    import routes.ingestion as ingestion

    for fn in (ingestion.upload_document, ingestion.upload_pricing_sheet, ingestion.upload_memo):
        src = inspect.getsource(fn)
        sem_at = src.find("_upload_semaphore()")
        read_at = src.find("read_capped(file)")
        assert sem_at != -1, f"{fn.__name__} does not acquire the upload semaphore"
        assert read_at != -1, f"{fn.__name__} does not call read_capped"
        assert sem_at < read_at, f"{fn.__name__}: read_capped is not inside the semaphore block"
