// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_LAYOUT, loadLayout, saveLayout } from "./layout-pref";

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Deep-Dive layout preference", () => {
  it("defaults to report", () => {
    expect(loadLayout()).toBe(DEFAULT_LAYOUT);
  });

  it("migrates legacy values without inverting user intent silently", () => {
    localStorage.setItem("caos.deepdive.layout", "core");
    expect(loadLayout()).toBe("summary");
    expect(localStorage.getItem("caos.deepdive.layout")).toBe("summary");

    localStorage.setItem("caos.deepdive.layout", "base");
    expect(loadLayout()).toBe("report");
    expect(localStorage.getItem("caos.deepdive.layout")).toBe("report");
  });

  it("persists current values and rejects unknown values", () => {
    saveLayout("dense");
    expect(loadLayout()).toBe("dense");

    localStorage.setItem("caos.deepdive.layout", "compact");
    expect(loadLayout()).toBe(DEFAULT_LAYOUT);
  });

  it("defaults without a browser and when storage reads fail", () => {
    vi.stubGlobal("window", undefined);
    expect(loadLayout()).toBe(DEFAULT_LAYOUT);
    vi.unstubAllGlobals();
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    expect(loadLayout()).toBe(DEFAULT_LAYOUT);
  });

  it("silently tolerates storage write failures", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
    expect(() => saveLayout("summary")).not.toThrow();
  });
});
