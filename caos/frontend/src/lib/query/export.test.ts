import { describe, expect, it } from "vitest";
import { graphToCsv } from "./export";
import type { GraphResult } from "./graph";

describe("graphToCsv", () => {
  it("exports query metadata, nodes, edges, and caveats with Excel-safe escaping", () => {
    const graph: GraphResult = {
      capability_id: "provenance",
      mode: "provenance",
      title: 'Atlas "source" trace',
      meta: ["2 nodes", "1 edge"],
      nodes: [
        { id: "a", label: "Atlas, Forge", kind: "issuer", x: 0, y: 0, group: "Industrials", sub: "Borrower" },
        { id: "b", label: "CP-1", kind: "module", x: 1, y: 1 },
      ],
      edges: [{ source: "a", target: "b", label: "cites", weight: 0.5 }],
      caveats: ["Demo graph only"],
    };

    const csv = graphToCsv(graph);
    expect(csv).toContain('CAOS Query,"Atlas ""source"" trace",provenance');
    expect(csv).toContain('a,"Atlas, Forge",issuer,Industrials,Borrower');
    expect(csv).toContain("Demo graph only");
    // narrative synthesis row leads the export
    expect(csv).toContain("Synthesis,");
    // edges carry the weight column (header + value)
    expect(csv).toContain("source,target,label,weight");
    expect(csv).toContain("a,b,cites,0.5");
  });

  // Regression for matrix 6.8 / FE-10 10.1: formula-trigger prefixes must be
  // neutralized (CSV injection), numerics must stay numeric, and non-finite
  // weights must not leak "Infinity"/"NaN" into the sheet.
  it("neutralizes formula-trigger cells and keeps numbers numeric", () => {
    const graph: GraphResult = {
      capability_id: "provenance",
      mode: "provenance",
      title: "=cmd|' /C calc'!A0",
      meta: ["@SUM(1,2)", "+alpha", "-beta"],
      nodes: [{ id: "n", label: "=HYPERLINK(evil)", kind: "issuer", x: 0, y: 0 }],
      edges: [
        { source: "n", target: "n", label: "self", weight: -0.5 },
        { source: "n", target: "n", label: "bad", weight: Infinity },
      ],
      caveats: [],
    };
    const csv = graphToCsv(graph);
    // every formula trigger is prefixed with a quote
    expect(csv).toContain("'=cmd|");
    expect(csv).toContain("'@SUM(1,2)");
    expect(csv).toContain("'+alpha");
    expect(csv).toContain("'-beta");
    expect(csv).toContain("'=HYPERLINK(evil)");
    // negative number stays a bare numeric cell
    expect(csv).toContain("n,n,self,-0.5");
    // non-finite weight emits an empty cell, not "Infinity"
    expect(csv).toMatch(/n,n,bad,($|\n)/);
    expect(csv).not.toContain("Infinity");
  });
});
