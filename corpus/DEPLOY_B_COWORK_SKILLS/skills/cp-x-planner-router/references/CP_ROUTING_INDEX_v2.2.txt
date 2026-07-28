CP ROUTING INDEX v2.6 (32 deployable modules)
data preparation->CP-PARSE(L-1) | source readiness->CP-0(L0) | route plan->CP-X(Orch) |
financial data,KPIs->CP-1(L1) | business,transaction->CP-1A(L1) | earnings delta->CP-1B(L1) | peer benchmark->CP-1C(L1) |
fundamental credit->CP-2(L2) | downside,stress->CP-2A(L2) | event catalyst->CP-2B(L2) | governance,sponsor->CP-2C(L2) | liquidity,CFO->CP-2D(L2) | macro,FX->CP-2E(L2) | ESG,sustainability,SLL->CP-2F(L2) | forward credit model,deleveraging,forecast cases->CP-2G(L2) | rating migration,trigger headroom,agency divergence->CP-2H(L2) |
relative value,spread->CP-3(L3) | recovery,waterfall->CP-3A(L3) | portfolio fit,sizing->CP-3B(L3) | refinancing,LME->CP-3C(L3) | market-implied credit,technicals,curve dislocation->CP-3D(L3) |
legal,covenant->CP-4(L4) | covenant capacity->CP-4A(L4) | structural subordination,guarantees->CP-4B(L4) | restructuring scenario,fulcrum,plan recovery->CP-4C(L4) |
evidence trace->CP-5(L5) | QA,audit->CP-5A(L5) | IC debate->CP-6(L6) | portfolio debate->CP-6A(L6) |
issuer or sector deep research,user-scoped research->CP-DR(L7) | email/news intelligence,ranked digest,run-local signals->CP-EMAIL(L7,standalone) | decision post-mortem->CP-8(L8)

CP-DR replaces CP-SR for new runs. Historical CP-SR artifacts are sources, not route targets. CP-DR can run standalone; CP-0 is optional advisory input. Web/hybrid research requires verified web capability and an approved plan.
CP-EMAIL owns `intelligence_digest`, requires no upstream CP module and has no dependency edge. Its specialist, CP-X and CP-DR follow-ups are displayed manual recommendations only. The retired CP-MON command is a compatibility rewrite defined in CP_MODULE_ID_ALIASES_v1.md, not a route target.
