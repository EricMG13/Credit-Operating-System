import { describe, expect, it } from "vitest";
import { coerceView, nativeView, viewsFor } from "./views";

describe("viewsFor", () => {
  it("list-shaped walks open table-native with graph one click away", () => {
    // peer-set is a ranked list — the table (rank order) leads, not the graph.
    expect(viewsFor("peer-set", "peers")).toEqual(["rv", "graph"]);
    expect(nativeView("peer-set", "peers")).toBe("rv");
    expect(viewsFor("concentration-map", "concentration")).toEqual(["rv", "graph"]);
    // Memos have no lineage edges, so the BY_CAP override lands before the
    // provenance trace-native default (which would show 5 empty columns).
    expect(viewsFor("analyst-memos", "provenance")).toEqual(["rv", "graph"]);
    expect(nativeView("analyst-memos", "provenance")).toBe("rv");
  });

  it("topology-native walks stay on graph (mode default, no BY_CAP override)", () => {
    // contagion is a driver hub + exposed issuers — the graph IS the answer.
    expect(viewsFor("contagion", "contagion")).toEqual(["graph", "rv"]);
    expect(nativeView("contagion", "contagion")).toBe("graph");
    // wiki-links (mode concentration) has no BY_CAP override, so stays graph-native.
    expect(nativeView("wiki-links", "concentration")).toBe("graph");
  });

  it("provenance walks with real lineage stay lineage-native with graph+table", () => {
    expect(viewsFor("trace-source", "provenance")).toEqual(["trace", "graph", "rv"]);
    expect(nativeView("trace-source", "provenance")).toBe("trace");
    expect(nativeView("conclusion-lineage", "provenance")).toBe("trace");
  });

  it("the two register walks override their mode default", () => {
    // Covenant register is a table (names × terms) first, not a bare hub graph.
    expect(nativeView("covenant-register", "concentration")).toBe("rv");
    // Sponsor graph rides provenance mode but is a hub topology — pinned to graph,
    // never the empty "trace" (Lineage) columns the mode default would pick.
    expect(nativeView("sponsor-graph", "provenance")).toBe("graph");
  });

  it("the scatter capability is scatter-native (metric-encoded x/y)", () => {
    expect(viewsFor("scatter", "concentration")).toEqual(["scatter", "rv"]);
    expect(nativeView("scatter", "concentration")).toBe("scatter");
  });

  it("unknown mode falls back to graph+table", () => {
    expect(viewsFor("mystery", "new-mode")).toEqual(["graph", "rv"]);
  });
});

describe("coerceView", () => {
  it("keeps a valid view", () => {
    expect(coerceView("rv", "peer-set", "peers")).toBe("rv");
  });

  it("coerces a stale invalid view to the native one", () => {
    // peer-set is now table-native, so an out-of-set view falls back to "rv".
    expect(coerceView("scatter", "peer-set", "peers")).toBe("rv");
    expect(coerceView("trace", "peer-set", "peers")).toBe("rv");
    expect(coerceView("graph", "scatter", "concentration")).toBe("scatter");
  });
});
