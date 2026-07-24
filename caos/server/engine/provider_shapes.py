"""Anthropic-shaped response objects shared by the OpenRouter and Gemini
adapters, so both providers present the same surface to synth/council/debate."""

from __future__ import annotations

from typing import Any, List, Optional


class TextBlock:
    type = "text"

    def __init__(self, text: str):
        self.text = text


class ToolUseBlock:
    type = "tool_use"

    def __init__(self, name: str, inp: dict):
        self.name = name
        self.input = inp


class Usage:
    def __init__(
        self,
        input_tokens: int,
        output_tokens: int,
        cache_read_input_tokens: int = 0,
        cache_creation_input_tokens: int = 0,
        cost: Optional[float] = None,
    ):
        self.input_tokens = input_tokens
        self.output_tokens = output_tokens
        self.cache_read_input_tokens = cache_read_input_tokens
        self.cache_creation_input_tokens = cache_creation_input_tokens
        self.cost = cost


class Response:
    def __init__(self, content: List[Any], usage: Usage, stop_reason: str):
        self.content = content
        self.usage = usage
        self.stop_reason = stop_reason
