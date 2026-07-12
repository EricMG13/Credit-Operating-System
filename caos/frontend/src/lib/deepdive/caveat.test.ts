import { describe, expect, it } from "vitest";

import { deepDiveCaveatKind } from "./caveat";

describe("deepDiveCaveatKind", () => {
  it("the ATLF reference deal is the showcase", () => {
    expect(deepDiveCaveatKind({ isReference: true, loading: false, runId: null })).toBe("reference");
    // reference wins even while a run id is present
    expect(deepDiveCaveatKind({ isReference: true, loading: true, runId: "r1" })).toBe("reference");
  });

  it("a non-reference issuer with a completed run shows live output", () => {
    expect(deepDiveCaveatKind({ isReference: false, loading: false, runId: "r1" })).toBe("live");
  });

  it("a non-reference issuer still resolving its run is loading", () => {
    expect(deepDiveCaveatKind({ isReference: false, loading: true, runId: null })).toBe("loading");
  });

  // Regression: an issuer that exists but was never run must NOT claim live
  // output — it renders the reference template, and the disclaimer must say so.
  it("a non-reference issuer with no run is flagged noRun, never live", () => {
    const kind = deepDiveCaveatKind({ isReference: false, loading: false, runId: null });
    expect(kind).toBe("noRun");
    expect(kind).not.toBe("live");
  });

  // M-3: a genuine backend fetch failure (phase="error") must be told apart
  // from "issuer exists, never analysed" (noRun) — previously both collapsed to
  // the same generic message, hiding a real outage behind a normal empty read.
  it("phase='error' resolves to 'error', not noRun", () => {
    expect(deepDiveCaveatKind({ isReference: false, loading: false, runId: null, phase: "error" }))
      .toBe("error");
  });

  it("reference and loading still win over phase='error'", () => {
    expect(deepDiveCaveatKind({ isReference: true, loading: false, runId: null, phase: "error" }))
      .toBe("reference");
    expect(deepDiveCaveatKind({ isReference: false, loading: true, runId: null, phase: "error" }))
      .toBe("loading");
  });

  it("phase is optional — omitting it keeps the pre-existing runId-only behavior", () => {
    expect(deepDiveCaveatKind({ isReference: false, loading: false, runId: null })).toBe("noRun");
    expect(deepDiveCaveatKind({ isReference: false, loading: false, runId: "r1" })).toBe("live");
  });
});
