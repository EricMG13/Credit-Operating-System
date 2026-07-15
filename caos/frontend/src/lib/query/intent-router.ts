// Deterministic, client-side pre-submit intent classifier — decides whether
// the ONE composer's Run action should call the metric-scan lane
// (scanMetrics → /api/query/nl) or the graph-walk lane (submit → the
// existing LLM-router-with-keyword-fallback in app/query/page.tsx). This is
// a NEW triage layer above that existing router — it does not replace
// queryRoute's job of picking WHICH walk/capability to run within the graph
// lane, only whether to enter the metric lane at all.
//
// No LLM call here — pure pattern match, so classification is instant and
// pre-submit-visible (the LaneRouter chip updates on every keystroke).
// "Never route into a dead lane": callers pass whether the metric lane is
// backed by a reachable model tier; when it isn't, this never returns
// "metric" even if the text pattern-matches one.

export type QueryLane = "metric" | "graph";

export interface LaneChoice {
  lane: QueryLane;
  /** The matched rule, verbatim — shown as the chip's tooltip. */
  reason: string;
}

interface Pattern {
  re: RegExp;
  reason: string;
}

// Comparator / ranking / threshold language — "issuers with leverage above
// 6x", "rank by DM", "top 10 most levered". This is exactly the shape the
// deterministic metric planner (/api/query/nl) is built for.
const METRIC_PATTERNS: Pattern[] = [
  { re: /\b(rank|sort|top\s+\d+|highest|lowest|most|least)\b/i, reason: "ranking language" },
  { re: /(>=|<=|>|<)\s*\d/, reason: "numeric comparator" },
  { re: /\b(greater than|less than|at least|at most|above|below|over|under)\s+\d/i, reason: "numeric threshold" },
  { re: /\bissuers?\s+(with|where)\b/i, reason: "issuer filter" },
];

// Relationship / provenance / explanatory language — the graph-walk lane's
// natural shape.
const GRAPH_PATTERNS: Pattern[] = [
  { re: /\b(peer|peers|related|connected|linked|network|graph|map)\b/i, reason: "relationship language" },
  { re: /\b(trace|lineage|evidence|source|why|how)\b/i, reason: "explanatory / provenance language" },
];

export function classifyIntent(
  text: string,
  opts: { metricLaneAvailable: boolean },
): LaneChoice {
  const t = text.trim();
  if (!t) return { lane: "graph", reason: "no input yet — graph is the default lane" };

  for (const p of GRAPH_PATTERNS) {
    if (p.re.test(t)) return { lane: "graph", reason: p.reason };
  }
  if (opts.metricLaneAvailable) {
    for (const p of METRIC_PATTERNS) {
      if (p.re.test(t)) return { lane: "metric", reason: p.reason };
    }
  }
  return { lane: "graph", reason: "default — relationship/graph walk" };
}
