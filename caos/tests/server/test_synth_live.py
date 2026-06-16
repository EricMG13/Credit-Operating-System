"""Live-synthesis path tests (SYNTH-1).

The live LLM path is the product thesis and was previously untested — every other
server test forces ``ANTHROPIC_API_KEY=""`` and runs fixture-only. These exercise
``LiveSynthesizer`` against a **mocked Anthropic client** (no key, no network), so
CI covers: a well-formed structured-output response, truncation, a prose-wrapped
text fallback, a schema-violating payload, the one-shot repair (success + failure),
and the budget guard that skips the repair when the per-run cap is spent.
"""

from __future__ import annotations

import os

import pytest

from engine import budget
from engine.schemas import validate_payload
from engine.synth import (
    LiveSynthesizer,
    SynthesisError,
    _extract_payload,
    _payload_from_data,
)


# ── Fakes ────────────────────────────────────────────────────────────────────
class _Block:
    def __init__(self, type, **kw):
        self.type = type
        for k, v in kw.items():
            setattr(self, k, v)


class _Usage:
    def __init__(self, input_tokens=10, output_tokens=20):
        self.input_tokens = input_tokens
        self.output_tokens = output_tokens


class _Resp:
    def __init__(self, content, stop_reason="tool_use", usage=None):
        self.content = content
        self.stop_reason = stop_reason
        self.usage = usage or _Usage()


def _tool_use(data, stop_reason="tool_use"):
    return _Resp(
        [_Block("tool_use", id="t1", name="emit_module_payload", input=data)],
        stop_reason=stop_reason,
    )


def _text(text, stop_reason="end_turn"):
    return _Resp([_Block("text", text=text)], stop_reason=stop_reason)


class _FakeMessages:
    def __init__(self, responses):
        self._responses = list(responses)
        self.calls = []

    async def create(self, **kwargs):
        self.calls.append(kwargs)
        if not self._responses:
            raise AssertionError("messages.create called more times than expected")
        return self._responses.pop(0)


class _FakeClient:
    def __init__(self, responses):
        self.messages = _FakeMessages(responses)


class _Hit:
    def __init__(self, chunk_id, text):
        self.chunk_id = chunk_id
        self.text = text
        self.score = 1.0


async def _retrieve(query, k=5):
    return [_Hit("c1", "Revenue was 100 in FY24.")]


def _good_payload():
    return {
        "module_name": "CP-1 Financials",
        "owned_object": "normalized_financials",
        "runtime_output": {"revenue": 100},
        "confidence": "High",
        "limitation_flags": [],
        "downstream_consumers": ["CP-2"],
        "claims": [
            {
                "claim_id": "C1",
                "claim_text": "Revenue was 100 in FY24.",
                "evidence": [
                    {
                        "evidence_id": "E1",
                        "extraction_type": "sourced_fact",
                        "lineage_class": "Directly Sourced",
                        "source_locator": "chunk c1",
                        "confidence": "High",
                    }
                ],
            }
        ],
    }


def _bad_enum_payload():
    p = _good_payload()
    p["claims"][0]["evidence"][0]["extraction_type"] = "totally_made_up"
    return p


def _make_synth(responses):
    s = LiveSynthesizer()
    s._client = _FakeClient(responses)  # bypass _get_client → no anthropic import, no key
    s._active_prompt = lambda module_id: "ACTIVE PROMPT (stub)"  # don't depend on the corpus files
    return s


async def _run(synth, module_id="CP-1"):
    return await synth.synthesize(
        module_id, issuer_name="Atlas Forge", upstream={}, retrieve=_retrieve
    )


@pytest.fixture(autouse=True)
def _reset_budget():
    budget.set_budget(None)
    yield
    budget.set_budget(None)


# ── Tests ──────────────────────────────────────────────────────────────────--
@pytest.mark.asyncio
async def test_well_formed_tool_use_returns_validated_payload():
    synth = _make_synth([_tool_use(_good_payload())])
    payload = await _run(synth)

    assert payload.module_id == "CP-1"
    assert payload.confidence == "High"
    assert len(payload.claims) == 1
    assert payload.claims[0].evidence[0].extraction_type == "sourced_fact"
    assert validate_payload(payload) == []
    # exactly one call, and it forced the structured-output tool
    assert len(synth._client.messages.calls) == 1
    call = synth._client.messages.calls[0]
    assert call["tool_choice"]["name"] == "emit_module_payload"
    assert call["tools"][0]["name"] == "emit_module_payload"


@pytest.mark.asyncio
async def test_truncated_first_response_is_repaired():
    synth = _make_synth([
        _tool_use(_good_payload(), stop_reason="max_tokens"),  # truncated → repair
        _tool_use(_good_payload()),                            # repair succeeds
    ])
    payload = await _run(synth)

    assert payload.confidence == "High"
    assert len(synth._client.messages.calls) == 2


@pytest.mark.asyncio
async def test_prose_wrapped_json_text_fallback():
    import json

    body = "Here is the payload you asked for:\n" + json.dumps(_good_payload()) + "\nThanks!"
    synth = _make_synth([_text(body)])  # no tool_use block → text-JSON fallback
    payload = await _run(synth)

    assert payload.confidence == "High"
    assert len(synth._client.messages.calls) == 1  # fallback parsed it; no repair


@pytest.mark.asyncio
async def test_schema_violation_is_repaired():
    synth = _make_synth([
        _tool_use(_bad_enum_payload()),  # bad extraction_type → validate fails → repair
        _tool_use(_good_payload()),      # repair succeeds
    ])
    payload = await _run(synth)

    assert payload.claims[0].evidence[0].extraction_type == "sourced_fact"
    assert len(synth._client.messages.calls) == 2
    # the repair turn fed the validation error back to the model
    repair_msg = synth._client.messages.calls[1]["messages"][0]["content"]
    assert "INVALID" in repair_msg and "extraction_type" in repair_msg


@pytest.mark.asyncio
async def test_repair_failure_raises_synthesis_error():
    synth = _make_synth([
        _tool_use(_bad_enum_payload()),  # first invalid
        _tool_use(_bad_enum_payload()),  # repair also invalid → gate
    ])
    with pytest.raises(SynthesisError, match="after one repair"):
        await _run(synth)
    assert len(synth._client.messages.calls) == 2


@pytest.mark.asyncio
async def test_budget_exhausted_skips_repair():
    budget.set_budget(budget.RunBudget(limit=1))  # spent after the first call's usage
    synth = _make_synth([_tool_use(_bad_enum_payload())])  # only one response available
    with pytest.raises(SynthesisError, match="repair skipped"):
        await _run(synth)
    assert len(synth._client.messages.calls) == 1  # no second (repair) call


@pytest.mark.asyncio
async def test_initial_budget_exhausted_gates_before_any_call():
    b = budget.RunBudget(limit=1)
    b.used = 5  # already over
    budget.set_budget(b)
    synth = _make_synth([])  # no call should be made
    with pytest.raises(SynthesisError, match="token budget exhausted"):
        await _run(synth)
    assert len(synth._client.messages.calls) == 0


@pytest.mark.asyncio
async def test_no_real_api_key_required():
    # The whole live path is exercised with no ANTHROPIC_API_KEY and a fake client.
    assert not os.environ.get("ANTHROPIC_API_KEY")
    synth = _make_synth([_tool_use(_good_payload())])
    payload = await _run(synth)
    assert payload.module_id == "CP-1"


# ── Direct unit coverage of the extractor ─────────────────────────────────────
def test_extract_payload_flags_truncation():
    payload, err = _extract_payload("CP-1", _tool_use(_good_payload(), stop_reason="max_tokens"))
    assert payload is None and "truncated" in err


def test_extract_payload_flags_schema_violation():
    payload, err = _extract_payload("CP-1", _tool_use(_bad_enum_payload()))
    assert payload is None and "extraction_type" in err


def test_extract_payload_accepts_good_tool_use():
    payload, err = _extract_payload("CP-1", _tool_use(_good_payload()))
    assert err is None and payload.confidence == "High"


def test_payload_from_data_is_defensive_on_empty():
    # A near-empty dict still constructs (degenerate) — validate_payload then judges it.
    p = _payload_from_data("CP-1", {})
    assert p.module_id == "CP-1"
    assert p.confidence == "Insufficient Information"
    assert p.claims == []
