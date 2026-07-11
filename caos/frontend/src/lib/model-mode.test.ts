// @vitest-environment jsdom
// M-13b regression: loadMode reads localStorage with no guard, unlike its own
// sibling saveMode (same file) which already wraps its write in try/catch —
// the established local convention. In a browser with localStorage
// disabled/full/blocked (private-mode Safari, some corporate policies),
// loadMode must degrade to DEFAULT_MODE instead of throwing.
import { describe, it, expect, vi, afterEach } from "vitest";

import { loadMode, DEFAULT_MODE } from "./model-mode";

describe("loadMode (M-13b)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("falls back to DEFAULT_MODE when localStorage.getItem throws", () => {
    // jsdom's window.localStorage instance doesn't accept a per-instance
    // method override (a spy on the instance is silently ignored) — spy on
    // Storage.prototype so the throw actually reaches loadMode's call.
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    expect(loadMode()).toBe(DEFAULT_MODE);
  });

  it("still reads a persisted valid mode when storage works normally", () => {
    vi.spyOn(Storage.prototype, "getItem").mockReturnValue("MAX");
    expect(loadMode()).toBe("MAX");
  });

  it("falls back to DEFAULT_MODE for an unrecognized stored value", () => {
    vi.spyOn(Storage.prototype, "getItem").mockReturnValue("BOGUS");
    expect(loadMode()).toBe(DEFAULT_MODE);
  });
});
