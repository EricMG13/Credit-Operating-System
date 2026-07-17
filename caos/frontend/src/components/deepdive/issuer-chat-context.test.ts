import { afterEach, describe, it, expect } from "vitest";
import { caosChatContext } from "./IssuerChat";
import { EVIDENCE } from "@/lib/reports/evidence";
import type { LiveRunState } from "@/lib/engine/useLiveRun";

function live(overrides: Partial<LiveRunState> = {}): LiveRunState {
  return {
    runId: "abcd1234-ef56-7890",
    committeeStatus: "Restricted",
    council: [],
    liveOuts: {},
    liveStatus: {},
    liveEvidence: {},
    loading: false,
    phase: "complete",
    ...overrides,
  };
}

afterEach(() => {
  delete EVIDENCE["E-TEST"];
  delete EVIDENCE["E-EMPTY"];
});

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
    const state = live({
      council: [{
        finding_id: "CP-5C-1", severity: "High", lane: 5, module_id: "CP-1",
        description: "E-44 citation page mismatch", affected_claim_id: null, required_remediation: null,
      }],
      liveOuts: { "CP-2": { kpis: [{ l: "Energy cost %", v: "12" }], sections: [] } },
      liveStatus: { "CP-2": "Passed" },
    });
    const ctx = caosChatContext("CP-2", null, state, "Beacon Street Media");
    expect(ctx).toContain("run abcd1234-ef56-7890");
    expect(ctx).toContain("Beacon Street Media");
    expect(ctx).toContain("CP-2 (CURRENTLY VIEWING)");
    expect(ctx).toContain("COMMITTEE REVIEW (CP-5C)");
    // honesty property: a non-reference live run must NOT leak the ATLF reference fixtures
    expect(ctx).not.toContain("Atlas Forge");
  });

  it("serializes every live output section and puts the current module first", () => {
    const ctx = caosChatContext("CP-2", "E-71", live({
      liveOuts: {
        "CP-Z": { kpis: [], sections: [{ type: "text", title: "View", body: "Narrative" }] },
        "CP-2": {
          kpis: [{ l: "Leverage", v: "5.0x" }],
          sections: [{ type: "table", title: "Bridge", cols: ["A"], rows: [["one", "two"]] }],
        },
        "CP-A": {
          kpis: [],
          sections: [{ type: "flags", title: "Flags", items: [{ sev: "HIGH", text: "Review" }] }],
        },
        "CP-EMPTY": { kpis: [], sections: [] },
      },
      committeeStatus: null,
    }));

    expect(ctx.indexOf("CP-2 (CURRENTLY VIEWING)")).toBeLessThan(ctx.indexOf("CP-A:"));
    expect(ctx).toContain("Bridge — one | two");
    expect(ctx).toContain("Flags — [HIGH] Review");
    expect(ctx).toContain("View — Narrative");
    expect(ctx).toContain("Committee status: —");
    expect(ctx).toContain("LoanX Prints — Jun 8, 2026 · MKT");
    expect(ctx).not.toContain("COMMITTEE REVIEW (CP-5C)");
  });

  it("describes an unavailable issuer run without leaking fixture figures", () => {
    const ctx = caosChatContext("", "E-44", live({ runId: null }), undefined);
    expect(ctx).toContain("No completed issuer-specific run is available");
    expect(ctx).toContain("ISSUER: this issuer");
    expect(ctx).not.toContain("USER IS CURRENTLY VIEWING");
    expect(ctx).toContain("Do not use Atlas Forge reference figures");
    expect(ctx).not.toContain("LTM adj. EBITDA");
    expect(ctx).not.toContain("ANALYST IS POINTING AT EVIDENCE");
  });

  it("includes the named module for an unavailable run", () => {
    const ctx = caosChatContext("CP-4", null, live({ runId: null }), "Named Issuer");
    expect(ctx).toContain("ISSUER: Named Issuer");
    expect(ctx).toMatch(/USER IS CURRENTLY VIEWING: CP-4 — /);
  });

  it("handles a generic live launcher and fallback issuer label", () => {
    const ctx = caosChatContext("", null, live({ committeeStatus: null }), undefined);
    expect(ctx).toContain("ISSUER: this issuer. Committee status: —");
    expect(ctx).not.toContain("USER IS CURRENTLY VIEWING");
  });

  it("keeps unknown module ids unlabeled on live and unavailable runs", () => {
    const current = caosChatContext("CP-UNKNOWN", null, live());
    const unavailable = caosChatContext("CP-UNKNOWN", null, live({ runId: null }));
    expect(current).toContain("USER IS CURRENTLY VIEWING: CP-UNKNOWN.");
    expect(unavailable).toContain("USER IS CURRENTLY VIEWING: CP-UNKNOWN.");
  });

  it("falls back to the first excerpt and omits absent page and QA metadata", () => {
    EVIDENCE["E-TEST"] = {
      doc: "D-X",
      page: null,
      section: "Fallback excerpt",
      status: "open",
      conf: 0.5,
      module: "CP-X",
      excerpt: [{ t: "first passage without a hit flag" }],
    };
    const ctx = caosChatContext("CP-4", "E-TEST");
    expect(ctx).toContain('Cited passage: "first passage without a hit flag"');
    expect(ctx).not.toContain("p.null");
    expect(ctx).not.toContain("QA:");
  });

  it("omits a cited passage when the evidence excerpt is empty", () => {
    EVIDENCE["E-EMPTY"] = {
      doc: "D-X",
      page: 2,
      section: "No passage",
      status: "verified",
      conf: 1,
      module: "CP-X",
      excerpt: [],
    };
    const ctx = caosChatContext("UNKNOWN", "E-EMPTY");
    expect(ctx).toContain("D-X p.2");
    expect(ctx).not.toContain("Cited passage:");
    expect(ctx).toContain("USER IS CURRENTLY VIEWING: UNKNOWN.");
  });
});
