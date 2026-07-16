// @vitest-environment jsdom
// Locks the disabled-with-reason convention: an inert action stays focusable
// (aria-disabled, never native disabled), guards its click, explains itself via
// title + aria-describedby + a visible reason line, and the reason text never
// leaks into the button's accessible name.
import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ActionReason } from "./ActionReason";

afterEach(cleanup);

describe("ActionReason", () => {
  it("fires normally with no reason and renders no reason chrome", () => {
    const onClick = vi.fn();
    render(<ActionReason onClick={onClick} className="caos-primary-action">Run screen</ActionReason>);
    const button = screen.getByRole("button", { name: "Run screen" });
    expect(button.getAttribute("aria-disabled")).toBeNull();
    expect(button.getAttribute("title")).toBeNull();
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(document.querySelector(".caos-action-reason")).toBeNull();
  });

  it("guards the click and explains itself three ways when a reason is set", () => {
    const onClick = vi.fn();
    render(
      <ActionReason onClick={onClick} reason="No candidates returned — adjust the screen">
        Review top candidate
      </ActionReason>,
    );
    // Accessible name stays the label — the reason never enters it.
    const button = screen.getByRole("button", { name: "Review top candidate" });
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(button.getAttribute("title")).toBe("No candidates returned — adjust the screen");
    const describedBy = button.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    const reasonNode = document.getElementById(describedBy!);
    expect(reasonNode?.textContent).toBe("No candidates returned — adjust the screen");
    expect(reasonNode?.className).toContain("caos-action-reason");
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
    // Still focusable — a keyboard user can reach the explanation.
    button.focus();
    expect(document.activeElement).toBe(button);
  });

  it("keeps the reason screen-reader-only in tight toolbars", () => {
    render(
      <ActionReason reason="Select live alerts first" reasonDisplay="hidden">
        Acknowledge selected
      </ActionReason>,
    );
    const button = screen.getByRole("button", { name: "Acknowledge selected" });
    const reasonNode = document.getElementById(button.getAttribute("aria-describedby")!);
    expect(reasonNode?.className).toContain("sr-only");
  });
});
