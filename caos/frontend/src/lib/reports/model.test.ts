import { describe, expect, it } from "vitest";
import { buildModel } from "./model";
import type { ModelAnchor } from "@/lib/engine/modelAnchor";

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
