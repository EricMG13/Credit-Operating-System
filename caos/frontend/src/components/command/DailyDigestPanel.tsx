"use client";

// Daily Digest — the live coverage-health readout for the research lens:
// coverage counts, equal-weighted WARF over the manual agency ratings, the
// staleness watch (names whose latest complete run is old or missing), the
// CCC-cliff watch (B3/B- and below), and 24h run activity. Deterministic
// server roll-up (GET /api/digest/daily), rendered only when live.

import { StatusGlyph } from "@/components/shared/StatusGlyph";
import { useIssuerProfileOverlay } from "@/components/shared/IssuerProfileOverlay";
import type { DailyDigest, DigestWatchRow } from "@/lib/api";

export function DailyDigestPanel({ digest }: { digest: DailyDigest }) {
  const cov = digest.coverage || {};
  const act = digest.activity_24h || {};
  const failed = act.runs_failed ?? 0;
  const stats: { l: string; v: string; color?: string }[] = [
    {
      l: "WARF (eq-wt)",
      v: digest.warf != null ? `${digest.warf.toLocaleString("en-US")} · ${digest.warf_band ?? "—"}` : "no rated names",
    },
    { l: "Rated / covered", v: `${cov.rated ?? 0} of ${cov.issuers ?? 0}` },
    { l: "Complete runs", v: `${cov.with_complete_run ?? 0} of ${cov.issuers ?? 0}` },
    {
      l: "Runs 24h",
      v: `${act.runs_completed ?? 0} done · ${failed} failed`,
      color: failed > 0 ? "var(--caos-critical)" : undefined,
    },
  ];
  return (
    <div className="flex flex-col min-h-0">
      {/* 2-col: this panel renders in the ~220-280px CommandContext slot, where
          4 columns collapse to one word per line. */}
      <div className="grid grid-cols-2 gap-px bg-caos-border/50 border-b border-caos-border">
        {stats.map((s) => (
          <div key={s.l} className="bg-caos-panel px-3 py-2">
            <div className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">{s.l}</div>
            <div className="tabular text-caos-xl" style={{ color: s.color || "var(--caos-text)" }}>{s.v}</div>
          </div>
        ))}
      </div>
      <div className="flex-1 min-h-0 grid grid-cols-2 gap-px bg-caos-border/50">
        <WatchList
          title={`Stale coverage · > ${digest.stale_threshold_days}d`}
          rows={digest.stale}
          kind="warning"
          empty="Nothing stale — coverage is fresh."
        />
        <WatchList
          title="CCC-cliff watch · B3/B- and below"
          rows={digest.ccc_watch}
          kind="critical"
          empty="No names at or below B3/B-."
        />
      </div>
    </div>
  );
}

function WatchList({ title, rows, kind, empty }: {
  title: string;
  rows: DigestWatchRow[];
  kind: "warning" | "critical";
  empty: string;
}) {
  const { openProfile } = useIssuerProfileOverlay();
  const color = kind === "critical" ? "var(--caos-critical)" : "var(--caos-warning)";
  return (
    <div className="bg-caos-panel min-h-0 flex flex-col">
      <div className="px-3 h-6 shrink-0 flex items-center gap-1.5 border-b border-caos-border/50">
        {rows.length ? <StatusGlyph kind={kind} size={9} /> : null}
        <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">{title}</span>
        <span className="tabular text-caos-2xs" style={{ color: rows.length ? color : "var(--caos-muted)" }}>{rows.length}</span>
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        {rows.length === 0 ? (
          <p className="px-3 py-2 tabular text-caos-2xs text-caos-muted m-0">{empty}</p>
        ) : (
          <div className="divide-y divide-caos-border/30">
            {rows.map((r) => (
              <button
                key={r.issuer_id}
                onClick={() => openProfile(r.issuer_id)}
                title={`Open ${r.name} profile`}
                className="w-full text-left px-3 py-1 flex items-baseline gap-2 hover:bg-caos-elevated/50 transition-caos focus-ring"
              >
                <span className="text-caos-md text-caos-text truncate flex-1 min-w-[10ch]">{r.name}</span>
                <span className="tabular text-caos-xs truncate shrink text-right min-w-0" style={{ color }} title={r.detail || undefined}>{r.detail || "—"}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
