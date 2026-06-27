"""engine/openrouter.py — the OpenRouter provider adapter: Anthropic-shaped normalization,
translation, overload detection, and seam provider routing.
"""

from __future__ import annotations

import pytest
import httpx
from engine import openrouter, llm_client

# ── Message Translation ──────────────────────────────────────────────────────
def test_translate_messages_string():
    system = "system prompt"
    messages = [
        {"role": "user", "content": "hello"},
        {"role": "assistant", "content": "hi"}
    ]
    out = openrouter._translate_messages(system, messages)
    assert len(out) == 3
    assert out[0] == {"role": "system", "content": "system prompt"}
    assert out[1] == {"role": "user", "content": "hello"}
    assert out[2] == {"role": "assistant", "content": "hi"}

def test_translate_messages_block_list():
    system = [{"type": "text", "text": "system block"}]
    messages = [
        {"role": "user", "content": [{"type": "text", "text": "hello block"}]}
    ]
    out = openrouter._translate_messages(system, messages)
    assert len(out) == 2
    assert out[0] == {"role": "system", "content": "system block"}
    assert out[1] == {"role": "user", "content": "hello block"}

# ── Tool Translation ──────────────────────────────────────────────────────────
def test_translate_tools():
    tools = [{
        "name": "emit_payload",
        "description": "emit payload tool",
        "input_schema": {
            "type": "object",
            "properties": {"value": {"type": "string"}},
            "required": ["value"]
        }
    }]
    tool_choice = {"type": "tool", "name": "emit_payload"}
    
    openai_tools, openai_tool_choice = openrouter._translate_tools(tools, tool_choice)
    
    assert openai_tools is not None
    assert len(openai_tools) == 1
    assert openai_tools[0]["type"] == "function"
    assert openai_tools[0]["function"]["name"] == "emit_payload"
    assert openai_tools[0]["function"]["parameters"]["type"] == "object"
    
    assert openai_tool_choice == {
        "type": "function",
        "function": {"name": "emit_payload"}
    }

# ── Normalization ────────────────────────────────────────────────────────────
def test_normalize_response_text():
    mock_response = {
        "choices": [{
            "message": {
                "role": "assistant",
                "content": "hello response"
            },
            "finish_reason": "stop"
        }],
        "usage": {
            "prompt_tokens": 10,
            "completion_tokens": 5
        }
    }
    
    r = openrouter._normalize_response(mock_response)
    assert len(r.content) == 1
    assert r.content[0].type == "text"
    assert r.content[0].text == "hello response"
    assert r.usage.input_tokens == 10
    assert r.usage.output_tokens == 5
    assert r.stop_reason == "end_turn"

def test_normalize_response_tool_call():
    mock_response = {
        "choices": [{
            "message": {
                "role": "assistant",
                "content": None,
                "tool_calls": [{
                    "function": {
                        "name": "emit_payload",
                        "arguments": "{\"value\": \"test\"}"
                    }
                }]
            },
            "finish_reason": "tool_calls"
        }],
        "usage": {
            "prompt_tokens": 12,
            "completion_tokens": 8
        }
    }
    
    r = openrouter._normalize_response(mock_response)
    assert len(r.content) == 1
    assert r.content[0].type == "tool_use"
    assert r.content[0].name == "emit_payload"
    assert r.content[0].input == {"value": "test"}
    assert r.usage.input_tokens == 12
    assert r.usage.output_tokens == 8
    assert r.stop_reason == "tool_use"

# ── Overload classification ──────────────────────────────────────────────────
def test_is_overloaded():
    req = httpx.Request("POST", "https://openrouter.ai")
    resp_429 = httpx.Response(429, request=req)
    resp_502 = httpx.Response(502, request=req)
    resp_200 = httpx.Response(200, request=req)
    
    assert openrouter.is_overloaded(httpx.HTTPStatusError("Rate Limit", request=req, response=resp_429)) is True
    assert openrouter.is_overloaded(httpx.HTTPStatusError("Bad Gateway", request=req, response=resp_502)) is True
    assert openrouter.is_overloaded(httpx.HTTPStatusError("OK", request=req, response=resp_200)) is False
    assert openrouter.is_overloaded(ValueError("Some other error")) is False

# ── Provider routing ─────────────────────────────────────────────────────────
def test_provider_detection():
    assert llm_client._provider("deepseek/deepseek-v4-pro") == "openrouter"
    assert llm_client._provider("deepseek-v4-pro") == "openrouter"
    assert llm_client._provider("openrouter/something") == "openrouter"
    assert llm_client._provider("gemini-2.5-flash") == "gemini"
    assert llm_client._provider("claude-opus-4-8") == "anthropic"

# ── Seam Routing ─────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_seam_routes_openrouter_model_to_adapter(monkeypatch):
    seen = {}
    
    async def fake_call(**kw):
        seen.update(kw)
        return openrouter._Response([openrouter._TextBlock("ok")], openrouter._Usage(1, 1), "end_turn")
        
    monkeypatch.setattr(openrouter, "call", fake_call)
    
    resp = await llm_client.create(
        None, lane="test-lane", model="deepseek/deepseek-v4-pro",
        max_tokens=15, system="sys", messages=[{"role": "user", "content": "ping"}],
    )
    
    assert seen["model"] == "deepseek/deepseek-v4-pro"
    assert seen["max_tokens"] == 15
    assert resp.content[0].text == "ok"
