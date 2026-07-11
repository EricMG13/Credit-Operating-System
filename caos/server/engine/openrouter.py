"""OpenRouter provider adapter — presents OpenRouter as an Anthropic-shaped seam."""

from __future__ import annotations

import httpx
import logging
from typing import Any, List, Optional

from config import get_settings

logger = logging.getLogger("caos.llm")

class _TextBlock:
    type = "text"
    def __init__(self, text: str):
        self.text = text

class _ToolUseBlock:
    type = "tool_use"
    def __init__(self, name: str, inp: dict):
        self.name = name
        self.input = inp

class _Usage:
    def __init__(self, input_tokens: int, output_tokens: int):
        self.input_tokens = input_tokens
        self.output_tokens = output_tokens
        self.cache_read_input_tokens = 0
        self.cache_creation_input_tokens = 0

class _Response:
    def __init__(self, content: List[Any], usage: _Usage, stop_reason: str):
        self.content = content
        self.usage = usage
        self.stop_reason = stop_reason

def _translate_messages(system: Any, messages: Optional[List[dict]]) -> List[dict]:
    out: List[dict] = []
    # If system prompt is present, prepend it as a system message
    if system:
        if isinstance(system, str):
            out.append({"role": "system", "content": system})
        elif isinstance(system, list):
            parts = [b.get("text", "") for b in system if isinstance(b, dict) and b.get("type") == "text"]
            system_text = "\n".join(p for p in parts if p)
            if system_text:
                out.append({"role": "system", "content": system_text})

    for m in messages or []:
        role = m.get("role")
        content = m.get("content", "")
        # Normalize content to string
        if not isinstance(content, str):
            parts = [b.get("text", "") for b in content if isinstance(b, dict) and b.get("type") == "text"]
            content = "\n".join(p for p in parts if p)
        out.append({"role": role, "content": content})
    return out

def _translate_tools(tools: Optional[List[dict]], tool_choice: Optional[dict]) -> tuple[Optional[List[dict]], Optional[Any]]:
    if not tools:
        return None, None
    
    openai_tools = []
    for tool in tools:
        openai_tools.append({
            "type": "function",
            "function": {
                "name": tool["name"],
                "description": tool.get("description", ""),
                "parameters": tool.get("input_schema") or tool.get("parameters_json_schema")
            }
        })
    
    openai_tool_choice: Any = None
    if tool_choice:
        if tool_choice.get("type") == "tool":
            openai_tool_choice = {
                "type": "function",
                "function": {"name": tool_choice["name"]}
            }
        elif tool_choice.get("type") == "any":
            openai_tool_choice = "required"
        elif tool_choice.get("type") == "auto":
            openai_tool_choice = "auto"
            
    return openai_tools, openai_tool_choice

def _normalize_response(data: dict) -> _Response:
    choices = data.get("choices", [])
    blocks: List[Any] = []
    stop_reason = "end_turn"
    
    if choices:
        choice = choices[0]
        message = choice.get("message", {})
        
        # Text content
        text = message.get("content")
        if text:
            blocks.append(_TextBlock(text))
            
        # Tool / function calls. `or []`, not a .get default: OpenAI-compatible
        # providers serialize "tool_calls": null on text-only replies, and dict.get
        # returns that None (TypeError on iteration, discarding a valid response).
        tool_calls = message.get("tool_calls") or []
        for tc in tool_calls:
            func = tc.get("function", {})
            name = func.get("name", "")
            # Fail-closed parse: stdlib json accepts NaN/Infinity, which would land a
            # non-finite number in a CP-1 tool-argument and poison a downstream divide.
            # loads_finite rejects those; a reject (or any malformed args) degrades to {}.
            from engine.llm_safety import loads_finite
            try:
                args = loads_finite(func.get("arguments", "{}"))
            except Exception:
                args = {}
            blocks.append(_ToolUseBlock(name, args))
            
        # Stop reason mapping
        finish_reason = choice.get("finish_reason", "")
        if finish_reason == "stop":
            stop_reason = "end_turn"
        elif finish_reason == "length":
            stop_reason = "max_tokens"
        elif finish_reason == "tool_calls":
            stop_reason = "tool_use"
            
    usage_data = data.get("usage", {})
    usage = _Usage(
        input_tokens=usage_data.get("prompt_tokens", 0),
        output_tokens=usage_data.get("completion_tokens", 0)
    )
    
    return _Response(blocks, usage, stop_reason)

async def call(*, lane: str, model: str, system: Any = None, messages: Optional[List[dict]] = None,
               max_tokens: Optional[int] = None, tools: Optional[List[dict]] = None,
               tool_choice: Optional[dict] = None, effort: Optional[str] = None):
    s = get_settings()
    
    if not s.openrouter_api_key:
        raise RuntimeError("OpenRouter API key is not configured (set OPENROUTER_API_KEY in .env)")
        
    translated_messages = _translate_messages(system, messages)
    openai_tools, openai_tool_choice = _translate_tools(tools, tool_choice)
    
    payload: dict[str, Any] = {
        "model": model,
        "messages": translated_messages,
    }
    if max_tokens is not None:
        payload["max_tokens"] = max_tokens
    if openai_tools:
        payload["tools"] = openai_tools
    if openai_tool_choice:
        payload["tool_choice"] = openai_tool_choice
        
    headers = {
        "Authorization": f"Bearer {s.openrouter_api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/EricMG13/Credit-Operating-System",
        "X-Title": "CAOS",
    }
    
    async with httpx.AsyncClient(timeout=s.caos_llm_timeout_s) as client:
        response = await client.post(
            f"{s.openrouter_base_url}/chat/completions",
            json=payload,
            headers=headers,
        )
        response.raise_for_status()
        data = response.json()
        return _normalize_response(data)

def is_overloaded(exc: Exception) -> bool:
    """True for retry-on-a-cheaper-model cases on OpenRouter (HTTP 429/502/503/529)."""
    if not isinstance(exc, httpx.HTTPStatusError):
        return False
    return exc.response.status_code in (429, 502, 503, 529)
