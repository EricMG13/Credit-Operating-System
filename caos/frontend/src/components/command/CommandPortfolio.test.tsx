// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CommandPortfolioPosition } from "@/lib/portfolio-lab";
import { CommandPortfolioTable } from "./CommandPortfolio";

afterEach(cleanup);

const position: CommandPortfolioPosition = {
  id: "position-1",
  portfolio_id: "portfolio-1",
  issuer_id: "issuer-1",
  borrower_name: "A very long exact borrower name that remains readable",
  ticker: "LONG",
  figi: "BBG000000001",
  loan_name: "First Lien Term Loan B 2031",
  sector: "Software",
  sub_sector: null,
  ranking: "1L",
  rating_moody: "B2",
  rating_sp: "B",
  par_usd: 100_000_000,
  facility_musd: 500,
  margin_bps: 475,
  maturity: "2031-06-30",
  price: 98.5,
  ytm: null,
  dm: null,
  market_value: 98_500_000,
  created_at: "2026-07-15T00:00:00Z",
  posture: "OVERWEIGHT",
  run_id: "run-1",
  qa_status: "Passed",
  committee_status: "Committee Ready",
};

describe("CommandPortfolioTable", () => {
  it("opens row details from the row remainder without an expand column", () => {
    const onSelect = vi.fn();
    render(<CommandPortfolioTable positions={[position]} selected={null} onSelect={onSelect} />);
    const row = screen.getByRole("row", { name: /exact borrower name/i });
    expect(screen.queryByRole("button", { name: /expand|collapse/i })).toBeNull();

    fireEvent.click(row);
    expect(onSelect).toHaveBeenLastCalledWith("position-1");
    fireEvent.keyDown(row, { key: "Enter" });
    fireEvent.keyDown(row, { key: " " });
    expect(onSelect).toHaveBeenCalledTimes(3);
  });

  it("keeps ticker and company links separate from row activation", () => {
    const onSelect = vi.fn();
    render(<CommandPortfolioTable positions={[position]} selected={null} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole("link", { name: "LONG" }));
    fireEvent.keyDown(screen.getByRole("link", { name: /A very long exact borrower/i }), { key: "Enter" });
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByText(position.borrower_name)).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Size" })).toBeTruthy();
  });
});
