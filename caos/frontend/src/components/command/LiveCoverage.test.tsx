// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import type { PortfolioRowDTO } from "@/lib/api";
import { LiveCoverage } from "./LiveCoverage";

afterEach(cleanup);

const row = (over: Partial<PortfolioRowDTO> = {}): PortfolioRowDTO => ({
  issuer_id: "i1", name: "Aurora Cables", ticker: "AURC", sector: "Telecom",
  run_id: "r1", qa_status: "Passed", committee_status: "Committee Ready", as_of: null,
  metrics: { net_leverage: 5.7, interest_coverage: 2.1 },
  rv_recommendation: "OVERWEIGHT", rv_percentile: 64, downside_fragility: "MODERATE",
  gaps: [],
  ...over,
});

describe("LiveCoverage", () => {
  it("renders engine-derived fundamentals for a covered issuer", () => {
    render(<LiveCoverage rows={[row()]} />);
    expect(screen.getByText("AURC")).toBeTruthy();
    expect(screen.getByText("Aurora Cables")).toBeTruthy();
    expect(screen.getByText("5.7x")).toBeTruthy();      // net leverage
    expect(screen.getByText("2.1x")).toBeTruthy();      // interest coverage
    expect(screen.getByText(/OVERWEIGHT · p64/)).toBeTruthy();
    expect(screen.getByText(/MODERATE/)).toBeTruthy();  // fragility band word travels with the colour
    expect(screen.getByText("Passed")).toBeTruthy();  // server vocabulary (gate.py), not "Pass"
  });

  it("degrades missing metrics / RV / fragility to em-dash, never crashes", () => {
    render(<LiveCoverage rows={[row({
      metrics: {}, rv_recommendation: null, rv_percentile: null, downside_fragility: null,
    })]} />);
    // net lev, int cov, RV, fragility all absent → four em-dashes in the row
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(4);
  });

  it("sorts the observed dataset with a keyboard-operable header control", () => {
    render(<LiveCoverage rows={[
      row({ issuer_id: "i1", ticker: "BETF", name: "Beta Fiber", metrics: { net_leverage: 6.1, interest_coverage: 2.1 } }),
      row({ issuer_id: "i2", ticker: "AURC", name: "Aurora Cables", metrics: { net_leverage: 4.2, interest_coverage: 2.1 } }),
    ]} />);

    fireEvent.click(screen.getByRole("button", { name: "Sort NetLev ascending" }));
    const orderedRows = screen.getAllByRole("row", { name: /details/ });
    expect(orderedRows.map((item) => item.getAttribute("aria-label"))).toEqual([
      expect.stringContaining("AURC"),
      expect.stringContaining("BETF"),
    ]);
    expect(screen.getByRole("button", { name: "Sort NetLev descending" })).toBeTruthy();
  });

  it("supports selection via click and keyboard (Enter/Space)", () => {
    const handleSelect = vi.fn();
    const rows = [row({ issuer_id: "i1", ticker: "AURC", name: "Aurora Cables" })];
    
    render(
      <LiveCoverage rows={rows} selected={null} onSelect={handleSelect} />
    );

    // The row is a role="row" with tabIndex={0} for keyboard operability,
    // not a role="button". Accessible name comes from aria-label.
    const rowEl = screen.getByRole("row", { name: /AURC/i });
    expect(rowEl).toBeTruthy();

    // Click to select
    fireEvent.click(rowEl);
    expect(handleSelect).toHaveBeenCalledWith("i1");

    handleSelect.mockClear();

    // Press Enter to select
    fireEvent.keyDown(rowEl, { key: "Enter", code: "Enter" });
    expect(handleSelect).toHaveBeenCalledWith("i1");

    handleSelect.mockClear();

    // Press Space to select
    fireEvent.keyDown(rowEl, { key: " ", code: "Space" });
    expect(handleSelect).toHaveBeenCalledWith("i1");
  });

  it("opens ticker and name links without activating the row", () => {
    const handleSelect = vi.fn();
    render(<LiveCoverage rows={[row()]} onSelect={handleSelect} />);

    fireEvent.click(screen.getByRole("link", { name: "AURC" }));
    fireEvent.keyDown(screen.getByRole("link", { name: "Aurora Cables" }), { key: "Enter" });
    expect(handleSelect).not.toHaveBeenCalled();
  });

  it("exposes semantic headers and one roving row tab stop with vertical arrow navigation", () => {
    const handleSelect = vi.fn();
    const rows = [
      row({ issuer_id: "i1", ticker: "AURC", name: "Aurora Cables" }),
      row({ issuer_id: "i2", ticker: "BETF", name: "Beta Fiber" }),
    ];
    const { rerender } = render(<LiveCoverage rows={rows} onSelect={handleSelect} />);

    const grid = screen.getByRole("grid", { name: "Live coverage worklist" });
    expect(grid.getAttribute("aria-rowcount")).toBe("3");
    expect(screen.getByRole("columnheader", { name: /NetLev/ }).querySelector("button")?.className).toContain("text-right");
    expect(screen.getAllByRole("rowheader")).toHaveLength(2);

    const dataRows = screen.getAllByRole("row", { name: /details/ });
    expect(dataRows.filter((item) => item.tabIndex === 0)).toHaveLength(1);
    dataRows[0].focus();
    fireEvent.keyDown(dataRows[0], { key: "ArrowDown" });
    expect(document.activeElement).toBe(dataRows[1]);
    expect(dataRows[0].tabIndex).toBe(-1);
    expect(dataRows[1].tabIndex).toBe(0);
    expect(handleSelect).not.toHaveBeenCalled();

    fireEvent.keyDown(dataRows[1], { key: "Enter" });
    expect(handleSelect).toHaveBeenCalledWith("i2");

    const firstLinks = within(dataRows[0]).getAllByRole("link");
    const secondLinks = within(dataRows[1]).getAllByRole("link");
    expect([...firstLinks, ...secondLinks].every((link) => link.tabIndex === -1)).toBe(true);
    expect(dataRows[0].getAttribute("aria-keyshortcuts")).toBe("F2");
    expect(document.getElementById(dataRows[0].getAttribute("aria-describedby")!)?.textContent).toContain("Press F2");

    dataRows[0].focus();
    fireEvent.keyDown(dataRows[0], { key: "F2" });
    expect(document.activeElement).toBe(firstLinks[0]);
    expect(firstLinks.every((link) => link.tabIndex === 0)).toBe(true);
    expect(secondLinks.every((link) => link.tabIndex === -1)).toBe(true);
    rerender(<LiveCoverage rows={rows} onSelect={handleSelect} />);
    expect(within(screen.getByRole("row", { name: /AURC/ })).getAllByRole("link").every((link) => link.tabIndex === 0)).toBe(true);
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(document.activeElement).toBe(screen.getByRole("row", { name: /AURC/ }));
    expect(within(screen.getByRole("row", { name: /AURC/ })).getAllByRole("link").every((link) => link.tabIndex === -1)).toBe(true);
  });

  it("hands focus across the virtual window boundary instead of clamping at the last rendered row", async () => {
    const rows = Array.from({ length: 100 }, (_, index) => row({
      issuer_id: `issuer-${index}`,
      ticker: `T${index}`,
      name: `Issuer ${index}`,
    }));
    render(<LiveCoverage rows={rows} onSelect={() => undefined} />);

    const rendered = screen.getAllByRole("row", { name: /details/ });
    const lastRendered = rendered.at(-1)!;
    const currentIndex = Number(lastRendered.getAttribute("aria-rowindex")) - 2;
    expect(currentIndex).toBeLessThan(rows.length - 1);
    lastRendered.focus();
    fireEvent.keyDown(lastRendered, { key: "ArrowDown" });

    const nextRow = await waitFor(() => screen.getByRole("row", { name: new RegExp(`T${currentIndex + 1} .*details`) }));
    expect(document.activeElement).toBe(nextRow);
    expect(nextRow.getAttribute("aria-rowindex")).toBe(String(currentIndex + 3));
  });
});
