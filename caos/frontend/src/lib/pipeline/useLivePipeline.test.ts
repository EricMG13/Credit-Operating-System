import { describe, expect, it } from "vitest";
import { buildLiveSnapshot, liveOutcome } from "./useLivePipeline";
import { EDGES, MODULES } from "./data";
import type { ModuleDetailDTO, ModuleStatusDTO, RunSummaryDTO } from "@/lib/engine/types";

function mod(
  module_id: string,
  committee_status: string,
  qa_status = "Passed",
  confidence = "High",
): ModuleStatusDTO {
  return { module_id, module_name: module_id, committee_status, qa_status, confidence, validation_status: "Passed" };
}

function run(committee_status: string, modules: ModuleStatusDTO[]): RunSummaryDTO {
  return {
    id: "run-1", issuer_id: "iss", status: "complete", qa_status: "Restricted",
    committee_status, as_of_date: null, model_id: "claude-opus-4-8", prompt_version: "v2.0",
    error: null, modules,
  };
}

const cpx = {
  runtime_output: {
    gate_status: "Full Run",
    summary: "Route plan includes 19 modules.",
    execution_sequence: [{ module_id: "CP-1", depends_on: ["CP-0"] }, { module_id: "CP-4C", depends_on: ["CP-1"] }],
  },
} as unknown as ModuleDetailDTO;

describe("buildLiveSnapshot", () => {
  it("registers CP-2G and CP-4D in the graph without synthetic completion rows", () => {
    expect(MODULES.some((module) => module.id === "CP-2G")).toBe(true);
    expect(MODULES.some((module) => module.id === "CP-4D")).toBe(true);
    expect(EDGES).toContainEqual(["CP-2G", "CP-6A"]);
    expect(EDGES).toContainEqual(["CP-4D", "CP-4C"]);
    const snapshot = buildLiveSnapshot(run("Committee Ready", [mod("CP-1", "Committee Ready")]), cpx);
    expect(snapshot.sim.mods["CP-2G"].state).toBe("idle");
    expect(snapshot.sim.mods["CP-4D"].state).toBe("idle");
  });
  it("maps committee_status to node states; unproduced nodes stay idle", () => {
    const s = buildLiveSnapshot(
      run("Blocked", [mod("CP-1", "Restricted"), mod("CP-2", "Committee Ready"), mod("CP-4C", "Blocked")]), cpx);
    expect(s.sim.mods["CP-1"].state).toBe("warning");
    expect(s.sim.mods["CP-2"].state).toBe("pass");
    expect(s.sim.mods["CP-4C"].state).toBe("blocked");
    expect(s.sim.mods["CP-6A"].state).toBe("idle"); // never produced by this run
  });

  it("clearance uses run committee_status; scope = produced modules", () => {
    const s = buildLiveSnapshot(run("Restricted", [mod("CP-1", "Restricted"), mod("CP-2", "Committee Ready")]), cpx);
    expect(s.committeeStatus).toBe("Restricted");
    expect(s.gateStatus).toBe("Full Run");
    expect(s.scope.has("CP-2")).toBe(true);
    expect(s.scope.has("CP-6A")).toBe(false);
    expect(s.total).toBe(2);
    expect(s.completed).toBe(2); // pass + warning both clear
  });

  it("falls back when the CP-X plan is absent (404 → null)", () => {
    const s = buildLiveSnapshot(run("Committee Ready", [mod("CP-1", "Committee Ready")]), null);
    expect(s.gateStatus).toBe("Committee Ready"); // no route plan → committee_status
    expect(s.summary).toBe("");
    expect(s.plan).toHaveLength(1);
  });
});

describe("liveOutcome", () => {
  it("Insufficient/Draft → warning; unknown fails closed (never green pass)", () => {
    expect(liveOutcome(mod("X", "Insufficient Information"))).toBe("warning");
    expect(liveOutcome(mod("X", "Draft Only"))).toBe("warning");
    // A Blocked QA verdict on an unknown committee_status → blocked.
    expect(liveOutcome({ ...mod("X", "Weird"), qa_status: "Blocked" })).toBe("blocked");
    // An unrecognized/missing committee_status must NOT read green "pass" —
    // it degrades to a non-pass "warning" on a clearance tool.
    expect(liveOutcome(mod("X", "Weird"))).toBe("warning");
    expect(liveOutcome(mod("X", ""))).toBe("warning");
  });
});
