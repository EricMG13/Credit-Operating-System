// @vitest-environment jsdom
//
// Regression for matrix 4.2 (ATLF lineage residue): the FormulaBar must not
// present the seeded Atlas Forge lineage — SRC chips, the L-04 warn flag, E-xx
// evidence chips, ATLF refNote tails ($184M, RP basket, bridge story), or the
// G-02 derived-period narrative — for a LIVE issuer (isReference={false}).
// The matrix recorded that this suppression path had zero tests, which is how
// the residue survived the 99ada2f gating pass.
import { describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { FormulaBar } from "./ModelSheet";
import { buildModel } from "@/lib/reports/model";

const model = buildModel();
const noop = vi.fn();

function bar(sel: { row: string; col: string }, isReference: boolean) {
  return render(
    <FormulaBar
      model={model}
      sel={sel}
      overrides={{}}
      onResetCell={noop}
      onOpenEvidence={noop}
      showQ={true}
      collapsedRows={new Set()}
      isReference={isReference}
    />,
  );
}

describe("FormulaBar lineage gating (matrix 4.2)", () => {
  it("live issuer: no SRC chip, no L-04 warn, no evidence chips on a sourced row", () => {
    bar({ row: "int", col: "l1" }, false);
    expect(screen.queryByText("CP-2F T2F.2")).toBeNull();
    expect(screen.queryByText("L-04")).toBeNull();
    expect(screen.queryByText(/hedging register absent/)).toBeNull();
    // generic formula mechanics stay
    expect(screen.getByText(/Cash interest = Σ instrument balance/)).toBeTruthy();
  });

  it("reference issuer keeps the full ATLF lineage on the same row", () => {
    bar({ row: "int", col: "l1" }, true);
    expect(screen.getByText("CP-2F T2F.2")).toBeTruthy();
    expect(screen.getByText("L-04")).toBeTruthy();
    expect(screen.getByText(/hedging register absent \(L-04\)/)).toBeTruthy();
  });

  it("live issuer: ATLF refNote tails ($184M register, bridge story) are suppressed", () => {
    bar({ row: "cash", col: "l1" }, false);
    expect(screen.getByText(/Cash rolls forward from NCF/)).toBeTruthy();
    expect(screen.queryByText(/\$184M/)).toBeNull();

    cleanup();
    bar({ row: "ssn", col: "l1" }, false);
    // refNote-only row falls back to the plain-source line
    expect(screen.getByText(/sourced from model logic/)).toBeTruthy();
    expect(screen.queryByText(/2L bridge to May-26/)).toBeNull();
  });

  it("live issuer: derived column shows a generic marker, not the ATLF G-02 story", () => {
    const derivedCol = model.columns.find((c) => model.cols[c.key]?.derived);
    expect(derivedCol).toBeTruthy(); // grid template hardcodes one derived period
    bar({ row: "rev", col: derivedCol!.key }, false);
    expect(screen.getAllByText(/derived period/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/G-02/)).toBeNull();
    expect(screen.queryByText(/Q4-25 management accounts/)).toBeNull();
  });
});
