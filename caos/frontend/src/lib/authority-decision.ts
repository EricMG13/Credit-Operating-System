import type { AuthorityEnvelope } from "@/lib/analysis-workbench";
import type { DecisionAuthority } from "@/lib/decision-state";

export function authorityProvenance(authority: AuthorityEnvelope): DecisionAuthority["provenance"] {
  return {
    origin: authority.origin === "live" ? "LIVE" : authority.origin === "demo" ? "DEMO" : "REFERENCE",
    method: "DERIVED",
    freshness: authority.freshness === "current" ? "CURRENT" : authority.freshness === "stale" ? "STALE" : "UNKNOWN",
    detail: authority.method,
  };
}
