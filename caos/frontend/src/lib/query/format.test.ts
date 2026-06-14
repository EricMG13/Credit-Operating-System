import { describe, expect, it } from "vitest";
import { fmtMetric } from "./format";

describe("fmtMetric", () => {
  it("formats $M with thousands separator and no decimals", () => {
    expect(fmtMetric(2801, "$M")).toBe("$2,801M");
    expect(fmtMetric(421.4, "$M")).toBe("$421M");
  });

  it("formats percentages to one decimal", () => {
    expect(fmtMetric(15, "%")).toBe("15.0%");
    expect(fmtMetric(28.04, "%")).toBe("28.0%");
  });

  it("formats multiples to two decimals", () => {
    expect(fmtMetric(5.68, "x")).toBe("5.68x");
  });

  it("passes through unknown units", () => {
    expect(fmtMetric(3, "")).toBe("3");
  });
});
