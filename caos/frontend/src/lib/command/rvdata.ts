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
  const comps = validRows.filter((x) => `${x.sector}|${ratingBucket(x.ratings)}` === key).map((x) => x.mid3yDm).filter((x): x is number => isNum(x) && x > 0);
  dmBenchmarks.set(
    key,
    comps.length < 2 ? null : median(comps)
  );
}

const rows: RVRow[] = validRows.map((r) => {
  const bucket = ratingBucket(r.ratings);
  const benchmark = dmBenchmarks.get(`${r.sector}|${bucket}`) ?? null;
  const rvBp = benchmark === null ? null : r.mid3yDm! - benchmark;
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

export const SECTORS: Sector[] = [...new Set(rows.map((r) => r.sector))].map((name) => ({
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

export const INDEX_STATS: IndexStat[] = SECTORS.map((sector) => {
  const mids = sector.rows.map((r) => (r.bid + r.ask) / 2);
  return {
    name: sector.name,
    n: sector.rows.length,
    mv: sector.rows.reduce((sum, r) => sum + r.size, 0) / 1000,
    avgPrice: mean(mids) ?? 0,
    d: DELTA_COLS.map((_, i) => mean(sector.rows.map((r) => r.d[i]).filter(isNum))),
    ytm: mean(sector.rows.map((r) => r.ytm)) ?? 0,
    dm: mean(sector.rows.map((r) => r.dm)) ?? 0,
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

const averageRow = (members: RVRow[]) => ({
  n: members.length,
  size: mean(members.map((r) => r.size)),
  margin: mean(members.map((r) => r.margin)),
  bid: mean(members.map((r) => r.bid)),
  ask: mean(members.map((r) => r.ask)),
  d: DELTA_COLS.map((_, i) => mean(members.map((r) => r.d[i]).filter(isNum))),
  ytm: mean(members.map((r) => r.ytm)),
  dm: mean(members.map((r) => r.dm)),
});

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
