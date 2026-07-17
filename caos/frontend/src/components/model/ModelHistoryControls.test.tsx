// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ModelHistoryControls } from "./ModelHistoryControls";

afterEach(cleanup);

const props = () => ({
  canUndo: true, canRedo: true, onUndo: vi.fn(), onRedo: vi.fn(),
  checkpoints: [{ id: "cp-1", name: "Base", at: "2026-07-17T00:00:00Z", overrides: {} }],
  onCheckpoint: vi.fn(async () => false), onRestore: vi.fn(() => true), onDelete: vi.fn(async () => true),
});

describe("ModelHistoryControls edge interactions", () => {
  it("submits with Enter, preserves a rejected name, and deletes a checkpoint", async () => {
    const p = props();
    render(<ModelHistoryControls {...p} error="Save failed" />);
    fireEvent.click(screen.getByRole("button", { name: /CHECKPOINTS/ }));
    const input = screen.getByRole("textbox", { name: "Checkpoint name" });
    fireEvent.change(input, { target: { value: "Review" } });
    fireEvent.keyDown(input, { key: "Tab" });
    expect(p.onCheckpoint).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(p.onCheckpoint).toHaveBeenCalledWith("Review"));
    expect((input as HTMLInputElement).value).toBe("Review");
    fireEvent.click(screen.getByRole("button", { name: "Delete checkpoint Base" }));
    expect(p.onDelete).toHaveBeenCalledWith("cp-1");
    expect(screen.getByRole("alert").textContent).toBe("Save failed");
  });
});
