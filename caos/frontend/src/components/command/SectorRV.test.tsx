// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { SectorRV } from "./SectorRV";
import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = () => {};
  window.requestAnimationFrame = (cb) => {
    cb(0);
    return 0;
  };
  global.ResizeObserver = class ResizeObserver {
    observe() {
      // Synchronously trigger callback to establish dimensions under test
      this.callback([{
        contentRect: { width: 820, height: 340 }
      }]);
    }
    unobserve() {}
    disconnect() {}
    constructor(public callback: any) {}
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
});
