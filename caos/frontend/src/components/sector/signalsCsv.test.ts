import { describe, expect, it } from "vitest";
import { signalsToCsv } from "./signalsCsv";
import type { SectorSignal } from "@/lib/api";

const base: SectorSignal = {
  id: "seed-industrials-2026-07-06-01",
  sector: "Industrials",
  signal_date: "2026-07-06T10:15:00Z",
  category: "earnings",
  severity: "high",
  headline: "Q2 order books soften",
  summary: "Distributor commentary points to slower short-cycle demand.",
  materiality_score: 0.9,
  issuers: [{ name: "Atlas Forge Industrials", ticker: "ATLF", exposure: "held" }],
  sources: [],
  provenance: "seed",
  staleness_flag: "seed",
  confidence: "fixture",
};

describe("signalsToCsv", () => {
  it("exports the header row plus one row per selected signal", () => {
    const csv = signalsToCsv([base]);
    expect(csv).toContain("id,sector,category,severity,headline,materiality_score,signal_date,issuers,provenance");
    expect(csv).toContain("seed-industrials-2026-07-06-01,Industrials,earnings,high,Q2 order books soften,0.9,2026-07-06T10:15:00Z,ATLF,seed");
  });

  it("neutralizes formula-trigger headlines and joins multiple issuers", () => {
    const rigged: SectorSignal = {
      ...base,
      headline: "=cmd|' /C calc'!A0",
      issuers: [
        { name: "Atlas Forge Industrials", ticker: "ATLF", exposure: "held" },
        { name: "Second Co", ticker: "SECO", exposure: "watch" },
      ],
    };
    const csv = signalsToCsv([rigged]);
    expect(csv).toContain("'=cmd|");
    expect(csv).toContain("ATLF; SECO");
  });

  it("returns just the header for an empty selection", () => {
    const csv = signalsToCsv([]);
    expect(csv.split("\n")).toHaveLength(1);
  });
});
