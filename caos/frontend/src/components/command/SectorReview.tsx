"use client";

// CP-SR Sector Review window — opened by clicking a sector on the Sector
// Review Board. Timeframe selector (1W…1Y) re-frames the spread analysis and
// issuer impact table; "UPDATE KNOWLEDGE" simulates a CP-SR refresh run that
// re-reads sector sources, appends the newest finding to the driver register,
// re-scores impacted issuers, and stamps the board card as reviewed today.

import { useEffect, useRef, useState } from "react";
import { CloseButton } from "@/components/shared/CloseButton";
import { StatusGlyph } from "@/components/shared/StatusGlyph";
import { useModalA11y } from "@/lib/use-modal-a11y";
import { SECTOR_REVIEWS } from "@/lib/command/srdata";
import type { SectorRow } from "@/lib/command/data";
import {
  ImpactedIssuers,
  KnowledgeSources,
  MetricsGrid,
  RefreshTrace,
  SectorThesis,
  TimeframeBar,
} from "./sections";

const STANCE_COLOR: Record<string, string> = {
  CONSTRUCTIVE: "var(--caos-success)",
  NEUTRAL: "var(--caos-muted)",
  CAUTIOUS: "var(--caos-warning)",
  NEGATIVE: "var(--caos-critical)",
};

// A refresh needs no new uploads: CP-SR scans the existing document vault and
// searches external sources, then synthesizes the update.
const REFRESH_STEPS = [
  "CP-0 — scanning ingested vault documents (no new files required)",
  "CP-MON — searching external sources: newswires · sell-side · filings · pricing services",
  "CP-SR — synthesizing sector knowledge update & early-warning thresholds",
  "CP-1C — re-scoring impacted issuers vs refreshed peer set",
];

export function SectorReview({
  row,
  refreshedAt,
  onRefreshed,
  onClose,
}: {
  row: SectorRow;
  refreshedAt: string | null;
  onRefreshed: (sector: string) => void;
  onClose: () => void;
}) {
  const data = SECTOR_REVIEWS[row.sector];
  const [tf, setTf] = useState(1); // default 1M
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(0);
  const refreshed = !!refreshedAt;
  // Keep callback identity out of the interval effect — the parent re-renders
  // on every sim tick and would otherwise reset the step timer.
  const onRefreshedRef = useRef(onRefreshed);
  onRefreshedRef.current = onRefreshed;

  const panelRef = useModalA11y<HTMLDivElement>(onClose);

  // staged CP-SR refresh simulation — stable interval while running
  useEffect(() => {
    if (!running) return;
    const iv = setInterval(() => setStep((s) => s + 1), 650);
    return () => clearInterval(iv);
  }, [running]);

  useEffect(() => {
    if (running && step >= REFRESH_STEPS.length) {
      setRunning(false);
      onRefreshedRef.current(row.sector);
    }
  }, [running, step, row.sector]);

  if (!data) return null;

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center p-6"
      style={{ background: "rgba(5,5,7,0.72)" }}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Sector Review: ${row.sector}`}
        onClick={(e) => e.stopPropagation()}
        className="caos-enter bg-caos-panel border border-caos-border rounded-md w-full max-w-3xl max-h-[88vh] flex flex-col overflow-hidden"
        style={{ boxShadow: "var(--shadow-modal)" }}
      >
        {/* chrome */}
        <div className="h-9 px-3 flex items-center gap-2 border-b border-caos-border bg-caos-elevated/60 shrink-0">
          <span className="tabular text-caos-xl text-caos-text whitespace-nowrap">Sector Review · CP-SR — {row.sector}</span>
          <span className="tabular text-caos-2xs px-1.5 py-px rounded border border-caos-border" style={{ color: STANCE_COLOR[row.stance] }}>
            {row.stance}
          </span>
          {row.ew > 0 ? (
            <span className="tabular text-caos-2xs px-1.5 py-px rounded border border-caos-border" style={{ color: row.ew >= 3 ? "var(--caos-critical)" : "var(--caos-warning)" }}>
              <StatusGlyph kind="warning" /> {row.ew} EW triggers
            </span>
          ) : null}
          <div className="flex-1" />
          <span className="tabular text-caos-xs text-caos-muted whitespace-nowrap">
            {refreshed ? "reviewed today · knowledge current" : "rev. " + row.reviewed + (row.due ? " · REFRESH DUE" : "")}
          </span>
          <CloseButton onClick={onClose} title="Close (Esc)" />
        </div>

        {/* timeframe + update knowledge */}
        <TimeframeBar
          tf={tf}
          setTf={setTf}
          refreshed={refreshed}
          running={running}
          onUpdate={() => { setStep(0); setRunning(true); }}
        />

        {/* refresh run trace */}
        {running ? <RefreshTrace steps={REFRESH_STEPS} step={step} /> : null}

        <div className="flex-1 min-h-0 overflow-auto">
          <MetricsGrid data={data} tf={tf} row={row} />

          {/* knowledge sources — retrieved by the refresh search */}
          {(running && step >= 1) || refreshed ? (
            <KnowledgeSources data={data} refreshed={refreshed} step={step} />
          ) : null}

          <SectorThesis data={data} refreshed={refreshed} />

          <ImpactedIssuers data={data} tf={tf} refreshed={refreshed} />
        </div>

        {/* footer */}
        <div className="px-4 py-2 border-t border-caos-border bg-caos-elevated/40 shrink-0 flex items-center gap-2">
          <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">CP-SR register</span>
          <span className="tabular text-caos-xs px-1.5 py-px rounded border border-caos-border text-caos-muted">
            {data.issuers.filter((i) => i.held).length} held · {data.issuers.filter((i) => !i.held).length} peers monitored
          </span>
          <span className="flex-1" />
          <span className="tabular text-caos-xs" style={{ color: refreshed ? "var(--caos-success)" : "var(--caos-muted)" }}>
            {refreshed
              ? "knowledge updated " + refreshedAt + " · " + data.sources.length + " sources searched · issuers re-scored · board stamped"
              : "last full review " + row.reviewed}
          </span>
        </div>
      </div>
    </div>
  );
}
