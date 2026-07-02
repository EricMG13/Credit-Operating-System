"use client";

// Concept A — Sector RV: sector-peer relative value tables in the desk-sheet
// format (issuer + loan data, spread-implied liquidity, mid RV assessment,
// price deltas), with US Leveraged Loan index statistics and per-rating
// averages. Sector dropdown switches between sector tables.

import { useMemo, useState } from "react";
import { Panel as PanelShell } from "@/components/shared/Panel";
import { FilterHeader, useColumnFilters, type FilterState } from "@/components/shared/TableColumnFilter";
import {
  BUCKETS,
  DELTA_COLS,
  INDEX_STATS,
  RV_SECTORS,
  ratingAverages,
  subSectorAverages,
  type Liquidity,
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

// Left-edge flag on the actionable tails only (cheap/rich) — alert, not
// decoration. Transparent (not absent) elsewhere so column alignment holds.
const rvEdge = (s: RVSignal): string =>
  s === "Cheap" ? "3px solid var(--caos-success-bright)"
    : s === "Rich" ? "3px solid var(--caos-critical-bright)"
      : "3px solid transparent";

function DeltaCell({ v }: { v: number | null }) {
  if (v === null)
    return <td className="px-2 py-[3px] text-right tabular text-caos-muted">—</td>;
  const pos = v > 0;
  const neg = v < 0;
  return (
    <td
      className="px-2 py-[3px] text-right tabular"
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

function RVChip({ signal, bp }: { signal: RVSignal; bp: number | null }) {
  const s = RV_STYLE[signal];
  const prefix = bp !== null && bp > 0 ? "+" : "";
  return (
    <span
      className="tabular text-caos-2xs px-1.5 py-px rounded whitespace-nowrap"
      style={{ background: s.bg, color: s.fg }}
      title={bp === null ? "No sector/rating benchmark" : `${prefix}${Math.round(bp)}bps versus sector rating median`}
    >
      {signal}{bp === null ? "" : ` ${prefix}${Math.round(bp)}`}
    </span>
  );
}

const td = "px-2 py-[3px] tabular whitespace-nowrap";

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
  }, [data, config, getVal]);
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

function PeerTable({ rows, preset = "full" }: { rows: RVRow[]; preset?: "full" | "market" | "rv" }) {
  // Default: lead with the actionable tail — cheapest (widest rvBp) on top.
  const [sort, setSort] = useState<SortConfig>({ col: "rv", asc: false });
  const [filters, setFilters] = useState<FilterState>({});
  const filterVal = useMemo<Record<string, (r: RVRow) => SortVal>>(() => ({
    company: (r: RVRow) => r.company, subSector: (r: RVRow) => r.subSector, subGroup: (r: RVRow) => r.subGroup,
    loanType: (r: RVRow) => r.loanType, figi: (r: RVRow) => r.figi, rank: (r: RVRow) => r.rank,
    rating: (r: RVRow) => r.rating, size: (r: RVRow) => r.size, margin: (r: RVRow) => r.margin,
    maturity: (r: RVRow) => r.maturity, bid: (r: RVRow) => r.bid, ask: (r: RVRow) => r.ask,
    liq: (r: RVRow) => r.liq, rv: (r: RVRow) => r.rv, ytm: (r: RVRow) => r.ytm, dm: (r: RVRow) => r.dm,
    ...Object.fromEntries(DELTA_COLS.map((_, i) => [`d${i}`, (r: RVRow) => r.d[i]])),
  }), []);
  const filtered = useColumnFilters(rows, filters, filterVal);
  const handleSort = (col: string) => setSort((p) => (p.col === col ? { col, asc: !p.asc } : { col, asc: true }));
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
  const sorted = useSort(filtered, sort, (r, c) => {
    if (c.startsWith("d")) return r.d[parseInt(c.substring(1))];
    if (c === "rv") return r.rvBp;
    return field(r, c);
  });

  const showCol = (key: string) => {
    if (preset === "full") return true;
    if (preset === "market") {
      return ["company", "subSector", "size", "margin", "maturity", "bid", "ask", "liq", "ytm", "dm"].includes(key);
    }
    if (preset === "rv") {
      return ["company", "rating", "liq", "rv", "d0", "d1", "dm"].includes(key);
    }
    return true;
  };

  const minWidthClass = preset === "full" ? "min-w-[1760px]" : preset === "market" ? "min-w-[1000px]" : "min-w-[760px]";

  return (
    <table aria-label="Sector relative value" className={`border-collapse text-caos-sm ${minWidthClass} w-full`}>
      <thead>
        <tr className="border-b border-caos-border">
          {showCol("company") && <SortTh label="Company" col="company" sort={sort} onSort={handleSort} rows={rows} getValue={filterVal.company} filters={filters} onFilter={setFilter} />}
          {showCol("rv") && <SortTh label="RV vs Bucket" col="rv" sort={sort} onSort={handleSort} rows={rows} getValue={filterVal.rv} filters={filters} onFilter={setFilter} />}
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
        {sorted.map((r, i) => (
          <tr key={r.figi + i} className="border-b border-caos-border/40 hover:bg-caos-elevated/50 transition-caos group">
            {showCol("company") && <td style={{ borderLeft: rvEdge(r.rv) }} className={td + " sticky left-0 z-10 bg-caos-panel text-caos-text group-hover:bg-caos-elevated/50 transition-colors"}>{r.company}</td>}
            {showCol("rv") && <td className={td}><RVChip signal={r.rv} bp={r.rvBp} /></td>}
            {showCol("subSector") && <td className={td + " text-caos-muted max-w-[260px] truncate"}>{r.subSector}</td>}
            {showCol("subGroup") && <td className={td + " text-caos-muted max-w-[260px] truncate"}>{r.subGroup}</td>}
            {showCol("loanType") && <td className={td + " text-caos-muted"}>{r.loanType}</td>}
            {showCol("figi") && <td className={td + " text-caos-accent"}>{r.figi}</td>}
            {showCol("rank") && <td className={td + " text-caos-muted"}>{r.rank}</td>}
            {showCol("rating") && <td className={td + " text-caos-text"}>{r.rating}</td>}
            {showCol("size") && <td className={td + " text-right text-caos-text"}>{r.size.toLocaleString()}</td>}
            {showCol("margin") && <td className={td + " text-right text-caos-text"}>{r.margin}</td>}
            {showCol("maturity") && <td className={td + " text-right text-caos-muted"}>{r.maturity}</td>}
            {showCol("bid") && <td className={td + " text-right text-caos-text"}>{r.bid.toFixed(2)}</td>}
            {showCol("ask") && <td className={td + " text-right text-caos-text"}>{r.ask.toFixed(2)}</td>}
            {showCol("liq") && <td className={td}><Chip liq={r.liq} label={r.liq} /></td>}
            {r.d.map((v, j) => (
              showCol(`d${j}`) && <DeltaCell key={j} v={v} />
            ))}
            {showCol("ytm") && <td className={td + " text-right text-caos-text"}>{r.ytm.toFixed(1)}</td>}
            {showCol("dm") && <td className={td + " text-right text-caos-text"}>{r.dm.toLocaleString()}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const fmt = (v: number | null, digits = 2) => (v === null ? "—" : v.toFixed(digits));

const bucketMedian = (xs: number[]): number | null => {
  const v = xs.filter((x) => x > 0).sort((a, b) => a - b);
  if (v.length < 2) return null; // matches the rvdata benchmark rule (n ≥ 2)
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};

// Sector RV made spatial: 3Y DM by rating bucket, one dot per loan, a tick at
// each bucket's benchmark median. Dots ABOVE the tick are wide (cheap), below
// are tight (rich) — vertical position carries the signal for colorblind users;
// hue doubles it. This is the "relative" the tables only implied.
function RVScatter({ rows, color }: { rows: RVRow[]; color: string }) {
  const W = 820, H = 200, padL = 46, padR = 14, padT = 12, padB = 24;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const present = BUCKETS.filter((b) => rows.some((r) => r.bucket === b));
  if (!present.length) return null;

  // Robust domain: clamp to the 5th–95th percentile so a single junk DM value
  // (the feed carries a few, e.g. 579,028bp) can't flatten the distribution.
  // Out-of-range dots pin to the plot edge; the real value stays in the tooltip.
  const dms = rows.map((r) => r.dm);
  const sortedDm = [...dms].sort((a, b) => a - b);
  const q = (p: number) => {
    const idx = (sortedDm.length - 1) * p;
    const l = Math.floor(idx), h = Math.ceil(idx);
    return sortedDm[l] + (sortedDm[h] - sortedDm[l]) * (idx - l);
  };
  const yMin = q(0.05), yMax = q(0.95);
  const pad = (yMax - yMin || 1) * 0.08;
  const lo = yMin - pad, hi = yMax + pad;
  const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
  const scaleY = (v: number) => clamp(padT + ((hi - v) / (hi - lo)) * plotH, padT, padT + plotH);
  const bandW = plotW / present.length;
  const bandX = (i: number) => padL + (i + 0.5) * bandW;
  const gridVals = [hi, (hi + lo) / 2, lo];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-full"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Three-year discount margin by rating bucket, with each bucket's benchmark median marked"
    >
      {gridVals.map((v, i) => (
        <g key={i}>
          <line x1={padL} y1={scaleY(v)} x2={W - padR} y2={scaleY(v)} stroke="var(--caos-border)" strokeWidth={1} strokeOpacity={0.5} />
          <text x={padL - 6} y={scaleY(v) + 3} textAnchor="end" fontSize={9} fill="var(--caos-muted)" className="tabular">{Math.round(v)}</text>
        </g>
      ))}
      <text x={13} y={padT + plotH / 2} textAnchor="middle" fontSize={9} fill="var(--caos-muted)" transform={`rotate(-90 13 ${padT + plotH / 2})`} className="uppercase tracking-wider">3Y DM (bp)</text>
      {/* baseline carries the active-sector color — the one place the sector hue does real work */}
      <line x1={padL} y1={padT + plotH} x2={W - padR} y2={padT + plotH} stroke={color} strokeWidth={1.5} strokeOpacity={0.6} />
      {present.map((bucket, i) => {
        const members = rows.filter((r) => r.bucket === bucket);
        const med = bucketMedian(members.map((r) => r.dm));
        const cx = bandX(i);
        const m = members.length;
        return (
          <g key={bucket}>
            {med !== null && (
              <line x1={cx - bandW * 0.32} y1={scaleY(med)} x2={cx + bandW * 0.32} y2={scaleY(med)} stroke="var(--caos-text)" strokeWidth={1.5} strokeOpacity={0.7}>
                <title>{`${bucket} benchmark · median 3Y DM ${Math.round(med)}bp`}</title>
              </line>
            )}
            {members.map((r, j) => {
              const off = m > 1 ? (j / (m - 1) - 0.5) * bandW * 0.62 : 0;
              return (
                <circle key={r.figi + j} cx={cx + off} cy={scaleY(r.dm)} r={3.4} fill={RV_STYLE[r.rv].fg} fillOpacity={0.85}>
                  <title>{`${r.company} · DM ${r.dm} · ${r.rv}${r.rvBp === null ? "" : ` ${r.rvBp > 0 ? "+" : ""}${Math.round(r.rvBp)}bp`}`}</title>
                </circle>
              );
            })}
            <text x={cx} y={H - 8} textAnchor="middle" fontSize={9} fill="var(--caos-muted)" className="tabular">{bucket}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function SectorRV() {
  const [active, setActive] = useState(0);
  const sector = RV_SECTORS[active];
  const averages = useMemo(() => ratingAverages(sector.rows), [sector]);
  const subSectorAvgs = useMemo(() => subSectorAverages(sector.rows), [sector]);

  const [colPreset, setColPreset] = useState<"full" | "market" | "rv">("rv");

  const [sortIdx, setSortIdx] = useState<SortConfig>({ col: null, asc: true });
  const handleSortIdx = (col: string) => setSortIdx((p) => (p.col === col ? { col, asc: !p.asc } : { col, asc: true }));
  const sortedIdx = useSort(INDEX_STATS, sortIdx, (r, c) => {
    if (c.startsWith("d")) return r.d[parseInt(c.substring(1))];
    return field(r, c);
  });

  const [sortSub, setSortSub] = useState<SortConfig>({ col: null, asc: true });
  const handleSortSub = (col: string) => setSortSub((p) => (p.col === col ? { col, asc: !p.asc } : { col, asc: true }));
  const sortedSub = useSort(subSectorAvgs, sortSub, (r, c) => {
    if (c.startsWith("d")) return r.d[parseInt(c.substring(1))];
    return field(r, c);
  });

  const [sortAvg, setSortAvg] = useState<SortConfig>({ col: null, asc: true });
  const handleSortAvg = (col: string) => setSortAvg((p) => (p.col === col ? { col, asc: !p.asc } : { col, asc: true }));
  const sortedAvg = useSort(averages, sortAvg, (r, c) => {
    if (c.startsWith("d")) return r.d[parseInt(c.substring(1))];
    return field(r, c);
  });

  return (
    <div className="flex flex-col gap-2 min-h-0 min-w-0 flex-1">
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
          className="focus-ring h-7 min-w-[220px] rounded border border-caos-border bg-caos-elevated px-2 tabular text-caos-sm text-caos-text outline-none transition-caos hover:border-caos-accent/60"
        >
          {RV_SECTORS.map((s, i) => (
            <option key={s.name} value={i}>{s.name}</option>
          ))}
        </select>
        <span className="flex-1" />
        <div className="flex items-center gap-1">
          <span className="shrink-0 tabular text-caos-2xs uppercase tracking-widest text-caos-muted mr-1">Lens</span>
          {([
            ["Full", "full"],
            ["Market", "market"],
            ["RV", "rv"],
          ] as const).map(([label, preset]) => (
            <button
              key={preset}
              type="button"
              onClick={() => setColPreset(preset)}
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
        </div>
        <span className="tabular text-caos-xs text-caos-muted whitespace-nowrap hidden xl:inline">
          {sector.rows.length} loans · market-data file
        </span>
      </div>

      {/* RV distribution — the spatial view of the "relative" the tables imply */}
      <PanelShell
        title={sector.name + " — RV Distribution"}
        className="h-[200px] shrink-0"
        right={
          <span className="tabular text-caos-xs text-caos-muted">
            3Y DM by rating · tick = bucket median · above = wide / cheap
          </span>
        }
      >
        <div className="h-full w-full px-2 py-1">
          <RVScatter rows={sector.rows} color={sector.color} />
        </div>
      </PanelShell>

      {/* peer table */}
      <PanelShell
        title={sector.name + " — Sector Peers · Relative Value"}
        className="flex-[3] min-h-0"
        right={
          <span className="tabular text-caos-xs text-caos-muted">
            RV = 3Y DM − sector×rating median (n ≥ 2) · sorted cheap → rich
          </span>
        }
      >
        <div className="overflow-auto h-full">
          <PeerTable rows={sector.rows} preset={colPreset} />
        </div>
      </PanelShell>

      {/* index stats + sub-sector averages + rating averages */}
      <div className="flex-[2] grid grid-cols-1 xl:grid-cols-3 gap-2 min-h-0">
        <PanelShell
          title="Market Data Summary"
          className="order-3"
          right={<span className="tabular text-caos-xs text-caos-muted">derived from file sectors</span>}
        >
          <div className="overflow-auto h-full">
            <table aria-label="Index statistics" className="border-collapse text-caos-sm w-full min-w-[760px]">
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
                      <DeltaCell key={j} v={v} />
                    ))}
                    <td className={td + " text-right text-caos-text"}>{s.ytm.toFixed(1)}</td>
                    <td className={td + " text-right text-caos-text"}>{s.dm.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PanelShell>

        <PanelShell
          title="Sub-Sector Market Average"
          className="order-2"
          right={<span className="tabular text-caos-xs text-caos-muted">{sector.name} · peer set</span>}
        >
          <div className="overflow-auto h-full">
            <table aria-label="Sub-sector market average" className="border-collapse text-caos-sm w-full min-w-[760px]">
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
                      <DeltaCell key={j} v={v} />
                    ))}
                    <td className={td + " text-right text-caos-text"}>{fmt(b.ytm, 1)}</td>
                    <td className={td + " text-right text-caos-text"}>{b.dm === null ? "—" : Math.round(b.dm).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PanelShell>

        <PanelShell
          title="Sector Ratings Average"
          className="order-1"
          right={<span className="tabular text-caos-xs text-caos-muted">{sector.name} · peer set</span>}
        >
          <div className="overflow-auto h-full">
            <table aria-label="Sector ratings average" className="border-collapse text-caos-sm w-full min-w-[760px]">
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
                      <DeltaCell key={j} v={v} />
                    ))}
                    <td className={td + " text-right text-caos-text"}>{fmt(b.ytm, 1)}</td>
                    <td className={td + " text-right text-caos-text"}>{b.dm === null ? "—" : Math.round(b.dm).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PanelShell>
      </div>
    </div>
  );
}
