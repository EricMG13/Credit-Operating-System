import { describe, expect, it } from "vitest";
import { DELTA_COLS, INDEX_STATS, RV_SECTORS, ratingAverages, subSectorAverages } from "./rvdata";

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
