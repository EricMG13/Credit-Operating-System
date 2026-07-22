# Model-provider activation evidence — 2026-07-22 (frozen candidate)

Closes the PD-06 "model-provider activation evidence" leg. Same target-shaped
stack as [C3_LIVE_OPERATION_EVIDENCE_2026-07-22.md](C3_LIVE_OPERATION_EVIDENCE_2026-07-22.md)
(frozen code == `cda106dc`, ENVIRONMENT=production, two workers, live
PostgreSQL, ClamAV, edge-authorized API). Provider keys were supplied only via
`caos/server/.env`, read by the application's own settings loader; no key
value was read or transcribed by the operator.

## Activation-state matrix (all observed live)

| State | Configuration | Observed behavior |
|---|---|---|
| 1. No keys | model keys blanked | `/api/health` → `"llm": "demo-fallback"`; all LLM lanes deterministic; the entire C3 observation window ran in this posture — engine runs complete, gates fire honestly |
| 2. Keys present, egress **off** (default) | real keys in `.env`, `CAOS_DOCUMENT_EGRESS_ENABLED` unset | **Still** `"llm": "demo-fallback"` — `document_egress_allowed` (config.py) is a fail-closed opt-in: a provider key proves availability, not permission to transmit issuer material. No external call is possible until the operator grants egress |
| 3. Keys + egress **on** | `CAOS_DOCUMENT_EGRESS_ENABLED=true` | `/api/health` → `"llm": "configured"`; live calls succeed (below) |
| 4. Provider fault | valid config, OpenRouter key invalidated | Lane fails **fast and clean** — upstream `401` → single `WARNING` log → HTTP `502 {"detail":"Chat backend unavailable — try again."}` in 0.1 s; no hang, no stack leak, no cascade; service health unaffected |

## Live activation calls (both providers)

- **OpenRouter (default hybrid tier)**: `POST /api/chat/issuer` → 200; log
  line `{"event":"llm_call","lane":"chat","model":"deepseek/deepseek-v4-flash",
  "fallback":false,"input_tokens":141,"output_tokens":352,"cost":8.28e-05,
  "stop_reason":"end_turn"}`. Reply was grounded-refusal style (correctly
  declined to invent run data, pointed at CP-3) — the governed prompt frame, not
  a canned demo string.
- **Anthropic (tier override)**: with the chat tier pointed at
  `claude-haiku-4-5-20251001`, `POST /api/chat/issuer` → 200 in 1.8 s; log
  line `{"event":"llm_call","lane":"chat","model":"claude-haiku-4-5-20251001",
  "fallback":false,"input_tokens":163,"output_tokens":66,"stop_reason":"end_turn"}`.

Token counts, cost, latency, and stop reason are structured-logged per call
(`caos.llm`), giving the operator per-call audit evidence.

## Boundaries

- Chat is tier-routed to a single provider per configuration; cross-provider
  automatic failover is a mode feature of specific lanes (COUNCIL_CROSS_MODEL),
  not a chat guarantee — the observed 502-fast behavior is the documented
  lane-level fault-isolation invariant (a lane failure never aborts the
  service or a run).
- Gemini key present but not exercised (no lane routes to it by default);
  activation of a Gemini-routed tier would follow the same matrix.
- Target-host repetition of state 3/4 belongs to the H0-bound rerun set.
