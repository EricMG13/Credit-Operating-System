import { describe, expect, it } from "vitest";
import { coerceView, nativeView, viewsFor } from "./views";

describe("viewsFor", () => {
  it("peers/contagion/concentration get graph+table, never lineage or scatter", () => {
    for (const mode of ["peers", "contagion", "concentration"]) {
      expect(viewsFor("peer-set", mode)).toEqual(["graph", "rv"]);
    }
  });

  it("provenance is lineage-native with graph+table", () => {
    expect(viewsFor("trace-source", "provenance")).toEqual(["trace", "graph", "rv"]);
    expect(nativeView("trace-source", "provenance")).toBe("trace");
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
    expect(coerceView("scatter", "peer-set", "peers")).toBe("graph");
    expect(coerceView("trace", "peer-set", "peers")).toBe("graph");
    expect(coerceView("graph", "scatter", "concentration")).toBe("scatter");
  });
});
