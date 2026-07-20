"use client";

import { useEffect, useState } from "react";
import { activeFindings, analysisApi, type AnalysisContext, type Finding } from "@/lib/analysis-workbench";

/** Compact cross-route continuity bar. Enterprise surfaces reserve its collapsed
 * geometry while context resolves; ownership is re-checked by both APIs. */
export function AnalysisContextStrip() {
  const [context, setContext] = useState<AnalysisContext | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [unavailable, setUnavailable] = useState(false);
  const [contextFree, setContextFree] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const load = (id: string) => {
      setContextFree(false);
      setUnavailable(false);
      Promise.all([analysisApi.getContext(id), analysisApi.listFindings(id)])
        .then(([nextContext, nextFindings]) => {
          if (!cancelled) { setContext(nextContext); setFindings(activeFindings(nextFindings)); }
        })
        .catch(() => { if (!cancelled) setUnavailable(true); });
    };
    const initialUrl = new URL(window.location.href);
    const initialId = initialUrl.searchParams.get("context");
    if (initialId) load(initialId);
    else if (initialUrl.pathname === "/settings") setContextFree(true);
    const onContext = (event: Event) => {
      const detail = (event as CustomEvent<AnalysisContext>).detail;
      if (detail?.id) load(detail.id);
    };
    const onContextError = () => {
      setContext(null);
      setFindings([]);
      setUnavailable(true);
    };
    window.addEventListener("caos:analysis-context", onContext);
    window.addEventListener("caos:analysis-context-error", onContextError);
    return () => {
      cancelled = true;
      window.removeEventListener("caos:analysis-context", onContext);
      window.removeEventListener("caos:analysis-context-error", onContextError);
    };
  }, []);

  if (!context && contextFree) {
    return (
      <div
        role="status"
        className="flex min-h-12 shrink-0 items-center border-b border-caos-border bg-caos-info-surface/20 px-3 md:min-h-8"
      >
        <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">Workspace configuration · no analysis context</span>
      </div>
    );
  }
  if (!context && !unavailable) {
    return (
      <div
        role="status"
        aria-busy="true"
        className="flex min-h-12 shrink-0 items-center border-b border-caos-border bg-caos-info-surface/20 px-3 md:min-h-8"
      >
        <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">Analysis context · resolving</span>
      </div>
    );
  }
  if (unavailable) {
    return <div role="alert" className="flex min-h-12 shrink-0 items-center overflow-hidden border-b border-caos-critical/40 bg-caos-critical/5 px-3 tabular text-caos-2xs uppercase tracking-wider text-caos-critical md:min-h-8"><span className="truncate">Analysis context unavailable or not owned by this analyst.</span></div>;
  }
  if (!context) return null;
  const summaryTitle = `Active analysis · ${context.name} · ${context.sector_id ?? "cross-coverage"} · ${findings.length} findings`;
  return (
    <details className="shrink-0 border-b border-caos-border bg-caos-info-surface/40">
      <summary
        className="flex min-h-12 cursor-pointer items-center gap-2 overflow-hidden whitespace-nowrap px-3 tabular text-caos-xs text-caos-text focus-ring md:min-h-8"
        title={summaryTitle}
      >
        <span className="shrink-0 uppercase tracking-wider text-caos-accent">Active analysis</span>
        <span className="min-w-0 truncate">{context.name}</span>
        <span className="ml-auto shrink-0 text-caos-muted"><span className="hidden sm:inline">{context.sector_id ?? "cross-coverage"} · </span>{findings.length} findings</span>
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
