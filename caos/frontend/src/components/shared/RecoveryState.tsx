"use client";

import type { Provenance } from "@/lib/provenance";
import { ConclusionAuthority } from "./ConclusionAuthority";

export function RecoveryState({
  title,
  detail,
  preservedWork,
  fallback,
  onRetry,
  retryLabel = "Retry",
  onEscalate,
  escalationLabel = "Escalate",
}: {
  title: string;
  detail: string;
  preservedWork?: string;
  fallback?: { provenance: Provenance; approval?: "UNRATIFIED" | "RATIFIED" | "CONDITIONAL" | "DRAFT"; asOf?: string };
  onRetry?: () => void;
  retryLabel?: string;
  onEscalate?: () => void;
  escalationLabel?: string;
}) {
  return (
    <section role="alert" className="border border-caos-warning/50 bg-caos-warning/5 rounded-md p-3 space-y-2">
      <div>
        <h3 className="text-caos-lg font-semibold text-caos-text">{title}</h3>
        <p className="mt-1 text-caos-md leading-relaxed text-caos-muted">{detail}</p>
      </div>
      {preservedWork ? (
        <p className="tabular text-caos-xs text-caos-text">Preserved: {preservedWork}</p>
      ) : null}
      {fallback ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">Fallback data</span>
          <ConclusionAuthority prov={{ ...fallback.provenance, asOf: fallback.asOf ?? fallback.provenance.asOf }} approval={fallback.approval} />
        </div>
      ) : null}
      {onRetry || onEscalate ? (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {onRetry ? (
            <button type="button" onClick={onRetry} className="caos-action-primary focus-ring">{retryLabel}</button>
          ) : null}
          {onEscalate ? (
            <button type="button" onClick={onEscalate} className="caos-action-secondary focus-ring">{escalationLabel}</button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
