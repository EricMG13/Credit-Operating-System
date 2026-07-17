// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ roleView: "analyst" as string, setRoleView: vi.fn() }));
vi.mock("./RoleViewProvider", () => ({
  useRoleView: () => ({ roleView: mocks.roleView, setRoleView: mocks.setRoleView }),
}));

import { RoleViewSwitch } from "./RoleViewSwitch";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mocks.roleView = "analyst";
});

describe("RoleViewSwitch", () => {
  it("puts only the active option in the Tab order, matching the current roleView", () => {
    mocks.roleView = "pm";
    render(<RoleViewSwitch />);
    expect(screen.getByRole("radio", { name: /Analyst/ }).getAttribute("tabindex")).toBe("-1");
    expect(screen.getByRole("radio", { name: /^PM$/ }).getAttribute("tabindex")).toBe("0");
    expect(screen.getByRole("radio", { name: /^PM$/ }).getAttribute("aria-checked")).toBe("true");
  });

  it("ArrowRight from the active option moves focus and calls setRoleView with the next option", () => {
    render(<RoleViewSwitch />);
    const analyst = screen.getByRole("radio", { name: /Analyst/ });
    analyst.focus();
    fireEvent.keyDown(analyst, { key: "ArrowRight" });
    expect(mocks.setRoleView).toHaveBeenCalledWith("pm");
  });

  it("clicking an option still calls setRoleView directly (the roving-tabs migration didn't drop the pointer path)", () => {
    render(<RoleViewSwitch />);
    fireEvent.click(screen.getByRole("radio", { name: /^QA$/ }));
    expect(mocks.setRoleView).toHaveBeenCalledWith("qa");
  });
});
