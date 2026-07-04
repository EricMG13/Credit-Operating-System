"use client";

// Presentational content sections for the CP-SR Sector Review modal, lifted out
// of SectorReview so the modal holds state + effects and these render. All are
// pure (no state, no handlers). Markup is byte-identical to the former inline JSX.

import { useRef, type KeyboardEvent } from "react";
import { Bar, Dot } from "@/components/pipeline/atoms";
import { StatusGlyph } from "@/components/shared/StatusGlyph";
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
      <div className="tabular text-caos-metric leading-none" style={{ color: color || "var(--caos-text)" }}>{value}</div>
      <div className="text-caos-2xs uppercase tracking-wider text-caos-muted mt-1">{label}</div>
      {sub ? <div className="tabular text-caos-2xs text-caos-muted">{sub}</div> : null}
    </div>
  );
}

/* ---------- timeframe selector + update-knowledge control ---------- */
export function TimeframeBar({ tf, setTf, refreshed, running, partial, onUpdate }: {
  tf: number;
  setTf: (i: number) => void;
  refreshed: boolean;
  running: boolean;
  partial: boolean;
  onUpdate: () => void;
}) {
  const chipRefs = useRef<(HTMLButtonElement | null)[]>([]);
  // Roving tabindex: the group is one tab-stop; ←/→/↑/↓ move selection and
  // focus, Home/End jump to ends (standard radiogroup keyboard pattern).
  const rove = (to: number) => {
    const n = (to + TIMEFRAMES.length) % TIMEFRAMES.length;
    setTf(n);
    chipRefs.current[n]?.focus();
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); rove(tf + 1); }
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); rove(tf - 1); }
    else if (e.key === "Home") { e.preventDefault(); rove(0); }
    else if (e.key === "End") { e.preventDefault(); rove(TIMEFRAMES.length - 1); }
  };

  // A partial refresh (a source timed out) re-arms the button as RETRY.
  const retryable = refreshed && partial;

  return (
    <div className="px-3 py-2 border-b border-caos-border flex items-center gap-2 shrink-0">
      <span id="tf-label" className="tabular text-caos-2xs uppercase tracking-widest text-caos-muted">Timeframe</span>
      <div role="radiogroup" aria-labelledby="tf-label" onKeyDown={onKey} className="flex items-center rounded border border-caos-border overflow-hidden">
        {TIMEFRAMES.map((t, i) => (
          <button
            key={t}
            ref={(el) => { chipRefs.current[i] = el; }}
            type="button"
            role="radio"
            aria-checked={tf === i}
            tabIndex={tf === i ? 0 : -1}
            onClick={() => setTf(i)}
            className={
              "tabular text-caos-xs px-2.5 py-1 border-b-2 transition-caos focus-ring " +
              (tf === i ? "bg-caos-elevated text-caos-text border-caos-accent" : "text-caos-muted border-transparent hover:text-caos-text")
            }
          >
            {t}
          </button>
        ))}
      </div>
      <div className="flex-1" />
      {!refreshed && !running ? (
        <span className="tabular text-caos-2xs text-caos-muted whitespace-nowrap hidden sm:inline">
          no uploads needed — re-scans sources, usually confirms current marks
        </span>
      ) : null}
      <button
        onClick={onUpdate}
        disabled={running || (refreshed && !partial)}
        title={retryable
          ? "Some sources timed out — retry re-attempts the unreachable ones"
          : "CP-SR scans ingested vault documents and searches external sources (newswires, sell-side, filings) — no file attachment needed"}
        className={
          "tabular text-caos-xs px-3 py-1.5 rounded border transition-caos flex items-center gap-1.5 focus-ring " +
          (retryable
            ? "border-caos-warning text-caos-warning hover:bg-caos-warning hover:text-caos-bg"
            : refreshed
              ? "border-caos-border text-caos-muted cursor-default"
              : "border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg disabled:opacity-60")
        }
      >
        {retryable ? <StatusGlyph kind="warning" /> : refreshed ? <StatusGlyph kind="success" /> : running ? <Dot sev="running" pulse /> : null}
        {retryable ? "RETRY" : refreshed ? "KNOWLEDGE CURRENT" : running ? "UPDATING…" : "UPDATE KNOWLEDGE"}
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
      {/* visible progress — the sr-only live region carries the same to AT */}
      <div className="flex items-center gap-2 mb-1.5">
        <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted whitespace-nowrap">Refreshing knowledge</span>
        <span className="tabular text-caos-2xs text-caos-muted whitespace-nowrap">step {Math.min(step + 1, steps.length)} / {steps.length}</span>
        <div className="flex-1"><Bar pct={(Math.min(step, steps.length) / steps.length) * 100} h={2} /></div>
      </div>
      {steps.map((s, i) => (
        <div key={s} className="flex items-center gap-2 py-[2px]">
          {i < step ? (
            <span className="inline-flex" style={{ color: "var(--caos-success)" }}><StatusGlyph kind="success" size={10} /></span>
          ) : i === step ? (
            <Dot sev="running" pulse />
          ) : (
            <Dot sev="idle" />
          )}
          <span className={"tabular text-caos-xs " + (i <= step ? "text-caos-text" : "text-caos-muted")}>{s}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------- knowledge sources retrieved by the refresh ---------- */
export function KnowledgeSources({ data, refreshed, step, retried }: { data: SectorReviewData; refreshed: boolean; step: number; retried: boolean }) {
  return (
    <div className="px-4 pb-3 caos-enter">
      <div className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted mb-1.5 flex items-center gap-2">
        <span>Knowledge sources · {refreshed ? "this refresh" : "searching…"}</span>
        <span className="tabular text-caos-2xs px-1 py-px rounded border border-caos-border text-caos-muted normal-case tracking-normal">
          {data.sources.filter((s) => s.kind === "external").length} external · {data.sources.filter((s) => s.kind === "vault").length} vault
        </span>
      </div>
      <div className="rounded border border-caos-border overflow-hidden">
        {data.sources.map((s, i) => {
          const reachable = retried || s.reachable !== false;
          const searched = refreshed || step >= 2; // the CP-MON external-search step has run
          const found = reachable && (refreshed || step >= 2 || i < step * 2);
          const rowClass = "grid grid-cols-[64px_200px_1fr_16px] items-center gap-x-2 px-3 py-[5px] border-b border-caos-border/50 last:border-b-0 text-left";
          const inner = (
            <>
              <span
                className="tabular text-caos-2xs px-1 py-px rounded border text-center"
                style={
                  s.kind === "external"
                    ? { borderColor: "color-mix(in srgb, var(--caos-accent) 50%, transparent)", color: "var(--caos-accent)" }
                    : { borderColor: "var(--caos-border)", color: "var(--caos-muted)" }
                }
              >
                {s.kind === "external" ? "EXTERNAL" : "VAULT"}
              </span>
              <span className="text-caos-md text-caos-text truncate">{s.name}</span>
              <span className="text-caos-xs text-caos-muted truncate">{s.detail}{!reachable && searched ? " · timed out" : ""}</span>
              {!reachable && searched ? (
                <span className="flex justify-end" style={{ color: "var(--caos-critical)" }} title="Source did not respond — retry re-attempts it"><StatusGlyph kind="critical" size={10} /></span>
              ) : found ? (
                <span className="flex justify-end" style={{ color: "var(--caos-success)" }}><StatusGlyph kind="success" size={10} /></span>
              ) : (
                <Dot sev="running" pulse />
              )}
            </>
          );
          // Only a source with a registered URL is an actual affordance; the rest
          // are pointers, so they render as plain rows (no fake button/hover).
          return s.url ? (
            <button
              key={s.name}
              type="button"
              onClick={() => window.open(s.url, "_blank", "noopener,noreferrer")}
              title="Open source"
              className={"w-full " + rowClass + " hover:bg-caos-elevated/50 transition-caos focus-ring"}
            >
              {inner}
            </button>
          ) : (
            <div key={s.name} title="Source pointer — no direct file registered in demo data" className={rowClass}>
              {inner}
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
      <p className="text-caos-md text-caos-text/90 leading-relaxed max-w-[70ch] [text-wrap:pretty]">{data.thesis}</p>
      <div className="mt-2.5 rounded border border-caos-border overflow-hidden">
        {data.drivers.map((d) => (
          <div key={d} className="px-3 py-[6px] border-b border-caos-border/50 last:border-b-0">
            <span className="text-caos-md text-caos-text/85">{d}</span>
          </div>
        ))}
        {refreshed ? (
          <div className="flex items-center gap-2 px-3 py-[6px] caos-enter" style={{ background: "color-mix(in srgb, var(--caos-accent) 6%, transparent)" }}>
            <Dot sev="running" />
            <span className="text-caos-md text-caos-text">{data.newFinding}</span>
            <span className="tabular text-caos-2xs px-1 py-px rounded border border-caos-accent/60 text-caos-accent ml-auto whitespace-nowrap">NEW · this refresh</span>
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
            <div key={i.code} className="grid grid-cols-[46px_150px_64px_70px_1fr_104px] items-center gap-x-2 px-3 py-[7px] border-b border-caos-border/50 last:border-b-0">
              <span className="tabular text-caos-accent text-caos-md">{i.code}</span>
              <span className="text-caos-md text-caos-text truncate">{i.name}</span>
              <span className={"tabular text-caos-2xs px-1 py-px rounded border text-center " + (i.held ? "border-caos-accent/60 text-caos-accent" : "border-caos-border text-caos-muted")}>
                {i.held ? "HELD" : "PEER"}
              </span>
              <span className="tabular text-caos-md text-right" style={{ color: moveColor(mv) }}>{fmtBps(mv)}</span>
              <span className="text-caos-xs text-caos-muted leading-snug">{i.impact}</span>
              {/* Post-refresh: the model is re-run; the demo inputs don't move,
                  so the score delta is truthfully ±0 rather than a claimed change. */}
              <span className="tabular text-caos-2xs flex items-center justify-end gap-1" style={{ color: refreshed ? "var(--caos-success)" : "var(--caos-muted)" }}>
                {refreshed ? <><StatusGlyph kind="success" size={9} /> re-scored ±0</> : "model current"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
