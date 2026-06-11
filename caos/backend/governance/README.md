# CP Governance Layer (P0)

Operational port of the Modular OS v2 governance/schema layer into the backend.
The prompt corpus (`~/Documents/Modular OS`) remains the source of truth for
module **system prompts** (`CP-<ID>_ACTIVE_PROMPT.md`) — those are loaded at
agent-build time in P1. This package codifies the parts the **runtime** enforces.

## Corpus → code mapping

| Corpus artifact | Code |
|---|---|
| `01_TAXONOMY/*` + `00_GOVERNANCE` status taxonomy | `enums.py` |
| `02_SCHEMA/CP_MODULE_PAYLOAD_BASE.schema.txt` | `payload_base.py` + `schemas/CP_MODULE_PAYLOAD_BASE.schema.json` |
| `SYSTEM_ROUTE_MAP_v2` + `MODULE_EXECUTION_ORDER_v2` + `MODULES_REFERENCE_v2` | `module_registry.json` |
| CP-X one-owner-per-object (VE-009), strictly-forward flow | `registry.py::validate` |
| `CP_RENDER_COMPILE_BOUNDARY` enum validation (VE-010) | `enums.RENDER_VALIDATED_ENUMS` |

## What it enforces (in CI, before any LLM runs)

- **One-owner-per-object** — no two modules declare the same `owned_object`.
- **Strictly-forward flow** — the `analytical` edge subgraph is acyclic.
- **Order consistency** — every analytical edge respects execution order.
- **Sanctioned cycles only** — the sole bidirectional edge is CP-SR↔CP-MON.

```
python3 backend/governance/registry.py     # self-check (exit 0 = clean)
```

## Edge types

| Type | Meaning | Order-constrained? | May cycle? |
|---|---|---|---|
| `analytical` | strict L0–L6 forward data dependency | yes | no |
| `enrichment` | L7 (CP-SR) context overlay into the pipeline | no | no |
| `trigger` | CP-MON orchestration re-entry via CP-X | no | yes (re-entry) |
| `loop` | the sanctioned CP-SR↔CP-MON bidirectional edge | no | yes (sanctioned) |

## Open items (P1)

- `binding_constraint` (CP-6E, 9 values + None) — port the 9 values from the CP-6E
  refs to complete the render-enum set, then enable that VE-010 check.
- Generate `payload_base.py` and the per-module payload models from the JSON
  Schemas via `datamodel-code-generator` (Migration Guide Phase 2).
