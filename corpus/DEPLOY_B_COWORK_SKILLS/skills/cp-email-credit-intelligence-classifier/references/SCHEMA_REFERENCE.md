# CP-EMAIL | Display Digest Schema Reference

## Identity and output

| Field | Binding value |
|---|---|
| module_id | `CP-EMAIL` |
| module_name | `CreditIntelligenceClassifier` |
| owned_object | `intelligence_digest` |
| schema_family | `Nested` |
| output_class | `DISPLAY_DIGEST` |
| persistence | Run-local only |
| output surface | Current chat display only |

The runtime payload is defined by `CP-EMAIL__CreditIntelligenceClassifier__payload.schema.txt`. It is an audit model for the displayed digest, not a file or external handoff.

## Runtime objects

| Object | Required fields / rules |
|---|---|
| `run_header` | run ID; as-of timestamp/time zone; lookback; mode; requested markets; resolved scope label |
| `scope_resolution` | explicit qualifiers; inherited preferences actually available; inclusions; exclusions; fallback flag; unresolved scope |
| `coverage_manifest[]` | source class; requested scope; status; access depth; retrieval cut-off; reliable count or `—`; limitation |
| `source_register[]` | source ID; origin/source role; private/public; authority tier; publication/event/retrieval timestamps; access depth; locator; evidence family |
| `story_cluster_register[]` | cluster ID; canonical headline; entity IDs/names; atomic claim IDs; member source IDs; earliest event time; newness; disclosed comparison basis; conflict/correction flags |
| `signal_assessments[]` | cluster ID; priority; direction; credit channels; mechanism; monitoring-lane result; confidence/reason; affected instruments; evidence IDs |
| `top_line_assessment` | counts by priority; leading conclusion; cross-cutting theme only when supported; zero-item statement when applicable |
| `ranked_story_cards[]` | immutable item ID and original rank for the run; priority; subject; headline; happened; newness and comparison basis; impact/mechanism; event status; instruments if evidenced; confidence reason; sources/locators; action |
| `sector_clo_regulatory_synthesis[]` | synthesis type; finding; affected scope; supporting independent clusters; mechanism; limitations |
| `recommended_analyst_actions[]` | priority; action/question/date; rationale; optional manual RBOT command; no automatic execution |
| `limitations[]` | inaccessible content; identity ambiguity; conflict; stale coverage; unavailable comparison basis; suppressed volume |
| `suppressed_item_count` | Reliable non-negative count or `—`; never estimated |
| `qa_summary` | `Passed`, `Restricted` or `Blocked`; disclosed remediation rows and unresolved findings |

## Controlled values

### Coverage status

`REVIEWED` | `LIMITED` | `UNAVAILABLE` | `NOT REQUESTED` | `NO QUALIFYING ITEMS`

### Access depth

`FULL BODY` | `ATTACHMENT REVIEWED` | `SUMMARY` | `SNIPPET` | `HEADLINE ONLY` | `METADATA ONLY` | `INACCESSIBLE`

### Newness

`FIRST SEEN` | `SUBSTANTIVE UPDATE` | `REPEAT` | `CORRECTION` | `STALE RESURFACING` | `NOT TESTED`

`FIRST SEEN` requires a named accessible comparison basis and cut-off that was searched with no earlier version found. Without that comparison, use `NOT TESTED`.

### Event status

`CONFIRMED` | `ANNOUNCED` | `PROPOSED` | `DISPUTED` | `RUMOUR` | `CORRECTED` | `UNRESOLVED`

### Priority

`URGENT ACTION` | `MATERIAL SIGNAL` | `WATCH` | `INFORMATION`

### Confidence

`High` | `Medium` | `Low` | `Insufficient Information`, always followed by a short reason. Confidence is evidence confidence, not probability of default or event probability.

## Story card minimum contract

```text
{item-N} | Rank {rank}. {PRIORITY} — {issuer/sector}
   {concise headline}
   What happened: {atomic sourced facts}
   What is new: {newness and comparison basis}
   Impact: {Evidence -> Risk Mechanic -> Creditor Implication}
   Status / instruments: {only when evidenced}
   Confidence: {label — reason}
   Sources: {source, timestamp, locator/link}
   Action: {manual analyst/RBOT action | No action — context only}
```

Ranks and `item-N` handles are assigned once per run. Follow-up views preserve them; changed retrieval scope/time creates a new run and ranking.

## Complete display order

1. `CP-EMAIL — {mode}` plus run header.
2. Coverage strip with every requested source class.
3. Top-line assessment and priority counts.
4. All urgent story cards, then material, watch and information cards up to the cap.
5. Sector/CLO/regulatory synthesis only when supported by an explicit mechanism and adequate evidence.
6. Recommended analyst actions.
7. Limitations, unavailable comparison basis and suppressed-item count.

## Completion states

- `Passed`: all hard gates pass; ordinary disclosed limitations may remain.
- `Restricted`: digest may display, but one or more items/sections are demoted, omitted or explicitly constrained by material evidence gaps.
- `Blocked`: a critical privacy, fabricated-access, unsupported-figure, attribution, identity or output-class defect prevents a trustworthy analytical digest. Display the block reason, resolved scope and coverage; do not fabricate a substitute.

No completion state creates a file, sends a message, persists a register or runs another module.
