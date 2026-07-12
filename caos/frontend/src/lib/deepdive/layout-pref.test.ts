// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_LAYOUT, loadLayout, saveLayout } from "./layout-pref";

afterEach(() => {
  localStorage.clear();
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
});

