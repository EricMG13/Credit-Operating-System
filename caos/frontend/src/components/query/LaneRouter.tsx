"use client";

// The pre-submit lane indicator for Query's one composer — shows which lane
// Run will fire into (metric scan vs graph walk) and why, with a one-click
// reroute to the other lane. Visible BEFORE submit, updates live as the
// analyst types (Alex's "explainable, reversible intent router" red-flag).

import type { LaneChoice, QueryLane } from "@/lib/query/intent-router";

const LANE_LABEL: Record<QueryLane, string> = {
  metric: "METRIC SCAN",
  graph: "GRAPH WALK",
};

export function LaneRouter({
  choice,
  onOverride,
}: {
  choice: LaneChoice;
  onOverride: (lane: QueryLane) => void;
}) {
  const other: QueryLane = choice.lane === "metric" ? "graph" : "metric";
  return (
    <div className="flex items-center gap-1.5 px-0.5 pt-1" title={choice.reason}>
      <span className="tabular text-caos-3xs uppercase tracking-wider text-caos-muted">routed →</span>
      <span className="tabular text-caos-3xs uppercase tracking-wider rounded px-1.5 py-px border border-caos-accent/50 text-caos-accent bg-caos-accent/10">
        {LANE_LABEL[choice.lane]}
      </span>
      <span className="tabular text-caos-3xs text-caos-muted truncate max-w-[220px]">{choice.reason}</span>
      <button
        type="button"
        onClick={() => onOverride(other)}
        className="tabular text-caos-3xs text-caos-muted hover:text-caos-accent transition-caos focus-ring rounded px-1 ml-auto"
      >
        reroute: {LANE_LABEL[other]}
      </button>
    </div>
  );
}
