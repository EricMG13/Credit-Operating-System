"use client";

import { useState } from "react";
import type { DecisionContextState, DecisionDatumState } from "@/lib/decision-state";
import type { Provenance } from "@/lib/provenance";
import { ConclusionAuthority } from "./ConclusionAuthority";

const ORIGINS = ["LIVE", "REFERENCE", "DEMO"];

function isProvenance(v: unknown): v is Provenance {
  return !!v && typeof v === "object" && ORIGINS.includes((v as Provenance).origin as string);
}

function legacyState(value: React.ReactNode | Provenance | undefined, unavailableMessage: string): DecisionDatumState {
  if (value == null || value === "") return { kind: "unavailable", message: unavailableMessage };
  if (isProvenance(value)) {
    return {
      kind: "ready",
      value: <ConclusionAuthority prov={value} />,
      asOf: value.asOf ?? "timestamp unavailable",
    };
  }
  // Compatibility adapter only. New route code must supply `state` with a real
  // observation time; the adapter says so rather than fabricating freshness.
  return { kind: "ready", value, asOf: "timestamp unavailable" };
}

function datumTimestamp(state: DecisionDatumState) {
  return "asOf" in state ? state.asOf : state.kind === "offline" ? state.lastKnownAt : undefined;
}

function datumAuthority(state: DecisionDatumState) {
  return "authority" in state ? state.authority : undefined;
}

function sharedAuthority(states: DecisionDatumState[]) {
  const entries = states.map((datum) => {
    const authority = datumAuthority(datum);
    const asOf = datumTimestamp(datum);
    if (!authority || !asOf) return null;
    const { provenance, approval } = authority;
    return {
      authority,
      asOf,
      key: [asOf, provenance.origin, provenance.method ?? "", provenance.freshness ?? "", approval ?? ""].join("|"),
    };
  });
  if (entries.some((entry) => entry == null)) return null;
  const first = entries[0]!;
  return entries.every((entry) => entry!.key === first.key) ? first : null;
}

function Datum({ state, showObservation = true }: { state: DecisionDatumState; showObservation?: boolean }) {
  let content: React.ReactNode;
  let glyph = "";
  switch (state.kind) {
    case "ready":
      content = state.value;
      break;
    case "observed-empty":
      // "○" = observed, nothing there. A "✓" here scan-reads as green health
      // decorating an empty board (2026-07-16 critique, PM persona).
      glyph = "○";
      content = state.message ?? "No material change observed";
      break;
    case "stale":
      glyph = "△";
      content = state.value;
      break;
    case "partial":
      glyph = "△";
      content = state.value ?? `Partial result · missing ${state.missingSources.join(", ")}`;
      break;
    case "loading":
      glyph = "◌";
      content = state.message ?? "Checking source…";
      break;
    case "offline":
      glyph = "△";
      content = state.lastKnown ?? "Source offline";
      break;
    case "error":
      glyph = "✕";
      content = state.message;
      break;
    case "unavailable":
      glyph = "—";
      content = state.message ?? "Unavailable";
      break;
  }

  const timestamp = datumTimestamp(state);
  const authority = datumAuthority(state);
  const interactive = state.kind === "offline" || state.kind === "error";

  return (
    <div
      className="caos-decision-state flex-wrap tabular text-caos-md leading-snug"
      data-kind={state.kind}
      role={state.kind === "loading" ? "status" : undefined}
    >
      {glyph ? <span aria-hidden="true">{glyph}</span> : null}
      <span className="min-w-0 [overflow-wrap:anywhere]">{content}</span>
      {showObservation && timestamp ? <span className="basis-full tabular text-caos-2xs text-caos-muted">as of {timestamp}</span> : null}
      {showObservation && authority ? (
        <span className="basis-full mt-0.5">
          <ConclusionAuthority prov={{ ...authority.provenance, asOf: timestamp ?? authority.provenance.asOf }} approval={authority.approval} />
        </span>
      ) : null}
      {interactive && state.onRetry ? (
        <button type="button" onClick={state.onRetry} className="caos-action-secondary focus-ring">
          {state.retryLabel ?? "Retry"}
        </button>
      ) : null}
      {state.kind === "error" && state.onEscalate ? (
        <button type="button" onClick={state.onEscalate} className="caos-action-secondary focus-ring">
          {state.escalationLabel ?? "Escalate"}
        </button>
      ) : null}
    </div>
  );
}

function Cell({ label, state, showObservation }: { label: string; state: DecisionDatumState; showObservation: boolean }) {
  return (
    <div data-kind={state.kind} className="caos-decision-cell min-w-0 px-3 py-2 border-r border-caos-border last:border-r-0 max-lg:border-r-0 max-lg:border-b max-lg:last:border-b-0">
      <div className="caos-decision-label tabular text-caos-2xs uppercase tracking-widest text-caos-muted">{label}</div>
      <div className="mt-1"><Datum state={state} showObservation={showObservation} /></div>
    </div>
  );
}

export function DecisionHeader({
  state,
  whatChanged,
  whyItMatters,
  requiredAction,
  evidenceHealth,
  defaultOpen = true,
  className = "",
}: {
  /** Preferred explicit state contract. Legacy value props adapt to unavailable. */
  state?: DecisionContextState;
  whatChanged?: React.ReactNode;
  whyItMatters?: React.ReactNode;
  requiredAction?: React.ReactNode;
  evidenceHealth?: React.ReactNode | Provenance;
  /** Keep decision-first surfaces open; editors can reclaim space by default. */
  defaultOpen?: boolean;
  className?: string;
}) {
  const [userOpen, setUserOpen] = useState<boolean | null>(null);
  const open = userOpen ?? defaultOpen;
  const resolved: DecisionContextState = state ?? {
    whatChanged: legacyState(whatChanged, "Change observation unavailable"),
    whyItMatters: legacyState(whyItMatters, "Decision impact unavailable"),
    requiredAction: legacyState(requiredAction, "Required action unavailable"),
    evidenceHealth: legacyState(evidenceHealth, "Evidence state unavailable"),
  };
  const hasError = Object.values(resolved).some((datum) => datum.kind === "error");
  const cells = [resolved.whatChanged, resolved.whyItMatters, resolved.requiredAction, resolved.evidenceHealth];
  const commonObservation = sharedAuthority(cells);
  // When every cell states the same value-less cause ("Run the gated screen to
  // establish this observation." ×4), the 4-cell anatomy is scaffolding, not
  // information — collapse to one spanning line. Cells that carry values
  // (ready/stale/partial) never collapse: their content differs by definition.
  const sharedCause = (() => {
    const collapsible = new Set(["unavailable", "observed-empty", "loading"]);
    const key = (s: DecisionDatumState) => `${s.kind}|${"message" in s ? s.message ?? "" : ""}`;
    const first = cells[0];
    if (!collapsible.has(first.kind)) return null;
    return cells.every((cell) => key(cell) === key(first)) ? first : null;
  })();

  return (
    <section role={hasError ? "alert" : undefined} aria-label="Decision header" data-contract="decision-context" className={`caos-decision-header shrink-0 border-b border-caos-border bg-caos-panel/40 ${className}`}>
      <button
        type="button"
        onClick={() => setUserOpen(!open)}
        aria-expanded={open}
        aria-label="Decision brief: change, impact, action, and evidence"
        className="caos-decision-toggle w-full flex items-center gap-2 px-3 min-h-8 py-1 text-left focus-ring transition-caos hover:bg-caos-elevated/40"
      >
        <span className="tabular text-caos-xs font-semibold uppercase tracking-[0.12em] text-caos-text">Decision brief</span>
        <span className="hidden sm:inline tabular text-caos-2xs uppercase tracking-widest text-caos-muted">Change · impact · action · evidence</span>
        <span aria-hidden="true" className="tabular text-caos-2xs text-caos-muted ml-auto">{open ? "−" : "+"}</span>
      </button>
      {open ? (
        <div className="border-t border-caos-border/60">
          {sharedCause ? (
            <div className="caos-decision-grid grid grid-cols-1">
              <Cell label="Entire brief" state={sharedCause} showObservation={!commonObservation} />
            </div>
          ) : (
            <div className="caos-decision-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
              <Cell label="What changed" state={resolved.whatChanged} showObservation={!commonObservation} />
              <Cell label="Why it matters" state={resolved.whyItMatters} showObservation={!commonObservation} />
              <Cell label="Required action" state={resolved.requiredAction} showObservation={!commonObservation} />
              <Cell label="Evidence health" state={resolved.evidenceHealth} showObservation={!commonObservation} />
            </div>
          )}
          {commonObservation ? (
            <div data-origin={commonObservation.authority.provenance.origin} className="caos-decision-observation flex flex-wrap items-center gap-2 border-t border-caos-border/60 px-3 py-1.5" aria-label="Shared authority for all decision conclusions">
              <span className="caos-observation-label tabular text-caos-2xs uppercase tracking-widest text-caos-muted">Observation authority</span>
              <span className="caos-observation-time tabular text-caos-2xs text-caos-muted">as of {commonObservation.asOf}</span>
              <ConclusionAuthority
                prov={{ ...commonObservation.authority.provenance, asOf: commonObservation.asOf }}
                approval={commonObservation.authority.approval}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
