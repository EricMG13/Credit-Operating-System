// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_CASE, parseAssumptions, saveAssumptions } from "./assumptions";

afterEach(() => localStorage.clear());

describe("persisted assumptions validation", () => {
  it("accepts only known finite numeric case and year fields", () => {
    const parsed = parseAssumptions(JSON.stringify({
      base: { mInt: 1.25, gDrive: "bad", unknown: 99 },
      down: { mCapex: 1.4 },
      baseYears: { 0: { mInt: 2, mTax: "bad", unknown: 4 }, 8: { mInt: 9 } },
    }));
    expect(parsed?.base.mInt).toBe(1.25);
    expect(parsed?.base.gDrive).toBe(DEFAULT_CASE.gDrive);
    expect(parsed?.base).not.toHaveProperty("unknown");
    expect(parsed?.baseYears).toEqual({ 0: { mInt: 2 } });
  });

  it("rejects non-finite values on load and save", () => {
    const parsed = parseAssumptions('{"base":{"mInt":1e999},"down":{"mInt":1}}');
    expect(parsed?.base.mInt).toBe(DEFAULT_CASE.mInt);

    saveAssumptions("issuer-1", {
      base: { ...DEFAULT_CASE, mInt: Number.NaN },
      down: { ...DEFAULT_CASE, mTax: Number.POSITIVE_INFINITY },
      baseYears: { 0: { mCapex: Number.NEGATIVE_INFINITY } },
    });
    const stored = JSON.parse(localStorage.getItem("caos-d-assumptions:issuer-1") || "{}");
    expect(stored.base.mInt).toBe(DEFAULT_CASE.mInt);
    expect(stored.down.mTax).toBe(DEFAULT_CASE.mTax);
    expect(stored.baseYears).toEqual({});
  });
});
