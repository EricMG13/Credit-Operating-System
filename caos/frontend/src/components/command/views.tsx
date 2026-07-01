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
  ALERTS, COVERAGE, EMAIL_TILES, EMAILS, GAPS, PORTFOLIO, QA_QUEUE, SECTORS,
  type EmailRow,
} from "@/lib/command/data";
import { simClock } from "@/lib/pipeline/sim-engine";
import { SEV_COLOR, sevSurface } from "@/lib/pipeline/sev";
import { Dot, Tag } from "@/components/pipeline/atoms";
import { SectorReview } from "@/components/command/SectorReview";
import { FlashOnChange } from "@/components/shared/FlashOnChange";
import { onActivate } from "@/lib/a11y";
import { IssuerLink } from "@/components/shared/IssuerLink";
import { FilterHeader, useColumnFilters, type FilterState } from "@/components/shared/TableColumnFilter";

export const POSTURE_COLOR: Record<string, string> = {
  OVERWEIGHT: "var(--caos-success)", HOLD: "var(--caos-muted)",
  UNDERWEIGHT: "var(--caos-warning)", REDUCE: "var(--caos-critical)",
};
const STANCE_COLOR: Record<string, string> = {
  CONSTRUCTIVE: "var(--caos-success)", NEUTRAL: "var(--caos-muted)",
  CAUTIOUS: "var(--caos-warning)", NEGATIVE: "var(--caos-critical)",
};

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
  "Δ d/d": "Day-over-day change (bps)",
  NetLev: "Net leverage (×)",
  IntCov: "Interest coverage (×)",
  M2E: "Market-to-estimate gap",
  "Conv.": "Conviction — analyst scale 1–5",
  QA: "QA clearance status",
  "⚑": "Open alerts",
};

export function PortfolioTable({
  selected, onSelect, tick: _tick,
}: {
  selected: string | null;
  onSelect: (code: string | null) => void;
  tick: number;
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

  const [colPreset, setColPreset] = useState<"full" | "credit" | "market" | "custom">("full");

  const presetKeys = {
    full: ["expand", "code", "name", "sector", "subSector", "figi", "rank", "rating", "size", "margin", "maturity", "bid", "ask", "dd", "spark", "ytdSpark", "lev", "snrLev", "totalLev", "cov", "posture", "conv", "qa", "alerts"],
    credit: ["expand", "code", "name", "sector", "rank", "rating", "lev", "snrLev", "totalLev", "cov", "posture", "conv", "qa", "alerts"],
    market: ["expand", "code", "name", "sector", "size", "margin", "maturity", "bid", "ask", "dd", "spark", "ytdSpark", "posture", "alerts"],
  } as const;

  const ALL_COLS = [
    { key: "expand", head: "", width: "24px", sticky: "sticky left-0 z-30" },
    { key: "code", head: "Ticker", width: "58px", sticky: "sticky left-[32px] z-30" },
    { key: "name", head: "Company", width: "170px", sticky: "sticky left-[98px] z-30" },
    { key: "sector", head: "Sector", width: "220px" },
    { key: "subSector", head: "Sub-sector", width: "240px" },
    { key: "figi", head: "FIGI", width: "90px" },
    { key: "rank", head: "Rank", width: "110px" },
    { key: "rating", head: "Ratings", width: "74px" },
    { key: "size", head: "Size", width: "70px" },
    { key: "margin", head: "Margin", width: "58px" },
    { key: "maturity", head: "Maturity", width: "70px" },
    { key: "bid", head: "Bid", width: "44px" },
    { key: "ask", head: "Ask", width: "44px" },
    { key: "dd", head: "Δ 1D", width: "54px" },
    { key: "spark", head: "30D Chart", width: "86px" },
    { key: "ytdSpark", head: "YTD Chart", width: "86px" },
    { key: "lev", head: "NetLev", width: "48px" },
    { key: "snrLev", head: "SnrLev", width: "48px" },
    { key: "totalLev", head: "TotLev", width: "48px" },
    { key: "cov", head: "IntCov", width: "48px" },
    { key: "posture", head: "Posture", width: "92px" },
    { key: "conv", head: "Conv.", width: "44px" },
    { key: "qa", head: "QA", width: "74px" },
    { key: "alerts", head: "⚑", width: "36px" },
  ] as const;

  const [visibleCols, setVisibleCols] = useState<string[]>(() => [...presetKeys.full]);
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
            onClick={() => onSelect(sel ? null : key)}
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
            className={`sticky left-[98px] z-20 inline-flex items-center min-h-[18px] text-caos-text truncate hover:text-white transition-caos ${stickyBg} ${hoverBg}`}
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
        return <span key="figi" className="tabular text-caos-muted text-caos-sm truncate">{p.figi || "—"}</span>;
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
        return <span key="bid" className="tabular text-right">{(p.bid ?? p.px - 0.2).toFixed(1)}</span>;
      case "ask":
        return <span key="ask" className="tabular text-right">{(p.ask ?? p.px + 0.2).toFixed(1)}</span>;
      case "dd":
        return (
          <span
            key="dd"
            className="tabular text-right rounded px-0.5"
            style={{
              color: p.dd > 0 ? "var(--caos-success-bright)" : p.dd < 0 ? "var(--caos-critical-bright)" : "var(--caos-muted)",
              background: p.dd > 0 ? "rgba(34,197,94,0.06)" : p.dd < 0 ? "rgba(239,68,68,0.06)" : undefined,
            }}
          >
            {p.dd > 0 ? "+" : ""}{p.dd.toFixed(2)}
          </span>
        );
      case "spark":
        return <Spark key="spark" data={p.spark} color={sparkColor} w={76} h={16} />;
      case "ytdSpark":
        return <Spark key="ytdSpark" data={p.ytdSpark || p.spark} color={sparkColor} w={76} h={16} />;
      case "lev":
        return <span key="lev" className="tabular text-right">{p.lev.toFixed(1)}x</span>;
      case "snrLev":
        return <span key="snrLev" className="tabular text-right">{(p.snrLev ?? Math.max(0, p.lev - 1.1)).toFixed(1)}x</span>;
      case "totalLev":
        return <span key="totalLev" className="tabular text-right">{(p.totalLev ?? p.lev).toFixed(1)}x</span>;
      case "cov":
        return <span key="cov" className="tabular text-right">{p.cov.toFixed(1)}x</span>;
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
        <span className="shrink-0 tabular text-caos-2xs uppercase tracking-widest text-caos-muted mr-1">Lens</span>
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

        {/* body */}
        <div className="flex-1 min-h-0 overflow-auto px-4 py-3">
          <p className="text-caos-lg text-caos-text/90 leading-relaxed whitespace-pre-line">{email.body}</p>
        </div>

        {/* CP-MON classification footer */}
        <div className="px-4 py-2 border-t border-caos-border bg-caos-elevated/40 shrink-0 flex items-center gap-2 flex-wrap">
          <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">CP-MON classification</span>
          <span className="tabular text-caos-xs px-1.5 py-px rounded border border-caos-border text-caos-accent">{email.issuer}</span>
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
export function EmailIntel({ tick, live }: { tick: number; live: boolean }) {
  const [filter, setFilter] = useState<string | null>(null);
  const [openEmail, setOpenEmail] = useState<EmailRow | null>(null);
  const grow = live ? Math.floor(tick / 8) : 0;
  // Tiles weighted by SEVERITY, not count — CRITICAL leads (largest), LOW and the
  // meta tiles recede, so the eye lands on what must be acted on rather than on
  // the biggest number (the 67 auto-filed).
  const tiles = [
    { k: "critical", label: "Critical", n: EMAIL_TILES.critical, sub: "≥ 90 mat.", on: true, fs: "text-caos-hero", color: SEV_COLOR.critical },
    { k: "high", label: "High", n: EMAIL_TILES.high, sub: "70–89", on: true, fs: "text-[18px]", color: SEV_COLOR.high },
    { k: "medium", label: "Medium", n: EMAIL_TILES.medium + Math.floor(grow / 2), sub: "40–69", on: true, fs: "text-caos-metric", color: SEV_COLOR.medium },
    { k: "low", label: "Low", n: EMAIL_TILES.low + grow, sub: "< 40 · filed", on: true, fs: "text-caos-xl", color: "var(--caos-muted)" },
    { k: "dedup", label: "Deduped", n: EMAIL_TILES.dedup, sub: "CP-MON-F", on: false, fs: "text-caos-xl", color: "var(--caos-muted)" },
    { k: "unresolved", label: "Unresolved", n: EMAIL_TILES.unresolved, sub: "issuer match", on: false, fs: "text-caos-xl", color: "var(--caos-text)" },
  ];
  const list = EMAILS.filter((e) => !filter || e.sev === filter);
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="grid gap-1.5 p-2 shrink-0" style={{ gridTemplateColumns: "1.35fr 1.15fr 1fr .85fr .85fr .9fr" }}>
        {/* fallow-ignore-next-line complexity */}
        {tiles.map((t) => {
          const sel = filter === t.k;
          const cls =
            "text-left rounded border px-2 py-1.5 transition-caos " +
            (sel ? "caos-selected bg-caos-elevated " : "bg-caos-bg ") +
            (t.on ? "hover:bg-caos-elevated/70 focus-ring" : "");
          const style = { borderColor: sel ? "var(--caos-accent)" : t.on ? sevSurface(t.k).borderColor : "var(--caos-border)" };
          const inner = (
            <>
              <div className={"tabular leading-none " + t.fs} style={{ color: t.color }}>
                <FlashOnChange value={t.n}>{t.n}</FlashOnChange>
              </div>
              <div className="text-caos-sm uppercase tracking-wider text-caos-muted mt-1">{t.label}</div>
              <div className="tabular text-caos-2xs text-caos-muted truncate">{t.sub}</div>
            </>
          );
          return t.on ? (
            <button key={t.k} onClick={() => setFilter(sel ? null : t.k)} className={cls} style={style}>{inner}</button>
          ) : (
            <div key={t.k} className={cls} style={style}>{inner}</div>
          );
        })}
      </div>
      <div className="flex-1 min-h-0 overflow-auto border-t border-caos-border">
        {list.map((e, i) => (
          <div
            key={i}
            role="button"
            tabIndex={0}
            onClick={() => setOpenEmail(e)}
            onKeyDown={onActivate(() => setOpenEmail(e))}
            title="Open email"
            aria-label={`Open email: ${e.subj}`}
            className="grid grid-cols-[40px_46px_1fr_120px_40px_130px] items-center gap-x-2 px-3 py-[3px] border-b border-caos-border/50 text-caos-lg hover:bg-caos-elevated/60 transition-caos cursor-pointer focus-ring"
          >
            <span className="tabular text-caos-md text-caos-muted">{e.t}</span>
            <span className="tabular text-caos-accent">{e.issuer}</span>
            <span className="min-w-0">
              <span className="text-caos-text truncate block">{e.subj}{e.dedup ? <span className="text-caos-muted text-caos-xs"> · dup</span> : null}</span>
              <span className="text-caos-muted text-caos-xs truncate block">{e.src}</span>
            </span>
            <span className="text-caos-sm text-caos-muted truncate">{e.signal}</span>
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
export function AlertFeed({ tick, live }: { tick: number; live: boolean }) {
  const visible = live ? Math.min(ALERTS.length, Math.floor(tick / 5) + 2) : ALERTS.length;
  const items = ALERTS.slice(0, visible);
  return (
    <div>
      {items.map((a, i) => (
        <div key={a.code} className={"flex items-start gap-2 px-3 py-[6px] border-b border-caos-border/50 hover:bg-caos-elevated/60 transition-caos " + (i === 0 && live ? "caos-enter" : "")}>
          <Dot sev={a.sev} pulse={i === 0 && live} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="tabular text-caos-md text-caos-accent">{a.issuer}</span>
              {/* Severity as a labelled tag too — the dot's color isn't the only
                  carrier of severity (colorblind-safe). */}
              <Tag sev={a.sev}>{a.sev}</Tag>
              <span className="tabular text-caos-xs text-caos-muted">{a.code}</span>
              <span className="tabular text-caos-xs text-caos-muted ml-auto">{simClock(Math.max(0, tick - i * 5))}</span>
            </div>
            <div className="text-caos-lg text-caos-text leading-snug mt-0.5">{a.text}</div>
            <div className="mt-1"><Tag sev="info">route → {a.route}</Tag></div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- CP-SR sector board ---------- */
export function SectorBoard() {
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
      if (Array.isArray(saved) && saved.length) setVisible(new Set(saved));
    } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem("caos-command-sectors-v2", JSON.stringify([...visible])); } catch {}
  }, [visible]);
  const shown = rows.filter((s) => visible.has(s.sector));
  const hidden = sectorChoices.filter((s) => !visible.has(s));

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
                  className="pointer-events-auto relative z-10 inline-flex h-6 w-6 items-center justify-center rounded tabular text-caos-lg font-bold leading-none text-caos-critical hover:text-caos-critical-bright focus-ring"
                >
                  ×
                </button>
              </div>
              <div className="relative pointer-events-none tabular text-caos-xs tracking-wide mt-1" style={{ color: STANCE_COLOR[s.stance] }}>{s.stance}</div>
              <div className="relative pointer-events-none text-caos-sm text-caos-muted mt-1 leading-snug">{s.trend}</div>
              <div className="relative pointer-events-none tabular text-caos-2xs text-caos-muted mt-1.5 flex justify-between">
                <span>{fresh ? "rev. today " + fresh : "rev. " + s.reviewed}</span>
                {fresh ? (
                  <span style={{ color: "var(--caos-success)" }}>✓ UPDATED</span>
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
                  className="inline-flex h-6 w-6 items-center justify-center rounded tabular text-caos-lg font-bold leading-none text-caos-critical hover:text-caos-critical-bright focus-ring"
                >
                  ×
                </button>
              </div>
              <div className="tabular text-caos-xs tracking-wide mt-1" style={{ color: STANCE_COLOR[s.stance] }}>{s.stance}</div>
              <div className="text-caos-sm text-caos-muted mt-1 leading-snug">{s.trend}</div>
              <div className="tabular text-caos-2xs text-caos-muted mt-1.5 flex justify-between">
                <span>{fresh ? "rev. today " + fresh : "rev. " + s.reviewed}</span>
                {fresh ? (
                  <span style={{ color: "var(--caos-success)" }}>✓ UPDATED</span>
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
              [sector]: new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" }),
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
const CELL_COLOR: Record<string, string> = {
  fresh: "rgba(34,197,94,0.35)", aging: "rgba(245,165,36,0.35)", stale: "rgba(239,68,68,0.40)",
  running: "rgba(99,161,255,0.25)", blocked: "rgba(239,68,68,0.35)",
};

const LAYER_TITLES: Record<string, string> = {
  L1: "L1 — Data Foundation (financials, fact packs, performance deltas, peer benchmarks)",
  L2: "L2 — Fundamental Credit Synthesis (fundamental credit, downside pathways, event catalysts, governance, liquidity, macro sensitivity)",
  L3: "L3 — Valuation, Portfolio, & Refinancing (relative value, recovery waterfalls, position sizing, refinancing risk)",
  L4: "L4 — Legal & Covenant (covenant interpretation, capacity calculator)",
  L5: "L5 — Quality Assurance (evidence trace validation, research integrity QA)",
  L6: "L6 — Debate & Decision (IC debate, portfolio debate)",
};

export function CoverageMatrix() {
  const [coverageData, setCoverageData] = useState(() => COVERAGE);
  const [running, setRunning] = useState<Record<string, boolean>>({});
  const layers = ["L1", "L2", "L3", "L4", "L5", "L6"];

  const handleReRun = (id: string) => {
    setRunning((prev) => ({ ...prev, [id]: true }));
    setCoverageData((prevData) =>
      prevData.map((item) => {
        if (item.id === id || item.code === id) {
          const newCells = { ...item.cells };
          layers.forEach((l) => {
            newCells[l] = "running";
          });
          return { ...item, cells: newCells };
        }
        return item;
      })
    );

    setTimeout(() => {
      setCoverageData((prevData) =>
        prevData.map((item) => {
          if (item.id === id || item.code === id) {
            const newCells = { ...item.cells };
            layers.forEach((l) => {
              newCells[l] = "fresh";
            });
            return { ...item, cells: newCells };
          }
          return item;
        })
      );
      setRunning((prev) => ({ ...prev, [id]: false }));
    }, 2000);
  };

  return (
    <div className="p-2">
      <div className="grid grid-cols-[110px_repeat(6,1fr)_70px] gap-1 items-center mb-1 px-1">
        <span className="tabular text-caos-xs uppercase text-caos-muted">Issuer</span>
        {layers.map((l) => (
          <span
            key={l}
            title={LAYER_TITLES[l]}
            tabIndex={0}
            className="tabular text-caos-xs uppercase text-caos-muted text-center cursor-help border-b border-dashed border-caos-border/50 pb-0.5 focus:outline-none focus:border-caos-accent focus:text-caos-text rounded px-0.5 transition-caos"
          >
            {l}
          </span>
        ))}
        <span className="tabular text-caos-xs uppercase text-caos-muted text-right">Refresh</span>
      </div>
      {coverageData.map((c) => (
        <div key={c.id || c.code} className="grid grid-cols-[110px_repeat(6,1fr)_70px] gap-1 items-center mb-1 px-1">
          <span className="tabular text-caos-lg text-caos-accent">{c.code}</span>
          {layers.map((l) => {
            const st = c.cells[l];
            return (
              <div
                key={l}
                title={`${c.code} ${LAYER_TITLES[l]} — ${st}`}
                className={"h-5 rounded-sm flex items-center justify-center transition-caos hover:opacity-80 " + (st === "running" ? "caos-running" : "")}
                style={{ background: CELL_COLOR[st] }}
              >
                <span className="tabular text-caos-3xs uppercase font-medium text-white">{st}</span>
              </div>
            );
          })}
          <button
            onClick={() => handleReRun(c.id || c.code)}
            disabled={running[c.id || c.code]}
            className="tabular text-caos-xs text-caos-muted border border-caos-border rounded px-1 py-0.5 hover:text-caos-text hover:border-caos-accent/60 transition-caos disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            {running[c.id || c.code] ? "RUNNING" : "RE-RUN"}
          </button>
        </div>
      ))}
      <div className="flex gap-3 mt-2 px-1">
        {Object.keys(CELL_COLOR).map((k) => (
          <span key={k} className="flex items-center gap-1 text-caos-xs text-caos-muted"><span className="w-2 h-2 rounded-sm" style={{ background: CELL_COLOR[k] }}></span>{k}</span>
        ))}
      </div>
    </div>
  );
}

export function QaQueue() {
  return (
    <div>
      {QA_QUEUE.map((q) => (
        <div key={q.id} className="px-3 py-[6px] border-b border-caos-border/50">
          <div className="flex items-center gap-2">
            <Tag sev={q.sev === "HIGH" ? "critical" : q.sev === "MEDIUM" ? "warning" : "low"}>{q.sev}</Tag>
            <span className="tabular text-caos-md text-caos-accent">{q.id}</span>
            <span className="tabular text-caos-md text-caos-muted">{q.issuer} · {q.module}</span>
            <span className="tabular text-caos-xs text-caos-muted ml-auto">{q.age}</span>
          </div>
          <div className="text-caos-lg text-caos-text leading-snug mt-1">{q.text}</div>
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
  return (
    <div>
      {gaps.map((g, i) => (
        <div key={i} className="px-3 py-[6px] border-b border-caos-border/50">
          <div className="flex items-center gap-2">
            <Dot sev={g.sev} />
            <span className="tabular text-caos-md text-caos-accent">{g.issuer}</span>
            <span className="text-caos-lg text-caos-text truncate">{g.doc}</span>
            <span className="tabular text-caos-xs text-caos-muted ml-auto">req. {g.requested}</span>
          </div>
          <div className="text-caos-sm text-caos-muted leading-snug mt-0.5 pl-3.5">{g.impact}</div>
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
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!p) return null;
  const stat = (l: string, v: string, c?: string) => (
    <span key={l} className="flex flex-col items-start">
      <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">{l}</span>
      <span className="tabular text-caos-2xl" style={{ color: c }}>{v}</span>
    </span>
  );
  return (
    <div className="h-12 shrink-0 border-t border-caos-border bg-caos-panel flex items-center gap-6 px-4 caos-enter">
      <span className="flex items-center gap-2">
        <span className="tabular text-caos-2xl text-caos-accent">{p.code}</span>
        <span className="text-caos-2xl text-caos-text font-medium">{p.name}</span>
        <Tag sev={p.qa}>{p.qa}</Tag>
      </span>
      {stat("3Y DM", p.dm + "bps")}
      {stat("Margin", "S+" + p.margin)}
      {stat("Net Lev", p.lev.toFixed(1) + "x")}
      {stat("Int Cov", p.cov.toFixed(1) + "x")}
      {stat("M2E", p.m2e.toFixed(1) + "mo", p.m2e < 12 ? "var(--caos-warning)" : undefined)}
      {stat("Posture", p.posture, POSTURE_COLOR[p.posture])}
      <div className="flex-1"></div>
      {p.code === "ATLF" ? (
        <Link href="/deepdive" className="no-underline tabular text-caos-md px-2.5 py-1.5 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos">
          OPEN DEEP-DIVE →
        </Link>
      ) : (
        <span className="tabular text-caos-xs text-caos-muted">deep-dive mocked for ATLF only</span>
      )}
      <button onClick={onClose} className="text-caos-muted hover:text-caos-text transition-caos text-caos-xl">✕</button>
    </div>
  );
}
