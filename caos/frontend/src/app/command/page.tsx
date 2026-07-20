"use client";

// Concept A — The Command Center: portfolio posture and governance.
// Unified CIO/PM and Head of Research dashboard with toggleable sleeve and run tables.
// Sector RV has been promoted to a standalone route under /sector-rv.
// Click a row for the issuer detail strip; ATLF links into the Analytical Deep-Dive.

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { RequireAuth } from "@/components/shared/RequireAuth";
import { useRovingTabs } from "@/lib/useRovingTabs";
import { headStat } from "@/components/shared/headStat";
import { ShellIdentity } from "@/components/shared/ShellIdentity";
import { Panel as PanelShell } from "@/components/shared/Panel";
import { LiveCoverage } from "@/components/command/LiveCoverage";
import { DailyDigestPanel } from "@/components/command/DailyDigestPanel";
import { usePortfolio } from "@/lib/engine/usePortfolio";
import { fmtUtcDateTime } from "@/lib/format-date";
import { useDigest } from "@/lib/engine/useDigest";
import { useGovernanceSources } from "@/lib/command/useGovernanceSources";
import {
  CommandPortfolioPosture,
  CommandPortfolioTable,
  CommandPositionStrip,
} from "@/components/command/CommandPortfolio";
import { EnterprisePage, type NarrowContract } from "@/components/shared/EnterprisePage";
import { DecisionHeader } from "@/components/shared/DecisionHeader";
import { RankedChangesView } from "@/components/command/RankedChanges";
import { ActionReason } from "@/components/shared/ActionReason";
import { useAutonomyDraft } from "@/lib/engine/useAutonomyDraft";
import { draftToAlertRows } from "@/lib/alerts/inbox";
import { useRoleView } from "@/components/shared/RoleViewProvider";
import type { DecisionAuthority, DecisionContextState, DecisionDatumState } from "@/lib/decision-state";
import { WorkbenchToolbar } from "@/components/shared/WorkbenchToolbar";
import { PersonaWorkbench } from "@/components/shared/PersonaWorkbench";
import { DominantTableRegion } from "@/components/shared/DominantTableRegion";
import { contextHref, useAnalysisContext, type InsightArtifact } from "@/lib/analysis-workbench";
import { useTypedUrlState, type TypedUrlUpdate } from "@/lib/typed-url-state";
import { getPortfolios, type FreshnessState, type PortfolioSummary } from "@/lib/api";
import { portfolioLabApi, type CommandPortfolioSnapshot } from "@/lib/portfolio-lab";
import { SurfaceState } from "@/components/shared/SurfaceState";
import { AnalysisContextSaveState } from "@/components/shared/AnalysisContextSaveState";
import { GovernanceSummary } from "@/components/shared/GovernanceSummary";
import { useSurfaceInsight } from "@/lib/use-surface-insight";

const GovernancePanel = dynamic(
  () => import("@/components/command/GovernancePanel").then((module) => module.GovernancePanel),
  { loading: () => <div role="status" aria-live="polite" className="min-h-72 p-3 text-caos-xs text-caos-muted">Loading governance queue…</div> },
);
const IssuerStrip = dynamic(
  () => import("@/components/command/views").then((module) => module.IssuerStrip),
  { loading: () => <div role="status" aria-live="polite" className="h-12 shrink-0 border-t border-caos-border bg-caos-panel px-4 flex items-center text-caos-xs text-caos-muted">Loading issuer details…</div> },
);

const COMMAND_URL_KEYS = ["dataset", "selected", "portfolio"] as const;
type CommandUrlKey = (typeof COMMAND_URL_KEYS)[number];
type CommandUrlUpdater = (changes: TypedUrlUpdate<CommandUrlKey>, mode?: "push" | "replace") => void;
type CommandDataset = "changes" | "positions" | "coverage" | "governance";
const DATASET_TABS: readonly [string, CommandDataset][] = [
  ["Changes", "changes"],
  ["Positions", "positions"],
  ["Live coverage", "coverage"],
  ["Governance", "governance"],
];

function resolveCommandDataset(requested: string | null, roleView: ReturnType<typeof useRoleView>["roleView"]): CommandDataset {
  if (requested && DATASET_TABS.some(([, dataset]) => dataset === requested)) return requested as CommandDataset;
  if (roleView === "qa") return "governance";
  if (roleView === "pm") return "changes";
  return "coverage";
}

function usePortfolioDirectory() {
  const [rows, setRows] = useState<PortfolioSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    getPortfolios()
      .then((portfolios) => {
        if (!alive) return;
        setRows(portfolios);
        setError(false);
      })
      .catch(() => {
        if (!alive) return;
        setRows([]);
        setError(true);
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);
  return { rows, loading, error };
}

function resolvePortfolioSelection(directory: PortfolioSummary[], requestedId: string | null, contextId: string | null) {
  const requested = requestedId && directory.some((row) => row.id === requestedId) ? requestedId : null;
  const contextual = contextId && directory.some((row) => row.id === contextId) ? contextId : null;
  const id = requestedId ? requested : contextual ?? directory[0]?.id ?? null;
  return { id, portfolio: directory.find((row) => row.id === id) ?? null };
}

function useCommandSnapshot(portfolioId: string | null) {
  const [snapshot, setSnapshot] = useState<CommandPortfolioSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!portfolioId) {
      setSnapshot(null);
      setLoading(false);
      setError(false);
      return;
    }
    let alive = true;
    const load = () => {
      setLoading(true);
      portfolioLabApi.getCommandSnapshot(portfolioId)
        .then((value) => {
          if (!alive) return;
          setSnapshot(value);
          setError(false);
        })
        .catch(() => {
          if (!alive) return;
          setSnapshot(null);
          setError(true);
        })
        .finally(() => { if (alive) setLoading(false); });
    };
    load();
    window.addEventListener("focus", load);
    return () => {
      alive = false;
      window.removeEventListener("focus", load);
    };
  }, [portfolioId]);
  return { snapshot, loading, error };
}

function useDefaultPortfolioUrl(portfolioId: string | null, requestedId: string | null, loading: boolean, update: CommandUrlUpdater) {
  useEffect(() => {
    if (!portfolioId || requestedId || loading) return;
    update({ portfolio: portfolioId }, "replace");
  }, [loading, portfolioId, requestedId, update]);
}

function useCommandInsight(contextId: string | null | undefined, selected: string | null) {
  return useSurfaceInsight(contextId, {
    surface: "command",
    kind: "decision-brief",
    subjectRefs: { alert_event_id: selected },
    loadingMessage: "Generating cited decision brief…",
    emptyMessage: "No cited decision brief is available.",
    errorMessage: "Cited decision brief is unavailable.",
  });
}

function useCommandContextSync(analysis: ReturnType<typeof useAnalysisContext>, dataset: CommandDataset, roleView: ReturnType<typeof useRoleView>["roleView"], selected: string | null, portfolioId: string | null, directoryLoading: boolean) {
  const context = analysis.context;
  const patch = analysis.patch;
  useEffect(() => {
    if (!context || directoryLoading) return;
    const current = context.surface_state.command;
    const unchanged = current?.active_id === selected
      && current?.view === dataset
      && current?.filters?.role === roleView
      && current?.filters?.portfolio_id === portfolioId
      && context.portfolio_scope === portfolioId;
    if (unchanged) return;
    void patch({
      portfolio_scope: portfolioId,
      surface_state: {
        ...context.surface_state,
        command: {
          ...current,
          active_id: selected,
          view: dataset,
          filters: { ...current?.filters, role: roleView, portfolio_id: portfolioId },
        },
      },
    }).catch(() => undefined);
  }, [context, dataset, directoryLoading, patch, portfolioId, roleView, selected]);
}

type Digest = ReturnType<typeof useDigest>["digest"];

function digestFreshness(digest: Digest): FreshnessState | null {
  if (!digest?.freshness) return null;
  if (digest.freshness.counts.stale > 0) return "stale";
  if (digest.freshness.counts.unknown > 0) return "unknown";
  if (digest.freshness.counts.due > 0) return "due";
  return "current";
}

function digestDecisionMetadata(digest: Digest) {
  const asOf = digest?.as_of ? fmtUtcDateTime(digest.as_of) : null;
  const freshnessState = digestFreshness(digest);
  const freshness = freshnessState?.toUpperCase() as "CURRENT" | "DUE" | "STALE" | "UNKNOWN" | undefined;
  const authority: DecisionAuthority | undefined = asOf && freshness ? {
    provenance: { origin: "LIVE", method: "DERIVED", freshness, detail: `Central ${digest?.freshness?.policy_version} latest-run freshness roll-up.`, asOf },
    approval: "UNRATIFIED",
  } : undefined;
  const emptyAuthority = authority ? { ...authority, approval: null } satisfies DecisionAuthority : undefined;
  return { asOf, freshnessState, authority, emptyAuthority };
}

type CommandDecisionInput = {
  digest: Digest;
  digestLive: boolean;
  digestLoading: boolean;
  portfolio: ReturnType<typeof usePortfolio>;
  liveQa: ReturnType<typeof useGovernanceSources>["liveQa"];
  liveFailed: ReturnType<typeof useGovernanceSources>["liveFailed"];
  liveGaps: ReturnType<typeof useGovernanceSources>["liveGapsItems"];
};

function changedDecisionCell(input: CommandDecisionInput, metadata: ReturnType<typeof digestDecisionMetadata>): DecisionDatumState {
  if (input.digestLoading) return { kind: "loading", message: "Checking 24-hour engine activity…" };
  if (!input.digestLive || !input.digest || !metadata.asOf) return { kind: "unavailable", message: "Live activity unavailable" };
  const activity = Object.entries(input.digest.activity_24h || {}).filter(([, value]) => typeof value === "number" && value > 0);
  if (!activity.length) return { kind: "observed-empty", message: "No engine activity observed in 24h — first run populates this", asOf: metadata.asOf, authority: metadata.emptyAuthority };
  const value = activity.slice(0, 3).map(([key, count]) => `${count} ${key.replaceAll("_", " ")}`).join(" · ");
  return { kind: "ready", value: `${value} in 24h`, asOf: metadata.asOf, authority: metadata.authority };
}

function impactDecisionCell(input: CommandDecisionInput, metadata: ReturnType<typeof digestDecisionMetadata>): DecisionDatumState {
  if (input.digestLoading) return { kind: "loading", message: "Calculating portfolio impact…" };
  if (!input.digestLive || !input.digest || !metadata.asOf) return { kind: "unavailable", message: "Portfolio impact unavailable" };
  if (input.digest.warf == null) return { kind: "observed-empty", message: "No rated names yet — WARF forms once ratings ingest", asOf: metadata.asOf, authority: metadata.emptyAuthority };
  const band = input.digest.warf_band ? ` (${input.digest.warf_band})` : "";
  return { kind: "ready", value: `WARF ${input.digest.warf}${band} · CCC watch ${input.digest.ccc_watch.length}`, asOf: metadata.asOf, authority: metadata.authority };
}

function actionDecisionCell(input: CommandDecisionInput): DecisionDatumState {
  if (input.portfolio.loading) return { kind: "loading", message: "Checking governance queues…" };
  if (input.portfolio.error) return { kind: "offline", lastKnown: "Governance queues unavailable" };
  if (!input.portfolio.fetchedAt) return { kind: "unavailable", message: "Governance queue unavailable" };
  return {
    kind: "ready",
    value: `${(input.liveQa ?? []).length + (input.liveFailed ?? []).length} QA findings · ${(input.liveGaps ?? []).length} source gaps`,
    asOf: fmtUtcDateTime(input.portfolio.fetchedAt),
    authority: { provenance: { origin: "LIVE", method: "DERIVED", freshness: "CURRENT", detail: "Portfolio QA and source-gap roll-up." }, approval: "UNRATIFIED" },
  };
}

function evidenceDecisionCell(input: CommandDecisionInput, metadata: ReturnType<typeof digestDecisionMetadata>): DecisionDatumState {
  if (input.digestLoading) return { kind: "loading", message: "Checking evidence coverage…" };
  if (!input.digestLive || !input.digest?.freshness || !metadata.asOf || !metadata.freshnessState) return { kind: "unavailable", message: "Central evidence freshness unavailable" };
  const counts = input.digest.freshness.counts;
  const value = `${counts.stale} stale · ${counts.due} due · ${counts.unknown} unknown · ${counts.current} current`;
  if (metadata.freshnessState === "stale") return { kind: "stale", value, asOf: metadata.asOf, authority: metadata.authority };
  if (metadata.freshnessState === "current") return { kind: "ready", value: `${counts.current} current · no due, stale, or unknown runs`, asOf: metadata.asOf, authority: metadata.authority };
  const missingSources = metadata.freshnessState === "unknown" ? ["unverified latest-run freshness"] : ["run refresh due"];
  return { kind: "partial", value, missingSources, asOf: metadata.asOf, authority: metadata.authority };
}

function buildCommandDecision(input: CommandDecisionInput): DecisionContextState {
  const metadata = digestDecisionMetadata(input.digest);
  return {
    whatChanged: changedDecisionCell(input, metadata),
    whyItMatters: impactDecisionCell(input, metadata),
    requiredAction: actionDecisionCell(input),
    evidenceHealth: evidenceDecisionCell(input, metadata),
  };
}

export default function CommandPage() {
  return (
    <RequireAuth>
      <CommandCenter />
    </RequireAuth>
  );
}

type CommandPositionsContentProps = {
  directory: PortfolioSummary[];
  directoryLoading: boolean;
  directoryError: boolean;
  invalidRequested: boolean;
  snapshot: CommandPortfolioSnapshot | null;
  snapshotLoading: boolean;
  snapshotError: boolean;
  selectedPortfolio: PortfolioSummary | null;
  selected: string | null;
  onReset: () => void;
  onSelect: (id: string) => void;
};

function CommandPositionsContent(props: CommandPositionsContentProps) {
  if (props.directoryLoading) return <SurfaceState kind="loading" title="Loading portfolios" detail="Retrieving authorized persisted holdings." className="m-auto max-w-md" />;
  if (props.directoryError) return <SurfaceState kind="offline" title="Portfolio directory unavailable" detail="Persisted holdings could not be loaded. No sample sleeve has been substituted." className="m-auto max-w-md" primaryAction={<Link href="/portfolios" className="caos-action-primary no-underline focus-ring">Open Portfolio Lab</Link>} />;
  if (props.invalidRequested) return <SurfaceState kind="unavailable" title="Portfolio unavailable" detail="The requested portfolio is missing or outside your authorized scope." className="m-auto max-w-md" primaryAction={<button type="button" className="caos-action-primary focus-ring" onClick={props.onReset}>Open default portfolio</button>} />;
  if (!props.directory.length) return <SurfaceState kind="empty" title="No portfolio configured" detail="Create or import a persisted portfolio before reviewing held positions and posture." className="m-auto max-w-md" primaryAction={<Link href="/portfolios" className="caos-action-primary no-underline focus-ring">Create or open portfolio</Link>} />;
  if (props.snapshotLoading && !props.snapshot) return <SurfaceState kind="loading" title="Loading holdings" detail={`Retrieving ${props.selectedPortfolio?.name ?? "selected portfolio"}.`} className="m-auto max-w-md" />;
  if (props.snapshotError || !props.snapshot) return <SurfaceState kind="offline" title="Holdings unavailable" detail="The selected portfolio remains configured, but its positions could not be loaded." className="m-auto max-w-md" primaryAction={<Link href="/portfolios" className="caos-action-primary no-underline focus-ring">Open Portfolio Lab</Link>} />;
  if (!props.snapshot.positions.length) return <SurfaceState kind="empty" title="No positions held" detail="This persisted portfolio contains no holdings. Upload holdings in Portfolio Lab." className="m-auto max-w-md" primaryAction={<Link href={`/portfolios?portfolio=${encodeURIComponent(props.snapshot.portfolio.id)}`} className="caos-action-primary no-underline focus-ring">Add holdings</Link>} />;
  return <CommandPortfolioTable positions={props.snapshot.positions} selected={props.selected} onSelect={props.onSelect} />;
}

function commandNarrowContract(snapshot: CommandPortfolioSnapshot | null, portfolio: ReturnType<typeof usePortfolio>): NarrowContract {
  const coverage = portfolio.error
    ? headStat("Live Coverage", "—", "var(--caos-warning)")
    : headStat("Live Coverage", `${portfolio.coveredCount}/${portfolio.issuerCount}`, "var(--caos-success)");
  return {
    essentialControls: <div className="flex items-center gap-4 shrink-0 overflow-x-auto caos-no-scrollbar">{headStat("Positions", snapshot ? String(snapshot.position_count) : "—")}{coverage}</div>,
  };
}

type CommandSurfaceStatus = "loading" | "error" | "ready";

type CommandViewProps = {
  analysis: ReturnType<typeof useAnalysisContext>;
  roleView: ReturnType<typeof useRoleView>["roleView"];
  dataset: CommandDataset;
  selected: string | null;
  updateUrlState: CommandUrlUpdater;
  getDatasetTabProps: ReturnType<typeof useRovingTabs>["getItemProps"];
  portfolio: ReturnType<typeof usePortfolio>;
  portfolioDirectory: PortfolioSummary[];
  selectedPortfolioId: string | null;
  selectedPortfolio: PortfolioSummary | null;
  commandSnapshot: CommandPortfolioSnapshot | null;
  autonomy: ReturnType<typeof useAutonomyDraft>;
  rankedRowCount: number;
  topChangeHref: string | null;
  digest: Digest;
  digestLive: boolean;
  digestAsOf: string | null;
  commandDecision: DecisionContextState;
  positionsContent: ReactNode;
  qaStatus: CommandSurfaceStatus;
  findingStatus: CommandSurfaceStatus;
  digestStatus: CommandSurfaceStatus;
  liveQa: ReturnType<typeof useGovernanceSources>["liveQa"];
  liveFailed: ReturnType<typeof useGovernanceSources>["liveFailed"];
  liveGapsItems: ReturnType<typeof useGovernanceSources>["liveGapsItems"];
  liveMixed: ReturnType<typeof useGovernanceSources>["liveMixed"];
  insight: InsightArtifact | null;
  insightMessage: string | null;
  generateInsight: () => Promise<void>;
  liveSelected: ReturnType<typeof usePortfolio>["rows"][number] | null;
  selectedCommandPosition: CommandPortfolioSnapshot["positions"][number] | null;
  narrowContract: NarrowContract;
  routerPush: (href: string) => void;
};

function topChangeReason(props: CommandViewProps) {
  if (props.autonomy.loading) return "Checking the autonomy draft…";
  if (props.autonomy.offline) return "Autonomy engine unreachable — no changes to open";
  if (props.rankedRowCount === 0) return props.autonomy.draft?.refreshing ? "Cycle running — no changes yet" : "No ranked changes yet — the first cycle populates this";
  if (!props.topChangeHref) return "Top ranked change has no issuer identifier";
  return null;
}

function CommandTopChangeAction({ view }: { view: CommandViewProps }) {
  return <ActionReason reason={topChangeReason(view)} reasonDisplay="hidden" className="caos-action-primary focus-ring" onClick={() => { if (view.topChangeHref) view.routerPush(view.topChangeHref); }}>Open top change</ActionReason>;
}

function CommandIdentity({ view }: { view: CommandViewProps }) {
  const badge = view.selectedPortfolio ? <span className="tabular text-caos-2xs uppercase tracking-wider whitespace-nowrap shrink-0 text-caos-muted">{view.selectedPortfolio.kind} · persisted</span> : null;
  return <ShellIdentity badges={badge} title={view.selectedPortfolio?.name ?? "Portfolio command"} />;
}

function CommandHeaderStatus({ view }: { view: CommandViewProps }) {
  const label = view.commandSnapshot?.as_of ? `Holdings as of ${view.commandSnapshot.as_of}` : view.digestAsOf ? `Observed ${view.digestAsOf}` : "Holdings date unavailable";
  return <><span className="tabular text-caos-2xs text-caos-muted">{label}</span><AnalysisContextSaveState analysis={view.analysis} /></>;
}

function CommandContextControls({ view }: { view: CommandViewProps }) {
  const coverage = view.portfolio.error
    ? headStat("Live Coverage", "—", "var(--caos-warning)")
    : headStat("Live Coverage", `${view.portfolio.coveredCount}/${view.portfolio.issuerCount}`, "var(--caos-success)");
  return <>
    {view.portfolioDirectory.length ? <label className="flex items-center gap-2 tabular text-caos-2xs uppercase tracking-wider text-caos-muted">Portfolio<select aria-label="Selected portfolio" value={view.selectedPortfolioId ?? ""} onChange={(event) => view.updateUrlState({ portfolio: event.target.value || null, selected: null }, "replace")} className="h-7 max-w-56 rounded border border-caos-border bg-caos-bg px-2 text-caos-xs text-caos-text focus-ring">{view.portfolioDirectory.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label> : null}
    {headStat("Positions", view.commandSnapshot ? String(view.commandSnapshot.position_count) : "—")}
    {coverage}
  </>;
}

function CommandUtilityControls({ view }: { view: CommandViewProps }) {
  return <div className="grid gap-3"><Link href="/portfolios" className="caos-action-secondary no-underline focus-ring">Open Portfolio Lab</Link>{view.analysis.context ? <Link href={contextHref("/monitor", view.analysis.context.id)} className="caos-action-secondary no-underline focus-ring">Open Monitor</Link> : null}</div>;
}

function CommandToolbar({ view }: { view: CommandViewProps }) {
  const count = view.portfolio.loading ? "Loading" : view.portfolio.error ? "Live coverage unavailable" : `${view.portfolio.coveredCount}/${view.portfolio.issuerCount} covered`;
  const role = view.roleView === "pm" ? "PM" : view.roleView === "qa" ? "QA" : "Analyst";
  const queryHref = view.analysis.context ? contextHref("/query", view.analysis.context.id) : "/query";
  const filters = <Link href={queryHref} className="caos-action-secondary no-underline focus-ring whitespace-nowrap">Open cross-issuer Query</Link>;
  return <WorkbenchToolbar title="Ranked changes & governance" description="Portfolio posture and governance queues beside the ranked-change worklist." count={count} viewLabel={`View: ${role}`} filters={filters} />;
}

function CommandCoverageContent({ view }: { view: CommandViewProps }) {
  if (view.portfolio.loading) return <SurfaceState kind="loading" title="Loading live coverage" className="m-auto max-w-md" />;
  if (view.portfolio.error && !view.portfolio.rows.length) return <SurfaceState kind="offline" title="Live coverage unavailable" detail="Latest-run coverage could not be loaded." className="m-auto max-w-md" />;
  if (!view.portfolio.rows.length) return <SurfaceState kind="empty" title="No live coverage" detail="No completed analytical runs are available." className="m-auto max-w-md" primaryAction={<Link href="/upload" className="caos-action-primary no-underline focus-ring">Start document intake</Link>} />;
  return <div className="overflow-x-auto h-full flex flex-col"><LiveCoverage rows={view.portfolio.rows} selected={view.selected} onSelect={(value) => view.updateUrlState({ selected: value }, "replace")} /></div>;
}

function CommandDatasetContent({ view }: { view: CommandViewProps }) {
  if (view.dataset === "changes") return <RankedChangesView state={view.autonomy} />;
  if (view.dataset === "governance") return <GovernancePanel findingStatus={view.findingStatus} qaStatus={view.qaStatus} digestStatus={view.digestStatus} liveQa={view.liveQa} liveFailedGates={view.liveFailed} liveGaps={view.liveGapsItems} liveMixedOrigin={view.liveMixed} staleRows={view.digestLive ? view.digest?.stale ?? [] : []} />;
  const label = view.dataset === "positions" ? "Persisted portfolio positions" : "Live coverage worklist";
  return <DominantTableRegion ownerId="command-worklist" label={label} className="h-full min-h-0">{view.dataset === "positions" ? view.positionsContent : <CommandCoverageContent view={view} />}</DominantTableRegion>;
}

function commandDatasetTitle(dataset: CommandDataset) {
  if (dataset === "changes") return "Ranked Changes · autonomy draft";
  if (dataset === "positions") return "Persisted portfolio · positions";
  if (dataset === "coverage") return "Live Coverage";
  return "Governance · CP-5 / CP-0 / Staleness";
}

function CommandDatasetPanel({ view }: { view: CommandViewProps }) {
  const tabs = <div role="tablist" aria-label="Command dataset" className="flex items-center gap-1 overflow-x-auto">{DATASET_TABS.map(([label, mode], index) => <button key={mode} type="button" role="tab" aria-selected={view.dataset === mode} onClick={() => view.updateUrlState({ dataset: mode, selected: null })} {...view.getDatasetTabProps(index)} className="caos-action-secondary focus-ring whitespace-nowrap">{label}</button>)}</div>;
  return <PanelShell title={commandDatasetTitle(view.dataset)} className="h-full min-h-0" right={tabs}><CommandDatasetContent view={view} /></PanelShell>;
}

function CitedBriefPanel({ view }: { view: CommandViewProps }) {
  const actionLabel = view.insight ? "Refresh cited brief" : "Generate cited brief";
  const content = view.insight
    ? <article className="p-2 pt-0 grid gap-2"><p className="text-caos-sm text-caos-text">{view.insight.summary}</p><ul className="grid gap-1">{view.insight.claims.map((claim) => <li key={claim.id} className="text-caos-xs text-caos-muted">{claim.statement} · sources {claim.evidence_ids.join(", ") || "missing"}</li>)}</ul></article>
    : <p role="status" className="p-2 pt-0 text-caos-xs text-caos-muted">{view.insightMessage ?? "No cited brief generated."}</p>;
  return <PanelShell title="Cited decision brief"><button type="button" onClick={() => void view.generateInsight()} className="caos-action-secondary focus-ring m-2">{actionLabel}</button>{content}</PanelShell>;
}

function CommandInspector({ view }: { view: CommandViewProps }) {
  return <div className="grid gap-2"><GovernanceSummary coldStart={!view.portfolio.live && !view.portfolio.error && !view.portfolio.loading} qa={view.liveQa?.length} failed={view.liveFailed?.length} gaps={view.liveGapsItems?.length} mixed={view.liveMixed?.length} stale={view.digestLive ? view.digest?.stale?.length ?? 0 : undefined} onOpen={() => view.updateUrlState({ dataset: "governance" })} /><CitedBriefPanel view={view} /></div>;
}

function CommandDecisionPanel({ view }: { view: CommandViewProps }) {
  const posture = view.commandSnapshot && view.commandSnapshot.position_count > 0
    ? <CommandPortfolioPosture counts={view.commandSnapshot.posture_counts} total={view.commandSnapshot.position_count} portfolioName={view.commandSnapshot.portfolio.name} />
    : null;
  return <div className="grid gap-2"><DecisionHeader state={view.commandDecision} />{posture}</div>;
}

function CommandWorkspace({ view }: { view: CommandViewProps }) {
  return <div className="flex-1 min-h-0 gap-2 p-2 flex flex-col overflow-hidden"><CommandToolbar view={view} /><div id="ranked-changes" className="caos-persona-route command-workbench flex-1 min-h-0" tabIndex={-1}><PersonaWorkbench surface="command" decision={<CommandDecisionPanel view={view} />} primary={<CommandDatasetPanel view={view} />} context={<CommandContext digest={view.digestLive ? view.digest : null} />} inspector={<CommandInspector view={view} />} /></div></div>;
}

function CommandSelectionStrips({ view }: { view: CommandViewProps }) {
  return <>
    {view.dataset === "positions" && view.selectedCommandPosition ? <CommandPositionStrip position={view.selectedCommandPosition} onClose={() => view.updateUrlState({ selected: null }, "replace")} /> : null}
    {view.dataset === "coverage" && view.liveSelected ? <IssuerStrip code={view.liveSelected.issuer_id} liveRow={view.liveSelected} onClose={() => view.updateUrlState({ selected: null }, "replace")} /> : null}
  </>;
}

function CommandView({ view }: { view: CommandViewProps }) {
  return <EnterprisePage kind="overview" identity={<CommandIdentity view={view} />} primaryAction={<CommandTopChangeAction view={view} />} status={<CommandHeaderStatus view={view} />} contextualControls={<CommandContextControls view={view} />} utilityLabel="Command utilities" utilityControls={<CommandUtilityControls view={view} />} narrowContract={view.narrowContract}><CommandWorkspace view={view} /><CommandSelectionStrips view={view} /></EnterprisePage>;
}

function useCommandNavigation() {
  const router = useRouter();
  const analysis = useAnalysisContext({ name: "Portfolio command" });
  const { roleView } = useRoleView();
  const { values, update } = useTypedUrlState(COMMAND_URL_KEYS);
  const dataset = resolveCommandDataset(values.dataset, roleView);
  const { getItemProps } = useRovingTabs(
    DATASET_TABS.length,
    DATASET_TABS.findIndex(([, mode]) => mode === dataset),
    (index) => update({ dataset: DATASET_TABS[index][1], selected: null }),
  );
  return { analysis, roleView, dataset, selected: values.selected, requestedPortfolioId: values.portfolio, updateUrlState: update, getDatasetTabProps: getItemProps, routerPush: (href: string) => router.push(href) };
}

function invalidPortfolioRequest(requestedId: string | null, directoryLoading: boolean, selectedId: string | null) {
  return Boolean(requestedId && !directoryLoading && !selectedId);
}

function useCommandPortfolioModel(navigation: ReturnType<typeof useCommandNavigation>) {
  const portfolio = usePortfolio();
  const directory = usePortfolioDirectory();
  const selection = resolvePortfolioSelection(directory.rows, navigation.requestedPortfolioId, navigation.analysis.context?.portfolio_scope ?? null);
  const command = useCommandSnapshot(selection.id);
  useDefaultPortfolioUrl(selection.id, navigation.requestedPortfolioId, directory.loading, navigation.updateUrlState);
  return { portfolio, directory, selection, command, invalidRequested: invalidPortfolioRequest(navigation.requestedPortfolioId, directory.loading, selection.id) };
}

function commandSurfaceStatus(loading: boolean, error: boolean): CommandSurfaceStatus {
  if (loading) return "loading";
  if (error) return "error";
  return "ready";
}

function deriveRankedChange(autonomy: ReturnType<typeof useAutonomyDraft>) {
  const rows = autonomy.draft ? draftToAlertRows(autonomy.draft) : [];
  const issuer = rows[0]?.issuerId ?? rows[0]?.issuerName;
  return { count: rows.length, href: issuer ? `/deepdive?issuer=${encodeURIComponent(issuer)}` : null };
}

function useCommandGovernanceModel(portfolio: ReturnType<typeof usePortfolio>) {
  const governance = useGovernanceSources(portfolio);
  const autonomy = useAutonomyDraft();
  const ranked = useMemo(() => deriveRankedChange(autonomy), [autonomy]);
  return {
    governance,
    autonomy,
    ranked,
    qaStatus: commandSurfaceStatus(portfolio.loading, Boolean(portfolio.error)),
    findingStatus: commandSurfaceStatus(portfolio.loading || governance.qaFindingsLoading, Boolean(portfolio.error || governance.qaFindingsError)),
    digestStatus: commandSurfaceStatus(governance.loading, Boolean(governance.error)),
  };
}

function selectedLiveCoverage(portfolio: ReturnType<typeof usePortfolio>, selected: string | null) {
  if (!selected) return null;
  return portfolio.rows.find((row) => row.issuer_id === selected) ?? null;
}

function selectedCommandPosition(snapshot: CommandPortfolioSnapshot | null, selected: string | null) {
  if (!selected) return null;
  return snapshot?.positions.find((position) => position.id === selected) ?? null;
}

function useCommandAnalysisModel(navigation: ReturnType<typeof useCommandNavigation>, portfolioModel: ReturnType<typeof useCommandPortfolioModel>, governanceModel: ReturnType<typeof useCommandGovernanceModel>) {
  const { governance } = governanceModel;
  useCommandContextSync(navigation.analysis, navigation.dataset, navigation.roleView, navigation.selected, portfolioModel.selection.id, portfolioModel.directory.loading);
  const insight = useCommandInsight(navigation.analysis.context?.id, navigation.selected);
  return {
    insight,
    digestAsOf: digestDecisionMetadata(governance.digest).asOf,
    commandDecision: buildCommandDecision({ digest: governance.digest, digestLive: governance.live, digestLoading: governance.loading, portfolio: portfolioModel.portfolio, liveQa: governance.liveQa, liveFailed: governance.liveFailed, liveGaps: governance.liveGapsItems }),
    liveSelected: selectedLiveCoverage(portfolioModel.portfolio, navigation.selected),
    selectedPosition: selectedCommandPosition(portfolioModel.command.snapshot, navigation.selected),
  };
}

function buildPositionsContent(navigation: ReturnType<typeof useCommandNavigation>, portfolioModel: ReturnType<typeof useCommandPortfolioModel>) {
  const props: CommandPositionsContentProps = {
    directory: portfolioModel.directory.rows,
    directoryLoading: portfolioModel.directory.loading,
    directoryError: portfolioModel.directory.error,
    invalidRequested: portfolioModel.invalidRequested,
    snapshot: portfolioModel.command.snapshot,
    snapshotLoading: portfolioModel.command.loading,
    snapshotError: portfolioModel.command.error,
    selectedPortfolio: portfolioModel.selection.portfolio,
    selected: navigation.selected,
    onReset: () => navigation.updateUrlState({ portfolio: null, selected: null }, "replace"),
    onSelect: (positionId) => navigation.updateUrlState({ selected: positionId }, "replace"),
  };
  return <CommandPositionsContent {...props} />;
}

function buildCommandViewProps(navigation: ReturnType<typeof useCommandNavigation>, portfolioModel: ReturnType<typeof useCommandPortfolioModel>, governanceModel: ReturnType<typeof useCommandGovernanceModel>, analysisModel: ReturnType<typeof useCommandAnalysisModel>): CommandViewProps {
  const { governance } = governanceModel;
  return {
    analysis: navigation.analysis,
    roleView: navigation.roleView,
    dataset: navigation.dataset,
    selected: navigation.selected,
    updateUrlState: navigation.updateUrlState,
    getDatasetTabProps: navigation.getDatasetTabProps,
    portfolio: portfolioModel.portfolio,
    portfolioDirectory: portfolioModel.directory.rows,
    selectedPortfolioId: portfolioModel.selection.id,
    selectedPortfolio: portfolioModel.selection.portfolio,
    commandSnapshot: portfolioModel.command.snapshot,
    autonomy: governanceModel.autonomy,
    rankedRowCount: governanceModel.ranked.count,
    topChangeHref: governanceModel.ranked.href,
    digest: governance.digest,
    digestLive: governance.live,
    digestAsOf: analysisModel.digestAsOf,
    commandDecision: analysisModel.commandDecision,
    positionsContent: buildPositionsContent(navigation, portfolioModel),
    qaStatus: governanceModel.qaStatus,
    findingStatus: governanceModel.findingStatus,
    digestStatus: governanceModel.digestStatus,
    liveQa: governance.liveQa,
    liveFailed: governance.liveFailed,
    liveGapsItems: governance.liveGapsItems,
    liveMixed: governance.liveMixed,
    insight: analysisModel.insight.insight,
    insightMessage: analysisModel.insight.message,
    generateInsight: analysisModel.insight.generate,
    liveSelected: analysisModel.liveSelected,
    selectedCommandPosition: analysisModel.selectedPosition,
    narrowContract: commandNarrowContract(portfolioModel.command.snapshot, portfolioModel.portfolio),
    routerPush: navigation.routerPush,
  };
}

function useCommandCenterView() {
  const navigation = useCommandNavigation();
  const portfolioModel = useCommandPortfolioModel(navigation);
  const governanceModel = useCommandGovernanceModel(portfolioModel.portfolio);
  const analysisModel = useCommandAnalysisModel(navigation, portfolioModel, governanceModel);
  return buildCommandViewProps(navigation, portfolioModel, governanceModel, analysisModel);
}

function CommandCenter() {
  const view = useCommandCenterView();
  return <CommandView view={view} />;
}

function CommandContext({ digest }: { digest: ReturnType<typeof useDigest>["digest"] | null }) {
  return <div className="grid gap-2">{digest ? <PanelShell title="Daily Digest · coverage & ratings" right={<span className="tabular text-caos-xs text-caos-success">● LIVE</span>}><DailyDigestPanel digest={digest} /></PanelShell> : <PanelShell title="Daily Digest"><p className="p-2 text-caos-xs text-caos-muted">Live coverage digest unavailable.</p></PanelShell>}</div>;
}
