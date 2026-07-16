"""LIGHT-tier entailment check — Phase 2 validation gate (RT-2026-07-07-12).

A separate, cheap LLM call layered ON TOP of the deterministic gates (citation +
numeric + fact cross-reference) that judges whether the cited evidence actually
*entails* a kept claim, not merely whether the claim's numerals appear in the
evidence. A claim that states "4.4x" (grounded by the numeric gate) but asserts
it means "leverage deteriorated" when the cited chunk actually says "leverage
improved to 4.4x from 5.1x" survives the numeric gate yet fails entailment.

Below threshold (or ``entails=False``) the *caller* demotes the claim's
``claim_type`` from ``observation`` to ``causal-hypothesis`` — it is NOT dropped.
This is the red-team resolution: the cost of a wrong entailment verdict is a
labeled hypothesis, not a lost true claim. The deterministic gates already
passed, so a demoted claim is still cited and number-grounded; it is simply no
longer presented as a fact.

Fault-isolated: any failure (timeout, parse error, keyless, model unavailable,
empty claim list) returns an empty verdict dict → the caller keeps the original
``claim_type`` labels unchanged. Entailment is additive polish, never a sole
gate and never a reason to lose deterministic content.

Spend: one batched LIGHT call per generation (all kept claims in one request),
not one call per claim. Cached payloads skip it entirely — the persisted
``claim_type`` labels already reflect the demotion from generation time. Spend
is bounded to one LIGHT call per novel (question, fingerprint) pair.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Dict, List

from pydantic import BaseModel, Field, ValidationError

from config import document_egress_allowed
from engine import llm_client, presets
from engine.llm_safety import UNTRUSTED_RULE, first_json_object, wrap_untrusted

logger = logging.getLogger("caos.entailment")

# A claim whose entailment confidence falls below this (or `entails=False`) is
# demoted by the caller from "observation" to "causal-hypothesis". Tunable —
# start conservative so a genuinely supported observation is not mislabeled.
_ENTAILMENT_DEMOTE_THRESHOLD = 0.6


@dataclass
class EntailmentClaim:
    """One kept claim the entailment lane judges. ``evidence_text`` is the cited
    chunks'/entries' free text (untrusted); ``evidence_numbers`` is the closed
    set of figures cited facts authorize (trusted deterministic)."""

    index: int
    text: str
    evidence_text: List[str] = field(default_factory=list)
    evidence_numbers: List[float] = field(default_factory=list)


@dataclass
class EntailmentVerdict:
    entails: bool
    confidence: float


class _VerdictItem(BaseModel):
    index: int
    entails: bool
    # Unbounded here on purpose: a model that returns 1.2 or -0.5 is clamped in
    # check_entailment rather than rejecting the whole reply (a borderline
    # confidence should not waste the entire batched call).
    confidence: float = 0.0


class _EntailmentReply(BaseModel):
    verdicts: List[_VerdictItem] = Field(default_factory=list)


_SYSTEM = (
    "You are the entailment check on an institutional leveraged-finance credit "
    "platform. For each CLAIM, judge whether the EVIDENCE actually supports "
    f"(entails) the claim — not merely whether the claim's numbers appear, but "
    f"whether the evidence substantiates what the claim asserts. {UNTRUSTED_RULE}\n\n"
    "Rules:\n"
    "1. A claim is entailed only if a careful reader could draw it directly from "
    "the EVIDENCE without extra assumptions. A causal/explanatory claim "
    "(\"X because Y\") is NOT entailed unless the evidence states the cause.\n"
    "2. confidence is your certainty the evidence entails the claim, 0.0 to 1.0.\n"
    "3. Return a verdict for EVERY claim index provided. If no claims, return "
    '{"verdicts": []}.\n\n'
    "Reply with ONLY JSON:\n"
    '{"verdicts": [{"index": 0, "entails": true, "confidence": 0.9}, ...]}'
)


def available() -> bool:
    """True when the resolved LIGHT entailment model has its provider key."""
    return (
        document_egress_allowed()
        and presets.can_run_model(presets.model_for(presets.LIGHT))
    )


def _text_of(resp) -> str:
    return next((b.text for b in resp.content if getattr(b, "type", "") == "text"), "")


def _format_evidence(claim: EntailmentClaim) -> str:
    """Render one claim's evidence as a fenced block for the prompt. Untrusted
    chunk text is wrapped per ``llm_safety``; deterministic numbers are trusted
    and emitted as-is."""
    parts: List[str] = []
    for t in claim.evidence_text:
        parts.append(wrap_untrusted(t))
    if claim.evidence_numbers:
        parts.append("Computed figures (trusted): " + ", ".join(
            f"{n:g}" for n in claim.evidence_numbers))
    return "\n".join(parts) if parts else "(no evidence provided)"


def should_demote(verdict: EntailmentVerdict) -> bool:
    """True when an ``observation`` claim should be demoted to
    ``causal-hypothesis``: the evidence does not entail it, or confidence is
    below the threshold."""
    return (not verdict.entails) or (verdict.confidence < _ENTAILMENT_DEMOTE_THRESHOLD)


async def check_entailment(claims: List[EntailmentClaim]) -> Dict[int, EntailmentVerdict]:
    """Batched LIGHT-tier NLI over kept claims. Returns ``{index: verdict}``.

    Fault-isolated: returns ``{}`` on any failure (no claims, keyless, timeout,
    parse error). The caller treats an empty dict as "no demotions" and keeps
    the original ``claim_type`` labels — entailment never loses deterministic
    content.
    """
    if not claims:
        return {}
    if not available():
        return {}

    numbered = "\n\n".join(
        f"CLAIM {c.index}:\n{c.text}\n\nEVIDENCE:\n{_format_evidence(c)}"
        for c in claims
    )
    try:
        resp = await llm_client.create(
            llm_client.anthropic_client(),
            lane="query-entailment",
            model=presets.model_for(presets.LIGHT),
            effort=presets.effort_for(presets.LIGHT),
            max_tokens=800,
            system=_SYSTEM,
            messages=[{"role": "user", "content": numbered}],
        )
        reply = _EntailmentReply.model_validate(first_json_object(_text_of(resp)))
    except (ValidationError, ValueError) as e:
        logger.warning("entailment reply failed validation — skipping demotion: %s", e)
        return {}
    except Exception:  # noqa: BLE001 — fault-isolated: timeout / network / provider
        logger.exception("entailment LLM call failed — skipping demotion")
        return {}

    out: Dict[int, EntailmentVerdict] = {}
    for v in reply.verdicts:
        # Clamp confidence into [0,1] defensively (the schema already bounds it,
        # but a model that returns 1.2 should not crash a downstream comparison).
        conf = max(0.0, min(1.0, float(v.confidence)))
        out[int(v.index)] = EntailmentVerdict(entails=bool(v.entails), confidence=conf)
    return out
