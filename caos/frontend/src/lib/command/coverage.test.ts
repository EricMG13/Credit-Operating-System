import { describe, it, expect } from "vitest";
import {
  worstStatus, STATUS_RANK, rollupRunToCells, runnableIssuerId, MODULE_LAYER, ATLF_COVERAGE_ROW,
} from "./coverage";
import { ATLF_REFERENCE_ISSUER_ID, type RunSummaryDTO } from "@/lib/engine/types";

const mod = (module_id: string, qa_status: string) => ({
  module_id, module_name: module_id, qa_status,
  committee_status: "n/a", confidence: "n/a", validation_status: "n/a",
});
const run = (over: Partial<RunSummaryDTO>): RunSummaryDTO => ({
  id: "r1", issuer_id: "i1", status: "complete", qa_status: "pass",
  committee_status: "n/a", as_of_date: null, model_id: null, prompt_version: null,
  error: null, modules: [], ...over,
});

describe("worstStatus", () => {
  it("returns the most attention-needing cell (blocked < stale < aging < fresh)", () => {
    expect(worstStatus({ L1: "fresh", L2: "stale", L3: "fresh" })).toBe("stale");
    expect(worstStatus({ L1: "aging", L2: "blocked", L3: "fresh" })).toBe("blocked");
    expect(worstStatus({ L1: "fresh", L2: "fresh" })).toBe("fresh");
  });
  it("ranks blocked strictly worse than stale, so blocked never hides under a red stale", () => {
    expect(STATUS_RANK.blocked).toBeLessThan(STATUS_RANK.stale);
  });
});

describe("runnableIssuerId (seeded↔engine boundary)", () => {
  it("resolves the engine-backed reference issuer, null for seeded-only codes", () => {
    expect(runnableIssuerId("ATLF")).toBe(ATLF_REFERENCE_ISSUER_ID);
    expect(runnableIssuerId("SXAA")).toBeNull();
    expect(runnableIssuerId("QLMH")).toBeNull();
  });
  it("the prepended ATLF matrix row IS runnable — the real-run path is reachable", () => {
    // Regression guard: the demo sleeve has no engine-backed code, so without
    // this row RE-RUN would be dead code (found in browser verification).
    expect(runnableIssuerId(ATLF_COVERAGE_ROW.code)).toBe(ATLF_REFERENCE_ISSUER_ID);
    expect(worstStatus(ATLF_COVERAGE_ROW.cells)).toBe("stale"); // seeds into the stale-triage bucket
  });
});

describe("rollupRunToCells (honest real-run → cells, no fabricated freshness)", () => {
  it("all of a layer's modules cleared → fresh; none → blocked; some → aging", () => {
    const cells = rollupRunToCells(run({
      qa_status: "pass",
      modules: [
        mod("CP-1", "pass"), mod("CP-1A", "warning"), // L1 all cleared → fresh
        mod("CP-2", "fail"), mod("CP-2B", "fail"),     // L2 none cleared → blocked
        mod("CP-3", "pass"), mod("CP-3B", "fail"),     // L3 mixed → aging
      ],
    }));
    expect(cells.L1).toBe("fresh");
    expect(cells.L2).toBe("blocked");
    expect(cells.L3).toBe("aging");
  });

  it("omits layers the run never touched — the caller keeps the seeded cell, never fabricates fresh", () => {
    const cells = rollupRunToCells(run({ qa_status: "pass", modules: [mod("CP-1", "pass")] }));
    expect(cells.L1).toBe("fresh");
    expect(cells.L4).toBeUndefined(); // no L4 module ran → not fabricated
    expect(cells.L6).toBeUndefined();
  });

  it("L5 (QA gate) rolls up from the run's own qa_status, not from a module", () => {
    expect(rollupRunToCells(run({ qa_status: "pass" })).L5).toBe("fresh");
    expect(rollupRunToCells(run({ qa_status: "fail" })).L5).toBe("blocked");
  });

  it("every mapped module resolves to one of the six visible layers", () => {
    for (const layer of Object.values(MODULE_LAYER)) {
      expect(["L1", "L2", "L3", "L4", "L5", "L6"]).toContain(layer);
    }
  });
});
