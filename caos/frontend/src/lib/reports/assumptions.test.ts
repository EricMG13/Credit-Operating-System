// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { ATLF_REFERENCE_ISSUER_ID } from "@/lib/engine/types";
import {
  DEFAULT_ASSUMPTIONS, DEFAULT_CASE, caseModifiedCount, effectiveYear,
  loadAssumptions, parseAssumptions, saveAssumptions, yearModifiedCount,
} from "./assumptions";

afterEach(() => {
  localStorage.clear(); sessionStorage.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals();
});

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
    const stored = JSON.parse(sessionStorage.getItem("caos-d-assumptions:issuer-1") || "{}");
    expect(stored.base.mInt).toBe(DEFAULT_CASE.mInt);
    expect(stored.down.mTax).toBe(DEFAULT_CASE.mTax);
    expect(stored.baseYears).toEqual({});
  });

  it("rejects malformed or incomplete documents", () => {
    expect(parseAssumptions("not-json")).toBeNull();
    expect(parseAssumptions(JSON.stringify({ base: {} }))).toBeNull();
    expect(parseAssumptions(null)).toBeNull();
  });

  it("loads namespaced state and migrates legacy state only for the reference issuer", () => {
    const saved = { base: { ...DEFAULT_CASE, mInt: 1.2 }, down: DEFAULT_CASE };
    sessionStorage.setItem("caos-d-assumptions:issuer-1", JSON.stringify(saved));
    expect(loadAssumptions("issuer-1").base.mInt).toBe(1.2);

    localStorage.setItem("caos-d-assumptions", JSON.stringify(saved));
    expect(loadAssumptions("other")).toBe(DEFAULT_ASSUMPTIONS);
    expect(loadAssumptions(ATLF_REFERENCE_ISSUER_ID).base.mInt).toBe(1.2);
    expect(localStorage.getItem("caos-d-assumptions")).toBeNull();
  });

  it("uses defaults during SSR and tolerates storage write failures", () => {
    vi.stubGlobal("window", undefined);
    expect(loadAssumptions("issuer")).toBe(DEFAULT_ASSUMPTIONS);
    vi.unstubAllGlobals();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
    expect(() => saveAssumptions("issuer", DEFAULT_ASSUMPTIONS)).not.toThrow();
  });

  it("counts and merges case and year modifications", () => {
    expect(caseModifiedCount({ ...DEFAULT_CASE, mInt: 1.2 })).toBe(1);
    expect(effectiveYear(DEFAULT_CASE)).toBe(DEFAULT_CASE);
    expect(effectiveYear(DEFAULT_CASE, { mInt: 2 }).mInt).toBe(2);
    expect(yearModifiedCount()).toBe(0);
    expect(yearModifiedCount({ mInt: 2, mTax: 3 })).toBe(2);
  });
});
