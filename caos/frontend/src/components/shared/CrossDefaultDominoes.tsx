"use client";

// Cross-default dominoes — which tranches a single facility default pulls in
// (CP-3B tranche register × the CP-4C material-indebtedness threshold).
// Shared by Issuer Profile and Deep-Dive's Covenants tab (P3 wiring, WP-4
// G13) so the two surfaces read the identical live map, never two competing
// computations of the same contagion question. Fetched lazily; when the run
// extracted no threshold or tranches the server's own honest `note` renders
// instead of a fabricated map — same contract both callers rely on.

import { useEffect, useState } from "react";
import { Panel } from "@/components/shared/Panel";
import { getCrossDefaultMap, type CrossDefaultMap } from "@/lib/api";

function fmtMusd(value: number): string {
  return Math.abs(value) >= 1000 ? "$" + (value / 1000).toFixed(1) + "bn" : "$" + value.toFixed(0) + "m";
}

export function CrossDefaultDominoes({ issuerId, hasRun }: { issuerId: string; hasRun: boolean }) {
  const [map, setMap] = useState<CrossDefaultMap | null>(null);
  // Distinct from "no run yet" (hasRun=false, nothing fetched): a genuine fetch
  // failure (500/timeout/etc) must render an explicit error, not collapse to
  // the same silent nothing as "not applicable".
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!hasRun) return;
    let stale = false;
    setError(false);
    getCrossDefaultMap(issuerId)
      .then((d) => { if (!stale) setMap(d); })
      .catch(() => { if (!stale) setError(true); });
    return () => { stale = true; };
  }, [issuerId, hasRun]);

  if (!hasRun) return null;
  if (error) {
    return (
      <Panel title="Cross-default dominoes · CP-3B / CP-4C">
        <div className="px-3 py-2.5 text-caos-md text-caos-muted">Couldn’t load cross-default data.</div>
      </Panel>
    );
  }
  if (!map) return null;
  const computable = map.threshold_musd != null && map.dominoes.length > 0;
  return (
    <Panel
      title="Cross-default dominoes · CP-3B / CP-4C"
      right={map.threshold_musd != null
        ? <span className="tabular text-caos-2xs text-caos-muted">trips ≥ {fmtMusd(map.threshold_musd)}</span>
        : undefined}
    >
      {!computable ? (
        <div className="px-3 py-2.5 text-caos-md text-caos-muted">{map.note || "No domino map for this run."}</div>
      ) : (
        <div className="text-caos-md divide-y divide-caos-border/30">
          {map.dominoes.map((d) => (
            <div key={d.code} className="px-3 py-1.5 flex items-baseline gap-2 flex-wrap">
              <span className="tabular text-caos-sm text-caos-accent w-14 shrink-0">{d.code}</span>
              <span className="text-caos-text text-caos-md truncate flex-1 min-w-0">{d.tranche}</span>
              <span className="tabular text-caos-sm text-caos-muted shrink-0">
                {d.amount_musd != null ? fmtMusd(d.amount_musd) : "unsized"}
              </span>
              <span
                className="tabular text-caos-xs w-32 text-right shrink-0"
                style={{ color: d.trips_cross_default === true ? "var(--caos-critical)" : d.trips_cross_default === false ? "var(--caos-muted)" : "var(--caos-idle)" }}
              >
                {d.trips_cross_default === true
                  ? `⚠ pulls in ${d.pulls_in.length} tranche${d.pulls_in.length === 1 ? "" : "s"}`
                  : d.trips_cross_default === false ? "— below threshold" : "◦ not computable"}
              </span>
              {d.trips_cross_default === true && d.pulls_in.length > 0 ? (
                <div className="basis-full flex items-center gap-1 pl-16 flex-wrap">
                  {d.pulls_in.map((p) => (
                    <span
                      key={p}
                      className="tabular text-caos-3xs uppercase tracking-wider px-1.5 py-px rounded border whitespace-nowrap"
                      style={{ color: "var(--caos-critical)", borderColor: "color-mix(in srgb, var(--caos-critical) 40%, transparent)", background: "color-mix(in srgb, var(--caos-critical) 8%, transparent)" }}
                    >
                      {p}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
