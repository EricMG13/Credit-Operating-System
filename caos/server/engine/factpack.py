"""CP-1A BusinessTransactionFactPack — the issuer's business & transaction facts.

Deterministic scan over retrieved offering / transaction chunks (the idiom of
[sponsor.py] / [legal.py]) for the fact areas a credit analyst anchors on before
the numbers: the transaction, ownership/sponsor, operating model, footprint, and
history. Each detected fact is evidence-traced to the chunk it was found in, so
CP-5B lineage passes and click-to-source resolves. No LLM; degrades to
Insufficient when no offering / transaction text is ingested.

Per the v2 taxonomy re-sync this replaces the old adjusted-EBITDA CP-1A; that
reconciliation now lives in CP-1 ([adjusted.py]).

ponytail: keyword-level fact areas (presence + sourced snippet), not a parsed
entity/ownership graph. Add a structured extractor if the fact pack needs typed
fields (parties, %, dates) rather than evidence-anchored statements.
"""

from __future__ import annotations

import re
from typing import List, Tuple

from engine.schemas import ClaimSpec, EvidenceSpec, ModulePayload
from engine.textscan import scan

_QUERY = ("acquisition merger leveraged buyout sponsor private equity ownership "
          "business segments operations headquartered founded")

# (fact-area label, area code, pattern). Order = senior credit-relevance.
_FACT_AREAS: Tuple[Tuple[str, str, str], ...] = (
    ("Transaction", "transaction",
     r"leveraged buyout|\blbo\b|acquisition of|to acquire|merger|business combination|"
     r"dividend recap|refinanc|initial public offering|\bipo\b|take[-\s]private"),
    ("Ownership / sponsor", "ownership",
     r"private equity|financial sponsor|\bsponsor\b|portfolio company|owned by|"
     r"majority[-\s]owned|controlling (?:stake|interest)|funds? (?:advised|managed) by"),
    ("Operating model", "operating_model",
     r"operating segment|business segment|reportable segment|principal activit|"
     r"core business|revenue is generated|business model"),
    ("Geography / footprint", "geography",
     r"headquartered|head office|operates in|facilities in|present in \d+ countries|"
     r"markets across|global footprint"),
    ("History / milestones", "history",
     r"founded in \d{4}|established in \d{4}|incorporated in \d{4}|since \d{4}|"
     r"traces its (?:roots|history)"),
)

_DOWNSTREAM = ["CP-2", "CP-RENDER"]


def scan_facts(chunks: List[Tuple[str, str]]) -> List[dict]:
    """Detect each fact area (once) with a sourced snippet, credit-relevance order."""
    out = []
    for (label, code, _pat), cid, text in scan(chunks, _FACT_AREAS, key=1):
        snippet = " ".join(text.split())[:200]
        out.append({"fact_area": label, "code": code, "statement": snippet, "chunk_id": cid})
    return out


async def synthesize_fact_pack(retrieve) -> ModulePayload:
    """Build the CP-1A payload by scanning retrieved offering / transaction chunks."""
    hits = await retrieve(_QUERY, 8)
    facts = scan_facts([(h.chunk_id, h.text) for h in hits])

    if not facts:
        return ModulePayload(
            module_id="CP-1A", module_name="BusinessTransactionFactPack",
            owned_object="business_transaction_fact_register",
            runtime_output={"facts": [], "fact_areas": [],
                            "note": "No business / transaction facts identified in ingested offering text."},
            confidence="Insufficient Information",
            limitation_flags=["No offering / transaction disclosure detected in ingested sources."],
            downstream_consumers=_DOWNSTREAM,
        )

    areas = [f["fact_area"] for f in facts]
    return ModulePayload(
        module_id="CP-1A", module_name="BusinessTransactionFactPack",
        owned_object="business_transaction_fact_register",
        runtime_output={
            "facts": facts,
            "fact_areas": areas,
            "register_basis": "keyword scan of ingested offering / transaction chunks",
        },
        confidence="High", downstream_consumers=_DOWNSTREAM,
        claims=[ClaimSpec(
            claim_id="C-FACT1",
            claim_text=f"Business-transaction fact register covers {len(facts)} area(s): {', '.join(areas)}.",
            evidence=[EvidenceSpec(
                f"E-FACT-{i}", "quoted_text", "Directly Sourced",
                f"{f['fact_area']} disclosure (ingested chunk)", "High",
                resolved_chunk_id=f["chunk_id"]) for i, f in enumerate(facts)],
        )],
    )
