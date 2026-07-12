// Model grid export (port of design bundle concept-d.jsx exportXlsx).
//
// The design prototype used SheetJS for a true .xlsx with number formats and a
// separate Overrides sheet. We ship a dependency-free CSV export (opens in
// Excel) with the same content: header rows, every model row, and an overrides
// appendix. To upgrade to real .xlsx, `npm i xlsx` and swap the body of
// `exportModel` for the SheetJS path from the design prototype.

import type { Model } from "@/lib/reports/model";
import type { Overrides } from "@/lib/reports/model";
import { ROWS } from "./rows";
import { GROUPS_META } from "./model-format";
import { csvCell, downloadCsv } from "@/lib/csv";

export function exportModel(
  model: Model,
  showQ: boolean,
  overrides: Overrides,
  meta: { header: string; subheader: string; filename: string },
): void {
  const colDefs = model.columns
    .filter((c) => showQ || c.group !== "Q")
    .map((c) => ({ ...c, ctx: model.cols[c.key] }));

  const round3 = (v: number | null | undefined): string | number =>
    v == null || Number.isNaN(v) ? "" : Math.round(v * 1000) / 1000;

  const lines: string[] = [];
  lines.push([meta.header, ...colDefs.map((c) => GROUPS_META[c.group])].map(csvCell).join(","));
  lines.push([meta.subheader, ...colDefs.map((c) => c.ctx.label + (c.ctx.derived ? "*" : ""))].map(csvCell).join(","));

  ROWS.forEach((row) => {
    if (row.sec) {
      lines.push(csvCell(row.sec));
      return;
    }
    // percent-format rows exported as decimals (matches the design's raw values)
    const cells = colDefs.map((c) => round3(row.g!(c.ctx)));
    lines.push([(row.ind ? "   " : "") + row.l + (row.sub ? " (" + row.sub + ")" : ""), ...cells].map(csvCell).join(","));
  });

  const ovKeys = Object.keys(overrides || {});
  if (ovKeys.length) {
    const labels: Record<string, string> = {
      rev: "Revenues", adj: "Adj. EBITDA", ab: "Adjustments", int: "Cash interest",
      tax: "Cash taxes", wc: "Changes in WC", capex: "Capex", diss: "Debt issue/(repay)", div: "Dividends",
    };
    lines.push("");
    lines.push(csvCell("Manual overrides — historical inputs"));
    lines.push(["Period", "Account", "Override value ($m, model basis)"].map(csvCell).join(","));
    ovKeys.forEach((k) => {
      const p = k.split(":");
      const ctx = model.cols[p[0]];
      lines.push([
        ctx ? ctx.label + (ctx.kind === "q" ? " (Q)" : " (FY)") : p[0],
        labels[p[1]] || p[1],
        overrides[k],
      ].map(csvCell).join(","));
    });
  }

  downloadCsv(meta.filename, lines.join("\n"));
}
