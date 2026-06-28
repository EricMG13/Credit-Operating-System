"use client";

// Concept A — Sector RV: sector-peer relative value tables in the desk-sheet
// format (issuer + loan data, spread-implied liquidity, mid RV assessment,
// price deltas), with US Leveraged Loan index statistics and per-rating
// averages. Sector dropdown switches between sector tables.

import { useMemo, useState } from "react";
import { Panel as PanelShell } from "@/components/shared/Panel";
import {
  DELTA_COLS,
  INDEX_STATS,
  SECTORS,
  ratingAverages,
  type Liquidity,
  type RVRow,
  type RVSignal,
} from "@/lib/command/rvdata";

const LIQ_STYLE: Record<Liquidity, { bg: string; fg: string }> = {
  High: { bg: "rgba(34,197,94,0.20)", fg: "var(--caos-success-bright)" },
  Normal: { bg: "rgba(34,197,94,0.09)", fg: "var(--caos-success-bright)" },
  OK: { bg: "rgba(245,165,36,0.14)", fg: "var(--caos-warning-bright)" },
  Concerning: { bg: "rgba(239,68,68,0.16)", fg: "var(--caos-critical-bright)" },
  Impaired: { bg: "rgba(148,163,184,0.14)", fg: "var(--caos-muted)" },
};

const RV_STYLE: Record<RVSignal, { bg: string; fg: string }> = {
  Cheap: { bg: "rgba(34,197,94,0.20)", fg: "var(--caos-success-bright)" },
  Wide: { bg: "rgba(34,197,94,0.09)", fg: "var(--caos-success-bright)" },
  Inline: { bg: "rgba(79,140,255,0.12)", fg: "var(--caos-accent)" },
  Tight: { bg: "rgba(245,165,36,0.14)", fg: "var(--caos-warning-bright)" },
  Rich: { bg: "rgba(239,68,68,0.16)", fg: "var(--caos-critical-bright)" },
  "N/A": { bg: "rgba(148,163,184,0.14)", fg: "var(--caos-muted)" },
};

function DeltaCell({ v }: { v: number | null }) {
  if (v === null)
    return <td className="px-2 py-[5px] text-right tabular text-caos-muted">—</td>;
  const pos = v > 0;
  const neg = v < 0;
  return (
    <td
      className="px-2 py-[5px] text-right tabular"
      style={{
        color: pos ? "var(--caos-success-bright)" : neg ? "var(--caos-critical-bright)" : "var(--caos-muted)",
        background: pos ? "rgba(34,197,94,0.06)" : neg ? "rgba(239,68,68,0.06)" : undefined,
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

const td = "px-2 py-[5px] tabular whitespace-nowrap";

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

function SortTh({ label, align = "left", col, sort, onSort }: { label: string; align?: "left" | "right"; col: string; sort: SortConfig; onSort: (c: string) => void }) {
  const active = sort.col === col;
  return (
    // The clickable sort control is a real <button> (keyboard-operable, visible
    // focus ring); the <th> carries aria-sort so screen readers announce the
    // current sort direction. Previously a bare <th onClick> — mouse-only. (a11y)
    <th
      scope="col"
      aria-sort={active ? (sort.asc ? "ascending" : "descending") : "none"}
      className={`p-0 tabular text-caos-2xs uppercase tracking-wider text-caos-muted whitespace-nowrap sticky top-0 bg-caos-panel z-10 select-none ${align === "right" ? "text-right" : "text-left"}`}
    >
      <button
        type="button"
        onClick={() => onSort(col)}
        title={`Sort by ${label}`}
        className={`w-full px-2 py-[6px] inline-flex items-center gap-1 hover:text-caos-text transition-caos focus-ring ${align === "right" ? "justify-end" : "justify-start"}`}
      >
        {align === "right" && active && <span aria-hidden="true" className="text-caos-md text-caos-accent">{sort.asc ? "↑" : "↓"}</span>}
        {label}
        {align === "left" && active && <span aria-hidden="true" className="text-caos-md text-caos-accent">{sort.asc ? "↑" : "↓"}</span>}
      </button>
    </th>
  );
}

function PeerTable({ rows }: { rows: RVRow[] }) {
  const [sort, setSort] = useState<SortConfig>({ col: null, asc: true });
  const handleSort = (col: string) => setSort((p) => (p.col === col ? { col, asc: !p.asc } : { col, asc: true }));
  const sorted = useSort(rows, sort, (r, c) => {
    if (c.startsWith("d")) return r.d[parseInt(c.substring(1))];
    if (c === "rv") return r.rvBp;
    return field(r, c);
  });

  return (
    <table aria-label="Sector relative value" className="border-collapse text-caos-sm min-w-[1760px] w-full">
      <thead>
        <tr className="border-b border-caos-border">
          <SortTh label="Company" col="company" sort={sort} onSort={handleSort} />
          <SortTh label="Sub-Sector" col="subSector" sort={sort} onSort={handleSort} />
          <SortTh label="Sub-Group" col="subGroup" sort={sort} onSort={handleSort} />
          <SortTh label="Loan Type" col="loanType" sort={sort} onSort={handleSort} />
          <SortTh label="FIGI" col="figi" sort={sort} onSort={handleSort} />
          <SortTh label="Ranking" col="rank" sort={sort} onSort={handleSort} />
          <SortTh label="Rating" col="rating" sort={sort} onSort={handleSort} />
          <SortTh label="Size ($Mn)" col="size" align="right" sort={sort} onSort={handleSort} />
          <SortTh label="Margin" col="margin" align="right" sort={sort} onSort={handleSort} />
          <SortTh label="Maturity" col="maturity" align="right" sort={sort} onSort={handleSort} />
          <SortTh label="Bid" col="bid" align="right" sort={sort} onSort={handleSort} />
          <SortTh label="Ask" col="ask" align="right" sort={sort} onSort={handleSort} />
          <SortTh label="Liquidity" col="liq" sort={sort} onSort={handleSort} />
          <SortTh label="RV vs Bucket" col="rv" sort={sort} onSort={handleSort} />
          {DELTA_COLS.map((c, i) => (
            <SortTh key={c} label={c} col={`d${i}`} align="right" sort={sort} onSort={handleSort} />
          ))}
          <SortTh label="Mid YTM" col="ytm" align="right" sort={sort} onSort={handleSort} />
          <SortTh label="Mid 3Y DM" col="dm" align="right" sort={sort} onSort={handleSort} />
        </tr>
      </thead>
      <tbody>
        {sorted.map((r, i) => (
          <tr key={r.figi + i} className="border-b border-caos-border/40 hover:bg-caos-elevated/50 transition-caos">
            <td className={td + " text-caos-text"}>{r.company}</td>
            <td className={td + " text-caos-muted max-w-[260px] truncate"}>{r.subSector}</td>
            <td className={td + " text-caos-muted max-w-[260px] truncate"}>{r.subGroup}</td>
            <td className={td + " text-caos-muted"}>{r.loanType}</td>
            <td className={td + " text-caos-accent"}>{r.figi}</td>
            <td className={td + " text-caos-muted"}>{r.rank}</td>
            <td className={td + " text-caos-text"}>{r.rating}</td>
            <td className={td + " text-right text-caos-text"}>{r.size.toLocaleString()}</td>
            <td className={td + " text-right text-caos-text"}>{r.margin}</td>
            <td className={td + " text-right text-caos-muted"}>{r.maturity}</td>
            <td className={td + " text-right text-caos-text"}>{r.bid.toFixed(2)}</td>
            <td className={td + " text-right text-caos-text"}>{r.ask.toFixed(2)}</td>
            <td className={td}><Chip liq={r.liq} label={r.liq} /></td>
            <td className={td}><RVChip signal={r.rv} bp={r.rvBp} /></td>
            {r.d.map((v, j) => (
              <DeltaCell key={j} v={v} />
            ))}
            <td className={td + " text-right text-caos-text"}>{r.ytm.toFixed(1)}</td>
            <td className={td + " text-right text-caos-text"}>{r.dm.toLocaleString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const fmt = (v: number | null, digits = 2) => (v === null ? "—" : v.toFixed(digits));

export function SectorRV() {
  const [active, setActive] = useState(0);
  const sector = SECTORS[active];
  const averages = useMemo(() => ratingAverages(sector.rows), [sector]);

  const [sortIdx, setSortIdx] = useState<SortConfig>({ col: null, asc: true });
  const handleSortIdx = (col: string) => setSortIdx((p) => (p.col === col ? { col, asc: !p.asc } : { col, asc: true }));
  const sortedIdx = useSort(INDEX_STATS, sortIdx, (r, c) => {
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
      <div className="h-9 shrink-0 rounded border border-caos-border bg-caos-panel/60 px-3 flex items-center gap-2 overflow-x-auto">
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
          {SECTORS.map((s, i) => (
            <option key={s.name} value={i}>{s.name}</option>
          ))}
        </select>
        <span className="flex-1" />
        <span className="tabular text-caos-xs text-caos-muted whitespace-nowrap hidden xl:inline">
          {sector.rows.length} loans · market-data file
        </span>
      </div>

      {/* peer table */}
      <PanelShell
        title={sector.name + " — Sector Peers · Relative Value"}
        className="flex-[3] min-h-0"
        right={
          <span className="tabular text-caos-xs text-caos-muted">
            issuer + loan data · liquidity · RV versus sector/rating median
          </span>
        }
      >
        <div className="overflow-auto h-full">
          <PeerTable rows={sector.rows} />
        </div>
      </PanelShell>

      {/* index stats + rating averages */}
      <div className="flex-[2] grid grid-cols-2 gap-2 min-h-0">
        <PanelShell
          title="Market Data Summary"
          right={<span className="tabular text-caos-xs text-caos-muted">derived from file sectors</span>}
        >
          <div className="overflow-auto h-full">
            <table aria-label="Index statistics" className="border-collapse text-caos-sm w-full min-w-[760px]">
              <thead>
                <tr className="border-b border-caos-border">
                  <SortTh label="Index" col="name" sort={sortIdx} onSort={handleSortIdx} />
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
          title={"Sector Ratings Average · " + sector.name}
          right={<span className="tabular text-caos-xs text-caos-muted">computed from peer set</span>}
        >
          <div className="overflow-auto h-full">
            <table aria-label="Sector ratings average" className="border-collapse text-caos-sm w-full min-w-[760px]">
              <thead>
                <tr className="border-b border-caos-border">
                  <SortTh label="Rating" col="bucket" sort={sortAvg} onSort={handleSortAvg} />
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
