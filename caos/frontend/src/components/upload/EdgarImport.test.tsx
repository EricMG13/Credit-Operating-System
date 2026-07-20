// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";

vi.mock("@/lib/api", () => ({
  edgarVaultUrls: vi.fn(),
}));

import { edgarVaultUrls } from "@/lib/api";
import type { EdgarVaultResult } from "@/lib/api";
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
    expect(screen.getByLabelText("Public EDGAR document URLs")).toBeTruthy();
    expect(screen.getByText("VAULT URL")).toBeTruthy();
  });

  it("vaults a pasted EDGAR URL, threading the run mode", async () => {
    vi.mocked(edgarVaultUrls).mockResolvedValue({
      ok: [{
        document_id: "d1", storage_key: "k", doc_type: "EDGAR Exhibit", run_mode: "legal",
        chunks_created: 7, provenance: "primary · vaulted", message: "ok",
      }],
      failed: [],
    });

    render(<EdgarImport issuer={issuer} runMode="legal" />);
    fireEvent.change(screen.getByLabelText("Public EDGAR document URLs"), { target: { value: "u/ex10,u/10k" } });
    fireEvent.click(screen.getByText("VAULT URL"));
    await waitFor(() => expect(edgarVaultUrls).toHaveBeenCalledWith("i1", "u/ex10,u/10k", "legal"));
    expect(await screen.findByText(/7 ch/)).toBeTruthy();   // vaulted confirmation
  });

  it("hands each successful EDGAR vault to the wizard outcome transition", async () => {
    const vaulted: EdgarVaultResult = {
      document_id: "d-result", storage_key: "vault/d-result", doc_type: "EDGAR Exhibit", run_mode: "legal",
      chunks_created: 2, provenance: "primary · vaulted", message: "10-K vaulted",
    };
    const onVaulted = vi.fn();
    vi.mocked(edgarVaultUrls).mockResolvedValue({ ok: [vaulted], failed: [] });

    render(<EdgarImport issuer={issuer} runMode="legal" onVaulted={onVaulted} />);
    fireEvent.change(screen.getByLabelText("Public EDGAR document URLs"), { target: { value: "u/10k" } });
    fireEvent.click(screen.getByText("VAULT URL"));

    await waitFor(() => expect(onVaulted).toHaveBeenCalledWith(vaulted));
  });

  it("surfaces which URLs failed on a partial batch, not just the successes (M-12)", async () => {
    vi.mocked(edgarVaultUrls).mockResolvedValue({
      ok: [{
        document_id: "d1", storage_key: "k", doc_type: "EDGAR Exhibit", run_mode: "legal",
        chunks_created: 3, provenance: "primary · vaulted", message: "ok",
      }],
      failed: [{ url: "u/bad", reason: "404 not found" }],
    });

    render(<EdgarImport issuer={issuer} runMode="legal" />);
    fireEvent.change(screen.getByLabelText("Public EDGAR document URLs"), { target: { value: "u/ex10,u/bad" } });
    fireEvent.click(screen.getByText("VAULT URL"));
    expect(await screen.findByText(/vaulted 1\/2 — 1 failed/)).toBeTruthy();
    expect(await screen.findByText(/u\/bad — 404 not found/)).toBeTruthy();
  });

  it("shows administrator guidance when SEC import is unavailable", async () => {
    vi.mocked(edgarVaultUrls).mockRejectedValue({ response: { status: 503 } });
    render(<EdgarImport issuer={issuer} runMode="legal" />);
    fireEvent.change(screen.getByLabelText("Public EDGAR document URLs"), { target: { value: "u/ex10" } });
    fireEvent.click(screen.getByText("VAULT URL"));
    expect(await screen.findByText(/SEC filing import is unavailable/i, { exact: false })).toBeTruthy();
    expect(screen.getByText(/workspace administrator/i, { exact: false })).toBeTruthy();
  });

  it.each([
    { label: "string detail", rejection: { response: { status: 400, data: { detail: "SEC rejected the URL" } } }, message: "SEC rejected the URL" },
    { label: "nested message", rejection: { response: { status: 400, data: { detail: { message: "Malformed accession" } } } }, message: "Malformed accession" },
    { label: "fallback", rejection: new Error("network unavailable"), message: "EDGAR URL vaulting failed." },
  ])("surfaces a useful non-503 vaulting error — $label", async ({ rejection, message }) => {
    vi.mocked(edgarVaultUrls).mockRejectedValue(rejection);
    render(<EdgarImport issuer={issuer} runMode="legal" />);
    const input = screen.getByLabelText("Public EDGAR document URLs");
    fireEvent.change(input, { target: { value: "u/ex10" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(edgarVaultUrls).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: "Enter" });
    expect((await screen.findByRole("alert")).textContent).toContain(message);
  });

  it("marks a zero-chunk result as a warning and preserves issuer punctuation", async () => {
    vi.mocked(edgarVaultUrls).mockResolvedValue({
      ok: [{
        document_id: "d-empty", storage_key: "k", doc_type: "EDGAR Exhibit", run_mode: "legal",
        chunks_created: 0, provenance: "primary · vaulted", message: "No eligible text",
      }],
      failed: [],
    });

    render(<EdgarImport issuer={{ ...issuer, name: "Carnival plc." }} runMode="legal" />);
    const input = screen.getByLabelText("Public EDGAR document URLs");
    fireEvent.change(input, { target: { value: "u/empty" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(await screen.findByText("0 ch")).toBeTruthy();
    expect(screen.getByText(/together for Carnival plc\.$/)).toBeTruthy();
    const resultRow = screen.getByText("No eligible text").parentElement;
    expect(resultRow?.querySelector('[aria-hidden="true"]')?.getAttribute("style")).toContain("var(--caos-warning)");
  });

  it("does not vault a whitespace-only URL from the Enter-key path", () => {
    render(<EdgarImport issuer={issuer} runMode="legal" />);
    const input = screen.getByLabelText("Public EDGAR document URLs");
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(edgarVaultUrls).not.toHaveBeenCalled();
  });

  it("does not double-vault on a fast double-invoke via Enter before the first call resolves (M-14)", async () => {
    let resolveVault: (r: { ok: EdgarVaultResult[]; failed: { url: string; reason: string }[] }) => void;
    vi.mocked(edgarVaultUrls).mockReturnValue(
      new Promise((resolve) => {
        resolveVault = resolve;
      })
    );

    render(<EdgarImport issuer={issuer} runMode="legal" />);
    const input = screen.getByLabelText("Public EDGAR document URLs");
    fireEvent.change(input, { target: { value: "u/ex10" } });
    // The Enter-key trigger calls vault() directly and isn't gated by the
    // button's `disabled` attribute, so it's the path that actually exercises
    // re-entrancy: fire it twice back-to-back before the first call resolves.
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => expect(edgarVaultUrls).toHaveBeenCalledTimes(1));

    resolveVault!({ ok: [], failed: [] });
    await waitFor(() => expect(screen.getByText("VAULT URL")).toBeTruthy());
    expect(edgarVaultUrls).toHaveBeenCalledTimes(1);
  });
});
