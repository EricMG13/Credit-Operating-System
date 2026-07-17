"use client";

// The shared governance queue: six live categories reflecting the persona
// resolution's "shared Governance Queue containing source gaps, stale
// conclusions, failed gates, mixed-origin content, and overdue refreshes"
// (each finding exposes issuer, severity, age, and — via IssuerLink/module
// links — its remediation route). Mounted identically on Command and
// Monitor so QA queues are visible from both, per the handoff.
//
//   QA Queue        · CP-5 severity gate: Blocked/Restricted runs
//   Failed Gates     · CP-5 passed but the committee gate still refuses
//                      readiness (low confidence / unrecognized status)
//   Source Gaps      · CP-0 source-readiness gap log
//   Mixed Origin     · a live-run-backed issuer whose bespoke tabs still
//                      render the Atlas Forge reference fixture (FE-5)
//   Stale Sources    · a completed run has aged past the digest threshold
//   Overdue Refresh  · never run at all — a coverage gap, not a freshness one
//
// Stale Sources and Overdue Refresh both derive from the same digest.stale
// array (routes/digest.py conflates "aging" and "never run" into one list);
// splitting them here on the `detail === "never run"` marker gives each its
// own honest column instead of mislabeling a never-covered issuer as merely
// "stale".

import { QaQueue, GapsList } from "@/components/command/views";
import { IssuerLink } from "@/components/shared/IssuerLink";
import { SurfaceState } from "@/components/shared/SurfaceState";
import type { QaQueueItem, GapItem } from "@/lib/command/data";
import type { DigestWatchRow } from "@/lib/api";

function WatchList({
  rows,
  badge,
  badgeColor,
  emptyBody,
}: {
  rows: DigestWatchRow[];
  badge: string;
  badgeColor: string;
  emptyBody: string;
}) {
  if (rows.length === 0) {
    return <SurfaceState kind="empty" title={emptyBody} compact className="mx-3" />;
  }
  return (
    <div>
      {rows.map((r) => (
        <div key={r.issuer_id} className="px-3 py-[6px] border-b border-caos-border/50">
          <div className="flex items-center gap-2">
            <span
              className="tabular text-caos-2xs uppercase tracking-wider px-1.5 py-px rounded border"
              style={{
                color: badgeColor,
                borderColor: `color-mix(in srgb, ${badgeColor} 40%, transparent)`,
                background: `color-mix(in srgb, ${badgeColor} 8%, transparent)`,
              }}
            >
              {badge}
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

function Category({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-caos-xs font-semibold uppercase tracking-wider text-caos-muted mb-2 px-3">{title}</h3>
      {children}
    </div>
  );
}

type SourceStatus = "loading" | "error" | "ready";

function SourceUnavailable({ source, status }: { source: string; status: Exclude<SourceStatus, "ready"> }) {
  const loading = status === "loading";
  return (
    <SurfaceState
      kind={loading ? "loading" : "error"}
      title={`${source} has not resolved`}
      detail="This category cannot be marked clear."
      compact
      className="m-3"
    />
  );
}

export function GovernancePanel({
  liveQa,
  liveFailedGates,
  liveGaps,
  liveMixedOrigin,
  staleRows,
  findingStatus = "ready",
  qaStatus = "ready",
  digestStatus = "ready",
}: {
  liveQa?: QaQueueItem[];
  liveFailedGates?: QaQueueItem[];
  liveGaps?: GapItem[];
  liveMixedOrigin?: DigestWatchRow[];
  staleRows: DigestWatchRow[];
  findingStatus?: SourceStatus;
  qaStatus?: SourceStatus;
  digestStatus?: SourceStatus;
}) {
  const aging = staleRows.filter((r) => r.detail !== "never run");
  const neverRun = staleRows.filter((r) => r.detail === "never run");

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-2.5">
      <Category title="QA Queue · CP-5 open findings">
        {findingStatus === "ready"
          ? <QaQueue items={liveQa ?? []} />
          : <SourceUnavailable source="Live CP-5 findings" status={findingStatus} />}
      </Category>
      <Category title="Failed Gates · committee gate">
        {qaStatus === "ready" ? (
          <QaQueue
            items={liveFailedGates ?? []}
            noFallback
            emptyLabel="No failed gates"
            emptyBody="No committee-gate failures beyond CP-5 severity. New non-severity gate failures land here."
          />
        ) : <SourceUnavailable source="Live committee-gate status" status={qaStatus} />}
      </Category>
      <Category title="Source Gaps · CP-0 gap log">
        {qaStatus === "ready"
          ? <GapsList items={liveGaps ?? []} />
          : <SourceUnavailable source="Live CP-0 source status" status={qaStatus} />}
      </Category>
      <Category title="Mixed Origin · reference + live run">
        {qaStatus === "ready" ? (
          <WatchList
            rows={liveMixedOrigin ?? []}
            badge="MIXED"
            badgeColor="var(--caos-accent)"
            emptyBody="No mixed-origin runs — every covered issuer's tabs share one provenance."
          />
        ) : <SourceUnavailable source="Live provenance status" status={qaStatus} />}
      </Category>
      <Category title="Stale Sources · digest watch">
        {digestStatus === "ready" ? (
          <WatchList
            rows={aging}
            badge="STALE"
            badgeColor="var(--caos-warning)"
            emptyBody="No stale sources — every covered issuer is within the freshness window."
          />
        ) : <SourceUnavailable source="Daily digest freshness" status={digestStatus} />}
      </Category>
      <Category title="Overdue Refresh · never run">
        {digestStatus === "ready" ? (
          <WatchList
            rows={neverRun}
            badge="OVERDUE"
            badgeColor="var(--caos-critical)"
            emptyBody="No overdue refreshes — every covered issuer has run at least once."
          />
        ) : <SourceUnavailable source="Daily digest coverage" status={digestStatus} />}
      </Category>
    </div>
  );
}
