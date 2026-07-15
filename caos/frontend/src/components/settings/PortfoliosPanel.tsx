"use client";

// Settings → Portfolios: manage the desk's CLO books. List portfolios, create one
// by dropping a holdings xlsx (+ optional constraints / mandate CSVs), and drag a
// fresh holdings file onto a selected book to update its positions. Exposure and
// compliance are computed server-side (engine/portfolio.py) and shown inline.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useDropzone } from "react-dropzone";
import { Panel } from "@/components/shared/Panel";
import { TextInput } from "@/components/shared/TextInput";
import { Dot } from "@/components/pipeline/atoms";
import {
  createPortfolio, getPortfolioDetail, getPortfolios, uploadPortfolioHoldings, toErrorMessage,
  type PortfolioSummary, type PortfolioDetail,
} from "@/lib/api";

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const usd = (n: unknown) =>
  typeof n === "number" ? "$" + Math.round(n).toLocaleString() : "—";

export function PortfoliosPanel() {
  const [list, setList] = useState<PortfolioSummary[]>([]);
  const [selected, setSelected] = useState<PortfolioDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const holdingsRef = useRef<File | null>(null);
  const constraintsRef = useRef<HTMLInputElement>(null);
  const mandateRef = useRef<HTMLInputElement>(null);
  const [holdingsName, setHoldingsName] = useState("");

  const refresh = useCallback(async () => {
    try {
      setList(await getPortfolios());
    } catch (e) {
      setError(toErrorMessage(e, "Couldn't load portfolios."));
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const onDropCreate = useCallback((accepted: File[]) => {
    if (accepted[0]) { holdingsRef.current = accepted[0]; setHoldingsName(accepted[0].name); }
  }, []);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: onDropCreate, accept: { [XLSX]: [".xlsx"] }, multiple: false,
  });

  const create = async () => {
    if (!name.trim() || !holdingsRef.current || busy) return;
    setBusy(true); setError(null);
    try {
      const fd = new FormData();
      fd.append("name", name.trim());
      fd.append("holdings", holdingsRef.current);
      if (constraintsRef.current?.files?.[0]) fd.append("constraints", constraintsRef.current.files[0]);
      if (mandateRef.current?.files?.[0]) fd.append("mandate", mandateRef.current.files[0]);
      const created = await createPortfolio(fd);
      setName(""); holdingsRef.current = null; setHoldingsName("");
      if (constraintsRef.current) constraintsRef.current.value = "";
      if (mandateRef.current) mandateRef.current.value = "";
      await refresh();
      setSelected(await getPortfolioDetail(created.id));
    } catch (e) {
      setError(toErrorMessage(e, "Couldn't create the portfolio. Check the holdings file has a Holdings column."));
    } finally { setBusy(false); }
  };

  const open = async (id: string) => {
    setError(null);
    try { setSelected(await getPortfolioDetail(id)); }
    catch (e) { setError(toErrorMessage(e, "Couldn't load that portfolio.")); }
  };

  return (
    <div id="settings-panel-portfolios" role="tabpanel" aria-labelledby="settings-tab-portfolios" className="flex flex-col gap-2">
      {error ? (
        <div role="alert" className="rounded border px-3 py-2 tabular text-caos-md"
          style={{ borderColor: "color-mix(in srgb, var(--caos-critical) 50%, transparent)", background: "color-mix(in srgb, var(--caos-critical) 7%, transparent)", color: "var(--caos-critical-bright)" }}>
          {error}
        </div>
      ) : null}

      <Panel title="Portfolios · managed CLO books" right={<span className="tabular text-caos-xs text-caos-muted">{list.length} book{list.length === 1 ? "" : "s"}</span>}>
        <div className="text-caos-xl">
          {list.length === 0 ? (
            <div className="px-3 py-4 text-caos-muted text-caos-md">No portfolios yet — create one below by dropping a holdings file.</div>
          ) : list.map((p) => (
            <button key={p.id} onClick={() => open(p.id)}
              className={"w-full grid grid-cols-[1fr_92px_92px_120px] items-center gap-x-3 px-3 py-[7px] border-b border-caos-border/50 text-left transition-caos hover:bg-caos-elevated/60 " + (selected?.id === p.id ? "bg-caos-elevated" : "")}>
              <span className="text-caos-text truncate">{p.name}<span className="text-caos-muted"> · {p.kind}</span></span>
              <span className="tabular text-caos-xs text-caos-muted text-right">{p.n_positions} pos</span>
              <span className="tabular text-caos-xs text-caos-muted text-right">{usd(p.total_nav)}</span>
              <span className="tabular text-caos-xs text-right flex items-center justify-end gap-2">
                {p.breaches ? <span className="flex items-center gap-1" style={{ color: "var(--caos-critical)" }}><Dot sev="critical" />{p.breaches} breach</span>
                  : p.watches ? <span className="flex items-center gap-1" style={{ color: "var(--caos-warning)" }}><Dot sev="warning" />{p.watches} watch</span>
                  : <span className="flex items-center gap-1" style={{ color: "var(--caos-success)" }}><Dot sev="ok" />compliant</span>}
              </span>
            </button>
          ))}
        </div>
      </Panel>

      {/* Create */}
      <Panel title="New portfolio">
        <div className="p-3 flex flex-col gap-2.5">
          <div>
            <label className="block tabular text-caos-2xs uppercase tracking-wider text-caos-muted mb-1">Name · required</label>
            <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Test CLO I Ltd" aria-label="Portfolio name" maxLength={255} className="w-full px-2.5 py-1.5 text-caos-lg" />
          </div>
          <div {...getRootProps()} className="rounded border border-dashed px-4 py-5 text-center cursor-pointer transition-caos"
            style={{ borderColor: isDragActive ? "var(--caos-accent)" : holdingsName ? "color-mix(in srgb, var(--caos-success) 50%, transparent)" : "var(--caos-border)", background: holdingsName ? "color-mix(in srgb, var(--caos-success) 4%, transparent)" : "var(--caos-bg)" }}>
            <input {...getInputProps()} aria-label="Holdings file (xlsx)" />
            <div className="text-caos-lg text-caos-text/85">{holdingsName || "Drop the holdings file (.xlsx), or click to browse"}</div>
            <div className="tabular text-caos-xs text-caos-muted mt-1">Positions = rows with a Holdings par column · required</div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">Constraints CSV · optional
              <input ref={constraintsRef} type="file" accept=".csv" className="block mt-1 text-caos-xs text-caos-muted" />
            </label>
            <label className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">Mandate CSV · optional
              <input ref={mandateRef} type="file" accept=".csv" className="block mt-1 text-caos-xs text-caos-muted" />
            </label>
          </div>
          <button onClick={create} disabled={!name.trim() || !holdingsName || busy}
            className="h-8 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos tabular text-caos-md disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            {busy ? <><Dot sev="running" pulse /> CREATING…</> : "CREATE PORTFOLIO"}
          </button>
        </div>
      </Panel>

      {selected ? <PortfolioPosture detail={selected} onUpdated={async (d) => { setSelected(d); await refresh(); }} onError={setError} /> : null}
    </div>
  );
}

// Settings owns configuration/import. Operational posture lives in Portfolio Lab.
function PortfolioPosture({ detail, onUpdated, onError }: {
  detail: PortfolioDetail;
  onUpdated: (d: PortfolioDetail) => void;
  onError: (m: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const ex = detail.exposure as Record<string, unknown>;
  const breaches = detail.compliance.filter((row) => row.status === "Breach").length;
  const watches = detail.compliance.filter((row) => row.status === "Watch").length;
  const mandateRows = Object.entries(detail.mandate ?? {}).slice(0, 6);

  const onDrop = useCallback(async (accepted: File[]) => {
    if (!accepted[0] || busy) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("holdings", accepted[0]);
      await uploadPortfolioHoldings(detail.id, fd);
      onUpdated(await getPortfolioDetail(detail.id));
    } catch (e) {
      onError(toErrorMessage(e, "Couldn't update holdings."));
    } finally { setBusy(false); }
  }, [detail.id, busy, onUpdated, onError]);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { [XLSX]: [".xlsx"] }, multiple: false,
  });

  return (
    <Panel title={`Configuration · ${detail.name}`} right={<span className="tabular text-caos-xs text-caos-muted">imports & mandate</span>}>
      <div className="p-3 flex flex-col gap-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" aria-label="Portfolio configuration summary">
          {[["Positions", String(ex.n_positions ?? "—")], ["Reported NAV", usd(ex.total_nav)],
            ["Constraints", String(detail.compliance.length)], ["Exceptions", `${breaches} breach · ${watches} watch`]].map(([l, v]) => (
            <div key={l} className="rounded border border-caos-border px-2 py-1.5">
              <div className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">{l}</div>
              <div className="tabular text-caos-lg text-caos-text">{v}</div>
            </div>
          ))}
        </div>
        {mandateRows.length ? <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2" aria-label="Mandate configuration">
          {mandateRows.map(([key, value]) => <div key={key} className="rounded border border-caos-border px-2 py-1.5"><dt className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">{key.replaceAll("_", " ")}</dt><dd className="m-0 mt-1 tabular text-caos-md text-caos-text truncate">{String(value)}</dd></div>)}
        </dl> : <p className="m-0 text-caos-md text-caos-muted">No mandate metadata was imported.</p>}

        <Link href={`/portfolios?portfolio=${encodeURIComponent(detail.id)}`} className="h-8 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos tabular text-caos-md flex items-center justify-center">
          OPEN OPERATIONAL POSTURE IN PORTFOLIO LAB
        </Link>

        {/* update holdings */}
        <div {...getRootProps()} className="rounded border border-dashed px-4 py-4 text-center cursor-pointer transition-caos"
          style={{ borderColor: isDragActive ? "var(--caos-accent)" : "var(--caos-border)", background: "var(--caos-bg)" }}>
          <input {...getInputProps()} aria-label="Update holdings file (xlsx)" />
          <div className="tabular text-caos-md text-caos-muted">{busy ? "Updating positions…" : "Drop a new holdings file to update positions"}</div>
        </div>
      </div>
    </Panel>
  );
}
