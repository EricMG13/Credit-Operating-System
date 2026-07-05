"use client";

// Command Center views: portfolio posture table, CP-MON email intelligence,
// live alert feed, CP-SR sector board, coverage matrix, QA queue, source gaps
// and the issuer detail strip (port of design bundle concept-a.jsx).

import { useEffect, useMemo, useRef, useState } from "react";
import { CloseButton } from "@/components/shared/CloseButton";
import Link from "next/link";
import { StatusGlyph } from "@/components/shared/StatusGlyph";
import { useModalA11y } from "@/lib/use-modal-a11y";
import {
  ALERTS, COVERAGE, EMAIL_TILES, EMAIL_TOTAL, EMAILS, FEED_LINKABLE_ISSUERS, GAPS, PORTFOLIO, QA_QUEUE, SECTORS,
  type EmailRow,
} from "@/lib/command/data";
import { simClock } from "@/lib/pipeline/sim-engine";
import { STANCE_COLOR } from "@/lib/command/srdata";
import { SEV_COLOR, sevSurface } from "@/lib/pipeline/sev";
import { Dot, Tag, ToggleGroup } from "@/components/pipeline/atoms";
import { SectorReview } from "@/components/command/SectorReview";
import { onActivate } from "@/lib/a11y";
import { IssuerLink } from "@/components/shared/IssuerLink";
import { FilterHeader, useColumnFilters, type FilterState } from "@/components/shared/TableColumnFilter";
import { createRun, getRun } from "@/lib/api";
import type { RunSummaryDTO } from "@/lib/engine/types";
import {
  COVERAGE_LAYERS, STATUS_RANK, worstStatus, rollupRunToCells, runnableIssuerId, ATLF_COVERAGE_ROW,
} from "@/lib/command/coverage";

export const POSTURE_COLOR: Record<string, string> = {
  OVERWEIGHT: "var(--caos-success)", HOLD: "var(--caos-muted)",
  UNDERWEIGHT: "var(--caos-warning)", REDUCE: "var(--caos-critical)",
};

// Leverage / coverage in the seeded sample sleeve are engine-derived and NOT
// carried by the market-data seed — every row is 0 (placeholder), snrLev/totalLev
// absent. Render those as "—" rather than a fabricated 0.0x; the real figures live
// in Live Coverage. The `> 0` guard is specific to THIS seed, where 0 means
// "absent": it deliberately differs from LiveCoverage's fmtX (finite-only), which
// must still show a genuine 0.0x / negative net-cash leverage from live engine
// output. Do not reuse fmtLevX on live metrics — use fmtX there.
const fmtLevX = (v?: number): string =>
  typeof v === "number" && Number.isFinite(v) && v > 0 ? v.toFixed(1) + "x" : "—";

/* ---------- CIO/PM view: posture lead band ---------- */
// The command-center "verdict" — portfolio posture at a glance before any table.
// Figures derive from the sample PORTFOLIO (the header lens note already marks it
// not-live); each posture's color is paired with its OW/HOLD/UW/REDUCE label and
// count, so meaning survives without hue (WCAG 1.4.1).
const POSTURE_ORDER = ["OVERWEIGHT", "HOLD", "UNDERWEIGHT", "REDUCE"] as const;
const POSTURE_SHORT: Record<string, string> = { OVERWEIGHT: "OW", HOLD: "HOLD", UNDERWEIGHT: "UW", REDUCE: "REDUCE" };

export function PostureSummary() {
  const total = PORTFOLIO.length;
  const by: Record<string, number> = { OVERWEIGHT: 0, HOLD: 0, UNDERWEIGHT: 0, REDUCE: 0 };
  let alerting = 0;
  for (const p of PORTFOLIO) {
    by[p.posture] = (by[p.posture] || 0) + 1;
    if (p.alerts) alerting += 1;
  }
  return (
    <div className="shrink-0 flex items-center gap-4 px-3 py-2 rounded-md border border-caos-border bg-caos-panel">
      <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted shrink-0">
        Posture · {total} positions
      </span>
      <div
        className="flex h-2.5 flex-1 min-w-0 overflow-hidden rounded-sm border border-caos-border/60"
        role="img"
        aria-label={"Posture distribution — " + POSTURE_ORDER.map((k) => POSTURE_SHORT[k] + " " + by[k]).join(", ")}
      >
        {POSTURE_ORDER.map((k) => (by[k] ? <div key={k} title={k + " · " + by[k]} style={{ width: (by[k] / total) * 100 + "%", background: POSTURE_COLOR[k] }} /> : null))}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {POSTURE_ORDER.map((k) => (
          <span key={k} className="flex items-baseline gap-1 whitespace-nowrap">
            <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">{POSTURE_SHORT[k]}</span>
            <span className="tabular text-caos-md" style={{ color: POSTURE_COLOR[k] }}>{by[k]}</span>
          </span>
        ))}
      </div>
      <div className="h-5 w-px bg-caos-border shrink-0 hidden md:block" />
      <Link
        href="/monitor"
        title="Positions with open CP-MON alerts — open Monitor"
        className="no-underline hidden md:flex items-baseline gap-1.5 shrink-0 group"
      >
        <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">On watch</span>
        <span className="tabular text-caos-md" style={{ color: "var(--caos-warning)" }}>{alerting}</span>
        <span className="tabular text-caos-xs text-caos-muted group-hover:text-caos-accent transition-caos">→ Monitor</span>
      </Link>
      <span className="hidden md:flex items-baseline gap-1.5 shrink-0">
        <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">QA open</span>
        <span className="tabular text-caos-md" style={{ color: "var(--caos-warning)" }}>{QA_QUEUE.length}</span>
      </span>
    </div>
  );
}

/* ---------- sparkline ---------- */
export function Spark({ data, color = "var(--caos-accent)", w = 72, h = 18 }: { data: number[]; color?: string; w?: number; h?: number }) {
  const min = Math.min(...data), max = Math.max(...data);
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * (w - 2) + 1;
      const y = h - 2 - ((v - min) / (max - min || 1)) * (h - 4);
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} className="shrink-0">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.25" opacity={0.8}></polyline>
    </svg>
  );
}

/* ---------- CIO/PM view: portfolio table ---------- */
// Tooltips for the abbreviated / glyph-only column headers — F5: a column's
// meaning shouldn't depend on prior knowledge or a bare glyph.
const COL_TITLES: Record<string, string> = {
  "3Y DM": "3-year discount margin (bps)",
  "Δ 1D": "Day-over-day change in discount margin (bps)",
  NetLev: "Net leverage (×)",
  SnrLev: "Senior leverage (×)",
  TotLev: "Total leverage (×)",
  IntCov: "Interest coverage (×)",
  "Conv.": "Conviction — analyst scale 1–5",
  QA: "QA clearance status",
  "⚑": "Open alerts",
};

export function PortfolioTable({
  selected, onSelect,
}: {
  selected: string | null;
  onSelect: (code: string | null) => void;
}) {
  const th = "tabular text-caos-xs uppercase tracking-wider text-caos-muted";
  const scrollerRef = useRef<HTMLDivElement>(null);
  const customizerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [filters, setFilters] = useState<FilterState>({});
  const setFilter = (col: string, values: string[] | undefined) =>
    setFilters((f) => {
      const next = { ...f };
      if (values === undefined) {
        delete next[col];
      } else {
        next[col] = values;
      }
      return next;
    });

  type PortfolioFilterKey = "code" | "name" | "sector" | "subSector" | "figi" | "rank" | "rating" | "size" | "margin" | "maturity" | "bid" | "ask" | "dd" | "spark" | "ytdSpark" | "lev" | "snrLev" | "totalLev" | "cov" | "posture" | "conv" | "qa" | "alerts";
  const vals = useMemo<Record<PortfolioFilterKey, (p: (typeof PORTFOLIO)[number]) => string | number | null | undefined>>(() => ({
    code: (p) => p.code, name: (p) => p.borrower || p.name, sector: (p) => p.sector,
    subSector: (p) => p.subSector, figi: (p) => p.figi, rank: (p) => p.rank, rating: (p) => p.rating,
    size: (p) => p.size, margin: (p) => p.margin, maturity: (p) => p.maturity, bid: (p) => p.bid,
    ask: (p) => p.ask, dd: (p) => p.dd, spark: () => "chart", ytdSpark: () => "chart",
    lev: (p) => p.lev, snrLev: (p) => p.snrLev, totalLev: (p) => p.totalLev, cov: (p) => p.cov,
    posture: (p) => p.posture, conv: (p) => p.conv, qa: (p) => p.qa, alerts: (p) => p.alerts,
  }), []);
  const shown = useColumnFilters(PORTFOLIO, filters, vals);

  const [colPreset, setColPreset] = useState<"full" | "credit" | "market" | "custom">("credit");

  const presetKeys = {
    full: ["expand", "code", "name", "sector", "subSector", "figi", "rank", "rating", "size", "margin", "maturity", "bid", "ask", "dd", "spark", "ytdSpark", "lev", "snrLev", "totalLev", "cov", "posture", "conv", "qa", "alerts"],
    credit: ["expand", "code", "name", "sector", "rank", "rating", "lev", "snrLev", "totalLev", "cov", "posture", "conv", "qa", "alerts"],
    market: ["expand", "code", "name", "sector", "size", "margin", "maturity", "bid", "ask", "dd", "spark", "ytdSpark", "posture", "alerts"],
  } as const;

  // Order front-loads the "what needs me" signal (posture · conviction · QA ·
  // alerts) right after identity, then leverage, then market/taxonomy detail —
  // so the columns that answer the CIO lens are reachable without scrolling past
  // the analyst firehose. Render order follows this array; presets only filter.
  const ALL_COLS = [
    { key: "expand", head: "", width: "24px", sticky: "sticky left-0 z-30" },
    { key: "code", head: "Ticker", width: "58px", sticky: "sticky left-[32px] z-30" },
    { key: "name", head: "Company", width: "170px", sticky: "sticky left-[98px] z-30" },
    { key: "sector", head: "Sector", width: "220px" },
    { key: "rating", head: "Ratings", width: "74px" },
    { key: "posture", head: "Posture", width: "92px" },
    { key: "conv", head: "Conv.", width: "44px" },
    { key: "qa", head: "QA", width: "74px" },
    { key: "alerts", head: "⚑", width: "36px" },
    { key: "lev", head: "NetLev", width: "48px" },
    { key: "snrLev", head: "SnrLev", width: "48px" },
    { key: "totalLev", head: "TotLev", width: "48px" },
    { key: "cov", head: "IntCov", width: "48px" },
    { key: "subSector", head: "Sub-sector", width: "240px" },
    { key: "figi", head: "FIGI", width: "90px" },
    { key: "rank", head: "Rank", width: "110px" },
    { key: "size", head: "Size", width: "70px" },
    { key: "margin", head: "Margin", width: "58px" },
    { key: "maturity", head: "Maturity", width: "70px" },
    { key: "bid", head: "Bid", width: "44px" },
    { key: "ask", head: "Ask", width: "44px" },
    { key: "dd", head: "Δ 1D", width: "54px" },
    { key: "spark", head: "30D Chart", width: "86px" },
    { key: "ytdSpark", head: "YTD Chart", width: "86px" },
  ] as const;

  const [visibleCols, setVisibleCols] = useState<string[]>(() => [...presetKeys.credit]);
  const [customizerOpen, setCustomizerOpen] = useState(false);

  useEffect(() => {
    if (!customizerOpen) return;
    const onPointer = (e: PointerEvent) => {
      if (customizerRef.current?.contains(e.target as Node)) return;
      if (buttonRef.current?.contains(e.target as Node)) return;
      setCustomizerOpen(false);
    };
    window.addEventListener("pointerdown", onPointer);
    return () => window.removeEventListener("pointerdown", onPointer);
  }, [customizerOpen]);

  const activeCols = ALL_COLS.filter((c) => visibleCols.includes(c.key));
  const gridTemplateColumns = activeCols.map((c) => c.width).join(" ");
  const minWidth = activeCols.reduce((sum, c) => sum + parseInt(c.width), 0) + (activeCols.length - 1) * 8 + 24;

  const renderCell = (key: string, p: (typeof PORTFOLIO)[number], sel: boolean) => {
    const stickyBg = sel ? "bg-caos-elevated" : "bg-caos-bg";
    const hoverBg = "group-hover:bg-caos-elevated/60";
    const sparkColor = p.dd > 5 ? "var(--caos-critical)" : p.dd < -2 ? "var(--caos-success)" : "var(--caos-muted)";
    
    switch (key) {
      case "expand":
        return (
          <button
            key="expand"
            type="button"
            onClick={() => onSelect(sel ? null : (p.id || p.figi || p.code))}
            aria-label={sel ? `Collapse details for ${p.borrower || p.name}` : `Expand details for ${p.borrower || p.name}`}
            className={`sticky left-0 z-20 flex h-5 w-5 items-center justify-center rounded hover:bg-caos-elevated text-caos-muted hover:text-caos-text transition-caos focus-ring cursor-pointer ${stickyBg} ${hoverBg}`}
          >
            <span className="text-[10px]" aria-hidden="true">{sel ? "▼" : "▶"}</span>
          </button>
        );
      case "code":
        return (
          <IssuerLink
            key="code"
            query={p.code}
            className={`sticky left-[32px] z-20 inline-flex items-center min-h-[18px] tabular text-caos-accent transition-caos ${stickyBg} ${hoverBg}`}
            title={`Open ${p.code} profile`}
          >
            {p.code}
          </IssuerLink>
        );
      case "name":
        return (
          <IssuerLink
            key="name"
            query={p.borrower || p.name}
            className={`sticky left-[98px] z-20 inline-flex items-center min-h-[18px] text-caos-text truncate hover:text-[#f2f2f7] transition-caos ${stickyBg} ${hoverBg}`}
            title={`Open ${p.borrower || p.name} profile`}
          >
            {p.borrower || p.name}
          </IssuerLink>
        );
      case "sector":
        return <span key="sector" className="text-caos-muted text-caos-md truncate">{p.sector}</span>;
      case "subSector":
        return <span key="subSector" className="text-caos-muted text-caos-md truncate">{p.subSector || "—"}</span>;
      case "figi":
        return <span key="figi" className="tabular text-caos-muted text-caos-xs truncate">{p.figi || "—"}</span>;
      case "rank":
        return <span key="rank" className="tabular text-caos-md text-caos-muted">{p.rank || "—"}</span>;
      case "rating":
        return <span key="rating" className="tabular text-caos-md text-caos-muted">{p.rating}</span>;
      case "size":
        return <span key="size" className="tabular text-caos-md text-caos-text text-right truncate w-full">{p.size || "$—"}</span>;
      case "margin":
        return <span key="margin" className="tabular text-right w-full">S+{p.margin}</span>;
      case "maturity":
        return <span key="maturity" className="tabular text-right text-caos-muted">{p.maturity || p.inst.match(/'\d+/)?.[0] || "—"}</span>;
      case "bid":
        return <span key="bid" className="tabular text-right">{p.bid == null ? "—" : p.bid.toFixed(1)}</span>;
      case "ask":
        return <span key="ask" className="tabular text-right">{p.ask == null ? "—" : p.ask.toFixed(1)}</span>;
      case "dd":
        return (
          <span
            key="dd"
            className="tabular text-right rounded px-0.5"
            style={{
              // Δ 1D is a DM-spread delta in bps: positive = widening = deterioration (critical),
              // negative = tightening = improvement (success). Matches the sparkline rule (:223) and moveColor.
              color: p.dd > 0 ? "var(--caos-critical-bright)" : p.dd < 0 ? "var(--caos-success-bright)" : "var(--caos-muted)",
              background: p.dd > 0 ? "color-mix(in srgb, var(--caos-critical) 6%, transparent)" : p.dd < 0 ? "color-mix(in srgb, var(--caos-success) 6%, transparent)" : undefined,
            }}
          >
            {p.dd > 0 ? "+" : ""}{p.dd.toFixed(2)}
          </span>
        );
      case "spark":
        return <Spark key="spark" data={p.spark} color={sparkColor} w={76} h={16} />;
      case "ytdSpark":
        // Only render a YTD spark when we actually have YTD data; falling back to
        // the 30-day `spark` here would mislabel it under the "YTD Chart" header.
        return p.ytdSpark
          ? <Spark key="ytdSpark" data={p.ytdSpark} color={sparkColor} w={76} h={16} />
          : <span key="ytdSpark" className="tabular text-caos-muted">—</span>;
      case "lev":
        return <span key="lev" className="tabular text-right">{fmtLevX(p.lev)}</span>;
      case "snrLev":
        return <span key="snrLev" className="tabular text-right">{fmtLevX(p.snrLev)}</span>;
      case "totalLev":
        return <span key="totalLev" className="tabular text-right">{fmtLevX(p.totalLev)}</span>;
      case "cov":
        return <span key="cov" className="tabular text-right">{fmtLevX(p.cov)}</span>;
      case "posture":
        return <span key="posture" className="tabular text-caos-md truncate" style={{ color: POSTURE_COLOR[p.posture] }}>{p.posture}</span>;
      case "conv":
        return <span key="conv" className="tabular text-right text-caos-text">{p.conv}</span>;
      case "qa":
        return <Tag key="qa" sev={p.qa}>{p.qa}</Tag>;
      case "alerts":
        return (
          <span key="alerts" className="tabular text-right" style={{ color: p.alerts ? "var(--caos-warning)" : "var(--caos-muted)" }}>
            {p.alerts ? "⚑" + p.alerts : "—"}
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col text-caos-md">
      <div className="flex shrink-0 items-center gap-1 overflow-visible whitespace-nowrap border-b border-caos-border px-3 py-1">
        <span className="shrink-0 tabular text-caos-2xs uppercase tracking-widest text-caos-muted mr-1">View</span>
        {([
          ["Desk", "full"],
          ["Credit", "credit"],
          ["Market", "market"],
        ] as const).map(([label, preset]) => (
          <button
            key={preset}
            type="button"
            onClick={() => {
              setColPreset(preset);
              setVisibleCols([...presetKeys[preset]]);
            }}
            className={
              "shrink-0 tabular text-caos-2xs px-1.5 py-0.5 rounded border transition-caos focus-ring " +
              (colPreset === preset
                ? "border-caos-accent text-caos-text bg-caos-elevated"
                : "border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60")
            }
          >
            {label}
          </button>
        ))}
        
        <span className="ml-auto shrink-0 tabular text-caos-2xs text-caos-muted mr-2">{shown.length} / {PORTFOLIO.length} shown</span>
        <div className="relative shrink-0 flex items-center">
          <button
            ref={buttonRef}
            type="button"
            onClick={() => setCustomizerOpen(!customizerOpen)}
            className="shrink-0 tabular text-caos-2xs px-1.5 py-0.5 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos focus-ring flex items-center gap-1 cursor-pointer"
            aria-haspopup="dialog"
            aria-expanded={customizerOpen}
          >
            <span>COLUMNS</span>
            <svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M2 3h8M2 6h8M2 9h8" />
            </svg>
          </button>
          {customizerOpen && (
            <div
              role="dialog"
              aria-label="Customize columns"
              ref={customizerRef}
              className="absolute right-0 top-7 z-overlay w-48 rounded border border-caos-border bg-caos-panel p-2 shadow-lg max-h-80 overflow-auto"
              style={{ boxShadow: "var(--shadow-pop)" }}
            >
              <div className="text-caos-2xs uppercase tracking-wider text-caos-muted mb-1.5 px-1 font-semibold">Toggle Columns</div>
              <div className="flex flex-col gap-0.5">
                {ALL_COLS.filter(c => !["expand", "code", "name"].includes(c.key)).map(c => {
                  const checked = visibleCols.includes(c.key);
                  return (
                    <label key={c.key} className="flex items-center gap-2 px-1 py-0.5 hover:bg-caos-elevated/70 rounded cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          setColPreset("custom");
                          if (e.target.checked) {
                            setVisibleCols(prev => {
                              const next = [...prev, c.key];
                              return ALL_COLS.map(col => col.key).filter(k => next.includes(k));
                            });
                          } else {
                            setVisibleCols(prev => prev.filter(k => k !== c.key));
                          }
                        }}
                        className="accent-[var(--caos-accent)] cursor-pointer"
                      />
                      <span className="tabular text-caos-xs text-caos-text">{c.head || c.key}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
      <div ref={scrollerRef} className="flex-1 min-h-0 overflow-auto">
        <div style={{ minWidth }}>
          <div className="px-3 h-7 border-b border-caos-border sticky top-0 bg-caos-panel z-20 items-center" style={{ gridTemplateColumns, display: "grid", gap: "0 0.5rem" }}>
            {activeCols.map((col) => {
              const alignsRight = ["size", "margin", "maturity", "bid", "ask", "dd", "lev", "snrLev", "totalLev", "cov", "conv", "alerts"].includes(col.key);
              if (col.key === "expand") {
                return (
                  <div
                    key="expand"
                    className={th + " sticky left-0 z-30 bg-caos-panel flex items-center justify-center"}
                    style={{ width: col.width }}
                  />
                );
              }
              const getter = vals[col.key as PortfolioFilterKey];
              if (!getter) {
                return (
                  <div
                    key={col.key}
                    className={th + ((col as { sticky?: string }).sticky ? " " + (col as { sticky?: string }).sticky + " bg-caos-panel" : "")}
                    style={{ width: col.width }}
                  >
                    {col.head}
                  </div>
                );
              }
              return (
                <FilterHeader
                  key={col.key}
                  label={COL_TITLES[col.head] || col.head}
                  col={col.key}
                  rows={PORTFOLIO}
                  getValue={getter}
                  selected={filters[col.key]}
                  onChange={setFilter}
                  className={th + (alignsRight ? " justify-end text-right w-full" : "") + ((col as { sticky?: string }).sticky ? " " + (col as { sticky?: string }).sticky + " bg-caos-panel" : "")}
                >
                  {col.head}
                </FilterHeader>
              );
            })}
          </div>
          {/* fallow-ignore-next-line complexity */}
          {shown.map((p) => {
            const key = p.id || p.figi || p.code;
            const sel = selected === key;
            return (
              <div
                key={key}
                className="group relative bg-caos-bg px-3 py-[2px] border-b border-caos-border/50 transition-caos hover:bg-caos-elevated/60 z-0 items-center"
                style={{ gridTemplateColumns, display: "grid", gap: "0 0.5rem" }}
              >
                {activeCols.map((col) => renderCell(col.key, p, sel))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ---------- CP-MON email viewer window ---------- */
function EmailWindow({ email, onClose }: { email: EmailRow; onClose: () => void }) {
  const panelRef = useModalA11y<HTMLDivElement>(onClose);

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
        aria-label={`Email: ${email.subj}`}
        onClick={(e) => e.stopPropagation()}
        className="caos-enter bg-caos-panel border border-caos-border rounded-md w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
        style={{ boxShadow: "var(--shadow-modal)" }}
      >
        {/* window chrome */}
        <div className="h-9 px-3 flex items-center gap-2 border-b border-caos-border bg-caos-elevated/60 shrink-0">
          <Dot sev={email.sev} />
          <span className="tabular text-caos-xl text-caos-text truncate">{email.subj}</span>
          <span className="tabular text-caos-2xs px-1.5 py-px rounded border border-caos-border text-caos-muted whitespace-nowrap">
            CP-MON · mat {email.mat}
          </span>
          <div className="flex-1" />
          <CloseButton onClick={onClose} title="Close (Esc)" />
        </div>

        {/* envelope */}
        <div className="px-4 py-2.5 border-b border-caos-border shrink-0 text-caos-md leading-relaxed">
          <div className="grid grid-cols-[52px_1fr] gap-x-2">
            <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">From</span>
            <span className="text-caos-text truncate">{email.from} <span className="text-caos-muted">· {email.src}</span></span>
            <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">To</span>
            <span className="text-caos-muted truncate">{email.to}</span>
            <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">Time</span>
            <span className="text-caos-muted">{email.t} ET · today</span>
          </div>
        </div>

        {/* body — a reading surface, not a workspace cell: row size (12px) and a
            capped measure. The analyst verifies claims by reading these; 10.5px
            at a ~110ch line under-served the primary persona. */}
        <div className="flex-1 min-h-0 overflow-auto px-4 py-3">
          <p className="text-caos-xl text-caos-text/90 leading-relaxed whitespace-pre-line max-w-[76ch]">{email.body}</p>
        </div>

        {/* CP-MON classification footer */}
        <div className="px-4 py-2 border-t border-caos-border bg-caos-elevated/40 shrink-0 flex items-center gap-2 flex-wrap">
          <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">CP-MON classification</span>
          {/* Profile chip only when the issuer resolves; illustrative names get a
              plain chip — no invited dead-ends (see FEED_LINKABLE_ISSUERS). */}
          {FEED_LINKABLE_ISSUERS.has(email.issuer) ? (
            <IssuerLink query={email.issuer} title={`Open ${email.issuer} profile`} className="tabular text-caos-xs px-1.5 py-px rounded border border-caos-border text-caos-accent hover:text-caos-text hover:border-caos-accent/60 transition-caos">{email.issuer}</IssuerLink>
          ) : (
            <span className="tabular text-caos-xs px-1.5 py-px rounded border border-caos-border text-caos-text">{email.issuer}</span>
          )}
          <span className="tabular text-caos-xs px-1.5 py-px rounded border border-caos-border text-caos-muted">{email.signal}</span>
          <span className="tabular text-caos-xs px-1.5 py-px rounded border border-caos-border" style={{ color: SEV_COLOR[email.sev] }}>
            {email.sev.toUpperCase()} · {email.mat}
          </span>
          {email.dedup ? (
            <span className="tabular text-caos-xs px-1.5 py-px rounded border border-caos-border text-caos-muted">DEDUPED · CP-MON-F</span>
          ) : null}
          <span className="flex-1" />
          <span className="tabular text-caos-xs text-caos-muted">routed → {email.route}</span>
        </div>
      </div>
    </div>
  );
}

/* ---------- CP-MON email intelligence ---------- */
export function EmailIntel() {
  const [filter, setFilter] = useState<string | null>(null);
  const [openEmail, setOpenEmail] = useState<EmailRow | null>(null);
  // Tiles are the day's FIXED end-of-day classification (a truthful replay, not a
  // live accrual): critical+high+medium+low === EMAIL_TOTAL (105). They no longer
  // drift past the "Msgs today" header — the numbers reconcile by construction.
  // Weighted by SEVERITY, not count, so the eye lands on what must be acted on
  // (CRITICAL largest) rather than on the biggest number (the 64 auto-filed).
  const tiles = [
    { k: "critical", label: "Critical", n: EMAIL_TILES.critical, sub: "≥ 90 mat.", on: true, fs: "text-caos-hero", color: SEV_COLOR.critical },
    { k: "high", label: "High", n: EMAIL_TILES.high, sub: "70–89", on: true, fs: "text-caos-metric-lg", color: SEV_COLOR.high },
    { k: "medium", label: "Medium", n: EMAIL_TILES.medium, sub: "40–69", on: true, fs: "text-caos-metric", color: SEV_COLOR.medium },
    { k: "low", label: "Low", n: EMAIL_TILES.low, sub: "< 40 · filed", on: true, fs: "text-caos-xl", color: "var(--caos-muted)" },
    { k: "dedup", label: "Deduped", n: EMAIL_TILES.dedup, sub: "CP-MON-F", on: false, fs: "text-caos-xl", color: "var(--caos-muted)" },
    { k: "unresolved", label: "Unresolved", n: EMAIL_TILES.unresolved, sub: "issuer match", on: false, fs: "text-caos-xl", color: "var(--caos-text)" },
  ];
  const list = EMAILS.filter((e) => !filter || e.sev === filter);
  const activeTile = tiles.find((t) => t.k === filter);
  // The row list is an illustrative SAMPLE of the day's intake, not the full 105.
  // A persistent "showing N of M" caption pre-empts the "why does the Critical
  // tile say 3 but I only see 2 rows?" credibility hit.
  const sampleTotal = activeTile ? activeTile.n : EMAIL_TOTAL;
  const sampleScope = activeTile ? `${activeTile.label.toLowerCase()} · sample` : "today · sample";
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="grid gap-1.5 p-2 shrink-0" style={{ gridTemplateColumns: "1.35fr 1.15fr 1fr .85fr .85fr .9fr" }}>
        {tiles.map((t) => {
          const sel = filter === t.k;
          // Clickable severity tiles read as buttons (filled, hover, focus ring);
          // inert meta-tiles (deduped/unresolved) get a dashed, dimmed, label-like
          // treatment so the "which of these can I click?" question is answered by
          // sight, not by trial (the old build styled all six identically).
          const cls =
            "text-left rounded px-2 py-1.5 transition-caos " +
            (sel
              ? "caos-selected bg-caos-elevated border border-caos-accent "
              : t.on
                ? "bg-caos-bg border hover:bg-caos-elevated/70 focus-ring "
                // Dashed transparent border + no hover/focus signals "not a
                // button" WITHOUT dimming: opacity-70 here dropped muted text to
                // 4.15:1, under the 4.5:1 AA floor (axe color-contrast).
                : "bg-transparent border border-dashed border-caos-border/60 cursor-default ");
          const style = t.on && !sel ? { borderColor: sevSurface(t.k).borderColor } : undefined;
          const inner = (
            <>
              <div className={"tabular leading-none " + t.fs} style={{ color: t.color }}>{t.n}</div>
              <div className="text-caos-xs uppercase tracking-wider text-caos-muted mt-1">{t.label}</div>
              <div className="tabular text-caos-2xs text-caos-muted truncate">{t.sub}</div>
            </>
          );
          return t.on ? (
            <button
              key={t.k}
              onClick={() => setFilter(sel ? null : t.k)}
              aria-pressed={sel}
              // Explicit name — the visual stack ("3 / Critical / ≥ 90 mat.")
              // concatenates into mush in screen-reader output.
              aria-label={`${t.label}: ${t.n} messages (${t.sub}) — filter`}
              className={cls}
              style={style}
            >{inner}</button>
          ) : (
            <div key={t.k} className={cls} style={style}>{inner}</div>
          );
        })}
      </div>
      {/* Sample-size caption + one-click filter escape (user control & freedom).
          Sentence-case: this is a sentence, not a desk label — all-caps at this
          length reads as shouting (and trips the all-caps-body detector). */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-1 border-t border-caos-border text-caos-2xs text-caos-muted tabular">
        <span>Showing {list.length} of {sampleTotal} {sampleScope}</span>
        {filter ? (
          <button onClick={() => setFilter(null)} className="text-caos-accent hover:text-caos-text focus-ring rounded px-1">Clear filter</button>
        ) : null}
      </div>
      {/* Column headers — signal/mat/route were unlabeled columns; "mat 94" is
          the row's whole severity story and shouldn't require studying tile
          subtitles to decode (recognition over recall). */}
      <div className="shrink-0 grid grid-cols-[40px_46px_1fr_120px_40px_130px] gap-x-2 px-3 py-1 border-b border-caos-border/50 text-caos-2xs uppercase tracking-wider text-caos-muted tabular">
        <span>Time</span>
        <span>Issuer</span>
        {/* min-w-0 + truncate: degrade like the data rows when the 1fr column is
            starved (narrow panel) instead of wrapping to three lines. */}
        <span className="min-w-0 truncate">Subject · source</span>
        <span className="truncate">Signal</span>
        <span className="text-right" title="Materiality score (0–100); tiles above show the severity bands">Mat</span>
        <span className="text-right">Route</span>
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        {list.length === 0 ? (
          <div className="px-3 py-8 text-center text-caos-md text-caos-muted leading-relaxed">
            {activeTile?.n ?? 0} {activeTile?.label.toLowerCase()} messages auto-filed —<br />not retained in this illustrative sample.
          </div>
        ) : list.map((e, i) => (
          <div
            key={i}
            role="button"
            tabIndex={0}
            onClick={() => setOpenEmail(e)}
            onKeyDown={onActivate(() => setOpenEmail(e))}
            aria-label={`Open email: ${e.subj}`}
            className="grid grid-cols-[40px_46px_1fr_120px_40px_130px] items-center gap-x-2 px-3 py-[3px] border-b border-caos-border/50 text-caos-md hover:bg-caos-elevated/60 transition-caos cursor-pointer focus-ring"
          >
            <span className="tabular text-caos-md text-caos-muted">{e.t}</span>
            {/* Issuer is identifying text, NOT a link — the whole row is the click
                target (opens the email). The issuer→profile jump lives on the
                accent chip inside the opened email, avoiding nested interactives. */}
            <span className="tabular text-caos-text">{e.issuer}</span>
            <span className="min-w-0">
              <span className="text-caos-text truncate block">{e.subj}{e.dedup ? <span className="text-caos-muted text-caos-xs"> · dup</span> : null}</span>
              <span className="text-caos-muted text-caos-xs truncate block">{e.src}</span>
            </span>
            <span className="text-caos-xs text-caos-muted truncate">{e.signal}</span>
            <span className="tabular text-right" style={{ color: SEV_COLOR[e.sev] }}>{e.mat}</span>
            <span className="tabular text-caos-xs text-caos-muted truncate text-right">→ {e.route}</span>
          </div>
        ))}
      </div>
      {openEmail ? <EmailWindow email={openEmail} onClose={() => setOpenEmail(null)} /> : null}
    </div>
  );
}

/* ---------- CP-MON live alert feed ---------- */
// Frozen per-alert arrival stamp. ALERTS is authored oldest→newest; each is
// offset a fixed step from the 09:30 open, so a given alert always shows the SAME
// time on every render. The old build recomputed `simClock(tick − i*5)` live, so
// every timestamp drifted forward each tick — the feed performed a liveness the
// "not live" marker disclaims. Stable index → stable stamp.
const ALERT_ARRIVAL_STEP = 5; // ticks between successive arrivals (× 7 sim-sec)
function alertArrival(i: number): string {
  return simClock(i * ALERT_ARRIVAL_STEP);
}

export function AlertFeed({ tick, running, done, sevFilter = null }: {
  tick: number; running: boolean; done: boolean; sevFilter?: string | null;
}) {
  // The alert row cites evidence and routes to a module; the "source" chip closes
  // the loop by opening the SAME EmailWindow the intake tape uses, so a critical
  // re-score is one interaction from the message that fired it (design principle
  // #3). Alerts with no triggering email render the chip disabled with a reason —
  // the no-dead-ends pattern mirroring FEED_LINKABLE_ISSUERS.
  const [openEmail, setOpenEmail] = useState<EmailRow | null>(null);
  // Progressive reveal while the replay steps (the "arriving" feel); all rows once
  // it completes (a finished day shows the full routing log, even if it finished
  // before tick 40). Gating on `done` — not on "is running" — is what keeps the
  // arrival progressive instead of dumping all ten the instant play resumes.
  const visible = done ? ALERTS.length : Math.min(ALERTS.length, Math.floor(tick / 5) + 2);
  // Newest arrival on TOP (a feed's mental model). ALERTS is oldest→newest, so
  // reverse the revealed slice; each keeps its frozen index-based stamp. The
  // severity filter applies after reveal, so filtering never leaks unarrived rows.
  const rows = ALERTS.slice(0, visible)
    .map((a, i) => ({ a, at: alertArrival(i) }))
    .reverse()
    .filter(({ a }) => !sevFilter || a.sev === sevFilter);
  // pb-12: scroll room so the last row can clear the fixed Ask chip (bottom-right).
  return (
    <div className="pb-12">
      {rows.length === 0 ? (
        <div className="px-3 py-6 text-center text-caos-md text-caos-muted">
          No {sevFilter ?? ""} alerts routed yet.
        </div>
      ) : rows.map(({ a, at }, r) => {
        // Only the true newest row pulses, and only while the sim is actively
        // running — a completed replay is static, not perpetually "live".
        const isNewest = r === 0 && !sevFilter;
        // The intake message that fired this alert (undefined for derived alerts).
        const srcEmail = typeof a.sourceEmail === "number" ? EMAILS[a.sourceEmail] : undefined;
        return (
          <div key={a.code} className={"flex items-start gap-2 px-3 py-[6px] border-b border-caos-border/50 " + (isNewest && running ? "caos-enter" : "")}>
            <Dot sev={a.sev} pulse={isNewest && running} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {/* Issuer → profile link ONLY when the issuer resolves in the
                    register; the other seeded names render as plain text — an
                    accent link that dead-ends in "Issuer not found" is worse
                    than no link (it failed on both CRITICALs). Rows are inert
                    containers, so the link nests cleanly when present. */}
                {FEED_LINKABLE_ISSUERS.has(a.issuer) ? (
                  <IssuerLink query={a.issuer} title={`Open ${a.issuer} profile`} className="tabular text-caos-md text-caos-accent hover:text-caos-text transition-caos">
                    {a.issuer}
                  </IssuerLink>
                ) : (
                  <span className="tabular text-caos-md text-caos-text">{a.issuer}</span>
                )}
                {/* Severity as a labelled tag too — the dot's color isn't the only
                    carrier of severity (colorblind-safe). */}
                <Tag sev={a.sev}>{a.sev}</Tag>
                <span className="tabular text-caos-xs text-caos-muted">{a.code}</span>
                <span className="tabular text-caos-xs text-caos-muted ml-auto">{at}</span>
              </div>
              <div className="text-caos-md text-caos-text leading-snug mt-0.5">{a.text}</div>
              <div className="mt-1 flex items-center gap-1.5">
                <Tag sev="info">route → {a.route}</Tag>
                {/* Source chip: opens the intake email that fired this alert —
                    same EmailWindow the tape uses, so evidence is one click away.
                    Disabled (with a reason) when the alert is derived and has no
                    single triggering message, mirroring the no-dead-ends pattern
                    used for the issuer chip above. */}
                {srcEmail ? (
                  <button
                    type="button"
                    onClick={() => setOpenEmail(srcEmail)}
                    title={`Open source message: ${srcEmail.subj}`}
                    aria-label={`Open source email for ${a.issuer} alert ${a.code}`}
                    className="inline-flex items-center gap-1 tabular text-caos-2xs px-1.5 py-px rounded border border-caos-border text-caos-accent hover:text-caos-text hover:border-caos-accent/60 transition-caos focus-ring cursor-pointer"
                  >
                    <span aria-hidden="true">✉</span>
                    <span>Source</span>
                  </button>
                ) : (
                  <span
                    title="Derived alert — no single intake email; see CP-3 fair-value band"
                    aria-label="No source email — derived alert"
                    className="inline-flex items-center gap-1 tabular text-caos-2xs px-1.5 py-px rounded border border-dashed border-caos-border/60 text-caos-muted cursor-default"
                  >
                    <span aria-hidden="true">✉</span>
                    <span>No source</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
      {openEmail ? <EmailWindow email={openEmail} onClose={() => setOpenEmail(null)} /> : null}
    </div>
  );
}

/* ---------- CP-SR sector board ---------- */
export function SectorBoard({ clock, onSummary }: {
  clock: string; // desk sim clock "HH:MM:SS" — stamps refreshes on the desk time, not wall-clock
  onSummary?: (s: { shown: number; due: number }) => void; // report counts up for the panel header
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const coverageSectors = Array.from(new Set(PORTFOLIO.map((p) => p.sector))).filter(Boolean).sort();
  const sectorChoices = coverageSectors;
  const [visible, setVisible] = useState<Set<string>>(() => new Set());
  // sector → "HH:MM ET" stamp once its knowledge was refreshed this session
  const [refreshed, setRefreshed] = useState<Record<string, string>>({});
  const rows = sectorChoices.map((sector) =>
    SECTORS.find((s) => s.sector === sector) ?? {
      sector,
      stance: "NEUTRAL" as const,
      ew: 0,
      trend: "coverage sector · CP-SR review pending",
      reviewed: "—",
      due: true,
    }
  );
  const openRow = rows.find((s) => s.sector === open);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("caos-command-sectors-v2") || "[]");
      if (Array.isArray(saved) && saved.length) { setVisible(new Set(saved)); return; }
    } catch {}
    // First run (no saved set): seed the reviewed sectors so the board teaches
    // its value instead of opening as a single empty "Add sector" tile.
    setVisible(new Set(SECTORS.slice(0, 4).map((s) => s.sector)));
  }, []);
  useEffect(() => {
    try { localStorage.setItem("caos-command-sectors-v2", JSON.stringify([...visible])); } catch {}
  }, [visible]);
  const shown = rows.filter((s) => visible.has(s.sector));
  const hidden = sectorChoices.filter((s) => !visible.has(s));
  // A refresh this session clears the due flag, so the header count decrements
  // as sectors are reviewed instead of staying a hardcoded "2 refreshes due".
  const dueCount = shown.filter((s) => s.due && !refreshed[s.sector]).length;
  useEffect(() => {
    onSummary?.({ shown: shown.length, due: dueCount });
  }, [shown.length, dueCount, onSummary]);

  return (
    <div className="p-2 flex flex-col gap-2">
      <div className="grid grid-cols-4 gap-1.5">
      {/* fallow-ignore-next-line complexity */}
      {shown.map((s) => {
        const fresh = refreshed[s.sector];
        const hasReview = SECTORS.some((x) => x.sector === s.sector);
        return (
          hasReview ? (
            <div
              key={s.sector}
              title="Open sector review analysis"
              className="relative text-left rounded border border-caos-border bg-caos-bg px-2.5 py-2 transition-caos hover:border-caos-accent/50"
            >
              <button
                type="button"
                onClick={() => setOpen(s.sector)}
                onKeyDown={onActivate(() => setOpen(s.sector))}
                aria-label={`Open ${s.sector} sector review analysis`}
                className="absolute inset-0 rounded focus-ring cursor-pointer"
              />
              <div className="relative pointer-events-none flex items-center gap-1.5">
                <span className="text-caos-xl font-medium text-caos-text truncate">{s.sector}</span>
                {s.ew > 0 ? <span className="tabular text-caos-xs" style={{ color: s.ew >= 3 ? "var(--caos-critical)" : "var(--caos-warning)" }}><StatusGlyph kind="warning" /> {s.ew}</span> : null}
                <span className="flex-1" />
                <button
                  onClick={(e) => { e.stopPropagation(); setVisible((v) => { const n = new Set(v); n.delete(s.sector); return n; }); }}
                  aria-label={`Remove ${s.sector}`}
                  className="pointer-events-auto relative z-10 inline-flex h-6 w-6 items-center justify-center rounded tabular text-caos-md font-bold leading-none text-caos-muted hover:text-caos-critical-bright focus-ring transition-caos"
                >
                  ×
                </button>
              </div>
              <div className="relative pointer-events-none tabular text-caos-xs tracking-wide mt-1" style={{ color: STANCE_COLOR[s.stance] }}>{s.stance}</div>
              <div className="relative pointer-events-none text-caos-xs text-caos-muted mt-1 leading-snug">{s.trend}</div>
              <div className="relative pointer-events-none tabular text-caos-2xs text-caos-muted mt-1.5 flex justify-between">
                <span>{fresh ? "rev. today " + fresh : "rev. " + s.reviewed}</span>
                {fresh ? (
                  <span className="inline-flex items-center gap-1" style={{ color: "var(--caos-success)" }}><StatusGlyph kind="success" size={9} /> UPDATED</span>
                ) : s.due ? (
                  <span style={{ color: "var(--caos-warning)" }}>REFRESH DUE</span>
                ) : null}
              </div>
            </div>
          ) : (
            <div
              key={s.sector}
              title="Sector in coverage; CP-SR review pending"
              className="text-left rounded border border-caos-border bg-caos-bg px-2.5 py-2 cursor-default"
            >
              <div className="flex items-center gap-1.5">
                <span className="text-caos-xl font-medium text-caos-muted truncate">{s.sector}</span>
                {s.ew > 0 ? <span className="tabular text-caos-xs" style={{ color: s.ew >= 3 ? "var(--caos-critical)" : "var(--caos-warning)" }}><StatusGlyph kind="warning" /> {s.ew}</span> : null}
                <span className="flex-1" />
                <button
                  onClick={() => setVisible((v) => { const n = new Set(v); n.delete(s.sector); return n; })}
                  aria-label={`Remove ${s.sector}`}
                  className="inline-flex h-6 w-6 items-center justify-center rounded tabular text-caos-md font-bold leading-none text-caos-muted hover:text-caos-critical-bright focus-ring transition-caos"
                >
                  ×
                </button>
              </div>
              <div className="tabular text-caos-xs tracking-wide mt-1" style={{ color: STANCE_COLOR[s.stance] }}>{s.stance}</div>
              <div className="text-caos-xs text-caos-muted mt-1 leading-snug">{s.trend}</div>
              <div className="tabular text-caos-2xs text-caos-muted mt-1.5 flex justify-between">
                <span>{fresh ? "rev. today " + fresh : "rev. " + s.reviewed}</span>
                {fresh ? (
                  <span className="inline-flex items-center gap-1" style={{ color: "var(--caos-success)" }}><StatusGlyph kind="success" size={9} /> UPDATED</span>
                ) : s.due ? (
                  <span style={{ color: "var(--caos-warning)" }}>REFRESH DUE</span>
                ) : null}
              </div>
            </div>
          )
        );
      })}
      <div className="relative min-h-[118px] text-left rounded border border-dashed border-caos-border bg-caos-bg px-2.5 py-2 transition-caos hover:border-caos-accent/60">
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          onKeyDown={onActivate(() => setAdding((v) => !v))}
          aria-haspopup="menu"
          aria-expanded={adding}
          className="block w-full text-left focus-ring"
        >
          <div className="text-caos-xl font-medium text-caos-muted">Add sector</div>
          <div className="tabular text-caos-2xs text-caos-muted mt-1">coverage universe</div>
        </button>
        {adding ? (
          <div role="menu" className="absolute left-2 right-2 top-14 z-overlay max-h-44 overflow-auto rounded border border-caos-border bg-caos-panel">
            {hidden.length ? hidden.map((s) => (
              <button
                key={s}
                type="button"
                role="menuitem"
                onClick={() => { setVisible((v) => new Set(v).add(s)); setAdding(false); }}
                className="block w-full text-left px-2 py-1.5 tabular text-caos-xs text-caos-text hover:bg-caos-elevated focus-ring"
              >
                {s}
              </button>
            )) : <span className="block px-2 py-1.5 tabular text-caos-xs text-caos-muted">All sectors shown</span>}
          </div>
        ) : null}
      </div>
      {openRow ? (
        <SectorReview
          row={openRow}
          refreshedAt={refreshed[openRow.sector] || null}
          onRefreshed={(sector) =>
            setRefreshed((prev) => ({
              ...prev,
              [sector]: clock.slice(0, 5), // desk time HH:MM, matches the sim clock shown across the Command Center
            }))
          }
          onClose={() => setOpen(null)}
        />
      ) : null}
      </div>
    </div>
  );
}

/* ---------- Research view ---------- */
const LAYER_TITLES: Record<string, string> = {
  L1: "L1 — Data Foundation (financials, fact packs, performance deltas, peer benchmarks)",
  L2: "L2 — Fundamental Credit Synthesis (fundamental credit, downside pathways, event catalysts, governance, liquidity, macro sensitivity)",
  L3: "L3 — Valuation, Portfolio, & Refinancing (relative value, recovery waterfalls, position sizing, refinancing risk)",
  L4: "L4 — Legal & Covenant (covenant interpretation, capacity calculator)",
  L5: "L5 — Quality Assurance (evidence trace validation, research integrity QA)",
  L6: "L6 — Debate & Decision (IC debate, portfolio debate)",
};

// Glance-able layer key — the full LAYER_TITLES live only in the column-head
// hover/focus title, invisible to a scanning eye. This persistent legend gives
// the L1–L6 taxonomy a name on-screen for the Research lens (recognition > recall).
const LAYER_SHORT: Record<string, string> = {
  L1: "Data Foundation", L2: "Credit Synthesis", L3: "Valuation & RV",
  L4: "Legal & Covenant", L5: "QA", L6: "Decision",
};

// Sequential freshness ramp — solid tinted fills only. Process states
// (running / blocked) are NOT fills; they render as an outlined glyph cell so
// `blocked` reads as categorical, never as "a slightly redder stale".
const FRESH_FILL: Record<string, string> = {
  fresh: "color-mix(in srgb, var(--caos-success) 32%, transparent)",
  aging: "color-mix(in srgb, var(--caos-warning) 34%, transparent)",
  stale: "color-mix(in srgb, var(--caos-critical) 40%, transparent)",
};
const CELL_SHORT: Record<string, string> = { fresh: "FRESH", aging: "AGING", stale: "STALE" };

// `label` is a concise SR announcement ("ACOM L1 stale") — the visible glyph
// text alone (STALE/BLKD) doesn't tell a non-sighted reader which issuer/layer
// the state belongs to; `title` stays the verbose mouse-hover string.
function CoverageCell({ status, title, label }: { status: string; title: string; label?: string }) {
  if (status === "blocked") {
    // Categorical: outlined critical ring + ✕-glyph, no red fill — visually
    // distinct from a solid-red `stale` even for a low-vision / colorblind read.
    return (
      <div
        title={title}
        role={label ? "img" : undefined}
        aria-label={label}
        className="h-5 rounded-sm flex items-center justify-center gap-0.5 border transition-caos hover:opacity-80"
        style={{ borderColor: "var(--caos-critical)", background: "color-mix(in srgb, var(--caos-critical) 8%, transparent)", color: "var(--caos-critical-bright)" }}
      >
        <StatusGlyph kind="blocked" size={9} />
        <span className="tabular text-caos-2xs uppercase font-medium">BLKD</span>
      </div>
    );
  }
  if (status === "running") {
    // Accent ring + open-arc glyph + pulse. `caos-running` self-disables under
    // prefers-reduced-motion; the glyph carries the meaning without the pulse.
    return (
      <div
        title={title}
        role={label ? "img" : undefined}
        aria-label={label}
        className="h-5 rounded-sm flex items-center justify-center gap-0.5 border caos-running transition-caos"
        style={{ borderColor: "color-mix(in srgb, var(--caos-accent) 55%, transparent)", background: "color-mix(in srgb, var(--caos-accent) 14%, transparent)", color: "var(--caos-accent)" }}
      >
        <StatusGlyph kind="running" size={9} />
        <span className="tabular text-caos-2xs uppercase font-medium">RUNNING</span>
      </div>
    );
  }
  return (
    <div
      title={title}
      role={label ? "img" : undefined}
      aria-label={label}
      className="h-5 rounded-sm flex items-center justify-center transition-caos hover:opacity-80"
      style={{ background: FRESH_FILL[status] || "transparent" }}
    >
      <span className="tabular text-caos-2xs uppercase font-medium text-caos-text">{CELL_SHORT[status] || status}</span>
    </div>
  );
}

// On-system empty / cleared note — mirrors deepdive/rails NoIssuerRailOutput:
// role="note", severity-tinted border, glyph + uppercase label + muted body.
function EmptyNote({ tone, label, body }: { tone: "success" | "warning"; label: string; body: string }) {
  const color = tone === "success" ? "var(--caos-success)" : "var(--caos-warning)";
  return (
    <div role="note" className="m-3 bg-caos-panel border rounded-md px-3 py-2.5 shrink-0" style={{ borderColor: `color-mix(in srgb, ${color} 45%, transparent)` }}>
      <div className="flex items-center gap-1.5">
        <span style={{ color }}><StatusGlyph kind={tone === "success" ? "success" : "warning"} size={11} /></span>
        <span className="tabular text-caos-2xs uppercase tracking-wider" style={{ color }}>{label}</span>
      </div>
      <div className="text-caos-md text-caos-muted leading-snug mt-0.5">{body}</div>
    </div>
  );
}

type RowRun = { phase: "queuing" | "running" | "done" | "failed"; runId?: string; error?: string; at?: string };

const errMsg = (e: unknown): string => {
  const ax = e as { response?: { data?: { detail?: string } }; message?: string };
  return ax?.response?.data?.detail || ax?.message || "request failed";
};
const shortId = (id?: string) => (id ? id.slice(0, 8) : "—");
const nowStamp = () => new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" });

// CoverageMatrix run poll: cadence between getRun checks, and the ceiling after
// which we stop and mark the row timed out.
const _RUN_POLL_INTERVAL_MS = 2500;
const _RUN_POLL_TIMEOUT_MS = 180_000;

function ReRunButton({ runnable, phase, error, code, onClick }: { runnable: boolean; phase?: RowRun["phase"]; error?: string; code: string; onClick: () => void }) {
  if (!runnable) {
    return (
      <span
        title={`Seeded sample — no live engine run for ${code} (Phase-1 runs ATLF only)`}
        aria-label={`Seeded sample — no live engine run for ${code}`}
        className="tabular text-caos-2xs uppercase text-caos-muted border border-caos-border/50 rounded px-1 py-0.5 text-center cursor-not-allowed select-none"
      >
        Seeded
      </span>
    );
  }
  const busy = phase === "queuing" || phase === "running";
  const label = phase === "queuing" ? "QUEUING" : phase === "running" ? "RUNNING" : phase === "failed" ? "RETRY" : "RE-RUN";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      title={phase === "failed" && error ? `Run failed: ${error} — click to retry` : `Trigger a real engine run for ${code}`}
      aria-label={`${label} ${code}`}
      className={
        "tabular text-caos-xs rounded px-1 py-0.5 border transition-caos focus-ring cursor-pointer disabled:cursor-wait " +
        (phase === "failed"
          ? "border-caos-critical/60 text-caos-critical-bright hover:border-caos-critical"
          : "border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60") +
        (busy ? " caos-running" : "")
      }
    >
      {label}
    </button>
  );
}

export function CoverageMatrix() {
  // ATLF (the seeded reference deal) is the one engine-backed issuer and is NOT
  // in the demo sleeve, so it is prepended — otherwise no row is runnable and
  // RE-RUN is unreachable dead code.
  const [coverageData, setCoverageData] = useState(() => [ATLF_COVERAGE_ROW, ...COVERAGE]);
  const [runs, setRuns] = useState<Record<string, RowRun>>({});
  const [filter, setFilter] = useState<"all" | "blocked" | "stale" | "aging">("all");
  // Default to issuer order: the seeded sample repeats a 10-row status pattern,
  // so a worst-first default stacks ~38 byte-identical rows and reads as "all
  // broken". Staleness triage stays one click away.
  const [sortBy, setSortBy] = useState<"staleness" | "code">("code");
  const mounted = useRef(true);
  // Per-row in-flight guard — a synchronous ref (not the async `runs` state) so a
  // second RE-RUN or a repeated bulk "Re-run stale" click can't spawn a second
  // poll loop for a row already running and race setRuns/applyRollup.
  const inflight = useRef<Record<string, boolean>>({});
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const rows = useMemo(() => {
    const withWorst = coverageData.map((c) => ({ ...c, worst: worstStatus(c.cells) }));
    const filtered = filter === "all" ? withWorst : withWorst.filter((r) => r.worst === filter);
    // Engine-backed rows first under BOTH sorts — the one runnable issuer (ATLF,
    // where RE-RUN is real) leads the seeded sample instead of sinking ~40 rows
    // down alphabetically. Salience marks the exception, not the 382 illustrative rows.
    return filtered.sort((a, b) => {
      const runRank = (runnableIssuerId(a.code) ? 0 : 1) - (runnableIssuerId(b.code) ? 0 : 1);
      if (runRank !== 0) return runRank;
      return sortBy === "staleness"
        ? ((STATUS_RANK[a.worst] ?? 9) - (STATUS_RANK[b.worst] ?? 9)) || a.code.localeCompare(b.code)
        : a.code.localeCompare(b.code);
    });
  }, [coverageData, filter, sortBy]);

  const applyRollup = (rowId: string, run: RunSummaryDTO) => {
    inflight.current[rowId] = false;
    const rolled = rollupRunToCells(run);
    setCoverageData((prev) => prev.map((it) => (it.id === rowId ? { ...it, cells: { ...it.cells, ...rolled } } : it)));
    setRuns((r) => ({ ...r, [rowId]: { phase: "done", runId: run.id, at: nowStamp() } }));
  };

  const fail = (rowId: string, error: string, runId?: string) => {
    inflight.current[rowId] = false;
    setRuns((r) => ({ ...r, [rowId]: { phase: "failed", runId, error } }));
  };

  const poll = (rowId: string, runId: string, started: number) => {
    if (!mounted.current) return;
    getRun(runId)
      .then((cur) => {
        if (!mounted.current) return;
        if (cur.status === "complete") return applyRollup(rowId, cur);
        if (cur.status === "failed") return fail(rowId, cur.error || "run failed", runId);
        if (Date.now() - started > _RUN_POLL_TIMEOUT_MS) return fail(rowId, "timed out waiting for the run", runId);
        setRuns((r) => ({ ...r, [rowId]: { phase: "running", runId } }));
        window.setTimeout(() => poll(rowId, runId, started), _RUN_POLL_INTERVAL_MS);
      })
      .catch((e) => {
        if (!mounted.current) return;
        fail(rowId, errMsg(e), runId);
      });
  };

  // Real engine run — the honest replacement for the old setTimeout→all-fresh
  // fake. Only fires for engine-backed rows (guarded; the button is disabled
  // otherwise). Cells update from the REAL run's per-layer roll-up; a failure or
  // timeout leaves the seeded cells untouched rather than fabricating freshness.
  const reRun = (rowId: string, code: string) => {
    const issuerId = runnableIssuerId(code);
    if (!issuerId || inflight.current[rowId]) return; // seeded row, or already running
    inflight.current[rowId] = true;
    setRuns((r) => ({ ...r, [rowId]: { phase: "queuing" } }));
    createRun(issuerId)
      .then((created) => {
        if (!mounted.current) return;
        if (created.status === "complete") return applyRollup(rowId, created);
        setRuns((r) => ({ ...r, [rowId]: { phase: "running", runId: created.id } }));
        poll(rowId, created.id, Date.now());
      })
      .catch((e) => {
        if (!mounted.current) return;
        fail(rowId, errMsg(e));
      });
  };

  const bulkStale = rows.filter((r) => runnableIssuerId(r.code) && r.worst !== "fresh" && r.worst !== "running");
  const grid = "grid grid-cols-[120px_repeat(6,1fr)_84px] gap-1 items-center px-1";

  return (
    <div className="p-2 flex flex-col">
      {/* triage controls */}
      <div className="flex items-center flex-wrap gap-x-2 gap-y-1.5 px-1 mb-1.5">
        <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">Filter</span>
        <ToggleGroup
          size="sm"
          value={filter}
          onChange={(k) => setFilter(k)}
          options={[
            { k: "all", l: "All" }, { k: "blocked", l: "Blocked" }, { k: "stale", l: "Stale" }, { k: "aging", l: "Aging" },
          ] as const}
        />
        <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted ml-1">Sort</span>
        <ToggleGroup
          size="sm"
          value={sortBy}
          onChange={(k) => setSortBy(k)}
          options={[{ k: "staleness", l: "Staleness" }, { k: "code", l: "Issuer" }] as const}
        />
        <span className="flex-1" />
        <span className="tabular text-caos-2xs text-caos-muted">{rows.length} / {coverageData.length}</span>
        <button
          type="button"
          onClick={() => bulkStale.forEach((r) => reRun(r.id, r.code))}
          disabled={!bulkStale.length}
          title={bulkStale.length ? `Trigger real engine runs for ${bulkStale.length} engine-backed issuer(s) needing a refresh` : "No engine-backed issuers need a refresh in view"}
          className="tabular text-caos-2xs uppercase px-1.5 py-0.5 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos focus-ring cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Re-run engine-backed ({bulkStale.length})
        </button>
      </div>
      {/* honesty banner — the matrix is a seeded sample; RE-RUN is real only where engine-backed */}
      <div role="note" className="tabular text-caos-md text-caos-muted px-1 mb-1.5 leading-snug">
        Seeded coverage sample · <span style={{ color: "var(--caos-accent)" }}>RE-RUN</span> triggers a real engine run where the issuer is engine-backed (Phase-1: ATLF); other rows are illustrative.
      </div>
      {/* Persistent L1–L6 taxonomy key — the layer meaning no longer lives only in
          a hover title. Full descriptions stay on the column-head focus/hover. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-1 mb-1.5">
        <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">Layers</span>
        {COVERAGE_LAYERS.map((l) => (
          <span key={l} className="tabular text-caos-2xs text-caos-muted whitespace-nowrap">
            <span className="text-caos-accent">{l}</span> {LAYER_SHORT[l]}
          </span>
        ))}
      </div>

      <div className={grid + " mb-1"}>
        <span className="tabular text-caos-xs uppercase text-caos-muted">Issuer</span>
        {COVERAGE_LAYERS.map((l) => (
          <span
            key={l}
            title={LAYER_TITLES[l]}
            aria-label={LAYER_TITLES[l]}
            tabIndex={0}
            className="tabular text-caos-xs uppercase text-caos-muted text-center cursor-help border-b border-dashed border-caos-border/50 pb-0.5 focus:outline-none focus:border-caos-accent focus:text-caos-text rounded px-0.5 transition-caos"
          >
            {l}
          </span>
        ))}
        <span className="tabular text-caos-xs uppercase text-caos-muted text-center">Refresh</span>
      </div>

      {rows.length === 0 ? (
        <EmptyNote tone="warning" label="No matching issuers" body={`No issuers are ${filter} in the current view. Switch the filter back to All to see full coverage.`} />
      ) : (
        rows.map((c) => {
          const rr = runs[c.id];
          const busy = rr?.phase === "queuing" || rr?.phase === "running";
          const runnable = !!runnableIssuerId(c.code);
          // Only the meaningful rows carry a sub-label now: a real run's id/time,
          // a failure, or the accent "engine-backed" tag on the runnable issuer.
          // The 382 illustrative rows show nothing — the banner + "Seeded" chip
          // already state the boundary once, so repeating it 382× was pure noise.
          const sub = rr?.phase === "done" && rr.at
            ? `run ${shortId(rr.runId)} · ${rr.at}`
            : rr?.phase === "failed" ? "run failed" : runnable ? "engine-backed" : null;
          return (
            <div key={c.id} className={grid + " mb-1"}>
              <span className="min-w-0 flex flex-col leading-tight">
                <IssuerLink query={c.code} title={`Open ${c.code} profile`} className="tabular text-caos-md text-caos-accent hover:text-caos-text transition-caos truncate">
                  {c.code}
                </IssuerLink>
                {sub ? (
                  <span
                    className="tabular text-caos-2xs truncate"
                    style={{ color: rr?.phase === "failed" ? "var(--caos-critical-bright)" : runnable ? "var(--caos-accent)" : "var(--caos-muted)" }}
                  >
                    {sub}
                  </span>
                ) : null}
              </span>
              {COVERAGE_LAYERS.map((l) => {
                const st = busy ? "running" : c.cells[l];
                return <CoverageCell key={l} status={st} title={`${c.code} ${LAYER_TITLES[l]} — ${st}`} label={`${c.code} ${l} ${st}`} />;
              })}
              <div className="flex justify-center">
                <ReRunButton runnable={runnable} phase={rr?.phase} error={rr?.error} code={c.code} onClick={() => reRun(c.id, c.code)} />
              </div>
            </div>
          );
        })
      )}

      {/* legend — two labelled groups so the sequential freshness ramp reads
          apart from the categorical process states */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 px-1">
        <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">Freshness</span>
        {["fresh", "aging", "stale"].map((k) => (
          <span key={k} className="flex items-center gap-1 text-caos-xs text-caos-muted">
            <span className="inline-flex w-9"><CoverageCell status={k} title={k} /></span>{k}
          </span>
        ))}
        <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted ml-2">State</span>
        {["running", "blocked"].map((k) => (
          <span key={k} className="flex items-center gap-1 text-caos-xs text-caos-muted">
            <span className="inline-flex w-9"><CoverageCell status={k} title={k} /></span>{k}
          </span>
        ))}
      </div>
    </div>
  );
}

export function QaQueue() {
  if (QA_QUEUE.length === 0) {
    return <EmptyNote tone="success" label="QA queue clear" body="No open CP-5 findings. New QA-gate failures land here for triage." />;
  }
  return (
    <div>
      {QA_QUEUE.map((q) => (
        <div key={q.id} className="px-3 py-[6px] border-b border-caos-border/50">
          <div className="flex items-center gap-2">
            <Tag sev={q.sev === "HIGH" ? "critical" : q.sev === "MEDIUM" ? "warning" : "low"}>{q.sev}</Tag>
            <span className="tabular text-caos-md text-caos-muted">{q.id}</span>
            {/* Drill-through: issuer → profile overlay; module → its Deep-Dive
                view (where the cited evidence lives) — the P1 "one click from
                evidence" fix. */}
            <IssuerLink query={q.issuer} title={`Open ${q.issuer} profile`} className="tabular text-caos-md text-caos-accent hover:text-caos-text transition-caos">
              {q.issuer}
            </IssuerLink>
            <Link
              href={`/deepdive?issuer=${encodeURIComponent(q.issuer)}&mod=${encodeURIComponent(q.module)}`}
              title={`Open ${q.issuer} ${q.module} in Deep-Dive`}
              className="no-underline tabular text-caos-xs text-caos-muted hover:text-caos-accent border border-caos-border/70 hover:border-caos-accent/60 rounded px-1 transition-caos"
            >
              {q.module} →
            </Link>
            <span className="tabular text-caos-xs text-caos-muted ml-auto">{q.age}</span>
          </div>
          <div className="text-caos-md text-caos-text leading-snug mt-1">{q.text}</div>
        </div>
      ))}
    </div>
  );
}

export function GapsList() {
  // Source gaps read worst-first: severity primary, most-recent request as the
  // tiebreak — so a high-severity gap never hides below a low one (the data
  // array isn't authored in order). Matches the QA-queue / alert-feed ordering.
  const rank: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const gaps = [...GAPS].sort(
    (a, b) =>
      (rank[a.sev] ?? 9) - (rank[b.sev] ?? 9) ||
      Date.parse(`${b.requested} 2026`) - Date.parse(`${a.requested} 2026`),
  );
  if (gaps.length === 0) {
    return <EmptyNote tone="success" label="No open gaps" body="Every covered issuer has its required sources. New CP-0 source gaps land here." />;
  }
  return (
    <div>
      {gaps.map((g, i) => (
        <div key={i} className="px-3 py-[6px] border-b border-caos-border/50">
          <div className="flex items-center gap-2">
            {/* Severity never rides on the colour dot alone (WCAG 1.4.1) — the
                word travels too, matching the QA-queue Tag one panel over. */}
            <Dot sev={g.sev} />
            <span className="tabular text-caos-2xs uppercase tracking-wider" style={{ color: SEV_COLOR[g.sev] ?? "var(--caos-muted)" }}>{g.sev}</span>
            <IssuerLink query={g.issuer} title={`Open ${g.issuer} profile`} className="tabular text-caos-md text-caos-accent hover:text-caos-text transition-caos">
              {g.issuer}
            </IssuerLink>
            <span className="text-caos-md text-caos-text truncate">{g.doc}</span>
            <span className="tabular text-caos-xs text-caos-muted ml-auto">req. {g.requested}</span>
          </div>
          <div className="text-caos-xs text-caos-muted leading-snug mt-0.5 pl-3.5">{g.impact}</div>
        </div>
      ))}
    </div>
  );
}

/* ---------- footer detail strip ---------- */
export function IssuerStrip({ code, onClose }: { code: string; onClose: () => void }) {
  const p = PORTFOLIO.find((x) => (x.id || x.figi || x.code) === code);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Don't steal Escape from a field the user is typing in (e.g. the NL Query
      // input) — only close the strip when focus isn't in an editable control.
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return;
      onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!p) return null;
  const stat = (l: string, v: string, c?: string) => (
    <span key={l} className="flex flex-col items-start">
      <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">{l}</span>
      <span className="tabular text-caos-xl" style={{ color: c }}>{v}</span>
    </span>
  );
  return (
    <div className="h-12 shrink-0 border-t border-caos-border bg-caos-panel flex items-center gap-6 px-4 caos-enter">
      <span className="flex items-center gap-2">
        <span className="tabular text-caos-xl text-caos-accent">{p.code}</span>
        <span className="text-caos-xl text-caos-text font-medium">{p.name}</span>
        <Tag sev={p.qa}>{p.qa}</Tag>
      </span>
      {stat("3Y DM", p.dm + "bps")}
      {stat("Margin", "S+" + p.margin)}
      {stat("Net Lev", fmtLevX(p.lev))}
      {stat("Int Cov", fmtLevX(p.cov))}
      {stat("M2E", p.m2e.toFixed(1) + "mo", p.m2e < 12 ? "var(--caos-warning)" : undefined)}
      {stat("Posture", p.posture, POSTURE_COLOR[p.posture])}
      <div className="flex-1"></div>
      {p.code === "ATLF" ? (
        <Link href="/deepdive" className="no-underline tabular text-caos-md px-2.5 py-1.5 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos">
          OPEN DEEP-DIVE →
        </Link>
      ) : (
        <span className="tabular text-caos-xs text-caos-muted">Deep-Dive available for ATLF in this preview</span>
      )}
      <CloseButton onClick={onClose} title="Close (Esc)" />
    </div>
  );
}
