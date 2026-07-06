// Sector RV dataset — normalized from the market-data CSV feed.

import marketRows from "./market-data.json";

export type Liquidity = "High" | "Normal" | "OK" | "Concerning" | "Impaired";
export type RVSignal = "Cheap" | "Wide" | "Inline" | "Tight" | "Rich" | "N/A";

export const DELTA_COLS = ["Δ 1M", "Δ YTD"];
export const RV_AS_OF = "2026-07-06";
export const RV_FILE_LABEL = "Jun 29 08:39";
export const RV_SOURCE = "market-data.json";
export const RV_THRESHOLDS = {
  cheap: 150,
  wide: 50,
  tight: -50,
  rich: -150,
} as const;

export type RVStaleness = {
  label: "CURRENT (0–90d)" | "POTENTIALLY STALE (91–180d)" | "STALE (>180d)" | "UNKNOWN";
  tone: "success" | "warning" | "critical";
};

export function rvStaleness(asOf = RV_AS_OF, now = new Date()): RVStaleness {
  const asOfTime = Date.parse(`${asOf}T00:00:00Z`);
  if (Number.isNaN(asOfTime)) return { label: "UNKNOWN", tone: "warning" };

  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const ageDays = Math.max(0, Math.floor((todayUtc - asOfTime) / (1000 * 60 * 60 * 24)));
  if (ageDays <= 90) return { label: "CURRENT (0–90d)", tone: "success" };
  if (ageDays <= 180) return { label: "POTENTIALLY STALE (91–180d)", tone: "warning" };
  return { label: "STALE (>180d)", tone: "critical" };
}

export interface BenchmarkProvenance {
  asOf: string;
  peerSet: string;
  n: number;
  source: string;
  credible: boolean;
}

export interface InstrumentRV {
  status: "insufficient";
  reason: string;
  liq: Liquidity;
  maturity: string | null;
}

export interface PortfolioRV {
  held: boolean;
  headroomPct?: number;
}

export type RVHolding = { held: boolean; headroomPct?: number };
export type RVHoldingInput = {
  id?: string | null;
  figi?: string | null;
  name?: string | null;
  borrower?: string | null;
  headroomPct?: number;
};

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
  maturity: string | null;
  bid: number;
  ask: number;
  liq: Liquidity;
  rv: RVSignal;
  rvBp: number | null;
  rvProvenance: BenchmarkProvenance | null;
  instrumentRv: InstrumentRV;
  portfolioRv: PortfolioRV;
  carryRv: number | null;
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

export const BUCKETS = ["Ba1", "Ba2", "Ba3", "B1", "B2", "B3", "Caa1", "Caa2", "Caa3", "NR"];
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
  if (rvBp >= RV_THRESHOLDS.cheap) return "Cheap";
  if (rvBp >= RV_THRESHOLDS.wide) return "Wide";
  if (rvBp <= RV_THRESHOLDS.rich) return "Rich";
  if (rvBp <= RV_THRESHOLDS.tight) return "Tight";
  return "Inline";
};

const MAX_CREDIBLE_DM_BP = 5000;
const credibleDm = (dm: number | null | undefined): dm is number =>
  isNum(dm) && dm > 0 && dm < MAX_CREDIBLE_DM_BP;

const validRows = RAW_ROWS.filter((r) =>
  r.company && r.sector && isNum(r.size) && isNum(r.margin) && isNum(r.bid) && isNum(r.ask) && isNum(r.midYtm) && isNum(r.mid3yDm)
);

const parseMaturityYears = (maturityStr: string | null | undefined): number | null => {
  if (!maturityStr) return null;
  const d = new Date(maturityStr);
  if (Number.isNaN(d.getTime())) {
    const m = maturityStr.match(/'?(\d{2})/);
    if (m) {
      const year = 2000 + parseInt(m[1]);
      const currentYear = parseInt(RV_AS_OF.slice(0, 4), 10);
      return Math.max(0.1, year - currentYear);
    }
    return null;
  }
  const diffMs = d.getTime() - Date.parse(`${RV_AS_OF}T00:00:00Z`);
  const years = diffMs / (1000 * 60 * 60 * 24 * 365.25);
  return Math.max(0.1, years);
};

const addHoldingKey = (map: Map<string, RVHolding>, key: string | null | undefined, holding: RVHolding) => {
  const normalized = key?.trim();
  if (normalized) map.set(normalized.toUpperCase(), holding);
};

export function buildRVHoldingsMap(items: RVHoldingInput[]): Map<string, RVHolding> {
  const map = new Map<string, RVHolding>();
  for (const item of items) {
    const holding: RVHolding = item.headroomPct === undefined ? { held: true } : { held: true, headroomPct: item.headroomPct };
    addHoldingKey(map, item.figi, holding);
    addHoldingKey(map, item.id, holding);
    addHoldingKey(map, item.name, holding);
    addHoldingKey(map, item.borrower, holding);
  }
  return map;
}

export function buildRVRows(holdings?: Map<string, RVHolding>): RVRow[] {
  const holdingsMap = holdings || new Map<string, RVHolding>();
  const dmBenchmarks = new Map<string, { median: number | null; n: number }>();

  for (const r of validRows) {
    const key = `${r.sector}|${ratingBucket(r.ratings)}`;
    if (dmBenchmarks.has(key)) continue;
    const comps = validRows.filter((x) => `${x.sector}|${ratingBucket(x.ratings)}` === key).map((x) => x.mid3yDm).filter(credibleDm);
    dmBenchmarks.set(key, {
      median: comps.length < 2 ? null : median(comps),
      n: comps.length,
    });
  }

  return validRows.map((r) => {
    const bucket = ratingBucket(r.ratings);
    const benchInfo = dmBenchmarks.get(`${r.sector}|${bucket}`);
    const benchmark = benchInfo?.median ?? null;
    const isCredible = credibleDm(r.mid3yDm);
    const rvBp = benchmark === null || !isCredible ? null : r.mid3yDm! - benchmark;
    const figi = r.bloombergId.toUpperCase();
    const peerN = benchInfo?.n ?? 0;

    const rvProvenance: BenchmarkProvenance | null = rvBp !== null ? {
      asOf: RV_AS_OF,
      peerSet: "sector×bucket",
      n: peerN,
      source: RV_SOURCE,
      credible: isCredible && peerN >= 2,
    } : null;

    const instrumentRv: InstrumentRV = {
      status: "insufficient",
      reason: "No recovery/LGD data in feed",
      liq: liquidity(r.bid!, r.ask!, r.midYtm!, r.mid3yDm!),
      maturity: r.maturity || null,
    };

    const holding = holdingsMap.get(figi) || holdingsMap.get(r.company.toUpperCase()) || { held: false };
    const portfolioRv: PortfolioRV = {
      held: holding.held,
      headroomPct: holding.headroomPct,
    };

    const years = parseMaturityYears(r.maturity);
    const carryRv = rvBp !== null && years !== null ? rvBp / years : null;

    return {
      company: r.company,
      sector: r.sector,
      subSector: r.subSector,
      subGroup: r.subGroup,
      loanType: r.loanType,
      figi,
      rank: r.ranking,
      rating: r.ratings,
      bucket,
      size: r.size!,
      margin: r.margin!,
      maturity: r.maturity || null,
      bid: r.bid!,
      ask: r.ask!,
      liq: liquidity(r.bid!, r.ask!, r.midYtm!, r.mid3yDm!),
      rv: rvSignal(rvBp),
      rvBp,
      rvProvenance,
      instrumentRv,
      portfolioRv,
      carryRv,
      d: [r.d1m, r.ytd],
      ytm: r.midYtm!,
      dm: r.mid3yDm!,
    };
  });
}

export function invalidationTrigger(rvBp: number | null, n: number): string {
  if (rvBp === null) return "—";
  if (rvBp >= RV_THRESHOLDS.cheap) {
    return n < 4
      ? "rvBp compresses to < +50bp and peer-set n improves to ≥4"
      : "rvBp compresses to < +50bp";
  }
  if (rvBp >= RV_THRESHOLDS.wide) return "rvBp compresses to < +10bp";
  return "baseline change";
}

export interface CrossSectorCell {
  median: number | null;
  n: number;
}

export function crossSectorMatrix(rowsList: RVRow[]): Record<string, Record<string, CrossSectorCell>> {
  const sectors = [...new Set(rowsList.map((r) => r.sector))];
  const matrix: Record<string, Record<string, CrossSectorCell>> = {};
  for (const sector of sectors) {
    matrix[sector] = {};
    for (const bucket of BUCKETS) {
      const cohort = rowsList.filter((r) => r.sector === sector && r.bucket === bucket && r.rvBp !== null);
      const medianVal = cohort.length < 2 ? null : median(cohort.map((r) => r.rvBp as number));
      matrix[sector][bucket] = {
        median: medianVal,
        n: cohort.length,
      };
    }
  }
  return matrix;
}

export const rows = buildRVRows();

export interface Sector {
  name: string;
  color: string;
  rows: RVRow[];
}

export const buildRVSectors = (rowsList: RVRow[]): Sector[] => [...new Set(rowsList.map((r) => r.sector))].map((name) => ({
  name,
  color: SECTOR_COLORS[name] ?? "#a1a1b5",
  rows: rowsList.filter((r) => r.sector === name),
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

export const buildIndexStats = (sectors: Sector[]): IndexStat[] => sectors.map((sector) => {
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

export const RV_SECTORS: Sector[] = buildRVSectors(rows);
export const INDEX_STATS: IndexStat[] = buildIndexStats(RV_SECTORS);

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
  }).filter((b) => b.n > 0);
}
