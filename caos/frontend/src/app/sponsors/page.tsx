"use client";

// Sponsor track record — the cross-issuer CP-2D governance roll-up, grouped by
// the analyst-entered Issuer.sponsor field: what has this PE owner done to
// creditors across the names we cover? A read-model over persisted runs
// (GET /api/sponsors); live-only with an honest empty state — no seeded demo
// fallback, since a fabricated sponsor history would be worse than none.

import { useEffect, useState } from "react";
import Link from "next/link";
import { RequireAuth } from "@/components/shared/RequireAuth";
import { Panel } from "@/components/shared/Panel";
import { ConceptNav } from "@/components/shared/ConceptNav";
import { StatusGlyph } from "@/components/shared/StatusGlyph";
import { useIssuerProfileOverlay } from "@/components/shared/IssuerProfileOverlay";
import {
  getSponsors, getSponsorTrackRecord,
  type SponsorIssuerRow, type SponsorSummary, type SponsorTrackRecord,
} from "@/lib/api";

export default function SponsorsPage() {
  return (
    <RequireAuth>
      <SponsorsView />
    </RequireAuth>
  );
}

function SponsorsView() {
  // null = loading; [] = loaded-empty (or unreachable backend — same honest state).
  const [sponsors, setSponsors] = useState<SponsorSummary[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [record, setRecord] = useState<SponsorTrackRecord | null>(null);
  const [recordLoading, setRecordLoading] = useState(false);

  useEffect(() => {
    let stale = false;
    getSponsors()
      .then((rows) => {
        if (stale) return;
        setSponsors(rows);
        setSelected(rows[0]?.sponsor ?? null);
      })
      .catch(() => { if (!stale) setSponsors([]); });
    return () => { stale = true; };
  }, []);

  useEffect(() => {
    if (!selected) { setRecord(null); return; }
    let stale = false;
    setRecordLoading(true);
    getSponsorTrackRecord(selected)
      .then((r) => { if (!stale) setRecord(r); })
      .catch(() => { if (!stale) setRecord(null); })
      .finally(() => { if (!stale) setRecordLoading(false); });
    return () => { stale = true; };
  }, [selected]);

  return (
    <div className="h-screen flex flex-col bg-caos-bg">
      {/* sub-header */}
      <div className="h-10 shrink-0 border-b border-caos-border bg-caos-panel/60 flex items-center gap-3 px-4">
        <Link href="/issuers" className="text-caos-muted hover:text-caos-text text-caos-xl transition-caos whitespace-nowrap no-underline">
          ← Directory
        </Link>
        <div className="h-4 w-px bg-caos-border" />
        <span className="text-caos-xl text-caos-text font-medium whitespace-nowrap">Sponsor Track Records</span>
        <span className="tabular text-caos-sm text-caos-muted whitespace-nowrap truncate">
          {sponsors === null ? "loading…" : `${sponsors.length} sponsor${sponsors.length === 1 ? "" : "s"} · CP-2D governance roll-up`}
        </span>
        <div className="flex-1" />
        <ConceptNav />
      </div>

      <div className="flex-1 min-h-0 p-2 flex gap-2">
        {/* sponsor register */}
        <Panel title="Sponsors · by coverage" className="w-80 shrink-0">
          {sponsors === null ? (
            <p className="px-3 py-2.5 tabular text-caos-sm text-caos-muted m-0">Loading…</p>
          ) : sponsors.length === 0 ? (
            <div className="px-3 py-2.5 flex flex-col gap-1.5">
              <p className="tabular text-caos-sm text-caos-muted m-0">No sponsors on file.</p>
              <p className="tabular text-caos-2xs text-caos-muted m-0">
                Set “Sponsor / PE owner” when creating an issuer — track records aggregate CP-2D reviews across a sponsor’s names.
              </p>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-caos-border/30">
              {sponsors.map((s) => (
                <button
                  key={s.sponsor}
                  onClick={() => setSelected(s.sponsor)}
                  aria-pressed={selected === s.sponsor}
                  className={
                    "w-full text-left px-3 py-2 flex items-baseline gap-2 transition-caos focus-ring hover:bg-caos-elevated/50 " +
                    (selected === s.sponsor ? "bg-caos-elevated/70" : "")
                  }
                >
                  <span className="text-caos-lg text-caos-text truncate flex-1">{s.sponsor}</span>
                  <span className="tabular text-caos-xs text-caos-muted whitespace-nowrap">
                    {s.issuer_count} name{s.issuer_count === 1 ? "" : "s"}
                  </span>
                </button>
              ))}
            </div>
          )}
        </Panel>

        {/* track record */}
        <Panel
          title={selected ? `Track record · ${selected}` : "Track record"}
          className="flex-1 min-w-0"
          right={record?.avg_governance_risk_score != null
            ? <span className="tabular text-caos-xs text-caos-muted">avg governance risk {record.avg_governance_risk_score}</span>
            : undefined}
        >
          {!selected ? (
            <p className="px-3 py-2.5 tabular text-caos-sm text-caos-muted m-0">Select a sponsor.</p>
          ) : recordLoading ? (
            <p className="px-3 py-2.5 tabular text-caos-sm text-caos-muted m-0">Loading…</p>
          ) : !record ? (
            <p className="px-3 py-2.5 tabular text-caos-sm text-caos-muted m-0">Couldn’t load this sponsor’s record.</p>
          ) : (
            <TrackRecord record={record} />
          )}
        </Panel>
      </div>
    </div>
  );
}

function TrackRecord({ record }: { record: SponsorTrackRecord }) {
  const flags = Object.entries(record.flag_counts).sort((a, b) => b[1] - a[1]);
  return (
    <div className="flex flex-col">
      {/* the track record itself: which red flags recur, at how many names */}
      <div className="px-3 py-2 border-b border-caos-border/50 flex flex-wrap items-center gap-1.5">
        {flags.length === 0 ? (
          <span className="tabular text-caos-xs text-caos-muted">No CP-2D red flags across covered names.</span>
        ) : (
          flags.map(([flag, n]) => (
            <span
              key={flag}
              className="inline-flex items-center gap-1 tabular text-caos-2xs px-1.5 py-0.5 rounded border"
              style={{
                borderColor: "color-mix(in srgb, var(--caos-warning) 45%, transparent)",
                color: "var(--caos-warning)",
              }}
            >
              <StatusGlyph kind="warning" size={9} />
              {flag} · {n} of {record.issuer_count}
            </span>
          ))
        )}
      </div>
      {/* per-name rows */}
      <div className="grid grid-cols-[minmax(180px,2fr)_90px_110px_1fr_90px] gap-x-3 px-3 h-7 items-center border-b border-caos-border">
        {["Name", "Net lev", "Gov. risk", "Flags", "QA"].map((h) => (
          <span key={h} className="tabular text-caos-xs uppercase tracking-wider text-caos-muted">{h}</span>
        ))}
      </div>
      <div className="divide-y divide-caos-border/30">
        {record.issuers.map((row) => <IssuerRow key={row.issuer_id} row={row} />)}
      </div>
    </div>
  );
}

function IssuerRow({ row }: { row: SponsorIssuerRow }) {
  const { openProfile } = useIssuerProfileOverlay();
  return (
    <div className="grid grid-cols-[minmax(180px,2fr)_90px_110px_1fr_90px] gap-x-3 px-3 py-1.5 items-baseline">
      <button
        onClick={() => openProfile(row.issuer_id)}
        className="text-left text-caos-lg text-caos-text hover:text-caos-accent transition-caos focus-ring truncate"
        title={`Open ${row.name} profile`}
      >
        {row.name}
        {row.ticker ? <span className="tabular text-caos-xs text-caos-muted ml-1.5">{row.ticker.toUpperCase()}</span> : null}
      </button>
      <span className="tabular text-caos-md text-caos-text">
        {row.net_leverage != null ? row.net_leverage.toFixed(1) + "×" : "—"}
      </span>
      <span className="tabular text-caos-md text-caos-text">
        {row.governance_risk_score != null ? row.governance_risk_score : row.run_id ? "unscored" : "no run"}
      </span>
      <span className="tabular text-caos-xs truncate" style={{ color: row.flags.length ? "var(--caos-warning)" : "var(--caos-muted)" }}>
        {row.flags.length ? row.flags.join(" · ") : "none"}
      </span>
      <span className="tabular text-caos-xs text-caos-muted">{row.qa_status || "—"}</span>
    </div>
  );
}
