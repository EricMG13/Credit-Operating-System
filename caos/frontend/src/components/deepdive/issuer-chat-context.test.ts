import { describe, it, expect } from "vitest";
import { caosChatContext } from "./IssuerChat";

// The Evidence Sync grounding: the assistant's context must reflect the evidence
// the analyst is pointing at, so deictic questions ("is this a problem?")
// resolve to the right citation.
describe("caosChatContext", () => {
  it("always carries the issuer and the current module", () => {
    const ctx = caosChatContext("CP-4");
    expect(ctx).toContain("Atlas Forge");
    expect(ctx).toContain("USER IS CURRENTLY VIEWING: CP-4");
  });

  it("injects the focused evidence when one is set", () => {
    const ctx = caosChatContext("CP-4", "E-44");
    expect(ctx).toContain("ANALYST IS POINTING AT EVIDENCE E-44");
    expect(ctx).toMatch(/Cited passage:/);
  });

  it("omits the focus line when nothing is focused", () => {
    expect(caosChatContext("CP-4", null)).not.toContain("ANALYST IS POINTING AT EVIDENCE");
  });

  it("ignores an unknown evidence id without crashing or injecting a focus line", () => {
    expect(caosChatContext("CP-4", "E-999")).not.toContain("ANALYST IS POINTING AT EVIDENCE");
  });

  it("grounds in the live run and drops the ATLF fixtures when a run is present", () => {
    const live = {
      runId: "abcd1234-ef56-7890",
      committeeStatus: "Restricted",
      council: [{
        finding_id: "CP-5C-1", severity: "High", lane: 5, module_id: "CP-1",
        description: "E-44 citation page mismatch", affected_claim_id: null, required_remediation: null,
      }],
      liveOuts: { "CP-2": { kpis: [{ l: "Energy cost %", v: "12" }], sections: [] } },
      liveEvidence: {},
      loading: false,
    };
    const ctx = caosChatContext("CP-2", null, live, "Beacon Street Media");
    expect(ctx).toContain("run abcd1234-ef56-7890");
    expect(ctx).toContain("Beacon Street Media");
    expect(ctx).toContain("CP-2 (CURRENTLY VIEWING)");
    expect(ctx).toContain("COMMITTEE REVIEW (CP-5C)");
    // honesty property: a non-reference live run must NOT leak the ATLF reference fixtures
    expect(ctx).not.toContain("Atlas Forge");
  });
});
