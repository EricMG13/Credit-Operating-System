"use client";

import type { ReactNode } from "react";
import { StatusGlyph } from "./StatusGlyph";

export type SurfaceStateKind =
  | "loading"
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
  empty: { label: "No observed data", glyph: "idle", color: "var(--caos-muted)" },
  unavailable: { label: "Unavailable", glyph: "warning", color: "var(--caos-warning)" },
  stale: { label: "Stale", glyph: "warning", color: "var(--caos-warning)" },
  partial: { label: "Partial", glyph: "warning", color: "var(--caos-warning)" },
  offline: { label: "Offline", glyph: "held", color: "var(--caos-warning)" },
  error: { label: "Error", glyph: "critical", color: "var(--caos-critical-bright)" },
};

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
  compact = false,
  className = "",
}: {
  kind: SurfaceStateKind;
  title: string;
  detail?: string;
  supporting?: ReactNode;
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
  compact?: boolean;
  className?: string;
}) {
  const presentation = PRESENTATION[kind];
  const role = kind === "loading" ? "status" : kind === "error" || kind === "offline" ? "alert" : undefined;

  return (
    <section
      role={role}
      aria-live={kind === "loading" ? "polite" : undefined}
      className={
        "rounded-md border border-caos-border bg-caos-bg/45 " +
        (compact ? "px-2.5 py-2" : "px-3 py-3.5") +
        (className ? ` ${className}` : "")
      }
      data-surface-state={kind}
    >
      <div className="flex items-center gap-1.5 tabular text-caos-2xs uppercase tracking-wider" style={{ color: presentation.color }}>
        <StatusGlyph kind={presentation.glyph} size={10} className={kind === "loading" ? "caos-running" : ""} />
        <span>{presentation.label}</span>
      </div>
      <h3 className={(compact ? "mt-1 text-caos-md" : "mt-1.5 text-caos-lg") + " font-semibold text-caos-text"}>{title}</h3>
      {detail ? <p className={(compact ? "mt-0.5 text-caos-xs" : "mt-1 text-caos-md") + " leading-relaxed text-caos-muted"}>{detail}</p> : null}
      {supporting ? <div className="mt-2">{supporting}</div> : null}
      {primaryAction || secondaryAction ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {primaryAction}
          {secondaryAction}
        </div>
      ) : null}
    </section>
  );
}
