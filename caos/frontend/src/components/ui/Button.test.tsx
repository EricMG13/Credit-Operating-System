// @vitest-environment jsdom
// Locks the Button contract: variant selects the right action-grammar class,
// native `disabled` is unreachable (TS-only, not runtime-checkable here), and
// the disabled-with-reason behavior is ActionReason's — this only checks the
// wiring, not re-testing ActionReason's own behavior.
import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Button } from "./Button";

afterEach(cleanup);

describe("Button", () => {
  it("defaults to the secondary tier and fires onClick when live", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);
    const button = screen.getByRole("button", { name: "Save" });
    expect(button.className).toContain("caos-action-secondary");
    expect(button.className).toContain("focus-ring");
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renders the primary tier", () => {
    render(<Button variant="primary">Run</Button>);
    expect(screen.getByRole("button", { name: "Run" }).className).toContain("caos-action-primary");
  });

  it("merges a caller className alongside the variant class", () => {
    render(<Button className="ml-auto">Open</Button>);
    const button = screen.getByRole("button", { name: "Open" });
    expect(button.className).toContain("caos-action-secondary");
    expect(button.className).toContain("ml-auto");
  });

  it("goes inert with a discoverable reason instead of native disabled", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick} reason="Resolve every gate first">Ratify</Button>);
    const button = screen.getByRole("button", { name: "Ratify" });
    expect(button.hasAttribute("disabled")).toBe(false);
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(button.getAttribute("title")).toBe("Resolve every gate first");
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});
