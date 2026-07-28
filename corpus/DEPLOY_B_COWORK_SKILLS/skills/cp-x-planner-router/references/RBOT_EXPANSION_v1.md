# RBOT expansion addendum — CP-2G, CP-2H, CP-3D and CP-4C

Effective 2026-07-21. This addendum is binding wherever an older companion still states 28 modules, 29 entries, a 22-node graph, a proposed status, or the superseded CP-SR as a live route. Each deployment has the same 32 CP modules. Structure B adds one packaging-only `rbot-orchestrator` entry; it has no CP module ID or analytical payload. CP-DR owns all new user-scoped issuer or sector research.

## Ownership and hard boundaries

| Module | Owned object | Minimum gate | Produces | Must not do |
|---|---|---|---|---|
| CP-2G ForwardCreditModel | `forward_credit_model` | CP-1 identity, period and canonical history match | Base/upside/downside earnings, FCF, debt, liquidity, leverage, coverage and breakpoints | Replace CP-2A/CP-2D, use silent plugs, invent probabilities, issue a rating or recommend a security |
| CP-2H RatingTransitionCase | `rating_transition_case` | Current sourced agency rating/outlook/criteria and explicit metric bridge | Agency trigger headroom, migration pressure, divergence and monitoring cases | Issue a formal/shadow rating, fabricate triggers, or present RBOT classes as agency actions |
| CP-3D MarketImpliedRiskMap | `market_implied_risk_map` | Security identity, timestamp/timezone, quote type, convention and benchmark | Issuer curve, model-dependent implied risk, liquidity/technicals and fundamental-market gap | Fabricate market data or turn the map into a recommendation, rank or position size |
| CP-4C RestructuringScenario | `restructuring_scenario` | Sourced distress gate plus relevant jurisdiction, claim and priority evidence | Path comparison, claims reconciliation, valuation, waterfalls, fulcrum range and class recoveries | Treat price alone as distress, double count claims/guarantees, give legal advice or issue a trade direction |

## Dependency insertion

Use the exact current v2.6 ownership, boundaries and edges in `CP_ROUTING_INDEX_v2.2.txt`, `CP-X_ROUTING_LOGIC_v2.2.txt` and `CP-X_ROUTE_GRAPH_v2.2.txt`; the filenames are retained for citation stability. In ordinary use:

1. CP-2G follows CP-1 and consumes only the relevant validated CP-2/CP-2A/CP-2D/CP-2E drivers.
2. CP-2H follows verified agency evidence and normally consumes CP-2G forecast cases.
3. CP-3D may run alongside CP-3/CP-3C after market and fundamental gates; CP-3 consumes its evidence when available.
4. CP-4C runs only after its distress gate; it consumes relevant CP-2G, CP-3C, CP-3D, CP-4, CP-4A, CP-4B and claims evidence.
5. CP-5 and CP-5A retain their evidence/QA gates; CP-6 and CP-6A retain their debate gates.

## Named-path updates

- Full credit assessment: add CP-2G then CP-2H after the L2 specialist work; add CP-3D alongside L3; add CP-4C only when its distress gate is met.
- Relative value: CP-2G -> CP-3D -> CP-3, with CP-2H where ratings migration is material.
- Ratings review: CP-1 -> CP-2G -> CP-2H -> CP-5 -> CP-5A -> CP-6 as required.
- Distressed/LME: CP-2A + CP-2D -> CP-2G -> CP-2H + CP-3C + CP-3D -> CP-4 + CP-4B + CP-4A -> CP-4C.
- Displayed intelligence digest: run CP-EMAIL standalone with no upstream or handoff. It may display manual recommendations such as `Run CP-2H` for ratings evidence, `Run CP-3D` for market dislocation, `Run CP-2G` for forecast deterioration or `Run CP-4C` for a sourced distress case. The user must invoke any recommendation separately; CP-EMAIL never routes, activates or feeds the specialist and creates no dependency edge.

## Structure parity

Structure A is flat and Structure B uses progressive disclosure. For each of these four modules, `MODULE_RUNBOOK.md`, module schema, six phase references and payload schema are byte-identical across A and B. Neither structure assumes a built-in research mode, autonomous agent-to-agent calls or a product-specific execution feature. Analytical capability comes only from the instructions, supplied support files and tools explicitly available to the run.
