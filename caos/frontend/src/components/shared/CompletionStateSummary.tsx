"use client";

import { StatusGlyph } from "./StatusGlyph";

export type CompletionExecution = "not-started" | "queued" | "running" | "complete" | "failed";
export type CompletionPersistence = "unsaved" | "draft" | "partial" | "saved" | "published";
export type CompletionApproval = "unratified" | "conditional" | "ratified";
export type CompletionFreshness = "current" | "stale" | "unknown";
export type CompletionNotApplicable = "not-applicable";

type AxisView = {
  label: string;
  glyph: Parameters<typeof StatusGlyph>[0]["kind"];
  color: string;
};

const VIEW: Record<
  CompletionExecution | CompletionPersistence | CompletionApproval | CompletionFreshness | CompletionNotApplicable,
  AxisView
> = {
  "not-started": { label: "Not started", glyph: "idle", color: "var(--caos-muted)" },
  queued: { label: "Queued", glyph: "held", color: "var(--caos-accent)" },
  running: { label: "Running", glyph: "running", color: "var(--caos-accent)" },
  complete: { label: "Complete", glyph: "success", color: "var(--caos-success)" },
  failed: { label: "Failed", glyph: "critical", color: "var(--caos-critical-bright)" },
  unsaved: { label: "Unsaved", glyph: "warning", color: "var(--caos-warning)" },
  draft: { label: "Draft", glyph: "idle", color: "var(--caos-muted)" },
  partial: { label: "Partial", glyph: "warning", color: "var(--caos-warning)" },
  saved: { label: "Saved", glyph: "success", color: "var(--caos-success)" },
  published: { label: "Published", glyph: "success", color: "var(--caos-success)" },
  unratified: { label: "Unratified", glyph: "warning", color: "var(--caos-warning)" },
  conditional: { label: "Conditional", glyph: "warning", color: "var(--caos-warning)" },
  ratified: { label: "Ratified", glyph: "success", color: "var(--caos-success)" },
  current: { label: "Current", glyph: "success", color: "var(--caos-success)" },
  stale: { label: "Stale", glyph: "critical", color: "var(--caos-critical-bright)" },
  unknown: { label: "Unknown", glyph: "idle", color: "var(--caos-muted)" },
  "not-applicable": { label: "N/A", glyph: "idle", color: "var(--caos-muted)" },
};

export interface CompletionStateSummaryProps {
  label: string;
  execution: CompletionExecution | CompletionNotApplicable;
  persistence: CompletionPersistence | CompletionNotApplicable;
  approval: CompletionApproval | CompletionNotApplicable;
  freshness: CompletionFreshness | CompletionNotApplicable;
  className?: string;
}

function CompletionAxis({ axis, value }: { axis: string; value: keyof typeof VIEW }) {
  const view = VIEW[value];
  const shortAxis = axis === "Execution" ? "Exec" : axis === "Persistence" ? "Persist" : axis === "Approval" ? "Approval" : "Fresh";
  return (
    <div role="group" aria-label={`${axis}: ${view.label}`} className="flex min-w-0 items-center gap-1.5 px-2 py-1" data-completion-axis={axis}>
      <span aria-hidden="true" className="tabular text-caos-3xs uppercase tracking-wider text-caos-muted">
        <span className="xl:hidden">{shortAxis}</span>
        <span className="hidden xl:inline">{axis}</span>
      </span>
      <span className="inline-flex min-w-0 items-center gap-1 tabular text-caos-2xs uppercase whitespace-nowrap" style={{ color: view.color }}>
        <StatusGlyph kind={view.glyph} size={9} className={value === "running" ? "caos-running" : ""} />
        <span>{view.label}</span>
      </span>
    </div>
  );
}

/**
 * Presentation-only completion grammar. Every axis is passed independently by
 * the caller; execution completion never promotes persistence, approval, or
 * freshness inside this component.
 */
export function CompletionStateSummary({
  label,
  execution,
  persistence,
  approval,
  freshness,
  className = "",
}: CompletionStateSummaryProps) {
  return (
    <div
      role="group"
      aria-label={label}
      data-execution={execution}
      data-persistence={persistence}
      data-approval={approval}
      data-freshness={freshness}
      className={`m-0 flex min-w-0 flex-wrap items-center divide-x divide-caos-border rounded border border-caos-border bg-caos-bg/55${className ? ` ${className}` : ""}`}
    >
      <CompletionAxis axis="Execution" value={execution} />
      <CompletionAxis axis="Persistence" value={persistence} />
      <CompletionAxis axis="Approval" value={approval} />
      <CompletionAxis axis="Freshness" value={freshness} />
    </div>
  );
}
