// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";

vi.mock("@/lib/api", () => ({
  edgarSearch: vi.fn(),
  edgarExhibits: vi.fn(),
  edgarVaultExhibit: vi.fn(),
}));

import { edgarSearch, edgarExhibits, edgarVaultExhibit } from "@/lib/api";
import { EdgarImport } from "./EdgarImport";
import type { Issuer } from "@/types/issuers";

const issuer: Issuer = { id: "i1", name: "Carnival", ticker: "CCL" };

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("EdgarImport", () => {
  it("renders the search panel prefilled for the issuer", () => {
    render(<EdgarImport issuer={issuer} runMode="legal" />);
    expect(screen.getByDisplayValue("Carnival credit agreement")).toBeTruthy();
    expect(screen.getByText("SEARCH EDGAR")).toBeTruthy();
  });

  it("searches → expands exhibits → vaults one (threading the run mode)", async () => {
    vi.mocked(edgarSearch).mockResolvedValue([
      { cik: "320193", accession: "acc1", form: "8-K", filed_date: "2024-01-01",
        title: "Carnival 8-K filing", source_url: "u", provenance: "external · unverified" },
    ]);
    vi.mocked(edgarExhibits).mockResolvedValue([
      { name: "creditagreement.htm", url: "u/ex10", doc_label: "Credit Agreement",
        authority_rank: 1, size: 1000 },
    ]);
    vi.mocked(edgarVaultExhibit).mockResolvedValue({
      document_id: "d1", storage_key: "k", doc_type: "EDGAR Exhibit", run_mode: "legal",
      chunks_created: 7, provenance: "primary · vaulted", message: "ok",
    });

    render(<EdgarImport issuer={issuer} runMode="legal" />);
    fireEvent.click(screen.getByText("SEARCH EDGAR"));

    fireEvent.click(await screen.findByText("Carnival 8-K filing"));
    expect(edgarExhibits).toHaveBeenCalledWith("320193", "acc1");

    fireEvent.click(await screen.findByText("VAULT →"));
    await waitFor(() => expect(edgarVaultExhibit).toHaveBeenCalledWith("i1", "u/ex10", "legal"));
    expect(await screen.findByText(/7 ch/)).toBeTruthy();   // vaulted confirmation
  });

  it("shows the not-configured guidance on a 503", async () => {
    vi.mocked(edgarSearch).mockRejectedValue({ response: { status: 503 } });
    render(<EdgarImport issuer={issuer} runMode="legal" />);
    fireEvent.click(screen.getByText("SEARCH EDGAR"));
    expect(await screen.findByText(/not configured/i, { exact: false })).toBeTruthy();
  });
});
