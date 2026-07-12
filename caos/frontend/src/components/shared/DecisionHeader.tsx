"use client";

// The four-cell decision header for analytical surfaces:
//   WHAT CHANGED · WHY IT MATTERS · REQUIRED ACTION · EVIDENCE HEALTH
// Terse desk language, one strip under the sub-header. Cells are supplied by
// the page (each surface's data contract differs); an empty cell renders an
// explicit "— no data" rather than hiding — status honesty over polish.
//
// Role hook: PM and QA views open expanded (their ten-second answer), the
// Analyst view opens collapsed to a single reveal row; either can toggle.

import { useState } from "react";
import { useRoleView } from "./RoleViewProvider";
import { ProvenanceChip } from "./ProvenanceChip";
import type { Provenance } from "@/lib/provenance";

const ORIGINS = ["LIVE", "REFERENCE", "DEMO"];

function isProvenance(v: unknown): v is Provenance {
  return !!v && typeof v === "object" && ORIGINS.includes((v as Provenance).origin as string);
}

function Cell({ label, value }: { label: string; value?: React.ReactNode | Provenance }) {
  return (
    <div className="min-w-0 px-3 py-1.5 border-r border-caos-border last:border-r-0 max-lg:border-r-0 max-lg:border-b max-lg:last:border-b-0">
      <div className="tabular text-caos-2xs uppercase tracking-widest text-caos-muted">{label}</div>
      <div className="tabular text-caos-xs text-caos-text truncate" title={typeof value === "string" ? value : undefined}>
        {value == null || value === "" ? (
          <span className="text-caos-muted">— no data</span>
        ) : isProvenance(value) ? (
          <ProvenanceChip prov={value} className="mt-0.5" />
        ) : (
          value
        )}
      </div>
    </div>
  );
}

export function DecisionHeader({
  whatChanged,
  whyItMatters,
  requiredAction,
  evidenceHealth,
  className = "",
}: {
  whatChanged?: React.ReactNode;
  whyItMatters?: React.ReactNode;
  requiredAction?: React.ReactNode;
  evidenceHealth?: React.ReactNode | Provenance;
  className?: string;
}) {
  const { roleView } = useRoleView();
  // null = follow the role default; a click overrides for the session.
  const [userOpen, setUserOpen] = useState<boolean | null>(null);
  const open = userOpen ?? roleView !== "analyst";

  return (
    <section
      aria-label="Decision header"
      className={"shrink-0 border-b border-caos-border bg-caos-panel/40 " + className}
    >
      <button
        type="button"
        onClick={() => setUserOpen(!open)}
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-3 min-h-6 py-0.5 text-left focus-ring transition-caos hover:bg-caos-elevated/40"
      >
        <span className="tabular text-caos-2xs uppercase tracking-widest text-caos-muted">
          What changed · Why it matters · Required action · Evidence health
        </span>
        <span aria-hidden="true" className="tabular text-caos-2xs text-caos-muted ml-auto">
          {open ? "−" : "+"}
        </span>
      </button>
      {open ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 border-t border-caos-border/60">
          <Cell label="What changed" value={whatChanged} />
          <Cell label="Why it matters" value={whyItMatters} />
          <Cell label="Required action" value={requiredAction} />
          <Cell label="Evidence health" value={evidenceHealth} />
        </div>
      ) : null}
    </section>
  );
}
