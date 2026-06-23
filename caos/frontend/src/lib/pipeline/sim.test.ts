import { describe, it, expect } from "vitest";
import { simClock } from "./sim";

// Severity-color helpers (isCleared / sevVar / sevSurface) moved to ./sev and
// are covered by sev.test.ts.

describe("simClock", () => {
  it("formats the tick offset from 09:30:00 as HH:MM:SS (7 sim-seconds/tick)", () => {
    expect(simClock(0)).toBe("09:30:00");
    expect(simClock(1)).toBe("09:30:07");
    expect(simClock(60)).toBe("09:37:00");
  });
});
