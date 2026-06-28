# Phase-0 Engine Freeze

Date: 2026-06-28

## Frozen Cert Surface

The Phase-0/Phase-1 certification surface is the implemented registry in
`caos/server/engine/registry.py`:

`CP-0`, `CP-1`, `CP-1A`, `CP-1B`, `CP-1C`, `CP-2`, `CP-2B`, `CP-2C`, `CP-2D`,
`CP-2E`, `CP-2F`, `CP-3`, `CP-3B`, `CP-3C`, `CP-3D`, `CP-4`, `CP-4C`,
`CP-6A`, `CP-6E`.

No new engine module enters certification without reopening Phase 0 and adding a
golden/regression check for the new behavior.

## Deferred

Spec-only corpus modules stay out of certification until they have real
synthesizers and tests:

`CP-SR`, `CP-MON`, `CP-RENDER`, `CP-EXTRACT`.

## Refinement Status

The `.goal/` tournament folders are historical working records, not active
cert-scope changes. Their recommended CP-1 finite-number guards are present in
the live engine where the function divides, multiplies, or rounds CP-1-derived
values:

| Refinement | Live file | Status |
| --- | --- | --- |
| `altman-z` | `caos/server/engine/distress.py` | landed |
| `compute-deltas` | `caos/server/engine/earnings.py` | landed |
| `compute-pathways` | `caos/server/engine/downside.py` | landed |
| `rate-sensitivity` | `caos/server/engine/macro.py` | landed |
| `interest-runway-months` | `caos/server/engine/liquidity.py` | landed |
| `build-scorecard` | `caos/server/engine/relval.py` | landed |
| `score-vuln` | `caos/server/engine/refinancing.py` | landed |
| `assess-fit` | `caos/server/engine/portfoliofit.py` | landed; no finite guard needed |
| `recovery-waterfall` | `caos/server/engine/capstructure.py` | landed; optional direct-caller guard deferred |

## Rule

During cert, engine changes are limited to correctness fixes for this frozen
surface. Feature work waits for the next phase gate.
