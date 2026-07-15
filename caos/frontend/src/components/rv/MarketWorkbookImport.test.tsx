// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const previewMarketWorkbook = vi.hoisted(() => vi.fn());
const commitMarketWorkbook = vi.hoisted(() => vi.fn());

vi.mock("@/lib/analysis-workbench", () => ({
  analysisApi: { previewMarketWorkbook, commitMarketWorkbook },
}));
vi.mock("@/lib/api", () => ({
  toErrorMessage: (_error: unknown, fallback: string) => fallback,
}));

import { MarketWorkbookImport } from "./MarketWorkbookImport";

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("MarketWorkbookImport", () => {
  it("previews an explicit Bloomberg mapping before committing the same bytes and token", async () => {
    const preview = {
      workbook_sha256: "a".repeat(64), preview_token: "signed-preview", issuer_mappings: {},
      selected_sheet: "Market Data", header_row: 1, mapping: {}, as_of: "2026-07-13T00:00:00Z",
      row_count: 588, accepted_count: 586, rejected_count: 2, formula_cell_count: 0,
      blocking_count: 0, warning_count: 6, preview_truncated: true, rows: [],
      issues: [{ severity: "warning", code: "invalid_discount_margin", message: "Two rows rejected.", row: null, column: null, field: "discount_margin" }],
    };
    const committed = {
      snapshot_id: "snapshot-market-1", existing: false, document_id: "document-1",
      source_manifest_id: "manifest-1", workbook_sha256: preview.workbook_sha256,
      payload_hash: "b".repeat(64), as_of: preview.as_of, source_label: "Bloomberg recorded workbook",
      instrument_count: 586, rejected_count: 2, warning_count: 6, formula_cell_count: 0,
      freshness: { state: "current" },
    };
    previewMarketWorkbook.mockResolvedValue(preview);
    commitMarketWorkbook.mockResolvedValue(committed);
    const onCommitted = vi.fn();
    render(<MarketWorkbookImport onCommitted={onCommitted} />);

    fireEvent.click(screen.getByRole("button", { name: /import price feed/i }));
    const file = new File(["xlsx-bytes"], "market.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    fireEvent.change(screen.getByLabelText(/workbook · .xlsx only/i), { target: { files: [file] } });
    fireEvent.change(screen.getByLabelText(/market as-of/i), { target: { value: "2026-07-13" } });
    fireEvent.click(screen.getByRole("button", { name: /preview workbook/i }));

    expect(await screen.findByText(/586 accepted · 2 rejected · 6 warnings · 0 blocking/i)).toBeTruthy();
    expect(previewMarketWorkbook).toHaveBeenCalledWith(expect.objectContaining({
      file,
      mapping: expect.objectContaining({
        sheet: "Market Data",
        columns: expect.objectContaining({ price: "Ask", discount_margin: "Mid 3Y DM" }),
        constants: { currency: "USD", as_of: "2026-07-13" },
      }),
    }));

    fireEvent.click(screen.getByRole("button", { name: /commit immutable snapshot/i }));
    await waitFor(() => expect(commitMarketWorkbook).toHaveBeenCalledWith(expect.objectContaining({
      file, preview, sourceLabel: "Bloomberg recorded workbook",
    })));
    expect(await screen.findByText(/new snapshot snapshot/i)).toBeTruthy();
    expect(onCommitted).toHaveBeenCalledWith(committed);
  });

  it("does not expose commit when preview has blocking issues", async () => {
    previewMarketWorkbook.mockResolvedValue({
      workbook_sha256: "a".repeat(64), preview_token: "signed-preview", issuer_mappings: {},
      selected_sheet: null, header_row: null, mapping: {}, as_of: null,
      row_count: 0, accepted_count: 0, rejected_count: 0, formula_cell_count: 0,
      blocking_count: 1, warning_count: 0, preview_truncated: false, rows: [],
      issues: [{ severity: "blocking", code: "missing_required_columns", message: "Required fields missing.", row: null, column: null, field: null }],
    });
    render(<MarketWorkbookImport />);
    fireEvent.click(screen.getByRole("button", { name: /import price feed/i }));
    fireEvent.change(screen.getByLabelText(/layout/i), { target: { value: "canonical" } });
    fireEvent.change(screen.getByLabelText(/workbook · .xlsx only/i), { target: { files: [new File(["x"], "bad.xlsx")] } });
    fireEvent.click(screen.getByRole("button", { name: /preview workbook/i }));
    const commitButton = await screen.findByRole("button", { name: /commit immutable snapshot/i });
    expect((commitButton as HTMLButtonElement).disabled).toBe(true);
  });
});
