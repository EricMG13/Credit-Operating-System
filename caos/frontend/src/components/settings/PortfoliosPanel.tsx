"use client";

// Settings → Portfolios: manage the desk's CLO books. List portfolios, create one
// by dropping a holdings xlsx (+ optional constraints / mandate CSVs), and drag a
// fresh holdings file onto a selected book to update its positions. Exposure and
// compliance are computed server-side (engine/portfolio.py) and shown inline.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useDropzone } from "react-dropzone";
import { ActionReason } from "@/components/shared/ActionReason";
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

function PortfolioError({ message }: { message: string | null }) {
  if (!message) return null;
  return <div role="alert" className="rounded border px-3 py-2 tabular text-caos-md" style={{ borderColor: "color-mix(in srgb, var(--caos-critical) 50%, transparent)", background: "color-mix(in srgb, var(--caos-critical) 7%, transparent)", color: "var(--caos-critical-bright)" }}>{message}</div>;
}

function PortfolioCompliance({ portfolio }: { portfolio: PortfolioSummary }) {
  if (portfolio.breaches) return <span className="flex items-center gap-1" style={{ color: "var(--caos-critical)" }}><Dot sev="critical" />{portfolio.breaches} breach</span>;
  if (portfolio.watches) return <span className="flex items-center gap-1" style={{ color: "var(--caos-warning)" }}><Dot sev="warning" />{portfolio.watches} watch</span>;
  return <span className="flex items-center gap-1" style={{ color: "var(--caos-success)" }}><Dot sev="ok" />compliant</span>;
}

function PortfolioList({ list, selectedId, onOpen }: { list: PortfolioSummary[]; selectedId?: string; onOpen: (id: string) => void }) {
  if (!list.length) return <div className="px-3 py-4 text-caos-muted text-caos-md">No portfolios yet — create one below by dropping a holdings file.</div>;
  return <>{list.map((portfolio) => (
    <button key={portfolio.id} onClick={() => onOpen(portfolio.id)} className={"w-full grid grid-cols-[1fr_92px_92px_120px] items-center gap-x-3 px-3 py-[7px] border-b border-caos-border/50 text-left transition-caos hover:bg-caos-elevated/60 " + (selectedId === portfolio.id ? "bg-caos-elevated" : "")}>
      <span className="text-caos-text truncate">{portfolio.name}<span className="text-caos-muted"> · {portfolio.kind}</span></span>
      <span className="tabular text-caos-xs text-caos-muted text-right">{portfolio.n_positions} pos</span>
      <span className="tabular text-caos-xs text-caos-muted text-right">{usd(portfolio.total_nav)}</span>
      <span className="tabular text-caos-xs text-right flex items-center justify-end gap-2"><PortfolioCompliance portfolio={portfolio} /></span>
    </button>
  ))}</>;
}

function PortfolioListPanel({ list, selectedId, onOpen }: { list: PortfolioSummary[]; selectedId?: string; onOpen: (id: string) => void }) {
  const countLabel = `${list.length} book${list.length === 1 ? "" : "s"}`;
  return <Panel title="Portfolios · managed CLO books" right={<span className="tabular text-caos-xs text-caos-muted">{countLabel}</span>}><div className="text-caos-xl"><PortfolioList list={list} selectedId={selectedId} onOpen={onOpen} /></div></Panel>;
}

const newPortfolioReason = (busy: boolean, name: string, holdingsName: string): string | null => {
  if (busy) return "Creating…";
  if (!name.trim()) return "Enter a portfolio name first";
  return holdingsName ? null : "Attach a holdings file first";
};

const holdingsDropStyle = (dragging: boolean, holdingsName: string) => ({
  borderColor: dragging
    ? "var(--caos-accent)"
    : holdingsName
      ? "color-mix(in srgb, var(--caos-success) 50%, transparent)"
      : "var(--caos-border)",
  background: holdingsName
    ? "color-mix(in srgb, var(--caos-success) 4%, transparent)"
    : "var(--caos-bg)",
});

function PortfolioCreateLabel({ busy }: { busy: boolean }) {
  return busy ? <><Dot sev="running" pulse /> CREATING…</> : <>CREATE PORTFOLIO</>;
}

function NewPortfolioPanel({ name, holdingsName, busy, constraintsRef, mandateRef, dropzone, onNameChange, onCreate }: {
  name: string;
  holdingsName: string;
  busy: boolean;
  constraintsRef: React.RefObject<HTMLInputElement>;
  mandateRef: React.RefObject<HTMLInputElement>;
  dropzone: Pick<ReturnType<typeof useDropzone>, "getRootProps" | "getInputProps" | "isDragActive">;
  onNameChange: (name: string) => void;
  onCreate: () => Promise<void>;
}) {
  const reason = newPortfolioReason(busy, name, holdingsName);
  return (
    <Panel title="New portfolio">
      <div className="p-3 flex flex-col gap-2.5">
        <div><label className="block tabular text-caos-2xs uppercase tracking-wider text-caos-muted mb-1">Name · required</label><TextInput name="portfolio-name" autoComplete="off" value={name} onChange={(event) => onNameChange(event.target.value)} placeholder="e.g. Test CLO I Ltd…" aria-label="Portfolio name" maxLength={255} className="w-full px-2.5 py-1.5 text-caos-lg" /></div>
        <div {...dropzone.getRootProps()} className="rounded border border-dashed px-4 py-5 text-center cursor-pointer transition-caos" style={holdingsDropStyle(dropzone.isDragActive, holdingsName)}>
          <input {...dropzone.getInputProps()} aria-label="Holdings file (xlsx)" />
          <div className="text-caos-lg text-caos-text/85">{holdingsName || "Drop the holdings file (.xlsx), or click to browse"}</div>
          <div className="tabular text-caos-xs text-caos-muted mt-1">Positions = rows with a Holdings par column · required</div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">Constraints CSV · optional<input ref={constraintsRef} type="file" name="portfolio-constraints" autoComplete="off" accept=".csv" className="block mt-1 text-caos-xs text-caos-muted" /></label>
          <label className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">Mandate CSV · optional<input ref={mandateRef} type="file" name="portfolio-mandate" autoComplete="off" accept=".csv" className="block mt-1 text-caos-xs text-caos-muted" /></label>
        </div>
        <ActionReason onClick={onCreate} reason={reason} className="h-8 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos tabular text-caos-md aria-disabled:opacity-40 aria-disabled:cursor-not-allowed flex items-center justify-center gap-2"><PortfolioCreateLabel busy={busy} /></ActionReason>
      </div>
    </Panel>
  );
}

function PortfolioConfigurationSummary({ detail }: { detail: PortfolioDetail }) {
  const exposure = detail.exposure as Record<string, unknown>;
  const breaches = detail.compliance.filter((row) => row.status === "Breach").length;
  const watches = detail.compliance.filter((row) => row.status === "Watch").length;
  const rows = [
    ["Positions", String(exposure.n_positions ?? "—")],
    ["Reported NAV", usd(exposure.total_nav)],
    ["Constraints", String(detail.compliance.length)],
    ["Exceptions", `${breaches} breach · ${watches} watch`],
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" aria-label="Portfolio configuration summary">
      {rows.map(([label, value]) => (
        <div key={label} className="rounded border border-caos-border px-2 py-1.5">
          <div className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">{label}</div>
          <div className="tabular text-caos-lg text-caos-text">{value}</div>
        </div>
      ))}
    </div>
  );
}

function MandateConfiguration({ mandate }: { mandate: PortfolioDetail["mandate"] }) {
  const rows = Object.entries(mandate ?? {}).slice(0, 6);
  if (!rows.length) return <p className="m-0 text-caos-md text-caos-muted">No mandate metadata was imported.</p>;
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2" aria-label="Mandate configuration">
      {rows.map(([key, value]) => (
        <div key={key} className="rounded border border-caos-border px-2 py-1.5">
          <dt className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">{key.replaceAll("_", " ")}</dt>
          <dd className="m-0 mt-1 tabular text-caos-md text-caos-text truncate">{String(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function StagedHoldingsReplacement({
  detail,
  pendingHoldings,
  busy,
  onConfirm,
  onCancel,
}: {
  detail: PortfolioDetail;
  pendingHoldings: File | null;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!pendingHoldings) return null;
  const exposure = detail.exposure as Record<string, unknown>;
  return (
    <div className="rounded border border-caos-warning/50 bg-caos-warning/5 px-3 py-2.5 flex flex-col gap-2">
      <p className="m-0 text-caos-md text-caos-text">
        Replace positions in <span className="font-semibold">{detail.name}</span> with <span className="tabular">{pendingHoldings.name}</span>. This replaces the current {String(exposure.n_positions ?? "unknown")} positions.
      </p>
      <div className="flex gap-2">
        <ActionReason onClick={onConfirm} reason={busy ? "Replacing positions…" : null} className="caos-action-primary focus-ring">
          {busy ? "REPLACING…" : "CONFIRM REPLACE POSITIONS"}
        </ActionReason>
        <button type="button" onClick={onCancel} disabled={busy} className="caos-action-secondary focus-ring disabled:opacity-40">
          Cancel
        </button>
      </div>
    </div>
  );
}

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
      <PortfolioError message={error} />
      <PortfolioListPanel list={list} selectedId={selected?.id} onOpen={open} />
      <NewPortfolioPanel name={name} holdingsName={holdingsName} busy={busy} constraintsRef={constraintsRef} mandateRef={mandateRef} dropzone={{ getRootProps, getInputProps, isDragActive }} onNameChange={setName} onCreate={create} />
      {selected ? <PortfolioPosture key={selected.id} detail={selected} onUpdated={async (d) => { setSelected(d); await refresh(); }} onError={setError} /> : null}
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
  // Dropping a file stages a replacement only. The explicit second action names
  // the exact book and file before its current positions are overwritten.
  const [pendingHoldings, setPendingHoldings] = useState<File | null>(null);

  const onDrop = useCallback((accepted: File[]) => {
    if (!accepted[0] || busy) return;
    setPendingHoldings(accepted[0]);
  }, [busy]);

  const confirmHoldingsReplacement = async () => {
    if (!pendingHoldings || busy) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("holdings", pendingHoldings);
      await uploadPortfolioHoldings(detail.id, fd);
      onUpdated(await getPortfolioDetail(detail.id));
      setPendingHoldings(null);
    } catch (e) {
      onError(toErrorMessage(e, "Couldn't update holdings."));
    } finally { setBusy(false); }
  };
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { [XLSX]: [".xlsx"] }, multiple: false,
  });

  return (
    <Panel title={`Configuration · ${detail.name}`} right={<span className="tabular text-caos-xs text-caos-muted">imports & mandate</span>}>
      <div className="p-3 flex flex-col gap-3">
        <PortfolioConfigurationSummary detail={detail} />
        <MandateConfiguration mandate={detail.mandate} />

        <Link href={`/portfolios?portfolio=${encodeURIComponent(detail.id)}`} className="h-8 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos tabular text-caos-md flex items-center justify-center">
          OPEN OPERATIONAL POSTURE IN PORTFOLIO LAB
        </Link>

        {/* update holdings — stage, review the exact replacement, then commit */}
        <div {...getRootProps()} className="rounded border border-dashed px-4 py-4 text-center cursor-pointer transition-caos"
          style={{ borderColor: isDragActive ? "var(--caos-accent)" : "var(--caos-border)", background: "var(--caos-bg)" }}>
          <input {...getInputProps()} aria-label="Update holdings file (xlsx)" />
          <div className="tabular text-caos-md text-caos-muted">{busy ? "Updating positions…" : pendingHoldings ? `${pendingHoldings.name} staged for review` : "Drop a new holdings file to stage a replacement"}</div>
        </div>
        <StagedHoldingsReplacement detail={detail} pendingHoldings={pendingHoldings} busy={busy} onConfirm={confirmHoldingsReplacement} onCancel={() => setPendingHoldings(null)} />
      </div>
    </Panel>
  );
}
