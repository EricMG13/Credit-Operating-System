"use client";

import Link from "next/link";
import { AnalysisStateBadge } from "@/components/shared/AnalysisWorkbench";
import { DominantTableRegion } from "@/components/shared/DominantTableRegion";
import { IssuerLink } from "@/components/shared/IssuerLink";
import { contextHref, type SectorReviewV2 } from "@/lib/analysis-workbench";

export type SectorReviewTab = "overview" | "signals" | "comparables" | "early-warning" | "risks" | "sources";

export const SECTOR_REVIEW_TABS: Array<{ id: SectorReviewTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "signals", label: "Signals" },
  { id: "comparables", label: "Comparables" },
  { id: "early-warning", label: "Early Warning" },
  { id: "risks", label: "Risks" },
  { id: "sources", label: "Sources" },
];

function EmptyPanel() {
  return (
    <div className="grid h-full place-items-center p-6 text-center text-caos-sm text-caos-muted">
      No versioned dossier exists for this context. Request a refresh to create a draft without replacing any prior published review.
    </div>
  );
}

function OverviewPanel({
  review,
  selectedSection,
  onSelectSection,
}: {
  review: SectorReviewV2;
  selectedSection: string | null;
  onSelectSection: (sectionId: string) => void;
}) {
  return (
    <div className="space-y-3">
      <section className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {review.dimension_scores.map((score) => (
          <article key={score.id} className="rounded-md border border-caos-border bg-caos-panel p-3">
            <div className="flex items-center gap-2">
              <h3 className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">{score.label}</h3>
              <span className="ml-auto tabular text-caos-sm font-semibold text-caos-text">{score.score ?? "—"}</span>
            </div>
            <p className="mt-2 text-caos-xs text-caos-warning">{score.missing_dependency ?? `${Math.round(score.confidence * 100)}% confidence`}</p>
          </article>
        ))}
      </section>
      <section className="rounded-md border border-caos-border bg-caos-panel">
        <div className="border-b border-caos-border px-3 py-2">
          <h2 className="tabular text-caos-xs font-semibold uppercase tracking-widest text-caos-text">Seven-section dossier</h2>
        </div>
        <ol>
          {review.sections.map((section) => (
            <li key={section.id}>
              <button
                type="button"
                onClick={() => onSelectSection(section.id)}
                className={`grid w-full grid-cols-[1fr_auto] gap-3 border-t border-caos-border/70 px-3 py-3 text-left first:border-t-0 focus-ring ${selectedSection === section.id ? "bg-caos-info-surface" : "hover:bg-caos-elevated/30"}`}
              >
                <span>
                  <span className="text-caos-sm font-semibold text-caos-text">{section.title}</span>
                  <span className="mt-1 block text-caos-xs leading-relaxed text-caos-muted">{section.summary}</span>
                </span>
                <span className="tabular text-caos-2xs uppercase text-caos-muted">{review.ratifications[section.id] ?? section.freshness}</span>
              </button>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function SignalsPanel({ review }: { review: SectorReviewV2 }) {
  return (
    <div className="space-y-2">
      {review.early_warning.map((signal) => (
        <article key={signal.id} className="rounded-md border border-caos-border bg-caos-panel p-3">
          <div className="flex items-center gap-2">
            <AnalysisStateBadge state={signal.status === "breached" ? "error" : signal.status === "watch" ? "partial" : "ready"} />
            <h3 className="text-caos-sm font-semibold text-caos-text">{signal.indicator}</h3>
          </div>
          <p className="mt-2 tabular text-caos-xs text-caos-muted">{signal.current_state} · threshold {signal.threshold}</p>
        </article>
      ))}
    </div>
  );
}

function ComparablesPanel({ review }: { review: SectorReviewV2 }) {
  return (
    <DominantTableRegion ownerId="sector-comparables" label="Sector comparables" className="rounded-md border border-caos-border">
      <table className="w-full tabular text-caos-xs">
        <thead className="sticky top-0 bg-caos-panel text-caos-muted"><tr><th className="px-3 py-2 text-left">Issuer</th><th className="px-3 py-2 text-left">Posture</th><th className="px-3 py-2 text-left">Decision gaps</th></tr></thead>
        <tbody>
          {review.comparables.map((item) => (
            <tr key={item.issuer_id ?? item.issuer_name} className="border-t border-caos-border">
              <td className="px-3 py-2 font-semibold text-caos-text">{item.issuer_id ? <IssuerLink issuer={{ id: item.issuer_id }}>{item.issuer_name}</IssuerLink> : item.issuer_name}</td>
              <td className="px-3 py-2 text-caos-muted">{item.posture}</td>
              <td className="px-3 py-2 text-caos-warning">{item.missing_dependencies.join(" · ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </DominantTableRegion>
  );
}

function EarlyWarningPanel({ review }: { review: SectorReviewV2 }) {
  return (
    <div className="space-y-2">
      {review.early_warning.map((item) => (
        <article key={item.id} className="grid gap-2 rounded-md border border-caos-border bg-caos-panel p-3 md:grid-cols-[1fr_auto]">
          <div><h3 className="text-caos-sm font-semibold text-caos-text">{item.indicator}</h3><p className="mt-1 text-caos-xs text-caos-muted">Threshold · {item.threshold}</p></div>
          <span className="tabular text-caos-xs uppercase text-caos-warning">{item.status} · {item.current_state}</span>
        </article>
      ))}
    </div>
  );
}

function RisksPanel({ review }: { review: SectorReviewV2 }) {
  return (
    <div className="space-y-2">
      {review.risks.map((risk) => (
        <article key={risk.id} className="rounded-md border border-caos-border bg-caos-panel p-3">
          <div className="flex items-center gap-2"><span className="tabular text-caos-2xs uppercase text-caos-warning">{risk.severity}</span><h3 className="text-caos-sm font-semibold text-caos-text">{risk.title}</h3><span className="ml-auto tabular text-caos-2xs uppercase text-caos-muted">Likelihood {risk.likelihood}</span></div>
          <p className="mt-2 text-caos-xs text-caos-muted">Residual risk · {risk.residual_risk}</p>
        </article>
      ))}
    </div>
  );
}

function SourcesPanel({ review, contextId }: { review: SectorReviewV2; contextId?: string }) {
  return (
    <div className="space-y-3">
      <section className="rounded-md border border-caos-border bg-caos-panel">
        <div className="border-b border-caos-border px-3 py-2"><h2 className="tabular text-caos-xs font-semibold uppercase tracking-widest text-caos-text">Source register</h2></div>
        <ol>{review.source_register.map((source) => <li key={source.id} className="border-t border-caos-border/70 px-3 py-2 first:border-t-0"><div className="flex flex-wrap items-center gap-2"><span className="text-caos-xs font-semibold text-caos-text">{source.title}</span><span className="ml-auto tabular text-caos-2xs uppercase text-caos-muted">{source.origin} · {source.freshness}</span></div><p className="mt-1 tabular text-caos-2xs text-caos-muted">{source.id}</p></li>)}</ol>
      </section>
      <section className="rounded-md border border-caos-warning/50 bg-caos-warning/5 p-3">
        <h2 className="tabular text-caos-xs font-semibold uppercase tracking-widest text-caos-warning">Contradictions and uncertainty</h2>
        <ol className="mt-2 space-y-2">{review.uncertainties.map((item) => <li key={item.id} className="text-caos-xs text-caos-text">△ {item.statement}<span className="block pl-4 text-caos-muted">{item.impact}</span></li>)}</ol>
        {contextId ? <Link href={contextHref("/monitor", contextId, { focus: "source-gaps" })} className="caos-action-secondary mt-3 focus-ring no-underline">Route gaps to QA</Link> : null}
      </section>
    </div>
  );
}

export function SectorReviewContent({
  review,
  tab,
  selectedSection,
  onSelectSection,
  contextId,
}: {
  review: SectorReviewV2 | null;
  tab: SectorReviewTab;
  selectedSection: string | null;
  onSelectSection: (sectionId: string) => void;
  contextId?: string;
}) {
  if (!review) return <EmptyPanel />;
  switch (tab) {
    case "overview": return <OverviewPanel review={review} selectedSection={selectedSection} onSelectSection={onSelectSection} />;
    case "signals": return <SignalsPanel review={review} />;
    case "comparables": return <ComparablesPanel review={review} />;
    case "early-warning": return <EarlyWarningPanel review={review} />;
    case "risks": return <RisksPanel review={review} />;
    case "sources": return <SourcesPanel review={review} contextId={contextId} />;
  }
}
