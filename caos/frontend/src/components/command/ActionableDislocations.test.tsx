// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ActionableDislocations } from "./ActionableDislocations";
import type { RVRow } from "@/lib/command/rvdata";

afterEach(cleanup);

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

describe("ActionableDislocations", () => {
  it("renders ranked rows with the disclosed REFERENCE/DERIVED basis chip and a benchmarked count", () => {
    const rows = [
      mkRow({ figi: "A", company: "Alpha Holdings", rvBp: 220, carryRv: 55.1 }),
      mkRow({ figi: "B", company: "Bravo Corp", rvBp: -60 }),
      mkRow({ figi: "C", company: "Charlie Ltd", rvBp: null }),
    ];
    render(<ActionableDislocations rows={rows} />);

    expect(screen.getByText("REFERENCE")).toBeTruthy();
    expect(screen.getByText("DERIVED")).toBeTruthy();
    expect(screen.getByText("Ranked by |RV| + carry — full universe")).toBeTruthy();
    expect(screen.getByText("2 of 2 benchmarked")).toBeTruthy();

    // Widest |rvBp| (Alpha, 220) ranks ahead of Bravo (60); the null-rvBp row
    // (Charlie) is excluded entirely.
    const names = screen.getAllByText(/Holdings|Corp|Ltd/).map((el) => el.textContent);
    expect(names.indexOf("Alpha Holdings")).toBeLessThan(names.indexOf("Bravo Corp"));
    expect(screen.queryByText("Charlie Ltd")).toBeNull();

    expect(screen.getByText("+220bp")).toBeTruthy();
    expect(screen.getByText("carry +55.1 bp/yr")).toBeTruthy();
    expect(screen.getByText("carry — bp/yr")).toBeTruthy();
  });

  it("shows the held badge and a working Deep-Dive link only for a portfolio-matched name", () => {
    const rows = [
      mkRow({ figi: "A", company: "Held Co", rvBp: 300, portfolioRv: { held: true, headroomPct: 12 } }),
      mkRow({ figi: "B", company: "Unmatched Peer Co", rvBp: -250, portfolioRv: { held: false } }),
    ];
    render(<ActionableDislocations rows={rows} />);

    expect(screen.getByText("held +12%")).toBeTruthy();
    const deepDiveLink = screen.getByRole("link", { name: /Deep-Dive/i });
    expect(deepDiveLink.getAttribute("href")).toBe("/deepdive?issuer=Held%20Co");

    // Only one Deep-Dive link exists — the unmatched synthetic peer name never
    // gets one (never a dead link).
    expect(screen.getAllByRole("link", { name: /Deep-Dive/i })).toHaveLength(1);
  });

  it("shows an honest empty state when nothing in the universe carries a benchmark", () => {
    const rows = [mkRow({ rvBp: null })];
    render(<ActionableDislocations rows={rows} />);
    expect(
      screen.getByText("No benchmarked loans in the current universe — no actionable dislocation to rank."),
    ).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Deep-Dive/i })).toBeNull();
  });

  it("caps the ranked list at 8 rows even with a larger benchmarked universe", () => {
    const rows = Array.from({ length: 15 }, (_, i) =>
      mkRow({ figi: `F${i}`, company: `Co${i}`, rvBp: (i + 1) * 10 }),
    );
    render(<ActionableDislocations rows={rows} />);
    expect(screen.getByText("8 of 15 benchmarked")).toBeTruthy();
  });
});
