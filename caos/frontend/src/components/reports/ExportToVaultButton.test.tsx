// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({ exportToVault: vi.fn() }));

vi.mock("@/lib/api", () => ({ exportToVault: mocks.exportToVault }));

import { ExportToVaultButton } from "./ExportToVaultButton";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ExportToVaultButton", () => {
  it("exports one note and exposes the written path", async () => {
    mocks.exportToVault.mockResolvedValue({ written: ["Atlas Forge.md"] });
    render(<ExportToVaultButton runId="run-1" className="desk-export" />);
    const button = screen.getByRole("button", { name: "⬓ EXPORT TO VAULT" });
    expect(button.className).toContain("desk-export");
    fireEvent.click(button);
    expect(await screen.findByRole("button", { name: "✓ EXPORTED · 1 note" })).toBeTruthy();
    expect(screen.getByTitle("Wrote: Atlas Forge.md")).toBeTruthy();
    expect(mocks.exportToVault).toHaveBeenCalledWith("run-1");
  });

  it("renders plural notes and ignores a click while export is pending", async () => {
    let resolveExport!: (value: { written: string[] }) => void;
    mocks.exportToVault.mockImplementation(() => new Promise((resolve) => { resolveExport = resolve; }));
    render(<ExportToVaultButton runId="run-2" />);
    fireEvent.click(screen.getByRole("button", { name: "⬓ EXPORT TO VAULT" }));
    const busy = await screen.findByRole("button", { name: "EXPORTING…" });
    expect(busy.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(busy);
    expect(mocks.exportToVault).toHaveBeenCalledTimes(1);
    resolveExport({ written: ["Hub.md", "Spoke.md"] });
    expect(await screen.findByRole("button", { name: "✓ EXPORTED · 2 notes" })).toBeTruthy();
  });

  it("explains an unconfigured vault", async () => {
    mocks.exportToVault.mockRejectedValue({ response: { status: 503 } });
    render(<ExportToVaultButton runId="run-3" />);
    fireEvent.click(screen.getByRole("button", { name: "⬓ EXPORT TO VAULT" }));
    expect(await screen.findByTitle("Vault export not configured (VAULT_EXPORT_DIR unset).")).toBeTruthy();
  });

  it("keeps an ordinary export failure retryable", async () => {
    mocks.exportToVault
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({ written: [] });
    render(<ExportToVaultButton runId="run-4" />);
    fireEvent.click(screen.getByRole("button", { name: "⬓ EXPORT TO VAULT" }));
    const failed = await screen.findByTitle("Export failed — try again.");
    expect(failed.textContent).toBe("✗ EXPORT FAILED");
    fireEvent.click(failed);
    await waitFor(() => expect(mocks.exportToVault).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole("button", { name: "✓ EXPORTED · 0 notes" })).toBeTruthy();
  });
});
