// Sector RV dataset — normalized from the market-data CSV feed.

import marketRows from "./market-data.json";

export type Liquidity = "High" | "Normal" | "OK" | "Concerning" | "Impaired";
export type RVSignal = "Cheap" | "Wide" | "Inline" | "Tight" | "Rich" | "N/A";

export const DELTA_COLS = ["Δ 1M", "Δ YTD"];

export interface RVRow {
  company: string;
  sector: string;
  subSector: string;
  subGroup: string;
  loanType: string;
  figi: string;
  rank: string;
  rating: string;
  bucket: string;
  size: number;
  margin: number;
  maturity: string;
  bid: number;
  ask: number;
  liq: Liquidity;
  rv: RVSignal;
  rvBp: number | null;
  d: (number | null)[];
  ytm: number;
  dm: number;
}

interface MarketDataInput {
  company: string;
  sector: string;
  subSector: string;
  subGroup: string;
  bloombergId: string;
  loanType: string;
  ranking: string;
  ratings: string;
  size: number | null;
  margin: number | null;
  maturity: string;
  bid: number | null;
  ask: number | null;
  d1m: number | null;
  ytd: number | null;
  midYtm: number | null;
  mid3yDm: number | null;
}

const RAW_ROWS = marketRows as MarketDataInput[];

const SECTOR_COLORS: Record<string, string> = {
  Industrials: "#38bdf8",
  "Consumer Discretionary": "#f87171",
  Energy: "#f5a524",
  Utilities: "#2dd4bf",
  Financials: "#a78bfa",
  "Real Estate": "#64748b",
  "Consumer Staples": "#4ade80",
  "Health Care": "#fb923c",
  "Information Technology": "#22d3ee",
  Media: "#f472b6",
  Entertainment: "#facc15",
  "Technology Hardware": "#818cf8",
  "IT Services": "#34d399",
  Software: "#60a5fa",
  Telecoms: "#c084fc",
  Materials: "#94a3b8",
  "Communication Services": "#e879f9",
};

const BUCKETS = ["Ba1", "Ba2", "Ba3", "B1", "B2", "B3", "Caa1", "Caa2", "Caa3", "NR"];
const SP_TO_MOODYS: Record<string, string> = {
  "BB+": "Ba1",
  BB: "Ba2",
  "BB-": "Ba3",
  "B+": "B1",
  B: "B2",
  "B-": "B3",
  "CCC+": "Caa1",
  CCC: "Caa2",
  "CCC-": "Caa3",
  CC: "Caa3",
};

const isNum = (x: number | null | undefined): x is number => typeof x === "number" && Number.isFinite(x);

// A leveraged-loan mark can be deeply distressed (bid <70 → DM in the low
// thousands of bps, YTM ~40%), but a 4-figure YTM or a 5-figure DM is a corrupt
// feed row, not a signal — one such value poisons every sector/bucket mean and
// median it lands in (a raw 579,028bp DM turns the RV signal into "Cheap +…" and
// blows up the sector average). `isNum` accepts these because they are finite;
// this gate rejects them from all RV math while the row itself stays in the peer
// table. Ceilings sit well above the real distressed tail (~3,300bp / ~36% on
// this feed) and orders of magnitude below the garbage (≥6,900bp / ≥72%).
// ponytail: flat ceiling; revisit only if a genuine mark ever legitimately clears it.
const DM_CEILING = 5000; // bps
const YTM_CEILING = 60; // %
export const isPlausibleMark = (ytm: number | null | undefined, dm: number | null | undefined): boolean =>
  isNum(ytm) && ytm > 0 && ytm <= YTM_CEILING && isNum(dm) && dm > 0 && dm <= DM_CEILING;

const mean = (xs: number[]): number | null => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
const median = (xs: number[]): number | null => {
  if (!xs.length) return null;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const ratingBucket = (rating: string): string => {
  for (const side of rating.split(/\s+\/\s+/).map((s) => s.trim())) {
    const raw = side.toUpperCase();
    const token = side.split(" ")[0] || "";
    const clean = token.replace(/[^A-Za-z0-9+-]/g, "");
    if (clean === "NR") return "NR";
    if (!clean || raw.includes("N/A") || clean === "IA" || clean === "WR") continue;
    if (BUCKETS.includes(clean)) return clean;
    if (SP_TO_MOODYS[clean]) return SP_TO_MOODYS[clean];
  }
  return "NR";
};

const liquidity = (bid: number, ask: number, ytm: number, dm: number): Liquidity => {
  const width = ask - bid;
  if (bid < 70) return "Impaired";
  if (bid < 90 || width >= 1.5 || ytm >= 12 || dm >= 1000) return "Concerning";
  if (width > 0.75 || ytm >= 9 || dm >= 650) return "OK";
  if (width <= 0.5 && bid >= 99) return "High";
  return "Normal";
};

const rvSignal = (rvBp: number | null): RVSignal => {
  if (rvBp === null) return "N/A";
  if (rvBp >= 150) return "Cheap";
  if (rvBp >= 50) return "Wide";
  if (rvBp <= -150) return "Rich";
  if (rvBp <= -50) return "Tight";
  return "Inline";
};

const validRows = RAW_ROWS.filter((r) =>
  r.company && r.sector && isNum(r.size) && isNum(r.margin) && isNum(r.bid) && isNum(r.ask) && isNum(r.midYtm) && isNum(r.mid3yDm)
);

const dmBenchmarks = new Map<string, number | null>();

for (const r of validRows) {
  const key = `${r.sector}|${ratingBucket(r.ratings)}`;
  if (dmBenchmarks.has(key)) continue;
  const comps = validRows
    .filter((x) => `${x.sector}|${ratingBucket(x.ratings)}` === key && isPlausibleMark(x.midYtm, x.mid3yDm))
    .map((x) => x.mid3yDm)
    .filter((x): x is number => isNum(x) && x > 0);
  dmBenchmarks.set(
    key,
    comps.length < 2 ? null : median(comps)
  );
}

const rows: RVRow[] = validRows.map((r) => {
  const bucket = ratingBucket(r.ratings);
  const benchmark = dmBenchmarks.get(`${r.sector}|${bucket}`) ?? null;
  // No RV signal for an implausible mark — it must not surface as "Cheap +…" or
  // sort to the top of the RV column.
  const rvBp = benchmark === null || !isPlausibleMark(r.midYtm, r.mid3yDm) ? null : r.mid3yDm! - benchmark;
  return {
    company: r.company,
    sector: r.sector,
    subSector: r.subSector,
    subGroup: r.subGroup,
    loanType: r.loanType,
    figi: r.bloombergId.toUpperCase(),
    rank: r.ranking,
    rating: r.ratings,
    bucket,
    size: r.size!,
    margin: r.margin!,
    maturity: r.maturity,
    bid: r.bid!,
    ask: r.ask!,
    liq: liquidity(r.bid!, r.ask!, r.midYtm!, r.mid3yDm!),
    rv: rvSignal(rvBp),
    rvBp,
    d: [r.d1m, r.ytd],
    ytm: r.midYtm!,
    dm: r.mid3yDm!,
  };
});

export interface Sector {
  name: string;
  color: string;
  rows: RVRow[];
}

export const RV_SECTORS: Sector[] = [...new Set(rows.map((r) => r.sector))].map((name) => ({
  name,
  color: SECTOR_COLORS[name] ?? "#a1a1b5",
  rows: rows.filter((r) => r.sector === name),
}));

export interface IndexStat {
  name: string;
  n: number;
  mv: number;
  avgPrice: number;
  d: (number | null)[];
  ytm: number;
  dm: number;
}

export const INDEX_STATS: IndexStat[] = RV_SECTORS.map((sector) => {
  const mids = sector.rows.map((r) => (r.bid + r.ask) / 2);
  // Average yield/DM only over plausible marks so one garbage row can't skew the
  // sector stat by orders of magnitude. Count/MV/price stay over all rows.
  const priced = sector.rows.filter((r) => isPlausibleMark(r.ytm, r.dm));
  return {
    name: sector.name,
    n: sector.rows.length,
    mv: sector.rows.reduce((sum, r) => sum + r.size, 0) / 1000,
    avgPrice: mean(mids) ?? 0,
    d: DELTA_COLS.map((_, i) => mean(sector.rows.map((r) => r.d[i]).filter(isNum))),
    ytm: mean(priced.map((r) => r.ytm)) ?? 0,
    dm: mean(priced.map((r) => r.dm)) ?? 0,
  };
});

export interface RatingAvg {
  bucket: string;
  n: number;
  size: number | null;
  margin: number | null;
  bid: number | null;
  ask: number | null;
  d: (number | null)[];
  ytm: number | null;
  dm: number | null;
}

const averageRow = (members: RVRow[]) => {
  // Same rule as the index stats: yield/DM averages skip implausible marks so a
  // corrupt row can't poison the bucket/sub-sector average it falls into.
  const priced = members.filter((r) => isPlausibleMark(r.ytm, r.dm));
  return {
    n: members.length,
    size: mean(members.map((r) => r.size)),
    margin: mean(members.map((r) => r.margin)),
    bid: mean(members.map((r) => r.bid)),
    ask: mean(members.map((r) => r.ask)),
    d: DELTA_COLS.map((_, i) => mean(members.map((r) => r.d[i]).filter(isNum))),
    ytm: mean(priced.map((r) => r.ytm)),
    dm: mean(priced.map((r) => r.dm)),
  };
};

export interface SubSectorAvg extends Omit<RatingAvg, "bucket"> {
  subSector: string;
}

export function subSectorAverages(data: RVRow[]): SubSectorAvg[] {
  return [...new Set(data.map((r) => r.subSector))].map((subSector) => ({
    subSector,
    ...averageRow(data.filter((r) => r.subSector === subSector)),
  }));
}

export function ratingAverages(data: RVRow[]): RatingAvg[] {
  return BUCKETS.map((bucket) => {
    const members = data.filter((r) => r.bucket === bucket);
    return {
      bucket,
      ...averageRow(members),
    };
  }).filter((b) => b.n > 0 || ["Caa2", "NR"].includes(b.bucket));
}
