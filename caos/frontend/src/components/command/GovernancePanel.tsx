"use client";

// The combined governance panel: QA findings + source gaps (already live-wired
// — QaQueue/GapsList reused unmodified) plus a NEW stale-sources category from
// the digest already fetched on Command (useDigest) — zero new endpoints.
// Visible identically from Command and, per the handoff, Monitor's governance
// surface reads the same underlying live sources.

import { QaQueue, GapsList } from "@/components/command/views";
import { IssuerLink } from "@/components/shared/IssuerLink";
import type { QaQueueItem, GapItem } from "@/lib/command/data";
import type { DigestWatchRow } from "@/lib/api";

function StaleSources({ rows }: { rows: DigestWatchRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="px-3 py-4 tabular text-caos-xs text-caos-muted" style={{ color: "var(--caos-success)" }}>
        No stale sources — every covered issuer is within the freshness window.
      </div>
    );
  }
  return (
    <div>
      {rows.map((r) => (
        <div key={r.issuer_id} className="px-3 py-[6px] border-b border-caos-border/50">
          <div className="flex items-center gap-2">
            <span
              className="tabular text-caos-2xs uppercase tracking-wider px-1.5 py-px rounded border"
              style={{
                color: "var(--caos-warning)",
                borderColor: "color-mix(in srgb, var(--caos-warning) 40%, transparent)",
                background: "color-mix(in srgb, var(--caos-warning) 8%, transparent)",
              }}
            >
              STALE
            </span>
            <IssuerLink
              query={r.name}
              title={`Open ${r.name} profile`}
              className="tabular text-caos-md text-caos-accent hover:text-caos-text transition-caos focus-ring rounded px-0.5 outline-none"
            >
              {r.name}
            </IssuerLink>
          </div>
          {r.detail ? <div className="text-caos-xs text-caos-muted leading-snug mt-0.5 pl-3.5">{r.detail}</div> : null}
        </div>
      ))}
    </div>
  );
}

export function GovernancePanel({
  liveQa,
  liveGaps,
  staleRows,
}: {
  liveQa?: QaQueueItem[];
  liveGaps?: GapItem[];
  staleRows: DigestWatchRow[];
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-2.5">
      <div>
        <h3 className="text-caos-xs font-semibold uppercase tracking-wider text-caos-muted mb-2 px-3">QA Queue · CP-5 open findings</h3>
        <QaQueue items={liveQa} />
      </div>
      <div>
        <h3 className="text-caos-xs font-semibold uppercase tracking-wider text-caos-muted mb-2 px-3">Source Gaps · CP-0 gap log</h3>
        <GapsList items={liveGaps} />
      </div>
      <div>
        <h3 className="text-caos-xs font-semibold uppercase tracking-wider text-caos-muted mb-2 px-3">Stale Sources · digest watch</h3>
        <StaleSources rows={staleRows} />
      </div>
    </div>
  );
}
