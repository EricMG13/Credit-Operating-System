// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AnalysisContextSaveState } from "./AnalysisContextSaveState";

afterEach(cleanup);

describe("AnalysisContextSaveState", () => {
  it("renders only the active save state", () => {
    const retryLastPatch = vi.fn().mockResolvedValue(null);
    const view = render(<AnalysisContextSaveState analysis={{ mutationState: "idle", mutationError: null, retryLastPatch }} />);
    expect(view.container.firstChild).toBeNull();

    view.rerender(<AnalysisContextSaveState analysis={{ mutationState: "saving", mutationError: null, retryLastPatch }} />);
    expect(screen.getByRole("status").textContent).toBe("Saving context…");
  });

  it("shows detailed and generic errors and retries without leaking rejection", async () => {
    const retryLastPatch = vi.fn()
      .mockRejectedValueOnce(new Error("still offline"))
      .mockResolvedValueOnce(null);
    const view = render(<AnalysisContextSaveState analysis={{ mutationState: "error", mutationError: "Rate limit reached", retryLastPatch }} />);
    expect(screen.getByRole("alert").textContent).toContain("Last change not saved — Rate limit reached");
    fireEvent.click(screen.getByRole("button", { name: "Retry context save" }));
    await waitFor(() => expect(retryLastPatch).toHaveBeenCalledTimes(1));

    view.rerender(<AnalysisContextSaveState analysis={{ mutationState: "error", mutationError: null, retryLastPatch }} />);
    expect(screen.getByRole("alert").textContent).toContain("Last change not saved.");
    fireEvent.click(screen.getByRole("button", { name: "Retry context save" }));
    await waitFor(() => expect(retryLastPatch).toHaveBeenCalledTimes(2));
  });
});
