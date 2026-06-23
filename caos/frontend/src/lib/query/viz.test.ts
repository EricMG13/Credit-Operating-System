import { describe, expect, it } from "vitest";
import { barSpecFor, narrate } from "./viz";
import type { SemanticResult, StructuredResult } from "./types";

const cell = (value: number, provenance: "run" | "derived" | "seed" = "run") => ({
  value, unit: "x", provenance, qa_status: "Pass", period: "LTM", citation: null,
});

const structured = (
  rows: Array<{ name: string; v: number; p?: "run" | "derived" | "seed" }>,
  total?: number, // universe before the top-N cap; defaults to uncapped
): StructuredResult => ({
  mode: "structured",
  interpretation: "rank by net leverage",
  spec: null,
  rank_by: "net_leverage",
  columns: [{ key: "net_leverage", label: "Net leverage", unit: "x", higher_is_better: false }],
  rows: rows.map((r, i) => ({
    issuer: { id: String(i), name: r.name, ticker: null, industry: null, country: null },
    rank_value: r.v,
    metrics: { net_leverage: cell(r.v, r.p ?? "run") },
  })),
  total_ranked: total ?? rows.length,
  caveats: [],
});

describe("barSpecFor", () => {
  it("returns null for semantic results (no chart)", () => {
    const sem: SemanticResult = { mode: "semantic", interpretation: "x", rank_by: null, rows: [], caveats: [] };
    expect(barSpecFor(sem)).toBeNull();
  });

  it("returns null when fewer than two numeric rows", () => {
    expect(barSpecFor(structured([{ name: "A", v: 5 }]))).toBeNull();
  });

  it("builds a provenance-coloured bar spec for a rankable multi-row result", () => {
    const spec = barSpecFor(structured([{ name: "A", v: 5.8 }, { name: "B", v: 4.4, p: "seed" }]))!;
    expect(spec).not.toBeNull();
    expect(spec.type).toBe("interval");
    expect((spec.data as unknown[]).length).toBe(2);
    expect(spec.encode).toMatchObject({ color: "prov" });
    expect(spec.scale.color.domain).toEqual(["run", "derived", "seed"]);
  });
});

describe("narrate", () => {
  it("summarizes a ranked result with leader, polarity, median and citation count", () => {
    const s = narrate(structured([{ name: "Acme", v: 5.8 }, { name: "Beta", v: 4.4, p: "seed" }, { name: "Gamma", v: 2.3, p: "seed" }]));
    expect(s).toContain("Acme leads the result");
    expect(s).toContain("higher = weaker"); // net leverage: higher_is_better=false (#6)
    expect(s).toContain("median");
    expect(s).toContain("1/3 cited");
    // uncapped: the cohort IS the universe, so no "top N of M" framing
    expect(s).toContain("3 issuers ranked");
    expect(s).not.toContain("Top 3 of");
  });

  // Regression (OBS-002): when the result is a top-N slice of a larger universe,
  // the count must say "Top N of M" and the median must be scoped to the shown
  // rows — not presented as the coverage-universe median.
  it("labels a capped ranking as top-N of the universe and scopes the median", () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({ name: `I${i}`, v: 8 - i * 0.3 }));
    const s = narrate(structured(rows, 36));
    expect(s).toContain("Top 10 of 36 ranked");
    expect(s).toContain("median of these 10");
    expect(s).not.toContain("10 issuers ranked");
  });

  it("summarizes semantic evidence matches", () => {
    const sem: SemanticResult = {
      mode: "semantic", interpretation: "x", rank_by: null, caveats: [],
      rows: [{ issuer: { id: "1", name: "Acme", ticker: null, industry: null, country: null }, score: 1,
               excerpts: [{ chunk_id: "c", doc: "d", text: "t" }] }],
    };
    expect(narrate(sem)).toContain("matched on document evidence");
  });

  it("handles the empty result", () => {
    expect(narrate(structured([]))).toBe("No issuers matched.");
  });
});
