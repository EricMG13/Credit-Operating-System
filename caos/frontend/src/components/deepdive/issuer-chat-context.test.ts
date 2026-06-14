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
});
