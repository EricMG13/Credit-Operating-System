CP-X ROUTE GRAPH v2.6 (32 deployable modules; filename retained for citation stability)

NODES: CP-PARSE,CP-0,CP-X,CP-1,CP-1A,CP-1B,CP-1C,CP-2,CP-2A,CP-2B,CP-2C,
CP-2D,CP-2E,CP-2F,CP-2G,CP-2H,CP-3,CP-3A,CP-3B,CP-3C,CP-3D,CP-4,CP-4A,CP-4B,CP-4C,CP-5,CP-5A,
CP-6,CP-6A,CP-DR,CP-EMAIL,CP-8

DEPENDENCY EDGES:
CP-PARSE->CP-0  CP-0->CP-X  CP-X->CP-1,CP-1A
CP-1->CP-1B,CP-1C,CP-2,CP-2A,CP-2D,CP-2G,CP-2H,CP-3,CP-3C,CP-3D,CP-4,CP-4A,CP-6
CP-1A->CP-2,CP-2C  CP-1B->CP-2,CP-2A  CP-1C->CP-2,CP-3,CP-6
CP-2->CP-2A,CP-2B,CP-2C,CP-2D,CP-2E,CP-2F,CP-2G,CP-2H,CP-3,CP-3D,CP-6
CP-2A->CP-2G,CP-4C,CP-3C,CP-6,CP-6A  CP-2B->CP-6  CP-2C->CP-6
CP-2D->CP-2G,CP-3,CP-3C,CP-4C,CP-6  CP-2E->CP-2G,CP-6  CP-2F->CP-6
CP-2G->CP-2H,CP-3,CP-3C,CP-3D,CP-4C,CP-6
CP-2H->CP-2B,CP-3,CP-3C,CP-3D,CP-6
CP-3->CP-3A,CP-3B,CP-6,CP-6A  CP-3A->CP-6  CP-3B->CP-6,CP-6A
CP-3C->CP-4,CP-4C,CP-6  CP-3D->CP-3,CP-3A,CP-3B,CP-4C,CP-6
CP-4->CP-4A,CP-4B,CP-4C,CP-6  CP-4B->CP-4A,CP-4C,CP-6
CP-4A->CP-4C,CP-6,CP-6A  CP-4C->CP-6,CP-6A
CP-5->CP-5A  CP-6->CP-6A,CP-5  CP-6A->CP-5
CP-DR->CP-X,CP-1,CP-2,CP-2G,CP-2H,CP-3D,CP-4C,CP-5A,CP-6,CP-6A
ALL ANALYTICAL->CP-5,CP-5A (implicit)  VALIDATED DECISIONS->CP-8 (optional post-mortem)

OPTIONAL / ADVISORY INPUTS (not dependency edges):
CP-0~>CP-DR advisory source map; Blocked CP-0 supplies gaps only.
CP-EMAIL is standalone, has no required upstream and owns the run-local intelligence_digest.
CP-EMAIL may display a manual `Run CP-X` or direct-specialist recommendation; it never invokes, schedules or grounds the recommended module.
CP-DR may display a manual `Run CP-EMAIL` monitoring-scope recommendation, and CP-EMAIL may display a manual `Run CP-DR` research-question recommendation. Neither creates a handoff, trigger, dependency edge or recursive run.

LAYERS: L-1->L0->Orch->L1->L2->L3->L4->L5->L6; L7 research/intelligence is standalone or routed where an explicit dependency edge exists; L8 is terminal.

CHANGELOG v2.6: CP-EMAIL replaced the former CP-MON node, owns intelligence_digest, has no dependency edges and permits manual advisory follow-ups only. v2.5 added CP-2G forward model, CP-2H rating transition, CP-3D market-implied risk and CP-4C restructuring scenario ownership and routes. v2.4 superseded CP-SR with user-scoped CP-DR; added CP-PARSE, CP-2F, CP-4B and CP-8.
