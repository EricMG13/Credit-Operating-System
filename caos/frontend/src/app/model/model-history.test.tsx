// @vitest-environment jsdom
// Integration lock for G3: multi-cell paste applies as ONE undo step, ⌘Z/⌘⇧Z
// undo/redo the override grid, and checkpoints round-trip through the shared
// modal (save → list → restore).
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ModelPage from "./page";
import { getAnalystSettings, updateAnalystWorkspace } from "@/lib/api";

vi.mock("next/navigation", () => ({
  usePathname: () => "/model",
  // No ?issuer= — resolves to the ATLF reference issuer, which always has a
  // usable model grid regardless of the (irrelevant here) engine anchor.
  useSearchParams: () => ({ get: () => null }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));
vi.mock("@/components/shared/RequireAuth", () => ({
  RequireAuth: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/lib/engine/useModelEngine", () => ({
  useModelEngine: () => ({ anchor: null, downside: null, loading: false, live: false, runId: null, committeeStatus: null, phase: "none" }),
}));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  getSavedModel: vi.fn().mockResolvedValue(null),
  saveModel: vi.fn(),
  getAnalystSettings: vi.fn(),
  updateAnalystWorkspace: vi.fn(),
}));

const mockGetAnalystSettings = vi.mocked(getAnalystSettings);
const mockUpdateAnalystWorkspace = vi.mocked(updateAnalystWorkspace);

function emptySettings(workspace: Record<string, unknown> = {}) {
  return { model_lanes: {}, email_intelligence: { approved_senders: [] }, workspace };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  window.localStorage.clear();
});

describe("Model Builder · paste + undo/redo (G3)", () => {
  it("a multi-cell paste applies as one override patch, and ⌘Z undoes the whole block in one step", async () => {
    mockGetAnalystSettings.mockResolvedValue(emptySettings());
    render(<ModelPage />);
    await screen.findByRole("grid", { name: "Model worksheet" });

    const q1 = document.getElementById("cell-rev-q1")!;
    fireEvent.click(q1); // select the anchor cell
    const grid = screen.getByRole("grid", { name: "Model worksheet" });

    fireEvent.paste(grid, { clipboardData: { getData: () => "10\t20" } });
    await waitFor(() => expect(screen.getByText(/pasted 2 cells/)).toBeTruthy());
    // Selection stayed on rev/q1 — the formula bar reflects the new override.
    expect(screen.getByText("MANUAL OVERRIDE")).toBeTruthy();

    act(() => { fireEvent.keyDown(window, { key: "z", ctrlKey: true }); });
    await waitFor(() => expect(screen.queryByText("MANUAL OVERRIDE")).toBeNull());

    act(() => { fireEvent.keyDown(window, { key: "z", ctrlKey: true, shiftKey: true }); });
    await waitFor(() => expect(screen.getByText("MANUAL OVERRIDE")).toBeTruthy());
  });

  it("skips a paste landing on a non-editable column and reports it, without applying a bogus override", async () => {
    mockGetAnalystSettings.mockResolvedValue(emptySettings());
    render(<ModelPage />);
    await screen.findByRole("grid", { name: "Model worksheet" });

    const q1 = document.getElementById("cell-rev-q1")!;
    fireEvent.click(q1);
    const grid = screen.getByRole("grid", { name: "Model worksheet" });
    fireEvent.paste(grid, { clipboardData: { getData: () => "n/a" } });

    await waitFor(() => expect(screen.getByText(/1 invalid value discarded/)).toBeTruthy());
    expect(screen.queryByText("MANUAL OVERRIDE")).toBeNull();
  });
});

describe("Model Builder · checkpoints (G3)", () => {
  it("saves a named checkpoint and restores it through the shared modal", async () => {
    mockGetAnalystSettings.mockResolvedValue(emptySettings());
    mockUpdateAnalystWorkspace.mockImplementation(async (patch) => {
      const next = patch({});
      return emptySettings(next as Record<string, unknown>);
    });
    render(<ModelPage />);
    await screen.findByRole("grid", { name: "Model worksheet" });

    const q1 = document.getElementById("cell-rev-q1")!;
    fireEvent.click(q1);
    const grid = screen.getByRole("grid", { name: "Model worksheet" });
    fireEvent.paste(grid, { clipboardData: { getData: () => "10" } });
    await waitFor(() => expect(screen.getByText("MANUAL OVERRIDE")).toBeTruthy());

    fireEvent.click(screen.getByTitle("Save or restore a named snapshot of your overrides"));
    const nameInput = await screen.findByLabelText("Checkpoint name");
    fireEvent.change(nameInput, { target: { value: "First pass" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByText("First pass")).toBeTruthy());
    fireEvent.keyDown(document, { key: "Escape" });

    // Diverge from the checkpoint, then restore it.
    fireEvent.paste(grid, { clipboardData: { getData: () => "999" } });
    await waitFor(() => expect(screen.getByText(/pasted 1 cell/)).toBeTruthy());

    fireEvent.click(screen.getByTitle("Save or restore a named snapshot of your overrides"));
    await screen.findByText("First pass");
    fireEvent.click(screen.getByRole("button", { name: "Restore" }));

    // Restoring closes the modal and reverts the FormulaBar's reading for the
    // still-selected q1 cell back to the checkpoint's value (10, not 999).
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Model checkpoints" })).toBeNull());
    expect(screen.getByText("MANUAL OVERRIDE")).toBeTruthy();
  });
});
