// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";

vi.mock("@/lib/api", () => ({
  edgarVaultUrl: vi.fn(),
}));

import { edgarVaultUrl } from "@/lib/api";
import { EdgarImport } from "./EdgarImport";
import type { Issuer } from "@/types/issuers";

const issuer: Issuer = { id: "i1", name: "Carnival", ticker: "CCL" };

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("EdgarImport", () => {
  it("renders the EDGAR URL vaulting panel", () => {
    render(<EdgarImport issuer={issuer} runMode="legal" />);
    expect(screen.getByPlaceholderText("https://www.sec.gov/Archives/edgar/data/...")).toBeTruthy();
    expect(screen.getByText("VAULT URL")).toBeTruthy();
  });

  it("vaults a pasted EDGAR URL, threading the run mode", async () => {
    vi.mocked(edgarVaultUrl).mockResolvedValue({
      document_id: "d1", storage_key: "k", doc_type: "EDGAR Exhibit", run_mode: "legal",
      chunks_created: 7, provenance: "primary · vaulted", message: "ok",
    });

    render(<EdgarImport issuer={issuer} runMode="legal" />);
    fireEvent.change(screen.getByLabelText("EDGAR document URL"), { target: { value: "u/ex10" } });
    fireEvent.click(screen.getByText("VAULT URL"));
    await waitFor(() => expect(edgarVaultUrl).toHaveBeenCalledWith("i1", "u/ex10", "legal"));
    expect(await screen.findByText(/7 ch/)).toBeTruthy();   // vaulted confirmation
  });

  it("shows the not-configured guidance on a 503", async () => {
    vi.mocked(edgarVaultUrl).mockRejectedValue({ response: { status: 503 } });
    render(<EdgarImport issuer={issuer} runMode="legal" />);
    fireEvent.change(screen.getByLabelText("EDGAR document URL"), { target: { value: "u/ex10" } });
    fireEvent.click(screen.getByText("VAULT URL"));
    expect(await screen.findByText(/not configured/i, { exact: false })).toBeTruthy();
  });
});
