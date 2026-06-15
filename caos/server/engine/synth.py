"""Module synthesis — how a module turns inputs into a payload.

Two implementations behind one interface, mirroring the demo-mode pattern in
[llm.py]:

  - FixtureSynthesizer — returns the canonical ATLF payloads. Used when no model
    key is configured, so the whole engine (persistence, retrieval, lineage,
    gate) is fully exercisable and testable offline.
  - LiveSynthesizer — reads the module's on-disk Active Prompt from
    ``Modular OS/``, grounds it in retrieved document chunks, calls Claude, and
    parses the JSON payload. The methodology prompt files stay the single source
    of truth; we never fork them into code.

``get_synthesizer`` picks Live when ANTHROPIC_API_KEY is set, else Fixture.
"""

from __future__ import annotations

import json
import logging
import re
from pathlib import Path
from typing import Awaitable, Callable, Dict, List, Protocol

from config import SERVER_DIR, get_settings
from engine import budget
from engine.fixtures import atlf_payload
from engine.llm_safety import UNTRUSTED_RULE, wrap_untrusted
from engine.schemas import ClaimSpec, EvidenceSpec, ModulePayload

logger = logging.getLogger("caos.engine")

# Modular OS lives at the repo root, two levels above the server dir.
MODULAR_OS_DIR = SERVER_DIR.parent.parent / "Modular OS"

RetrieveFn = Callable[[str, int], Awaitable[list]]


class SynthesisError(RuntimeError):
    """Raised when a module cannot produce a valid payload (runner gates it)."""


class Synthesizer(Protocol):
    name: str

    async def synthesize(
        self,
        module_id: str,
        *,
        issuer_name: str,
        upstream: Dict[str, ModulePayload],
        retrieve: RetrieveFn,
    ) -> ModulePayload: ...


class FixtureSynthesizer:
    name = "fixture"

    async def synthesize(self, module_id, *, issuer_name, upstream, retrieve):
        payload = atlf_payload(module_id)
        if payload is None:
            raise SynthesisError(f"No fixture payload for {module_id}")
        return payload


class LiveSynthesizer:
    name = "live"

    def __init__(self) -> None:
        self._settings = get_settings()
        self._client = None

    def _get_client(self):
        if self._client is None:
            import anthropic

            self._client = anthropic.AsyncAnthropic(api_key=self._settings.anthropic_api_key)
        return self._client

    def _active_prompt(self, module_id: str) -> str:
        path = MODULAR_OS_DIR / module_id / f"{module_id}_ACTIVE_PROMPT.md"
        if not path.is_file():
            raise SynthesisError(f"Active prompt not found for {module_id} at {path}")
        return path.read_text(encoding="utf-8")

    async def synthesize(self, module_id, *, issuer_name, upstream, retrieve):
        if not budget.llm_allowed():
            raise SynthesisError(f"{module_id}: per-run token budget exhausted")
        active_prompt = self._active_prompt(module_id)
        hits = await retrieve(f"{issuer_name} {module_id} financials covenants leverage liquidity", 8)
        grounding = "\n\n".join(f"[chunk {h.chunk_id}]\n{h.text}" for h in hits) or "(no documents)"
        upstream_json = json.dumps(
            {mid: p.runtime_output for mid, p in upstream.items()}, default=str
        )

        system = (
            active_prompt
            + "\n\n---\nReturn ONLY a JSON object for this module's payload with keys: "
            "module_name, owned_object, runtime_output (object), confidence "
            "(High|Medium|Low|Insufficient Information), limitation_flags (array), "
            "downstream_consumers (array), and claims (array of {claim_id, claim_text, "
            "evidence:[{evidence_id, extraction_type, lineage_class, source_locator, "
            "confidence}]}). Ground every claim in the SOURCE CHUNKS; never invent figures.\n\n"
            + UNTRUSTED_RULE
        )
        user = (f"ISSUER: {issuer_name}\n\nUPSTREAM OUTPUTS:\n{upstream_json}\n\n"
                f"SOURCE CHUNKS:\n{wrap_untrusted(grounding)}")

        resp = await self._get_client().messages.create(
            model=self._settings.anthropic_model,
            max_tokens=4096,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        budget.record_usage(resp)
        text = next((b.text for b in resp.content if b.type == "text"), "")
        return _parse_payload(module_id, text)


def _parse_payload(module_id: str, text: str) -> ModulePayload:
    """Parse a model JSON response into a ModulePayload (defensive)."""
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        raise SynthesisError(f"{module_id}: model returned no JSON object")
    try:
        data = json.loads(match.group(0))
    except json.JSONDecodeError as e:
        raise SynthesisError(f"{module_id}: payload JSON did not parse ({e})") from e

    claims: List[ClaimSpec] = []
    for c in data.get("claims", []):
        evidence = [
            EvidenceSpec(
                evidence_id=str(e.get("evidence_id", "")),
                extraction_type=str(e.get("extraction_type", "")),
                lineage_class=str(e.get("lineage_class", "")),
                source_locator=str(e.get("source_locator", "")),
                confidence=str(e.get("confidence", "Medium")),
            )
            for e in c.get("evidence", [])
        ]
        claims.append(
            ClaimSpec(
                claim_id=str(c.get("claim_id", "")),
                claim_text=str(c.get("claim_text", "")),
                evidence=evidence,
            )
        )

    return ModulePayload(
        module_id=module_id,
        module_name=str(data.get("module_name", module_id)),
        owned_object=str(data.get("owned_object", "")),
        runtime_output=data.get("runtime_output", {}) or {},
        claims=claims,
        confidence=str(data.get("confidence", "Insufficient Information")),
        limitation_flags=list(data.get("limitation_flags", []) or []),
        downstream_consumers=list(data.get("downstream_consumers", []) or []),
    )


def get_synthesizer() -> Synthesizer:
    if get_settings().anthropic_api_key:
        return LiveSynthesizer()
    return FixtureSynthesizer()
