"use client";

import { useEffect, useState } from "react";
import { analysisApi, type AnalysisContext, type Finding } from "@/lib/analysis-workbench";

/** Compact cross-route continuity bar. It appears only when a `?context=`
 * handoff is active; ownership is re-checked by both APIs on every route. */
export function AnalysisContextStrip() {
  const [context, setContext] = useState<AnalysisContext | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const load = (id: string) => {
      setUnavailable(false);
      Promise.all([analysisApi.getContext(id), analysisApi.listFindings(id)])
        .then(([nextContext, nextFindings]) => {
          if (!cancelled) { setContext(nextContext); setFindings(nextFindings); }
        })
        .catch(() => { if (!cancelled) setUnavailable(true); });
    };
    const initialId = new URLSearchParams(window.location.search).get("context");
    if (initialId) load(initialId);
    const onContext = (event: Event) => {
      const detail = (event as CustomEvent<AnalysisContext>).detail;
      if (detail?.id) load(detail.id);
    };
    window.addEventListener("caos:analysis-context", onContext);
    return () => {
      cancelled = true;
      window.removeEventListener("caos:analysis-context", onContext);
    };
  }, []);

  if (!context && !unavailable) return null;
  if (unavailable) {
    return <div role="alert" className="shrink-0 border-b border-caos-critical/40 bg-caos-critical/5 px-3 py-1.5 tabular text-caos-2xs uppercase tracking-wider text-caos-critical">Analysis context unavailable or not owned by this analyst.</div>;
  }
  if (!context) return null;
  return (
    <details className="shrink-0 border-b border-caos-border bg-caos-info-surface/40">
      <summary className="min-h-8 cursor-pointer px-3 py-1.5 tabular text-caos-xs text-caos-text focus-ring">
        <span className="uppercase tracking-wider text-caos-accent">Active analysis</span>
        <span className="ml-2">{context.name}</span>
        <span className="ml-2 text-caos-muted">{context.sector_id ?? "cross-coverage"} · {findings.length} findings</span>
      </summary>
      <div className="grid gap-2 border-t border-caos-border/70 px-3 py-2 md:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
          <p className="text-caos-xs text-caos-muted">Issuer scope {context.issuer_ids.length} · instrument scope {context.instrument_ids.length} · as of {context.as_of ?? "not fixed"}</p>
          {findings.length ? <p className="mt-1 truncate text-caos-xs text-caos-text">Latest finding · {findings[0].title}</p> : <p className="mt-1 text-caos-xs text-caos-muted">No findings pinned yet.</p>}
        </div>
        <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">Context {context.id.slice(0, 8)}</span>
      </div>
    </details>
  );
}
