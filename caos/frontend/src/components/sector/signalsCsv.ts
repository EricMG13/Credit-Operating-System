// Client-side-only CSV export for a batch of selected Sector Review signals
// (P2-WP-7). No server call — reuses the shared csvCell/downloadCsv helpers
// (src/lib/csv.ts) rather than a bespoke exporter, same pattern as
// src/lib/query/export.ts.

import type { SectorSignal } from "@/lib/api";
import { csvCell, downloadCsv } from "@/lib/csv";

const HEADER = ["id", "sector", "category", "severity", "headline", "materiality_score", "signal_date", "issuers", "provenance"];

export function signalsToCsv(signals: SectorSignal[]): string {
  const lines: string[] = [];
  lines.push(HEADER.map(csvCell).join(","));
  signals.forEach((s) => {
    lines.push(
      [
        s.id,
        s.sector,
        s.category,
        s.severity,
        s.headline,
        s.materiality_score,
        s.signal_date,
        s.issuers.map((i) => i.ticker || i.name).join("; "),
        s.provenance,
      ]
        .map(csvCell)
        .join(","),
    );
  });
  return lines.join("\n");
}

export function downloadSignalsCsv(sector: string, signals: SectorSignal[]): void {
  downloadCsv("CAOS Sector Review - " + sector.replace(/[^\w.-]+/g, "_") + ".csv", signalsToCsv(signals));
}
