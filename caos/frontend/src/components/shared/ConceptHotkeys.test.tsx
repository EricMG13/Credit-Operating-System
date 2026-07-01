// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { ConceptHotkeys } from "./ConceptHotkeys";

afterEach(cleanup);

// Mock useRouter and usePathname from next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
  usePathname: () => "/command",
}));

describe("ConceptHotkeys", () => {
  it("dispatches caos:subview-cycle event on Alt+Comma", () => {
    const listener = vi.fn();
    window.addEventListener("caos:subview-cycle", listener);

    render(<ConceptHotkeys />);

    const event = new KeyboardEvent("keydown", {
      key: ",",
      code: "Comma",
      altKey: true,
      bubbles: true,
    });
    window.dispatchEvent(event);

    expect(listener).toHaveBeenCalled();
    const callArg = listener.mock.calls[0][0] as CustomEvent;
    expect(callArg.detail.direction).toBe(-1);

    window.removeEventListener("caos:subview-cycle", listener);
  });

  it("dispatches caos:subview-cycle event on Alt+Period", () => {
    const listener = vi.fn();
    window.addEventListener("caos:subview-cycle", listener);

    render(<ConceptHotkeys />);

    const event = new KeyboardEvent("keydown", {
      key: ".",
      code: "Period",
      altKey: true,
      bubbles: true,
    });
    window.dispatchEvent(event);

    expect(listener).toHaveBeenCalled();
    const callArg = listener.mock.calls[0][0] as CustomEvent;
    expect(callArg.detail.direction).toBe(1);

    window.removeEventListener("caos:subview-cycle", listener);
  });
});
