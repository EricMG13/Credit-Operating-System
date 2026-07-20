"use client";

// Concept A — Sector RV: sector-peer relative value tables in the desk-sheet
// format (issuer + loan data, spread-implied liquidity, mid RV assessment,
// price deltas), with US Leveraged Loan index statistics and per-rating
// averages. Sector dropdown switches between sector tables.

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useResizeObserver } from "@/lib/use-resize-observer";
import { useRovingFocus, type RovingItemProps } from "@/lib/useRovingFocus";
import { Panel as PanelShell } from "@/components/shared/Panel";
import { IssuerLink } from "@/components/shared/IssuerLink";
import { StatusGlyph } from "@/components/shared/StatusGlyph";
import { FilterHeader, updateColumnFilter, useColumnFilters, type FilterState } from "@/components/shared/TableColumnFilter";
import { ActionableDislocations } from "@/components/command/ActionableDislocations";
import { ActionReason } from "@/components/shared/ActionReason";
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
  Impaired: { bg: "color-mix(in srgb, var(--tranche-eq) 14%, transparent)", fg: "var(--caos-muted)" },
};

const RV_STYLE: Record<RVSignal, { bg: string; fg: string }> = {
  Cheap: { bg: "color-mix(in srgb, var(--caos-success) 20%, transparent)", fg: "var(--caos-success-bright)" },
  Wide: { bg: "color-mix(in srgb, var(--caos-success) 9%, transparent)", fg: "var(--caos-success-bright)" },
  Inline: { bg: "color-mix(in srgb, var(--tranche-2l) 12%, transparent)", fg: "var(--caos-accent)" },
  Tight: { bg: "color-mix(in srgb, var(--caos-warning) 14%, transparent)", fg: "var(--caos-warning-bright)" },
  Rich: { bg: "color-mix(in srgb, var(--caos-critical) 16%, transparent)", fg: "var(--caos-critical-bright)" },
  "N/A": { bg: "color-mix(in srgb, var(--tranche-eq) 14%, transparent)", fg: "var(--caos-muted)" },
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
                        {n > 0 && <span className="text-caos-3xs text-caos-muted ml-0.5">({n})</span>}
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

type SortThProps<T> = {
  label: string;
  align?: "left" | "right";
  col: string;
  sort: SortConfig;
  onSort: (c: string) => void;
  rows?: T[];
  getValue?: (row: T) => SortVal;
  filters?: FilterState;
  onFilter?: (col: string, values: string[] | undefined) => void;
};

function SortIndicator({ active, asc }: { active: boolean; asc: boolean }) {
  if (!active) {
    return <span aria-hidden="true" className="text-caos-2xs text-caos-muted opacity-40">↕</span>;
  }
  return <span aria-hidden="true" className="text-caos-md text-caos-accent">{asc ? "↑" : "↓"}</span>;
}

function ColumnFilter<T>({ label, col, rows, getValue, filters, onFilter }: SortThProps<T>) {
  if (!rows || !getValue || !filters || !onFilter) return null;
  return (
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
  );
}

function SortTh<T>({
  label, align = "left", col, sort, onSort, rows, getValue, filters, onFilter,
}: SortThProps<T>) {
  const active = sort.col === col;
  const rightAligned = align === "right";
  return (
    // The clickable sort control is a real <button> (keyboard-operable, visible
    // focus ring); the <th> carries aria-sort so screen readers announce the
    // current sort direction. Previously a bare <th onClick> — mouse-only. (a11y)
    <th
      scope="col"
      aria-sort={active ? (sort.asc ? "ascending" : "descending") : "none"}
      className={`p-0 tabular text-caos-2xs uppercase tracking-wider text-caos-muted whitespace-nowrap sticky top-0 bg-caos-panel select-none ${col === "company" ? "left-0 z-20" : "z-10"} ${rightAligned ? "text-right" : "text-left"}`}
    >
      <span className={`flex w-full items-center gap-1 px-2 py-[6px] ${rightAligned ? "justify-end" : "justify-start"}`}>
        <button
          type="button"
          onClick={() => onSort(col)}
          title={`Sort by ${label}`}
          className={`min-w-0 inline-flex items-center gap-1 hover:text-caos-text transition-caos focus-ring ${rightAligned ? "justify-end" : "justify-start"}`}
        >
          {rightAligned && <SortIndicator active={active} asc={sort.asc} />}
          <span className="truncate">{label}</span>
          {!rightAligned && <SortIndicator active={active} asc={sort.asc} />}
        </button>
        <ColumnFilter label={label} col={col} rows={rows} getValue={getValue} filters={filters} onFilter={onFilter} sort={sort} onSort={onSort} />
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

type PeerPreset = "full" | "market" | "rv";

type PeerColumnSpec = {
  key: string;
  label: string;
  align?: "left" | "right";
  render: ((row: RVRow) => React.ReactNode) | null;
};

const PEER_COLUMNS: PeerColumnSpec[] = [
  { key: "company", label: "Company", render: null },
  { key: "rv", label: "RV comp.", render: (r) => <td className={td}><CompoundRvChip r={r} /></td> },
  { key: "cohort", label: "Cohort RV", align: "right", render: (r) => <td className={td + " text-right tabular text-caos-text"}>{r.rvBp === null ? "—" : (r.rvBp > 0 ? "+" : "") + Math.round(r.rvBp)}</td> },
  { key: "inst", label: "Instrument", render: (r) => <td className={td + " text-caos-muted whitespace-nowrap"}><EvidenceBadge row={r} /></td> },
  { key: "portf", label: "Portf. Held", render: (r) => <td className={td + " text-caos-muted"}>{r.portfolioRv.held ? <span className="text-caos-success-bright">held</span> : "—"}</td> },
  { key: "carryRv", label: "Carry RV (bp/yr)", align: "right", render: (r) => <td className={td + " text-right tabular text-caos-text"}>{r.carryRv === null ? "—" : (r.carryRv > 0 ? "+" : "") + r.carryRv.toFixed(1)}</td> },
  { key: "subSector", label: "Sub-Sector", render: (r) => <td className={td + " text-caos-muted max-w-[260px] truncate"}>{r.subSector}</td> },
  { key: "subGroup", label: "Sub-Group", render: (r) => <td className={td + " text-caos-muted max-w-[260px] truncate"}>{r.subGroup}</td> },
  { key: "loanType", label: "Loan Type", render: (r) => <td className={td + " text-caos-muted"}>{r.loanType}</td> },
  { key: "figi", label: "FIGI", render: (r) => <td className={td + " text-caos-accent"}>{r.figi}</td> },
  { key: "rank", label: "Ranking", render: (r) => <td className={td + " text-caos-muted"}>{r.rank}</td> },
  { key: "rating", label: "Rating", render: (r) => <td className={td + " text-caos-text"}>{r.rating}</td> },
  { key: "size", label: "Size ($Mn)", align: "right", render: (r) => <td className={td + " text-right text-caos-text"}>{r.size.toLocaleString()}</td> },
  { key: "margin", label: "Margin", align: "right", render: (r) => <td className={td + " text-right text-caos-text"}>{r.margin}</td> },
  { key: "maturity", label: "Maturity", align: "right", render: (r) => <td className={td + " text-right text-caos-muted"}>{r.maturity || "—"}</td> },
  { key: "bid", label: "Bid", align: "right", render: (r) => <td className={td + " text-right text-caos-text"}>{r.bid.toFixed(2)}</td> },
  { key: "ask", label: "Ask", align: "right", render: (r) => <td className={td + " text-right text-caos-text"}>{r.ask.toFixed(2)}</td> },
  { key: "liq", label: "Liquidity", render: (r) => <td className={td}><Chip liq={r.liq} label={r.liq} /></td> },
  ...DELTA_COLS.map((label, index) => ({
    key: "d" + index,
    label,
    align: "right" as const,
    render: (r: RVRow) => <DeltaCell v={r.d[index]} colLabel={label} />,
  })),
  { key: "ytm", label: "Mid YTM", align: "right", render: (r) => <td className={td + " text-right text-caos-text"}>{r.ytm.toFixed(1)}</td> },
  { key: "dm", label: "Mid 3Y DM", align: "right", render: (r) => <td className={td + " text-right text-caos-text"}>{r.dm.toLocaleString()}</td> },
];

const PEER_PRESET_COLUMNS: Record<Exclude<PeerPreset, "full">, Set<string>> = {
  market: new Set(["company", "subSector", "size", "margin", "maturity", "bid", "ask", "liq", "ytm", "dm"]),
  rv: new Set(["company", "rating", "liq", "rv", "cohort", "inst", "portf", "carryRv", "d0", "d1", "dm"]),
};

function peerColumns(preset: PeerPreset) {
  if (preset === "full") return PEER_COLUMNS;
  return PEER_COLUMNS.filter((column) => PEER_PRESET_COLUMNS[preset].has(column.key));
}

function peerSortValue(row: RVRow, column: string): SortVal {
  if (column.startsWith("d")) return row.d[parseInt(column.substring(1))];
  if (column === "rv" || column === "cohort") return row.rvBp;
  if (column === "absRv") return Math.abs(row.rvBp ?? 0);
  if (column === "inst") return row.instrumentRv.status;
  if (column === "portf") return row.portfolioRv.held ? 1 : 0;
  if (column === "carryRv") return row.carryRv;
  return field(row, column);
}

function PeerTableHeader({
  columns, rows, sort, onSort, filters, onFilter,
}: {
  columns: PeerColumnSpec[];
  rows: RVRow[];
  sort: SortConfig;
  onSort: (column: string) => void;
  filters: FilterState;
  onFilter: (column: string, values: string[] | undefined) => void;
}) {
  return (
    <thead>
      <tr className="border-b border-caos-border">
        {columns.map((column) => (
          <SortTh
            key={column.key}
            label={column.label}
            col={column.key}
            align={column.align}
            sort={sort}
            onSort={onSort}
            rows={rows}
            getValue={PEER_FILTER_VAL[column.key]}
            filters={filters}
            onFilter={onFilter}
          />
        ))}
      </tr>
    </thead>
  );
}

function PeerCompanyCell({
  row, selected, stickyBackground, onSelect, onHover,
}: {
  row: RVRow;
  selected: boolean;
  stickyBackground: string;
  onSelect: (figi: string) => void;
  onHover: (figi: string | null) => void;
}) {
  return (
    <td className={td + " sticky left-0 z-10 text-caos-text transition-colors " + stickyBackground}>
      <button
        type="button"
        aria-pressed={selected}
        aria-label={"Select " + row.company + ", rating " + row.rating}
        onClick={(event) => {
          event.stopPropagation();
          onSelect(row.figi);
        }}
        onFocus={() => onHover(row.figi)}
        onBlur={() => onHover(null)}
        className="w-full text-left focus-ring rounded px-1 -mx-1 outline-none cursor-pointer"
      >
        {row.company}
      </button>
    </td>
  );
}

function peerRowBackground(selected: boolean, hovered: boolean) {
  if (selected) return "bg-caos-accent/[0.12]";
  if (hovered) return "bg-caos-elevated/60";
  return "hover:bg-caos-elevated/50";
}

function peerStickyBackground(selected: boolean, hovered: boolean) {
  if (selected || hovered) return "bg-caos-elevated";
  return "bg-caos-panel group-hover:bg-caos-elevated/50";
}

function PeerTableRow({
  row, columns, selected, hovered, rowRef, onSelect, onHover,
}: {
  row: RVRow;
  columns: PeerColumnSpec[];
  selected: boolean;
  hovered: boolean;
  rowRef?: React.Ref<HTMLTableRowElement>;
  onSelect: (figi: string) => void;
  onHover: (figi: string | null) => void;
}) {
  const rowBackground = peerRowBackground(selected, hovered);
  const stickyBackground = peerStickyBackground(selected, hovered);
  return (
    <tr
      ref={rowRef}
      tabIndex={0}
      aria-label={`Select ${row.company}, rating ${row.rating || "unrated"}`}
      data-selected={selected ? "true" : undefined}
      onClick={() => onSelect(row.figi)}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        onSelect(row.figi);
      }}
      onMouseEnter={() => onHover(row.figi)}
      onMouseLeave={() => onHover(null)}
      className={"border-b border-caos-border/40 transition-caos group cursor-pointer " + rowBackground}
      style={selected ? { boxShadow: "inset 2px 0 0 var(--caos-accent)" } : undefined}
    >
      {columns.map((column) => (
        <Fragment key={column.key}>
          {column.key === "company"
            ? <PeerCompanyCell row={row} selected={selected} stickyBackground={stickyBackground} onSelect={onSelect} onHover={onHover} />
            : column.render?.(row)}
        </Fragment>
      ))}
    </tr>
  );
}

function PeerTable({
  rows, filtered, preset = "full", filters, onFilter, selected, hovered, onSelect, onHover,
}: {
  rows: RVRow[];
  filtered: RVRow[];
  preset?: PeerPreset;
  filters: FilterState;
  onFilter: (col: string, values: string[] | undefined) => void;
  selected: string | null;
  hovered: string | null;
  onSelect: (figi: string) => void;
  onHover: (figi: string | null) => void;
}) {
  const { sort, handleSort } = useSortState({ col: "absRv", asc: false });
  const selectedRowRef = useRef<HTMLTableRowElement>(null);
  useEffect(() => {
    selectedRowRef.current?.scrollIntoView({ block: "nearest" });
  }, [selected]);
  const sorted = useSort(filtered, sort, peerSortValue);
  const columns = peerColumns(preset);
  const minWidthClass = preset === "full" ? "min-w-[1920px]" : "min-w-[1100px]";
  return (
    <table aria-label="Sector relative value" className={"border-collapse text-caos-xs " + minWidthClass + " w-full"}>
      <PeerTableHeader columns={columns} rows={rows} sort={sort} onSort={handleSort} filters={filters} onFilter={onFilter} />
      <tbody>
        {sorted.map((row) => (
          <PeerTableRow
            key={loanKey(row)}
            row={row}
            columns={columns}
            selected={selected === row.figi}
            hovered={hovered === row.figi}
            rowRef={selected === row.figi ? selectedRowRef : undefined}
            onSelect={onSelect}
            onHover={onHover}
          />
        ))}
        {sorted.length === 0 && (
          <tr>
            <td colSpan={columns.length} className="px-3 py-8 text-center tabular text-caos-xs text-caos-muted">
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
type RVScatterProps = {
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
};

type ScatterGeometry = {
  width: number;
  height: number;
  padL: number;
  padR: number;
  padT: number;
  plotW: number;
  plotH: number;
  bandW: number;
  bandX: (index: number) => number;
  scaleX: (value: number) => number;
  scaleY: (value: number) => number;
  xLo: number;
  xHi: number;
  gridValues: number[];
};

type ScatterInteractions = {
  selected: string | null;
  hovered: string | null;
  onSelect: (figi: string) => void;
  onHover: (figi: string | null) => void;
};
type ScatterRoving = ReturnType<typeof useRovingFocus>;

function scatterCategories(rows: RVRow[], xMeasure: XMeasure) {
  if (!isCategorical(xMeasure)) return [];
  if (xMeasure === "rating") return BUCKETS.filter((bucket) => rows.some((row) => row.bucket === bucket));
  return [...new Set(rows.map((row) => row.subSector))].sort();
}

function scatterPointIds(rows: RVRow[], categories: string[], xMeasure: XMeasure, chartType: ChartType) {
  if (chartType !== "scatter") return [];
  if (!isCategorical(xMeasure)) return rows.map((row) => row.figi);
  return categories.flatMap((category) =>
    rows.filter((row) => categoryOf(row, xMeasure) === category).map((row) => row.figi),
  );
}

function scatterYDomain(rows: RVRow[]) {
  const sorted = rows.map((row) => row.dm).sort((a, b) => a - b);
  const min = percentileSorted(sorted, 0.05);
  const max = percentileSorted(sorted, 0.95);
  const pad = (max - min || 1) * 0.08;
  return { lo: min - pad, hi: max + pad };
}

function scatterXDomain(rows: RVRow[], xMeasure: XMeasure) {
  const values = rows.map((row) => continuousValue(row, xMeasure));
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  const pad = (max - min || 1) * 0.08;
  return { lo: min - pad, hi: max + pad };
}

function scatterGeometry(rows: RVRow[], categories: string[], xMeasure: XMeasure, width: number, height: number): ScatterGeometry {
  const padL = 46, padR = 14, padT = 14, padB = 30;
  const plotW = Math.max(1, width - padL - padR);
  const plotH = Math.max(1, height - padT - padB);
  const y = scatterYDomain(rows);
  const x = scatterXDomain(rows, xMeasure);
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
  const scaleY = (value: number) => clamp(padT + ((y.hi - value) / (y.hi - y.lo || 1)) * plotH, padT, padT + plotH);
  const scaleX = (value: number) => padL + ((value - x.lo) / (x.hi - x.lo || 1)) * plotW;
  const bandW = categories.length ? plotW / categories.length : plotW;
  return {
    width, height, padL, padR, padT, plotW, plotH, bandW, scaleX, scaleY,
    bandX: (index) => padL + (index + 0.5) * bandW,
    xLo: x.lo,
    xHi: x.hi,
    gridValues: [y.hi, (y.hi + y.lo) / 2, y.lo],
  };
}

function scatterAriaLabel(chartType: ChartType, xMeasure: XMeasure) {
  const label = X_LABEL[xMeasure].toLowerCase();
  if (chartType === "bar") return "Average three-year discount margin per " + label;
  if (chartType === "box") return "Three-year discount margin distribution per " + label + ", each with min-to-max whisker, interquartile box and median tick";
  if (!isCategorical(xMeasure)) return "Three-year discount margin against " + label;
  const category = xMeasure === "rating" ? "bucket" : "category";
  return "Three-year discount margin by " + label + ", with each " + category + "'s median marked";
}

function ScatterFrame({ geometry, color }: { geometry: ScatterGeometry; color: string }) {
  const { width, padL, padR, padT, plotH, scaleY, gridValues } = geometry;
  return (
    <>
      {gridValues.map((value, index) => (
        <g key={index}>
          <line x1={padL} y1={scaleY(value)} x2={width - padR} y2={scaleY(value)} stroke="var(--caos-border)" strokeWidth={1} strokeOpacity={0.3} strokeDasharray="3 3" />
          <text x={padL - 6} y={scaleY(value) + 3} textAnchor="end" fontSize={9} fill="var(--caos-muted)" className="tabular">{Math.round(value)}</text>
        </g>
      ))}
      <text x={13} y={padT + plotH / 2} textAnchor="middle" fontSize={9} fill="var(--caos-muted)" transform={"rotate(-90 13 " + (padT + plotH / 2) + ")"} className="uppercase tracking-wider">3Y DM (bp)</text>
      <line x1={padL} y1={padT + plotH} x2={width - padR} y2={padT + plotH} stroke={color} strokeWidth={1.5} strokeOpacity={0.6} />
    </>
  );
}

function ContinuousAxis({ geometry, xMeasure }: { geometry: ScatterGeometry; xMeasure: XMeasure }) {
  const { height, padL, padT, plotW, plotH, scaleX, xLo, xHi } = geometry;
  return (
    <>
      {[0, 0.25, 0.5, 0.75, 1].map((fraction, index) => {
        const value = xLo + (xHi - xLo) * fraction;
        const x = scaleX(value);
        return (
          <g key={"gx" + index}>
            <line x1={x} y1={padT} x2={x} y2={padT + plotH} stroke="var(--caos-border)" strokeWidth={1} strokeOpacity={0.15} strokeDasharray="3 3" />
            <text x={x} y={height - 14} textAnchor="middle" fontSize={9} fill="var(--caos-muted)" className="tabular">{xMeasure === "price" ? value.toFixed(1) : Math.round(value)}</text>
          </g>
        );
      })}
      <text x={padL + plotW / 2} y={height - 2} textAnchor="middle" fontSize={9} fill="var(--caos-muted)" className="uppercase tracking-wider">{X_LABEL[xMeasure]}</text>
    </>
  );
}

function ContinuousPoint({
  row, xMeasure, geometry, roving, selected, hovered, onSelect, onHover,
}: {
  row: RVRow;
  xMeasure: XMeasure;
  geometry: ScatterGeometry;
  roving: ScatterRoving;
} & ScatterInteractions) {
  const xValue = continuousValue(row, xMeasure);
  const xLabel = xMeasure === "price" ? xValue.toFixed(2) : Math.round(xValue);
  return (
    <Point
      cx={geometry.scaleX(xValue)}
      cy={geometry.scaleY(row.dm)}
      fill={RV_STYLE[row.rv].fg}
      isSel={selected === row.figi}
      isHov={hovered === row.figi}
      label={"Position " + row.company + ", rating " + row.rating + ", discount margin " + row.dm + " basis points, " + row.rv}
      title={row.company + " · DM " + row.dm + " · " + X_LABEL[xMeasure] + " " + xLabel + " · " + row.rv}
      onSelect={() => onSelect(row.figi)}
      onHover={(active) => onHover(active ? row.figi : null)}
      roving={roving.getItemProps(row.figi)}
    />
  );
}

function ContinuousPoints({
  rows, xMeasure, geometry, roving, ...interactions
}: {
  rows: RVRow[];
  xMeasure: XMeasure;
  geometry: ScatterGeometry;
  roving: ScatterRoving;
} & ScatterInteractions) {
  return rows.map((row) => (
    <ContinuousPoint
      key={loanKey(row)}
      row={row}
      xMeasure={xMeasure}
      geometry={geometry}
      roving={roving}
      {...interactions}
    />
  ));
}

function CategoryLabel({ category, x, height }: { category: string; x: number; height: number }) {
  const label = category.length > 9 ? category.slice(0, 8) + "…" : category;
  return <text x={x} y={height - 8} textAnchor="middle" fontSize={9} fill="var(--caos-muted)" className="tabular">{label}</text>;
}

function CategoryBar({ category, members, x, geometry }: { category: string; members: RVRow[]; x: number; geometry: ScatterGeometry }) {
  const average = mean(members.map((row) => row.dm));
  if (average === null) return <CategoryLabel category={category} x={x} height={geometry.height} />;
  const width = Math.min(geometry.bandW * 0.5, 44);
  const y = geometry.scaleY(average);
  const baseline = geometry.padT + geometry.plotH;
  return (
    <g>
      <rect x={x - width / 2} y={y} width={width} height={Math.max(0, baseline - y)} fill="var(--caos-accent)" fillOpacity={0.55} rx={1.5}>
        <title>{category + " · avg 3Y DM " + Math.round(average) + "bp · n=" + members.length}</title>
      </rect>
      <text x={x} y={y - 3} textAnchor="middle" fontSize={9} fill="var(--caos-muted)" className="tabular">{Math.round(average)}</text>
      <CategoryLabel category={category} x={x} height={geometry.height} />
    </g>
  );
}

function CategoryBox({ category, members, x, geometry }: { category: string; members: RVRow[]; x: number; geometry: ScatterGeometry }) {
  const values = members.map((row) => row.dm).sort((a, b) => a - b);
  if (!values.length) return <CategoryLabel category={category} x={x} height={geometry.height} />;
  const min = values[0], max = values[values.length - 1];
  const q1 = percentileSorted(values, 0.25), q3 = percentileSorted(values, 0.75), medianValue = percentileSorted(values, 0.5);
  const yMin = geometry.scaleY(min), yMax = geometry.scaleY(max);
  const yQ1 = geometry.scaleY(q1), yQ3 = geometry.scaleY(q3), yMedian = geometry.scaleY(medianValue);
  const width = Math.min(geometry.bandW * 0.42, 40);
  return (
    <g>
      <title>{category + " · DM min " + Math.round(min) + " / med " + Math.round(medianValue) + " / max " + Math.round(max) + "bp · n=" + members.length}</title>
      <line x1={x} y1={yMax} x2={x} y2={yMin} stroke="var(--caos-muted)" strokeWidth={1.2} strokeOpacity={0.7} />
      <line x1={x - width * 0.3} y1={yMax} x2={x + width * 0.3} y2={yMax} stroke="var(--caos-muted)" strokeWidth={1.2} />
      <line x1={x - width * 0.3} y1={yMin} x2={x + width * 0.3} y2={yMin} stroke="var(--caos-muted)" strokeWidth={1.2} />
      <rect x={x - width / 2} y={yQ3} width={width} height={Math.max(1, yQ1 - yQ3)} fill="var(--caos-accent)" fillOpacity={0.16} stroke="var(--caos-accent)" strokeWidth={1.2} rx={1.5} />
      <line x1={x - width / 2} y1={yMedian} x2={x + width / 2} y2={yMedian} stroke="var(--caos-text)" strokeWidth={2} strokeOpacity={0.85} />
      <CategoryLabel category={category} x={x} height={geometry.height} />
    </g>
  );
}

function categoryPointOffset(index: number, count: number, bandWidth: number) {
  if (count <= 1) return 0;
  return (index / (count - 1) - 0.5) * bandWidth * 0.62;
}

function rvBasisPointLabel(value: number | null) {
  if (value === null) return "";
  return " " + (value > 0 ? "+" : "") + Math.round(value) + "bp";
}

function CategoryPointStem({
  x, row, medianValue, geometry, active,
}: {
  x: number;
  row: RVRow;
  medianValue: number | null;
  geometry: ScatterGeometry;
  active: boolean;
}) {
  if (medianValue === null) return null;
  const cheap = row.dm >= medianValue;
  return (
    <line
      x1={x}
      y1={geometry.scaleY(medianValue)}
      x2={x}
      y2={geometry.scaleY(row.dm)}
      stroke={cheap ? "var(--caos-success-bright)" : "var(--caos-critical-bright)"}
      strokeWidth={active ? 2.4 : 1.8}
      strokeOpacity={active ? 0.9 : 0.5}
    />
  );
}

function CategoryPoint({
  row, index, count, medianValue, x, geometry, roving, selected, hovered, onSelect, onHover,
}: {
  row: RVRow;
  index: number;
  count: number;
  medianValue: number | null;
  x: number;
  geometry: ScatterGeometry;
  roving: ScatterRoving;
} & ScatterInteractions) {
  const pointX = x + categoryPointOffset(index, count, geometry.bandW);
  const isSelected = selected === row.figi;
  const isHovered = hovered === row.figi;
  const active = isSelected || isHovered;
  return (
    <g>
      <CategoryPointStem x={pointX} row={row} medianValue={medianValue} geometry={geometry} active={active} />
      <Point
        cx={pointX}
        cy={geometry.scaleY(row.dm)}
        fill={RV_STYLE[row.rv].fg}
        isSel={isSelected}
        isHov={isHovered}
        label={"Position " + row.company + ", rating " + row.rating + ", discount margin " + row.dm + " basis points, " + row.rv}
        title={row.company + " · DM " + row.dm + " · " + row.rv + rvBasisPointLabel(row.rvBp)}
        onSelect={() => onSelect(row.figi)}
        onHover={(active) => onHover(active ? row.figi : null)}
        roving={roving.getItemProps(row.figi)}
      />
    </g>
  );
}

function CategoryScatter({
  category, members, x, geometry, roving, ...interactions
}: {
  category: string;
  members: RVRow[];
  x: number;
  geometry: ScatterGeometry;
  roving: ScatterRoving;
} & ScatterInteractions) {
  const medianValue = bucketMedian(members.map((row) => row.dm));
  return (
    <g>
      {medianValue !== null && (
        <line x1={x - geometry.bandW * 0.36} y1={geometry.scaleY(medianValue)} x2={x + geometry.bandW * 0.36} y2={geometry.scaleY(medianValue)} stroke="var(--caos-muted)" strokeWidth={1.5} strokeDasharray="4 3" strokeOpacity={0.75}>
          <title>{category + " · median 3Y DM " + Math.round(medianValue) + "bp"}</title>
        </line>
      )}
      {members.map((row, index) => (
        <CategoryPoint
          key={loanKey(row)}
          row={row}
          index={index}
          count={members.length}
          medianValue={medianValue}
          x={x}
          geometry={geometry}
          roving={roving}
          {...interactions}
        />
      ))}
      <CategoryLabel category={category} x={x} height={geometry.height} />
    </g>
  );
}

function CategoryPlot({
  category, members, x, chartType, geometry, roving, ...interactions
}: {
  category: string;
  members: RVRow[];
  x: number;
  chartType: ChartType;
  geometry: ScatterGeometry;
  roving: ScatterRoving;
} & ScatterInteractions) {
  if (chartType === "bar") return <CategoryBar category={category} members={members} x={x} geometry={geometry} />;
  if (chartType === "box") return <CategoryBox category={category} members={members} x={x} geometry={geometry} />;
  return <CategoryScatter category={category} members={members} x={x} geometry={geometry} roving={roving} {...interactions} />;
}

function CategoricalPlots({
  rows, categories, xMeasure, chartType, geometry, roving, ...interactions
}: {
  rows: RVRow[];
  categories: string[];
  xMeasure: XMeasure;
  chartType: ChartType;
  geometry: ScatterGeometry;
  roving: ScatterRoving;
} & ScatterInteractions) {
  return categories.map((category, index) => (
    <CategoryPlot
      key={category}
      category={category}
      members={rows.filter((row) => categoryOf(row, xMeasure) === category)}
      x={geometry.bandX(index)}
      chartType={chartType}
      geometry={geometry}
      roving={roving}
      {...interactions}
    />
  ));
}

function ScatterSvg({
  rows, color, categories, xMeasure, chartType, geometry, roving, ...interactions
}: RVScatterProps & { categories: string[]; geometry: ScatterGeometry; roving: ScatterRoving }) {
  const categorical = isCategorical(xMeasure);
  return (
    <svg
      viewBox={"0 0 " + geometry.width + " " + geometry.height}
      className="w-full h-full"
      preserveAspectRatio="xMidYMid meet"
      role="group"
      aria-label={scatterAriaLabel(chartType, xMeasure)}
    >
      <ScatterFrame geometry={geometry} color={color} />
      {categorical
        ? <CategoricalPlots rows={rows} categories={categories} xMeasure={xMeasure} chartType={chartType} geometry={geometry} roving={roving} {...interactions} />
        : (
          <>
            <ContinuousAxis geometry={geometry} xMeasure={xMeasure} />
            <ContinuousPoints rows={rows} xMeasure={xMeasure} geometry={geometry} roving={roving} {...interactions} />
          </>
        )}
    </svg>
  );
}

function RVScatter({
  rows, xMeasure, chartType, width, height, ...rest
}: RVScatterProps) {
  const categories = scatterCategories(rows, xMeasure);
  const pointIds = scatterPointIds(rows, categories, xMeasure, chartType);
  const roving = useRovingFocus(pointIds);
  if (!rows.length || (isCategorical(xMeasure) && !categories.length)) return null;
  const geometry = scatterGeometry(rows, categories, xMeasure, width, height);
  return (
    <ScatterSvg
      rows={rows}
      xMeasure={xMeasure}
      chartType={chartType}
      width={width}
      height={height}
      categories={categories}
      geometry={geometry}
      roving={roving}
      {...rest}
    />
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
        <span className="tabular text-caos-3xs uppercase font-bold text-caos-success border border-caos-success/30 bg-caos-success/5 px-1 rounded-sm">
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

type RVSector = ReturnType<typeof buildRVSectors>[number];
type RatingAverageRow = ReturnType<typeof ratingAverages>[number];
type SubSectorAverageRow = ReturnType<typeof subSectorAverages>[number];
type IndexStatRow = ReturnType<typeof buildIndexStats>[number];
type StatsTab = "ratings" | "subsectors" | "indexes";

function statsSortValue(row: { d: Array<number | null> }, column: string): SortVal {
  if (column.startsWith("d")) return row.d[parseInt(column.substring(1))];
  return field(row, column);
}

function useSectorUniverse(holdings?: Map<string, RVHolding>) {
  const rows = useMemo(() => (holdings ? buildRVRows(holdings) : SEED_ROWS), [holdings]);
  const sectors = useMemo(() => (holdings ? buildRVSectors(rows) : SEED_RV_SECTORS), [holdings, rows]);
  const indexes = useMemo(() => (holdings ? buildIndexStats(sectors) : SEED_INDEX_STATS), [holdings, sectors]);
  const [active, setActive] = useState(0);
  useEffect(() => {
    if (active >= sectors.length) setActive(0);
  }, [active, sectors.length]);
  const sector = sectors[active] ?? sectors[0]!;
  const averages = useMemo(() => ratingAverages(sector.rows), [sector]);
  const subSectorAvgs = useMemo(() => subSectorAverages(sector.rows), [sector]);
  return { rows, sectors, indexes, active, setActive, sector, averages, subSectorAvgs };
}

function useSectorControls() {
  const [chartRef, dimensions] = useResizeObserver<HTMLDivElement>();
  const [colPreset, setColPreset] = useState<PeerPreset>("rv");
  const [statsTab, setStatsTab] = useState<StatsTab>("ratings");
  const [xMeasure, setXMeasure] = useState<XMeasure>("rating");
  const [chartType, setChartType] = useState<ChartType>("scatter");
  useEffect(() => {
    if ((xMeasure === "size" || xMeasure === "price") && chartType !== "scatter") setChartType("scatter");
  }, [xMeasure, chartType]);
  return { chartRef, dimensions, colPreset, setColPreset, statsTab, setStatsTab, xMeasure, setXMeasure, chartType, setChartType };
}

function useSectorFilterState(sector: RVSector) {
  const [filters, setFilters] = useState<FilterState>({});
  const filtered = useColumnFilters(sector.rows, filters, PEER_FILTER_VAL);
  const setFilter = (column: string, values: string[] | undefined) =>
    setFilters((current) => updateColumnFilter(current, column, values));
  return { filters, setFilters, filtered, setFilter };
}

function useSectorSelection(sector: RVSector) {
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const handleSelect = (figi: string) => setSelected((current) => (current === figi ? null : figi));
  useEffect(() => {
    if (selected && !sector.rows.some((row) => row.figi === selected)) setSelected(null);
  }, [sector, selected]);
  const selectedRow = selected ? sector.rows.find((row) => row.figi === selected) ?? null : null;
  return { selected, setSelected, hovered, setHovered, handleSelect, selectedRow };
}

function useSectorReads(filtered: RVRow[], sectorName: string) {
  const book = useMemo(() => topOfBook(filtered), [filtered]);
  const readLines = useMemo(() => sectorRead(filtered, sectorName), [filtered, sectorName]);
  return { book, readLines };
}

function useSectorSorts(indexes: IndexStatRow[], subSectors: SubSectorAverageRow[], averages: RatingAverageRow[]) {
  const { sort: indexSort, handleSort: sortIndexes } = useSortState();
  const sortedIndexes = useSort(indexes, indexSort, statsSortValue);
  const { sort: subSectorSort, handleSort: sortSubSectors } = useSortState();
  const sortedSubSectors = useSort(subSectors, subSectorSort, statsSortValue);
  const { sort: averageSort, handleSort: sortAverages } = useSortState();
  const sortedAverages = useSort(averages, averageSort, statsSortValue);
  return {
    indexSort, sortIndexes, sortedIndexes,
    subSectorSort, sortSubSectors, sortedSubSectors,
    averageSort, sortAverages, sortedAverages,
  };
}

function useSectorRVController(holdings?: Map<string, RVHolding>) {
  const universe = useSectorUniverse(holdings);
  const controls = useSectorControls();
  const filters = useSectorFilterState(universe.sector);
  const selection = useSectorSelection(universe.sector);
  const reads = useSectorReads(filters.filtered, universe.sector.name);
  const sorts = useSectorSorts(universe.indexes, universe.subSectorAvgs, universe.averages);
  return { ...universe, ...controls, ...filters, ...selection, ...reads, ...sorts };
}

type SectorRVController = ReturnType<typeof useSectorRVController>;

const X_MEASURE_OPTIONS: ReadonlyArray<readonly [string, XMeasure]> = [
  ["Rating", "rating"],
  ["Sub-sector", "subSector"],
  ["Size", "size"],
  ["Price", "price"],
];

const CHART_TYPE_OPTIONS: ReadonlyArray<readonly [string, ChartType]> = [
  ["Scatter", "scatter"],
  ["Bar", "bar"],
  ["Box", "box"],
];

const TABLE_LENS_OPTIONS: ReadonlyArray<readonly [string, PeerPreset]> = [
  ["Full", "full"],
  ["Market", "market"],
  ["RV", "rv"],
];

function toolbarButtonClass(active: boolean, disabled = false) {
  const base = "shrink-0 tabular text-caos-2xs h-7 px-2.5 rounded border transition-caos focus-ring flex items-center justify-center ";
  if (active) return base + "border-caos-accent text-caos-text bg-caos-elevated";
  if (disabled) return base + "border-caos-border/30 text-caos-muted/40 cursor-not-allowed";
  return base + "border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 cursor-pointer";
}

function ToolbarDivider() {
  return <span className="w-px h-4 bg-caos-border/60 shrink-0" aria-hidden="true" />;
}

function ToolbarGroupLabel({ children }: { children: React.ReactNode }) {
  return <span className="shrink-0 tabular text-caos-2xs uppercase tracking-widest text-caos-muted mr-1">{children}</span>;
}

function SectorSelector({ state }: { state: SectorRVController }) {
  return (
    <>
      <label htmlFor="sector-rv-select" className="tabular text-caos-2xs uppercase tracking-widest text-caos-muted whitespace-nowrap">Sector tables</label>
      <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: state.sector.color }} aria-hidden="true" />
      <select
        id="sector-rv-select"
        value={state.active}
        onChange={(event) => state.setActive(Number(event.target.value))}
        className="focus-ring h-7 min-w-[220px] rounded border border-caos-border bg-caos-elevated px-2.5 tabular text-caos-xs text-caos-text outline-none transition-caos hover:border-caos-accent/60 cursor-pointer"
      >
        {state.sectors.map((sector, index) => <option key={sector.name} value={index}>{sector.name}</option>)}
      </select>
    </>
  );
}

function XMeasureControls({ state }: { state: SectorRVController }) {
  const selectMeasure = (measure: XMeasure) => {
    state.setXMeasure(measure);
    if ((measure === "size" || measure === "price") && state.chartType !== "scatter") state.setChartType("scatter");
  };
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Chart X measure">
      <ToolbarGroupLabel>X</ToolbarGroupLabel>
      {X_MEASURE_OPTIONS.map(([label, measure]) => (
        <button key={measure} type="button" aria-pressed={state.xMeasure === measure} onClick={() => selectMeasure(measure)} className={toolbarButtonClass(state.xMeasure === measure)}>
          {label}
        </button>
      ))}
    </div>
  );
}

function ChartTypeControls({ state }: { state: SectorRVController }) {
  const continuous = state.xMeasure === "size" || state.xMeasure === "price";
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Chart type">
      <ToolbarGroupLabel>Chart</ToolbarGroupLabel>
      {CHART_TYPE_OPTIONS.map(([label, chartType]) => {
        const disabled = chartType !== "scatter" && continuous;
        return (
          <ActionReason
            key={chartType}
            type="button"
            aria-pressed={state.chartType === chartType}
            reason={disabled ? "Bar and Box charts need a categorical X measure (Rating or Sub-sector)" : null}
            reasonDisplay="hidden"
            onClick={() => state.setChartType(chartType)}
            className={toolbarButtonClass(state.chartType === chartType, disabled)}
          >
            {label}
          </ActionReason>
        );
      })}
    </div>
  );
}

function TableLensControls({ state }: { state: SectorRVController }) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Loans table lens">
      <ToolbarGroupLabel>Table</ToolbarGroupLabel>
      {TABLE_LENS_OPTIONS.map(([label, preset]) => (
        <button key={preset} type="button" aria-pressed={state.colPreset === preset} onClick={() => state.setColPreset(preset)} className={toolbarButtonClass(state.colPreset === preset)}>
          {label}
        </button>
      ))}
    </div>
  );
}

function FilterReset({ state }: { state: SectorRVController }) {
  const count = Object.keys(state.filters).length;
  if (!count) return null;
  return (
    <>
      <ToolbarDivider />
      <button
        type="button"
        onClick={() => state.setFilters({})}
        aria-label={"Clear " + count + " column filter(s)"}
        className="shrink-0 tabular text-caos-2xs h-7 px-2.5 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos focus-ring cursor-pointer flex items-center justify-center"
      >
        Clear filters ({count})
      </button>
    </>
  );
}

function SectorToolbar({ state }: { state: SectorRVController }) {
  return (
    <div className="h-9 shrink-0 rounded border border-caos-border bg-caos-panel/60 px-3 flex items-center gap-2 overflow-x-auto whitespace-nowrap">
      <SectorSelector state={state} />
      <span className="flex-1" />
      <XMeasureControls state={state} />
      <ToolbarDivider />
      <ChartTypeControls state={state} />
      <ToolbarDivider />
      <TableLensControls state={state} />
      <FilterReset state={state} />
      <span className="tabular text-caos-xs text-caos-muted whitespace-nowrap hidden xl:inline">{state.sector.rows.length} in file</span>
    </div>
  );
}

function distributionCaption(chartType: ChartType, xMeasure: XMeasure) {
  const label = X_LABEL[xMeasure].toLowerCase();
  if (chartType === "bar") return "avg 3Y DM by " + label;
  if (chartType === "box") return "3Y DM spread by " + label + " · box = IQR";
  if (isCategorical(xMeasure)) return "3Y DM by " + label + " · tick = median · above = wide / cheap";
  return "3Y DM vs " + label;
}

function EmptyDistribution() {
  return (
    <div className="h-full min-h-[240px] flex flex-col items-center justify-center gap-2 text-center">
      <span style={{ color: "var(--caos-muted)" }} aria-hidden="true"><StatusGlyph kind="idle" size={16} /></span>
      <p className="tabular text-caos-sm text-caos-muted m-0 max-w-[320px] leading-relaxed">
        No loans match the current column filters — clear a filter to plot the sector distribution.
      </p>
    </div>
  );
}

function DistributionChart({ state }: { state: SectorRVController }) {
  if (!state.filtered.length) return <EmptyDistribution />;
  if (state.dimensions.width <= 0) return null;
  return (
    <RVScatter
      rows={state.filtered}
      color={state.sector.color}
      xMeasure={state.xMeasure}
      chartType={state.chartType}
      selected={state.selected}
      hovered={state.hovered}
      onSelect={state.handleSelect}
      onHover={state.setHovered}
      width={state.dimensions.width}
      height={state.dimensions.height}
    />
  );
}

function DistributionFocus({ state }: { state: SectorRVController }) {
  if (state.chartType !== "scatter" && !state.selectedRow) {
    return (
      <div className="flex items-center h-8 px-3 border-t border-caos-border text-caos-2xs text-caos-muted">
        Point selection is available in the Scatter view and the peer table.
      </div>
    );
  }
  return <FocusReadout row={state.selectedRow} onClear={() => state.setSelected(null)} />;
}

function DistributionPanel({ state }: { state: SectorRVController }) {
  return (
    <PanelShell
      title={state.sector.name + " — RV Distribution"}
      className="min-h-[360px]"
      right={<span className="tabular text-caos-xs text-caos-muted">{distributionCaption(state.chartType, state.xMeasure)}</span>}
    >
      <div className="flex flex-col h-full min-h-0">
        <div ref={state.chartRef} className="flex-1 min-h-[300px] w-full px-2 py-1"><DistributionChart state={state} /></div>
        <DistributionFocus state={state} />
      </div>
    </PanelShell>
  );
}

function readScopeLabel(filtered: number, total: number) {
  if (filtered !== total) return "computed · " + filtered + " of " + total + " shown";
  return "computed · " + filtered + " loans";
}

function SectorReadRail({ state }: { state: SectorRVController }) {
  return (
    <div data-testid="sector-rv-right-rail" className="grid grid-rows-2 gap-2 min-h-0 max-h-[360px] overflow-hidden">
      <PanelShell
        title="Sector read"
        className="min-h-0"
        right={<span className="tabular text-caos-2xs uppercase tracking-widest text-caos-muted">{readScopeLabel(state.filtered.length, state.sector.rows.length)}</span>}
      >
        <SectorReadPanel lines={state.readLines} />
      </PanelShell>
      <PanelShell
        title="Top of book"
        className="min-h-0"
        right={<span className="tabular text-caos-2xs uppercase tracking-widest text-caos-muted">by RV vs bucket</span>}
      >
        <TopOfBookPanel
          book={state.book}
          selected={state.selected}
          hovered={state.hovered}
          onSelect={state.handleSelect}
          onHover={state.setHovered}
        />
      </PanelShell>
    </div>
  );
}

function SectorDistribution({ state }: { state: SectorRVController }) {
  return (
    <div className="shrink-0 grid grid-cols-1 @[60rem]:grid-cols-[1.6fr_1fr] gap-3 items-stretch">
      <DistributionPanel state={state} />
      <SectorReadRail state={state} />
    </div>
  );
}

function SectorPeerPanel({ state }: { state: SectorRVController }) {
  return (
    <PanelShell
      title={state.sector.name + " — Sector Peers · Relative Value"}
      className="min-h-[400px] h-[400px] flex-none"
      right={<span className="tabular text-caos-xs text-caos-muted">RV = 3Y DM − sector×rating median (n ≥ 2) · sorted |rvBp| ↓</span>}
    >
      <div className="overflow-auto h-full">
        <PeerTable
          rows={state.sector.rows}
          filtered={state.filtered}
          preset={state.colPreset}
          filters={state.filters}
          onFilter={state.setFilter}
          selected={state.selected}
          hovered={state.hovered}
          onSelect={state.handleSelect}
          onHover={state.setHovered}
        />
      </div>
    </PanelShell>
  );
}

type StatsColumn = { label: string; column: string; align?: "left" | "right" };

const RATING_STATS_COLUMNS: StatsColumn[] = [
  { label: "Rating", column: "bucket" },
  { label: "Loans", column: "n", align: "right" },
  { label: "Avg Size ($Mn)", column: "size", align: "right" },
  { label: "Margin", column: "margin", align: "right" },
  { label: "Bid", column: "bid", align: "right" },
  { label: "Ask", column: "ask", align: "right" },
  ...DELTA_COLS.map((label, index) => ({ label, column: "d" + index, align: "right" as const })),
  { label: "Mid YTM", column: "ytm", align: "right" },
  { label: "Mid 3Y DM", column: "dm", align: "right" },
];

const SUBSECTOR_STATS_COLUMNS: StatsColumn[] = [
  { label: "Sub-Sector", column: "subSector" },
  ...RATING_STATS_COLUMNS.slice(1),
];

const INDEX_STATS_COLUMNS: StatsColumn[] = [
  { label: "Index", column: "name" },
  { label: "Loans", column: "n", align: "right" },
  { label: "MV ($Bn)", column: "mv", align: "right" },
  { label: "Avg Price", column: "avgPrice", align: "right" },
  ...DELTA_COLS.map((label, index) => ({ label, column: "d" + index, align: "right" as const })),
  { label: "YTM", column: "ytm", align: "right" },
  { label: "3Y DM", column: "dm", align: "right" },
];

function StatsHeader({ columns, sort, onSort }: { columns: StatsColumn[]; sort: SortConfig; onSort: (column: string) => void }) {
  return (
    <thead>
      <tr className="border-b border-caos-border">
        {columns.map((column) => (
          <SortTh key={column.column} label={column.label} col={column.column} align={column.align} sort={sort} onSort={onSort} />
        ))}
      </tr>
    </thead>
  );
}

function AverageStatsCells({ row, summaryTone }: { row: RatingAverageRow | SubSectorAverageRow; summaryTone: string }) {
  return <>
    <td className={td + " text-right " + summaryTone}>{row.n.toLocaleString()}</td>
    <td className={td + " text-right " + summaryTone}>{row.size === null ? "—" : Math.round(row.size).toLocaleString()}</td>
    <td className={td + " text-right " + summaryTone}>{row.margin === null ? "—" : Math.round(row.margin)}</td>
    <td className={td + " text-right text-caos-text"}>{fmt(row.bid)}</td>
    <td className={td + " text-right text-caos-text"}>{fmt(row.ask)}</td>
    {row.d.map((value, index) => <DeltaCell key={DELTA_COLS[index]} v={value} colLabel={DELTA_COLS[index]} />)}
    <td className={td + " text-right text-caos-text"}>{fmt(row.ytm, 1)}</td>
    <td className={td + " text-right text-caos-text"}>{row.dm === null ? "—" : Math.round(row.dm).toLocaleString()}</td>
  </>;
}

function RatingStatsRow({ row }: { row: RatingAverageRow }) {
  const dataTone = row.n ? "text-caos-text" : "text-caos-muted";
  return (
    <tr className="border-b border-caos-border/40">
      <td className={td + " text-caos-text"}>{row.bucket}</td>
      <AverageStatsCells row={row} summaryTone={dataTone} />
    </tr>
  );
}

function RatingsStatsTable({ state }: { state: SectorRVController }) {
  return (
    <table aria-label="Sector ratings average" className="border-collapse text-caos-xs w-full min-w-[760px]">
      <StatsHeader columns={RATING_STATS_COLUMNS} sort={state.averageSort} onSort={state.sortAverages} />
      <tbody>{state.sortedAverages.map((row) => <RatingStatsRow key={row.bucket} row={row} />)}</tbody>
    </table>
  );
}

function SubSectorStatsRow({ row }: { row: SubSectorAverageRow }) {
  return (
    <tr className="border-b border-caos-border/40">
      <td className={td + " text-caos-text max-w-[260px] truncate"}>{row.subSector}</td>
      <AverageStatsCells row={row} summaryTone="text-caos-text" />
    </tr>
  );
}

function SubSectorStatsTable({ state }: { state: SectorRVController }) {
  return (
    <table aria-label="Sub-sector market average" className="border-collapse text-caos-xs w-full min-w-[760px]">
      <StatsHeader columns={SUBSECTOR_STATS_COLUMNS} sort={state.subSectorSort} onSort={state.sortSubSectors} />
      <tbody>{state.sortedSubSectors.map((row) => <SubSectorStatsRow key={row.subSector} row={row} />)}</tbody>
    </table>
  );
}

function IndexStatsRow({ row }: { row: IndexStatRow }) {
  return (
    <tr className="border-b border-caos-border/40">
      <td className={td + " text-caos-text"}>{row.name}</td>
      <td className={td + " text-right text-caos-text"}>{row.n.toLocaleString()}</td>
      <td className={td + " text-right text-caos-text"}>{row.mv.toLocaleString()}</td>
      <td className={td + " text-right text-caos-text"}>{row.avgPrice.toFixed(2)}</td>
      {row.d.map((value, index) => <DeltaCell key={DELTA_COLS[index]} v={value} colLabel={DELTA_COLS[index]} />)}
      <td className={td + " text-right text-caos-text"}>{row.ytm.toFixed(1)}</td>
      <td className={td + " text-right text-caos-text"}>{row.dm.toLocaleString()}</td>
    </tr>
  );
}

function IndexStatsTable({ state }: { state: SectorRVController }) {
  return (
    <table aria-label="Index statistics" className="border-collapse text-caos-xs w-full min-w-[760px]">
      <StatsHeader columns={INDEX_STATS_COLUMNS} sort={state.indexSort} onSort={state.sortIndexes} />
      <tbody>{state.sortedIndexes.map((row) => <IndexStatsRow key={row.name} row={row} />)}</tbody>
    </table>
  );
}

const STATS_TAB_OPTIONS: ReadonlyArray<readonly [string, StatsTab]> = [
  ["Ratings", "ratings"],
  ["Sub-Sectors", "subsectors"],
  ["Indexes", "indexes"],
];

function StatisticsControls({ state }: { state: SectorRVController }) {
  const scope = state.statsTab === "indexes" ? "derived from file sectors" : state.sector.name + " · peer set";
  return (
    <div className="flex items-center gap-3">
      <span className="tabular text-caos-xs text-caos-muted">{scope}</span>
      <div className="flex items-center gap-1" role="group" aria-label="Statistics view type">
        {STATS_TAB_OPTIONS.map(([label, tab]) => (
          <button
            key={tab}
            type="button"
            aria-pressed={state.statsTab === tab}
            onClick={() => state.setStatsTab(tab)}
            className={"shrink-0 tabular text-caos-2xs px-1.5 py-0.5 rounded border transition-caos focus-ring " + (state.statsTab === tab ? "border-caos-accent text-caos-text bg-caos-elevated" : "border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60")}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function StatisticsTable({ state }: { state: SectorRVController }) {
  if (state.statsTab === "ratings") return <RatingsStatsTable state={state} />;
  if (state.statsTab === "subsectors") return <SubSectorStatsTable state={state} />;
  return <IndexStatsTable state={state} />;
}

function SectorStatistics({ state }: { state: SectorRVController }) {
  return (
    <PanelShell
      title="Sector Averages & Index Summary"
      className="min-h-[280px] h-[280px] flex-none"
      right={<StatisticsControls state={state} />}
    >
      <div className="overflow-auto h-full"><StatisticsTable state={state} /></div>
    </PanelShell>
  );
}

function SectorRVWorkspace({ state }: { state: SectorRVController }) {
  const filterCount = Object.keys(state.filters).length;
  return (
    <div
      className="@container flex flex-col gap-3 min-w-0"
      onKeyDown={(event) => {
        if (event.key === "Escape" && state.selected) state.setSelected(null);
      }}
    >
      <CaveatHeader rows={state.rows} />
      <PanelShell title="Actionable Dislocations" className="flex-none min-h-0" collapsible>
        <ActionableDislocations rows={state.rows} />
      </PanelShell>
      <SectorToolbar state={state} />
      <RvLegend />
      <SectorDistribution state={state} />
      <SectorPeerPanel state={state} />
      <CrossSectorHeatmap rowsList={state.rows} filtersActive={filterCount > 0} filterCount={filterCount} />
      <SectorStatistics state={state} />
    </div>
  );
}

export function SectorRV({ holdings }: { holdings?: Map<string, RVHolding> } = {}) {
  const state = useSectorRVController(holdings);
  return <SectorRVWorkspace state={state} />;
}
