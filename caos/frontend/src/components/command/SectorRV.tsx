"use client";

// Concept A — Sector RV: sector-peer relative value tables in the desk-sheet
// format (issuer + loan data, spread-implied liquidity, mid RV assessment,
// price deltas), with US Leveraged Loan index statistics and per-rating
// averages. Sheet-tab toggle switches between sector tables.

import { useMemo, useState } from "react";
import { Panel as PanelShell } from "@/components/shared/Panel";
import {
  DELTA_COLS,
  INDEX_STATS,
  RV_LABEL,
  SECTORS,
  ratingAverages,
  type Liquidity,
  type RVRow,
} from "@/lib/command/rvdata";

const LIQ_STYLE: Record<Liquidity, { bg: string; fg: string }> = {
  High: { bg: "rgba(34,197,94,0.20)", fg: "#4ade80" },
  Normal: { bg: "rgba(34,197,94,0.09)", fg: "#86efac" },
  OK: { bg: "rgba(245,165,36,0.14)", fg: "#fbbf24" },
  Concerning: { bg: "rgba(239,68,68,0.16)", fg: "#f87171" },
  Impaired: { bg: "rgba(148,163,184,0.14)", fg: "#94a3b8" },
};

function DeltaCell({ v }: { v: number | null }) {
  if (v === null)
    return <td className="px-2 py-[5px] text-right tabular text-caos-muted/50">—</td>;
  const pos = v > 0;
  const neg = v < 0;
  return (
    <td
      className="px-2 py-[5px] text-right tabular"
      style={{
        color: pos ? "#4ade80" : neg ? "#f87171" : "var(--caos-muted)",
        background: pos ? "rgba(34,197,94,0.06)" : neg ? "rgba(239,68,68,0.06)" : undefined,
      }}
    >
      {v.toFixed(2)}
    </td>
  );
}

function Chip({ liq, label }: { liq: Liquidity; label: string }) {
  const s = LIQ_STYLE[liq];
  return (
    <span
      className="tabular text-[8.5px] px-1.5 py-px rounded whitespace-nowrap"
      style={{ background: s.bg, color: s.fg }}
    >
      {label}
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
    <th
      className={`px-2 py-[6px] tabular text-[8.5px] uppercase tracking-wider text-caos-muted whitespace-nowrap sticky top-0 bg-caos-panel z-10 cursor-pointer hover:text-caos-text transition-caos select-none ${align === "right" ? "text-right" : "text-left"}`}
      onClick={() => onSort(col)}
    >
      <div className={`flex items-center gap-1 ${align === "right" ? "justify-end" : "justify-start"}`}>
        {align === "right" && active && <span className="text-[10px] text-caos-accent">{sort.asc ? "↑" : "↓"}</span>}
        {label}
        {align === "left" && active && <span className="text-[10px] text-caos-accent">{sort.asc ? "↑" : "↓"}</span>}
      </div>
    </th>
  );
}

function PeerTable({ rows }: { rows: RVRow[] }) {
  const [sort, setSort] = useState<SortConfig>({ col: null, asc: true });
  const handleSort = (col: string) => setSort((p) => (p.col === col ? { col, asc: !p.asc } : { col, asc: true }));
  const sorted = useSort(rows, sort, (r, c) => {
    if (c.startsWith("d")) return r.d[parseInt(c.substring(1))];
    if (c === "rv") return RV_LABEL[r.liq] || "";
    return field(r, c);
  });

  return (
    <table className="border-collapse text-[9.5px] min-w-[1760px] w-full">
      <thead>
        <tr className="border-b border-caos-border">
          <SortTh label="Company" col="company" sort={sort} onSort={handleSort} />
          <SortTh label="Sub-Group" col="sub" sort={sort} onSort={handleSort} />
          <SortTh label="Pub/Priv" col="pub" sort={sort} onSort={handleSort} />
          <SortTh label="FIGI" col="figi" sort={sort} onSort={handleSort} />
          <SortTh label="Ranking" col="rank" sort={sort} onSort={handleSort} />
          <SortTh label="Rating" col="rating" sort={sort} onSort={handleSort} />
          <SortTh label="Size ($Mn)" col="size" align="right" sort={sort} onSort={handleSort} />
          <SortTh label="Margin" col="margin" align="right" sort={sort} onSort={handleSort} />
          <SortTh label="Maturity" col="maturity" align="right" sort={sort} onSort={handleSort} />
          <SortTh label="Bid" col="bid" align="right" sort={sort} onSort={handleSort} />
          <SortTh label="Ask" col="ask" align="right" sort={sort} onSort={handleSort} />
          <SortTh label="Liquidity" col="liq" sort={sort} onSort={handleSort} />
          <SortTh label="Mid RV" col="rv" sort={sort} onSort={handleSort} />
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
            <td className={td + " text-caos-muted max-w-[260px] truncate"}>{r.sub}</td>
            <td className={td + " text-caos-muted"}>{r.pub}</td>
            <td className={td + " text-caos-accent"}>{r.figi}</td>
            <td className={td + " text-caos-muted"}>{r.rank}</td>
            <td className={td + " text-caos-text"}>{r.rating}</td>
            <td className={td + " text-right text-caos-text"}>{r.size.toLocaleString()}</td>
            <td className={td + " text-right text-caos-text"}>{r.margin}</td>
            <td className={td + " text-right text-caos-muted"}>{r.maturity}</td>
            <td className={td + " text-right text-caos-text"}>{r.bid.toFixed(2)}</td>
            <td className={td + " text-right text-caos-text"}>{r.ask.toFixed(2)}</td>
            <td className={td}><Chip liq={r.liq} label={r.liq} /></td>
            <td className={td}><Chip liq={r.liq} label={RV_LABEL[r.liq]} /></td>
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
      {/* sheet tabs */}
      <div className="h-9 shrink-0 rounded border border-caos-border bg-caos-panel/60 px-3 flex items-center gap-1.5 overflow-x-auto">
        <span className="tabular text-[8.5px] uppercase tracking-widest text-caos-muted whitespace-nowrap mr-1.5">
          Sector tables
        </span>
        {SECTORS.map((s, i) => (
          <button
            key={s.name}
            onClick={() => setActive(i)}
            className={
              "flex items-center gap-1.5 tabular text-[9.5px] px-2.5 py-1 rounded border transition-caos whitespace-nowrap " +
              (i === active
                ? "bg-caos-elevated text-caos-text"
                : "border-caos-border text-caos-muted hover:text-caos-text")
            }
            style={i === active ? { borderColor: s.color } : undefined}
          >
            <span className="w-2 h-2 rounded-sm" style={{ background: s.color }} />
            {s.name}
          </button>
        ))}
        <span className="flex-1" />
        <span className="tabular text-[9px] text-caos-muted whitespace-nowrap hidden xl:inline">
          {sector.rows.length} loans · marks T-1 close
        </span>
      </div>

      {/* peer table */}
      <PanelShell
        title={sector.name + " — Sector Peers · Relative Value"}
        className="flex-[3] min-h-0"
        right={
          <span className="tabular text-[9px] text-caos-muted">
            issuer + loan data · spread-implied liquidity · CP-3 inputs
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
          title="Index Statistics"
          right={<span className="tabular text-[9px] text-caos-muted">Bloomberg US Leveraged Loan Index</span>}
        >
          <div className="overflow-auto h-full">
            <table className="border-collapse text-[9.5px] w-full min-w-[760px]">
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
          right={<span className="tabular text-[9px] text-caos-muted">computed from peer set</span>}
        >
          <div className="overflow-auto h-full">
            <table className="border-collapse text-[9.5px] w-full min-w-[760px]">
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
                    <td className={td + " text-right " + (b.n ? "text-caos-text" : "text-caos-muted/50")}>
                      {b.size === null ? "—" : Math.round(b.size).toLocaleString()}
                    </td>
                    <td className={td + " text-right " + (b.n ? "text-caos-text" : "text-caos-muted/50")}>
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
