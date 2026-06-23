"use client";

// Presentational content sections for the CP-SR Sector Review modal, lifted out
// of SectorReview so the modal holds state + effects and these render. All are
// pure (no state, no handlers). Markup is byte-identical to the former inline JSX.

import { Dot } from "@/components/pipeline/atoms";
import { INDEX_MOVE, TIMEFRAMES, issuerMove } from "@/lib/command/srdata";
import type { SectorReviewData } from "@/lib/command/srdata";
import type { SectorRow } from "@/lib/command/data";

function fmtBps(v: number): string {
  return (v > 0 ? "+" : "") + v + "bps";
}

function moveColor(v: number): string {
  // spreads: wider (positive) = bad, tighter (negative) = good
  return v > 0 ? "var(--caos-critical)" : v < 0 ? "var(--caos-success)" : "var(--caos-muted)";
}

function Metric({ label, value, color, sub }: { label: string; value: string; color?: string; sub?: string }) {
  return (
    <div className="rounded border border-caos-border bg-caos-bg px-2.5 py-2">
      <div className="tabular text-[15px] leading-none" style={{ color: color || "var(--caos-text)" }}>{value}</div>
      <div className="text-caos-2xs uppercase tracking-wider text-caos-muted mt-1">{label}</div>
      {sub ? <div className="tabular text-caos-2xs text-caos-muted">{sub}</div> : null}
    </div>
  );
}

/* ---------- timeframe selector + update-knowledge control ---------- */
export function TimeframeBar({ tf, setTf, refreshed, running, onUpdate }: {
  tf: number;
  setTf: (i: number) => void;
  refreshed: boolean;
  running: boolean;
  onUpdate: () => void;
}) {
  return (
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
        onClick={onUpdate}
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
  );
}

/* ---------- metrics for the selected timeframe ---------- */
export function MetricsGrid({ data, tf, row }: { data: SectorReviewData; tf: number; row: SectorRow }) {
  const dm = data.dm[tf];
  const vsIndex = dm - INDEX_MOVE[tf];
  return (
    <div className="grid grid-cols-4 gap-1.5 p-3">
      <Metric label={"Sector DM Δ " + TIMEFRAMES[tf]} value={fmtBps(dm)} color={moveColor(dm)} />
      <Metric label="vs Lev Loan Index" value={fmtBps(vsIndex)} color={moveColor(vsIndex)} sub={"index " + fmtBps(INDEX_MOVE[tf])} />
      <Metric label="Dispersion" value={data.dispersion[tf] + "bps"} sub="intra-sector p10–p90" />
      <Metric label="EW triggers" value={String(row.ew)} color={row.ew >= 3 ? "var(--caos-critical)" : row.ew > 0 ? "var(--caos-warning)" : "var(--caos-success)"} sub="CP-MON armed" />
    </div>
  );
}

/* ---------- staged refresh trace ---------- */
export function RefreshTrace({ steps, step }: { steps: string[]; step: number }) {
  return (
    <div className="px-4 py-2 border-b border-caos-border bg-caos-elevated/30 shrink-0">
      {steps.map((s, i) => (
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
  );
}

/* ---------- knowledge sources retrieved by the refresh ---------- */
export function KnowledgeSources({ data, refreshed, step }: { data: SectorReviewData; refreshed: boolean; step: number }) {
  return (
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
  );
}

/* ---------- thesis + driver register ---------- */
export function SectorThesis({ data, refreshed }: { data: SectorReviewData; refreshed: boolean }) {
  return (
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
  );
}

/* ---------- impacted issuers ---------- */
export function ImpactedIssuers({ data, tf, refreshed }: { data: SectorReviewData; tf: number; refreshed: boolean }) {
  return (
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
  );
}
