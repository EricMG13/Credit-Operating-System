"use client";

// Concept A — Sector RV: sector-peer relative value tables in the desk-sheet
// format (issuer + loan data, spread-implied liquidity, mid RV assessment,
// price deltas), with US Leveraged Loan index statistics and per-rating
// averages. Sector dropdown switches between sector tables.

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useResizeObserver } from "@/lib/use-resize-observer";
import { useRovingFocus, type RovingItemProps } from "@/lib/useRovingFocus";
import { Panel as PanelShell } from "@/components/shared/Panel";
import { IssuerLink } from "@/components/shared/IssuerLink";
import { StatusGlyph } from "@/components/shared/StatusGlyph";
import { FilterHeader, useColumnFilters, type FilterState } from "@/components/shared/TableColumnFilter";
import { ActionableDislocations } from "@/components/command/ActionableDislocations";
import {
  BUCKETS,
  DELTA_COLS,
  INDEX_STATS as SEED_INDEX_STATS,
  RV_AS_OF,
  RV_SECTORS as SEED_RV_SECTORS,
  RV_THRESHOLDS,
  buildIndexStats,
  buildRVSectors,
  buildRVRows,
  ratingAverages,
  subSectorAverages,
  crossSectorMatrix,
  derivePosture,
  invalidationTrigger,
  median,
  rvStaleness,
  rows as SEED_ROWS,
  type Liquidity,
  type RVHolding,
  type RVRow,
  type RVSignal,
} from "@/lib/command/rvdata";

const LIQ_STYLE: Record<Liquidity, { bg: string; fg: string }> = {
  High: { bg: "color-mix(in srgb, var(--caos-success) 20%, transparent)", fg: "var(--caos-success-bright)" },
  Normal: { bg: "color-mix(in srgb, var(--caos-success) 9%, transparent)", fg: "var(--caos-success-bright)" },
  OK: { bg: "color-mix(in srgb, var(--caos-warning) 14%, transparent)", fg: "var(--caos-warning-bright)" },
  Concerning: { bg: "color-mix(in srgb, var(--caos-critical) 16%, transparent)", fg: "var(--caos-critical-bright)" },
  Impaired: { bg: "rgba(148,163,184,0.14)", fg: "var(--caos-muted)" },
};

const RV_STYLE: Record<RVSignal, { bg: string; fg: string }> = {
  Cheap: { bg: "color-mix(in srgb, var(--caos-success) 20%, transparent)", fg: "var(--caos-success-bright)" },
  Wide: { bg: "color-mix(in srgb, var(--caos-success) 9%, transparent)", fg: "var(--caos-success-bright)" },
  Inline: { bg: "color-mix(in srgb, var(--tranche-2l) 12%, transparent)", fg: "var(--caos-accent)" },
  Tight: { bg: "color-mix(in srgb, var(--caos-warning) 14%, transparent)", fg: "var(--caos-warning-bright)" },
  Rich: { bg: "color-mix(in srgb, var(--caos-critical) 16%, transparent)", fg: "var(--caos-critical-bright)" },
  "N/A": { bg: "rgba(148,163,184,0.14)", fg: "var(--caos-muted)" },
};
const HEATMAP_BUCKETS = ["Ba1", "Ba2", "Ba3", "B1", "B2", "B3"];

function DeltaCell({ v, colLabel }: { v: number | null; colLabel?: string }) {
  if (v === null) {
    const noDataLabel = colLabel ? `${colLabel}: no data` : undefined;
    return (
      <td
        className="px-2 py-[3px] text-right tabular text-caos-muted"
        aria-label={noDataLabel}
        title={noDataLabel}
      >
        —
      </td>
    );
  }
  const pos = v > 0;
  const neg = v < 0;
  const valueLabel = colLabel ? `${colLabel}: ${pos ? "+" : ""}${v.toFixed(2)}` : undefined;
  return (
    <td
      className="px-2 py-[3px] text-right tabular"
      aria-label={valueLabel}
      title={valueLabel}
      style={{
        color: pos ? "var(--caos-success-bright)" : neg ? "var(--caos-critical-bright)" : "var(--caos-muted)",
        background: pos ? "color-mix(in srgb, var(--caos-success) 6%, transparent)" : neg ? "color-mix(in srgb, var(--caos-critical) 6%, transparent)" : undefined,
      }}
    >
      {/* Sign is explicit so direction isn't carried by color alone (colorblind
          users + the green/red wash). toFixed already prints "-" for negatives. */}
      {pos ? "+" : ""}{v.toFixed(2)}
    </td>
  );
}

function Chip({ liq, label }: { liq: Liquidity; label: string }) {
  const s = LIQ_STYLE[liq];
  return (
    <span
      className="tabular text-caos-2xs px-1.5 py-px rounded whitespace-nowrap"
      style={{ background: s.bg, color: s.fg }}
    >
      {label}
    </span>
  );
}

function CaveatHeader({ rows }: { rows: RVRow[] }) {
  const count = rows.length;
  const staleness = rvStaleness(RV_AS_OF);
  const posture = derivePosture(rows);
  const staleTone =
    staleness.tone === "success"
      ? "text-caos-success"
      : staleness.tone === "warning"
        ? "text-caos-warning"
        : "text-caos-critical";
  const postureColor =
    posture.label === "CONSTRUCTIVE"
      ? "var(--caos-success)"
      : posture.label === "CAUTIOUS"
        ? "var(--caos-warning)"
        : "var(--caos-muted)";
  const postureTitle = `Posture rule: cheap share minus rich share ≥ 10pts is CONSTRUCTIVE; ≤ -10pts is CAUTIOUS; otherwise NEUTRAL. Cheap ${posture.cheapCount} / rich ${posture.richCount} of ${posture.n} benchmarked → ${posture.label}.`;

  return (
    <div className="shrink-0 flex items-center justify-between px-4 py-2 border-b border-caos-border bg-caos-panel/40">
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-caos-warning" />
          <span className="tabular text-caos-2xs uppercase tracking-wider font-semibold text-caos-warning">SEED-REF</span>
        </span>
        <span className="tabular text-caos-xs text-caos-muted">
          posture: <span style={{ color: postureColor }} title={postureTitle}>{posture.label}</span> <span className="text-caos-3xs uppercase text-caos-muted opacity-80">(derived · not CP-SR)</span>
        </span>
        <span className="text-caos-muted">·</span>
        <span className="tabular text-caos-xs text-caos-muted">
          staleness: <span className={staleTone}>{staleness.label}</span>
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="tabular text-caos-2xs text-caos-muted font-mono uppercase">
          universe: {count} loans
        </span>
        <span className="text-caos-muted">·</span>
        <span className="tabular text-caos-2xs text-caos-muted font-mono">
          as-of {RV_AS_OF}
        </span>
      </div>
    </div>
  );
}

function CompoundRvChip({ r }: { r: RVRow }) {
  const cohortColor = RV_STYLE[r.rv]?.fg || "var(--caos-muted)";
  const instrumentColor = "var(--caos-border)";
  const portfolioColor = r.portfolioRv.held ? "var(--caos-success)" : "var(--caos-border)";
  const label = `Cohort: ${r.rv} | Instrument: ${r.instrumentRv.status} | Portfolio: ${r.portfolioRv.held ? "Held" : "Not Held"}`;

  return (
    <span className="inline-flex items-center gap-1.5" title={label} aria-label={label}>
      <span className="tabular text-caos-xs font-semibold" style={{ color: cohortColor }}>
        {r.rv}
      </span>
      <span className="inline-flex items-center gap-1" aria-hidden="true">
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: cohortColor }} />
        <span className="w-1.5 h-1.5 rotate-45 shrink-0 border bg-transparent" style={{ borderColor: instrumentColor }} />
        <span
          className="w-1.5 h-1.5 shrink-0 border"
          style={{ borderColor: portfolioColor, background: r.portfolioRv.held ? portfolioColor : "transparent" }}
        />
      </span>
    </span>
  );
}

function EvidenceBadge({ row }: { row: RVRow }) {
  const marketOk = Number.isFinite(row.bid) && Number.isFinite(row.ask) && row.ask >= row.bid;
  const peerOk = Boolean(row.rvProvenance?.credible);
  const title = `CP-6E compliance check: market ${marketOk ? "✓" : "◯"} | peer ${peerOk ? "✓" : "◯"} | recovery ◯ (insufficient feed)`;

  return (
    <span className="inline-flex items-center gap-1.5 tabular text-caos-2xs uppercase tracking-wider text-caos-muted" title={title} aria-label={title}>
      <span className={marketOk ? "text-caos-success" : "text-caos-muted"}>m {marketOk ? "✓" : "◯"}</span>
      <span className={peerOk ? "text-caos-success" : "text-caos-muted"}>p {peerOk ? "✓" : "◯"}</span>
      <span className="text-caos-muted">r ◯</span>
    </span>
  );
}

function RvLegend() {
  const signals: RVSignal[] = ["Cheap", "Wide", "Inline", "Tight", "Rich"];
  return (
    <div className="min-h-7 rounded border border-caos-border bg-caos-panel/60 px-3 py-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-caos-2xs text-caos-muted">
      <span className="tabular uppercase tracking-widest text-caos-muted">Legend</span>
      <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
        {signals.map((signal) => (
          <span key={signal} className="inline-flex items-center gap-1 tabular">
            <span className="w-2 h-2 rounded-sm" style={{ background: RV_STYLE[signal].fg }} aria-hidden="true" />
            {signal}
          </span>
        ))}
      </span>
      <span className="text-caos-muted">·</span>
      <span className="tabular">● cohort · ◇ instrument · ■ portfolio</span>
      <span className="text-caos-muted">·</span>
      <span className="tabular">m market · p peer · r recovery — ✓ verified / ◯ insufficient</span>
      <details className="relative ml-auto">
        <summary className="cursor-pointer list-none tabular text-caos-2xs text-caos-accent hover:text-caos-text focus-ring rounded px-1">
          Method
        </summary>
        <div className="absolute right-0 z-overlay mt-1 w-[min(420px,calc(100vw-2rem))] rounded border border-caos-border bg-caos-elevated p-2 text-caos-xs leading-relaxed text-caos-text shadow-lg" style={{ boxShadow: "var(--shadow-pop)" }}>
          RV = 3Y DM − sector×rating median (n ≥ 2) · carry = rvBp / yrs to maturity · staleness bands 90/180d.
        </div>
      </details>
    </div>
  );
}

function CrossSectorHeatmap({ rowsList, filtersActive, filterCount }: { rowsList: RVRow[]; filtersActive: boolean; filterCount: number }) {
  const matrix = useMemo(() => crossSectorMatrix(rowsList), [rowsList]);
  const sectors = useMemo(() => {
    const bucketMedian = (sector: string) => {
      const values = HEATMAP_BUCKETS
        .map((b) => matrix[sector]?.[b]?.median)
        .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
      return median(values) ?? Number.NEGATIVE_INFINITY;
    };
    return Object.keys(matrix).sort((a, b) => bucketMedian(b) - bucketMedian(a) || a.localeCompare(b));
  }, [matrix]);

  const getHeatmapColor = (medianVal: number | null) => {
    if (medianVal === null) return "text-caos-muted bg-transparent";
    if (medianVal >= RV_THRESHOLDS.cheap) return "text-caos-success-bright bg-caos-success/15 font-semibold";
    if (medianVal >= RV_THRESHOLDS.wide) return "text-caos-success bg-caos-success/8";
    if (medianVal <= RV_THRESHOLDS.rich) return "text-caos-critical-bright bg-caos-critical/15 font-semibold";
    if (medianVal <= RV_THRESHOLDS.tight) return "text-caos-critical bg-caos-critical/8";
    return "text-caos-muted bg-caos-elevated/40";
  };

  const caption = filtersActive
    ? `[reference universe · ${filterCount} column filters NOT applied]`
    : "[derived from universe · not per-sector]";

  return (
    <PanelShell
      title="Cross-Sector RV · median rvBp by sector × rating bucket"
      as="h3"
      right={
        <span className={`inline-flex items-center gap-1 tabular text-caos-3xs uppercase font-mono ${filtersActive ? "text-caos-warning" : "text-caos-muted"}`}>
          {filtersActive && <span className="w-1.5 h-1.5 rounded-full bg-caos-warning" aria-hidden="true" />}
          {caption}
        </span>
      }
    >
      <div className="p-3 flex flex-col gap-2">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-caos-xs">
            <thead>
              <tr className="border-b border-caos-border">
                <th scope="col" className="p-1.5 text-left tabular text-caos-2xs uppercase tracking-wider text-caos-muted font-normal">Sector</th>
                {HEATMAP_BUCKETS.map((b) => (
                  <th key={b} scope="col" className="p-1.5 text-right tabular text-caos-2xs uppercase tracking-wider text-caos-muted font-normal w-20">{b}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sectors.map((sector) => (
                <tr key={sector} className="border-b border-caos-border/40 hover:bg-caos-elevated/20 transition-caos">
                  <td className="p-1.5 font-medium text-caos-text truncate max-w-[150px]" title={sector}>{sector}</td>
                  {HEATMAP_BUCKETS.map((b) => {
                    const cell = matrix[sector]?.[b];
                    const val = cell?.median ?? null;
                    const n = cell?.n ?? 0;
                    const label = val === null ? "—" : (val > 0 ? "+" : "") + Math.round(val);
                    return (
                      <td
                        key={b}
                        className={`p-1.5 text-right tabular ${getHeatmapColor(val)}`}
                        title={val === null ? "No comp peers" : `${label}bp median across ${n} loans`}
                      >
                        {label}
                        {n > 0 && <span className="text-[9px] text-caos-muted ml-0.5">({n})</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </PanelShell>
  );
}

const td = "px-2 py-[5px] tabular whitespace-nowrap";
const loanKey = (r: RVRow) => `${r.figi}|${r.company}|${r.maturity ?? "na"}|${r.loanType}|${r.size}|${r.margin}`;

type SortConfig = { col: string | null; asc: boolean };
type SortVal = string | number | null | undefined;

// single cast point for sorting on a dynamic column name
const field = (r: object, c: string): SortVal => (r as Record<string, SortVal>)[c];

function useSort<T>(data: T[], config: SortConfig, getVal: (row: T, col: string) => SortVal) {
  return useMemo(() => {
    if (!config.col) return data;
    return [...data].sort((a, b) => {
      const valA = getVal(a, config.col!);
      const valB = getVal(b, config.col!);
      if (valA === valB) return 0;
      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;
      if (typeof valA === "string" && typeof valB === "string") {
        return config.asc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return config.asc ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
    });
    // getVal is a pure projection over config.col; inline-arrow callers would
    // otherwise bust this memo on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, config.col, config.asc]);
}

function useSortState(initial: SortConfig = { col: null, asc: true }) {
  const [sort, setSort] = useState<SortConfig>(initial);
  const handleSort = (col: string) => setSort((p) => (p.col === col ? { col, asc: !p.asc } : { col, asc: true }));
  return { sort, handleSort };
}

function SortTh<T>({
  label, align = "left", col, sort, onSort, rows, getValue, filters, onFilter,
}: {
  label: string;
  align?: "left" | "right";
  col: string;
  sort: SortConfig;
  onSort: (c: string) => void;
  rows?: T[];
  getValue?: (row: T) => SortVal;
  filters?: FilterState;
  onFilter?: (col: string, values: string[] | undefined) => void;
}) {
  const active = sort.col === col;
  const filterNode = rows && getValue && filters && onFilter ? (
    <FilterHeader
      label={label}
      col={col}
      rows={rows}
      getValue={getValue}
      selected={filters[col]}
      onChange={onFilter}
      iconOnly
    >
      {label}
    </FilterHeader>
  ) : null;
  return (
    // The clickable sort control is a real <button> (keyboard-operable, visible
    // focus ring); the <th> carries aria-sort so screen readers announce the
    // current sort direction. Previously a bare <th onClick> — mouse-only. (a11y)
    <th
      scope="col"
      aria-sort={active ? (sort.asc ? "ascending" : "descending") : "none"}
      className={`p-0 tabular text-caos-2xs uppercase tracking-wider text-caos-muted whitespace-nowrap sticky top-0 bg-caos-panel select-none ${col === "company" ? "left-0 z-20" : "z-10"} ${align === "right" ? "text-right" : "text-left"}`}
    >
      <span className={`flex w-full items-center gap-1 px-2 py-[6px] ${align === "right" ? "justify-end" : "justify-start"}`}>
        <button
          type="button"
          onClick={() => onSort(col)}
          title={`Sort by ${label}`}
          className={`min-w-0 inline-flex items-center gap-1 hover:text-caos-text transition-caos focus-ring ${align === "right" ? "justify-end" : "justify-start"}`}
        >
          {align === "right" && active && <span aria-hidden="true" className="text-caos-md text-caos-accent">{sort.asc ? "↑" : "↓"}</span>}
          <span className="truncate">{label}</span>
          {!active && <span aria-hidden="true" className="text-caos-2xs text-caos-muted opacity-40">↕</span>}
          {align === "left" && active && <span aria-hidden="true" className="text-caos-md text-caos-accent">{sort.asc ? "↑" : "↓"}</span>}
        </button>
        {filterNode}
      </span>
    </th>
  );
}

// Column-filter getters — shared by the table (its funnel headers) AND the
// chart (so the RV distribution respects the same filters). Exported as a stable
// memo-free constant object so both the lifted useColumnFilters call and the
// per-header FilterHeader read identical semantics.
const PEER_FILTER_VAL: Record<string, (r: RVRow) => SortVal> = {
  company: (r) => r.company, subSector: (r) => r.subSector, subGroup: (r) => r.subGroup,
  loanType: (r) => r.loanType, figi: (r) => r.figi, rank: (r) => r.rank,
  rating: (r) => r.rating, size: (r) => r.size, margin: (r) => r.margin,
  maturity: (r) => r.maturity || "", bid: (r) => r.bid, ask: (r) => r.ask,
  liq: (r) => r.liq, rv: (r) => r.rv, ytm: (r) => r.ytm, dm: (r) => r.dm,
  cohort: (r) => r.rvBp,
  inst: (r) => r.instrumentRv.status,
  portf: (r) => r.portfolioRv.held ? "held" : "none",
  carryRv: (r) => r.carryRv,
  ...Object.fromEntries(DELTA_COLS.map((_, i) => [`d${i}`, (r: RVRow) => r.d[i]])),
};

function PeerTable({
  rows, filtered, preset = "full", filters, onFilter, selected, hovered, onSelect, onHover,
}: {
  rows: RVRow[];
  filtered: RVRow[];
  preset?: "full" | "market" | "rv";
  filters: FilterState;
  onFilter: (col: string, values: string[] | undefined) => void;
  selected: string | null;
  hovered: string | null;
  onSelect: (figi: string) => void;
  onHover: (figi: string | null) => void;
}) {
  // Default: absolute rvBp descending (safer default sort, reducing junk blast radius).
  const { sort, handleSort } = useSortState({ col: "absRv", asc: false });
  // Scroll the selected row into view when selection is driven from the chart or
  // Top-of-book (not when the user clicked the row itself, but scrollIntoView with
  // block:"nearest" is a no-op if it's already visible, so it's harmless either way).
  const selRef = useRef<HTMLTableRowElement>(null);
  useEffect(() => {
    selRef.current?.scrollIntoView({ block: "nearest" });
  }, [selected]);
  const filterVal = PEER_FILTER_VAL;
  const setFilter = onFilter;
  const sorted = useSort(filtered, sort, (r, c) => {
    if (c.startsWith("d")) return r.d[parseInt(c.substring(1))];
    if (c === "rv" || c === "cohort") return r.rvBp;
    if (c === "absRv") return Math.abs(r.rvBp ?? 0);
    if (c === "inst") return r.instrumentRv.status;
    if (c === "portf") return r.portfolioRv.held ? 1 : 0;
    if (c === "carryRv") return r.carryRv;
    return field(r, c);
  });

  const showCol = (key: string) => {
    if (preset === "full") return true;
    if (preset === "market") {
      return ["company", "subSector", "size", "margin", "maturity", "bid", "ask", "liq", "ytm", "dm"].includes(key);
    }
    if (preset === "rv") {
      return ["company", "rating", "liq", "rv", "cohort", "inst", "portf", "carryRv", "d0", "d1", "dm"].includes(key);
    }
    return true;
  };

  const visibleColCount = [
    "company", "rv", "cohort", "inst", "portf", "carryRv", "subSector", "subGroup", "loanType", "figi",
    "rank", "rating", "size", "margin", "maturity", "bid", "ask", "liq", ...DELTA_COLS.map((_, i) => `d${i}`),
    "ytm", "dm",
  ].filter(showCol).length;
  const minWidthClass = preset === "full" ? "min-w-[1920px]" : "min-w-[1100px]";

  return (
    <table aria-label="Sector relative value" className={`border-collapse text-caos-xs ${minWidthClass} w-full`}>
      <thead>
        <tr className="border-b border-caos-border">
          {showCol("company") && <SortTh label="Company" col="company" sort={sort} onSort={handleSort} rows={rows} getValue={filterVal.company} filters={filters} onFilter={setFilter} />}
          {showCol("rv") && <SortTh label="RV comp." col="rv" sort={sort} onSort={handleSort} rows={rows} getValue={filterVal.rv} filters={filters} onFilter={setFilter} />}
          {showCol("cohort") && <SortTh label="Cohort RV" col="cohort" sort={sort} onSort={handleSort} rows={rows} getValue={filterVal.cohort} filters={filters} onFilter={setFilter} />}
          {showCol("inst") && <SortTh label="Instrument" col="inst" sort={sort} onSort={handleSort} rows={rows} getValue={filterVal.inst} filters={filters} onFilter={setFilter} />}
          {showCol("portf") && <SortTh label="Portf. Held" col="portf" sort={sort} onSort={handleSort} rows={rows} getValue={filterVal.portf} filters={filters} onFilter={setFilter} />}
          {showCol("carryRv") && <SortTh label="Carry RV (bp/yr)" col="carryRv" align="right" sort={sort} onSort={handleSort} rows={rows} getValue={filterVal.carryRv} filters={filters} onFilter={setFilter} />}
          {showCol("subSector") && <SortTh label="Sub-Sector" col="subSector" sort={sort} onSort={handleSort} rows={rows} getValue={filterVal.subSector} filters={filters} onFilter={setFilter} />}
          {showCol("subGroup") && <SortTh label="Sub-Group" col="subGroup" sort={sort} onSort={handleSort} rows={rows} getValue={filterVal.subGroup} filters={filters} onFilter={setFilter} />}
          {showCol("loanType") && <SortTh label="Loan Type" col="loanType" sort={sort} onSort={handleSort} rows={rows} getValue={filterVal.loanType} filters={filters} onFilter={setFilter} />}
          {showCol("figi") && <SortTh label="FIGI" col="figi" sort={sort} onSort={handleSort} rows={rows} getValue={filterVal.figi} filters={filters} onFilter={setFilter} />}
          {showCol("rank") && <SortTh label="Ranking" col="rank" sort={sort} onSort={handleSort} rows={rows} getValue={filterVal.rank} filters={filters} onFilter={setFilter} />}
          {showCol("rating") && <SortTh label="Rating" col="rating" sort={sort} onSort={handleSort} rows={rows} getValue={filterVal.rating} filters={filters} onFilter={setFilter} />}
          {showCol("size") && <SortTh label="Size ($Mn)" col="size" align="right" sort={sort} onSort={handleSort} rows={rows} getValue={filterVal.size} filters={filters} onFilter={setFilter} />}
          {showCol("margin") && <SortTh label="Margin" col="margin" align="right" sort={sort} onSort={handleSort} rows={rows} getValue={filterVal.margin} filters={filters} onFilter={setFilter} />}
          {showCol("maturity") && <SortTh label="Maturity" col="maturity" align="right" sort={sort} onSort={handleSort} rows={rows} getValue={filterVal.maturity} filters={filters} onFilter={setFilter} />}
          {showCol("bid") && <SortTh label="Bid" col="bid" align="right" sort={sort} onSort={handleSort} rows={rows} getValue={filterVal.bid} filters={filters} onFilter={setFilter} />}
          {showCol("ask") && <SortTh label="Ask" col="ask" align="right" sort={sort} onSort={handleSort} rows={rows} getValue={filterVal.ask} filters={filters} onFilter={setFilter} />}
          {showCol("liq") && <SortTh label="Liquidity" col="liq" sort={sort} onSort={handleSort} rows={rows} getValue={filterVal.liq} filters={filters} onFilter={setFilter} />}
          {DELTA_COLS.map((c, i) => (
            showCol(`d${i}`) && <SortTh key={c} label={c} col={`d${i}`} align="right" sort={sort} onSort={handleSort} rows={rows} getValue={filterVal[`d${i}`]} filters={filters} onFilter={setFilter} />
          ))}
          {showCol("ytm") && <SortTh label="Mid YTM" col="ytm" align="right" sort={sort} onSort={handleSort} rows={rows} getValue={filterVal.ytm} filters={filters} onFilter={setFilter} />}
          {showCol("dm") && <SortTh label="Mid 3Y DM" col="dm" align="right" sort={sort} onSort={handleSort} rows={rows} getValue={filterVal.dm} filters={filters} onFilter={setFilter} />}
        </tr>
      </thead>
      <tbody>
        {sorted.map((r) => {
          const isSel = selected === r.figi;
          const isHov = hovered === r.figi;
          // Selected row: accent tint + inset accent bar (position + tint, so the
          // highlight isn't colour-alone). Hover mirror stays subtle. The sticky
          // company cell has its own background, so it gets the matching tint too.
          const rowBg = isSel
            ? "bg-caos-accent/[0.12]"
            : isHov
              ? "bg-caos-elevated/60"
              : "hover:bg-caos-elevated/50";
          const stickyBg = isSel
            ? "bg-caos-elevated"
            : isHov
              ? "bg-caos-elevated"
              : "bg-caos-panel group-hover:bg-caos-elevated/50";
          return (
            <tr
              key={loanKey(r)}
              ref={isSel ? selRef : undefined}
              data-selected={isSel ? "true" : undefined}
              onClick={() => onSelect(r.figi)}
              onMouseEnter={() => onHover(r.figi)}
              onMouseLeave={() => onHover(null)}
              className={`border-b border-caos-border/40 transition-caos group cursor-pointer ${rowBg}`}
              style={isSel ? { boxShadow: "inset 2px 0 0 var(--caos-accent)" } : undefined}
            >
              {showCol("company") && (
                <td className={td + ` sticky left-0 z-10 text-caos-text transition-colors ${stickyBg}`}>
                  <button
                    type="button"
                    aria-pressed={isSel}
                    aria-label={`Select ${r.company}, rating ${r.rating}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(r.figi);
                    }}
                    onFocus={() => onHover(r.figi)}
                    onBlur={() => onHover(null)}
                    className="w-full text-left focus-ring rounded px-1 -mx-1 outline-none cursor-pointer"
                  >
                    {r.company}
                  </button>
                </td>
              )}
              {showCol("rv") && <td className={td}><CompoundRvChip r={r} /></td>}
              {showCol("cohort") && <td className={td + " text-right tabular text-caos-text"}>{r.rvBp !== null ? (r.rvBp > 0 ? "+" : "") + Math.round(r.rvBp) : "—"}</td>}
              {showCol("inst") && <td className={td + " text-caos-muted whitespace-nowrap"}><EvidenceBadge row={r} /></td>}
              {showCol("portf") && <td className={td + " text-caos-muted"}>{r.portfolioRv.held ? <span className="text-caos-success-bright">held</span> : "—"}</td>}
              {showCol("carryRv") && <td className={td + " text-right tabular text-caos-text"}>{r.carryRv !== null ? (r.carryRv > 0 ? "+" : "") + r.carryRv.toFixed(1) : "—"}</td>}
              {showCol("subSector") && <td className={td + " text-caos-muted max-w-[260px] truncate"}>{r.subSector}</td>}
              {showCol("subGroup") && <td className={td + " text-caos-muted max-w-[260px] truncate"}>{r.subGroup}</td>}
              {showCol("loanType") && <td className={td + " text-caos-muted"}>{r.loanType}</td>}
              {showCol("figi") && <td className={td + " text-caos-accent"}>{r.figi}</td>}
              {showCol("rank") && <td className={td + " text-caos-muted"}>{r.rank}</td>}
              {showCol("rating") && <td className={td + " text-caos-text"}>{r.rating}</td>}
              {showCol("size") && <td className={td + " text-right text-caos-text"}>{r.size.toLocaleString()}</td>}
              {showCol("margin") && <td className={td + " text-right text-caos-text"}>{r.margin}</td>}
              {showCol("maturity") && <td className={td + " text-right text-caos-muted"}>{r.maturity || "—"}</td>}
              {showCol("bid") && <td className={td + " text-right text-caos-text"}>{r.bid.toFixed(2)}</td>}
              {showCol("ask") && <td className={td + " text-right text-caos-text"}>{r.ask.toFixed(2)}</td>}
              {showCol("liq") && <td className={td}><Chip liq={r.liq} label={r.liq} /></td>}
              {r.d.map((v, j) => (
                showCol(`d${j}`) && <DeltaCell key={DELTA_COLS[j]} v={v} colLabel={DELTA_COLS[j]} />
              ))}
              {showCol("ytm") && <td className={td + " text-right text-caos-text"}>{r.ytm.toFixed(1)}</td>}
              {showCol("dm") && <td className={td + " text-right text-caos-text"}>{r.dm.toLocaleString()}</td>}
            </tr>
          );
        })}
        {sorted.length === 0 && (
          <tr>
            <td colSpan={visibleColCount} className="px-3 py-8 text-center tabular text-caos-xs text-caos-muted">
              No loans match the current column filters — clear a filter to repopulate the peer table.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

const fmt = (v: number | null, digits = 2) => (v === null ? "—" : v.toFixed(digits));

const bucketMedian = (xs: number[]): number | null => {
  const v = xs.filter((x) => x > 0);
  if (v.length < 2) return null; // matches the rvdata benchmark rule (n ≥ 2)
  return median(v);
};

// Same sum/length mean as rvdata's helper (no new number math): the Bar view's
// per-category height. null on an empty group so a category with no members
// simply draws nothing.
const mean = (xs: number[]): number | null => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

// Linear-interpolated percentile over an ALREADY-sorted ascending array — the
// exact q(p) the scatter already used for its 5–95 domain clamp, lifted so the
// Box view's whisker/IQR quartiles reuse it verbatim instead of a new formula.
const percentileSorted = (sorted: number[], p: number): number => {
  const idx = (sorted.length - 1) * p;
  const l = Math.floor(idx), h = Math.ceil(idx);
  return sorted[l] + (sorted[h] - sorted[l]) * (idx - l);
};

// ── Sector read + Top of book: deterministic reads over the SAME filtered rows ──
// Nothing here is opinion or fabricated prose — every phrase is templated from a
// count, a min/max, or a group tally on real RVRow fields (rvBp, bucket,
// subSector). A row with no benchmark (rvBp === null → "N/A") is excluded from the
// actionable tails exactly as the peer table's cheap→rich sort excludes it.

// The cheapest (widest positive rvBp) and richest (tightest negative rvBp) loans.
// A "pick" is a real row plus its one-line, machine-computed context — no prose.
export interface Pick {
  figi: string;
  company: string;
  rating: string;
  subSector: string;
  rvBp: number;
  rv: RVSignal;
  held: boolean;
  headroomPct?: number;
}

interface TopOfBook {
  cheap: Pick[]; // widest rvBp first (the "add" tail)
  rich: Pick[]; // tightest rvBp first (the "fade" tail)
}

const toPick = (r: RVRow): Pick => ({
  figi: r.figi,
  company: r.company,
  rating: r.rating,
  subSector: r.subSector,
  rvBp: r.rvBp as number, // callers pre-filter rvBp !== null
  rv: r.rv,
  held: r.portfolioRv.held,
  headroomPct: r.portfolioRv.headroomPct,
});

// Cheapest 3 (widest) to add, richest 2 (tightest) to fade — mirrors the task's
// spec and the peer table's default cheap→rich ordering. Benchmark-less rows drop
// out. Ties broken by |rvBp| then company for a stable, deterministic list.
function topOfBook(rows: RVRow[]): TopOfBook {
  const ranked = rows
    .filter((r) => r.rvBp !== null)
    .sort((a, b) => (b.rvBp as number) - (a.rvBp as number) || a.company.localeCompare(b.company));
  const cheap = ranked.filter((r) => (r.rvBp as number) > 0).slice(0, 3).map(toPick);
  const rich = ranked
    .filter((r) => (r.rvBp as number) < 0)
    .slice(-2)
    .reverse() // tightest (most negative) first
    .map(toPick);
  return { cheap, rich };
}

// A short, fully deterministic sector summary computed from the filtered rows:
// how many carry a benchmark, the dispersion range of rvBp, and which rating
// bucket / sub-sector concentrates the cheap tail. Returned as structured lines so
// the numeric spans can be styled without embedding markup in a string.
export interface SectorReadLine {
  text: string;
  metric?: string;
}

// Which key (bucket label or sub-sector) holds the most positive-rvBp members,
// and how many. null when there is no cheap tail at all.
function topCheapGroup(rows: RVRow[], key: (r: RVRow) => string): { name: string; count: number } | null {
  const tally = new Map<string, number>();
  for (const r of rows) {
    if (r.rvBp !== null && r.rvBp > 0) tally.set(key(r), (tally.get(key(r)) ?? 0) + 1);
  }
  let best: { name: string; count: number } | null = null;
  for (const [name, count] of tally) {
    if (!best || count > best.count) best = { name, count };
  }
  return best;
}

function sectorRead(rows: RVRow[], sectorName: string): SectorReadLine[] {
  const benched = rows.filter((r) => r.rvBp !== null);
  const lines: SectorReadLine[] = [];

  if (!rows.length) {
    return [{ text: "No loans in the current selection." }];
  }
  if (benched.length < 2) {
    lines.push({
      text: `${benched.length} of ${rows.length} loans carry a sector×rating benchmark (n ≥ 2 required) — too thin to read dispersion.`,
    });
    return lines;
  }

  const bps = benched.map((r) => r.rvBp as number).sort((a, b) => a - b);
  const widest = bps[bps.length - 1];
  const tightest = bps[0];
  const cheapCount = bps.filter((b) => b > 0).length;
  const richCount = bps.filter((b) => b < 0).length;

  lines.push({
    text: `RV dispersion spans`,
    metric: `${tightest > 0 ? "+" : ""}${Math.round(tightest)} → ${widest > 0 ? "+" : ""}${Math.round(widest)}bp vs sector×rating median`,
  });
  lines.push({
    text: `${cheapCount} loan${cheapCount === 1 ? "" : "s"} screen cheap (wide of median), ${richCount} rich (tight) across ${benched.length} benchmarked in ${sectorName}.`,
  });

  const byBucket = topCheapGroup(benched, (r) => r.bucket);
  const bySub = topCheapGroup(benched, (r) => r.subSector);
  if (byBucket && bySub) {
    lines.push({
      text: `Cheap tail concentrates in the ${byBucket.name} bucket (${byBucket.count}) and ${bySub.name} (${bySub.count}).`,
    });
  } else if (!cheapCount) {
    lines.push({ text: `No loan screens wide of its bucket median in the current selection.` });
  }

  return lines;
}

export type XMeasure = "rating" | "subSector" | "size" | "price";
export type ChartType = "scatter" | "bar" | "box";

const X_LABEL: Record<XMeasure, string> = {
  rating: "Rating",
  subSector: "Sub-sector",
  size: "Size ($Mn)",
  price: "Price",
};
const isCategorical = (x: XMeasure) => x === "rating" || x === "subSector";
// Continuous X reads a plain number off the row; Price is the bid/ask mid, the
// same mid the Market-Data Summary already averages.
const continuousValue = (r: RVRow, x: XMeasure): number => (x === "size" ? r.size : (r.bid + r.ask) / 2);
// Category a row belongs to, for the active categorical X.
const categoryOf = (r: RVRow, x: XMeasure): string => (x === "subSector" ? r.subSector : r.bucket);

function Point({
  cx, cy, fill, isSel, isHov, label, title, onSelect, onHover, roving,
}: {
  cx: number;
  cy: number;
  fill: string;
  isSel: boolean;
  isHov: boolean;
  label: string;
  title: string;
  onSelect: () => void;
  onHover: (on: boolean) => void;
  /** Roving-tabindex props for this point (G7) — exactly one point in the
   *  whole scatter is a real tab stop; arrow keys move which one, Tab moves
   *  past the scatter in one step instead of through every plotted loan. */
  roving: RovingItemProps;
}) {
  return (
    <g
      ref={roving.ref as React.Ref<SVGGElement>}
      role="button"
      tabIndex={roving.tabIndex}
      aria-label={label}
      aria-pressed={isSel}
      className="focus-ring cursor-pointer group outline-none"
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        } else {
          roving.onKeyDown(e);
        }
      }}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onFocus={() => { onHover(true); roving.onFocus(); }}
      onBlur={() => onHover(false)}
    >
      {/* Accessibility Focus Ring */}
      <circle
        cx={cx}
        cy={cy}
        r={13}
        fill="none"
        stroke="var(--caos-accent)"
        strokeWidth={1.5}
        className="opacity-0 group-focus-visible:opacity-100 transition-opacity"
      />
      {/* Selection outer ring with pulse */}
      {isSel && (
        <>
          <circle
            cx={cx}
            cy={cy}
            r={10.5}
            fill="none"
            stroke="var(--caos-accent)"
            strokeWidth={1.5}
            strokeOpacity={0.6}
            className="animate-pulse motion-reduce:animate-none"
          />
          {/* Backing gap */}
          <circle
            cx={cx}
            cy={cy}
            r={6.5}
            fill="none"
            stroke="var(--caos-bg)"
            strokeWidth={2}
          />
        </>
      )}
      {/* Soft hover ring */}
      {!isSel && isHov && (
        <circle
          cx={cx}
          cy={cy}
          r={7.5}
          fill="none"
          stroke="var(--caos-accent)"
          strokeWidth={1}
          strokeOpacity={0.6}
        />
      )}
      <circle cx={cx} cy={cy} r={isSel ? 4.5 : 3.4} fill={fill} fillOpacity={isSel ? 1 : 0.85}>
        <title>{title}</title>
      </circle>
    </g>
  );
}

// Sector RV made spatial: 3Y DM (Y, always) plotted against the chosen X measure.
// Categorical X (Rating / Sub-sector) → banded columns with per-band median tick
// and coloured points; dots ABOVE the tick are wide (cheap), below are tight
// (rich) — vertical position carries the signal for colorblind users; hue doubles
// it. Continuous X (Size / Price) → a linear axis of plain coloured points. Bar
// = average DM per category; Box = min→max whisker + IQR + median per category.
// This is the "relative" the tables only implied. Every mode renders from the
// SAME (column-filtered) row set.
//
// Selection/hover is lifted to SectorRV(): a clicked point selects that loan
// (enlarged + accent ring here, tinted + scrolled-into-view in the PeerTable);
// hover mirrors softly. In the categorical/continuous scatter modes each point is
// a real keyboard-operable control (Enter/Space selects). Bar/Box are aggregate
// views with no per-loan point, so selection simply doesn't apply there.
function RVScatter({
  rows, color, xMeasure, chartType, selected, hovered, onSelect, onHover, width: W, height: H,
}: {
  rows: RVRow[];
  color: string;
  xMeasure: XMeasure;
  chartType: ChartType;
  selected: string | null;
  hovered: string | null;
  onSelect: (figi: string) => void;
  onHover: (figi: string | null) => void;
  width: number;
  height: number;
}) {
  const padL = 46, padR = 14, padT = 14, padB = 30;
  const plotW = Math.max(1, W - padL - padR);
  const plotH = Math.max(1, H - padT - padB);

  const cat = isCategorical(xMeasure);
  // Ordered category list — keep BUCKETS order for Rating; A→Z for Sub-sector.
  const cats = cat
    ? (xMeasure === "rating"
      ? BUCKETS.filter((b) => rows.some((r) => r.bucket === b))
      : [...new Set(rows.map((r) => r.subSector))].sort())
    : [];

  // Roving-tabindex order for the plotted points (G7) — MUST match the exact
  // render order below (continuous: `rows` order; categorical: flattened by
  // category then member) so arrow keys move in the same direction the eye
  // reads left-to-right across the plot. Called unconditionally, before the
  // early returns just below — a hook can't follow a conditional return.
  const pointIds = chartType === "scatter"
    ? (cat ? cats.flatMap((c) => rows.filter((r) => categoryOf(r, xMeasure) === c).map((r) => r.figi)) : rows.map((r) => r.figi))
    : [];
  const roving = useRovingFocus(pointIds);

  if (!rows.length) return null;
  if (cat && !cats.length) return null;

  // Robust Y domain: clamp to the 5th–95th percentile so a single junk DM value
  // (the feed carries a few, e.g. 579,028bp) can't flatten the distribution.
  // Out-of-range dots pin to the plot edge; the real value stays in the tooltip.
  const sortedDm = rows.map((r) => r.dm).sort((a, b) => a - b);
  const yMin = percentileSorted(sortedDm, 0.05), yMax = percentileSorted(sortedDm, 0.95);
  const yPad = (yMax - yMin || 1) * 0.08;
  const lo = yMin - yPad, hi = yMax + yPad;
  const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
  const scaleY = (v: number) => clamp(padT + ((hi - v) / (hi - lo || 1)) * plotH, padT, padT + plotH);
  const gridVals = [hi, (hi + lo) / 2, lo];

  // Categorical band geometry.
  const bandW = cat && cats.length ? plotW / cats.length : plotW;
  const bandX = (i: number) => padL + (i + 0.5) * bandW;

  // Continuous X domain (Size / Price) with an 8% pad, mirroring the Y clamp pad.
  const xs = cat ? [] : rows.map((r) => continuousValue(r, xMeasure));
  const xMinRaw = xs.length ? Math.min(...xs) : 0;
  const xMaxRaw = xs.length ? Math.max(...xs) : 1;
  const xPad = (xMaxRaw - xMinRaw || 1) * 0.08;
  const xLo = xMinRaw - xPad, xHi = xMaxRaw + xPad;
  const scaleX = (v: number) => padL + ((v - xLo) / (xHi - xLo || 1)) * plotW;

  const ariaLabel =
    chartType === "bar"
      ? `Average three-year discount margin per ${X_LABEL[xMeasure].toLowerCase()}`
      : chartType === "box"
        ? `Three-year discount margin distribution per ${X_LABEL[xMeasure].toLowerCase()}, each with min-to-max whisker, interquartile box and median tick`
        : cat
          ? `Three-year discount margin by ${X_LABEL[xMeasure].toLowerCase()}, with each ${xMeasure === "rating" ? "bucket" : "category"}'s median marked`
          : `Three-year discount margin against ${X_LABEL[xMeasure].toLowerCase()}`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-full"
      preserveAspectRatio="xMidYMid meet"
      role="group"
      aria-label={ariaLabel}
    >
      {gridVals.map((v, i) => (
        <g key={i}>
          <line x1={padL} y1={scaleY(v)} x2={W - padR} y2={scaleY(v)} stroke="var(--caos-border)" strokeWidth={1} strokeOpacity={0.3} strokeDasharray="3 3" />
          <text x={padL - 6} y={scaleY(v) + 3} textAnchor="end" fontSize={9} fill="var(--caos-muted)" className="tabular">{Math.round(v)}</text>
        </g>
      ))}
      <text x={13} y={padT + plotH / 2} textAnchor="middle" fontSize={9} fill="var(--caos-muted)" transform={`rotate(-90 13 ${padT + plotH / 2})`} className="uppercase tracking-wider">3Y DM (bp)</text>
      {/* baseline carries the active-sector color — the one place the sector hue does real work */}
      <line x1={padL} y1={padT + plotH} x2={W - padR} y2={padT + plotH} stroke={color} strokeWidth={1.5} strokeOpacity={0.6} />

      {/* Continuous scatter (Size / Price): linear x-axis + vertical gridlines, labels, title, plain coloured points */}
      {!cat && [0, 0.25, 0.5, 0.75, 1].map((f, i) => {
        const xv = xLo + (xHi - xLo) * f;
        const gx = scaleX(xv);
        return (
          <g key={`gx${i}`}>
            <line x1={gx} y1={padT} x2={gx} y2={padT + plotH} stroke="var(--caos-border)" strokeWidth={1} strokeOpacity={0.15} strokeDasharray="3 3" />
            <text x={gx} y={H - 14} textAnchor="middle" fontSize={9} fill="var(--caos-muted)" className="tabular">{xMeasure === "price" ? xv.toFixed(1) : Math.round(xv)}</text>
          </g>
        );
      })}
      {!cat && (
        <text x={padL + plotW / 2} y={H - 2} textAnchor="middle" fontSize={9} fill="var(--caos-muted)" className="uppercase tracking-wider">{X_LABEL[xMeasure]}</text>
      )}
      {!cat && rows.map((r) => {
        const isSel = selected === r.figi, isHov = hovered === r.figi;
        return (
          <Point
            key={loanKey(r)}
            cx={scaleX(continuousValue(r, xMeasure))}
            cy={scaleY(r.dm)}
            fill={RV_STYLE[r.rv].fg}
            isSel={isSel}
            isHov={isHov}
            label={`Position ${r.company}, rating ${r.rating}, discount margin ${r.dm} basis points, ${r.rv}`}
            title={`${r.company} · DM ${r.dm} · ${X_LABEL[xMeasure]} ${xMeasure === "price" ? continuousValue(r, xMeasure).toFixed(2) : Math.round(continuousValue(r, xMeasure))} · ${r.rv}`}
            onSelect={() => onSelect(r.figi)}
            onHover={(on) => onHover(on ? r.figi : null)}
            roving={roving.getItemProps(r.figi)}
          />
        );
      })}

      {/* Categorical modes: Scatter (banded points + median tick) / Bar (avg DM) / Box (whisker + IQR + median) */}
      {cat && cats.map((c, i) => {
        const members = rows.filter((r) => categoryOf(r, xMeasure) === c);
        const cx = bandX(i);
        const label = c.length > 9 ? c.slice(0, 8) + "…" : c;

        if (chartType === "bar") {
          const avg = mean(members.map((r) => r.dm));
          return (
            <g key={c}>
              {avg !== null && (() => {
                const bw = Math.min(bandW * 0.5, 44);
                const y0 = scaleY(avg), y1 = padT + plotH;
                return (
                  <>
                    <rect x={cx - bw / 2} y={y0} width={bw} height={Math.max(0, y1 - y0)} fill="var(--caos-accent)" fillOpacity={0.55} rx={1.5}>
                      <title>{`${c} · avg 3Y DM ${Math.round(avg)}bp · n=${members.length}`}</title>
                    </rect>
                    <text x={cx} y={y0 - 3} textAnchor="middle" fontSize={9} fill="var(--caos-muted)" className="tabular">{Math.round(avg)}</text>
                  </>
                );
              })()}
              <text x={cx} y={H - 8} textAnchor="middle" fontSize={9} fill="var(--caos-muted)" className="tabular">{label}</text>
            </g>
          );
        }

        if (chartType === "box") {
          const v = members.map((r) => r.dm).sort((a, b) => a - b);
          const bw = Math.min(bandW * 0.42, 40);
          return (
            <g key={c}>
              {v.length > 0 && (() => {
                const mn = v[0], mx = v[v.length - 1];
                const q1 = percentileSorted(v, 0.25), q3 = percentileSorted(v, 0.75), md = percentileSorted(v, 0.5);
                const yMn = scaleY(mn), yMx = scaleY(mx), yQ1 = scaleY(q1), yQ3 = scaleY(q3), yMd = scaleY(md);
                return (
                  <>
                    <title>{`${c} · DM min ${Math.round(mn)} / med ${Math.round(md)} / max ${Math.round(mx)}bp · n=${members.length}`}</title>
                    {/* min→max whisker */}
                    <line x1={cx} y1={yMx} x2={cx} y2={yMn} stroke="var(--caos-muted)" strokeWidth={1.2} strokeOpacity={0.7} />
                    <line x1={cx - bw * 0.3} y1={yMx} x2={cx + bw * 0.3} y2={yMx} stroke="var(--caos-muted)" strokeWidth={1.2} />
                    <line x1={cx - bw * 0.3} y1={yMn} x2={cx + bw * 0.3} y2={yMn} stroke="var(--caos-muted)" strokeWidth={1.2} />
                    {/* IQR box */}
                    <rect x={cx - bw / 2} y={yQ3} width={bw} height={Math.max(1, yQ1 - yQ3)} fill="var(--caos-accent)" fillOpacity={0.16} stroke="var(--caos-accent)" strokeWidth={1.2} rx={1.5} />
                    {/* median tick */}
                    <line x1={cx - bw / 2} y1={yMd} x2={cx + bw / 2} y2={yMd} stroke="var(--caos-text)" strokeWidth={2} strokeOpacity={0.85} />
                  </>
                );
              })()}
              <text x={cx} y={H - 8} textAnchor="middle" fontSize={9} fill="var(--caos-muted)" className="tabular">{label}</text>
            </g>
          );
        }

        // Categorical scatter (default). For Rating this is byte-for-byte the
        // original behavior; Sub-sector reuses the same banded geometry.
        const med = bucketMedian(members.map((r) => r.dm));
        const m = members.length;
        return (
          <g key={c}>
            {med !== null && (
              <line x1={cx - bandW * 0.36} y1={scaleY(med)} x2={cx + bandW * 0.36} y2={scaleY(med)} stroke="var(--caos-muted)" strokeWidth={1.5} strokeDasharray="4 3" strokeOpacity={0.75}>
                <title>{`${c} · median 3Y DM ${Math.round(med)}bp`}</title>
              </line>
            )}
            {members.map((r, j) => {
              const off = m > 1 ? (j / (m - 1) - 0.5) * bandW * 0.62 : 0;
              const px = cx + off;
              const isSel = selected === r.figi, isHov = hovered === r.figi;
              // Prototype design: a coloured stem from the bucket median to each
              // point makes the cheap/rich magnitude read at a glance — green
              // above the median (wide/cheap), red below (tight/rich). Vertical
              // length encodes rvBp; hue doubles the signal for colourblind users.
              const cheap = med === null ? true : r.dm >= med;
              return (
                <g key={loanKey(r)}>
                  {med !== null && (
                    <line
                      x1={px} y1={scaleY(med)} x2={px} y2={scaleY(r.dm)}
                      stroke={cheap ? "var(--caos-success-bright)" : "var(--caos-critical-bright)"}
                      strokeWidth={isSel || isHov ? 2.4 : 1.8}
                      strokeOpacity={isSel || isHov ? 0.9 : 0.5}
                    />
                  )}
                  <Point
                    cx={px}
                    cy={scaleY(r.dm)}
                    fill={RV_STYLE[r.rv].fg}
                    isSel={isSel}
                    isHov={isHov}
                    label={`Position ${r.company}, rating ${r.rating}, discount margin ${r.dm} basis points, ${r.rv}`}
                    title={`${r.company} · DM ${r.dm} · ${r.rv}${r.rvBp === null ? "" : ` ${r.rvBp > 0 ? "+" : ""}${Math.round(r.rvBp)}bp`}`}
                    onSelect={() => onSelect(r.figi)}
                    onHover={(on) => onHover(on ? r.figi : null)}
                    roving={roving.getItemProps(r.figi)}
                  />
                </g>
              );
            })}
            <text x={cx} y={H - 8} textAnchor="middle" fontSize={9} fill="var(--caos-muted)" className="tabular">{label}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Sector read panel — deterministic summary lines (see sectorRead). ──
function SectorReadPanel({ lines }: { lines: SectorReadLine[] }) {
  return (
    <div className="px-3 py-2.5 text-caos-xs leading-relaxed text-caos-text space-y-1.5">
      {lines.map((l, i) => (
        <p key={i} className="m-0">
          {l.text}
          {l.metric && (
            <>
              {" "}
              <span className="tabular text-caos-accent">{l.metric}</span>
            </>
          )}
        </p>
      ))}
    </div>
  );
}

// One "pick" row in Top of book — cheap (add) or rich (fade). rvBp sign is
// explicit and the tone label is spelled out so direction never rides on colour
// alone. Clicking a pick selects the loan (same lift as the chart/table).
function PickRow({
  pick, tone, selected, hovered, onSelect, onHover,
}: {
  pick: Pick;
  tone: "add" | "fade";
  selected: string | null;
  hovered: string | null;
  onSelect: (figi: string) => void;
  onHover: (figi: string | null) => void;
}) {
  const isSel = selected === pick.figi;
  const isHov = hovered === pick.figi;
  const color = tone === "add" ? RV_STYLE.Cheap.fg : RV_STYLE.Rich.fg;
  const sign = pick.rvBp > 0 ? "+" : "";
  return (
    <button
      type="button"
      aria-pressed={isSel}
      onClick={() => onSelect(pick.figi)}
      onMouseEnter={() => onHover(pick.figi)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(pick.figi)}
      onBlur={() => onHover(null)}
      className={
        "w-full flex items-baseline gap-2 rounded px-1.5 py-1 text-left transition-caos focus-ring " +
        (isSel
          ? "bg-caos-elevated ring-1 ring-caos-accent/60"
          : isHov
            ? "bg-caos-elevated/60"
            : "hover:bg-caos-elevated/50")
      }
    >
      <span className="tabular text-caos-2xs whitespace-nowrap" style={{ color }}>
        {sign}{Math.round(pick.rvBp)}
      </span>
      <span className="text-caos-xs text-caos-text truncate min-w-0 flex-1">{pick.company}</span>
      {pick.held && (
        <span className="tabular text-[9px] uppercase font-bold text-caos-success border border-caos-success/30 bg-caos-success/5 px-1 rounded-sm">
          held {pick.headroomPct !== undefined ? `+${pick.headroomPct}%` : ""}
        </span>
      )}
      <span className="tabular text-caos-2xs text-caos-muted whitespace-nowrap">
        {pick.rating} · {pick.subSector}
      </span>
    </button>
  );
}

// Top of book — cheapest (add) / richest (fade) computed from the filtered rows.
function TopOfBookPanel({
  book, selected, hovered, onSelect, onHover,
}: {
  book: TopOfBook;
  selected: string | null;
  hovered: string | null;
  onSelect: (figi: string) => void;
  onHover: (figi: string | null) => void;
}) {
  const empty = !book.cheap.length && !book.rich.length;
  return (
    <div className="px-2 py-2 space-y-2">
      {empty && (
        <p className="m-0 px-1.5 text-caos-xs text-caos-muted">
          No benchmarked loans in scope — no actionable tail. <span aria-hidden="true">—</span>
        </p>
      )}
      {book.cheap.length > 0 && (
        <div>
          <div className="px-1.5 pb-1 tabular text-caos-2xs uppercase tracking-widest" style={{ color: RV_STYLE.Cheap.fg }}>
            Cheap · add
          </div>
          <div className="space-y-0.5">
            {book.cheap.map((p) => (
              <PickRow key={p.figi} pick={p} tone="add" selected={selected} hovered={hovered} onSelect={onSelect} onHover={onHover} />
            ))}
          </div>
        </div>
      )}
      {book.rich.length > 0 && (
        <div>
          <div className="px-1.5 pb-1 tabular text-caos-2xs uppercase tracking-widest" style={{ color: RV_STYLE.Rich.fg }}>
            Rich · fade
          </div>
          <div className="space-y-0.5">
            {book.rich.map((p) => (
              <PickRow key={p.figi} pick={p} tone="fade" selected={selected} hovered={hovered} onSelect={onSelect} onHover={onHover} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Focus readout under the chart — the selected loan's company/rating/DM/rvBp,
// pulled straight off the real row. A hint line when nothing is selected.
function FocusReadout({ row, onClear }: { row: RVRow | null; onClear: () => void }) {
  if (!row) {
    return (
      <div className="flex items-center h-8 px-3 border-t border-caos-border text-caos-2xs text-caos-muted">
        Click a point or a peer-table row — selection links both ways · Esc clears.
      </div>
    );
  }
  const sign = row.rvBp !== null && row.rvBp > 0 ? "+" : "";
  const K = ({ children }: { children: React.ReactNode }) => (
    <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">{children}</span>
  );
  const invalidation = invalidationTrigger(row.rvBp, row.rvProvenance?.n ?? 0);
  const openAsk = () => window.dispatchEvent(new Event("caos:ask-toggle"));
  return (
    <div className="flex items-center gap-x-4 gap-y-1 flex-wrap h-auto min-h-8 px-3 py-1.5 border-t border-caos-border">
      <span className="text-caos-xs text-caos-text font-medium">{row.company}</span>
      <span className="flex items-baseline gap-1"><K>Rating</K><span className="tabular text-caos-xs text-caos-text">{row.rating}</span></span>
      <span className="flex items-baseline gap-1"><K>3Y DM</K><span className="tabular text-caos-xs text-caos-text">{row.dm.toLocaleString()}bp</span></span>
      <span className="flex items-baseline gap-1">
        <K>RV vs bucket</K>
        <span className="tabular text-caos-xs" style={{ color: RV_STYLE[row.rv].fg }}>
          {row.rvBp === null ? "—" : `${sign}${Math.round(row.rvBp)}bp`} · {row.rv}
        </span>
      </span>
      <span className="flex items-baseline gap-1">
        <K>Carry RV (bp/yr)</K>
        <span className="tabular text-caos-xs text-caos-text">
          {row.carryRv !== null ? `${row.carryRv > 0 ? "+" : ""}${row.carryRv.toFixed(1)}` : "—"}
        </span>
      </span>
      <span className="flex items-baseline gap-1">
        <K>Portfolio</K>
        <span className="tabular text-caos-xs" style={{ color: row.portfolioRv.held ? "var(--caos-success)" : "var(--caos-muted)" }}>
          {row.portfolioRv.held ? "Held" : "Not Held"}
        </span>
      </span>
      <span className="flex items-baseline gap-1">
        <K>Invalidation</K>
        <span className="tabular text-caos-xs text-caos-warning" title="CP-6E Monitoring Trigger">
          {invalidation}
        </span>
      </span>
      <IssuerLink
        query={row.company}
        title={`Open ${row.company} profile`}
        className="tabular text-caos-2xs text-caos-accent hover:text-caos-text border border-caos-border hover:border-caos-accent/60 rounded px-2 py-0.5 transition-caos focus-ring"
      >
        Profile
      </IssuerLink>
      <Link
        href={`/deepdive?issuer=${encodeURIComponent(row.company)}&mod=CP-6A`}
        className="tabular text-caos-2xs text-caos-muted hover:text-caos-text border border-caos-border hover:border-caos-accent/60 rounded px-2 py-0.5 transition-caos focus-ring no-underline"
        title={`Open ${row.company} in Deep-Dive`}
      >
        Deep-Dive
      </Link>
      <button
        type="button"
        onClick={openAsk}
        aria-label={`Ask about selected RV for ${row.company}`}
        className="tabular text-caos-2xs text-caos-accent hover:text-caos-bg border border-caos-accent/60 hover:bg-caos-accent rounded px-2 py-0.5 transition-caos focus-ring"
      >
        Ask RV
      </button>
      <button
        type="button"
        onClick={onClear}
        className="ml-auto tabular text-caos-2xs text-caos-muted hover:text-caos-text border border-caos-border rounded px-2 py-0.5 transition-caos focus-ring"
      >
        Clear
      </button>
    </div>
  );
}

export function SectorRV({ holdings }: { holdings?: Map<string, RVHolding> } = {}) {
  const rvRows = useMemo(() => (holdings ? buildRVRows(holdings) : SEED_ROWS), [holdings]);
  const rvSectors = useMemo(() => (holdings ? buildRVSectors(rvRows) : SEED_RV_SECTORS), [holdings, rvRows]);
  const indexStats = useMemo(() => (holdings ? buildIndexStats(rvSectors) : SEED_INDEX_STATS), [holdings, rvSectors]);

  const [chartRef, dimensions] = useResizeObserver<HTMLDivElement>();
  const [active, setActive] = useState(0);
  useEffect(() => {
    if (active >= rvSectors.length) setActive(0);
  }, [active, rvSectors.length]);
  const sector = rvSectors[active] ?? rvSectors[0]!;
  const averages = useMemo(() => ratingAverages(sector.rows), [sector]);
  const subSectorAvgs = useMemo(() => subSectorAverages(sector.rows), [sector]);

  const [colPreset, setColPreset] = useState<"full" | "market" | "rv">("rv");

  // Bottom averages stats tab control
  const [statsTab, setStatsTab] = useState<"ratings" | "subsectors" | "indexes">("ratings");

  // Chart controls: Y is always 3Y DM; X and chart-type are analyst-chosen.
  const [xMeasure, setXMeasure] = useState<XMeasure>("rating");
  const [chartType, setChartType] = useState<ChartType>("scatter");

  // Prevent illegal continuous chart type configurations
  useEffect(() => {
    if ((xMeasure === "size" || xMeasure === "price") && chartType !== "scatter") {
      setChartType("scatter");
    }
  }, [xMeasure, chartType]);

  // Column filters live HERE (lifted out of PeerTable) so the RV distribution
  // chart renders from the SAME filtered set as the table. Sector selection is
  // already applied upstream (sector.rows); column filters compose on top.
  const [filters, setFilters] = useState<FilterState>({});
  const filtered = useColumnFilters(sector.rows, filters, PEER_FILTER_VAL);
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

  // Bar/Box need a categorical X; on a continuous X they are disabled.

  // Cross-pane selection lifted here: a clicked scatter point, Top-of-book pick,
  // or peer-table row selects one loan (by figi); hover mirrors softly. Toggling
  // the same figi deselects. RVScatter enlarges + rings the selected point;
  // PeerTable tints + scrolls its row into view.
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const handleSelect = (figi: string) => setSelected((cur) => (cur === figi ? null : figi));

  // A selection is only meaningful within the active sector's rows; switching
  // sector (or column-filtering the selected loan out) clears it so no stale
  // highlight or focus readout survives. Read the row from the sector universe so
  // a filtered-out-but-selected loan still resolves for the readout until cleared.
  useEffect(() => {
    if (selected && !sector.rows.some((r) => r.figi === selected)) setSelected(null);
  }, [sector, selected]);
  const selectedRow = selected ? sector.rows.find((r) => r.figi === selected) ?? null : null;

  // Deterministic top-half reads, computed from the SAME filtered set the chart
  // and peer table render (sector rows + column filters). No LLM, no fabrication.
  const book = useMemo(() => topOfBook(filtered), [filtered]);
  const readLines = useMemo(() => sectorRead(filtered, sector.name), [filtered, sector.name]);

  const { sort: sortIdx, handleSort: handleSortIdx } = useSortState();
  const sortedIdx = useSort(indexStats, sortIdx, (r, c) => {
    if (c.startsWith("d")) return r.d[parseInt(c.substring(1))];
    return field(r, c);
  });

  const { sort: sortSub, handleSort: handleSortSub } = useSortState();
  const sortedSub = useSort(subSectorAvgs, sortSub, (r, c) => {
    if (c.startsWith("d")) return r.d[parseInt(c.substring(1))];
    return field(r, c);
  });

  const { sort: sortAvg, handleSort: handleSortAvg } = useSortState();
  const sortedAvg = useSort(averages, sortAvg, (r, c) => {
    if (c.startsWith("d")) return r.d[parseInt(c.substring(1))];
    return field(r, c);
  });

  return (
    <div
      className="@container flex flex-col gap-3 min-w-0"
      onKeyDown={(e) => {
        if (e.key === "Escape" && selected) setSelected(null);
      }}
    >
      <CaveatHeader rows={rvRows} />

      {/* Decision-first opener (WP-6): ranked |RV| + carry dislocations across
          the whole loan universe, ahead of the sector-scoped scatter/toolbar/
          heatmap/averages below — those are demoted, not deleted. */}
      <PanelShell title="Actionable Dislocations" className="flex-none min-h-0" collapsible>
        <ActionableDislocations rows={rvRows} />
      </PanelShell>

      {/* sector selector */}
      <div className="h-9 shrink-0 rounded border border-caos-border bg-caos-panel/60 px-3 flex items-center gap-2 overflow-x-auto whitespace-nowrap">
        <label htmlFor="sector-rv-select" className="tabular text-caos-2xs uppercase tracking-widest text-caos-muted whitespace-nowrap">
          Sector tables
        </label>
        <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: sector.color }} aria-hidden="true" />
        <select
          id="sector-rv-select"
          value={active}
          onChange={(e) => setActive(Number(e.target.value))}
          className="focus-ring h-7 min-w-[220px] rounded border border-caos-border bg-caos-elevated px-2.5 tabular text-caos-xs text-caos-text outline-none transition-caos hover:border-caos-accent/60 cursor-pointer"
        >
          {rvSectors.map((s, i) => (
            <option key={s.name} value={i}>{s.name}</option>
          ))}
        </select>
        <span className="flex-1" />
        {/* X measure — what the RV distribution plots along the horizontal axis */}
        <div className="flex items-center gap-1" role="group" aria-label="Chart X measure">
          <span className="shrink-0 tabular text-caos-2xs uppercase tracking-widest text-caos-muted mr-1">X</span>
          {([
            ["Rating", "rating"],
            ["Sub-sector", "subSector"],
            ["Size", "size"],
            ["Price", "price"],
          ] as const).map(([label, x]) => (
            <button
              key={x}
              type="button"
              aria-pressed={xMeasure === x}
              onClick={() => {
                setXMeasure(x);
                if ((x === "size" || x === "price") && chartType !== "scatter") setChartType("scatter");
              }}
              className={
                "shrink-0 tabular text-caos-2xs h-7 px-2.5 rounded border transition-caos focus-ring cursor-pointer flex items-center justify-center " +
                (xMeasure === x
                  ? "border-caos-accent text-caos-text bg-caos-elevated"
                  : "border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60")
              }
            >
              {label}
            </button>
          ))}
        </div>
        <span className="w-px h-4 bg-caos-border/60 shrink-0" aria-hidden="true" />
        {/* Chart type — scatter / bar (avg) / box (distribution) */}
        <div className="flex items-center gap-1" role="group" aria-label="Chart type">
          <span className="shrink-0 tabular text-caos-2xs uppercase tracking-widest text-caos-muted mr-1">Chart</span>
          {([
            ["Scatter", "scatter"],
            ["Bar", "bar"],
            ["Box", "box"],
          ] as const).map(([label, ct]) => {
            const disabled = ct !== "scatter" && (xMeasure === "size" || xMeasure === "price");
            return (
              <button
                key={ct}
                type="button"
                aria-pressed={chartType === ct}
                disabled={disabled}
                onClick={() => { if (!disabled) setChartType(ct); }}
                className={
                  "shrink-0 tabular text-caos-2xs h-7 px-2.5 rounded border transition-caos focus-ring flex items-center justify-center " +
                  (chartType === ct
                    ? "border-caos-accent text-caos-text bg-caos-elevated"
                    : disabled
                      ? "border-caos-border/30 text-caos-muted/40 cursor-not-allowed"
                      : "border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 cursor-pointer")
                }
              >
                {label}
              </button>
            );
          })}
        </div>
        <span className="w-px h-4 bg-caos-border/60 shrink-0" aria-hidden="true" />
        <div className="flex items-center gap-1" role="group" aria-label="Loans table lens">
          <span className="shrink-0 tabular text-caos-2xs uppercase tracking-widest text-caos-muted mr-1">Table</span>
          {([
            ["Full", "full"],
            ["Market", "market"],
            ["RV", "rv"],
          ] as const).map(([label, preset]) => (
            <button
              key={preset}
              type="button"
              aria-pressed={colPreset === preset}
              onClick={() => setColPreset(preset)}
              className={
                "shrink-0 tabular text-caos-2xs h-7 px-2.5 rounded border transition-caos focus-ring cursor-pointer flex items-center justify-center " +
                (colPreset === preset
                  ? "border-caos-accent text-caos-text bg-caos-elevated"
                  : "border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60")
              }
            >
              {label}
            </button>
          ))}
        </div>
        {Object.keys(filters).length > 0 && (
          <>
            <span className="w-px h-4 bg-caos-border/60 shrink-0" aria-hidden="true" />
            <button
              type="button"
              onClick={() => setFilters({})}
              aria-label={`Clear ${Object.keys(filters).length} column filter(s)`}
              className="shrink-0 tabular text-caos-2xs h-7 px-2.5 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos focus-ring cursor-pointer flex items-center justify-center"
            >
              Clear filters ({Object.keys(filters).length})
            </button>
          </>
        )}
        <span className="tabular text-caos-xs text-caos-muted whitespace-nowrap hidden xl:inline">
          {sector.rows.length} in file
        </span>
      </div>

      <RvLegend />

      {/* TOP HALF — the spatial "relative" the tables only imply, given the
          dominant width, flanked by two deterministic reads over the SAME
          filtered universe. Big scatter (left) · Sector read + Top of book
          stacked (right). All three render from `filtered` (sector rows + the
          peer table's column filters) so the whole surface stays one universe. */}
      <div className="shrink-0 grid grid-cols-1 @[60rem]:grid-cols-[1.6fr_1fr] gap-3 items-stretch">
        <PanelShell
          title={sector.name + " — RV Distribution"}
          className="min-h-[360px]"
          right={
            <span className="tabular text-caos-xs text-caos-muted">
              {chartType === "bar"
                ? `avg 3Y DM by ${X_LABEL[xMeasure].toLowerCase()}`
                : chartType === "box"
                  ? `3Y DM spread by ${X_LABEL[xMeasure].toLowerCase()} · box = IQR`
                  : xMeasure === "rating" || xMeasure === "subSector"
                    ? `3Y DM by ${X_LABEL[xMeasure].toLowerCase()} · tick = median · above = wide / cheap`
                    : `3Y DM vs ${X_LABEL[xMeasure].toLowerCase()}`}
            </span>
          }
        >
          {/* Chart body grows; the focus readout is a fixed strip at the bottom. */}
          <div className="flex flex-col h-full min-h-0">
            <div ref={chartRef} className="flex-1 min-h-[300px] w-full px-2 py-1">
              {filtered.length === 0 ? (
                // All rows filtered out — the SVG would render blank, so say so
                // and point at the exit (matches Sector read / Top-of-book copy).
                <div className="h-full min-h-[240px] flex flex-col items-center justify-center gap-2 text-center">
                  <span style={{ color: "var(--caos-muted)" }} aria-hidden="true">
                    <StatusGlyph kind="idle" size={16} />
                  </span>
                  <p className="tabular text-caos-sm text-caos-muted m-0 max-w-[320px] leading-relaxed">
                    No loans match the current column filters — clear a filter to plot the sector distribution.
                  </p>
                </div>
              ) : dimensions.width > 0 ? (
                <RVScatter
                  rows={filtered}
                  color={sector.color}
                  xMeasure={xMeasure}
                  chartType={chartType}
                  selected={selected}
                  hovered={hovered}
                  onSelect={handleSelect}
                  onHover={setHovered}
                  width={dimensions.width}
                  height={dimensions.height}
                />
              ) : null}
            </div>
            {/* Focus readout — selected loan's real fields, or a linking hint. In
                the aggregate (bar/box) views there is no per-loan point, so note
                that selection lives in the scatter/table. */}
            {chartType !== "scatter" && !selectedRow ? (
              <div className="flex items-center h-8 px-3 border-t border-caos-border text-caos-2xs text-caos-muted">
                Point selection is available in the Scatter view and the peer table.
              </div>
            ) : (
              <FocusReadout row={selectedRow} onClear={() => setSelected(null)} />
            )}
          </div>
        </PanelShell>

        {/* right column — Sector read over Top of book, both stacked and stretched */}
        <div data-testid="sector-rv-right-rail" className="grid grid-rows-2 gap-2 min-h-0 max-h-[360px] overflow-hidden">
          <PanelShell
            title="Sector read"
            className="min-h-0"
            right={<span className="tabular text-caos-2xs uppercase tracking-widest text-caos-muted">{filtered.length !== sector.rows.length ? `computed · ${filtered.length} of ${sector.rows.length} shown` : `computed · ${filtered.length} loans`}</span>}
          >
            <SectorReadPanel lines={readLines} />
          </PanelShell>
          <PanelShell
            title="Top of book"
            className="min-h-0"
            right={<span className="tabular text-caos-2xs uppercase tracking-widest text-caos-muted">by RV vs bucket</span>}
          >
            <TopOfBookPanel
              book={book}
              selected={selected}
              hovered={hovered}
              onSelect={handleSelect}
              onHover={setHovered}
            />
          </PanelShell>
        </div>
      </div>

      {/* peer table */}
      <PanelShell
        title={sector.name + " — Sector Peers · Relative Value"}
        className="min-h-[400px] h-[400px] flex-none"
        right={
          <span className="tabular text-caos-xs text-caos-muted">
            RV = 3Y DM − sector×rating median (n ≥ 2) · sorted |rvBp| ↓
          </span>
        }
      >
        <div className="overflow-auto h-full">
          <PeerTable
            rows={sector.rows}
            filtered={filtered}
            preset={colPreset}
            filters={filters}
            onFilter={setFilter}
            selected={selected}
            hovered={hovered}
            onSelect={handleSelect}
            onHover={setHovered}
          />
        </div>
      </PanelShell>

      {/* cross-sector relative value heatmap */}
      <CrossSectorHeatmap rowsList={rvRows} filtersActive={Object.keys(filters).length > 0} filterCount={Object.keys(filters).length} />

      {/* consolidated statistics tabbed panel */}
      <PanelShell
        title="Sector Averages & Index Summary"
        className="min-h-[280px] h-[280px] flex-none"
        right={
          <div className="flex items-center gap-3">
            <span className="tabular text-caos-xs text-caos-muted">
              {statsTab === "indexes" ? "derived from file sectors" : `${sector.name} · peer set`}
            </span>
            <div className="flex items-center gap-1" role="group" aria-label="Statistics view type">
              {([
                ["Ratings", "ratings"],
                ["Sub-Sectors", "subsectors"],
                ["Indexes", "indexes"],
              ] as const).map(([label, tab]) => (
                <button
                  key={tab}
                  type="button"
                  aria-pressed={statsTab === tab}
                  onClick={() => setStatsTab(tab)}
                  className={
                    "shrink-0 tabular text-caos-2xs px-1.5 py-0.5 rounded border transition-caos focus-ring " +
                    (statsTab === tab
                      ? "border-caos-accent text-caos-text bg-caos-elevated"
                      : "border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60")
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        }
      >
        <div className="overflow-auto h-full">
          {statsTab === "ratings" ? (
            <table aria-label="Sector ratings average" className="border-collapse text-caos-xs w-full min-w-[760px]">
              <thead>
                <tr className="border-b border-caos-border">
                  <SortTh label="Rating" col="bucket" sort={sortAvg} onSort={handleSortAvg} />
                  <SortTh label="Loans" col="n" align="right" sort={sortAvg} onSort={handleSortAvg} />
                  <SortTh label="Avg Size ($Mn)" col="size" align="right" sort={sortAvg} onSort={handleSortAvg} />
                  <SortTh label="Margin" col="margin" align="right" sort={sortAvg} onSort={handleSortAvg} />
                  <SortTh label="Bid" col="bid" align="right" sort={sortAvg} onSort={handleSortAvg} />
                  <SortTh label="Ask" col="ask" align="right" sort={sortAvg} onSort={handleSortAvg} />
                  {DELTA_COLS.map((c, i) => (
                    <SortTh key={c} label={c} col={`d${i}`} align="right" sort={sortAvg} onSort={handleSortAvg} />
                  ))}
                  <SortTh label="Mid YTM" col="ytm" align="right" sort={sortAvg} onSort={handleSortAvg} />
                  <SortTh label="Mid 3Y DM" col="dm" align="right" sort={sortAvg} onSort={handleSortAvg} />
                </tr>
              </thead>
              <tbody>
                {sortedAvg.map((b) => (
                  <tr key={b.bucket} className="border-b border-caos-border/40">
                    <td className={td + " text-caos-text"}>{b.bucket}</td>
                    <td className={td + " text-right " + (b.n ? "text-caos-text" : "text-caos-muted")}>
                      {b.n.toLocaleString()}
                    </td>
                    <td className={td + " text-right " + (b.n ? "text-caos-text" : "text-caos-muted")}>
                      {b.size === null ? "—" : Math.round(b.size).toLocaleString()}
                    </td>
                    <td className={td + " text-right " + (b.n ? "text-caos-text" : "text-caos-muted")}>
                      {b.margin === null ? "—" : Math.round(b.margin)}
                    </td>
                    <td className={td + " text-right text-caos-text"}>{fmt(b.bid)}</td>
                    <td className={td + " text-right text-caos-text"}>{fmt(b.ask)}</td>
                    {b.d.map((v, j) => (
                      <DeltaCell key={DELTA_COLS[j]} v={v} colLabel={DELTA_COLS[j]} />
                    ))}
                    <td className={td + " text-right text-caos-text"}>{fmt(b.ytm, 1)}</td>
                    <td className={td + " text-right text-caos-text"}>{b.dm === null ? "—" : Math.round(b.dm).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : statsTab === "subsectors" ? (
            <table aria-label="Sub-sector market average" className="border-collapse text-caos-xs w-full min-w-[760px]">
              <thead>
                <tr className="border-b border-caos-border">
                  <SortTh label="Sub-Sector" col="subSector" sort={sortSub} onSort={handleSortSub} />
                  <SortTh label="Loans" col="n" align="right" sort={sortSub} onSort={handleSortSub} />
                  <SortTh label="Avg Size ($Mn)" col="size" align="right" sort={sortSub} onSort={handleSortSub} />
                  <SortTh label="Margin" col="margin" align="right" sort={sortSub} onSort={handleSortSub} />
                  <SortTh label="Bid" col="bid" align="right" sort={sortSub} onSort={handleSortSub} />
                  <SortTh label="Ask" col="ask" align="right" sort={sortSub} onSort={handleSortSub} />
                  {DELTA_COLS.map((c, i) => (
                    <SortTh key={c} label={c} col={`d${i}`} align="right" sort={sortSub} onSort={handleSortSub} />
                  ))}
                  <SortTh label="Mid YTM" col="ytm" align="right" sort={sortSub} onSort={handleSortSub} />
                  <SortTh label="Mid 3Y DM" col="dm" align="right" sort={sortSub} onSort={handleSortSub} />
                </tr>
              </thead>
              <tbody>
                {sortedSub.map((b) => (
                  <tr key={b.subSector} className="border-b border-caos-border/40">
                    <td className={td + " text-caos-text max-w-[260px] truncate"}>{b.subSector}</td>
                    <td className={td + " text-right text-caos-text"}>{b.n.toLocaleString()}</td>
                    <td className={td + " text-right text-caos-text"}>{b.size === null ? "—" : Math.round(b.size).toLocaleString()}</td>
                    <td className={td + " text-right text-caos-text"}>{b.margin === null ? "—" : Math.round(b.margin)}</td>
                    <td className={td + " text-right text-caos-text"}>{fmt(b.bid)}</td>
                    <td className={td + " text-right text-caos-text"}>{fmt(b.ask)}</td>
                    {b.d.map((v, j) => (
                      <DeltaCell key={DELTA_COLS[j]} v={v} colLabel={DELTA_COLS[j]} />
                    ))}
                    <td className={td + " text-right text-caos-text"}>{fmt(b.ytm, 1)}</td>
                    <td className={td + " text-right text-caos-text"}>{b.dm === null ? "—" : Math.round(b.dm).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table aria-label="Index statistics" className="border-collapse text-caos-xs w-full min-w-[760px]">
              <thead>
                <tr className="border-b border-caos-border">
                  <SortTh label="Index" col="name" sort={sortIdx} onSort={handleSortIdx} />
                  <SortTh label="Loans" col="n" align="right" sort={sortIdx} onSort={handleSortIdx} />
                  <SortTh label="MV ($Bn)" col="mv" align="right" sort={sortIdx} onSort={handleSortIdx} />
                  <SortTh label="Avg Price" col="avgPrice" align="right" sort={sortIdx} onSort={handleSortIdx} />
                  {DELTA_COLS.map((c, i) => (
                    <SortTh key={c} label={c} col={`d${i}`} align="right" sort={sortIdx} onSort={handleSortIdx} />
                  ))}
                  <SortTh label="YTM" col="ytm" align="right" sort={sortIdx} onSort={handleSortIdx} />
                  <SortTh label="3Y DM" col="dm" align="right" sort={sortIdx} onSort={handleSortIdx} />
                </tr>
              </thead>
              <tbody>
                {sortedIdx.map((s) => (
                  <tr key={s.name} className="border-b border-caos-border/40">
                    <td className={td + " text-caos-text"}>{s.name}</td>
                    <td className={td + " text-right text-caos-text"}>{s.n.toLocaleString()}</td>
                    <td className={td + " text-right text-caos-text"}>{s.mv.toLocaleString()}</td>
                    <td className={td + " text-right text-caos-text"}>{s.avgPrice.toFixed(2)}</td>
                    {s.d.map((v, j) => (
                      <DeltaCell key={DELTA_COLS[j]} v={v} colLabel={DELTA_COLS[j]} />
                    ))}
                    <td className={td + " text-right text-caos-text"}>{s.ytm.toFixed(1)}</td>
                    <td className={td + " text-right text-caos-text"}>{s.dm.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </PanelShell>
    </div>
  );
}
