// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { SectorRV } from "./SectorRV";
import { describe, it, expect, beforeAll, afterEach } from "vitest";

afterEach(cleanup);
import { buildRVRows, crossSectorMatrix, invalidationTrigger } from "@/lib/command/rvdata";

beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = () => {};
  window.requestAnimationFrame = (cb) => {
    cb(0);
    return 0;
  };
  global.ResizeObserver = class ResizeObserver {
    observe() {
      // Synchronously trigger callback to establish dimensions under test
      this.callback([
        { contentRect: { width: 820, height: 340 } } as ResizeObserverEntry,
      ], this);
    }
    unobserve() {}
    disconnect() {}
    constructor(public callback: ResizeObserverCallback) {}
  };
});

describe("SectorRV Scatter Interaction", () => {
  it("renders scatter points as accessible buttons and handles keyboard press", () => {
    render(<SectorRV />);
    
    // Points will be rendered as elements with role="button" and a descriptive name prefix
    const points = screen.getAllByRole("button", { name: /Position/i });
    expect(points.length).toBeGreaterThan(0);
    
    const firstPoint = points[0];
    firstPoint.focus();
    expect(document.activeElement).toBe(firstPoint);

    // Press Enter to select it
    fireEvent.keyDown(firstPoint, { key: "Enter", code: "Enter" });
    expect(firstPoint.getAttribute("aria-pressed")).toBe("true");

    // Press Space to deselect it
    fireEvent.keyDown(firstPoint, { key: " ", code: "Space" });
    expect(firstPoint.getAttribute("aria-pressed")).toBe("false");
  });

  it("applies responsive container query classes to layouts", () => {
    const { container } = render(<SectorRV />);
    const root = container.firstChild as HTMLElement;
    expect(root.classList.contains("@container")).toBe(true);
    
    const topHalfGrid = container.querySelector(".grid") as HTMLElement;
    expect(topHalfGrid.classList.contains("@[60rem]:grid-cols-[1.6fr_1fr]")).toBe(true);
  });
});

describe("Broader Sector RV Calculations & Presentation", () => {
  it("computes dynamic buildRVRows with benchmark provenance and holdings mapping", () => {
    const defaultRows = buildRVRows();
    expect(defaultRows.length).toBeGreaterThan(0);

    // Verify cohort/Axis 1 structure
    const firstRow = defaultRows[0];
    expect(firstRow).toHaveProperty("rvProvenance");
    if (firstRow.rvBp !== null) {
      expect(firstRow.rvProvenance).not.toBeNull();
      expect(firstRow.rvProvenance?.peerSet).toBe("sector×bucket");
      expect(firstRow.rvProvenance?.asOf).toBe("2026-07-06");
      expect(firstRow.rvProvenance?.source).toBe("market-data.json");
    }

    // Verify instrument/Axis 2 (LGD insufficient info)
    expect(firstRow.instrumentRv.status).toBe("insufficient");
    expect(firstRow.instrumentRv.reason).toContain("No recovery/LGD data in feed");
    expect(firstRow.instrumentRv).toHaveProperty("liq");
    expect(firstRow.instrumentRv).toHaveProperty("maturity");

    // Verify portfolio/Axis 3 (empty by default)
    expect(firstRow.portfolioRv.held).toBe(false);

    // Test with holdings mapped
    const holdings = new Map<string, { held: boolean; headroomPct?: number }>();
    holdings.set(firstRow.figi, { held: true, headroomPct: 25 });
    
    const customRows = buildRVRows(holdings);
    const matchedRow = customRows.find(r => r.figi === firstRow.figi);
    expect(matchedRow?.portfolioRv.held).toBe(true);
    expect(matchedRow?.portfolioRv.headroomPct).toBe(25);
  });

  it("calculates carryRv based on rvBp and duration-to-maturity", () => {
    const defaultRows = buildRVRows();
    const withMaturity = defaultRows.find(r => r.maturity !== null && r.rvBp !== null);
    if (withMaturity) {
      expect(withMaturity.carryRv).not.toBeNull();
      expect(typeof withMaturity.carryRv).toBe("number");
    }
  });

  it("builds correct crossSectorMatrix medians across the universe", () => {
    const allRows = buildRVRows();
    const matrix = crossSectorMatrix(allRows);
    expect(matrix).toHaveProperty("Energy");
    expect(matrix).toHaveProperty("Industrials");

    // Verify cell structure
    const cell = matrix["Energy"]["Ba2"];
    expect(cell).toHaveProperty("median");
    expect(cell).toHaveProperty("n");
  });

  it("determines deterministic CP-6E invalidation triggers correctly", () => {
    expect(invalidationTrigger(null, 5)).toBe("—");
    expect(invalidationTrigger(180, 5)).toContain("rvBp compresses to < +50bp");
    expect(invalidationTrigger(80, 3)).toContain("rvBp compresses to < +10bp");
    expect(invalidationTrigger(0, 2)).toBe("baseline change");
  });

  it("renders caveat honesty headers, posture mapping, and cross-sector heatmap in DOM", () => {
    render(<SectorRV />);

    // Honesty caveat elements
    expect(screen.getByText("SEED-REF")).toBeDefined();
    expect(screen.getByText("posture:")).toBeDefined();
    expect(screen.getByText("CONSTRUCTIVE")).toBeDefined();
    expect(screen.getByText("(derived · not CP-SR)")).toBeDefined();
    expect(screen.getByText("staleness:")).toBeDefined();
    expect(screen.getByText("CURRENT (0–90d)")).toBeDefined();
    expect(screen.getByText(/as-of 2026-07-06/i)).toBeDefined();

    // Cross-Sector Heatmap element
    expect(screen.getByText("Cross-Sector RV · median rvBp by sector × rating bucket")).toBeDefined();
  });
});
