"use client";

import { useEffect, useState } from "react";
import { activeFindings, analysisApi, type AuthorityEnvelope, type Finding } from "@/lib/analysis-workbench";
import { fmtUtcDateTime } from "@/lib/format-date";

export function AnalysisStateBadge({ state }: { state: string }) {
  const glyph = state === "ready" ? "✓" : state === "error" ? "✕" : state === "running" || state === "queued" ? "◌" : "△";
  const tone = state === "ready" ? "var(--caos-success)" : state === "error" ? "var(--caos-critical)" : "var(--caos-warning)";
  return (
    <span className="inline-flex items-center gap-1 tabular text-caos-2xs uppercase tracking-wider" style={{ color: tone }}>
      <span aria-hidden="true">{glyph}</span>{state.replace("-", " ")}
    </span>
  );
}

export function AuthorityLine({ authority }: { authority: AuthorityEnvelope }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 tabular text-caos-2xs uppercase tracking-wider text-caos-muted" role="note">
      <span style={{ color: authority.origin === "live" ? "var(--caos-success)" : "var(--caos-accent)" }}>
        {authority.origin}
      </span>
      <span>{authority.method}</span>
      <span>{authority.freshness}</span>
      <span>{authority.approval_state}</span>
      {authority.as_of ? <span>as of {fmtUtcDateTime(authority.as_of)}</span> : null}
      {authority.run_id ? <span>run {authority.run_id.slice(0, 8)}</span> : null}
    </div>
  );
}

export function FindingsTray({ contextId, refreshKey = 0 }: { contextId: string; refreshKey?: number }) {
  const [findings, setFindings] = useState<Finding[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [unpinError, setUnpinError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    analysisApi.listFindings(contextId)
      .then((rows) => { if (!cancelled) setFindings(activeFindings(rows)); })
      .catch(() => { if (!cancelled) setError("Findings unavailable"); });
    return () => { cancelled = true; };
  }, [contextId, refreshKey]);

  const unpin = (id: string) => {
    setUnpinError(null);
    analysisApi.archiveFinding(id)
      .then(() => setFindings((rows) => rows.filter((finding) => finding.id !== id)))
      .catch(() => setUnpinError("Unpin failed — the finding is unchanged. Retry."));
  };

  return (
    <section className="border border-caos-border rounded-md bg-caos-panel min-h-0 flex flex-col" aria-label="Findings tray">
      <div className="flex items-center gap-2 border-b border-caos-border px-3 py-2">
        <h2 className="tabular text-caos-xs font-semibold uppercase tracking-widest text-caos-text">Findings tray</h2>
        <span className="ml-auto tabular text-caos-2xs text-caos-muted">{findings.length} pinned</span>
      </div>
      <div className="min-h-0 overflow-auto p-2">
        {error ? <p className="text-caos-xs text-caos-critical">{error}</p> : null}
        {unpinError ? <p role="alert" className="p-2 text-caos-xs text-caos-critical">{unpinError}</p> : null}
        {!error && !findings.length ? <p className="p-2 text-caos-xs text-caos-muted">Pin a cited answer, sector risk or RV pitch once; downstream surfaces consume the same finding.</p> : null}
        <ol className="space-y-1">
          {findings.map((finding) => (
            <li key={finding.id} className="rounded-sm border border-caos-border/70 bg-caos-bg/40 p-2">
              <div className="flex items-center gap-2">
                <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-accent">{finding.source_surface}</span>
                <span className="ml-auto tabular text-caos-2xs uppercase text-caos-muted">{finding.status}</span>
                <button
                  type="button"
                  onClick={() => unpin(finding.id)}
                  className="tabular text-caos-2xs text-caos-muted underline-offset-2 hover:text-caos-text hover:underline transition-caos focus-ring"
                  aria-label={`Unpin finding: ${finding.title}`}
                >
                  Unpin
                </button>
              </div>
              <p className="mt-1 text-caos-xs font-semibold text-caos-text">{finding.title}</p>
              {finding.body ? <p className="mt-1 text-caos-xs leading-relaxed text-caos-muted line-clamp-3">{finding.body}</p> : null}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
