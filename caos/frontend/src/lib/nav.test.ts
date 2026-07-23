import { describe, it, expect } from "vitest";
import { NAV_GROUPS, CONCEPT_CYCLE, activeGroupId, rolePriorityItems, routeMatches, routeTitleForPath } from "./nav";

describe("nav registry", () => {
  it("has no duplicate hrefs", () => {
    const hrefs = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href));
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("cycle order equals the flattened visual group order", () => {
    expect(CONCEPT_CYCLE).toEqual(NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href)));
  });

  it("uses full product names where short labels lose information scent", () => {
    const labels = Object.fromEntries(NAV_GROUPS.flatMap((group) => group.items.map((item) => [item.href, item.label])));
    expect(labels["/command"]).toBe("Command Center");
    expect(labels["/model"]).toBe("Model Builder");
    expect(labels["/reports"]).toBe("Report Studio");
    expect(labels["/monitor"]).toBe("Alert Monitor");
    expect(labels["/portfolios"]).toBe("Portfolio Lab");
    expect(labels["/decisions"]).toBe("IC Book");
  });

  it("covers all 15 workflow routes including the two approved top-level additions", () => {
    expect(CONCEPT_CYCLE).toHaveLength(15);
    for (const href of [
      "/issuers",
      "/upload",
      "/research",
      "/query",
      "/sector",
      "/sector-rv",
      "/sponsors",
      "/command",
      "/deepdive",
      "/model",
      "/portfolios",
      "/decisions",
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
    // Pipeline is golden-path step 2 (watch the run triggered from Upload) —
    // it belongs to Intake & Runs, not the steady-state Monitor group.
    expect(activeGroupId("/pipeline")).toBe("intake");
    expect(activeGroupId("/sector-rv")).toBe("analyze");
    expect(activeGroupId("/deepdive")).toBe("decide");
    expect(activeGroupId("/decisions/decision-1")).toBe("decide");
    expect(activeGroupId("/reports")).toBe("publish");
    expect(activeGroupId("/monitor")).toBe("monitor");
    expect(activeGroupId("/settings")).toBeNull();
  });

  it("projects the exact five role-priority destinations without changing the canonical cycle", () => {
    expect(rolePriorityItems("analyst").map((item) => item.href)).toEqual([
      "/issuers", "/deepdive", "/model", "/reports", "/pipeline",
    ]);
    expect(rolePriorityItems("pm").map((item) => item.href)).toEqual([
      "/command", "/portfolios", "/decisions", "/reports", "/monitor",
    ]);
    expect(rolePriorityItems("qa").map((item) => item.href)).toEqual([
      "/monitor", "/pipeline", "/decisions", "/reports", "/upload",
    ]);
    expect(CONCEPT_CYCLE).toEqual(NAV_GROUPS.flatMap((group) => group.items.map((item) => item.href)));
  });

  it("derives workflow headings from the canonical registry and resolves utility/dynamic routes", () => {
    expect(routeTitleForPath("/portfolios")).toBe("Portfolio Lab");
    expect(routeTitleForPath("/decisions/decision-1")).toBe("IC Book");
    expect(routeTitleForPath("/issuers/profile?issuer=issuer-1")).toBe("Issuer Profile");
    expect(routeTitleForPath("/issuers/issuer-1")).toBe("Issuer Profile");
    expect(routeTitleForPath("/settings/access")).toBe("Settings");
    expect(routeTitleForPath("/")).toBe("CAOS Home");
    expect(routeTitleForPath("/unknown")).toBe("Page not found");
  });
});
