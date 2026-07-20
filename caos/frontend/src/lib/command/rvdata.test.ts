import { describe, expect, it } from "vitest";
import {
  buildIndexStats,
  buildRVHoldingsMap,
  buildRVRows,
  buildRVSectors,
  cleanRating,
  crossSectorMatrix,
  DELTA_COLS,
  derivePosture,
  INDEX_STATS,
  invalidationTrigger,
  median,
  RV_AS_OF,
  RV_FILE_LABEL,
  RV_SECTORS,
  RV_SOURCE,
  RV_THRESHOLDS,
  ratingAverages,
  rvStaleness,
  subSectorAverages,
  type RVRow,
} from "./rvdata";
import { PORTFOLIO } from "./data";

describe("sector RV market data", () => {
  it("loads the market-data file into sector RV tables", () => {
    const rowCount = RV_SECTORS.reduce((sum, sector) => sum + sector.rows.length, 0);

    expect(rowCount).toBe(582);
    expect(RV_SECTORS.map((sector) => sector.name)).toEqual([
      "Industrials",
      "Financials",
      "Consumer Discretionary",
      "Health Care",
      "Consumer Staples",
      "Energy",
      "Real Estate",
      "Utilities",
      "Materials",
      "Information Technology",
      "Entertainment",
      "Communication Services",
      "Telecoms",
    ]);
    expect(DELTA_COLS).toEqual(["Δ 1M", "Δ YTD"]);
    expect(RV_AS_OF).toBe("2026-07-06");
    expect(RV_FILE_LABEL).toBe("Jun 29 08:39");
    expect(RV_SOURCE).toBe("market-data.json");
    expect(RV_THRESHOLDS).toEqual({ cheap: 150, wide: 50, tight: -50, rich: -150 });
    expect(INDEX_STATS).toHaveLength(RV_SECTORS.length);
    expect(INDEX_STATS.reduce((sum, sector) => sum + sector.n, 0)).toBe(rowCount);
    expect(RV_SECTORS.every((sector) => sector.color !== "#a1a1b5")).toBe(true);
  });

  it("computes sector and sub-sector averages from the selected sector", () => {
    const industrials = RV_SECTORS.find((sector) => sector.name === "Industrials")!;
    const averages = ratingAverages(industrials.rows);
    const subSectors = subSectorAverages(industrials.rows);

    expect(averages.find((row) => row.bucket === "B2")?.n).toBeGreaterThan(0);
    expect(averages.every((row) => row.d.length === DELTA_COLS.length)).toBe(true);
    expect(subSectors.reduce((sum, row) => sum + row.n, 0)).toBe(industrials.rows.length);
    expect(subSectors.every((row) => row.d.length === DELTA_COLS.length)).toBe(true);
  });

  it("uses the other agency rating when the first side is N/A, but leaves NR alone", () => {
    const industrials = RV_SECTORS.find((sector) => sector.name === "Industrials")!;

    expect(industrials.rows.find((row) => row.company === "MillerKnoll")?.bucket).toBe("Ba1");
    expect(industrials.rows.find((row) => row.company === "Advantage Sales & Marketing")?.bucket).toBe("NR");
  });

  it("does not show RV versus bucket for single-name sector/rating comps", () => {
    const energy = RV_SECTORS.find((sector) => sector.name === "Energy")!;

    expect(energy.rows.find((row) => row.company === "Natgasoline")?.rv).toBe("N/A");
    expect(energy.rows.find((row) => row.company === "Natgasoline")?.rvBp).toBeNull();
  });

  it("labels feed staleness from the shared as-of date", () => {
    expect(rvStaleness(RV_AS_OF, new Date("2026-07-06T12:00:00Z"))).toEqual({
      label: "CURRENT (0–90d)",
      tone: "success",
    });
    expect(rvStaleness(RV_AS_OF, new Date("2026-10-06T12:00:00Z"))).toEqual({
      label: "POTENTIALLY STALE (91–180d)",
      tone: "warning",
    });
    expect(rvStaleness("not-a-date")).toEqual({ label: "UNKNOWN", tone: "warning" });
    expect(rvStaleness(RV_AS_OF, new Date("2027-02-01T12:00:00Z"))).toEqual({
      label: "STALE (>180d)",
      tone: "critical",
    });
    expect(rvStaleness(RV_AS_OF, new Date("2026-01-01T12:00:00Z"))).toEqual({
      label: "CURRENT (0–90d)",
      tone: "success",
    });
  });

  it("normalizes Bloomberg rating placeholders", () => {
    expect(cleanRating("#N/A N/A / BB-")).toBe("— / BB-");
    expect(cleanRating("#N/A / #N/A N/A")).toBe("— / —");
  });

  it("computes medians for empty, odd, and even cohorts", () => {
    expect(median([])).toBeNull();
    expect(median([9, 1, 5])).toBe(5);
    expect(median([8, 2, 4, 6])).toBe(5);
  });

  it("derives posture from benchmarked cheap/rich share", () => {
    const row = (rvBp: number | null) => ({ rvBp }) as RVRow;

    expect(derivePosture([row(100), row(50), row(-25), row(null)])).toMatchObject({
      label: "CONSTRUCTIVE",
      cheapCount: 2,
      richCount: 1,
      n: 3,
    });
    expect(derivePosture([row(25), row(-20), row(null)])).toMatchObject({ label: "NEUTRAL", n: 2 });
    expect(derivePosture([row(-100), row(-25), row(10)])).toMatchObject({ label: "CAUTIOUS", n: 3 });
    expect(derivePosture([])).toMatchObject({ label: "NEUTRAL", n: 0 });
  });

  it("builds exact-match portfolio overlays for Sector RV", () => {
    const sample = buildRVRows().find((row) => row.figi)!;
    const direct = buildRVRows(buildRVHoldingsMap([{ figi: sample.figi.toLowerCase(), headroomPct: 12 }]))
      .find((row) => row.figi === sample.figi);
    const sleeveRows = buildRVRows(buildRVHoldingsMap(PORTFOLIO));

    expect(direct?.portfolioRv).toEqual({ held: true, headroomPct: 12 });
    expect(sleeveRows.some((row) => row.portfolioRv.held)).toBe(true);
  });

  it("indexes portfolio holdings by every supported identity without inventing headroom", () => {
    const holdings = buildRVHoldingsMap([{
      figi: "  bb-global  ",
      id: "internal-1",
      name: "Atlas Forge",
      borrower: "Atlas Parent",
    }, {
      figi: null,
      id: "   ",
      name: null,
      borrower: null,
      headroomPct: 0,
    }]);

    for (const key of ["BB-GLOBAL", "INTERNAL-1", "ATLAS FORGE", "ATLAS PARENT"]) {
      expect(holdings.get(key)).toEqual({ held: true });
    }
    expect(holdings.has("")).toBe(false);
  });

  it("describes invalidation conditions at each RV threshold", () => {
    expect(invalidationTrigger(null, 10)).toBe("—");
    expect(invalidationTrigger(200, 3)).toContain("peer-set n improves to ≥4");
    expect(invalidationTrigger(200, 4)).toBe("rvBp compresses to < +50bp");
    expect(invalidationTrigger(75, 2)).toBe("rvBp compresses to < +10bp");
    expect(invalidationTrigger(49, 10)).toBe("baseline change");
  });

  it("builds the sector-by-rating matrix only from benchmarked rows", () => {
    const rvRow = (sector: string, bucket: string, rvBp: number | null) => ({
      sector,
      bucket,
      rvBp,
    }) as RVRow;
    const matrix = crossSectorMatrix([
      rvRow("Industrials", "B2", 100),
      rvRow("Industrials", "B2", 50),
      rvRow("Industrials", "B2", null),
      rvRow("Energy", "B2", -25),
    ]);

    expect(matrix.Industrials.B2).toEqual({ median: 75, n: 2 });
    expect(matrix.Industrials.B1).toEqual({ median: null, n: 0 });
    expect(matrix.Energy.B2).toEqual({ median: null, n: 1 });
  });

  it("uses neutral sector and empty-index fallbacks for synthetic cohorts", () => {
    const sectors = buildRVSectors([{ sector: "Unknown Desk Sector" } as RVRow]);
    expect(sectors).toEqual([{
      name: "Unknown Desk Sector",
      color: "#a1a1b5",
      rows: [{ sector: "Unknown Desk Sector" }],
    }]);

    expect(buildIndexStats([{ name: "Empty", color: "#000", rows: [] }])).toEqual([{
      name: "Empty",
      n: 0,
      mv: 0,
      avgPrice: 0,
      d: [null, null],
      ytm: 0,
      dm: 0,
    }]);
  });

  it("never surfaces a junk feed mark as an RV tail (F1)", () => {
    const all = RV_SECTORS.flatMap((sector) => sector.rows);

    // A non-credible 3Y DM (<=0 or >=5000bp — the feed carries ±20000 and
    // ~579,028 junk ticks) must not produce an rvBp, or it would lead the peer
    // table's cheap->rich default sort as a bogus "Cheap".
    for (const row of all) {
      if (row.dm <= 0 || row.dm >= 5000) {
        expect(row.rvBp).toBeNull();
        expect(row.rv).toBe("N/A");
      }
    }
    // Invariant that fails pre-fix: no rendered rvBp is a junk magnitude.
    expect(all.every((row) => row.rvBp === null || Math.abs(row.rvBp) < 5000)).toBe(true);
    // And the guard is actually exercised by the sample book.
    expect(all.some((row) => row.dm >= 5000)).toBe(true);
  });
});
