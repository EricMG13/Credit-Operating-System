import { describe, expect, it, vi } from "vitest";

vi.mock("./market-data.json", () => {
  function marketRow(company: string, maturity: string, mid3yDm: number) {
    return {
      company,
      sector: "Synthetic Sector",
      subSector: "Synthetic Subsector",
      subGroup: "Synthetic Group",
      bloombergId: `BB-${company}`,
      loanType: "Term Loan",
      ranking: "1L",
      ratings: "B2",
      size: 500,
      margin: 450,
      maturity,
      bid: 98,
      ask: 99,
      d1m: 1,
      ytd: 2,
      midYtm: 8,
      mid3yDm,
    };
  }

  return {
    default: [
      marketRow("ShortYear", "'30", 500),
      marketRow("Malformed", "not-a-date", 600),
      marketRow("Missing", "", 700),
      { ...marketRow("Unrated", "2031-01-01", 800), ratings: "" },
    ],
  };
});

import { buildRVRows } from "./rvdata";

describe("RV maturity normalization", () => {
  it("uses a short-year fallback and degrades malformed or missing maturities", () => {
    const rows = buildRVRows();

    expect(rows.find((row) => row.company === "ShortYear")?.carryRv).toBe(-25);
    expect(rows.find((row) => row.company === "Malformed")?.carryRv).toBeNull();
    expect(rows.find((row) => row.company === "Missing")?.carryRv).toBeNull();
  });
});
