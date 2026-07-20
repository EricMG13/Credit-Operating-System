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
import { ConclusionAuthority } from "@/components/shared/ConclusionAuthority";
import { SurfaceState } from "@/components/shared/SurfaceState";
import { ActionReason } from "@/components/shared/ActionReason";
import { useAutonomyDraft, type AutonomyDraftState } from "@/lib/engine/useAutonomyDraft";
import { draftToAlertRows, formatImpact, requiredActionFor, rowProvenance, type AlertRow } from "@/lib/alerts/inbox";
import { getAlertStates, setAlertState, toErrorMessage, type AlertStateDTO } from "@/lib/api";
import { useScrollOwner } from "@/lib/use-scroll-owner";

function issuerHref(row: AlertRow): string | null {
  return row.issuerId ? `/deepdive?issuer=${encodeURIComponent(row.issuerId)}` : null;
}

const acknowledgementPresentation = (
  acknowledging: boolean,
  resolved: boolean,
  acknowledged: boolean,
): { reason: string | null; label: string } => {
  if (acknowledging) return { reason: "Saving acknowledgement…", label: "Acknowledging…" };
  if (resolved) return { reason: "Resolved on Monitor — this row is closed", label: "Resolved" };
  if (acknowledged) return { reason: "Already acknowledged", label: "Acked" };
  return { reason: null, label: "Ack" };
};

function RankedChangeRow({
  row,
  state,
  ackError,
  acknowledging,
  onAck,
}: {
  row: AlertRow;
  state?: AlertStateDTO;
  ackError?: string;
  acknowledging: boolean;
  onAck: (key: string) => void;
}) {
  const acknowledged = state?.state === "ack";
  const resolved = state?.state === "resolved";
  const impact = formatImpact(row);
  const acknowledgement = acknowledgementPresentation(acknowledging, resolved, acknowledged);
  const deepDiveHref = issuerHref(row);
  return (
    <div className="px-3 py-[6px] border-b border-caos-border/50">
      <div className="flex items-center gap-2">
        <ConclusionAuthority prov={rowProvenance(row)} />
        {impact ? (
          <span
            className="tabular text-caos-2xs uppercase tracking-wider px-1.5 py-px rounded border whitespace-nowrap"
            title="Anomaly severity — standard deviations from the baseline/peer median, never a fabricated bp figure"
            style={{ color: "var(--caos-muted)", borderColor: "var(--caos-border)" }}
          >
            {impact}
          </span>
        ) : null}
        <IssuerLink
          query={row.issuerName}
          title={`Open ${row.issuerName} profile`}
          className="tabular text-caos-md text-caos-accent hover:text-caos-text transition-caos focus-ring rounded px-0.5 outline-none"
        >
          {row.issuerName}
        </IssuerLink>
        <span className="tabular text-caos-xs text-caos-muted ml-auto">
          {resolved ? "resolved" : state?.assignee || "unassigned"}
        </span>
      </div>
      <div className="text-caos-md text-caos-text leading-snug mt-1">{row.event}</div>
      <div className="flex items-center gap-2 mt-1">
        <span className="tabular text-caos-xs text-caos-muted">{requiredActionFor(row)}</span>
        {deepDiveHref ? (
          <Link
            href={deepDiveHref}
            title={`Open ${row.issuerName} in Deep-Dive`}
            className="no-underline tabular text-caos-xs text-caos-accent hover:text-caos-text border border-caos-border/70 hover:border-caos-accent/60 rounded px-1.5 min-h-8 flex items-center transition-caos focus-ring outline-none caos-target"
          >
            Open →
          </Link>
        ) : <span className="tabular text-caos-xs text-caos-muted">Issuer authority unavailable</span>}
        <ActionReason
          type="button"
          reason={acknowledgement.reason}
          onClick={() => onAck(row.key)}
          className="tabular text-caos-xs px-1.5 min-h-8 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos focus-ring aria-disabled:opacity-50 caos-target"
        >
          {acknowledgement.label}
        </ActionReason>
      </div>
      {ackError ? <p className="mt-1 text-caos-2xs text-caos-critical" role="alert">{ackError} Retry acknowledgement for this unchanged alert.</p> : null}
    </div>
  );
}

/** Self-fetching wrapper — kept for callsites that don't already hold the
 * draft. Command lifts the fetch to the page (it also gates OPEN TOP CHANGE
 * on the same state) and renders RankedChangesView directly, so the draft is
 * requested once per surface. */
export function RankedChanges() {
  return <RankedChangesView state={useAutonomyDraft()} />;
}

function RankedChangeTableRow({
  row,
  state,
  ackError,
  acknowledging,
  onAck,
}: {
  row: AlertRow;
  state?: AlertStateDTO;
  ackError?: string;
  acknowledging: boolean;
  onAck: (key: string) => void;
}) {
  const acknowledged = state?.state === "ack";
  const resolved = state?.state === "resolved";
  const acknowledgement = acknowledgementPresentation(acknowledging, resolved, acknowledged);
  const deepDiveHref = issuerHref(row);
  return (
    <tr>
      <th scope="row" className="text-left">
        <IssuerLink
          query={row.issuerName}
          title={`Open ${row.issuerName} profile`}
          className="tabular text-caos-sm text-caos-accent hover:text-caos-text transition-caos focus-ring rounded px-0.5 outline-none"
        >
          {row.issuerName}
        </IssuerLink>
      </th>
      <td>
        <div className="flex items-start gap-2">
          <ConclusionAuthority prov={rowProvenance(row)} />
          <span>{row.event}</span>
        </div>
      </td>
      <td className="text-right tabular">{formatImpact(row) || "—"}</td>
      <td>{requiredActionFor(row)}</td>
      <td className="tabular">{resolved ? "resolved" : state?.assignee || "unassigned"}</td>
      <td>
        <div className="flex items-center justify-end gap-1.5">
          {deepDiveHref ? (
            <Link
              href={deepDiveHref}
              title={`Open ${row.issuerName} in Deep-Dive`}
              className="caos-action-secondary no-underline focus-ring whitespace-nowrap"
            >
              Open
            </Link>
          ) : <span className="text-caos-xs text-caos-muted">Issuer authority unavailable</span>}
          <ActionReason
            type="button"
            reason={acknowledgement.reason}
            onClick={() => onAck(row.key)}
            className="caos-action-secondary focus-ring whitespace-nowrap aria-disabled:opacity-50"
          >
            {acknowledgement.label}
          </ActionReason>
        </div>
        {ackError ? <p className="mt-1 text-caos-2xs text-caos-critical" role="alert">{ackError} Retry acknowledgement for this unchanged alert.</p> : null}
      </td>
    </tr>
  );
}

export function RankedChangesView({
  state,
  limit = null,
  tableColumnPreset,
}: {
  state: AutonomyDraftState;
  limit?: number | null;
  tableColumnPreset?: string;
}) {
  const { draft, loading, offline } = state;
  const [states, setStates] = useState<Map<string, AlertStateDTO>>(new Map());
  const [ackPending, setAckPending] = useState<string | null>(null);
  const [ackErrors, setAckErrors] = useState<Map<string, string>>(new Map());
  const tableScroll = useScrollOwner<HTMLDivElement>();

  const allRows = draft ? draftToAlertRows(draft) : [];
  const rows = limit && limit > 0 ? allRows.slice(0, limit) : allRows;

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
    if (ackPending) return;
    setAckPending(key);
    setAckErrors((errors) => {
      const next = new Map(errors);
      next.delete(key);
      return next;
    });
    setAlertState(key, "ack").then((row) => {
      setStates((m) => new Map(m).set(key, row));
    }).catch((reason) => {
      setAckErrors((errors) => new Map(errors).set(key, toErrorMessage(reason, "Acknowledgement could not be saved.")));
    }).finally(() => setAckPending(null));
  };

  if (loading) {
    return <SurfaceState kind="loading" title="Loading ranked changes" compact className="m-2" />;
  }

  if (offline) {
    // Was labeled origin: "DEMO" — DEMO means seeded/illustrative, and this
    // is the opposite fact (a live service is genuinely unreachable).
    // SurfaceState's "offline" kind exists precisely for this.
    return <SurfaceState kind="offline" title="Autonomy engine unreachable" detail="No draft data to show." compact className="m-2" />;
  }

  if (rows.length === 0) {
    const cycling = draft?.refreshing;
    // approval={null} equivalent: an empty board has no conclusion to be
    // unratified — SurfaceState's "empty" kind already conveys "a real check
    // ran and genuinely found nothing", so no separate provenance chip is
    // needed here.
    return (
      <SurfaceState
        kind="empty"
        title={cycling ? "cycle running — no changes yet" : "no ranked changes to report"}
        detail={draft?.marking ?? undefined}
        compact
        className="m-2"
      />
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
      {rows.length < allRows.length ? (
        <p className="px-3 py-1.5 border-b border-caos-border/50 tabular text-caos-2xs text-caos-muted">
          Showing {rows.length} of {allRows.length} ranked changes
        </p>
      ) : null}
      {tableColumnPreset === "pm-delta" ? (
        <div ref={tableScroll.ref} className={`overflow-x-auto${tableScroll.scrollable ? " focus-ring" : ""}`} tabIndex={tableScroll.scrollable ? 0 : undefined} role={tableScroll.scrollable ? "region" : undefined} aria-label={tableScroll.scrollable ? "PM ranked-change worklist columns" : undefined}>
          <table className="caos-table min-w-[900px] w-full">
            <thead>
              <tr>
                <th scope="col">Issuer</th>
                <th scope="col">Change</th>
                <th scope="col" className="text-right">Portfolio impact</th>
                <th scope="col">Required action</th>
                <th scope="col">Owner</th>
                <th scope="col" className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <RankedChangeTableRow
                  key={row.key}
                  row={row}
                  state={states.get(row.key)}
                  ackError={ackErrors.get(row.key)}
                  acknowledging={ackPending === row.key}
                  onAck={ack}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : rows.map((row) => (
          <RankedChangeRow
            key={row.key}
            row={row}
            state={states.get(row.key)}
            ackError={ackErrors.get(row.key)}
            acknowledging={ackPending === row.key}
            onAck={ack}
          />
        ))}
    </div>
  );
}
