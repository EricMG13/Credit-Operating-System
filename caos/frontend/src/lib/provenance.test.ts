import { describe, it, expect } from "vitest";
import { fromSeedFlag, fromModelEngine, fromReportCaveat } from "./provenance";

describe("provenance mappers (RT-2026-07-11-65)", () => {
  it("seed flags: seed→DEMO, live→LIVE, unknown→null (caller keeps bespoke rendering)", () => {
    expect(fromSeedFlag("seed")?.origin).toBe("DEMO");
    expect(fromSeedFlag("live")?.origin).toBe("LIVE");
    expect(fromSeedFlag("mystery")).toBeNull();
    expect(fromSeedFlag(undefined)).toBeNull();
  });

  it("model engine: LIVE strictly requires live AND anchor", () => {
    expect(fromModelEngine({ live: true, anchor: { x: 1 }, runId: "r-1" }).origin).toBe("LIVE");
    expect(fromModelEngine({ live: true, anchor: null }).origin).toBe("DEMO");
    expect(fromModelEngine({ live: false, anchor: { x: 1 } }).origin).toBe("DEMO");
    expect(fromModelEngine({ live: false, anchor: null }).origin).toBe("DEMO");
  });

  it("report caveats: reference→REFERENCE, live→LIVE, unknown states→null (never guessed)", () => {
    expect(fromReportCaveat("reference", false)?.origin).toBe("REFERENCE");
    expect(fromReportCaveat("reference", true)?.origin).toBe("REFERENCE");
    expect(fromReportCaveat("live", true)?.origin).toBe("LIVE");
    expect(fromReportCaveat("loading", false)).toBeNull();
    expect(fromReportCaveat("error", false)).toBeNull();
    expect(fromReportCaveat("noRun", false)).toBeNull();
  });

  it("no mapper fabricates freshness — omitted axis stays omitted", () => {
    for (const p of [
      fromSeedFlag("seed"),
      fromSeedFlag("live"),
      fromModelEngine({ live: true, anchor: {}, runId: "r" }),
      fromReportCaveat("reference", false),
      fromReportCaveat("live", true),
    ]) {
      expect(p?.freshness).toBeUndefined();
    }
  });
});
