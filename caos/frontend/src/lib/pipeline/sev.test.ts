import { describe, expect, it } from "vitest";
import { SEV_COLOR, isCleared, moduleLiveState, sevSurface, sevVar } from "./sev";

describe("isCleared", () => {
  it("is true only for pass / warning (both unblock downstream)", () => {
    expect(isCleared("pass")).toBe(true);
    expect(isCleared("warning")).toBe(true);
  });
  it("is false for everything else, incl. undefined", () => {
    for (const s of ["idle", "running", "held", "blocked", "critical", undefined]) {
      expect(isCleared(s)).toBe(false);
    }
  });
});

describe("moduleLiveState", () => {
  it("maps a produced module's qa_status to a launcher state", () => {
    expect(moduleLiveState("Passed")).toBe("pass");
    expect(moduleLiveState("Restricted")).toBe("warning"); // cleared-with-concerns
  });
  it("maps 'Not Reviewed' to its own state — never silently 'pass'", () => {
    // A module that hasn't been reviewed yet is not the same fact as a clean
    // pass; a caller that folded them together (the prior behavior) showed an
    // unreviewed module as if review had happened and it cleared.
    expect(moduleLiveState("Not Reviewed")).toBe("not-reviewed");
    expect(moduleLiveState("Not Reviewed")).not.toBe("pass");
  });
  it("'not-reviewed' is not 'cleared' — it hasn't earned that yet", () => {
    expect(isCleared(moduleLiveState("Not Reviewed"))).toBe(false);
  });
  it("maps the engine's per-module failure gate (Blocked) to failed", () => {
    // runner._persist_blocked sets qa_status="Blocked"; it must read as failed —
    // NOT as a false pass (the module row IS persisted) and NOT as idle.
    expect(moduleLiveState("Blocked")).toBe("failed");
  });
  it("treats an absent module (undefined) as idle — not produced this run", () => {
    expect(moduleLiveState(undefined)).toBe("idle");
  });
  it("failed is not 'cleared' (a failed module must not unlock its pane)", () => {
    expect(isCleared(moduleLiveState("Blocked"))).toBe(false);
  });
});

describe("sevVar", () => {
  it("maps a known token to its color", () => {
    expect(sevVar("pass")).toBe(SEV_COLOR.pass);
    expect(sevVar("critical")).toBe(SEV_COLOR.critical);
  });
  it("falls back to idle for an unknown token", () => {
    expect(sevVar("nonsense")).toBe("var(--caos-idle)");
  });
});

describe("sevSurface", () => {
  it("builds a color-mix triple with default border 38 / wash 10", () => {
    const s = sevSurface("warning");
    const c = SEV_COLOR.warning;
    expect(s.color).toBe(c);
    expect(s.borderColor).toBe(`color-mix(in srgb, ${c} 38%, transparent)`);
    expect(s.background).toBe(`color-mix(in srgb, ${c} 10%, transparent)`);
  });
  it("honors border/wash overrides", () => {
    const s = sevSurface("ok", { border: 50, wash: 5 });
    const c = SEV_COLOR.ok;
    expect(s.borderColor).toBe(`color-mix(in srgb, ${c} 50%, transparent)`);
    expect(s.background).toBe(`color-mix(in srgb, ${c} 5%, transparent)`);
  });
  it("uses the idle fallback color for an unknown severity", () => {
    expect(sevSurface("nope").color).toBe("var(--caos-idle)");
  });
});
