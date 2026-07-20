import { describe, it, expect } from "vitest";
import { normalizeFy } from "@/components/charts/G2Chart";

// Regression: normalizeFy once walked the whole spec and uppercased the
// encode field name (x:"fy" → x:"FY"), detaching it from the data key so G2
// treated "FY" as a constant and collapsed every period onto one x-category.

describe("normalizeFy", () => {
  it("uppercases fy inside data values but leaves encode field names untouched", () => {
    const spec = {
      type: "interval",
      data: [{ fy: "fy23", s: "Revenue", v: 2801 }],
      encode: { x: "fy", y: "v", color: "s" },
    };
    const out = normalizeFy(spec);
    expect(out.encode).toEqual({ x: "fy", y: "v", color: "s" });
    expect(out.data).toEqual([{ fy: "FY23", s: "Revenue", v: 2801 }]);
  });

  it("keeps data row KEYS verbatim (only values are rewritten)", () => {
    const out = normalizeFy({ data: [{ fy: "fy2024", v: 1 }] });
    expect(Object.keys(out.data[0])).toEqual(["fy", "v"]);
    expect(out.data[0].fy).toBe("FY2024");
  });

  it("normalizes nested view data without touching child encodes (lineSpec shape)", () => {
    const spec = {
      type: "view",
      data: [{ fy: "fy23", v: 6.7 }, { fy: "fy24", v: 6.0 }],
      children: [
        { type: "line", encode: { x: "fy", y: "v" } },
        { type: "point", encode: { x: "fy", y: "v" } },
      ],
    };
    const out = normalizeFy(spec);
    expect(out.children[0].encode.x).toBe("fy");
    expect(out.children[1].encode.x).toBe("fy");
    expect(out.data.map((d: { fy: string }) => d.fy)).toEqual(["FY23", "FY24"]);
  });

  it("normalizes data attached to a child mark", () => {
    const out = normalizeFy({
      type: "view",
      children: [{ type: "line", data: [{ fy: "fy25", v: 1 }], encode: { x: "fy", y: "v" } }],
    });
    expect(out.children[0].data[0].fy).toBe("FY25");
    expect(out.children[0].encode.x).toBe("fy");
  });

  it("leaves already-uppercase labels and non-fy strings alone", () => {
    const out = normalizeFy({
      data: [{ fy: "FY23", s: "Fluid Systems", v: 31 }],
      scale: { color: { domain: ["Revenue"] } },
      axis: { x: { title: false } },
    });
    expect(out.data[0]).toEqual({ fy: "FY23", s: "Fluid Systems", v: 31 });
    expect(out.scale.color.domain).toEqual(["Revenue"]);
  });

  it("preserves an empty object used as a data subtree", () => {
    const data = {};
    const out = normalizeFy({ type: "interval", data });
    expect(out.data).toBe(data);
  });
});
