import { describe, it, expect } from "vitest";
import { rankDislocations, canOpenDeepDive, deepDiveHref } from "./dislocations";
import type { RVRow } from "./rvdata";

function mkRow(overrides: Partial<RVRow> = {}): RVRow {
  return {
    company: "Sample Co",
    sector: "Industrials",
    subSector: "Aerospace",
    subGroup: "Components",
    loanType: "TLB",
    figi: "BBG000SAMPLE",
    rank: "1L",
    rating: "B2",
    bucket: "B2",
    size: 500,
    margin: 375,
    maturity: "2029-06-30",
    bid: 98.5,
    ask: 99,
    liq: "Normal",
    rv: "Inline",
    rvBp: 0,
    rvProvenance: null,
    instrumentRv: { status: "insufficient", reason: "No recovery/LGD data in feed", liq: "Normal", maturity: "2029-06-30" },
    portfolioRv: { held: false },
    carryRv: null,
    d: [null, null],
    ytm: 8.5,
    dm: 400,
    ...overrides,
  };
}

describe("rankDislocations", () => {
  it("ranks by |rvBp| descending regardless of sign", () => {
    const rows = [
      mkRow({ figi: "A", company: "Alpha", rvBp: 40 }),
      mkRow({ figi: "B", company: "Bravo", rvBp: -200 }),
      mkRow({ figi: "C", company: "Charlie", rvBp: 120 }),
    ];
    const ranked = rankDislocations(rows);
    expect(ranked.map((d) => d.company)).toEqual(["Bravo", "Charlie", "Alpha"]);
    expect(ranked[0].rvBp).toBe(-200);
    expect(ranked[0].absRvBp).toBe(200);
  });

  it("drops rows with no benchmark (rvBp === null) — same exclusion as topOfBook", () => {
    const rows = [
      mkRow({ figi: "A", company: "Alpha", rvBp: null }),
      mkRow({ figi: "B", company: "Bravo", rvBp: 80 }),
    ];
    const ranked = rankDislocations(rows);
    expect(ranked).toHaveLength(1);
    expect(ranked[0].company).toBe("Bravo");
  });

  it("breaks ties by company name for a stable, deterministic order", () => {
    const rows = [
      mkRow({ figi: "A", company: "Zulu", rvBp: 100 }),
      mkRow({ figi: "B", company: "Alpha", rvBp: -100 }),
    ];
    const ranked = rankDislocations(rows);
    expect(ranked.map((d) => d.company)).toEqual(["Alpha", "Zulu"]);
  });

  it("respects the limit parameter, defaulting to 8", () => {
    const rows = Array.from({ length: 12 }, (_, i) =>
      mkRow({ figi: `F${i}`, company: `Co${i}`, rvBp: i + 1 }),
    );
    expect(rankDislocations(rows)).toHaveLength(8);
    expect(rankDislocations(rows, 3)).toHaveLength(3);
  });

  it("carries carryRv and held/headroomPct straight off the row — no fabricated fields", () => {
    const rows = [
      mkRow({
        figi: "A",
        company: "Alpha",
        rvBp: 150,
        carryRv: 42.5,
        portfolioRv: { held: true, headroomPct: 8 },
      }),
    ];
    const [d] = rankDislocations(rows);
    expect(d.carryRv).toBe(42.5);
    expect(d.held).toBe(true);
    expect(d.headroomPct).toBe(8);
  });
});

describe("canOpenDeepDive / deepDiveHref", () => {
  it("only a held (portfolio-matched) name can open Deep-Dive — never a synthetic peer-universe name", () => {
    expect(canOpenDeepDive({ held: true })).toBe(true);
    expect(canOpenDeepDive({ held: false })).toBe(false);
  });

  it("builds the same /deepdive?issuer= href shape used elsewhere (FocusReadout, RankedChanges)", () => {
    expect(deepDiveHref({ company: "Atlas Forge" })).toBe("/deepdive?issuer=Atlas%20Forge");
  });
});
