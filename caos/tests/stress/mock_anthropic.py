"""Mock Anthropic + OpenRouter APIs for stress / fault injection — no tokens, no network.

Point the app at it:
    ANTHROPIC_BASE_URL=http://127.0.0.1:8099 ANTHROPIC_API_KEY=test \
    OPENROUTER_BASE_URL=http://127.0.0.1:8099 OPENROUTER_API_KEY=test ...
The anthropic SDK (0.109 / 0.111) reads ``ANTHROPIC_BASE_URL`` when ``base_url``
isn't passed; ``engine/openrouter.py`` reads ``OPENROUTER_BASE_URL`` the same
way (config.openrouter_base_url). Together every lane (engine synth, chat,
nlquery, scenario, deepresearch — Anthropic *or* the DeepSeek-hybrid-default
OpenRouter path) hits this instead of the real API — no prod-code change
needed. (Gemini lanes are separate, engine/gemini.py — not covered here.)

MOCK_MODE (read per request, so a supervisor can flip it between scenarios):
  ok    canned reply — JSON, or SSE when the caller sets ``stream: true``  [default]
  429   rate-limit   → exercises the no-backoff path (S-ENG-02 / S-EXT-02)
  529   overloaded   → same
  hang  sleep ~forever → exercises the no-timeout path (S-ENG-03 / S-API-05 / S-EXT-01)

ponytail: the canned text is deliberately dumb — strict-JSON lanes (nlquery /
synth) may degrade on it; that's a valid degraded-path test, not a mock bug.
Make the text smarter only if you need LLM *success*-path load (you usually don't).
"""
from __future__ import annotations

import asyncio
import json
import os

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, Response, StreamingResponse

app = FastAPI(title="mock-anthropic")

_TEXT = "Mock response. Not real analysis."


def _mode() -> str:
    return os.environ.get("MOCK_MODE", "ok").lower()


def _message() -> dict:
    return {
        "id": "msg_mock",
        "type": "message",
        "role": "assistant",
        "model": "mock",
        "content": [{"type": "text", "text": _TEXT}],
        "stop_reason": "end_turn",
        "stop_sequence": None,
        "usage": {"input_tokens": 1, "output_tokens": 1},
    }


def _sse():
    """Minimal valid Anthropic SSE event sequence the SDK stream parser accepts."""
    def ev(t: str, d: dict) -> str:
        return f"event: {t}\ndata: {json.dumps(d)}\n\n"

    yield ev("message_start", {"type": "message_start", "message": {**_message(), "content": []}})
    yield ev("content_block_start",
             {"type": "content_block_start", "index": 0, "content_block": {"type": "text", "text": ""}})
    yield ev("content_block_delta",
             {"type": "content_block_delta", "index": 0, "delta": {"type": "text_delta", "text": _TEXT}})
    yield ev("content_block_stop", {"type": "content_block_stop", "index": 0})
    yield ev("message_delta",
             {"type": "message_delta", "delta": {"stop_reason": "end_turn", "stop_sequence": None},
              "usage": {"output_tokens": 1}})
    yield ev("message_stop", {"type": "message_stop"})


@app.post("/v1/messages")
async def messages(req: Request):
    mode = _mode()
    if mode == "hang":
        await asyncio.sleep(86_400)  # holds the caller's slot until it gives up
    if mode in ("429", "529"):
        code = int(mode)
        kind = "overloaded_error" if code == 529 else "rate_limit_error"
        return JSONResponse({"type": "error", "error": {"type": kind, "message": f"mock {code}"}},
                            status_code=code)
    body = await req.json()
    if body.get("stream"):
        return StreamingResponse(_sse(), media_type="text/event-stream")
    return JSONResponse(_message())


def _chat_completion() -> dict:
    """OpenAI chat-completions shape — what engine/openrouter.py._normalize_response expects."""
    return {
        "id": "chatcmpl-mock",
        "choices": [{
            "message": {"role": "assistant", "content": _TEXT},
            "finish_reason": "stop",
        }],
        "usage": {"prompt_tokens": 1, "completion_tokens": 1},
    }


@app.post("/chat/completions")
async def chat_completions(req: Request):
    """OpenRouter-compatible route (engine/openrouter.py posts to
    ``{OPENROUTER_BASE_URL}/chat/completions``) — same MOCK_MODE dispatch as
    ``/v1/messages`` above, OpenAI response shape instead of Anthropic's."""
    mode = _mode()
    if mode == "hang":
        await asyncio.sleep(86_400)  # holds the caller's slot until it gives up
    if mode in ("429", "529"):
        code = int(mode)
        return JSONResponse({"error": {"message": f"mock {code}"}}, status_code=code)
    await req.json()
    return JSONResponse(_chat_completion())


@app.get("/healthz")
def healthz() -> Response:
    return Response(status_code=204)
