# CP-DR A — Research Brief and Scope Lock

Required brief:

```yaml
scope_type: issuer|sector
scope_key: ""
subject_name: ""
research_question: ""
decision_context: ""
as_of_date: YYYY-MM-DD
time_horizon: ""
entities_or_subsegments: []
geographies: []
comparators: []
must_answer: []
perspectives_requested: []
exclusions: []
source_mode: supplied_only|web_only|hybrid
preferred_sources: []
prohibited_sources: []
freshness_requirement: ""
research_budget: standard|extended
plan_approval: required|auto
```

Reject empty identity/question/context/time boundaries. Clarify only material ambiguity. Write an inclusion/exclusion ledger before search. A material change to subject, entities, geography, period, decision context, or source mode invalidates the approved plan hash.

## Selective research-scope resolution

Before capability checks, planning or search, resolve the run-local brief from explicit command qualifiers, explicit current-conversation values, validated matching context, approved live references and declared safe defaults, in that order. Conversation may scope intent but is not research evidence. Surface a material disagreement as `CONFLICT` and resolve it before substantive research; apply a default only to `MISSING`.

Show only unresolved, decision-material fields, with one consolidated question and no more than three fields per stage:

1. research scope: `subject_name`, `research_question`, `scope_type`;
2. decision/time boundary: `decision_context`, `as_of_date`, `time_horizon`;
3. unresolved research controls: `source_mode`, `research_budget`, `plan_approval`.

Do not display a full qualifier menu or complete qualifier ledger at launch. All advanced qualifiers remain available inline through this mapping:

| Displayed qualifier | Brief field / values |
|---|---|
| `scope_type` | `issuer` or `sector` |
| `issuer/sector` | `subject_name`, with `scope_key` once resolved |
| `research_question` / `decision_context` | exact user objective and decision use |
| `as_of` / `horizon` | `as_of_date`; `time_horizon` |
| `entities/subsegments` / `geography` | lists; empty means deliberately broad only when stated |
| `comparators` / `must_answer` / `perspectives` | lists; never infer user priorities from source volume |
| `source_mode` | `supplied_only`, `web_only` or `hybrid` |
| `preferred_sources` / `prohibited_sources` | lists; source preference never lowers evidence standards |
| `freshness` | explicit cut-off or freshness requirement |
| `budget` | `standard` or `extended` |
| `plan_approval` | `required` or `auto` |
| `exclusions` | exact excluded questions, entities, periods or sources |

Do not treat a blank required field as a default. Use `research_budget: standard`; require plan approval for web/hybrid research; and use `supplied_only` when verified web access is unavailable. A complete brief proceeds without an extra confirmation unless `plan_approval: required` applies at Phase 3.
