import { describe, expect, it } from "vitest";
import { buildModel } from "./model";
import { DEFAULT_ASSUMPTIONS, DEFAULT_CASE, type Assumptions } from "./assumptions";
import type { ModelAnchor } from "@/lib/engine/modelAnchor";

// Build an Assumptions with one base-case field overridden.
const withBase = (patch: Partial<typeof DEFAULT_CASE>): Assumptions => ({
  base: { ...DEFAULT_CASE, ...patch },
  down: { ...DEFAULT_CASE },
});

// A live anchor deliberately offset from the seeded build, so the test proves
// the override actually re-bases l1/pf (rather than coinciding by construction).
const ANCHOR: ModelAnchor = {
  ltmRevenue: 2850,
  ltmAdjEbitda: 450,
  netDebt: 2500,
  netLeverage: 5.9,
  intCov: 2.0,
};

const FORECAST = ["b0", "b1", "b2", "d0", "d1", "d2"] as const;

describe("buildModel — seeded baseline", () => {
  it("reports an LTM net leverage that ties to CP-1's 5.68x", () => {
    const m = buildModel();
    expect(m.provenance.anchored).toBe(false);
    expect(m.cols.l1.netlev!).toBeCloseTo(5.68, 1);
    expect(m.provenance.seededLtmNetlev).toBeCloseTo(m.cols.l1.netlev!, 5);
  });

  it("degrades leverage and coverage when adjusted EBITDA is non-positive", () => {
    const m = buildModel(1, { "f22:adj": -100 });
    expect(m.cols.f22.srsec).toBeNull();
    expect(m.cols.f22.totlev).toBeNull();
    expect(m.cols.f22.netlev).toBeNull();
    expect(m.cols.f22.intcov).toBeNull();
  });
});

describe("buildModel — forecast assumptions", () => {
  it("default assumptions reproduce the agent build exactly", () => {
    const a = buildModel();
    const b = buildModel(1, {}, undefined, DEFAULT_ASSUMPTIONS);
    for (const k of FORECAST) {
      expect(b.cols[k].rev).toBeCloseTo(a.cols[k].rev, 9);
      expect(b.cols[k].adj).toBeCloseTo(a.cols[k].adj, 9);
      expect(b.cols[k].netlev!).toBeCloseTo(a.cols[k].netlev!, 9);
      expect(b.cols[k].fcf).toBeCloseTo(a.cols[k].fcf, 9);
    }
  });

  it("uses the seeded annual SOFR and cash-interest curves as the no-op baseline", () => {
    const m = buildModel();
    expect([m.cols.b0.sofr, m.cols.b1.sofr, m.cols.b2.sofr]).toEqual([3.8, 3.5, 3.3]);
    expect([m.cols.b0.int, m.cols.b1.int, m.cols.b2.int]).toEqual([196, 188, 180]);
    expect([m.cols.d0.sofr, m.cols.d1.sofr, m.cols.d2.sofr]).toEqual([3.3, 3, 3]);
    expect([m.cols.d0.int, m.cols.d1.int, m.cols.d2.int]).toEqual([200, 196, 190]);
  });

  it("applies a SOFR delta to the floating debt base and preserves the seeded baseline", () => {
    const base = buildModel();
    const up = buildModel(1, {}, undefined, withBase({ sofrDelta: 0.01 }));
    const floatingDebt = 55 + 1406 + 900;
    expect(up.cols.b0.sofr).toBeCloseTo(base.cols.b0.sofr + 1, 9);
    expect(up.cols.b0.int).toBeCloseTo(base.cols.b0.int + floatingDebt * 0.01, 9);
    expect(up.cols.d0.int).toBe(base.cols.d0.int);
  });

  it("a positive growth delta lifts base revenue; only the base case moves", () => {
    const base = buildModel();
    const up = buildModel(1, {}, undefined, withBase({ gDrive: 0.05, gFluid: 0.05, gAfter: 0.05 }));
    expect(up.cols.b0.rev).toBeGreaterThan(base.cols.b0.rev);
    expect(up.cols.d0.rev).toBe(base.cols.d0.rev); // downside untouched
  });

  it("an adj-margin delta moves adj. EBITDA but not revenue", () => {
    const base = buildModel();
    const up = buildModel(1, {}, undefined, withBase({ dAdjm: 0.02 }));
    expect(up.cols.b0.rev).toBeCloseTo(base.cols.b0.rev, 9);
    expect(up.cols.b0.adjm).toBeCloseTo(base.cols.b0.adjm + 0.02, 9);
    expect(up.cols.b0.adj).toBeGreaterThan(base.cols.b0.adj);
  });

  it("scaling cash interest down lifts FFO and FCF (derived lines move)", () => {
    const base = buildModel();
    const cut = buildModel(1, {}, undefined, withBase({ mInt: 0.5 }));
    expect(cut.cols.b0.int).toBeCloseTo(base.cols.b0.int * 0.5, 6);
    expect(cut.cols.b0.ffo).toBeGreaterThan(base.cols.b0.ffo);
    expect(cut.cols.b0.fcf).toBeGreaterThan(base.cols.b0.fcf);
  });

  it("D&A % of sales changes D&A and EBIT, leaving EBITDA and adj. EBITDA flat", () => {
    const base = buildModel();
    const hi = buildModel(1, {}, undefined, withBase({ daPct: 0.06 }));
    expect(hi.cols.b0.da).toBeGreaterThan(base.cols.b0.da);
    expect(hi.cols.b0.ebit).toBeLessThan(base.cols.b0.ebit);
    expect(hi.cols.b0.ebitda).toBeCloseTo(base.cols.b0.ebitda, 9); // EBITDA = adj − addbacks
  });

  it("disallowing an add-back deducts the unrealised amount from Adj. EBITDA, EBITDA flat", () => {
    const base = buildModel();
    const cut = buildModel(1, {}, undefined, withBase({ abSbc: 0 })); // reject stock-based comp
    const gross = base.cols.b0.abAccts[2];
    expect(cut.cols.b0.abAccts[2]).toBeCloseTo(gross, 9);          // gross register unchanged
    expect(cut.cols.b0.ab).toBeCloseTo(base.cols.b0.ab - gross, 9); // net add-backs drop by that account
    expect(cut.cols.b0.adj).toBeCloseTo(base.cols.b0.adj - gross, 9); // unrealised amount deducted
    expect(cut.cols.b0.ebitda).toBeCloseTo(base.cols.b0.ebitda, 9); // reported EBITDA unchanged
    expect(cut.cols.b0.netlev!).toBeGreaterThan(base.cols.b0.netlev!); // leverage rises
  });

  it("a year override applies to that forecast year only (FY27e), not its siblings", () => {
    const base = buildModel();
    const y = buildModel(1, {}, undefined, { base: { ...DEFAULT_CASE }, down: { ...DEFAULT_CASE }, baseYears: { 1: { dAdjm: 0.03 } } });
    expect(y.cols.b0.adjm).toBeCloseTo(base.cols.b0.adjm, 9); // FY26e untouched
    expect(y.cols.b1.adjm).toBeCloseTo(base.cols.b1.adjm + 0.03, 9); // FY27e moved
    expect(y.cols.b2.adjm).toBeCloseTo(base.cols.b2.adjm, 9); // FY28e untouched
    expect(y.cols.d1.adjm).toBeCloseTo(base.cols.d1.adjm, 9); // downside untouched
  });
});

describe("buildModel — live CP-1 anchor", () => {
  it("re-bases the LTM (l1) and PF columns onto the anchor", () => {
    const m = buildModel(1, {}, ANCHOR);
    for (const k of ["l1", "pf"] as const) {
      const c = m.cols[k];
      expect(c.rev).toBe(ANCHOR.ltmRevenue);
      expect(c.adj).toBe(ANCHOR.ltmAdjEbitda);
      expect(c.ndebt).toBe(ANCHOR.netDebt);
      expect(c.netlev!).toBeCloseTo(ANCHOR.netDebt / ANCHOR.ltmAdjEbitda, 6);
      // cash is back-solved from net debt so ndebt = tdebt - cash stays consistent
      expect(c.tdebt - c.cash).toBeCloseTo(c.ndebt, 6);
    }
  });

  // Finding 4.3: only net leverage is live/live in an anchored column. The other
  // ratios would mix live adj. EBITDA with the SEEDED debt stack / ATLF interest —
  // fabricated committee numbers — so they are nulled, and interest coverage comes
  // from the anchor's engine-reported figure instead.
  it("consumes the anchor's reported interest coverage, not live-adj / seeded-interest", () => {
    const m = buildModel(1, {}, ANCHOR);
    for (const k of ["l1", "pf"] as const) {
      expect(m.cols[k].intcov).toBe(ANCHOR.intCov);
    }
  });

  it("nulls intcov when the anchor reports no coverage (renders —, never fabricates)", () => {
    const m = buildModel(1, {}, { ...ANCHOR, intCov: null });
    expect(m.cols.l1.intcov).toBeNull();
    expect(m.cols.pf.intcov).toBeNull();
  });

  it("nulls the live/seeded mongrel KPIs (totlev / srsec / fcfdebt) in anchored columns", () => {
    const m = buildModel(1, {}, ANCHOR);
    for (const k of ["l1", "pf"] as const) {
      expect(m.cols[k].totlev).toBeNull();
      expect(m.cols[k].srsec).toBeNull();
      expect(m.cols[k].fcfdebt).toBeNull();
      expect(m.cols[k].netlev!).toBeCloseTo(ANCHOR.netDebt / ANCHOR.ltmAdjEbitda, 6); // stays live/live
    }
  });

  it("degrades back-solved cash to NaN when live net debt exceeds the seeded debt stack", () => {
    // seeded l1 tdebt = 55 + 1420 + 900 + 200 = 2575; netDebt 3200 would back-solve cash to -625
    const m = buildModel(1, {}, { ...ANCHOR, netDebt: 3200, netLeverage: 7.1 });
    for (const k of ["l1", "pf"] as const) {
      expect(Number.isNaN(m.cols[k].cash)).toBe(true);
      expect(m.cols[k].ndebt).toBe(3200); // reported net debt survives untouched
    }
  });

  it("preserves the seeded LTM leverage in provenance for the tie-out", () => {
    const seeded = buildModel();
    const anchored = buildModel(1, {}, ANCHOR);
    expect(anchored.provenance.anchored).toBe(true);
    expect(anchored.provenance.seededLtmNetlev).toBeCloseTo(seeded.cols.l1.netlev!, 6);
  });

  it("leaves the forecast (BASE/DOWN) columns identical to the seeded build", () => {
    const seeded = buildModel();
    const anchored = buildModel(1, {}, ANCHOR);
    for (const k of FORECAST) {
      expect(anchored.cols[k].netlev).toBe(seeded.cols[k].netlev);
      expect(anchored.cols[k].rev).toBe(seeded.cols[k].rev);
      expect(anchored.cols[k].fcf).toBe(seeded.cols[k].fcf);
      expect(anchored.cols[k].cash).toBe(seeded.cols[k].cash);
    }
  });

  it("leaves historical columns (FY24/FY25, l0) untouched", () => {
    const seeded = buildModel();
    const anchored = buildModel(1, {}, ANCHOR);
    for (const k of ["f24", "f25", "l0"] as const) {
      expect(anchored.cols[k].rev).toBe(seeded.cols[k].rev);
      expect(anchored.cols[k].adj).toBe(seeded.cols[k].adj);
    }
  });

  // FE 4.3 / E2E-5d: intcov must not be a cross-sourced "mongrel" (live adj.
  // EBITDA ÷ the seeded ATLF interest line). Under a live anchor it either ties
  // to the run's own reported coverage or is suppressed.
  it("ties intcov to the anchor's reported coverage, not the seeded interest line", () => {
    const anchored = buildModel(1, {}, ANCHOR); // ANCHOR.intCov = 2.0x
    for (const k of ["l1", "pf"] as const) {
      const c = anchored.cols[k];
      expect(c.intcov!).toBeCloseTo(ANCHOR.intCov!, 6); // ties to the live figure
      expect(c.adj / c.int).toBeCloseTo(ANCHOR.intCov!, 6); // interest re-based to match
    }
  });

  it("suppresses intcov when the anchor reports no coverage (never a mongrel)", () => {
    const anchored = buildModel(1, {}, { ...ANCHOR, intCov: null });
    for (const k of ["l1", "pf"] as const) {
      expect(anchored.cols[k].intcov).toBeNull();
    }
  });
});
