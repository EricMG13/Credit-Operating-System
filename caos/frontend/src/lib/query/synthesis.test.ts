import { describe, expect, it } from "vitest";
import { synthesize } from "./synthesis";
import type { GraphResult, GraphNode } from "./graph";

const node = (id: string, kind: string, extra: Partial<GraphNode> = {}): GraphNode => ({
  id, label: id, kind, x: 0.5, y: 0.5, ...extra,
});

const base = (over: Partial<GraphResult>): GraphResult => ({
  capability_id: "x", mode: "peers", title: "T", nodes: [], edges: [], meta: [], caveats: [], ...over,
});

describe("synthesize", () => {
  it("empty graph returns the meta reason", () => {
    expect(synthesize(base({ meta: ["No headline metrics"] }))).toBe("No headline metrics");
  });

  it("peers names the focus and the #1 peer", () => {
    const g = base({
      mode: "peers",
      nodes: [
        node("acme", "center", { label: "Acme", center: true }),
        node("maple", "issuer", { label: "Maplewood", group: "Auto Parts" }),
        node("atlas", "issuer", { label: "Atlas" }),
      ],
      edges: [
        { source: "acme", target: "maple", label: "#1" },
        { source: "acme", target: "atlas", label: "#2" },
      ],
    });
    expect(synthesize(g)).toBe(
      "Acme's nearest peer on credit profile is Maplewood (Auto Parts), of 2 ranked by profile distance."
    );
  });

  it("contagion counts exposed issuers against the driver", () => {
    const g = base({
      mode: "contagion",
      nodes: [
        node("d", "driver", { label: "energy" }),
        node("a", "issuer", { exposed: true }),
        node("b", "issuer"),
      ],
    });
    expect(synthesize(g)).toBe(
      "1 of 2 issuers in coverage link to the energy driver — a shared-exposure overlay."
    );
  });

  it("concentration names the largest cluster", () => {
    const g = base({
      mode: "concentration",
      nodes: [node("s1", "sector", { label: "Tech" }), node("s2", "sector", { label: "Autos" }),
        node("i1", "issuer"), node("i2", "issuer"), node("i3", "issuer")],
      edges: [
        { source: "s1", target: "i1", kind: "member" },
        { source: "s1", target: "i2", kind: "member" },
        { source: "s2", target: "i3", kind: "member" },
      ],
    });
    expect(synthesize(g)).toBe("Coverage splits into 2 clusters; the largest is Tech with 2 names.");
  });

  it("provenance counts claims, modules, sources and weak flags", () => {
    const g = base({
      mode: "provenance",
      nodes: [
        node("m1", "module"), node("c1", "claim"), node("c2", "claim", { flag: true }),
        node("e1", "evidence"), node("k1", "chunk"),
      ],
    });
    expect(synthesize(g)).toBe("2 claims traced through 1 module to 2 sources; 1 flagged weak.");
  });

  it("falls back to title + meta when the template can't ground", () => {
    const g = base({
      mode: "provenance",
      nodes: [node("f1", "finding-crit")],
      title: "Open findings",
      meta: ["3 findings", "2 issuers"],
    });
    expect(synthesize(g)).toBe("Open findings — 3 findings · 2 issuers.");
  });
});
