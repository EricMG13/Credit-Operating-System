export function csvCell(v: unknown): string {
  if (v == null) return "";
  // Numbers pass through as numerics (negative figures must stay numbers in the
  // sheet); a non-finite value has no meaningful cell value — emit empty.
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  let s = String(v);
  // CSV-injection guard (matrix 6.8): a leading =, +, -, @ (or tab/CR) makes
  // Excel/Sheets execute the cell as a formula. Untrusted labels and override
  // values are not trusted spreadsheet code — neutralize with a leading quote.
  if (/^[=+\-@\t\r\n]/.test(s)) s = "'" + s;
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
