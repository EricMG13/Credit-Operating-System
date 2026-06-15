"use client";

// CP-SR Sector Review window — opened by clicking a sector on the Sector
// Review Board. Timeframe selector (1W…1Y) re-frames the spread analysis and
// issuer impact table; "UPDATE KNOWLEDGE" simulates a CP-SR refresh run that
// re-reads sector sources, appends the newest finding to the driver register,
// re-scores impacted issuers, and stamps the board card as reviewed today.

import { useEffect, useRef, useState } from "react";
import { Dot } from "@/components/pipeline/atoms";
import { StatusGlyph } from "@/components/shared/StatusGlyph";
import { useModalA11y } from "@/lib/use-modal-a11y";
import {
  INDEX_MOVE,
  SECTOR_REVIEWS,
  TIMEFRAMES,
  issuerMove,
} from "@/lib/command/srdata";
import type { SectorRow } from "@/lib/command/data";

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

function fmtBps(v: number): string {
  return (v > 0 ? "+" : "") + v + "bps";
}

function moveColor(v: number): string {
  // spreads: wider (positive) = bad, tighter (negative) = good
  return v > 0 ? "var(--caos-critical)" : v < 0 ? "var(--caos-success)" : "var(--caos-muted)";
}

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
  const dm = data.dm[tf];
  const vsIndex = dm - INDEX_MOVE[tf];

  const metric = (label: string, value: string, color?: string, sub?: string) => (
    <div className="rounded border border-caos-border bg-caos-bg px-2.5 py-2">
      <div className="tabular text-[15px] leading-none" style={{ color: color || "var(--caos-text)" }}>{value}</div>
      <div className="text-caos-2xs uppercase tracking-wider text-caos-muted mt-1">{label}</div>
      {sub ? <div className="tabular text-caos-2xs text-caos-muted">{sub}</div> : null}
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center p-6"
      style={{ background: "rgba(5,5,7,0.72)" }}
      onClick={onClose}
    >
      <div
        ref={panelRef}
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
          <button
            onClick={onClose}
            title="Close (Esc)"
            className="w-5 h-5 rounded border border-caos-border flex items-center justify-center text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos text-caos-md"
          >
            ✕
          </button>
        </div>

        {/* timeframe + update knowledge */}
        <div className="px-3 py-2 border-b border-caos-border flex items-center gap-2 shrink-0">
          <span className="tabular text-caos-2xs uppercase tracking-widest text-caos-muted">Timeframe</span>
          <div className="flex items-center rounded border border-caos-border overflow-hidden">
            {TIMEFRAMES.map((t, i) => (
              <button
                key={t}
                onClick={() => setTf(i)}
                className={"tabular text-caos-sm px-2.5 py-1 transition-caos " + (tf === i ? "bg-caos-elevated text-caos-text" : "text-caos-muted hover:text-caos-text")}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="flex-1" />
          {!refreshed && !running ? (
            <span className="tabular text-caos-2xs text-caos-muted whitespace-nowrap hidden lg:inline">
              no new files required — searches vault + external sources
            </span>
          ) : null}
          <button
            onClick={() => { setStep(0); setRunning(true); }}
            disabled={running || refreshed}
            title="CP-SR scans ingested vault documents and searches external sources (newswires, sell-side, filings) — no file attachment needed"
            className={
              "tabular text-caos-sm px-3 py-1.5 rounded border transition-caos flex items-center gap-1.5 " +
              (refreshed
                ? "border-caos-border text-caos-muted cursor-default"
                : "border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg disabled:opacity-60")
            }
          >
            {running ? <Dot sev="running" pulse /> : null}
            {refreshed ? "✓ KNOWLEDGE CURRENT" : running ? "UPDATING…" : "⟳ UPDATE KNOWLEDGE"}
          </button>
        </div>

        {/* refresh run trace */}
        {running ? (
          <div className="px-4 py-2 border-b border-caos-border bg-caos-elevated/30 shrink-0">
            {REFRESH_STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-2 py-[2px]">
                {i < step ? (
                  <span className="text-caos-xs" style={{ color: "var(--caos-success)" }}>✓</span>
                ) : i === step ? (
                  <Dot sev="running" pulse />
                ) : (
                  <Dot sev="idle" />
                )}
                <span className={"tabular text-caos-sm " + (i <= step ? "text-caos-text" : "text-caos-muted")}>{s}</span>
              </div>
            ))}
          </div>
        ) : null}

        <div className="flex-1 min-h-0 overflow-auto">
          {/* metrics for selected timeframe */}
          <div className="grid grid-cols-4 gap-1.5 p-3">
            {metric("Sector DM Δ " + TIMEFRAMES[tf], fmtBps(dm), moveColor(dm))}
            {metric("vs Lev Loan Index", fmtBps(vsIndex), moveColor(vsIndex), "index " + fmtBps(INDEX_MOVE[tf]))}
            {metric("Dispersion", data.dispersion[tf] + "bps", undefined, "intra-sector p10–p90")}
            {metric("EW triggers", String(row.ew), row.ew >= 3 ? "var(--caos-critical)" : row.ew > 0 ? "var(--caos-warning)" : "var(--caos-success)", "CP-MON armed")}
          </div>

          {/* knowledge sources — retrieved by the refresh search */}
          {(running && step >= 1) || refreshed ? (
            <div className="px-4 pb-3 caos-enter">
              <div className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted mb-1.5 flex items-center gap-2">
                <span>Knowledge sources · {refreshed ? "this refresh" : "searching…"}</span>
                <span className="tabular text-caos-3xs px-1 py-px rounded border border-caos-border text-caos-muted normal-case tracking-normal">
                  {data.sources.filter((s) => s.kind === "external").length} external · {data.sources.filter((s) => s.kind === "vault").length} vault
                </span>
              </div>
              <div className="rounded border border-caos-border overflow-hidden">
                {data.sources.map((s, i) => {
                  const found = refreshed || step >= 2 || i < step * 2;
                  return (
                    <div key={s.name} className="grid grid-cols-[64px_200px_1fr_16px] items-center gap-x-2 px-3 py-[5px] border-b border-caos-border/50 last:border-b-0">
                      <span
                        className="tabular text-caos-3xs px-1 py-px rounded border text-center"
                        style={
                          s.kind === "external"
                            ? { borderColor: "rgba(79,140,255,0.5)", color: "var(--caos-accent)" }
                            : { borderColor: "var(--caos-border)", color: "var(--caos-muted)" }
                        }
                      >
                        {s.kind === "external" ? "EXTERNAL" : "VAULT"}
                      </span>
                      <span className="text-caos-md text-caos-text truncate">{s.name}</span>
                      <span className="text-caos-sm text-caos-muted truncate">{s.detail}</span>
                      {found ? (
                        <span className="text-caos-xs text-right" style={{ color: "var(--caos-success)" }}>✓</span>
                      ) : (
                        <Dot sev="running" pulse />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* thesis + driver register */}
          <div className="px-4 pb-3">
            <div className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted mb-1.5">Sector thesis · CP-SR</div>
            <p className="text-caos-lg text-caos-text/90 leading-relaxed">{data.thesis}</p>
            <div className="mt-2.5 rounded border border-caos-border overflow-hidden">
              {data.drivers.map((d) => (
                <div key={d} className="flex items-center gap-2 px-3 py-[6px] border-b border-caos-border/50 last:border-b-0">
                  <Dot sev="ok" />
                  <span className="text-caos-md text-caos-text/85">{d}</span>
                </div>
              ))}
              {refreshed ? (
                <div className="flex items-center gap-2 px-3 py-[6px] caos-enter" style={{ background: "rgba(79,140,255,0.06)" }}>
                  <Dot sev="running" />
                  <span className="text-caos-md text-caos-text">{data.newFinding}</span>
                  <span className="tabular text-caos-3xs px-1 py-px rounded border border-caos-accent/60 text-caos-accent ml-auto whitespace-nowrap">NEW · this refresh</span>
                </div>
              ) : null}
            </div>
          </div>

          {/* impacted issuers */}
          <div className="px-4 pb-4">
            <div className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted mb-1.5">
              Impacted issuers · Δ DM {TIMEFRAMES[tf]}
            </div>
            <div className="rounded border border-caos-border overflow-hidden">
              {data.issuers.map((i) => {
                const mv = issuerMove(data, i, tf);
                return (
                  <div key={i.code} className="grid grid-cols-[46px_150px_64px_70px_1fr_92px] items-center gap-x-2 px-3 py-[7px] border-b border-caos-border/50 last:border-b-0">
                    <span className="tabular text-caos-accent text-caos-md">{i.code}</span>
                    <span className="text-caos-md text-caos-text truncate">{i.name}</span>
                    <span className={"tabular text-caos-3xs px-1 py-px rounded border text-center " + (i.held ? "border-caos-accent/60 text-caos-accent" : "border-caos-border text-caos-muted")}>
                      {i.held ? "HELD" : "PEER"}
                    </span>
                    <span className="tabular text-caos-md text-right" style={{ color: moveColor(mv) }}>{fmtBps(mv)}</span>
                    <span className="text-caos-sm text-caos-muted leading-snug">{i.impact}</span>
                    <span className="tabular text-caos-2xs text-right" style={{ color: refreshed ? "var(--caos-success)" : "var(--caos-muted)" }}>
                      {refreshed ? "✓ re-scored" : "model current"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
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
