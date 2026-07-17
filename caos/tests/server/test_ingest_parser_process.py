"""Upload parsers run in killable child processes, not immortal pool threads."""

from __future__ import annotations

import multiprocessing
import operator
import time

import pytest
from fastapi import HTTPException

import ingest
from config import get_settings


@pytest.mark.asyncio
async def test_parse_bounded_returns_child_result(monkeypatch):
    monkeypatch.setattr(get_settings(), "upload_parse_timeout_s", 2)
    assert await ingest.parse_bounded(operator.add, 20, 22) == 42


@pytest.mark.asyncio
async def test_parse_bounded_terminates_child_at_deadline(monkeypatch):
    monkeypatch.setattr(get_settings(), "upload_parse_timeout_s", 0.05)
    started = time.monotonic()
    with pytest.raises(HTTPException) as exc:
        await ingest.parse_bounded(time.sleep, 5)
    assert exc.value.status_code == 422
    assert time.monotonic() - started < 2
    assert not [
        child for child in multiprocessing.active_children()
        if child.name == "caos-upload-parser"
    ]


@pytest.mark.asyncio
async def test_parse_bounded_preserves_parser_error(monkeypatch):
    monkeypatch.setattr(get_settings(), "upload_parse_timeout_s", 2)
    with pytest.raises(ValueError):
        await ingest.parse_bounded(int, "not-an-integer")
