// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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

  it("uses semantic headers, aligned numerics, and one vertically roving row tab stop", () => {
    const onSelect = vi.fn();
    const second = { ...position, id: "position-2", issuer_id: "issuer-2", ticker: "BETA", borrower_name: "Beta Fiber" };
    const positions = [position, second];
    const { rerender } = render(<CommandPortfolioTable positions={positions} selected={null} onSelect={onSelect} />);

    expect(screen.getByRole("grid", { name: "Persisted portfolio positions" }).getAttribute("aria-rowcount")).toBe("3");
    for (const name of ["Size", "Price", "Margin"]) {
      expect(screen.getByRole("columnheader", { name }).className).toContain("text-right");
    }
    expect(screen.getAllByRole("rowheader")).toHaveLength(2);
    // ICU/CLDR renders compact currency as "$100M" (≤ICU 77) or "$100.0M" (ICU 78+); both satisfy maximumFractionDigits: 1.
    expect(screen.getAllByText(/^\$100(\.0)?M$/)[0].closest("[role='gridcell']")?.className).toContain("text-right");

    const rows = screen.getAllByRole("row", { name: /position details/ });
    expect(rows.filter((item) => item.tabIndex === 0)).toHaveLength(1);
    rows[0].focus();
    fireEvent.keyDown(rows[0], { key: "ArrowDown" });
    expect(document.activeElement).toBe(rows[1]);
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.keyDown(rows[1], { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith("position-2");

    const firstLinks = within(rows[0]).getAllByRole("link");
    const secondLinks = within(rows[1]).getAllByRole("link");
    expect([...firstLinks, ...secondLinks].every((link) => link.tabIndex === -1)).toBe(true);
    expect(rows[0].getAttribute("aria-keyshortcuts")).toBe("F2");
    expect(document.getElementById(rows[0].getAttribute("aria-describedby")!)?.textContent).toContain("Press F2");

    rows[0].focus();
    fireEvent.keyDown(rows[0], { key: "F2" });
    expect(document.activeElement).toBe(firstLinks[0]);
    expect(firstLinks.every((link) => link.tabIndex === 0)).toBe(true);
    expect(secondLinks.every((link) => link.tabIndex === -1)).toBe(true);
    rerender(<CommandPortfolioTable positions={positions} selected={null} onSelect={onSelect} />);
    expect(within(screen.getByRole("row", { name: /exact borrower name/i })).getAllByRole("link").every((link) => link.tabIndex === 0)).toBe(true);
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    const restored = screen.getByRole("row", { name: /exact borrower name/i });
    expect(document.activeElement).toBe(restored);
    expect(within(restored).getAllByRole("link").every((link) => link.tabIndex === -1)).toBe(true);
  });
});
