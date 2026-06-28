import { describe, expect, it } from "vitest";
import { DELTA_COLS, INDEX_STATS, SECTORS, ratingAverages } from "./rvdata";

describe("sector RV market data", () => {
  it("loads the market-data file into sector RV tables", () => {
    const rowCount = SECTORS.reduce((sum, sector) => sum + sector.rows.length, 0);

    expect(rowCount).toBe(374);
    expect(SECTORS.map((sector) => sector.name)).toEqual([
      "Industrials",
      "Consumer Discretionary",
      "Energy",
      "Utilities",
      "Financials",
      "Real Estate",
      "Consumer Staples",
      "Health Care",
      "Information Technology",
      "Media",
      "Entertainment",
      "Technology Hardware",
      "IT Services",
      "Software",
      "Telecoms",
      "Materials",
      "Communication Services",
    ]);
    expect(DELTA_COLS).toEqual(["Δ 1M", "Δ YTD"]);
    expect(INDEX_STATS).toHaveLength(SECTORS.length);
    expect(SECTORS.every((sector) => sector.color !== "#8a8a9a")).toBe(true);
  });

  it("computes sector rating averages from the selected sector", () => {
    const industrials = SECTORS.find((sector) => sector.name === "Industrials")!;
    const averages = ratingAverages(industrials.rows);

    expect(averages.find((row) => row.bucket === "B2")?.n).toBeGreaterThan(0);
    expect(averages.every((row) => row.d.length === DELTA_COLS.length)).toBe(true);
  });

  it("uses the other agency rating when the first side is N/A, but leaves NR alone", () => {
    const industrials = SECTORS.find((sector) => sector.name === "Industrials")!;

    expect(industrials.rows.find((row) => row.company === "MillerKnoll")?.bucket).toBe("Ba1");
    expect(industrials.rows.find((row) => row.company === "Advantage Sales & Marketing")?.bucket).toBe("NR");
  });

  it("does not show RV versus bucket for single-name sector/rating comps", () => {
    const energy = SECTORS.find((sector) => sector.name === "Energy")!;

    expect(energy.rows.find((row) => row.company === "Natgasoline")?.rv).toBe("N/A");
    expect(energy.rows.find((row) => row.company === "Natgasoline")?.rvBp).toBeNull();
  });
});
