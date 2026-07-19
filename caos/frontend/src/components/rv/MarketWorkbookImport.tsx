"use client";

import { useMemo, useState } from "react";
import { analysisApi, type MarketImportCommit, type MarketWorkbookPreview } from "@/lib/analysis-workbench";
import { toErrorMessage } from "@/lib/api";
import { fmtUtcDate } from "@/lib/format-date";

type Template = "bloomberg" | "canonical";

type ImportConfig = { template: Template; sheet: string; priceHeader: string; currency: string; asOf: string; sourceLabel: string };

const INITIAL_CONFIG: ImportConfig = {
  template: "bloomberg",
  sheet: "Market Data",
  priceHeader: "Ask",
  currency: "USD",
  asOf: "",
  sourceLabel: "Bloomberg recorded workbook",
};

function marketWorkbookMapping(config: ImportConfig): Record<string, unknown> {
  if (config.template === "canonical") return {};
  return {
    sheet: config.sheet.trim(),
    header_row: 1,
    columns: { figi: "FIGI", borrower: "Company", instrument: "FIGI", price: config.priceHeader, discount_margin: "Mid 3Y DM" },
    constants: { currency: config.currency.trim().toUpperCase(), as_of: config.asOf },
  };
}

function useMarketWorkbookImport(onCommitted?: (value: MarketImportCommit) => void) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [config, setConfig] = useState<ImportConfig>(INITIAL_CONFIG);
  const [preview, setPreview] = useState<MarketWorkbookPreview | null>(null);
  const [committed, setCommitted] = useState<MarketImportCommit | null>(null);
  const [busy, setBusy] = useState<"preview" | "commit" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mapping = useMemo(() => marketWorkbookMapping(config), [config]);
  const resetResult = () => { setPreview(null); setCommitted(null); setError(null); };
  const updateConfig = <Key extends keyof ImportConfig>(key: Key, value: ImportConfig[Key], reset = true) => {
    setConfig((current) => ({ ...current, [key]: value }));
    if (reset) resetResult();
  };
  const selectFile = (nextFile: File | null) => { setFile(nextFile); resetResult(); };
  const runPreview = async () => {
    if (!file || busy || (config.template === "bloomberg" && !config.asOf)) return;
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
      const value = await analysisApi.commitMarketWorkbook({ file, mapping, preview, sourceLabel: config.sourceLabel });
      setCommitted(value);
      onCommitted?.(value);
    } catch (reason) {
      setError(toErrorMessage(reason, "Market workbook commit failed. Preview again if the token expired."));
    } finally { setBusy(null); }
  };
  return { open, setOpen, file, config, updateConfig, selectFile, preview, committed, busy, error, runPreview, commit };
}

type MarketImportModel = ReturnType<typeof useMarketWorkbookImport>;

function BloombergMappingFields({ model }: { model: MarketImportModel }) {
  if (model.config.template !== "bloomberg") return null;
  return (
    <div className="grid grid-cols-2 gap-2">
      <label className="text-caos-xs text-caos-text">Sheet<input value={model.config.sheet} onChange={(event) => model.updateConfig("sheet", event.target.value)} className="mt-1 h-8 w-full rounded-sm border border-caos-border bg-caos-panel px-2 text-caos-text focus-ring" /></label>
      <label className="text-caos-xs text-caos-text">Price field<select value={model.config.priceHeader} onChange={(event) => model.updateConfig("priceHeader", event.target.value)} className="mt-1 h-8 w-full rounded-sm border border-caos-border bg-caos-panel px-2 text-caos-text focus-ring"><option>Ask</option><option>Bid</option><option>Price</option></select></label>
      <label className="text-caos-xs text-caos-text">Currency<input value={model.config.currency} maxLength={3} onChange={(event) => model.updateConfig("currency", event.target.value)} className="mt-1 h-8 w-full rounded-sm border border-caos-border bg-caos-panel px-2 uppercase text-caos-text focus-ring" /></label>
      <label className="text-caos-xs text-caos-text">Market as-of · required<input type="date" value={model.config.asOf} onChange={(event) => model.updateConfig("asOf", event.target.value)} className="mt-1 h-8 w-full rounded-sm border border-caos-border bg-caos-panel px-2 text-caos-text focus-ring" /></label>
    </div>
  );
}

function MarketImportConfiguration({ model }: { model: MarketImportModel }) {
  const previewDisabled = !model.file || model.busy !== null || (model.config.template === "bloomberg" && !model.config.asOf);
  return (
    <>
      <p className="text-caos-xs leading-relaxed text-caos-muted">Preview validates cached Bloomberg values and writes nothing. Commit creates one immutable, source-linked snapshot.</p>
      <label className="block text-caos-xs text-caos-text">Workbook · .xlsx only<input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => model.selectFile(event.target.files?.[0] ?? null)} className="mt-1 block w-full text-caos-xs text-caos-muted file:mr-2 file:rounded-sm file:border file:border-caos-border file:bg-caos-elevated file:px-2 file:py-1 file:text-caos-text" /></label>
      <label className="block text-caos-xs text-caos-text">Layout<select value={model.config.template} onChange={(event) => model.updateConfig("template", event.target.value as Template)} className="mt-1 h-8 w-full rounded-sm border border-caos-border bg-caos-panel px-2 text-caos-xs text-caos-text focus-ring"><option value="bloomberg">Bloomberg Market Data sheet</option><option value="canonical">CAOS canonical headers</option></select></label>
      <BloombergMappingFields model={model} />
      <label className="block text-caos-xs text-caos-text">Source label<input value={model.config.sourceLabel} maxLength={160} onChange={(event) => model.updateConfig("sourceLabel", event.target.value, false)} className="mt-1 h-8 w-full rounded-sm border border-caos-border bg-caos-panel px-2 text-caos-text focus-ring" /></label>
      <button type="button" onClick={() => void model.runPreview()} disabled={previewDisabled} className="caos-action-secondary focus-ring disabled:opacity-40">{model.busy === "preview" ? "Validating…" : "Preview workbook"}</button>
    </>
  );
}

function PreviewIssues({ preview }: { preview: MarketWorkbookPreview }) {
  if (!preview.issues.length) return <p className="text-caos-success">No validation issues.</p>;
  return <ul className="max-h-28 space-y-1 overflow-auto" aria-label="Workbook validation issues">{preview.issues.slice(0, 20).map((issue, index) => <li key={`${issue.code}-${issue.row ?? "all"}-${index}`} className={issue.severity === "blocking" ? "text-caos-critical" : "text-caos-warning"}>{issue.severity === "blocking" ? "BLOCK" : "WARN"} · {issue.message}</li>)}</ul>;
}

function MarketImportPreview({ model }: { model: MarketImportModel }) {
  const preview = model.preview;
  if (!preview) return null;
  const commitDisabled = preview.blocking_count > 0 || model.busy !== null || !model.config.sourceLabel.trim();
  return (
    <div className="space-y-2 rounded-sm border border-caos-border p-2 text-caos-xs">
      <p className="tabular text-caos-text">{preview.accepted_count.toLocaleString()} accepted · {preview.rejected_count.toLocaleString()} rejected · {preview.warning_count.toLocaleString()} warnings · {preview.blocking_count.toLocaleString()} blocking</p>
      <p className="text-caos-muted">{preview.selected_sheet ?? "No sheet"} · as-of {preview.as_of ? fmtUtcDate(preview.as_of) : "unknown"} · {preview.formula_cell_count.toLocaleString()} formula cells</p>
      <PreviewIssues preview={preview} />
      <button type="button" onClick={() => void model.commit()} disabled={commitDisabled} className="caos-primary-action focus-ring disabled:opacity-40">{model.busy === "commit" ? "Committing…" : "Commit immutable snapshot"}</button>
    </div>
  );
}

function MarketImportStatus({ committed }: { committed: MarketImportCommit | null }) {
  if (!committed) return null;
  return <p role="status" className="text-caos-xs text-caos-success">{committed.existing ? "Existing" : "New"} snapshot {committed.snapshot_id.slice(0, 8)} · {committed.instrument_count.toLocaleString()} instruments · freshness {String(committed.freshness.state ?? "unknown")}</p>;
}

function MarketImportBody({ model }: { model: MarketImportModel }) {
  if (!model.open) return null;
  return <div className="space-y-3 border-t border-caos-border p-3"><MarketImportConfiguration model={model} />{model.error ? <p role="alert" className="text-caos-xs text-caos-critical">{model.error}</p> : null}<MarketImportPreview model={model} /><MarketImportStatus committed={model.committed} /></div>;
}

export function MarketWorkbookImport({ onCommitted }: { onCommitted?: (value: MarketImportCommit) => void }) {
  const model = useMarketWorkbookImport(onCommitted);

  return (
    <section className="rounded-md border border-caos-border bg-caos-bg/30" aria-label="Market workbook import">
      <button type="button" onClick={() => model.setOpen((value) => !value)} aria-expanded={model.open} className="focus-ring flex w-full items-center justify-between px-3 py-2 text-left">
        <span className="tabular text-caos-2xs font-semibold uppercase tracking-wider text-caos-text">Import price feed</span>
        <span className="text-caos-muted" aria-hidden="true">{model.open ? "−" : "+"}</span>
      </button>
      <MarketImportBody model={model} />
    </section>
  );
}
