"use client";

// Settings → Portfolios: manage the desk's CLO books. List portfolios, create one
// by dropping a holdings xlsx (+ optional constraints / mandate CSVs), and drag a
// fresh holdings file onto a selected book to update its positions. Exposure and
// compliance are computed server-side (engine/portfolio.py) and shown inline.

import { useCallback, useEffect, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Panel } from "@/components/shared/Panel";
import { TextInput } from "@/components/shared/TextInput";
import { Dot } from "@/components/pipeline/atoms";
import {
  createPortfolio, getPortfolioDetail, getPortfolios, uploadPortfolioHoldings, toErrorMessage,
  type PortfolioSummary, type PortfolioDetail,
} from "@/lib/api";

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

// Compliance status → the semantic color it must never be carried by alone (paired
// with the text label in the cell).
const STATUS_COLOR: Record<string, string> = {
  Pass: "var(--caos-success)",
  Watch: "var(--caos-warning)",
  Breach: "var(--caos-critical)",
  Info: "var(--caos-muted)",
};

const usd = (n: unknown) =>
  typeof n === "number" ? "$" + Math.round(n).toLocaleString() : "—";
const pct = (n: unknown) => (typeof n === "number" ? n.toFixed(2) + "%" : "—");

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
    onDrop: onDropCreate, accept: { [XLSX]: [".xlsx"], "application/vnd.ms-excel": [".xls"] }, multiple: false,
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

// The computed posture for one book: exposure summary + sector concentration +
// compliance monitor, and a drag-drop to replace positions from a new holdings file.
function PortfolioPosture({ detail, onUpdated, onError }: {
  detail: PortfolioDetail;
  onUpdated: (d: PortfolioDetail) => void;
  onError: (m: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const ex = detail.exposure as Record<string, unknown>;
  const sectors = (ex.sectors as Array<Record<string, unknown>> | undefined) ?? [];
  const ratings = (ex.rating_dist as Array<Record<string, unknown>> | undefined) ?? [];
  const single = ex.single_name_max as Record<string, unknown> | null;

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
    onDrop, accept: { [XLSX]: [".xlsx"], "application/vnd.ms-excel": [".xls"] }, multiple: false,
  });

  return (
    <Panel title={`Posture · ${detail.name}`} right={<span className="tabular text-caos-xs text-caos-muted">computed from holdings</span>}>
      <div className="p-3 flex flex-col gap-3">
        {/* summary strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[["NAV", usd(ex.total_nav)], ["Par", usd(ex.total_par)], ["Positions", String(ex.n_positions ?? "—")],
            ["Obligors", String(ex.n_obligors ?? "—")], ["WA rating", String(ex.wa_rating ?? "—")],
            ["WA margin", typeof ex.wa_margin === "number" ? Math.round(ex.wa_margin as number) + "bps" : "—"],
            ["1st lien", pct(ex.first_lien_pct)], ["Single name", single ? pct(single.pct_nav) : "—"]].map(([l, v]) => (
            <div key={l} className="rounded border border-caos-border px-2 py-1.5">
              <div className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">{l}</div>
              <div className="tabular text-caos-lg text-caos-text">{v}</div>
            </div>
          ))}
        </div>

        {/* rating distribution */}
        {ratings.length ? (
          <div className="flex flex-wrap gap-1.5">
            {ratings.map((r) => (
              <span key={String(r.bucket)} className="tabular text-caos-xs px-1.5 py-0.5 rounded border border-caos-border text-caos-muted">
                {String(r.bucket)} <span className="text-caos-text">{pct(r.pct_nav)}</span>
              </span>
            ))}
          </div>
        ) : null}

        {/* top sectors */}
        {sectors.length ? (
          <div>
            <div className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted mb-1">Top sectors (%NAV)</div>
            <div className="rounded border border-caos-border overflow-hidden">
              {sectors.slice(0, 8).map((s) => {
                const p = typeof s.pct_nav === "number" ? (s.pct_nav as number) : 0;
                const over = p > 10;
                return (
                  <div key={String(s.sector)} className="grid grid-cols-[1fr_180px_56px] items-center gap-x-2 px-3 py-[5px] border-b border-caos-border/50 last:border-b-0">
                    <span className="text-caos-md text-caos-text truncate">{String(s.sector)}</span>
                    <span className="h-2 rounded-sm" style={{ width: `${Math.min(100, p * 6)}%`, background: over ? "var(--caos-critical)" : "var(--caos-accent)" }} />
                    <span className="tabular text-caos-xs text-right" style={{ color: over ? "var(--caos-critical)" : "var(--caos-muted)" }}>{pct(p)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* compliance monitor */}
        {detail.compliance.length ? (
          <div>
            <div className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted mb-1">Constraint compliance</div>
            <div className="rounded border border-caos-border overflow-hidden">
              <div className="grid grid-cols-[1fr_96px_72px_72px_84px] gap-x-2 px-3 h-6 items-center border-b border-caos-border bg-caos-panel tabular text-caos-2xs uppercase tracking-wider text-caos-muted">
                <span>Parameter</span><span>Limit</span><span className="text-right">Current</span><span className="text-right">Headroom</span><span className="text-right">Status</span>
              </div>
              {detail.compliance.map((c, i) => (
                <div key={String(c.code ?? i)} className="grid grid-cols-[1fr_96px_72px_72px_84px] gap-x-2 px-3 py-[5px] items-center border-b border-caos-border/50 last:border-b-0">
                  <span className="text-caos-md text-caos-text truncate" title={String(c.parameter ?? "")}>{String(c.parameter ?? "—")}</span>
                  <span className="tabular text-caos-xs text-caos-muted truncate">{String(c.limit_text ?? "—")}</span>
                  <span className="tabular text-caos-xs text-right text-caos-text">{typeof c.current === "number" ? c.current : "—"}</span>
                  <span className="tabular text-caos-xs text-right text-caos-muted">{typeof c.headroom === "number" ? c.headroom : "—"}</span>
                  <span className="tabular text-caos-xs text-right font-medium" style={{ color: STATUS_COLOR[String(c.status)] ?? "var(--caos-muted)" }}>{String(c.status ?? "—")}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

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
