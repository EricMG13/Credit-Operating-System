"""engine.llm_client — the single live-Messages seam.

Covers M-2 (overload → cheaper-model fallback, and re-raise for non-overload)
and M-1 (one structured caos.llm trace line per call, tagged with the run id).
The Anthropic SDK errors need an httpx response to construct, so `is_overloaded`
is monkeypatched to classify a local sentinel instead — the value under test is
llm_client.create's control flow, not the SDK's exception taxonomy.
"""
from __future__ import annotations

import json
import logging

import pytest

from engine import budget, llm_client


class _Usage:
    input_tokens = 10
    output_tokens = 5
    cache_read_input_tokens = 0
    cache_creation_input_tokens = 0


class _Resp:
    def __init__(self, model: str):
        self.usage = _Usage()
        self.stop_reason = "end_turn"
        self.model = model


class _Client:
    """Fake Anthropic client: raises ``error`` the first ``fail_times`` calls, then
    returns a response. ``client.messages.create`` resolves to ``create`` here."""

    def __init__(self, error: Exception | None = None, fail_times: int = 0):
        self.error = error
        self.fail_times = fail_times
        self.calls: list[str] = []
        self.messages = self

    async def create(self, **kwargs):
        self.calls.append(kwargs["model"])
        if self.fail_times > 0:
            self.fail_times -= 1
            raise self.error
        return _Resp(kwargs["model"])


class _Overload(Exception):
    pass


@pytest.mark.asyncio
async def test_create_falls_back_to_cheaper_model_on_overload(monkeypatch, caplog):
    monkeypatch.setattr(llm_client, "is_overloaded", lambda e: isinstance(e, _Overload))
    client = _Client(error=_Overload(), fail_times=1)

    with caplog.at_level(logging.INFO, logger="caos.llm"):
        resp = await llm_client.create(
            client, lane="t", model="big-model", fallback_model="cheap-model",
            max_tokens=10, messages=[],
        )

    assert client.calls == ["big-model", "cheap-model"]  # primary overloaded → retried cheaper
    assert resp.model == "cheap-model"
    # M-1: the trace must LABEL the degraded call as a fallback on the cheaper model
    # (the operational signal for how often overload degradation fires).
    trace = [r.message for r in caplog.records if r.name == "caos.llm"]
    assert trace, "no caos.llm trace emitted on the fallback path"
    rec = json.loads(trace[-1])
    assert rec["fallback"] is True and rec["model"] == "cheap-model"


@pytest.mark.asyncio
async def test_create_reraises_non_overload_without_fallback(monkeypatch):
    monkeypatch.setattr(llm_client, "is_overloaded", lambda e: False)
    client = _Client(error=RuntimeError("boom"), fail_times=1)

    with pytest.raises(RuntimeError):
        await llm_client.create(
            client, lane="t", model="m", fallback_model="m2", max_tokens=10, messages=[],
        )
    assert client.calls == ["m"]  # no retry on a non-overload error


@pytest.mark.asyncio
async def test_create_no_fallback_when_primary_equals_fallback(monkeypatch):
    """If the primary already IS the cheap model, an overload must surface, not loop."""
    monkeypatch.setattr(llm_client, "is_overloaded", lambda e: isinstance(e, _Overload))
    client = _Client(error=_Overload(), fail_times=99)

    with pytest.raises(_Overload):
        await llm_client.create(
            client, lane="t", model="cheap", fallback_model="cheap", max_tokens=10, messages=[],
        )
    assert client.calls == ["cheap"]  # tried once, no second attempt


@pytest.mark.asyncio
async def test_create_emits_trace_line_tagged_with_run_id(caplog):
    client = _Client()
    budget.set_run_id("run-xyz")
    try:
        with caplog.at_level(logging.INFO, logger="caos.llm"):
            await llm_client.create(client, lane="chat", model="m", max_tokens=10, messages=[])
    finally:
        budget.set_run_id(None)

    lines = [r.message for r in caplog.records if r.name == "caos.llm"]
    assert lines, "no caos.llm trace line emitted"
    rec = json.loads(lines[-1])
    assert rec["event"] == "llm_call"
    assert rec["lane"] == "chat" and rec["run_id"] == "run-xyz"
    assert rec["model"] == "m" and rec["fallback"] is False
    assert rec["input_tokens"] == 10 and rec["output_tokens"] == 5
    assert rec["stop_reason"] == "end_turn"
