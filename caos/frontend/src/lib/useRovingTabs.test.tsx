// @vitest-environment jsdom
import React, { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useRovingTabs } from "./useRovingTabs";

afterEach(cleanup);

function Group({
  options,
  orientation,
  onActivateSpy,
}: {
  options: string[];
  orientation?: "horizontal" | "vertical";
  onActivateSpy?: (index: number) => void;
}) {
  const [active, setActive] = useState(0);
  const { getItemProps } = useRovingTabs(
    options.length,
    active,
    (index) => {
      setActive(index);
      onActivateSpy?.(index);
    },
    { orientation },
  );
  return (
    <div role="radiogroup">
      {options.map((label, i) => (
        <button
          key={label}
          type="button"
          role="radio"
          aria-checked={active === i}
          data-testid={`item-${i}`}
          {...getItemProps(i)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

describe("useRovingTabs", () => {
  it("only the active item is in the Tab order — the rest are Tab-skipped", () => {
    render(<Group options={["A", "B", "C"]} />);
    expect(screen.getByTestId("item-0").getAttribute("tabindex")).toBe("0");
    expect(screen.getByTestId("item-1").getAttribute("tabindex")).toBe("-1");
    expect(screen.getByTestId("item-2").getAttribute("tabindex")).toBe("-1");
  });

  it("ArrowRight moves focus AND activates the next item, wrapping past the end", () => {
    const onActivate = vi.fn();
    render(<Group options={["A", "B", "C"]} onActivateSpy={onActivate} />);
    screen.getByTestId("item-0").focus();

    fireEvent.keyDown(screen.getByTestId("item-0"), { key: "ArrowRight" });
    expect(onActivate).toHaveBeenCalledWith(1);
    expect(document.activeElement).toBe(screen.getByTestId("item-1"));
    expect(screen.getByTestId("item-1").getAttribute("aria-checked")).toBe("true");

    fireEvent.keyDown(screen.getByTestId("item-1"), { key: "ArrowRight" });
    fireEvent.keyDown(screen.getByTestId("item-2"), { key: "ArrowRight" });
    expect(onActivate).toHaveBeenLastCalledWith(0); // wraps
    expect(document.activeElement).toBe(screen.getByTestId("item-0"));
  });

  it("ArrowLeft moves to the previous item, wrapping before the start", () => {
    render(<Group options={["A", "B", "C"]} />);
    screen.getByTestId("item-0").focus();
    fireEvent.keyDown(screen.getByTestId("item-0"), { key: "ArrowLeft" });
    expect(document.activeElement).toBe(screen.getByTestId("item-2")); // wraps
  });

  it("Home and End jump to the first and last item", () => {
    render(<Group options={["A", "B", "C", "D"]} />);
    screen.getByTestId("item-1").focus();
    fireEvent.keyDown(screen.getByTestId("item-1"), { key: "End" });
    expect(document.activeElement).toBe(screen.getByTestId("item-3"));
    fireEvent.keyDown(screen.getByTestId("item-3"), { key: "Home" });
    expect(document.activeElement).toBe(screen.getByTestId("item-0"));
  });

  it("vertical orientation uses ArrowDown/ArrowUp instead of left/right", () => {
    render(<Group options={["A", "B"]} orientation="vertical" />);
    screen.getByTestId("item-0").focus();
    // The horizontal keys must be no-ops in vertical mode.
    fireEvent.keyDown(screen.getByTestId("item-0"), { key: "ArrowRight" });
    expect(document.activeElement).toBe(screen.getByTestId("item-0"));
    fireEvent.keyDown(screen.getByTestId("item-0"), { key: "ArrowDown" });
    expect(document.activeElement).toBe(screen.getByTestId("item-1"));
  });

  it("an unrelated key is ignored — no activation, no focus change", () => {
    const onActivate = vi.fn();
    render(<Group options={["A", "B"]} onActivateSpy={onActivate} />);
    screen.getByTestId("item-0").focus();
    fireEvent.keyDown(screen.getByTestId("item-0"), { key: "a" });
    expect(onActivate).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByTestId("item-0"));
  });
});
