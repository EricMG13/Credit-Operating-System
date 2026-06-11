"""Anthropic Claude client wrapper for CAOS agents."""

from __future__ import annotations

import json
from typing import Any

import anthropic
from pydantic import BaseModel

from core.config import get_settings

settings = get_settings()

_client: anthropic.AsyncAnthropic | None = None


class AgentResponseError(RuntimeError):
    """Raised when the model response cannot be parsed into the expected form."""


def get_client() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        _client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    return _client


class AgentMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


async def run_agent(
    system_prompt: str,
    messages: list[AgentMessage],
    *,
    model: str | None = None,
    max_tokens: int = 8096,
    temperature: float = 0.0,
    output_schema: type[BaseModel] | None = None,
) -> str | dict[str, Any]:
    """
    Core agent invocation.

    If `output_schema` is provided, the response is parsed as structured JSON
    and returned as a dict. The system prompt is automatically augmented to
    request JSON output conforming to the schema.

    Source-First Discipline is enforced by the caller's system prompt.
    """
    client = get_client()
    resolved_model = model or settings.anthropic_model

    if output_schema:
        schema_json = json.dumps(output_schema.model_json_schema(), indent=2)
        system = (
            f"{system_prompt}\n\n"
            "### OUTPUT REQUIREMENT\n"
            "You MUST respond with valid JSON that strictly conforms to the following schema. "
            "Do not include any prose outside the JSON object.\n\n"
            f"```json\n{schema_json}\n```"
        )
    else:
        system = system_prompt

    response = await client.messages.create(
        model=resolved_model,
        max_tokens=max_tokens,
        temperature=temperature,
        system=system,
        messages=[{"role": m.role, "content": m.content} for m in messages],
    )

    # Extract the first text block; tool-use blocks, refusals, or empty
    # responses won't have `.text`, so fall back gracefully.
    raw_text = next(
        (block.text for block in response.content if getattr(block, "type", None) == "text"),
        None,
    )
    if raw_text is None:
        raise AgentResponseError(
            f"Model returned no text content (stop_reason={response.stop_reason})."
        )

    if output_schema:
        # Strip markdown fences if present
        cleaned = raw_text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        try:
            parsed = json.loads(cleaned)
        except json.JSONDecodeError as e:
            raise AgentResponseError(f"Model did not return valid JSON: {e}") from e
        return output_schema.model_validate(parsed).model_dump()

    return raw_text


async def run_fast_agent(
    system_prompt: str,
    messages: list[AgentMessage],
    **kwargs: Any,
) -> str | dict[str, Any]:
    """Uses claude-haiku for low-latency routing and classification tasks."""
    return await run_agent(
        system_prompt,
        messages,
        model=settings.anthropic_model_fast,
        **kwargs,
    )
