"use client";

// Command Center views: portfolio posture table, CP-MON email intelligence,
// live alert feed, QA queue, source gaps
// and the issuer detail strip (port of design bundle concept-a.jsx).

import { useEffect, useMemo, useRef, useState } from "react";
import { CloseButton } from "@/components/shared/CloseButton";
import Link from "next/link";
import { StatusGlyph } from "@/components/shared/StatusGlyph";
import {
  GAPS, PORTFOLIO, QA_QUEUE, type QaQueueItem, type GapItem,
} from "@/lib/command/data";
import { cleanRating } from "@/lib/command/rvdata";
import { FRAGILITY_COLOR, QA_COLOR, RV_COLOR, fmtX } from "@/components/command/LiveCoverage";
import type { PortfolioRowDTO } from "@/lib/api";
import { SEV_COLOR } from "@/lib/pipeline/sev";
import { Dot, Tag } from "@/components/pipeline/atoms";
import { IssuerLink } from "@/components/shared/IssuerLink";
import { FilterHeader, updateColumnFilter, useColumnFilters, type FilterState } from "@/components/shared/TableColumnFilter";
import { useVirtualScroll } from "@/lib/useVirtualScroll";
import { useRovingFocus } from "@/lib/useRovingFocus";
import { focusFirstRowAction, syncRowActionTabStops } from "@/lib/rowActionMode";

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
    <div className="shrink-0 flex items-center gap-5 px-4 py-2.5 rounded-md border border-caos-border bg-caos-panel">
      <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted shrink-0">
        Posture · {total} positions
      </span>
      <div
        className="flex h-2.5 flex-1 min-w-0 overflow-hidden rounded bg-caos-bg border border-caos-border/40"
        role="img"
        aria-label={"Posture distribution — " + POSTURE_ORDER.map((k) => POSTURE_SHORT[k] + " " + by[k]).join(", ")}
      >
        {POSTURE_ORDER.map((k) => (
          by[k] ? (
            <div
              key={k}
              title={k + " · " + by[k]}
              className="transition-[width] duration-[160ms] ease-out motion-reduce:transition-none"
              style={{ width: (by[k] / total) * 100 + "%", background: POSTURE_COLOR[k] }}
            />
          ) : null
        ))}
      </div>
      <div className="flex items-center gap-4 shrink-0">
        {POSTURE_ORDER.map((k) => (
          <span key={k} className="flex items-center gap-1.5 whitespace-nowrap">
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ background: POSTURE_COLOR[k] }}
            />
            <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">{POSTURE_SHORT[k]}</span>
            <span className="tabular text-caos-md font-medium" style={{ color: POSTURE_COLOR[k] }}>{by[k]}</span>
          </span>
        ))}
      </div>
      <div className="h-4 w-px bg-caos-border shrink-0 hidden md:block" />
      <div className="flex items-center gap-4 shrink-0">
        <Link
          href="/monitor"
          title="Positions with open CP-MON alerts — open Monitor"
          className="no-underline hidden md:flex items-center gap-1.5 shrink-0 group transition-caos"
        >
          <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">On watch</span>
          <span className="tabular text-caos-md font-medium text-caos-warning">{alerting}</span>
          <span className="tabular text-caos-xs text-caos-muted group-hover:text-caos-accent transition-caos">→ Monitor</span>
        </Link>
        <span className="hidden md:flex items-center gap-1.5 shrink-0">
          <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">QA open</span>
          <span className="tabular text-caos-md font-medium text-caos-warning">{QA_QUEUE.length}</span>
        </span>
      </div>
    </div>
  );
}

/* ---------- sparkline ---------- */
export function Spark({ data, color = "var(--caos-accent)", w = 72, h = 18 }: { data: number[]; color?: string; w?: number; h?: number }) {
  if (data.length < 2) return <span className="tabular text-caos-muted">{data[0] ?? "—"}</span>;
  const min = Math.min(...data), max = Math.max(...data);
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * (w - 2) + 1;
      const y = h - 2 - ((v - min) / (max - min || 1)) * (h - 4);
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} className="shrink-0" role="img" aria-label={`Trend from ${data[0]} to ${data[data.length - 1]}; range ${min} to ${max}`}>
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

type SeedPosition = (typeof PORTFOLIO)[number];
type CellSelect = (code: string | null) => void;

const SIMPLE_CELL_RENDERERS: Record<string, (position: SeedPosition) => React.ReactNode> = {
  sector: (position) => <span key="sector" className="text-caos-muted text-caos-md truncate">{position.sector}</span>,
  subSector: (position) => <span key="subSector" className="text-caos-muted text-caos-md truncate">{position.subSector || "—"}</span>,
  figi: (position) => <span key="figi" className="tabular text-caos-muted text-caos-xs truncate">{position.figi || "—"}</span>,
  rank: (position) => <span key="rank" className="tabular text-caos-md text-caos-muted">{position.rank || "—"}</span>,
  rating: (position) => <span key="rating" className="tabular text-caos-md text-caos-muted">{cleanRating(position.rating)}</span>,
  size: (position) => <span key="size" className="tabular text-caos-md text-caos-text text-right truncate w-full">{position.size || "$—"}</span>,
  margin: (position) => <span key="margin" className="tabular text-right w-full">S+{position.margin}</span>,
  maturity: (position) => <span key="maturity" className="tabular text-right text-caos-muted">{position.maturity || position.inst.match(/'\d+/)?.[0] || "—"}</span>,
  bid: (position) => <span key="bid" className="tabular text-right">{position.bid == null ? "—" : position.bid.toFixed(1)}</span>,
  ask: (position) => <span key="ask" className="tabular text-right">{position.ask == null ? "—" : position.ask.toFixed(1)}</span>,
  lev: (position) => <span key="lev" className="tabular text-right">{fmtLevX(position.lev)}</span>,
  snrLev: (position) => <span key="snrLev" className="tabular text-right">{fmtLevX(position.snrLev)}</span>,
  totalLev: (position) => <span key="totalLev" className="tabular text-right">{fmtLevX(position.totalLev)}</span>,
  cov: (position) => <span key="cov" className="tabular text-right">{fmtLevX(position.cov)}</span>,
  posture: (position) => <span key="posture" className="tabular text-caos-md truncate" style={{ color: POSTURE_COLOR[position.posture] }}>{position.posture}</span>,
  conv: (position) => <span key="conv" className="tabular text-right text-caos-text">{position.conv}</span>,
  qa: (position) => <Tag key="qa" sev={position.qa}>{position.qa}</Tag>,
  alerts: (position) => <span key="alerts" className="tabular text-right" style={{ color: position.alerts ? "var(--caos-warning)" : "var(--caos-muted)" }}>{position.alerts ? `⚑${position.alerts}` : "—"}</span>,
};

function renderIdentityCell(key: string, position: SeedPosition, selected: boolean, onSelect: CellSelect) {
  const stickyBg = selected ? "bg-caos-elevated" : "bg-caos-bg";
  const hoverBg = "group-hover:bg-caos-elevated/60";
  const borrower = position.borrower || position.name;
  if (key === "expand") {
    return <button key="expand" type="button" onClick={() => onSelect(selected ? null : (position.id || position.figi || position.code))} aria-label={selected ? `Collapse details for ${borrower}` : `Expand details for ${borrower}`} className={`sticky left-0 z-20 flex h-5 w-5 items-center justify-center rounded hover:bg-caos-elevated text-caos-muted hover:text-caos-text transition-caos focus-ring cursor-pointer ${stickyBg} ${hoverBg}`}><span className="text-[10px]" aria-hidden="true">{selected ? "▼" : "▶"}</span></button>;
  }
  if (key === "code") return <IssuerLink key="code" query={position.code} className={`sticky left-[32px] z-20 inline-flex items-center min-h-[18px] tabular text-caos-accent transition-caos ${stickyBg} ${hoverBg}`} title={`Open ${position.code} profile`}>{position.code}</IssuerLink>;
  if (key === "name") return <IssuerLink key="name" query={borrower} className={`sticky left-[98px] z-20 inline-flex items-center gap-1.5 min-h-[18px] text-caos-text truncate transition-caos ${stickyBg} ${hoverBg}`} title={`Open ${borrower} profile — ${position.name}, ${position.size}`}><span className="truncate">{borrower}</span><span className="tabular text-caos-2xs text-caos-muted shrink-0" aria-hidden="true">{position.size}</span></IssuerLink>;
  return undefined;
}

function sparkTone(delta: number) {
  if (delta > 5) return "var(--caos-critical)";
  if (delta < -2) return "var(--caos-success)";
  return "var(--caos-muted)";
}

function deltaTone(delta: number) {
  if (delta > 0) return { color: "var(--caos-critical-bright)", background: "color-mix(in srgb, var(--caos-critical) 6%, transparent)", prefix: "+" };
  if (delta < 0) return { color: "var(--caos-success-bright)", background: "color-mix(in srgb, var(--caos-success) 6%, transparent)", prefix: "" };
  return { color: "var(--caos-muted)", background: undefined, prefix: "" };
}

function renderMarketSignalCell(key: string, position: SeedPosition) {
  const sparkColor = sparkTone(position.dd);
  if (key === "dd") {
    const tone = deltaTone(position.dd);
    return <span key="dd" className="tabular text-right rounded px-0.5" style={{ color: tone.color, background: tone.background }}>{tone.prefix}{position.dd.toFixed(2)}</span>;
  }
  if (key === "spark") return <Spark key="spark" data={position.spark} color={sparkColor} w={76} h={16} />;
  if (key === "ytdSpark") return position.ytdSpark ? <Spark key="ytdSpark" data={position.ytdSpark} color={sparkColor} w={76} h={16} /> : <span key="ytdSpark" className="tabular text-caos-muted">—</span>;
  return undefined;
}

function renderCell(key: string, position: SeedPosition, selected: boolean, onSelect: CellSelect) {
  const identity = renderIdentityCell(key, position, selected, onSelect);
  if (identity !== undefined) return identity;
  const signal = renderMarketSignalCell(key, position);
  if (signal !== undefined) return signal;
  const renderer = SIMPLE_CELL_RENDERERS[key];
  return renderer ? renderer(position) : null;
}

type PortfolioFilterKey = "code" | "name" | "sector" | "subSector" | "figi" | "rank" | "rating" | "size" | "margin" | "maturity" | "bid" | "ask" | "dd" | "spark" | "ytdSpark" | "lev" | "snrLev" | "totalLev" | "cov" | "posture" | "conv" | "qa" | "alerts";
type PortfolioPreset = "full" | "credit" | "market";

const PORTFOLIO_VALUE_GETTERS: Record<PortfolioFilterKey, (position: SeedPosition) => string | number | null | undefined> = {
  code: (p) => p.code, name: (p) => p.borrower || p.name, sector: (p) => p.sector,
  subSector: (p) => p.subSector, figi: (p) => p.figi, rank: (p) => p.rank, rating: (p) => p.rating,
  size: (p) => p.size, margin: (p) => p.margin, maturity: (p) => p.maturity, bid: (p) => p.bid,
  ask: (p) => p.ask, dd: (p) => p.dd, spark: () => "chart", ytdSpark: () => "chart",
  lev: (p) => p.lev, snrLev: (p) => p.snrLev, totalLev: (p) => p.totalLev, cov: (p) => p.cov,
  posture: (p) => p.posture, conv: (p) => p.conv, qa: (p) => p.qa, alerts: (p) => p.alerts,
};

const PORTFOLIO_PRESET_KEYS = {
  full: ["expand", "code", "name", "sector", "subSector", "figi", "rank", "rating", "size", "margin", "maturity", "bid", "ask", "dd", "spark", "ytdSpark", "lev", "snrLev", "totalLev", "cov", "posture", "conv", "qa", "alerts"],
  // Seed leverage fields are absent, so the credit default hides them while the
  // full lens keeps them available for sleeves with real engine coverage.
  credit: ["expand", "code", "name", "sector", "rank", "rating", "posture", "conv", "qa", "alerts"],
  market: ["expand", "code", "name", "sector", "size", "margin", "maturity", "bid", "ask", "dd", "spark", "ytdSpark", "posture", "alerts"],
} as const;

// Signal columns lead taxonomy and market detail; presets only filter this order.
const PORTFOLIO_COLUMNS = [
  { key: "expand", head: "", width: "24px", sticky: "sticky left-0 z-30" },
  { key: "code", head: "Ticker", width: "58px", sticky: "sticky left-[32px] z-30" },
  { key: "name", head: "Company", width: "170px", sticky: "sticky left-[98px] z-30" },
  { key: "sector", head: "Sector", width: "220px" }, { key: "rating", head: "Ratings", width: "74px" },
  { key: "posture", head: "Posture", width: "92px" }, { key: "conv", head: "Conv.", width: "48px" },
  { key: "qa", head: "QA", width: "74px" }, { key: "alerts", head: "⚑", width: "36px" },
  { key: "lev", head: "NetLev", width: "54px" }, { key: "snrLev", head: "SnrLev", width: "54px" },
  { key: "totalLev", head: "TotLev", width: "54px" }, { key: "cov", head: "IntCov", width: "54px" },
  { key: "subSector", head: "Sub-sector", width: "240px" }, { key: "figi", head: "FIGI", width: "90px" },
  { key: "rank", head: "Rank", width: "110px" }, { key: "size", head: "Size", width: "70px" },
  { key: "margin", head: "Margin", width: "58px" }, { key: "maturity", head: "Maturity", width: "70px" },
  { key: "bid", head: "Bid", width: "44px" }, { key: "ask", head: "Ask", width: "44px" },
  { key: "dd", head: "Δ 1D", width: "54px" }, { key: "spark", head: "30D Chart", width: "86px" },
  { key: "ytdSpark", head: "YTD Chart", width: "86px" },
] as const;

const RIGHT_ALIGNED_COLUMNS = new Set(["size", "margin", "maturity", "bid", "ask", "dd", "lev", "snrLev", "totalLev", "cov", "conv", "alerts"]);
const FIXED_COLUMNS = new Set(["expand", "code", "name"]);

function matchingPortfolioPreset(visibleCols: string[]): PortfolioPreset | "custom" {
  const matches = (keys: readonly string[]) => keys.length === visibleCols.length && keys.every((key) => visibleCols.includes(key));
  if (matches(PORTFOLIO_PRESET_KEYS.full)) return "full";
  if (matches(PORTFOLIO_PRESET_KEYS.credit)) return "credit";
  if (matches(PORTFOLIO_PRESET_KEYS.market)) return "market";
  return "custom";
}

function useColumnCustomizer() {
  const customizerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!customizerRef.current?.contains(event.target as Node) && !buttonRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    window.addEventListener("pointerdown", closeOutside);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("pointerdown", closeOutside);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);
  return { buttonRef, customizerRef, open, setOpen };
}

function usePortfolioColumns() {
  const [filters, setFilters] = useState<FilterState>({});
  const [visibleCols, setVisibleCols] = useState<string[]>(() => [...PORTFOLIO_PRESET_KEYS.credit]);
  const customizer = useColumnCustomizer();
  const shown = useColumnFilters(PORTFOLIO, filters, PORTFOLIO_VALUE_GETTERS);
  const activeCols = PORTFOLIO_COLUMNS.filter((column) => visibleCols.includes(column.key));
  const setFilter = (column: string, values: string[] | undefined) => setFilters((current) => updateColumnFilter(current, column, values));
  const setPreset = (preset: PortfolioPreset) => setVisibleCols([...PORTFOLIO_PRESET_KEYS[preset]]);
  const setColumnVisible = (key: string, visible: boolean) => setVisibleCols((current) => {
    if (!visible) return current.filter((column) => column !== key);
    const next = [...current, key];
    return PORTFOLIO_COLUMNS.map((column) => column.key).filter((column) => next.includes(column));
  });
  const gridTemplateColumns = activeCols.map((column) => column.width).join(" ");
  const minWidth = activeCols.reduce((sum, column) => sum + parseInt(column.width), 0) + (activeCols.length - 1) * 8 + 24;
  return { activeCols, colPreset: matchingPortfolioPreset(visibleCols), customizer, filters, gridTemplateColumns, minWidth, setColumnVisible, setFilter, setPreset, shown, visibleCols };
}

function useSelectedRowFocus(selected: string | null, visibleRowIds: string[], setActiveRowId: (id: string) => void) {
  useEffect(() => {
    if (selected && visibleRowIds.includes(selected)) setActiveRowId(selected);
  }, [selected, setActiveRowId, visibleRowIds]);
}

function useRowActionTabStops(rowRefs: { current: Map<string, HTMLDivElement> }, actionRowId: string | null, rowIds: string[], visibleRowIds: string[], setActionRowId: (id: string | null) => void) {
  useEffect(() => {
    if (actionRowId && !visibleRowIds.includes(actionRowId)) setActionRowId(null);
    for (const [id, row] of rowRefs.current) syncRowActionTabStops(row, actionRowId === id);
  }, [actionRowId, rowIds, rowRefs, setActionRowId, visibleRowIds]);
}

function usePendingRowFocus(rowRefs: { current: Map<string, HTMLDivElement> }, pendingFocusId: { current: string | null }, activeId: string | null, visibleRowIds: string[], setActiveRowId: (id: string) => void) {
  useEffect(() => {
    const pending = pendingFocusId.current;
    const row = pending ? rowRefs.current.get(pending) : undefined;
    if (row) {
      row.focus();
      pendingFocusId.current = null;
      return;
    }
    if (!pending && activeId && !visibleRowIds.includes(activeId) && visibleRowIds[0]) setActiveRowId(visibleRowIds[0]);
  }, [activeId, pendingFocusId, rowRefs, setActiveRowId, visibleRowIds]);
}

function usePortfolioRows(shown: SeedPosition[], selected: string | null) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const pendingFocusId = useRef<string | null>(null);
  const [actionRowId, setActionRowId] = useState<string | null>(null);
  const virtual = useVirtualScroll({ itemCount: shown.length, estimateHeight: 33, overscan: 10, containerRef: scrollerRef });
  const visibleItems = useMemo(() => shown.slice(virtual.startIndex, virtual.endIndex + 1), [shown, virtual.endIndex, virtual.startIndex]);
  const visibleRowIds = useMemo(() => visibleItems.map((position) => position.id || position.figi || position.code), [visibleItems]);
  const rowIds = useMemo(() => shown.map((position) => position.id || position.figi || position.code), [shown]);
  const { activeId, getItemProps: getRowFocusProps, setActiveId: setActiveRowId } = useRovingFocus(rowIds);
  useSelectedRowFocus(selected, visibleRowIds, setActiveRowId);
  useRowActionTabStops(rowRefs, actionRowId, rowIds, visibleRowIds, setActionRowId);
  usePendingRowFocus(rowRefs, pendingFocusId, activeId, visibleRowIds, setActiveRowId);
  const moveFocus = (targetId: string, targetIndex: number) => {
    setActionRowId(null);
    setActiveRowId(targetId);
    const targetRow = rowRefs.current.get(targetId);
    if (targetRow) targetRow.focus();
    else if (scrollerRef.current) {
      pendingFocusId.current = targetId;
      scrollerRef.current.scrollTop = targetIndex * 33;
      scrollerRef.current.dispatchEvent(new Event("scroll"));
    }
  };
  return { actionRowId, getRowFocusProps, moveFocus, rowIds, rowRefs, scrollerRef, setActionRowId, visibleItems, ...virtual };
}

type PortfolioRowsModel = ReturnType<typeof usePortfolioRows>;
type PortfolioColumnsModel = ReturnType<typeof usePortfolioColumns>;

function portfolioNavigationIndex(key: string, rowId: string, rowIds: string[]) {
  if (!rowIds.length) return null;
  if (key === "Home") return 0;
  if (key === "End") return rowIds.length - 1;
  if (key !== "ArrowUp" && key !== "ArrowDown") return null;
  const offset = key === "ArrowDown" ? 1 : -1;
  return Math.max(0, Math.min(rowIds.length - 1, rowIds.indexOf(rowId) + offset));
}

type PortfolioKeyActions = {
  actionMode: boolean;
  activate: () => void;
  enterActionMode: (row: HTMLDivElement) => boolean;
  exitActionMode: () => void;
  moveFocus: (targetId: string, targetIndex: number) => void;
  rowId: string;
  rowIds: string[];
};

function handlePortfolioRowKeyDown(event: React.KeyboardEvent<HTMLDivElement>, actions: PortfolioKeyActions) {
  if (event.key === "Escape" && actions.actionMode) {
    event.preventDefault();
    actions.exitActionMode();
    event.currentTarget.focus();
    return;
  }
  if (event.currentTarget !== event.target) return;
  if (event.key === "F2") {
    if (actions.enterActionMode(event.currentTarget)) event.preventDefault();
    return;
  }
  const targetIndex = portfolioNavigationIndex(event.key, actions.rowId, actions.rowIds);
  if (targetIndex !== null) {
    event.preventDefault();
    actions.moveFocus(actions.rowIds[targetIndex], targetIndex);
    return;
  }
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    actions.activate();
  }
}

function PortfolioColumnCustomizer({ columns }: { columns: PortfolioColumnsModel }) {
  if (!columns.customizer.open) return null;
  return (
    <div role="dialog" aria-label="Customize columns" ref={columns.customizer.customizerRef} className="absolute right-0 top-[calc(100%+4px)] z-overlay w-48 rounded border border-caos-border bg-caos-panel p-2 shadow-lg max-h-80 overflow-auto" style={{ boxShadow: "var(--shadow-pop)" }}>
      <div className="text-caos-2xs uppercase tracking-wider text-caos-muted mb-1.5 px-1 font-semibold">Toggle Columns</div>
      <div className="flex flex-col gap-0.5">
        {PORTFOLIO_COLUMNS.filter((column) => !FIXED_COLUMNS.has(column.key)).map((column) => (
          <label key={column.key} className="flex items-center gap-2 px-1 py-0.5 hover:bg-caos-elevated/70 rounded cursor-pointer select-none">
            <input type="checkbox" name="portfolio-visible-column" autoComplete="off" checked={columns.visibleCols.includes(column.key)} onChange={(event) => columns.setColumnVisible(column.key, event.target.checked)} className="accent-[var(--caos-accent)] cursor-pointer focus-ring" />
            <span className="tabular text-caos-xs text-caos-text">{column.head || column.key}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function PortfolioToolbar({ columns }: { columns: PortfolioColumnsModel }) {
  const lenses = [["Desk", "full"], ["Credit", "credit"], ["Market", "market"]] as const;
  return (
    <div className="flex shrink-0 items-center overflow-visible whitespace-nowrap border-b border-caos-border px-3 h-9">
      <div className="flex items-center gap-1">
        <span className="shrink-0 tabular text-caos-2xs uppercase tracking-wider text-caos-muted mr-2">View</span>
        <div className="flex items-center bg-caos-bg border border-caos-border/80 rounded p-[2px] gap-0.5">
          {lenses.map(([label, preset]) => (
            <button key={preset} type="button" onClick={() => columns.setPreset(preset)} className={"shrink-0 tabular text-caos-2xs px-2.5 py-0.5 rounded-sm transition-caos focus-ring cursor-pointer " + (columns.colPreset === preset ? "bg-caos-elevated text-caos-text font-medium" : "text-caos-muted hover:text-caos-text")}>{label}</button>
          ))}
        </div>
      </div>
      <span className="ml-auto shrink-0 tabular text-caos-2xs text-caos-muted mr-3">{columns.shown.length} / {PORTFOLIO.length} shown</span>
      <div className="relative shrink-0 flex items-center">
        <button ref={columns.customizer.buttonRef} type="button" onClick={() => columns.customizer.setOpen(!columns.customizer.open)} className="shrink-0 tabular text-caos-2xs px-2 py-1 rounded border border-caos-border/80 text-caos-muted hover:text-caos-text hover:bg-caos-elevated/40 hover:border-caos-accent/40 transition-caos focus-ring flex items-center gap-1 cursor-pointer" aria-haspopup="dialog" aria-expanded={columns.customizer.open}>
          <span>COLUMNS</span>
          <svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 3h8M2 6h8M2 9h8" /></svg>
        </button>
        <PortfolioColumnCustomizer columns={columns} />
      </div>
    </div>
  );
}

function PortfolioHeader({ columns }: { columns: PortfolioColumnsModel }) {
  const headerClass = "tabular text-caos-xs uppercase tracking-wider text-caos-muted";
  return (
    <div role="row" aria-rowindex={1} className="px-3 h-8.5 border-b border-caos-border sticky top-0 bg-caos-panel z-20 items-center" style={{ gridTemplateColumns: columns.gridTemplateColumns, display: "grid", gap: "0 0.5rem" }}>
      {columns.activeCols.map((column) => {
        if (column.key === "expand") return <div key="expand" role="columnheader" className={headerClass + " sticky left-0 z-30 bg-caos-panel flex items-center justify-center"} style={{ width: column.width }} />;
        const getter = PORTFOLIO_VALUE_GETTERS[column.key as PortfolioFilterKey];
        const sticky = "sticky" in column ? ` ${column.sticky} bg-caos-panel` : "";
        if (!getter) return <div key={column.key} role="columnheader" className={headerClass + sticky} style={{ width: column.width }}>{column.head}</div>;
        return (
          <FilterHeader key={column.key} label={COL_TITLES[column.head] || column.head} col={column.key} rows={PORTFOLIO} getValue={getter} selected={columns.filters[column.key]} onChange={columns.setFilter} asHeaderCell className={headerClass + (RIGHT_ALIGNED_COLUMNS.has(column.key) ? " justify-end text-right w-full" : "") + sticky}>
            {column.head}
          </FilterHeader>
        );
      })}
    </div>
  );
}

function PortfolioRow({ columns, onSelect, position, rowIndex, rows, selected }: { columns: PortfolioColumnsModel; onSelect: CellSelect; position: SeedPosition; rowIndex: number; rows: PortfolioRowsModel; selected: string | null }) {
  const rowId = position.id || position.figi || position.code;
  const isSelected = selected === rowId;
  const focusProps = rows.getRowFocusProps(rowId);
  const activate = () => onSelect(isSelected ? null : rowId);
  const actionMode = rows.actionRowId === rowId;
  const registerRow = (element: HTMLDivElement | null) => {
    focusProps.ref(element);
    if (!element) return void rows.rowRefs.current.delete(rowId);
    rows.rowRefs.current.set(rowId, element);
    syncRowActionTabStops(element, actionMode);
  };
  const actions: PortfolioKeyActions = {
    actionMode, activate, rowId, rowIds: rows.rowIds, moveFocus: rows.moveFocus,
    enterActionMode: (row) => {
      if (!focusFirstRowAction(row)) return false;
      rows.setActionRowId(rowId);
      return true;
    },
    exitActionMode: () => rows.setActionRowId(null),
  };
  const rowTone = isSelected ? "bg-caos-elevated/30 hover:bg-caos-elevated/55" : "bg-caos-bg hover:bg-caos-elevated/35";
  return (
    <div role="row" ref={registerRow} tabIndex={actionMode ? -1 : focusProps.tabIndex} onFocus={focusProps.onFocus} onBlur={(event) => { if (actionMode && !event.currentTarget.contains(event.relatedTarget as Node | null)) rows.setActionRowId(null); }} aria-rowindex={rows.startIndex + rowIndex + 2} aria-selected={isSelected} aria-keyshortcuts="F2" aria-describedby="coverage-positions-grid-help" aria-label={`${position.borrower || position.name} position details`} onClick={(event) => { if (!(event.target as HTMLElement).closest("a, button, input, select, textarea, [role='button'], [role='link']")) activate(); }} onKeyDown={(event) => handlePortfolioRowKeyDown(event, actions)} className={`group relative px-3 py-[5px] border-b border-caos-border/40 transition-caos items-center outline-none focus-ring ${rowTone} z-0`} style={{ gridTemplateColumns: columns.gridTemplateColumns, display: "grid", gap: "0 0.5rem" }}>
      {columns.activeCols.map((column) => <div key={column.key} role={column.key === "code" ? "rowheader" : "gridcell"} className="contents">{renderCell(column.key, position, isSelected, onSelect)}</div>)}
    </div>
  );
}

function PortfolioGrid({ columns, onSelect, rows, selected }: { columns: PortfolioColumnsModel; onSelect: CellSelect; rows: PortfolioRowsModel; selected: string | null }) {
  return (
    <div ref={rows.scrollerRef} role="grid" aria-label="Coverage positions" aria-rowcount={columns.shown.length + 1} className="flex-1 min-h-0 overflow-auto">
      <div style={{ minWidth: columns.minWidth }}>
        <PortfolioHeader columns={columns} />
        <div style={{ paddingTop: rows.paddingTop, paddingBottom: rows.paddingBottom }}>
          {rows.visibleItems.map((position, index) => <PortfolioRow key={position.id || position.figi || position.code} columns={columns} onSelect={onSelect} position={position} rowIndex={index} rows={rows} selected={selected} />)}
        </div>
      </div>
    </div>
  );
}

export function PortfolioTable({ selected, onSelect }: { selected: string | null; onSelect: CellSelect }) {
  const columns = usePortfolioColumns();
  const rows = usePortfolioRows(columns.shown, selected);
  return (
    <div className="flex h-full min-h-0 flex-col text-caos-md">
      <p id="coverage-positions-grid-help" className="sr-only">Use Up and Down Arrow to move between position rows. Press Enter or Space to open row details. Press F2 to enter row actions; press Escape to return to the row.</p>
      <PortfolioToolbar columns={columns} />
      <PortfolioGrid columns={columns} onSelect={onSelect} rows={rows} selected={selected} />
    </div>
  );
}

export { AlertFeed, EmailIntel } from "@/components/command/MonitorStreams";

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

// `items` is the live CP-5 gate queue (lib/command/qa.ts) when a backend is
// present; absent, it falls back to the seeded per-finding list so the offline
// demo is unchanged. An empty live array is a real "queue clear" state.
export function QaQueue({
  items,
  noFallback = false,
  emptyLabel = "QA queue clear",
  emptyBody = "No open CP-5 findings. New QA-gate failures land here for triage.",
}: {
  items?: QaQueueItem[];
  /** Governance's new categories (Failed Gates) have no seeded demo fixture —
   *  `noFallback` keeps an undefined/offline `items` at an honest empty state
   *  instead of falling back to the original QA_QUEUE seed (which would
   *  duplicate those five rows under a second heading). */
  noFallback?: boolean;
  emptyLabel?: string;
  emptyBody?: string;
}) {
  const queue = items ?? (noFallback ? [] : QA_QUEUE);
  if (queue.length === 0) {
    return <EmptyNote tone="success" label={emptyLabel} body={emptyBody} />;
  }
  return (
    <div>
      {queue.map((q) => (
        <div key={q.key ?? q.id} className="px-3 py-[6px] border-b border-caos-border/50">
          <div className="flex items-center gap-2">
            <Tag sev={q.sev === "HIGH" ? "critical" : q.sev === "MEDIUM" ? "warning" : "low"}>{q.sev}</Tag>
            <span className="tabular text-caos-md text-caos-muted">{q.id}</span>
            {/* Drill-through: issuer → profile overlay; module → its Deep-Dive
                view (where the cited evidence lives) — the P1 "one click from
                evidence" fix. */}
            <IssuerLink query={q.issuer} title={`Open ${q.issuer} profile`} className="tabular text-caos-md text-caos-accent hover:text-caos-text transition-caos focus-ring rounded px-0.5 outline-none">
              {q.issuer}
            </IssuerLink>
            <Link
              href={`/deepdive?issuer=${encodeURIComponent(q.issuer)}&mod=${encodeURIComponent(q.module)}`}
              title={`Open ${q.issuer} ${q.module} in Deep-Dive`}
              className="no-underline tabular text-caos-xs text-caos-muted hover:text-caos-accent border border-caos-border/70 hover:border-caos-accent/60 rounded px-1 transition-caos focus-ring outline-none"
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

// `items` is the live CP-0 source-gap log (lib/command/gaps.ts) when a backend
// is present; absent, it falls back to the seeded list so the offline demo is
// unchanged. An empty live array is a real "no open gaps" state.
export function GapsList({ items }: { items?: GapItem[] }) {
  // Source gaps read worst-first: severity primary, most-recent request as the
  // tiebreak — so a high-severity gap never hides below a low one (the data
  // array isn't authored in order). Matches the QA-queue / alert-feed ordering.
  const rank: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const gaps = [...(items ?? GAPS)].sort(
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
            <IssuerLink query={g.issuer} title={`Open ${g.issuer} profile`} className="tabular text-caos-md text-caos-accent hover:text-caos-text transition-caos focus-ring rounded px-0.5 outline-none">
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
function editableElement(element: HTMLElement | null) {
  if (!element) return false;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName) || element.isContentEditable;
}

function useIssuerStripEscape(onClose: () => void) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || editableElement(document.activeElement as HTMLElement | null)) return;
      onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);
}

function StripStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return <span className="flex flex-col items-start"><span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">{label}</span><span className="tabular text-caos-xl" style={{ color }}>{value}</span></span>;
}

function LiveIssuerStrip({ row, onClose }: { row: PortfolioRowDTO; onClose: () => void }) {
  const recommendation = row.rv_recommendation;
  const fragility = row.downside_fragility;
  const fragilityGlyph = fragility === "HIGH" ? "▲" : fragility === "MODERATE" ? "■" : "●";
  return (
    <div className="h-12 shrink-0 border-t border-caos-border bg-caos-panel flex items-center gap-6 px-4 caos-enter">
      <span className="flex items-center gap-2">
        <span className="tabular text-caos-xl text-caos-accent">{row.ticker || "—"}</span>
        <span className="text-caos-xl text-caos-text font-medium">{row.name}</span>
        <span className="tabular text-caos-2xs uppercase tracking-wider" style={{ color: QA_COLOR[row.qa_status] ?? "var(--caos-muted)" }}>{row.qa_status}</span>
        <span className="tabular text-caos-2xs uppercase tracking-wider" style={{ color: "var(--caos-success)" }}>● LIVE</span>
        {row.as_of ? <span className="tabular text-caos-2xs text-caos-muted uppercase tracking-wider">as of {row.as_of.slice(0, 10)}</span> : null}
      </span>
      <StripStat label="Net Lev" value={fmtX(row.metrics.net_leverage)} />
      <StripStat label="Int Cov" value={fmtX(row.metrics.interest_coverage)} />
      <StripStat label="RV" value={recommendation ?? "—"} color={recommendation ? RV_COLOR[recommendation] : undefined} />
      <StripStat label="Fragility" value={fragility ? `${fragilityGlyph} ${fragility}` : "—"} color={fragility ? FRAGILITY_COLOR[fragility] : undefined} />
      <div className="flex-1"></div>
      <Link href={`/deepdive?issuer=${encodeURIComponent(row.issuer_id)}`} className="no-underline tabular text-caos-md px-2.5 py-1.5 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos">OPEN DEEP-DIVE →</Link>
      <CloseButton onClick={onClose} title="Close (Esc)" />
    </div>
  );
}

function SeededIssuerStrip({ position, onClose }: { position: SeedPosition; onClose: () => void }) {
  return (
    <div className="h-12 shrink-0 border-t border-caos-border bg-caos-panel flex items-center gap-6 px-4 caos-enter">
      <span className="flex items-center gap-2">
        <span className="tabular text-caos-xl text-caos-accent">{position.code}</span>
        <span className="text-caos-xl text-caos-text font-medium">{position.name}</span>
        <Tag sev={position.qa}>{position.qa}</Tag>
        <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted border border-caos-border rounded px-1.5 py-px whitespace-nowrap" title="Seeded sample figures for the Phase-1 showcase — not live positions.">Sample — not live</span>
      </span>
      <StripStat label="3Y DM" value={`${position.dm}bps`} />
      <StripStat label="Margin" value={`S+${position.margin}`} />
      <StripStat label="Net Lev" value={fmtLevX(position.lev)} />
      <StripStat label="Int Cov" value={fmtLevX(position.cov)} />
      <StripStat label="M2E" value={`${position.m2e.toFixed(1)}mo`} color={position.m2e < 12 ? "var(--caos-warning)" : undefined} />
      <StripStat label="Posture" value={position.posture} color={POSTURE_COLOR[position.posture]} />
      <div className="flex-1"></div>
      {position.code === "ATLF" ? <Link href="/deepdive" className="no-underline tabular text-caos-md px-2.5 py-1.5 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos">OPEN DEEP-DIVE →</Link> : <span className="tabular text-caos-xs text-caos-muted">Deep-Dive available for ATLF in this preview</span>}
      <CloseButton onClick={onClose} title="Close (Esc)" />
    </div>
  );
}

// `liveRow` (a live-coverage selection) takes precedence over the seeded fixture:
// resolving a live ticker against PORTFOLIO either dead-ended (no match → null)
// or, on a code collision, attributed seeded DM/leverage to the live issuer.
export function IssuerStrip({ code, liveRow, onClose }: { code: string; liveRow?: PortfolioRowDTO | null; onClose: () => void }) {
  useIssuerStripEscape(onClose);
  if (liveRow) return <LiveIssuerStrip row={liveRow} onClose={onClose} />;
  const position = PORTFOLIO.find((row) => (row.id || row.figi || row.code) === code);
  return position ? <SeededIssuerStrip position={position} onClose={onClose} /> : null;
}
