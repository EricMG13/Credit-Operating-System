"""Gemini provider adapter — presents google-genai as an Anthropic-shaped seam.

CAOS's LLM lanes read responses with getattr-lenient duck typing:
``resp.content`` (a list of blocks; a text block has ``.type=="text"`` + ``.text``,
a forced-tool block has ``.type=="tool_use"`` + ``.input`` dict), ``resp.usage``
(``.input_tokens`` / ``.output_tokens`` / ``.cache_read_input_tokens`` /
``.cache_creation_input_tokens``), and ``resp.stop_reason``. This module calls
google-genai and returns an object that quacks like an Anthropic ``Message``, so
the existing seam (``engine/llm_client.create``) and trace
(``engine/budget.trace_llm``) work unchanged — no caller edits.

PR-2 routes the text lanes (chat, council, debate, nlquery, scenario, extract)
and the single-forced-tool synth path. The two-tool advisor path
(``config.advisor_enabled``) stays Anthropic-only. google-genai is imported
lazily, so the package is only required when a ``gemini-*`` model is selected.

Live-unverified (needs a real GEMINI_API_KEY — see PR notes): that
``parameters_json_schema`` accepts every CAOS synth schema; that
``thoughts_token_count`` is populated; that ``prompt_token_count`` includes the
cached prefix (the basis for the net-out below); the exact ``finish_reason`` for
a forced call. The synth text-block JSON fallback and lenient usage reads defend
against the first three.
"""

from __future__ import annotations

import functools
from typing import Any, List, Optional

from config import get_settings


class GeminiUnsupported(Exception):
    """A call shape PR-2 deliberately does not route to Gemini (e.g. the multi-tool
    advisor path) — the caller keeps it on Anthropic."""


def _genai():
    from google import genai  # noqa: PLC0415 — lazy: only needed when a gemini model is used
    return genai


def _types():
    from google.genai import types  # noqa: PLC0415
    return types


@functools.lru_cache(maxsize=1)
def get_client():
    genai = _genai()
    from google.genai import types  # noqa: PLC0415

    s = get_settings()
    # HttpOptions.timeout is milliseconds; bound it so a stalled Gemini call can't hang
    # a request lane (parity with the Anthropic timeout). ponytail: opt-in lane, only
    # built when a gemini model is used.
    http_options = types.HttpOptions(timeout=int(s.caos_llm_timeout_s * 1000))
    # api_key omitted -> SDK reads GOOGLE_API_KEY / GEMINI_API_KEY from the env.
    return (
        genai.Client(api_key=s.gemini_api_key, http_options=http_options)
        if s.gemini_api_key
        else genai.Client(http_options=http_options)
    )


# ── Anthropic → Gemini translation ───────────────────────────────────────────
def _system_text(system) -> Optional[str]:
    """Anthropic system (str OR a list of {type:text,text,...} blocks) -> plain str.

    Synth passes a cache_control-tagged block list; Gemini wants a plain string."""
    if system is None:
        return None
    if isinstance(system, str):
        return system
    parts = [b.get("text", "") for b in system if isinstance(b, dict) and b.get("type") == "text"]
    return "\n".join(p for p in parts if p) or None


def _media_part(block: dict):
    """Anthropic ``image``/``document`` block -> a Gemini inline-data Part.

    Only base64 sources are translated; anything else returns None so the block is
    skipped rather than sent as a broken part. Callers that REQUIRE the media to
    arrive (the vision extractor) must not route to a provider whose adapter would
    drop it — silently degrading a multimodal read to a text-only prompt would
    produce confident output about a document the model never saw.
    """
    import base64

    source = block.get("source")
    if not isinstance(source, dict) or source.get("type") != "base64":
        return None
    data, media_type = source.get("data"), source.get("media_type")
    if not data or not media_type:
        return None
    try:
        raw = base64.b64decode(data)
    except Exception:  # noqa: BLE001 — a malformed block is skipped, never fatal
        return None
    return _types().Part(inline_data=_types().Blob(mime_type=media_type, data=raw))


def _to_contents(messages: List[dict]):
    types = _types()
    out = []
    for m in messages:
        role = "model" if m.get("role") == "assistant" else "user"  # Gemini: assistant -> model
        content = m.get("content", "")
        if isinstance(content, str):
            parts = [types.Part(text=content)]
        else:
            parts = []
            for b in content:
                if not isinstance(b, dict):
                    continue
                if b.get("type") == "text":
                    parts.append(types.Part(text=b["text"]))
                elif b.get("type") in ("image", "document"):
                    media = _media_part(b)
                    if media is not None:
                        parts.append(media)
        out.append(types.Content(role=role, parts=parts))
    return out


# ── Effort -> thinking config ────────────────────────────────────────────────
# 2.5 integer budgets (verified ranges): flash/flash-lite 0..24576 (0 disables),
# pro 128..32768 (cannot disable; floor 128). flash-lite checked before flash so
# the startswith match doesn't collide (identical tables, but explicit).
_BUDGETS_25 = {
    "gemini-2.5-flash-lite": {"minimal": 0, "low": 1024, "medium": 8192, "high": 24576},
    "gemini-2.5-flash": {"minimal": 0, "low": 1024, "medium": 8192, "high": 24576},
    "gemini-2.5-pro": {"minimal": 128, "low": 128, "medium": 8192, "high": 32768},
}


_EFFORTS = ("minimal", "low", "medium", "high")


def _thinking_config(model: str, effort: Optional[str]):
    types = _types()
    eff = (effort or "medium").lower()
    if eff not in _EFFORTS:
        eff = "medium"  # clamp: an out-of-vocab level builds client-side but 400s live
    # Gemini 3 uses a thinking_level enum (pro has no 'minimal'); 2.5 uses an integer
    # budget. Never set both in one request (server 400). thinking_level exists only in
    # google-genai 2.x (py3.10+) — fall back to a budget when absent, so a gemini-3 id
    # can't crash an older SDK at construction.
    if model.startswith("gemini-3") and "thinking_level" in types.ThinkingConfig.model_fields:
        level = "low" if ("pro" in model and eff == "minimal") else eff
        return types.ThinkingConfig(thinking_level=level)
    fam = next((k for k in _BUDGETS_25 if model.startswith(k)), "gemini-2.5-flash")
    return types.ThinkingConfig(thinking_budget=_BUDGETS_25[fam][eff])


# ── Normalization: Gemini response -> Anthropic-shaped object ─────────────────
# Gemini FinishReason -> Anthropic stop_reason (trace-only; unmapped -> end_turn).
# MALFORMED_FUNCTION_CALL is a failure, not a tool call, so it is left to default to
# end_turn rather than emitting a misleading tool_use stop with no tool block.
_STOP_MAP = {
    "STOP": "end_turn", "MAX_TOKENS": "max_tokens",
    "SAFETY": "stop_sequence", "RECITATION": "stop_sequence",
}


class _TextBlock:
    type = "text"

    def __init__(self, text: str):
        self.text = text


class _ToolUseBlock:
    type = "tool_use"

    def __init__(self, name: str, inp: dict):
        self.name = name
        self.input = inp  # parsed dict — what synth's tool_use reader expects


class _Usage:
    def __init__(self, input_tokens, output_tokens,
                 cache_read_input_tokens=0, cache_creation_input_tokens=0):
        self.input_tokens = input_tokens
        self.output_tokens = output_tokens
        self.cache_read_input_tokens = cache_read_input_tokens
        self.cache_creation_input_tokens = cache_creation_input_tokens


class _Response:
    def __init__(self, content, usage, stop_reason):
        self.content = content
        self.usage = usage
        self.stop_reason = stop_reason


def normalize(resp) -> _Response:
    """Gemini GenerateContentResponse -> Anthropic-shaped response. All reads are
    getattr-lenient so an SDK shape drift degrades gracefully, never crashes."""
    blocks: List[Any] = []
    text = getattr(resp, "text", None)  # concatenated text parts of candidate 0; may be None
    if text:
        blocks.append(_TextBlock(text))
    for fc in (getattr(resp, "function_calls", None) or []):
        blocks.append(_ToolUseBlock(getattr(fc, "name", ""), dict(getattr(fc, "args", None) or {})))

    um = getattr(resp, "usage_metadata", None)
    prompt = (getattr(um, "prompt_token_count", 0) or 0) if um else 0
    cand = (getattr(um, "candidates_token_count", 0) or 0) if um else 0
    thoughts = (getattr(um, "thoughts_token_count", 0) or 0) if um else 0
    cached = (getattr(um, "cached_content_token_count", 0) or 0) if um else 0
    tool_use = (getattr(um, "tool_use_prompt_token_count", 0) or 0) if um else 0
    # Gemini total = prompt + candidates + tool_use + thoughts, and prompt_token_count
    # already includes the cached prefix. Map so CAOS's budget (input + cache_read +
    # cache_creation) round-trips to the true total without double-counting: net the
    # cached prefix out of input, carry it as cache_read, fold the tool-use prompt into
    # input. Thinking bills as output, so fold thoughts into output_tokens.
    usage = _Usage(
        input_tokens=max(prompt - cached, 0) + tool_use,
        output_tokens=cand + thoughts,
        cache_read_input_tokens=min(cached, prompt),
    )

    stop = "end_turn"
    cands = getattr(resp, "candidates", None)
    if cands:
        fr = getattr(cands[0], "finish_reason", None)
        fr_name = getattr(fr, "name", None) or (str(fr) if fr is not None else None)
        if fr_name:
            stop = _STOP_MAP.get(fr_name, "end_turn")
    if any(getattr(b, "type", None) == "tool_use" for b in blocks):
        stop = "tool_use"  # forced-tool lanes present a tool_use stop reason
    return _Response(blocks, usage, stop)


# ── The call ─────────────────────────────────────────────────────────────────
async def call(*, model, system, messages, max_tokens, effort=None, tools=None, tool_choice=None):
    """One google-genai call, returned as an Anthropic-shaped response.

    Forced-tool path when ``tools`` + a forced ``tool_choice`` ({"type":"tool"})
    are present (synth); plain text otherwise. A multi-tool
    ``tool_choice={"type":"any"}`` (advisor path) raises GeminiUnsupported."""
    types = _types()
    client = get_client()
    forced = bool(tools) and isinstance(tool_choice, dict) and tool_choice.get("type") == "tool"
    cfg = dict(
        system_instruction=_system_text(system),
        max_output_tokens=max_tokens,
        thinking_config=_thinking_config(model, effort),
    )
    if forced:
        if len(tools) != 1:
            raise GeminiUnsupported("multi-tool forced choice is Anthropic-only")
        tool = tools[0]
        fn = types.FunctionDeclaration(
            name=tool["name"],
            description=tool.get("description", ""),
            parameters_json_schema=tool.get("input_schema") or tool.get("parameters_json_schema"),
        )
        cfg.update(
            tools=[types.Tool(function_declarations=[fn])],
            automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
            tool_config=types.ToolConfig(
                function_calling_config=types.FunctionCallingConfig(
                    mode=types.FunctionCallingConfigMode.ANY,
                    allowed_function_names=[tool["name"]],
                ),
            ),
        )
    elif tools:
        raise GeminiUnsupported("non-forced tool use is not routed to Gemini")

    resp = await client.aio.models.generate_content(
        model=model,
        contents=_to_contents(messages),
        config=types.GenerateContentConfig(**cfg),
    )
    return normalize(resp)


def is_overloaded(exc: Exception) -> bool:
    """True for retry-on-a-cheaper-model cases on Gemini: 429 / RESOURCE_EXHAUSTED
    and 5xx / UNAVAILABLE. Read leniently so an SDK shape change degrades to
    "don't fall back", never to a crash."""
    try:
        from google.genai import errors  # noqa: PLC0415
    except Exception:  # noqa: BLE001 — SDK absent => can't classify => don't fall back
        return False
    if not isinstance(exc, getattr(errors, "APIError", ())):
        return False
    code = getattr(exc, "code", None)
    status = getattr(exc, "status", None)
    return code in (429, 500, 503) or status in ("RESOURCE_EXHAUSTED", "UNAVAILABLE")
