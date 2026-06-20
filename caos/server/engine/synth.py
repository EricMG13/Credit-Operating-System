"""Module synthesis — how a module turns inputs into a payload.

Two implementations behind one interface, mirroring the demo-mode pattern in
[llm.py]:

  - FixtureSynthesizer — returns the canonical ATLF payloads. Used when no model
    key is configured, so the whole engine (persistence, retrieval, lineage,
    gate) is fully exercisable and testable offline.
  - LiveSynthesizer — reads the module's on-disk Active Prompt from
    ``Modular OS/``, grounds it in retrieved document chunks, and asks Claude to
    return the payload via a **forced tool call** (structured output) rather than
    free-text JSON we then scrape. The methodology prompt files stay the single
    source of truth; we never fork them into code.

``get_synthesizer`` picks Live when ANTHROPIC_API_KEY is set, else Fixture.

Robustness (SYNTH-1): the live path is the product thesis and the least-defended
code, so it is hardened on three axes —
  1. **Structured output** — the model must call ``emit_module_payload`` whose
     ``input_schema`` mirrors ``ModulePayload`` (with closed enums for
     confidence / extraction_type / lineage_class), so the payload arrives
     schema-shaped instead of regex-scraped from prose.
  2. **One-shot repair** — a first response that truncates, parses badly, or
     fails ``validate_payload`` gets exactly one corrective retry (the error fed
     back) before the module is gated, and only if the token budget allows it.
  3. A defensive text→JSON fallback is retained for the (forced-tool) case where
     a response unexpectedly carries no tool call.
"""

from __future__ import annotations

import copy
import json
import logging
import re
from typing import Awaitable, Callable, Dict, List, Optional, Tuple, Protocol

from config import SERVER_DIR, get_settings
from engine import budget
from engine.fixtures import atlf_payload
from engine.llm_safety import UNTRUSTED_RULE, wrap_untrusted
from engine.schemas import (
    CONFIDENCE,
    EXTRACTION_TYPES,
    LINEAGE_CLASSES,
    ClaimSpec,
    EvidenceSpec,
    ModulePayload,
    validate_payload,
)

logger = logging.getLogger("caos.engine")

# Modular OS lives at the repo root, two levels above the server dir.
MODULAR_OS_DIR = SERVER_DIR.parent.parent / "Modular OS"

RetrieveFn = Callable[[str, int], Awaitable[list]]

# Per-module grounding focus for the live synthesize() path. CP-1 is the canonical
# financial foundation, so steer its retrieval at the income/leverage/coverage
# disclosures it normalizes. Anything not listed uses the broad default.
_RETRIEVAL_FOCUS = {
    "CP-1": "revenue EBITDA net debt leverage interest coverage margin cash flow financial statements",
}

# A full CP-1 spread (multi-period financials + KPI register + claims) does not
# fit in 4096 output tokens — it truncated, and the one-shot repair re-truncates
# at the same ceiling. 8192 fits the richest module with headroom.
_MAX_TOKENS = 8192

# Advisor tool (config.advisor_enabled). The synthesizer's call is reasoning-heavy
# and a fit for a cheaper executor consulting a stronger advisor mid-generation.
_ADVISOR_BETA = "advisor-tool-2026-03-01"
_ADVISOR_MAX_TOKENS = 2048  # Anthropic's recommended cap: ~7x less advisor output, ~0% truncation.

# Structured-output contract: the model fills this schema instead of authoring
# free-text JSON. Closed enums mirror engine.schemas so most schema violations
# are prevented at the source; the rest are caught by validate_payload.
_PAYLOAD_TOOL = {
    "name": "emit_module_payload",
    "description": (
        "Emit this module's analytical payload. Populate every field, and ground "
        "each claim's evidence in the provided SOURCE CHUNKS — never invent figures."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "module_name": {"type": "string"},
            "owned_object": {"type": "string"},
            "runtime_output": {
                "type": "object",
                "description": "The module's structured output object.",
            },
            "confidence": {"type": "string", "enum": sorted(CONFIDENCE)},
            "limitation_flags": {"type": "array", "items": {"type": "string"}},
            "downstream_consumers": {"type": "array", "items": {"type": "string"}},
            "claims": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "claim_id": {"type": "string"},
                        "claim_text": {"type": "string"},
                        "evidence": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "evidence_id": {"type": "string"},
                                    "extraction_type": {
                                        "type": "string",
                                        "enum": sorted(EXTRACTION_TYPES),
                                    },
                                    "lineage_class": {
                                        "type": "string",
                                        "enum": sorted(LINEAGE_CLASSES),
                                    },
                                    "source_locator": {"type": "string"},
                                    "confidence": {"type": "string", "enum": sorted(CONFIDENCE)},
                                },
                                "required": [
                                    "evidence_id",
                                    "extraction_type",
                                    "lineage_class",
                                    "source_locator",
                                ],
                            },
                        },
                    },
                    "required": ["claim_id", "claim_text", "evidence"],
                },
            },
        },
        "required": ["module_name", "owned_object", "runtime_output", "confidence", "claims"],
    },
}

# CP-1 is the canonical data foundation: every deterministic overlay reads these
# exact keys off ``runtime_output.normalized_financials``. The fixture / EDGAR /
# reported producers emit this shape because they are code; the LLM producer
# does not unless we pin it — so a live CP-1 used to land its figures under
# whatever keys the model chose, and the overlays silently went Insufficient.
# This is the *output* contract (normalization), independent of how messy the
# *input* filing is: map the issuer's disclosed figures into these slots, and
# leave any metric the sources do not disclose as null (NEVER invent — a missing
# metric must read as missing, not fabricated). runtime_output stays open
# (no additionalProperties:false) so CP-1's richer narrative output is preserved.
_CP1_RUNTIME_SCHEMA = {
    "type": "object",
    "description": (
        "CP-1 canonical output. Fill normalized_financials by mapping the issuer's "
        "disclosed credit metrics into the canonical keys below, regardless of how "
        "the source labels them. Set any metric the documents do not disclose to "
        "null — never invent. You may add other keys (KPI register, coverage gates, "
        "notes) alongside these."
    ),
    "properties": {
        "normalized_financials": {
            "type": "object",
            "description": "The canonical normalized financials every downstream module reads.",
            "properties": {
                "revenue": {
                    "type": "object",
                    "additionalProperties": {"type": ["number", "null"]},
                    "description": 'Period label (e.g. "FY24", "LTM_Q1_26") -> revenue in $M.',
                },
                "adj_ebitda": {
                    "type": "object",
                    "additionalProperties": {"type": ["number", "null"]},
                    "description": "Period label -> adjusted EBITDA in $M (same labels as revenue).",
                },
                "net_debt_ltm": {"type": ["number", "null"], "description": "Net debt, $M, LTM."},
                "net_leverage_adj_ltm": {
                    "type": ["number", "null"],
                    "description": "Headline net leverage = net debt / adj. EBITDA, in turns.",
                },
                "interest_coverage_ltm": {
                    "type": ["number", "null"],
                    "description": "Adj. EBITDA / cash interest, in turns.",
                },
                "leverage_basis": {
                    "type": ["string", "null"],
                    "description": "What net_leverage_adj_ltm is measured on, if stated: "
                    "one of total | senior_secured | first_lien | net.",
                },
            },
        },
        "distress": {
            "type": "object",
            "description": "Distress model output, if computable from the sources.",
            "properties": {
                "altman_z": {"type": ["number", "null"]},
                "zone": {"type": ["string", "null"]},
                "model": {"type": ["string", "null"]},
            },
        },
    },
}


def _payload_tool(module_id: str) -> dict:
    """The forced-tool schema. CP-1 gets its ``runtime_output`` pinned to the
    canonical normalized-financials contract; every other module keeps the
    free-form object (their shapes are deterministic / module-specific)."""
    if module_id != "CP-1":
        return _PAYLOAD_TOOL
    tool = copy.deepcopy(_PAYLOAD_TOOL)
    tool["input_schema"]["properties"]["runtime_output"] = _CP1_RUNTIME_SCHEMA
    return tool


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

    async def _call(self, system: str, messages: list, tool: dict, module_id: str):
        """One Claude call that must emit ``emit_module_payload``; accrues token usage.

        With ``advisor_enabled`` the call runs on the cheaper executor and exposes the
        advisor tool, so the model consults a stronger model before emitting the
        payload — ``tool_choice: any`` lets it call the advisor first yet still keeps
        the payload tool mandatory. Otherwise it is the original single forced-tool
        call on ``anthropic_model``."""
        s = self._settings
        # Cache the stable prefix (tools + system). A cache_control breakpoint on the
        # system block also caches the preceding tools, so this covers the whole
        # tools+system prefix — identical between the initial call and the one-shot
        # repair (guaranteed hit), and across re-runs of this module within the 5-min
        # window. The per-module Active Prompt (~2k tokens) clears the 1024 floor.
        system_blocks = [{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}]
        if s.advisor_enabled:
            advisor = {
                "type": "advisor_20260301",
                "name": "advisor",
                "model": s.advisor_model,
                "max_uses": 1,
                "max_tokens": _ADVISOR_MAX_TOKENS,
            }
            resp = await self._get_client().beta.messages.create(
                betas=[_ADVISOR_BETA],
                model=s.synth_executor_model,
                max_tokens=_MAX_TOKENS,
                system=system_blocks,
                tools=[advisor, tool],
                tool_choice={"type": "any"},  # advisor (model's choice), then the payload tool
                messages=messages,
            )
        else:
            resp = await self._get_client().messages.create(
                model=s.anthropic_model,
                max_tokens=_MAX_TOKENS,
                system=system_blocks,
                tools=[tool],
                tool_choice={"type": "tool", "name": tool["name"]},
                messages=messages,
            )
        budget.record_usage(resp)
        # Per-call output-token visibility: a module near the ceiling is the
        # truncation signal (CP-1's full spread is the one that hits it).
        out = int(getattr(getattr(resp, "usage", None), "output_tokens", 0) or 0)
        logger.info("%s synth call: output_tokens=%d/%d%s", module_id, out, _MAX_TOKENS,
                    " (NEAR LIMIT — raise max_tokens)" if out >= _MAX_TOKENS * 0.9 else "")
        return resp

    async def synthesize(self, module_id, *, issuer_name, upstream, retrieve):
        if not budget.llm_allowed():
            raise SynthesisError(f"{module_id}: per-run token budget exhausted")
        active_prompt = self._active_prompt(module_id)
        # Module-focused grounding query (in practice this generic path is CP-1's
        # live fallback): point retrieval at the metrics CP-1 normalizes rather than
        # a one-size covenants/liquidity string. Falls back to the broad query for
        # any other module that reaches this path.
        focus = _RETRIEVAL_FOCUS.get(module_id, "financials covenants leverage liquidity")
        hits = await retrieve(f"{issuer_name} {focus}", 8)
        grounding = "\n\n".join(f"[chunk {h.chunk_id}]\n{h.text}" for h in hits) or "(no documents)"
        upstream_json = json.dumps(
            {mid: p.runtime_output for mid, p in upstream.items()}, default=str
        )

        tool = _payload_tool(module_id)
        system = (
            active_prompt
            + "\n\n---\nCall the `emit_module_payload` tool exactly once with this module's "
            "payload. Ground every claim in the SOURCE CHUNKS; never invent figures. Use "
            'confidence "Insufficient Information" where the sources do not support a claim.\n\n'
            + UNTRUSTED_RULE
        )
        if module_id == "CP-1":
            system += (
                "\n\n---\nCP-1 is the canonical data foundation. Fill "
                "`runtime_output.normalized_financials` with the canonical keys in the "
                "tool schema, mapping the issuer's disclosed figures into them; set any "
                "metric the sources do not disclose to null."
            )
        user = (
            f"ISSUER: {issuer_name}\n\nUPSTREAM OUTPUTS:\n{upstream_json}\n\n"
            f"SOURCE CHUNKS:\n{wrap_untrusted(grounding)}"
        )

        resp = await self._call(system, [{"role": "user", "content": user}], tool, module_id)
        payload, error = _extract_payload(module_id, resp)
        if error is None:
            return payload

        # One-shot repair: feed the error back and try once more — but only if the
        # budget allows another call (a failing run must not blow the cap).
        logger.info("%s: first payload invalid (%s); attempting one repair", module_id, error)
        if not budget.llm_allowed():
            raise SynthesisError(f"{module_id}: {error}; repair skipped (token budget exhausted)")
        repair_user = (
            user
            + "\n\n---\nA previous attempt produced an INVALID payload:\n"
            + error
            + "\nCall `emit_module_payload` again with a complete, corrected payload; "
            "ground every claim in the SOURCE CHUNKS above."
        )
        resp2 = await self._call(system, [{"role": "user", "content": repair_user}], tool, module_id)
        payload, error2 = _extract_payload(module_id, resp2)
        if error2 is not None:
            raise SynthesisError(f"{module_id}: payload still invalid after one repair ({error2})")
        return payload


def _extract_payload(
    module_id: str, resp
) -> Tuple[Optional[ModulePayload], Optional[str]]:
    """Turn a Claude response into a validated payload.

    Returns ``(payload, None)`` on success or ``(None, error)`` when the response
    can't yield a valid payload — truncation, no payload, or a schema violation.
    The caller uses ``error`` to drive the one-shot repair.
    """
    if getattr(resp, "stop_reason", None) == "max_tokens":
        return None, "response truncated (max_tokens) before a complete payload"
    data = _payload_data_from_resp(resp)
    if not isinstance(data, dict):
        return None, "model returned no payload (no tool call, no JSON object)"
    payload = _payload_from_data(module_id, data)
    errors = validate_payload(payload)
    if errors:
        return None, "; ".join(errors)
    return payload, None


def _payload_data_from_resp(resp) -> Optional[dict]:
    """Pull the payload dict from the forced tool call, falling back to a JSON
    object embedded in a text block (defensive — should not happen with
    forced tool_choice, but keeps a bad response recoverable)."""
    content = getattr(resp, "content", None) or []
    for block in content:
        if getattr(block, "type", None) == "tool_use":
            return getattr(block, "input", None)
    text = next(
        (getattr(b, "text", "") for b in content if getattr(b, "type", None) == "text"), ""
    )
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        return None
    try:
        return json.loads(match.group(0))
    except json.JSONDecodeError:
        return None


def _payload_from_data(module_id: str, data: dict) -> ModulePayload:
    """Build a ModulePayload from a payload dict (tool input or parsed JSON).

    Defensive (``.get`` defaults + ``str`` coercion) so a malformed dict yields a
    degenerate-but-constructed payload that ``validate_payload`` then flags —
    rather than raising here and bypassing the repair path."""
    claims: List[ClaimSpec] = []
    for c in data.get("claims", []) or []:
        evidence = [
            EvidenceSpec(
                evidence_id=str(e.get("evidence_id", "")),
                extraction_type=str(e.get("extraction_type", "")),
                lineage_class=str(e.get("lineage_class", "")),
                source_locator=str(e.get("source_locator", "")),
                confidence=str(e.get("confidence", "Medium")),
            )
            for e in (c.get("evidence", []) or [])
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


def _parse_payload(module_id: str, text: str) -> ModulePayload:
    """Parse a free-text JSON response into a ModulePayload (legacy text path)."""
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        raise SynthesisError(f"{module_id}: model returned no JSON object")
    try:
        data = json.loads(match.group(0))
    except json.JSONDecodeError as e:
        raise SynthesisError(f"{module_id}: payload JSON did not parse ({e})") from e
    return _payload_from_data(module_id, data)


def get_synthesizer() -> Synthesizer:
    if get_settings().anthropic_api_key:
        return LiveSynthesizer()
    return FixtureSynthesizer()
