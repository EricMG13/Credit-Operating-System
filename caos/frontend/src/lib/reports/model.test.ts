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
});
