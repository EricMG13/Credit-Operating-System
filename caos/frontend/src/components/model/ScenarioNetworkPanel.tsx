"use client";

import { useState } from "react";
import { propagateScenario, type ScenarioPropagationResult } from "@/lib/api";
import { StatusGlyph } from "@/components/shared/StatusGlyph";
import { SurfaceState } from "@/components/shared/SurfaceState";

const STATUS = {
  computed: { glyph: "success" as const, label: "COMPUTED", color: "var(--caos-success)" },
  degraded: { glyph: "warning" as const, label: "DEGRADED", color: "var(--caos-warning)" },
  "no-data": { glyph: "idle" as const, label: "NO DATA", color: "var(--caos-muted)" },
};

export function ScenarioNetworkPanel({ issuerId, runId }: { issuerId: string; runId: string | null }) {
  const [ebitdaPct, setEbitdaPct] = useState(-20);
  const [rateBps, setRateBps] = useState(0);
  const [result, setResult] = useState<ScenarioPropagationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const run = async () => {
    if (!runId || busy) return;
    setBusy(true); setError(false);
    try {
      setResult(await propagateScenario({ issuer_id: issuerId, run_id: runId, ebitda_pct: ebitdaPct / 100, rate_bps: rateBps }));
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="border-t border-caos-border pt-2" aria-labelledby="scenario-network-title">
      <h3 id="scenario-network-title" className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">
        Scenario network · cross-module propagation
      </h3>
      {!runId ? (
        <SurfaceState
          kind="unavailable"
          title="Completed run required"
          detail="Run the issuer analysis before propagating a scenario across modules."
          compact
          className="mt-2"
        />
      ) : (
        <div className="mt-2 flex items-center justify-end gap-2 flex-wrap">
          <label className="tabular text-caos-2xs text-caos-muted">
            EBITDA %
            <input type="number" min={-90} max={50} value={ebitdaPct} onChange={(e) => setEbitdaPct(Number(e.target.value))} className="ml-1 w-14 rounded border border-caos-border bg-caos-bg px-1 py-0.5 text-caos-text focus-ring" />
          </label>
          <label className="tabular text-caos-2xs text-caos-muted">
            RATE BP
            <input type="number" min={-500} max={1000} value={rateBps} onChange={(e) => setRateBps(Number(e.target.value))} className="ml-1 w-16 rounded border border-caos-border bg-caos-bg px-1 py-0.5 text-caos-text focus-ring" />
          </label>
          <button type="button" onClick={run} disabled={busy} className="tabular text-caos-2xs min-h-[24px] px-2 rounded border border-caos-accent text-caos-accent disabled:opacity-40 transition-caos focus-ring">
            {busy ? "PROPAGATING…" : "PROPAGATE"}
          </button>
        </div>
      )}
      {error ? <div role="alert" className="tabular text-caos-xs mt-2" style={{ color: "var(--caos-critical)" }}>Couldn’t propagate this scenario. Retry without changing the current model.</div> : null}
      {result ? (
        <div className="flex gap-1.5 overflow-x-auto mt-2 pb-1" aria-label="Scenario propagation chain">
          {result.nodes.map((node, index) => {
            const status = STATUS[node.status];
            return (
              <div key={node.node} className="contents">
                {index > 0 ? <span aria-hidden="true" className="self-center text-caos-muted">→</span> : null}
                <div className="min-w-[126px] rounded border border-caos-border bg-caos-bg px-2 py-1.5" title={node.basis}>
                  <div className="flex items-center gap-1">
                    <StatusGlyph kind={status.glyph} />
                    <span className="tabular text-caos-3xs uppercase tracking-wider" style={{ color: status.color }}>{status.label}</span>
                  </div>
                  <div className="tabular text-caos-xs uppercase text-caos-muted mt-1">{node.node}</div>
                  <div className="text-caos-xs text-caos-text leading-snug mt-0.5">{node.label}</div>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
