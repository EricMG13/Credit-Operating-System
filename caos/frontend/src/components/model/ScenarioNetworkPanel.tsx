"use client";

import { useRef, useState } from "react";
import { propagateScenario, type ScenarioPropagationResult } from "@/lib/api";
import { StatusGlyph } from "@/components/shared/StatusGlyph";
import { SurfaceState } from "@/components/shared/SurfaceState";
import { ActionReason } from "@/components/shared/ActionReason";

const STATUS = {
  computed: { glyph: "success" as const, label: "COMPUTED", color: "var(--caos-success)" },
  degraded: { glyph: "warning" as const, label: "DEGRADED", color: "var(--caos-warning)" },
  "no-data": { glyph: "idle" as const, label: "NO DATA", color: "var(--caos-muted)" },
};

function ScenarioControls({
  ebitdaPct,
  rateBps,
  busy,
  onEbitdaChange,
  onRateChange,
  onRun,
}: {
  ebitdaPct: number;
  rateBps: number;
  busy: boolean;
  onEbitdaChange: (value: number) => void;
  onRateChange: (value: number) => void;
  onRun: () => void;
}) {
  return (
    <div className="mt-2 flex items-center justify-end gap-2 flex-wrap">
      <label className="tabular text-caos-2xs text-caos-muted">
        EBITDA %
        <input type="number" name="scenario-ebitda-change" autoComplete="off" min={-90} max={50} value={ebitdaPct} onChange={(event) => onEbitdaChange(Number(event.target.value))} className="ml-1 w-14 rounded border border-caos-border bg-caos-bg px-1 py-0.5 text-caos-text focus-ring" />
      </label>
      <label className="tabular text-caos-2xs text-caos-muted">
        RATE BP
        <input type="number" name="scenario-rate-change" autoComplete="off" min={-500} max={1000} value={rateBps} onChange={(event) => onRateChange(Number(event.target.value))} className="ml-1 w-16 rounded border border-caos-border bg-caos-bg px-1 py-0.5 text-caos-text focus-ring" />
      </label>
      <ActionReason type="button" onClick={onRun} reason={busy ? "Propagating…" : null} className="tabular text-caos-2xs min-h-[24px] px-2 rounded border border-caos-accent text-caos-accent aria-disabled:opacity-40 transition-caos focus-ring">
        {busy ? "PROPAGATING…" : "PROPAGATE"}
      </ActionReason>
    </div>
  );
}

function ScenarioNode({ node, index }: { node: ScenarioPropagationResult["nodes"][number]; index: number }) {
  const status = STATUS[node.status];
  return (
    <div className="contents">
      {index > 0 ? <span aria-hidden="true" className="self-center text-caos-muted">→</span> : null}
      <div className="min-w-[126px] rounded border border-caos-border bg-caos-bg px-2 py-1.5" title={node.basis}>
        <div className="flex items-center gap-1">
          <StatusGlyph kind={status.glyph} />
          <span className="tabular text-caos-3xs uppercase tracking-wider" style={{ color: status.color }}>{status.label}</span>
        </div>
        <div className="tabular text-caos-xs uppercase tracking-wider text-caos-muted mt-1">{node.node}</div>
        <div className="text-caos-xs text-caos-text leading-snug mt-0.5">{node.label}</div>
      </div>
    </div>
  );
}

function ScenarioResult({ result }: { result: ScenarioPropagationResult | null }) {
  if (!result) return null;
  const signed = (value: number, digits: number) => `${value < 0 ? "−" : "+"}${Math.abs(value).toFixed(digits)}`;
  return (
    <div className="mt-2">
      <div className="tabular text-caos-3xs uppercase tracking-wider text-caos-muted mb-1">
        Run {result.shock.run_id} · EBITDA {signed(result.shock.ebitda_pct * 100, 1)}% · rate {signed(result.shock.rate_bps, 0)} bp
      </div>
      {result.source ? (
        <div className="tabular text-caos-3xs uppercase tracking-wider text-caos-muted mb-1.5">
          Source {result.source.qa_status} · {result.source.included_modules.length} accepted modules
          {result.source.excluded_modules.length ? ` · ${result.source.excluded_modules.length} blocked excluded` : ""}
        </div>
      ) : null}
      <div className="flex gap-1.5 overflow-x-auto pb-1" aria-label="Scenario propagation chain">
        {result.nodes.map((node, index) => <ScenarioNode key={node.node} node={node} index={index} />)}
      </div>
    </div>
  );
}

type KeyedScenarioResult = { key: string; value: ScenarioPropagationResult };
type KeyedScenarioRequest = { id: number; key: string };

const scenarioKey = (issuerId: string, runId: string | null, ebitdaPct: number, rateBps: number) =>
  `${issuerId}\u0000${runId ?? ""}\u0000${ebitdaPct}\u0000${rateBps}`;

export function ScenarioNetworkPanel({ issuerId, runId }: { issuerId: string; runId: string | null }) {
  const [ebitdaPct, setEbitdaPct] = useState(-20);
  const [rateBps, setRateBps] = useState(0);
  const [resultState, setResultState] = useState<KeyedScenarioResult | null>(null);
  const [pending, setPending] = useState<KeyedScenarioRequest | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const requestId = useRef(0);
  const currentKey = scenarioKey(issuerId, runId, ebitdaPct, rateBps);
  const currentKeyRef = useRef(currentKey);
  currentKeyRef.current = currentKey;
  const result = resultState?.key === currentKey ? resultState.value : null;
  const busy = pending?.key === currentKey;
  const error = errorKey === currentKey;

  const run = async () => {
    if (!runId || busy) return;
    const key = currentKey;
    const id = ++requestId.current;
    setPending({ id, key });
    setErrorKey(null);
    try {
      const value = await propagateScenario({ issuer_id: issuerId, run_id: runId, ebitda_pct: ebitdaPct / 100, rate_bps: rateBps });
      if (currentKeyRef.current === key && requestId.current === id) {
        setResultState({ key, value });
      }
    } catch {
      if (currentKeyRef.current === key && requestId.current === id) {
        setErrorKey(key);
      }
    } finally {
      setPending((current) => current?.id === id ? null : current);
    }
  };

  return (
    <section className="border-t border-caos-border pt-2" aria-labelledby="scenario-network-title">
      <h2 id="scenario-network-title" className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">
        Scenario network · cross-module propagation
      </h2>
      {!runId ? (
        <SurfaceState
          kind="unavailable"
          title="Completed run required"
          detail="Seeded reference content elsewhere on this page is illustrative. A completed live run is required before a scenario can propagate across live modules."
          compact
          className="mt-2"
        />
      ) : (
        <ScenarioControls ebitdaPct={ebitdaPct} rateBps={rateBps} busy={busy} onEbitdaChange={setEbitdaPct} onRateChange={setRateBps} onRun={run} />
      )}
      {error ? <div role="alert" className="tabular text-caos-xs mt-2" style={{ color: "var(--caos-critical)" }}>Couldn’t propagate this scenario. Retry without changing the current model.</div> : null}
      <ScenarioResult result={result} />
    </section>
  );
}
