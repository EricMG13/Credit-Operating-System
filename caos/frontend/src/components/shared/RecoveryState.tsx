"use client";

import type { Provenance } from "@/lib/provenance";
import { ConclusionAuthority } from "./ConclusionAuthority";
import { SurfaceState } from "./SurfaceState";

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
    <SurfaceState
      kind="unavailable"
      title={title}
      detail={detail}
      supporting={
        preservedWork || fallback ? (
          <div className="space-y-2">
            {preservedWork ? <p className="tabular text-caos-xs text-caos-text">Preserved: {preservedWork}</p> : null}
            {fallback ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">Fallback data</span>
                <ConclusionAuthority prov={{ ...fallback.provenance, asOf: fallback.asOf ?? fallback.provenance.asOf }} approval={fallback.approval} />
              </div>
            ) : null}
          </div>
        ) : undefined
      }
      primaryAction={onRetry ? <button type="button" onClick={onRetry} className="caos-action-primary focus-ring">{retryLabel}</button> : undefined}
      secondaryAction={onEscalate ? <button type="button" onClick={onEscalate} className="caos-action-secondary focus-ring">{escalationLabel}</button> : undefined}
    />
  );
}
