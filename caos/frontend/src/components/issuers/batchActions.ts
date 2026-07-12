// Batch actions for the Issuer Register's BatchBar (WP-10). Pure, DOM-free
// builders so the sequential-run / read-merge-PUT / CSV-export logic is
// unit-testable without rendering the page. Deliberately just these three —
// no delete/refresh/assign, since no real backing semantics exist for those
// yet (would be a fake blanket action, which BatchBar's contract forbids).

import type { BatchAction } from "@/components/shared/BatchBar";
import { createRun, getWatchlist, saveWatchlist, toErrorMessage } from "@/lib/api";
import { csvCell, downloadCsv } from "@/lib/csv";
import { issuerRating, issuerSector } from "@/lib/issuers";
import type { Issuer } from "@/types/issuers";

// BatchBar itself awaits each selected id in turn (sequential — routes/runs.py
// rate-limits POST /api/runs per analyst, so firing these concurrently would
// just trade a slow batch for a 429 storm). A fresh Idempotency-Key per issuer
// lets a dropped-response retry land on the SAME run instead of creating a
// duplicate (routes/runs.py _idempotency_lookup) — one key per issuer, since
// each issuer's run is a genuinely distinct request, not a retry of another.
export function runPipelineAction(n: number): BatchAction {
  return {
    id: "run-pipeline",
    label: `Run pipeline (${n})`,
    run: async (issuerId: string) => {
      try {
        await createRun(issuerId, undefined, undefined, crypto.randomUUID());
      } catch (err) {
        // Re-thrown with the server's verbatim detail (e.g. the 429 rate-limit
        // message) rather than axios's generic "Request failed with status
        // code 429" — BatchBar reports err.message as that item's outcome.
        throw new Error(toErrorMessage(err, "Run failed"));
      }
    },
  };
}

// One read-merge-PUT for the whole batch, not one per selected id. BatchBar's
// contract still calls run(id) once per selection, so every id is handed the
// SAME in-flight promise — built on the first call, reused (not re-triggered)
// by the rest — which gives the batch one shared success/failure outcome.
export function addToWatchlistAction(selected: string[]): BatchAction {
  let shared: Promise<void> | null = null;
  const merge = async () => {
    const current = await getWatchlist();
    const merged = Array.from(new Set([...current.issuer_ids, ...selected]));
    await saveWatchlist(merged);
  };
  return {
    id: "add-watchlist",
    label: `Add to watchlist (${selected.length})`,
    run: async () => {
      if (!shared) {
        shared = merge().catch((err) => {
          throw new Error(toErrorMessage(err, "Couldn't update the watchlist"));
        });
      }
      return shared;
    },
  };
}

const CSV_COLUMNS = ["Ticker", "Issuer", "Rating", "Sector", "Sub-sector", "Country"];

function issuerCsvRow(issuer: Issuer): string {
  return [
    issuer.ticker?.slice(0, 5).toUpperCase() || "",
    issuer.name,
    issuerRating(issuer),
    issuerSector(issuer),
    issuer.sub_sector || "",
    issuer.country || "",
  ].map(csvCell).join(",");
}

export function issuersToCsv(rows: Issuer[]): string {
  return [CSV_COLUMNS.map(csvCell).join(","), ...rows.map(issuerCsvRow)].join("\n");
}

// Pure client-side — no server call, so no per-item network outcome to honestly
// report; it either builds+downloads the file or throws (Blob/anchor failure).
export function exportCsvAction(rows: Issuer[]): BatchAction {
  let downloaded = false;
  return {
    id: "export-csv",
    label: "Export CSV",
    run: async () => {
      if (!downloaded) {
        downloaded = true;
        downloadCsv(`caos-issuers-${new Date().toISOString().slice(0, 10)}.csv`, issuersToCsv(rows));
      }
    },
  };
}
