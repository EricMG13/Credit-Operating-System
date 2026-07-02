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
});
