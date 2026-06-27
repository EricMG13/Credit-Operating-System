import { describe, expect, it } from "vitest";
import { buildReports } from "./builders";

// review run-2 #F2/#F1: the Credit Snapshot capital-structure table must tie to the
// canonical CP-3B structure (total debt 3,270), and each subtotal's Multiple must be
// its own outstanding / EBITDA — not total leverage copied onto the sub-layer row.
describe("creditSnapshot capital structure", () => {
  const snapshot = buildReports().find((r) => r.id === "snapshot")!;
  const capTable = snapshot.sections.find(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (s: any) => s.t === "table" && s.title === "CAPITAL STRUCTURE",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rowFor = (label: string) => capTable.rows.find((r: any) => r.cells?.[0] === label);

  it("ties total debt to the canonical 3,270, not the ad-hoc seed (2,575)", () => {
    const total = rowFor("Total debt");
    expect(Number(total.cells[6].replace(/,/g, ""))).toBe(3270); // 120 + 1850 + 900 + 400
  });

  it("subordinated subtotal shows its OWN multiple, strictly below total leverage", () => {
    const sub = rowFor("Unsecured / subordinated");
    const total = rowFor("Total debt");
    const mult = (c: string) => Number(c.replace("x", ""));
    expect(mult(sub.cells[7])).toBeLessThan(mult(total.cells[7]));
    expect(sub.cells[7]).not.toBe(total.cells[7]);
  });
});
