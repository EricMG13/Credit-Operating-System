"use client";

// C8 — cross-issuer summary of the most recent IC Decision Records, mirroring
// GovernancePanel's compact per-issuer row idiom. Read-only here — recording
// a decision happens on the Issuer Profile (DecisionRecordPanel), the natural
// place to have the run/report evidence already in view.

import { useEffect, useState } from "react";
import { IssuerLink } from "@/components/shared/IssuerLink";
import { listDecisionRecords, type DecisionRecordDTO } from "@/lib/api";

const _RECENT_CAP = 10;

export function RecentDecisions() {
  const [records, setRecords] = useState<DecisionRecordDTO[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let stale = false;
    listDecisionRecords()
      .then((rows) => { if (!stale) setRecords(rows.slice(0, _RECENT_CAP)); })
      .catch(() => { if (!stale) setError(true); });
    return () => { stale = true; };
  }, []);

  if (error) {
    return (
      <div className="px-3 py-4 tabular text-caos-xs text-caos-muted">
        Couldn&apos;t load recent decisions — check your connection.
      </div>
    );
  }
  if (records === null) {
    return <div className="px-3 py-4 tabular text-caos-xs text-caos-muted">Loading…</div>;
  }
  if (records.length === 0) {
    return (
      <div className="px-3 py-4 tabular text-caos-xs text-caos-muted" style={{ color: "var(--caos-success)" }}>
        No IC decisions recorded yet — log one from an issuer&apos;s profile.
      </div>
    );
  }
  return (
    <div>
      {records.map((r) => (
        <div key={r.id} className="px-3 py-[6px] border-b border-caos-border/50 last:border-b-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="tabular text-caos-2xs uppercase tracking-wider px-1.5 py-px rounded border"
              style={{
                color: "var(--caos-accent)",
                borderColor: "color-mix(in srgb, var(--caos-accent) 40%, transparent)",
                background: "color-mix(in srgb, var(--caos-accent) 8%, transparent)",
              }}
            >
              {r.recommendation}
            </span>
            <IssuerLink
              issuer={{ id: r.issuer_id }}
              title={`Open ${r.issuer_name ?? "issuer"} profile`}
              className="tabular text-caos-md text-caos-accent hover:text-caos-text transition-caos focus-ring rounded px-0.5 outline-none"
            >
              {r.issuer_name ?? r.issuer_id}
            </IssuerLink>
            <span className="tabular text-caos-2xs text-caos-muted">{r.decision} · {r.committee_date}</span>
          </div>
          <div className="text-caos-xs text-caos-muted leading-snug mt-0.5 pl-0.5 truncate">{r.thesis}</div>
        </div>
      ))}
    </div>
  );
}
