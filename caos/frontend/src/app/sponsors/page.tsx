"use client";

// Sponsor track record — the cross-issuer CP-2D governance roll-up, grouped by
// the analyst-entered Issuer.sponsor field: what has this PE owner done to
// creditors across the names we cover? A read-model over persisted runs
// (GET /api/sponsors); live-only with an honest empty state — no seeded demo
// fallback, since a fabricated sponsor history would be worse than none.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { RequireAuth } from "@/components/shared/RequireAuth";
import { Panel } from "@/components/shared/Panel";
import { EnterprisePage } from "@/components/shared/EnterprisePage";
import { ShellIdentity } from "@/components/shared/ShellIdentity";
import { StatusGlyph } from "@/components/shared/StatusGlyph";
import { WorkbenchToolbar } from "@/components/shared/WorkbenchToolbar";
import { PersonaWorkbench } from "@/components/shared/PersonaWorkbench";
import { DominantTableRegion } from "@/components/shared/DominantTableRegion";
import { SurfaceState } from "@/components/shared/SurfaceState";
import { AnalysisContextSaveState } from "@/components/shared/AnalysisContextSaveState";
import { useIssuerProfileOverlay } from "@/components/shared/IssuerProfileOverlay";
import {
  getSponsors, getSponsorTrackRecord,
  type SponsorIssuerRow, type SponsorSummary, type SponsorTrackRecord,
} from "@/lib/api";
import { contextHref, useAnalysisContext } from "@/lib/analysis-workbench";

export default function SponsorsPage() {
  return (
    <RequireAuth>
      <SponsorsView />
    </RequireAuth>
  );
}

function SponsorsView() {
  const analysis = useAnalysisContext({ name: "Sponsor review" });
  const { openProfile } = useIssuerProfileOverlay();
  // null = loading; [] = loaded-empty. Transport failure is separate: an
  // unreachable register must never read as "no sponsors".
  const [sponsors, setSponsors] = useState<SponsorSummary[] | null>(null);
  const [sponsorsError, setSponsorsError] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [record, setRecord] = useState<SponsorTrackRecord | null>(null);
  const [recordLoading, setRecordLoading] = useState(false);
  const [recordError, setRecordError] = useState(false);
  const [recordRetry, setRecordRetry] = useState(0);

  const loadSponsors = useCallback(() => {
    let stale = false;
    setSponsors(null);
    setSponsorsError(false);
    getSponsors()
      .then((rows) => {
        if (stale) return;
        setSponsors(rows);
        const saved = analysis.context?.artifacts.sponsor_id
          ?? analysis.context?.surface_state.sponsors?.active_id;
        setSelected(saved && rows.some((row) => row.sponsor === saved) ? saved : rows[0]?.sponsor ?? null);
      })
      .catch(() => { if (!stale) { setSponsors([]); setSponsorsError(true); } });
    return () => { stale = true; };
  }, [
    analysis.context?.artifacts.sponsor_id,
    analysis.context?.surface_state.sponsors?.active_id,
  ]);

  useEffect(() => {
    return loadSponsors();
  }, [loadSponsors]);

  useEffect(() => {
    if (!selected) { setRecord(null); return; }
    let stale = false;
    setRecordLoading(true);
    setRecordError(false);
    getSponsorTrackRecord(selected)
      .then((r) => { if (!stale) setRecord(r); })
      .catch(() => { if (!stale) { setRecord(null); setRecordError(true); } })
      .finally(() => { if (!stale) setRecordLoading(false); });
    return () => { stale = true; };
  }, [selected, recordRetry]);

  const sponsorsContext = analysis.context;
  const patchSponsorsContext = analysis.patch;
  useEffect(() => {
    const context = sponsorsContext;
    if (!context || !selected) return;
    if (
      context.artifacts.sponsor_id === selected
      && context.surface_state.sponsors?.active_id === selected
    ) return;
    void patchSponsorsContext({
      artifacts: { ...context.artifacts, sponsor_id: selected },
      surface_state: {
        ...context.surface_state,
        sponsors: { ...(context.surface_state.sponsors ?? {}), active_id: selected, view: "track-record" },
      },
    }).catch(() => undefined);
  }, [patchSponsorsContext, selected, sponsorsContext]);

  const openSponsorIssuer = (issuerId: string) => {
    const context = analysis.context;
    if (context) {
      void analysis.patch({
        issuer_ids: context.issuer_ids.includes(issuerId) ? context.issuer_ids : [...context.issuer_ids, issuerId],
        surface_state: {
          ...context.surface_state,
          sponsors: { ...(context.surface_state.sponsors ?? {}), selected_ids: [issuerId] },
        },
      }).then(() => openProfile(issuerId)).catch(() => undefined);
      return;
    }
    openProfile(issuerId);
  };

  return (
    <EnterprisePage kind="worklist"
      identity={<ShellIdentity tag="CP-2D" title="Sponsor Track Records" />}
      primaryAction={
        <button
          type="button"
          disabled={!selected}
          onClick={() => document.getElementById("sponsor-record")?.focus()}
          className="caos-primary-action focus-ring disabled:opacity-40"
        >
          Review selected sponsor
        </button>
      }
      status={<AnalysisContextSaveState analysis={analysis} />}
      contextualControls={
        <span className="tabular text-caos-sm text-caos-muted whitespace-nowrap">
          {sponsors === null ? "Loading register" : sponsorsError ? "Register unavailable" : `${sponsors.length} sponsors`}
        </span>
      }
      narrowContract={{ essentialControls: null }}
    >
      <div className="caos-persona-route sponsors-workbench flex-1 min-h-0 p-2">
      <PersonaWorkbench surface="sponsors" primary={<div className="h-full min-h-0 flex flex-col">
      <WorkbenchToolbar
        title="Sponsor coverage"
        description="Select a sponsor to inspect cross-name governance and ownership history."
        count={sponsors === null ? "Loading" : sponsorsError ? "Unavailable" : `${sponsors.length} sponsors`}
        viewLabel="Shared worklist"
      />

      <DominantTableRegion ownerId="sponsor-register" label="Sponsor coverage register" className="flex-1 min-h-0">
      <div className="h-full min-h-0 flex gap-2">
        {/* sponsor register */}
        <Panel title="Sponsors · by coverage" className="w-80 shrink-0">
          {sponsors === null ? (
            <div className="p-3"><SurfaceState kind="loading" title="Loading sponsor register" compact /></div>
          ) : sponsorsError ? (
            <div className="p-3">
              <SurfaceState
                kind="offline"
                title="Sponsor register unavailable"
                detail="The service could not be reached. No conclusion was drawn from the missing response."
                primaryAction={<button type="button" onClick={loadSponsors} className="caos-action-primary focus-ring">Retry</button>}
              />
            </div>
          ) : sponsors.length === 0 ? (
            <div className="p-3">
              <SurfaceState
                kind="empty"
                title="No sponsors on file"
                detail="Set Sponsor / PE owner on an issuer. Track records aggregate observed CP-2D reviews across that sponsor’s covered names."
                primaryAction={<Link href={analysis.context ? contextHref("/issuers", analysis.context.id) : "/issuers"} className="caos-secondary-action focus-ring no-underline">Open issuer directory</Link>}
              />
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
        <div id="sponsor-record" tabIndex={-1} className="flex-1 min-w-0 focus:outline-none">
        <Panel
          title={selected ? `Track record · ${selected}` : "Track record"}
          className="h-full"
          right={record?.avg_governance_risk_score != null
            ? <span className="tabular text-caos-xs text-caos-muted">avg governance risk {record.avg_governance_risk_score}</span>
            : undefined}
        >
          {sponsors !== null && sponsors.length === 0 && !sponsorsError ? (
            <div className="p-3"><SurfaceState kind="empty" title="Add sponsors first" detail="Set a Sponsor / PE owner on a covered issuer — track records build from covered names." compact /></div>
          ) : !selected ? (
            <div className="p-3"><SurfaceState kind="empty" title="Select a sponsor" detail="Choose a covered sponsor to inspect recurring governance flags and source health." compact /></div>
          ) : recordLoading ? (
            <div className="p-3"><SurfaceState kind="loading" title={`Loading ${selected}`} detail="Retrieving the persisted cross-name CP-2D record." compact /></div>
          ) : recordError || !record ? (
            <div className="p-3">
              <SurfaceState
                kind="unavailable"
                title="Sponsor record unavailable"
                detail="The selected sponsor record could not be loaded. The current sponsor selection is preserved."
                supporting={<p className="tabular text-caos-xs text-caos-text">Preserved: {selected}</p>}
                primaryAction={<button type="button" onClick={() => setRecordRetry((n) => n + 1)} className="caos-action-primary focus-ring">Retry</button>}
              />
            </div>
          ) : (
            <TrackRecord record={record} onOpenIssuer={openSponsorIssuer} contextId={analysis.context?.id} />
          )}
        </Panel>
        </div>
      </div>
      </DominantTableRegion>
      </div>} />
      </div>
    </EnterprisePage>
  );
}

function TrackRecord({ record, onOpenIssuer, contextId }: { record: SponsorTrackRecord; onOpenIssuer: (issuerId: string) => void; contextId?: string }) {
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
        {record.issuers.map((row) => <IssuerRow key={row.issuer_id} row={row} onOpen={onOpenIssuer} />)}
      </div>
      <div className="grid gap-2 border-t border-caos-border p-3 lg:grid-cols-2">
        <div className="rounded border border-caos-border bg-caos-bg/40 p-2">
          <p className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">Source health</p>
          <p className="mt-1 text-caos-sm text-caos-text">
            {record.issuers.filter((row) => row.run_id).length}/{record.issuer_count} names have a completed CP-2D run · {record.issuers.filter((row) => row.qa_status === "Blocked").length} blocked
          </p>
        </div>
        <div className="rounded border border-caos-border bg-caos-bg/40 p-2">
          <p className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">Monitoring thresholds</p>
          <p className="mt-1 text-caos-sm text-caos-muted">Sponsor-level thresholds are not stored in CP-2D. Route recurring flags to the issuer alert inbox.</p>
          <Link href={contextId ? contextHref("/monitor", contextId) : "/monitor"} className="mt-1 inline-block text-caos-xs text-caos-accent focus-ring">Open Monitor →</Link>
        </div>
      </div>
    </div>
  );
}

function IssuerRow({ row, onOpen }: { row: SponsorIssuerRow; onOpen: (issuerId: string) => void }) {
  return (
    <div className="grid grid-cols-[minmax(180px,2fr)_90px_110px_1fr_90px] gap-x-3 px-3 py-1.5 items-baseline">
      <button
        onClick={() => onOpen(row.issuer_id)}
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
