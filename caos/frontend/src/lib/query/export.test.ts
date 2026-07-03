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
});
