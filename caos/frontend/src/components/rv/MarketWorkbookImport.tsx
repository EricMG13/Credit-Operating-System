"use client";

import { useMemo, useState } from "react";
import { analysisApi, type MarketImportCommit, type MarketWorkbookPreview } from "@/lib/analysis-workbench";
import { toErrorMessage } from "@/lib/api";
import { fmtUtcDate } from "@/lib/format-date";

type Template = "bloomberg" | "canonical";

export function MarketWorkbookImport({ onCommitted }: { onCommitted?: (value: MarketImportCommit) => void }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [template, setTemplate] = useState<Template>("bloomberg");
  const [sheet, setSheet] = useState("Market Data");
  const [priceHeader, setPriceHeader] = useState("Ask");
  const [currency, setCurrency] = useState("USD");
  const [asOf, setAsOf] = useState("");
  const [sourceLabel, setSourceLabel] = useState("Bloomberg recorded workbook");
  const [preview, setPreview] = useState<MarketWorkbookPreview | null>(null);
  const [committed, setCommitted] = useState<MarketImportCommit | null>(null);
  const [busy, setBusy] = useState<"preview" | "commit" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mapping = useMemo<Record<string, unknown>>(() => {
    if (template === "canonical") return {};
    return {
      sheet: sheet.trim(),
      header_row: 1,
      columns: {
        figi: "FIGI",
        borrower: "Company",
        instrument: "FIGI",
        price: priceHeader,
        discount_margin: "Mid 3Y DM",
      },
      constants: { currency: currency.trim().toUpperCase(), as_of: asOf },
    };
  }, [asOf, currency, priceHeader, sheet, template]);

  const resetResult = () => { setPreview(null); setCommitted(null); setError(null); };

  const runPreview = async () => {
    if (!file || busy || (template === "bloomberg" && !asOf)) return;
    setBusy("preview"); setError(null); setCommitted(null);
    try {
      setPreview(await analysisApi.previewMarketWorkbook({ file, mapping }));
    } catch (reason) {
      setPreview(null);
      setError(toErrorMessage(reason, "Market workbook preview failed."));
    } finally { setBusy(null); }
  };

  const commit = async () => {
    if (!file || !preview || preview.blocking_count > 0 || busy) return;
    setBusy("commit"); setError(null);
    try {
      const value = await analysisApi.commitMarketWorkbook({ file, mapping, preview, sourceLabel });
      setCommitted(value);
      onCommitted?.(value);
    } catch (reason) {
      setError(toErrorMessage(reason, "Market workbook commit failed. Preview again if the token expired."));
    } finally { setBusy(null); }
  };

  return (
    <section className="rounded-md border border-caos-border bg-caos-bg/30" aria-label="Market workbook import">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="focus-ring flex w-full items-center justify-between px-3 py-2 text-left">
        <span className="tabular text-caos-2xs font-semibold uppercase tracking-wider text-caos-text">Import price feed</span>
        <span className="text-caos-muted" aria-hidden="true">{open ? "−" : "+"}</span>
      </button>
      {open ? <div className="space-y-3 border-t border-caos-border p-3">
        <p className="text-caos-xs leading-relaxed text-caos-muted">Preview validates cached Bloomberg values and writes nothing. Commit creates one immutable, source-linked snapshot.</p>
        <label className="block text-caos-xs text-caos-text">Workbook · .xlsx only
          <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => { setFile(event.target.files?.[0] ?? null); resetResult(); }} className="mt-1 block w-full text-caos-xs text-caos-muted file:mr-2 file:rounded-sm file:border file:border-caos-border file:bg-caos-elevated file:px-2 file:py-1 file:text-caos-text" />
        </label>
        <label className="block text-caos-xs text-caos-text">Layout
          <select value={template} onChange={(event) => { setTemplate(event.target.value as Template); resetResult(); }} className="mt-1 h-8 w-full rounded-sm border border-caos-border bg-caos-panel px-2 text-caos-xs text-caos-text focus-ring">
            <option value="bloomberg">Bloomberg Market Data sheet</option>
            <option value="canonical">CAOS canonical headers</option>
          </select>
        </label>
        {template === "bloomberg" ? <div className="grid grid-cols-2 gap-2">
          <label className="text-caos-xs text-caos-text">Sheet<input value={sheet} onChange={(event) => { setSheet(event.target.value); resetResult(); }} className="mt-1 h-8 w-full rounded-sm border border-caos-border bg-caos-panel px-2 text-caos-text focus-ring" /></label>
          <label className="text-caos-xs text-caos-text">Price field<select value={priceHeader} onChange={(event) => { setPriceHeader(event.target.value); resetResult(); }} className="mt-1 h-8 w-full rounded-sm border border-caos-border bg-caos-panel px-2 text-caos-text focus-ring"><option>Ask</option><option>Bid</option><option>Price</option></select></label>
          <label className="text-caos-xs text-caos-text">Currency<input value={currency} maxLength={3} onChange={(event) => { setCurrency(event.target.value); resetResult(); }} className="mt-1 h-8 w-full rounded-sm border border-caos-border bg-caos-panel px-2 uppercase text-caos-text focus-ring" /></label>
          <label className="text-caos-xs text-caos-text">Market as-of · required<input type="date" value={asOf} onChange={(event) => { setAsOf(event.target.value); resetResult(); }} className="mt-1 h-8 w-full rounded-sm border border-caos-border bg-caos-panel px-2 text-caos-text focus-ring" /></label>
        </div> : null}
        <label className="block text-caos-xs text-caos-text">Source label<input value={sourceLabel} maxLength={160} onChange={(event) => setSourceLabel(event.target.value)} className="mt-1 h-8 w-full rounded-sm border border-caos-border bg-caos-panel px-2 text-caos-text focus-ring" /></label>
        <button type="button" onClick={() => void runPreview()} disabled={!file || busy !== null || (template === "bloomberg" && !asOf)} className="caos-action-secondary focus-ring disabled:opacity-40">{busy === "preview" ? "Validating…" : "Preview workbook"}</button>
        {error ? <p role="alert" className="text-caos-xs text-caos-critical">{error}</p> : null}
        {preview ? <div className="space-y-2 rounded-sm border border-caos-border p-2 text-caos-xs">
          <p className="tabular text-caos-text">{preview.accepted_count.toLocaleString()} accepted · {preview.rejected_count.toLocaleString()} rejected · {preview.warning_count.toLocaleString()} warnings · {preview.blocking_count.toLocaleString()} blocking</p>
          <p className="text-caos-muted">{preview.selected_sheet ?? "No sheet"} · as-of {preview.as_of ? fmtUtcDate(preview.as_of) : "unknown"} · {preview.formula_cell_count.toLocaleString()} formula cells</p>
          {preview.issues.length ? <ul className="max-h-28 space-y-1 overflow-auto" aria-label="Workbook validation issues">{preview.issues.slice(0, 20).map((issue, index) => <li key={`${issue.code}-${issue.row ?? "all"}-${index}`} className={issue.severity === "blocking" ? "text-caos-critical" : "text-caos-warning"}>{issue.severity === "blocking" ? "BLOCK" : "WARN"} · {issue.message}</li>)}</ul> : <p className="text-caos-success">No validation issues.</p>}
          <button type="button" onClick={() => void commit()} disabled={preview.blocking_count > 0 || busy !== null || !sourceLabel.trim()} className="caos-primary-action focus-ring disabled:opacity-40">{busy === "commit" ? "Committing…" : "Commit immutable snapshot"}</button>
        </div> : null}
        {committed ? <p role="status" className="text-caos-xs text-caos-success">{committed.existing ? "Existing" : "New"} snapshot {committed.snapshot_id.slice(0, 8)} · {committed.instrument_count.toLocaleString()} instruments · freshness {String(committed.freshness.state ?? "unknown")}</p> : null}
      </div> : null}
    </section>
  );
}
