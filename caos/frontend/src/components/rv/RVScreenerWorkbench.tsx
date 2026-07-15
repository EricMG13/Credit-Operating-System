"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnalysisStateBadge, AuthorityLine, FindingsTray } from "@/components/shared/AnalysisWorkbench";
import { ConceptNav } from "@/components/shared/ConceptNav";
import { DecisionHeader } from "@/components/shared/DecisionHeader";
import { DominantTableRegion } from "@/components/shared/DominantTableRegion";
import { EnterprisePage } from "@/components/shared/EnterprisePage";
import { PersonaWorkbench } from "@/components/shared/PersonaWorkbench";
import { SemanticVisualization, type VisualizationSpec } from "@/components/charts/SemanticVisualization";
import { MarketWorkbookImport } from "@/components/rv/MarketWorkbookImport";
import { useRoleView } from "@/components/shared/RoleViewProvider";
import { headStat } from "@/components/shared/headStat";
import { toErrorMessage } from "@/lib/api";
import {
  analysisApi,
  contextHref,
  useAnalysisContext,
  type AuthorityEnvelope,
  type RVCandidate,
  type RVScreenRun,
} from "@/lib/analysis-workbench";
import type { DecisionAuthority, DecisionContextState, DecisionDatumState } from "@/lib/decision-state";
import { useTypedUrlState } from "@/lib/typed-url-state";

type View = "table" | "distribution" | "compare";
const RV_URL_KEYS = ["view", "selected"] as const;
const ROW_HEIGHT = 46;
const WINDOW_ROWS = 22;

function display(value: unknown, suffix = "") {
  if (typeof value === "number" && Number.isFinite(value)) return `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })}${suffix}`;
  if (typeof value === "string" && value) return value;
  return "—";
}

function decisionAuthority(authority: AuthorityEnvelope): DecisionAuthority {
  return {
    provenance: {
      origin: authority.origin === "live" ? "LIVE" : authority.origin === "demo" ? "DEMO" : "REFERENCE",
      method: "DERIVED",
      freshness: authority.freshness === "current" ? "CURRENT" : authority.freshness === "stale" ? "STALE" : "UNKNOWN",
      detail: authority.method,
    },
    approval: authority.approval_state === "ratified" ? "RATIFIED" : "DRAFT",
  };
}

function rvDatum(screen: RVScreenRun | null, value: React.ReactNode): DecisionDatumState {
  if (!screen) return { kind: "unavailable", message: "Run the gated screen to establish this observation." };
  if (screen.status === "error") return { kind: "error", message: "RV screen failed." };
  if (screen.status === "stale") return { kind: "stale", value, asOf: screen.authority.as_of ?? screen.updated_at, authority: decisionAuthority(screen.authority) };
  if (screen.status === "observed-empty") return { kind: "observed-empty", message: "Successful screen returned no instruments.", asOf: screen.authority.as_of ?? screen.updated_at, authority: decisionAuthority(screen.authority) };
  return { kind: "ready", value, asOf: screen.authority.as_of ?? screen.updated_at, authority: decisionAuthority(screen.authority) };
}

function PitchBlock({ title, value }: { title: string; value: unknown }) {
  const data = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return (
    <section className="rounded-md border border-caos-border bg-caos-bg/30 p-3">
      <h3 className="tabular text-caos-2xs font-semibold uppercase tracking-widest text-caos-muted">{title}</h3>
      <dl className="mt-2 space-y-1">{Object.entries(data).map(([key, item]) => <div key={key} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 text-caos-xs"><dt className="text-caos-muted">{key.replaceAll("_", " ")}</dt><dd className="tabular text-right text-caos-text">{item && typeof item === "object" ? JSON.stringify(item) : display(item)}</dd></div>)}</dl>
    </section>
  );
}

function VirtualCandidateGrid({
  candidates,
  selectedId,
  compareIds,
  onSelect,
  onCompare,
}: {
  candidates: RVCandidate[];
  selectedId: string | null;
  compareIds: Set<string>;
  onSelect: (candidate: RVCandidate) => void;
  onCompare: (candidate: RVCandidate) => void;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const [start, setStart] = useState(0);
  const end = Math.min(candidates.length, start + WINDOW_ROWS);
  const visible = candidates.slice(start, end);
  return (
    <div className="min-h-0 flex-1 overflow-hidden rounded-md border border-caos-border bg-caos-panel flex flex-col" role="grid" aria-label="Ranked RV candidates" aria-rowcount={candidates.length + 1}>
      <div role="row" className="grid h-9 grid-cols-[40px_minmax(170px,1.5fr)_100px_90px_90px_100px_110px] items-center border-b border-caos-border bg-caos-panel px-2 tabular text-caos-2xs uppercase tracking-wider text-caos-muted">
        <span role="columnheader">#</span><span role="columnheader">Instrument</span><span role="columnheader">Class</span><span role="columnheader">DM</span><span role="columnheader">Pickup</span><span role="columnheader">Bid / Ask</span><span role="columnheader">Compare</span>
      </div>
      <div ref={viewport} className="relative min-h-0 flex-1 overflow-auto" onScroll={(event) => setStart(Math.max(0, Math.floor(event.currentTarget.scrollTop / ROW_HEIGHT) - 4))}>
        <div style={{ height: candidates.length * ROW_HEIGHT, position: "relative" }}>
          {visible.map((candidate, offset) => {
            const index = start + offset;
            const pickup = (candidate.pitch.market_relative_value as Record<string, unknown> | undefined)?.dm_pickup_bps;
            return (
              <div key={candidate.id} role="row" aria-rowindex={index + 2} style={{ position: "absolute", top: index * ROW_HEIGHT, height: ROW_HEIGHT, left: 0, right: 0 }} className={`grid grid-cols-[40px_minmax(170px,1.5fr)_100px_90px_90px_100px_110px] items-center border-b border-caos-border/70 px-2 tabular text-caos-xs ${selectedId === candidate.id ? "bg-caos-info-surface" : "hover:bg-caos-elevated/30"}`}>
                <button type="button" className="contents focus-ring" onClick={() => onSelect(candidate)} onKeyDown={(event) => { if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); const next = Math.max(0, Math.min(candidates.length - 1, index + (event.key === "ArrowDown" ? 1 : -1))); viewport.current?.scrollTo({ top: next * ROW_HEIGHT }); onSelect(candidates[next]); } }}>
                  <span role="gridcell" className="text-caos-accent">{candidate.rank}</span>
                  <span role="gridcell" className="min-w-0"><span className="block truncate font-semibold text-caos-text">{candidate.borrower}</span><span className="block truncate text-caos-2xs text-caos-muted">{display(candidate.market.ranking)} · {candidate.figi ?? "identity unavailable"}</span></span>
                  <span role="gridcell" className={candidate.classification === "actionable" ? "text-caos-success" : candidate.classification === "unavailable" ? "text-caos-critical" : "text-caos-warning"}>{candidate.classification}</span>
                  <span role="gridcell" className="text-caos-text">{display(candidate.market.dm, "bp")}</span>
                  <span role="gridcell" className="text-caos-text">{display(pickup, "bp")}</span>
                  <span role="gridcell" className="text-caos-muted">{display(candidate.market.bid)} / {display(candidate.market.ask)}</span>
                </button>
                <span role="gridcell"><button type="button" aria-pressed={compareIds.has(candidate.id)} onClick={() => onCompare(candidate)} disabled={!compareIds.has(candidate.id) && compareIds.size >= 5} className="caos-action-secondary focus-ring disabled:opacity-40">{compareIds.has(candidate.id) ? "Remove" : "Compare"}</button></span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function RVScreenerWorkbench() {
  const { roleView } = useRoleView();
  const contextState = useAnalysisContext({ name: "Telecom RV screen", sector_id: "telecom" });
  const { values: urlState, update: updateUrlState } = useTypedUrlState(RV_URL_KEYS);
  const [screen, setScreen] = useState<RVScreenRun | null>(null);
  const [selected, setSelected] = useState<RVCandidate | null>(null);
  const view: View = urlState.view === "distribution" || urlState.view === "compare" ? urlState.view : "table";
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [findingsKey, setFindingsKey] = useState(0);

  useEffect(() => {
    if (!contextState.context?.rv_run_id) return;
    analysisApi.getRVScreen(contextState.context.rv_run_id).then((value) => {
      setScreen(value); setSelected(value.candidates.find((candidate) => candidate.id === urlState.selected) ?? value.candidates[0] ?? null);
    }).catch(() => setScreen(null));
  }, [contextState.context, urlState.selected]);

  const runScreen = async (snapshotId?: string) => {
    if (!contextState.context || busy) return;
    setBusy(true); setError(null);
    try {
      const next = await analysisApi.createRVScreen({ context_id: contextState.context.id, snapshot_id: snapshotId, filters: contextState.context.sector_id ? { sector_id: contextState.context.sector_id } : {} });
      setScreen(next); setSelected(next.candidates[0] ?? null);
      updateUrlState({ selected: next.candidates[0]?.id ?? null }, "replace");
      contextState.setContext({ ...contextState.context, rv_run_id: next.id, rv_snapshot_id: next.snapshot_id });
    } catch (reason) { setError(toErrorMessage(reason, "RV screen failed.")); }
    finally { setBusy(false); }
  };

  const reviewTop = () => {
    if (!screen) { void runScreen(); return; }
    const top = screen.candidates.find((candidate) => candidate.classification === "actionable") ?? screen.candidates.find((candidate) => candidate.classification === "screen-only") ?? screen.candidates[0];
    if (top) { setSelected(top); updateUrlState({ selected: top.id, view: null }, "replace"); }
  };

  const toggleCompare = (candidate: RVCandidate) => {
    setCompareIds((current) => { const next = new Set(current); if (next.has(candidate.id)) next.delete(candidate.id); else if (next.size < 5) next.add(candidate.id); return next; });
  };

  const pinPitch = async (kind: "rv-pitch" | "monitor-threshold") => {
    if (!contextState.context || !screen || !selected) return;
    setBusy(true);
    try {
      await analysisApi.createFinding({
        context_id: contextState.context.id,
        kind,
        title: `${selected.borrower} · ${selected.classification}`,
        body: selected.missing_gates.length ? `Decision gates missing: ${selected.missing_gates.join(", ")}.` : "All RV decision gates satisfied.",
        source_surface: "rv-screener",
        source_run_id: screen.id,
        evidence: selected.evidence,
      });
      setFindingsKey((value) => value + 1);
    } catch (reason) { setError(toErrorMessage(reason, "Finding could not be pinned.")); }
    finally { setBusy(false); }
  };

  const ratifyCandidate = async () => {
    if (!screen || !selected || selected.classification !== "actionable") return;
    setBusy(true);
    try {
      const next = await analysisApi.ratifyRVCandidate(screen.id, selected.id);
      setScreen(next);
      setSelected(next.candidates.find((candidate) => candidate.id === selected.id) ?? selected);
    } catch (reason) { setError(toErrorMessage(reason, "Candidate ratification failed.")); }
    finally { setBusy(false); }
  };

  const selectedPickup = selected ? (selected.pitch.market_relative_value as Record<string, unknown> | undefined)?.dm_pickup_bps : null;
  const roleLabel = roleView === "pm" ? "PM" : roleView === "qa" ? "QA" : "Analyst";
  const pitchOrder = roleView === "pm"
    ? [["3 · Portfolio implementation", "portfolio_implementation"], ["1 · Market relative value", "market_relative_value"], ["2 · Instrument mispricing", "instrument_mispricing"]] as const
    : [["1 · Market relative value", "market_relative_value"], ["2 · Instrument mispricing", "instrument_mispricing"], ["3 · Portfolio implementation", "portfolio_implementation"]] as const;
  const decisionState: DecisionContextState = {
    whatChanged: rvDatum(screen, selected ? `${selected.borrower} · ${display(selectedPickup, "bp")} vs cohort` : "No candidate selected"),
    whyItMatters: rvDatum(screen, selected ? `${selected.classification} · ${selected.missing_gates.length} missing gates` : "No instrument evidence"),
    requiredAction: rvDatum(screen, selected?.classification === "actionable" ? "Review sizing and ratify" : "Resolve missing gates before any recommendation"),
    evidenceHealth: rvDatum(screen, screen ? `${screen.snapshot_source_label ?? screen.authority.origin} · ${String(screen.snapshot_freshness?.state ?? screen.authority.freshness)}` : "Snapshot unavailable"),
  };
  const context = contextState.context;
  const compared = screen?.candidates.filter((candidate) => compareIds.has(candidate.id)) ?? [];
  const distribution = useMemo(() => screen ? ["actionable", "screen-only", "unavailable"].map((key) => ({ key, count: screen.counts[key] ?? 0 })) : [], [screen]);
  const distributionSpec: VisualizationSpec = {
    kind: "bar",
    title: "RV candidate classification",
    unit: "instruments",
    asOf: screen?.authority.as_of ?? undefined,
    sourceIds: screen?.authority.source_ids ?? ["rv-screen"],
    accessibleSummary: screen ? `${screen.candidates.length} instruments: ${distribution.map((item) => `${item.key} ${item.count}`).join(", ")}.` : "Run the screen to populate candidate classification.",
    status: (screen?.counts.actionable ?? 0) > 0 ? { label: "Actionable present", tone: "success" } : { label: "No actionable candidate", tone: "warning" },
    data: distribution,
    tabularFallback: { label: "RV classification counts", columns: [{ key: "key", label: "Classification" }, { key: "count", label: "Instruments" }], data: distribution },
    chart: { type: "interval", encode: { x: "key", y: "count" } },
  };

  return (
    <EnterprisePage
      kind="analytical"
      identity={<><ConceptNav compact /><span className="h-4 w-px bg-caos-border" /><span className="text-caos-sm font-semibold text-caos-text">RV Screener</span>{screen ? <span className="tabular text-caos-2xs text-caos-muted">{screen.snapshot_source_label ?? "Snapshot"} · {screen.snapshot_id.slice(0, 8)}</span> : null}</>}
      status={<span className="tabular text-caos-2xs uppercase text-caos-accent">View: {roleLabel} · composition only</span>}
      primaryAction={<button type="button" onClick={reviewTop} disabled={!context || busy} className="caos-primary-action focus-ring disabled:opacity-40">{busy ? "Running…" : screen ? "Review top candidate" : "Run screen"}</button>}
      contextualControls={<>{headStat("Universe", context?.sector_id ?? "All")}{headStat("Actionable", String(screen?.counts.actionable ?? 0), "var(--caos-success)")}{headStat("Screen only", String(screen?.counts["screen-only"] ?? 0), "var(--caos-warning)")}{headStat("Snapshot", screen?.snapshot_source_label ?? screen?.authority.origin ?? "—")}{headStat("Freshness", String(screen?.snapshot_freshness?.state ?? screen?.authority.freshness ?? "—"))}</>}
      utilityLabel="RV utilities"
      utilityControls={<div className="space-y-4 text-caos-xs"><MarketWorkbookImport onCommitted={(value) => { void runScreen(value.snapshot_id); }} /><section><h3 className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">Cohort construction</h3><p className="mt-2 leading-relaxed text-caos-text">Sector × rating cohort. Minimum n=4. Exact instruments remain separate even when the same issuer has multiple tranches.</p></section><section><h3 className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">Decision methodology</h3><ol className="mt-2 list-decimal space-y-1 pl-4 text-caos-muted"><li>Spread / YTW / DM pickup</li><li>Instrument, collateral and recovery</li><li>Portfolio yield and risk budget</li></ol></section><button type="button" onClick={() => contextState.patch({ filters: { ...(context?.filters ?? {}), rv: screen?.filters ?? {} } })} disabled={!screen} className="caos-action-secondary focus-ring disabled:opacity-40">Save current screen</button></div>}
      narrowContract={{ essentialControls: <span className="tabular text-caos-2xs uppercase text-caos-muted">{screen?.candidates.length ?? 0} instruments</span> }}
    >
      <main className="caos-persona-route rv-workbench min-h-0 flex-1 overflow-hidden p-2">
        <PersonaWorkbench
          surface="rv-screener"
          decision={<DecisionHeader state={decisionState} defaultOpen />}
          primary={<section className="min-h-0 h-full overflow-hidden flex flex-col p-3 border border-caos-border" aria-label="RV candidate workspace">
          <div className="mb-2 flex flex-wrap items-center gap-1" role="tablist" aria-label="RV views">{(["table", "distribution", "compare"] as const).map((value) => <button key={value} type="button" role="tab" aria-selected={view === value} onClick={() => updateUrlState({ view: value === "table" ? null : value })} disabled={value === "compare" && compareIds.size < 2} className={`caos-action-secondary focus-ring disabled:opacity-40 ${view === value ? "border-caos-accent text-caos-text" : ""}`}>{value}{value === "compare" ? ` (${compareIds.size})` : ""}</button>)}{screen ? <div className="ml-auto"><AuthorityLine authority={screen.authority} /></div> : null}</div>
          {error ? <div className="mb-2 rounded-sm border border-caos-critical/50 bg-caos-critical/5 p-2 text-caos-xs text-caos-critical" role="alert">{error}</div> : null}
          {!screen ? <div className="grid min-h-0 flex-1 place-items-center rounded-md border border-dashed border-caos-border p-6 text-center"><div><p className="tabular text-caos-xs uppercase tracking-widest text-caos-accent">Immutable snapshot required</p><p className="mt-2 max-w-lg text-caos-sm leading-relaxed text-caos-muted">Run the screen to normalize the reference pricing sheet. Reference observations can surface candidates but can never produce an actionable recommendation.</p></div></div> : null}
          {screen && view === "table" ? <DominantTableRegion ownerId="rv-candidates" label="Ranked RV candidates" className="min-h-0 flex-1"><VirtualCandidateGrid candidates={screen.candidates} selectedId={selected?.id ?? null} compareIds={compareIds} onSelect={(candidate) => { setSelected(candidate); updateUrlState({ selected: candidate.id }, "replace"); }} onCompare={toggleCompare} /></DominantTableRegion> : null}
          {screen && view === "distribution" ? <div className="min-h-0 flex-1 overflow-auto"><SemanticVisualization spec={distributionSpec} /></div> : null}
          {screen && view === "compare" ? <div className="min-h-0 flex-1 overflow-auto"><div className="grid gap-3 xl:grid-cols-2">{compared.map((candidate) => <article key={candidate.id} className="rounded-md border border-caos-border bg-caos-panel p-3"><div className="flex items-center gap-2"><h2 className="text-caos-sm font-semibold text-caos-text">{candidate.borrower}</h2><span className="ml-auto tabular text-caos-2xs uppercase text-caos-warning">{candidate.classification}</span></div><dl className="mt-3 grid grid-cols-2 gap-2 text-caos-xs"><div><dt className="text-caos-muted">DM</dt><dd className="tabular text-caos-text">{display(candidate.market.dm, "bp")}</dd></div><div><dt className="text-caos-muted">Pickup</dt><dd className="tabular text-caos-text">{display((candidate.pitch.market_relative_value as Record<string, unknown>).dm_pickup_bps, "bp")}</dd></div><div><dt className="text-caos-muted">Ranking</dt><dd className="text-caos-text">{display(candidate.market.ranking)}</dd></div><div><dt className="text-caos-muted">Maturity</dt><dd className="text-caos-text">{display(candidate.market.maturity)}</dd></div></dl><p className="mt-3 text-caos-xs text-caos-warning">{candidate.missing_gates.join(" · ") || "All gates satisfied"}</p></article>)}</div></div> : null}
        </section>}
          context={view === "distribution" ? null : <SemanticVisualization spec={distributionSpec} />}
          inspector={<aside className="min-h-0 overflow-auto border border-caos-border bg-caos-panel/50 p-3" aria-label="RV evidence inspector">
          <div className="flex items-center gap-2"><h2 className="tabular text-caos-xs font-semibold uppercase tracking-widest text-caos-text">Instrument inspector</h2>{selected ? <AnalysisStateBadge state={selected.classification === "actionable" ? "ready" : selected.classification === "unavailable" ? "error" : "partial"} /> : null}</div>
          {selected ? <><div className="mt-3"><h3 className="text-base font-semibold text-caos-text">{selected.borrower}</h3><p className="mt-1 tabular text-caos-xs text-caos-muted">{selected.figi ?? "No exact identity"} · {display(selected.market.ranking)} · {display(selected.market.maturity)}</p><p className={`mt-2 tabular text-caos-xs uppercase ${selected.classification === "actionable" ? "text-caos-success" : "text-caos-warning"}`}>{selected.recommendation} · {selected.classification}</p></div>{roleView === "qa" && selected.missing_gates.length ? <section className="mt-4 rounded-md border border-caos-warning/50 bg-caos-warning/5 p-3"><h3 className="tabular text-caos-2xs font-semibold uppercase tracking-widest text-caos-warning">QA gate review</h3><ul className="mt-2 space-y-1 text-caos-xs text-caos-text">{selected.missing_gates.map((gate) => <li key={gate}>△ {gate}</li>)}</ul></section> : null}<div className="mt-4 space-y-2">{pitchOrder.map(([title, key]) => <PitchBlock key={key} title={title} value={selected.pitch[key]} />)}</div>{roleView !== "qa" && selected.missing_gates.length ? <section className="mt-4 rounded-md border border-caos-warning/50 bg-caos-warning/5 p-3"><h3 className="tabular text-caos-2xs font-semibold uppercase tracking-widest text-caos-warning">Decision gates missing</h3><ul className="mt-2 space-y-1 text-caos-xs text-caos-text">{selected.missing_gates.map((gate) => <li key={gate}>△ {gate}</li>)}</ul></section> : null}<div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => void pinPitch("rv-pitch")} disabled={busy} className="caos-action-secondary focus-ring">Pin pitch</button><button type="button" onClick={() => void pinPitch("monitor-threshold")} disabled={busy} className="caos-action-secondary focus-ring">Monitor threshold</button>{context ? <><Link href={contextHref("/query", context.id, { instrument: selected.instrument_id })} className="caos-action-secondary focus-ring no-underline">Investigate</Link><Link href={contextHref("/sector", context.id)} className="caos-action-secondary focus-ring no-underline">Sector view</Link></> : null}<button type="button" onClick={() => void ratifyCandidate()} disabled={selected.classification !== "actionable" || busy} className="caos-action-secondary focus-ring disabled:opacity-40" title={selected.classification !== "actionable" ? "Resolve every decision gate before ratification." : undefined}>{selected.ratified_at ? "Ratified" : "Ratify candidate"}</button></div></> : <p className="mt-3 text-caos-xs text-caos-muted">Select one exact instrument to inspect its three-part pitch, evidence and portfolio effect.</p>}
          {context ? <div className="mt-4"><FindingsTray contextId={context.id} refreshKey={findingsKey} /></div> : null}
        </aside>}
        />
      </main>
    </EnterprisePage>
  );
}
