"use client";

import type { ReactNode } from "react";
import { StatusGlyph } from "./StatusGlyph";

export type SurfaceStateKind =
  | "loading"
  | "checking"
  | "not-run"
  | "empty"
  | "unavailable"
  | "stale"
  | "partial"
  | "offline"
  | "error";

const PRESENTATION: Record<
  SurfaceStateKind,
  { label: string; glyph: Parameters<typeof StatusGlyph>[0]["kind"]; color: string }
> = {
  loading: { label: "Loading", glyph: "running", color: "var(--caos-accent)" },
  // Distinct from "loading": a lightweight status probe (e.g. a key-posture
  // check) rather than a data fetch — same running glyph, lighter word, so a
  // caller isn't forced into either "no data yet" copy or a full loading
  // sentence for a check that resolves to a simple ready/not-ready fact.
  checking: { label: "Checking", glyph: "running", color: "var(--caos-accent)" },
  // Distinct from "empty": a real check ran and found nothing (empty) vs
  // nothing has been attempted yet (not-run). Collapsing them into one
  // "empty" state is what let a still-loading fetch assert "no versioned
  // dossier exists" as if the absence had been verified — this kind is for
  // the genuinely-correct "nothing has run" case, never a stand-in for
  // "loading" or "empty".
  "not-run": { label: "Not yet run", glyph: "idle", color: "var(--caos-muted)" },
  empty: { label: "No observed data", glyph: "idle", color: "var(--caos-muted)" },
  unavailable: { label: "Unavailable", glyph: "warning", color: "var(--caos-warning)" },
  stale: { label: "Stale", glyph: "warning", color: "var(--caos-warning)" },
  partial: { label: "Partial", glyph: "warning", color: "var(--caos-warning)" },
  offline: { label: "Offline", glyph: "held", color: "var(--caos-warning)" },
  error: { label: "Error", glyph: "critical", color: "var(--caos-critical-bright)" },
};

type SurfaceStateProps = {
  kind: SurfaceStateKind;
  title: string;
  detail?: string;
  supporting?: ReactNode;
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
  headingLevel?: 2 | 3 | 4;
  compact?: boolean;
  className?: string;
};

const HEADINGS = { 2: "h2", 3: "h3", 4: "h4" } as const;
const LIVE_STATES = new Set<SurfaceStateKind>(["loading", "checking"]);
const ALERT_STATES = new Set<SurfaceStateKind>(["error", "offline"]);

function surfaceSemantics(kind: SurfaceStateKind) {
  const live = LIVE_STATES.has(kind);
  return { live, role: live ? "status" : ALERT_STATES.has(kind) ? "alert" : undefined } as const;
}

function surfaceClassName(compact: boolean, className: string): string {
  const spacing = compact ? "px-2.5 py-2" : "px-3 py-3.5";
  return `min-w-0 rounded-md border border-caos-border bg-caos-bg/45 ${spacing}${className ? ` ${className}` : ""}`;
}

function SurfaceStateStatus({ kind, live }: { kind: SurfaceStateKind; live: boolean }) {
  const presentation = PRESENTATION[kind];
  return (
    <div className="flex items-center gap-1.5 tabular text-caos-2xs uppercase tracking-wider" style={{ color: presentation.color }}>
      <StatusGlyph kind={presentation.glyph} size={10} className={live ? "caos-running" : ""} />
      <span>{presentation.label}</span>
    </div>
  );
}

function SurfaceStateBody({ detail, supporting, primaryAction, secondaryAction, compact }: Pick<SurfaceStateProps, "detail" | "supporting" | "primaryAction" | "secondaryAction"> & { compact: boolean }) {
  return (
    <>
      {detail ? <p className={(compact ? "mt-0.5" : "mt-1") + " max-w-[70ch] text-caos-md leading-relaxed text-caos-muted text-pretty [overflow-wrap:anywhere]"}>{detail}</p> : null}
      {supporting ? <div className="mt-2">{supporting}</div> : null}
      {primaryAction || secondaryAction ? <div className="mt-2.5 flex flex-wrap items-center gap-2">{primaryAction}{secondaryAction}</div> : null}
    </>
  );
}

/**
 * Shared, presentation-only contract for non-happy-path surface states.
 * Callers retain authority over the state kind, copy, and recovery actions;
 * this component never infers live, ratified, or actionable status.
 */
export function SurfaceState({
  kind,
  title,
  detail,
  supporting,
  primaryAction,
  secondaryAction,
  headingLevel = 3,
  compact = false,
  className = "",
}: SurfaceStateProps) {
  const semantics = surfaceSemantics(kind);
  const Heading = HEADINGS[headingLevel];

  return (
    <section
      role={semantics.role}
      aria-live={semantics.live ? "polite" : undefined}
      className={surfaceClassName(compact, className)}
      data-surface-state={kind}
    >
      <SurfaceStateStatus kind={kind} live={semantics.live} />
      <Heading className={(compact ? "mt-1 text-caos-xl" : "mt-1.5 text-caos-metric") + " font-semibold leading-tight text-caos-text text-balance [overflow-wrap:anywhere]"}>{title}</Heading>
      <SurfaceStateBody detail={detail} supporting={supporting} primaryAction={primaryAction} secondaryAction={secondaryAction} compact={compact} />
    </section>
  );
}
