// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { WorkbenchToolbar } from "./WorkbenchToolbar";

afterEach(cleanup);

describe("WorkbenchToolbar", () => {
  it("exposes at most five actions before overflow", () => {
    render(<WorkbenchToolbar
      title="Coverage"
      count="42 issuers"
      actions={Array.from({ length: 7 }, (_, index) => ({ id: String(index), label: `Action ${index + 1}`, onClick: vi.fn() }))}
    />);
    expect(screen.getAllByRole("button")).toHaveLength(7);
    expect(screen.getByText("More actions")).toBeTruthy();
    const toolbar = screen.getByRole("toolbar", { name: "Coverage actions" });
    expect(toolbar.querySelectorAll(":scope > button")).toHaveLength(5);
  });
});
