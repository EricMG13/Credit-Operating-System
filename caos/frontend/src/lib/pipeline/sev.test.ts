import { describe, expect, it } from "vitest";
import { SEV_COLOR, isCleared, sevSurface, sevVar } from "./sev";

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
