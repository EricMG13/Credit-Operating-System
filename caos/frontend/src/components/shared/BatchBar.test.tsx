// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, act, cleanup } from "@testing-library/react";
import { BatchBar } from "./BatchBar";

afterEach(cleanup);

describe("BatchBar", () => {
  it("renders nothing when selection is empty", () => {
    const { container } = render(<BatchBar selected={[]} onClear={() => {}} actions={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("shows the selection count and runs an action across every selected id", async () => {
    const run = vi.fn().mockResolvedValue(undefined);
    render(
      <BatchBar selected={["a", "b", "c"]} onClear={() => {}} actions={[{ id: "flag", label: "Flag to QA", run }]} />,
    );
    expect(screen.getByText("3 items selected")).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Flag to QA" }));
    });
    await waitFor(() => expect(run).toHaveBeenCalledTimes(3));
    expect(run).toHaveBeenCalledWith("a");
    expect(run).toHaveBeenCalledWith("b");
    expect(run).toHaveBeenCalledWith("c");
    await waitFor(() => expect(screen.getByText("3 succeeded")).toBeTruthy());
  });

  it("reports PER-ITEM partial failure — never a blanket success", async () => {
    const run = vi.fn(async (id: string) => {
      if (id === "bad") throw new Error("rate limited");
    });
    render(
      <BatchBar selected={["good", "bad"]} onClear={() => {}} actions={[{ id: "a", label: "Run", run }]} />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Run" }));
    });
    await waitFor(() => expect(screen.getByText("1/2 succeeded")).toBeTruthy());
  });

  it("clear button fires onClear", () => {
    const onClear = vi.fn();
    render(<BatchBar selected={["a"]} onClear={onClear} actions={[]} />);
    fireEvent.click(screen.getByRole("button", { name: /clear/i }));
    expect(onClear).toHaveBeenCalled();
  });
});
