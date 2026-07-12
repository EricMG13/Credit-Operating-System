"use client";

// Command's opener: the ranked-changes list from the live autonomy draft
// (Watchtower). Each row: what changed / why (reason) / owner / required
// action / Open (Deep-Dive) / Ack. Severity-only ranking, disclosed via a
// basis chip — PortfolioRowDTO carries no position size, so par-weighting is
// never fabricated (P2 backend investigation finding #5). Offline vs
// empty-live are rendered as distinctly different, honest states — neither
// is ever shown as the other, and neither ever substitutes a fabricated
// demo list (this is a wholly new surface; there is no seeded fixture to
// fall back to).

import { useEffect, useState } from "react";
import Link from "next/link";
import { IssuerLink } from "@/components/shared/IssuerLink";
import { ProvenanceChip } from "@/components/shared/ProvenanceChip";
import { useAutonomyDraft } from "@/lib/engine/useAutonomyDraft";
import { draftToAlertRows, requiredActionFor, type AlertRow } from "@/lib/alerts/inbox";
import { getAlertStates, setAlertState, type AlertStateDTO } from "@/lib/api";

function issuerHref(row: AlertRow): string {
  const q = row.issuerId ?? row.issuerName;
  return `/deepdive?issuer=${encodeURIComponent(q)}`;
}

export function RankedChanges() {
  const { draft, loading, offline } = useAutonomyDraft();
  const [states, setStates] = useState<Map<string, AlertStateDTO>>(new Map());

  const rows = draft ? draftToAlertRows(draft) : [];

  useEffect(() => {
    if (rows.length === 0) return;
    let alive = true;
    getAlertStates()
      .then((list) => {
        if (!alive) return;
        setStates(new Map(list.map((s) => [s.alert_key, s])));
      })
      .catch(() => {
        // Ack/assign state is enrichment, not load-bearing — an unreachable
        // alerts route just means every row shows as unassigned/open.
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft?.generated_at]);

  const ack = (key: string) => {
    setAlertState(key, "ack").then((row) => {
      setStates((m) => new Map(m).set(key, row));
    });
  };

  if (loading) {
    return <div className="px-3 py-4 tabular text-caos-xs text-caos-muted">loading…</div>;
  }

  if (offline) {
    return (
      <div className="px-3 py-4 flex items-center gap-2">
        <ProvenanceChip prov={{ origin: "DEMO", detail: "Autonomy engine unreachable — Watchtower has no data to show." }} />
        <span className="tabular text-caos-xs text-caos-muted">Watchtower unreachable</span>
      </div>
    );
  }

  if (rows.length === 0) {
    const cycling = draft?.refreshing;
    return (
      <div className="px-3 py-4 flex items-center gap-2">
        <ProvenanceChip prov={{ origin: "LIVE", detail: draft?.marking }} />
        <span className="tabular text-caos-xs text-caos-muted">
          {cycling ? "cycle running — no changes yet" : "no ranked changes to report"}
        </span>
      </div>
    );
  }

  return (
    <div>
      <div className="px-3 py-1.5 flex items-center gap-2 border-b border-caos-border/50">
        <span
          className="tabular text-caos-2xs uppercase tracking-widest text-caos-muted"
          title="PortfolioRowDTO carries no position size — ranking never fabricates par-weighting."
        >
          Ranked by severity — holdings not loaded
        </span>
        <span className="tabular text-caos-2xs text-caos-muted ml-auto">{draft?.marking}</span>
      </div>
      {rows.map((row) => {
        const state = states.get(row.key);
        const acked = state?.state === "ack";
        return (
          <div key={row.key} className="px-3 py-[6px] border-b border-caos-border/50">
            <div className="flex items-center gap-2">
              <ProvenanceChip prov={{ origin: "LIVE", method: row.method === "MODELLED" ? "MODELLED" : "DERIVED" }} />
              <IssuerLink
                query={row.issuerName}
                title={`Open ${row.issuerName} profile`}
                className="tabular text-caos-md text-caos-accent hover:text-caos-text transition-caos focus-ring rounded px-0.5 outline-none"
              >
                {row.issuerName}
              </IssuerLink>
              <span className="tabular text-caos-xs text-caos-muted ml-auto">
                {state?.assignee || "unassigned"}
              </span>
            </div>
            <div className="text-caos-md text-caos-text leading-snug mt-1">{row.event}</div>
            <div className="flex items-center gap-2 mt-1">
              <span className="tabular text-caos-xs text-caos-muted">{requiredActionFor(row)}</span>
              <Link
                href={issuerHref(row)}
                title={`Open ${row.issuerName} in Deep-Dive`}
                className="no-underline tabular text-caos-xs text-caos-accent hover:text-caos-text border border-caos-border/70 hover:border-caos-accent/60 rounded px-1.5 min-h-8 flex items-center transition-caos focus-ring outline-none caos-target"
              >
                Open →
              </Link>
              <button
                type="button"
                disabled={acked}
                onClick={() => ack(row.key)}
                className="tabular text-caos-xs px-1.5 min-h-8 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos focus-ring disabled:opacity-50 caos-target"
              >
                {acked ? "Acked" : "Ack"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
