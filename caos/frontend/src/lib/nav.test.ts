import { describe, it, expect } from "vitest";
import { NAV_GROUPS, CONCEPT_CYCLE, activeGroupId, routeMatches } from "./nav";

describe("nav registry", () => {
  it("has no duplicate hrefs", () => {
    const hrefs = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href));
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("cycle order equals the flattened visual group order", () => {
    expect(CONCEPT_CYCLE).toEqual(NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href)));
  });

  it("covers all 12 concept routes", () => {
    expect(CONCEPT_CYCLE).toHaveLength(12);
    for (const href of [
      "/issuers",
      "/upload",
      "/research",
      "/query",
      "/sector",
      "/sector-rv",
      "/command",
      "/deepdive",
      "/model",
      "/reports",
      "/pipeline",
      "/monitor",
    ]) {
      expect(CONCEPT_CYCLE).toContain(href);
    }
  });

  it("routeMatches requires a path-segment boundary", () => {
    // /model must not match /monitor-ish prefixes and vice versa
    expect(routeMatches("/model", "/model")).toBe(true);
    expect(routeMatches("/model/x", "/model")).toBe(true);
    expect(routeMatches("/monitor", "/model")).toBe(false);
    expect(routeMatches("/modeling", "/model")).toBe(false);
  });

  it("activeGroupId resolves nested routes to their workflow group", () => {
    expect(activeGroupId("/issuers/profile")).toBe("intake");
    expect(activeGroupId("/sector-rv")).toBe("analyze");
    expect(activeGroupId("/deepdive")).toBe("decide");
    expect(activeGroupId("/reports")).toBe("publish");
    expect(activeGroupId("/monitor")).toBe("monitor");
    expect(activeGroupId("/settings")).toBeNull();
  });
});
