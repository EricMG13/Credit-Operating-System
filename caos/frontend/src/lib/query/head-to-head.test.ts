// C7 — head-to-head issuer comparison walk. Covers all three registration
// points (per the Query design mandates): questions.ts, views.ts, synthesis.ts.

import { describe, expect, it } from "vitest";
import { QUESTIONS, ENGINE_NOTES, questionFor } from "./questions";
import { nativeView, viewsFor } from "./views";
import { synthesize } from "./synthesis";
import type { GraphResult, GraphNode, Capability } from "./graph";

const node = (id: string, kind: string, extra: Partial<GraphNode> = {}): GraphNode => ({
  id, label: id, kind, x: 0.5, y: 0.5, ...extra,
});

const base = (over: Partial<GraphResult>): GraphResult => ({
  capability_id: "head-to-head", mode: "concentration", title: "Acme vs Atlas",
  nodes: [], edges: [], meta: [], caveats: [], ...over,
});

describe("head-to-head registration", () => {
  it("questions.ts carries a phrased question and an engine note", () => {
    expect(QUESTIONS["head-to-head"]).toBeDefined();
    expect(QUESTIONS["head-to-head"].q.length).toBeGreaterThan(0);
    expect(ENGINE_NOTES["head-to-head"]).toBeDefined();
    const cap: Capability = { id: "head-to-head", label: "Head-to-head comparison", mode: "concentration", enabled: true, reason: null };
    expect(questionFor(cap)).toBe(QUESTIONS["head-to-head"].q);
  });

  it("views.ts opens table-native, graph one click away — same shape as covenant-register", () => {
    expect(nativeView("head-to-head", "concentration")).toBe("rv");
    expect(viewsFor("head-to-head", "concentration")).toEqual(["rv", "graph"]);
  });
});

describe("synthesize — head-to-head", () => {
  it("no rows falls back to the meta reason (pre-pick empty state)", () => {
    const g = base({ meta: ["Pick two issuers to compare."], caveats: ["Pick two issuers to compare."] });
    expect(synthesize(g)).toBe("Pick two issuers to compare.");
  });

  it("states which issuer screens stronger on relative value when both sides have a percentile", () => {
    const g = base({
      nodes: [
        node("h2h:Net leverage", "sector", { label: "Net leverage", group: "Net leverage" }),
        node("a:Net leverage", "issuer", { label: "Acme", group: "Net leverage", sub: "4x" }),
        node("b:Net leverage", "issuer", { label: "Atlas", group: "Net leverage", sub: "6x" }),
        node("h2h:CP-3 relative value", "sector", { label: "CP-3 relative value", group: "CP-3 relative value" }),
        node("a:CP-3 relative value", "issuer", { label: "Acme", group: "CP-3 relative value", sub: "72th pctile · OVERWEIGHT" }),
        node("b:CP-3 relative value", "issuer", { label: "Atlas", group: "CP-3 relative value", sub: "35th pctile · UNDERWEIGHT" }),
      ],
    });
    expect(synthesize(g)).toBe(
      "Acme vs Atlas compared across 2 rows — Acme screens stronger on relative value than Atlas."
    );
  });

  it("falls back to a neutral row count when RV percentiles are absent or tied", () => {
    const g = base({
      nodes: [
        node("h2h:Net leverage", "sector", { label: "Net leverage", group: "Net leverage" }),
        node("a:Net leverage", "issuer", { label: "Acme", group: "Net leverage", sub: "4x" }),
        node("b:Net leverage", "issuer", { label: "Atlas", group: "Net leverage", sub: "6x" }),
      ],
    });
    expect(synthesize(g)).toBe("Acme vs Atlas compared across 1 row.");
  });
});
