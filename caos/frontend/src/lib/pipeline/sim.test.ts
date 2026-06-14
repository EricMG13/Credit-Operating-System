import { describe, it, expect } from "vitest";
import { isCleared, sevVar, sevSurface, simClock } from "./sim";

describe("isCleared", () => {
  it("treats pass and warning as cleared (both unblock downstream)", () => {
    expect(isCleared("pass")).toBe(true);
    expect(isCleared("warning")).toBe(true);
  });

  it("treats everything else, including undefined, as not cleared", () => {
    for (const s of ["idle", "running", "held", "blocked", "critical", undefined]) {
      expect(isCleared(s)).toBe(false);
    }
  });
});

describe("sevVar / sevSurface", () => {
  it("maps a severity token to its CSS var, falling back to idle", () => {
    expect(sevVar("critical")).toBe("var(--caos-critical)");
    expect(sevVar("unknown-token")).toBe("var(--caos-idle)");
  });

  it("builds a valid color-mix surface for var-based severities (regression: the old `color + \"44\"` was invalid CSS)", () => {
    const s = sevSurface("critical");
    expect(s.color).toBe("var(--caos-critical)");
    expect(s.borderColor).toBe("color-mix(in srgb, var(--caos-critical) 38%, transparent)");
    expect(s.background).toBe("color-mix(in srgb, var(--caos-critical) 10%, transparent)");
  });

  it("honors custom border/wash percentages", () => {
    const s = sevSurface("warning", { border: 50, wash: 20 });
    expect(s.borderColor).toContain("50%");
    expect(s.background).toContain("20%");
  });
});

describe("simClock", () => {
  it("formats the tick offset from 09:30:00 as HH:MM:SS (7 sim-seconds/tick)", () => {
    expect(simClock(0)).toBe("09:30:00");
    expect(simClock(1)).toBe("09:30:07");
    expect(simClock(60)).toBe("09:37:00");
  });
});
