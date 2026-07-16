"use client";

// Concept A — The Command Center: portfolio posture and governance.
// Unified CIO/PM and Head of Research dashboard with toggleable sleeve and run tables.
// Sector RV has been promoted to a standalone route under /sector-rv.
// Click a row for the issuer detail strip; ATLF links into the Analytical Deep-Dive.

import { useEffect, useState } from "react";
import Link from "next/link";
import { RequireAuth } from "@/components/shared/RequireAuth";
import { headStat } from "@/components/shared/headStat";
import { ShellIdentity } from "@/components/shared/ShellIdentity";
import { Panel as PanelShell } from "@/components/shared/Panel";
import { LiveCoverage } from "@/components/command/LiveCoverage";
import { DailyDigestPanel } from "@/components/command/DailyDigestPanel";
import { usePortfolio } from "@/lib/engine/usePortfolio";
import { fmtUtcDateTime } from "@/lib/format-date";
import { useDigest } from "@/lib/engine/useDigest";
import { useGovernanceSources } from "@/lib/command/useGovernanceSources";
import { IssuerStrip } from "@/components/command/views";
import {
  CommandPortfolioPosture,
  CommandPortfolioTable,
  CommandPositionStrip,
} from "@/components/command/CommandPortfolio";
import { EnterprisePage, type NarrowContract } from "@/components/shared/EnterprisePage";
import { DecisionHeader } from "@/components/shared/DecisionHeader";
import { RankedChanges } from "@/components/command/RankedChanges";
import { GovernancePanel } from "@/components/command/GovernancePanel";
import { useRoleView } from "@/components/shared/RoleViewProvider";
import type { DecisionContextState } from "@/lib/decision-state";
import { WorkbenchToolbar } from "@/components/shared/WorkbenchToolbar";
import { PersonaWorkbench } from "@/components/shared/PersonaWorkbench";
import { DominantTableRegion } from "@/components/shared/DominantTableRegion";
import { analysisApi, contextHref, type InsightArtifact, useAnalysisContext } from "@/lib/analysis-workbench";
import { useTypedUrlState } from "@/lib/typed-url-state";
import { getPortfolios, type FreshnessState, type PortfolioSummary } from "@/lib/api";
import { portfolioLabApi, type CommandPortfolioSnapshot } from "@/lib/portfolio-lab";
import { SurfaceState } from "@/components/shared/SurfaceState";
import { AnalysisContextSaveState } from "@/components/shared/AnalysisContextSaveState";

const COMMAND_URL_KEYS = ["dataset", "selected", "portfolio"] as const;
type CommandDataset = "changes" | "positions" | "coverage" | "governance";

export default function CommandPage() {
  return (
    <RequireAuth>
      <CommandCenter />
    </RequireAuth>
  );
}

function CommandCenter() {
  const analysis = useAnalysisContext({ name: "Portfolio command" });
  const { roleView } = useRoleView();
  const { values: urlState, update: updateUrlState } = useTypedUrlState(COMMAND_URL_KEYS);
  const selected = urlState.selected;
  const requestedPortfolioId = urlState.portfolio;
  const requestedDataset = urlState.dataset as CommandDataset | null;
  const dataset: CommandDataset = requestedDataset && ["changes", "positions", "coverage", "governance"].includes(requestedDataset)
    ? requestedDataset
    : roleView === "qa" ? "governance" : roleView === "pm" ? "changes" : "coverage";
  const [insight, setInsight] = useState<InsightArtifact | null>(null);
  const [insightMessage, setInsightMessage] = useState<string | null>(null);
  const [portfolioDirectory, setPortfolioDirectory] = useState<PortfolioSummary[]>([]);
  const [portfolioDirectoryLoading, setPortfolioDirectoryLoading] = useState(true);
  const [portfolioDirectoryError, setPortfolioDirectoryError] = useState(false);
  const [commandSnapshot, setCommandSnapshot] = useState<CommandPortfolioSnapshot | null>(null);
  const [commandSnapshotLoading, setCommandSnapshotLoading] = useState(false);
  const [commandSnapshotError, setCommandSnapshotError] = useState(false);

  const portfolio = usePortfolio();

  useEffect(() => {
    let alive = true;
    setPortfolioDirectoryLoading(true);
    getPortfolios()
      .then((rows) => {
        if (!alive) return;
        setPortfolioDirectory(rows);
        setPortfolioDirectoryError(false);
      })
      .catch(() => {
        if (!alive) return;
        setPortfolioDirectory([]);
        setPortfolioDirectoryError(true);
      })
      .finally(() => { if (alive) setPortfolioDirectoryLoading(false); });
    return () => { alive = false; };
  }, []);

  const contextPortfolioId = analysis.context?.portfolio_scope ?? null;
  const selectedPortfolioId = requestedPortfolioId
    ? (portfolioDirectory.some((row) => row.id === requestedPortfolioId) ? requestedPortfolioId : null)
    : portfolioDirectory.some((row) => row.id === contextPortfolioId)
      ? contextPortfolioId
      : portfolioDirectory[0]?.id ?? null;
  const invalidRequestedPortfolio = Boolean(
    requestedPortfolioId && !portfolioDirectoryLoading && !selectedPortfolioId,
  );
  const selectedPortfolio = portfolioDirectory.find((row) => row.id === selectedPortfolioId) ?? null;

  useEffect(() => {
    if (!selectedPortfolioId) {
      setCommandSnapshot(null);
      setCommandSnapshotLoading(false);
      setCommandSnapshotError(false);
      return;
    }
    let alive = true;
    const load = () => {
      setCommandSnapshotLoading(true);
      portfolioLabApi.getCommandSnapshot(selectedPortfolioId)
        .then((snapshot) => {
          if (!alive) return;
          setCommandSnapshot(snapshot);
          setCommandSnapshotError(false);
        })
        .catch(() => {
          if (!alive) return;
          setCommandSnapshot(null);
          setCommandSnapshotError(true);
        })
        .finally(() => { if (alive) setCommandSnapshotLoading(false); });
    };
    load();
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      alive = false;
      window.removeEventListener("focus", onFocus);
    };
  }, [selectedPortfolioId]);

  useEffect(() => {
    if (!selectedPortfolioId || requestedPortfolioId || portfolioDirectoryLoading) return;
    updateUrlState({ portfolio: selectedPortfolioId }, "replace");
  }, [portfolioDirectoryLoading, requestedPortfolioId, selectedPortfolioId, updateUrlState]);
  // Shared CP-5/CP-0 governance queues and central freshness digest. When the
  // portfolio is offline, consumers retain their explicit seeded fallbacks.
  const { digest, live: digestLive, loading: digestLoading, error: digestError, liveQa, liveFailed, liveGapsItems, liveMixed } = useGovernanceSources(portfolio);
  const qaStatus = portfolio.loading ? "loading" : portfolio.error ? "error" : "ready";
  const digestStatus = digestLoading ? "loading" : digestError ? "error" : "ready";

  // Stable IDs keep duplicate/reused tickers from selecting the wrong issuer.
  const liveSelected = selected
    ? portfolio.rows.find((r) => r.issuer_id === selected) ?? null
    : null;
  const selectedCommandPosition = selected
    ? commandSnapshot?.positions.find((position) => position.id === selected) ?? null
    : null;
  const digestAsOf = digest?.as_of ? fmtUtcDateTime(digest.as_of) : null;
  const digestFreshnessState: FreshnessState | null = digest?.freshness
    ? digest.freshness.counts.stale > 0 ? "stale"
      : digest.freshness.counts.unknown > 0 ? "unknown"
        : digest.freshness.counts.due > 0 ? "due" : "current"
    : null;
  const digestFreshnessLabel = digestFreshnessState?.toUpperCase() as "CURRENT" | "DUE" | "STALE" | "UNKNOWN" | undefined;
  const digestAuthority = digestAsOf && digestFreshnessLabel ? {
    provenance: {
      origin: "LIVE" as const,
      method: "DERIVED" as const,
      freshness: digestFreshnessLabel,
      detail: `Central ${digest?.freshness?.policy_version} latest-run freshness roll-up.`,
      asOf: digestAsOf,
    },
    approval: "UNRATIFIED" as const,
  } : undefined;
  const commandDecision: DecisionContextState = {
    whatChanged: digestLoading
      ? { kind: "loading", message: "Checking 24-hour engine activity…" }
      : digestLive && digest && digestAsOf
        ? (Object.values(digest.activity_24h || {}).some((value) => typeof value === "number" && value > 0)
          ? {
              kind: "ready",
              value: `${Object.entries(digest.activity_24h || {}).filter(([, value]) => typeof value === "number" && value > 0).slice(0, 3).map(([key, value]) => `${value} ${key.replaceAll("_", " ")}`).join(" · ")} in 24h`,
              asOf: digestAsOf,
              authority: digestAuthority,
            }
          : { kind: "observed-empty", message: "No engine activity observed in 24h", asOf: digestAsOf, authority: digestAuthority })
        : { kind: "unavailable", message: "Live activity unavailable" },
    whyItMatters: digestLoading
      ? { kind: "loading", message: "Calculating portfolio impact…" }
      : digestLive && digest && digestAsOf && digest.warf != null
        ? { kind: "ready", value: `WARF ${digest.warf}${digest.warf_band ? ` (${digest.warf_band})` : ""} · CCC watch ${digest.ccc_watch.length}`, asOf: digestAsOf, authority: digestAuthority }
        : { kind: "unavailable", message: "Portfolio impact unavailable" },
    requiredAction: portfolio.loading
      ? { kind: "loading", message: "Checking governance queues…" }
      : portfolio.error
        ? { kind: "offline", lastKnown: "Governance queues unavailable" }
        : portfolio.fetchedAt
          ? {
              kind: "ready",
              value: `${(liveQa ?? []).length + (liveFailed ?? []).length} QA findings · ${(liveGapsItems ?? []).length} source gaps`,
              asOf: fmtUtcDateTime(portfolio.fetchedAt),
              authority: { provenance: { origin: "LIVE", method: "DERIVED", freshness: "CURRENT", detail: "Portfolio QA and source-gap roll-up." }, approval: "UNRATIFIED" },
            }
          : { kind: "unavailable", message: "Governance queue unavailable" },
    evidenceHealth: digestLoading
      ? { kind: "loading", message: "Checking evidence coverage…" }
      : digestLive && digest && digestAsOf && digest.freshness && digestFreshnessState
        ? digestFreshnessState === "stale"
          ? { kind: "stale", value: `${digest.freshness.counts.stale} stale · ${digest.freshness.counts.due} due · ${digest.freshness.counts.unknown} unknown · ${digest.freshness.counts.current} current`, asOf: digestAsOf, authority: digestAuthority }
          : digestFreshnessState === "current"
            ? { kind: "ready", value: `${digest.freshness.counts.current} current · no due, stale, or unknown runs`, asOf: digestAsOf, authority: digestAuthority }
            : { kind: "partial", value: `${digest.freshness.counts.stale} stale · ${digest.freshness.counts.due} due · ${digest.freshness.counts.unknown} unknown · ${digest.freshness.counts.current} current`, missingSources: digestFreshnessState === "unknown" ? ["unverified latest-run freshness"] : ["run refresh due"], asOf: digestAsOf, authority: digestAuthority }
        : { kind: "unavailable", message: "Central evidence freshness unavailable" },
  };

  const commandContext = analysis.context;
  const patchCommandContext = analysis.patch;
  useEffect(() => {
    const context = commandContext;
    if (!context) return;
    const current = context.surface_state.command;
    if (
      current?.active_id === selected
      && current?.view === dataset
      && current?.filters?.role === roleView
      && current?.filters?.portfolio_id === selectedPortfolioId
      && context.portfolio_scope === selectedPortfolioId
    ) return;
    void patchCommandContext({
      portfolio_scope: selectedPortfolioId,
      surface_state: {
        ...context.surface_state,
        command: {
          ...current,
          active_id: selected,
          view: dataset,
          filters: { ...current?.filters, role: roleView, portfolio_id: selectedPortfolioId },
        },
      },
    }).catch(() => undefined);
  }, [commandContext, dataset, patchCommandContext, roleView, selected, selectedPortfolioId]);

  useEffect(() => {
    if (!analysis.context?.id) return;
    let alive = true;
    analysisApi.listInsights(analysis.context.id, { surface: "command", kind: "decision-brief", limit: 20 })
      .then((page) => { if (alive) setInsight(page.current); })
      .catch(() => { if (alive) setInsightMessage("No cited decision brief is available."); });
    return () => { alive = false; };
  }, [analysis.context?.id]);

  const generateInsight = async () => {
    if (!analysis.context?.id) return;
    setInsightMessage("Generating cited decision brief…");
    try {
      const created = await analysisApi.createInsight(analysis.context.id, {
        surface: "command",
        kind: "decision-brief",
        subject_refs: { alert_event_id: selected },
        force: Boolean(insight),
      });
      if (created.status === "ready" || created.status === "ratified") {
        setInsight(created);
        setInsightMessage(null);
      } else {
        setInsightMessage(`Brief is ${created.status}.`);
      }
    } catch (reason) {
      setInsightMessage(reason instanceof Error ? reason.message : "Cited decision brief is unavailable.");
    }
  };

  const positionsContent = portfolioDirectoryLoading ? (
    <SurfaceState kind="loading" title="Loading portfolios" detail="Retrieving authorized persisted holdings." className="m-auto max-w-md" />
  ) : portfolioDirectoryError ? (
    <SurfaceState kind="offline" title="Portfolio directory unavailable" detail="Persisted holdings could not be loaded. No sample sleeve has been substituted." className="m-auto max-w-md" primaryAction={<Link href="/portfolios" className="caos-action-primary no-underline focus-ring">Open Portfolio Lab</Link>} />
  ) : invalidRequestedPortfolio ? (
    <SurfaceState kind="unavailable" title="Portfolio unavailable" detail="The requested portfolio is missing or outside your authorized scope." className="m-auto max-w-md" primaryAction={<button type="button" className="caos-action-primary focus-ring" onClick={() => updateUrlState({ portfolio: null, selected: null }, "replace")}>Open default portfolio</button>} />
  ) : portfolioDirectory.length === 0 ? (
    <SurfaceState kind="empty" title="No portfolio configured" detail="Create or import a persisted portfolio before reviewing held positions and posture." className="m-auto max-w-md" primaryAction={<Link href="/portfolios" className="caos-action-primary no-underline focus-ring">Create or open portfolio</Link>} />
  ) : commandSnapshotLoading && !commandSnapshot ? (
    <SurfaceState kind="loading" title="Loading holdings" detail={`Retrieving ${selectedPortfolio?.name ?? "selected portfolio"}.`} className="m-auto max-w-md" />
  ) : commandSnapshotError || !commandSnapshot ? (
    <SurfaceState kind="offline" title="Holdings unavailable" detail="The selected portfolio remains configured, but its positions could not be loaded." className="m-auto max-w-md" primaryAction={<Link href="/portfolios" className="caos-action-primary no-underline focus-ring">Open Portfolio Lab</Link>} />
  ) : commandSnapshot.positions.length === 0 ? (
    <SurfaceState kind="empty" title="No positions held" detail="This persisted portfolio contains no holdings. Upload holdings in Portfolio Lab." className="m-auto max-w-md" primaryAction={<Link href={`/portfolios?portfolio=${encodeURIComponent(commandSnapshot.portfolio.id)}`} className="caos-action-primary no-underline focus-ring">Add holdings</Link>} />
  ) : (
    <CommandPortfolioTable positions={commandSnapshot.positions} selected={selected} onSelect={(positionId) => updateUrlState({ selected: positionId }, "replace")} />
  );

  const narrowContract: NarrowContract = {
    essentialControls: (
      <div className="flex items-center gap-4 shrink-0 overflow-x-auto caos-no-scrollbar">
        {headStat("Positions", commandSnapshot ? String(commandSnapshot.position_count) : "—")}
        {/* M-6 honesty: a failed portfolio fetch must not read as a real 0/0 count */}
        {portfolio.error
          ? headStat("Live Coverage", "—", "var(--caos-warning)")
          : headStat("Live Coverage", `${portfolio.coveredCount}/${portfolio.issuerCount}`, "var(--caos-success)")}
      </div>
    ),
  };

  return (
    <EnterprisePage kind="overview"
      identity={
        <ShellIdentity
          badges={
            selectedPortfolio ? <span className="tabular text-caos-2xs uppercase tracking-wider whitespace-nowrap shrink-0 text-caos-muted">{selectedPortfolio.kind} · persisted</span> : null
          }
          title={selectedPortfolio?.name ?? "Portfolio command"}
        />
      }
      primaryAction={
        <button
          type="button"
          className="caos-primary-action focus-ring"
          onClick={() => {
            updateUrlState({ dataset: "changes", selected: null });
            requestAnimationFrame(() => {
              const el = document.getElementById("ranked-changes");
              el?.scrollIntoView({ behavior: "smooth" });
              (el as HTMLElement | null)?.focus();
            });
          }}
        >Open top change</button>
      }
      status={<><span className="tabular text-caos-2xs text-caos-muted">{commandSnapshot?.as_of ? `Holdings as of ${commandSnapshot.as_of}` : digestAsOf ? `Observed ${digestAsOf}` : "Holdings date unavailable"}</span><AnalysisContextSaveState analysis={analysis} /></>}
      contextualControls={
        <>
          {portfolioDirectory.length > 0 ? (
            <label className="flex items-center gap-2 tabular text-caos-2xs uppercase tracking-wider text-caos-muted">
              Portfolio
              <select
                aria-label="Selected portfolio"
                value={selectedPortfolioId ?? ""}
                onChange={(event) => updateUrlState({ portfolio: event.target.value || null, selected: null }, "replace")}
                className="h-7 max-w-56 rounded border border-caos-border bg-caos-bg px-2 text-caos-xs text-caos-text focus-ring"
              >
                {portfolioDirectory.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
              </select>
            </label>
          ) : null}
          {headStat("Positions", commandSnapshot ? String(commandSnapshot.position_count) : "—")}
          {portfolio.error
            ? headStat("Live Coverage", "—", "var(--caos-warning)")
            : headStat("Live Coverage", `${portfolio.coveredCount}/${portfolio.issuerCount}`, "var(--caos-success)")}
        </>
      }
      utilityLabel="Command utilities"
      utilityControls={
        <div className="grid gap-3">
          <Link href="/portfolios" className="caos-action-secondary no-underline focus-ring">Open Portfolio Lab</Link>
          {analysis.context ? <Link href={contextHref("/monitor", analysis.context.id)} className="caos-action-secondary no-underline focus-ring">Open Monitor</Link> : null}
        </div>
      }
      narrowContract={narrowContract}
    >
      {/* Decision header — cells populate from the LIVE digest + portfolio
          roll-ups only; offline they state "— no data" rather than promoting
          seeded sample counts into a decision strip (mock-vs-live seam). */}
      {/* workspace */}
      <div className="flex-1 min-h-0 gap-2 p-2 flex flex-col overflow-hidden">
        <WorkbenchToolbar
          title="Ranked changes & governance"
          description="Portfolio posture and governance queues beside the ranked-change worklist."
          count={portfolio.loading ? "Loading" : portfolio.error ? "Live coverage unavailable" : `${portfolio.coveredCount}/${portfolio.issuerCount} covered`}
          viewLabel={`View: ${roleView === "pm" ? "PM" : roleView === "qa" ? "QA" : "Analyst"}`}
          filters={
            <Link
              href={analysis.context ? contextHref("/query", analysis.context.id) : "/query"}
              className="caos-action-secondary no-underline focus-ring whitespace-nowrap"
            >
              Open cross-issuer Query
            </Link>
          }
        />
        <div id="ranked-changes" className="caos-persona-route command-workbench flex-1 min-h-0" tabIndex={-1}>
          <PersonaWorkbench
            surface="command"
            decision={<div className="grid gap-2"><DecisionHeader state={commandDecision} />{commandSnapshot && commandSnapshot.position_count > 0 ? <CommandPortfolioPosture counts={commandSnapshot.posture_counts} total={commandSnapshot.position_count} portfolioName={commandSnapshot.portfolio.name} /> : null}</div>}
            primary={
              <PanelShell
                title={dataset === "changes" ? "Ranked Changes · Watchtower draft" : dataset === "positions" ? "Persisted portfolio · positions" : dataset === "coverage" ? "Live Coverage" : "Governance · CP-5 / CP-0 / Staleness"}
                className="h-full min-h-0"
                right={<div role="tablist" aria-label="Command dataset" className="flex items-center gap-1 overflow-x-auto">
                  {([ ["Changes", "changes"], ["Positions", "positions"], ["Live coverage", "coverage"], ["Governance", "governance"] ] as const).map(([label, mode]) => <button key={mode} type="button" role="tab" aria-selected={dataset === mode} onClick={() => updateUrlState({ dataset: mode, selected: null })} className="caos-action-secondary focus-ring whitespace-nowrap">{label}</button>)}
                </div>}
              >
                {dataset === "changes" ? <RankedChanges /> : dataset === "governance" ? <GovernancePanel qaStatus={qaStatus} digestStatus={digestStatus} liveQa={liveQa} liveFailedGates={liveFailed} liveGaps={liveGapsItems} liveMixedOrigin={liveMixed} staleRows={digestLive ? digest?.stale ?? [] : []} /> : (
                  <DominantTableRegion ownerId="command-worklist" label={dataset === "positions" ? "Persisted portfolio positions" : "Live coverage worklist"} className="h-full min-h-0">
                    {dataset === "positions" ? positionsContent : portfolio.loading ? <SurfaceState kind="loading" title="Loading live coverage" className="m-auto max-w-md" /> : portfolio.error && portfolio.rows.length === 0 ? <SurfaceState kind="offline" title="Live coverage unavailable" detail="Latest-run coverage could not be loaded." className="m-auto max-w-md" /> : portfolio.rows.length === 0 ? <SurfaceState kind="empty" title="No live coverage" detail="No completed analytical runs are available." className="m-auto max-w-md" primaryAction={<Link href="/upload" className="caos-action-primary no-underline focus-ring">Start document intake</Link>} /> : <div className="overflow-x-auto h-full flex flex-col"><LiveCoverage rows={portfolio.rows} selected={selected} onSelect={(value) => updateUrlState({ selected: value }, "replace")} /></div>}
                  </DominantTableRegion>
                )}
              </PanelShell>
            }
            context={<CommandContext digest={digestLive ? digest : null} />}
            inspector={<div className="grid gap-2">
              <CommandGovernanceSummary qa={liveQa?.length} failed={liveFailed?.length} gaps={liveGapsItems?.length} mixed={liveMixed?.length} stale={digestLive ? digest?.stale?.length ?? 0 : undefined} onOpen={() => updateUrlState({ dataset: "governance" })} />
              <PanelShell title="Cited decision brief">
                <button type="button" onClick={() => void generateInsight()} className="caos-action-secondary focus-ring m-2">{insight ? "Refresh cited brief" : "Generate cited brief"}</button>
                {insight ? <article className="p-2 pt-0 grid gap-2"><p className="text-caos-sm text-caos-text">{insight.summary}</p><ul className="grid gap-1">{insight.claims.map((claim) => <li key={claim.id} className="text-caos-xs text-caos-muted">{claim.statement} · sources {claim.evidence_ids.join(", ") || "missing"}</li>)}</ul></article> : <p role="status" className="p-2 pt-0 text-caos-xs text-caos-muted">{insightMessage ?? "No cited brief generated."}</p>}
              </PanelShell>
            </div>}
          />
        </div>
      </div>

      {dataset === "positions" && selectedCommandPosition ? <CommandPositionStrip position={selectedCommandPosition} onClose={() => updateUrlState({ selected: null }, "replace")} /> : null}
      {dataset === "coverage" && liveSelected ? <IssuerStrip code={liveSelected.issuer_id} liveRow={liveSelected} onClose={() => updateUrlState({ selected: null }, "replace")} /> : null}
    </EnterprisePage>
  );
}

function CommandGovernanceSummary({ qa, failed, gaps, mixed, stale, onOpen }: { qa?: number; failed?: number; gaps?: number; mixed?: number; stale?: number; onOpen: () => void }) {
  const rows = [["CP-5 findings", qa], ["Failed gates", failed], ["Source gaps", gaps], ["Mixed origin", mixed], ["Stale sources", stale]] as const;
  return <PanelShell title="Governance summary"><dl className="grid gap-1 p-2">{rows.map(([label, value]) => <div key={label} className="flex items-center justify-between gap-3 border-b border-caos-border/40 py-1"><dt className="text-caos-xs text-caos-muted">{label}</dt><dd className="tabular text-caos-sm text-caos-text">{value ?? "Unavailable"}</dd></div>)}</dl><button type="button" onClick={onOpen} className="caos-action-secondary focus-ring m-2">Open governance queue</button></PanelShell>;
}

function CommandContext({ digest }: { digest: ReturnType<typeof useDigest>["digest"] | null }) {
  return <div className="grid gap-2">{digest ? <PanelShell title="Daily Digest · coverage & ratings" right={<span className="tabular text-caos-xs text-caos-success">● LIVE</span>}><DailyDigestPanel digest={digest} /></PanelShell> : <PanelShell title="Daily Digest"><p className="p-2 text-caos-xs text-caos-muted">Live coverage digest unavailable.</p></PanelShell>}</div>;
}
