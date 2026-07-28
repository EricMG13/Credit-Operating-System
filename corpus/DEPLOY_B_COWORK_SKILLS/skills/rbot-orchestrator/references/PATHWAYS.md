<!-- Structure B progressive-disclosure companion for RBOT Orchestrator. Source: README/EXAMPLE_PATHWAYS_v2.md. -->

# Example Pathways

## Pathway 1 — Full Credit Assessment

**Use case:** New issuer / new investment opportunity.

*Untriaged or mixed source packs pass through CP-PARSE first for selection, adaptive parsing and ZIP batching. Already selected clean/simple sources may be marked `PASS_THROUGH` and go unchanged to CP-0.*

```text
CP-PARSE -> CP-0 -> CP-X -> CP-1 + CP-1A
              -> CP-1B + CP-1C
              -> CP-2
              -> CP-2A + CP-2B + CP-2C + CP-2D + CP-2E + CP-2F
              -> CP-2G -> CP-2H
              -> CP-3 + CP-3C + CP-3D
              -> CP-3A + CP-3B
              -> CP-4 -> CP-4B + CP-4A -> CP-4C when the distress gate is met
              -> CP-5 -> CP-5A
              -> CP-6 -> CP-6A
```

**Outputs:** Full credit synthesis, IC Action Bias, Portfolio Posture. Each module self-authors its own report .docx (Audit Summary + numeric Confidence Score, analysis narrative, single Audit Appendix) plus a handoff .md; the committee-ready synthesis is produced by the final synthesis/orchestration modules — there is no separate renderer.

## Pathway 2 — Covenant-Focused Review

**Use case:** New credit agreement, amendment, or covenant capacity question.

```text
CP-0 -> CP-1 -> CP-3C -> CP-4 -> CP-4A -> CP-5 -> CP-5A
```

**Outputs:** Covenant interpretation, aggressiveness rubric, capacity calculations, headroom analysis.

## Pathway 3 — Earnings Update

**Use case:** Issuer reports quarterly or annual results.

```text
CP-0 -> CP-1 -> CP-1B -> CP-2 -> CP-5 -> CP-5A
```

**Outputs:** Updated canonical data, earnings delta analysis, refreshed fundamental synthesis, QA status.

## Pathway 4 — Portfolio Allocation Decision

**Use case:** Credit view exists; portfolio team needs allocation decision.

```text
CP-3 -> CP-3B -> CP-4A -> CP-6 -> CP-6A
```

**Outputs:** Portfolio fit, sizing evidence gate, covenant capacity consideration, IC action bias, final Portfolio Posture.

## Pathway 5 — Relative Value and Security Selection

**Use case:** Compare instruments and determine security preference.

```text
CP-1 -> CP-1C -> CP-2 -> CP-2D -> CP-2G -> CP-3D -> CP-3 -> CP-3A
```

**Outputs:** Peer benchmark, RV analysis, spread comparison, recovery waterfall, LGD by instrument.

## Pathway 6 — Distressed / LME Risk Review

**Use case:** Issuer facing maturity wall, exchange offer, or creditor-on-creditor risk.

```text
CP-1 -> CP-2A + CP-2D -> CP-2G -> CP-2H + CP-3C + CP-3D -> CP-4 + CP-4B + CP-4A -> CP-4C -> CP-6
```

**Outputs:** Refinancing path risk, LME risk register, covenant vulnerability, capacity analysis, IC debate.


## Pathway 7 — User-Scoped Deep Research

**Use case:** A multi-source issuer or sector question needs explicit scope, research planning, web/internal evidence and synthesis.

```text
Research brief -> CP-DR plan approval -> CP-DR research dossier
  optional input: CP-0 source map
  optional downstream: CP-X -> specialist modules
```

**Outputs:** Research dossier, claim-evidence ledger, source/conflict registers, coverage and stop reason. CP-DR may display a bounded manual `Run CP-EMAIL [qualifiers]` recommendation; it does not emit a trigger or packet.

## Pathway 8 — Displayed Intelligence Digest

**Use case:** Accessible email/public news needs aggregation, classification, ranking and run-local credit-signal monitoring.

```text
Run CP-EMAIL [qualifiers]
    -> displayed intelligence_digest
    -> optional manual recommendation (not an edge or automatic run):
         Rating action     -> Run CP-2H
         New issue/price   -> Run CP-3D or CP-3
         LME / distressed  -> Run CP-3C or CP-4C
         Sector question   -> Run CP-DR
         Route uncertain   -> Run CP-X
```

**Outputs:** One displayed digest with coverage, ranked story cards, limitations and manual follow-up commands. No alert delivery, durable watchlist, file, canonical handoff or automatic module invocation.

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-05-18 | Initial 6 pathways |
| 2.0 | 2026-06-08 | Added Pathway 7 (Sector Review), Pathway 8 (Monitoring Refresh) |
| 2.1 | 2026-06-26 | Removed CP-RENDER from Pathway 1 (no renderer/parser/database; CP-RENDER, CP-EXTRACT, CP-DB removed). Each module now self-authors a report .docx + handoff .md per run, with a numeric Confidence Score (0–100). |
| 2.5 | 2026-07-21 | Added forward-model, ratings-transition, market-implied and restructuring branches. |
| 2.6 | 2026-07-22 | Replaced the former CP-MON refresh path with standalone, display-only CP-EMAIL and manual follow-up commands |
