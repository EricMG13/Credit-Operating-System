// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ModuleFinder } from "./ModuleFinder";

const getAnalystSettings = vi.fn();
const updateAnalystWorkspace = vi.fn();

vi.mock("@/lib/api", () => ({
  getAnalystSettings: (...a: unknown[]) => getAnalystSettings(...a),
  updateAnalystWorkspace: (...a: unknown[]) => updateAnalystWorkspace(...a),
}));

// beforeEach (not just afterEach): the FIRST test needs a primed mock too — an
// unprimed vi.fn() resolves to undefined, and ModuleFinder.tsx's fire-and-forget
// `updateAnalystWorkspace(...).catch(...)` throws synchronously on undefined.catch.
beforeEach(() => {
  getAnalystSettings.mockResolvedValue({ model_lanes: {}, email_intelligence: {}, workspace: {} });
  updateAnalystWorkspace.mockResolvedValue({ model_lanes: {}, email_intelligence: {}, workspace: {} });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ModuleFinder", () => {
  it("opens on ⌘M, filters by id or name, and selecting adds a recent chip", async () => {
    getAnalystSettings.mockResolvedValue({ model_lanes: {}, email_intelligence: {}, workspace: {} });
    const onSelect = vi.fn();
    render(<ModuleFinder onSelect={onSelect} activeId="CP-0" />);
    await waitFor(() => expect(getAnalystSettings).toHaveBeenCalled());

    fireEvent.keyDown(window, { key: "m", metaKey: true });
    const input = await screen.findByRole("combobox");
    fireEvent.change(input, { target: { value: "liquidity" } });

    const option = await screen.findByText("Liquidity");
    fireEvent.mouseDown(option);

    expect(onSelect).toHaveBeenCalledWith("CP-2E");
    // Modal closes and a recent chip for the selected module appears in the strip.
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(await screen.findByTitle("Liquidity")).toBeTruthy();
    expect(updateAnalystWorkspace).toHaveBeenCalled();
  });

  it("does not open ⌘M while focus is inside a text input", async () => {
    render(
      <div>
        <input aria-label="other field" />
        <ModuleFinder onSelect={() => {}} activeId="CP-0" />
      </div>,
    );
    const other = screen.getByLabelText("other field");
    other.focus();
    fireEvent.keyDown(other, { key: "m", metaKey: true });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("pinning a module persists it to workspace and renders a pinned chip", async () => {
    getAnalystSettings.mockResolvedValue({ model_lanes: {}, email_intelligence: {}, workspace: {} });
    render(<ModuleFinder onSelect={() => {}} activeId="CP-0" />);
    await waitFor(() => expect(getAnalystSettings).toHaveBeenCalled());

    fireEvent.click(screen.getByTitle("Find a module by id or name (⌘M)"));
    const input = await screen.findByRole("combobox");
    fireEvent.change(input, { target: { value: "liquidity" } });
    const pinBtn = await screen.findByTitle("Pin");
    await act(async () => {
      fireEvent.mouseDown(pinBtn);
    });

    expect(updateAnalystWorkspace).toHaveBeenCalled();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(await screen.findByText("★ CP-2E")).toBeTruthy();
  });

  it("a 404 on settings load leaves pins/recents empty without surfacing an error", async () => {
    getAnalystSettings.mockRejectedValue(new Error("404"));
    render(<ModuleFinder onSelect={() => {}} activeId="CP-0" />);
    await waitFor(() => expect(getAnalystSettings).toHaveBeenCalled());
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByTitle("Find a module by id or name (⌘M)")).toBeTruthy();
  });
});
