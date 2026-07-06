// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { PortfolioTable } from "./views";
import { describe, it, expect, vi } from "vitest";

describe("PortfolioTable Customizer interaction", () => {
  it("opens the column customizer, allows checkbox toggle, and closes on Escape", () => {
    const handleSelect = vi.fn();
    render(<PortfolioTable selected={null} onSelect={handleSelect} />);
    
    // Customizer is closed by default
    expect(screen.queryByRole("dialog", { name: /Customize columns/i })).toBeNull();

    // Click trigger button
    const triggerBtn = screen.getByRole("button", { name: /COLUMNS/i });
    fireEvent.click(triggerBtn);

    // Dialog is visible
    const dialog = screen.getByRole("dialog", { name: /Customize columns/i });
    expect(dialog).not.toBeNull();

    // Press Escape
    fireEvent.keyDown(window, { key: "Escape", code: "Escape" });

    // Dialog is closed
    expect(screen.queryByRole("dialog", { name: /Customize columns/i })).toBeNull();
    // Focus returned to triggerBtn
    expect(document.activeElement).toBe(triggerBtn);
  });
});
