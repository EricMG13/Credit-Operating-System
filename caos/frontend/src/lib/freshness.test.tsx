// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FreshnessIndicator } from "@/components/shared/FreshnessIndicator";
import {
  FRESHNESS_VIEW,
  resolvePipelineFreshnessRunId,
  resolveReportFreshnessTarget,
  toProvFreshness,
  worstFreshness,
} from "./freshness";
import type { FreshnessEvaluation, FreshnessState } from "@/lib/api";

const evaluation = (state: FreshnessState): FreshnessEvaluation => ({
  state,
  source_kind: "run",
  observed_at: "2026-07-01T00:00:00Z",
  effective_period_end: null,
  expected_next_at: null,
  due_at: null,
  age_days: 13,
  reason: `run_${state}`,
  policy_version: "caos-freshness-v1",
});

afterEach(cleanup);

describe("central freshness view mapping", () => {
  it.each(["current", "due", "stale", "unknown"] as const)("keeps %s distinct", (state) => {
    expect(toProvFreshness(evaluation(state))).toBe(FRESHNESS_VIEW[state].label);
    render(<FreshnessIndicator evaluation={evaluation(state)} />);
    expect(screen.getByText(FRESHNESS_VIEW[state].label)).toBeTruthy();
    expect(screen.getByLabelText(new RegExp(`Freshness ${FRESHNESS_VIEW[state].label}`)).getAttribute("title")).toContain("caos-freshness-v1");
  });

  it("renders absent data as UNKNOWN and does not let current hide a worse sibling", () => {
    expect(toProvFreshness(null)).toBe("UNKNOWN");
    expect(worstFreshness([evaluation("current"), evaluation("due")])?.state).toBe("due");
    expect(worstFreshness([evaluation("current"), evaluation("unknown"), evaluation("stale")])?.state).toBe("stale");
    render(<FreshnessIndicator evaluation={null} />);
    expect(screen.getByText("UNKNOWN")).toBeTruthy();
  });
});

describe("exact surface freshness identity", () => {
  it("binds an old selected report to its own report id and run", () => {
    expect(resolveReportFreshnessTarget(
      { id: "report-old", run_id: "run-old" },
      "run-latest",
    )).toEqual({ artifactId: "report-old", runId: "run-old" });
  });

  it("binds a live draft to the engine run and no prior report", () => {
    expect(resolveReportFreshnessTarget(null, "run-latest")).toEqual({
      artifactId: null,
      runId: "run-latest",
    });
  });

  it("prefers an exact Pipeline URL run and otherwise uses the selected live run", () => {
    expect(resolvePipelineFreshnessRunId("run-url", "run-live")).toBe("run-url");
    expect(resolvePipelineFreshnessRunId(null, "run-live")).toBe("run-live");
    expect(resolvePipelineFreshnessRunId(null, null)).toBeNull();
  });
});
