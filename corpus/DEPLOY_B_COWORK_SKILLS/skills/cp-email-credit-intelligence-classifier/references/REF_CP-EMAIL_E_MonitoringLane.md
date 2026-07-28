# CP-EMAIL E — Run-Local Monitoring Lane

## Purpose

The internal monitoring lane preserves the retired CP-MON predecessor's useful analytical discipline without preserving a second module, external alert system or durable watchlist. It asks: could this story change the current credit assessment, monitoring intensity or required analytical work?

The lane is run-local. It does not claim continuous monitoring, autonomous refresh, persisted signal state, saved watchlists, connector health, notifications or background execution.

## Signal assessment

For every `WATCH`, `MATERIAL SIGNAL` and `URGENT ACTION` cluster, record:

`cluster_id | issuer/entity | level | direction | credit_channels | evidence -> mechanic -> implication | event_status | newness | evidence_confidence/reason | conflict | affected_instruments | analyst_action | optional_manual_module`

`INFORMATION` items may omit a signal assessment when they are context only.

## Materiality tests

Promote only when supported evidence answers one of these:

- Does liquidity runway, debt service, covenant compliance/headroom or near-term refinancing capacity change?
- Does default/LME probability, priming/structural risk or recovery value plausibly change?
- Does EBITDA/FCF deterioration impair deleveraging, market access or headroom?
- Does a rating, legal, regulatory, operational or governance event create a documented creditor pathway?
- Does a timestamped market move reveal a meaningful repricing/dislocation rather than unsupported colour?
- Does a loan/CLO fact change an evidenced obligor, facility, rating or eligibility consideration?

Do not invent thresholds. Apply issuer-specific covenant, guidance, maturity or monitoring thresholds only when sourced in the current run or accessible optional context. Absence of evidence never increases materiality.

## Temporal comparison

If an accessible prior digest or source history exists, identify acceleration, reversal, recurrence, gap closure, new theme, correction or substantive update and cite the comparison basis. If not, set `newness: NOT TESTED` where necessary and state `durable delta status unavailable`. Never imply persistent signal history from model memory.

## Manual follow-up map

| Need identified | Advisory command |
|---|---|
| Source/readiness gap | `Run CP-0` after the ID migration is live; until then use the current SourceReadiness command |
| Canonical financial refresh | `Run CP-1` |
| Dated event register | `Run CP-2B` |
| Forward cases/deleveraging | `Run CP-2G` |
| Ratings trigger/headroom | `Run CP-2H` |
| Refinancing/LME structure | `Run CP-3C` |
| Market-implied risk/technicals | `Run CP-3D` |
| Restructuring/fulcrum | `Run CP-4C` |
| Bounded deep research question | `Run CP-DR` |
| Route uncertainty | `Run CP-X` |

The digest may display a command recommendation, rationale and unresolved question. It never executes, approves, queues or routes the command and does not create a canonical analytical handoff.

## Boundary gate

CP-EMAIL owns the displayed `intelligence_digest`, run-local story clusters and run-local signal assessments only. CP-2B, CP-2G, CP-2H, CP-3C, CP-3D, CP-4C, CP-DR and CP-X retain their owned objects. CP-EMAIL does not issue ratings, legal conclusions, trade recommendations or position sizes.
