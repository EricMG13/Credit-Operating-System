import { describe, expect, it } from "vitest";

import {
  ALERTS,
  CRITICAL_ALERTS,
  EMAILS,
  EMAIL_TILES,
  EMAIL_TOTAL,
  simAlertsToday,
} from "./monitor-data";

describe("Monitor authored data contracts", () => {
  it("monitor-01 monitor-03 monitor-04 monitor-07 boundary conditions reconcile fixed totals and capped replay counts", () => {
    expect(EMAIL_TOTAL).toBe(105);
    expect(EMAIL_TOTAL).toBe(
      EMAIL_TILES.critical + EMAIL_TILES.high + EMAIL_TILES.medium + EMAIL_TILES.low,
    );
    expect(EMAILS).toHaveLength(8);
    expect(CRITICAL_ALERTS).toBe(ALERTS.filter((alert) => alert.sev === "critical").length);
    expect(simAlertsToday(0, true)).toBe(2);
    expect(simAlertsToday(5, true)).toBe(3);
    expect(simAlertsToday(Number.MAX_SAFE_INTEGER, true)).toBe(ALERTS.length);
    expect(simAlertsToday(0, false)).toBe(ALERTS.length);
  });

  it("monitor-05 monitor-06 monitor-07 invalid input degrades non-finite and negative replay ticks to the opening baseline", () => {
    for (const tick of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -1, -10_000]) {
      expect(simAlertsToday(tick, true)).toBe(2);
    }
  });

  it("monitor-01 monitor-02 monitor-03 monitor-04 monitor-05 monitor-06 monitor-07 performance keeps authored tapes finite and bounded", () => {
    const counts = Array.from({ length: 10_001 }, (_, tick) => simAlertsToday(tick, true));
    expect(counts.every(Number.isFinite)).toBe(true);
    expect(counts.every((count) => count >= 0 && count <= ALERTS.length)).toBe(true);
    expect(counts.every((count, index) => index === 0 || count >= counts[index - 1])).toBe(true);
    expect(new Set(ALERTS.map((alert) => alert.code)).size).toBe(ALERTS.length);
  });
});
